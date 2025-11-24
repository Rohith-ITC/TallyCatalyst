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

  // Derive encryption key from email + salt (stable across token refreshes)
  async getEncryptionKey() {
    const email = sessionStorage.getItem('email');
    if (!email) {
      throw new Error('No user email found - cannot access encrypted cache');
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

  // Encrypt data
  async encryptData(data) {
    try {
      const keyBuffer = await this.getEncryptionKey();
      const key = await crypto.subtle.importKey(
        'raw',
        keyBuffer,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt']
      );

      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(JSON.stringify(data));
      
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        dataBuffer
      );

      // Combine IV and encrypted data
      const combined = new Uint8Array(iv.length + encrypted.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(encrypted), iv.length);

      // Convert to base64 for storage
      return btoa(String.fromCharCode(...combined));
    } catch (error) {
      console.error('Encryption error:', error);
      throw error;
    }
  }

  // Decrypt data
  async decryptData(encryptedBase64) {
    try {
      const keyBuffer = await this.getEncryptionKey();
      const key = await crypto.subtle.importKey(
        'raw',
        keyBuffer,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );

      // Decode from base64
      const combined = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
      
      // Extract IV and encrypted data
      const iv = combined.slice(0, 12);
      const encrypted = combined.slice(12);

      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        encrypted
      );

      const decoder = new TextDecoder();
      return JSON.parse(decoder.decode(decrypted));
    } catch (error) {
      console.error('Decryption error:', error);
      // If decryption fails (e.g., wrong user), return null
      return null;
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
      
      // Store metadata in OPFS
      const salesMap = this.metadataCache.get('sales') || new Map();
      const metadata = {
        cacheKey,
        timestamp,
        baseKey,
        ...(dateRange ? { startDate: dateRange.startDate, endDate: dateRange.endDate } : {})
      };
      salesMap.set(cacheKey, metadata);
      this.metadataCache.set('sales', salesMap);
      await this.saveMetadata();
      
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

  // List all cache entries for viewing
  async listAllCacheEntries() {
    try {
      await this.init();
      
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
        salesData: 'cacheKey, timestamp, baseKey, startDate, endDate',
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
    
    // Detect browser support with detailed logging
    const isSecureContext = window.isSecureContext || window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const hasStorage = 'storage' in navigator;
    const hasGetDirectory = hasStorage && 'getDirectory' in navigator.storage;
    const supportsOPFS = isSecureContext && hasStorage && hasGetDirectory;
    
    console.log('🔍 Storage Detection:', {
      isSecureContext,
      protocol: window.location.protocol,
      hostname: window.location.hostname,
      hasStorage,
      hasGetDirectory,
      supportsOPFS,
      userAgent: navigator.userAgent
    });
    
    // Try OPFS first if supported
    if (supportsOPFS) {
      try {
        console.log('🚀 Initializing OPFS backend...');
        // Initialize OPFS root first
        const opfsRoot = await navigator.storage.getDirectory();
        this.encryption = new EncryptionUtils(opfsRoot);
        this.backend = new OPFSBackend(this.encryption);
        await this.backend.init();
        this.backendType = 'OPFS';
        console.log('✅ OPFS backend initialized successfully');
        this.initialized = true;
        return;
      } catch (error) {
        console.warn('⚠️ OPFS initialization failed, falling back to IndexedDB:', error);
        // Fall through to IndexedDB
      }
    }
    
    // Fall back to IndexedDB
    try {
      console.log('🚀 Initializing IndexedDB backend...');
      this.encryption = new EncryptionUtils(null); // No OPFS root
      this.backend = new IndexedDBBackend(this.encryption);
      await this.backend.init();
      this.backendType = 'IndexedDB';
      console.log('✅ IndexedDB backend initialized successfully');
    } catch (error) {
      console.error('❌ IndexedDB initialization failed:', error);
      throw new Error('Failed to initialize both OPFS and IndexedDB backends');
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
}

// Export singleton instance and DateRangeUtils
export const hybridCache = new HybridCache();
export { DateRangeUtils };

