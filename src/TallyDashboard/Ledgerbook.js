import React, { useState, useEffect, useMemo } from 'react';
import { apiPost, apiGet } from '../utils/apiUtils';
import { getDropdownFilterOptions, getUserModules } from '../config/SideBarConfigurations';
import { getCustomersFromOPFS, syncCustomers } from '../utils/cacheSyncManager';
import { hybridCache } from '../utils/hybridCache';

function Ledgerbook() {
  // Get all companies from sessionStorage (memoized)
  const companies = useMemo(() => {
    try {
      return JSON.parse(sessionStorage.getItem('allConnections') || '[]');
    } catch (e) {
      return [];
    }
  }, []);

  // Get user modules for permission-based dropdown options (reactive)
  const [userModules, setUserModules] = useState([]);

  // Update user modules when component mounts or when user access changes
  useEffect(() => {
    const updateUserModules = () => {
      const modules = getUserModules();
      setUserModules(modules);
    };

    // Initial load
    updateUserModules();

    // Listen for user access updates
    window.addEventListener('userAccessUpdated', updateUserModules);
    window.addEventListener('companyChanged', updateUserModules);

    return () => {
      window.removeEventListener('userAccessUpdated', updateUserModules);
      window.removeEventListener('companyChanged', updateUserModules);
    };
  }, []);

  // Get dropdown filter options based on user permissions
  const tableOptions = useMemo(() => {
    const dropdownOptions = getDropdownFilterOptions('ledger_book', userModules);
    return dropdownOptions.map(option => option.label);
  }, [userModules]);

  // Default dates
  function getFirstOfMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  }
  function getToday() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  // Get company from sessionStorage (controlled by top bar)
  const selectedCompanyGuid = sessionStorage.getItem('selectedCompanyGuid') || '';
  const company = selectedCompanyGuid;
  const [table, setTable] = useState('');
  const [tableFocused, setTableFocused] = useState(false);
  const [dropdown3, setDropdown3] = useState('');
  const [dropdown3Focused, setDropdown3Focused] = useState(false);
  const [fromDate, setFromDate] = useState(getFirstOfMonth());
  const [toDate, setToDate] = useState(getToday());

  // Set default table when tableOptions change
  useEffect(() => {
    if (tableOptions.length > 0 && !table) {
      setTable(tableOptions[0]);
    }
  }, [tableOptions, table]);

  // Listen for company changes and reset table selection
  useEffect(() => {
    const handleCompanyChange = () => {
      // Reset table selection when company changes
      if (tableOptions.length > 0) {
        setTable(tableOptions[0]);
      } else {
        setTable('');
      }
    };

    window.addEventListener('companyChanged', handleCompanyChange);
    return () => window.removeEventListener('companyChanged', handleCompanyChange);
  }, [tableOptions]);
  const [fromDateFocused, setFromDateFocused] = useState(false);
  const [toDateFocused, setToDateFocused] = useState(false);
  const [ledgerOptions, setLedgerOptions] = useState([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerError, setLedgerError] = useState('');
  // Add a refresh trigger for ledgers
  const [refreshLedgers, setRefreshLedgers] = useState(0);
  const [refreshingLedgers, setRefreshingLedgers] = useState(false);

  // Ledger search and dropdown state
  const [ledgerSearchTerm, setLedgerSearchTerm] = useState('');
  const [showLedgerDropdown, setShowLedgerDropdown] = useState(false);
  const [filteredLedgerOptions, setFilteredLedgerOptions] = useState([]);
  const [tableData, setTableData] = useState(null);
  const [tableLoading, setTableLoading] = useState(false);
  const [tableError, setTableError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 10;
  const [showConfigOptions, setShowConfigOptions] = useState(false);
  const [showVoucherDetails, setShowVoucherDetails] = useState(false);
  const [viewingVoucher, setViewingVoucher] = useState(null);
  const [isDownloadingPDF, setIsDownloadingPDF] = useState(false);
  const parseAmount = (amount) => {
    if (amount === null || amount === undefined || amount === '') return 0;
    if (typeof amount === 'number') return amount;
    let sanitized = String(amount).trim();
    sanitized = sanitized.replace(/₹/g, '');
    sanitized = sanitized.replace(/,/g, '');
    sanitized = sanitized.replace(/\(\-\)/g, '-');
    sanitized = sanitized.replace(/^\((.*)\)$/g, '-$1');
    const parsed = parseFloat(sanitized);
    return isNaN(parsed) ? 0 : parsed;
  };

  const formatCurrency = (amount) => {
    const value = parseAmount(amount);
    return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const describeBalance = (balance) => {
    if (!balance) return '-';
    const debit = parseAmount(balance.debit);
    const credit = parseAmount(balance.credit);

    if (debit > 0 && credit <= 0) {
      return `${formatCurrency(debit)} Dr`;
    }
    if (credit > 0 && debit <= 0) {
      return `${formatCurrency(credit)} Cr`;
    }
    if (debit === 0 && credit === 0) {
      return `${formatCurrency(0)}`;
    }
    return `${formatCurrency(debit)} Dr / ${formatCurrency(credit)} Cr`;
  };

  const normalizeToArray = (value) => {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  };

  const handleVoucherRowClick = (row) => {
    let voucherData = null;
    let parentBillRow = null;

    if (table === 'Ledger Vouchers') {
      voucherData = row?.originalRow || row;
    } else if (table === 'Bill wise O/s') {
      if (row?.isVoucherEntry) {
        // Clicked on a voucher entry row
        voucherData = row.originalVoucher || row;
        parentBillRow = row.originalRow || row.billRowSnapshot || null;
      } else if (row?.VOUCHERS && Array.isArray(row.VOUCHERS) && row.VOUCHERS.length > 0) {
        // Clicked on a bill row - use the first voucher
        voucherData = row.VOUCHERS[0];
        parentBillRow = row;
      } else {
        // Bill row without vouchers - try to use row data directly if it has voucher fields
        if (row.MASTERID || row.VCHNO || row.VOUCHERNUMBER) {
          voucherData = row;
          parentBillRow = null;
        } else {
          return; // No voucher data available
        }
      }
    } else {
      return;
    }

    if (!voucherData) return;

    const ledgerEntries = normalizeToArray(voucherData.ALLLEDGERENTRIES);
    const inferredParticulars = voucherData.PARTICULARS || ledgerEntries[0]?.LEDGERNAME || parentBillRow?.REFNO || '';

    setViewingVoucher({
      ...voucherData,
      ledgerName: tableData?.ledgername || '',
      formattedDate: voucherData.DATE,
      refNo: parentBillRow?.REFNO || row?.REFNO || '',
      dueOn: parentBillRow?.DUEON || row?.DUEON || '',
      overdueDays: parentBillRow?.OVERDUEDAYS ?? row?.OVERDUEDAYS,
      openingBalances: parentBillRow ? {
        debit: parentBillRow.DEBITOPENBAL,
        credit: parentBillRow.CREDITOPENBAL
      } : null,
      pendingBalances: parentBillRow ? {
        debit: parentBillRow.DEBITCLSBAL,
        credit: parentBillRow.CREDITCLSBAL
      } : null,
      particulars: inferredParticulars
    });
    setShowVoucherDetails(true);
  };

  // Download PDF function for voucher
  const downloadPDF = async () => {
    if (!viewingVoucher || !viewingVoucher.MASTERID) {
      alert('❌ Unable to download PDF: Missing voucher information');
      return;
    }

    if (!currentCompanyObj) {
      alert('❌ Unable to download PDF: Missing company information');
      return;
    }

    setIsDownloadingPDF(true);

    try {
      // Step 1: Request PDF generation
      const requestPayload = {
        tallyloc_id: currentCompanyObj.tallyloc_id,
        company: currentCompanyObj.company,
        guid: currentCompanyObj.guid,
        master_id: viewingVoucher.MASTERID
      };

      console.log('Requesting PDF generation:', requestPayload);
      const requestResult = await apiPost('/api/tally/pdf/request', requestPayload);

      if (!requestResult || !requestResult.success || !requestResult.request_id) {
        throw new Error(requestResult?.message || 'Failed to request PDF generation');
      }

      const requestId = requestResult.request_id;
      console.log('PDF request ID:', requestId);

      // Step 2: Poll PDF status until ready (with timeout)
      let statusResult = null;
      const maxAttempts = 30; // Maximum 30 attempts
      const pollInterval = 1000; // Check every 1 second
      let attempts = 0;

      while (attempts < maxAttempts) {
        // Wait before checking (except first attempt)
        if (attempts > 0) {
          await new Promise(resolve => setTimeout(resolve, pollInterval));
        }

        statusResult = await apiGet(`/api/tally/pdf/status/${requestId}`);

        if (statusResult && statusResult.status === 'ready' && statusResult.pdf_base64) {
          console.log(`PDF ready after ${attempts + 1} attempt(s)`);
          break;
        }

        if (statusResult && statusResult.status === 'error') {
          throw new Error(statusResult?.message || 'PDF generation failed');
        }

        attempts++;
        console.log(`PDF status: ${statusResult?.status || 'unknown'}, attempt ${attempts}/${maxAttempts}`);
      }

      // Step 3: Verify PDF is ready
      if (!statusResult || statusResult.status !== 'ready' || !statusResult.pdf_base64) {
        throw new Error(statusResult?.message || 'PDF generation timed out. Please try again later.');
      }

      // Step 4: Decode base64 and download PDF
      const pdfBase64 = statusResult.pdf_base64;
      
      // Convert base64 to binary
      const binaryString = atob(pdfBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Create blob and download
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // Generate filename from voucher number if available
      const voucherNumber = viewingVoucher?.VCHNO || viewingVoucher?.VOUCHERNUMBER || viewingVoucher?.MASTERID;
      a.download = `Voucher_${voucherNumber}.pdf`;
      
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      console.log('PDF downloaded successfully');

      // Close the modal after successful download
      setShowVoucherDetails(false);
      setViewingVoucher(null);

    } catch (error) {
      console.error('Error downloading PDF:', error);
      alert(`❌ Error downloading PDF: ${error.message}`);
    } finally {
      setIsDownloadingPDF(false);
    }
  };

  // Configuration state variables to persist checkbox selections
  const [configOptions, setConfigOptions] = useState({
    ledgers: false,
    billwiseBreakup: false
  });

  // Get the current company object using the selected guid and tallyloc_id
  const currentCompanyObj = useMemo(() => {
    if (!company) return null;
    const selectedCompanyTallylocId = sessionStorage.getItem('selectedCompanyTallylocId');
    // Match by both guid and tallyloc_id to handle companies with same guid but different tallyloc_id
    return companies.find(c => 
      c.guid === company && 
      (selectedCompanyTallylocId ? String(c.tallyloc_id) === String(selectedCompanyTallylocId) : true)
    );
  }, [company, companies]);

  // Listen for company changes from top bar
  useEffect(() => {
    const handleCompanyChange = () => {
      // Company changed from top bar, refresh data
      setDropdown3('');
      setTableData(null);
      setCurrentPage(1);
    };

    window.addEventListener('companyChanged', handleCompanyChange);
    return () => window.removeEventListener('companyChanged', handleCompanyChange);
  }, []);

  // Listen for global refresh from top bar
  useEffect(() => {
    const handleGlobalRefresh = () => {
      console.log('🔄 Ledgerbook: Global refresh received');
      setRefreshLedgers(prev => prev + 1);
    };

    window.addEventListener('globalRefresh', handleGlobalRefresh);
    return () => window.removeEventListener('globalRefresh', handleGlobalRefresh);
  }, []);

  // Listen for cache updates from Cache Management
  useEffect(() => {
    const handleCacheUpdate = (event) => {
      const { type, company: updatedCompany } = event.detail || {};
      if (type === 'customers') {
        const currentCompanyGuid = sessionStorage.getItem('selectedCompanyGuid') || '';
        const selectedCompanyTallylocId = sessionStorage.getItem('selectedCompanyTallylocId');
        // Match by both guid and tallyloc_id to handle companies with same guid but different tallyloc_id
        const currentCompany = companies.find(c => 
          c.guid === currentCompanyGuid && 
          (selectedCompanyTallylocId ? String(c.tallyloc_id) === String(selectedCompanyTallylocId) : true)
        );
        // Only refresh if the update is for the current company
        if (currentCompany && updatedCompany && 
            (updatedCompany.guid === currentCompanyGuid || 
             (updatedCompany.tallyloc_id === currentCompany.tallyloc_id && 
              updatedCompany.company === currentCompany.company))) {
          console.log('🔄 Ledgerbook: Customer cache updated, refreshing...');
          setRefreshLedgers(prev => prev + 1);
        }
      }
    };

    window.addEventListener('ledgerCacheUpdated', handleCacheUpdate);
    return () => window.removeEventListener('ledgerCacheUpdated', handleCacheUpdate);
  }, [companies]);

  // Filter ledgers based on search term with debouncing
  useEffect(() => {
    const currentSearchTerm = ledgerSearchTerm.trim();

    // Clear results immediately if search term is empty
    if (!currentSearchTerm) {
      // Don't set to empty here - let the dropdown useEffect handle showing all ledgers
      return;
    }

    // Clear previous results immediately when search term changes
    // This ensures old results don't show when user types new search term
    setFilteredLedgerOptions([]);

    // Debounce search to improve performance
    const timeoutId = setTimeout(() => {
      // Use captured search term to ensure we're searching with the correct value
      const searchLower = currentSearchTerm.toLowerCase();
      // Search in both NAME and GSTNO fields
      const exactMatches = [];
      const startsWithMatches = [];
      const containsMatches = [];

      for (let i = 0; i < ledgerOptions.length; i++) {
        const ledger = ledgerOptions[i];
        const ledgerName = ledger.NAME || '';
        const ledgerGstNo = ledger.GSTNO || '';
        const ledgerNameLower = ledgerName.toLowerCase();
        const ledgerGstNoLower = ledgerGstNo.toLowerCase();

        // Check if search term matches name or GST number
        const nameMatch = ledgerNameLower.includes(searchLower);
        const gstMatch = ledgerGstNoLower.includes(searchLower);

        if (nameMatch || gstMatch) {
          // Prioritize exact matches
          if (ledgerNameLower === searchLower || ledgerGstNoLower === searchLower) {
            exactMatches.push(ledger);
          } else if (ledgerNameLower.startsWith(searchLower) || ledgerGstNoLower.startsWith(searchLower)) {
            startsWithMatches.push(ledger);
          } else {
            containsMatches.push(ledger);
          }
        }

        // Early exit if we have enough results
        if (exactMatches.length + startsWithMatches.length + containsMatches.length >= 50) {
          break;
        }
      }

      // Combine results in priority order
      const filtered = [...exactMatches, ...startsWithMatches, ...containsMatches].slice(0, 50);
      setFilteredLedgerOptions(filtered);
    }, 150); // 150ms debounce

    return () => clearTimeout(timeoutId);
  }, [ledgerSearchTerm, ledgerOptions]);


  // Show all ledgers when dropdown opens
  useEffect(() => {
    if (showLedgerDropdown && !ledgerSearchTerm.trim()) {
      // Always show all ledgers when dropdown opens (like PlaceOrder)
      setFilteredLedgerOptions(ledgerOptions);
    }
  }, [showLedgerDropdown, ledgerSearchTerm, ledgerOptions]);

  // Function to get modified table data based on configuration options
  const getModifiedTableData = React.useCallback(() => {
    if (!tableData || !tableData.data) return [];

    let modifiedData = [...tableData.data];

    // Apply configuration-based modifications for Ledger Vouchers
    if (table === 'Ledger Vouchers') {
      if (configOptions.ledgers) {
        // Show ledger details - expand ALLLEDGERENTRIES
        let expandedData = [];
        modifiedData.forEach(row => {
          if (row.ALLLEDGERENTRIES && Array.isArray(row.ALLLEDGERENTRIES)) {
            // Add main voucher row
            expandedData.push({
              ...row,
              PARTICULARS: row.PARTICULARS,
              VCHTYPE: row.VCHTYPE,
              VCHNO: row.VCHNO,
              DEBITAMT: row.DEBITAMT,
              CREDITAMT: row.CREDITAMT,
              isMainRow: true
            });

            // Add ledger entry rows
            row.ALLLEDGERENTRIES.forEach(ledgerEntry => {
              expandedData.push({
                DATE: row.DATE,
                PARTICULARS: ledgerEntry.LEDGERNAME,
                VCHTYPE: row.VCHTYPE,
                VCHNO: row.VCHNO,
                DEBITAMT: ledgerEntry.DEBITAMT,
                CREDITAMT: ledgerEntry.CREDITAMT,
                isLedgerEntry: true,
                originalRow: row
              });
            });
          } else {
            // No ALLLEDGERENTRIES, keep original row
            expandedData.push(row);
          }
        });
        modifiedData = expandedData;
      }
    }

    // Apply configuration-based modifications for Bill wise O/s
    if (table === 'Bill wise O/s') {
      let expandedData = [];

      // Process regular bill rows and their vouchers if billwiseBreakup is enabled
      if (configOptions.billwiseBreakup) {
        modifiedData.forEach(row => {
          if (row.VOUCHERS && Array.isArray(row.VOUCHERS)) {
            // Add main bill row
            expandedData.push({
              ...row,
              isMainRow: true
            });

            // Add voucher entry rows
            row.VOUCHERS.forEach(voucher => {
              expandedData.push({
                DATE: voucher.DATE,
                REFNO: row.REFNO,
                DEBITOPENBAL: row.DEBITOPENBAL,
                CREDITOPENBAL: row.CREDITOPENBAL,
                DEBITCLSBAL: row.DEBITCLSBAL,
                CREDITCLSBAL: row.CREDITCLSBAL,
                DUEON: row.DUEON,
                OVERDUEDAYS: row.OVERDUEDAYS,
                VOUCHERTYPE: voucher.VOUCHERTYPE,
                VOUCHERNUMBER: voucher.VOUCHERNUMBER,
                DEBITAMT: voucher.DEBITAMT,
                CREDITAMT: voucher.CREDITAMT,
                ALLLEDGERENTRIES: voucher.ALLLEDGERENTRIES,
                BILLALLOCATIONS: voucher.BILLALLOCATIONS,
                INVENTORYALLOCATIONS: voucher.INVENTORYALLOCATIONS,
                isVoucherEntry: true,
                originalRow: row,
                originalVoucher: voucher,
                parentRefNo: row.REFNO,
                billRowSnapshot: row
              });
            });
          } else {
            // No VOUCHERS, keep original row
            expandedData.push(row);
          }
        });
      } else {
        // If billwiseBreakup is disabled, just add all regular rows
        expandedData.push(...modifiedData);
      }

      // Update modifiedData to include the expanded data
      modifiedData = expandedData;
    }

    return modifiedData;
  }, [tableData, table, configOptions]);

  // Handle ledger cache refresh
  const handleRefreshLedgers = async () => {
    if (!company || !currentCompanyObj) return;

    setRefreshingLedgers(true);
    setLedgerError('');

    try {
      console.log('🔄 Refreshing ledger cache...');
      await syncCustomers(currentCompanyObj);
      console.log('✅ Ledger cache refreshed successfully');
      
      // Dispatch event to notify other components
      window.dispatchEvent(new CustomEvent('ledgerCacheUpdated', { 
        detail: { type: 'customers', company: currentCompanyObj } 
      }));
      
      // Small delay to ensure cache is fully written and readable
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Trigger re-fetch by incrementing refreshLedgers
      setRefreshLedgers(prev => prev + 1);
    } catch (error) {
      console.error('❌ Error refreshing ledger cache:', error);
      setLedgerError('Failed to refresh ledger cache. Please try again.');
    } finally {
      setRefreshingLedgers(false);
    }
  };

  // Fetch ledgers when company changes or refreshLedgers increments
  useEffect(() => {
    const fetchLedgers = async () => {
      if (!company) {
        setLedgerOptions([]);
        setDropdown3('');
        return;
      }
      if (!currentCompanyObj) {
        setLedgerOptions([]);
        setDropdown3('');
        return;
      }
      const { tallyloc_id, company: companyVal, guid } = currentCompanyObj;
      const cacheKey = `ledgerlist-w-addrs_${tallyloc_id}_${companyVal}`;
      
      setLedgerLoading(true);
      setLedgerError('');
      
      // Retry logic for reading cache (handles timing issues after cache write)
      let ledgers = null;
      let retries = refreshLedgers > 0 ? 3 : 1; // Retry more times if we just refreshed
      let attempt = 0;
      
      while (attempt < retries && !ledgers) {
        try {
          attempt++;
          console.log(`📖 Attempting to load ledgers from cache (attempt ${attempt}/${retries})...`);
          
          // Get customers from cache instead of making API call
          // Note: syncCustomers already handles clearing and writing cache, so we just read it here
          ledgers = await getCustomersFromOPFS(cacheKey);
          
          if (ledgers && Array.isArray(ledgers) && ledgers.length > 0) {
            console.log(`✅ Successfully loaded ${ledgers.length} ledgers from cache`);
            break;
          } else {
            ledgers = null;
            if (attempt < retries) {
              console.log(`⚠️ No data found, retrying in 200ms...`);
              await new Promise(resolve => setTimeout(resolve, 200));
            }
          }
        } catch (err) {
          console.error(`❌ Error loading ledgers from cache (attempt ${attempt}):`, err);
          if (attempt < retries) {
            await new Promise(resolve => setTimeout(resolve, 200));
          } else {
            const errorMessage = err.message || 'Failed to load ledgers from cache';
            setLedgerError(errorMessage);
            setLedgerOptions([]);
            setDropdown3('');
            setLedgerLoading(false);
            return;
          }
        }
      }
      
      if (ledgers && Array.isArray(ledgers) && ledgers.length > 0) {
        setLedgerOptions(ledgers);
        if (ledgers.length === 1) setDropdown3(ledgers[0].NAME);
        else setDropdown3('');
        setLedgerError('');
      } else {
        // No data in cache after retries
        console.warn('⚠️ No customer data found in cache after retries');
        setLedgerOptions([]);
        setDropdown3('');
        setLedgerError('No customer data found in cache. Please sync customers first from Cache Management.');
      }
      
      setLedgerLoading(false);
    };

    fetchLedgers();
  }, [company, refreshLedgers, currentCompanyObj]);

  // Handle clicks outside configuration dropdown and escape key
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showConfigOptions && !event.target.closest('[data-config-dropdown]')) {
        setShowConfigOptions(false);
      }

      // Handle clicks outside ledger dropdown
      if (showLedgerDropdown && !event.target.closest('[data-ledger-dropdown]')) {
        setShowLedgerDropdown(false);
      }
    };

    const handleEscapeKey = (event) => {
      if (event.key === 'Escape') {
        if (showConfigOptions) {
          setShowConfigOptions(false);
        }
        if (showLedgerDropdown) {
          setShowLedgerDropdown(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscapeKey);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [showConfigOptions, showLedgerDropdown]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!company || !dropdown3) return;

    if (!currentCompanyObj) return;

    const { tallyloc_id, company: companyVal, guid } = currentCompanyObj;

    // Convert dates to required format (YYYYMMDD)
    const fromDateFormatted = parseInt(fromDate.replace(/-/g, ''));
    const toDateFormatted = parseInt(toDate.replace(/-/g, ''));

    setTableLoading(true);
    setTableError('');
    setTableData(null);
    setCurrentPage(1); // Reset to first page when new data is fetched

    const payload = {
      tallyloc_id,
      company: companyVal,
      guid,
      reporttype: table,
      ledgername: dropdown3,
      fromdate: fromDateFormatted,
      todate: toDateFormatted
    };

    try {
      const data = await apiPost('/api/tally/led_statbillrep', payload);

      if (data && data.data && Array.isArray(data.data)) {
        setTableData(data);
        setTableError('');
      } else if (data && data.error) {
        setTableError(data.error);
        setTableData(null);
      } else {
        setTableError('No data received');
        setTableData(null);
      }
    } catch (error) {
      setTableError('Failed to fetch data');
      setTableData(null);
    } finally {
      setTableLoading(false);
    }
  };

  // Export functionality
  const handleExport = (type) => {
    if (!tableData || !tableData.data) return;

    if (type === 'pdf') {
      // PDF export logic
      const printWindow = window.open('', '_blank');
      printWindow.document.write(`
         <html>
           <head>
             <title>${table} - ${tableData.ledgername}</title>
             <style>
               body { font-family: Arial, sans-serif; margin: 20px; }
               table { border-collapse: collapse; width: 100%; margin-top: 20px; }
               th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
               th { background-color: #f2f2f2; font-weight: bold; }
               .header { text-align: center; margin-bottom: 20px; }
               .period { text-align: center; color: #666; margin-bottom: 20px; }
             </style>
           </head>
           <body>
             <div class="header">
               <h1 style="margin: 0 0 10px 0; color: #1e293b; font-size: 24px;">${currentCompanyObj?.company || ''}</h1>
               <h2 style="margin: 0 0 10px 0; color: #374151; font-size: 20px;">${table}</h2>
               <h3 style="margin: 0 0 10px 0; color: #475569; font-size: 18px;">Ledger: ${tableData.ledgername}</h3>
               <div class="period">Period: ${(() => {
          const fromDateStr = tableData.fromdate.toString();
          const toDateStr = tableData.todate.toString();
          const fromDay = fromDateStr.slice(6, 8);
          const fromMonth = fromDateStr.slice(4, 6);
          const fromYear = fromDateStr.slice(0, 4);
          const toDay = toDateStr.slice(6, 8);
          const toMonth = toDateStr.slice(4, 6);
          const toYear = toDateStr.slice(0, 4);
          return `${fromDay}-${fromMonth}-${fromYear} to ${toDay}-${toMonth}-${toYear}`;
        })()}</div>
             </div>
             ${generateTableHTML()}
           </body>
         </html>
       `);
      printWindow.document.close();
      printWindow.print();
    } else if (type === 'excel') {
      // Excel export logic
      let csvContent = '';

      if (table === 'Ledger Vouchers') {
        csvContent = 'Date,Particulars,Sub Debit,Sub Credit,Vch Type,Vch No.,Debit,Credit\n';
        modifiedData.forEach(row => {
          const particulars = row.isLedgerEntry ? row.PARTICULARS : row.PARTICULARS;
          const subDebit = row.isLedgerEntry ? (row.DEBITAMT || 0) : '';
          const subCredit = row.isLedgerEntry ? (row.CREDITAMT || 0) : '';
          const date = row.isLedgerEntry ? '' : row.DATE;
          const vchType = row.isLedgerEntry ? '-' : row.VCHTYPE;
          const vchNo = row.isLedgerEntry ? '-' : row.VCHNO;
          const debit = row.isLedgerEntry ? '-' : (row.DEBITAMT || 0);
          const credit = row.isLedgerEntry ? '-' : (row.CREDITAMT || 0);
          csvContent += `${date},"${particulars}",${subDebit},${subCredit},${vchType},${vchNo},${debit},${credit}\n`;
        });
      } else {
        if (configOptions.billwiseBreakup) {
          csvContent = 'Date,Ref No,Vch Type,Amount,Opening Amount,Pending Amount,Due On,Overdue Days\n';
          modifiedData.forEach(row => {
            const debitOpen = parseFloat(row.DEBITOPENBAL || 0);
            const creditOpen = parseFloat(row.CREDITOPENBAL || 0);
            const debitClose = parseFloat(row.DEBITCLSBAL || 0);
            const creditClose = parseFloat(row.DEBITCLSBAL || 0);

            let openingAmount = '-';
            if (debitOpen > 0) openingAmount = `${debitOpen} Dr`;
            else if (creditOpen > 0) openingAmount = `${creditOpen} Cr`;

            let pendingAmount = '-';
            if (debitClose > 0) pendingAmount = `${debitClose} Dr`;
            else if (creditClose > 0) pendingAmount = `${debitClose} Cr`;

            let vchType = row.isVoucherEntry ? row.VOUCHERTYPE : '';
            let amount = '';
            if (row.isVoucherEntry) {
              if (row.DEBITAMT > 0) amount = `${row.DEBITAMT} Dr`;
              else if (row.CREDITAMT > 0) amount = `${row.CREDITAMT} Cr`;
            }

            // For sub-lines, show empty opening/pending amounts and correct REFNO
            const refNo = row.isVoucherEntry ? (row.isOnAccountVoucher ? 'On Account' : row.VOUCHERNUMBER) : (row.isMainOnAccountRow ? 'On Account:' : row.REFNO);
            const finalOpeningAmount = row.isVoucherEntry ? '' : openingAmount;
            const finalPendingAmount = row.isVoucherEntry ? '' : pendingAmount;

            csvContent += `${row.DATE},${refNo},"${vchType}","${amount}","${finalOpeningAmount}","${finalPendingAmount}",${row.DUEON || '-'},${row.OVERDUEDAYS || '-'}\n`;
          });

          // Add On Account row if it exists
          if (tableData.onacc && (parseFloat(tableData.onacc.DEBITOPENBAL || 0) > 0 || parseFloat(tableData.onacc.CREDITOPENBAL || 0) > 0)) {
            const onaccDebitOpen = parseFloat(tableData.onacc.DEBITOPENBAL || 0);
            const onaccCreditOpen = parseFloat(tableData.onacc.CREDITOPENBAL || 0);
            const onaccDebitClose = parseFloat(tableData.onacc.DEBITCLSBAL || 0);
            const onaccCreditClose = parseFloat(tableData.onacc.CREDITCLSBAL || 0);

            let onaccOpeningAmount = '-';
            if (onaccDebitOpen > 0) onaccOpeningAmount = `${onaccDebitOpen} Dr`;
            else if (onaccCreditOpen > 0) onaccOpeningAmount = `${onaccCreditOpen} Cr`;

            let onaccPendingAmount = '-';
            if (onaccDebitClose > 0) onaccPendingAmount = `${onaccDebitClose} Dr`;
            else if (onaccCreditClose > 0) onaccPendingAmount = `${onaccCreditClose} Cr`;

            csvContent += `,On Account:,"","","${onaccOpeningAmount}","${onaccPendingAmount}",-,-`;

            // Add ONACCVOUCHERSOPEN and ONACCVOUCHERS entries
            if (tableData.onacc.ONACCVOUCHERSOPEN && Array.isArray(tableData.onacc.ONACCVOUCHERSOPEN)) {
              tableData.onacc.ONACCVOUCHERSOPEN.forEach(voucher => {
                const amount = voucher.DEBITAMT > 0 ? `${voucher.DEBITAMT} Dr` : voucher.CREDITAMT > 0 ? `${voucher.CREDITAMT} Cr` : '';
                csvContent += `\n${voucher.DATE},${voucher.VOUCHERNUMBER || ''},${voucher.VOUCHERTYPE},"${amount}","","",-,-`;
              });
            }

            if (tableData.onacc.ONACCVOUCHERS && Array.isArray(tableData.onacc.ONACCVOUCHERS)) {
              tableData.onacc.ONACCVOUCHERS.forEach(voucher => {
                const amount = voucher.DEBITAMT > 0 ? `${voucher.DEBITAMT} Dr` : voucher.CREDITAMT > 0 ? `${voucher.CREDITAMT} Cr` : '';
                csvContent += `\n${voucher.DATE},${voucher.VOUCHERNUMBER || ''},${voucher.VOUCHERTYPE},"${amount}","","",-,-`;
              });
            }
          }
        } else {
          csvContent = 'Date,Ref No,Opening Amount,Pending Amount,Due On,Overdue Days\n';
          tableData.data.forEach(row => {
            const debitOpen = parseFloat(row.DEBITOPENBAL || 0);
            const creditOpen = parseFloat(row.CREDITOPENBAL || 0);
            const debitClose = parseFloat(row.DEBITCLSBAL || 0);
            const creditClose = parseFloat(row.CREDITCLSBAL || 0);

            let openingAmount = '-';
            if (debitOpen > 0) openingAmount = `${debitOpen} Dr`;
            else if (creditOpen > 0) openingAmount = `${creditOpen} Cr`;

            let pendingAmount = '-';
            if (debitClose > 0) pendingAmount = `${debitClose} Dr`;
            else if (creditClose > 0) pendingAmount = `${debitClose} Cr`;

            csvContent += `${row.DATE},${row.REFNO},"${openingAmount}","${pendingAmount}",${row.DUEON || '-'},${row.OVERDUEDAYS || '-'}\n`;
          });

          // Add On Account row if it exists
          if (tableData.onacc && (parseFloat(tableData.onacc.DEBITOPENBAL || 0) > 0 || parseFloat(tableData.onacc.CREDITOPENBAL || 0) > 0)) {
            const onaccDebitOpen = parseFloat(tableData.onacc.DEBITOPENBAL || 0);
            const onaccCreditOpen = parseFloat(tableData.onacc.CREDITOPENBAL || 0);
            const onaccDebitClose = parseFloat(tableData.onacc.DEBITCLSBAL || 0);
            const onaccCreditClose = parseFloat(tableData.onacc.CREDITCLSBAL || 0);

            let onaccOpeningAmount = '-';
            if (onaccDebitOpen > 0) onaccOpeningAmount = `${onaccDebitOpen} Dr`;
            else if (onaccCreditOpen > 0) onaccOpeningAmount = `${onaccCreditOpen} Cr`;

            let onaccPendingAmount = '-';
            if (onaccDebitClose > 0) onaccPendingAmount = `${onaccDebitClose} Dr`;
            else if (onaccCreditClose > 0) onaccPendingAmount = `${onaccCreditClose} Cr`;

            csvContent += `,On Account:,"${onaccOpeningAmount}","${onaccPendingAmount}",-,-`;
          }
        }
      }

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `${table}_${tableData.ledgername}_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Print functionality
  const handlePrint = () => {
    if (!tableData || !tableData.data) return;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
       <html>
         <head>
           <title>${table} - ${tableData.ledgername}</title>
           <style>
             body { font-family: Arial, sans-serif; margin: 20px; }
             table { border-collapse: collapse; width: 100%; margin-top: 20px; }
             th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
             th { background-color: #f2f2f2; font-weight: bold; }
             .header { text-align: center; margin-bottom: 20px; }
             .period { text-align: center; color: #666; margin-bottom: 20px; }
             @media print {
               body { margin: 0; }
               .no-print { display: none; }
             }
           </style>
         </head>
         <body>
           <div class="header">
             <h1 style="margin: 0 0 10px 0; color: #1e293b; font-size: 24px;">${currentCompanyObj?.company || ''}</h1>
             <h2 style="margin: 0 0 10px 0; color: #374151; font-size: 20px;">${table}</h2>
             <h3 style="margin: 0 0 10px 0; color: #475569; font-size: 18px;">Ledger: ${tableData.ledgername}</h3>
             <div class="period">Period: ${(() => {
        const fromDateStr = tableData.fromdate.toString();
        const toDateStr = tableData.todate.toString();
        const fromDay = fromDateStr.slice(6, 8);
        const fromMonth = fromDateStr.slice(4, 6);
        const fromYear = fromDateStr.slice(0, 4);
        const toDay = toDateStr.slice(6, 8);
        const toMonth = toDateStr.slice(4, 6);
        const toYear = toDateStr.slice(0, 4);
        return `${fromDay}-${fromMonth}-${fromYear} to ${toDay}-${toMonth}-${toYear}`;
      })()}</div>
           </div>
           ${generateTableHTML()}
         </body>
       </html>
     `);
    printWindow.document.close();
    printWindow.print();
  };

  // Helper function to generate table HTML for export/print
  const generateTableHTML = () => {
    if (table === 'Ledger Vouchers') {
      // Calculate current total from all records (only main rows, not sub-rows)
      const currentTotalDebit = modifiedData.filter(row => !row.isLedgerEntry).reduce((sum, row) => sum + parseFloat(row.DEBITAMT || 0), 0);
      const currentTotalCredit = modifiedData.filter(row => !row.isLedgerEntry).reduce((sum, row) => sum + parseFloat(row.CREDITAMT || 0), 0);

      return `
         <table>
           <thead>
             <tr>
               <th>Date</th>
               <th>Particulars</th>
               <th style="width: 80px;"></th>
               <th style="width: 80px;"></th>
               <th>Vch Type</th>
               <th>Vch No.</th>
               <th>Debit</th>
               <th>Credit</th>
             </tr>
           </thead>
           <tbody>
             ${modifiedData.map(row => `
               <tr style="${row.isLedgerEntry ? 'background-color: #f8fafc;' : ''}">
                 <td>${row.isLedgerEntry ? '' : row.DATE}</td>
                 <td style="${row.isLedgerEntry ? 'padding-left: 20px; font-style: italic; color: #64748b;' : ''}">${row.PARTICULARS}</td>
                 <td style="width: 80px; text-align: right;">${row.isLedgerEntry ? (row.DEBITAMT ? parseFloat(row.DEBITAMT).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '') : ''}</td>
                 <td style="width: 80px; text-align: right;">${row.isLedgerEntry ? (row.CREDITAMT ? parseFloat(row.CREDITAMT).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '') : ''}</td>
                 <td>${row.isLedgerEntry ? '' : row.VCHTYPE}</td>
                 <td>${row.isLedgerEntry ? '' : row.VCHNO}</td>
                 <td>${row.isLedgerEntry ? '' : (row.DEBITAMT ? parseFloat(row.DEBITAMT).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '')}</td>
                 <td>${row.isLedgerEntry ? '' : (row.CREDITAMT ? parseFloat(row.CREDITAMT).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '')}</td>
               </tr>
             `).join('')}
           </tbody>
         </table>
         <div style="margin-top: 20px; padding: 15px; border: 1px solid #ddd; background-color: #f9f9f9;">
           <table style="width: 100%; border-collapse: collapse;">
             <tr>
               <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; width: 60%;">Opening Balance</td>
               <td style="padding: 8px; border: 1px solid #ddd; text-align: right; width: 20%;">${tableData.opening?.DEBITAMT ? parseFloat(tableData.opening.DEBITAMT).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}</td>
               <td style="padding: 8px; border: 1px solid #ddd; text-align: right; width: 20%;">${tableData.opening?.CREDITAMT ? parseFloat(tableData.opening.CREDITAMT).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}</td>
             </tr>
             <tr>
               <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; width: 60%;">Current Total</td>
               <td style="padding: 8px; border: 1px solid #ddd; text-align: right; width: 20%;">${currentTotalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
               <td style="padding: 8px; border: 1px solid #ddd; text-align: right; width: 20%;">${currentTotalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
             </tr>
             <tr>
               <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; width: 60%;">Closing Balance</td>
               <td style="padding: 8px; border: 1px solid #ddd; text-align: right; width: 20%;">${tableData.closing?.DEBITAMT ? parseFloat(tableData.closing.DEBITAMT).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}</td>
               <td style="padding: 8px; border: 1px solid #ddd; text-align: right; width: 20%;">${tableData.closing?.CREDITAMT ? parseFloat(tableData.closing.CREDITAMT).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}</td>
             </tr>
           </table>
         </div>
       `;
    } else {
      // Add On Account row if it has non-zero values
      let onAccountRow = '';
      if (tableData.onacc && (parseFloat(tableData.onacc.DEBITOPENBAL || 0) > 0 || parseFloat(tableData.onacc.CREDITOPENBAL || 0) > 0)) {
        const onaccDebitOpen = parseFloat(tableData.onacc.DEBITOPENBAL || 0);
        const onaccCreditOpen = parseFloat(tableData.onacc.CREDITOPENBAL || 0);
        const onaccDebitClose = parseFloat(tableData.onacc.DEBITCLSBAL || 0);
        const onaccCreditClose = parseFloat(tableData.onacc.CREDITCLSBAL || 0);

        let onaccOpeningAmount = '-';
        if (onaccDebitOpen > 0) onaccOpeningAmount = `${onaccDebitOpen.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Dr`;
        else if (onaccCreditOpen > 0) onaccOpeningAmount = `${onaccCreditOpen.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Cr`;

        let onaccPendingAmount = '-';
        if (onaccDebitClose > 0) onaccPendingAmount = `${onaccDebitClose.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Dr`;
        else if (onaccCreditClose > 0) onaccPendingAmount = `${onaccCreditClose.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Cr`;

        onAccountRow = `
           <tr style="background-color: #f0f0f0; font-weight: bold;">
             <td colspan="2">On Account</td>
             ${configOptions.billwiseBreakup ? '<td colspan="2"></td>' : ''}
             <td>${onaccOpeningAmount}</td>
             <td>${onaccPendingAmount}</td>
             <td colspan="2">-</td>
           </tr>
         `;

        // Add ONACCVOUCHERSOPEN and ONACCVOUCHERS entries if billwiseBreakup is enabled
        if (configOptions.billwiseBreakup) {
          // Add ONACCVOUCHERSOPEN entries - UPDATED
          if (tableData.onacc.ONACCVOUCHERSOPEN && Array.isArray(tableData.onacc.ONACCVOUCHERSOPEN)) {
            tableData.onacc.ONACCVOUCHERSOPEN.forEach(voucher => {
              onAccountRow += `
                 <tr style="background-color: #f8fafc;">
                   <td style="font-style: italic; color: #64748b;">${voucher.DATE}</td>
                   <td style="padding-left: 20px; font-style: italic; color: #64748b;">${voucher.VOUCHERNUMBER || ''}</td>
                   <td style="font-style: italic; color: #64748b;">${voucher.VOUCHERTYPE}</td>
                   <td style="text-align: right; font-style: italic; color: #64748b;">${voucher.DEBITAMT > 0 ?
                  `${parseFloat(voucher.DEBITAMT).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Dr` :
                  voucher.CREDITAMT > 0 ?
                    `${parseFloat(voucher.CREDITAMT).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Cr` : ''
                }</td>
                   <td style="font-style: italic; color: #64748b;"></td>
                   <td style="font-style: italic; color: #64748b;"></td>
                   <td style="font-style: italic; color: #64748b;"></td>
                   <td style="font-style: italic; color: #64748b;"></td>
                 </tr>
               `;
            });
          }

          // Add ONACCVOUCHERS entries - UPDATED
          if (tableData.onacc.ONACCVOUCHERS && Array.isArray(tableData.onacc.ONACCVOUCHERS)) {
            tableData.onacc.ONACCVOUCHERS.forEach(voucher => {
              onAccountRow += `
                 <tr style="background-color: #f8fafc;">
                   <td style="font-style: italic; color: #64748b;">${voucher.DATE}</td>
                   <td style="padding-left: 20px; font-style: italic; color: #64748b;">${voucher.VOUCHERNUMBER || ''}</td>
                   <td style="font-style: italic; color: #64748b;">${voucher.VOUCHERTYPE}</td>
                   <td style="text-align: right; font-style: italic; color: #64748b;">${voucher.DEBITAMT > 0 ?
                  `${parseFloat(voucher.DEBITAMT).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Dr` :
                  voucher.CREDITAMT > 0 ?
                    `${parseFloat(voucher.CREDITAMT).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Cr` : ''
                }</td>
                   <td style="font-style: italic; color: #64748b;"></td>
                   <td style="font-style: italic; color: #64748b;"></td>
                   <td style="font-style: italic; color: #64748b;"></td>
                   <td style="font-style: italic; color: #64748b;"></td>
                 </tr>
               `;
            });
          }
        }
      }

      // Calculate totals from main records only (exclude sub-lines) and add On Account values
      const totalDebitOpen = modifiedData.filter(row => !row.isVoucherEntry).reduce((sum, row) => sum + parseFloat(row.DEBITOPENBAL || 0), 0);
      const totalCreditOpen = modifiedData.filter(row => !row.isVoucherEntry).reduce((sum, row) => sum + parseFloat(row.CREDITOPENBAL || 0), 0);
      const totalDebitClose = modifiedData.filter(row => !row.isVoucherEntry).reduce((sum, row) => sum + parseFloat(row.DEBITCLSBAL || 0), 0);
      const totalCreditClose = modifiedData.filter(row => !row.isVoucherEntry).reduce((sum, row) => sum + parseFloat(row.CREDITCLSBAL || 0), 0);

      // Add On Account values to totals
      let onaccDebitOpen = 0, onaccCreditOpen = 0, onaccDebitClose = 0, onaccCreditClose = 0;
      if (tableData.onacc) {
        onaccDebitOpen = parseFloat(tableData.onacc.DEBITOPENBAL || 0);
        onaccCreditOpen = parseFloat(tableData.onacc.CREDITOPENBAL || 0);
        onaccDebitClose = parseFloat(tableData.onacc.DEBITCLSBAL || 0);
        onaccCreditClose = parseFloat(tableData.onacc.CREDITCLSBAL || 0);
      }

      const finalTotalDebitOpen = totalDebitOpen + onaccDebitOpen;
      const finalTotalCreditOpen = totalCreditOpen + onaccCreditOpen;
      const finalTotalDebitClose = totalDebitClose + onaccDebitClose;
      const finalTotalCreditClose = totalCreditClose + onaccCreditClose;

      let totalOpeningAmount = '-';
      if (finalTotalDebitOpen > 0) totalOpeningAmount = `${finalTotalDebitOpen.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Dr`;
      else if (finalTotalCreditOpen > 0) totalOpeningAmount = `${finalTotalCreditOpen.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Cr`;

      let totalPendingAmount = '-';
      if (finalTotalDebitClose > 0) totalPendingAmount = `${finalTotalDebitClose.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Dr`;
      else if (finalTotalCreditClose > 0) totalPendingAmount = `${finalTotalCreditClose.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Cr`;

      return `
         <table>
           <thead>
             <tr>
               <th>Date</th>
               <th>Ref No</th>
               ${configOptions.billwiseBreakup ? '<th>Vch Type</th><th>Amount</th>' : ''}
               <th>Opening Amount</th>
               <th>Pending Amount</th>
               <th>Due On</th>
               <th>Overdue Days</th>
             </tr>
           </thead>
           <tbody>
             ${modifiedData.map(row => {
        const debitOpen = parseFloat(row.DEBITOPENBAL || 0);
        const creditOpen = parseFloat(row.CREDITOPENBAL || 0);
        const debitClose = parseFloat(row.DEBITCLSBAL || 0);
        const creditClose = parseFloat(row.CREDITCLSBAL || 0);

        let openingAmount = '-';
        if (debitOpen > 0) openingAmount = `${debitOpen.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Dr`;
        else if (creditOpen > 0) openingAmount = `${creditOpen.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Cr`;

        let pendingAmount = '-';
        if (debitClose > 0) pendingAmount = `${debitClose.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Dr`;
        else if (creditClose > 0) pendingAmount = `${creditClose.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Cr`;

        return `
                 <tr style="${row.isVoucherEntry ? 'background-color: #f8fafc;' : ''}">
                   <td style="${row.isVoucherEntry ? 'font-style: italic; color: #64748b;' : ''}">${row.DATE}</td>
                   <td style="${row.isVoucherEntry ? 'font-style: italic; color: #64748b; padding-left: 20px;' : ''}">${row.isVoucherEntry ? (row.isOnAccountVoucher ? 'On Account' : row.VOUCHERNUMBER) : (row.isMainOnAccountRow ? 'On Account:' : row.REFNO)}</td>
                   ${configOptions.billwiseBreakup ? `<td style="font-style: italic; color: #64748b;">${row.isVoucherEntry ? row.VOUCHERTYPE : ''}</td><td style="text-align: right; font-style: italic; color: #64748b;">${(() => {
            if (row.isVoucherEntry) {
              if (row.DEBITAMT > 0) return `${parseFloat(row.DEBITAMT).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Dr`;
              else if (row.CREDITAMT > 0) return `${parseFloat(row.CREDITAMT).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Cr`;
            }
            return '';
          })()}</td>` : ''}
                   <td style="${row.isVoucherEntry ? 'font-style: italic; color: #64748b;' : ''}">${row.isVoucherEntry ? '' : openingAmount}</td>
                   <td style="${row.isVoucherEntry ? 'font-style: italic; color: #64748b;' : ''}">${row.isVoucherEntry ? '' : pendingAmount}</td>
                   <td style="${row.isVoucherEntry ? 'font-style: italic; color: #64748b;' : ''}">${row.DUEON || '-'}</td>
                   <td style="${row.isVoucherEntry ? 'font-style: italic; color: #64748b;' : ''}">${row.OVERDUEDAYS || '-'}</td>
                 </tr>
               `;
      }).join('')}
             ${onAccountRow}
           </tbody>
         </table>
         <div style="margin-top: 20px; padding: 15px; border: 1px solid #ddd; background-color: #f9f9f9;">
           <table style="width: 100%; border-collapse: collapse;">
             <tr>
               <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; width: ${configOptions.billwiseBreakup ? '40%' : '60%'};">Total</td>
               ${configOptions.billwiseBreakup ? '<td colspan="2"></td>' : ''}
               <td style="padding: 8px; border: 1px solid #ddd; text-align: right; width: ${configOptions.billwiseBreakup ? '15%' : '20%'};">${totalOpeningAmount}</td>
               <td style="padding: 8px; border: 1px solid #ddd; text-align: right; width: ${configOptions.billwiseBreakup ? '15%' : '20%'};">${totalPendingAmount}</td>
             </tr>
           </table>
         </div>
       `;
    }
  };


  // Pagination functions
  const modifiedData = useMemo(() => getModifiedTableData(), [tableData, table, configOptions.billwiseBreakup, configOptions.ledgers, /* stable ref */ getModifiedTableData]);

  // For Ledger Vouchers and Bill wise O/s, pagination should work based on main rows only (not sub-rows)
  let paginationData = modifiedData;
  if (table === 'Ledger Vouchers') {
    paginationData = modifiedData.filter(row => !row.isLedgerEntry);
  } else if (table === 'Bill wise O/s') {
    paginationData = modifiedData.filter(row => !row.isVoucherEntry);
  }

  const indexOfLastRecord = currentPage * recordsPerPage;
  const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;
  const currentRecords = table === 'Ledger Vouchers'
    ? paginationData.slice(indexOfFirstRecord, indexOfLastRecord).map(mainRow => {
      // Find the corresponding main row in modifiedData to get all its sub-rows
      const mainRowIndex = modifiedData.findIndex(row =>
        !row.isLedgerEntry &&
        row.DATE === mainRow.DATE &&
        row.VCHTYPE === mainRow.VCHTYPE &&
        row.VCHNO === mainRow.VCHNO
      );

      if (mainRowIndex !== -1) {
        // Return the main row and all its sub-rows
        const allRows = [];
        let i = mainRowIndex;
        while (i < modifiedData.length &&
          (modifiedData[i].isLedgerEntry ||
            (modifiedData[i].DATE === mainRow.DATE &&
              modifiedData[i].VCHTYPE === mainRow.VCHTYPE &&
              modifiedData[i].VCHNO === mainRow.VCHNO))) {
          allRows.push(modifiedData[i]);
          i++;
        }
        return allRows;
      }
      return [mainRow];
    }).flat()
    : table === 'Bill wise O/s'
      ? paginationData.slice(indexOfFirstRecord, indexOfLastRecord).map(mainRow => {
        // Find the corresponding main row in modifiedData to get all its sub-rows
        const mainRowIndex = modifiedData.findIndex(row =>
          !row.isVoucherEntry &&
          row.REFNO === mainRow.REFNO
        );

        if (mainRowIndex !== -1) {
          // Return the main row and all its sub-rows
          const allRows = [];
          let i = mainRowIndex;
          while (i < modifiedData.length &&
            (modifiedData[i].isVoucherEntry ||
              (modifiedData[i].REFNO === mainRow.REFNO))) {
            allRows.push(modifiedData[i]);
            i++;
          }
          return allRows;
        }
        return [mainRow];
      }).flat()
      : modifiedData.slice(indexOfFirstRecord, indexOfLastRecord);
  const totalPages = Math.ceil(paginationData.length / recordsPerPage);

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  const handleConfigOption = (option, checked) => {
    // Update configuration state to persist checkbox selections
    setConfigOptions(prev => ({
      ...prev,
      [option]: checked
    }));

    // Reset to first page when configuration changes
    setCurrentPage(1);

    // Handle different configuration options
    switch (option) {
      case 'ledgers':
        console.log('Show Ledger Details (Dr/Cr):', checked);
        break;
      case 'billwiseBreakup':
        console.log('Show Billwise Breakup:', checked);
        break;
      default:
        break;
    }
  };



  return (
    <div className="ledgerbook-container" style={{
      width: '100%',
      minHeight: 'calc(100vh - 120px)',
      padding: '16px',
      margin: 0,
      boxSizing: 'border-box',
    }}>
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

          /* Mobile Responsive Styles */
          @media (max-width: 768px) {
            /* Main container */
            .ledgerbook-container {
              padding: 8px !important;
              overflow-x: hidden !important;
              max-width: 100vw !important;
            }

            /* Form container */
            .ledgerbook-form-container {
              padding: 8px !important;
              overflow: visible !important;
            }

            /* Header section */
            .ledgerbook-header {
              flex-direction: column !important;
              align-items: flex-start !important;
              gap: 12px !important;
              padding-bottom: 12px !important;
            }

            .ledgerbook-header-left {
              width: 100% !important;
            }

            .ledgerbook-header-right {
              width: 100% !important;
              justify-content: flex-start !important;
            }

            .ledgerbook-title {
              font-size: 18px !important;
            }

            .ledgerbook-icon {
              width: 32px !important;
              height: 32px !important;
            }

            .ledgerbook-icon .material-icons {
              font-size: 16px !important;
            }

            /* Ledger count display */
            .ledger-count-display {
              max-width: 100% !important;
              font-size: 12px !important;
              padding: 6px 12px !important;
            }

            /* Form grid - stack on mobile */
            .ledgerbook-form-grid {
              grid-template-columns: 1fr !important;
              gap: 12px !important;
              margin-bottom: 16px !important;
            }

            /* Form inputs */
            .ledgerbook-input-wrapper {
              width: 100% !important;
            }

            .ledgerbook-input {
              padding: 14px 16px !important;
              font-size: 14px !important;
            }

            .ledgerbook-input-label {
              font-size: 10px !important;
            }

            /* Submit button */
            .ledgerbook-submit-button {
              width: 100% !important;
              min-width: auto !important;
              padding: 14px 24px !important;
            }

            /* Table area - improved mobile view */
            .ledgerbook-table-area {
              padding: 12px 8px !important;
              overflow-x: hidden !important;
              max-width: 100% !important;
            }

            /* Export buttons */
            .ledgerbook-export-buttons {
              flex-direction: column !important;
              gap: 8px !important;
              margin-bottom: 12px !important;
              width: 100% !important;
              align-items: stretch !important;
            }

            .ledgerbook-export-buttons > div {
              width: 100% !important;
              display: flex !important;
              flex-wrap: wrap !important;
              gap: 6px !important;
            }

            .ledgerbook-export-buttons > div[data-config-dropdown] {
              width: 100% !important;
            }

            .ledgerbook-export-buttons > div[data-config-dropdown] button {
              width: 100% !important;
            }

            .ledgerbook-export-button {
              flex: 1 1 calc(50% - 3px) !important;
              min-width: calc(50% - 3px) !important;
              max-width: calc(50% - 3px) !important;
              padding: 8px 12px !important;
              font-size: 12px !important;
            }

            .ledgerbook-export-button .material-icons {
              font-size: 14px !important;
            }

            /* Table header info */
            .ledgerbook-table-header {
              flex-direction: column !important;
              align-items: flex-start !important;
              gap: 8px !important;
              width: 100% !important;
            }

            .ledgerbook-table-header h3 {
              font-size: 16px !important;
              word-break: break-word !important;
              width: 100% !important;
            }

            .ledgerbook-table-header .period {
              font-size: 12px !important;
              word-break: break-word !important;
              width: 100% !important;
            }

            /* Table wrapper - horizontal scroll */
            .ledgerbook-table-wrapper {
              overflow-x: auto !important;
              -webkit-overflow-scrolling: touch !important;
              width: 100% !important;
              max-width: 100% !important;
              margin: 0 !important;
            }

            .ledgerbook-table {
              min-width: 800px !important;
            }

            .ledgerbook-table th,
            .ledgerbook-table td {
              padding: 12px 14px !important;
              font-size: 13px !important;
            }

            /* Config button */
            .ledgerbook-config-button {
              padding: 8px 12px !important;
              font-size: 12px !important;
            }

            /* Pagination controls */
            .ledgerbook-pagination {
              flex-direction: column !important;
              gap: 12px !important;
              align-items: stretch !important;
            }

            .ledgerbook-pagination > div:first-child {
              width: 100% !important;
              text-align: center !important;
              font-size: 12px !important;
            }

            .ledgerbook-pagination > div:last-child {
              width: 100% !important;
              display: flex !important;
              justify-content: center !important;
              flex-wrap: wrap !important;
              gap: 6px !important;
            }

            .ledgerbook-pagination button {
              flex: 1 1 auto !important;
              min-width: 60px !important;
              padding: 10px 12px !important;
              font-size: 13px !important;
            }

            /* Opening/Current/Closing balance tables */
            .ledgerbook-table-area table {
              font-size: 13px !important;
            }

            .ledgerbook-table-area table td {
              padding: 12px 8px !important;
              font-size: 13px !important;
            }

            /* Table container improvements */
            .ledgerbook-table-container {
              width: 100% !important;
              max-width: 100% !important;
              overflow-x: hidden !important;
            }

            .ledgerbook-table-container > div {
              width: 100% !important;
              max-width: 100% !important;
            }

            .ledgerbook-table-header-section {
              width: 100% !important;
              max-width: 100% !important;
              overflow-x: hidden !important;
            }

            /* Empty state message */
            .ledgerbook-empty-state {
              padding-left: 16px !important;
              padding-right: 16px !important;
              padding-top: 40px !important;
              padding-bottom: 40px !important;
              text-align: center !important;
              font-size: 16px !important;
              justify-content: center !important;
              align-items: center !important;
            }

            /* Voucher details modal */
            .ledgerbook-voucher-modal {
              width: 95vw !important;
              max-width: 95vw !important;
              height: 90vh !important;
              margin: 5vh auto !important;
              padding: 16px !important;
            }

            .ledgerbook-voucher-modal-content {
              padding: 16px !important;
            }

            .ledgerbook-voucher-modal-header h2 {
              font-size: 18px !important;
            }

            .ledgerbook-voucher-summary {
              padding: 16px !important;
            }

            .ledgerbook-voucher-summary-grid {
              grid-template-columns: 1fr !important;
              gap: 12px !important;
            }

            .ledgerbook-voucher-table-wrapper {
              overflow-x: auto !important;
              -webkit-overflow-scrolling: touch !important;
            }

            .ledgerbook-voucher-table {
              min-width: 600px !important;
            }

            .ledgerbook-voucher-table th,
            .ledgerbook-voucher-table td {
              padding: 10px 12px !important;
              font-size: 12px !important;
            }

            .ledgerbook-voucher-summary-grid {
              grid-template-columns: 1fr !important;
            }
          }

          @media (max-width: 480px) {
            .ledgerbook-container {
              padding: 4px !important;
            }

            .ledgerbook-form-container {
              padding: 6px !important;
            }

            .ledgerbook-title {
              font-size: 16px !important;
            }

            .ledger-count-display {
              font-size: 11px !important;
              padding: 5px 10px !important;
            }

            .ledgerbook-table-area {
              padding: 8px 4px !important;
            }

            .ledgerbook-export-button {
              font-size: 11px !important;
              padding: 7px 10px !important;
              flex: 1 1 calc(50% - 3px) !important;
              min-width: calc(50% - 3px) !important;
              max-width: calc(50% - 3px) !important;
            }

            .ledgerbook-table th,
            .ledgerbook-table td {
              padding: 10px 12px !important;
              font-size: 12px !important;
            }

            .ledgerbook-table-header h3 {
              font-size: 14px !important;
            }

            .ledgerbook-table-header .period {
              font-size: 11px !important;
            }

            .ledgerbook-pagination {
              padding: 12px 8px !important;
            }

            .ledgerbook-pagination > div:first-child {
              font-size: 11px !important;
            }

            .ledgerbook-pagination button {
              padding: 8px 10px !important;
              font-size: 12px !important;
              min-width: 50px !important;
            }

            .ledgerbook-table-area table td {
              padding: 10px 6px !important;
              font-size: 12px !important;
            }

            .ledgerbook-empty-state {
              font-size: 14px !important;
              padding: 30px 12px !important;
            }
          }
        `}
      </style>
      {/* Feedback/Error */}
      {ledgerError && (
        <div style={{ background: '#fee2e2', color: '#b91c1c', borderRadius: 8, padding: '8px 16px', margin: '0 auto 18px auto', fontWeight: 600, fontSize: 15, maxWidth: 1200, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="material-icons" style={{ fontSize: 18 }}>error_outline</span>
          {ledgerError}
        </div>
      )}
      <div style={{
        background: '#fff',
        margin: 0,
        width: '100%',
        borderRadius: '16px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        overflow: 'visible',
        border: '1px solid #e5e7eb',
        position: 'relative',
        boxSizing: 'border-box'
      }}>
        {/* Form */}
        <form className="ledgerbook-form-container" onSubmit={handleSubmit} style={{ padding: '12px', width: '100%', overflow: 'visible', position: 'relative', boxSizing: 'border-box' }}>
          {/* Header */}
          <div className="ledgerbook-header" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '6px',
            paddingBottom: '16px',
            borderBottom: '1px solid #f3f4f6',
            position: 'relative'
          }}>
            <div className="ledgerbook-header-left" style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <div className="ledgerbook-icon" style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 4px rgba(59, 130, 246, 0.3)'
              }}>
                <span className="material-icons" style={{ fontSize: '20px', color: '#fff' }}>
                  business
                </span>
              </div>
              <h3 className="ledgerbook-title" style={{
                margin: 0,
                fontSize: '20px',
                fontWeight: '600',
                color: '#1f2937'
              }}>
                Ledger Book
              </h3>
            </div>

            {/* Ledger Count Display with Refresh Button */}
            <div className="ledgerbook-header-right" style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              {/* Ledger Count Display */}
              <div className="ledger-count-display" style={{
                fontSize: '14px',
                color: '#64748b',
                fontWeight: '500',
                padding: '8px 16px',
                backgroundColor: '#f8fafc',
                borderRadius: '20px',
                border: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                position: 'relative',
                zIndex: 1,
                maxWidth: '200px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                <span style={{ fontSize: '16px', flexShrink: 0 }}>📊</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {ledgerLoading ? 'Loading...' : ledgerError ? 'Error' : `${ledgerOptions.length.toLocaleString()} ledgers available`}
                </span>
              </div>
              {/* Refresh Button */}
              <button
                onClick={handleRefreshLedgers}
                disabled={refreshingLedgers || !company || ledgerLoading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '8px',
                  backgroundColor: refreshingLedgers ? '#e2e8f0' : '#3b82f6',
                  color: refreshingLedgers ? '#94a3b8' : 'white',
                  border: 'none',
                  borderRadius: '50%',
                  cursor: refreshingLedgers || !company || ledgerLoading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  minWidth: '32px',
                  height: '32px',
                  flexShrink: 0,
                  opacity: refreshingLedgers || !company || ledgerLoading ? 0.6 : 1
                }}
                title="Refresh ledger cache"
              >
                <span className="material-icons" style={{ 
                  fontSize: '18px',
                  animation: refreshingLedgers ? 'spin 1s linear infinite' : 'none'
                }}>
                  {refreshingLedgers ? 'sync' : 'refresh'}
                </span>
              </button>
            </div>
          </div>

          {/* Single Line: Ledger Name, Report Name, From Date, To Date, Submit Button */}
          <div className="ledgerbook-form-grid" style={{
            display: 'grid',
            gridTemplateColumns: '480px 300px 180px 180px 120px',
            gap: '16px',
            alignItems: 'end',
            minHeight: '60px',
            position: 'relative',
            marginBottom: '20px'
          }}>
            {/* Ledger Name */}
            <div className="ledgerbook-input-wrapper" style={{
              position: 'relative'
            }} data-ledger-dropdown>
              <div style={{
                position: 'relative',
                background: 'white',
                borderRadius: '12px',
                border: showLedgerDropdown ? '2px solid #3b82f6' : '2px solid #e2e8f0',
                transition: 'all 0.2s ease',
                boxShadow: showLedgerDropdown ? '0 4px 12px rgba(59, 130, 246, 0.15)' : '0 1px 3px rgba(0, 0, 0, 0.1)',
                zIndex: showLedgerDropdown ? 1001 : 'auto'
              }}>
                <input
                  value={dropdown3 || ledgerSearchTerm}
                  onChange={e => {
                    const inputValue = e.target.value;
                    setLedgerSearchTerm(inputValue);
                    setDropdown3('');
                    setShowLedgerDropdown(true);
                    // Clear filtered results immediately when clearing search or starting new search
                    if (!inputValue.trim()) {
                      // Always show all ledgers when no search term (like PlaceOrder)
                      setFilteredLedgerOptions(ledgerOptions);
                    } else {
                      // Clear previous results immediately when starting new search
                      // The debounced search will populate new results
                      setFilteredLedgerOptions([]);
                    }
                  }}
                  onFocus={() => {
                    setDropdown3Focused(true);
                    setShowLedgerDropdown(true);
                    // Always show all ledgers when focused (like PlaceOrder)
                    setFilteredLedgerOptions(ledgerOptions);
                  }}
                  onBlur={() => {
                    setDropdown3Focused(false);
                    // Delay hiding dropdown to allow click events
                    setTimeout(() => setShowLedgerDropdown(false), 200);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setShowLedgerDropdown(false);
                      e.target.blur();
                    }
                  }}
                  required
                  disabled={ledgerLoading || ledgerError}
                  className="ledgerbook-input"
                  style={{
                    width: '100%',
                    padding: '16px 20px',
                    paddingRight: dropdown3 ? '50px' : '20px',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '15px',
                    color: '#374151',
                    outline: 'none',
                    background: 'transparent',
                    cursor: ledgerLoading ? 'not-allowed' : 'text'
                  }}
                  placeholder={ledgerLoading ? 'Loading...' : ledgerError ? ledgerError : ''}
                />

                {/* Search Icon or Dropdown Arrow */}
                {!dropdown3 && (
                  <span
                    className="material-icons"
                    style={{
                      position: 'absolute',
                      right: '16px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: showLedgerDropdown ? '#3b82f6' : '#9ca3af',
                      fontSize: '20px',
                      pointerEvents: 'none',
                      transition: 'color 0.2s ease'
                    }}
                  >
                    {showLedgerDropdown ? 'expand_less' : 'search'}
                  </span>
                )}

                {/* Clear Button for Ledger */}
                {dropdown3 && (
                  <button
                    type="button"
                    onClick={() => {
                      setDropdown3('');
                      setLedgerSearchTerm('');
                      setShowLedgerDropdown(false);
                      // Always show all ledgers when reopening (like PlaceOrder)
                      setFilteredLedgerOptions(ledgerOptions);
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
                    title="Clear ledger name"
                  >
                    ×
                  </button>
                )}

                <label className="ledgerbook-input-label" style={{
                  position: 'absolute',
                  left: '16px',
                  top: dropdown3Focused || !!dropdown3 ? '-8px' : '50%',
                  transform: dropdown3Focused || !!dropdown3 ? 'none' : 'translateY(-50%)',
                  fontSize: dropdown3Focused || !!dropdown3 ? '11px' : '14px',
                  fontWeight: '600',
                  color: dropdown3Focused || !!dropdown3 ? '#3b82f6' : '#6b7280',
                  backgroundColor: '#fff',
                  padding: '0 6px',
                  transition: 'all 0.2s ease',
                  pointerEvents: 'none',
                  zIndex: 1
                }}>
                  Ledger Name
                </label>

                {ledgerLoading && (
                  <div style={{
                    position: 'absolute',
                    right: 60,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: 16,
                    height: 16,
                    border: '2px solid #e5e7eb',
                    borderTop: '2px solid #3b82f6',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                )}

                {/* Custom Ledger Dropdown */}
                {showLedgerDropdown && (
                  <div
                    className="dropdown-animation"
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 8px)',
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

                    {/* Loading indicator */}
                    {ledgerSearchTerm.trim() && filteredLedgerOptions.length === 0 && (
                      <div style={{
                        padding: '16px',
                        textAlign: 'center',
                        color: '#64748b',
                        fontSize: '14px'
                      }}>
                        <div style={{
                          width: '20px',
                          height: '20px',
                          border: '2px solid #e2e8f0',
                          borderTop: '2px solid #3b82f6',
                          borderRadius: '50%',
                          animation: 'spin 1s linear infinite',
                          margin: '0 auto 8px auto'
                        }} />
                        Searching {ledgerOptions.length.toLocaleString()} ledgers...
                      </div>
                    )}

                    {/* Results */}
                    {filteredLedgerOptions.map((ledger, index) => (
                      <div
                        key={ledger.NAME}
                        onClick={() => {
                          setDropdown3(ledger.NAME);
                          setLedgerSearchTerm('');
                          setShowLedgerDropdown(false);
                          setFilteredLedgerOptions([]);
                        }}
                        style={{
                          padding: '12px 16px',
                          cursor: 'pointer',
                          borderBottom: index < filteredLedgerOptions.length - 1 ? '1px solid #f1f5f9' : 'none',
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
                          {ledger.NAME}
                        </div>
                        <div style={{
                          fontSize: '12px',
                          color: '#64748b',
                          marginTop: '2px'
                        }}>
                          {ledger.MAILINGNAME && `Mailing Name: ${ledger.MAILINGNAME}`}
                        </div>
                      </div>
                    ))}

                    {/* Show more results indicator */}
                    {filteredLedgerOptions.length === 50 && (
                      <div style={{
                        padding: '12px 16px',
                        textAlign: 'center',
                        color: '#64748b',
                        fontSize: '12px',
                        fontStyle: 'italic',
                        borderTop: '1px solid #f1f5f9',
                        backgroundColor: '#f8fafc'
                      }}>
                        Showing first 50 results. Refine your search for more specific results.
                      </div>
                    )}
                  </div>
                )}

                {/* No Results Message */}
                {showLedgerDropdown && ledgerSearchTerm.trim() && filteredLedgerOptions.length === 0 && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    backgroundColor: 'white',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '16px',
                    textAlign: 'center',
                    color: '#64748b',
                    fontSize: '14px',
                    zIndex: 1000,
                    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
                    marginTop: '4px'
                  }}>
                    No ledgers found matching "{ledgerSearchTerm}"
                  </div>
                )}
              </div>
            </div>

            {/* Report Name */}
            <div className="ledgerbook-input-wrapper" style={{
              position: 'relative',
              zIndex: 10
            }}>
              <div style={{
                position: 'relative',
                background: 'white',
                borderRadius: '12px',
                border: '2px solid #e2e8f0',
                transition: 'all 0.2s ease',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                zIndex: 10
              }}>
                <select
                  value={table}
                  onChange={e => setTable(e.target.value)}
                  onFocus={() => setTableFocused(true)}
                  onBlur={() => setTableFocused(false)}
                  required
                  className="ledgerbook-input"
                  style={{
                    width: '100%',
                    padding: '16px 20px',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '15px',
                    color: '#374151',
                    outline: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    zIndex: 11,
                    position: 'relative'
                  }}
                >
                  {tableOptions.length === 0 ? (
                    <option value="">No reports available</option>
                  ) : (
                    tableOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)
                  )}
                </select>
                <label className="ledgerbook-input-label" style={{
                  position: 'absolute',
                  left: '16px',
                  top: tableFocused || table ? '-8px' : '50%',
                  transform: tableFocused || table ? 'none' : 'translateY(-50%)',
                  fontSize: tableFocused || table ? '11px' : '14px',
                  fontWeight: '600',
                  color: tableFocused || table ? '#3b82f6' : '#6b7280',
                  backgroundColor: '#fff',
                  padding: '0 6px',
                  transition: 'all 0.2s ease',
                  pointerEvents: 'none',
                  zIndex: 1
                }}>
                  Report Name
                </label>
              </div>
            </div>

            {/* From Date */}
            <div className="ledgerbook-input-wrapper" style={{
              position: 'relative'
            }}>
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
                  onChange={e => setFromDate(e.target.value)}
                  onFocus={() => setFromDateFocused(true)}
                  onBlur={() => setFromDateFocused(false)}
                  required
                  className="ledgerbook-input"
                  style={{
                    width: '100%',
                    padding: '16px 20px',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '15px',
                    color: '#374151',
                    outline: 'none',
                    background: 'transparent',
                    cursor: 'text'
                  }}
                />
                <label className="ledgerbook-input-label" style={{
                  position: 'absolute',
                  left: '16px',
                  top: fromDateFocused || fromDate ? '-8px' : '50%',
                  transform: fromDateFocused || fromDate ? 'none' : 'translateY(-50%)',
                  fontSize: fromDateFocused || fromDate ? '11px' : '14px',
                  fontWeight: '600',
                  color: fromDateFocused || fromDate ? '#3b82f6' : '#6b7280',
                  backgroundColor: '#fff',
                  padding: '0 6px',
                  transition: 'all 0.2s ease',
                  pointerEvents: 'none',
                  zIndex: 1
                }}>
                  From Date
                </label>
              </div>
            </div>

            {/* To Date */}
            <div className="ledgerbook-input-wrapper" style={{
              position: 'relative'
            }}>
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
                  onChange={e => setToDate(e.target.value)}
                  onFocus={() => setToDateFocused(true)}
                  onBlur={() => setToDateFocused(false)}
                  required
                  className="ledgerbook-input"
                  style={{
                    width: '100%',
                    padding: '16px 20px',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '15px',
                    color: '#374151',
                    outline: 'none',
                    background: 'transparent',
                    cursor: 'text'
                  }}
                />
                <label className="ledgerbook-input-label" style={{
                  position: 'absolute',
                  left: '16px',
                  top: toDateFocused || toDate ? '-8px' : '50%',
                  transform: toDateFocused || toDate ? 'none' : 'translateY(-50%)',
                  fontSize: toDateFocused || toDate ? '11px' : '14px',
                  fontWeight: '600',
                  color: toDateFocused || toDate ? '#3b82f6' : '#6b7280',
                  backgroundColor: '#fff',
                  padding: '0 6px',
                  transition: 'all 0.2s ease',
                  pointerEvents: 'none',
                  zIndex: 1
                }}>
                  To Date
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
                className="ledgerbook-submit-button"
                disabled={!company || !dropdown3}
                style={{
                  background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '12px 24px',
                  cursor: (!company || !dropdown3) ? 'not-allowed' : 'pointer',
                  fontSize: '15px',
                  fontWeight: '600',
                  boxShadow: '0 4px 6px rgba(59, 130, 246, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  opacity: (!company || !dropdown3) ? 0.5 : 1,
                  transition: 'all 0.2s ease',
                  minWidth: '120px',
                  justifyContent: 'center'
                }}
              >
                <span className="material-icons" style={{ fontSize: '16px' }}>search</span>
                Submit
              </button>
            </div>

          </div>

        </form>
        {/* Table Area */}
        <div className="ledgerbook-table-area" style={{
          width: '100%',
          background: '#f9fafb',
          borderTop: '1px solid #e5e7eb',
          borderRadius: '0 0 16px 16px',
          marginTop: 8,
          padding: 16,
          boxSizing: 'border-box'
        }}>
          {tableLoading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', color: '#64748b', fontSize: 18 }}>
              <span className="material-icons" style={{ marginRight: 8, animation: 'spin 1s linear infinite' }}>refresh</span>
              Loading data...
            </div>
          )}

          {tableError && (
            <div style={{ background: '#fee2e2', color: '#b91c1c', borderRadius: 8, padding: '16px', marginBottom: 16, fontWeight: 600, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="material-icons" style={{ fontSize: 18 }}>error_outline</span>
              {tableError}
            </div>
          )}

          {tableData && !tableLoading && tableData.reporttype === table && (
            <div className="ledgerbook-table-container">
              {/* Data Table */}
              <div style={{
                background: '#fff',
                borderRadius: '16px',
                border: '1px solid #e2e8f0',
                overflow: 'hidden',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
              }}>
                <div style={{ maxWidth: '100%' }}>
                  <div className="ledgerbook-table-header-section" style={{ background: '#f8fafc', padding: '16px' }}>
                    {/* First Line: Export and Print Icons */}
                    <div className="ledgerbook-export-buttons" style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', justifyContent: 'space-between' }}>
                      {/* Export buttons on the left */}
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button
                          onClick={() => handleExport('pdf')}
                          title="Export to PDF"
                          className="ledgerbook-export-button"
                          style={{
                            background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '10px 16px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            color: '#fff',
                            fontSize: '14px',
                            fontWeight: '600',
                            transition: 'all 0.2s ease',
                            boxShadow: '0 2px 4px rgba(220, 38, 38, 0.2)'
                          }}
                          onMouseEnter={(e) => e.target.style.background = 'linear-gradient(135deg, #b91c1c 0%, #991b1b 100%)'}
                          onMouseLeave={(e) => e.target.style.background = 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)'}
                        >
                          <span className="material-icons" style={{ fontSize: '16px' }}>picture_as_pdf</span>
                          PDF
                        </button>
                        <button
                          onClick={() => handleExport('excel')}
                          title="Export to Excel"
                          className="ledgerbook-export-button"
                          style={{
                            background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '10px 16px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            color: '#fff',
                            fontSize: '14px',
                            fontWeight: '600',
                            transition: 'all 0.2s ease',
                            boxShadow: '0 2px 4px rgba(5, 150, 105, 0.2)'
                          }}
                          onMouseEnter={(e) => e.target.style.background = 'linear-gradient(135deg, #047857 0%, #065f46 100%)'}
                          onMouseLeave={(e) => e.target.style.background = 'linear-gradient(135deg, #059669 0%, #047857 100%)'}
                        >
                          <span className="material-icons" style={{ fontSize: '16px' }}>table_chart</span>
                          Excel
                        </button>
                        <button
                          onClick={handlePrint}
                          title="Print Report"
                          className="ledgerbook-export-button"
                          style={{
                            background: 'linear-gradient(135deg, #1e40af 0%, #1d4ed8 100%)',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '10px 16px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            color: '#fff',
                            fontSize: '14px',
                            fontWeight: '600',
                            transition: 'all 0.2s ease',
                            boxShadow: '0 2px 4px rgba(30, 64, 175, 0.2)'
                          }}
                          onMouseEnter={(e) => e.target.style.background = 'linear-gradient(135deg, #1d4ed8 0%, #1e3a8a 100%)'}
                          onMouseLeave={(e) => e.target.style.background = 'linear-gradient(135deg, #1e40af 0%, #1d4ed8 100%)'}
                        >
                          <span className="material-icons" style={{ fontSize: '16px' }}>print</span>
                          Print
                        </button>
                      </div>

                      {/* Configuration Icon - Only for Bill wise O/s */}
                      {table === 'Bill wise O/s' && (
                        <div style={{ position: 'relative' }} data-config-dropdown>
                          <button
                            onClick={() => {
                              setShowConfigOptions(!showConfigOptions);
                              // Close dropdown if it's already open
                              if (showConfigOptions) {
                                setShowConfigOptions(false);
                              }
                            }}
                            title="Configuration Options"
                            className="ledgerbook-config-button"
                            style={{
                              background: showConfigOptions ? 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)' : 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                              border: 'none',
                              borderRadius: '8px',
                              padding: '10px 16px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              color: '#fff',
                              fontSize: '14px',
                              fontWeight: '600',
                              transition: 'all 0.2s ease',
                              boxShadow: '0 2px 4px rgba(99, 102, 241, 0.2)'
                            }}
                            onMouseEnter={(e) => {
                              if (!showConfigOptions) {
                                e.target.style.background = 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!showConfigOptions) {
                                e.target.style.background = 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)';
                              }
                            }}
                          >
                            <span className="material-icons" style={{ fontSize: 16 }}>settings</span>
                            Config
                          </button>
                          {/* Configuration Options Dropdown */}
                          {showConfigOptions && (
                            <div style={{
                              position: 'absolute',
                              top: '100%',
                              right: 0,
                              backgroundColor: 'white',
                              border: '1px solid #e5e7eb',
                              borderRadius: 6,
                              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                              zIndex: 1000,
                              minWidth: '200px',
                              marginTop: '4px'
                            }}>
                              <div style={{
                                padding: '8px 12px',
                                borderBottom: '1px solid #f3f4f6',
                                backgroundColor: '#f9fafb',
                                fontWeight: 600,
                                fontSize: 12,
                                color: '#374151'
                              }}>
                                Configuration Options
                              </div>
                              <div
                                style={{
                                  padding: '10px 12px',
                                  fontSize: 12,
                                  color: '#374151',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px'
                                }}
                              >
                                <input
                                  type="checkbox"
                                  id="billwise-breakup-option"
                                  checked={configOptions.billwiseBreakup}
                                  onChange={(e) => handleConfigOption('billwiseBreakup', e.target.checked)}
                                  style={{ cursor: 'pointer' }}
                                />
                                <label htmlFor="billwise-breakup-option" style={{ cursor: 'pointer', margin: 0 }}>
                                  Show Billwise Breakup
                                </label>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Configuration Icon - Only for Ledger Vouchers */}
                      {table === 'Ledger Vouchers' && (
                        <div style={{ position: 'relative' }} data-config-dropdown>
                          <button
                            onClick={() => {
                              setShowConfigOptions(!showConfigOptions);
                              // Close dropdown if it's already open
                              if (showConfigOptions) {
                                setShowConfigOptions(false);
                              }
                            }}
                            title="Configuration Options"
                            className="ledgerbook-config-button"
                            style={{
                              background: showConfigOptions ? 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)' : 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                              border: 'none',
                              borderRadius: '8px',
                              padding: '10px 16px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              color: '#fff',
                              fontSize: '14px',
                              fontWeight: '600',
                              transition: 'all 0.2s ease',
                              boxShadow: '0 2px 4px rgba(99, 102, 241, 0.2)'
                            }}
                            onMouseEnter={(e) => {
                              if (!showConfigOptions) {
                                e.target.style.background = 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!showConfigOptions) {
                                e.target.style.background = 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)';
                              }
                            }}
                          >
                            <span className="material-icons" style={{ fontSize: 16 }}>settings</span>
                            Config
                          </button>
                          {/* Configuration Options Dropdown */}
                          {showConfigOptions && (
                            <div style={{
                              position: 'absolute',
                              top: '100%',
                              right: 0,
                              backgroundColor: 'white',
                              border: '1px solid #e5e7eb',
                              borderRadius: 6,
                              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                              zIndex: 1000,
                              minWidth: '200px',
                              marginTop: '4px'
                            }}>
                              <div style={{
                                padding: '8px 12px',
                                borderBottom: '1px solid #f3f4f6',
                                backgroundColor: '#f9fafb',
                                fontWeight: 600,
                                fontSize: 12,
                                color: '#374151'
                              }}>
                                Configuration Options
                              </div>
                              <div
                                style={{
                                  padding: '10px 12px',
                                  fontSize: 12,
                                  color: '#374151',
                                  borderBottom: '1px solid #f3f4f6',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px'
                                }}
                              >
                                <input
                                  type="checkbox"
                                  id="ledgers-option"
                                  checked={configOptions.ledgers}
                                  onChange={(e) => handleConfigOption('ledgers', e.target.checked)}
                                  style={{ cursor: 'pointer' }}
                                />
                                <label htmlFor="ledgers-option" style={{ cursor: 'pointer', margin: 0 }}>
                                  Show Ledger Details (Dr/Cr)
                                </label>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Second Line: Ledger Name and Period */}
                    <div className="ledgerbook-table-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h3 style={{ margin: 0, color: '#1e293b', fontSize: 18, fontWeight: 600 }}>
                        Ledger: {tableData.ledgername}
                      </h3>
                      <div className="period" style={{ fontSize: 14, color: '#64748b', fontWeight: 500 }}>
                        Period: {(() => {
                          const fromDateStr = tableData.fromdate.toString();
                          const toDateStr = tableData.todate.toString();
                          const fromDay = fromDateStr.slice(6, 8);
                          const fromMonth = fromDateStr.slice(4, 6);
                          const fromYear = fromDateStr.slice(0, 4);
                          const toDay = toDateStr.slice(6, 8);
                          const toMonth = toDateStr.slice(4, 6);
                          const toYear = toDateStr.slice(0, 4);
                          return `${fromDay}-${fromMonth}-${fromYear} to ${toDay}-${toMonth}-${toYear}`;
                        })()}
                      </div>
                    </div>
                  </div>

                  <div className="ledgerbook-table-wrapper">
                    <table className="ledgerbook-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{
                          background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                          borderBottom: '2px solid #e2e8f0'
                        }}>
                          {table === 'Ledger Vouchers' ? (
                            <>
                              <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '15px', fontWeight: '700', color: '#1e293b', letterSpacing: '0.025em' }}>Date</th>
                              <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '15px', fontWeight: '700', color: '#1e293b', letterSpacing: '0.025em' }}>Particulars</th>
                              <th style={{ padding: '16px 20px', textAlign: 'right', fontSize: '15px', fontWeight: '700', color: '#1e293b', letterSpacing: '0.025em', width: '80px' }}></th>
                              <th style={{ padding: '16px 20px', textAlign: 'right', fontSize: '15px', fontWeight: '700', color: '#1e293b', letterSpacing: '0.025em', width: '80px' }}></th>
                              <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '15px', fontWeight: '700', color: '#1e293b', letterSpacing: '0.025em' }}>Vch Type</th>
                              <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '15px', fontWeight: '700', color: '#1e293b', letterSpacing: '0.025em' }}>Vch No.</th>
                              <th style={{ padding: '16px 20px', textAlign: 'right', fontSize: '15px', fontWeight: '700', color: '#1e293b', letterSpacing: '0.025em' }}>Debit</th>
                              <th style={{ padding: '16px 20px', textAlign: 'right', fontSize: '15px', fontWeight: '700', color: '#1e293b', letterSpacing: '0.025em' }}>Credit</th>
                            </>
                          ) : (
                            <>
                              <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '15px', fontWeight: '700', color: '#1e293b', letterSpacing: '0.025em' }}>Date</th>
                              <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '15px', fontWeight: '700', color: '#1e293b', letterSpacing: '0.025em' }}>Ref No</th>
                              {configOptions.billwiseBreakup && (
                                <>
                                  <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '15px', fontWeight: '700', color: '#1e293b', letterSpacing: '0.025em', width: '120px', minWidth: '110px' }}>Vch Type</th>
                                  <th style={{ padding: '16px 20px', textAlign: 'right', fontSize: '15px', fontWeight: '700', color: '#1e293b', letterSpacing: '0.025em', width: '200px', minWidth: '180px' }}>Amount</th>
                                </>
                              )}
                              <th style={{ padding: '16px 20px', textAlign: 'right', fontSize: '15px', fontWeight: '700', color: '#1e293b', letterSpacing: '0.025em' }}>Opening Amount</th>
                              <th style={{ padding: '16px 20px', textAlign: 'right', fontSize: '15px', fontWeight: '700', color: '#1e293b', letterSpacing: '0.025em' }}>Pending Amount</th>
                              <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '15px', fontWeight: '700', color: '#1e293b', letterSpacing: '0.025em' }}>Due On</th>
                              <th style={{ padding: '16px 20px', textAlign: 'right', fontSize: '15px', fontWeight: '700', color: '#1e293b', letterSpacing: '0.025em' }}>Overdue Days</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {currentRecords.map((row, index) => {
                          const baseVoucherRow = row?.originalRow || row;
                          const isLedgerVoucherRow = table === 'Ledger Vouchers' && (baseVoucherRow?.VCHNO || baseVoucherRow?.VOUCHERNUMBER);
                          const isBillwiseVoucherRow = table === 'Bill wise O/s' && row?.isVoucherEntry && (row.originalVoucher || row);
                          const isBillwiseBillRow = table === 'Bill wise O/s' && !row?.isVoucherEntry && (row?.VOUCHERS?.length > 0 || row?.MASTERID || row?.VCHNO || row?.VOUCHERNUMBER);
                          const isVoucherRow = Boolean(isLedgerVoucherRow || isBillwiseVoucherRow || isBillwiseBillRow);
                          return (
                            <tr
                              key={index}
                              onClick={isVoucherRow ? () => handleVoucherRowClick(row) : undefined}
                              style={{
                                borderBottom: '1px solid #f1f5f9',
                                backgroundColor: (row.isLedgerEntry || row.isVoucherEntry) ? '#f8fafc' : 'transparent',
                                borderLeft: (row.isLedgerEntry || row.isVoucherEntry) ? '4px solid #3b82f6' : 'none',
                                borderLeftColor: row.isOnAccountVoucher ? '#10b981' : (row.isLedgerEntry || row.isVoucherEntry) ? '#3b82f6' : 'transparent',
                                background: row.isMainOnAccountRow ? '#f8fafc' : (row.isLedgerEntry || row.isVoucherEntry) ? '#f8fafc' : 'transparent',
                                borderTop: row.isMainOnAccountRow ? '1px solid #e5e7eb' : 'none',
                                transition: 'background-color 0.2s ease',
                                cursor: isVoucherRow ? 'pointer' : 'default',
                                ':hover': {
                                  backgroundColor: '#f8fafc'
                                }
                              }}>
                              {table === 'Ledger Vouchers' ? (
                                <>
                                  <td style={{
                                    padding: '16px 20px',
                                    fontSize: '15px',
                                    color: '#374151',
                                    fontWeight: (!row.isLedgerEntry && configOptions.ledgers) ? 'bold' : 'normal',
                                    fontStyle: row.isLedgerEntry ? 'italic' : 'normal'
                                  }}>{row.isLedgerEntry ? '' : row.DATE}</td>
                                  <td style={{
                                    padding: '16px 20px',
                                    fontSize: '15px',
                                    color: row.isLedgerEntry ? '#64748b' : '#374151',
                                    paddingLeft: row.isLedgerEntry ? '32px' : '20px',
                                    fontStyle: row.isLedgerEntry ? 'italic' : 'normal',
                                    fontWeight: (!row.isLedgerEntry && configOptions.ledgers) ? 'bold' : 'normal'
                                  }}>
                                    {row.isLedgerEntry ? row.PARTICULARS : row.PARTICULARS}
                                  </td>
                                  <td style={{
                                    padding: '16px 20px',
                                    fontSize: '15px',
                                    color: '#374151',
                                    textAlign: 'right',
                                    width: '80px',
                                    fontWeight: (!row.isLedgerEntry && configOptions.ledgers) ? 'bold' : 'normal',
                                    fontStyle: row.isLedgerEntry ? 'italic' : 'normal'
                                  }}>
                                    {row.isLedgerEntry ? (row.DEBITAMT ? `${parseFloat(row.DEBITAMT).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Dr` : '') : ''}
                                  </td>
                                  <td style={{
                                    padding: '16px 20px',
                                    fontSize: '15px',
                                    color: '#374151',
                                    textAlign: 'right',
                                    width: '80px',
                                    fontWeight: (!row.isLedgerEntry && configOptions.ledgers) ? 'bold' : 'normal',
                                    fontStyle: row.isLedgerEntry ? 'italic' : 'normal'
                                  }}>
                                    {row.isLedgerEntry ? (row.CREDITAMT ? `${parseFloat(row.CREDITAMT).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Cr` : '') : ''}
                                  </td>
                                  <td style={{
                                    padding: '16px 20px',
                                    fontSize: '15px',
                                    color: '#374151',
                                    fontWeight: (!row.isLedgerEntry && configOptions.ledgers) ? 'bold' : 'normal',
                                    fontStyle: row.isLedgerEntry ? 'italic' : 'normal'
                                  }}>{row.isLedgerEntry ? '' : row.VCHTYPE}</td>
                                  <td style={{
                                    padding: '16px 20px',
                                    fontSize: '15px',
                                    color: '#374151',
                                    fontWeight: (!row.isLedgerEntry && configOptions.ledgers) ? 'bold' : 'normal',
                                    fontStyle: row.isLedgerEntry ? 'italic' : 'normal'
                                  }}>{row.isLedgerEntry ? '' : row.VCHNO}</td>
                                  <td style={{
                                    padding: '16px 20px',
                                    fontSize: '15px',
                                    color: '#374151',
                                    textAlign: 'right',
                                    fontWeight: (!row.isLedgerEntry && configOptions.ledgers) ? 'bold' : 'normal',
                                    fontStyle: row.isLedgerEntry ? 'italic' : 'normal'
                                  }}>{row.isLedgerEntry ? '' : (row.DEBITAMT ? parseFloat(row.DEBITAMT).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '')}</td>
                                  <td style={{
                                    padding: '16px 20px',
                                    fontSize: '15px',
                                    color: '#374151',
                                    textAlign: 'right',
                                    fontWeight: (!row.isLedgerEntry && configOptions.ledgers) ? 'bold' : 'normal',
                                    fontStyle: row.isLedgerEntry ? 'italic' : 'normal'
                                  }}>{row.isLedgerEntry ? '' : (row.CREDITAMT ? parseFloat(row.CREDITAMT).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '')}</td>
                                </>
                              ) : (
                                <>
                                  <td style={{
                                    padding: '16px 20px',
                                    fontSize: '15px',
                                    color: '#374151',
                                    fontWeight: (!row.isVoucherEntry && configOptions.billwiseBreakup) ? 'bold' : 'normal',
                                    fontStyle: row.isVoucherEntry ? 'italic' : 'normal'
                                  }}>{row.isVoucherEntry ? row.DATE : row.DATE}</td>
                                  <td style={{
                                    padding: '16px 20px',
                                    fontSize: '15px',
                                    color: row.isVoucherEntry ? '#64748b' : (row.isMainOnAccountRow ? '#64748b' : '#374151'),
                                    paddingLeft: row.isVoucherEntry ? '32px' : '20px',
                                    fontStyle: row.isVoucherEntry ? 'italic' : 'normal',
                                    fontWeight: row.isMainOnAccountRow ? '500' : (!row.isVoucherEntry && configOptions.billwiseBreakup) ? 'bold' : 'normal'
                                  }}>
                                    {row.isVoucherEntry ? (row.isOnAccountVoucher ? 'On Account' : row.VOUCHERNUMBER) : (row.isMainOnAccountRow ? 'On Account:' : row.REFNO)}
                                  </td>
                                  {configOptions.billwiseBreakup && (
                                    <>
                                      <td style={{
                                        padding: '16px 20px',
                                        fontSize: '15px',
                                        color: row.isVoucherEntry ? '#64748b' : '#374151',
                                        fontStyle: row.isVoucherEntry ? 'italic' : 'normal',
                                        fontWeight: (!row.isVoucherEntry && configOptions.billwiseBreakup) ? 'bold' : 'normal',
                                        width: '120px',
                                        minWidth: '110px'
                                      }}>
                                        {row.isVoucherEntry ? row.VOUCHERTYPE : ''}
                                      </td>
                                      <td style={{
                                        padding: '16px 20px',
                                        fontSize: '15px',
                                        color: row.isVoucherEntry ? '#64748b' : '#374151',
                                        textAlign: 'right',
                                        fontStyle: row.isVoucherEntry ? 'italic' : 'normal',
                                        fontWeight: (!row.isVoucherEntry && configOptions.billwiseBreakup) ? 'bold' : 'normal',
                                        width: '200px',
                                        minWidth: '180px'
                                      }}>
                                        {row.isVoucherEntry ? (
                                          row.DEBITAMT > 0 ?
                                            `${parseFloat(row.DEBITAMT).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Dr` :
                                            row.CREDITAMT > 0 ?
                                              `${parseFloat(row.CREDITAMT).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Cr` : ''
                                        ) : ''}
                                      </td>
                                    </>
                                  )}
                                  <td style={{
                                    padding: '16px 20px',
                                    fontSize: '15px',
                                    color: '#374151',
                                    textAlign: 'right',
                                    fontWeight: (!row.isVoucherEntry && configOptions.billwiseBreakup) ? 'bold' : 'normal',
                                    fontStyle: row.isVoucherEntry ? 'italic' : 'normal'
                                  }}>
                                    {row.isVoucherEntry ? '' : (() => {
                                      const debit = parseFloat(row.DEBITOPENBAL || 0);
                                      const credit = parseFloat(row.CREDITOPENBAL || 0);
                                      if (debit > 0) {
                                        return `${debit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Dr`;
                                      } else if (credit > 0) {
                                        return `${credit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Cr`;
                                      } else {
                                        return '-';
                                      }
                                    })()}
                                  </td>
                                  <td style={{
                                    padding: '16px 20px',
                                    fontSize: '15px',
                                    color: '#374151',
                                    textAlign: 'right',
                                    fontWeight: (!row.isVoucherEntry && configOptions.billwiseBreakup) ? 'bold' : 'normal',
                                    fontStyle: row.isVoucherEntry ? 'italic' : 'normal'
                                  }}>
                                    {row.isVoucherEntry ? '' : (() => {
                                      const debit = parseFloat(row.DEBITCLSBAL || 0);
                                      const credit = parseFloat(row.CREDITCLSBAL || 0);
                                      if (debit > 0) {
                                        return `${debit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Dr`;
                                      } else if (credit > 0) {
                                        return `${credit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Cr`;
                                      } else {
                                        return '-';
                                      }
                                    })()}
                                  </td>
                                  <td style={{
                                    padding: '16px 20px',
                                    fontSize: '15px',
                                    color: '#374151',
                                    fontWeight: (!row.isVoucherEntry && configOptions.billwiseBreakup) ? 'bold' : 'normal',
                                    fontStyle: row.isVoucherEntry ? 'italic' : 'normal'
                                  }}>{row.isVoucherEntry ? '' : (row.DUEON || '-')}</td>
                                  <td style={{
                                    padding: '16px 20px',
                                    fontSize: '15px',
                                    color: '#374151',
                                    textAlign: 'right',
                                    fontWeight: (!row.isVoucherEntry && configOptions.billwiseBreakup) ? 'bold' : 'normal',
                                    fontStyle: row.isVoucherEntry ? 'italic' : 'normal'
                                  }}>{row.isVoucherEntry ? '' : (row.OVERDUEDAYS || '-')}</td>
                                </>
                              )}
                            </tr>
                          );
                        })}

                      </tbody>

                      {/* On Account row - only show on last page for Bill wise O/s */}
                      {table === 'Bill wise O/s' && tableData.onacc && currentPage === totalPages && (
                        <>
                          {/* On Account summary row */}
                          <tr style={{
                            background: '#f8fafc',
                            borderTop: '1px solid #e5e7eb',
                            borderBottom: '1px solid #e5e7eb'
                          }}>
                            <td style={{
                              padding: '16px 20px',
                              fontSize: '15px',
                              color: '#374151',
                              fontWeight: configOptions.billwiseBreakup ? 'bold' : 'normal'
                            }}></td>
                            <td style={{
                              padding: '16px 20px',
                              fontSize: '15px',
                              color: '#64748b',
                              fontWeight: configOptions.billwiseBreakup ? 'bold' : '500'
                            }}>
                              On Account:
                            </td>
                            {configOptions.billwiseBreakup && (
                              <>
                                <td style={{
                                  padding: '12px 16px',
                                  fontSize: 14,
                                  color: '#374151',
                                  fontWeight: 'bold'
                                }}></td>
                                <td style={{
                                  padding: '12px 16px',
                                  fontSize: 14,
                                  color: '#374151',
                                  textAlign: 'right',
                                  fontWeight: 'bold'
                                }}></td>
                              </>
                            )}
                            <td style={{
                              padding: '16px 20px',
                              fontSize: '15px',
                              color: '#374151',
                              textAlign: 'right',
                              fontWeight: configOptions.billwiseBreakup ? 'bold' : 'normal'
                            }}>
                              {(() => {
                                const debit = parseFloat(tableData.onacc.DEBITOPENBAL || 0);
                                const credit = parseFloat(tableData.onacc.CREDITOPENBAL || 0);
                                if (debit > 0) {
                                  return `${debit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Dr`;
                                } else if (credit > 0) {
                                  return `${credit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Cr`;
                                } else {
                                  return '-';
                                }
                              })()}
                            </td>
                            <td style={{
                              padding: '16px 20px',
                              fontSize: '15px',
                              color: '#374151',
                              textAlign: 'right',
                              fontWeight: configOptions.billwiseBreakup ? 'bold' : 'normal'
                            }}>
                              {(() => {
                                const debit = parseFloat(tableData.onacc.DEBITCLSBAL || 0);
                                const credit = parseFloat(tableData.onacc.CREDITCLSBAL || 0);
                                if (debit > 0) {
                                  return `${debit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Dr`;
                                } else if (credit > 0) {
                                  return `${credit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Cr`;
                                } else {
                                  return '-';
                                }
                              })()}
                            </td>
                            <td style={{
                              padding: '16px 20px',
                              fontSize: '15px',
                              color: '#374151',
                              fontWeight: configOptions.billwiseBreakup ? 'bold' : 'normal'
                            }}>-</td>
                            <td style={{
                              padding: '16px 20px',
                              fontSize: '15px',
                              color: '#374151',
                              textAlign: 'right',
                              fontWeight: configOptions.billwiseBreakup ? 'bold' : 'normal'
                            }}>-</td>
                          </tr>

                          {/* On Account voucher entries - only if billwiseBreakup is enabled */}
                          {configOptions.billwiseBreakup && (
                            <>
                              {/* ONACCVOUCHERSOPEN entries */}
                              {tableData.onacc.ONACCVOUCHERSOPEN && Array.isArray(tableData.onacc.ONACCVOUCHERSOPEN) && tableData.onacc.ONACCVOUCHERSOPEN.map((voucher, index) => (
                                <tr key={`onacc-open-${index}`} style={{
                                  backgroundColor: '#f8fafc',
                                  borderLeft: '4px solid #10b981'
                                }}>
                                  <td style={{ padding: '16px 20px', fontSize: '15px', color: '#64748b', fontStyle: 'italic' }}>{voucher.DATE}</td>
                                  <td style={{
                                    padding: '16px 20px',
                                    fontSize: '15px',
                                    color: '#64748b',
                                    paddingLeft: '32px',
                                    fontStyle: 'italic'
                                  }}>
                                    {voucher.VOUCHERNUMBER || ''}
                                  </td>
                                  <td style={{ padding: '16px 20px', fontSize: '15px', color: '#64748b', fontStyle: 'italic' }}>
                                    {voucher.VOUCHERTYPE}
                                  </td>
                                  <td style={{ padding: '16px 20px', fontSize: '15px', color: '#64748b', textAlign: 'right', fontStyle: 'italic' }}>
                                    {voucher.DEBITAMT > 0 ?
                                      `${parseFloat(voucher.DEBITAMT).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Dr` :
                                      voucher.CREDITAMT > 0 ?
                                        `${parseFloat(voucher.CREDITAMT).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Cr` : ''
                                    }
                                  </td>
                                  <td style={{ padding: '16px 20px', fontSize: '15px', color: '#374151', textAlign: 'right', fontStyle: 'italic' }}></td>
                                  <td style={{ padding: '16px 20px', fontSize: '15px', color: '#374151', textAlign: 'right', fontStyle: 'italic' }}></td>
                                  <td style={{ padding: '16px 20px', fontSize: '15px', color: '#374151', fontStyle: 'italic' }}></td>
                                  <td style={{ padding: '16px 20px', fontSize: '15px', color: '#374151', textAlign: 'right', fontStyle: 'italic' }}></td>
                                </tr>
                              ))}

                              {/* ONACCVOUCHERS entries */}
                              {tableData.onacc.ONACCVOUCHERS && Array.isArray(tableData.onacc.ONACCVOUCHERS) && tableData.onacc.ONACCVOUCHERS.map((voucher, index) => (
                                <tr key={`onacc-${index}`} style={{
                                  backgroundColor: '#f8fafc',
                                  borderLeft: '4px solid #10b981'
                                }}>
                                  <td style={{ padding: '16px 20px', fontSize: '15px', color: '#64748b', fontStyle: 'italic' }}>{voucher.DATE}</td>
                                  <td style={{
                                    padding: '16px 20px',
                                    fontSize: '15px',
                                    color: '#64748b',
                                    paddingLeft: '32px',
                                    fontStyle: 'italic'
                                  }}>
                                    {voucher.VOUCHERNUMBER || ''}
                                  </td>
                                  <td style={{ padding: '16px 20px', fontSize: '15px', color: '#64748b', fontStyle: 'italic' }}>
                                    {voucher.VOUCHERTYPE}
                                  </td>
                                  <td style={{ padding: '16px 20px', fontSize: '15px', color: '#64748b', textAlign: 'right', fontStyle: 'italic' }}>
                                    {voucher.DEBITAMT > 0 ?
                                      `${parseFloat(voucher.DEBITAMT).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Dr` :
                                      voucher.CREDITAMT > 0 ?
                                        `${parseFloat(voucher.CREDITAMT).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Cr` : ''
                                    }
                                  </td>
                                  <td style={{ padding: '16px 20px', fontSize: '15px', color: '#374151', textAlign: 'right', fontStyle: 'italic' }}></td>
                                  <td style={{ padding: '16px 20px', fontSize: '15px', color: '#374151', textAlign: 'right', fontStyle: 'italic' }}></td>
                                  <td style={{ padding: '16px 20px', fontSize: '15px', color: '#374151', fontStyle: 'italic' }}></td>
                                  <td style={{ padding: '16px 20px', fontSize: '15px', color: '#374151', textAlign: 'right', fontStyle: 'italic' }}></td>
                                </tr>
                              ))}
                            </>
                          )}
                        </>
                      )}

                      {/* Summary rows for Bill wise O/s - placed below table columns */}
                      {table === 'Bill wise O/s' && currentRecords.length > 0 && (
                        <>
                          {/* Current Page Total - Only show when there are 11+ records (multiple pages) */}
                          {modifiedData.length >= 11 && (
                            <tr style={{ background: '#f8fafc', borderTop: '1px solid #e5e7eb' }}>
                              <td style={{ padding: '20px', fontSize: '15px', color: '#64748b', fontWeight: '600', textAlign: 'left' }}>
                                Current Page Total:
                              </td>
                              <td></td>
                              {configOptions.billwiseBreakup && (
                                <>
                                  <td></td>
                                  <td></td>
                                </>
                              )}
                              <td style={{ padding: '20px', fontSize: '15px', color: '#374151', fontWeight: '700', textAlign: 'right' }}>
                                {(() => {
                                  // Calculate total from main rows only on current page
                                  const currentPageMainRows = paginationData.slice(indexOfFirstRecord, indexOfLastRecord);
                                  const total = currentPageMainRows.reduce((sum, row) => {
                                    const debit = parseFloat(row.DEBITOPENBAL || 0);
                                    const credit = parseFloat(row.CREDITOPENBAL || 0);
                                    return sum + (debit - credit);
                                  }, 0);

                                  // Add On Account values to the total only if we're on the last page
                                  let onAccountTotal = 0;
                                  if (currentPage === totalPages && tableData.onacc) {
                                    const onaccDebit = parseFloat(tableData.onacc.DEBITOPENBAL || 0);
                                    const onaccCredit = parseFloat(tableData.onacc.CREDITOPENBAL || 0);
                                    onAccountTotal = onaccDebit - onaccCredit;
                                  }
                                  const finalTotal = total + onAccountTotal;

                                  if (finalTotal > 0) {
                                    return `${finalTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Dr`;
                                  } else if (finalTotal < 0) {
                                    return `${Math.abs(finalTotal).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Cr`;
                                  } else {
                                    return '0.00';
                                  }
                                })()}
                              </td>
                              <td style={{ padding: '16px', fontSize: 14, color: '#374151', fontWeight: 600, textAlign: 'right' }}>
                                {(() => {
                                  // Calculate total from main rows only on current page
                                  const currentPageMainRows = paginationData.slice(indexOfFirstRecord, indexOfLastRecord);
                                  const total = currentPageMainRows.reduce((sum, row) => {
                                    const debit = parseFloat(row.DEBITCLSBAL || 0);
                                    const credit = parseFloat(row.CREDITCLSBAL || 0);
                                    return sum + (debit - credit);
                                  }, 0);

                                  // Add On Account values to the total only if we're on the last page
                                  let onAccountTotal = 0;
                                  if (currentPage === totalPages && tableData.onacc) {
                                    const onaccDebit = parseFloat(tableData.onacc.DEBITCLSBAL || 0);
                                    const onaccCredit = parseFloat(tableData.onacc.CREDITCLSBAL || 0);
                                    onAccountTotal = onaccDebit - onaccCredit;
                                  }
                                  const finalTotal = total + onAccountTotal;

                                  if (finalTotal > 0) {
                                    return `${finalTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Dr`;
                                  } else if (finalTotal < 0) {
                                    return `${Math.abs(finalTotal).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Cr`;
                                  } else {
                                    return '0.00';
                                  }
                                })()}
                              </td>
                              <td></td>
                              <td></td>
                            </tr>
                          )}
                          <tr style={{ background: '#f1f5f9', borderTop: '1px solid #e5e7eb' }}>
                            <td style={{ padding: '20px', fontSize: '15px', color: '#64748b', fontWeight: '600', textAlign: 'left' }}>
                              Total:
                            </td>
                            <td></td>
                            {configOptions.billwiseBreakup && (
                              <>
                                <td></td>
                                <td></td>
                              </>
                            )}
                            <td style={{ padding: '20px', fontSize: '15px', color: '#374151', fontWeight: '700', textAlign: 'right' }}>
                              {(() => {
                                // Calculate total from all records
                                const recordsTotal = modifiedData.reduce((sum, row) => {
                                  // Only consider main rows, exclude sub-lines
                                  if (row.isVoucherEntry) return sum;

                                  const debit = parseFloat(row.DEBITOPENBAL || 0);
                                  const credit = parseFloat(row.CREDITOPENBAL || 0);
                                  return sum + (debit - credit);
                                }, 0);

                                // Add On Account values to the total
                                let onAccountTotal = 0;
                                if (tableData.onacc) {
                                  const onaccDebit = parseFloat(tableData.onacc.DEBITOPENBAL || 0);
                                  const onaccCredit = parseFloat(tableData.onacc.CREDITOPENBAL || 0);
                                  onAccountTotal = onaccDebit - onaccCredit;
                                }
                                const finalTotal = recordsTotal + onAccountTotal;

                                if (finalTotal > 0) {
                                  return `${finalTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Dr`;
                                } else if (finalTotal < 0) {
                                  return `${Math.abs(finalTotal).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Cr`;
                                } else {
                                  return '0.00';
                                }
                              })()}
                            </td>
                            <td style={{ padding: '20px', fontSize: '15px', color: '#374151', fontWeight: '700', textAlign: 'right' }}>
                              {(() => {
                                if (tableData.closing) {
                                  const debit = parseFloat(tableData.closing.DEBITCLSBAL || 0);
                                  const credit = parseFloat(tableData.closing.CREDITCLSBAL || 0);
                                  const netAmount = debit - credit;
                                  if (netAmount > 0) {
                                    return `${netAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Dr`;
                                  } else if (netAmount < 0) {
                                    return `${Math.abs(netAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Cr`;
                                  } else {
                                    return '0.00';
                                  }
                                } else {
                                  return '0.00';
                                }
                              })()}
                            </td>
                            <td></td>
                            <td></td>
                          </tr>
                        </>
                      )}
                    </table>

                    {/* Summary Section - Different for each report type */}
                    {table === 'Ledger Vouchers' ? (
                      <>
                        {/* Current Page Total - Only show when there are 11+ records (multiple pages) */}
                        {modifiedData.length >= 11 && (
                          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <tbody>
                              <tr style={{ background: '#f8fafc', borderTop: '1px solid #e5e7eb' }}>
                                <td style={{ padding: '20px', fontSize: '15px', color: '#64748b', fontWeight: '600', width: '60%' }}>
                                  Current Page Total:
                                </td>
                                <td style={{ padding: '20px', fontSize: '15px', color: '#374151', fontWeight: '700', textAlign: 'right', width: '20%' }}>
                                  {currentRecords.filter(row => !row.isLedgerEntry).reduce((sum, row) => sum + (parseFloat(row.DEBITAMT || 0)), 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                                <td style={{ padding: '20px', fontSize: '15px', color: '#374151', fontWeight: '700', textAlign: 'right', width: '10%' }}>
                                  {currentRecords.filter(row => !row.isLedgerEntry).reduce((sum, row) => sum + (parseFloat(row.CREDITAMT || 0)), 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        )}

                        {/* Opening Balance */}
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <tbody>
                            <tr style={{ background: '#f1f5f9', borderTop: '1px solid #e5e7eb' }}>
                              <td style={{ padding: '20px', fontSize: '15px', color: '#64748b', fontWeight: '600', width: '60%' }}>
                                Opening Balance:
                              </td>
                              <td style={{ padding: '20px', fontSize: '15px', color: '#374151', fontWeight: '700', textAlign: 'right', width: '20%' }}>
                                {tableData.opening ? (
                                  parseFloat(tableData.opening.DEBITAMT || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                ) : '0.00'}
                              </td>
                              <td style={{ padding: '20px', fontSize: '15px', color: '#374151', fontWeight: '700', textAlign: 'right', width: '10%' }}>
                                {tableData.opening ? (
                                  parseFloat(tableData.opening.CREDITAMT || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                ) : '0.00'}
                              </td>
                            </tr>
                          </tbody>
                        </table>

                        {/* Current Total */}
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <tbody>
                            <tr style={{ background: '#f8fafc', borderTop: '1px solid #e5e7eb' }}>
                              <td style={{ padding: '20px', fontSize: '15px', color: '#64748b', fontWeight: '600', width: '60%' }}>
                                Current Total:
                              </td>
                              <td style={{ padding: '20px', fontSize: '15px', color: '#374151', fontWeight: '700', textAlign: 'right', width: '20%' }}>
                                {modifiedData.filter(row => !row.isLedgerEntry).reduce((sum, row) => sum + (parseFloat(row.DEBITAMT || 0)), 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td style={{ padding: '20px', fontSize: '15px', color: '#374151', fontWeight: '700', textAlign: 'right', width: '10%' }}>
                                {modifiedData.filter(row => !row.isLedgerEntry).reduce((sum, row) => sum + (parseFloat(row.CREDITAMT || 0)), 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                            </tr>
                          </tbody>
                        </table>

                        {/* Closing Balance */}
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <tbody>
                            <tr style={{ background: '#f1f5f9', borderTop: '1px solid #e5e7eb' }}>
                              <td style={{ padding: '20px', fontSize: '15px', color: '#64748b', fontWeight: '600', width: '60%' }}>
                                Closing Balance:
                              </td>
                              <td style={{ padding: '20px', fontSize: '15px', color: '#374151', fontWeight: '700', textAlign: 'right', width: '20%' }}>
                                {tableData.closing ? (
                                  parseFloat(tableData.closing.DEBITAMT || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                ) : '0.00'}
                              </td>
                              <td style={{ padding: '20px', fontSize: '15px', color: '#374151', fontWeight: '700', textAlign: 'right', width: '10%' }}>
                                {tableData.closing ? (
                                  parseFloat(tableData.closing.CREDITAMT || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                ) : '0.00'}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </>
                    ) : null}

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                      <div className="ledgerbook-pagination" style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '16px',
                        borderTop: '1px solid #e5e7eb',
                        background: '#f8fafc'
                      }}>
                        <div style={{ fontSize: 14, color: '#64748b' }}>
                          Showing {indexOfFirstRecord + 1} to {Math.min(indexOfLastRecord, paginationData.length)} of {paginationData.length} records
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <button
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={currentPage === 1}
                            style={{
                              padding: '10px 16px',
                              border: '1px solid #d1d5db',
                              background: currentPage === 1 ? '#f3f4f6' : '#fff',
                              color: currentPage === 1 ? '#9ca3af' : '#374151',
                              borderRadius: '8px',
                              cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                              fontSize: '14px',
                              fontWeight: '600',
                              transition: 'all 0.2s ease',
                              boxShadow: currentPage === 1 ? 'none' : '0 1px 3px rgba(0, 0, 0, 0.1)'
                            }}
                          >
                            Previous
                          </button>

                          {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
                            <button
                              key={pageNum}
                              onClick={() => handlePageChange(pageNum)}
                              style={{
                                padding: '10px 16px',
                                border: '1px solid #d1d5db',
                                background: currentPage === pageNum ? 'linear-gradient(135deg, #1e40af 0%, #1d4ed8 100%)' : '#fff',
                                color: currentPage === pageNum ? '#fff' : '#374151',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontSize: '14px',
                                fontWeight: '600',
                                minWidth: '40px',
                                transition: 'all 0.2s ease',
                                boxShadow: currentPage === pageNum ? '0 2px 4px rgba(30, 64, 175, 0.2)' : '0 1px 3px rgba(0, 0, 0, 0.1)'
                              }}
                            >
                              {pageNum}
                            </button>
                          ))}

                          <button
                            onClick={() => handlePageChange(currentPage + 1)}
                            disabled={currentPage === totalPages}
                            style={{
                              padding: '10px 16px',
                              border: '1px solid #d1d5db',
                              background: currentPage === totalPages ? '#f3f4f6' : '#fff',
                              color: currentPage === totalPages ? '#9ca3af' : '#374151',
                              borderRadius: '8px',
                              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                              fontSize: '14px',
                              fontWeight: '600',
                              transition: 'all 0.2s ease',
                              boxShadow: currentPage === totalPages ? 'none' : '0 1px 3px rgba(0, 0, 0, 0.1)'
                            }}
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {!tableData && !tableLoading && !tableError && (
            <div className="ledgerbook-empty-state" style={{ display: 'flex', alignItems: 'Left', justifyContent: 'Left', paddingLeft: '10em', padding: '60px', color: '#64748b', fontSize: 20, fontWeight: 500 }}>
              <span>Table data will appear here after you submit.</span>
            </div>
          )}
        </div>
        {showVoucherDetails && viewingVoucher && (
          <div
            className="ledgerbook-voucher-modal"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(15, 23, 42, 0.55)',
              backdropFilter: 'blur(2px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '32px',
              zIndex: 10000
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowVoucherDetails(false);
                setViewingVoucher(null);
              }
            }}
          >
            <div
              className="ledgerbook-voucher-modal-content"
              style={{
                background: '#fff',
                borderRadius: '18px',
                width: '96%',
                maxWidth: '1024px',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 20px 50px rgba(15, 23, 42, 0.25)',
                overflow: 'hidden',
                border: '1px solid #e2e8f0'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div
                className="ledgerbook-voucher-modal-header"
                style={{
                  padding: '24px 28px',
                  borderBottom: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%)'
                }}
              >
                <div>
                  <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1e293b' }}>
                    Voucher Details
                    {(viewingVoucher?.VCHNO || viewingVoucher?.VOUCHERNUMBER) && (
                      <span style={{ marginLeft: 12, fontSize: 14, fontWeight: 500, color: '#64748b' }}>
                        {(viewingVoucher?.VCHNO || viewingVoucher?.VOUCHERNUMBER)} - {(viewingVoucher?.VCHTYPE || viewingVoucher?.VOUCHERTYPE || '-')}
                      </span>
                    )}
                  </h2>
                  <div style={{ marginTop: 8, fontSize: 14, color: '#64748b', fontWeight: 500 }}>
                    Ledger: {viewingVoucher?.ledgerName || dropdown3}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {viewingVoucher?.MASTERID && (
                    <button
                      onClick={downloadPDF}
                      disabled={isDownloadingPDF}
                      style={{
                        background: isDownloadingPDF ? '#cbd5e1' : '#3b82f6',
                        color: '#fff',
                        border: 'none',
                        cursor: isDownloadingPDF ? 'not-allowed' : 'pointer',
                        padding: '10px 20px',
                        borderRadius: '8px',
                        fontSize: 14,
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'background 0.2s',
                        opacity: isDownloadingPDF ? 0.7 : 1
                      }}
                      onMouseEnter={(e) => {
                        if (!isDownloadingPDF) {
                          e.currentTarget.style.background = '#2563eb';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isDownloadingPDF) {
                          e.currentTarget.style.background = '#3b82f6';
                        }
                      }}
                    >
                      <span className="material-icons" style={{ fontSize: 18 }}>
                        {isDownloadingPDF ? 'hourglass_empty' : 'download'}
                      </span>
                      {isDownloadingPDF ? 'Downloading...' : 'Download PDF'}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setShowVoucherDetails(false);
                      setViewingVoucher(null);
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(15, 23, 42, 0.08)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span className="material-icons" style={{ fontSize: 24, color: '#475569' }}>close</span>
                  </button>
                </div>
              </div>

              <div className="ledgerbook-voucher-modal-content" style={{ flex: 1, overflow: 'auto', padding: '28px' }}>
                {/* Voucher Summary */}
                <div
                  className="ledgerbook-voucher-summary"
                  style={{
                    background: '#f8fafc',
                    borderRadius: '14px',
                    border: '1px solid #e2e8f0',
                    padding: '20px 24px',
                    marginBottom: '24px'
                  }}
                >
                  <div className="ledgerbook-voucher-summary-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Voucher Type</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#1e293b' }}>{viewingVoucher?.VOUCHERTYPE || viewingVoucher?.VCHTYPE || '-'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Voucher No.</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#1e293b' }}>{viewingVoucher?.VCHNO || viewingVoucher?.VOUCHERNUMBER || '-'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Date</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#1e293b' }}>{viewingVoucher?.formattedDate || '-'}</div>
                    </div>
                    {viewingVoucher?.refNo && (
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Bill Reference</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: '#1e293b' }}>{viewingVoucher.refNo}</div>
                      </div>
                    )}
                  </div>
                  {(viewingVoucher?.particulars || viewingVoucher?.PARTICULARS) && (
                    <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Particulars</div>
                      <div style={{ fontSize: 16, fontWeight: 600, color: '#1e293b' }}>{viewingVoucher.particulars || viewingVoucher.PARTICULARS}</div>
                    </div>
                  )}
                  {(viewingVoucher?.NARRATION || viewingVoucher?.narration || viewingVoucher?.Narration || viewingVoucher?.CP_Temp7 || viewingVoucher?.cp_temp7) && (
                    <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className="material-icons" style={{ fontSize: 16, color: '#64748b' }}>description</span>
                        Narration
                      </div>
                      <div style={{
                        fontSize: 14,
                        fontWeight: 500,
                        color: '#1e293b',
                        padding: '12px 16px',
                        background: '#f8fafc',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                        lineHeight: '1.6',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word'
                      }}>
                        {viewingVoucher?.NARRATION || viewingVoucher?.narration || viewingVoucher?.Narration || viewingVoucher?.CP_Temp7 || viewingVoucher?.cp_temp7}
                      </div>
                    </div>
                  )}
                  {(viewingVoucher?.openingBalances || viewingVoucher?.pendingBalances || viewingVoucher?.dueOn || viewingVoucher?.overdueDays !== undefined) && (
                    <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #e2e8f0', display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                      {viewingVoucher?.openingBalances && (
                        <div style={{ background: '#eef2ff', color: '#3730a3', padding: '8px 14px', borderRadius: 999, fontSize: 13, fontWeight: 600 }}>
                          Opening: {describeBalance(viewingVoucher.openingBalances)}
                        </div>
                      )}
                      {viewingVoucher?.pendingBalances && (
                        <div style={{ background: '#fef3c7', color: '#b45309', padding: '8px 14px', borderRadius: 999, fontSize: 13, fontWeight: 600 }}>
                          Pending: {describeBalance(viewingVoucher.pendingBalances)}
                        </div>
                      )}
                      {viewingVoucher?.dueOn && (
                        <div style={{ background: '#dcfce7', color: '#047857', padding: '8px 14px', borderRadius: 999, fontSize: 13, fontWeight: 600 }}>
                          Due On: {viewingVoucher.dueOn}
                        </div>
                      )}
                      {(viewingVoucher?.overdueDays || viewingVoucher?.overdueDays === 0) && viewingVoucher?.overdueDays !== undefined && viewingVoucher?.overdueDays !== null && (
                        <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '8px 14px', borderRadius: 999, fontSize: 13, fontWeight: 600 }}>
                          Overdue Days: {viewingVoucher.overdueDays}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Ledger Entries */}
                {(() => {
                  const ledgerEntries = normalizeToArray(viewingVoucher?.ALLLEDGERENTRIES);
                  if (!ledgerEntries.length) return null;
                  return (
                    <div style={{ marginBottom: 28 }}>
                      <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 18, fontWeight: 700, color: '#1e293b', marginBottom: 18 }}>
                        <span className="material-icons" style={{ fontSize: 20 }}>account_balance</span>
                        Ledger Entries
                      </h3>
                      <div className="ledgerbook-voucher-table-wrapper">
                        <div className="ledgerbook-voucher-table" style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', padding: '14px 18px', background: '#f8fafc', borderBottom: '2px solid #e2e8f0', fontWeight: 700, color: '#1e293b' }}>
                          <div>Ledger Name</div>
                          <div style={{ textAlign: 'right' }}>Debit Amount</div>
                          <div style={{ textAlign: 'right' }}>Credit Amount</div>
                        </div>
                        {ledgerEntries.map((entry, idx) => {
                          const billAllocations = normalizeToArray(entry.BILLALLOCATIONS);
                          const inventoryAllocations = normalizeToArray(entry.INVENTORYALLOCATIONS);
                          return (
                            <div key={idx} style={{ borderBottom: idx === ledgerEntries.length - 1 ? 'none' : '1px solid #e2e8f0' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', padding: '16px 18px', alignItems: 'center' }}>
                                <div style={{ fontSize: 15, fontWeight: 600, color: '#1e293b' }}>{entry.LEDGERNAME}</div>
                                <div style={{ textAlign: 'right', fontSize: 14, color: '#1e293b', fontWeight: 600 }}>
                                  {entry.DEBITAMT && parseAmount(entry.DEBITAMT) > 0 ? formatCurrency(entry.DEBITAMT) : ''}
                                </div>
                                <div style={{ textAlign: 'right', fontSize: 14, color: '#1e293b', fontWeight: 600 }}>
                                  {entry.CREDITAMT && parseAmount(entry.CREDITAMT) > 0 ? formatCurrency(entry.CREDITAMT) : ''}
                                </div>
                              </div>

                              {billAllocations.length > 0 && (
                                <div style={{ background: '#f8fafc', padding: '12px 34px', borderTop: '1px solid #e2e8f0' }}>
                                  <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 8 }}>Bill Allocations</div>
                                  {billAllocations.map((bill, bIdx) => (
                                    <div key={bIdx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', padding: '6px 0', fontSize: 13, color: '#475569' }}>
                                      <div>{bill.BILLNAME || '-'}</div>
                                      <div style={{ textAlign: 'right' }}>
                                        {bill.DEBITAMT && parseAmount(bill.DEBITAMT) > 0 ? formatCurrency(bill.DEBITAMT) : ''}
                                      </div>
                                      <div style={{ textAlign: 'right' }}>
                                        {bill.CREDITAMT && parseAmount(bill.CREDITAMT) > 0 ? formatCurrency(bill.CREDITAMT) : ''}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {inventoryAllocations.length > 0 && (
                                <div style={{ background: '#f8fafc', padding: '12px 34px', borderTop: '1px solid #e2e8f0' }}>
                                  <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 8 }}>Inventory Allocations</div>
                                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 12, padding: '6px 0', fontSize: 12, fontWeight: 600, color: '#64748b', borderBottom: '1px solid #e2e8f0', marginBottom: 8 }}>
                                    <div>Item Name</div>
                                    <div style={{ textAlign: 'right' }}>Quantity</div>
                                    <div style={{ textAlign: 'right' }}>Rate</div>
                                    <div style={{ textAlign: 'right' }}>Discount</div>
                                    <div style={{ textAlign: 'right' }}>Amount</div>
                                  </div>
                                  {inventoryAllocations.map((inv, invIndex) => (
                                    <div key={invIndex} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 12, padding: '6px 0', fontSize: 13, color: '#1e293b' }}>
                                      <div>{inv.STOCKITEMNAME}</div>
                                      <div style={{ textAlign: 'right' }}>{inv.BILLEQTY || inv.ACTUALQTY || '-'}</div>
                                      <div style={{ textAlign: 'right' }}>{inv.RATE || '-'}</div>
                                      <div style={{ textAlign: 'right' }}>{inv.DISCOUNT || '0'}</div>
                                      <div style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(inv.AMOUNT || inv.VALUE)}</div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Inventory Entries */}
                {(() => {
                  const inventoryEntries = normalizeToArray(viewingVoucher?.ALLINVENTORYENTRIES);
                  if (!inventoryEntries.length) return null;
                  return (
                    <div>
                      <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 18, fontWeight: 700, color: '#1e293b', marginBottom: 18 }}>
                        <span className="material-icons" style={{ fontSize: 20 }}>inventory_2</span>
                        All Inventory Entries
                      </h3>
                      <div className="ledgerbook-voucher-table-wrapper">
                        <div className="ledgerbook-voucher-table" style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', padding: '14px 18px', background: '#f8fafc', borderBottom: '2px solid #e2e8f0', fontWeight: 700, color: '#1e293b' }}>
                          <div>Item Name</div>
                          <div style={{ textAlign: 'right' }}>Quantity</div>
                          <div style={{ textAlign: 'right' }}>Rate</div>
                          <div style={{ textAlign: 'right' }}>Discount</div>
                          <div style={{ textAlign: 'right' }}>Amount</div>
                        </div>
                        {inventoryEntries.map((entry, idx) => (
                          <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', padding: '16px 18px', borderBottom: idx === inventoryEntries.length - 1 ? 'none' : '1px solid #e2e8f0', alignItems: 'center' }}>
                            <div style={{ fontSize: 15, fontWeight: 600, color: '#1e293b' }}>{entry.STOCKITEMNAME}</div>
                            <div style={{ textAlign: 'right', fontSize: 14, color: '#1e293b' }}>{entry.BILLEQTY || entry.ACTUALQTY || '-'}</div>
                            <div style={{ textAlign: 'right', fontSize: 14, color: '#1e293b' }}>{entry.RATE || '-'}</div>
                            <div style={{ textAlign: 'right', fontSize: 14, color: '#1e293b' }}>{entry.DISCOUNT || '0'}</div>
                            <div style={{ textAlign: 'right', fontSize: 14, color: '#1e293b', fontWeight: 600 }}>{formatCurrency(entry.AMOUNT || entry.VALUE)}</div>
                          </div>
                        ))}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Ledgerbook; 