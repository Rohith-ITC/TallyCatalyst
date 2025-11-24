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

// Shared encryption utilities for both OPFS and IndexedDB backends
class EncryptionUtils {
  constructor() {
    // Use IndexedDB for storing user keys (shared by both backends)
    this.db = new Dexie('TallyCatalystCache');
    this.db.version(1).stores({
      userKeys: '++id, email, salt'
    });
  }

  // Get or create salt for user email
  async getUserSalt(email) {
    if (!email) {
      throw new Error('Email is required for cache encryption');
    }

    try {
      let userKey = await this.db.userKeys.where('email').equals(email).first();
      
      if (!userKey) {
        // Generate a new salt for this user
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const saltBase64 = btoa(String.fromCharCode(...salt));
        
        userKey = {
          email: email,
          salt: saltBase64
        };
        await this.db.userKeys.add(userKey);
      }
      
      return userKey.salt;
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
    // Use IndexedDB for metadata (timestamps, expiry) for fast queries
    this.metadataDb = new Dexie('TallyCatalystOPFSMetadata');
    this.metadataDb.version(1).stores({
      salesMetadata: '++id, cacheKey, timestamp, startDate, endDate, baseKey',
      dashboardMetadata: '++id, cacheKey, timestamp'
    });
  }

  async init() {
    if (this.initialized) return;
    
    try {
      if ('storage' in navigator && 'getDirectory' in navigator.storage) {
        this.root = await navigator.storage.getDirectory();
        this.initialized = true;
        console.log('✅ OPFS initialized');
      } else {
        throw new Error('OPFS not supported');
      }
    } catch (error) {
      console.error('OPFS initialization error:', error);
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
      
      // Store metadata in IndexedDB with date range
      const existing = await this.metadataDb.salesMetadata.where('cacheKey').equals(cacheKey).first();
      const metadata = {
        cacheKey,
        timestamp,
        baseKey,
        ...(dateRange ? { startDate: dateRange.startDate, endDate: dateRange.endDate } : {})
      };
      
      if (existing) {
        await this.metadataDb.salesMetadata.update(existing.id, metadata);
      } else {
        await this.metadataDb.salesMetadata.add(metadata);
      }
      
      // Clean up old entries
      const expiryTime = Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000);
      const expired = await this.metadataDb.salesMetadata.where('timestamp').below(expiryTime).toArray();
      for (const entry of expired) {
        try {
          const expiredFilePath = this.getSalesFilePath(entry.cacheKey);
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
        await this.metadataDb.salesMetadata.delete(entry.id);
      }
      
      console.log(`✅ Cached sales data in OPFS: ${cacheKey}`);
    } catch (error) {
      console.error('Error storing sales data in OPFS:', error);
      throw error;
    }
  }

  async getSalesData(cacheKey, maxAgeDays = 5) {
    try {
      await this.init();
      
      // Check metadata first
      const metadata = await this.metadataDb.salesMetadata.where('cacheKey').equals(cacheKey).first();
      if (!metadata) {
        return null;
      }
      
      // Check expiry
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
        await this.metadataDb.salesMetadata.delete(metadata.id);
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
        await this.metadataDb.salesMetadata.delete(metadata.id);
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
      const existing = await this.metadataDb.dashboardMetadata.where('cacheKey').equals(cacheKey).first();
      if (existing) {
        await this.metadataDb.dashboardMetadata.update(existing.id, { timestamp });
      } else {
        await this.metadataDb.dashboardMetadata.add({ cacheKey, timestamp });
      }
      
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
      const metadata = await this.metadataDb.dashboardMetadata.where('cacheKey').equals(cacheKey).first();
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
        await this.metadataDb.dashboardMetadata.delete(metadata.id);
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
      const allSalesMetadata = await this.metadataDb.salesMetadata.toArray();
      const allDashboardMetadata = await this.metadataDb.dashboardMetadata.toArray();
      
      const salesToDelete = allSalesMetadata.filter(item => item.cacheKey.startsWith(prefix));
      const stateToDelete = allDashboardMetadata.filter(item => item.cacheKey.startsWith(prefix));
      
      // Delete files
      for (const entry of salesToDelete) {
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
          await dir.removeEntry(fileName);
        } catch (err) {
          // File might not exist, ignore
        }
        await this.metadataDb.salesMetadata.delete(entry.id);
      }
      
      for (const entry of stateToDelete) {
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
          await dir.removeEntry(fileName);
        } catch (err) {
          // File might not exist, ignore
        }
        await this.metadataDb.dashboardMetadata.delete(entry.id);
      }
      
      console.log(`🧹 Cleared OPFS cache for company: ${companyInfo.company}`);
    } catch (error) {
      console.error('Error clearing company cache in OPFS:', error);
    }
  }

  // Find cached date ranges for a base key that overlap with request range
  async findCachedDateRanges(baseKey, requestStartDate, requestEndDate, maxAgeDays = 5) {
    try {
      await this.init();
      const expiryTime = Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000);
      
      // Get all metadata entries with matching base key
      const allMetadata = await this.metadataDb.salesMetadata
        .where('baseKey').equals(baseKey)
        .toArray();
      
      // Filter by expiry time
      const validMetadata = allMetadata.filter(entry => entry.timestamp >= expiryTime);
      
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
}

