import React, { useState, useEffect } from 'react';
import { getApiUrl } from '../config';
import { apiPost } from '../utils/apiUtils';
import VendorForm from './VendorForm';

const VendorManagement = () => {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  // Check if a vendor name already exists in the ledger
  const checkVendorName = async (vendorName, sessionData) => {
    try {
      console.log('🔍 Checking vendor name:', vendorName);
      
      if (!vendorName || vendorName.trim() === '') {
        throw new Error('Vendor name is required');
      }

      const token = sessionStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      // Validate session data
      const { tallyloc_id, company, guid } = sessionData;
      if (!tallyloc_id || !company || !guid) {
        throw new Error('Missing required session data (tallyloc_id, company, guid)');
      }

      const checkData = {
        tallyloc_id: parseInt(tallyloc_id),
        company: company,
        guid: guid,
        type: 'name',
        value: vendorName.trim()
      };

      console.log('🔍 Vendor Name Check Data:', checkData);

      const response = await fetch(getApiUrl('/api/tally/ledger-check'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(checkData)
      });

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (jsonError) {
          console.error('Failed to parse error response as JSON:', jsonError);
          errorData = { message: `HTTP ${response.status}: ${response.statusText}` };
        }
        
        console.error('Vendor Name Check API Error:', {
          status: response.status,
          statusText: response.statusText,
          errorData: errorData,
          requestData: checkData
        });
        throw new Error(errorData.message || `Failed to check vendor name: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('🔍 Vendor Name Check Result:', result);
      
      return {
        success: true,
        exists: result.exists === true,
        status: result.status,
        canProceed: result.canProceed,
        message: result.message,
        isDuplicate: (result.exists === true && result.status === 'approved') || result.canProceed === false,
        data: result
      };

    } catch (error) {
      console.error('Error checking vendor name:', error);
      return {
        success: false,
        exists: false,
        status: null,
        canProceed: false,
        message: error.message,
        isDuplicate: false,
        error: error
      };
    }
  };
  
  // Invite vendor state
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [vendorCompany, setVendorCompany] = useState('');
  const [vendorEmail, setVendorEmail] = useState('');
  const [generatedLink, setGeneratedLink] = useState('');
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);
  const [duplicateError, setDuplicateError] = useState('');
  const [isCheckingRealtime, setIsCheckingRealtime] = useState(false);
  const [realtimeDuplicateStatus, setRealtimeDuplicateStatus] = useState(null); // null, 'checking', 'duplicate', 'available'

  // Fetch vendors from API (using same endpoint as PlaceOrder customer list)
  const fetchVendors = async () => {
    const selectedCompanyGuid = sessionStorage.getItem('selectedCompanyGuid');
    
    if (!selectedCompanyGuid) {
      setVendors([]);
      setError('No company selected');
      setLoading(false);
      return;
    }

    // Get all companies from sessionStorage
    let companies = [];
    try {
      companies = JSON.parse(sessionStorage.getItem('allConnections') || '[]');
    } catch (e) {
      console.error('Error parsing allConnections:', e);
    }

    // Find the current company object
    const currentCompany = companies.find(c => c.guid === selectedCompanyGuid);
    if (!currentCompany) {
      setVendors([]);
      setError('Company not found');
      setLoading(false);
      return;
    }

    const { tallyloc_id, company, guid } = currentCompany;
    const cacheKey = `ledgerlist-w-addrs_${tallyloc_id}_${company}`;

    // Check cache first
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      try {
        const ledgers = JSON.parse(cached);
        setVendors(ledgers);
        setError(null);
        setLoading(false);
        return;
      } catch (e) {
        console.error('Error parsing cached data:', e);
      }
    }

    // Set loading state and fetch data
    setLoading(true);
    setError(null);
    setVendors([]); // Clear previous data while loading

    try {
      const data = await apiPost(`/api/tally/ledgerlist-w-addrs?ts=${Date.now()}`, {
        tallyloc_id,
        company,
        guid
      });

      if (data && data.ledgers && Array.isArray(data.ledgers)) {
        setVendors(data.ledgers);
        setError(null);
        // Cache the result
        sessionStorage.setItem(cacheKey, JSON.stringify(data.ledgers));
      } else if (data && data.error) {
        setError(data.error);
        setVendors([]);
      } else {
        setError('Unknown error');
        setVendors([]);
      }
    } catch (err) {
      console.error('Error fetching vendors:', err);
      setError('Failed to fetch vendors');
      setVendors([]);
    } finally {
      setLoading(false);
    }
  };

  // Load vendors on component mount
  useEffect(() => {
    fetchVendors();
  }, []);

  // Listen for company changes from top bar
  useEffect(() => {
    const handleCompanyChange = () => {
      // Company changed from top bar, refresh vendors
      fetchVendors();
    };

    window.addEventListener('companyChanged', handleCompanyChange);
    return () => window.removeEventListener('companyChanged', handleCompanyChange);
  }, []);
  
  
  // Save invitation to localStorage
  const saveInvitation = (invitation) => {
    try {
      const savedInvitations = localStorage.getItem('vendor_invitations') || '[]';
      const invitations = JSON.parse(savedInvitations);
      invitations.push(invitation);
      localStorage.setItem('vendor_invitations', JSON.stringify(invitations));
    } catch (err) {
      console.error('Error saving invitation:', err);
    }
  };
  
  // Generate unique token for vendor invitation
  const generateInvitationToken = () => {
    return 'vendor_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  };
  
  // Handle invite vendor
  const handleInviteVendor = async () => {
    if (!vendorCompany.trim() || !vendorEmail.trim()) {
      alert('Please enter both vendor name and email');
      return;
    }
    
    if (!validateEmail(vendorEmail)) {
      alert('Please enter a valid email address');
      return;
    }
    
    // Check for real-time duplicate status first
    if (realtimeDuplicateStatus === 'duplicate') {
      setDuplicateError(`Vendor name "${vendorCompany.trim()}" already exists and is approved. Please use a different name.`);
      return;
    }
    
    if (isCheckingRealtime) {
      alert('Please wait while we check for duplicates...');
      return;
    }
    
    // Get current company data from allConnections
    const selectedCompanyGuid = sessionStorage.getItem('selectedCompanyGuid');
    if (!selectedCompanyGuid) {
      alert('Please select a company before inviting vendors');
      return;
    }

    let companies = [];
    try {
      companies = JSON.parse(sessionStorage.getItem('allConnections') || '[]');
    } catch (e) {
      console.error('Error parsing allConnections:', e);
    }

    const currentCompany = companies.find(c => c.guid === selectedCompanyGuid);
    if (!currentCompany) {
      alert('Please ensure you are connected to Tally before inviting vendors');
      return;
    }

    const { tallyloc_id: tallylocId, company, guid } = currentCompany;
    
    // Check for duplicate vendor name
    setIsCheckingDuplicate(true);
    setDuplicateError('');
    
    try {
      const sessionData = {
        tallyloc_id: tallylocId,
        company: company,
        guid: guid
      };
      
      const duplicateCheck = await checkVendorName(vendorCompany.trim(), sessionData);
      
      if (duplicateCheck.isDuplicate) {
        setDuplicateError(`Vendor name "${vendorCompany.trim()}" already exists and is approved. Please use a different name.`);
        setIsCheckingDuplicate(false);
        return;
      }
      
      if (!duplicateCheck.success) {
        setDuplicateError(`Failed to verify vendor name: ${duplicateCheck.message}`);
        setIsCheckingDuplicate(false);
        return;
      }
      
    } catch (error) {
      console.error('Error checking duplicate vendor name:', error);
      setDuplicateError(`Error checking vendor name: ${error.message}`);
      setIsCheckingDuplicate(false);
      return;
    }
    
    setIsCheckingDuplicate(false);
    
    // Generate unique token
    const token = generateInvitationToken();
    
    // Store invitation data with session info
    const invitationData = {
      token,
      company: vendorCompany.trim(),
      email: vendorEmail.trim(),
      tallyloc_id: tallylocId,
      company_session: company,
      guid: guid,
      createdAt: new Date().toISOString(),
      used: false
    };
    
    saveInvitation(invitationData);
    
    // Encode invitation data in the URL for cross-device access
    const encodedData = btoa(JSON.stringify({
      company: vendorCompany.trim(),
      email: vendorEmail.trim(),
      tallyloc_id: tallylocId,
      company_session: company,
      guid: guid,
      token: token
    }));
    
    // Generate the link with encoded data
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/vendor-form/${token}?data=${encodedData}`;
    
    setGeneratedLink(link);
    setShowLinkModal(true);
    
    // Reset form
    setVendorCompany('');
    setVendorEmail('');
    setShowInviteForm(false);
    setDuplicateError('');
  };
  
  // Copy link to clipboard
  const copyLinkToClipboard = () => {
    navigator.clipboard.writeText(generatedLink).then(() => {
      alert('Link copied to clipboard!');
    }).catch(() => {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = generatedLink;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      alert('Link copied to clipboard!');
    });
  };
  
  // Validate email
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Debounced real-time duplicate check
  const debouncedCheckDuplicate = (() => {
    let timeoutId;
    return (vendorName) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(async () => {
        if (!vendorName || vendorName.trim().length < 3) {
          setRealtimeDuplicateStatus(null);
          setIsCheckingRealtime(false);
          return;
        }

        setIsCheckingRealtime(true);
        setRealtimeDuplicateStatus('checking');

        try {
          const selectedCompanyGuid = sessionStorage.getItem('selectedCompanyGuid');
          if (!selectedCompanyGuid) {
            setRealtimeDuplicateStatus(null);
            setIsCheckingRealtime(false);
            return;
          }

          let companies = [];
          try {
            companies = JSON.parse(sessionStorage.getItem('allConnections') || '[]');
          } catch (e) {
            console.error('Error parsing allConnections:', e);
            setRealtimeDuplicateStatus(null);
            setIsCheckingRealtime(false);
            return;
          }

          const currentCompany = companies.find(c => c.guid === selectedCompanyGuid);
          if (!currentCompany) {
            setRealtimeDuplicateStatus(null);
            setIsCheckingRealtime(false);
            return;
          }

          const { tallyloc_id: tallylocId, company, guid } = currentCompany;
          const sessionData = {
            tallyloc_id: tallylocId,
            company: company,
            guid: guid
          };

          const duplicateCheck = await checkVendorName(vendorName.trim(), sessionData);
          
          if (duplicateCheck.isDuplicate) {
            setRealtimeDuplicateStatus('duplicate');
          } else if (duplicateCheck.success) {
            setRealtimeDuplicateStatus('available');
          } else {
            setRealtimeDuplicateStatus(null);
          }
        } catch (error) {
          console.error('Error in real-time duplicate check:', error);
          setRealtimeDuplicateStatus(null);
        } finally {
          setIsCheckingRealtime(false);
        }
      }, 500); // 500ms delay
    };
  })();

  // Handle vendor name change and clear duplicate error
  const handleVendorNameChange = (e) => {
    const value = e.target.value;
    setVendorCompany(value);
    
    // Clear form submission error
    if (duplicateError) {
      setDuplicateError('');
    }
    
    // Trigger real-time duplicate check
    debouncedCheckDuplicate(value);
  };

  // Listen for global refresh events
  useEffect(() => {
    const handleGlobalRefresh = () => {
      fetchVendors();
    };

    window.addEventListener('globalRefresh', handleGlobalRefresh);
    return () => window.removeEventListener('globalRefresh', handleGlobalRefresh);
  }, []);

  // Filter vendors based on search term and status
  const filteredVendors = vendors.filter(vendor => {
    const matchesSearch = vendor.NAME?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         vendor.EMAIL?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         vendor.PANNO?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         vendor.GSTNO?.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Note: The ledgerlist-w-addrs API doesn't have status field
    // For now, show all vendors regardless of filterStatus
    // If you need status filtering, you'll need to add it to the API response
    const matchesStatus = filterStatus === 'all' || 
                         (filterStatus === 'active' && vendor.status === 'approved') ||
                         (filterStatus === 'pending' && vendor.status === 'pending') ||
                         (filterStatus === 'rejected' && vendor.status === 'rejected');
    
    return matchesSearch && (filterStatus === 'all' || matchesStatus);
  });


  // Render vendor list
  const renderVendorList = () => (
    <div style={{ padding: '24px' }}>
      {/* Header with search and filters */}
      <div className="vendor-header-container" style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '24px',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <h2 style={{ 
            fontSize: '24px', 
            fontWeight: '600', 
            color: '#1f2937', 
            margin: '0',
            fontFamily: 'system-ui, -apple-system, sans-serif'
          }}>
            Vendor Management
          </h2>
          <p style={{ 
            fontSize: '14px', 
            color: '#6b7280', 
            margin: '4px 0 0 0',
            fontFamily: 'system-ui, -apple-system, sans-serif'
          }}>
            Manage your vendor database and authorizations
          </p>
        </div>
        
        <button
          onClick={() => setShowInviteForm(!showInviteForm)}
          style={{
            padding: '10px 20px',
            backgroundColor: '#3b82f6',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
          }}
          onMouseEnter={(e) => e.target.style.backgroundColor = '#2563eb'}
          onMouseLeave={(e) => e.target.style.backgroundColor = '#3b82f6'}
        >
          <span className="material-icons" style={{ fontSize: '18px' }}>person_add</span>
          {showInviteForm ? 'Hide' : 'Invite'} Vendor
        </button>
      </div>
      
      {/* Invite Vendor Form */}
      {showInviteForm && (
        <div style={{
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          padding: '24px',
          marginBottom: '24px',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)'
        }}>
          <h3 style={{ 
            fontSize: '18px', 
            fontWeight: '600', 
            color: '#1f2937', 
            marginBottom: '16px',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span className="material-icons" style={{ fontSize: '20px', color: '#3b82f6' }}>mail</span>
            Send Vendor Invitation
          </h3>
          
          <div style={{ display: 'flex', gap: '64px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <div style={{ flex: '1', minWidth: '200px', maxWidth: '300px' }}>
              <label style={{ 
                display: 'block', 
                fontSize: '14px', 
                fontWeight: '500', 
                color: '#374151', 
                marginBottom: '6px',
                fontFamily: 'system-ui, -apple-system, sans-serif'
              }}>
                Vendor Name *
              </label>
              <input
                type="text"
                value={vendorCompany}
                onChange={handleVendorNameChange}
                placeholder="Enter vendor name"
                style={{
                  width: '100%',
                  padding: '10px 16px',
                  border: realtimeDuplicateStatus === 'duplicate' ? '1px solid #ef4444' : 
                         realtimeDuplicateStatus === 'available' ? '1px solid #10b981' : '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  outline: 'none',
                  transition: 'all 0.2s'
                }}
              />
              
              {/* Real-time duplicate status indicator */}
              {vendorCompany.trim().length >= 3 && (
                <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {isCheckingRealtime ? (
                    <>
                      <div style={{
                        width: '12px',
                        height: '12px',
                        border: '2px solid #6b7280',
                        borderTop: '2px solid transparent',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                      }}></div>
                      <span style={{ fontSize: '12px', color: '#6b7280', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                        Checking...
                      </span>
                    </>
                  ) : realtimeDuplicateStatus === 'duplicate' ? (
                    <>
                      <span className="material-icons" style={{ fontSize: '16px', color: '#ef4444' }}>error</span>
                      <span style={{ fontSize: '12px', color: '#ef4444', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                        Name already exists
                      </span>
                    </>
                  ) : realtimeDuplicateStatus === 'available' ? (
                    <>
                      <span className="material-icons" style={{ fontSize: '16px', color: '#10b981' }}>check_circle</span>
                      <span style={{ fontSize: '12px', color: '#10b981', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                        Name available
                      </span>
                    </>
                  ) : null}
                </div>
              )}
            </div>
            
            <div style={{ flex: '1', minWidth: '200px', maxWidth: '300px' }}>
              <label style={{ 
                display: 'block', 
                fontSize: '14px', 
                fontWeight: '500', 
                color: '#374151', 
                marginBottom: '6px',
                fontFamily: 'system-ui, -apple-system, sans-serif'
              }}>
                Email Address *
              </label>
              <input
                type="email"
                value={vendorEmail}
                onChange={(e) => setVendorEmail(e.target.value)}
                placeholder="Enter email address"
                style={{
                  width: '100%',
                  padding: '10px 16px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  outline: 'none',
                  transition: 'all 0.2s'
                }}
              />
            </div>
          </div>
          
          {/* Duplicate Error Display */}
          {duplicateError && (
            <div style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '6px',
              padding: '12px 16px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span className="material-icons" style={{ fontSize: '18px', color: '#ef4444' }}>error</span>
              <span style={{ 
                fontSize: '14px', 
                color: '#dc2626',
                fontFamily: 'system-ui, -apple-system, sans-serif'
              }}>
                {duplicateError}
              </span>
            </div>
          )}
          
          <button
            onClick={handleInviteVendor}
            disabled={isCheckingDuplicate || isCheckingRealtime || realtimeDuplicateStatus === 'duplicate'}
            style={{
              padding: '10px 24px',
              backgroundColor: (isCheckingDuplicate || isCheckingRealtime || realtimeDuplicateStatus === 'duplicate') ? '#9ca3af' : '#10b981',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: (isCheckingDuplicate || isCheckingRealtime || realtimeDuplicateStatus === 'duplicate') ? 'not-allowed' : 'pointer',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              opacity: (isCheckingDuplicate || isCheckingRealtime || realtimeDuplicateStatus === 'duplicate') ? 0.7 : 1
            }}
            onMouseEnter={(e) => {
              if (!isCheckingDuplicate && !isCheckingRealtime && realtimeDuplicateStatus !== 'duplicate') {
                e.target.style.backgroundColor = '#059669';
              }
            }}
            onMouseLeave={(e) => {
              if (!isCheckingDuplicate && !isCheckingRealtime && realtimeDuplicateStatus !== 'duplicate') {
                e.target.style.backgroundColor = '#10b981';
              }
            }}
          >
            {isCheckingDuplicate ? (
              <>
                <div style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid #fff',
                  borderTop: '2px solid transparent',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }}></div>
                Checking for duplicates...
              </>
            ) : isCheckingRealtime ? (
              <>
                <div style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid #fff',
                  borderTop: '2px solid transparent',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }}></div>
                Verifying name...
              </>
            ) : realtimeDuplicateStatus === 'duplicate' ? (
              <>
                <span className="material-icons" style={{ fontSize: '18px' }}>error</span>
                Name Already Exists
              </>
            ) : (
              <>
                <span className="material-icons" style={{ fontSize: '18px' }}>send</span>
                Generate & Send Link
              </>
            )}
          </button>
        </div>
      )}

      {/* Search and Filter Controls */}
      <div className="search-filter-container" style={{ 
        display: 'flex', 
        gap: '16px', 
        marginBottom: '24px',
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>
        <div style={{ 
          width: '100%', 
          maxWidth: '600px',
          minWidth: '250px'
        }}>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Search vendors by name, email, PAN, or GST..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 16px 10px 40px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                outline: 'none',
                transition: 'all 0.2s',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#3b82f6';
                e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#d1d5db';
                e.target.style.boxShadow = 'none';
              }}
            />
            <span 
              className="material-icons" 
              style={{ 
                position: 'absolute', 
                left: '12px', 
                top: '50%', 
                transform: 'translateY(-50%)', 
                color: '#9ca3af',
                fontSize: '18px'
              }}
            >
              search
            </span>
          </div>
        </div>
        
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{
            padding: '12px 16px',
            border: '1px solid #d1d5db',
            borderRadius: '8px',
            fontSize: '14px',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            backgroundColor: '#fff',
            cursor: 'pointer',
            outline: 'none',
            marginLeft: 'auto'
          }}
        >
          <option value="all">All Vendors</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* Vendor List */}
      {loading ? (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          padding: '60px 0',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid #e5e7eb',
            borderTop: '4px solid #3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
          <p style={{ 
            color: '#6b7280', 
            fontSize: '14px',
            fontFamily: 'system-ui, -apple-system, sans-serif'
          }}>
            Loading vendors...
          </p>
        </div>
      ) : error ? (
        <div style={{
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '8px',
          padding: '24px',
          textAlign: 'center'
        }}>
          <span className="material-icons" style={{ fontSize: '48px', color: '#ef4444', marginBottom: '16px' }}>
            error
          </span>
          <h3 style={{ 
            color: '#dc2626', 
            fontSize: '18px', 
            fontWeight: '600', 
            margin: '0 0 8px 0',
            fontFamily: 'system-ui, -apple-system, sans-serif'
          }}>
            Error Loading Vendors
          </h3>
          <p style={{ 
            color: '#7f1d1d', 
            fontSize: '14px', 
            margin: '0 0 16px 0',
            fontFamily: 'system-ui, -apple-system, sans-serif'
          }}>
            {error}
          </p>
          <button
            onClick={fetchVendors}
            style={{
              padding: '8px 16px',
              backgroundColor: '#ef4444',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              fontFamily: 'system-ui, -apple-system, sans-serif'
            }}
          >
            Retry
          </button>
        </div>
      ) : filteredVendors.length === 0 ? (
        <div style={{
          background: '#f9fafb',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          padding: '48px 24px',
          textAlign: 'center'
        }}>
          <span className="material-icons" style={{ fontSize: '48px', color: '#9ca3af', marginBottom: '16px' }}>
            {searchTerm || filterStatus !== 'all' ? 'search_off' : 'people'}
          </span>
          <h3 style={{ 
            color: '#374151', 
            fontSize: '18px', 
            fontWeight: '600', 
            margin: '0 0 8px 0',
            fontFamily: 'system-ui, -apple-system, sans-serif'
          }}>
            {searchTerm || filterStatus !== 'all' ? 'No vendors found' : 'No vendors available'}
          </h3>
          <p style={{ 
            color: '#6b7280', 
            fontSize: '14px', 
            margin: '0 0 16px 0',
            fontFamily: 'system-ui, -apple-system, sans-serif'
          }}>
            {searchTerm || filterStatus !== 'all' 
              ? 'Try adjusting your search criteria or filters' 
              : 'Get started by adding your first vendor'
            }
          </p>
        </div>
      ) : (
        <div style={{
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          overflow: 'hidden'
        }}>
          {filteredVendors.map((vendor, index) => (
            <div
              key={vendor.NAME || index}
              style={{
                padding: '20px',
                borderBottom: index < filteredVendors.length - 1 ? '1px solid #f3f4f6' : 'none',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#f9fafb'}
              onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
            >
              <div style={{ flex: '1' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <h3 style={{ 
                    fontSize: '16px', 
                    fontWeight: '600', 
                    color: '#1f2937', 
                    margin: '0',
                    fontFamily: 'system-ui, -apple-system, sans-serif'
                  }}>
                    {vendor.NAME || 'Unnamed Vendor'}
                  </h3>
                  {vendor.status && (
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: '500',
                      fontFamily: 'system-ui, -apple-system, sans-serif',
                      backgroundColor: vendor.status === 'approved' ? '#dcfce7' : 
                                     vendor.status === 'pending' ? '#fef3c7' : '#fecaca',
                      color: vendor.status === 'approved' ? '#166534' : 
                             vendor.status === 'pending' ? '#92400e' : '#991b1b'
                    }}>
                      {vendor.status}
                    </span>
                  )}
                </div>
                
                <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                  {vendor.EMAIL && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="material-icons" style={{ fontSize: '16px', color: '#6b7280' }}>email</span>
                      <span style={{ fontSize: '14px', color: '#6b7280', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                        {vendor.EMAIL}
                      </span>
                    </div>
                  )}
                  {vendor.PANNO && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="material-icons" style={{ fontSize: '16px', color: '#6b7280' }}>badge</span>
                      <span style={{ fontSize: '14px', color: '#6b7280', fontFamily: 'monospace' }}>
                        {vendor.PANNO}
                      </span>
                    </div>
                  )}
                  {vendor.GSTNO && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="material-icons" style={{ fontSize: '16px', color: '#6b7280' }}>receipt</span>
                      <span style={{ fontSize: '14px', color: '#6b7280', fontFamily: 'monospace' }}>
                        {vendor.GSTNO}
                      </span>
                    </div>
                  )}
                  {vendor.ADDRESS && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="material-icons" style={{ fontSize: '16px', color: '#6b7280' }}>location_on</span>
                      <span style={{ fontSize: '14px', color: '#6b7280', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                        {vendor.ADDRESS}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div style={{
      background: '#f3f4f6',
      width: '100vw',
      minHeight: 'calc(100vh - 120px)',
      padding: 0,
      margin: 0,
      paddingLeft: 'clamp(60px, 220px, 220px)',
    }}>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .vendor-header-container {
          flex-direction: column;
        }
        
        @media (min-width: 768px) {
          .vendor-header-container {
            flex-direction: row;
          }
        }
        
        .search-filter-container {
          flex-direction: column;
          width: 100%;
        }
        
        @media (min-width: 768px) {
          .search-filter-container {
            flex-direction: row;
          }
        }
      `}</style>
      
      <div style={{
        background: '#fff',
        margin: 'clamp(12px, 24px, 24px) clamp(16px, 32px, 32px) 16px clamp(16px, 32px, 32px)',
        maxWidth: '1400px',
        width: 'calc(100% - clamp(32px, 64px, 64px))',
        borderRadius: '16px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        overflow: 'hidden',
        border: '1px solid #e5e7eb',
        position: 'relative',
        boxSizing: 'border-box'
      }}>
        {/* Content */}
        <div style={{ minHeight: '500px' }}>
          {renderVendorList()}
        </div>
      </div>
      
      {/* Link Modal */}
      {showLinkModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}
        onClick={() => setShowLinkModal(false)}
        >
          <div style={{
            background: '#fff',
            borderRadius: '12px',
            padding: '32px',
            maxWidth: '600px',
            width: '100%',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            zIndex: 10000
          }}
          onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
              <h3 style={{ 
                fontSize: '20px', 
                fontWeight: '600', 
                color: '#1f2937', 
                margin: 0,
                fontFamily: 'system-ui, -apple-system, sans-serif',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span className="material-icons" style={{ fontSize: '24px', color: '#10b981' }}>check_circle</span>
                Vendor Invitation Link Generated!
              </h3>
              <button
                onClick={() => setShowLinkModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  color: '#6b7280'
                }}
              >
                <span className="material-icons">close</span>
              </button>
            </div>
            
            <p style={{ 
              fontSize: '14px', 
              color: '#6b7280', 
              marginBottom: '20px',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              lineHeight: '1.5'
            }}>
              Share this link with your vendor to allow them to fill out the vendor registration form.
            </p>
            
            <div style={{
              background: '#f9fafb',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '12px 16px',
              marginBottom: '20px',
              position: 'relative',
              wordBreak: 'break-all'
            }}>
              <input
                type="text"
                value={generatedLink}
                readOnly
                style={{
                  width: '100%',
                  border: 'none',
                  background: 'transparent',
                  fontSize: '14px',
                  fontFamily: 'monospace',
                  color: '#1f2937',
                  outline: 'none'
                }}
                onClick={(e) => e.target.select()}
              />
            </div>
            
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowLinkModal(false)}
                style={{
                  padding: '10px 20px',
                  background: '#f3f4f6',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  color: '#374151',
                  fontFamily: 'system-ui, -apple-system, sans-serif'
                }}
              >
                Close
              </button>
              <button
                onClick={copyLinkToClipboard}
                style={{
                  padding: '10px 20px',
                  background: '#3b82f6',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <span className="material-icons" style={{ fontSize: '18px' }}>content_copy</span>
                Copy Link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VendorManagement;
