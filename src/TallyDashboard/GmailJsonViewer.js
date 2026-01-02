import React, { useState, useEffect } from 'react';
import { getValidGoogleTokenFromConfigs } from '../utils/googleDriveUtils';
import { fetchJsonFromGmail } from '../utils/gmailUtils';
import { getCompanyConfigValue } from '../utils/companyConfigUtils';

function GmailJsonViewer() {
  const [loading, setLoading] = useState(false);
  const [jsonData, setJsonData] = useState(null);
  const [error, setError] = useState(null);
  const [lastFetchTime, setLastFetchTime] = useState(null);
  const [subjectPattern, setSubjectPattern] = useState('Tally Export *');

  // Get company info from session storage
  const tallylocId = sessionStorage.getItem('tallyloc_id');
  const coGuid = sessionStorage.getItem('selectedCompanyGuid') || sessionStorage.getItem('guid');
  const userEmail = sessionStorage.getItem('email');

  // Fetch subject pattern from company configs on mount
  useEffect(() => {
    const loadSubjectPattern = async () => {
      if (tallylocId && coGuid) {
        try {
          const configuredPattern = await getCompanyConfigValue('gmail_json_subject_pattern', tallylocId, coGuid);
          if (configuredPattern) {
            setSubjectPattern(configuredPattern);
          }
        } catch (error) {
          console.log('No custom subject pattern configured, using default:', error);
        }
      }
    };
    loadSubjectPattern();
  }, [tallylocId, coGuid]);

  // Fetch JSON from Gmail
  const fetchJson = async () => {
    if (!tallylocId || !coGuid) {
      setError('Please select a company first.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get Gmail token from company configs
      const token = await getValidGoogleTokenFromConfigs(tallylocId, coGuid, userEmail);
      
      if (!token) {
        setError('Gmail is not configured for this company. Please configure your Google account in Tally Configurations.');
        setLoading(false);
        return;
      }

      // Fetch JSON from Gmail
      const result = await fetchJsonFromGmail(subjectPattern, tallylocId, coGuid, userEmail);
      
      if (result.success) {
        if (result.downloaded && result.data) {
          setJsonData(result.data);
          setLastFetchTime(new Date());
          setError(null);
        } else {
          setError(result.message || 'No new emails with JSON attachments found.');
          setJsonData(null);
        }
      } else {
        setError(result.error || 'Failed to fetch JSON from Gmail.');
        setJsonData(null);
      }
    } catch (err) {
      console.error('Error fetching JSON from Gmail:', err);
      setError(err.message || 'An unexpected error occurred while fetching JSON.');
      setJsonData(null);
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch on mount
  useEffect(() => {
    if (tallylocId && coGuid) {
      fetchJson();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tallylocId, coGuid]);

  return (
    <div style={{
      padding: '24px',
      maxWidth: '100%',
      minHeight: 'calc(100vh - 140px)',
      background: '#fff',
      borderRadius: '12px',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <h2 style={{
            margin: 0,
            fontSize: '24px',
            fontWeight: 700,
            color: '#1e293b',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <span className="material-icons" style={{ fontSize: '28px', color: '#3b82f6' }}>
              email
            </span>
            Gmail JSON Viewer
          </h2>
          <p style={{
            margin: '8px 0 0 0',
            fontSize: '14px',
            color: '#64748b'
          }}>
            Fetching emails matching: <strong>"{subjectPattern}"</strong>
          </p>
          {lastFetchTime && (
            <p style={{
              margin: '4px 0 0 0',
              fontSize: '12px',
              color: '#94a3b8'
            }}>
              Last fetched: {lastFetchTime.toLocaleString()}
            </p>
          )}
        </div>
        <button
          onClick={fetchJson}
          disabled={loading || !tallylocId || !coGuid}
          style={{
            padding: '10px 20px',
            background: loading ? '#94a3b8' : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            fontWeight: 600,
            fontSize: '14px',
            cursor: loading ? 'not-allowed' : 'pointer',
            boxShadow: '0 2px 8px rgba(59, 130, 246, 0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            if (!loading && tallylocId && coGuid) {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.35)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(59, 130, 246, 0.25)';
          }}
        >
          <span className="material-icons" style={{ fontSize: '18px' }}>
            {loading ? 'hourglass_empty' : 'refresh'}
          </span>
          {loading ? 'Fetching...' : 'Refresh'}
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div style={{
          padding: '16px 20px',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '8px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px'
        }}>
          <span className="material-icons" style={{ fontSize: '20px', color: '#dc2626', flexShrink: 0 }}>
            error
          </span>
          <div style={{ flex: 1 }}>
            <p style={{
              margin: 0,
              fontSize: '14px',
              color: '#991b1b',
              fontWeight: 500
            }}>
              {error}
            </p>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px 20px',
          color: '#64748b'
        }}>
          <span className="material-icons" style={{
            fontSize: '48px',
            marginBottom: '16px',
            animation: 'spin 1s linear infinite'
          }}>
            hourglass_empty
          </span>
          <p style={{ margin: 0, fontSize: '16px', fontWeight: 500 }}>
            Fetching JSON from Gmail...
          </p>
          <p style={{ margin: '8px 0 0 0', fontSize: '14px', color: '#94a3b8' }}>
            This may take a few moments
          </p>
        </div>
      )}

      {/* JSON Display */}
      {!loading && jsonData && (
        <div style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '20px',
          maxHeight: 'calc(100vh - 320px)',
          overflow: 'auto'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '12px'
          }}>
            <h3 style={{
              margin: 0,
              fontSize: '14px',
              fontWeight: 600,
              color: '#475569',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              JSON Content
            </h3>
            <button
              onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(jsonData, null, 2));
                alert('JSON copied to clipboard!');
              }}
              style={{
                padding: '6px 12px',
                background: '#fff',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 500,
                color: '#475569',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#f1f5f9';
                e.currentTarget.style.borderColor = '#94a3b8';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#fff';
                e.currentTarget.style.borderColor = '#cbd5e1';
              }}
            >
              <span className="material-icons" style={{ fontSize: '16px' }}>
                content_copy
              </span>
              Copy
            </button>
          </div>
          <pre style={{
            margin: 0,
            padding: '16px',
            background: '#1e293b',
            color: '#e2e8f0',
            borderRadius: '6px',
            fontSize: '13px',
            fontFamily: '"Fira Code", "Consolas", "Monaco", monospace',
            lineHeight: '1.6',
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all'
          }}>
            {JSON.stringify(jsonData, null, 2)}
          </pre>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && !jsonData && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px 20px',
          color: '#94a3b8',
          textAlign: 'center'
        }}>
          <span className="material-icons" style={{
            fontSize: '64px',
            marginBottom: '16px',
            color: '#cbd5e1'
          }}>
            inbox
          </span>
          <p style={{ margin: 0, fontSize: '16px', fontWeight: 500, color: '#64748b' }}>
            No JSON data available
          </p>
          <p style={{ margin: '8px 0 0 0', fontSize: '14px', maxWidth: '400px' }}>
            Click the Refresh button to fetch the latest JSON file from your Gmail inbox
          </p>
        </div>
      )}

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


