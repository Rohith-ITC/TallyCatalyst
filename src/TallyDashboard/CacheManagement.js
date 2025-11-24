import React, { useState, useEffect } from 'react';
import { hybridCache } from '../utils/hybridCache';

const CacheManagement = () => {
  const [cacheStats, setCacheStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [cacheEntries, setCacheEntries] = useState(null);
  const [showCacheViewer, setShowCacheViewer] = useState(false);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [cacheExpiryDays, setCacheExpiryDays] = useState(null);
  const [savingExpiry, setSavingExpiry] = useState(false);

  useEffect(() => {
    loadCacheStats();
    loadCurrentCompany();
    loadCacheExpiry();
  }, []);

  const loadCacheExpiry = () => {
    try {
      const stored = localStorage.getItem('cacheExpiryDays');
      if (stored === null || stored === 'null' || stored === 'never') {
        setCacheExpiryDays('never');
      } else {
        const days = parseInt(stored, 10);
        setCacheExpiryDays(isNaN(days) || days < 0 ? 'never' : days.toString());
      }
    } catch (error) {
      setCacheExpiryDays('never');
    }
  };

  const saveCacheExpiry = async (days) => {
    setSavingExpiry(true);
    try {
      hybridCache.setCacheExpiryDays(days);
      setCacheExpiryDays(days === null || days === 'never' || days === '' ? 'never' : days.toString());
      setMessage({ type: 'success', text: 'Cache expiry period updated successfully!' });
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      console.error('Error saving cache expiry:', error);
      setMessage({ type: 'error', text: 'Failed to save cache expiry period' });
    } finally {
      setSavingExpiry(false);
    }
  };

  const loadCurrentCompany = () => {
    try {
      const connections = JSON.parse(sessionStorage.getItem('allConnections') || '[]');
      const selectedGuid = sessionStorage.getItem('selectedCompanyGuid');
      if (selectedGuid && Array.isArray(connections)) {
        const company = connections.find(c => c.guid === selectedGuid);
        if (company) {
          setSelectedCompany({
            tallyloc_id: company.tallyloc_id,
            guid: company.guid,
            company: company.company
          });
        }
      }
    } catch (error) {
      console.error('Error loading current company:', error);
    }
  };

  const loadCacheStats = async () => {
    try {
      const stats = await hybridCache.getCacheStats();
      setCacheStats(stats);
    } catch (error) {
      console.error('Error loading cache stats:', error);
      setMessage({ type: 'error', text: 'Failed to load cache statistics' });
    }
  };

  const loadCacheEntries = async () => {
    setLoadingEntries(true);
    try {
      const entries = await hybridCache.listAllCacheEntries();
      setCacheEntries(entries);
      setShowCacheViewer(true);
    } catch (error) {
      console.error('Error loading cache entries:', error);
      setMessage({ type: 'error', text: 'Failed to load cache entries: ' + error.message });
    } finally {
      setLoadingEntries(false);
    }
  };

  const clearAllCache = async () => {
    if (!window.confirm('Are you sure you want to clear ALL cache? This will remove all cached sales data and dashboard states for all companies.')) {
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      // Clear all cache by clearing OPFS directories
      const opfsRoot = await navigator.storage.getDirectory();
      
      // Clear sales directory
      try {
        await opfsRoot.removeEntry('sales', { recursive: true });
        await opfsRoot.getDirectoryHandle('sales', { create: true });
      } catch (err) {
        // Directory might not exist
      }

      // Clear dashboard directory
      try {
        await opfsRoot.removeEntry('dashboard', { recursive: true });
        await opfsRoot.getDirectoryHandle('dashboard', { create: true });
      } catch (err) {
        // Directory might not exist
      }

      // Clear metadata
      try {
        const metadataDir = await opfsRoot.getDirectoryHandle('metadata', { create: true });
        const salesFile = await metadataDir.getFileHandle('sales.json', { create: true });
        const dashboardFile = await metadataDir.getFileHandle('dashboard.json', { create: true });
        const salesWritable = await salesFile.createWritable();
        const dashboardWritable = await dashboardFile.createWritable();
        await salesWritable.write(JSON.stringify([]));
        await dashboardWritable.write(JSON.stringify([]));
        await salesWritable.close();
        await dashboardWritable.close();
      } catch (err) {
        console.warn('Failed to clear metadata:', err);
      }

      // Note: We keep the keys directory as it contains user encryption keys
      // Clearing it would prevent decryption of any remaining cached data

      setMessage({ type: 'success', text: 'All cache cleared successfully!' });
      await loadCacheStats();
    } catch (error) {
      console.error('Error clearing all cache:', error);
      setMessage({ type: 'error', text: 'Failed to clear cache: ' + error.message });
    } finally {
      setLoading(false);
    }
  };

  const clearCompanyCache = async () => {
    if (!selectedCompany) {
      setMessage({ type: 'error', text: 'No company selected' });
      return;
    }

    if (!window.confirm(`Are you sure you want to clear cache for "${selectedCompany.company}"? This will remove all cached sales data and dashboard states for this company.`)) {
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      await hybridCache.clearCompanyCache(selectedCompany);
      setMessage({ type: 'success', text: `Cache cleared successfully for ${selectedCompany.company}!` });
      await loadCacheStats();
    } catch (error) {
      console.error('Error clearing company cache:', error);
      setMessage({ type: 'error', text: 'Failed to clear company cache: ' + error.message });
    } finally {
      setLoading(false);
    }
  };

  const clearSalesCache = async () => {
    if (!selectedCompany) {
      setMessage({ type: 'error', text: 'No company selected' });
      return;
    }

    if (!window.confirm(`Are you sure you want to clear sales cache for "${selectedCompany.company}"? This will remove all cached sales data for this company.`)) {
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      // Clear sales cache by deleting sales directory
      const opfsRoot = await navigator.storage.getDirectory();
      try {
        await opfsRoot.removeEntry('sales', { recursive: true });
        // Recreate empty directory
        await opfsRoot.getDirectoryHandle('sales', { create: true });
      } catch (err) {
        // Directory might not exist
      }

      // Also clear sales metadata
      try {
        const metadataDir = await opfsRoot.getDirectoryHandle('metadata', { create: true });
        const salesFile = await metadataDir.getFileHandle('sales.json', { create: true });
        const writable = await salesFile.createWritable();
        await writable.write(JSON.stringify([]));
        await writable.close();
      } catch (err) {
        console.warn('Failed to clear sales metadata:', err);
      }

      setMessage({ type: 'success', text: `Sales cache cleared successfully for ${selectedCompany.company}!` });
      await loadCacheStats();
    } catch (error) {
      console.error('Error clearing sales cache:', error);
      setMessage({ type: 'error', text: 'Failed to clear sales cache: ' + error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      padding: '24px',
      maxWidth: '1200px',
      margin: '0 auto',
      fontFamily: 'Segoe UI, Roboto, Arial, sans-serif'
    }}>
      <div style={{
        marginBottom: '32px',
        borderBottom: '2px solid #e5e7eb',
        paddingBottom: '24px'
      }}>
        <h1 style={{
          fontSize: '28px',
          fontWeight: 700,
          color: '#1e293b',
          margin: 0,
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <span className="material-icons" style={{ fontSize: '32px', color: '#3b82f6' }}>
            storage
          </span>
          Cache Management
        </h1>
        <p style={{
          fontSize: '16px',
          color: '#64748b',
          marginTop: '8px',
          marginLeft: '44px'
        }}>
          Manage and clear cached data stored in OPFS (Origin Private File System)
        </p>
      </div>

      {/* View Cache Section */}
      <div style={{
        marginTop: '0',
        marginBottom: '32px',
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '24px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px'
        }}>
          <h3 style={{
            fontSize: '18px',
            fontWeight: 600,
            color: '#1e293b',
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <span className="material-icons" style={{ fontSize: '24px', color: '#3b82f6' }}>
              folder_open
            </span>
            View Cache Contents
          </h3>
          <button
            onClick={loadCacheEntries}
            disabled={loadingEntries}
            style={{
              padding: '10px 20px',
              background: loadingEntries ? '#94a3b8' : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '14px',
              cursor: loadingEntries ? 'not-allowed' : 'pointer',
              boxShadow: loadingEntries ? 'none' : '0 2px 8px rgba(59, 130, 246, 0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              if (!loadingEntries) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.35)';
              }
            }}
            onMouseLeave={(e) => {
              if (!loadingEntries) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(59, 130, 246, 0.25)';
              }
            }}
          >
            {loadingEntries ? (
              <>
                <span className="material-icons" style={{ fontSize: '18px', animation: 'spin 1s linear infinite' }}>
                  refresh
                </span>
                Loading...
              </>
            ) : (
              <>
                <span className="material-icons" style={{ fontSize: '18px' }}>
                  refresh
                </span>
                {showCacheViewer ? 'Refresh' : 'View Cache'}
              </>
            )}
          </button>
        </div>

        {cacheEntries && showCacheViewer && (
          <div>
            {/* Summary */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '12px',
              marginBottom: '20px'
            }}>
              <div style={{
                background: '#f8fafc',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0'
              }}>
                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Total Entries</div>
                <div style={{ fontSize: '20px', fontWeight: 600, color: '#1e293b' }}>
                  {cacheEntries.totalEntries}
                </div>
              </div>
              <div style={{
                background: '#f8fafc',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0'
              }}>
                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Total Size</div>
                <div style={{ fontSize: '20px', fontWeight: 600, color: '#1e293b' }}>
                  {cacheEntries.totalSizeMB} MB
                </div>
              </div>
              <div style={{
                background: '#f8fafc',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0'
              }}>
                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Sales Entries</div>
                <div style={{ fontSize: '20px', fontWeight: 600, color: '#3b82f6' }}>
                  {cacheEntries.salesCount}
                </div>
              </div>
              <div style={{
                background: '#f8fafc',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0'
              }}>
                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Dashboard Entries</div>
                <div style={{ fontSize: '20px', fontWeight: 600, color: '#10b981' }}>
                  {cacheEntries.dashboardCount}
                </div>
              </div>
            </div>

            {/* Cache Entries Table */}
            {cacheEntries.entries.length > 0 ? (
              <div style={{
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                overflow: 'hidden',
                maxHeight: '600px',
                overflowY: 'auto'
              }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '14px'
                }}>
                  <thead style={{
                    background: '#f8fafc',
                    position: 'sticky',
                    top: 0,
                    zIndex: 10
                  }}>
                    <tr>
                      <th style={{
                        padding: '12px',
                        textAlign: 'left',
                        fontWeight: 600,
                        color: '#1e293b',
                        borderBottom: '2px solid #e2e8f0'
                      }}>Type</th>
                      <th style={{
                        padding: '12px',
                        textAlign: 'left',
                        fontWeight: 600,
                        color: '#1e293b',
                        borderBottom: '2px solid #e2e8f0'
                      }}>Cache Key</th>
                      <th style={{
                        padding: '12px',
                        textAlign: 'left',
                        fontWeight: 600,
                        color: '#1e293b',
                        borderBottom: '2px solid #e2e8f0'
                      }}>Date Range</th>
                      <th style={{
                        padding: '12px',
                        textAlign: 'left',
                        fontWeight: 600,
                        color: '#1e293b',
                        borderBottom: '2px solid #e2e8f0'
                      }}>Size</th>
                      <th style={{
                        padding: '12px',
                        textAlign: 'left',
                        fontWeight: 600,
                        color: '#1e293b',
                        borderBottom: '2px solid #e2e8f0'
                      }}>Age</th>
                      <th style={{
                        padding: '12px',
                        textAlign: 'left',
                        fontWeight: 600,
                        color: '#1e293b',
                        borderBottom: '2px solid #e2e8f0'
                      }}>Cached Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cacheEntries.entries.map((entry, index) => (
                      <tr
                        key={index}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          background: index % 2 === 0 ? '#fff' : '#f8fafc'
                        }}
                      >
                        <td style={{ padding: '12px' }}>
                          <span style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: 600,
                            background: entry.type === 'sales' ? '#dbeafe' : '#dcfce7',
                            color: entry.type === 'sales' ? '#1e40af' : '#166534'
                          }}>
                            {entry.type === 'sales' ? 'Sales' : 'Dashboard'}
                          </span>
                        </td>
                        <td style={{
                          padding: '12px',
                          fontFamily: 'monospace',
                          fontSize: '12px',
                          color: '#475569',
                          wordBreak: 'break-all',
                          maxWidth: '400px'
                        }}>
                          {entry.cacheKey}
                        </td>
                        <td style={{ padding: '12px', color: '#64748b', fontSize: '13px' }}>
                          {entry.startDate && entry.endDate ? (
                            <div>
                              <div>{entry.startDate}</div>
                              <div style={{ color: '#94a3b8' }}>to</div>
                              <div>{entry.endDate}</div>
                            </div>
                          ) : (
                            <span style={{ color: '#cbd5e1' }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: '12px', color: '#1e293b', fontWeight: 500 }}>
                          {entry.sizeMB} MB
                          <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                            ({entry.sizeKB} KB)
                          </div>
                        </td>
                        <td style={{ padding: '12px', color: '#64748b' }}>
                          {entry.ageDays === 0 ? (
                            <span style={{ color: '#10b981', fontWeight: 600 }}>Today</span>
                          ) : entry.ageDays === 1 ? (
                            <span style={{ color: '#3b82f6' }}>1 day ago</span>
                          ) : (
                            <span>{entry.ageDays} days ago</span>
                          )}
                        </td>
                        <td style={{ padding: '12px', color: '#64748b', fontSize: '13px' }}>
                          {entry.date}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{
                padding: '40px',
                textAlign: 'center',
                color: '#94a3b8',
                fontSize: '14px'
              }}>
                <span className="material-icons" style={{ fontSize: '48px', marginBottom: '12px', display: 'block' }}>
                  folder_off
                </span>
                No cache entries found
              </div>
            )}
          </div>
        )}

        {!showCacheViewer && (
          <p style={{
            fontSize: '14px',
            color: '#64748b',
            textAlign: 'center',
            padding: '20px',
            fontStyle: 'italic'
          }}>
            Click "View Cache" to see all cached entries
          </p>
        )}
      </div>

      {/* Cache Expiry Settings */}
      <div style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '24px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}>
        <h2 style={{
          fontSize: '18px',
          fontWeight: 600,
          color: '#1e293b',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span className="material-icons" style={{ fontSize: '20px', color: '#3b82f6' }}>
            schedule
          </span>
          Cache Expiry Period
        </h2>
        <p style={{
          fontSize: '14px',
          color: '#64748b',
          marginBottom: '16px',
          lineHeight: '1.6'
        }}>
          Set how long cached data should be kept before automatically expiring. Set to "Never" to keep cache indefinitely.
        </p>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          flexWrap: 'wrap'
        }}>
          <select
            value={cacheExpiryDays || 'never'}
            onChange={(e) => {
              const value = e.target.value;
              if (value === 'custom') {
                const customDays = prompt('Enter number of days (0 for never):', '');
                if (customDays !== null) {
                  const days = parseInt(customDays, 10);
                  if (!isNaN(days) && days >= 0) {
                    saveCacheExpiry(days === 0 ? 'never' : days);
                  } else if (customDays === '' || customDays.toLowerCase() === 'never') {
                    saveCacheExpiry('never');
                  }
                }
              } else {
                saveCacheExpiry(value);
              }
            }}
            disabled={savingExpiry}
            style={{
              padding: '10px 16px',
              fontSize: '15px',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              background: '#fff',
              color: '#1e293b',
              cursor: savingExpiry ? 'not-allowed' : 'pointer',
              minWidth: '200px',
              fontWeight: 500
            }}
          >
            <option value="never">Never (Keep Forever)</option>
            <option value="1">1 Day</option>
            <option value="3">3 Days</option>
            <option value="7">7 Days</option>
            <option value="14">14 Days</option>
            <option value="30">30 Days</option>
            <option value="60">60 Days</option>
            <option value="90">90 Days</option>
            <option value="custom">Custom...</option>
          </select>
          {savingExpiry && (
            <span className="material-icons" style={{ 
              fontSize: '20px', 
              color: '#3b82f6',
              animation: 'spin 1s linear infinite'
            }}>
              refresh
            </span>
          )}
          <div style={{
            fontSize: '14px',
            color: '#64748b',
            fontStyle: 'italic'
          }}>
            {cacheExpiryDays === 'never' 
              ? 'Cache will never expire automatically' 
              : `Cache will expire after ${cacheExpiryDays} day${parseInt(cacheExpiryDays) !== 1 ? 's' : ''}`}
          </div>
        </div>
      </div>

      {/* Current Company Info */}
      {selectedCompany && (
        <div style={{
          background: '#f0f9ff',
          border: '1px solid #bae6fd',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '24px'
        }}>
          <h3 style={{
            fontSize: '16px',
            fontWeight: 600,
            color: '#0369a1',
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span className="material-icons" style={{ fontSize: '20px' }}>business</span>
            Current Company
          </h3>
          <div style={{ fontSize: '15px', color: '#0c4a6e' }}>
            <strong>{selectedCompany.company}</strong>
            <div style={{ fontSize: '13px', color: '#075985', marginTop: '4px' }}>
              ID: {selectedCompany.tallyloc_id} | GUID: {selectedCompany.guid.substring(0, 8)}...
            </div>
          </div>
        </div>
      )}

      {/* Message Display */}
      {message.text && (
        <div style={{
          padding: '16px',
          borderRadius: '8px',
          marginBottom: '24px',
          background: message.type === 'success' ? '#f0fdf4' : '#fef2f2',
          border: `1px solid ${message.type === 'success' ? '#86efac' : '#fecaca'}`,
          color: message.type === 'success' ? '#16a34a' : '#dc2626',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <span className="material-icons">
            {message.type === 'success' ? 'check_circle' : 'error'}
          </span>
          <span>{message.text}</span>
          <button
            onClick={() => setMessage({ type: '', text: '' })}
            style={{
              marginLeft: 'auto',
              background: 'transparent',
              border: 'none',
              color: 'inherit',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <span className="material-icons" style={{ fontSize: '20px' }}>close</span>
          </button>
        </div>
      )}

      {/* Cache Actions */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '20px'
      }}>
        {/* Clear All Cache */}
        <div style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '16px'
          }}>
            <span className="material-icons" style={{ fontSize: '28px', color: '#dc2626' }}>
              delete_sweep
            </span>
            <h3 style={{
              fontSize: '18px',
              fontWeight: 600,
              color: '#1e293b',
              margin: 0
            }}>
              Clear All Cache
            </h3>
          </div>
          <p style={{
            fontSize: '14px',
            color: '#64748b',
            marginBottom: '20px',
            lineHeight: '1.6'
          }}>
            Remove all cached data for all companies. This includes sales data, dashboard states, and metadata.
          </p>
          <button
            onClick={clearAllCache}
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px 20px',
              background: loading ? '#94a3b8' : 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '15px',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: loading ? 'none' : '0 2px 8px rgba(220, 38, 38, 0.25)',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(220, 38, 38, 0.35)';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(220, 38, 38, 0.25)';
              }
            }}
          >
            {loading ? (
              <>
                <span className="material-icons" style={{ fontSize: '18px', animation: 'spin 1s linear infinite' }}>
                  refresh
                </span>
                Clearing...
              </>
            ) : (
              <>
                <span className="material-icons" style={{ fontSize: '18px' }}>
                  delete_sweep
                </span>
                Clear All Cache
              </>
            )}
          </button>
        </div>

        {/* Clear Company Cache */}
        <div style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '16px'
          }}>
            <span className="material-icons" style={{ fontSize: '28px', color: '#f59e0b' }}>
              business_center
            </span>
            <h3 style={{
              fontSize: '18px',
              fontWeight: 600,
              color: '#1e293b',
              margin: 0
            }}>
              Clear Company Cache
            </h3>
          </div>
          <p style={{
            fontSize: '14px',
            color: '#64748b',
            marginBottom: '20px',
            lineHeight: '1.6'
          }}>
            Remove all cached data for the currently selected company. This includes sales data and dashboard states.
          </p>
          <button
            onClick={clearCompanyCache}
            disabled={loading || !selectedCompany}
            style={{
              width: '100%',
              padding: '12px 20px',
              background: (loading || !selectedCompany) ? '#94a3b8' : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '15px',
              cursor: (loading || !selectedCompany) ? 'not-allowed' : 'pointer',
              boxShadow: (loading || !selectedCompany) ? 'none' : '0 2px 8px rgba(245, 158, 11, 0.25)',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
            onMouseEnter={(e) => {
              if (!loading && selectedCompany) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(245, 158, 11, 0.35)';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading && selectedCompany) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(245, 158, 11, 0.25)';
              }
            }}
          >
            {loading ? (
              <>
                <span className="material-icons" style={{ fontSize: '18px', animation: 'spin 1s linear infinite' }}>
                  refresh
                </span>
                Clearing...
              </>
            ) : (
              <>
                <span className="material-icons" style={{ fontSize: '18px' }}>
                  business_center
                </span>
                Clear Company Cache
              </>
            )}
          </button>
        </div>

        {/* Clear Sales Cache */}
        <div style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '16px'
          }}>
            <span className="material-icons" style={{ fontSize: '28px', color: '#3b82f6' }}>
              analytics
            </span>
            <h3 style={{
              fontSize: '18px',
              fontWeight: 600,
              color: '#1e293b',
              margin: 0
            }}>
              Clear Sales Cache
            </h3>
          </div>
          <p style={{
            fontSize: '14px',
            color: '#64748b',
            marginBottom: '20px',
            lineHeight: '1.6'
          }}>
            Remove only sales data cache for the currently selected company. Dashboard states will be preserved.
          </p>
          <button
            onClick={clearSalesCache}
            disabled={loading || !selectedCompany}
            style={{
              width: '100%',
              padding: '12px 20px',
              background: (loading || !selectedCompany) ? '#94a3b8' : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '15px',
              cursor: (loading || !selectedCompany) ? 'not-allowed' : 'pointer',
              boxShadow: (loading || !selectedCompany) ? 'none' : '0 2px 8px rgba(59, 130, 246, 0.25)',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
            onMouseEnter={(e) => {
              if (!loading && selectedCompany) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.35)';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading && selectedCompany) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(59, 130, 246, 0.25)';
              }
            }}
          >
            {loading ? (
              <>
                <span className="material-icons" style={{ fontSize: '18px', animation: 'spin 1s linear infinite' }}>
                  refresh
                </span>
                Clearing...
              </>
            ) : (
              <>
                <span className="material-icons" style={{ fontSize: '18px' }}>
                  analytics
                </span>
                Clear Sales Cache
              </>
            )}
          </button>
        </div>
      </div>

      {/* Cache Statistics */}
      {cacheStats && (
        <div style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '20px',
          marginTop: '32px',
          marginBottom: '24px'
        }}>
          <h2 style={{
            fontSize: '18px',
            fontWeight: 600,
            color: '#1e293b',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span className="material-icons" style={{ fontSize: '20px', color: '#3b82f6' }}>
              info
            </span>
            Cache Information
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px'
          }}>
            <div style={{
              background: cacheStats.isUsingOPFS ? 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)' : 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
              padding: '16px',
              borderRadius: '8px',
              border: `2px solid ${cacheStats.isUsingOPFS ? '#3b82f6' : '#f59e0b'}`,
              boxShadow: `0 2px 8px ${cacheStats.isUsingOPFS ? 'rgba(59, 130, 246, 0.2)' : 'rgba(245, 158, 11, 0.2)'}`
            }}>
              <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '8px', fontWeight: 500 }}>
                Active Storage Backend
              </div>
              <div style={{
                fontSize: '24px',
                fontWeight: 700,
                color: cacheStats.isUsingOPFS ? '#1e40af' : '#92400e',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '4px'
              }}>
                {cacheStats.isUsingOPFS ? (
                  <>
                    <span className="material-icons" style={{ fontSize: '28px' }}>storage</span>
                    OPFS
                  </>
                ) : (
                  <>
                    <span className="material-icons" style={{ fontSize: '28px' }}>database</span>
                    IndexedDB
                  </>
                )}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic' }}>
                {cacheStats.isUsingOPFS 
                  ? 'Using Origin Private File System' 
                  : 'Using IndexedDB (OPFS not available)'}
              </div>
            </div>
            <div style={{
              background: '#fff',
              padding: '16px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0'
            }}>
              <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '4px' }}>
                OPFS Support
              </div>
              <div style={{
                fontSize: '18px',
                fontWeight: 600,
                color: cacheStats.supportsOPFS ? '#16a34a' : '#dc2626',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                {cacheStats.supportsOPFS ? (
                  <>
                    <span className="material-icons" style={{ fontSize: '20px' }}>check_circle</span>
                    Supported
                  </>
                ) : (
                  <>
                    <span className="material-icons" style={{ fontSize: '20px' }}>error</span>
                    Not Supported
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default CacheManagement;

