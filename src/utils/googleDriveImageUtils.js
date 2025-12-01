/**
 * Utility functions for converting Google Drive links to displayable image URLs
 */

/**
 * Extract file ID from various Google Drive link formats
 * @param {string} url - Google Drive URL
 * @returns {string|null} - File ID or null if not a Google Drive link
 */
export const extractGoogleDriveFileId = (url) => {
  if (!url || typeof url !== 'string') return null;
  
  // Pattern 1: https://drive.google.com/file/d/{FILE_ID}/view
  let match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  
  // Pattern 2: https://drive.google.com/open?id={FILE_ID}
  match = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  
  // Pattern 3: https://drive.google.com/uc?id={FILE_ID}
  match = url.match(/\/uc\?id=([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  
  return null;
};

/**
 * Check if URL is a Google Drive link
 * @param {string} url - URL to check
 * @returns {boolean}
 */
export const isGoogleDriveLink = (url) => {
  if (!url || typeof url !== 'string') return false;
  return url.includes('drive.google.com');
};

/**
 * Convert Google Drive link to direct image URL
 * @param {string} url - Google Drive URL
 * @param {string} fileType - Optional file type (image, pdf, etc.)
 * @returns {string} - Direct image URL or original URL if conversion fails
 */
export const convertGoogleDriveToImageUrl = (url, fileType = null) => {
  if (!isGoogleDriveLink(url)) {
    return url; // Return original URL if not a Google Drive link
  }
  
  const fileId = extractGoogleDriveFileId(url);
  if (!fileId) {
    console.warn('Could not extract file ID from Google Drive URL:', url);
    return url; // Return original URL if file ID extraction fails
  }
  
  // Use Google CDN format (lh3.googleusercontent.com) - most reliable method
  // Format: https://lh3.googleusercontent.com/d/{FILE_ID}=w{SIZE}
  // This is the same format that Google Drive uses internally and works best
  
  // If file type is known to be PDF, use CDN (first page as image)
  if (fileType === 'pdf' || url.toLowerCase().includes('.pdf') || url.toLowerCase().includes('pdf')) {
    // For PDFs, use CDN with w800 size
    return `https://lh3.googleusercontent.com/d/${fileId}=w800`;
  }
  
  // For images, use CDN format (most reliable, no rate limiting issues)
  return `https://lh3.googleusercontent.com/d/${fileId}=w800`;
  
  // Alternative methods (used as fallbacks in error handler):
  // - Smaller CDN: https://lh3.googleusercontent.com/d/${fileId}=w400
  // - Very small CDN: https://lh3.googleusercontent.com/d/${fileId}=w200
  // - Old thumbnail API: https://drive.google.com/thumbnail?id=${fileId}&sz=w800
  // - Direct view: https://drive.google.com/uc?export=view&id=${fileId}
};

/**
 * Detect file type from URL or attempt to fetch file metadata
 * @param {string} url - Google Drive URL
 * @returns {Promise<string>} - File type (image, pdf, etc.)
 */
export const detectGoogleDriveFileType = async (url) => {
  if (!isGoogleDriveLink(url)) return null;
  
  const fileId = extractGoogleDriveFileId(url);
  if (!fileId) return null;
  
  // Try to detect from URL first
  const urlLower = url.toLowerCase();
  if (urlLower.includes('.pdf') || urlLower.includes('pdf')) return 'pdf';
  if (urlLower.includes('.jpg') || urlLower.includes('.jpeg')) return 'image';
  if (urlLower.includes('.png')) return 'image';
  if (urlLower.includes('.gif')) return 'image';
  if (urlLower.includes('.webp')) return 'image';
  
  // Default to image for unknown types
  return 'image';
};

