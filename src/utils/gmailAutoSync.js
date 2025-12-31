// Gmail Auto-Sync Service for automatic JSON email fetching and caching
import { fetchJsonFromGmail } from './gmailUtils';
import { hybridCache } from './hybridCache';

/**
 * Gmail Auto-Sync Service
 * Automatically checks for new emails with JSON attachments and stores them in cache
 */
class GmailAutoSyncService {
  constructor() {
    this.isRunning = false;
    this.intervalId = null;
    this.checkInterval = 5 * 60 * 1000; // Default: 5 minutes
    this.subjectPattern = null;
    this.companyInfo = null;
    this.onDownloadCallback = null;
    this.onErrorCallback = null;
  }

  /**
   * Start automatic email checking
   * @param {string} subjectPattern - Subject pattern to search for (e.g., "Tally Export *")
   * @param {number} intervalMinutes - Check interval in minutes (default: 5)
   * @param {Function} onDownload - Callback when JSON is downloaded
   * @param {Function} onError - Callback when error occurs
   */
  start(subjectPattern, intervalMinutes = 5, onDownload = null, onError = null) {
    if (this.isRunning) {
      console.warn('Gmail auto-sync is already running');
      return;
    }

    if (!subjectPattern) {
      const error = 'Subject pattern is required';
      console.error(error);
      if (onError) onError(new Error(error));
      return;
    }

    this.subjectPattern = subjectPattern;
    this.checkInterval = intervalMinutes * 60 * 1000;
    this.onDownloadCallback = onDownload;
    this.onErrorCallback = onError;

    // Get company info
    const tallylocId = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('tallyloc_id') : null;
    const coGuid = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('selectedCompanyGuid') : null;
    const company = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('company') : null;

    if (!tallylocId || !coGuid || !company) {
      const error = 'Company information not available';
      console.error(error);
      if (onError) onError(new Error(error));
      return;
    }

    this.companyInfo = {
      tallyloc_id: tallylocId,
      guid: coGuid,
      company: company
    };

    console.log(`📧 Starting Gmail auto-sync for subject: ${subjectPattern}, interval: ${intervalMinutes} minutes`);
    
    // Initial check immediately
    this.checkForNewEmails();

    // Then check at regular intervals
    this.intervalId = setInterval(() => {
      this.checkForNewEmails();
    }, this.checkInterval);

    this.isRunning = true;
  }

  /**
   * Stop automatic email checking
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('📧 Gmail auto-sync stopped');
  }

  /**
   * Check for new emails and download JSON
   */
  async checkForNewEmails() {
    if (!this.subjectPattern || !this.companyInfo) {
      return;
    }

    try {
      console.log(`📧 Checking for new emails with subject pattern: ${this.subjectPattern}...`);
      
      const result = await fetchJsonFromGmail(
        this.subjectPattern,
        this.companyInfo.tallyloc_id,
        this.companyInfo.guid
      );

      if (result.success && result.downloaded && result.data) {
        console.log('✅ New JSON file downloaded from email:', result.messageId);
        
        // Store in cache
        await this.storeJsonInCache(result.data, result.messageId);
        
        // Call callback if provided
        if (this.onDownloadCallback) {
          this.onDownloadCallback({
            data: result.data,
            messageId: result.messageId,
            snippet: result.emailSnippet
          });
        }
      } else if (result.success && !result.downloaded) {
        console.log('ℹ️ No new emails found');
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (error) {
      console.error('❌ Error checking for emails:', error);
      if (this.onErrorCallback) {
        this.onErrorCallback(error);
      }
    }
  }

  /**
   * Store JSON data in cache
   * @param {Object} jsonData - JSON data to store
   * @param {string} messageId - Gmail message ID
   */
  async storeJsonInCache(jsonData, messageId) {
    try {
      const userEmail = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('email') : null;
      
      // Determine the structure of JSON data
      // If it's sales data with vouchers, use setCompleteSalesData
      if (jsonData.vouchers && Array.isArray(jsonData.vouchers)) {
        console.log(`💾 Storing ${jsonData.vouchers.length} vouchers from email in cache...`);
        
        const metadata = {
          email: userEmail,
          source: 'email',
          messageId: messageId,
          downloadedAt: new Date().toISOString()
        };

        // Add booksfrom if present in JSON
        if (jsonData.booksfrom) {
          metadata.booksfrom = jsonData.booksfrom;
        }
        if (jsonData.lastaltid) {
          metadata.lastaltid = jsonData.lastaltid;
        }

        await hybridCache.setCompleteSalesData(this.companyInfo, jsonData, metadata);
        console.log('✅ JSON data stored in cache successfully');
      } else {
        // For other JSON structures, store as custom cache entry
        console.log('💾 Storing JSON data as custom cache entry...');
        
        const cacheKey = `email_json_${userEmail || 'unknown'}_${this.companyInfo.guid}_${Date.now()}`;
        const customData = {
          ...jsonData,
          _metadata: {
            source: 'email',
            messageId: messageId,
            downloadedAt: new Date().toISOString(),
            cacheKey: cacheKey
          }
        };

        // Store in sessionStorage for now (you can extend this to use hybridCache if needed)
        try {
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem(cacheKey, JSON.stringify(customData));
            console.log('✅ JSON data stored in sessionStorage:', cacheKey);
          }
        } catch (error) {
          console.warn('⚠️ Could not store in sessionStorage, storing in memory only');
        }
      }
    } catch (error) {
      console.error('❌ Error storing JSON in cache:', error);
      throw error;
    }
  }

  /**
   * Manually trigger email check
   */
  async checkNow() {
    await this.checkForNewEmails();
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      subjectPattern: this.subjectPattern,
      checkInterval: this.checkInterval,
      companyInfo: this.companyInfo
    };
  }
}

// Export singleton instance
export const gmailAutoSync = new GmailAutoSyncService();












