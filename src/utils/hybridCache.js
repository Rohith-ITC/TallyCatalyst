// Hybrid cache implementation - OPFS with IndexedDB fallback
import Dexie from 'dexie';

// Date range utility functions
class DateRangeUtils {
  // Check if two date ranges overlap
  static dateRangesOverlap(range1, range2) {
    const start1 = new Date(range1.startDate);
    const end1 = new Date(range1.endDate);
    const start2 = new Date(range2.startDate);
    const end2 = new Date(range2.endDate);
    
    return start1 <= end2 && start2 <= end1;
  }

  // Check if a date is within a range
  static dateInRange(date, range) {
    const d = new Date(date);
    const start = new Date(range.startDate);
    const end = new Date(range.endDate);
    return d >= start && d <= end;
  }

  // Get gaps between request range and cached ranges
  static getDateRangeGaps(requestRange, cachedRanges) {
    const gaps = [];
    const requestStart = new Date(requestRange.startDate);
    const requestEnd = new Date(requestRange.endDate);
    
    // Sort cached ranges by start date
    const sorted = [...cachedRanges].sort((a, b) => 
      new Date(a.startDate) - new Date(b.startDate)
    );
    
    let currentPos = requestStart;
    
    for (const cached of sorted) {
      const cachedStart = new Date(cached.startDate);
      const cachedEnd = new Date(cached.endDate);
      
      // If there's a gap before this cached range
      if (currentPos < cachedStart) {
        gaps.push({
          startDate: this.formatDate(currentPos),
          endDate: this.formatDate(new Date(cachedStart.getTime() - 1))
        });
      }
      
      // Move current position to after this cached range
      if (cachedEnd > currentPos) {
        currentPos = new Date(cachedEnd.getTime() + 1);
      }
    }
    
    // If there's a gap after all cached ranges
    if (currentPos <= requestEnd) {
      gaps.push({
        startDate: this.formatDate(currentPos),
        endDate: this.formatDate(requestEnd)
      });
    }
    
    return gaps;
  }

  // Merge overlapping or adjacent date ranges
  static mergeDateRanges(ranges) {
    if (ranges.length === 0) return [];
    
    const sorted = [...ranges].sort((a, b) => 
      new Date(a.startDate) - new Date(b.startDate)
    );
    
    const merged = [sorted[0]];
    
    for (let i = 1; i < sorted.length; i++) {
      const current = sorted[i];
      const last = merged[merged.length - 1];
      
      const currentStart = new Date(current.startDate);
      const lastEnd = new Date(last.endDate);
      
      // If overlapping or adjacent (within 1 day), merge
      if (currentStart <= new Date(lastEnd.getTime() + 24 * 60 * 60 * 1000)) {
        last.endDate = current.endDate > last.endDate ? current.endDate : last.endDate;
      } else {
        merged.push(current);
      }
    }
    
    return merged;
  }

  // Split request range into cached parts and missing gaps
  static splitDateRangeIntoGaps(requestRange, cachedRanges) {
    const requestStart = new Date(requestRange.startDate);
    const requestEnd = new Date(requestRange.endDate);
    
    // Filter cached ranges that overlap with request
    const overlapping = cachedRanges.filter(cached => 
      this.dateRangesOverlap(requestRange, cached)
    );
    
    if (overlapping.length === 0) {
      return {
        cached: [],
        gaps: [requestRange]
      };
    }
    
    // Get gaps
    const gaps = this.getDateRangeGaps(requestRange, overlapping);
    
    // Get cached ranges that are within request range
    const cached = overlapping.map(cached => ({
      startDate: cached.startDate < requestRange.startDate ? requestRange.startDate : cached.startDate,
      endDate: cached.endDate > requestRange.endDate ? requestRange.endDate : cached.endDate,
      data: cached.data
    }));
    
    return { cached, gaps };
  }

  // Format date to YYYY-MM-DD
  static formatDate(date) {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // Parse date range from cache key
  static parseDateRangeFromCacheKey(cacheKey) {
    // Cache key format: baseKey_startDate_endDate
    const parts = cacheKey.split('_');
    if (parts.length >= 2) {
      const endDate = parts[parts.length - 1];
      const startDate = parts[parts.length - 2];
      // Check if they look like dates (YYYY-MM-DD format)
      if (/^\d{4}-\d{2}-\d{2}$/.test(startDate) && /^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
        return { startDate, endDate };
      }
    }
    return null;
  }
}

// Shared encryption utilities
class EncryptionUtils {
  constructor(opfsRoot = null, indexedDB = null) {
    this.opfsRoot = opfsRoot;
    this.indexedDB = indexedDB; // Dexie database instance
  }

  // Validate if a string is valid base64
  isValidBase64(str) {
    if (!str || typeof str !== 'string') return false;
    // Remove whitespace and newlines
    const cleaned = str.replace(/\s/g, '');
    if (cleaned.length === 0) return false;
    // Base64 regex: only contains A-Z, a-z, 0-9, +, /, and = for padding
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    // Check if it matches base64 pattern
    if (!base64Regex.test(cleaned)) return false;
    // Check length is multiple of 4 (after padding) - but be lenient for very long strings
    // Some base64 strings might have extra padding that we can handle
    const paddingLength = (cleaned.match(/=/g) || []).length;
    const baseLength = cleaned.length - paddingLength;
    return baseLength > 0 && (baseLength % 4 === 0 || (baseLength % 4 === paddingLength && paddingLength <= 2));
  }

  // Clean and normalize base64 string
  cleanBase64(str) {
    if (!str || typeof str !== 'string') return str;
    // Remove all whitespace, newlines, and other non-base64 characters
    return str.replace(/[^A-Za-z0-9+/=]/g, '');
  }

  // Get or create salt for user email (stored in OPFS or IndexedDB)
  async getUserSalt(email) {
    if (!email) {
      throw new Error('Email is required for cache encryption');
    }

    try {
      // Try OPFS first if available
      if (this.opfsRoot) {
        try {
          // Read user keys file from OPFS
          const keysDir = await this.opfsRoot.getDirectoryHandle('keys', { create: true });
          const sanitizedEmail = email.replace(/[^a-zA-Z0-9_-]/g, '_');
          const keyFileName = `${sanitizedEmail}.json`;
          
          let userKey = null;
          try {
            const keyFile = await keysDir.getFileHandle(keyFileName);
            const file = await keyFile.getFile();
            const content = await file.text();
            userKey = JSON.parse(content);
          } catch (err) {
            // File doesn't exist, will create it
          }
          
          if (!userKey) {
            // Generate a new salt for this user
            const salt = crypto.getRandomValues(new Uint8Array(16));
            const saltBase64 = btoa(String.fromCharCode(...salt));
            
            userKey = {
              email: email,
              salt: saltBase64
            };
            
            // Write to OPFS
            const keyFile = await keysDir.getFileHandle(keyFileName, { create: true });
            const writable = await keyFile.createWritable();
            await writable.write(JSON.stringify(userKey));
            await writable.close();
          }
          
          return userKey.salt;
        } catch (error) {
          console.warn('OPFS salt retrieval failed, falling back to IndexedDB:', error);
          // Fall through to IndexedDB
        }
      }

      // Fall back to IndexedDB if OPFS is not available or failed
      if (this.indexedDB) {
        let userKey = await this.indexedDB.userKeys.get(email);
        
        if (!userKey) {
          // Generate a new salt for this user
          const salt = crypto.getRandomValues(new Uint8Array(16));
          const saltBase64 = btoa(String.fromCharCode(...salt));
          
          userKey = {
            email: email,
            salt: saltBase64
          };
          
          // Write to IndexedDB
          await this.indexedDB.userKeys.put(userKey);
        }
        
        return userKey.salt;
      }

      throw new Error('Neither OPFS root nor IndexedDB database is available for salt storage');
    } catch (error) {
      console.error('Error getting user salt:', error);
      throw error;
    }
  }

  // Check if Web Crypto API is available
  isCryptoAvailable() {
    return typeof crypto !== 'undefined' && 
           crypto !== null && 
           typeof crypto.subtle !== 'undefined' && 
           crypto.subtle !== null;
  }

  // Derive encryption key from email + salt (stable across token refreshes)
  async getEncryptionKey() {
    const email = sessionStorage.getItem('email');
    if (!email) {
      throw new Error('No user email found - cannot access encrypted cache');
    }

    // Check if crypto.subtle is available
    if (!this.isCryptoAvailable()) {
      const isSecureContext = window.isSecureContext || 
                             window.location.protocol === 'https:' || 
                             window.location.hostname === 'localhost' || 
                             window.location.hostname === '127.0.0.1';
      
      if (!isSecureContext) {
        console.warn('⚠️ Web Crypto API not available (not a secure context). Cache encryption disabled.');
        console.warn('⚠️ For production, use HTTPS. For development, access via localhost or use HTTPS.');
        // Return a dummy key for development - data will be stored unencrypted
        // This is acceptable for development but should never happen in production
        return new ArrayBuffer(32); // 32 bytes for AES-256
      } else {
        throw new Error('Web Crypto API (crypto.subtle) is not available in this browser. Cache encryption cannot be used.');
      }
    }

    try {
      const salt = await this.getUserSalt(email);
      
      // Combine email and salt
      const encoder = new TextEncoder();
      const emailData = encoder.encode(email);
      const saltData = Uint8Array.from(atob(salt), c => c.charCodeAt(0));
      
      // Combine email + salt
      const combined = new Uint8Array(emailData.length + saltData.length);
      combined.set(emailData);
      combined.set(saltData, emailData.length);
      
      // Hash to get encryption key
      const hashBuffer = await crypto.subtle.digest('SHA-256', combined);
      return hashBuffer;
    } catch (error) {
      console.error('Error deriving encryption key:', error);
      throw error;
    }
  }

