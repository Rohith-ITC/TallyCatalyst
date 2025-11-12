import React, { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPut } from '../utils/apiUtils';

function TallyConfig() {
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ 
    ip: '', 
    port: '', 
    connectionName: '', 
    accessType: 'Tally' // Default to Tally
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [tableError, setTableError] = useState('');
  const token = sessionStorage.getItem('token');
  const [connectionCompanies, setConnectionCompanies] = useState({});
  const [companiesLoading, setCompaniesLoading] = useState(false);

  // Fetch all connections
  const fetchConnections = async () => {
    setLoading(true);
    setTableError('');
    try {
      const cacheBuster = Date.now();
      const data = await apiGet(`/api/tally/connections/all?ts=${cacheBuster}`);
      if (data && data.success) {
      setConnections(data.data.connections || []);
      } else if (data) {
        throw new Error(data.message || 'Failed to fetch connections');
      }
    } catch (err) {
      setTableError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConnections();
    fetchConnectionCompanies();
    // eslint-disable-next-line
  }, []);

  const fetchConnectionCompanies = useCallback(async () => {
    setCompaniesLoading(true);
    try {
      const cacheBuster = Date.now();
      const data = await apiGet(`/api/tally/user-connections?ts=${cacheBuster}`);
      let companyList = [];

      if (Array.isArray(data)) {
        companyList = data;
      } else if (data) {
        const created = Array.isArray(data.createdByMe) ? data.createdByMe : [];
        const shared = Array.isArray(data.sharedWithMe) ? data.sharedWithMe : [];
        companyList = [...created, ...shared];
      }

      const grouped = {};
      companyList
        .filter(item => (item?.status || '').toLowerCase() === 'connected')
        .forEach(item => {
          const key = item.conn_name || item.connectionName || item.connection_name || item.name || '';
          if (!key) return;
          if (!grouped[key]) {
            grouped[key] = [];
          }
          grouped[key].push({
            guid: item.guid || `${key}-${item.company}`,
            company: item.company,
            accessType: item.access_type || item.accessType || 'Unknown',
            status: item.status
          });
        });

      setConnectionCompanies(grouped);
    } catch (error) {
      console.error('Failed to fetch connection companies:', error);
      setConnectionCompanies({});
    } finally {
      setCompaniesLoading(false);
    }
  }, []);

  // Handle form input
  const handleInput = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setFormError('');
    setFormSuccess('');
  };

  // Create new connection
  const handleCreate = async e => {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');
    setFormSuccess('');
    try {
      const cacheBuster = Date.now();
      const data = await apiPost(`/api/tally/check-connection?ts=${cacheBuster}`, {
          ip: form.ip,
          port: form.port,
          connectionName: form.connectionName,
          accessType: form.accessType,
      });
      if (data && data.success) {
      setFormSuccess(data.message || 'Tally connection successful and saved');
      setForm({ ip: '', port: '', connectionName: '', accessType: 'Tally' });
      await fetchConnections();
      await fetchConnectionCompanies();
      } else if (data) {
        throw new Error(data.message || 'Tally connection failed');
      }
    } catch (err) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  // Toggle connection status
  const handleToggle = async (id, isActive) => {
    try {
      const cacheBuster = Date.now();
      await apiPut(`/api/tally/connections/${id}?ts=${cacheBuster}`, {
        isActive: isActive
      });
      await fetchConnections();
      await fetchConnectionCompanies();
    } catch (err) {
      setTableError('Failed to update connection status');
    }
  };

  return (
    <>
      <style>{`
        @media (max-width: 700px) {
          body, html, #root, .adminhome-container {
            max-width: 100vw !important;
            overflow-x: hidden !important;
          }
          .tallyconfig-mobile-form {
            flex-direction: column !important;
            gap: 0 !important;
            align-items: stretch !important;
            max-width: 100vw !important;
            box-sizing: border-box !important;
            margin-top: 80px !important;
          }
          .tallyconfig-mobile-form > div,
          .tallyconfig-mobile-form button {
            min-width: 0 !important;
            width: 92vw !important;
            max-width: 92vw !important;
            margin-right: 0 !important;
            margin-bottom: 10px !important;
            box-sizing: border-box !important;
            display: block !important;
            padding-left: 0 !important;
            padding-right: 0 !important;
          }
          .tallyconfig-mobile-form button {
            width: 90vw !important;
            max-width: 90vw !important;
          }
          .tallyconfig-mobile-form input {
            width: 100% !important;
            min-width: 0 !important;
            font-size: 15px !important;
            padding: 8px 8px !important;
            box-sizing: border-box !important;
          }
          .tallyconfig-mobile-form label {
            margin-bottom: 2px !important;
            font-size: 13px !important;
          }
          .tallyconfig-mobile-form button {
            width: 100% !important;
            min-width: 0 !important;
            font-size: 15px !important;
            padding: 10px 0 !important;
            margin-bottom: 0 !important;
          }
          .tallyconfig-mobile-table, .tallyconfig-mobile-stacked-table {
            padding: 2px !important;
            min-width: 0 !important;
            width: 100vw !important;
            max-width: 100vw !important;
            box-sizing: border-box !important;
            overflow-x: hidden !important;
          }
          .tallyconfig-mobile-table table, .tallyconfig-mobile-stacked-table table {
            width: 100% !important;
            min-width: 0 !important;
            font-size: 13px !important;
            table-layout: fixed !important;
          }
          .tallyconfig-mobile-table th, .tallyconfig-mobile-table td,
          .tallyconfig-mobile-stacked-table th, .tallyconfig-mobile-stacked-table td {
            padding: 6px 2px !important;
            font-size: 13px !important;
            word-break: break-word !important;
            max-width: 80px !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
          }
          .tallyconfig-mobile-stacked-table th {
            white-space: normal !important;
            word-break: break-word !important;
            line-height: 1.2 !important;
          }
          .tallyconfig-mobile-stacked-table td {
            max-width: 90px !important;
          }
          .tallyconfig-mobile-form > div,
          .tallyconfig-mobile-form input {
            min-width: 0 !important;
            width: 100% !important;
            box-sizing: border-box !important;
          }
          .tallyconfig-mobile-form {
            margin-bottom: 0 !important;
          }
          .tallyconfig-mobile-table, .tallyconfig-mobile-stacked-table {
            margin-bottom: 0 !important;
          }
          .tallyconfig-mobile-table th:nth-child(1), .tallyconfig-mobile-table td:nth-child(1),
          .tallyconfig-mobile-stacked-table th:nth-child(1), .tallyconfig-mobile-stacked-table td:nth-child(1) {
            max-width: 70px !important;
          }
          .tallyconfig-mobile-table th:nth-child(2), .tallyconfig-mobile-table td:nth-child(2),
          .tallyconfig-mobile-stacked-table th:nth-child(2), .tallyconfig-mobile-stacked-table td:nth-child(2) {
            max-width: 60px !important;
          }
        }
      `}</style>
      <div style={{ margin: '0 auto', padding: 0, width: window.innerWidth <= 700 ? '76vw' : '90vw', maxWidth: 1200, boxSizing: 'border-box' }}>
        {/* Header Section */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32, marginTop: 50 }}>
          <div>
            <h2 style={{ color: '#1e40af', fontWeight: 700, fontSize: 28, margin: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="material-icons" style={{ fontSize: 32, color: '#1e40af' }}>settings</span>
              Tally Access Settings
            </h2>
            <div style={{ color: '#64748b', fontSize: 16, marginTop: 4 }}>Manage Tally Server Connection</div>
          </div>
          <div style={{ 
            background: '#f0f9ff', 
            color: '#0369a1', 
            padding: '8px 16px', 
            borderRadius: 20, 
            fontSize: 14, 
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}>
            <span className="material-icons" style={{ fontSize: 18 }}>account_tree</span>
            {connections.length} connections configured
          </div>
        </div>
        {/* Create Connection Form */}
        <div style={{ 
          background: '#fff', 
          borderRadius: 16, 
          boxShadow: '0 4px 24px 0 rgba(31,38,135,0.08)', 
          padding: window.innerWidth <= 700 ? 16 : 32, 
          marginBottom: 24, 
          width: '100%', 
          margin: '0 auto', 
          boxSizing: 'border-box' 
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 12, 
            marginBottom: 24,
            paddingBottom: 16,
            borderBottom: '1px solid #f1f5f9'
          }}>
            <span className="material-icons" style={{ fontSize: 24, color: '#3b82f6' }}>add_circle</span>
            <h3 style={{ color: '#1e293b', fontWeight: 700, margin: 0, fontSize: 20 }}>Create New Connection</h3>
        </div>
          <form onSubmit={handleCreate} className="tallyconfig-mobile-form" style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end', width: '100%' }}>
            <div style={{ flex: 0.6, minWidth: 200, marginRight: 2 }}>
              <label style={{ fontWeight: 600, color: '#1e293b', marginBottom: 6, display: 'block' }}>Tally Access Type</label>
              <select 
                name="accessType" 
                value={form.accessType} 
                onChange={() => {}}
                disabled
                style={{ 
                  padding: '12px 14px', 
                  borderRadius: 8, 
                  border: '1.5px solid #cbd5e1', 
                  width: '95%', 
                  fontSize: 16, 
                  background: '#f1f5f9', 
                  marginBottom: 0,
                  cursor: 'not-allowed',
                  opacity: 0.8
                }}
              >
                <option value="Tally">Tally</option>
              </select>
            </div>
            <div style={{ flex: 0.6, minWidth: 180, marginRight: 12 }}>
              <label style={{ fontWeight: 600, color: '#1e293b', marginBottom: 6, display: 'block' }}>Site ID</label>
              <input name="connectionName" value={form.connectionName} onChange={handleInput} required style={{ padding: '12px 14px', borderRadius: 8, border: '1.5px solid #cbd5e1', width: '95%', fontSize: 16, background: '#f8fafc', marginBottom: 0 }} placeholder="Myoffice" />
            </div>
            <div style={{ flex: 0.8, minWidth: 300, marginRight: 12 }}>
              <label style={{ fontWeight: 600, color: form.accessType === 'TallyDex' ? '#94a3b8' : '#1e293b', marginBottom: 6, display: 'block' }}>IP Address or Hostname</label>
              <input 
                name="ip" 
                value={form.ip} 
                onChange={handleInput} 
                required={form.accessType !== 'TallyDex'}
                disabled={form.accessType === 'TallyDex'}
                style={{ 
                  padding: '12px 14px', 
                  borderRadius: 8, 
                  border: '1.5px solid #cbd5e1', 
                  width: '95%', 
                  fontSize: 16, 
                  background: form.accessType === 'TallyDex' ? '#f1f5f9' : '#f8fafc', 
                  marginBottom: 0,
                  opacity: form.accessType === 'TallyDex' ? 0.6 : 1,
                  cursor: form.accessType === 'TallyDex' ? 'not-allowed' : 'text'
                }} 
                placeholder={form.accessType === 'TallyDex' ? 'Not required for TallyDex' : '192.168.1.100 or example.com'} 
              />
            </div>
            <div style={{ flex: 0.4, minWidth: 90, marginRight: 12 }}>
              <label style={{ fontWeight: 600, color: form.accessType === 'TallyDex' ? '#94a3b8' : '#1e293b', marginBottom: 6, display: 'block' }}>Port</label>
              <input 
                name="port" 
                value={form.port} 
                onChange={handleInput} 
                required={false}
                disabled={form.accessType === 'TallyDex'}
                style={{ 
                  padding: '12px 14px', 
                  borderRadius: 8, 
                  border: '1.5px solid #cbd5e1', 
                  width: '90%', 
                  fontSize: 16, 
                  background: form.accessType === 'TallyDex' ? '#f1f5f9' : '#f8fafc', 
                  marginBottom: 0,
                  opacity: form.accessType === 'TallyDex' ? 0.6 : 1,
                  cursor: form.accessType === 'TallyDex' ? 'not-allowed' : 'text'
                }} 
                placeholder={form.accessType === 'TallyDex' ? 'Not required' : '9009'} 
              />
            </div>
            <button 
              type="submit" 
              disabled={formLoading} 
              style={{ 
                padding: '14px 24px', 
                background: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)', 
                color: '#fff', 
                border: 'none', 
                borderRadius: 8, 
                fontWeight: 700, 
                fontSize: 16, 
                minWidth: 140, 
                cursor: 'pointer', 
                opacity: formLoading ? 0.7 : 1, 
                boxShadow: '0 2px 8px 0 rgba(59,130,246,0.20)', 
                whiteSpace: 'nowrap',
                transition: 'transform 0.2s, box-shadow 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}
              onMouseEnter={(e) => {
                if (!formLoading) {
                  e.target.style.transform = 'translateY(-1px)';
                  e.target.style.boxShadow = '0 4px 12px 0 rgba(59,130,246,0.30)';
                }
              }}
              onMouseLeave={(e) => {
                if (!formLoading) {
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = '0 2px 8px 0 rgba(59,130,246,0.20)';
                }
              }}
            >
              <span className="material-icons" style={{ fontSize: 18 }}>
                {formLoading ? 'sync' : 'add'}
              </span>
              {formLoading ? 'Creating...' : 'Create Connection'}
            </button>
          </form>
          {/* Form Messages */}
          {formError && (
            <div style={{ 
              background: '#fef2f2', 
              border: '1px solid #fecaca',
              borderRadius: 8, 
              padding: 16, 
              marginTop: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 12
            }}>
              <span className="material-icons" style={{ color: '#dc2626', fontSize: 20 }}>error</span>
              <div style={{ color: '#dc2626', fontSize: 14, fontWeight: 500 }}>{formError}</div>
            </div>
          )}
          {formSuccess && (
            <div style={{ 
              background: '#f0fdf4', 
              border: '1px solid #bbf7d0',
              borderRadius: 8, 
              padding: 16, 
              marginTop: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 12
            }}>
              <span className="material-icons" style={{ color: '#16a34a', fontSize: 20 }}>check_circle</span>
              <div style={{ color: '#16a34a', fontSize: 14, fontWeight: 500 }}>{formSuccess}</div>
            </div>
          )}
                       {(form.accessType === 'TallyDex' || form.accessType === 'Tally+TallyDex') && (
              <div style={{ 
              background: '#f0fdf4', 
              border: '1px solid #bbf7d0',
              borderRadius: 8, 
              padding: 16, 
              marginTop: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 12
            }}>
              <span className="material-icons" style={{ color: '#16a34a', fontSize: 20 }}>info</span>
              <div style={{ color: '#16a34a', fontSize: 14, fontWeight: 500 }}>
                <strong>Note:</strong> TallyDex data will be stored in MySQLDB
              </div>
              </div>
            )}
         </div>

        <div style={{ height: 32 }} />

        {/* Connections Table */}
        <div className="tallyconfig-mobile-table" style={{ 
          background: '#fff', 
          borderRadius: 16, 
          boxShadow: '0 4px 24px 0 rgba(31,38,135,0.08)', 
          padding: window.innerWidth <= 700 ? 16 : 32, 
          marginTop: 0, 
          width: window.innerWidth <= 700 ? '76vw' : '100%', 
          margin: '0 auto', 
          minHeight: 360, 
          boxSizing: 'border-box' 
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 12, 
            marginBottom: 24,
            paddingBottom: 16,
            borderBottom: '1px solid #f1f5f9'
          }}>
            <span className="material-icons" style={{ fontSize: 24, color: '#3b82f6' }}>list_alt</span>
            <h3 style={{ color: '#1e293b', fontWeight: 700, margin: 0, fontSize: 20 }}>Tally Connections</h3>
          </div>
          
          {/* Loading State */}
          {loading && (
            <div style={{ 
              textAlign: 'center', 
              padding: 60, 
              color: '#64748b',
              background: '#f8fafc',
              borderRadius: 12,
              margin: '16px 0'
            }}>
              <span className="material-icons" style={{ fontSize: 48, color: '#3b82f6', marginBottom: 16, display: 'block' }}>sync</span>
              <div style={{ fontSize: 16, fontWeight: 500 }}>Loading connections...</div>
            </div>
          )}

          {/* Error State */}
          {tableError && (
            <div style={{ 
              background: '#fef2f2', 
              border: '1px solid #fecaca',
              borderRadius: 8, 
              padding: 20, 
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 12
            }}>
              <span className="material-icons" style={{ color: '#dc2626', fontSize: 24 }}>error</span>
              <div style={{ color: '#dc2626', fontSize: 14, fontWeight: 500 }}>{tableError}</div>
            </div>
          )}

          {/* Empty State */}
          {!loading && connections.length === 0 && !tableError && (
            <div style={{ 
              textAlign: 'center', 
              padding: 60, 
              color: '#64748b',
              background: '#f8fafc',
              borderRadius: 12,
              margin: '16px 0'
            }}>
              <span className="material-icons" style={{ fontSize: 64, color: '#cbd5e1', marginBottom: 16, display: 'block' }}>account_tree</span>
              <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No connections found</div>
              <div style={{ fontSize: 14 }}>Create your first connection above to get started</div>
            </div>
          )}

          {!loading && connections.length > 0 && (
            <>
              {/* Desktop Table */}
              <div className="tallyconfig-desktop-table" style={{ display: window.innerWidth > 700 ? 'block' : 'none', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                  <thead>
                    <tr style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)' }}>
                      <th style={{ 
                        padding: '10px 12px', 
                        textAlign: 'left', 
                        fontWeight: 700, 
                        color: '#1e293b',
                        fontSize: 14,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        borderBottom: '2px solid #e2e8f0'
                      }}>Site ID</th>
                      <th style={{ 
                        padding: '10px 12px', 
                        textAlign: 'left', 
                        fontWeight: 700, 
                        color: '#1e293b',
                        fontSize: 14,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        borderBottom: '2px solid #e2e8f0'
                      }}>IP Address</th>
                      <th style={{ 
                        padding: '10px 12px', 
                        textAlign: 'left', 
                        fontWeight: 700, 
                        color: '#1e293b',
                        fontSize: 14,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        borderBottom: '2px solid #e2e8f0'
                      }}>Port</th>
                      <th style={{ 
                        padding: '10px 12px', 
                        textAlign: 'left', 
                        fontWeight: 700, 
                        color: '#1e293b',
                        fontSize: 14,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        borderBottom: '2px solid #e2e8f0'
                      }}>Access Type</th>
                      <th style={{ 
                        padding: '10px 12px', 
                        textAlign: 'left', 
                        fontWeight: 700, 
                        color: '#1e293b',
                        fontSize: 14,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        borderBottom: '2px solid #e2e8f0',
                        width: 300 
                      }}>Status</th>
                      <th style={{ 
                        padding: '10px 12px', 
                        textAlign: 'left', 
                        fontWeight: 700, 
                        color: '#1e293b',
                        fontSize: 14,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        borderBottom: '2px solid #e2e8f0',
                        width: 120 
                      }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {connections.map((connection, idx) => {
                      const connectionKey = connection.connectionName || connection.name || connection.conn_name || connection.ip || '';
                      const activeCompanies = connectionCompanies[connectionKey] || [];
                      return (
                        <tr 
                          key={connection.id} 
                          style={{ 
                            borderBottom: '1px solid #f1f5f9', 
                            height: '60px',
                            background: idx % 2 === 0 ? '#fff' : '#f8fafc',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.background = '#f0f9ff';
                            e.target.style.transform = 'translateY(-1px)';
                            e.target.style.boxShadow = '0 4px 12px 0 rgba(59,130,246,0.10)';
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.background = idx % 2 === 0 ? '#fff' : '#f8fafc';
                            e.target.style.transform = 'translateY(0)';
                            e.target.style.boxShadow = 'none';
                          }}
                        >
                          <td style={{ padding: '10px 12px', fontWeight: 600, color: '#1e293b' }}>{connection.name}</td>
                          <td style={{ padding: '10px 12px', color: '#64748b' }}>
                            <div style={{ fontFamily: 'monospace', marginBottom: 4 }}>{connection.ip}</div>
                            <div style={{
                              fontSize: 12,
                              color: '#475569',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              width: '100%'
                            }}
                              title={activeCompanies.length > 0 ? activeCompanies.map((company) => `${company.company}${company.accessType ? ` (${company.accessType})` : ''}`).join(', ') : (companiesLoading ? 'Checking companies…' : 'No active companies')}>
                              {companiesLoading ? (
                                <span style={{ color: '#94a3b8' }}>Checking companies…</span>
                              ) : activeCompanies.length > 0 ? (
                                <>
                                  {activeCompanies.map((company, idx) => (
                                    <React.Fragment key={company.guid}>
                                      {idx > 0 && <span style={{ color: '#cbd5f5' }}>•</span>}
                                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <span className="material-icons" style={{ fontSize: 12, color: '#3b82f6' }}>apartment</span>
                                        <span style={{ color: '#0f172a', fontWeight: 600 }}>{company.company}</span>
                                      </span>
                                    </React.Fragment>
                                  ))}
                                </>
                              ) : (
                                <span style={{ color: '#94a3b8' }}>No active companies</span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '10px 12px', color: '#64748b', fontFamily: 'monospace' }}>{connection.port}</td>
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{
                              padding: '3px 6px',
                              borderRadius: '8px',
                              fontSize: '12px',
                              fontWeight: 600,
                              background: '#e0f2fe',
                              color: '#0c4a6e',
                              display: 'inline-block'
                            }}>{connection.accessType || 'Tally'}</span>
                          </td>
                          <td style={{ padding: '10px 12px', width: 300 }}>
                            <span style={{
                              padding: '3px 6px',
                              borderRadius: '8px',
                              fontSize: '12px',
                              fontWeight: 600,
                              background: connection.status === 'active' ? '#dcfce7' : 
                                        connection.status === 'pending' ? '#fef3c7' :
                                        connection.status === 'rejected' ? '#fef2f2' : 
                                        connection.status === 'approved' ? '#dcfce7' : '#f1f5f9',
                              color: connection.status === 'active' ? '#166534' : 
                                     connection.status === 'pending' ? '#92400e' :
                                     connection.status === 'rejected' ? '#dc2626' : 
                                     connection.status === 'approved' ? '#166534' : '#64748b',
                              display: 'inline-block',
                              maxWidth: '280px',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }} title={connection.statusMessage || connection.status}>
                              {connection.statusMessage || connection.status}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px', verticalAlign: 'middle' }}>
                            {(connection.status === 'active' || connection.status === 'approved' || connection.status === 'inactive') ? (
                            <button
                              onClick={() => handleToggle(connection.id, !connection.isActive)}
                              style={{
                                borderRadius: '50%',
                                border: 'none',
                                fontSize: '32px',
                                cursor: 'pointer',
                                background: 'transparent',
                                color: connection.isActive ? '#3b82f6' : '#64748b',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                  transition: 'all 0.2s ease',
                                width: 64,
                                height: 48
                              }}
                              title={connection.isActive ? 'Deactivate' : 'Activate'}
                                onMouseEnter={(e) => {
                                  e.target.style.transform = 'scale(1.1)';
                                  e.target.style.color = connection.isActive ? '#1e40af' : '#3b82f6';
                                }}
                                onMouseLeave={(e) => {
                                  e.target.style.transform = 'scale(1)';
                                  e.target.style.color = connection.isActive ? '#3b82f6' : '#64748b';
                                }}
                            >
                              <span className="material-icons">
                                {connection.isActive ? 'toggle_on' : 'toggle_off'}
                              </span>
                            </button>
                            ) : (
                              <span style={{
                                color: '#94a3b8',
                                fontSize: '14px',
                                fontWeight: 500,
                                display: 'inline-block',
                                lineHeight: '48px',
                                height: '48px'
                              }}>
                                {connection.status === 'pending' ? 'Pending' : 
                                 connection.status === 'rejected' ? 'Rejected' : 'Inactive'}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* Mobile Stacked Table */}
              <div className="tallyconfig-mobile-stacked-table" style={{ display: window.innerWidth <= 700 ? 'block' : 'none', width: window.innerWidth <= 700 ? '76vw' : '100%' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                      <th style={{ padding: '8px 8px', textAlign: 'left', fontWeight: 600, color: '#1e293b' }}>Site ID/IP</th>
                      <th style={{ padding: '8px 8px', textAlign: 'left', fontWeight: 600, color: '#1e293b', whiteSpace: 'normal' }}>Port<br/>Access Type</th>
                      <th style={{ padding: '8px 8px', textAlign: 'left', fontWeight: 600, color: '#1e293b' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {connections.map((connection) => {
                      const connectionKey = connection.connectionName || connection.name || connection.conn_name || connection.ip || '';
                      const activeCompanies = connectionCompanies[connectionKey] || [];
                      return (
                      <React.Fragment key={connection.id}>
                        <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '8px 8px', fontWeight: 500, color: '#1e293b' }}>{connection.name}</td>
                          <td style={{ padding: '8px 8px', color: '#475569', fontFamily: 'monospace', maxWidth: window.innerWidth <= 700 ? 80 : undefined, width: window.innerWidth <= 700 ? 80 : undefined, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{connection.port}</td>
                          <td style={{ padding: '8px 8px' }} rowSpan={3}>
                            <button
                              onClick={() => handleToggle(connection.id, !connection.isActive)}
                              style={{
                                borderRadius: '50%',
                                border: 'none',
                                fontSize: '28px',
                                cursor: 'pointer',
                                background: 'transparent',
                                color: connection.isActive ? '#3b82f6' : '#64748b',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'color 0.2s',
                                width: 44,
                                height: 36
                              }}
                              title={connection.isActive ? 'Deactivate' : 'Activate'}
                            >
                              <span className="material-icons">
                                {connection.isActive ? 'toggle_on' : 'toggle_off'}
                              </span>
                            </button>
                          </td>
                        </tr>
                        <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '8px 8px', color: '#475569' }}>
                            <div style={{ fontFamily: 'monospace', marginBottom: 4 }}>{connection.ip}</div>
                            <div style={{
                              fontSize: 11,
                              color: '#475569',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              width: '100%'
                            }}
                              title={activeCompanies.length > 0 ? activeCompanies.map((company) => `${company.company}${company.accessType ? ` (${company.accessType})` : ''}`).join(', ') : (companiesLoading ? 'Checking companies…' : 'No active companies')}>
                              {companiesLoading ? (
                                <span style={{ color: '#94a3b8' }}>Checking companies…</span>
                              ) : activeCompanies.length > 0 ? (
                                <>
                                  {activeCompanies.map((company, idx) => (
                                    <React.Fragment key={company.guid}>
                                      {idx > 0 && <span style={{ color: '#cbd5f5' }}>•</span>}
                                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <span className="material-icons" style={{ fontSize: 11, color: '#3b82f6' }}>apartment</span>
                                        <span style={{ color: '#0f172a', fontWeight: 600 }}>{company.company}</span>
                                      </span>
                                    </React.Fragment>
                                  ))}
                                </>
                              ) : (
                                <span style={{ color: '#94a3b8' }}>No active companies</span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '8px 8px', maxWidth: window.innerWidth <= 700 ? 80 : undefined, width: window.innerWidth <= 700 ? 80 : undefined, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <span style={{
                              padding: '4px 8px',
                              borderRadius: '12px',
                              fontSize: '12px',
                              fontWeight: 600,
                              background: '#e0f2fe',
                              color: '#0c4a6e',
                              display: 'inline-block',
                              maxWidth: 80,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}>{connection.accessType || 'Tally'}</span>
                          </td>
                        </tr>
                        <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                          <td style={{ padding: '8px 8px', color: '#475569', fontFamily: 'monospace' }} colSpan={2}>
                            <span style={{
                              padding: '4px 8px',
                              borderRadius: '12px',
                              fontSize: '12px',
                              fontWeight: 600,
                              background: connection.isActive ? '#dcfce7' : '#fef2f2',
                              color: connection.isActive ? '#166534' : '#dc2626',
                              display: 'inline-block',
                              maxWidth: 80,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}>{connection.isActive ? 'Active' : 'Inactive'}</span>
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

export default TallyConfig; 