// IndexedDB Backend - stores encrypted data in IndexedDB
class IndexedDBBackend {
  constructor(encryptionUtils) {
    this.encryption = encryptionUtils;
    this.db = new Dexie('TallyCatalystCache');
    this.db.version(1).stores({
      salesData: '++id, cacheKey, timestamp, encryptedData, startDate, endDate, baseKey',
      dashboardState: '++id, cacheKey, timestamp, encryptedData'
    });
  }

  async setSalesData(cacheKey, data, maxAgeDays = 5, startDate = null, endDate = null) {
    try {
      const encrypted = await this.encryption.encryptData(data);
      const timestamp = Date.now();
      
      // Parse date range from cache key if not provided
      let dateRange = null;
      if (startDate && endDate) {
        dateRange = { startDate, endDate };
      } else {
        dateRange = DateRangeUtils.parseDateRangeFromCacheKey(cacheKey);
      }
      
      // Extract base key
      const baseKey = this.extractBaseKey(cacheKey);
      
      // Check if entry exists
      const existing = await this.db.salesData.where('cacheKey').equals(cacheKey).first();
      
      const entryData = {
        cacheKey,
        encryptedData: encrypted,
        timestamp: timestamp,
        baseKey,
        ...(dateRange ? { startDate: dateRange.startDate, endDate: dateRange.endDate } : {})
      };
      
      if (existing) {
        await this.db.salesData.update(existing.id, entryData);
      } else {
        await this.db.salesData.add(entryData);
      }

      // Clean up old entries (older than maxAgeDays)
      const expiryTime = Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000);
      await this.db.salesData.where('timestamp').below(expiryTime).delete();
      
      console.log(`✅ Cached sales data in IndexedDB: ${cacheKey}`);
    } catch (error) {
      console.error('Error storing sales data in IndexedDB:', error);
      // Don't throw - allow app to continue even if cache fails
    }
  }

  async getSalesData(cacheKey, maxAgeDays = 5) {
    try {
      const entry = await this.db.salesData.where('cacheKey').equals(cacheKey).first();
      
      if (!entry) {
        return null;
      }

      // Check expiry
      const age = Date.now() - entry.timestamp;
      const maxAge = maxAgeDays * 24 * 60 * 60 * 1000;
      
      if (age > maxAge) {
        await this.db.salesData.delete(entry.id);
        return null;
      }

      // Decrypt and return
      const decrypted = await this.encryption.decryptData(entry.encryptedData);
      if (!decrypted) {
        // Decryption failed (likely wrong user), delete entry
        await this.db.salesData.delete(entry.id);
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
      const encrypted = await this.encryption.encryptData(state);
      const timestamp = Date.now();
      
      const existing = await this.db.dashboardState.where('cacheKey').equals(cacheKey).first();
      
      if (existing) {
        await this.db.dashboardState.update(existing.id, {
          encryptedData: encrypted,
          timestamp: timestamp
        });
      } else {
        await this.db.dashboardState.add({
          cacheKey,
          encryptedData: encrypted,
          timestamp: timestamp
        });
      }
      
      console.log(`✅ Cached dashboard state in IndexedDB: ${cacheKey}`);
    } catch (error) {
      console.error('Error storing dashboard state in IndexedDB:', error);
      // Don't throw - allow app to continue
    }
  }

  async getDashboardState(cacheKey) {
    try {
      const entry = await this.db.dashboardState.where('cacheKey').equals(cacheKey).first();
      if (!entry) return null;

      const decrypted = await this.encryption.decryptData(entry.encryptedData);
      if (!decrypted) {
        await this.db.dashboardState.delete(entry.id);
        return null;
      }

      return decrypted;
    } catch (error) {
      console.error('Error retrieving dashboard state from IndexedDB:', error);
      return null;
    }
  }

  // Extract base key (without date range) from cache key
  extractBaseKey(cacheKey) {
    const parts = cacheKey.split('_');
    if (parts.length >= 2) {
      const endDate = parts[parts.length - 1];
      const startDate = parts[parts.length - 2];
      if (/^\d{4}-\d{2}-\d{2}$/.test(startDate) && /^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
        return parts.slice(0, -2).join('_');
      }
    }
    return cacheKey;
  }

  // Find cached date ranges for a base key that overlap with request range
  async findCachedDateRanges(baseKey, requestStartDate, requestEndDate, maxAgeDays = 5) {
    try {
      const expiryTime = Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000);
      
      // Get all entries with matching base key
      const allEntries = await this.db.salesData
        .where('baseKey').equals(baseKey)
        .toArray();
      
      // Filter by expiry time
      const validEntries = allEntries.filter(entry => entry.timestamp >= expiryTime);
      
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
          // Decrypt the data
          const decrypted = await this.encryption.decryptData(entry.encryptedData);
          if (decrypted) {
            cachedRanges.push({
              ...cachedRange,
              data: decrypted
            });
          }
        }
      }
      
      return cachedRanges;
    } catch (error) {
      console.error('Error finding cached date ranges in IndexedDB:', error);
      return [];
    }
  }

  async clearCompanyCache(companyInfo) {
    try {
      const prefix = `${companyInfo.tallyloc_id}_${companyInfo.guid}_`;
      const allSalesData = await this.db.salesData.toArray();
      const allDashboardState = await this.db.dashboardState.toArray();
      
      const salesToDelete = allSalesData.filter(item => item.cacheKey.startsWith(prefix));
      const stateToDelete = allDashboardState.filter(item => item.cacheKey.startsWith(prefix));
      
      await Promise.all([
        ...salesToDelete.map(item => this.db.salesData.delete(item.id)),
        ...stateToDelete.map(item => this.db.dashboardState.delete(item.id))
      ]);
      
      console.log(`🧹 Cleared IndexedDB cache for company: ${companyInfo.company}`);
    } catch (error) {
      console.error('Error clearing company cache in IndexedDB:', error);
    }
  }
}

