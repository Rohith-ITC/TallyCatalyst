// Gmail API utility functions for fetching JSON files from emails
import { getValidGoogleTokenFromConfigs } from './googleDriveUtils';
import { isExternalUser } from './cacheUtils';

/**
 * Track processed email message IDs to avoid duplicates
 */
const processedEmailIds = new Set();

/**
 * Get processed email IDs from localStorage
 */
const loadProcessedEmailIds = () => {
  try {
    const stored = localStorage.getItem('gmail_processed_email_ids');
    if (stored) {
      const ids = JSON.parse(stored);
      processedEmailIds.clear();
      ids.forEach(id => processedEmailIds.add(id));
    }
  } catch (error) {
    console.error('Error loading processed email IDs:', error);
  }
};

/**
 * Save processed email IDs to localStorage
 */
const saveProcessedEmailIds = () => {
  try {
    const ids = Array.from(processedEmailIds);
    // Keep only last 100 to avoid localStorage bloat
    const idsToSave = ids.slice(-100);
    localStorage.setItem('gmail_processed_email_ids', JSON.stringify(idsToSave));
  } catch (error) {
    console.error('Error saving processed email IDs:', error);
  }
};

/**
 * Check if email has been processed
 */
const isEmailProcessed = (messageId) => {
  return processedEmailIds.has(messageId);
};

/**
 * Mark email as processed
 */
const markEmailAsProcessed = (messageId) => {
  processedEmailIds.add(messageId);
  saveProcessedEmailIds();
};

// Initialize on load
if (typeof window !== 'undefined') {
  loadProcessedEmailIds();
}

/**
 * Get the authenticated user's email from Google
 */
export const getGoogleUserEmail = async (accessToken) => {
  try {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (response.ok) {
      const userInfo = await response.json();
      return userInfo.email;
    }
    return null;
  } catch (error) {
    console.error('Error fetching user email:', error);
    return null;
  }
};

/**
 * Search for emails matching subject pattern
 * @param {string} accessToken - Google access token
 * @param {string} subjectPattern - Subject pattern to search for (supports wildcards like "Tally Export *")
 * @param {number} maxResults - Maximum number of results to return (default: 50)
 * @returns {Promise<Array>} Array of email message objects
 */
export const searchEmailsBySubject = async (accessToken, subjectPattern, maxResults = 50) => {
  try {
    // Gmail search query - convert subject pattern to Gmail search format
    // Replace wildcards: "Tally Export *" becomes "subject:Tally Export"
    let query = subjectPattern;
    query = query.replace(/\*/g, '').trim();
    query = `subject:${query} has:attachment filename:.json`;
    
    const searchUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`;
    
    const response = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Gmail API error: ${response.statusText} - ${errorData.error?.message || ''}`);
    }

    const data = await response.json();
    return data.messages || [];
  } catch (error) {
    console.error('Error searching emails:', error);
    throw error;
  }
};

/**
 * Get email details including attachments
 * @param {string} accessToken - Google access token
 * @param {string} messageId - Gmail message ID
 * @returns {Promise<Object>} Email details object
 */
export const getEmailDetails = async (accessToken, messageId) => {
  try {
    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch email: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching email details:', error);
    throw error;
  }
};

/**
 * Extract JSON attachment from email
 * @param {string} accessToken - Google access token
 * @param {string} messageId - Gmail message ID
 * @returns {Promise<Object>} Parsed JSON object from attachment
 */
export const extractJsonAttachment = async (accessToken, messageId) => {
  try {
    const email = await getEmailDetails(accessToken, messageId);
    
    if (!email.payload || !email.payload.parts) {
      throw new Error('Email has no attachments');
    }

    // Recursively find JSON attachment
    const findJsonAttachment = (parts) => {
      for (const part of parts) {
        if (part.filename && part.filename.endsWith('.json')) {
          return part;
        }
        if (part.parts) {
          const found = findJsonAttachment(part.parts);
          if (found) return found;
        }
      }
      return null;
    };

    const jsonPart = findJsonAttachment(email.payload.parts);
    if (!jsonPart) {
      throw new Error('No JSON attachment found in email');
    }

    // Get attachment data
    const attachmentId = jsonPart.body.attachmentId;
    if (!attachmentId) {
      throw new Error('Attachment ID not found');
    }

    const attachmentResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    if (!attachmentResponse.ok) {
      throw new Error(`Failed to fetch attachment: ${attachmentResponse.statusText}`);
    }

    const attachmentData = await attachmentResponse.json();
    
    // Decode base64 data
    // Gmail API returns base64url encoded data
    const base64Data = attachmentData.data.replace(/-/g, '+').replace(/_/g, '/');
    const jsonContent = atob(base64Data);
    
    // Parse JSON
    return JSON.parse(jsonContent);
  } catch (error) {
    console.error('Error extracting JSON attachment:', error);
    throw error;
  }
};

