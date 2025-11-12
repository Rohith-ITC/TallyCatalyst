import React, { useState, useEffect, useMemo, useRef } from 'react';
import { apiGet, apiPost } from '../utils/apiUtils';
import { getApiUrl } from '../config';

function VoucherAuthorization() {
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedVouchers, setSelectedVouchers] = useState([]);
  const [authorizing, setAuthorizing] = useState(false);
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
      
      // For now, always set status to Pending - ISALTAUTH logic will be implemented later
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
        status: 'Pending', // Always pending for now - ISALTAUTH logic later
        description: v.PARTICULARS,
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
    // Use rawData from the voucher which contains ALLLEDGERENTRIES and INVENTORYALLOCATIONS
    setViewingVoucher(voucher);
    setShowVoucherDetails(true);
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

  const handleAuthorizeVouchers = async () => {
    if (selectedVouchers.length === 0) {
      alert('Please select vouchers to authorize');
      return;
    }

    setAuthorizing(true);
    try {
      // Get company info
      const companyInfo = getCompanyInfo();
      
      // Get selected voucher objects
      const selectedVoucherObjects = vouchers.filter(v => selectedVouchers.includes(v.id));
      
      console.log('🔍 Authorizing vouchers:', selectedVoucherObjects);
      
      // Authorize each voucher individually
      const authorizationPromises = selectedVoucherObjects.map(voucher => {
        const dateYYMMDD = convertDateToYYYYMMDD(voucher.date);
        
        console.log('📝 Authorizing voucher:', {
          masterid: voucher.masterId,
          date: dateYYMMDD
        });
        
        return apiPost('/api/tally/vchauth/auth', {
          tallyloc_id: parseInt(companyInfo.tallyloc_id),
          company: companyInfo.company,
          guid: companyInfo.guid,
          date: parseInt(dateYYMMDD),
          masterid: parseInt(voucher.masterId)
        });
      });
      
      // Wait for all authorizations to complete
      const responses = await Promise.all(authorizationPromises);
      console.log('📋 Authorization responses:', responses);
      
      // Check if all were successful
      const allSuccessful = responses.every(response => response && response.success);
      
      if (allSuccessful) {
        alert(`${selectedVouchers.length} voucher(s) authorized successfully`);
        setSelectedVouchers([]);
        loadVouchers(); // Reload the list
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

  // Filter vouchers based on selected filters
  const filteredVouchers = useMemo(() => {
    const filtered = vouchers.filter(voucher => {
      // All vouchers returned from API are already filtered by date, so we don't need date filtering here
      const searchMatch = 
        voucher.voucherNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (voucher.customer && voucher.customer.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (voucher.supplier && voucher.supplier.toLowerCase().includes(searchTerm.toLowerCase())) ||
        voucher.type.toLowerCase().includes(searchTerm.toLowerCase());
      const typeMatch = selectedVoucherType === 'all' || voucher.type === selectedVoucherType;
      const statusMatch = selectedStatus === 'all' || voucher.status === selectedStatus;
      const partyMatch = selectedParty === 'all' || 
        (voucher.customer && voucher.customer === selectedParty) ||
        (voucher.supplier && voucher.supplier === selectedParty);
      
      return searchMatch && typeMatch && statusMatch && partyMatch;
    });
    
    console.log(`✅ Filtered ${filtered.length} vouchers from ${vouchers.length} total`);
    
    return filtered;
  }, [vouchers, searchTerm, selectedVoucherType, selectedStatus, selectedParty]);

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
            {/* Single Line: Start Date, End Date, Submit Button, Authorize Button */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '250px 250px 160px 180px',
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
                  disabled={authorizing || selectedVouchers.length === 0}
                  style={{
                    background: authorizing || selectedVouchers.length === 0 ? '#94a3b8' : 'linear-gradient(135deg, #F27020 0%, #e55a00 100%)',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '12px 20px',
                    cursor: authorizing || selectedVouchers.length === 0 ? 'not-allowed' : 'pointer',
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
                    opacity: authorizing || selectedVouchers.length === 0 ? 0.7 : 1
                  }}
                  onMouseEnter={(e) => {
                    if (!authorizing && selectedVouchers.length > 0) {
                      e.target.style.background = 'linear-gradient(135deg, #e55a00 0%, #cc4a00 100%)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!authorizing && selectedVouchers.length > 0) {
                      e.target.style.background = 'linear-gradient(135deg, #F27020 0%, #e55a00 100%)';
                    }
                  }}
                >
                  <span className="material-icons" style={{ fontSize: '16px' }}>check_circle</span>
                  {authorizing ? 'Authorizing...' : `Authorize (${selectedVouchers.length})`}
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
                    gridTemplateColumns: '40px 140px 1fr 120px 100px 140px 140px',
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
                  </div>

                  {/* Table Rows */}
                  {filteredVouchers.map((voucher) => (
                    <div
                      key={voucher.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '40px 140px 1fr 120px 100px 140px 140px',
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
                        if (e.target.type !== 'checkbox' && e.target.tagName !== 'INPUT') {
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
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Voucher Details Modal */}
      {showVoucherDetails && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowVoucherDetails(false);
              setViewingVoucher(null);
            }
          }}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '12px',
              width: '90%',
              maxWidth: '1400px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <h2
                  style={{
                    margin: 0,
                    fontSize: '20px',
                    fontWeight: 700,
                    color: '#1e293b'
                  }}
                >
                  Voucher Details
                  {viewingVoucher && (
                    <span
                      style={{
                        marginLeft: '12px',
                        fontSize: '14px',
                        fontWeight: 500,
                        color: '#64748b'
                      }}
                    >
                      {viewingVoucher.voucherNumber} - {viewingVoucher.type}
                    </span>
                  )}
                </h2>
              </div>
              <button
                onClick={() => {
                  setShowVoucherDetails(false);
                  setViewingVoucher(null);
                }}
                style={{
                  background: '#f1f5f9',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = '#e2e8f0';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = '#f1f5f9';
                }}
              >
                <span className="material-icons" style={{ fontSize: '24px', color: '#64748b' }}>close</span>
              </button>
            </div>

            {/* Modal Content */}
            <div
              style={{
                flex: 1,
                overflow: 'auto',
                padding: '24px'
              }}
            >
              {viewingVoucher && viewingVoucher.rawData ? (
                <div style={{ width: '100%' }}>
                  {/* Voucher Header */}
                  <div style={{
                    background: '#f8fafc',
                    borderRadius: '8px',
                    padding: '16px 20px',
                    marginBottom: '20px',
                    border: '1px solid #e2e8f0'
                  }}>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr 1fr',
                      gap: '16px',
                      alignItems: 'center'
                    }}>
                      <div>
                        <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>Voucher Type</div>
                        <div style={{ fontSize: '16px', color: '#1e293b', fontWeight: 700 }}>{viewingVoucher.rawData.VCHTYPE}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>Voucher No.</div>
                        <div style={{ fontSize: '16px', color: '#1e293b', fontWeight: 700 }}>{viewingVoucher.rawData.VCHNO}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>Date</div>
                        <div style={{ fontSize: '16px', color: '#1e293b', fontWeight: 700 }}>{viewingVoucher.rawData.DATE}</div>
                      </div>
                    </div>
                    <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>Particulars</div>
                      <div style={{ fontSize: '16px', color: '#1e293b', fontWeight: 600 }}>{viewingVoucher.rawData.PARTICULARS}</div>
                    </div>
                  </div>

                  {/* Ledger Entries */}
                  {viewingVoucher.rawData.ALLLEDGERENTRIES && viewingVoucher.rawData.ALLLEDGERENTRIES.length > 0 && (
                    <div style={{ marginBottom: '24px' }}>
                      <h3 style={{
                        fontSize: '18px',
                        fontWeight: 700,
                        color: '#1e293b',
                        marginBottom: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <span className="material-icons" style={{ fontSize: '20px' }}>account_balance</span>
                        Ledger Entries
                      </h3>
                      <div style={{
                        background: 'white',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                        overflow: 'hidden'
                      }}>
                        {/* Table Header */}
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: '2fr 1fr 1fr',
                          gap: '16px',
                          padding: '12px 16px',
                          background: '#f8fafc',
                          borderBottom: '2px solid #e2e8f0',
                          fontWeight: 700,
                          fontSize: '14px',
                          color: '#1e293b'
                        }}>
                          <div>Ledger Name</div>
                          <div style={{ textAlign: 'right' }}>Debit Amount</div>
                          <div style={{ textAlign: 'right' }}>Credit Amount</div>
                        </div>

                        {/* Ledger Rows */}
                        {viewingVoucher.rawData.ALLLEDGERENTRIES.map((entry, index) => (
                          <div key={index}>
                            <div style={{
                              display: 'grid',
                              gridTemplateColumns: '2fr 1fr 1fr',
                              gap: '16px',
                              padding: '16px',
                              borderBottom: index < viewingVoucher.rawData.ALLLEDGERENTRIES.length - 1 ? '1px solid #e2e8f0' : 'none',
                              alignItems: 'center'
                            }}>
                              <div style={{ fontSize: '14px', color: '#1e293b', fontWeight: 600 }}>
                                {entry.LEDGERNAME}
                              </div>
                              <div style={{ textAlign: 'right', fontSize: '14px', color: '#1e293b', fontWeight: 600 }}>
                                {entry.DEBITAMT !== '0.00' && entry.DEBITAMT !== '0' && parseAmount(entry.DEBITAMT).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </div>
                              <div style={{ textAlign: 'right', fontSize: '14px', color: '#1e293b', fontWeight: 600 }}>
                                {entry.CREDITAMT !== '0.00' && entry.CREDITAMT !== '0' && parseAmount(entry.CREDITAMT).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </div>
                            </div>

                            {/* Bill Allocations */}
                            {entry.BILLALLOCATIONS && entry.BILLALLOCATIONS.length > 0 && (
                              <div style={{
                                padding: '12px 16px 12px 32px',
                                background: '#f8fafc',
                                borderTop: '1px solid #e2e8f0'
                              }}>
                                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginBottom: '8px' }}>Bill Allocations:</div>
                                {entry.BILLALLOCATIONS.map((bill, billIndex) => (
                                  <div key={billIndex} style={{
                                    display: 'grid',
                                    gridTemplateColumns: '2fr 1fr 1fr',
                                    gap: '16px',
                                    padding: '8px 0',
                                    fontSize: '13px'
                                  }}>
                                    <div style={{ color: '#64748b' }}>{bill.BILLNAME}</div>
                                    <div style={{ textAlign: 'right', color: '#64748b' }}>
                                      {bill.DEBITAMT !== '0.00' && bill.DEBITAMT !== '0' && parseAmount(bill.DEBITAMT).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </div>
                                    <div style={{ textAlign: 'right', color: '#64748b' }}>
                                      {bill.CREDITAMT !== '0.00' && bill.CREDITAMT !== '0' && parseAmount(bill.CREDITAMT).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Inventory Allocations */}
                            {entry.INVENTORYALLOCATIONS && entry.INVENTORYALLOCATIONS.length > 0 && (
                              <div style={{
                                padding: '12px 16px 12px 32px',
                                background: '#f8fafc',
                                borderTop: '1px solid #e2e8f0'
                              }}>
                                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginBottom: '8px' }}>Inventory Allocations:</div>
                                <div style={{
                                  display: 'grid',
                                  gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
                                  gap: '12px',
                                  padding: '8px 0',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  color: '#64748b',
                                  borderBottom: '1px solid #e2e8f0',
                                  marginBottom: '8px'
                                }}>
                                  <div>Item Name</div>
                                  <div style={{ textAlign: 'right' }}>Quantity</div>
                                  <div style={{ textAlign: 'right' }}>Rate</div>
                                  <div style={{ textAlign: 'right' }}>Discount</div>
                                  <div style={{ textAlign: 'right' }}>Amount</div>
                                </div>
                                {entry.INVENTORYALLOCATIONS.map((inv, invIndex) => (
                                  <div key={invIndex} style={{
                                    display: 'grid',
                                    gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
                                    gap: '12px',
                                    padding: '8px 0',
                                    fontSize: '13px'
                                  }}>
                                    <div style={{ color: '#1e293b' }}>{inv.STOCKITEMNAME}</div>
                                    <div style={{ textAlign: 'right', color: '#1e293b' }}>{inv.BILLEQTY}</div>
                                    <div style={{ textAlign: 'right', color: '#1e293b' }}>{inv.RATE}</div>
                                    <div style={{ textAlign: 'right', color: '#1e293b' }}>{inv.DISCOUNT || '0'}</div>
                                    <div style={{ textAlign: 'right', color: '#1e293b', fontWeight: 600 }}>
                                      ₹{parseAmount(inv.AMOUNT).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* All Inventory Entries */}
                  {viewingVoucher.rawData.ALLINVENTORYENTRIES && viewingVoucher.rawData.ALLINVENTORYENTRIES.length > 0 && (
                    <div style={{ marginBottom: '24px' }}>
                      <h3 style={{
                        fontSize: '18px',
                        fontWeight: 700,
                        color: '#1e293b',
                        marginBottom: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <span className="material-icons" style={{ fontSize: '20px' }}>inventory</span>
                        All Inventory Entries
                      </h3>
                      <div style={{
                        background: 'white',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                        overflow: 'hidden'
                      }}>
                        {/* Table Header */}
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
                          gap: '12px',
                          padding: '12px 16px',
                          background: '#f8fafc',
                          borderBottom: '2px solid #e2e8f0',
                          fontWeight: 700,
                          fontSize: '14px',
                          color: '#1e293b'
                        }}>
                          <div>Item Name</div>
                          <div style={{ textAlign: 'right' }}>Quantity</div>
                          <div style={{ textAlign: 'right' }}>Rate</div>
                          <div style={{ textAlign: 'right' }}>Discount</div>
                          <div style={{ textAlign: 'right' }}>Amount</div>
                        </div>

                        {/* Inventory Rows */}
                        {viewingVoucher.rawData.ALLINVENTORYENTRIES.map((inv, invIndex) => (
                          <div key={invIndex} style={{
                            display: 'grid',
                            gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
                            gap: '12px',
                            padding: '16px',
                            borderBottom: invIndex < viewingVoucher.rawData.ALLINVENTORYENTRIES.length - 1 ? '1px solid #e2e8f0' : 'none',
                            alignItems: 'center'
                          }}>
                            <div style={{ fontSize: '14px', color: '#1e293b', fontWeight: 600 }}>
                              {inv.STOCKITEMNAME}
                            </div>
                            <div style={{ textAlign: 'right', fontSize: '14px', color: '#1e293b' }}>
                              {inv.BILLEQTY}
                            </div>
                            <div style={{ textAlign: 'right', fontSize: '14px', color: '#1e293b' }}>
                              {inv.RATE}
                            </div>
                            <div style={{ textAlign: 'right', fontSize: '14px', color: '#1e293b' }}>
                              {inv.DISCOUNT || '0'}
                            </div>
                            <div style={{ textAlign: 'right', fontSize: '14px', color: '#1e293b', fontWeight: 600 }}>
                              ₹{parseAmount(inv.AMOUNT).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div
                  style={{
                    padding: '48px',
                    textAlign: 'center',
                    color: '#64748b'
                  }}
                >
                  <span className="material-icons" style={{ fontSize: 48, color: '#cbd5e1' }}>
                    receipt_long
                  </span>
                  <p style={{ margin: '16px 0 0 0', fontSize: 16 }}>
                    No voucher details available
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
