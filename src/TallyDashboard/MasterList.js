import React, { useState, useEffect } from 'react';
import { getApiUrl, API_CONFIG } from '../config';
import { apiPost } from '../utils/apiUtils';
import MasterForm from './MasterForm';
import { useIsMobile } from './MobileViewConfig';

const MasterList = () => {
  const isMobile = useIsMobile();
  const [masters, setMasters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedMaster, setSelectedMaster] = useState(null);
  const [showMasterForm, setShowMasterForm] = useState(false);

  // Check if a master name already exists in the ledger
  const checkMasterName = async (masterName, sessionData) => {
    try {
      console.log('🔍 Checking master name:', masterName);
      
      if (!masterName || masterName.trim() === '') {
        throw new Error('Master name is required');
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
        value: masterName.trim()
      };

      console.log('🔍 Master Name Check Data:', checkData);

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
        
        console.error('Master Name Check API Error:', {
          status: response.status,
          statusText: response.statusText,
          errorData: errorData,
          requestData: checkData
        });
        throw new Error(errorData.message || `Failed to check master name: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('🔍 Master Name Check Result:', result);
      
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
      console.error('Error checking master name:', error);
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
  
  // Invite master state
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [masterCompany, setMasterCompany] = useState('');
  const [masterEmail, setMasterEmail] = useState('');
  const [generatedLink, setGeneratedLink] = useState('');
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);
  const [duplicateError, setDuplicateError] = useState('');
  const [isCheckingRealtime, setIsCheckingRealtime] = useState(false);
  const [realtimeDuplicateStatus, setRealtimeDuplicateStatus] = useState(null); // null, 'checking', 'duplicate', 'available'

  // Fetch masters from API (using same endpoint as PlaceOrder customer list)
  const fetchMasters = async () => {
    const selectedCompanyGuid = sessionStorage.getItem('selectedCompanyGuid');
    
    if (!selectedCompanyGuid) {
      setMasters([]);
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
    const selectedCompanyTallylocId = sessionStorage.getItem('selectedCompanyTallylocId');
    // Match by both guid and tallyloc_id to handle companies with same guid but different tallyloc_id
    const currentCompany = companies.find(c => 
      c.guid === selectedCompanyGuid && 
      (selectedCompanyTallylocId ? String(c.tallyloc_id) === String(selectedCompanyTallylocId) : true)
    );
    if (!currentCompany) {
      setMasters([]);
      setError('Company not found');
      setLoading(false);
      return;
    }

    const { tallyloc_id, company, guid } = currentCompany;
    const cacheKey = `ledgerlist-w-addrs_${tallyloc_id}_${company}`;

    // Set loading state and fetch data
    setLoading(true);
    setError(null);
    setMasters([]); // Clear previous data while loading

    try {
      const token = sessionStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      // Fetch regular masters from ledgerlist-w-addrs
      const data = await apiPost(`/api/tally/ledgerlist-w-addrs?ts=${Date.now()}`, {
        tallyloc_id,
        company,
        guid
      });

      let regularMasters = [];
      if (data && data.ledgers && Array.isArray(data.ledgers)) {
        regularMasters = data.ledgers.map(master => ({
          ...master,
          status: master.status || 'approved' // Default to approved for existing masters
        }));
      } else if (data && data.error) {
        console.warn('Error fetching regular masters:', data.error);
      }

      // Fetch masters from ledger-list endpoint (same as MasterAuthorization)
      // Get session data directly from sessionStorage for localStorage matching (same as MasterAuthorization)
      const sessionTallylocId = sessionStorage.getItem('tallyloc_id');
      const sessionCompanyName = sessionStorage.getItem('company');
      const sessionGuid = sessionStorage.getItem('guid');
      
      let ledgerListMasters = [];
      try {
        // Use ledger-list endpoint to get master list (same as MasterAuthorization)
        const ledgerListResponse = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.TALLY_LEDGER_LIST), {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            tallyloc_id: parseInt(tallyloc_id),
            company: company,
            guid: guid
          })
        });

        if (ledgerListResponse.ok) {
          const ledgerListResult = await ledgerListResponse.json();
          console.log('📊 Ledger-list masters fetched successfully:', ledgerListResult);
          
          // Transform API response to master format (same as MasterAuthorization)
          // Get ALL masters, not just pending ones
          if (ledgerListResult.data && Array.isArray(ledgerListResult.data)) {
            ledgerListMasters = ledgerListResult.data;
          } else if (ledgerListResult.ledgers && Array.isArray(ledgerListResult.ledgers)) {
            ledgerListMasters = ledgerListResult.ledgers;
          } else if (Array.isArray(ledgerListResult)) {
            ledgerListMasters = ledgerListResult;
          } else if (ledgerListResult.ledgerData && Array.isArray(ledgerListResult.ledgerData)) {
            ledgerListMasters = ledgerListResult.ledgerData;
          }

          console.log('📊 Total masters from ledger-list:', ledgerListMasters.length);
        } else {
          const errorData = await ledgerListResponse.json().catch(() => ({}));
          console.warn('Failed to fetch from ledger-list:', ledgerListResponse.status, errorData);
        }
      } catch (ledgerListErr) {
        console.warn('Error fetching from ledger-list:', ledgerListErr);
        // Don't fail the entire fetch if this fails
      }

      // Load master submissions from localStorage (same as MasterAuthorization)
      // Use sessionStorage values for matching (same as MasterAuthorization)
      if (sessionTallylocId && sessionGuid) {
        try {
          const submissions = localStorage.getItem('master_submissions');
          if (submissions) {
            const submissionList = JSON.parse(submissions);
            console.log('📝 Master submissions from localStorage:', submissionList);
            
            // Add submissions that match current session (same logic as MasterAuthorization)
            submissionList.forEach(submission => {
              // Use strict equality matching with sessionStorage values (same as MasterAuthorization)
              if (submission.tallyloc_id === sessionTallylocId && 
                  submission.guid === sessionGuid &&
                  submission.status === 'pending') {
                console.log('📝 Adding submission master:', submission.name || submission.company);
                // Add to ledgerListMasters so it gets included in the merge
                ledgerListMasters.push({
                  ...submission,
                  name: submission.name || submission.company,
                  NAME: submission.name || submission.company || '',
                  EMAIL: submission.email || submission.emailid || '',
                  PANNO: submission.panNumber || submission.panno || submission.pan_no || '',
                  GSTNO: submission.gstNumber || submission.gstno || submission.gstin_no || submission.gstinNo || '',
                  ADDRESS: submission.address || submission.address1 || submission.address_1 || '',
                  status: 'pending',
                  isSubmission: true // Flag to identify localStorage submissions
                });
              }
            });
          }
        } catch (err) {
          console.error('Error loading master submissions from localStorage:', err);
        }
      }

      // Transform ledger-list masters to match master format (same as MasterAuthorization)
      // Include ALL masters from ledger-list, not just pending ones
      const transformedLedgerListMasters = ledgerListMasters.map(master => {
        // Get status from master data (same as MasterAuthorization)
        const masterStatus = master.status || master.STATUS || master.authorizationStatus || 'pending';
        
        return {
          ...master,
          NAME: master.name || master.NAME || master.company || master.ledger_name || '',
          EMAIL: master.email || master.EMAIL || master.emailid || master.email_id || '',
          PANNO: master.panno || master.PANNO || master.panNumber || master.pan_no || '',
          GSTNO: master.gstno || master.GSTNO || master.gstNumber || master.gstin_no || master.gstinNo || '',
          ADDRESS: master.address || master.ADDRESS || master.address1 || master.address_1 || '',
          status: masterStatus.toLowerCase() === 'pending' ? 'pending' : 
                 masterStatus.toLowerCase() === 'approved' ? 'approved' : 
                 masterStatus.toLowerCase() === 'rejected' ? 'rejected' : 'pending'
        };
      });

      console.log('📊 Transformed ledger-list masters:', transformedLedgerListMasters.length);
      const pendingCount = transformedLedgerListMasters.filter(v => v.status === 'pending').length;
      console.log('📋 Pending masters from ledger-list:', pendingCount);

      // Merge masters: combine regular masters with ledger-list masters
      // Use a Map to avoid duplicates based on master name
      const masterMap = new Map();
      
      // Add regular masters first
      regularMasters.forEach(master => {
        const key = (master.NAME || '').toLowerCase().trim();
        if (key) {
          masterMap.set(key, master);
        }
      });
      
      // Add/update with ledger-list masters (ledger-list status takes precedence for duplicates)
      transformedLedgerListMasters.forEach(master => {
        const key = (master.NAME || '').toLowerCase().trim();
        if (key) {
          // If master already exists, update it with ledger-list data (which has correct status)
          if (masterMap.has(key)) {
            masterMap.set(key, { ...masterMap.get(key), ...master });
          } else {
            masterMap.set(key, master);
          }
        }
      });

      // Convert map back to array and sort alphabetically by name
      const allMasters = Array.from(masterMap.values()).sort((a, b) => {
        const nameA = (a.NAME || '').toLowerCase().trim();
        const nameB = (b.NAME || '').toLowerCase().trim();
        return nameA.localeCompare(nameB);
      });

      // Debug: Log master statuses
      const statusCounts = allMasters.reduce((acc, master) => {
        const status = master.status || 'no-status';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {});
      console.log('📊 Master status breakdown:', statusCounts);
      console.log('📊 Total masters:', allMasters.length);
      console.log('📊 Pending masters in list:', allMasters.filter(v => (v.status || '').toLowerCase() === 'pending').length);

      setMasters(allMasters);
      setError(null);
      
      // Cache the result (excluding pending masters as they may change)
      const cacheableMasters = regularMasters;
      sessionStorage.setItem(cacheKey, JSON.stringify(cacheableMasters));
      
      console.log(`✅ Loaded ${allMasters.length} masters (${regularMasters.length} regular, ${transformedLedgerListMasters.length} from ledger-list, ${pendingCount} pending)`);
    } catch (err) {
      console.error('Error fetching masters:', err);
      setError('Failed to fetch masters');
      setMasters([]);
    } finally {
      setLoading(false);
    }
  };

  // Load masters on component mount
  useEffect(() => {
    fetchMasters();
  }, []);

  // Listen for company changes from top bar
  useEffect(() => {
    const handleCompanyChange = () => {
      // Company changed from top bar, refresh masters
      fetchMasters();
    };

    window.addEventListener('companyChanged', handleCompanyChange);
    return () => window.removeEventListener('companyChanged', handleCompanyChange);
  }, []);
  
  
  // Save invitation to localStorage
  const saveInvitation = (invitation) => {
    try {
      const savedInvitations = localStorage.getItem('master_invitations') || '[]';
      const invitations = JSON.parse(savedInvitations);
      invitations.push(invitation);
      localStorage.setItem('master_invitations', JSON.stringify(invitations));
    } catch (err) {
      console.error('Error saving invitation:', err);
    }
  };
  
  // Generate unique token for master invitation
  const generateInvitationToken = () => {
    return 'master_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  };
  
  // Handle invite master
  const handleInviteMaster = async () => {
    if (!masterCompany.trim() || !masterEmail.trim()) {
      alert('Please enter both master name and email');
      return;
    }
    
    if (!validateEmail(masterEmail)) {
      alert('Please enter a valid email address');
      return;
    }
    
    // Check for real-time duplicate status first
    if (realtimeDuplicateStatus === 'duplicate') {
      setDuplicateError(`Master name "${masterCompany.trim()}" already exists and is approved. Please use a different name.`);
      return;
    }
    
    if (isCheckingRealtime) {
      alert('Please wait while we check for duplicates...');
      return;
    }
    
    // Get current company data from allConnections
    const selectedCompanyGuid = sessionStorage.getItem('selectedCompanyGuid');
    if (!selectedCompanyGuid) {
      alert('Please select a company before inviting masters');
      return;
    }

    let companies = [];
    try {
      companies = JSON.parse(sessionStorage.getItem('allConnections') || '[]');
    } catch (e) {
      console.error('Error parsing allConnections:', e);
    }

    const selectedCompanyTallylocId = sessionStorage.getItem('selectedCompanyTallylocId');
    // Match by both guid and tallyloc_id to handle companies with same guid but different tallyloc_id
    const currentCompany = companies.find(c => 
      c.guid === selectedCompanyGuid && 
      (selectedCompanyTallylocId ? String(c.tallyloc_id) === String(selectedCompanyTallylocId) : true)
    );
    if (!currentCompany) {
      alert('Please ensure you are connected to Tally before inviting masters');
      return;
    }

    const { tallyloc_id: tallylocId, company, guid } = currentCompany;
    
    // Check for duplicate master name
    setIsCheckingDuplicate(true);
    setDuplicateError('');
    
    try {
      const sessionData = {
        tallyloc_id: tallylocId,
        company: company,
        guid: guid
      };
      
      const duplicateCheck = await checkMasterName(masterCompany.trim(), sessionData);
      
      if (duplicateCheck.isDuplicate) {
        setDuplicateError(`Master name "${masterCompany.trim()}" already exists and is approved. Please use a different name.`);
        setIsCheckingDuplicate(false);
        return;
      }
      
      if (!duplicateCheck.success) {
        setDuplicateError(`Failed to verify master name: ${duplicateCheck.message}`);
        setIsCheckingDuplicate(false);
        return;
      }
      
    } catch (error) {
      console.error('Error checking duplicate master name:', error);
      setDuplicateError(`Error checking master name: ${error.message}`);
      setIsCheckingDuplicate(false);
      return;
    }
    
    setIsCheckingDuplicate(false);
    
    // Generate unique token
    const token = generateInvitationToken();
    
    // Store invitation data with session info
    const invitationData = {
      token,
      company: masterCompany.trim(),
      email: masterEmail.trim(),
      tallyloc_id: tallylocId,
      company_session: company,
      guid: guid,
      createdAt: new Date().toISOString(),
      used: false
    };
    
    saveInvitation(invitationData);
    
    // Encode invitation data in the URL for cross-device access
    const encodedData = btoa(JSON.stringify({
      company: masterCompany.trim(),
      email: masterEmail.trim(),
      tallyloc_id: tallylocId,
      company_session: company,
      guid: guid,
      token: token
    }));
    
    // Generate the link with encoded data
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/master-form/${token}?data=${encodedData}`;
    
    setGeneratedLink(link);
    setShowLinkModal(true);
    
    // Reset form
    setMasterCompany('');
    setMasterEmail('');
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
    return (masterName) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(async () => {
        if (!masterName || masterName.trim().length < 3) {
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

          const selectedCompanyTallylocId = sessionStorage.getItem('selectedCompanyTallylocId');
    // Match by both guid and tallyloc_id to handle companies with same guid but different tallyloc_id
    const currentCompany = companies.find(c => 
      c.guid === selectedCompanyGuid && 
      (selectedCompanyTallylocId ? String(c.tallyloc_id) === String(selectedCompanyTallylocId) : true)
    );
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

          const duplicateCheck = await checkMasterName(masterName.trim(), sessionData);
          
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

  // Handle master name change and clear duplicate error
  const handleMasterNameChange = (e) => {
    const value = e.target.value;
    setMasterCompany(value);
    
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
      fetchMasters();
    };

    window.addEventListener('globalRefresh', handleGlobalRefresh);
    return () => window.removeEventListener('globalRefresh', handleGlobalRefresh);
  }, []);

  // Filter masters based on search term and status
  const filteredMasters = masters.filter(master => {
    const matchesSearch = master.NAME?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         master.EMAIL?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         master.PANNO?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         master.GSTNO?.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Get master status (case-insensitive comparison)
    const masterStatus = (master.status || '').toLowerCase();
    const matchesStatus = filterStatus === 'all' || 
                         (filterStatus === 'active' && (masterStatus === 'approved' || masterStatus === '')) ||
                         (filterStatus === 'pending' && masterStatus === 'pending') ||
                         (filterStatus === 'rejected' && masterStatus === 'rejected');
    
    // Debug logging for pending filter
    if (filterStatus === 'pending') {
      console.log('🔍 Filtering master:', master.NAME, 'Status:', master.status, 'Matches:', matchesStatus);
    }
    
    return matchesSearch && (filterStatus === 'all' || matchesStatus);
  });


  // Render master list
  const renderMasterList = () => (
    <>
      {/* Invite Master Form */}
      {showInviteForm && (
        <div style={{
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          padding: isMobile ? '16px' : '24px',
          marginBottom: isMobile ? '16px' : '24px',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)'
        }}>
          <h3 style={{ 
            fontSize: isMobile ? '16px' : '18px', 
            fontWeight: '600', 
            color: '#1f2937', 
            marginBottom: isMobile ? '12px' : '16px',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span className="material-icons" style={{ fontSize: isMobile ? '18px' : '20px', color: '#3b82f6' }}>mail</span>
            Send Master Invitation
          </h3>
          
          <div style={{ 
            display: 'flex', 
            flexDirection: isMobile ? 'column' : 'row',
            gap: isMobile ? '16px' : '64px', 
            marginBottom: '16px', 
            flexWrap: 'wrap' 
          }}>
            <div style={{ flex: '1', minWidth: isMobile ? '100%' : '200px', maxWidth: isMobile ? '100%' : '300px' }}>
              <label style={{ 
                display: 'block', 
                fontSize: '14px', 
                fontWeight: '500', 
                color: '#374151', 
                marginBottom: '6px',
                fontFamily: 'system-ui, -apple-system, sans-serif'
              }}>
                Master Name *
              </label>
              <input
                type="text"
                value={masterCompany}
                onChange={handleMasterNameChange}
                placeholder="Enter master name"
                style={{
                  width: '100%',
                  padding: isMobile ? '12px 16px' : '10px 16px',
                  border: realtimeDuplicateStatus === 'duplicate' ? '1px solid #ef4444' : 
                         realtimeDuplicateStatus === 'available' ? '1px solid #10b981' : '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: isMobile ? '16px' : '14px',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  outline: 'none',
                  transition: 'all 0.2s',
                  minHeight: isMobile ? '44px' : 'auto',
                  boxSizing: 'border-box'
                }}
              />
              
              {/* Real-time duplicate status indicator */}
              {masterCompany.trim().length >= 3 && (
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
            
            <div style={{ flex: '1', minWidth: isMobile ? '100%' : '200px', maxWidth: isMobile ? '100%' : '300px' }}>
              <label style={{ 
                display: 'block', 
                fontSize: isMobile ? '13px' : '14px', 
                fontWeight: '500', 
                color: '#374151', 
                marginBottom: '6px',
                fontFamily: 'system-ui, -apple-system, sans-serif'
              }}>
                Email Address *
              </label>
              <input
                type="email"
                value={masterEmail}
                onChange={(e) => setMasterEmail(e.target.value)}
                placeholder="Enter email address"
                style={{
                  width: '100%',
                  padding: isMobile ? '12px 16px' : '10px 16px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: isMobile ? '16px' : '14px',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  outline: 'none',
                  transition: 'all 0.2s',
                  minHeight: isMobile ? '44px' : 'auto',
                  boxSizing: 'border-box'
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
            onClick={handleInviteMaster}
            disabled={isCheckingDuplicate || isCheckingRealtime || realtimeDuplicateStatus === 'duplicate'}
            style={{
              padding: isMobile ? '12px 20px' : '10px 24px',
              backgroundColor: (isCheckingDuplicate || isCheckingRealtime || realtimeDuplicateStatus === 'duplicate') ? '#9ca3af' : '#10b981',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontSize: isMobile ? '14px' : '14px',
              fontWeight: '500',
              cursor: (isCheckingDuplicate || isCheckingRealtime || realtimeDuplicateStatus === 'duplicate') ? 'not-allowed' : 'pointer',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              opacity: (isCheckingDuplicate || isCheckingRealtime || realtimeDuplicateStatus === 'duplicate') ? 0.7 : 1,
              width: isMobile ? '100%' : 'auto',
              minHeight: isMobile ? '44px' : 'auto',
              boxSizing: 'border-box'
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

      {/* Master List */}
      <div className="master-list-master-list">
        {/* Search Bar */}
        <div className="master-list-search-bar">
          <div style={{ position: 'relative', marginBottom: isMobile ? '10px' : '12px' }}>
            <span className="material-icons" style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#9ca3af',
              fontSize: isMobile ? '18px' : '20px',
              zIndex: 1
            }}>
              search
            </span>
            <input
              type="text"
              placeholder={isMobile ? "Search masters..." : "Search masters by name, email, PAN, or GST..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: isMobile ? '12px 12px 12px 40px' : '12px 12px 12px 44px',
                border: '2px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: isMobile ? '16px' : '14px',
                fontWeight: '500',
                transition: 'all 0.2s ease',
                background: 'white',
                minHeight: isMobile ? '44px' : 'auto',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#3b82f6';
                e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e5e7eb';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{
              width: '100%',
              padding: isMobile ? '12px 16px' : '12px 16px',
              border: '2px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: isMobile ? '16px' : '14px',
              fontWeight: '500',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              backgroundColor: 'white',
              cursor: 'pointer',
              outline: 'none',
              transition: 'all 0.2s ease',
              minHeight: isMobile ? '44px' : 'auto',
              boxSizing: 'border-box',
              WebkitAppearance: 'none',
              MozAppearance: 'none',
              appearance: 'none',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236b7280' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 12px center',
              paddingRight: '40px'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#3b82f6';
              e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = '#e5e7eb';
              e.target.style.boxShadow = 'none';
            }}
          >
            <option value="all">All Masters</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        
        {/* List Content */}
        <div className="master-list-list-content">
          {loading ? (
            <div className="master-list-no-masters">
              <div style={{
                width: isMobile ? '56px' : '64px',
                height: isMobile ? '56px' : '64px',
                background: '#f3f4f6',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                fontSize: isMobile ? '28px' : '32px',
                color: '#9ca3af'
              }}>
                <span className="material-icons">
                  {searchTerm || filterStatus !== 'all' ? 'search_off' : 'people'}
                </span>
              </div>
              <h3 style={{ 
                color: '#374151', 
                fontSize: isMobile ? '16px' : '18px', 
                fontWeight: '600', 
                margin: '0 0 8px 0',
                fontFamily: 'system-ui, -apple-system, sans-serif'
              }}>
                {searchTerm || filterStatus !== 'all' ? 'No masters found' : 'No masters available'}
              </h3>
              <p style={{ 
                color: '#6b7280', 
                fontSize: isMobile ? '13px' : '14px', 
                margin: '0',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                padding: isMobile ? '0 16px' : '0'
              }}>
                {searchTerm || filterStatus !== 'all' 
                  ? 'Try adjusting your search criteria or filters' 
                  : 'Get started by adding your first master'
                }
              </p>
            </div>
          ) : (
            filteredMasters.map((master, index) => (
            <div
              key={master.NAME || index}
              className="master-list-master-item"
              onClick={async () => {
                // Fetch full master details from API
                const selectedCompanyGuid = sessionStorage.getItem('selectedCompanyGuid');
                if (!selectedCompanyGuid) {
                  alert('No company selected');
                  return;
                }

                let companies = [];
                try {
                  companies = JSON.parse(sessionStorage.getItem('allConnections') || '[]');
                } catch (e) {
                  console.error('Error parsing allConnections:', e);
                }

                const selectedCompanyTallylocId = sessionStorage.getItem('selectedCompanyTallylocId');
    // Match by both guid and tallyloc_id to handle companies with same guid but different tallyloc_id
    const currentCompany = companies.find(c => 
      c.guid === selectedCompanyGuid && 
      (selectedCompanyTallylocId ? String(c.tallyloc_id) === String(selectedCompanyTallylocId) : true)
    );
                if (!currentCompany) {
                  alert('Company not found');
                  return;
                }

                const { tallyloc_id, company, guid } = currentCompany;
                const masterName = master.NAME || master.name || '';

                try {
                  // Fetch full master details from ledgerlist-w-addrs API
                  const token = sessionStorage.getItem('token');
                  if (!token) {
                    throw new Error('No authentication token found');
                  }

                  const data = await apiPost(`/api/tally/ledgerlist-w-addrs?ts=${Date.now()}`, {
                    tallyloc_id,
                    company,
                    guid
                  });

                  // Find the specific master in the response
                  let fullMasterData = null;
                  if (data && data.ledgers && Array.isArray(data.ledgers)) {
                    fullMasterData = data.ledgers.find(
                      m => (m.NAME || m.name || '').toLowerCase().trim() === masterName.toLowerCase().trim()
                    );
                  }

                  // Use full master data if found, otherwise use the master from list
                  const masterToUse = fullMasterData || master;

                  // Transform master data to MasterForm format
                  // MasterForm expects: name, panNumber, gstNumber, addresses (array), contacts (array), bankDetails (array)
                  const formData = {
                    name: masterToUse.NAME || masterToUse.name || '',
                    alias: masterToUse.ALIAS || masterToUse.alias || '',
                    panNumber: masterToUse.PANNO || masterToUse.panno || masterToUse.panNumber || masterToUse.pan_no || '',
                    gstNumber: masterToUse.GSTNO || masterToUse.gstno || masterToUse.gstNumber || masterToUse.gstin_no || masterToUse.gstinNo || '',
                    
                    // Addresses - convert to array format
                    addresses: masterToUse.ADDRESSLIST && Array.isArray(masterToUse.ADDRESSLIST) && masterToUse.ADDRESSLIST.length > 0
                      ? masterToUse.ADDRESSLIST.map(addr => ({
                          address: (addr.ADDRESS || addr.address || '').replace(/\|/g, '\n'),
                          country: addr.COUNTRY || addr.country || 'India',
                          state: addr.STATE || addr.state || addr.STATENAME || addr.stateName || '',
                          pincode: addr.PINCODE || addr.pincode || addr.pin_code || '',
                          priorStateName: addr.PRIORSTATENAME || addr.priorStateName || '',
                          addressName: addr.ADDRESSNAME || addr.addressName || '',
                          phoneNumber: addr.PHONENUMBER || addr.phoneNumber || '',
                          countryISDCode: addr.COUNTRYISDCODE || addr.countryISDCode || '+91',
                          mobileNumber: addr.MOBILENUMBER || addr.mobileNumber || '',
                          contactPerson: addr.CONTACTPERSON || addr.contactPerson || '',
                          placeOfSupply: addr.PLACEOFSUPPLY || addr.placeOfSupply || '',
                          gstRegistrationType: addr.GSTREGISTRATIONTYPE || addr.gstRegistrationType || 'Regular',
                          applicableFrom: addr.APPLICABLEFROM || addr.applicableFrom || '',
                          mailingName: addr.MAILINGNAME || addr.mailingName || ''
                        }))
                      : (masterToUse.ADDRESS || masterToUse.address || masterToUse.address1)
                        ? [{
                            address: (masterToUse.ADDRESS || masterToUse.address || masterToUse.address1 || '').replace(/\|/g, '\n'),
                            country: masterToUse.COUNTRY || masterToUse.country || masterToUse.countryName || 'India',
                            state: masterToUse.STATE || masterToUse.state || masterToUse.STATENAME || masterToUse.stateName || '',
                            pincode: masterToUse.PINCODE || masterToUse.pincode || masterToUse.pin_code || ''
                          }]
                        : [{ address: '', country: 'India', state: '', pincode: '' }],

                    // Contacts - convert to array format
                    contacts: masterToUse.CONTACTLIST && Array.isArray(masterToUse.CONTACTLIST) && masterToUse.CONTACTLIST.length > 0
                      ? masterToUse.CONTACTLIST.map(contact => ({
                          contactPerson: contact.NAME || contact.CONTACTPERSON || contact.contactPerson || '',
                          email: contact.EMAIL || contact.email || '',
                          phone: contact.PHONENUMBER || contact.phone || contact.phoneNumber || '',
                          mobile: contact.MOBILENUMBER || contact.mobile || contact.mobileNumber || '',
                          countryISDCode: contact.COUNTRYISDCODE || contact.countryISDCode || '+91',
                          isDefaultWhatsappNum: contact.ISDEFAULTWHATSAPPNUM === 'Yes' || contact.isDefaultWhatsappNum === true
                        }))
                      : (masterToUse.CONTACTPERSON || masterToUse.contactPerson || masterToUse.EMAIL || masterToUse.email || masterToUse.PHONE || masterToUse.phone || masterToUse.MOBILE || masterToUse.mobile)
                        ? [{
                            contactPerson: masterToUse.CONTACTPERSON || masterToUse.contactPerson || '',
                            email: masterToUse.EMAIL || masterToUse.email || masterToUse.emailid || '',
                            phone: masterToUse.PHONE || masterToUse.phone || masterToUse.phoneNo || masterToUse.phone_no || '',
                            mobile: masterToUse.MOBILE || masterToUse.mobile || masterToUse.mobileNo || masterToUse.mobile_no || '',
                            countryISDCode: '+91',
                            isDefaultWhatsappNum: false
                          }]
                        : [{ contactPerson: '', email: '', phone: '', mobile: '', countryISDCode: '+91', isDefaultWhatsappNum: false }],

                    // Bank Details - convert to array format
                    bankDetails: masterToUse.PAYMENTDETAILSLIST && Array.isArray(masterToUse.PAYMENTDETAILSLIST) && masterToUse.PAYMENTDETAILSLIST.length > 0
                      ? masterToUse.PAYMENTDETAILSLIST.map(bank => ({
                          accountNumber: bank.ACCOUNTNUMBER || bank.accountNumber || bank.accountNo || bank.account_no || '',
                          ifscCode: bank.IFSCODE || bank.ifscCode || bank.ifsc_code || '',
                          bankName: bank.BANKNAME || bank.bankName || bank.bank_name || '',
                          swiftCode: bank.SWIFTCODE || bank.swiftCode || '',
                          paymentFavouring: bank.PAYMENTFAVOURING || bank.paymentFavouring || '',
                          bankId: bank.BANKID || bank.bankId || '',
                          defaultTransactionType: bank.DEFAULTTRANSACTIONTYPE || bank.defaultTransactionType || 'Inter Bank Transfer',
                          setAsDefault: bank.SETASDEFAULT === 'Yes' || bank.setAsDefault === true
                        }))
                      : (masterToUse.ACCOUNTNO || masterToUse.accountNumber || masterToUse.accountNo || masterToUse.account_no || masterToUse.IFSCCODE || masterToUse.ifscCode || masterToUse.ifsc_code || masterToUse.BANKNAME || masterToUse.bankName || masterToUse.bank_name)
                        ? [{
                            accountNumber: masterToUse.ACCOUNTNO || masterToUse.accountNumber || masterToUse.accountNo || masterToUse.account_no || '',
                            ifscCode: masterToUse.IFSCCODE || masterToUse.ifscCode || masterToUse.ifsc_code || '',
                            bankName: masterToUse.BANKNAME || masterToUse.bankName || masterToUse.bank_name || '',
                            swiftCode: '',
                            paymentFavouring: '',
                            bankId: '',
                            defaultTransactionType: 'Inter Bank Transfer',
                            setAsDefault: false
                          }]
                        : [{ accountNumber: '', ifscCode: '', bankName: '', swiftCode: '', paymentFavouring: '', bankId: '', defaultTransactionType: 'Inter Bank Transfer', setAsDefault: false }],

                    // Additional fields
                    gstRegistrationType: masterToUse.GSTREGISTRATIONTYPE || masterToUse.gstRegistrationType || 'Regular',
                    email: masterToUse.EMAIL || masterToUse.email || masterToUse.emailid || '',
                    emailCC: masterToUse.EMAILCC || masterToUse.emailCC || masterToUse.email_cc || '',
                    group: masterToUse.PARENT || masterToUse.parent || masterToUse.group || '',
                    maintainBalancesBillByBill: masterToUse.ISBILLWISEON === 'Yes' || masterToUse.isBillWiseOn === true || masterToUse.maintainBalancesBillByBill === true,
                    panDocumentLink: masterToUse.panDocumentLink || masterToUse.pan_document_link || '',
                    gstDocumentLink: masterToUse.gstDocumentLink || masterToUse.gst_document_link || ''
                  };

                  console.log('📝 Opening master form for:', masterName, 'Full master data:', masterToUse, 'Form data:', formData);
                  setSelectedMaster({ ...masterToUse, formData });
                  setShowMasterForm(true);
                } catch (error) {
                  console.error('Error fetching master details:', error);
                  alert('Failed to load master details. Please try again.');
                }
              }}
            >
              <div style={{ flex: '1', width: '100%' }}>
                <div style={{ 
                  display: 'flex', 
                  flexDirection: isMobile ? 'column' : 'row',
                  alignItems: isMobile ? 'flex-start' : 'center', 
                  gap: isMobile ? '8px' : '12px', 
                  marginBottom: isMobile ? '12px' : '8px' 
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, flexWrap: 'wrap' }}>
                    <span className="material-icons" style={{ 
                      fontSize: isMobile ? '18px' : '20px', 
                      color: '#3b82f6' 
                    }}>business</span>
                    <h3 style={{ 
                      fontSize: isMobile ? '16px' : '18px', 
                      fontWeight: '700', 
                      color: '#1f2937', 
                      margin: '0',
                      fontFamily: 'system-ui, -apple-system, sans-serif'
                    }}>
                      {master.NAME || 'Unnamed Master'}
                    </h3>
                  </div>
                  {master.status && (
                    <span style={{
                      padding: isMobile ? '6px 12px' : '4px 8px',
                      borderRadius: '20px',
                      fontSize: isMobile ? '11px' : '12px',
                      fontWeight: '600',
                      fontFamily: 'system-ui, -apple-system, sans-serif',
                      backgroundColor: master.status === 'approved' ? '#dcfce7' : 
                                     master.status === 'pending' ? '#fef3c7' : '#fecaca',
                      color: master.status === 'approved' ? '#166534' : 
                             master.status === 'pending' ? '#92400e' : '#991b1b',
                      border: `1px solid ${master.status === 'approved' ? '#166534' : 
                             master.status === 'pending' ? '#92400e' : '#991b1b'}30`,
                      alignSelf: isMobile ? 'flex-start' : 'center'
                    }}>
                      {master.status}
                    </span>
                  )}
                </div>
                
                {master.EMAIL && (
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '6px',
                    marginBottom: isMobile ? '8px' : '4px',
                    flexWrap: 'wrap'
                  }}>
                    <span className="material-icons" style={{ fontSize: isMobile ? '16px' : '16px', color: '#6b7280' }}>email</span>
                    <span style={{ 
                      fontSize: isMobile ? '13px' : '14px', 
                      color: '#6b7280', 
                      fontFamily: 'system-ui, -apple-system, sans-serif',
                      wordBreak: 'break-word'
                    }}>
                      {master.EMAIL}
                    </span>
                  </div>
                )}
                
                <div style={{ 
                  display: 'flex', 
                  gap: isMobile ? '12px' : '24px', 
                  flexWrap: 'wrap',
                  marginTop: isMobile ? '4px' : '0'
                }}>
                  {master.PANNO && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="material-icons" style={{ fontSize: isMobile ? '14px' : '16px', color: '#6b7280' }}>badge</span>
                      <span style={{ 
                        fontSize: isMobile ? '12px' : '14px', 
                        color: '#6b7280', 
                        fontFamily: 'monospace'
                      }}>
                        {master.PANNO}
                      </span>
                    </div>
                  )}
                  {master.GSTNO && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="material-icons" style={{ fontSize: isMobile ? '14px' : '16px', color: '#6b7280' }}>receipt</span>
                      <span style={{ 
                        fontSize: isMobile ? '12px' : '14px', 
                        color: '#6b7280', 
                        fontFamily: 'monospace'
                      }}>
                        {master.GSTNO}
                      </span>
                    </div>
                  )}
                </div>
                
                {master.ADDRESS && (
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'flex-start', 
                    gap: '6px',
                    marginTop: isMobile ? '8px' : '4px',
                    flexWrap: 'wrap'
                  }}>
                    <span className="material-icons" style={{ 
                      fontSize: isMobile ? '16px' : '16px', 
                      color: '#6b7280',
                      marginTop: '2px'
                    }}>location_on</span>
                    <span style={{ 
                      fontSize: isMobile ? '13px' : '14px', 
                      color: '#6b7280', 
                      fontFamily: 'system-ui, -apple-system, sans-serif',
                      flex: 1,
                      wordBreak: 'break-word'
                    }}>
                      {master.ADDRESS}
                    </span>
                  </div>
                )}
              </div>
            </div>
            ))
          )}
        </div>
      </div>
    </>
  );

  // Handle form success
  const handleFormSuccess = () => {
    setShowMasterForm(false);
    setSelectedMaster(null);
    // Refresh master list
    fetchMasters();
    // Trigger global refresh
    window.dispatchEvent(new CustomEvent('globalRefresh'));
  };

  // Handle form cancel
  const handleFormCancel = () => {
    setShowMasterForm(false);
    setSelectedMaster(null);
  };

  // If showing master form, render it instead of the list
  if (showMasterForm && selectedMaster) {
    return (
      <MasterForm
        initialData={selectedMaster.formData || selectedMaster}
        isEditing={true}
        onSuccess={handleFormSuccess}
        onCancel={handleFormCancel}
      />
    );
  }

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
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
          Loading masters...
        </p>
      </div>
    );
  }

  return (
    <div className="master-list-wrapper">
      <div className="master-list-container">
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .master-list-wrapper {
          margin-top: 10px !important;
          padding-top: 5px !important;
          width: 100% !important;
          align-self: stretch !important;
          display: flex !important;
          flex-direction: column !important;
          background: transparent !important;
          min-height: 100vh !important;
        }
        .master-list-container {
          padding: ${isMobile ? '12px' : '20px'} !important;
          width: 100% !important;
          height: 100vh !important;
          overflow: hidden !important;
          margin: 0 !important;
          box-sizing: border-box !important;
          position: relative !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          z-index: 1 !important;
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          justify-content: flex-start !important;
        }
        .master-list-container * {
          box-sizing: border-box !important;
        }
        .master-list-card {
          background: white !important;
          border-radius: ${isMobile ? '8px' : '12px'} !important;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06) !important;
          width: 100% !important;
          max-width: ${isMobile ? '100%' : '95%'} !important;
          margin: 0 auto !important;
          padding: ${isMobile ? '16px' : '40px 24px 24px 40px'} !important;
          display: flex !important;
          flex-direction: column !important;
          gap: ${isMobile ? '12px' : '20px'} !important;
          height: ${isMobile ? 'auto' : 'calc(100vh - 40px)'} !important;
          transform: ${isMobile ? 'translateX(0)' : 'translateX(20px)'} !important;
        }
        .master-list-header {
          display: flex !important;
          flex-direction: ${isMobile ? 'column' : 'row'} !important;
          justify-content: space-between !important;
          align-items: ${isMobile ? 'flex-start' : 'center'} !important;
          margin-bottom: 0 !important;
          padding: ${isMobile ? '12px 16px 0 16px' : '20px 30px 0 30px'} !important;
          height: auto !important;
          min-height: 50px !important;
          width: 100% !important;
          flex-shrink: 0 !important;
          gap: ${isMobile ? '12px' : '0'} !important;
        }
        .master-list-main {
          display: flex !important;
          flex-direction: column !important;
          gap: ${isMobile ? '12px' : '16px'} !important;
          width: 100% !important;
          margin: 0 !important;
          padding: ${isMobile ? '12px' : '20px'} !important;
          flex: 1 !important;
        }
        .master-list-master-list {
          flex: 1 1 auto !important;
          min-width: ${isMobile ? '100%' : '200px'} !important;
          background: #f8fafc !important;
          border-radius: 8px !important;
          border: 1px solid #e2e8f0 !important;
          overflow: hidden !important;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1) !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        .master-list-search-bar {
          padding: ${isMobile ? '10px' : '12px'} !important;
          border-bottom: 1px solid #e2e8f0 !important;
          background: white !important;
          margin: 0 !important;
        }
        @media (max-width: 768px) {
          .master-list-search-bar input,
          .master-list-search-bar select {
            font-size: 16px !important;
            padding: 12px 12px 12px 44px !important;
            min-height: 44px !important;
          }
        }
        .master-list-list-content {
          height: calc(100% - 50px) !important;
          overflow-y: auto !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        .master-list-master-item {
          padding: ${isMobile ? '12px' : '16px'} !important;
          border-bottom: 1px solid #e2e8f0 !important;
          cursor: pointer !important;
          transition: all 0.2s ease !important;
          margin: 0 !important;
          background: white !important;
          min-height: ${isMobile ? 'auto' : '80px'} !important;
        }
        .master-list-master-item:hover {
          background: #f1f5f9 !important;
        }
        @media (max-width: 768px) {
          .master-list-master-item {
            padding: 12px !important;
          }
          .master-list-master-item:active {
            background: #e2e8f0 !important;
          }
        }
        .master-list-no-masters {
          padding: ${isMobile ? '32px 16px' : '20px 10px'} !important;
          text-align: center !important;
          color: #6b7280 !important;
          margin: 0 !important;
        }
        @media (max-width: 768px) {
          .master-list-no-masters {
            padding: 24px 12px !important;
          }
          .master-list-no-masters .material-icons {
            font-size: 40px !important;
          }
          .master-list-no-masters h3 {
            font-size: 16px !important;
          }
          .master-list-no-masters p {
            font-size: 13px !important;
          }
        }
        .master-list-error {
          background: #fef2f2 !important;
          border: 1px solid #fecaca !important;
          color: #dc2626 !important;
          padding: 8px 12px !important;
          border-radius: 6px !important;
          margin-top: 10px !important;
          margin-bottom: 10px !important;
          flex-shrink: 0 !important;
          position: relative !important;
          z-index: 10 !important;
        }
        .master-list-card .material-icons {
          padding: 4px !important;
          margin: 2px !important;
          border-radius: 4px !important;
          transition: all 0.2s ease !important;
        }
        .master-list-card .material-icons:hover {
          background-color: rgba(0, 0, 0, 0.05) !important;
        }
        
        /* Mobile-specific improvements */
        @media (max-width: 768px) {
          .master-list-wrapper {
            padding-left: 0 !important;
          }
          .master-list-container {
            padding: 8px !important;
          }
          .master-list-card {
            padding: 12px !important;
            border-radius: 8px !important;
          }
          .master-list-header {
            padding: 12px 8px 0 8px !important;
          }
          .master-list-main {
            padding: 8px !important;
          }
          .master-list-master-list {
            max-height: calc(100vh - 300px) !important;
          }
          .master-list-list-content {
            max-height: calc(100vh - 350px) !important;
          }
          /* Better touch targets for mobile */
          button, .master-list-master-item {
            min-height: 44px !important;
            -webkit-tap-highlight-color: rgba(59, 130, 246, 0.2);
          }
          /* Prevent text selection on tap */
          .master-list-master-item {
            -webkit-user-select: none;
            -moz-user-select: none;
            -ms-user-select: none;
            user-select: none;
          }
        }
      `}</style>
      
      {error && (
        <div className="master-list-error">
          {error}
        </div>
      )}
      
      <div className="master-list-card">
        {/* Header */}
        <div className="master-list-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <span className="material-icons" style={{ color: 'white', fontSize: '20px' }}>people</span>
              </div>
              <h1 style={{
                fontSize: isMobile ? '20px' : '28px',
                fontWeight: '700',
                color: '#1f2937',
                margin: 0
              }}>
                Master List
              </h1>
            </div>
            <p style={{
              fontSize: isMobile ? '13px' : '16px',
              color: '#6b7280',
              margin: 0,
              fontWeight: '500'
            }}>
              Manage your master database and authorizations
            </p>
          </div>
          
          <div style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            gap: isMobile ? '8px' : '16px',
            alignItems: isMobile ? 'stretch' : 'center',
            width: isMobile ? '100%' : 'auto'
          }}>
            <div style={{
              display: 'flex',
              gap: '8px',
              alignItems: 'center',
              padding: '8px 16px',
              background: '#f1f5f9',
              borderRadius: '8px',
              border: '1px solid #e2e8f0'
            }}>
              <span className="material-icons" style={{ fontSize: '16px', color: '#64748b' }}>business</span>
              <span style={{ fontSize: '14px', color: '#64748b', fontWeight: '500' }}>
                {masters.length} Masters
              </span>
            </div>
            <button
              onClick={() => setShowInviteForm(!showInviteForm)}
              style={{
                padding: isMobile ? '10px 16px' : '12px 20px',
                background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: isMobile ? '13px' : '14px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s ease',
                boxShadow: '0 2px 4px rgba(59, 130, 246, 0.3)',
                width: isMobile ? '100%' : 'auto'
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = 'translateY(-1px)';
                e.target.style.boxShadow = '0 4px 8px rgba(59, 130, 246, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 2px 4px rgba(59, 130, 246, 0.3)';
              }}
            >
              <span className="material-icons" style={{ fontSize: '16px' }}>
                {showInviteForm ? 'close' : 'person_add'}
              </span>
              {showInviteForm ? 'Hide' : 'Invite'} Master
            </button>
          </div>
        </div>
        
        <div className="master-list-main">
          {renderMasterList()}
        </div>
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
                Master Invitation Link Generated!
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
              Share this link with your master to allow them to fill out the master registration form.
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

export default MasterList;