  // Encrypt data with compression and optimized processing
  async encryptData(data) {
    try {
      const startTime = performance.now();
      
      // Check if crypto is available
      if (!this.isCryptoAvailable()) {
        const isSecureContext = window.isSecureContext || 
                               window.location.protocol === 'https:' || 
                               window.location.hostname === 'localhost' || 
                               window.location.hostname === '127.0.0.1';
        
        if (!isSecureContext) {
          // For development on HTTP, store data unencrypted (base64 encoded)
          console.warn('⚠️ Storing data unencrypted (development mode - HTTP)');
          const jsonString = JSON.stringify(data);
          return btoa(unescape(encodeURIComponent(jsonString))); // Base64 encode
        } else {
          throw new Error('Web Crypto API not available. Cannot encrypt cache data.');
        }
      }

      // Step 1: Compress data first (reduces size significantly for JSON)
      const compressStart = performance.now();
      const compressedBuffer = await this.compressData(data);
      const compressTime = performance.now() - compressStart;
      console.log(`📦 Compression: ${(compressedBuffer.byteLength / 1024).toFixed(2)} KB in ${compressTime.toFixed(2)}ms`);

      // Step 2: Get encryption key
      const keyBuffer = await this.getEncryptionKey();
      const key = await crypto.subtle.importKey(
        'raw',
        keyBuffer,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt']
      );

      // Step 3: Encrypt compressed data
      const encryptStart = performance.now();
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        compressedBuffer
      );
      const encryptTime = performance.now() - encryptStart;
      console.log(`🔐 Encryption: ${(encrypted.byteLength / 1024).toFixed(2)} KB in ${encryptTime.toFixed(2)}ms`);

      // Step 4: Combine IV and encrypted data
      const combined = new Uint8Array(iv.length + encrypted.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(encrypted), iv.length);

      // Step 5: Convert to base64 (yield to browser periodically for large data)
      const base64Start = performance.now();
      let result;
      if (combined.length > 1024 * 1024) { // > 1MB, use chunked base64
        result = await this.arrayBufferToBase64Chunked(combined.buffer);
      } else {
        result = this.arrayBufferToBase64(combined.buffer);
      }
      const base64Time = performance.now() - base64Start;
      
      const totalTime = performance.now() - startTime;
      console.log(`📝 Base64 encoding: ${(result.length / 1024).toFixed(2)} KB in ${base64Time.toFixed(2)}ms`);
      console.log(`⚡ Total encryption time: ${totalTime.toFixed(2)}ms (${(combined.length / 1024 / 1024).toFixed(2)} MB)`);
      
      return result;
    } catch (error) {
      console.error('Encryption error:', error);
      throw error;
    }
  }

  // Chunked base64 encoding with yield points for large data
  async arrayBufferToBase64Chunked(buffer) {
    const bytes = new Uint8Array(buffer);
    const chunkSize = 1024 * 1024; // 1MB chunks
    const chunks = [];
    
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.slice(i, Math.min(i + chunkSize, bytes.length));
      chunks.push(this.arrayBufferToBase64(chunk.buffer));
      
      // Yield to browser every chunk to prevent blocking
      if (i + chunkSize < bytes.length) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    
    return chunks.join('');
  }

  // Helper function to convert ArrayBuffer to base64 efficiently
  // Optimized version using Uint8Array directly with chunked processing
  arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    const chunkSize = 16384; // Increased chunk size for better performance (16KB)
    let binary = '';
    
    // Use chunked processing to avoid blocking the main thread
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.slice(i, Math.min(i + chunkSize, bytes.length));
      // Use String.fromCharCode.apply for better performance on large chunks
      binary += String.fromCharCode.apply(null, chunk);
    }
    
    return btoa(binary);
  }

  // Compress data using native CompressionStream API (available in modern browsers)
  async compressData(data) {
    try {
      // Check if CompressionStream is available
      if (typeof CompressionStream === 'undefined') {
        console.warn('CompressionStream not available, skipping compression');
        // Fallback to uncompressed
        const jsonString = JSON.stringify(data);
        const encoder = new TextEncoder();
        return encoder.encode(jsonString).buffer;
      }

      const jsonString = JSON.stringify(data);
      const encoder = new TextEncoder();
      const dataStream = new Blob([encoder.encode(jsonString)]).stream();
      
      const compressedStream = dataStream.pipeThrough(new CompressionStream('gzip'));
      const compressedBlob = await new Response(compressedStream).blob();
      const compressedArrayBuffer = await compressedBlob.arrayBuffer();
      
      const originalSize = new TextEncoder().encode(jsonString).length;
      const compressedSize = compressedArrayBuffer.byteLength;
      const compressionRatio = ((1 - compressedSize / originalSize) * 100).toFixed(1);
      console.log(`📦 Compression: ${(originalSize / 1024).toFixed(2)} KB → ${(compressedSize / 1024).toFixed(2)} KB (${compressionRatio}% reduction)`);
      
      return compressedArrayBuffer;
    } catch (error) {
      console.warn('Compression failed, using uncompressed data:', error);
      // Fallback to uncompressed
      const jsonString = JSON.stringify(data);
      const encoder = new TextEncoder();
      return encoder.encode(jsonString).buffer;
    }
  }

  // Decompress data using native DecompressionStream API
  async decompressData(compressedBuffer) {
    try {
      // Check if DecompressionStream is available
      if (typeof DecompressionStream === 'undefined') {
        console.warn('DecompressionStream not available, assuming uncompressed');
        const decoder = new TextDecoder();
        return JSON.parse(decoder.decode(new Uint8Array(compressedBuffer)));
      }

      const compressedStream = new Blob([compressedBuffer]).stream();
      const decompressedStream = compressedStream.pipeThrough(new DecompressionStream('gzip'));
      const decompressedBlob = await new Response(decompressedStream).blob();
      const decompressedArrayBuffer = await decompressedBlob.arrayBuffer();
      const decoder = new TextDecoder();
      return JSON.parse(decoder.decode(decompressedArrayBuffer));
    } catch (error) {
      // Try as uncompressed data
      try {
        const decoder = new TextDecoder();
        return JSON.parse(decoder.decode(new Uint8Array(compressedBuffer)));
      } catch (e) {
        console.error('Decompression failed:', error);
        throw error;
      }
    }
  }

  // Decrypt data with decompression support
  async decryptData(encryptedBase64) {
    try {
      const startTime = performance.now();
      
      // Check if crypto is available
      if (!this.isCryptoAvailable()) {
        const isSecureContext = window.isSecureContext || 
                               window.location.protocol === 'https:' || 
                               window.location.hostname === 'localhost' || 
                               window.location.hostname === '127.0.0.1';
        
        if (!isSecureContext) {
          // For development on HTTP, data is stored as base64 encoded JSON
          console.warn('⚠️ Decrypting unencrypted data (development mode - HTTP)');
          try {
            const jsonString = decodeURIComponent(escape(atob(encryptedBase64)));
            return JSON.parse(jsonString);
          } catch (error) {
            // If base64 decode fails, try as encrypted data (might be from HTTPS session)
            console.warn('⚠️ Failed to decode as unencrypted, might be encrypted data');
            return null;
          }
        } else {
          throw new Error('Web Crypto API not available. Cannot decrypt cache data.');
        }
      }

      const keyBuffer = await this.getEncryptionKey();
      const key = await crypto.subtle.importKey(
        'raw',
        keyBuffer,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );

      // Clean base64 string (remove whitespace, newlines, etc.)
      let cleanedBase64 = this.cleanBase64(encryptedBase64);
      
      // Log validation status but don't fail - try to decode anyway
      const isValid = this.isValidBase64(cleanedBase64);
      if (!isValid) {
        console.warn('⚠️ Base64 validation failed, but attempting decode anyway (data might still be valid)');
      }

      // Decode from base64 - optimized for large data
      const base64Start = performance.now();
      let bytes;
      try {
        if (cleanedBase64.length > 1024 * 1024) { // > 1MB, use chunked decoding
          bytes = await this.base64ToArrayBufferChunked(cleanedBase64);
        } else {
          const binaryString = atob(cleanedBase64);
          bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
        }
      } catch (error) {
        console.error('⚠️ Base64 decoding failed even after cleaning:', error);
        // Try with original string as last resort (in case cleaning removed important characters)
        if (cleanedBase64 !== encryptedBase64) {
          try {
            console.log('🔄 Attempting decode with original string...');
            if (encryptedBase64.length > 1024 * 1024) {
              bytes = await this.base64ToArrayBufferChunked(encryptedBase64);
            } else {
              const binaryString = atob(encryptedBase64);
              bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
            }
            console.log('✅ Decode succeeded with original string');
          } catch (retryError) {
            console.error('❌ Base64 decoding failed with both cleaned and original strings:', retryError);
            return null;
          }
        } else {
          return null;
        }
      }
      const base64Time = performance.now() - base64Start;
      console.log(`📝 Base64 decoding: ${(bytes.length / 1024).toFixed(2)} KB in ${base64Time.toFixed(2)}ms`);
      
      // Check if this looks like encrypted data (has IV) or unencrypted base64
      // Encrypted data starts with 12-byte IV, so if length < 12, it's probably unencrypted
      if (bytes.length < 12) {
        // Try as unencrypted base64
        try {
          const jsonString = decodeURIComponent(escape(encryptedBase64));
          return JSON.parse(jsonString);
        } catch {
          return null;
        }
      }
      
      // Extract IV and encrypted data
      const iv = bytes.slice(0, 12);
      const encrypted = bytes.slice(12);

      // Decrypt
      const decryptStart = performance.now();
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        encrypted
      );
      const decryptTime = performance.now() - decryptStart;
      console.log(`🔓 Decryption: ${(decrypted.byteLength / 1024).toFixed(2)} KB in ${decryptTime.toFixed(2)}ms`);

      // Decompress (handles both compressed and uncompressed data)
      const decompressStart = performance.now();
      const decompressed = await this.decompressData(decrypted);
      const decompressTime = performance.now() - decompressStart;
      
      const totalTime = performance.now() - startTime;
      console.log(`📦 Decompression: ${decompressTime.toFixed(2)}ms`);
      console.log(`⚡ Total decryption time: ${totalTime.toFixed(2)}ms`);
      
      return decompressed;
    } catch (error) {
      console.error('Decryption error:', error);
      // If decryption fails, check if it's a base64 error
      if (error.message && (error.message.includes('base64') || error.message.includes('InvalidCharacterError'))) {
        console.warn('⚠️ Corrupted cache data detected (invalid base64), returning null');
        console.warn('⚠️ Cache file may need to be deleted and re-downloaded');
        return null;
      }
      // If decryption fails (e.g., wrong user or unencrypted data), try as unencrypted
      // Try with cleaned base64 first
      const cleanedBase64 = this.cleanBase64(encryptedBase64);
      if (cleanedBase64 && cleanedBase64.length > 0) {
        try {
          const binaryString = atob(cleanedBase64);
          const jsonString = decodeURIComponent(escape(binaryString));
          return JSON.parse(jsonString);
        } catch {
          // Try with original if cleaned didn't work
          try {
            const binaryString = atob(encryptedBase64);
            const jsonString = decodeURIComponent(escape(binaryString));
            return JSON.parse(jsonString);
          } catch {
            return null;
          }
        }
      }
      return null;
    }
  }

  // Chunked base64 to ArrayBuffer conversion with yield points
  async base64ToArrayBufferChunked(base64) {
    // Clean the base64 string first
    const cleanedBase64 = this.cleanBase64(base64);
    
    // Try to validate, but don't fail if validation fails - attempt decode anyway
    if (!this.isValidBase64(cleanedBase64)) {
      console.warn('⚠️ Base64 validation failed, but attempting decode anyway');
    }

    // Base64 must be decoded in groups of 4 characters
    // Round chunk size down to nearest multiple of 4 to avoid splitting mid-group
    const chunkSizeBase = 1024 * 1024; // 1MB base
    const chunkSize = Math.floor(chunkSizeBase / 4) * 4; // Round down to multiple of 4
    
    const totalLength = Math.ceil(cleanedBase64.length * 3 / 4);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    let currentPos = 0;
    
    try {
      while (currentPos < cleanedBase64.length) {
        // Calculate chunk end - ensure it's aligned to 4-character boundary
        let chunkEnd = Math.min(currentPos + chunkSize, cleanedBase64.length);
        
        // If not at the end, round down to nearest multiple of 4
        if (chunkEnd < cleanedBase64.length) {
          chunkEnd = Math.floor((chunkEnd - currentPos) / 4) * 4 + currentPos;
        }
        
        // If chunk would be empty, break
        if (chunkEnd <= currentPos) {
          break;
        }
        
        const chunk = cleanedBase64.slice(currentPos, chunkEnd);
        
        // Try to decode chunk
        try {
          const binaryString = atob(chunk);
          const chunkBytes = new Uint8Array(binaryString.length);
          for (let j = 0; j < binaryString.length; j++) {
            chunkBytes[j] = binaryString.charCodeAt(j);
          }
          result.set(chunkBytes, offset);
          offset += chunkBytes.length;
        } catch (chunkError) {
          // If chunk decode fails, the data might be corrupted at this position
          console.error(`❌ Failed to decode base64 chunk at position ${currentPos}:`, chunkError);
          throw new Error(`Invalid base64 chunk at position ${currentPos}: ${chunkError.message}`);
        }
        
        // Move to next chunk
        currentPos = chunkEnd;
        
        // Yield to browser every chunk (except last)
        if (currentPos < cleanedBase64.length) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }
      
      // Trim result to actual decoded length
      if (offset < result.length) {
        return result.slice(0, offset);
      }
      
      return result;
    } catch (error) {
      console.error('Error in base64ToArrayBufferChunked:', error);
      throw new Error(`Base64 decoding failed: ${error.message}`);
    }
  }
}

