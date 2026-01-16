import React, { useState, useEffect } from 'react';
import { getValidGoogleTokenFromConfigs } from '../utils/googleDriveUtils';
import { searchEmailsBySubject, getEmailDetails } from '../utils/gmailUtils';

function GmailJsonViewer() {
  // State for Gmail emails section
  const [emailsLoading, setEmailsLoading] = useState(false);
  const [emails, setEmails] = useState([]);
  const [emailsError, setEmailsError] = useState(null);
  const [emailsProgress, setEmailsProgress] = useState(null);
  const [lastEmailsFetchTime, setLastEmailsFetchTime] = useState(null);
  
  // Email detail modal state
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [emailDetails, setEmailDetails] = useState(null);
  const [emailDetailsLoading, setEmailDetailsLoading] = useState(false);
  const [emailDetailsError, setEmailDetailsError] = useState(null);
  
  // Date range state
  const [emailType, setEmailType] = useState('inbox'); // 'inbox' or 'sent'
  const [dateRangeType, setDateRangeType] = useState('preset'); // 'preset' or 'custom'
  const [presetRange, setPresetRange] = useState('3days'); // 'all', '3days', '1week', '1month'
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Get company info from session storage
  const tallylocId = sessionStorage.getItem('tallyloc_id');
  const coGuid = sessionStorage.getItem('selectedCompanyGuid') || sessionStorage.getItem('guid');
  const userEmail = sessionStorage.getItem('email');

  // Helper function to get date range query for Gmail API
  const getDateRangeQuery = () => {
    const folderQuery = emailType === 'inbox' ? 'in:inbox' : 'in:sent';
    
    if (dateRangeType === 'preset') {
      if (presetRange === 'all') {
        return folderQuery; // No date filter, get all emails from selected folder
      }
      
      const now = new Date();
      let startDate = new Date();
      
      switch (presetRange) {
        case '3days':
          startDate.setDate(now.getDate() - 3);
          break;
        case '1week':
          startDate.setDate(now.getDate() - 7);
          break;
        case '1month':
          startDate.setMonth(now.getMonth() - 1);
          break;
        default:
          return folderQuery;
      }
      
      // Gmail API uses Unix timestamp in seconds
      const timestamp = Math.floor(startDate.getTime() / 1000);
      return `${folderQuery} after:${timestamp}`;
    } else {
      // Custom date range
      if (!customStartDate) {
        return folderQuery; // If no start date, get all
      }
      
      const startTimestamp = Math.floor(new Date(customStartDate).getTime() / 1000);
      let query = `${folderQuery} after:${startTimestamp}`;
      
      if (customEndDate) {
        // Add 1 day to end date to include the entire end date
        const endDate = new Date(customEndDate);
        endDate.setHours(23, 59, 59, 999);
        const endTimestamp = Math.floor(endDate.getTime() / 1000);
        query += ` before:${endTimestamp}`;
      }
      
      return query;
    }
  };

  // Fetch Gmail emails from configured company
  const fetchGmailEmails = async () => {
    if (!tallylocId || !coGuid) {
      setEmailsError('Please select a company first.');
      return;
    }

    setEmailsLoading(true);
    setEmailsError(null);
    setEmailsProgress(null);

    try {
      // Get Gmail token from company configs
      const token = await getValidGoogleTokenFromConfigs(tallylocId, coGuid, userEmail);
      
      if (!token) {
        setEmailsError('Gmail is not configured for this company. Please configure your Google account in Tally Configurations.');
        setEmailsLoading(false);
        return;
      }

      // Get date range query
      const dateQuery = getDateRangeQuery();
      
      // Fetch all emails with pagination
      let allMessages = [];
      let nextPageToken = null;
      let pageCount = 0;
      const maxPages = 100; // Safety limit to prevent infinite loops
      
      do {
        let searchUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(dateQuery)}&maxResults=500`;
        if (nextPageToken) {
          searchUrl += `&pageToken=${encodeURIComponent(nextPageToken)}`;
        }
        
        const response = await fetch(searchUrl, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(`Gmail API error: ${response.statusText} - ${errorData.error?.message || ''}`);
        }

        const data = await response.json();
        const messages = data.messages || [];
        allMessages = allMessages.concat(messages);
        nextPageToken = data.nextPageToken || null;
        pageCount++;
        
        // Update progress message
        if (allMessages.length > 0) {
          setEmailsProgress(`Found ${allMessages.length} emails${nextPageToken ? ' (fetching more...)' : ''}`);
        }
      } while (nextPageToken && pageCount < maxPages);
      
      if (allMessages.length === 0) {
        setEmails([]);
        setEmailsError('No emails found for the selected date range.');
        setEmailsProgress(null);
        setEmailsLoading(false);
        return;
      }

      // Show progress message
      setEmailsProgress(`Found ${allMessages.length} emails. Fetching details...`);

      // Fetch details for each email in batches to avoid overwhelming the API
      const batchSize = 20;
      const emailDetails = [];
      
      for (let i = 0; i < allMessages.length; i += batchSize) {
        const batch = allMessages.slice(i, i + batchSize);
        const batchDetails = await Promise.all(
          batch.map(async (msg) => {
          try {
            const details = await getEmailDetails(token, msg.id);
            
            // Extract subject, from, date from headers
            const headers = details.payload?.headers || [];
            const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject';
            const from = headers.find(h => h.name === 'From')?.value || 'Unknown';
            const date = headers.find(h => h.name === 'Date')?.value || '';
            
            return {
              id: msg.id,
              threadId: msg.threadId,
              subject: subject,
              from: from,
              date: date,
              snippet: details.snippet || '',
              internalDate: details.internalDate
            };
          } catch (err) {
            console.error(`Error fetching email ${msg.id}:`, err);
            return null;
          }
          })
        );
        
        emailDetails.push(...batchDetails);
        
        // Update progress
        if (i + batchSize < allMessages.length) {
          setEmailsProgress(`Fetching details... ${Math.min(i + batchSize, allMessages.length)}/${allMessages.length} emails`);
        }
      }

      // Filter out nulls and sort by date (newest first)
      const validEmails = emailDetails.filter(e => e !== null);
      validEmails.sort((a, b) => parseInt(b.internalDate) - parseInt(a.internalDate));
      
      setEmails(validEmails);
      setLastEmailsFetchTime(new Date());
      setEmailsError(null);
      setEmailsProgress(null);
    } catch (err) {
      console.error('Error fetching Gmail emails:', err);
      setEmailsError(err.message || 'An unexpected error occurred while fetching emails.');
      setEmailsProgress(null);
      setEmails([]);
    } finally {
      setEmailsLoading(false);
    }
  };

  // Decode email body from base64
  const decodeEmailBody = (bodyData, encoding = 'base64') => {
    if (!bodyData) return '';
    
    try {
      if (encoding === 'base64' || encoding === 'base64url') {
        // Replace URL-safe base64 characters
        const base64Data = bodyData.replace(/-/g, '+').replace(/_/g, '/');
        // Add padding if needed
        const padded = base64Data + '='.repeat((4 - base64Data.length % 4) % 4);
        return decodeURIComponent(escape(atob(padded)));
      }
      return bodyData;
    } catch (error) {
      console.error('Error decoding email body:', error);
      return bodyData;
    }
  };

  // Extract email body from payload
  const extractEmailBody = (payload) => {
    if (!payload) return '';
    
    let htmlBody = '';
    let textBody = '';
    
    // Recursive function to find body parts
    const findBodyParts = (parts) => {
      if (!parts) return;
      
      for (const part of parts) {
        // If this part has nested parts, recurse
        if (part.parts) {
          findBodyParts(part.parts);
        }
        
        // Check if this is a body part (not an attachment)
        if (part.body && part.body.data && !part.filename) {
          const decoded = decodeEmailBody(part.body.data, part.body.encoding || 'base64');
          
          if (part.mimeType === 'text/html') {
            htmlBody = decoded;
          } else if (part.mimeType === 'text/plain') {
            textBody = decoded;
          }
        }
      }
    };
    
    // Check if it's a simple message (no parts)
    if (payload.body && payload.body.data && !payload.parts) {
      const decoded = decodeEmailBody(payload.body.data, payload.body.encoding || 'base64');
      if (payload.mimeType === 'text/html') {
        htmlBody = decoded;
      } else {
        textBody = decoded;
      }
    }
    
    // Check parts recursively
    if (payload.parts) {
      findBodyParts(payload.parts);
    }
    
    // Prefer HTML over plain text
    if (htmlBody) {
      return htmlBody;
    }
    
    if (textBody) {
      // Convert plain text to HTML for display
      return textBody.split('\n').map(line => {
        // Escape HTML
        const escaped = line
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        return `<p style="margin: 0 0 8px 0;">${escaped || '&nbsp;'}</p>`;
      }).join('');
    }
    
    return '';
  };

  // Handle email click - fetch and display full email
  const handleEmailClick = async (email) => {
    setSelectedEmail(email);
    setEmailDetails(null);
    setEmailDetailsError(null);
    setEmailDetailsLoading(true);

    try {
      // Get Gmail token from company configs
      const token = await getValidGoogleTokenFromConfigs(tallylocId, coGuid, userEmail);
      
      if (!token) {
        setEmailDetailsError('Gmail token not available. Please configure your Google account.');
        setEmailDetailsLoading(false);
        return;
      }

      // Fetch full email details
      const details = await getEmailDetails(token, email.id);
      
      // Extract all headers
      const headers = details.payload?.headers || [];
      const headerMap = {};
      headers.forEach(header => {
        headerMap[header.name.toLowerCase()] = header.value;
      });
      
      // Extract body
      const body = extractEmailBody(details.payload);
      
      // Extract attachments info
      const attachments = [];
      const findAttachments = (parts) => {
        if (!parts) return;
        parts.forEach(part => {
          if (part.filename && part.body && part.body.attachmentId) {
            attachments.push({
              filename: part.filename,
              mimeType: part.mimeType,
              size: part.body.size,
              attachmentId: part.body.attachmentId
            });
          }
          if (part.parts) {
            findAttachments(part.parts);
          }
        });
      };
      if (details.payload?.parts) {
        findAttachments(details.payload.parts);
      }
      
      setEmailDetails({
        ...details,
        headers: headerMap,
        body: body,
        attachments: attachments
      });
    } catch (err) {
      console.error('Error fetching email details:', err);
      setEmailDetailsError(err.message || 'Failed to load email details.');
    } finally {
      setEmailDetailsLoading(false);
    }
  };

  // Close email modal
  const closeEmailModal = () => {
    setSelectedEmail(null);
    setEmailDetails(null);
    setEmailDetailsError(null);
  };

  // Auto-fetch on mount
  useEffect(() => {
    if (tallylocId && coGuid) {
      fetchGmailEmails();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tallylocId, coGuid]);

  return (
    <div>
      {/* Gmail Emails Section */}
      <div style={{
        padding: '0',
        background: 'transparent',
        border: 'none',
        borderRadius: '0',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
      }}>
        {/* Date Range Filter Section */}
        <div style={{
          marginBottom: '12px',
          padding: '4px',
          background: '#fff',
          borderRadius: '6px',
          border: '1px solid #e2e8f0'
        }}>
          {/* Header with Title and Refresh Button */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '6px',
            flexWrap: 'wrap',
            gap: '8px'
          }}>
            <div>
              <h3 style={{
                margin: 0,
                fontSize: '16px',
                fontWeight: 700,
                color: '#1e293b',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span className="material-icons" style={{ fontSize: '18px', color: '#3b82f6' }}>
                  {emailType === 'inbox' ? 'inbox' : 'send'}
                </span>
                Gmail {emailType === 'inbox' ? 'Inbox' : 'Sent'} (from Tally Config)
              </h3>
            </div>
            <button
              onClick={fetchGmailEmails}
              disabled={emailsLoading || !tallylocId || !coGuid}
              style={{
                padding: '6px 12px',
                background: emailsLoading ? '#94a3b8' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                fontWeight: 600,
                fontSize: '11px',
                cursor: emailsLoading ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                if (!emailsLoading && tallylocId && coGuid) {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.35)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(16, 185, 129, 0.25)';
              }}
            >
              <span className="material-icons" style={{ fontSize: '14px' }}>
                {emailsLoading ? 'hourglass_empty' : 'refresh'}
              </span>
              {emailsLoading ? 'Loading...' : 'Refresh Emails'}
            </button>
          </div>

          {/* Compact Filter Controls Row */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap'
          }}>
            {/* Range Type Selection */}
            <div style={{
              display: 'flex',
              gap: '6px',
              alignItems: 'center'
            }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer',
                fontSize: '11px',
                color: '#475569'
              }}>
                <input
                  type="radio"
                  name="dateRangeType"
                  value="preset"
                  checked={dateRangeType === 'preset'}
                  onChange={(e) => setDateRangeType(e.target.value)}
                  style={{ cursor: 'pointer', width: '12px', height: '12px' }}
                />
                Preset Range
              </label>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer',
                fontSize: '11px',
                color: '#475569'
              }}>
                <input
                  type="radio"
                  name="dateRangeType"
                  value="custom"
                  checked={dateRangeType === 'custom'}
                  onChange={(e) => setDateRangeType(e.target.value)}
                  style={{ cursor: 'pointer', width: '12px', height: '12px' }}
                />
                Custom Range
              </label>
            </div>

            {/* Preset Range Options */}
            {dateRangeType === 'preset' && (
              <div style={{
                display: 'flex',
                gap: '4px',
                alignItems: 'center'
              }}>
                {[
                  { value: 'all', label: 'All Emails' },
                  { value: '3days', label: 'Last 3 Days' },
                  { value: '1week', label: 'Last Week' },
                  { value: '1month', label: 'Last Month' }
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setPresetRange(option.value)}
                    style={{
                      padding: '4px 8px',
                      background: presetRange === option.value
                        ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
                        : '#f1f5f9',
                      color: presetRange === option.value ? '#fff' : '#475569',
                      border: presetRange === option.value ? 'none' : '1px solid #e2e8f0',
                      borderRadius: '4px',
                      fontWeight: presetRange === option.value ? 600 : 500,
                      fontSize: '10px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (presetRange !== option.value) {
                        e.currentTarget.style.background = '#e2e8f0';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (presetRange !== option.value) {
                        e.currentTarget.style.background = '#f1f5f9';
                      }
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}

            {/* Custom Date Range */}
            {dateRangeType === 'custom' && (
              <div style={{
                display: 'flex',
                gap: '6px',
                alignItems: 'center'
              }}>
                <div style={{ minWidth: '120px' }}>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    max={customEndDate || new Date().toISOString().split('T')[0]}
                    placeholder="Start Date"
                    style={{
                      width: '100%',
                      padding: '4px 8px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '4px',
                      fontSize: '11px',
                      color: '#1e293b',
                      background: '#fff',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div style={{ minWidth: '120px' }}>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    min={customStartDate}
                    max={new Date().toISOString().split('T')[0]}
                    placeholder="End Date"
                    style={{
                      width: '100%',
                      padding: '4px 8px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '4px',
                      fontSize: '11px',
                      color: '#1e293b',
                      background: '#fff',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>
            )}

            {/* Apply Filters Button */}
            <button
              onClick={fetchGmailEmails}
              disabled={emailsLoading || !tallylocId || !coGuid}
              style={{
                padding: '4px 10px',
                background: (emailsLoading || !tallylocId || !coGuid)
                  ? '#94a3b8'
                  : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                fontWeight: 600,
                fontSize: '11px',
                cursor: (emailsLoading || !tallylocId || !coGuid) ? 'not-allowed' : 'pointer',
                boxShadow: (emailsLoading || !tallylocId || !coGuid)
                  ? 'none'
                  : '0 2px 8px rgba(59, 130, 246, 0.25)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'all 0.2s ease',
                marginLeft: 'auto'
              }}
              onMouseEnter={(e) => {
                if (!emailsLoading && tallylocId && coGuid) {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.35)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = (emailsLoading || !tallylocId || !coGuid)
                  ? 'none'
                  : '0 2px 8px rgba(59, 130, 246, 0.25)';
              }}
            >
              <span className="material-icons" style={{ fontSize: '14px' }}>
                {emailsLoading ? 'hourglass_empty' : 'search'}
              </span>
              {emailsLoading ? 'Loading...' : 'Apply Filters'}
            </button>
          </div>
        </div>

        {/* Emails Progress */}
        {emailsProgress && (
          <div style={{
            padding: '12px 16px',
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: '8px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px'
          }}>
            <span className="material-icons" style={{ fontSize: '18px', color: '#3b82f6', flexShrink: 0 }}>
              info
            </span>
            <p style={{
              margin: 0,
              fontSize: '13px',
              color: '#1e40af',
              fontWeight: 500
            }}>
              {emailsProgress}
            </p>
          </div>
        )}

        {/* Emails Error */}
        {emailsError && (
          <div style={{
            padding: '12px 16px',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px'
          }}>
            <span className="material-icons" style={{ fontSize: '18px', color: '#dc2626', flexShrink: 0 }}>
              error
            </span>
            <p style={{
              margin: 0,
              fontSize: '13px',
              color: '#991b1b',
              fontWeight: 500
            }}>
              {emailsError}
            </p>
          </div>
        )}

        {/* Emails Loading */}
        {emailsLoading && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px 20px',
            color: '#64748b'
          }}>
            <span className="material-icons" style={{
              fontSize: '40px',
              marginBottom: '12px',
              animation: 'spin 1s linear infinite'
            }}>
              hourglass_empty
            </span>
            <p style={{ margin: 0, fontSize: '14px', fontWeight: 500 }}>
              Loading emails...
            </p>
          </div>
        )}

        {/* Email Details - Replaces email list when selected */}
        {selectedEmail ? (
          <div style={{
            background: '#fff',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            padding: '20px',
            maxHeight: '400px',
            overflowY: 'auto'
          }}>
            {/* Email Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px',
              paddingBottom: '16px',
              borderBottom: '1px solid #e2e8f0'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                <button
                  onClick={closeEmailModal}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '8px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#64748b',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#f1f5f9';
                    e.currentTarget.style.color = '#1e293b';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = '#64748b';
                  }}
                  title="Back to emails"
                >
                  <span className="material-icons" style={{ fontSize: '20px' }}>
                    arrow_back
                  </span>
                </button>
                <h3 style={{
                  margin: 0,
                  fontSize: '18px',
                  fontWeight: 700,
                  color: '#1e293b',
                  flex: 1
                }}>
                  {selectedEmail.subject || 'No Subject'}
                </h3>
              </div>
            </div>

            {/* Email Content */}
            <div>
              {emailDetailsLoading && (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '40px 20px',
                  color: '#64748b'
                }}>
                  <span className="material-icons" style={{
                    fontSize: '40px',
                    marginBottom: '12px',
                    animation: 'spin 1s linear infinite'
                  }}>
                    hourglass_empty
                  </span>
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: 500 }}>
                    Loading email...
                  </p>
                </div>
              )}

              {emailDetailsError && (
                <div style={{
                  padding: '16px',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  marginBottom: '16px'
                }}>
                  <p style={{
                    margin: 0,
                    fontSize: '14px',
                    color: '#991b1b',
                    fontWeight: 500
                  }}>
                    {emailDetailsError}
                  </p>
                </div>
              )}

              {emailDetails && !emailDetailsLoading && (
                <>
                  {/* Email Headers */}
                  <div style={{
                    marginBottom: '24px',
                    padding: '16px',
                    background: '#f8fafc',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0'
                  }}>
                    <div style={{ marginBottom: '12px' }}>
                      <strong style={{ color: '#475569', fontSize: '13px' }}>From:</strong>
                      <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#1e293b' }}>
                        {emailDetails.headers.from || selectedEmail.from}
                      </p>
                    </div>
                    {emailDetails.headers.to && (
                      <div style={{ marginBottom: '12px' }}>
                        <strong style={{ color: '#475569', fontSize: '13px' }}>To:</strong>
                        <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#1e293b' }}>
                          {emailDetails.headers.to}
                        </p>
                      </div>
                    )}
                    {emailDetails.headers.date && (
                      <div style={{ marginBottom: '12px' }}>
                        <strong style={{ color: '#475569', fontSize: '13px' }}>Date:</strong>
                        <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#1e293b' }}>
                          {new Date(emailDetails.headers.date).toLocaleString()}
                        </p>
                      </div>
                    )}
                    {emailDetails.headers.cc && (
                      <div style={{ marginBottom: '12px' }}>
                        <strong style={{ color: '#475569', fontSize: '13px' }}>CC:</strong>
                        <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#1e293b' }}>
                          {emailDetails.headers.cc}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Attachments */}
                  {emailDetails.attachments && emailDetails.attachments.length > 0 && (
                    <div style={{
                      marginBottom: '24px',
                      padding: '16px',
                      background: '#fff7ed',
                      borderRadius: '8px',
                      border: '1px solid #fed7aa'
                    }}>
                      <strong style={{ color: '#9a3412', fontSize: '13px', display: 'block', marginBottom: '8px' }}>
                        Attachments ({emailDetails.attachments.length}):
                      </strong>
                      {emailDetails.attachments.map((att, idx) => (
                        <div key={idx} style={{
                          padding: '8px',
                          background: '#fff',
                          borderRadius: '6px',
                          marginBottom: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '13px',
                          color: '#1e293b'
                        }}>
                          <span className="material-icons" style={{ fontSize: '18px', color: '#f59e0b' }}>
                            attach_file
                          </span>
                          <span style={{ flex: 1 }}>{att.filename}</span>
                          {att.size && (
                            <span style={{ color: '#64748b', fontSize: '12px' }}>
                              {(att.size / 1024).toFixed(2)} KB
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Email Body */}
                  <div style={{
                    marginBottom: '24px'
                  }}>
                    {emailDetails.body ? (
                      <div
                        style={{
                          padding: '16px',
                          background: '#fff',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                          fontSize: '14px',
                          lineHeight: '1.6',
                          color: '#1e293b',
                          wordBreak: 'break-word',
                          maxHeight: '400px',
                          overflowY: 'auto'
                        }}
                        dangerouslySetInnerHTML={{ __html: emailDetails.body }}
                      />
                    ) : emailDetails.snippet ? (
                      <div style={{
                        padding: '16px',
                        background: '#fff',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                        fontSize: '14px',
                        lineHeight: '1.6',
                        color: '#1e293b',
                        wordBreak: 'break-word'
                      }}>
                        {emailDetails.snippet}
                      </div>
                    ) : (
                      <div style={{
                        padding: '16px',
                        background: '#f8fafc',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                        fontSize: '14px',
                        color: '#64748b',
                        textAlign: 'center',
                        fontStyle: 'italic'
                      }}>
                        No content available for this email
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Emails List */}
            {!emailsLoading && emails.length > 0 && (
              <div style={{
                maxHeight: '500px',
                overflowY: 'auto',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                background: '#fff'
              }}>
                {emails.map((email, index) => (
                  <div
                    key={email.id}
                    onClick={() => handleEmailClick(email)}
                    style={{
                      padding: '16px',
                      borderBottom: index < emails.length - 1 ? '1px solid #f1f5f9' : 'none',
                      cursor: 'pointer',
                      transition: 'background 0.2s ease',
                      background: '#fff'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#f0f9ff';
                      e.currentTarget.style.borderLeft = '3px solid #3b82f6';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#fff';
                      e.currentTarget.style.borderLeft = 'none';
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: '12px',
                      marginBottom: '8px'
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          marginBottom: '6px'
                        }}>
                          <p style={{
                            margin: 0,
                            fontSize: '15px',
                            fontWeight: 600,
                            color: '#1e293b',
                            wordBreak: 'break-word',
                            flex: 1
                          }}>
                            {email.subject}
                          </p>
                          <span className="material-icons" style={{
                            fontSize: '18px',
                            color: '#3b82f6',
                            flexShrink: 0,
                            opacity: 0.7
                          }}>
                            open_in_new
                          </span>
                        </div>
                        <p style={{
                          margin: 0,
                          fontSize: '13px',
                          color: '#64748b',
                          marginBottom: '4px',
                          wordBreak: 'break-word'
                        }}>
                          <span className="material-icons" style={{ fontSize: '14px', verticalAlign: 'middle', marginRight: '4px' }}>
                            person
                          </span>
                          {email.from}
                        </p>
                        {email.snippet && (
                          <p style={{
                            margin: '8px 0 0 0',
                            fontSize: '13px',
                            color: '#94a3b8',
                            lineHeight: '1.5',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical'
                          }}>
                            {email.snippet}
                          </p>
                        )}
                      </div>
                      <div style={{
                        fontSize: '12px',
                        color: '#94a3b8',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                        marginLeft: '12px'
                      }}>
                        {email.date ? new Date(email.date).toLocaleDateString() : 'No date'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty Emails State */}
            {!emailsLoading && !emailsError && emails.length === 0 && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '40px 20px',
                color: '#94a3b8',
                textAlign: 'center',
                background: '#fff',
                borderRadius: '8px',
                border: '1px solid #e2e8f0'
              }}>
                <span className="material-icons" style={{
                  fontSize: '48px',
                  marginBottom: '12px',
                  color: '#cbd5e1'
                }}>
                  mail_outline
                </span>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: '#64748b' }}>
                  No emails found
                </p>
                <p style={{ margin: '6px 0 0 0', fontSize: '12px', maxWidth: '300px' }}>
                  Click "Refresh Emails" to load emails from your Gmail inbox
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* CSS for spin animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default GmailJsonViewer;