// Hybrid Cache - automatically uses OPFS or IndexedDB based on browser support
class HybridCache {
  constructor() {
    this.encryption = new EncryptionUtils();
    this.backend = null;
    this.backendType = null;
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    
    // Detect browser support
    const supportsOPFS = 'storage' in navigator && 'getDirectory' in navigator.storage;
    
    if (supportsOPFS) {
      try {
        this.backend = new OPFSBackend(this.encryption);
        await this.backend.init();
        this.backendType = 'OPFS';
        console.log('✅ Using OPFS backend for cache storage');
      } catch (error) {
        console.warn('⚠️ OPFS initialization failed, falling back to IndexedDB:', error);
        this.backend = new IndexedDBBackend(this.encryption);
        this.backendType = 'IndexedDB';
        console.log('✅ Using IndexedDB backend for cache storage (OPFS fallback)');
      }
    } else {
      this.backend = new IndexedDBBackend(this.encryption);
      this.backendType = 'IndexedDB';
      console.log('✅ Using IndexedDB backend for cache storage (OPFS not supported)');
    }
    
    this.initialized = true;
  }

  async setSalesData(cacheKey, data, maxAgeDays = 5, startDate = null, endDate = null) {
    await this.init();
    return await this.backend.setSalesData(cacheKey, data, maxAgeDays, startDate, endDate);
  }

  async getSalesData(cacheKey, maxAgeDays = 5) {
    await this.init();
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
    // Return which backend is being used
    return {
      backend: this.backendType,
      supportsOPFS: 'storage' in navigator && 'getDirectory' in navigator.storage
    };
  }

  // Extract base key (without date range) from cache key
  extractBaseKey(cacheKey) {
    if (this.backend && typeof this.backend.extractBaseKey === 'function') {
      return this.backend.extractBaseKey(cacheKey);
    }
    // Fallback implementation
    const parts = cacheKey.split('_');
    if (parts.length >= 2) {
      const endDate = parts[parts.length - 1];
      const startDate = parts[parts.length - 2];
      if (/^\d{4}-\d{2}-\d{2}$/.test(startDate) && /^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
        return parts.slice(0, -2).join('_');
      }
    }
    return cacheKey;
  }

  // Find cached date ranges that overlap with request range
  async findCachedDateRanges(baseKey, requestStartDate, requestEndDate, maxAgeDays = 5) {
    await this.init();
    return await this.backend.findCachedDateRanges(baseKey, requestStartDate, requestEndDate, maxAgeDays);
  }
}

// Export singleton instance and DateRangeUtils
export const hybridCache = new HybridCache();
export { DateRangeUtils };