// OPFS Backend - stores encrypted data in Origin Private File System
class OPFSBackend {
  constructor(encryptionUtils) {
    this.encryption = encryptionUtils;
    this.root = null;
    this.initialized = false;
    this.metadataCache = new Map(); // In-memory cache for metadata
    this.metadataSaveTimer = null; // Timer for deferred metadata saves
  }

  // Load metadata from OPFS
  async loadMetadata() {
    try {
      const metadataDir = await this.root.getDirectoryHandle('metadata', { create: true });
      const salesFile = await metadataDir.getFileHandle('sales.json', { create: true });
      const dashboardFile = await metadataDir.getFileHandle('dashboard.json', { create: true });
      
      try {
        const salesContent = await (await salesFile.getFile()).text();
        if (salesContent) {
          const salesData = JSON.parse(salesContent);
          this.metadataCache.set('sales', new Map(salesData));
        } else {
          this.metadataCache.set('sales', new Map());
        }
      } catch {
        this.metadataCache.set('sales', new Map());
      }
      
      try {
        const dashboardContent = await (await dashboardFile.getFile()).text();
        if (dashboardContent) {
          const dashboardData = JSON.parse(dashboardContent);
          this.metadataCache.set('dashboard', new Map(dashboardData));
        } else {
          this.metadataCache.set('dashboard', new Map());
        }
      } catch {
        this.metadataCache.set('dashboard', new Map());
      }
    } catch (error) {
      console.error('Error loading metadata:', error);
      this.metadataCache.set('sales', new Map());
      this.metadataCache.set('dashboard', new Map());
    }
  }

  // Save metadata to OPFS
  async saveMetadata() {
    try {
      const metadataDir = await this.root.getDirectoryHandle('metadata', { create: true });
      
      // Save sales metadata
      const salesMap = this.metadataCache.get('sales') || new Map();
      const salesData = Array.from(salesMap.entries());
      const salesFile = await metadataDir.getFileHandle('sales.json', { create: true });
      const salesWritable = await salesFile.createWritable();
      await salesWritable.write(JSON.stringify(salesData));
      await salesWritable.close();
      
      // Save dashboard metadata
      const dashboardMap = this.metadataCache.get('dashboard') || new Map();
      const dashboardData = Array.from(dashboardMap.entries());
      const dashboardFile = await metadataDir.getFileHandle('dashboard.json', { create: true });
      const dashboardWritable = await dashboardFile.createWritable();
      await dashboardWritable.write(JSON.stringify(dashboardData));
      await dashboardWritable.close();
    } catch (error) {
      console.error('Error saving metadata:', error);
    }
  }

  async init() {
    if (this.initialized) return;
    
    try {
      // Check for secure context (HTTPS or localhost)
      const isSecureContext = window.isSecureContext || window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      
      if (!isSecureContext) {
        throw new Error('OPFS requires secure context (HTTPS or localhost)');
      }
      
      // Check for OPFS support
      if (!('storage' in navigator)) {
        throw new Error('navigator.storage is not available');
      }
      
      if (!('getDirectory' in navigator.storage)) {
        throw new Error('navigator.storage.getDirectory is not available');
      }
      
      console.log('🔍 Attempting OPFS initialization...');
      this.root = await navigator.storage.getDirectory();
      
      // Initialize encryption with OPFS root
      this.encryption.opfsRoot = this.root;
      
      // Load metadata
      await this.loadMetadata();
      
      this.initialized = true;
      console.log('✅ OPFS initialized successfully');
    } catch (error) {
      console.error('❌ OPFS initialization error:', error);
      console.error('Error details:', {
        message: error.message,
        name: error.name,
        stack: error.stack,
        isSecureContext: window.isSecureContext,
        protocol: window.location.protocol,
        hostname: window.location.hostname,
        hasStorage: 'storage' in navigator,
        hasGetDirectory: 'storage' in navigator && 'getDirectory' in navigator.storage
      });
      throw error;
    }
  }

  // Sanitize cache key for use as filename
  sanitizeFilename(key) {
    return key.replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  // Extract base key (without date range) from cache key
  extractBaseKey(cacheKey) {
    // Cache key format: baseKey_startDate_endDate
    // Remove the last two parts (startDate and endDate)
    const parts = cacheKey.split('_');
    if (parts.length >= 2) {
      const endDate = parts[parts.length - 1];
      const startDate = parts[parts.length - 2];
      // Check if they look like dates
      if (/^\d{4}-\d{2}-\d{2}$/.test(startDate) && /^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
        return parts.slice(0, -2).join('_');
      }
    }
    return cacheKey;
  }

  // Get file path for sales data
  getSalesFilePath(cacheKey) {
    const sanitized = this.sanitizeFilename(cacheKey);
    return `sales/${sanitized}.enc`;
  }

  // Get file path for dashboard state
  getDashboardFilePath(cacheKey) {
    const sanitized = this.sanitizeFilename(cacheKey);
    return `dashboard/${sanitized}.enc`;
  }

  async setSalesData(cacheKey, data, maxAgeDays = null, startDate = null, endDate = null) {
    try {
      await this.init();
      
      // Check data size and warn on mobile if large
      const dataSize = JSON.stringify(data).length;
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      if (isMobile && dataSize > 5 * 1024 * 1024) { // > 5MB
        console.warn(`⚠️ Large data write on mobile: ${(dataSize / (1024 * 1024)).toFixed(2)} MB`);
      }
      
      const syncStart = performance.now();
      const encrypted = await this.encryption.encryptData(data);
      const timestamp = Date.now();
      console.log(`💾 Cache write started for: ${cacheKey}`);
      
      // Parse date range from cache key if not provided
      let dateRange = null;
      if (startDate && endDate) {
        dateRange = { startDate, endDate };
      } else {
        dateRange = DateRangeUtils.parseDateRangeFromCacheKey(cacheKey);
      }
      
      // Extract base key (without date range)
      const baseKey = this.extractBaseKey(cacheKey);
      
      // Write encrypted data to OPFS
      const filePath = this.getSalesFilePath(cacheKey);
      const pathParts = filePath.split('/');
      const fileName = pathParts.pop();
      const dirPath = pathParts.join('/');
      
      // Create directory if needed
      let dir = this.root;
      if (dirPath) {
        for (const part of dirPath.split('/')) {
          if (part) {
            dir = await dir.getDirectoryHandle(part, { create: true });
          }
        }
      }
      
      // Write file - try sync access handle first, fallback to async
      const fileHandle = await dir.getFileHandle(fileName, { create: true });
      
      try {
        // Sync access handles may not be available on mobile browsers
        // Skip sync access on mobile for better compatibility
        if (!isMobile && 'createSyncAccessHandle' in fileHandle) {
          const syncHandle = await fileHandle.createSyncAccessHandle();
          try {
            const encoder = new TextEncoder();
            const dataToWrite = encoder.encode(encrypted);
            syncHandle.write(dataToWrite, { at: 0 });
            syncHandle.truncate(dataToWrite.length);
          } finally {
            syncHandle.close();
          }
        } else {
          // Use async file writing (more compatible with mobile)
          const writable = await fileHandle.createWritable();
          await writable.write(encrypted);
          await writable.close();
        }
      } catch (writeError) {
        console.warn('⚠️ Primary write method failed, trying fallback:', writeError.message);
        // If sync fails, try async
        const writable = await fileHandle.createWritable();
        await writable.write(encrypted);
        await writable.close();
      }
      
      // Store metadata in memory (defer file write to batch operations)
      const salesMap = this.metadataCache.get('sales') || new Map();
      const metadata = {
        cacheKey,
        timestamp,
        baseKey,
        ...(dateRange ? { startDate: dateRange.startDate, endDate: dateRange.endDate } : {})
      };
      salesMap.set(cacheKey, metadata);
      this.metadataCache.set('sales', salesMap);
      
      // Defer metadata save to avoid blocking (use setTimeout to batch writes)
      if (this.metadataSaveTimer) {
        clearTimeout(this.metadataSaveTimer);
      }
      this.metadataSaveTimer = setTimeout(async () => {
        await this.saveMetadata();
        this.metadataSaveTimer = null;
      }, 100); // Batch metadata saves within 100ms
      
      const syncTime = performance.now() - syncStart;
      console.log(`✅ Cache write completed in ${syncTime.toFixed(2)}ms: ${cacheKey}`);
      
      // Clean up old entries only if expiry is set (not null/never)
      if (maxAgeDays !== null && maxAgeDays !== undefined) {
        const expiryTime = Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000);
        const expiredKeys = [];
        for (const [key, meta] of salesMap.entries()) {
          if (meta.timestamp < expiryTime) {
            expiredKeys.push(key);
            try {
              const expiredFilePath = this.getSalesFilePath(key);
              const expiredPathParts = expiredFilePath.split('/');
              const expiredFileName = expiredPathParts.pop();
              const expiredDirPath = expiredPathParts.join('/');
              
              let expiredDir = this.root;
              if (expiredDirPath) {
                for (const part of expiredDirPath.split('/')) {
                  if (part) {
                    expiredDir = await expiredDir.getDirectoryHandle(part);
                  }
                }
              }
              await expiredDir.removeEntry(expiredFileName);
            } catch (err) {
              // File might not exist, ignore
            }
          }
        }
        for (const key of expiredKeys) {
          salesMap.delete(key);
        }
        if (expiredKeys.length > 0) {
          this.metadataCache.set('sales', salesMap);
          await this.saveMetadata();
        }
      }
      
      console.log(`✅ Cached sales data in OPFS: ${cacheKey}`);
    } catch (error) {
      console.error('Error storing sales data in OPFS:', error);
      throw error;
    }
  }

