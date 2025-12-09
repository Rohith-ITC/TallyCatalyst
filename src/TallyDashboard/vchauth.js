import React, { useState, useEffect, useMemo, useRef } from 'react';
import { apiGet, apiPost } from '../utils/apiUtils';
import VoucherDetailsModal from './components/VoucherDetailsModal';

function VoucherAuthorization() {
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedVouchers, setSelectedVouchers] = useState([]);
  const [authorizing, setAuthorizing] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [itemsPerPage] = useState(10);
  const [selectedVoucherType, setSelectedVoucherType] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('Pending'); // Default to Pending only
  const [selectedParty, setSelectedParty] = useState('all');
  const [showVoucherDetails, setShowVoucherDetails] = useState(false);
  const [viewingVoucher, setViewingVoucher] = useState(null);
  const [viewingVoucherMasterId, setViewingVoucherMasterId] = useState(null);
  const [activeTab, setActiveTab] = useState('pending'); // 'pending', 'authorized', 'rejected'
  const [showRejectNarrationModal, setShowRejectNarrationModal] = useState(false);
  const [rejectNarration, setRejectNarration] = useState('');
  const [voucherToReject, setVoucherToReject] = useState(null);
  const [rejectingMultiple, setRejectingMultiple] = useState(false);
  const [showAuthorizeNarrationModal, setShowAuthorizeNarrationModal] = useState(false);
  const [authorizeNarration, setAuthorizeNarration] = useState('');
  const [voucherToAuthorize, setVoucherToAuthorize] = useState(null);
  const [authorizingMultiple, setAuthorizingMultiple] = useState(false);
  const [showVoucherActivity, setShowVoucherActivity] = useState(false);
  const [voucherActivityData, setVoucherActivityData] = useState(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [progressState, setProgressState] = useState({
    active: false,
    total: 0,
    completed: 0,
    message: '',
    elapsedSeconds: 0
  });
  const progressTimerRef = useRef(null);
  const progressStartRef = useRef(null);

  // Get default date range (last 7 days)
  const getDefaultDateRange = () => {
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const formatDate = (date) => {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    };
    
    return {
      start: formatDate(sevenDaysAgo),
      end: formatDate(now)
    };
  };

  // Set default date range on component mount
  useEffect(() => {
    const defaultDates = getDefaultDateRange();
    setFromDate(defaultDates.start);
    setToDate(defaultDates.end);
    setDateRange(defaultDates);
  }, []);

  // Load vouchers on mount only (initial load with default dates)
  // After mount, user must click Submit button to refresh with new dates
  useEffect(() => {
    const tallyloc_id = sessionStorage.getItem('tallyloc_id');
    const company = sessionStorage.getItem('company');
    const guid = sessionStorage.getItem('guid');
    
    // Only load on initial mount when dates are available
    // This ensures we load once with default dates, then user must click Submit for changes
    if (tallyloc_id && company && guid && fromDate && toDate) {
      const loadData = async () => {
        await loadVouchers();
      };
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array - only run once on mount, not when dates change

  // Helper function to get company info from sessionStorage
  const getCompanyInfo = () => {
    const tallyloc_id = sessionStorage.getItem('tallyloc_id');
    const company = sessionStorage.getItem('company');
    const guid = sessionStorage.getItem('guid');
    
    if (!tallyloc_id || !company || !guid) {
      throw new Error('Company information not found. Please select a company first.');
    }
    
    return { tallyloc_id, company, guid };
  };

  // Helper function to convert YYYY-MM-DD to YYYYMMDD
  const formatDateForAPI = (dateString) => {
    return dateString.replace(/-/g, '');
  };

  // Helper function to parse date from DD-MMM-YY to YYYY-MM-DD
  const parseDateFromAPI = (dateString) => {
    // Parse date string like "1-Feb-25"
    const parts = dateString.split('-');
    if (parts.length !== 3) return dateString;
    
    const day = parseInt(parts[0]);
    const monthName = parts[1];
    const year = parseInt(parts[2]) + 2000; // Assuming 25 = 2025
    
    const monthMap = {
      'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
      'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
      'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
    };
    
    const month = monthMap[monthName] || '01';
    const formattedDay = String(day).padStart(2, '0');
    
    return `${year}-${month}-${formattedDay}`;
  };

  // Helper function to format date back to DD-MMM-YY for display
  const formatDateForDisplay = (dateString) => {
    if (!dateString) return '';
    
    // If already in DD-MMM-YY format, return as is
    if (dateString.includes('-') && dateString.length < 15) {
      return dateString;
    }
    
    // Parse YYYY-MM-DD format
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    
    const day = date.getDate();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear().toString().slice(-2);
    
    return `${day}-${month}-${year}`;
  };

  // Helper function to parse amount from string with commas
  const parseAmount = (amountString) => {
    if (!amountString) return 0;
    return parseFloat(amountString.replace(/,/g, ''));
  };

  // Helper function to transform API response to component format
  const transformVoucherData = (apiVouchers, chunkIndex = 0) => {
    return apiVouchers.map((v, index) => {
      // Keep date in original format for display (DD-MMM-YY)
      const date = v.DATE;
      
      // Parse date for filtering
      const dateForFilter = parseDateFromAPI(v.DATE);
      
      // Extract debit and credit amounts
      const debitAmount = parseAmount(v.DEBITAMT);
      const creditAmount = parseAmount(v.CREDITAMT);
      
      // Extract party name - PARTICULARS contains the party name
      let customer = null;
      let supplier = null;
      const partyName = v.PARTICULARS;
      
      // Determine if it's a customer or supplier based on voucher type
      if (v.VCHTYPE === 'Sales' || v.VCHTYPE === 'Receipt') {
        customer = partyName;
      } else if (v.VCHTYPE === 'Purchase' || v.VCHTYPE === 'Payment') {
        supplier = partyName;
      } else {
        // For journal and other types, use as customer
        customer = partyName;
      }
      
      // Determine status based on VOUCHER_ACTIVITY_HISTORY
      // Check the last entry in the activity history to determine current status
      let status = 'Pending';
      let rejectionNarration = '';
      let authorizationNarration = '';
      
      // Check if VOUCHER_ACTIVITY_HISTORY exists and has entries
      const activityHistory = v.VOUCHER_ACTIVITY_HISTORY || [];
      
      if (activityHistory.length > 0) {
        // Get the last (most recent) entry in the history
        const lastActivity = activityHistory[activityHistory.length - 1];
        const lastStatus = lastActivity.apprv_status || '';
        
        if (lastStatus.toLowerCase() === 'approved') {
          status = 'Authorized';
          authorizationNarration = lastActivity.comments || '';
        } else if (lastStatus.toLowerCase() === 'rejected') {
          status = 'Rejected';
          rejectionNarration = lastActivity.comments || '';
        }
      } else {
        // If no history, default to 'Pending'
        status = 'Pending';
      }
      
      // Extract narration from NARRATION or CP_Temp7 field
      const narration = v.NARRATION || v.narration || v.Narration || v.CP_Temp7 || v.cp_temp7 || '';
      
      return {
        id: v.MASTERID || `temp-${chunkIndex}-${index}`,
        masterId: v.MASTERID,
        voucherNumber: v.VCHNO || `VCH-${index + 1}`,
        date: date,
        dateForFilter: dateForFilter,
        type: v.VCHTYPE,
        amount: Math.max(debitAmount, creditAmount),
        debitAmount: debitAmount,
        creditAmount: creditAmount,
        customer: customer,
        supplier: supplier,
        status: status,
        rejectionNarration: rejectionNarration,
        authorizationNarration: authorizationNarration,
        description: v.PARTICULARS,
        narration: narration, // Add narration field
        rawData: v // Keep raw data for authorization
      };
    });
  };

  const formatDateForRangeLabel = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return dateString;
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}-${month}-${date.getFullYear()}`;
  };

  const formatDateForAPIInput = (dateObj) => {
    return `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
  };

  const splitDateRangeIntoChunks = (start, end, chunkSize = 2) => {
    if (!start || !end) return [];
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return [];

    const ranges = [];
    let cursor = new Date(startDate);
    while (cursor <= endDate) {
      const chunkStart = new Date(cursor);
      const chunkEnd = new Date(cursor);
      chunkEnd.setDate(chunkEnd.getDate() + chunkSize - 1);
      if (chunkEnd > endDate) {
        chunkEnd.setTime(endDate.getTime());
      }
      ranges.push({
        start: formatDateForAPIInput(chunkStart),
        end: formatDateForAPIInput(chunkEnd)
      });
      cursor = new Date(chunkEnd);
      cursor.setDate(cursor.getDate() + 1);
    }
    return ranges;
  };

  const updateProgressTimer = (active) => {
    if (active) {
      progressStartRef.current = Date.now();
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = setInterval(() => {
        setProgressState((prev) => {
          if (!prev.active) return prev;
          const elapsed = Math.floor((Date.now() - (progressStartRef.current || Date.now())) / 1000);
          return { ...prev, elapsedSeconds: elapsed };
        });
      }, 1000);
    } else {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      clearInterval(progressTimerRef.current);
    };
  }, []);

  const loadVouchers = async () => {
    setLoading(true);
    setError('');
    try {
      // Get company info from sessionStorage
      const companyInfo = getCompanyInfo();

      const ranges = splitDateRangeIntoChunks(fromDate, toDate, 2);

      if (ranges.length === 0) {
        setError('Invalid date range.');
        setVouchers([]);
        setTotalPages(1);
        return;
      }

      setProgressState({
        active: true,
        total: ranges.length,
        completed: 0,
        message: 'Fetching data from Tally server…',
        elapsedSeconds: 0
      });
      updateProgressTimer(true);

      const aggregatedMap = new Map();
      let totalFromChunks = 0;

      for (let i = 0; i < ranges.length; i += 1) {
        const range = ranges[i];
        const label = `${formatDateForRangeLabel(range.start)} to ${formatDateForRangeLabel(range.end)}`;
        setProgressState((prev) => ({
          ...prev,
          message: `Fetching data from Tally server…`
        }));

        const payload = {
          tallyloc_id: parseInt(companyInfo.tallyloc_id, 10),
          company: companyInfo.company,
          guid: companyInfo.guid,
          fromdate: parseInt(formatDateForAPI(range.start), 10),
          todate: parseInt(formatDateForAPI(range.end), 10)
        };

        console.log('🔍 Loading vouchers with payload:', payload);

        const response = await apiPost('/api/tally/pend-vch-auth', payload);

        console.log('📋 API Chunk Response:', response);
        
        // Debug: Check if narration fields are in the response
        if (response && response.pendingVchAuth && response.pendingVchAuth.length > 0) {
          const sampleVoucher = response.pendingVchAuth[0];
          console.log('🔍 Voucher Auth - Sample voucher keys:', Object.keys(sampleVoucher));
          console.log('🔍 Voucher Auth - Checking for narration fields:');
          const narrationFields = ['CP_Temp7', 'cp_temp7', 'NARRATION', 'narration', 'Narration'];
          narrationFields.forEach(field => {
            if (sampleVoucher.hasOwnProperty(field)) {
              console.log(`  ✅ Found ${field}:`, sampleVoucher[field]);
            }
          });
          // Check for any field that might contain narration
          Object.keys(sampleVoucher).forEach(key => {
            const lowerKey = key.toLowerCase();
            if (lowerKey.includes('narr') || lowerKey.includes('temp') || lowerKey.includes('note') || lowerKey.includes('desc')) {
              console.log(`  🔍 Potential narration field: ${key} =`, sampleVoucher[key]);
            }
          });
        }

        if (response && response.pendingVchAuth) {
          const transformedVouchers = transformVoucherData(response.pendingVchAuth, i);
          transformedVouchers.forEach((voucher) => {
            const key = voucher.masterId || voucher.id;
            if (!aggregatedMap.has(key)) {
              aggregatedMap.set(key, voucher);
            }
          });
          totalFromChunks += response.count || transformedVouchers.length;
        }

        setProgressState((prev) => ({
          ...prev,
          completed: i + 1
        }));
      }

      const aggregated = Array.from(aggregatedMap.values());

      if (aggregated.length > 0) {
        setVouchers(aggregated);
        const totalVouchers = totalFromChunks || aggregated.length;
        setTotalPages(Math.ceil(totalVouchers / itemsPerPage));
      } else {
        setVouchers([]);
        setTotalPages(1);
      }
      setSelectedVouchers([]);
    } catch (err) {
      console.error('Error loading vouchers:', err);
      setError(err.message || 'Error loading vouchers');
      setVouchers([]);
    } finally {
      updateProgressTimer(false);
      setProgressState({ active: false, total: 0, completed: 0, message: '', elapsedSeconds: 0 });
      setLoading(false);
    }
  };

  const handleVoucherSelect = (voucherId) => {
    setSelectedVouchers(prev => {
      if (prev.includes(voucherId)) {
        return prev.filter(id => id !== voucherId);
      } else {
        return [...prev, voucherId];
      }
    });
  };

  // Handle clicking on a voucher row to view details
  const handleVoucherView = (voucher) => {
    // Store the voucher for status checking and the masterId for the modal
    setViewingVoucher(voucher);
    setViewingVoucherMasterId(voucher.masterId);
    setShowVoucherDetails(true);
  };

  // Handle viewing voucher activity history
  const handleViewVoucherActivity = (voucher) => {
    setVoucherActivityData(voucher);
    setShowVoucherActivity(true);
  };

  const handleSelectAll = () => {
    if (selectedVouchers.length === filteredVouchers.length) {
      setSelectedVouchers([]);
    } else {
      setSelectedVouchers(filteredVouchers.map(v => v.id));
    }
  };

  // Helper function to convert date from DD-MMM-YY to YYYYMMDD
  const convertDateToYYYYMMDD = (dateString) => {
    const parts = dateString.split('-');
    if (parts.length !== 3) return '';
    
    const day = parts[0];
    const monthName = parts[1];
    const year = parts[2];
    
    const monthMap = {
      'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
      'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
      'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
    };
    
    const month = monthMap[monthName] || '01';
    const fullYear = '20' + year; // Assuming 25 -> 2025
    const formattedDay = day.padStart(2, '0');
    
    return `${fullYear}${month}${formattedDay}`;
  };

  // Helper function to authorize a single voucher
  const authorizeSingleVoucher = async (voucher) => {
    if (!voucher) return false;

    try {
      // Get company info
      const companyInfo = getCompanyInfo();
      
      const dateYYMMDD = convertDateToYYYYMMDD(voucher.date);
      
      // Extract narration from voucher if available
      const narration = voucher.narration || '';
      
      console.log('📝 Authorizing voucher:', {
        masterid: voucher.masterId,
        date: dateYYMMDD,
        narration
      });
      
      // Payload format: {"tallyloc_id":88,"company":"Data Lynk","guid":"f0650bb9-d9ad-4034-93e5-0d27e8286d39","date":20251127,"masterid":62, "narration":"testing", "comments":""}
      const response = await apiPost('/api/tally/vchauth/auth', {
        tallyloc_id: parseInt(companyInfo.tallyloc_id),
        company: companyInfo.company,
        guid: companyInfo.guid,
        date: parseInt(dateYYMMDD),
        masterid: parseInt(voucher.masterId),
        narration: narration,
        comments: '' // No comments for authorization
      });
      
      if (response && response.success) {
        // Update voucher status locally
        setVouchers(prevVouchers => 
          prevVouchers.map(v => 
            v.id === voucher.id || v.masterId === voucher.masterId
              ? { ...v, status: 'Authorized', authorizationNarration: '' }
              : v
          )
        );
      }
      
      return response && response.success;
    } catch (err) {
      console.error('Error authorizing voucher:', err);
      throw err;
    }
  };

  // Helper function to reject a single voucher
  const rejectSingleVoucher = async (voucher, comments = '') => {
    if (!voucher) return false;

    try {
      // Get company info
      const companyInfo = getCompanyInfo();
      
      const dateYYMMDD = convertDateToYYYYMMDD(voucher.date);
      
      // Extract narration from voucher if available
      const narration = voucher.narration || '';
      
      console.log('📝 Rejecting voucher:', {
        masterid: voucher.masterId,
        date: dateYYMMDD,
        narration,
        comments
      });
      
      // Payload format: {"tallyloc_id":88,"company":"Data Lynk","guid":"f0650bb9-d9ad-4034-93e5-0d27e8286d39","date":20251127,"masterid":62, "narration":"testing", "comments":"qty issue"}
      const response = await apiPost('/api/tally/vchauth/reject', {
        tallyloc_id: parseInt(companyInfo.tallyloc_id),
        company: companyInfo.company,
        guid: companyInfo.guid,
        date: parseInt(dateYYMMDD),
        masterid: parseInt(voucher.masterId),
        narration: narration,
        comments: comments || ''
      });
      
      if (response && response.success) {
        // Update voucher status locally
        setVouchers(prevVouchers => 
          prevVouchers.map(v => 
            v.id === voucher.id || v.masterId === voucher.masterId
              ? { ...v, status: 'Rejected', rejectionNarration: comments || '' }
              : v
          )
        );
      }
      
      return response && response.success;
    } catch (err) {
      console.error('Error rejecting voucher:', err);
      throw err;
    }
  };

  // Handle authorizing a single voucher from modal (direct authorization without description)
  const handleAuthorizeSingleVoucher = async () => {
    if (!viewingVoucher) {
      alert('No voucher selected');
      return;
    }

    setAuthorizing(true);
    try {
      const success = await authorizeSingleVoucher(viewingVoucher);
      
      if (success) {
        alert('Voucher authorized successfully');
        setShowVoucherDetails(false);
        setViewingVoucher(null);
        // Switch to authorized tab to show the newly authorized voucher
        setActiveTab('authorized');
        // Don't reload - status is already updated locally
      } else {
        alert('Failed to authorize voucher');
      }
    } catch (err) {
      alert('Error authorizing voucher: ' + err.message);
    } finally {
      setAuthorizing(false);
    }
  };

  // Handle rejecting a single voucher from modal
  const handleRejectSingleVoucher = () => {
    if (!viewingVoucher) {
      alert('No voucher selected');
      return;
    }

    setVoucherToReject(viewingVoucher);
    setRejectNarration('');
    setShowRejectNarrationModal(true);
  };

  // Confirm rejection with narration
  const confirmRejectSingleVoucher = async () => {
    if (!voucherToReject) return;

    setRejecting(true);
    setShowRejectNarrationModal(false);
    try {
      const success = await rejectSingleVoucher(voucherToReject, rejectNarration);
      
      if (success) {
        alert('Voucher rejected successfully');
        setShowVoucherDetails(false);
        setViewingVoucher(null);
        setVoucherToReject(null);
        setRejectNarration('');
        // Switch to rejected tab to show the newly rejected voucher
        setActiveTab('rejected');
        // Don't reload - status is already updated locally
      } else {
        alert('Failed to reject voucher');
      }
    } catch (err) {
      alert('Error rejecting voucher: ' + err.message);
    } finally {
      setRejecting(false);
    }
  };

  const handleAuthorizeVouchers = async () => {
    if (selectedVouchers.length === 0) {
      alert('Please select vouchers to authorize');
      return;
    }

    // Get selected voucher objects
    const selectedVoucherObjects = vouchers.filter(v => selectedVouchers.includes(v.id));

    setAuthorizing(true);
    try {
      // Authorize each voucher individually (no narration required)
      const authorizationPromises = selectedVoucherObjects.map(voucher => authorizeSingleVoucher(voucher));
      
      // Wait for all authorizations to complete
      const responses = await Promise.all(authorizationPromises);
      console.log('📋 Authorization responses:', responses);
      
      // Check if all were successful
      const allSuccessful = responses.every(response => response === true);
      
      if (allSuccessful) {
        alert(`${selectedVoucherObjects.length} voucher(s) authorized successfully`);
        setSelectedVouchers([]);
        // Switch to authorized tab to show the newly authorized vouchers
        setActiveTab('authorized');
        // Don't reload - status is already updated locally
      } else {
        alert('Some vouchers failed to authorize');
      }
    } catch (err) {
      console.error('Error authorizing vouchers:', err);
      alert('Error authorizing vouchers: ' + err.message);
    } finally {
      setAuthorizing(false);
    }
  };

  const handleRejectVouchers = () => {
    if (selectedVouchers.length === 0) {
      alert('Please select vouchers to reject');
      return;
    }

    // Get selected voucher objects
    const selectedVoucherObjects = vouchers.filter(v => selectedVouchers.includes(v.id));
    setVoucherToReject(selectedVoucherObjects); // Store array for bulk rejection
    setRejectingMultiple(true);
    setRejectNarration('');
    setShowRejectNarrationModal(true);
  };

  // Confirm bulk rejection with narration
  const confirmRejectMultipleVouchers = async () => {
    if (!voucherToReject || !Array.isArray(voucherToReject)) return;

    setRejecting(true);
    setShowRejectNarrationModal(false);
    try {
      // Reject each voucher individually with the same narration
      const rejectionPromises = voucherToReject.map(voucher => rejectSingleVoucher(voucher, rejectNarration));
      
      // Wait for all rejections to complete
      const responses = await Promise.all(rejectionPromises);
      console.log('📋 Rejection responses:', responses);
      
      // Check if all were successful
      const allSuccessful = responses.every(response => response === true);
      
      if (allSuccessful) {
        alert(`${voucherToReject.length} voucher(s) rejected successfully`);
        setSelectedVouchers([]);
        setVoucherToReject(null);
        setRejectNarration('');
        setRejectingMultiple(false);
        // Switch to rejected tab to show the newly rejected vouchers
        setActiveTab('rejected');
        // Don't reload - status is already updated locally
      } else {
        alert('Some vouchers failed to reject');
      }
    } catch (err) {
      console.error('Error rejecting vouchers:', err);
      alert('Error rejecting vouchers: ' + err.message);
    } finally {
      setRejecting(false);
    }
  };

  // Filter vouchers based on active tab and selected filters
  const filteredVouchers = useMemo(() => {
    const filtered = vouchers.filter(voucher => {
      // Filter by active tab (pending, authorized, rejected)
      let tabMatch = true;
      if (activeTab === 'pending') {
        tabMatch = voucher.status === 'Pending';
      } else if (activeTab === 'authorized') {
        tabMatch = voucher.status === 'Authorized';
      } else if (activeTab === 'rejected') {
        tabMatch = voucher.status === 'Rejected';
      }
      
      // All vouchers returned from API are already filtered by date, so we don't need date filtering here
      const searchMatch = 
        voucher.voucherNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (voucher.customer && voucher.customer.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (voucher.supplier && voucher.supplier.toLowerCase().includes(searchTerm.toLowerCase())) ||
        voucher.type.toLowerCase().includes(searchTerm.toLowerCase());
      const typeMatch = selectedVoucherType === 'all' || voucher.type === selectedVoucherType;
      // Don't apply statusMatch filter when using tabs - the tab already filters by status
      // const statusMatch = selectedStatus === 'all' || voucher.status === selectedStatus;
      const partyMatch = selectedParty === 'all' || 
        (voucher.customer && voucher.customer === selectedParty) ||
        (voucher.supplier && voucher.supplier === selectedParty);
      
      return tabMatch && searchMatch && typeMatch && partyMatch;
    });
    
    console.log(`✅ Filtered ${filtered.length} vouchers from ${vouchers.length} total (tab: ${activeTab})`);
    console.log(`   Vouchers by status:`, {
      pending: vouchers.filter(v => v.status === 'Pending').length,
      authorized: vouchers.filter(v => v.status === 'Authorized').length,
      rejected: vouchers.filter(v => v.status === 'Rejected').length
    });
    
    return filtered;
  }, [vouchers, searchTerm, selectedVoucherType, selectedParty, activeTab]);

  // Calculate metrics
  const metrics = useMemo(() => {
    const totalVouchers = filteredVouchers.length;
    const pendingVouchers = filteredVouchers.filter(v => v.status === 'Pending').length;
    const authorizedVouchers = filteredVouchers.filter(v => v.status === 'Authorized').length;
    const totalAmount = filteredVouchers.reduce((sum, v) => sum + v.amount, 0);
    const pendingAmount = filteredVouchers.filter(v => v.status === 'Pending').reduce((sum, v) => sum + v.amount, 0);
    const avgVoucherValue = totalVouchers > 0 ? totalAmount / totalVouchers : 0;
    
    return { totalVouchers, pendingVouchers, authorizedVouchers, totalAmount, pendingAmount, avgVoucherValue };
  }, [filteredVouchers]);

  const { totalVouchers, pendingVouchers, authorizedVouchers, totalAmount, pendingAmount, avgVoucherValue } = metrics;

  // Check if any selected vouchers are already authorized
  const hasAuthorizedSelectedVouchers = useMemo(() => {
    return vouchers.filter(v => selectedVouchers.includes(v.id) && v.status === 'Authorized').length > 0;
  }, [vouchers, selectedVouchers]);

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!fromDate || !toDate) {
      setError('Please select both start and end dates');
      return;
    }

    setDateRange({ start: fromDate, end: toDate });
    setCurrentPage(1);
    loadVouchers();
  };

  const hasActiveFilters =
    selectedVoucherType !== 'all' ||
    selectedStatus !== 'all' ||
    selectedParty !== 'all' ||
    searchTerm !== '';

  const clearAllFilters = () => {
    setSelectedVoucherType('all');
    setSelectedStatus('all');
    setSelectedParty('all');
    setSearchTerm('');
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-IN');
  };

  const progressPercent = progressState.total
    ? Math.round((progressState.completed / progressState.total) * 100)
    : 0;

  return (
    <>
      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes slideUp {
            from { 
              opacity: 0;
              transform: translateY(20px);
            }
            to { 
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}
      </style>
      <div
        style={{
          background: 'linear-gradient(135deg, #e0e7ff 0%, #f8fafc 100%)',
          minHeight: '100vh',
          padding: 0,
          paddingTop: '40px',
          width: '80vw',
          margin: 0,
          display: 'block',
          overflowX: 'hidden',
        }}
      >
        <div
          style={{
            width: '100%',
            margin: 0,
            background: 'white',
            borderRadius: '12px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            overflow: 'visible',
            border: '1px solid #e5e7eb',
            position: 'relative',
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center', 
            justifyContent: 'space-between',
            padding: '20px 24px',
            borderBottom: '1px solid #f3f4f6',
            position: 'relative'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 4px rgba(59, 130, 246, 0.2)'
              }}>
                <span className="material-icons" style={{ color: 'white', fontSize: '20px' }}>approval</span>
              </div>
              <div>
                <h1 style={{
                  margin: 0,
                  color: '#1e293b',
                  fontSize: '24px',
                  fontWeight: '700',
                  lineHeight: '1.2'
                }}>
                  Voucher Authorization
                </h1>
                <p style={{
                  margin: '4px 0 0 0',
                  color: '#64748b',
                  fontSize: '14px',
                  fontWeight: '500'
                }}>
                  Review and authorize pending vouchers
                </p>
              </div>
            </div>
            <div style={{
              background: '#f0f9ff',
              color: '#0369a1',
              padding: '6px 12px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              border: '1px solid #bae6fd'
            }}>
              <span className="material-icons" style={{ fontSize: '16px' }}>pending_actions</span>
              {pendingVouchers} pending vouchers
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ padding: '24px', width: '100%', overflow: 'visible', position: 'relative', boxSizing: 'border-box' }}>
            {/* Single Line: Start Date, End Date, Submit Button, Authorize Button, Reject Button */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '250px 250px 160px 180px 180px',
              gap: '20px',
              alignItems: 'end',
              minHeight: '60px',
              position: 'relative',
              marginBottom: '20px'
            }}>
              {/* Start Date */}
              <div style={{ position: 'relative' }}>
                <div style={{
                  position: 'relative',
                  background: 'white',
                  borderRadius: '12px',
                  border: '2px solid #e2e8f0',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                }}>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: 'none',
                      outline: 'none',
                      background: 'transparent',
                      fontSize: '14px',
                      color: '#1e293b',
                      borderRadius: '10px'
                    }}
                  />
                  <label style={{
                    position: 'absolute',
                    top: '-8px',
                    left: '12px',
                    background: 'white',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#64748b',
                    padding: '0 6px',
                    transition: 'all 0.2s ease',
                    pointerEvents: 'none',
                    zIndex: 1
                  }}>
                    Start Date
                  </label>
                </div>
              </div>

              {/* End Date */}
              <div style={{ position: 'relative' }}>
                <div style={{
                  position: 'relative',
                  background: 'white',
                  borderRadius: '12px',
                  border: '2px solid #e2e8f0',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                }}>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: 'none',
                      outline: 'none',
                      background: 'transparent',
                      fontSize: '14px',
                      color: '#1e293b',
                      borderRadius: '10px'
                    }}
                  />
                  <label style={{
                    position: 'absolute',
                    top: '-8px',
                    left: '12px',
                    background: 'white',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#64748b',
                    padding: '0 6px',
                    transition: 'all 0.2s ease',
                    pointerEvents: 'none',
                    zIndex: 1
                  }}>
                    End Date
                  </label>
                </div>
              </div>

              {/* Submit Button */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'flex-start'
              }}>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    background: loading ? '#94a3b8' : 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '12px 20px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: '#fff',
                    fontSize: '14px',
                    fontWeight: '600',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 2px 4px rgba(59, 130, 246, 0.2)',
                    width: '100%',
                    justifyContent: 'center',
                    opacity: loading ? 0.7 : 1
                  }}
                  onMouseEnter={(e) => {
                    if (!loading) {
                      e.target.style.background = 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!loading) {
                      e.target.style.background = 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)';
                    }
                  }}
                >
                  {loading ? (
                    <span className="material-icons" style={{ fontSize: '16px', animation: 'spin 1s linear infinite' }}>refresh</span>
                  ) : (
                    <span className="material-icons" style={{ fontSize: '16px' }}>search</span>
                  )}
                  {loading ? 'Loading...' : 'Submit'}
                </button>
              </div>

              {/* Authorize Button */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'flex-start'
              }}>
                <button
                  onClick={handleAuthorizeVouchers}
                  disabled={authorizing || rejecting || selectedVouchers.length === 0 || hasAuthorizedSelectedVouchers}
                  style={{
                    background: authorizing || rejecting || selectedVouchers.length === 0 || hasAuthorizedSelectedVouchers ? '#94a3b8' : 'linear-gradient(135deg, #F27020 0%, #e55a00 100%)',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '12px 20px',
                    cursor: authorizing || rejecting || selectedVouchers.length === 0 || hasAuthorizedSelectedVouchers ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: '#fff',
                    fontSize: '14px',
                    fontWeight: '600',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 2px 4px rgba(242, 112, 32, 0.2)',
                    width: '100%',
                    justifyContent: 'center',
                    opacity: authorizing || rejecting || selectedVouchers.length === 0 || hasAuthorizedSelectedVouchers ? 0.7 : 1
                  }}
                  onMouseEnter={(e) => {
                    if (!authorizing && !rejecting && selectedVouchers.length > 0 && !hasAuthorizedSelectedVouchers) {
                      e.target.style.background = 'linear-gradient(135deg, #e55a00 0%, #cc4a00 100%)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!authorizing && !rejecting && selectedVouchers.length > 0 && !hasAuthorizedSelectedVouchers) {
                      e.target.style.background = 'linear-gradient(135deg, #F27020 0%, #e55a00 100%)';
                    }
                  }}
                >
                  <span className="material-icons" style={{ fontSize: '16px' }}>check_circle</span>
                  {authorizing ? 'Authorizing...' : `Authorize (${selectedVouchers.length})`}
                </button>
              </div>

              {/* Reject Button */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'flex-start'
              }}>
                <button
                  onClick={handleRejectVouchers}
                  disabled={rejecting || authorizing || selectedVouchers.length === 0 || hasAuthorizedSelectedVouchers}
                  style={{
                    background: rejecting || authorizing || selectedVouchers.length === 0 || hasAuthorizedSelectedVouchers ? '#94a3b8' : 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '12px 20px',
                    cursor: rejecting || authorizing || selectedVouchers.length === 0 || hasAuthorizedSelectedVouchers ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: '#fff',
                    fontSize: '14px',
                    fontWeight: '600',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 2px 4px rgba(220, 38, 38, 0.2)',
                    width: '100%',
                    justifyContent: 'center',
                    opacity: rejecting || authorizing || selectedVouchers.length === 0 || hasAuthorizedSelectedVouchers ? 0.7 : 1
                  }}
                  onMouseEnter={(e) => {
                    if (!rejecting && !authorizing && selectedVouchers.length > 0 && !hasAuthorizedSelectedVouchers) {
                      e.target.style.background = 'linear-gradient(135deg, #b91c1c 0%, #991b1b 100%)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!rejecting && !authorizing && selectedVouchers.length > 0 && !hasAuthorizedSelectedVouchers) {
                      e.target.style.background = 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)';
                    }
                  }}
                >
                  <span className="material-icons" style={{ fontSize: '16px' }}>cancel</span>
                  {rejecting ? 'Rejecting...' : `Reject (${selectedVouchers.length})`}
                </button>
              </div>
            </div>
          </form>

          {progressState.active && (
            <div style={{
              margin: '0 24px 16px 24px',
              background: '#e0f2fe',
              border: '1px solid #bae6fd',
              borderRadius: '12px',
              padding: '16px 20px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ color: '#0f172a', fontWeight: 600, fontSize: '14px' }}>
                  {progressState.message || 'Fetching data from Tally server…'}
                </div>
                <div style={{ color: '#0369a1', fontWeight: 600, fontSize: '14px' }}>
                  {progressState.elapsedSeconds}s
                </div>
              </div>
              <div style={{ position: 'relative', height: '10px', background: '#bfdbfe', borderRadius: '999px', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${Math.min(Math.max(progressPercent, 0), 100)}%`,
                    background: 'linear-gradient(90deg, #0ea5e9 0%, #2563eb 100%)',
                    borderRadius: '999px',
                    transition: 'width 0.3s ease'
                  }}
                />
              </div>
              <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'flex-end', color: '#0369a1', fontWeight: 600, fontSize: '12px' }}>
                <span>{progressPercent}%</span>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              padding: '12px 16px',
              margin: '16px 24px',
              color: '#dc2626',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span className="material-icons" style={{ fontSize: '18px' }}>
                error
              </span>
              {error}
            </div>
          )}

          {/* Tabs for Pending/Authorized/Rejected */}
          <div style={{ padding: '0 24px', borderBottom: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => {
                  setActiveTab('pending');
                  setSelectedVouchers([]);
                }}
                style={{
                  padding: '12px 24px',
                  border: 'none',
                  borderBottom: activeTab === 'pending' ? '3px solid #F27020' : '3px solid transparent',
                  background: 'transparent',
                  color: activeTab === 'pending' ? '#F27020' : '#64748b',
                  fontSize: '14px',
                  fontWeight: activeTab === 'pending' ? '600' : '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <span className="material-icons" style={{ fontSize: '18px' }}>pending_actions</span>
                Pending
                <span style={{
                  background: activeTab === 'pending' ? '#F27020' : '#e5e7eb',
                  color: activeTab === 'pending' ? 'white' : '#64748b',
                  borderRadius: '12px',
                  padding: '2px 8px',
                  fontSize: '12px',
                  fontWeight: '600',
                  marginLeft: '4px'
                }}>
                  {vouchers.filter(v => v.status === 'Pending').length}
                </span>
              </button>
              <button
                onClick={() => {
                  setActiveTab('authorized');
                  setSelectedVouchers([]);
                }}
                style={{
                  padding: '12px 24px',
                  border: 'none',
                  borderBottom: activeTab === 'authorized' ? '3px solid #10b981' : '3px solid transparent',
                  background: 'transparent',
                  color: activeTab === 'authorized' ? '#10b981' : '#64748b',
                  fontSize: '14px',
                  fontWeight: activeTab === 'authorized' ? '600' : '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <span className="material-icons" style={{ fontSize: '18px' }}>check_circle</span>
                Authorized
                <span style={{
                  background: activeTab === 'authorized' ? '#10b981' : '#e5e7eb',
                  color: activeTab === 'authorized' ? 'white' : '#64748b',
                  borderRadius: '12px',
                  padding: '2px 8px',
                  fontSize: '12px',
                  fontWeight: '600',
                  marginLeft: '4px'
                }}>
                  {vouchers.filter(v => v.status === 'Authorized').length}
                </span>
              </button>
              <button
                onClick={() => {
                  setActiveTab('rejected');
                  setSelectedVouchers([]);
                }}
                style={{
                  padding: '12px 24px',
                  border: 'none',
                  borderBottom: activeTab === 'rejected' ? '3px solid #dc2626' : '3px solid transparent',
                  background: 'transparent',
                  color: activeTab === 'rejected' ? '#dc2626' : '#64748b',
                  fontSize: '14px',
                  fontWeight: activeTab === 'rejected' ? '600' : '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <span className="material-icons" style={{ fontSize: '18px' }}>cancel</span>
                Rejected
                <span style={{
                  background: activeTab === 'rejected' ? '#dc2626' : '#e5e7eb',
                  color: activeTab === 'rejected' ? 'white' : '#64748b',
                  borderRadius: '12px',
                  padding: '2px 8px',
                  fontSize: '12px',
                  fontWeight: '600',
                  marginLeft: '4px'
                }}>
                  {vouchers.filter(v => v.status === 'Rejected').length}
                </span>
              </button>
            </div>
          </div>

          {/* Dashboard Content */}
          <div style={{ padding: '24px' }}>
            {/* Vouchers Table */}
            <div style={{
              background: 'white',
              borderRadius: '8px',
              border: '1px solid #e5e7eb',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
              overflow: 'hidden'
            }}>
              {loading ? (
                <div style={{
                  padding: '48px',
                  textAlign: 'center',
                  color: '#64748b'
                }}>
                  <span className="material-icons" style={{ 
                    fontSize: 48, 
                    color: '#F27020',
                    animation: 'spin 1s linear infinite'
                  }}>
                    refresh
                  </span>
                  <p style={{ margin: '16px 0 0 0', fontSize: 16 }}>
                    Loading vouchers...
                  </p>
                </div>
              ) : filteredVouchers.length === 0 ? (
                <div style={{
                  padding: '48px',
                  textAlign: 'center',
                  color: '#64748b'
                }}>
                  <span className="material-icons" style={{ fontSize: 48, color: '#cbd5e1' }}>
                    receipt_long
                  </span>
                  <p style={{ margin: '16px 0 0 0', fontSize: 16 }}>
                    No vouchers found for the selected period
                  </p>
                </div>
              ) : (
                <div>
                  {/* Table Header */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '40px 140px 1fr 120px 100px 140px 140px 200px 120px',
                    gap: 16,
                    padding: '12px 20px',
                    background: '#ffffff',
                    borderBottom: '2px solid #1e293b',
                    fontWeight: 700,
                    fontSize: 14,
                    color: '#1e293b'
                  }}>
                    <div></div>
                    <div style={{ textAlign: 'left' }}>Date</div>
                    <div style={{ textAlign: 'left' }}>Particulars</div>
                    <div style={{ textAlign: 'left' }}>Vch Type</div>
                    <div style={{ textAlign: 'left' }}>Vch No.</div>
                    <div style={{ textAlign: 'right' }}>Debit</div>
                    <div style={{ textAlign: 'right' }}>Credit</div>
                    <div style={{ textAlign: 'left' }}>Notes</div>
                    <div style={{ textAlign: 'center' }}>Actions</div>
                  </div>

                  {/* Table Rows */}
                  {filteredVouchers.map((voucher) => (
                    <div
                      key={voucher.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '40px 140px 1fr 120px 100px 140px 140px 200px 120px',
                        gap: 16,
                        padding: '12px 20px',
                        borderBottom: '1px solid #e5e7eb',
                        alignItems: 'center',
                        transition: 'background-color 0.2s',
                        cursor: 'pointer'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.backgroundColor = '#f8fafc';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.backgroundColor = 'transparent';
                      }}
                      onClick={(e) => {
                        // Checkbox has stopPropagation, so clicking checkbox won't trigger this
                        // Only open voucher details when clicking elsewhere on the row
                        if (e.target.type !== 'checkbox' && e.target.tagName !== 'INPUT' && !e.target.closest('button')) {
                          handleVoucherView(voucher);
                        }
                      }}
                    >
                      <div>
                        <input
                          type="checkbox"
                          checked={selectedVouchers.includes(voucher.id)}
                          onChange={() => handleVoucherSelect(voucher.id)}
                          style={{ transform: 'scale(1.2)', accentColor: '#F27020' }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                      <div style={{ color: '#1e293b', fontSize: '14px' }}>
                        {voucher.date}
                      </div>
                      <div style={{ color: '#1e293b', fontSize: '14px' }}>
                        {voucher.description}
                      </div>
                      <div style={{ color: '#1e293b', fontSize: '14px' }}>
                        {voucher.type}
                      </div>
                      <div style={{ color: '#1e293b', fontSize: '14px' }}>
                        {voucher.voucherNumber}
                      </div>
                      <div style={{ textAlign: 'right', color: '#1e293b', fontSize: '14px' }}>
                        {voucher.debitAmount > 0 ? formatCurrency(voucher.debitAmount) : ''}
                      </div>
                      <div style={{ textAlign: 'right', color: '#1e293b', fontSize: '14px' }}>
                        {voucher.creditAmount > 0 ? formatCurrency(voucher.creditAmount) : ''}
                      </div>
                      <div style={{ 
                        color: voucher.status === 'Authorized' ? '#047857' : voucher.status === 'Rejected' ? '#991b1b' : '#64748b', 
                        fontSize: '13px',
                        fontStyle: (voucher.status === 'Authorized' && voucher.authorizationNarration) || (voucher.status === 'Rejected' && voucher.rejectionNarration) ? 'normal' : 'italic',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {voucher.status === 'Authorized' && voucher.authorizationNarration ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span className="material-icons" style={{ fontSize: '16px', color: '#10b981' }}>check_circle</span>
                            {voucher.authorizationNarration}
                          </span>
                        ) : voucher.status === 'Rejected' && voucher.rejectionNarration ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span className="material-icons" style={{ fontSize: '16px', color: '#dc2626' }}>cancel</span>
                            {voucher.rejectionNarration}
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>-</span>
                        )}
                      </div>
                      <div style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleViewVoucherActivity(voucher)}
                          style={{
                            padding: '6px 12px',
                            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
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
                            e.target.style.background = 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)';
                            e.target.style.boxShadow = '0 4px 8px rgba(59, 130, 246, 0.4)';
                            e.target.style.transform = 'translateY(-1px)';
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.background = 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)';
                            e.target.style.boxShadow = '0 2px 4px rgba(59, 130, 246, 0.3)';
                            e.target.style.transform = 'translateY(0)';
                          }}
                        >
                          <span className="material-icons" style={{ fontSize: '16px' }}>history</span>
                          Activity
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Voucher Details Modal */}
      {showVoucherDetails && viewingVoucherMasterId && (
        <VoucherDetailsModal
          masterId={viewingVoucherMasterId}
          onClose={() => {
            setShowVoucherDetails(false);
            setViewingVoucher(null);
            setViewingVoucherMasterId(null);
          }}
          showApproveReject={true}
          onApprove={handleAuthorizeSingleVoucher}
          onReject={handleRejectSingleVoucher}
          isAuthorizing={authorizing}
          isRejecting={rejecting}
          voucherStatus={viewingVoucher?.status}
        />
      )}

      {/* Rejection Narration Modal */}
      {showRejectNarrationModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
            zIndex: 15000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            animation: 'fadeIn 0.2s ease-out'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowRejectNarrationModal(false);
              setRejectNarration('');
              setVoucherToReject(null);
              setRejectingMultiple(false);
            }
          }}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '16px',
              width: '90%',
              maxWidth: '560px',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
              overflow: 'hidden',
              animation: 'slideUp 0.3s ease-out',
              transform: 'translateY(0)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with Icon */}
            <div style={{
              background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
              padding: '24px 28px',
              display: 'flex',
              alignItems: 'center',
              gap: '16px'
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backdropFilter: 'blur(10px)'
              }}>
                <span className="material-icons" style={{ fontSize: '28px', color: 'white' }}>cancel</span>
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{
                  margin: 0,
                  fontSize: '20px',
                  fontWeight: 700,
                  color: 'white',
                  marginBottom: '4px',
                  letterSpacing: '-0.01em'
                }}>
                  Reject Voucher{rejectingMultiple && Array.isArray(voucherToReject) ? 's' : ''}
                </h3>
                <p style={{
                  margin: 0,
                  fontSize: '14px',
                  color: 'rgba(255, 255, 255, 0.9)',
                  fontWeight: 500
                }}>
                  {rejectingMultiple && Array.isArray(voucherToReject)
                    ? `Add comments for rejecting ${voucherToReject.length} voucher(s)`
                    : 'Add optional comments for rejecting this voucher'}
                </p>
              </div>
            </div>

            {/* Content */}
            <div style={{ padding: '28px' }}>
              <div style={{ marginBottom: '24px' }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#374151',
                  marginBottom: '12px'
                }}>
                  <span className="material-icons" style={{ fontSize: '18px', color: '#dc2626' }}>comment</span>
                  Comments
                  <span style={{
                    fontSize: '12px',
                    fontWeight: 500,
                    color: '#94a3b8',
                    marginLeft: '4px'
                  }}>
                    (Optional)
                  </span>
                </label>
                <textarea
                  value={rejectNarration}
                  onChange={(e) => setRejectNarration(e.target.value)}
                  placeholder="Enter your comments here... (e.g., qty issue, Missing documents, Incorrect amount, Policy violation, etc.)"
                  style={{
                    width: '100%',
                    minHeight: '120px',
                    maxHeight: '200px',
                    padding: '14px 16px',
                    border: '2px solid #e2e8f0',
                    borderRadius: '10px',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    outline: 'none',
                    transition: 'all 0.2s ease',
                    backgroundColor: '#fafbfc',
                    color: '#1e293b',
                    lineHeight: '1.6',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#dc2626';
                    e.target.style.backgroundColor = 'white';
                    e.target.style.boxShadow = '0 0 0 3px rgba(220, 38, 38, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e2e8f0';
                    e.target.style.backgroundColor = '#fafbfc';
                    e.target.style.boxShadow = 'none';
                  }}
                />
                <div style={{
                  marginTop: '8px',
                  fontSize: '12px',
                  color: '#94a3b8',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <span className="material-icons" style={{ fontSize: '14px' }}>info</span>
                  These comments will be visible in the voucher details
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'flex-end',
                paddingTop: '8px',
                borderTop: '1px solid #f1f5f9'
              }}>
                <button
                  onClick={() => {
                    setShowRejectNarrationModal(false);
                    setRejectNarration('');
                    setVoucherToReject(null);
                    setRejectingMultiple(false);
                  }}
                  style={{
                    padding: '12px 24px',
                    border: '2px solid #e2e8f0',
                    borderRadius: '10px',
                    background: 'white',
                    color: '#64748b',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = '#f8fafc';
                    e.target.style.borderColor = '#cbd5e1';
                    e.target.style.color = '#475569';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = 'white';
                    e.target.style.borderColor = '#e2e8f0';
                    e.target.style.color = '#64748b';
                  }}
                >
                  <span className="material-icons" style={{ fontSize: '18px' }}>close</span>
                  Cancel
                </button>
                <button
                  onClick={rejectingMultiple ? confirmRejectMultipleVouchers : confirmRejectSingleVoucher}
                  disabled={rejecting}
                  style={{
                    padding: '12px 24px',
                    border: 'none',
                    borderRadius: '10px',
                    background: rejecting ? '#94a3b8' : 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: rejecting ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease',
                    opacity: rejecting ? 0.7 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: rejecting ? 'none' : '0 4px 12px rgba(220, 38, 38, 0.3)'
                  }}
                  onMouseEnter={(e) => {
                    if (!rejecting) {
                      e.target.style.background = 'linear-gradient(135deg, #b91c1c 0%, #991b1b 100%)';
                      e.target.style.boxShadow = '0 6px 16px rgba(220, 38, 38, 0.4)';
                      e.target.style.transform = 'translateY(-1px)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!rejecting) {
                      e.target.style.background = 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)';
                      e.target.style.boxShadow = '0 4px 12px rgba(220, 38, 38, 0.3)';
                      e.target.style.transform = 'translateY(0)';
                    }
                  }}
                >
                  {rejecting ? (
                    <>
                      <span className="material-icons" style={{ fontSize: '18px', animation: 'spin 1s linear infinite' }}>refresh</span>
                      Rejecting...
                    </>
                  ) : (
                    <>
                      <span className="material-icons" style={{ fontSize: '18px' }}>cancel</span>
                      Confirm Reject
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Voucher Activity Modal */}
      {showVoucherActivity && voucherActivityData && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
            zIndex: 15000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            animation: 'fadeIn 0.2s ease-out'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowVoucherActivity(false);
              setVoucherActivityData(null);
            }
          }}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '16px',
              width: '90%',
              maxWidth: '800px',
              maxHeight: '80vh',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
              overflow: 'hidden',
              animation: 'slideUp 0.3s ease-out',
              display: 'flex',
              flexDirection: 'column'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              padding: '24px 28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  background: 'rgba(255, 255, 255, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backdropFilter: 'blur(10px)'
                }}>
                  <span className="material-icons" style={{ fontSize: '28px', color: 'white' }}>history</span>
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{
                    margin: 0,
                    fontSize: '20px',
                    fontWeight: 700,
                    color: 'white',
                    marginBottom: '4px',
                    letterSpacing: '-0.01em'
                  }}>
                    Voucher Activity History
                  </h3>
                  <p style={{
                    margin: 0,
                    fontSize: '14px',
                    color: 'rgba(255, 255, 255, 0.9)',
                    fontWeight: 500
                  }}>
                    {voucherActivityData.voucherNumber} - {voucherActivityData.type}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowVoucherActivity(false);
                  setVoucherActivityData(null);
                }}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.2)',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(255, 255, 255, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'rgba(255, 255, 255, 0.2)';
                }}
              >
                <span className="material-icons" style={{ fontSize: '20px' }}>close</span>
              </button>
            </div>

            {/* Content */}
            <div style={{ 
              padding: '28px', 
              overflowY: 'auto',
              flex: 1
            }}>
              {voucherActivityData.rawData && voucherActivityData.rawData.VOUCHER_ACTIVITY_HISTORY && 
               Array.isArray(voucherActivityData.rawData.VOUCHER_ACTIVITY_HISTORY) && 
               voucherActivityData.rawData.VOUCHER_ACTIVITY_HISTORY.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {voucherActivityData.rawData.VOUCHER_ACTIVITY_HISTORY.map((activity, index) => (
                    <div
                      key={index}
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        padding: '20px',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: '1fr 1fr',
                        gap: '16px',
                        marginBottom: '16px'
                      }}>
                        <div>
                          <div style={{
                            fontSize: '12px',
                            fontWeight: 600,
                            color: '#64748b',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            marginBottom: '4px'
                          }}>
                            User Email
                          </div>
                          <div style={{
                            fontSize: '14px',
                            fontWeight: 500,
                            color: '#1e293b',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}>
                            <span className="material-icons" style={{ fontSize: '18px', color: '#3b82f6' }}>
                              email
                            </span>
                            {activity.email || 'N/A'}
                          </div>
                        </div>
                        
                        <div>
                          <div style={{
                            fontSize: '12px',
                            fontWeight: 600,
                            color: '#64748b',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            marginBottom: '4px'
                          }}>
                            Status
                          </div>
                          <div style={{
                            fontSize: '14px',
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 12px',
                            borderRadius: '20px',
                            background: activity.apprv_status === 'approved' ? '#d1fae5' : 
                                       activity.apprv_status === 'rejected' ? '#fee2e2' : '#fef3c7',
                            color: activity.apprv_status === 'approved' ? '#047857' : 
                                   activity.apprv_status === 'rejected' ? '#991b1b' : '#92400e',
                            border: `1px solid ${activity.apprv_status === 'approved' ? '#a7f3d0' : 
                                                  activity.apprv_status === 'rejected' ? '#fecaca' : '#fde68a'}`
                          }}>
                            <span className="material-icons" style={{ fontSize: '16px' }}>
                              {activity.apprv_status === 'approved' ? 'check_circle' : 
                               activity.apprv_status === 'rejected' ? 'cancel' : 'pending'}
                            </span>
                            {activity.apprv_status ? activity.apprv_status.toUpperCase() : 'PENDING'}
                          </div>
                        </div>
                      </div>

                      <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: '1fr 1fr',
                        gap: '16px'
                      }}>
                        <div>
                          <div style={{
                            fontSize: '12px',
                            fontWeight: 600,
                            color: '#64748b',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            marginBottom: '4px'
                          }}>
                            Date & Time
                          </div>
                          <div style={{
                            fontSize: '14px',
                            fontWeight: 500,
                            color: '#1e293b',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}>
                            <span className="material-icons" style={{ fontSize: '18px', color: '#64748b' }}>
                              schedule
                            </span>
                            {activity.created_at ? new Date(activity.created_at).toLocaleString() : 'N/A'}
                          </div>
                        </div>

                        {activity.comments && (
                          <div>
                            <div style={{
                              fontSize: '12px',
                              fontWeight: 600,
                              color: '#64748b',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                              marginBottom: '4px'
                            }}>
                              Comments
                            </div>
                            <div style={{
                              fontSize: '14px',
                              fontWeight: 500,
                              color: '#1e293b',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '8px 12px',
                              background: 'white',
                              borderRadius: '8px',
                              border: '1px solid #e2e8f0'
                            }}>
                              <span className="material-icons" style={{ fontSize: '18px', color: '#f59e0b' }}>
                                comment
                              </span>
                              {activity.comments}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{
                  textAlign: 'center',
                  padding: '48px 20px',
                  color: '#94a3b8'
                }}>
                  <span className="material-icons" style={{ 
                    fontSize: '64px', 
                    color: '#cbd5e1',
                    marginBottom: '16px'
                  }}>
                    history_toggle_off
                  </span>
                  <p style={{ 
                    fontSize: '16px', 
                    fontWeight: 600, 
                    margin: '0 0 8px 0',
                    color: '#64748b'
                  }}>
                    No Activity History
                  </p>
                  <p style={{ fontSize: '14px', margin: 0 }}>
                    There is no activity history available for this voucher yet.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </>
  );
}

export default VoucherAuthorization;