/**
 * Get latest unprocessed email with JSON attachment matching subject pattern
 * @param {string} accessToken - Google access token
 * @param {string} subjectPattern - Subject pattern to search for
 * @returns {Promise<Object|null>} Email object or null if none found
 */
export const getLatestUnprocessedEmail = async (accessToken, subjectPattern) => {
  try {
    const messages = await searchEmailsBySubject(accessToken, subjectPattern, 50);
    
    if (!messages || messages.length === 0) {
      return null;
    }

    // Get email details and sort by date (newest first)
    const emailDetails = await Promise.all(
      messages.map(async (msg) => {
        try {
          const details = await getEmailDetails(accessToken, msg.id);
          return {
            id: msg.id,
            threadId: msg.threadId,
            snippet: details.snippet,
            payload: details.payload,
            internalDate: details.internalDate
          };
        } catch (error) {
          console.error(`Error fetching email ${msg.id}:`, error);
          return null;
        }
      })
    );

    // Filter out nulls and sort by date (newest first)
    const validEmails = emailDetails.filter(e => e !== null);
    validEmails.sort((a, b) => parseInt(b.internalDate) - parseInt(a.internalDate));

    // Find first unprocessed email
    for (const email of validEmails) {
      if (!isEmailProcessed(email.id)) {
        return email;
      }
    }

    return null;
  } catch (error) {
    console.error('Error getting latest unprocessed email:', error);
    throw error;
  }
};

/**
 * Fetch JSON from Gmail - Main function
 * @param {string} subjectPattern - Subject pattern to search for (e.g., "Tally Export *")
 * @param {string} tallylocId - Optional: Tally location ID
 * @param {string} coGuid - Optional: Company GUID
 * @param {string} userEmail - Optional: User email (for external users)
 * @returns {Promise<Object>} Result object with success flag and data
 */
export const fetchJsonFromGmail = async (subjectPattern, tallylocId = null, coGuid = null, userEmail = null) => {
  try {
    // Get user email for external users
    const isExternal = isExternalUser();
    if (isExternal) {
      userEmail = userEmail || (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('email') : null);
      if (!userEmail) {
        throw new Error('External user email not found');
      }
    }

    // Get tallylocId and coGuid if not provided
    if (!tallylocId) {
      tallylocId = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('tallyloc_id') : null;
    }
    if (!coGuid) {
      coGuid = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('selectedCompanyGuid') : null;
    }

    if (!tallylocId || !coGuid) {
      throw new Error('Company information not found. Please select a company first.');
    }

    // Get access token (will get user-specific token for external users)
    const token = await getValidGoogleTokenFromConfigs(tallylocId, coGuid, userEmail);
    
    if (!token) {
      throw new Error('No Google access token available. Please configure your Google account first.');
    }

    // For external users, verify the token belongs to their email
    if (isExternal && userEmail) {
      const tokenOwnerEmail = await getGoogleUserEmail(token);
      if (tokenOwnerEmail && tokenOwnerEmail.toLowerCase() !== userEmail.toLowerCase()) {
        throw new Error(`Google account mismatch. Please configure your own Google account (${userEmail}).`);
      }
    }

    // Get latest unprocessed email
    const email = await getLatestUnprocessedEmail(token, subjectPattern);
    
    if (!email) {
      return {
        success: true,
        downloaded: false,
        message: 'No new emails with JSON attachments found matching the subject pattern'
      };
    }

    // Extract JSON from email
    const jsonData = await extractJsonAttachment(token, email.id);

    // Mark email as processed
    markEmailAsProcessed(email.id);

    return {
      success: true,
      downloaded: true,
      data: jsonData,
      messageId: email.id,
      emailSnippet: email.snippet
    };
  } catch (error) {
    console.error('Error in fetchJsonFromGmail:', error);
    return {
      success: false,
      downloaded: false,
      error: error.message,
      data: null
    };
  }
};