  async getSalesData(cacheKey, maxAgeDays = null) {
    try {
      await this.init();
      
      // Check metadata first
      const salesMap = this.metadataCache.get('sales') || new Map();
      const metadata = salesMap.get(cacheKey);
      if (!metadata) {
        return null;
      }
      
      // Check expiry only if maxAgeDays is set (not null/never)
      if (maxAgeDays !== null && maxAgeDays !== undefined) {
        const age = Date.now() - metadata.timestamp;
        const maxAge = maxAgeDays * 24 * 60 * 60 * 1000;
        if (age > maxAge) {
          // Delete expired file
          try {
            const filePath = this.getSalesFilePath(cacheKey);
            const pathParts = filePath.split('/');
            const fileName = pathParts.pop();
            const dirPath = pathParts.join('/');
            
            let dir = this.root;
            if (dirPath) {
              for (const part of dirPath.split('/')) {
                if (part) {
                  dir = await dir.getDirectoryHandle(part);
                }
              }
            }
            await dir.removeEntry(fileName);
          } catch (err) {
            // File might not exist, ignore
          }
          salesMap.delete(cacheKey);
          this.metadataCache.set('sales', salesMap);
          await this.saveMetadata();
          return null;
        }
      }
      
      // Read encrypted file from OPFS
      const filePath = this.getSalesFilePath(cacheKey);
      const pathParts = filePath.split('/');
      const fileName = pathParts.pop();
      const dirPath = pathParts.join('/');
      
      let dir = this.root;
      if (dirPath) {
        for (const part of dirPath.split('/')) {
          if (part) {
            dir = await dir.getDirectoryHandle(part);
          }
        }
      }
      
      const fileHandle = await dir.getFileHandle(fileName);
      const file = await fileHandle.getFile();
      const encrypted = await file.text();
      
      // Decrypt
      const decrypted = await this.encryption.decryptData(encrypted);
      if (!decrypted) {
        // Decryption failed, delete entry
        try {
          await dir.removeEntry(fileName);
        } catch (err) {
          // Ignore
        }
        salesMap.delete(cacheKey);
        this.metadataCache.set('sales', salesMap);
        await this.saveMetadata();
        return null;
      }
      
      // Add date range to returned data
      if (metadata.startDate && metadata.endDate) {
        decrypted._cachedDateRange = {
          startDate: metadata.startDate,
          endDate: metadata.endDate
        };
      }
      
      console.log(`📋 Retrieved cached sales data from OPFS: ${cacheKey}`);
      return decrypted;
    } catch (error) {
      if (error.name === 'NotFoundError') {
        return null;
      }
      console.error('Error retrieving sales data from OPFS:', error);
      return null;
    }
  }

  async setDashboardState(cacheKey, state) {
    try {
      await this.init();
      const encrypted = await this.encryption.encryptData(state);
      const timestamp = Date.now();
      
      // Write encrypted data to OPFS
      const filePath = this.getDashboardFilePath(cacheKey);
      const pathParts = filePath.split('/');
      const fileName = pathParts.pop();
      const dirPath = pathParts.join('/');
      
      // Create directory if needed
      let dir = this.root;
      if (dirPath) {
        for (const part of dirPath.split('/')) {
          if (part) {
            dir = await dir.getDirectoryHandle(part, { create: true });
          }
        }
      }
      
      // Write file - try sync access handle first, fallback to async
      const fileHandle = await dir.getFileHandle(fileName, { create: true });
      
      try {
        // Try sync access handle for better performance (if available)
        if ('createSyncAccessHandle' in fileHandle) {
          const syncHandle = await fileHandle.createSyncAccessHandle();
          try {
            const encoder = new TextEncoder();
            const dataToWrite = encoder.encode(encrypted);
            syncHandle.write(dataToWrite, { at: 0 });
            syncHandle.truncate(dataToWrite.length);
          } finally {
            syncHandle.close();
          }
        } else {
          // Fallback to async file writing
          const writable = await fileHandle.createWritable();
          await writable.write(encrypted);
          await writable.close();
        }
      } catch (writeError) {
        // If sync fails, try async
        const writable = await fileHandle.createWritable();
        await writable.write(encrypted);
        await writable.close();
      }
      
      // Store metadata
      const dashboardMap = this.metadataCache.get('dashboard') || new Map();
      dashboardMap.set(cacheKey, { cacheKey, timestamp });
      this.metadataCache.set('dashboard', dashboardMap);
      await this.saveMetadata();
      
      console.log(`✅ Cached dashboard state in OPFS: ${cacheKey}`);
    } catch (error) {
      console.error('Error storing dashboard state in OPFS:', error);
      throw error;
    }
  }

  async getDashboardState(cacheKey) {
    try {
      await this.init();
      
      // Check metadata
      const dashboardMap = this.metadataCache.get('dashboard') || new Map();
      const metadata = dashboardMap.get(cacheKey);
      if (!metadata) {
        return null;
      }
      
      // Read encrypted file from OPFS
      const filePath = this.getDashboardFilePath(cacheKey);
      const pathParts = filePath.split('/');
      const fileName = pathParts.pop();
      const dirPath = pathParts.join('/');
      
      let dir = this.root;
      if (dirPath) {
        for (const part of dirPath.split('/')) {
          if (part) {
            dir = await dir.getDirectoryHandle(part);
          }
        }
      }
      
      const fileHandle = await dir.getFileHandle(fileName);
      const file = await fileHandle.getFile();
      const encrypted = await file.text();
      
      // Decrypt
      const decrypted = await this.encryption.decryptData(encrypted);
      if (!decrypted) {
        // Decryption failed, delete entry
        try {
          await dir.removeEntry(fileName);
        } catch (err) {
          // Ignore
        }
        dashboardMap.delete(cacheKey);
        this.metadataCache.set('dashboard', dashboardMap);
        await this.saveMetadata();
        return null;
      }
      
      return decrypted;
    } catch (error) {
      if (error.name === 'NotFoundError') {
        return null;
      }
      console.error('Error retrieving dashboard state from OPFS:', error);
      return null;
    }
  }

  async clearCompanyCache(companyInfo) {
    try {
      await this.init();
      const prefix = `${companyInfo.tallyloc_id}_${companyInfo.guid}_`;
      
      // Get all metadata entries matching prefix
      const salesMap = this.metadataCache.get('sales') || new Map();
      const dashboardMap = this.metadataCache.get('dashboard') || new Map();
      
      const salesToDelete = Array.from(salesMap.entries()).filter(([key]) => key.startsWith(prefix));
      const stateToDelete = Array.from(dashboardMap.entries()).filter(([key]) => key.startsWith(prefix));
      
      // Delete files
      for (const [cacheKey] of salesToDelete) {
        try {
          const filePath = this.getSalesFilePath(cacheKey);
          const pathParts = filePath.split('/');
          const fileName = pathParts.pop();
          const dirPath = pathParts.join('/');
          
          let dir = this.root;
          if (dirPath) {
            for (const part of dirPath.split('/')) {
              if (part) {
                dir = await dir.getDirectoryHandle(part);
              }
            }
          }
          await dir.removeEntry(fileName);
        } catch (err) {
          // File might not exist, ignore
        }
        salesMap.delete(cacheKey);
      }
      
      for (const [cacheKey] of stateToDelete) {
        try {
          const filePath = this.getDashboardFilePath(cacheKey);
          const pathParts = filePath.split('/');
          const fileName = pathParts.pop();
          const dirPath = pathParts.join('/');
          
          let dir = this.root;
          if (dirPath) {
            for (const part of dirPath.split('/')) {
              if (part) {
                dir = await dir.getDirectoryHandle(part);
              }
            }
          }
          await dir.removeEntry(fileName);
        } catch (err) {
          // File might not exist, ignore
        }
        dashboardMap.delete(cacheKey);
      }
      
      if (salesToDelete.length > 0 || stateToDelete.length > 0) {
        this.metadataCache.set('sales', salesMap);
        this.metadataCache.set('dashboard', dashboardMap);
        await this.saveMetadata();
      }
      
      console.log(`🧹 Cleared OPFS cache for company: ${companyInfo.company}`);
    } catch (error) {
      console.error('Error clearing company cache in OPFS:', error);
    }
  }

