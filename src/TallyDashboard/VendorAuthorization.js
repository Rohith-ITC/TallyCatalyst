/**
 * VendorAuthorization Component
 * 
 * This component manages vendor authorization requests and approvals.
 * It integrates with:
 * - Vendor Creation component (for new vendor requests)
 * - Payment Creation component (for approved vendors)
 * - Backend APIs for data persistence
 * 
 * Integration Points:
 * - window.vendorAuthorization.refreshVendors() - Refresh vendor list
 * - window.vendorAuthorization.getApprovedVendors() - Get approved vendors for payment creation
 * - window.vendorAuthorization.getVendorById(id) - Get specific vendor details
 * 
 * API Endpoints Required:
 * - GET /api/vendor/authorization/list?companyGuid={guid} - List vendors
 * - PUT /api/vendor/authorization/{id} - Update vendor authorization status
 * 
 * Data Structure Expected:
 * {
 *   id: number,
 *   name: string,
 *   email: string,
 *   company: string,
 *   status: 'pending' | 'approved' | 'rejected',
 *   createdDate: string,
 *   authorizationDate: string | null,
 *   notes: string,
 *   contactPerson: string,
 *   phone: string,
 *   address: string,
 *   gstNumber: string,
 *   panNumber: string,
 *   bankDetails: {
 *     accountNumber: string,
 *     bankName: string,
 *     ifscCode: string,
 *     branch: string
 *   }
 * }
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getApiUrl, API_CONFIG } from '../config';
import { apiGet, apiPost, apiPut, apiDelete } from '../utils/apiUtils';
import { getUserModules, hasPermission, getPermissionValue } from '../config/SideBarConfigurations';

function VendorAuthorization({ onVendorSelect }) {
  console.log('🎯 VendorAuthorization component loading...');
  
  // Get all companies from sessionStorage
  const companies = useMemo(() => {
    try {
      return JSON.parse(sessionStorage.getItem('allConnections') || '[]');
    } catch (e) {
      return [];
    }
  }, []);
  
  // Get company from sessionStorage (controlled by top bar)
  const selectedCompanyGuid = sessionStorage.getItem('selectedCompanyGuid') || '';
  const company = selectedCompanyGuid;
  
  // State for vendor authorization
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [showVendorDetails, setShowVendorDetails] = useState(false);
  const [authorizationNotes, setAuthorizationNotes] = useState('');
  // Removed saving state - no loading indicators needed
  
  // Filter vendors based on search term
  const filteredVendors = vendors.filter(vendor =>
    vendor.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vendor.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vendor.company?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const loadVendors = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // Get session data for API request
      const tallylocId = sessionStorage.getItem('tallyloc_id');
      const companyName = sessionStorage.getItem('company');
      const guid = sessionStorage.getItem('guid');

      if (!tallylocId || !companyName || !guid) {
        throw new Error('Missing required session data (tallyloc_id, company, or guid)');
      }

      // API call to get vendor list using ledger-list endpoint
      const response = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.TALLY_LEDGER_LIST), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tallyloc_id: parseInt(tallylocId),
          company: companyName,
          guid: guid
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch vendors');
      }

      const result = await response.json();
      console.log('📊 Vendors fetched successfully:', result);
      console.log('📊 Result structure:', {
        hasData: !!result.data,
        hasLedgers: !!result.ledgers,
        isArray: Array.isArray(result),
        hasLedgerData: !!result.ledgerData
      });
      
      // Transform API response to vendor format
      let vendors = [];
      
      if (result.data && Array.isArray(result.data)) {
        vendors = result.data;
      } else if (result.ledgers && Array.isArray(result.ledgers)) {
        vendors = result.ledgers;
      } else if (Array.isArray(result)) {
        vendors = result;
      } else if (result.ledgerData && Array.isArray(result.ledgerData)) {
        vendors = result.ledgerData;
      }
      
      // Load vendor submissions from localStorage
      try {
        const submissions = localStorage.getItem('vendor_submissions');
        if (submissions) {
          const submissionList = JSON.parse(submissions);
          console.log('📝 Vendor submissions from localStorage:', submissionList);
          
          // Add submissions that match current session
          submissionList.forEach(submission => {
            if (submission.tallyloc_id === tallylocId && 
                submission.guid === guid &&
                submission.status === 'pending') {
              vendors.push({
                ...submission,
                id: submission.id,
                name: submission.name,
                email: submission.email,
                panNumber: submission.panNumber,
                gstNumber: submission.gstNumber,
                address: submission.address,
                contactPerson: submission.contactPerson,
                phone: submission.phone,
                mobile: submission.mobile,
                panDocumentLink: submission.panDocumentLink || '',
                gstDocumentLink: submission.gstDocumentLink || '',
                status: 'pending',
                isSubmission: true // Flag to identify localStorage submissions
              });
            }
          });
        }
      } catch (err) {
        console.error('Error loading vendor submissions:', err);
      }
      
      // Debug: Log sample vendor data structure
      if (vendors.length > 0) {
        console.log('🔍 Sample vendor data from API:', vendors[0]);
        console.log('🔍 Available fields in vendor data:', Object.keys(vendors[0]));
        console.log('🔍 GST-related fields:', {
          gstType: vendors[0].gstType,
          gst_type: vendors[0].gst_type,
          gsttype: vendors[0].gsttype,
          gstinNo: vendors[0].gstinNo,
          gstin_no: vendors[0].gstin_no,
          gstinno: vendors[0].gstinno,
          gstNumber: vendors[0].gstNumber
        });
      }

      // Transform API data to our vendor format
      const transformedVendors = Array.isArray(vendors) ? vendors.map((vendor, index) => ({
        id: vendor.id || vendor.ledger_id || vendor.ledgerId || index + 1,
        name: vendor.name || vendor.ledger_name || vendor.ledgerName || 'Unknown Vendor',
        email: vendor.email || vendor.emailid || vendor.email_id || vendor.emailId || '',
        company: companyName,
        contactPerson: vendor.contactPerson || vendor.contact_person || vendor.contactperson || '',
        phone: vendor.phone || vendor.phoneNo || vendor.phoneno || vendor.phone_no || vendor.phoneNumber || '',
        mobile: vendor.mobile || vendor.mobileNo || vendor.mobileno || vendor.mobile_no || vendor.mobileNumber || '',
        address: vendor.address || vendor.address1 || vendor.address_1 || '',
        state: vendor.stateName || vendor.state || vendor.state_name || '',
        pincode: vendor.pincode || vendor.pin_code || vendor.pinCode || '',
        country: vendor.countryName || vendor.country || vendor.country_name || 'India',
        gstNumber: vendor.gstinNo || vendor.gstin_no || vendor.gstinno || vendor.gstNumber || '',
        gstType: vendor.gstType || vendor.gst_type || vendor.gsttype || '',
        panNumber: vendor.panNo || vendor.pan_no || vendor.panno || vendor.panNumber || '',
        favouringName: vendor.favouringName || vendor.favouring_name || vendor.favouringname || '',
        status: vendor.status || vendor.authorizationStatus || 'pending', // Use actual status from API
        createdDate: vendor.createdAt || vendor.created_at || vendor.date_created || vendor.createdDate || new Date().toISOString().split('T')[0],
        authorizationDate: null,
        notes: '',
        bankDetails: {
          accountNumber: vendor.accountNo || vendor.account_no || vendor.accountno || vendor.accountNumber || '',
          bankName: vendor.bankName || vendor.bank_name || '',
          ifscCode: vendor.ifscCode || vendor.ifsc_code || vendor.ifsccode || '',
          branch: vendor.branch || vendor.branch_name || '',
          accountType: vendor.accountType || vendor.account_type || vendor.accounttype || ''
        }
      })) : [];

      // Debug: Log transformed vendor data
      if (transformedVendors.length > 0) {
        console.log('🔍 Sample transformed vendor:', transformedVendors[0]);
        console.log('🔍 Transformed GST Type:', transformedVendors[0].gstType);
      }

      console.log('📊 Transformed vendors:', transformedVendors.map(v => ({ name: v.name, status: v.status })));
      setVendors(transformedVendors);
    } catch (error) {
      console.error('Error loading vendors:', error);
      setError('Failed to load vendors. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [company]);
  
  // Load vendors on component mount and when company changes
  useEffect(() => {
    if (company) {
      loadVendors();
    }
  }, [company, loadVendors]);
  
  // Listen for company changes from top bar
  useEffect(() => {
    const handleCompanyChange = () => {
      setVendors([]);
      setSelectedVendor(null);
      setShowVendorDetails(false);
      if (company) {
        loadVendors();
      }
    };

    window.addEventListener('companyChanged', handleCompanyChange);
    return () => window.removeEventListener('companyChanged', handleCompanyChange);
  }, [company]);

  // Listen for global refresh events
  useEffect(() => {
    const handleGlobalRefresh = () => {
      console.log('🔄 Global refresh triggered - refreshing vendor authorization list');
      console.log('🔄 Current company:', company);
      if (company) {
        console.log('🔄 Calling loadVendors...');
        loadVendors();
      } else {
        console.log('🔄 No company selected, skipping vendor refresh');
      }
    };

    const handleVendorSubmission = () => {
      console.log('📝 Vendor submission added - refreshing vendor authorization list');
      if (company) {
        loadVendors();
      }
    };

    window.addEventListener('globalRefresh', handleGlobalRefresh);
    window.addEventListener('vendorSubmissionAdded', handleVendorSubmission);
    
    return () => {
      window.removeEventListener('globalRefresh', handleGlobalRefresh);
      window.removeEventListener('vendorSubmissionAdded', handleVendorSubmission);
    };
  }, [company, loadVendors]);
  
  const handleVendorSelect = (vendor) => {
    if (onVendorSelect) {
      // If onVendorSelect callback is provided, use it to navigate to approval form
      onVendorSelect(vendor);
    } else {
      // Fallback to original behavior (show details in sidebar)
      setSelectedVendor(vendor);
      setShowVendorDetails(true);
      setAuthorizationNotes(vendor.notes || '');
    }
  };
  
  const handleAuthorizationAction = async (action) => {
    if (!selectedVendor) return;
    
    // Add confirmation for reject action
    if (action === 'rejected') {
      const confirmReject = window.confirm(
        `Are you sure you want to reject vendor "${selectedVendor.name}"?\n\n` +
        `This action cannot be undone. The vendor will be marked as rejected and removed from pending approvals.`
      );
      if (!confirmReject) {
        return;
      }
    }
    
    // Add confirmation for approve action
    if (action === 'approved') {
      const confirmApprove = window.confirm(
        `Are you sure you want to approve vendor "${selectedVendor.name}"?\n\n` +
        `This will authorize the vendor and allow them to proceed with transactions.`
      );
      if (!confirmApprove) {
        return;
      }
    }
    
    try {
      // Get session data for API request
      const tallylocId = sessionStorage.getItem('tallyloc_id');
      const companyName = sessionStorage.getItem('company');
      const guid = sessionStorage.getItem('guid');

      if (!tallylocId || !companyName || !guid) {
        throw new Error('Missing required session data (tallyloc_id, company, or guid)');
      }

      console.log('Updating vendor authorization:', {
        vendor: selectedVendor.name,
        action: action,
        notes: authorizationNotes
      });

      // Check if the vendor is already authorized
      if (selectedVendor.status === 'approved') {
        console.log('Vendor is already authorized, skipping authorization...');
        alert('This vendor is already authorized. No action needed.');
        return;
      }
      
      // Create the vendor in Tally first (if not already created)
      console.log('Creating vendor in Tally before authorization...');
      try {
        const createResult = await createVendorInTally(selectedVendor);
        if (createResult?.existing) {
          console.log('Vendor already exists in Tally, proceeding with authorization...');
        } else {
          console.log('Vendor created successfully, proceeding with authorization...');
        }
      } catch (createError) {
        // If creation fails but vendor might already exist, log and continue
        console.warn('Vendor creation had issues, but proceeding with authorization:', createError.message);
        // Don't throw - allow authorization to proceed as vendor might already exist
      }

      // API call to update vendor authorization using ledger-auth endpoint
      const response = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.TALLY_LEDGER_AUTH), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tallyloc_id: parseInt(tallylocId),
          company: companyName,
          guid: guid,
          name: selectedVendor.name
        })
      });

      if (!response.ok) {
        let errorMessage = 'Failed to update vendor authorization';
        try {
          const errorData = await response.json();
          console.error('API Error Response:', errorData);
          
          // Provide specific error messages
          if (errorData.message === 'Failed to authorize ledger') {
            errorMessage = `Failed to authorize vendor "${selectedVendor.name}". Please try again or contact support.`;
          } else {
            errorMessage = errorData.message || errorData.error || `HTTP ${response.status}: ${response.statusText}`;
          }
        } catch (parseError) {
          console.error('Failed to parse error response:', parseError);
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('Vendor authorization updated:', result);
      
      // Update local state immediately
      console.log('Updating vendor status from', selectedVendor.status, 'to', action);
      setVendors(prev => prev.map(vendor => 
        vendor.id === selectedVendor.id 
          ? { 
              ...vendor, 
              status: action, 
              notes: authorizationNotes,
              authorizationDate: action !== 'pending' ? new Date().toISOString().split('T')[0] : null
            }
          : vendor
      ));
      
      setSelectedVendor(prev => ({
        ...prev,
        status: action,
        notes: authorizationNotes,
        authorizationDate: action !== 'pending' ? new Date().toISOString().split('T')[0] : null
      }));
      
      // Force a re-render by updating the vendors state again
      setVendors(prev => [...prev]);
      
      // Show success message
      alert(`Vendor ${action === 'approved' ? 'approved' : 'rejected'} successfully!\n\nVendor: ${selectedVendor.name}\nStatus: ${action.toUpperCase()}`);
      
      // Trigger global refresh to update vendor lists
      window.dispatchEvent(new CustomEvent('globalRefresh'));
      
      // Also refresh the vendor list directly
      setTimeout(() => {
        loadVendors();
      }, 500);
      
    } catch (error) {
      console.error('Error updating vendor authorization:', error);
      alert(`Failed to update vendor authorization: ${error.message}\n\nPlease try again.`);
    }
  };
  
  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': return '#10b981';
      case 'rejected': return '#ef4444';
      case 'pending': return '#f59e0b';
      default: return '#6b7280';
    }
  };
  
  const getStatusText = (status) => {
    switch (status) {
      case 'approved': return 'Approved';
      case 'rejected': return 'Rejected';
      case 'pending': return 'Pending';
      default: return 'Unknown';
    }
  };

  // Integration methods for other components
  const refreshVendors = () => {
    loadVendors();
  };

  const getVendorById = (vendorId) => {
    return vendors.find(vendor => vendor.id === vendorId);
  };

  const getApprovedVendors = () => {
    return vendors.filter(vendor => vendor.status === 'approved');
  };

  const getRejectedVendors = () => {
    return vendors.filter(vendor => vendor.status === 'rejected');
  };

  const getPendingVendors = () => {
    return vendors.filter(vendor => vendor.status === 'pending');
  };

  // Function to create a vendor in Tally before authorization
  const createVendorInTally = async (vendorData) => {
    try {
      const tallylocId = sessionStorage.getItem('tallyloc_id');
      const companyName = sessionStorage.getItem('company');
      const guid = sessionStorage.getItem('guid');

      if (!tallylocId || !companyName || !guid) {
        throw new Error('Missing required session data');
      }

      console.log('Creating vendor in Tally before authorization:', vendorData);

      // Check if vendor already exists in Tally
      const checkResponse = await fetch(getApiUrl('/api/tally/ledger-check'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tallyloc_id: parseInt(tallylocId),
          company: companyName,
          guid: guid,
          type: 'name',
          value: vendorData.name.trim()
        })
      });

      if (checkResponse.ok) {
        const checkResult = await checkResponse.json();
        if (checkResult.exists === true) {
          console.log('Vendor already exists in Tally, skipping creation:', vendorData.name);
          return { success: true, message: 'Vendor already exists', existing: true };
        }
      }

      // Vendor doesn't exist, proceed with creation
      // Prepare the vendor data for API according to the ledger-create structure
      const apiData = {
        tallyloc_id: parseInt(tallylocId),
        company: companyName,
        guid: guid,
        ledgerData: {
          name: vendorData.name.trim(),
          address: (vendorData.address || '').replace(/\n/g, '|'), // Convert line breaks to pipe characters
          pincode: vendorData.pincode || '',
          stateName: vendorData.state || '',
          countryName: vendorData.country || 'India',
          contactPerson: vendorData.contactPerson || '',
          phoneNo: vendorData.phone || '',
          mobileNo: vendorData.mobile || '',
          email: vendorData.email || '',
          emailCC: '',
          panNo: vendorData.panNumber || '',
          gstinNo: vendorData.gstNumber || '',
          bankName: vendorData.bankDetails?.bankName || '',
          accountNo: vendorData.bankDetails?.accountNumber || '',
          ifscCode: vendorData.bankDetails?.ifscCode || ''
        }
      };

      const response = await fetch(getApiUrl('/api/tally/ledger-create'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(apiData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        // If it's a 400 error and vendor already exists, treat as success
        if (response.status === 400 && (errorData.message?.toLowerCase().includes('already exists') || 
            errorData.message?.toLowerCase().includes('duplicate'))) {
          console.log('Vendor already exists (from error response), proceeding with authorization');
          return { success: true, message: 'Vendor already exists', existing: true };
        }
        throw new Error(errorData.message || errorData.error || 'Failed to create vendor in Tally');
      }

      const result = await response.json();
      console.log('Vendor created in Tally:', result);
      
      // Check if result indicates failure
      if (result.success === false) {
        // If it's a duplicate/exists error, treat as success
        if (result.message?.toLowerCase().includes('already exists') || 
            result.message?.toLowerCase().includes('duplicate')) {
          console.log('Vendor already exists (from result), proceeding with authorization');
          return { success: true, message: 'Vendor already exists', existing: true };
        }
        throw new Error(result.message || 'Failed to create vendor in Tally');
      }
      
      return result;
    } catch (error) {
      console.error('Error creating vendor in Tally:', error);
      // If error indicates vendor already exists, treat as success
      if (error.message?.toLowerCase().includes('already exists') || 
          error.message?.toLowerCase().includes('duplicate')) {
        console.log('Vendor already exists (from error), proceeding with authorization');
        return { success: true, message: 'Vendor already exists', existing: true };
      }
      throw error;
    }
  };

  // Expose methods for integration with other components
  useEffect(() => {
    // Make methods available globally for integration
    window.vendorAuthorization = {
      refreshVendors,
      getVendorById,
      getApprovedVendors,
      getRejectedVendors,
      getPendingVendors,
      vendors,
      selectedVendor
    };
  }, [vendors, selectedVendor]);
  
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '400px',
        fontSize: '16px',
        color: '#6b7280'
      }}>
        Loading vendors...
      </div>
    );
  }
  
  return (
    <div className="vendor-authorization-wrapper">
      <div className="vendor-authorization-container">
      <style>{`
        .vendor-authorization-wrapper {
          margin-top: 10px !important;
          padding-top: 5px !important;
          width: 100% !important;
          align-self: stretch !important;
          display: flex !important;
          flex-direction: column !important;
          background: #f5f5f5 !important;
          min-height: 100vh !important;
        }
        .vendor-authorization-container {
          padding: 20px !important;
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
        .vendor-authorization-container * {
          box-sizing: border-box !important;
        }
        .vendor-authorization-main {
          display: flex !important;
          gap: 16px !important;
          height: calc(100% - 120px) !important;
          width: 100% !important;
          margin: 0 !important;
          padding: 20px !important;
          flex: 1 !important;
        }
        .vendor-authorization-card {
          background: white !important;
          border-radius: 12px !important;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06) !important;
          width: 100% !important;
          max-width: 95% !important;
          margin: 0 auto !important;
          padding: 40px 24px 24px 40px !important;
          display: flex !important;
          flex-direction: column !important;
          gap: 20px !important;
          height: calc(100vh - 40px) !important;
          transform: translateX(20px) !important;
        }
        .vendor-authorization-header {
          display: flex !important;
          justify-content: space-between !important;
          align-items: center !important;
          margin-bottom: 0 !important;
          padding: 20px 30px 0 30px !important;
          height: auto !important;
          min-height: 50px !important;
          width: 100% !important;
          flex-shrink: 0 !important;
        }
        .vendor-authorization-vendor-list {
          flex: 1 1 50% !important;
          min-width: 200px !important;
          background: #f8fafc !important;
          border-radius: 8px !important;
          border: 1px solid #e2e8f0 !important;
          overflow: hidden !important;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1) !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        .vendor-authorization-vendor-details {
          flex: 1 1 50% !important;
          min-width: 200px !important;
          background: #f8fafc !important;
          border-radius: 8px !important;
          border: 1px solid #e2e8f0 !important;
          padding: 0 !important;
          overflow-y: auto !important;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1) !important;
          margin: 0 !important;
        }
        .vendor-authorization-search-bar {
          padding: 12px !important;
          border-bottom: 1px solid #e2e8f0 !important;
          background: white !important;
          margin: 0 !important;
        }
        .vendor-authorization-list-content {
          height: calc(100% - 50px) !important;
          overflow-y: auto !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        .vendor-authorization-details-content {
          padding: 8px !important;
          height: calc(100% - 50px) !important;
          overflow-y: auto !important;
          margin: 0 !important;
        }
        .vendor-authorization-details-header {
          display: flex !important;
          justify-content: space-between !important;
          align-items: center !important;
          padding: 12px !important;
          border-bottom: 1px solid #e2e8f0 !important;
          background: white !important;
          margin: 0 !important;
        }
        .vendor-authorization-error {
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
        .vendor-authorization-vendor-item {
          padding: 16px !important;
          border-bottom: 1px solid #e2e8f0 !important;
          cursor: pointer !important;
          transition: all 0.2s ease !important;
          margin: 0 !important;
          background: white !important;
        }
        .vendor-authorization-no-vendors {
          padding: 20px 10px !important;
          text-align: center !important;
          color: #6b7280 !important;
          margin: 0 !important;
        }
        .vendor-authorization-section {
          margin-bottom: 10px !important;
          padding: 10px !important;
          border-radius: 8px !important;
          border: 1px solid #e5e7eb !important;
        }
        
        /* Override AdminHome styles that interfere with VendorAuthorization */
        .adminhome-main .vendor-authorization-container {
          align-items: stretch !important;
          justify-content: flex-start !important;
          width: 100% !important;
          height: 100% !important;
          padding: 10px 5px 5px 5px !important;
          margin: 0 !important;
          margin-top: 5px !important;
        }
        
        /* Ensure VendorAuthorization container overrides parent centering */
        .vendor-authorization-container {
          align-items: stretch !important;
          justify-content: flex-start !important;
          width: 100% !important;
          height: 100% !important;
          padding-top: 10px !important;
          margin-top: 5px !important;
        }
        
        /* Override any parent container centering */
        .adminhome-main {
          align-items: stretch !important;
          justify-content: flex-start !important;
        }
        
        /* More specific overrides for AdminHome main container */
        .adminhome-main[style*="alignItems: 'center'"] {
          align-items: stretch !important;
        }
        .adminhome-main[style*="justifyContent: 'center'"] {
          justify-content: flex-start !important;
        }
        
        /* Force the main container to not center its children */
        .adminhome-main > * {
          align-self: stretch !important;
          width: 100% !important;
        }
        
        /* Ensure no inherited margins or padding */
        .vendor-authorization-container > * {
          margin: 0 !important;
          padding: 0 !important;
        }
        
        .vendor-authorization-container > *:not(.vendor-authorization-header):not(.vendor-authorization-error) {
          margin: 0 !important;
        }
        
        /* Material Icons Styling */
        .vendor-authorization-card .material-icons {
          padding: 4px !important;
          margin: 2px !important;
          border-radius: 4px !important;
          transition: all 0.2s ease !important;
        }
        
        .vendor-authorization-card .material-icons:hover {
          background-color: rgba(0, 0, 0, 0.05) !important;
        }
      `}</style>
      
      {error && (
        <div className="vendor-authorization-error">
          {error}
        </div>
      )}
      
      <div className="vendor-authorization-card">
        {/* Header */}
        <div className="vendor-authorization-header">
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
                <span className="material-icons" style={{ color: 'white', fontSize: '20px' }}>verified_user</span>
              </div>
              <h1 style={{
                fontSize: '28px',
                fontWeight: '700',
                color: '#1f2937',
                margin: 0
              }}>
                Vendor Authorization
              </h1>
            </div>
            <p style={{
              fontSize: '16px',
              color: '#6b7280',
              margin: 0,
              fontWeight: '500'
            }}>
              Manage vendor authorization requests and approvals
            </p>
          </div>
          
          <div style={{
            display: 'flex',
            gap: '16px',
            alignItems: 'center'
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
                {vendors.length} Vendors
              </span>
            </div>
            <button
              onClick={loadVendors}
              style={{
                padding: '12px 20px',
                background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s ease',
                boxShadow: '0 2px 4px rgba(59, 130, 246, 0.3)'
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
                refresh
              </span>
              Refresh
            </button>
          </div>
        </div>
        
        <div className="vendor-authorization-main">
        {/* Vendor List */}
        <div className="vendor-authorization-vendor-list">
          {/* Search Bar */}
          <div className="vendor-authorization-search-bar">
            <div style={{ position: 'relative' }}>
              <span className="material-icons" style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#9ca3af',
                fontSize: '20px'
              }}>
                search
              </span>
              <input
                type="text"
                placeholder="Search vendors by name, email, or company..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 12px 12px 44px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'all 0.2s ease',
                  background: 'white'
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
          </div>
          
          {/* Vendor List */}
          <div className="vendor-authorization-list-content">
            {filteredVendors.length === 0 ? (
              <div className="vendor-authorization-no-vendors">
                <div style={{
                  width: '64px',
                  height: '64px',
                  background: '#f3f4f6',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                  fontSize: '24px',
                  color: '#9ca3af'
                }}>
                  <span className="material-icons">pending_actions</span>
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#374151', margin: '0 0 8px 0' }}>
                  {searchTerm ? 'No vendors found' : 'No authorization requests'}
                </h3>
                <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
                  {searchTerm 
                    ? 'Try adjusting your search criteria' 
                    : 'There are no vendor authorization requests at the moment. Vendors will appear here when they need authorization.'
                  }
                </p>
              </div>
            ) : (
              filteredVendors.map(vendor => (
                <div
                  key={vendor.id}
                  onClick={() => handleVendorSelect(vendor)}
                  className="vendor-authorization-vendor-item"
                  style={{
                    backgroundColor: selectedVendor?.id === vendor.id ? '#f0f9ff' : 'white',
                    borderLeft: selectedVendor?.id === vendor.id ? '4px solid #3b82f6' : '4px solid transparent'
                  }}
                  onMouseEnter={(e) => {
                    if (selectedVendor?.id !== vendor.id) {
                      e.target.style.backgroundColor = '#f8fafc';
                      e.target.style.transform = 'translateX(4px)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedVendor?.id !== vendor.id) {
                      e.target.style.backgroundColor = 'white';
                      e.target.style.transform = 'translateX(0)';
                    }
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '12px'
                  }}>
                    <div style={{ flex: 1 }}>
                      <h3 style={{
                        fontSize: '18px',
                        fontWeight: '700',
                        color: '#1f2937',
                        margin: '0 0 4px 0',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <span className="material-icons" style={{ fontSize: '20px', color: '#3b82f6' }}>business</span>
                        {vendor.name}
                      </h3>
                      <p style={{
                        fontSize: '14px',
                        color: '#6b7280',
                        margin: '0 0 8px 0',
                        fontWeight: '500'
                      }}>
                        {vendor.email}
                      </p>
                    </div>
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-end',
                      gap: '8px'
                    }}>
                      <span style={{
                        padding: '6px 12px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: '600',
                        backgroundColor: getStatusColor(vendor.status) + '15',
                        color: getStatusColor(vendor.status),
                        border: `1px solid ${getStatusColor(vendor.status)}30`,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}>
                        {getStatusText(vendor.status)}
                      </span>
                      <div style={{
                        fontSize: '11px',
                        color: '#9ca3af',
                        textAlign: 'right'
                      }}>
                        {vendor.authorizationDate ? 
                          `Auth: ${new Date(vendor.authorizationDate).toLocaleDateString()}` :
                          `Created: ${new Date(vendor.createdDate).toLocaleDateString()}`
                        }
                      </div>
                    </div>
                  </div>
                  
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    fontSize: '13px',
                    color: '#6b7280'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span className="material-icons" style={{ fontSize: '16px' }}>person</span>
                      <span>{vendor.contactPerson}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span className="material-icons" style={{ fontSize: '16px' }}>phone</span>
                      <span>{vendor.phone}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        
        {/* Vendor Details */}
        {showVendorDetails && selectedVendor && (
          <div className="vendor-authorization-vendor-details">
            {/* Header */}
            <div className="vendor-authorization-details-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <span className="material-icons" style={{ color: 'white', fontSize: '20px' }}>business</span>
                </div>
                <div>
                  <h2 style={{
                    fontSize: '20px',
                    fontWeight: '700',
                    color: '#1f2937',
                    margin: '0 0 4px 0'
                  }}>
                    Vendor Details
                  </h2>
                  <p style={{
                    fontSize: '14px',
                    color: '#6b7280',
                    margin: 0,
                    fontWeight: '500'
                  }}>
                    {selectedVendor.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowVendorDetails(false)}
                style={{
                  width: '32px',
                  height: '32px',
                  background: '#f3f4f6',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  color: '#6b7280',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = '#e5e7eb';
                  e.target.style.color = '#374151';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = '#f3f4f6';
                  e.target.style.color = '#6b7280';
                }}
              >
                <span className="material-icons" style={{ fontSize: '18px' }}>close</span>
              </button>
            </div>
            
            <div className="vendor-authorization-details-content">
            
            {/* Basic Information */}
            <div className="vendor-authorization-section" style={{ 
              background: '#f8fafc',
              border: '1px solid #e5e7eb'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <span className="material-icons" style={{ fontSize: '20px', color: '#3b82f6' }}>info</span>
                <h3 style={{
                  fontSize: '16px',
                  fontWeight: '600',
                  color: '#1f2937',
                  margin: 0
                }}>
                  Basic Information
                </h3>
              </div>
              <div style={{ display: 'grid', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', display: 'block' }}>Company Name</label>
                    <div style={{ fontSize: '14px', color: '#1f2937', fontWeight: '500' }}>{selectedVendor.company}</div>
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', display: 'block' }}>Contact Person</label>
                    <div style={{ fontSize: '14px', color: '#1f2937', fontWeight: '500' }}>{selectedVendor.contactPerson}</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', display: 'block' }}>Email</label>
                    <div style={{ fontSize: '14px', color: '#1f2937', fontWeight: '500' }}>{selectedVendor.email}</div>
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', display: 'block' }}>Phone</label>
                    <div style={{ fontSize: '14px', color: '#1f2937', fontWeight: '500' }}>{selectedVendor.phone}</div>
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', display: 'block' }}>Address</label>
                  <div style={{ fontSize: '14px', color: '#1f2937', fontWeight: '500' }}>{selectedVendor.address}</div>
                </div>
              </div>
            </div>
            
            {/* Business Information */}
            <div className="vendor-authorization-section" style={{ 
              background: '#f0fdf4',
              border: '1px solid #bbf7d0'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <span className="material-icons" style={{ fontSize: '20px', color: '#10b981' }}>business_center</span>
                <h3 style={{
                  fontSize: '16px',
                  fontWeight: '600',
                  color: '#1f2937',
                  margin: 0
                }}>
                  Business Information
                </h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', display: 'block' }}>GST Number</label>
                  <div style={{ fontSize: '14px', color: '#1f2937', fontWeight: '500', fontFamily: 'monospace' }}>{selectedVendor.gstNumber}</div>
                  {selectedVendor.gstDocumentLink && (
                    <button
                      onClick={() => window.open(selectedVendor.gstDocumentLink, '_blank')}
                      style={{
                        marginTop: '8px',
                        padding: '6px 12px',
                        background: 'linear-gradient(135deg, #10b981, #059669)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: '600',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 2px 4px rgba(16, 185, 129, 0.3)'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.transform = 'translateY(-1px)';
                        e.target.style.boxShadow = '0 4px 8px rgba(16, 185, 129, 0.4)';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.transform = 'translateY(0)';
                        e.target.style.boxShadow = '0 2px 4px rgba(16, 185, 129, 0.3)';
                      }}
                    >
                      <span className="material-icons" style={{ fontSize: '14px' }}>visibility</span>
                      View GST Document
                    </button>
                  )}
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', display: 'block' }}>PAN Number</label>
                  <div style={{ fontSize: '14px', color: '#1f2937', fontWeight: '500', fontFamily: 'monospace' }}>{selectedVendor.panNumber}</div>
                  {selectedVendor.panDocumentLink && (
                    <button
                      onClick={() => window.open(selectedVendor.panDocumentLink, '_blank')}
                      style={{
                        marginTop: '8px',
                        padding: '6px 12px',
                        background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: '600',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 2px 4px rgba(59, 130, 246, 0.3)'
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
                      <span className="material-icons" style={{ fontSize: '14px' }}>visibility</span>
                      View PAN Document
                    </button>
                  )}
                </div>
              </div>
            </div>
            
            {/* Documents Section */}
            {(selectedVendor.panDocumentLink || selectedVendor.gstDocumentLink) && (
              <div className="vendor-authorization-section" style={{ 
                background: '#fef7ff',
                border: '1px solid #e9d5ff'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                  <span className="material-icons" style={{ fontSize: '20px', color: '#8b5cf6' }}>description</span>
                  <h3 style={{
                    fontSize: '16px',
                    fontWeight: '600',
                    color: '#1f2937',
                    margin: 0
                  }}>
                    Uploaded Documents
                  </h3>
                </div>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  {selectedVendor.panDocumentLink && (
                    <button
                      onClick={() => window.open(selectedVendor.panDocumentLink, '_blank')}
                      style={{
                        padding: '12px 16px',
                        background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: '600',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 2px 4px rgba(59, 130, 246, 0.3)',
                        minWidth: '180px'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.transform = 'translateY(-2px)';
                        e.target.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.4)';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.transform = 'translateY(0)';
                        e.target.style.boxShadow = '0 2px 4px rgba(59, 130, 246, 0.3)';
                      }}
                    >
                      <span className="material-icons" style={{ fontSize: '18px' }}>description</span>
                      View PAN Document
                    </button>
                  )}
                  {selectedVendor.gstDocumentLink && (
                    <button
                      onClick={() => window.open(selectedVendor.gstDocumentLink, '_blank')}
                      style={{
                        padding: '12px 16px',
                        background: 'linear-gradient(135deg, #10b981, #059669)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: '600',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 2px 4px rgba(16, 185, 129, 0.3)',
                        minWidth: '180px'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.transform = 'translateY(-2px)';
                        e.target.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.4)';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.transform = 'translateY(0)';
                        e.target.style.boxShadow = '0 2px 4px rgba(16, 185, 129, 0.3)';
                      }}
                    >
                      <span className="material-icons" style={{ fontSize: '18px' }}>description</span>
                      View GST Document
                    </button>
                  )}
                </div>
                <div style={{ 
                  marginTop: '12px', 
                  padding: '8px 12px', 
                  background: '#f0f9ff', 
                  borderRadius: '6px', 
                  border: '1px solid #bae6fd',
                  fontSize: '12px',
                  color: '#0369a1'
                }}>
                  <span className="material-icons" style={{ fontSize: '14px', verticalAlign: 'middle', marginRight: '4px' }}>info</span>
                  Documents will open in a new tab for review
                </div>
              </div>
            )}
            
            {/* Bank Details */}
            <div className="vendor-authorization-section" style={{ 
              background: '#fef3c7',
              border: '1px solid #fde68a'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <span className="material-icons" style={{ fontSize: '20px', color: '#f59e0b' }}>account_balance</span>
                <h3 style={{
                  fontSize: '16px',
                  fontWeight: '600',
                  color: '#1f2937',
                  margin: 0
                }}>
                  Bank Details
                </h3>
              </div>
              <div style={{ display: 'grid', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', display: 'block' }}>Account Number</label>
                    <div style={{ fontSize: '14px', color: '#1f2937', fontWeight: '500', fontFamily: 'monospace' }}>{selectedVendor.bankDetails.accountNumber}</div>
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', display: 'block' }}>Bank Name</label>
                    <div style={{ fontSize: '14px', color: '#1f2937', fontWeight: '500' }}>{selectedVendor.bankDetails.bankName}</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', display: 'block' }}>IFSC Code</label>
                    <div style={{ fontSize: '14px', color: '#1f2937', fontWeight: '500', fontFamily: 'monospace' }}>{selectedVendor.bankDetails.ifscCode}</div>
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', display: 'block' }}>Branch</label>
                    <div style={{ fontSize: '14px', color: '#1f2937', fontWeight: '500' }}>{selectedVendor.bankDetails.branch}</div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Approve Vendor Button */}
            <div style={{ 
              marginTop: '20px',
              padding: '16px',
              background: '#f8fafc',
              borderRadius: '8px',
              border: '1px solid #e5e7eb'
            }}>
              <button
                onClick={() => handleAuthorizationAction('approved')}
                disabled={selectedVendor.status === 'approved'}
                style={{
                  width: '100%',
                  padding: '14px 20px',
                  background: selectedVendor.status === 'approved' ? '#d1d5db' : 'linear-gradient(135deg, #10b981, #059669)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: selectedVendor.status === 'approved' ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.2s ease',
                  boxShadow: selectedVendor.status === 'approved' ? 'none' : '0 2px 4px rgba(16, 185, 129, 0.3)'
                }}
                onMouseEnter={(e) => {
                  if (selectedVendor.status !== 'approved') {
                    e.target.style.transform = 'translateY(-1px)';
                    e.target.style.boxShadow = '0 4px 8px rgba(16, 185, 129, 0.4)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedVendor.status !== 'approved') {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 2px 4px rgba(16, 185, 129, 0.3)';
                  }
                }}
              >
                <span className="material-icons" style={{ fontSize: '16px' }}>
                  check_circle
                </span>
                {selectedVendor.status === 'approved' ? 'Already Approved' : 'Approve Vendor'}
              </button>
            </div>
            </div>
          </div>
        )}
        </div>
      </div>
      </div>
    </div>
  );
}

export default VendorAuthorization;
