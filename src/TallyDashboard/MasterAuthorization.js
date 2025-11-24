/**
 * MasterAuthorization Component
 * 
 * This component manages master authorization requests and approvals.
 * It integrates with:
 * - Master Creation component (for new master requests)
 * - Payment Creation component (for approved masters)
 * - Backend APIs for data persistence
 * 
 * Integration Points:
 * - window.masterAuthorization.refreshMasters() - Refresh master list
 * - window.masterAuthorization.getApprovedMasters() - Get approved masters for payment creation
 * - window.masterAuthorization.getMasterById(id) - Get specific master details
 * 
 * API Endpoints Required:
 * - GET /api/master/authorization/list?companyGuid={guid} - List masters
 * - PUT /api/master/authorization/{id} - Update master authorization status
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

function MasterAuthorization({ onMasterSelect }) {
  console.log('🎯 MasterAuthorization component loading...');
  
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
  
  // State for master authorization
  const [masters, setMasters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMaster, setSelectedMaster] = useState(null);
  const [showMasterDetails, setShowMasterDetails] = useState(false);
  const [authorizationNotes, setAuthorizationNotes] = useState('');
  // Removed saving state - no loading indicators needed
  
  // Filter masters based on search term
  const filteredMasters = masters.filter(master => {
    const name = master.basicInfo?.name || master.name || '';
    const email = (master.contacts && master.contacts.length > 0 ? master.contacts[0].email : null) || master.email || '';
    const company = master.company || '';
    const searchLower = searchTerm.toLowerCase();
    return name.toLowerCase().includes(searchLower) ||
           email.toLowerCase().includes(searchLower) ||
           company.toLowerCase().includes(searchLower);
  });
  
  const loadMasters = useCallback(async () => {
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

      // API call to get master list using ledger-list endpoint
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
        throw new Error(errorData.message || 'Failed to fetch masters');
      }

      const result = await response.json();
      console.log('📊 Masters fetched successfully:', result);
      console.log('📊 Result structure:', {
        hasData: !!result.data,
        hasLedgers: !!result.ledgers,
        isArray: Array.isArray(result),
        hasLedgerData: !!result.ledgerData
      });
      
      // Transform API response to master format
      let masters = [];
      
      if (result.data && Array.isArray(result.data)) {
        masters = result.data;
      } else if (result.ledgers && Array.isArray(result.ledgers)) {
        masters = result.ledgers;
      } else if (Array.isArray(result)) {
        masters = result;
      } else if (result.ledgerData && Array.isArray(result.ledgerData)) {
        masters = result.ledgerData;
      }
      
      // Load master submissions from localStorage
      try {
        const submissions = localStorage.getItem('master_submissions');
        if (submissions) {
          const submissionList = JSON.parse(submissions);
          console.log('📝 Master submissions from localStorage:', submissionList);
          
          // Add submissions that match current session
          submissionList.forEach(submission => {
            if (submission.tallyloc_id === tallylocId && 
                submission.guid === guid &&
                submission.status === 'pending') {
              // Transform submission to match the new structure
              const transformedSubmission = {
                id: submission.id,
                company: companyName,
                status: 'pending',
                createdDate: submission.createdDate || new Date().toISOString().split('T')[0],
                authorizationDate: null,
                notes: '',
                basicInfo: {
                  name: submission.name || '',
                  alias: submission.alias || '',
                  group: submission.group || '',
                  narration: submission.narration || '',
                  description: submission.description || '',
                  maintainBalancesBillByBill: submission.maintainBalancesBillByBill || false,
                  defaultCreditPeriod: submission.defaultCreditPeriod || '',
                  checkCreditDaysDuringVoucher: submission.checkCreditDaysDuringVoucher || false,
                  specifyCreditLimit: submission.specifyCreditLimit || false,
                  creditLimitAmount: submission.creditLimitAmount || '',
                  overrideCreditLimitPostDated: submission.overrideCreditLimitPostDated || false,
                  inventoryValuesAffected: submission.inventoryValuesAffected || false,
                  priceLevelApplicable: submission.priceLevelApplicable || false,
                  priceLevel: submission.priceLevel || ''
                },
                addresses: submission.addresses && Array.isArray(submission.addresses) && submission.addresses.length > 0
                  ? submission.addresses
                  : submission.address ? [{
                      addressName: '',
                      address: (submission.address || '').replace(/\|/g, '\n'),
                      country: submission.country || 'India',
                      state: submission.state || '',
                      pincode: submission.pincode || '',
                      priorStateName: '',
                      phoneNumber: '',
                      countryISDCode: '+91',
                      mobileNumber: '',
                      contactPerson: '',
                      placeOfSupply: '',
                      gstRegistrationType: 'Regular',
                      applicableFrom: '',
                      mailingName: ''
                    }] : [],
                contacts: submission.contacts && Array.isArray(submission.contacts) && submission.contacts.length > 0
                  ? submission.contacts
                  : (submission.contactPerson || submission.email || submission.phone || submission.mobile) ? [{
                      contactPerson: submission.contactPerson || '',
                      email: submission.email || '',
                      phone: submission.phone || '',
                      mobile: submission.mobile || '',
                      countryISDCode: submission.countryISDCode || '+91',
                      isDefaultWhatsappNum: false
                    }] : [],
                bankDetails: submission.bankDetails && Array.isArray(submission.bankDetails) && submission.bankDetails.length > 0
                  ? submission.bankDetails
                  : (submission.accountNumber || submission.ifscCode || submission.bankName) ? [{
                      accountNumber: submission.accountNumber || '',
                      ifscCode: submission.ifscCode || '',
                      bankName: submission.bankName || '',
                      swiftCode: '',
                      paymentFavouring: submission.paymentFavouring || '',
                      bankId: '',
                      defaultTransactionType: 'Inter Bank Transfer',
                      setAsDefault: false,
                      branch: '',
                      accountType: ''
                    }] : [],
                statutory: {
                  taxType: submission.tax_type || (submission.gstNumber ? 'GST' : (submission.panNumber ? 'PAN' : '')),
                  gstNumber: submission.gstNumber || '',
                  gstType: submission.gstType || '',
                  panNumber: submission.panNumber || '',
                  gstDocumentLink: submission.gstDocumentLink || '',
                  panDocumentLink: submission.panDocumentLink || ''
                },
                emailCC: submission.emailCC || '',
                isSubmission: true // Flag to identify localStorage submissions
              };
              masters.push(transformedSubmission);
            }
          });
        }
      } catch (err) {
        console.error('Error loading master submissions:', err);
      }
      
      // Debug: Log sample master data structure
      if (masters.length > 0) {
        console.log('🔍 Sample master data from API:', masters[0]);
        console.log('🔍 Available fields in master data:', Object.keys(masters[0]));
        console.log('🔍 GST-related fields:', {
          gstType: masters[0].gstType,
          gst_type: masters[0].gst_type,
          gsttype: masters[0].gsttype,
          gstinNo: masters[0].gstinNo,
          gstin_no: masters[0].gstin_no,
          gstinno: masters[0].gstinno,
          gstNumber: masters[0].gstNumber
        });
      }

      // Transform API data to our master format - capturing all fields from MasterForm
      const transformedMasters = Array.isArray(masters) ? masters.map((master, index) => {
        // Basic Information
        const basicInfo = {
          name: master.name || master.ledger_name || master.ledgerName || 'Unknown Master',
          alias: master.alias || master.alias_name || '',
          group: master.group || master.groupName || master.group_name || '',
          narration: master.narration || '',
          description: master.description || '',
          maintainBalancesBillByBill: master.maintainBalancesBillByBill || false,
          defaultCreditPeriod: master.defaultCreditPeriod || '',
          checkCreditDaysDuringVoucher: master.checkCreditDaysDuringVoucher || false,
          specifyCreditLimit: master.specifyCreditLimit || false,
          creditLimitAmount: master.creditLimitAmount || '',
          overrideCreditLimitPostDated: master.overrideCreditLimitPostDated || false,
          inventoryValuesAffected: master.inventoryValuesAffected || false,
          priceLevelApplicable: master.priceLevelApplicable || false,
          priceLevel: master.priceLevel || master.priceLevelName || ''
        };

        // Address Information (supporting multiple addresses)
        const addresses = master.addresses && Array.isArray(master.addresses) && master.addresses.length > 0
          ? master.addresses.map(addr => ({
              addressName: addr.addressName || addr.address_name || '',
              address: (addr.address || addr.addresses || '').replace(/\|/g, '\n'),
              country: addr.country || addr.countryName || addr.country_name || 'India',
              state: addr.state || addr.stateName || addr.state_name || '',
              pincode: addr.pincode || addr.pin_code || addr.pinCode || '',
              priorStateName: addr.priorStateName || addr.prior_state_name || '',
              phoneNumber: addr.phoneNumber || addr.phone_number || '',
              countryISDCode: addr.countryISDCode || addr.country_isd_code || '+91',
              mobileNumber: addr.mobileNumber || addr.mobile_number || '',
              contactPerson: addr.contactPerson || addr.contact_person || '',
              placeOfSupply: addr.placeOfSupply || addr.place_of_supply || '',
              gstRegistrationType: addr.gstRegistrationType || addr.gst_registration_type || 'Regular',
              applicableFrom: addr.applicableFrom || addr.applicable_from || '',
              mailingName: addr.mailingName || addr.mailing_name || ''
            }))
          : (master.address || master.address1 || master.address_1) ? [{
              addressName: '',
              address: (master.address || master.address1 || master.address_1 || '').replace(/\|/g, '\n'),
              country: master.countryName || master.country || master.country_name || 'India',
              state: master.stateName || master.state || master.state_name || '',
              pincode: master.pincode || master.pin_code || master.pinCode || '',
              priorStateName: '',
              phoneNumber: '',
              countryISDCode: '+91',
              mobileNumber: '',
              contactPerson: '',
              placeOfSupply: '',
              gstRegistrationType: 'Regular',
              applicableFrom: '',
              mailingName: ''
            }] : [];

        // Contact Details (supporting multiple contacts)
        const contacts = master.contacts && Array.isArray(master.contacts) && master.contacts.length > 0
          ? master.contacts.map(contact => ({
              contactPerson: contact.contactPerson || contact.contact_person || contact.name || '',
              email: contact.email || contact.emailId || contact.email_id || '',
              phone: contact.phone || contact.phoneNumber || contact.phone_number || '',
              mobile: contact.mobile || contact.mobileNumber || contact.mobile_number || '',
              countryISDCode: contact.countryISDCode || contact.country_isd_code || '+91',
              isDefaultWhatsappNum: contact.isDefaultWhatsappNum || contact.is_default_whatsapp_num || false
            }))
          : (master.contactPerson || master.email || master.phone || master.mobile) ? [{
              contactPerson: master.contactPerson || master.contact_person || master.contactperson || '',
              email: master.email || master.emailid || master.email_id || master.emailId || '',
              phone: master.phone || master.phoneNo || master.phoneno || master.phone_no || master.phoneNumber || '',
              mobile: master.mobile || master.mobileNo || master.mobileno || master.mobile_no || master.mobileNumber || '',
              countryISDCode: master.countryISDCode || '+91',
              isDefaultWhatsappNum: false
            }] : [];

        // Bank Details (supporting multiple bank details)
        const bankDetails = master.bankDetails && Array.isArray(master.bankDetails) && master.bankDetails.length > 0
          ? master.bankDetails.map(bank => ({
              accountNumber: bank.accountNumber || bank.account_no || bank.accountnumber || '',
              ifscCode: bank.ifscCode || bank.ifsc_code || bank.ifsccode || '',
              bankName: bank.bankName || bank.bank_name || '',
              swiftCode: bank.swiftCode || bank.swift_code || '',
              paymentFavouring: bank.paymentFavouring || bank.payment_favouring || bank.favouringName || bank.favouring_name || '',
              bankId: bank.bankId || bank.bank_id || '',
              defaultTransactionType: bank.defaultTransactionType || bank.default_transaction_type || 'Inter Bank Transfer',
              setAsDefault: bank.setAsDefault || bank.set_as_default || false,
              branch: bank.branch || bank.branch_name || '',
              accountType: bank.accountType || bank.account_type || bank.accounttype || ''
            }))
          : (master.accountNo || master.ifscCode || master.bankName) ? [{
              accountNumber: master.accountNo || master.account_no || master.accountno || master.accountNumber || '',
              ifscCode: master.ifscCode || master.ifsc_code || master.ifsccode || '',
              bankName: master.bankName || master.bank_name || '',
              swiftCode: '',
              paymentFavouring: master.favouringName || master.favouring_name || master.favouringname || '',
              bankId: '',
              defaultTransactionType: 'Inter Bank Transfer',
              setAsDefault: false,
              branch: master.branch || master.branch_name || '',
              accountType: master.accountType || master.account_type || master.accounttype || ''
            }] : [];

        // Statutory Information
        const statutory = {
          taxType: master.tax_type || (master.gstinNo || master.gstin_no || master.gstinno) ? 'GST' : (master.panNo || master.pan_no || master.panno) ? 'PAN' : '',
          gstNumber: master.gstinNo || master.gstin_no || master.gstinno || master.gstNumber || '',
          gstType: master.gstType || master.gst_type || master.gsttype || '',
          panNumber: master.panNo || master.pan_no || master.panno || master.panNumber || '',
          gstDocumentLink: master.gstDocumentLink || master.gst_document_link || '',
          panDocumentLink: master.panDocumentLink || master.pan_document_link || ''
        };

        // Email CC
        const emailCC = master.emailCC || master.email_cc || '';

        return {
          id: master.id || master.ledger_id || master.ledgerId || index + 1,
          company: companyName,
          status: master.status || master.authorizationStatus || 'pending',
          createdDate: master.createdAt || master.created_at || master.date_created || master.createdDate || new Date().toISOString().split('T')[0],
          authorizationDate: null,
          notes: '',
          // All sections
          basicInfo,
          addresses,
          contacts,
          bankDetails,
          statutory,
          emailCC
        };
      }) : [];

      // Debug: Log transformed master data
      if (transformedMasters.length > 0) {
        console.log('🔍 Sample transformed master:', transformedMasters[0]);
        console.log('🔍 Transformed GST Type:', transformedMasters[0].gstType);
      }

      console.log('📊 Transformed masters:', transformedMasters.map(v => ({ name: v.name, status: v.status })));
      setMasters(transformedMasters);
    } catch (error) {
      console.error('Error loading masters:', error);
      setError('Failed to load masters. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [company]);
  
  // Load masters on component mount and when company changes
  useEffect(() => {
    if (company) {
      loadMasters();
    }
  }, [company, loadMasters]);
  
  // Listen for company changes from top bar
  useEffect(() => {
    const handleCompanyChange = () => {
      setMasters([]);
      setSelectedMaster(null);
      setShowMasterDetails(false);
      if (company) {
        loadMasters();
      }
    };

    window.addEventListener('companyChanged', handleCompanyChange);
    return () => window.removeEventListener('companyChanged', handleCompanyChange);
  }, [company]);

  // Listen for global refresh events
  useEffect(() => {
    const handleGlobalRefresh = () => {
      console.log('🔄 Global refresh triggered - refreshing master authorization list');
      console.log('🔄 Current company:', company);
      if (company) {
        console.log('🔄 Calling loadMasters...');
        loadMasters();
      } else {
        console.log('🔄 No company selected, skipping master refresh');
      }
    };

    const handleMasterSubmission = () => {
      console.log('📝 Master submission added - refreshing master authorization list');
      if (company) {
        loadMasters();
      }
    };

    window.addEventListener('globalRefresh', handleGlobalRefresh);
    window.addEventListener('masterSubmissionAdded', handleMasterSubmission);
    
    return () => {
      window.removeEventListener('globalRefresh', handleGlobalRefresh);
      window.removeEventListener('masterSubmissionAdded', handleMasterSubmission);
    };
  }, [company, loadMasters]);
  
  const handleMasterSelect = (master) => {
    if (onMasterSelect) {
      // If onMasterSelect callback is provided, use it to navigate to approval form
      onMasterSelect(master);
    } else {
      // Fallback to original behavior (show details in sidebar)
      setSelectedMaster(master);
      setShowMasterDetails(true);
      setAuthorizationNotes(master.notes || '');
    }
  };
  
  const handleAuthorizationAction = async (action) => {
    if (!selectedMaster) return;
    
    // Add confirmation for reject action
    const masterName = selectedMaster.basicInfo?.name || selectedMaster.name || 'Unknown';
    
    if (action === 'rejected') {
      const confirmReject = window.confirm(
        `Are you sure you want to reject master "${masterName}"?\n\n` +
        `This action cannot be undone. The master will be marked as rejected and removed from pending approvals.`
      );
      if (!confirmReject) {
        return;
      }
    }
    
    // Add confirmation for approve action
    if (action === 'approved') {
      const confirmApprove = window.confirm(
        `Are you sure you want to approve master "${masterName}"?\n\n` +
        `This will authorize the master and allow them to proceed with transactions.`
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

      const masterName = selectedMaster.basicInfo?.name || selectedMaster.name || 'Unknown';
      console.log('Updating master authorization:', {
        master: masterName,
        action: action,
        notes: authorizationNotes
      });

      // Check if the master is already authorized
      if (selectedMaster.status === 'approved') {
        console.log('Master is already authorized, skipping authorization...');
        alert('This master is already authorized. No action needed.');
        return;
      }
      
      // Create the master in Tally first (if not already created)
      console.log('Creating master in Tally before authorization...');
      try {
        const createResult = await createMasterInTally(selectedMaster);
        if (createResult?.existing) {
          console.log('Master already exists in Tally, proceeding with authorization...');
        } else {
          console.log('Master created successfully, proceeding with authorization...');
        }
      } catch (createError) {
        // If creation fails but master might already exist, log and continue
        console.warn('Master creation had issues, but proceeding with authorization:', createError.message);
        // Don't throw - allow authorization to proceed as master might already exist
      }

      // API call to update master authorization using ledger-auth endpoint
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
          name: selectedMaster.basicInfo?.name || selectedMaster.name || ''
        })
      });

      if (!response.ok) {
        let errorMessage = 'Failed to update master authorization';
        try {
          const errorData = await response.json();
          console.error('API Error Response:', errorData);
          
          // Provide specific error messages
          const masterName = selectedMaster.basicInfo?.name || selectedMaster.name || 'Unknown';
          if (errorData.message === 'Failed to authorize ledger') {
            errorMessage = `Failed to authorize master "${masterName}". Please try again or contact support.`;
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
      console.log('Master authorization updated:', result);
      
      // Update local state immediately
      console.log('Updating master status from', selectedMaster.status, 'to', action);
      setMasters(prev => prev.map(master => 
        master.id === selectedMaster.id 
          ? { 
              ...master, 
              status: action, 
              notes: authorizationNotes,
              authorizationDate: action !== 'pending' ? new Date().toISOString().split('T')[0] : null
            }
          : master
      ));
      
      setSelectedMaster(prev => ({
        ...prev,
        status: action,
        notes: authorizationNotes,
        authorizationDate: action !== 'pending' ? new Date().toISOString().split('T')[0] : null
      }));
      
      // Force a re-render by updating the masters state again
      setMasters(prev => [...prev]);
      
      // Show success message
      alert(`Master ${action === 'approved' ? 'approved' : 'rejected'} successfully!\n\nMaster: ${masterName}\nStatus: ${action.toUpperCase()}`);
      
      // Trigger global refresh to update master lists
      window.dispatchEvent(new CustomEvent('globalRefresh'));
      
      // Also refresh the master list directly
      setTimeout(() => {
        loadMasters();
      }, 500);
      
    } catch (error) {
      console.error('Error updating master authorization:', error);
      alert(`Failed to update master authorization: ${error.message}\n\nPlease try again.`);
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
  const refreshMasters = () => {
    loadMasters();
  };

  const getMasterById = (masterId) => {
    return masters.find(master => master.id === masterId);
  };

  const getApprovedMasters = () => {
    return masters.filter(master => master.status === 'approved');
  };

  const getRejectedMasters = () => {
    return masters.filter(master => master.status === 'rejected');
  };

  const getPendingMasters = () => {
    return masters.filter(master => master.status === 'pending');
  };

  // Function to create a master in Tally before authorization
  const createMasterInTally = async (masterData) => {
    try {
      const tallylocId = sessionStorage.getItem('tallyloc_id');
      const companyName = sessionStorage.getItem('company');
      const guid = sessionStorage.getItem('guid');

      if (!tallylocId || !companyName || !guid) {
        throw new Error('Missing required session data');
      }

      const masterName = masterData.basicInfo?.name || masterData.name || 'Unknown';
      console.log('Creating master in Tally before authorization:', masterName);

      // Check if master already exists in Tally
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
          value: (masterData.basicInfo?.name || masterData.name || '').trim()
        })
      });

      if (checkResponse.ok) {
        const checkResult = await checkResponse.json();
        if (checkResult.exists === true) {
          console.log('Master already exists in Tally, skipping creation:', masterName);
          return { success: true, message: 'Master already exists', existing: true };
        }
      }

      // Master doesn't exist, proceed with creation
      // Prepare the master data for API according to the ledger-create structure
      // Use the new structure with basicInfo, addresses, contacts, bankDetails, statutory
      const firstAddress = masterData.addresses && masterData.addresses.length > 0 ? masterData.addresses[0] : {};
      const firstContact = masterData.contacts && masterData.contacts.length > 0 ? masterData.contacts[0] : {};
      const firstBank = masterData.bankDetails && masterData.bankDetails.length > 0 ? masterData.bankDetails[0] : {};
      
      const apiData = {
        tallyloc_id: parseInt(tallylocId),
        company: companyName,
        guid: guid,
        ledgerData: {
          name: (masterData.basicInfo?.name || masterData.name || '').trim(),
          address: (firstAddress.address || masterData.address || '').replace(/\n/g, '|'), // Convert line breaks to pipe characters
          pincode: firstAddress.pincode || masterData.pincode || '',
          stateName: firstAddress.state || masterData.state || '',
          countryName: firstAddress.country || masterData.country || 'India',
          contactPerson: firstContact.contactPerson || masterData.contactPerson || '',
          phoneNo: firstContact.phone || masterData.phone || '',
          mobileNo: firstContact.mobile || masterData.mobile || '',
          email: firstContact.email || masterData.email || '',
          emailCC: masterData.emailCC || '',
          panNo: masterData.statutory?.panNumber || masterData.panNumber || '',
          gstinNo: masterData.statutory?.gstNumber || masterData.gstNumber || '',
          bankName: firstBank.bankName || masterData.bankDetails?.bankName || '',
          accountNo: firstBank.accountNumber || masterData.bankDetails?.accountNumber || '',
          ifscCode: firstBank.ifscCode || masterData.bankDetails?.ifscCode || ''
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
        // If it's a 400 error and master already exists, treat as success
        if (response.status === 400 && (errorData.message?.toLowerCase().includes('already exists') || 
            errorData.message?.toLowerCase().includes('duplicate'))) {
          console.log('Master already exists (from error response), proceeding with authorization');
          return { success: true, message: 'Master already exists', existing: true };
        }
        throw new Error(errorData.message || errorData.error || 'Failed to create master in Tally');
      }

      const result = await response.json();
      console.log('Master created in Tally:', result);
      
      // Check if result indicates failure
      if (result.success === false) {
        // If it's a duplicate/exists error, treat as success
        if (result.message?.toLowerCase().includes('already exists') || 
            result.message?.toLowerCase().includes('duplicate')) {
          console.log('Master already exists (from result), proceeding with authorization');
          return { success: true, message: 'Master already exists', existing: true };
        }
        throw new Error(result.message || 'Failed to create master in Tally');
      }
      
      return result;
    } catch (error) {
      console.error('Error creating master in Tally:', error);
      // If error indicates master already exists, treat as success
      if (error.message?.toLowerCase().includes('already exists') || 
          error.message?.toLowerCase().includes('duplicate')) {
        console.log('Master already exists (from error), proceeding with authorization');
        return { success: true, message: 'Master already exists', existing: true };
      }
      throw error;
    }
  };

  // Expose methods for integration with other components
  useEffect(() => {
    // Make methods available globally for integration
    window.masterAuthorization = {
      refreshMasters,
      getMasterById,
      getApprovedMasters,
      getRejectedMasters,
      getPendingMasters,
      masters,
      selectedMaster
    };
  }, [masters, selectedMaster]);
  
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
        Loading masters...
      </div>
    );
  }
  
  return (
    <div className="master-authorization-wrapper">
      <div className="master-authorization-container">
      <style>{`
        .master-authorization-wrapper {
          margin-top: 10px !important;
          padding-top: 5px !important;
          width: 100% !important;
          align-self: stretch !important;
          display: flex !important;
          flex-direction: column !important;
          background: #f5f5f5 !important;
          min-height: 100vh !important;
        }
        .master-authorization-container {
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
        .master-authorization-container * {
          box-sizing: border-box !important;
        }
        .master-authorization-main {
          display: flex !important;
          gap: 16px !important;
          height: calc(100% - 120px) !important;
          width: 100% !important;
          margin: 0 !important;
          padding: 20px !important;
          flex: 1 !important;
        }
        .master-authorization-card {
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
        .master-authorization-header {
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
        .master-authorization-master-list {
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
        .master-authorization-master-details {
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
        .master-authorization-search-bar {
          padding: 12px !important;
          border-bottom: 1px solid #e2e8f0 !important;
          background: white !important;
          margin: 0 !important;
        }
        .master-authorization-list-content {
          height: calc(100% - 50px) !important;
          overflow-y: auto !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        .master-authorization-details-content {
          padding: 8px !important;
          height: calc(100% - 50px) !important;
          overflow-y: auto !important;
          margin: 0 !important;
        }
        .master-authorization-details-header {
          display: flex !important;
          justify-content: space-between !important;
          align-items: center !important;
          padding: 12px !important;
          border-bottom: 1px solid #e2e8f0 !important;
          background: white !important;
          margin: 0 !important;
        }
        .master-authorization-error {
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
        .master-authorization-master-item {
          padding: 16px !important;
          border-bottom: 1px solid #e2e8f0 !important;
          cursor: pointer !important;
          transition: all 0.2s ease !important;
          margin: 0 !important;
          background: white !important;
        }
        .master-authorization-no-masters {
          padding: 20px 10px !important;
          text-align: center !important;
          color: #6b7280 !important;
          margin: 0 !important;
        }
        .master-authorization-section {
          margin-bottom: 10px !important;
          padding: 10px !important;
          border-radius: 8px !important;
          border: 1px solid #e5e7eb !important;
        }
        
        /* Override AdminHome styles that interfere with MasterAuthorization */
        .adminhome-main .master-authorization-container {
          align-items: stretch !important;
          justify-content: flex-start !important;
          width: 100% !important;
          height: 100% !important;
          padding: 10px 5px 5px 5px !important;
          margin: 0 !important;
          margin-top: 5px !important;
        }
        
        /* Ensure MasterAuthorization container overrides parent centering */
        .master-authorization-container {
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
        .master-authorization-container > * {
          margin: 0 !important;
          padding: 0 !important;
        }
        
        .master-authorization-container > *:not(.master-authorization-header):not(.master-authorization-error) {
          margin: 0 !important;
        }
        
        /* Material Icons Styling */
        .master-authorization-card .material-icons {
          padding: 4px !important;
          margin: 2px !important;
          border-radius: 4px !important;
          transition: all 0.2s ease !important;
        }
        
        .master-authorization-card .material-icons:hover {
          background-color: rgba(0, 0, 0, 0.05) !important;
        }
      `}</style>
      
      {error && (
        <div className="master-authorization-error">
          {error}
        </div>
      )}
      
      <div className="master-authorization-card">
        {/* Header */}
        <div className="master-authorization-header">
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
                Master Authorization
              </h1>
            </div>
            <p style={{
              fontSize: '16px',
              color: '#6b7280',
              margin: 0,
              fontWeight: '500'
            }}>
              Manage master authorization requests and approvals
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
                {masters.length} Masters
              </span>
            </div>
            <button
              onClick={loadMasters}
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
        
        <div className="master-authorization-main">
        {/* Master List */}
        <div className="master-authorization-master-list">
          {/* Search Bar */}
          <div className="master-authorization-search-bar">
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
                placeholder="Search masters by name, email, or company..."
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
          
          {/* Master List */}
          <div className="master-authorization-list-content">
            {filteredMasters.length === 0 ? (
              <div className="master-authorization-no-masters">
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
                  {searchTerm ? 'No masters found' : 'No authorization requests'}
                </h3>
                <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
                  {searchTerm 
                    ? 'Try adjusting your search criteria' 
                    : 'There are no master authorization requests at the moment. Masters will appear here when they need authorization.'
                  }
                </p>
              </div>
            ) : (
              filteredMasters.map(master => (
                <div
                  key={master.id}
                  onClick={() => handleMasterSelect(master)}
                  className="master-authorization-master-item"
                  style={{
                    backgroundColor: selectedMaster?.id === master.id ? '#f0f9ff' : 'white',
                    borderLeft: selectedMaster?.id === master.id ? '4px solid #3b82f6' : '4px solid transparent'
                  }}
                  onMouseEnter={(e) => {
                    if (selectedMaster?.id !== master.id) {
                      e.target.style.backgroundColor = '#f8fafc';
                      e.target.style.transform = 'translateX(4px)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedMaster?.id !== master.id) {
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
                        {master.basicInfo?.name || master.name || 'Unknown'}
                      </h3>
                      <p style={{
                        fontSize: '14px',
                        color: '#6b7280',
                        margin: '0 0 8px 0',
                        fontWeight: '500'
                      }}>
                        {master.contacts && master.contacts.length > 0 ? master.contacts[0].email : (master.email || 'N/A')}
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
                        backgroundColor: getStatusColor(master.status) + '15',
                        color: getStatusColor(master.status),
                        border: `1px solid ${getStatusColor(master.status)}30`,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}>
                        {getStatusText(master.status)}
                      </span>
                      <div style={{
                        fontSize: '11px',
                        color: '#9ca3af',
                        textAlign: 'right'
                      }}>
                        {master.authorizationDate ? 
                          `Auth: ${new Date(master.authorizationDate).toLocaleDateString()}` :
                          `Created: ${new Date(master.createdDate).toLocaleDateString()}`
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
                    {master.contacts && master.contacts.length > 0 ? (
                      <>
                        {master.contacts[0].contactPerson && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span className="material-icons" style={{ fontSize: '16px' }}>person</span>
                            <span>{master.contacts[0].contactPerson}</span>
                          </div>
                        )}
                        {master.contacts[0].phone && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span className="material-icons" style={{ fontSize: '16px' }}>phone</span>
                            <span>{master.contacts[0].phone}</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        {master.contactPerson && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span className="material-icons" style={{ fontSize: '16px' }}>person</span>
                            <span>{master.contactPerson}</span>
                          </div>
                        )}
                        {master.phone && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span className="material-icons" style={{ fontSize: '16px' }}>phone</span>
                            <span>{master.phone}</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        
        {/* Master Details */}
        {showMasterDetails && selectedMaster && (
          <div className="master-authorization-master-details">
            {/* Header */}
            <div className="master-authorization-details-header">
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
                    Master Details
                  </h2>
                      <p style={{
                        fontSize: '14px',
                        color: '#6b7280',
                        margin: 0,
                        fontWeight: '500'
                      }}>
                        {selectedMaster.basicInfo?.name || selectedMaster.name || 'Unknown'}
                      </p>
                </div>
              </div>
              <button
                onClick={() => setShowMasterDetails(false)}
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
            
            <div className="master-authorization-details-content">
            
            {/* Basic Information Section */}
            <div className="master-authorization-section" style={{ 
              background: '#f8fafc',
              border: '1px solid #e5e7eb',
              marginBottom: '16px'
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
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', display: 'block' }}>Master Name</label>
                    <div style={{ fontSize: '14px', color: '#1f2937', fontWeight: '500' }}>{selectedMaster.basicInfo?.name || selectedMaster.name || 'N/A'}</div>
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', display: 'block' }}>Alias</label>
                    <div style={{ fontSize: '14px', color: '#1f2937', fontWeight: '500' }}>{selectedMaster.basicInfo?.alias || 'N/A'}</div>
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', display: 'block' }}>Group</label>
                    <div style={{ fontSize: '14px', color: '#1f2937', fontWeight: '500' }}>{selectedMaster.basicInfo?.group || 'N/A'}</div>
                  </div>
                </div>
                {(selectedMaster.basicInfo?.narration || selectedMaster.basicInfo?.description) && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    {selectedMaster.basicInfo?.narration && (
                      <div>
                        <label style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', display: 'block' }}>Narration</label>
                        <div style={{ fontSize: '14px', color: '#1f2937', fontWeight: '500', whiteSpace: 'pre-wrap' }}>{selectedMaster.basicInfo.narration}</div>
                      </div>
                    )}
                    {selectedMaster.basicInfo?.description && (
                      <div>
                        <label style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', display: 'block' }}>Description</label>
                        <div style={{ fontSize: '14px', color: '#1f2937', fontWeight: '500', whiteSpace: 'pre-wrap' }}>{selectedMaster.basicInfo.description}</div>
                      </div>
                    )}
                  </div>
                )}
                {(selectedMaster.basicInfo?.maintainBalancesBillByBill || selectedMaster.basicInfo?.specifyCreditLimit || selectedMaster.basicInfo?.inventoryValuesAffected || selectedMaster.basicInfo?.priceLevelApplicable) && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '8px' }}>
                    {selectedMaster.basicInfo?.maintainBalancesBillByBill && (
                      <div>
                        <label style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', display: 'block' }}>Maintain Balances Bill-by-Bill</label>
                        <div style={{ fontSize: '14px', color: '#1f2937', fontWeight: '500' }}>Yes</div>
                        {selectedMaster.basicInfo?.defaultCreditPeriod && (
                          <div style={{ marginTop: '8px' }}>
                            <label style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', display: 'block' }}>Default Credit Period</label>
                            <div style={{ fontSize: '14px', color: '#1f2937', fontWeight: '500' }}>{selectedMaster.basicInfo.defaultCreditPeriod}</div>
                          </div>
                        )}
                        {selectedMaster.basicInfo?.checkCreditDaysDuringVoucher && (
                          <div style={{ marginTop: '8px', fontSize: '14px', color: '#1f2937', fontWeight: '500' }}>✓ Check for credit days during voucher entry</div>
                        )}
                      </div>
                    )}
                    {selectedMaster.basicInfo?.specifyCreditLimit && (
                      <div>
                        <label style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', display: 'block' }}>Credit Limit</label>
                        {selectedMaster.basicInfo?.creditLimitAmount && (
                          <div style={{ fontSize: '14px', color: '#1f2937', fontWeight: '500' }}>₹{selectedMaster.basicInfo.creditLimitAmount}</div>
                        )}
                        {selectedMaster.basicInfo?.overrideCreditLimitPostDated && (
                          <div style={{ marginTop: '8px', fontSize: '14px', color: '#1f2937', fontWeight: '500' }}>✓ Override credit limit using post-dated transactions</div>
                        )}
                      </div>
                    )}
                    {selectedMaster.basicInfo?.inventoryValuesAffected && (
                      <div>
                        <label style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', display: 'block' }}>Inventory Values Affected</label>
                        <div style={{ fontSize: '14px', color: '#1f2937', fontWeight: '500' }}>Yes</div>
                      </div>
                    )}
                    {selectedMaster.basicInfo?.priceLevelApplicable && selectedMaster.basicInfo?.priceLevel && (
                      <div>
                        <label style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', display: 'block' }}>Price Level</label>
                        <div style={{ fontSize: '14px', color: '#1f2937', fontWeight: '500' }}>{selectedMaster.basicInfo.priceLevel}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Address Section */}
            {selectedMaster.addresses && selectedMaster.addresses.length > 0 && (
              <div className="master-authorization-section" style={{ 
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                marginBottom: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                  <span className="material-icons" style={{ fontSize: '20px', color: '#10b981' }}>location_on</span>
                  <h3 style={{
                    fontSize: '16px',
                    fontWeight: '600',
                    color: '#1f2937',
                    margin: 0
                  }}>
                    Address Details
                  </h3>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {selectedMaster.addresses.map((addr, index) => (
                    <div key={index} style={{
                      padding: '16px',
                      background: 'white',
                      borderRadius: '8px',
                      border: '1px solid #d1fae5'
                    }}>
                      <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '12px' }}>
                        {addr.addressName ? `Address ${index + 1} - ${addr.addressName}` : `Address ${index + 1}`}
                      </h4>
                      <div style={{ display: 'grid', gap: '12px' }}>
                        {addr.address && (
                          <div>
                            <label style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', display: 'block' }}>Address</label>
                            <div style={{ fontSize: '14px', color: '#1f2937', fontWeight: '500', whiteSpace: 'pre-wrap' }}>{addr.address}</div>
                          </div>
                        )}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                          {addr.country && (
                            <div>
                              <label style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', display: 'block' }}>Country</label>
                              <div style={{ fontSize: '14px', color: '#1f2937', fontWeight: '500' }}>{addr.country}</div>
                            </div>
                          )}
                          {addr.state && (
                            <div>
                              <label style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', display: 'block' }}>State</label>
                              <div style={{ fontSize: '14px', color: '#1f2937', fontWeight: '500' }}>{addr.state}</div>
                            </div>
                          )}
                          {addr.pincode && (
                            <div>
                              <label style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', display: 'block' }}>Pincode</label>
                              <div style={{ fontSize: '14px', color: '#1f2937', fontWeight: '500' }}>{addr.pincode}</div>
                            </div>
                          )}
                        </div>
                        {(addr.priorStateName || addr.placeOfSupply || addr.gstRegistrationType) && (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                            {addr.priorStateName && (
                              <div>
                                <label style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', display: 'block' }}>Prior State</label>
                                <div style={{ fontSize: '14px', color: '#1f2937', fontWeight: '500' }}>{addr.priorStateName}</div>
                              </div>
                            )}
                            {addr.placeOfSupply && (
                              <div>
                                <label style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', display: 'block' }}>Place of Supply</label>
                                <div style={{ fontSize: '14px', color: '#1f2937', fontWeight: '500' }}>{addr.placeOfSupply}</div>
                              </div>
                            )}
                            {addr.gstRegistrationType && (
                              <div>
                                <label style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', display: 'block' }}>GST Registration Type</label>
                                <div style={{ fontSize: '14px', color: '#1f2937', fontWeight: '500' }}>{addr.gstRegistrationType}</div>
                              </div>
                            )}
                          </div>
                        )}
                        {(addr.phoneNumber || addr.mobileNumber || addr.contactPerson) && (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                            {addr.phoneNumber && (
                              <div>
                                <label style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', display: 'block' }}>Phone</label>
                                <div style={{ fontSize: '14px', color: '#1f2937', fontWeight: '500' }}>{addr.countryISDCode} {addr.phoneNumber}</div>
                              </div>
                            )}
                            {addr.mobileNumber && (
                              <div>
                                <label style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', display: 'block' }}>Mobile</label>
                                <div style={{ fontSize: '14px', color: '#1f2937', fontWeight: '500' }}>{addr.countryISDCode} {addr.mobileNumber}</div>
                              </div>
                            )}
                            {addr.contactPerson && (
                              <div>
                                <label style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', display: 'block' }}>Contact Person</label>
                                <div style={{ fontSize: '14px', color: '#1f2937', fontWeight: '500' }}>{addr.contactPerson}</div>
                              </div>
                            )}
                          </div>
                        )}
                        {(addr.mailingName || addr.applicableFrom) && (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            {addr.mailingName && (
                              <div>
                                <label style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', display: 'block' }}>Mailing Name</label>
                                <div style={{ fontSize: '14px', color: '#1f2937', fontWeight: '500' }}>{addr.mailingName}</div>
                              </div>
                            )}
                            {addr.applicableFrom && (
                              <div>
                                <label style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', display: 'block' }}>Applicable From</label>
                                <div style={{ fontSize: '14px', color: '#1f2937', fontWeight: '500' }}>{addr.applicableFrom}</div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Contact Details Section */}
            {selectedMaster.contacts && selectedMaster.contacts.length > 0 && (
              <div className="master-authorization-section" style={{ 
                background: '#fef3c7',
                border: '1px solid #fde68a',
                marginBottom: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                  <span className="material-icons" style={{ fontSize: '20px', color: '#f59e0b' }}>contact_phone</span>
                  <h3 style={{
                    fontSize: '16px',
                    fontWeight: '600',
                    color: '#1f2937',
                    margin: 0
                  }}>
                    Contact Details
                  </h3>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {selectedMaster.contacts.map((contact, index) => (
                    <div key={index} style={{
                      padding: '16px',
                      background: 'white',
                      borderRadius: '8px',
                      border: '1px solid #fde68a'
                    }}>
                      <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '12px' }}>
                        {index === 0 ? 'Primary Contact' : `Contact ${index + 1}`}
                      </h4>
                      <div style={{ display: 'grid', gap: '12px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          {contact.contactPerson && (
                            <div>
                              <label style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', display: 'block' }}>Contact Person</label>
                              <div style={{ fontSize: '14px', color: '#1f2937', fontWeight: '500' }}>{contact.contactPerson}</div>
                            </div>
                          )}
                          {contact.email && (
                            <div>
                              <label style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', display: 'block' }}>Email</label>
                              <div style={{ fontSize: '14px', color: '#1f2937', fontWeight: '500' }}>{contact.email}</div>
                            </div>
                          )}
                        </div>
                        {(contact.phone || contact.mobile) && (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            {contact.phone && (
                              <div>
                                <label style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', display: 'block' }}>Phone</label>
                                <div style={{ fontSize: '14px', color: '#1f2937', fontWeight: '500' }}>{contact.countryISDCode} {contact.phone}</div>
                              </div>
                            )}
                            {contact.mobile && (
                              <div>
                                <label style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', display: 'block' }}>Mobile</label>
                                <div style={{ fontSize: '14px', color: '#1f2937', fontWeight: '500' }}>{contact.countryISDCode} {contact.mobile}</div>
                              </div>
                            )}
                          </div>
                        )}
                        {contact.isDefaultWhatsappNum && (
                          <div style={{ fontSize: '14px', color: '#1f2937', fontWeight: '500' }}>
                            ✓ Set as Default WhatsApp Number
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {selectedMaster.emailCC && (
                    <div style={{
                      padding: '16px',
                      background: 'white',
                      borderRadius: '8px',
                      border: '1px solid #fde68a'
                    }}>
                      <label style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', display: 'block' }}>Email CC</label>
                      <div style={{ fontSize: '14px', color: '#1f2937', fontWeight: '500' }}>{selectedMaster.emailCC}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Statutory Information Section */}
            {selectedMaster.statutory && (selectedMaster.statutory.gstNumber || selectedMaster.statutory.panNumber) && (
              <div className="master-authorization-section" style={{ 
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                marginBottom: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                  <span className="material-icons" style={{ fontSize: '20px', color: '#10b981' }}>description</span>
                  <h3 style={{
                    fontSize: '16px',
                    fontWeight: '600',
                    color: '#1f2937',
                    margin: 0
                  }}>
                    Statutory Information
                  </h3>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  {selectedMaster.statutory.gstNumber && (
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', display: 'block' }}>GST Number</label>
                      <div style={{ fontSize: '14px', color: '#1f2937', fontWeight: '500', fontFamily: 'monospace' }}>{selectedMaster.statutory.gstNumber}</div>
                      {selectedMaster.statutory.gstType && (
                        <div style={{ marginTop: '4px', fontSize: '12px', color: '#6b7280' }}>Type: {selectedMaster.statutory.gstType}</div>
                      )}
                      {selectedMaster.statutory.gstDocumentLink && (
                        <button
                          onClick={() => window.open(selectedMaster.statutory.gstDocumentLink, '_blank')}
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
                  )}
                  {selectedMaster.statutory.panNumber && (
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', display: 'block' }}>PAN Number</label>
                      <div style={{ fontSize: '14px', color: '#1f2937', fontWeight: '500', fontFamily: 'monospace' }}>{selectedMaster.statutory.panNumber}</div>
                      {selectedMaster.statutory.panDocumentLink && (
                        <button
                          onClick={() => window.open(selectedMaster.statutory.panDocumentLink, '_blank')}
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
                  )}
                </div>
              </div>
            )}
            
            {/* Bank Details Section */}
            {selectedMaster.bankDetails && selectedMaster.bankDetails.length > 0 && (
              <div className="master-authorization-section" style={{ 
                background: '#fef3c7',
                border: '1px solid #fde68a',
                marginBottom: '16px'
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {selectedMaster.bankDetails.map((bank, index) => (
                    <div key={index} style={{
                      padding: '16px',
                      background: 'white',
                      borderRadius: '8px',
                      border: '1px solid #fde68a'
                    }}>
                      <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '12px' }}>
                        Bank Details {index + 1} {bank.setAsDefault && <span style={{ fontSize: '12px', color: '#10b981', fontWeight: '500' }}>(Default)</span>}
                      </h4>
                      <div style={{ display: 'grid', gap: '12px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          {bank.accountNumber && (
                            <div>
                              <label style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', display: 'block' }}>Account Number</label>
                              <div style={{ fontSize: '14px', color: '#1f2937', fontWeight: '500', fontFamily: 'monospace' }}>{bank.accountNumber}</div>
                            </div>
                          )}
                          {bank.bankName && (
                            <div>
                              <label style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', display: 'block' }}>Bank Name</label>
                              <div style={{ fontSize: '14px', color: '#1f2937', fontWeight: '500' }}>{bank.bankName}</div>
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          {bank.ifscCode && (
                            <div>
                              <label style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', display: 'block' }}>IFSC Code</label>
                              <div style={{ fontSize: '14px', color: '#1f2937', fontWeight: '500', fontFamily: 'monospace' }}>{bank.ifscCode}</div>
                            </div>
                          )}
                          {bank.branch && (
                            <div>
                              <label style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', display: 'block' }}>Branch</label>
                              <div style={{ fontSize: '14px', color: '#1f2937', fontWeight: '500' }}>{bank.branch}</div>
                            </div>
                          )}
                        </div>
                        {(bank.swiftCode || bank.paymentFavouring || bank.defaultTransactionType) && (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                            {bank.swiftCode && (
                              <div>
                                <label style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', display: 'block' }}>Swift Code</label>
                                <div style={{ fontSize: '14px', color: '#1f2937', fontWeight: '500', fontFamily: 'monospace' }}>{bank.swiftCode}</div>
                              </div>
                            )}
                            {bank.paymentFavouring && (
                              <div>
                                <label style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', display: 'block' }}>Payment Favouring</label>
                                <div style={{ fontSize: '14px', color: '#1f2937', fontWeight: '500' }}>{bank.paymentFavouring}</div>
                              </div>
                            )}
                            {bank.defaultTransactionType && (
                              <div>
                                <label style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', display: 'block' }}>Transaction Type</label>
                                <div style={{ fontSize: '14px', color: '#1f2937', fontWeight: '500' }}>{bank.defaultTransactionType}</div>
                              </div>
                            )}
                          </div>
                        )}
                        {bank.accountType && (
                          <div>
                            <label style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', display: 'block' }}>Account Type</label>
                            <div style={{ fontSize: '14px', color: '#1f2937', fontWeight: '500' }}>{bank.accountType}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Approve Master Button */}
            <div style={{ 
              marginTop: '20px',
              padding: '16px',
              background: '#f8fafc',
              borderRadius: '8px',
              border: '1px solid #e5e7eb'
            }}>
              <button
                onClick={() => handleAuthorizationAction('approved')}
                disabled={selectedMaster.status === 'approved'}
                style={{
                  width: '100%',
                  padding: '14px 20px',
                  background: selectedMaster.status === 'approved' ? '#d1d5db' : 'linear-gradient(135deg, #10b981, #059669)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: selectedMaster.status === 'approved' ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.2s ease',
                  boxShadow: selectedMaster.status === 'approved' ? 'none' : '0 2px 4px rgba(16, 185, 129, 0.3)'
                }}
                onMouseEnter={(e) => {
                  if (selectedMaster.status !== 'approved') {
                    e.target.style.transform = 'translateY(-1px)';
                    e.target.style.boxShadow = '0 4px 8px rgba(16, 185, 129, 0.4)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedMaster.status !== 'approved') {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 2px 4px rgba(16, 185, 129, 0.3)';
                  }
                }}
              >
                <span className="material-icons" style={{ fontSize: '16px' }}>
                  check_circle
                </span>
                {selectedMaster.status === 'approved' ? 'Already Approved' : 'Approve Master'}
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

export default MasterAuthorization;