  // Find cached date ranges for a base key that overlap with request range
  async findCachedDateRanges(baseKey, requestStartDate, requestEndDate, maxAgeDays = null) {
    try {
      await this.init();
      
      // Get all metadata entries with matching base key
      const salesMap = this.metadataCache.get('sales') || new Map();
      const allMetadata = Array.from(salesMap.values()).filter(meta => meta.baseKey === baseKey);
      
      // Filter by expiry time only if maxAgeDays is set (not null/never)
      let validMetadata = allMetadata;
      if (maxAgeDays !== null && maxAgeDays !== undefined) {
        const expiryTime = Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000);
        validMetadata = allMetadata.filter(entry => entry.timestamp >= expiryTime);
      }
      
      if (validMetadata.length === 0) {
        return [];
      }
      
      const requestRange = { startDate: requestStartDate, endDate: requestEndDate };
      const cachedRanges = [];
      
      for (const metadata of validMetadata) {
        if (!metadata.startDate || !metadata.endDate) continue;
        
        const cachedRange = {
          startDate: metadata.startDate,
          endDate: metadata.endDate
        };
        
        // Check if this cached range overlaps with request
        if (DateRangeUtils.dateRangesOverlap(requestRange, cachedRange)) {
          try {
            // Read the encrypted file
            const filePath = this.getSalesFilePath(metadata.cacheKey);
            const pathParts = filePath.split('/');
            const fileName = pathParts.pop();
            const dirPath = pathParts.join('/');
            
            let dir = this.root;
            if (dirPath) {
              for (const part of dirPath.split('/')) {
                if (part) {
                  dir = await dir.getDirectoryHandle(part);
                }
              }
            }
            
            const fileHandle = await dir.getFileHandle(fileName);
            const file = await fileHandle.getFile();
            const encrypted = await file.text();
            
            // Decrypt the data
            const decrypted = await this.encryption.decryptData(encrypted);
            if (decrypted) {
              cachedRanges.push({
                ...cachedRange,
                data: decrypted
              });
            }
          } catch (err) {
            // File might not exist or decryption failed, skip
            console.warn(`Failed to read cached file for ${metadata.cacheKey}:`, err);
          }
        }
      }
      
      return cachedRanges;
    } catch (error) {
      console.error('Error finding cached date ranges in OPFS:', error);
      return [];
    }
  }

  // Clear metadata cache (for refreshing after clearing cache)
  async clearMetadataCache() {
    this.metadataCache.set('sales', new Map());
    this.metadataCache.set('dashboard', new Map());
    // Reload from OPFS to ensure consistency
    await this.loadMetadata();
  }

  // List all cache entries for viewing
  async listAllCacheEntries() {
    try {
      await this.init();
      
      // Reload metadata to ensure we have the latest data
      await this.loadMetadata();
      
      const salesMap = this.metadataCache.get('sales') || new Map();
      const dashboardMap = this.metadataCache.get('dashboard') || new Map();
      
      const salesEntries = Array.from(salesMap.entries()).map(([cacheKey, metadata]) => ({
        type: 'sales',
        cacheKey,
        timestamp: metadata.timestamp,
        date: new Date(metadata.timestamp).toLocaleString(),
        startDate: metadata.startDate || null,
        endDate: metadata.endDate || null,
        baseKey: metadata.baseKey || null,
        age: Date.now() - metadata.timestamp,
        ageDays: Math.floor((Date.now() - metadata.timestamp) / (24 * 60 * 60 * 1000))
      }));

      const dashboardEntries = Array.from(dashboardMap.entries()).map(([cacheKey, metadata]) => ({
        type: 'dashboard',
        cacheKey,
        timestamp: metadata.timestamp,
        date: new Date(metadata.timestamp).toLocaleString(),
        startDate: null,
        endDate: null,
        baseKey: null,
        age: Date.now() - metadata.timestamp,
        ageDays: Math.floor((Date.now() - metadata.timestamp) / (24 * 60 * 60 * 1000))
      }));

      // Get file sizes
      const entriesWithSizes = await Promise.all([
        ...salesEntries.map(async (entry) => {
          try {
            const filePath = this.getSalesFilePath(entry.cacheKey);
            const pathParts = filePath.split('/');
            const fileName = pathParts.pop();
            const dirPath = pathParts.join('/');
            
            let dir = this.root;
            if (dirPath) {
              for (const part of dirPath.split('/')) {
                if (part) {
                  dir = await dir.getDirectoryHandle(part);
                }
              }
            }
            
            const fileHandle = await dir.getFileHandle(fileName);
            const file = await fileHandle.getFile();
            return {
              ...entry,
              size: file.size,
              sizeKB: Math.round(file.size / 1024),
              sizeMB: (file.size / (1024 * 1024)).toFixed(2)
            };
          } catch (err) {
            return { ...entry, size: 0, sizeKB: 0, sizeMB: '0.00' };
          }
        }),
        ...dashboardEntries.map(async (entry) => {
          try {
            const filePath = this.getDashboardFilePath(entry.cacheKey);
            const pathParts = filePath.split('/');
            const fileName = pathParts.pop();
            const dirPath = pathParts.join('/');
            
            let dir = this.root;
            if (dirPath) {
              for (const part of dirPath.split('/')) {
                if (part) {
                  dir = await dir.getDirectoryHandle(part);
                }
              }
            }
            
            const fileHandle = await dir.getFileHandle(fileName);
            const file = await fileHandle.getFile();
            return {
              ...entry,
              size: file.size,
              sizeKB: Math.round(file.size / 1024),
              sizeMB: (file.size / (1024 * 1024)).toFixed(2)
            };
          } catch (err) {
            return { ...entry, size: 0, sizeKB: 0, sizeMB: '0.00' };
          }
        })
      ]);

      // Calculate totals
      const totalSize = entriesWithSizes.reduce((sum, entry) => sum + (entry.size || 0), 0);
      const totalEntries = entriesWithSizes.length;

      return {
        entries: entriesWithSizes.sort((a, b) => b.timestamp - a.timestamp),
        totalEntries,
        totalSize,
        totalSizeKB: Math.round(totalSize / 1024),
        totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
        salesCount: salesEntries.length,
        dashboardCount: dashboardEntries.length
      };
    } catch (error) {
      console.error('Error listing cache entries:', error);
      return {
        entries: [],
        totalEntries: 0,
        totalSize: 0,
        totalSizeKB: 0,
        totalSizeMB: '0.00',
        salesCount: 0,
        dashboardCount: 0
      };
    }
  }

  // Get complete sales data cache key for a company
  // Format: {email}_{guid}_{tallyloc_id}_complete_sales
  getCompleteSalesDataKey(companyInfo, email = null) {
    const userEmail = email || (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('email') : null) || 'unknown';
    // Sanitize email for use in filename
    const sanitizedEmail = userEmail.replace(/[^a-zA-Z0-9_-]/g, '_');
    return `${sanitizedEmail}_${companyInfo.guid}_${companyInfo.tallyloc_id}_complete_sales`;
  }

  // Store complete sales data with metadata
  async setCompleteSalesData(companyInfo, data, metadata = {}) {
    try {
      const syncStart = performance.now();
      await this.init();
      const email = metadata.email || (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('email') : null) || 'unknown';
      const cacheKey = this.getCompleteSalesDataKey(companyInfo, email);
      console.log(`💾 Complete sales data cache write started for: ${cacheKey}`);
      const encrypted = await this.encryption.encryptData(data);
      const timestamp = Date.now();
      
      // Extract date range from metadata or data
      const booksfrom = metadata.booksfrom || null;
      const lastaltid = metadata.lastaltid || null;
      
      // Calculate date range from booksfrom to today if provided
      let startDate = null;
      let endDate = null;
      if (booksfrom) {
        // booksfrom might be in various formats, normalize to YYYY-MM-DD
        // First, try to convert if it's in YYYYMMDD format
        if (/^\d{8}$/.test(booksfrom)) {
          startDate = `${booksfrom.slice(0, 4)}-${booksfrom.slice(4, 6)}-${booksfrom.slice(6, 8)}`;
        } else if (/^\d{4}-\d{2}-\d{2}$/.test(booksfrom)) {
          // Already in YYYY-MM-DD format
          startDate = booksfrom;
        } else {
          // Try to parse formats like "1-Apr-24"
          const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
          try {
            const parts = booksfrom.split('-');
            if (parts.length === 3) {
              const day = parseInt(parts[0], 10);
              const monthName = parts[1].toLowerCase();
              const year = parseInt(parts[2], 10);
              const monthIndex = monthNames.findIndex(m => m === monthName);
              if (monthIndex !== -1) {
                const fullYear = year < 50 ? 2000 + year : (year < 100 ? 1900 + year : year);
                const month = String(monthIndex + 1).padStart(2, '0');
                const dayStr = String(day).padStart(2, '0');
                startDate = `${fullYear}-${month}-${dayStr}`;
              }
            }
          } catch (error) {
            console.warn('Error parsing booksfrom date:', booksfrom, error);
          }
        }
        const today = new Date();
        endDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      }
      
      // Write encrypted data to OPFS
      const filePath = this.getSalesFilePath(cacheKey);
      const pathParts = filePath.split('/');
      const fileName = pathParts.pop();
      const dirPath = pathParts.join('/');
      
      // Create directory if needed
      let dir = this.root;
      if (dirPath) {
        for (const part of dirPath.split('/')) {
          if (part) {
            dir = await dir.getDirectoryHandle(part, { create: true });
          }
        }
      }
      
      // Write file
      const fileHandle = await dir.getFileHandle(fileName, { create: true });
      
      try {
        if ('createSyncAccessHandle' in fileHandle) {
          const syncHandle = await fileHandle.createSyncAccessHandle();
          try {
            const encoder = new TextEncoder();
            const dataToWrite = encoder.encode(encrypted);
            syncHandle.write(dataToWrite, { at: 0 });
            syncHandle.truncate(dataToWrite.length);
          } finally {
            syncHandle.close();
          }
        } else {
          const writable = await fileHandle.createWritable();
          await writable.write(encrypted);
          await writable.close();
        }
      } catch (writeError) {
        const writable = await fileHandle.createWritable();
        await writable.write(encrypted);
        await writable.close();
      }
      
      // Store metadata with complete data flag
      const salesMap = this.metadataCache.get('sales') || new Map();
      const metadataEntry = {
        cacheKey,
        timestamp,
        baseKey: cacheKey,
        isComplete: true,
        lastaltid,
        booksfrom,
        ...(startDate && endDate ? { startDate, endDate } : {})
      };
      salesMap.set(cacheKey, metadataEntry);
      this.metadataCache.set('sales', salesMap);
      
      // For complete sales data, save metadata immediately (important for sync tracking)
      await this.saveMetadata();
      
      const syncTime = performance.now() - syncStart;
      console.log(`✅ Cached complete sales data in OPFS: ${cacheKey}, lastaltid: ${lastaltid} (${syncTime.toFixed(2)}ms)`);
    } catch (error) {
      console.error('Error storing complete sales data in OPFS:', error);
      throw error;
    }
  }

  // Get complete sales data for a company
  async getCompleteSalesData(companyInfo, email = null) {
    try {
      await this.init();
      const userEmail = email || (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('email') : null) || 'unknown';
      const cacheKey = this.getCompleteSalesDataKey(companyInfo, userEmail);
      
      // Check metadata first
      const salesMap = this.metadataCache.get('sales') || new Map();
      let metadata = salesMap.get(cacheKey);
      
      // If metadata doesn't exist, try to check if file exists anyway
      // (metadata might have been cleared but file might still be valid)
      if (!metadata || !metadata.isComplete) {
        // Try to read file directly to see if it exists
        try {
          const filePath = this.getSalesFilePath(cacheKey);
          const pathParts = filePath.split('/');
          const fileName = pathParts.pop();
          const dirPath = pathParts.join('/');
          
          let dir = this.root;
          if (dirPath) {
            for (const part of dirPath.split('/')) {
              if (part) {
                dir = await dir.getDirectoryHandle(part);
              }
            }
          }
          
          // File exists but metadata is missing - try to load it
          const fileHandle = await dir.getFileHandle(fileName);
          const file = await fileHandle.getFile();
          const encrypted = await file.text();
          
          // Try to decrypt - if successful, restore metadata
          const decrypted = await this.encryption.decryptData(encrypted);
          if (decrypted) {
            console.log('✅ Found cache file without metadata - restoring metadata');
            // Restore basic metadata
            metadata = {
              isComplete: true,
              timestamp: file.lastModified || Date.now(),
              lastaltid: null,
              booksfrom: null
            };
            salesMap.set(cacheKey, metadata);
            this.metadataCache.set('sales', salesMap);
            await this.saveMetadata();
            
            // Return the decrypted data
            return {
              data: decrypted,
              metadata: {
                lastaltid: metadata.lastaltid,
                booksfrom: metadata.booksfrom,
                timestamp: metadata.timestamp
              }
            };
          }
        } catch (fileError) {
          // File doesn't exist or can't be read - return null
          if (fileError.name !== 'NotFoundError') {
            console.warn('Error checking for cache file:', fileError);
          }
          return null;
        }
        return null;
      }
      
      // Read encrypted file from OPFS
      const filePath = this.getSalesFilePath(cacheKey);
      const pathParts = filePath.split('/');
      const fileName = pathParts.pop();
      const dirPath = pathParts.join('/');
      
      let dir = this.root;
      if (dirPath) {
        for (const part of dirPath.split('/')) {
          if (part) {
            dir = await dir.getDirectoryHandle(part);
          }
        }
      }
      
      const fileHandle = await dir.getFileHandle(fileName);
      const file = await fileHandle.getFile();
      
      // Validate file size - should be reasonable for base64 encoded data
      const fileSize = file.size;
      console.log(`📄 Reading complete sales cache file: ${fileName}, size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);
      
      if (fileSize === 0) {
        console.warn('⚠️ Cache file is empty');
        return null;
      }
      
      const encrypted = await file.text();
      
      // Validate that we read the full file
      if (encrypted.length === 0) {
        console.warn('⚠️ Read empty string from cache file');
        return null;
      }
      
      // Log encrypted data info for debugging
      console.log(`📝 Encrypted data length: ${encrypted.length} characters`);
      
      // Check if file might be truncated (base64 length should be roughly 4/3 of file size in bytes)
      // But since it's stored as text, the file size in bytes should match the string length
      const expectedLength = fileSize; // For text files, size in bytes should match character count
      if (Math.abs(encrypted.length - expectedLength) > 100) {
        console.warn(`⚠️ File size mismatch: expected ~${expectedLength} characters, got ${encrypted.length}. File might be truncated.`);
      }
      
      // Decrypt
      const decrypted = await this.encryption.decryptData(encrypted);
      if (!decrypted) {
        console.warn('⚠️ Failed to decrypt complete sales data - cache may be corrupted');
        // Try to delete the corrupted cache entry
        try {
          await dir.removeEntry(fileName);
          // Only clear metadata if file deletion was successful
          const salesMap = this.metadataCache.get('sales') || new Map();
          salesMap.delete(cacheKey);
          this.metadataCache.set('sales', salesMap);
          await this.saveMetadata();
          console.log(`🗑️ Deleted corrupted cache entry and cleared metadata: ${cacheKey}`);
        } catch (deleteError) {
          console.warn('Could not delete corrupted cache entry - keeping metadata:', deleteError);
          // Don't clear metadata if file deletion failed - file might still be recoverable
        }
        return null;
      }
      
      console.log(`📋 Retrieved complete cached sales data from OPFS: ${cacheKey}`);
      return {
        data: decrypted,
        metadata: {
          lastaltid: metadata.lastaltid,
          booksfrom: metadata.booksfrom,
          timestamp: metadata.timestamp
        }
      };
    } catch (error) {
      if (error.name === 'NotFoundError') {
        return null;
      }
      // If it's a base64 decoding error, try to clear the corrupted cache
      if (error.message && error.message.includes('base64')) {
        console.warn('⚠️ Base64 decoding error - attempting to clear corrupted cache');
        try {
          const cacheKey = this.getCompleteSalesDataKey(companyInfo);
          const filePath = this.getSalesFilePath(cacheKey);
          const pathParts = filePath.split('/');
          const fileName = pathParts.pop();
          const dirPath = pathParts.join('/');
          
          let dir = this.root;
          if (dirPath) {
            for (const part of dirPath.split('/')) {
              if (part) {
                dir = await dir.getDirectoryHandle(part);
              }
            }
          }
          await dir.removeEntry(fileName);
          // Only clear metadata if file deletion was successful
          const salesMap = this.metadataCache.get('sales') || new Map();
          salesMap.delete(cacheKey);
          this.metadataCache.set('sales', salesMap);
          await this.saveMetadata();
          console.log(`🗑️ Deleted corrupted cache entry and cleared metadata due to base64 error: ${cacheKey}`);
        } catch (deleteError) {
          console.warn('Could not delete corrupted cache entry - keeping metadata:', deleteError);
          // Don't clear metadata if file deletion failed
        }
      }
      console.error('Error retrieving complete sales data from OPFS:', error);
      return null;
    }
  }

  // Get lastaltid for a company
  async getLastAlterId(companyInfo, email = null) {
    try {
      await this.init();
      const userEmail = email || (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('email') : null) || 'unknown';
      const cacheKey = this.getCompleteSalesDataKey(companyInfo, userEmail);
      const salesMap = this.metadataCache.get('sales') || new Map();
      const metadata = salesMap.get(cacheKey);
      if (metadata && metadata.isComplete) {
        return metadata.lastaltid || null;
      }
      return null;
    } catch (error) {
      console.error('Error getting lastaltid:', error);
      return null;
    }
  }

  // Get raw cache file data as JSON (for viewing)
  async getCacheFileAsJson(cacheKey) {
    try {
      await this.init();
      
      // Check metadata first
      const salesMap = this.metadataCache.get('sales') || new Map();
      const dashboardMap = this.metadataCache.get('dashboard') || new Map();
      
      let filePath, dir;
      
      if (salesMap.has(cacheKey)) {
        filePath = this.getSalesFilePath(cacheKey);
        const pathParts = filePath.split('/');
        const fileName = pathParts.pop();
        const dirPath = pathParts.join('/');
        
        dir = this.root;
        if (dirPath) {
          for (const part of dirPath.split('/')) {
            if (part) {
              dir = await dir.getDirectoryHandle(part);
            }
          }
        }
        
        const fileHandle = await dir.getFileHandle(fileName);
        const file = await fileHandle.getFile();
        const encrypted = await file.text();
        
        // Decrypt
        const decrypted = await this.encryption.decryptData(encrypted);
        return decrypted;
      } else if (dashboardMap.has(cacheKey)) {
        filePath = this.getDashboardFilePath(cacheKey);
        const pathParts = filePath.split('/');
        const fileName = pathParts.pop();
        const dirPath = pathParts.join('/');
        
        dir = this.root;
        if (dirPath) {
          for (const part of dirPath.split('/')) {
            if (part) {
              dir = await dir.getDirectoryHandle(part);
            }
          }
        }
        
        const fileHandle = await dir.getFileHandle(fileName);
        const file = await fileHandle.getFile();
        const encrypted = await file.text();
        
        // Decrypt
        const decrypted = await this.encryption.decryptData(encrypted);
        return decrypted;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting cache file as JSON:', error);
      return null;
    }
  }
}

// IndexedDB Backend - stores encrypted data in IndexedDB using Dexie
class IndexedDBBackend {
  constructor(encryptionUtils) {
    this.encryption = encryptionUtils;
    this.db = null;
    this.initialized = false;
  }

  // Initialize Dexie database
  async init() {
    if (this.initialized) return;

    try {
      // Create Dexie database
      this.db = new Dexie('TallyCatalystCache');
      
      // Define schema
      this.db.version(1).stores({
        salesData: 'cacheKey, timestamp, baseKey, startDate, endDate, isComplete, lastaltid',
        dashboardState: 'cacheKey, timestamp',
        userKeys: 'email'
      });

      // Open database
      await this.db.open();
      
      // Initialize encryption with IndexedDB reference
      this.encryption.indexedDB = this.db;
      
      this.initialized = true;
      console.log('✅ IndexedDB backend initialized successfully');
    } catch (error) {
      console.error('❌ IndexedDB initialization error:', error);
      throw error;
    }
  }

  // Sanitize cache key (for consistency with OPFS)
  sanitizeFilename(key) {
    return key.replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  // Extract base key (without date range) from cache key
  extractBaseKey(cacheKey) {
    // Cache key format: baseKey_startDate_endDate
    // Remove the last two parts (startDate and endDate)
    const parts = cacheKey.split('_');
    if (parts.length >= 2) {
      const endDate = parts[parts.length - 1];
      const startDate = parts[parts.length - 2];
      // Check if they look like dates
      if (/^\d{4}-\d{2}-\d{2}$/.test(startDate) && /^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
        return parts.slice(0, -2).join('_');
      }
    }
    return cacheKey;
  }

  async setSalesData(cacheKey, data, maxAgeDays = 5, startDate = null, endDate = null) {
    try {
      await this.init();
      const encrypted = await this.encryption.encryptData(data);
      const timestamp = Date.now();
      
      // Parse date range from cache key if not provided
      let dateRange = null;
      if (startDate && endDate) {
        dateRange = { startDate, endDate };
      } else {
        dateRange = DateRangeUtils.parseDateRangeFromCacheKey(cacheKey);
      }
      
      // Extract base key (without date range)
      const baseKey = this.extractBaseKey(cacheKey);
      
      // Store encrypted data in IndexedDB
      await this.db.salesData.put({
        cacheKey,
        encryptedData: encrypted,
        timestamp,
        baseKey,
        startDate: dateRange ? dateRange.startDate : null,
        endDate: dateRange ? dateRange.endDate : null
      });
      
      // Clean up old entries
      const expiryTime = Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000);
      await this.db.salesData.where('timestamp').below(expiryTime).delete();
      
      console.log(`✅ Cached sales data in IndexedDB: ${cacheKey}`);
    } catch (error) {
      console.error('Error storing sales data in IndexedDB:', error);
      throw error;
    }
  }

  async getSalesData(cacheKey, maxAgeDays = null) {
    try {
      await this.init();
      
      // Get entry from IndexedDB
      const entry = await this.db.salesData.get(cacheKey);
      if (!entry) {
        return null;
      }
      
      // Check expiry only if maxAgeDays is set (not null/never)
      if (maxAgeDays !== null && maxAgeDays !== undefined) {
        const age = Date.now() - entry.timestamp;
        const maxAge = maxAgeDays * 24 * 60 * 60 * 1000;
        if (age > maxAge) {
          // Delete expired entry
          await this.db.salesData.delete(cacheKey);
          return null;
        }
      }
      
      // Decrypt
      const decrypted = await this.encryption.decryptData(entry.encryptedData);
      if (!decrypted) {
        // Decryption failed, delete entry
        await this.db.salesData.delete(cacheKey);
        return null;
      }
      
      // Add date range to returned data
      if (entry.startDate && entry.endDate) {
        decrypted._cachedDateRange = {
          startDate: entry.startDate,
          endDate: entry.endDate
        };
      }
      
      console.log(`📋 Retrieved cached sales data from IndexedDB: ${cacheKey}`);
      return decrypted;
    } catch (error) {
      console.error('Error retrieving sales data from IndexedDB:', error);
      return null;
    }
  }

  async setDashboardState(cacheKey, state) {
    try {
      await this.init();
      const encrypted = await this.encryption.encryptData(state);
      const timestamp = Date.now();
      
      // Store encrypted data in IndexedDB
      await this.db.dashboardState.put({
        cacheKey,
        encryptedData: encrypted,
        timestamp
      });
      
      console.log(`✅ Cached dashboard state in IndexedDB: ${cacheKey}`);
    } catch (error) {
      console.error('Error storing dashboard state in IndexedDB:', error);
      throw error;
    }
  }

  async getDashboardState(cacheKey) {
    try {
      await this.init();
      
      // Get entry from IndexedDB
      const entry = await this.db.dashboardState.get(cacheKey);
      if (!entry) {
        return null;
      }
      
      // Decrypt
      const decrypted = await this.encryption.decryptData(entry.encryptedData);
      if (!decrypted) {
        // Decryption failed, delete entry
        await this.db.dashboardState.delete(cacheKey);
        return null;
      }
      
      return decrypted;
    } catch (error) {
      console.error('Error retrieving dashboard state from IndexedDB:', error);
      return null;
    }
  }

  async clearCompanyCache(companyInfo) {
    try {
      await this.init();
      const prefix = `${companyInfo.tallyloc_id}_${companyInfo.guid}_`;
      
      // Delete sales data matching prefix
      const salesEntries = await this.db.salesData.where('cacheKey').startsWith(prefix).toArray();
      const salesKeys = salesEntries.map(e => e.cacheKey);
      await this.db.salesData.bulkDelete(salesKeys);
      
      // Delete dashboard state matching prefix
      const dashboardEntries = await this.db.dashboardState.where('cacheKey').startsWith(prefix).toArray();
      const dashboardKeys = dashboardEntries.map(e => e.cacheKey);
      await this.db.dashboardState.bulkDelete(dashboardKeys);
      
      console.log(`🧹 Cleared IndexedDB cache for company: ${companyInfo.company}`);
    } catch (error) {
      console.error('Error clearing company cache in IndexedDB:', error);
    }
  }

  // Find cached date ranges for a base key that overlap with request range
  async findCachedDateRanges(baseKey, requestStartDate, requestEndDate, maxAgeDays = null) {
    try {
      await this.init();
      
      // Get all entries with matching base key
      const allEntries = await this.db.salesData
        .where('baseKey').equals(baseKey)
        .toArray();
      
      // Filter by expiry time only if maxAgeDays is set (not null/never)
      let validEntries = allEntries;
      if (maxAgeDays !== null && maxAgeDays !== undefined) {
        const expiryTime = Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000);
        validEntries = allEntries.filter(entry => entry.timestamp >= expiryTime);
      }
      
      if (validEntries.length === 0) {
        return [];
      }
      
      const requestRange = { startDate: requestStartDate, endDate: requestEndDate };
      const cachedRanges = [];
      
      for (const entry of validEntries) {
        if (!entry.startDate || !entry.endDate) continue;
        
        const cachedRange = {
          startDate: entry.startDate,
          endDate: entry.endDate
        };
        
        // Check if this cached range overlaps with request
        if (DateRangeUtils.dateRangesOverlap(requestRange, cachedRange)) {
          try {
            // Decrypt the data
            const decrypted = await this.encryption.decryptData(entry.encryptedData);
            if (decrypted) {
              cachedRanges.push({
                ...cachedRange,
                data: decrypted
              });
            }
          } catch (err) {
            // Decryption failed, skip
            console.warn(`Failed to decrypt cached entry for ${entry.cacheKey}:`, err);
          }
        }
      }
      
      return cachedRanges;
    } catch (error) {
      console.error('Error finding cached date ranges in IndexedDB:', error);
      return [];
    }
  }

  // Clear metadata cache (for IndexedDB, entries are read directly from DB, so this is a no-op)
  async clearMetadataCache() {
    // For IndexedDB, entries are read directly from the database, so no in-memory cache to clear
    // But we'll ensure the database is up to date
    await this.init();
  }

  // List all cache entries for viewing
  async listAllCacheEntries() {
    try {
      await this.init();
      
      const salesEntries = await this.db.salesData.toArray();
      const dashboardEntries = await this.db.dashboardState.toArray();
      
      const salesList = salesEntries.map(entry => ({
        type: 'sales',
        cacheKey: entry.cacheKey,
        timestamp: entry.timestamp,
        date: new Date(entry.timestamp).toLocaleString(),
        startDate: entry.startDate || null,
        endDate: entry.endDate || null,
        baseKey: entry.baseKey || null,
        age: Date.now() - entry.timestamp,
        ageDays: Math.floor((Date.now() - entry.timestamp) / (24 * 60 * 60 * 1000)),
        size: new Blob([entry.encryptedData]).size,
        sizeKB: Math.round(new Blob([entry.encryptedData]).size / 1024),
        sizeMB: (new Blob([entry.encryptedData]).size / (1024 * 1024)).toFixed(2)
      }));

      const dashboardList = dashboardEntries.map(entry => ({
        type: 'dashboard',
        cacheKey: entry.cacheKey,
        timestamp: entry.timestamp,
        date: new Date(entry.timestamp).toLocaleString(),
        startDate: null,
        endDate: null,
        baseKey: null,
        age: Date.now() - entry.timestamp,
        ageDays: Math.floor((Date.now() - entry.timestamp) / (24 * 60 * 60 * 1000)),
        size: new Blob([entry.encryptedData]).size,
        sizeKB: Math.round(new Blob([entry.encryptedData]).size / 1024),
        sizeMB: (new Blob([entry.encryptedData]).size / (1024 * 1024)).toFixed(2)
      }));

      const allEntries = [...salesList, ...dashboardList];
      
      // Calculate totals
      const totalSize = allEntries.reduce((sum, entry) => sum + entry.size, 0);
      const totalEntries = allEntries.length;

      return {
        entries: allEntries.sort((a, b) => b.timestamp - a.timestamp),
        totalEntries,
        totalSize,
        totalSizeKB: Math.round(totalSize / 1024),
        totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
        salesCount: salesList.length,
        dashboardCount: dashboardList.length
      };
    } catch (error) {
      console.error('Error listing cache entries:', error);
      return {
        entries: [],
        totalEntries: 0,
        totalSize: 0,
        totalSizeKB: 0,
        totalSizeMB: '0.00',
        salesCount: 0,
        dashboardCount: 0
      };
    }
  }

  // Get complete sales data cache key for a company
  // Format: {email}_{guid}_{tallyloc_id}_complete_sales
  getCompleteSalesDataKey(companyInfo, email = null) {
    const userEmail = email || (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('email') : null) || 'unknown';
    // Sanitize email for use in filename
    const sanitizedEmail = userEmail.replace(/[^a-zA-Z0-9_-]/g, '_');
    return `${sanitizedEmail}_${companyInfo.guid}_${companyInfo.tallyloc_id}_complete_sales`;
  }

  // Store complete sales data with metadata
  async setCompleteSalesData(companyInfo, data, metadata = {}) {
    try {
      await this.init();
      const email = metadata.email || (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('email') : null) || 'unknown';
      const cacheKey = this.getCompleteSalesDataKey(companyInfo, email);
      const encrypted = await this.encryption.encryptData(data);
      const timestamp = Date.now();
      
      // Extract date range from metadata
      const booksfrom = metadata.booksfrom || null;
      const lastaltid = metadata.lastaltid || null;
      
      // Calculate date range from booksfrom to today if provided
      let startDate = null;
      let endDate = null;
      if (booksfrom) {
        // booksfrom might be in various formats, normalize to YYYY-MM-DD
        // First, try to convert if it's in YYYYMMDD format
        if (/^\d{8}$/.test(booksfrom)) {
          startDate = `${booksfrom.slice(0, 4)}-${booksfrom.slice(4, 6)}-${booksfrom.slice(6, 8)}`;
        } else if (/^\d{4}-\d{2}-\d{2}$/.test(booksfrom)) {
          // Already in YYYY-MM-DD format
          startDate = booksfrom;
        } else {
          // Try to parse formats like "1-Apr-24"
          const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
          try {
            const parts = booksfrom.split('-');
            if (parts.length === 3) {
              const day = parseInt(parts[0], 10);
              const monthName = parts[1].toLowerCase();
              const year = parseInt(parts[2], 10);
              const monthIndex = monthNames.findIndex(m => m === monthName);
              if (monthIndex !== -1) {
                const fullYear = year < 50 ? 2000 + year : (year < 100 ? 1900 + year : year);
                const month = String(monthIndex + 1).padStart(2, '0');
                const dayStr = String(day).padStart(2, '0');
                startDate = `${fullYear}-${month}-${dayStr}`;
              }
            }
          } catch (error) {
            console.warn('Error parsing booksfrom date:', booksfrom, error);
          }
        }
        const today = new Date();
        endDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      }
      
      // Store encrypted data in IndexedDB
      await this.db.salesData.put({
        cacheKey,
        encryptedData: encrypted,
        timestamp,
        baseKey: cacheKey,
        isComplete: true,
        lastaltid,
        booksfrom,
        startDate,
        endDate
      });
      
      console.log(`✅ Cached complete sales data in IndexedDB: ${cacheKey}, lastaltid: ${lastaltid}`);
    } catch (error) {
      console.error('Error storing complete sales data in IndexedDB:', error);
      throw error;
    }
  }

  // Get complete sales data for a company
  async getCompleteSalesData(companyInfo, email = null) {
    try {
      await this.init();
      const userEmail = email || (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('email') : null) || 'unknown';
      const cacheKey = this.getCompleteSalesDataKey(companyInfo, userEmail);
      
      // Get entry from IndexedDB
      const entry = await this.db.salesData.get(cacheKey);
      if (!entry || !entry.isComplete) {
        return null;
      }
      
      // Decrypt
      const decrypted = await this.encryption.decryptData(entry.encryptedData);
      if (!decrypted) {
        console.warn('⚠️ Failed to decrypt complete sales data - cache may be corrupted');
        // Try to delete the corrupted cache entry
        try {
          await this.db.salesData.delete(cacheKey);
          // Clear metadata entry as well
          const salesMap = this.metadataCache.get('sales') || new Map();
          salesMap.delete(cacheKey);
          this.metadataCache.set('sales', salesMap);
          await this.saveMetadata();
          console.log(`🗑️ Deleted corrupted cache entry and cleared metadata from IndexedDB: ${cacheKey}`);
        } catch (deleteError) {
          console.warn('Could not delete corrupted cache entry:', deleteError);
        }
        return null;
      }
      
      console.log(`📋 Retrieved complete cached sales data from IndexedDB: ${cacheKey}`);
      return {
        data: decrypted,
        metadata: {
          lastaltid: entry.lastaltid,
          booksfrom: entry.booksfrom,
          timestamp: entry.timestamp
        }
      };
    } catch (error) {
      // If it's a base64 decoding error, try to clear the corrupted cache
      if (error.message && error.message.includes('base64')) {
        console.warn('⚠️ Base64 decoding error - attempting to clear corrupted cache');
        try {
          const cacheKey = this.getCompleteSalesDataKey(companyInfo);
          await this.db.salesData.delete(cacheKey);
          // Clear metadata entry as well
          const salesMap = this.metadataCache.get('sales') || new Map();
          salesMap.delete(cacheKey);
          this.metadataCache.set('sales', salesMap);
          await this.saveMetadata();
          console.log(`🗑️ Deleted corrupted cache entry and cleared metadata due to base64 error: ${cacheKey}`);
        } catch (deleteError) {
          console.warn('Could not delete corrupted cache entry:', deleteError);
        }
      }
      console.error('Error retrieving complete sales data from IndexedDB:', error);
      return null;
    }
  }

  // Get lastaltid for a company
  async getLastAlterId(companyInfo, email = null) {
    try {
      await this.init();
      const userEmail = email || (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('email') : null) || 'unknown';
      const cacheKey = this.getCompleteSalesDataKey(companyInfo, userEmail);
      const entry = await this.db.salesData.get(cacheKey);
      if (entry && entry.isComplete) {
        return entry.lastaltid || null;
      }
      return null;
    } catch (error) {
      console.error('Error getting lastaltid:', error);
      return null;
    }
  }

  // Get raw cache file data as JSON (for viewing)
  async getCacheFileAsJson(cacheKey) {
    try {
      await this.init();
      
      // Try sales data first
      const salesEntry = await this.db.salesData.get(cacheKey);
      if (salesEntry) {
        const decrypted = await this.encryption.decryptData(salesEntry.encryptedData);
        return decrypted;
      }
      
      // Try dashboard state
      const dashboardEntry = await this.db.dashboardState.get(cacheKey);
      if (dashboardEntry) {
        const decrypted = await this.encryption.decryptData(dashboardEntry.encryptedData);
        return decrypted;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting cache file as JSON:', error);
      return null;
    }
  }
}

// Hybrid Cache - uses OPFS with IndexedDB fallback
class HybridCache {
  constructor() {
    this.encryption = null;
    this.backend = null;
    this.backendType = null;
    this.initialized = false;
  }

  // Get cache expiry period in days (null = never expire)
  getCacheExpiryDays() {
    try {
      const stored = localStorage.getItem('cacheExpiryDays');
      if (stored === null || stored === 'null' || stored === 'never') {
        return null; // Never expire
      }
      const days = parseInt(stored, 10);
      return isNaN(days) || days < 0 ? null : days;
    } catch (error) {
      return null; // Default to never expire
    }
  }

  // Set cache expiry period in days (null = never expire)
  setCacheExpiryDays(days) {
    try {
      if (days === null || days === 'never' || days === '') {
        localStorage.setItem('cacheExpiryDays', 'never');
      } else {
        const daysNum = parseInt(days, 10);
        if (!isNaN(daysNum) && daysNum >= 0) {
          localStorage.setItem('cacheExpiryDays', daysNum.toString());
        }
      }
    } catch (error) {
      console.error('Error setting cache expiry:', error);
    }
  }

  async init() {
    if (this.initialized) return;
    
    // Detect mobile device
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    // Detect browser support with detailed logging
    const isSecureContext = window.isSecureContext || window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const hasStorage = 'storage' in navigator;
    const hasGetDirectory = hasStorage && 'getDirectory' in navigator.storage;
    const supportsOPFS = isSecureContext && hasStorage && hasGetDirectory;
    
    console.log('🔍 Storage Detection:', {
      isMobile,
      isSecureContext,
      protocol: window.location.protocol,
      hostname: window.location.hostname,
      hasStorage,
      hasGetDirectory,
      supportsOPFS,
      userAgent: navigator.userAgent
    });
    
    // On mobile browsers, OPFS support varies significantly
    // Safari iOS: Limited OPFS support, better to use IndexedDB
    // Chrome Android: Good OPFS support
    // Firefox Android: Limited OPFS support
    const isSafariIOS = isMobile && /Safari/i.test(navigator.userAgent) && /iPhone|iPad|iPod/i.test(navigator.userAgent) && !/Chrome|CriOS|FxiOS/i.test(navigator.userAgent);
    const isFirefoxMobile = isMobile && /Firefox/i.test(navigator.userAgent);
    
    // Prefer IndexedDB on Safari iOS and Firefox Mobile due to better stability
    const preferIndexedDB = isSafariIOS || isFirefoxMobile;
    
    if (preferIndexedDB) {
      console.log('📱 Mobile browser detected with limited OPFS support, using IndexedDB');
    }
    
    if (supportsOPFS && !preferIndexedDB) {
      try {
        console.log('🚀 Initializing OPFS backend...');
        // Initialize OPFS root first with timeout for mobile
        const opfsInitPromise = navigator.storage.getDirectory();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('OPFS initialization timeout')), isMobile ? 10000 : 5000)
        );
        
        const opfsRoot = await Promise.race([opfsInitPromise, timeoutPromise]);
        
        // Check storage quota on mobile
        if (isMobile && 'estimate' in navigator.storage) {
          const estimate = await navigator.storage.estimate();
          const usagePercent = (estimate.usage / estimate.quota) * 100;
          console.log(`📊 Storage quota: ${(estimate.usage / (1024 * 1024)).toFixed(2)} MB / ${(estimate.quota / (1024 * 1024)).toFixed(2)} MB (${usagePercent.toFixed(1)}%)`);
          
          if (usagePercent > 90) {
            console.warn('⚠️ Storage quota nearly full on mobile (>90%), consider cleanup');
          } else if (usagePercent > 75) {
            console.warn('⚠️ Storage quota getting high on mobile (>75%)');
          }
        }
        
        this.encryption = new EncryptionUtils(opfsRoot);
        this.backend = new OPFSBackend(this.encryption);
        await this.backend.init();
        this.backendType = 'OPFS';
        console.log('✅ OPFS backend initialized successfully' + (isMobile ? ' (mobile)' : ''));
        this.initialized = true;
        return;
      } catch (error) {
        console.warn('⚠️ OPFS initialization failed, falling back to IndexedDB:', {
          error: error.message,
          isMobile,
          browser: navigator.userAgent
        });
        // Fall through to IndexedDB
      }
    }
    
    // Fall back to IndexedDB (or use it directly if preferred)
    try {
      console.log('🚀 Initializing IndexedDB backend...' + (isMobile ? ' (mobile)' : ''));
      this.encryption = new EncryptionUtils(null); // No OPFS root
      this.backend = new IndexedDBBackend(this.encryption);
      await this.backend.init();
      this.backendType = 'IndexedDB';
      console.log('✅ IndexedDB backend initialized successfully' + (isMobile ? ' (mobile)' : ''));
    } catch (error) {
      console.error('❌ IndexedDB initialization failed:', {
        error: error.message,
        isMobile,
        browser: navigator.userAgent
      });
      throw new Error(`Failed to initialize storage backends: ${error.message}. Please ensure your browser supports modern storage APIs.`);
    }
    
    this.initialized = true;
  }

  async setSalesData(cacheKey, data, maxAgeDays = null, startDate = null, endDate = null) {
    await this.init();
    // Use configured expiry if not provided
    if (maxAgeDays === null || maxAgeDays === undefined) {
      maxAgeDays = this.getCacheExpiryDays();
    }
    return await this.backend.setSalesData(cacheKey, data, maxAgeDays, startDate, endDate);
  }

  async getSalesData(cacheKey, maxAgeDays = null) {
    await this.init();
    // Use configured expiry if not provided
    if (maxAgeDays === null || maxAgeDays === undefined) {
      maxAgeDays = this.getCacheExpiryDays();
    }
    return await this.backend.getSalesData(cacheKey, maxAgeDays);
  }

  async setDashboardState(cacheKey, state) {
    await this.init();
    return await this.backend.setDashboardState(cacheKey, state);
  }

  async getDashboardState(cacheKey) {
    await this.init();
    return await this.backend.getDashboardState(cacheKey);
  }

  async clearCompanyCache(companyInfo) {
    await this.init();
    return await this.backend.clearCompanyCache(companyInfo);
  }

  async getCacheStats() {
    await this.init();
    const isSecureContext = window.isSecureContext || window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const hasStorage = 'storage' in navigator;
    const hasGetDirectory = hasStorage && 'getDirectory' in navigator.storage;
    const supportsOPFS = isSecureContext && hasStorage && hasGetDirectory;
    
    return {
      backend: this.backendType,
      supportsOPFS,
      isUsingOPFS: this.backendType === 'OPFS',
      isUsingIndexedDB: this.backendType === 'IndexedDB'
    };
  }

  // Add this method to HybridCache class
  async getStorageQuota() {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        return {
          quota: estimate.quota,
          usage: estimate.usage,
          available: estimate.quota - estimate.usage,
          usagePercent: ((estimate.usage / estimate.quota) * 100).toFixed(2),
          quotaMB: (estimate.quota / (1024 * 1024)).toFixed(2),
          usageMB: (estimate.usage / (1024 * 1024)).toFixed(2),
          availableMB: ((estimate.quota - estimate.usage) / (1024 * 1024)).toFixed(2)
        };
      }
      return null;
    } catch (error) {
      console.error('Error getting storage quota:', error);
      return null;
    }
  }

  // Add this method to check if storage is getting low
  async isStorageLow(thresholdPercent = 80) {
    const quota = await this.getStorageQuota();
    if (!quota) return false;
    const usagePercent = (quota.usage / quota.quota) * 100;
    return usagePercent >= thresholdPercent;
  }

  // Clear metadata cache (for refreshing after clearing cache)
  async clearMetadataCache() {
    await this.init();
    if (this.backend && this.backend.clearMetadataCache) {
      await this.backend.clearMetadataCache();
    }
  }

  // List all cache entries
  async listAllCacheEntries() {
    await this.init();
    return await this.backend.listAllCacheEntries();
  }

  // Extract base key (without date range) from cache key
  extractBaseKey(cacheKey) {
    return this.backend.extractBaseKey(cacheKey);
  }

  // Find cached date ranges that overlap with request range
  async findCachedDateRanges(baseKey, requestStartDate, requestEndDate, maxAgeDays = null) {
    await this.init();
    // Use configured expiry if not provided
    if (maxAgeDays === null || maxAgeDays === undefined) {
      maxAgeDays = this.getCacheExpiryDays();
    }
    return await this.backend.findCachedDateRanges(baseKey, requestStartDate, requestEndDate, maxAgeDays);
  }

  // Store complete sales data with metadata
  async setCompleteSalesData(companyInfo, data, metadata = {}) {
    await this.init();
    return await this.backend.setCompleteSalesData(companyInfo, data, metadata);
  }

  // Get complete sales data for a company
  async getCompleteSalesData(companyInfo, email = null) {
    await this.init();
    return await this.backend.getCompleteSalesData(companyInfo, email);
  }

  // Get lastaltid for a company
  async getLastAlterId(companyInfo, email = null) {
    await this.init();
    return await this.backend.getLastAlterId(companyInfo, email);
  }

  // Get raw cache file data as JSON (for viewing)
  async getCacheFileAsJson(cacheKey) {
    await this.init();
    return await this.backend.getCacheFileAsJson(cacheKey);
  }
}

// Export singleton instance and DateRangeUtils
export const hybridCache = new HybridCache();
export { DateRangeUtils };

