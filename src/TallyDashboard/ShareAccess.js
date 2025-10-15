import React, { useState, useEffect, useMemo } from 'react';
import { getApiUrl, API_CONFIG } from '../config';
import { apiGet, apiPost } from '../utils/apiUtils';

const ShareAccess = () => {
  console.log('ShareAccess component rendered'); // Debug log
  const [allConnections, setAllConnections] = useState([]);
  const [company, setCompany] = useState('');
  const [companyFocused, setCompanyFocused] = useState(false);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiData, setApiData] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmails, setSelectedEmails] = useState([]);
  const [selectedRole, setSelectedRole] = useState('');
  const [roles, setRoles] = useState([]);
  const [rolesLoading, setRolesLoading] = useState(false);

  // Company search and dropdown state
  const [companySearchTerm, setCompanySearchTerm] = useState('');
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const [filteredCompanyOptions, setFilteredCompanyOptions] = useState([]);

  // Fetch roles
  const fetchRoles = async () => {
    setRolesLoading(true);
    try {
      const data = await apiGet('/api/access-control/roles/all');
      if (data && data.roles) {
        setRoles(data.roles);
        console.log('Roles fetched:', data.roles);
      }
    } catch (err) {
      console.error('Error fetching roles:', err);
    } finally {
      setRolesLoading(false);
    }
  };

  useEffect(() => {
    // Get connections from session storage
    const connections = JSON.parse(sessionStorage.getItem('allConnections') || '[]');
    setAllConnections(connections);
    
    // Get selected company from session storage, but only if it has Full Access
    const selectedCompanyGuid = sessionStorage.getItem('selectedCompanyGuid');
    if (selectedCompanyGuid) {
      const selectedCompany = connections.find(c => c.guid === selectedCompanyGuid);
      // Only set the company if it has Full Access, otherwise leave it empty
      if (selectedCompany && selectedCompany.access_type === 'Full Access') {
        setCompany(selectedCompanyGuid);
      }
    }

    // Fetch roles
    fetchRoles();
  }, []);

  // Filter companies based on search term with debouncing
  useEffect(() => {
    if (!companySearchTerm.trim()) {
      setFilteredCompanyOptions([]);
      return;
    }
    
    // Debounce search to improve performance
    const timeoutId = setTimeout(() => {
      const searchLower = companySearchTerm.toLowerCase();
      
      // Search in company name and access_type
      const exactMatches = [];
      const startsWithMatches = [];
      const containsMatches = [];
      
      for (let i = 0; i < allConnections.length; i++) {
        const connection = allConnections[i];
        const companyName = connection.company || '';
        const accessType = connection.access_type || '';
        const companyNameLower = companyName.toLowerCase();
        const accessTypeLower = accessType.toLowerCase();
        
        // Check if search term matches company name or access type
        const nameMatch = companyNameLower.includes(searchLower);
        const accessMatch = accessTypeLower.includes(searchLower);
        
        if (nameMatch || accessMatch) {
          // Prioritize exact matches
          if (companyNameLower === searchLower || accessTypeLower === searchLower) {
            exactMatches.push(connection);
          } else if (companyNameLower.startsWith(searchLower) || accessTypeLower.startsWith(searchLower)) {
            startsWithMatches.push(connection);
          } else {
            containsMatches.push(connection);
          }
        }
      }
      
      // Combine results in priority order - no limit
      const filtered = [...exactMatches, ...startsWithMatches, ...containsMatches];
      setFilteredCompanyOptions(filtered);
    }, 150); // 150ms debounce
    
    return () => clearTimeout(timeoutId);
  }, [companySearchTerm, allConnections]);
  
  // Show all companies when dropdown opens
  useEffect(() => {
    if (showCompanyDropdown && !companySearchTerm.trim()) {
      // If less than 100 companies, show all immediately
      if (allConnections.length < 100) {
        setFilteredCompanyOptions(allConnections);
      } else {
        setFilteredCompanyOptions([]);
      }
    }
  }, [showCompanyDropdown, companySearchTerm, allConnections]);

  // Get the current company object using the selected guid
  const currentCompanyObj = useMemo(() => {
    return allConnections.find(c => c.guid === company);
  }, [company, allConnections]);

  const handleGetMasters = async (e) => {
    e.preventDefault();
    
    if (!currentCompanyObj) {
      setMessage('Please select a company first.');
      return;
    }

    if (!currentCompanyObj.tallyloc_id) {
      setMessage('Company configuration is incomplete. Please contact administrator.');
      return;
    }

    setIsLoading(true);
    setMessage('');

    try {
      const data = await apiPost(API_CONFIG.ENDPOINTS.TALLY_LEDGER_SHAREACCESS, {
          tallyloc_id: currentCompanyObj.tallyloc_id,
          company: currentCompanyObj.company,
          guid: currentCompanyObj.guid
      });
      setApiData(data);
      
             // Start with emails that already have access (STATUS = 1) selected by default
       const activeEmails = data.emails?.filter(email => email.STATUS === 1).map(email => email.EMAIL) || [];
       setSelectedEmails(activeEmails);
      

      
    } catch (error) {
      setMessage('Error getting masters. Please try again.');
      console.error('Error getting masters:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompanyChange = (e) => {
    const selectedCompany = allConnections.find(c => 
      `${c.company} [${c.access_type}]` === e.target.value
    );
    if (selectedCompany) {
      setCompany(selectedCompany.guid);
      // Clear data when company changes
      setApiData(null);
      setSelectedEmails([]);
      setSearchTerm('');
      setMessage('');
    }
  };

  const handleEmailSelection = (email) => {
    setSelectedEmails(prev => {
      if (prev.includes(email)) {
        return prev.filter(e => e !== email);
      } else {
        return [...prev, email];
      }
    });
  };

  const handleShareAccess = async () => {
    if (!currentCompanyObj) {
      setMessage('Please select a company first.');
      return;
    }

    if (!currentCompanyObj.tallyloc_id) {
      setMessage('Company configuration is incomplete. Please contact administrator.');
      return;
    }

    if (!selectedRole) {
      setMessage('Please select a role before sharing access.');
      return;
    }

    setIsLoading(true);
    setMessage('');

    try {
      // Prepare users array with email and roleId
      const users = selectedEmails.map(email => {
        // Find the email object from apiData to check if it has existing ROLE_ID
        const emailObj = apiData.emails?.find(e => e.EMAIL === email);
        const existingRoleId = emailObj?.ROLE_ID;
        
        return {
          email: email,
          roleId: existingRoleId || selectedRole || null // Use existing roleId, or global selected role, or null
        };
      });

      const data = await apiPost(API_CONFIG.ENDPOINTS.TALLY_LEDGER_SHAREACCESS_ACC, {
          tallyloc_id: currentCompanyObj.tallyloc_id,
          company: currentCompanyObj.company,
          guid: currentCompanyObj.guid,
          users: users
      });
      
      // Calculate totals from response
      const totalDeactivated = data.results.deactivated;
      const totalActive = data.results.activated + data.results.created + data.results.newAccounts;
      
      setMessage(`Total Deactivated = ${totalDeactivated} and Total Active = ${totalActive}`);
      
             // Auto-hide message after 5 seconds
       setTimeout(() => {
         setMessage('');
       }, 5000);
      
             console.log('Share access response:', data);
       
       // Refresh table data after successful access management
       try {
         const refreshData = await apiPost(API_CONFIG.ENDPOINTS.TALLY_LEDGER_SHAREACCESS, {
                      tallyloc_id: currentCompanyObj.tallyloc_id,
                      company: currentCompanyObj.company,
                      guid: currentCompanyObj.guid
         });
         
         if (refreshData) {
           setApiData(refreshData);
           
           // Update selected emails based on new STATUS values
           const newActiveEmails = refreshData.emails?.filter(email => email.STATUS === 1).map(email => email.EMAIL) || [];
           setSelectedEmails(newActiveEmails);
         }
       } catch (refreshError) {
         console.error('Error refreshing table data:', refreshError);
         // Don't show error to user as main operation was successful
       }
       
     } catch (error) {
       setMessage('Error managing access. Please try again.');
       console.error('Error managing access:', error);
     } finally {
       setIsLoading(false);
     }
   };

  // Filter emails based on search term
  const filteredEmails = useMemo(() => {
    if (!apiData?.emails) return [];
    
    return apiData.emails.filter(email => 
      email.EMAIL.toLowerCase().includes(searchTerm.toLowerCase()) ||
      email.LEDGERS.some(ledger => 
        ledger.NAME.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ledger.GROUP.toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [apiData, searchTerm]);

  return (
    <div style={{ width: '100%', maxWidth: '1400px', margin: '0' }}>
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          
          @keyframes dropdownFadeIn {
            from {
              opacity: 0;
              transform: translateY(-10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          
          .dropdown-animation {
            animation: dropdownFadeIn 0.2s ease-out;
          }
        `}
      </style>

      {/* Header Section */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32, marginTop: 50 }}>
        <div>
          <h2 style={{ color: '#1e40af', fontWeight: 700, fontSize: 28, margin: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="material-icons" style={{ fontSize: 32, color: '#1e40af' }}>share</span>
            Share Access Management
          </h2>
          <div style={{ color: '#64748b', fontSize: 16, marginTop: 4 }}>Grant access to users</div>
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
          <span className="material-icons" style={{ fontSize: 18 }}>business</span>
          {allConnections.filter(c => c.status === 'Connected' && c.access_type === 'Full Access').length} companies available
        </div>
      </div>

      {/* Company Selection Form */}
      <div style={{ 
        background: '#fff', 
        borderRadius: 16, 
        boxShadow: '0 4px 24px 0 rgba(31,38,135,0.08)', 
        padding: 32, 
        marginBottom: 24,
        width: '100%', 
        boxSizing: 'border-box' 
          }}>
          <div style={{
            display: 'flex',
              alignItems: 'center', 
          gap: 12,
          marginBottom: 28,
          paddingBottom: 16,
          borderBottom: '2px solid #f1f5f9'
        }}>
          <span className="material-icons" style={{ fontSize: 24, color: '#3b82f6' }}>share</span>
          <h3 style={{ color: '#1e293b', fontWeight: 700, margin: 0, fontSize: 20 }}>Share Access Form</h3>
            </div>
            
        <form onSubmit={handleGetMasters}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '400px 200px',
            gap: '24px',
            alignItems: 'end',
            position: 'relative'
          }}>
            {/* Company */}
            <div style={{ 
              position: 'relative'
            }}>
              <div style={{
                position: 'relative',
                background: 'white',
                borderRadius: '12px',
                border: showCompanyDropdown ? '2px solid #3b82f6' : '2px solid #e2e8f0',
                transition: 'all 0.2s ease',
                boxShadow: showCompanyDropdown ? '0 4px 12px rgba(59, 130, 246, 0.15)' : '0 1px 3px rgba(0, 0, 0, 0.1)',
                zIndex: showCompanyDropdown ? 1001 : 'auto'
              }}>
                <input
                  value={company ? (() => {
                    const currentCompany = allConnections.find(c => c.guid === company);
                    return currentCompany ? `${currentCompany.company} [${currentCompany.access_type}]` : '';
                  })() : companySearchTerm}
                  onChange={e => {
                    const inputValue = e.target.value;
                    setCompanySearchTerm(inputValue);
                    setCompany('');
                    setShowCompanyDropdown(true);
                    // Clear filtered results when clearing search
                    if (!inputValue.trim()) {
                      // If less than 100 companies, show all immediately
                      if (allConnections.length < 100) {
                        setFilteredCompanyOptions(allConnections);
                      } else {
                        setFilteredCompanyOptions([]);
                      }
                    }
                  }}
                  onFocus={() => {
                    setCompanyFocused(true);
                    setShowCompanyDropdown(true);
                    // Show all companies if less than 100
                    if (allConnections.length < 100) {
                      setFilteredCompanyOptions(allConnections);
                    }
                  }}
                  onBlur={() => setCompanyFocused(false)}
                  required
                  style={{
                    width: '100%',
                    padding: '16px 20px',
                    paddingRight: company ? '50px' : '20px',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '15px',
                    color: '#374151',
                    outline: 'none',
                    background: 'transparent',
                    cursor: 'text'
                  }}
                  placeholder=""
                />
                
                {/* Search Icon or Dropdown Arrow */}
                {!company && (
                  <span 
                    className="material-icons" 
                    style={{
                      position: 'absolute',
                      right: '16px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: showCompanyDropdown ? '#3b82f6' : '#9ca3af',
                      fontSize: '20px',
                      pointerEvents: 'none',
                      transition: 'color 0.2s ease'
                    }}
                  >
                    {showCompanyDropdown ? 'expand_less' : 'search'}
                  </span>
                )}
                
                {/* Clear Button for Company */}
                {company && (
                  <button
                    type="button"
                    onClick={() => {
                      setCompany('');
                      setCompanySearchTerm('');
                      setShowCompanyDropdown(false);
                      // If less than 100 companies, show all when reopening
                      if (allConnections.length < 100) {
                        setFilteredCompanyOptions(allConnections);
                      } else {
                        setFilteredCompanyOptions([]);
                      }
                    }}
                    style={{
                      position: 'absolute',
                      right: '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px',
                      borderRadius: '50%',
                      color: '#64748b',
                      fontSize: '18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'color 0.2s ease'
                    }}
                    title="Clear company"
                  >
                    ×
                  </button>
                )}

                <label style={{
                  position: 'absolute',
                  left: '16px',
                  top: companyFocused || (() => {
                    const currentCompany = allConnections.find(c => c.guid === company);
                    return !!currentCompany;
                  })() ? '-8px' : '50%',
                  transform: companyFocused || (() => {
                    const currentCompany = allConnections.find(c => c.guid === company);
                    return !!currentCompany;
                  })() ? 'none' : 'translateY(-50%)',
                  fontSize: companyFocused || (() => {
                    const currentCompany = allConnections.find(c => c.guid === company);
                    return !!currentCompany;
                  })() ? '11px' : '14px',
                  color: companyFocused || (() => {
                    const currentCompany = allConnections.find(c => c.guid === company);
                    return !!currentCompany;
                  })() ? '#3b82f6' : '#6b7280',
                  backgroundColor: '#fff',
                  padding: '0 6px',
                  transition: 'all 0.2s ease',
                  pointerEvents: 'none',
                  zIndex: 1
                }}>
                  Company
                </label>
                
                {/* Custom Company Dropdown */}
                {showCompanyDropdown && (
                  <div 
                    className="dropdown-animation"
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 2px)',
                      left: 0,
                      right: 0,
                      backgroundColor: 'white',
                      border: '2px solid #3b82f6',
                      borderRadius: '8px',
                      maxHeight: '300px',
                      overflowY: 'auto',
                      zIndex: 9999,
                      boxShadow: '0 10px 25px rgba(59, 130, 246, 0.2)',
                      marginTop: '0',
                      minHeight: '50px'
                    }}
                  >
                    {/* Results */}
                    {filteredCompanyOptions
                      .filter(conn => conn.status === 'Connected' && conn.access_type === 'Full Access')
                      .map((companyOption, index) => (
                      <div
                        key={companyOption.guid}
                        onClick={() => {
                          setCompany(companyOption.guid);
                          setCompanySearchTerm('');
                          setShowCompanyDropdown(false);
                        }}
                        style={{
                          padding: '12px 16px',
                          cursor: 'pointer',
                          borderBottom: index < filteredCompanyOptions.filter(c => c.status === 'Connected' && c.access_type === 'Full Access').length - 1 ? '1px solid #f1f5f9' : 'none',
                          transition: 'background-color 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.backgroundColor = '#f8fafc';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.backgroundColor = 'white';
                        }}
                      >
                        <div style={{
                          fontWeight: '600',
                          color: '#1e293b',
                          fontSize: '14px'
                        }}>
                          {companyOption.company}
                        </div>
                        <div style={{
                          fontSize: '12px',
                          color: '#64748b',
                          marginTop: '2px'
                        }}>
                          Access Type: {companyOption.access_type || 'N/A'}
                        </div>
                      </div>
                    ))}
                    
                    {/* Show total results count */}
                    {filteredCompanyOptions.filter(c => c.status === 'Connected' && c.access_type === 'Full Access').length > 0 && (
                      <div style={{
                        padding: '12px 16px',
                        textAlign: 'center',
                        color: '#64748b',
                        fontSize: '12px',
                        fontStyle: 'italic',
                        borderTop: '1px solid #f1f5f9',
                        backgroundColor: '#f8fafc'
                      }}>
                        Showing {filteredCompanyOptions.filter(c => c.status === 'Connected' && c.access_type === 'Full Access').length} company{filteredCompanyOptions.filter(c => c.status === 'Connected' && c.access_type === 'Full Access').length !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Get Masters Button */}
              <button 
                type="submit" 
                disabled={isLoading || !currentCompanyObj}
                style={{ 
                background: isLoading || !currentCompanyObj ? '#9ca3af' : 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)', 
                  color: '#fff', 
                  border: 'none', 
                  borderRadius: 8, 
                fontWeight: 600, 
                fontSize: 16, 
                padding: '12px 24px', 
                cursor: isLoading || !currentCompanyObj ? 'not-allowed' : 'pointer', 
                boxShadow: '0 2px 8px 0 rgba(59,130,246,0.10)', 
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                minWidth: 140
              }}
            >
              <span className="material-icons" style={{ fontSize: 18 }}>
                {isLoading ? 'sync' : 'search'}
              </span>
                {isLoading ? 'Getting...' : 'Get Masters'}
              </button>
          </div>
        </form>
      </div>

        {/* Message Display */}
        {message && (
          <div style={{ 
            background: message.includes('Error') ? '#fee2e2' : '#d1fae5', 
            color: message.includes('Error') ? '#b91c1c' : '#059669', 
          borderRadius: 16, 
          padding: 16, 
          marginBottom: 24,
            fontWeight: 600, 
            fontSize: 15, 
            display: 'flex', 
            alignItems: 'center', 
          gap: 8
          }}>
            <span className="material-icons" style={{ fontSize: 18 }}>
              {message.includes('Error') ? 'error_outline' : 'check_circle'}
            </span>
            {message}
          </div>
        )}

      {/* Search and Controls */}
        {apiData && (
        <div style={{
          background: '#fff',
          borderRadius: 16, 
          boxShadow: '0 4px 24px 0 rgba(31,38,135,0.08)', 
          padding: 24, 
          marginBottom: 24,
               display: 'flex', 
          justifyContent: 'space-between',
               alignItems: 'center', 
          gap: 16
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
            <span className="material-icons" style={{ color: '#64748b', fontSize: 20 }}>search</span>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search users..."
                    style={{
                      padding: '12px 16px',
                      borderRadius: 8,
                border: '1.5px solid #e2e8f0',
                      fontSize: 16,
                color: '#1e293b',
                outline: 'none',
                flex: 1,
                maxWidth: 400,
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
              onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
            />
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ position: 'relative' }}>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                disabled={rolesLoading}
                required
                style={{
                  padding: '12px 16px',
                  borderRadius: 8,
                  border: `2px solid ${!selectedRole ? '#dc2626' : '#e5e7eb'}`,
                  fontSize: 15,
                  color: '#1e293b',
                  outline: 'none',
                  background: '#fff',
                  cursor: rolesLoading ? 'not-allowed' : 'pointer',
                  minWidth: 250
                }}
                onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.target.style.borderColor = !selectedRole ? '#dc2626' : '#e5e7eb'}
              >
                <option value="">
                  {rolesLoading ? 'Loading roles...' : 'Select a role *'}
                </option>
                {roles.map(role => (
                  <option key={role.id} value={role.id}>
                    {role.display_name}
                  </option>
                ))}
              </select>
              {!selectedRole && (
                <span style={{
                  position: 'absolute',
                  top: '-8px',
                  right: '8px',
                  color: '#dc2626',
                  fontSize: '12px',
                  fontWeight: 600,
                  background: '#fff',
                  padding: '0 4px'
                }}>
                  Required
                </span>
              )}
            </div>
            
                    <button
              onClick={handleShareAccess}
              disabled={selectedEmails.length === 0 || !selectedRole}
                      style={{
                background: (selectedEmails.length === 0 || !selectedRole) ? '#9ca3af' : 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                color: '#fff',
                        border: 'none',
                borderRadius: 8,
                fontWeight: 600,
                        fontSize: 16,
                padding: '12px 24px',
                cursor: (selectedEmails.length === 0 || !selectedRole) ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 8px 0 rgba(5,150,105,0.10)',
                transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                gap: 8,
                minWidth: 160
              }}
            >
              <span className="material-icons" style={{ fontSize: 18 }}>
                share
              </span>
              Share Access ({selectedEmails.length})
                    </button>
                </div>
        </div>
      )}

      {/* Data Display */}
      {apiData && (
        <div style={{ 
          background: '#fff', 
          borderRadius: 16, 
          boxShadow: '0 4px 24px 0 rgba(31,38,135,0.08)', 
          padding: 32, 
          marginBottom: 24
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 12,
            marginBottom: 24,
            paddingBottom: 16,
            borderBottom: '2px solid #f1f5f9'
          }}>
            <span className="material-icons" style={{ fontSize: 24, color: '#3b82f6' }}>group</span>
            <h3 style={{ color: '#1e293b', fontWeight: 700, margin: 0, fontSize: 20 }}>
              Share Access ({filteredEmails.length})
            </h3>
             </div>

            {/* Data Table */}
            <div style={{
              background: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              overflow: 'hidden'
            }}>
              <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f3f4f6' }}>
                      <th style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600, color: '#374151', width: '80px' }}>
                         <input
                           type="checkbox"
                           checked={filteredEmails.length > 0 && selectedEmails.length === filteredEmails.length}
                           onChange={(e) => {
                             if (e.target.checked) {
                               // Add current filtered emails to existing selection (avoid duplicates)
                               const newEmails = [...new Set([...selectedEmails, ...filteredEmails.map(email => email.EMAIL)])];
                               setSelectedEmails(newEmails);
                             } else {
                               // Remove only the currently filtered emails from selection
                               const remainingEmails = selectedEmails.filter(email => 
                                 !filteredEmails.some(fe => fe.EMAIL === email)
                               );
                               setSelectedEmails(remainingEmails);
                             }
                           }}
                           style={{ marginRight: '8px' }}
                         />
                        All
                       </th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600, color: '#374151', width: '150px' }}>Role</th>
                       <th style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600, color: '#374151', width: '200px' }}>Email</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600, color: '#374151' }}>Ledgers</th>
                    </tr>
                  </thead>
                  <tbody>
                  {filteredEmails.map((email, index) => {
                    // Find role name based on ROLE_ID
                    const roleInfo = email.ROLE_ID ? roles.find(role => role.id === email.ROLE_ID) : null;
                    const roleName = roleInfo ? roleInfo.display_name : '-';
                    
                    return (
                      <tr key={index} style={{ 
                        borderBottom: '1px solid #f3f4f6',
                        background: email.STATUS === 1 ? '#fef3c7' : '#fff'
                      }}>
                                                 <td style={{ padding: '12px 16px', textAlign: 'left' }}>
                           <input
                             type="checkbox"
                             checked={selectedEmails.includes(email.EMAIL)}
                             onChange={() => handleEmailSelection(email.EMAIL)}
                             style={{ marginRight: '8px' }}
                           />
                         </td>
                        <td style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 500, color: '#374151' }}>
                          {roleName}
                         </td>
                        <td style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 500, color: '#374151' }}>
                          {email.EMAIL}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'left', color: '#6b7280', maxWidth: '400px' }}>
                          <div style={{ 
                            wordWrap: 'break-word', 
                            whiteSpace: 'pre-wrap',
                            lineHeight: '1.4'
                          }}>
                            {email.LEDGERS.map(ledger => `${ledger.NAME} (${ledger.GROUP})`).join(' | ')}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
    </div>
  );
};

export default ShareAccess;
