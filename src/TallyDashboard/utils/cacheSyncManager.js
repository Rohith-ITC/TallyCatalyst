/**
 * Cache Sync Manager
 * 
 * Singleton pattern to manage cache sync operations globally.
 * Prevents duplicate sync operations and shares progress between components.
 */

class CacheSyncManager {
  constructor() {
    this.isSyncing = false;
    this.progress = { current: 0, total: 0, message: '' };
    this.companyInfo = null;
    this.syncPromise = null;
    this.subscribers = new Set();
    this.syncStartTime = null;
  }

  /**
   * Subscribe to progress updates
   * @param {Function} callback - Function to call when progress updates
   * @returns {Function} Unsubscribe function
   */
  subscribe(callback) {
    this.subscribers.add(callback);
    // Immediately call with current progress
    if (this.isSyncing) {
      callback(this.progress);
    }
    // Return unsubscribe function
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Notify all subscribers of progress update
   * @param {Object} progress - Progress object { current, total, message }
   */
  notifySubscribers(progress) {
    this.progress = progress;
    this.subscribers.forEach(callback => {
      try {
        callback(progress);
      } catch (error) {
        console.error('Error in sync progress subscriber:', error);
      }
    });
  }

  /**
   * Check if a sync is currently in progress
   * @returns {boolean}
   */
  isSyncInProgress() {
    return this.isSyncing;
  }

  /**
   * Get current progress
   * @returns {Object} Progress object { current, total, message }
   */
  getProgress() {
    return { ...this.progress };
  }

  /**
   * Get current company info being synced
   * @returns {Object|null}
   */
  getCompanyInfo() {
    return this.companyInfo;
  }

  /**
   * Check if sync is for the same company
   * @param {Object} companyInfo - Company info to check
   * @returns {boolean}
   */
  isSameCompany(companyInfo) {
    if (!this.companyInfo || !companyInfo) return false;
    return (
      this.companyInfo.tallyloc_id === companyInfo.tallyloc_id &&
      this.companyInfo.guid === companyInfo.guid
    );
  }

  /**
   * Start a sync operation
   * @param {Object} companyInfo - Company information
   * @param {Function} syncFunction - Function that performs the sync
   * @returns {Promise} Promise that resolves when sync completes
   */
  async startSync(companyInfo, syncFunction) {
    // If sync is already in progress for the same company, return existing promise
    if (this.isSyncing && this.isSameCompany(companyInfo)) {
      console.log('🔄 Sync already in progress for this company, returning existing promise');
      return this.syncPromise;
    }

    // If sync is in progress for a different company, wait for it to complete
    if (this.isSyncing && !this.isSameCompany(companyInfo)) {
      console.log('⚠️ Sync in progress for different company, waiting...');
      try {
        await this.syncPromise;
      } catch (error) {
        // Ignore errors from previous sync
        console.log('Previous sync completed (with possible error)');
      }
    }

    // Start new sync
    this.isSyncing = true;
    this.companyInfo = companyInfo;
    this.syncStartTime = Date.now();
    this.notifySubscribers({ current: 0, total: 0, message: 'Starting sync...' });

    // Create progress callback wrapper
    const progressCallback = (progress) => {
      this.notifySubscribers(progress);
    };

    // Execute sync function
    this.syncPromise = syncFunction(companyInfo, progressCallback)
      .then((result) => {
        console.log('✅ Sync completed successfully');
        return result;
      })
      .catch((error) => {
        console.error('❌ Sync failed:', error);
        throw error;
      })
      .finally(() => {
        this.isSyncing = false;
        this.companyInfo = null;
        this.syncPromise = null;
        this.syncStartTime = null;
        // Clear progress after a short delay
        setTimeout(() => {
          if (!this.isSyncing) {
            this.notifySubscribers({ current: 0, total: 0, message: '' });
          }
        }, 1000);
      });

    return this.syncPromise;
  }

  /**
   * Cancel current sync (if possible)
   */
  cancelSync() {
    if (this.isSyncing) {
      console.log('🛑 Cancelling sync...');
      this.isSyncing = false;
      this.companyInfo = null;
      this.syncPromise = null;
      this.syncStartTime = null;
      this.notifySubscribers({ current: 0, total: 0, message: 'Cancelled' });
    }
  }
}

// Export singleton instance
export const cacheSyncManager = new CacheSyncManager();

