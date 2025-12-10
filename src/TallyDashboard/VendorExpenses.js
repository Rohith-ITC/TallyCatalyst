import React, { useState, useEffect } from 'react';
import { getApiUrl } from '../config';
import { apiGet, apiPost } from '../utils/apiUtils';
import { getCustomersFromOPFS } from '../utils/cacheSyncManager';
import { useIsMobile } from './MobileViewConfig';

function VendorExpenses() {
  const isMobile = useIsMobile();
  // State for form fields
  const [voucherType, setVoucherType] = useState('');
  const [isExpenses, setIsExpenses] = useState(true); // Toggle: true for Expenses, false for Vendors
  const [selectedLedger, setSelectedLedger] = useState('');
  const [cashBank, setCashBank] = useState('');
  const [amount, setAmount] = useState('');
  const [narration, setNarration] = useState('');

  // State for dropdown options
  const [voucherTypes, setVoucherTypes] = useState([]);
  const [expensesLedgers, setExpensesLedgers] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [cashBankAccounts, setCashBankAccounts] = useState([]);

  // Search and dropdown states for ledger/vendor
  const [ledgerSearchTerm, setLedgerSearchTerm] = useState('');
  const [showLedgerDropdown, setShowLedgerDropdown] = useState(false);
  const [filteredLedgers, setFilteredLedgers] = useState([]);
  const [ledgerFocused, setLedgerFocused] = useState(false);

  // Search and dropdown states for cash/bank
  const [cashBankSearchTerm, setCashBankSearchTerm] = useState('');
  const [showCashBankDropdown, setShowCashBankDropdown] = useState(false);
  const [filteredCashBankAccounts, setFilteredCashBankAccounts] = useState([]);
  const [cashBankFocused, setCashBankFocused] = useState(false);

  // Loading states
  const [loadingVoucherTypes, setLoadingVoucherTypes] = useState(false);
  const [loadingExpenses, setLoadingExpenses] = useState(false);
  const [loadingVendors, setLoadingVendors] = useState(false);
  const [loadingCashBank, setLoadingCashBank] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Error states
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [cashBankError, setCashBankError] = useState('');


  // Get company info from sessionStorage
  const getCompanyInfo = () => {
    const tallyloc_id = sessionStorage.getItem('tallyloc_id');
    const company = sessionStorage.getItem('company');
    const guid = sessionStorage.getItem('guid');
    return { tallyloc_id, company, guid };
  };

  // Fetch voucher types
  useEffect(() => {
    const fetchVoucherTypes = async () => {
      const { tallyloc_id, company, guid } = getCompanyInfo();
      if (!tallyloc_id || !company || !guid) return;

      setLoadingVoucherTypes(true);
      try {
        const payload = {
          tallyloc_id: parseInt(tallyloc_id),
          company: company,
          guid: guid
        };

        const response = await apiPost('/api/tally/vendor-mang/payment-voucher-types', payload);
        console.log('Voucher types API response:', response);
        if (response && response.success && response.data) {
          console.log('Voucher types data:', response.data);
          setVoucherTypes(response.data);
          if (response.data.length === 1) {
            // Auto-select if only one option
            const voucherTypeName = response.data[0].name || response.data[0].NAME || response.data[0];
            console.log('Auto-selecting single voucher type:', voucherTypeName);
            setVoucherType(voucherTypeName);
          } else if (response.data.length > 0) {
            // Select first one if multiple options
            const firstVoucherType = response.data[0].name || response.data[0].NAME || response.data[0];
            console.log('Setting default voucher type:', firstVoucherType);
            setVoucherType(firstVoucherType);
          }
        } else {
          console.warn('Unexpected voucher types response format:', response);
        }
      } catch (err) {
        console.error('Error fetching voucher types:', err);
        setError('Failed to load voucher types');
      } finally {
        setLoadingVoucherTypes(false);
      }
    };

    fetchVoucherTypes();
  }, []);

  // Fetch expenses ledgers
  useEffect(() => {
    const fetchExpensesLedgers = async () => {
      const { tallyloc_id, company, guid } = getCompanyInfo();
      if (!tallyloc_id || !company || !guid) return;

      setLoadingExpenses(true);
      try {
        const payload = {
          tallyloc_id: parseInt(tallyloc_id),
          company: company,
          guid: guid
        };

        const response = await apiPost('/api/tally/vendor-mang/expense-ledgers', payload);
        if (response && response.success && response.data) {
          setExpensesLedgers(response.data);
          // Auto-select if only one expense ledger
          if (response.data.length === 1) {
            const ledgerName = response.data[0].name || response.data[0].NAME || '';
            if (ledgerName) {
              setSelectedLedger(ledgerName);
            }
          }
        }
      } catch (err) {
        console.error('Error fetching expenses ledgers:', err);
        setError('Failed to load expenses ledgers');
      } finally {
        setLoadingExpenses(false);
      }
    };

    if (isExpenses) {
      fetchExpensesLedgers();
    }
  }, [isExpenses]);

  // Fetch vendors (using ledgerlist-w-addrs API - same as Master Management)
  useEffect(() => {
    const fetchVendors = async () => {
      const { tallyloc_id, company, guid } = getCompanyInfo();
      if (!tallyloc_id || !company || !guid) return;

      setLoadingVendors(true);
      setError(''); // Clear previous errors
      try {
        const payload = {
          tallyloc_id: parseInt(tallyloc_id),
          company: company,
          guid: guid
        };

        // Use ledgerlist-w-addrs API (same as Master Management and PlaceOrder)
        const cacheKey = `ledgerlist-w-addrs_${tallyloc_id}_${company}`;
        
        // Try to load from cache first (OPFS/IndexedDB or sessionStorage)
        try {
          const cachedLedgers = await getCustomersFromOPFS(cacheKey);
          if (cachedLedgers && Array.isArray(cachedLedgers) && cachedLedgers.length > 0) {
            console.log(`Loaded ${cachedLedgers.length} ledgers from cache`);
            
            // Log the actual structure of first ledger to see all available fields
            if (cachedLedgers.length > 0) {
              console.log('First cached ledger (full structure):', cachedLedgers[0]);
              console.log('All fields in first cached ledger:', Object.keys(cachedLedgers[0]));
              
              // Check for any field that might contain parent/group info
              const firstLedger = cachedLedgers[0];
              const possibleParentFields = Object.keys(firstLedger).filter(key => {
                const keyLower = key.toLowerCase();
                return keyLower.includes('parent') || 
                       keyLower.includes('group') || 
                       keyLower.includes('category') ||
                       keyLower.includes('type');
              });
              console.log('Fields that might contain parent/group info:', possibleParentFields);
              if (possibleParentFields.length > 0) {
                console.log('Values of potential parent fields:', 
                  possibleParentFields.reduce((acc, field) => {
                    acc[field] = firstLedger[field];
                    return acc;
                  }, {})
                );
              }
            }
            
            // Filter for vendors (Sundry Creditors) - check GROUPLIST field
            const vendorList = cachedLedgers.filter(ledger => {
              // Check GROUPLIST field (can be string or array)
              const groupList = ledger.GROUPLIST || ledger.groupList || ledger.GROUPLIST || '';
              
              // Handle both string and array formats
              let groupListStr = '';
              if (Array.isArray(groupList)) {
                groupListStr = groupList.join(' ').toLowerCase();
              } else if (typeof groupList === 'string') {
                groupListStr = groupList.toLowerCase();
              }
              
              // Check if "Sundry Creditors" is mentioned in GROUPLIST
              return groupListStr && (
                groupListStr.includes('sundry creditors') ||
                groupListStr.includes('sundry creditor')
              );
            });
            console.log(`Filtered ${vendorList.length} vendors from cached data`);
            if (vendorList.length > 0) {
              setVendors(vendorList);
              // Auto-select if only one vendor
              if (vendorList.length === 1) {
                const vendorName = vendorList[0].NAME || vendorList[0].name || '';
                if (vendorName) {
                  setSelectedLedger(vendorName);
                }
              }
              setLoadingVendors(false);
              return; // Use cached data
            } else {
              // No vendors found with Sundry Creditors filter - show empty list
              console.warn('No vendors found with "Sundry Creditors" in GROUPLIST filter.');
              setVendors([]);
              setSelectedLedger(''); // Clear selection
              setLoadingVendors(false);
              return;
            }
          }
        } catch (cacheError) {
          console.warn('Error loading from cache, will fetch fresh:', cacheError);
        }

        // Fetch fresh data from API if cache didn't have vendors
        console.log('Fetching vendors from API with payload:', payload);
        const response = await apiPost(`/api/tally/ledgerlist-w-addrs?ts=${Date.now()}`, payload);
        console.log('Vendors API response structure:', {
          hasResponse: !!response,
          hasLedgers: !!(response && response.ledgers),
          ledgersIsArray: !!(response && response.ledgers && Array.isArray(response.ledgers)),
          ledgersLength: response && response.ledgers ? response.ledgers.length : 0
        });
        
        if (response && response.ledgers && Array.isArray(response.ledgers)) {
          console.log(`Total ledgers received from API: ${response.ledgers.length}`);
          
          // Log the actual structure of first ledger to see all available fields
          if (response.ledgers.length > 0) {
            console.log('Sample ledger structure (all fields):', response.ledgers[0]);
            console.log('Sample ledger keys:', Object.keys(response.ledgers[0]));
          }
          
          // Filter for vendors (Sundry Creditors) - check GROUPLIST field
          const vendorList = response.ledgers.filter(ledger => {
            // Check GROUPLIST field (can be string or array)
            const groupList = ledger.GROUPLIST || ledger.groupList || ledger.GROUPLIST || '';
            
            // Handle both string and array formats
            let groupListStr = '';
            if (Array.isArray(groupList)) {
              groupListStr = groupList.join(' ').toLowerCase();
            } else if (typeof groupList === 'string') {
              groupListStr = groupList.toLowerCase();
            }
            
            // Check if "Sundry Creditors" is mentioned in GROUPLIST
            return groupListStr && (
              groupListStr.includes('sundry creditors') ||
              groupListStr.includes('sundry creditor')
            );
          });
          
          console.log(`Filtered vendors from API: ${vendorList.length}`);
          if (vendorList.length === 0 && response.ledgers.length > 0) {
            // Log sample GROUPLIST values for debugging
            const sampleGroupLists = response.ledgers.slice(0, 10).map(l => ({
              name: l.NAME || l.name,
              groupList: l.GROUPLIST || l.groupList,
              groupListType: typeof (l.GROUPLIST || l.groupList)
            }));
            console.log('Sample GROUPLIST values from first 10 ledgers:', sampleGroupLists);
            console.warn('No vendors found with "Sundry Creditors" in GROUPLIST.');
          }
          
          setVendors(vendorList);
          setSelectedLedger(''); // Clear selection if no vendors found
          // Auto-select if only one vendor
          if (vendorList.length === 1) {
            const vendorName = vendorList[0].NAME || vendorList[0].name || '';
            if (vendorName) {
              setSelectedLedger(vendorName);
            }
          }
        } else if (response && response.error) {
          setError('Failed to load vendors: ' + response.error);
          setVendors([]);
        } else {
          console.error('Unexpected response format:', response);
          console.error('Response keys:', response ? Object.keys(response) : 'null');
          setError('Unexpected response format from vendors API. Please check browser console for details.');
          setVendors([]);
        }
      } catch (err) {
        console.error('Error fetching vendors:', err);
        setError(`Failed to load vendors: ${err.message || 'Unknown error'}`);
        setVendors([]);
      } finally {
        setLoadingVendors(false);
      }
    };

    if (!isExpenses) {
      fetchVendors();
    }
  }, [isExpenses]);

  // Fetch cash/bank accounts
  useEffect(() => {
    const fetchCashBank = async () => {
      const { tallyloc_id, company, guid } = getCompanyInfo();
      if (!tallyloc_id || !company || !guid) {
        console.warn('Missing company info for cash/bank fetch:', { tallyloc_id, company, guid });
        return;
      }

      setLoadingCashBank(true);
      setCashBankError(''); // Clear previous errors
      try {
        const payload = {
          tallyloc_id: parseInt(tallyloc_id),
          company: company,
          guid: guid
        };

        console.log('Fetching cash/bank accounts with payload:', payload);
        const response = await apiPost('/api/tally/vendor-mang/cash-bank-ledgers', payload);
        console.log('Cash/bank API response:', response);
        
        if (response && response.success && response.data) {
          setCashBankAccounts(response.data);
          setCashBankError('');
          console.log(`Loaded ${response.data.length} cash/bank accounts`);
          // Auto-select if only one cash/bank account
          if (response.data.length === 1) {
            const accountName = response.data[0].name || response.data[0].NAME || '';
            if (accountName) {
              setCashBank(accountName);
            }
          }
        } else if (response && response.data) {
          // Handle case where response.data exists but no success flag
          setCashBankAccounts(response.data);
          setCashBankError('');
          console.log(`Loaded ${response.data.length} cash/bank accounts (no success flag)`);
          // Auto-select if only one cash/bank account
          if (response.data.length === 1) {
            const accountName = response.data[0].name || response.data[0].NAME || '';
            if (accountName) {
              setCashBank(accountName);
            }
          }
        } else {
          console.error('Unexpected response format:', response);
          setCashBankError('Unexpected response format from cash/bank API');
          setCashBankAccounts([]);
        }
      } catch (err) {
        console.error('Error fetching cash/bank accounts:', err);
        console.error('Error details:', {
          message: err.message,
          stack: err.stack,
          name: err.name
        });
        setCashBankError(`Failed to load cash/bank accounts: ${err.message || 'Unknown error'}`);
        setCashBankAccounts([]);
      } finally {
        setLoadingCashBank(false);
      }
    };

    fetchCashBank();
  }, []);

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    // Validation
    if (!voucherType) {
      setError('Please select a voucher type');
      return;
    }
    if (!selectedLedger) {
      setError(`Please select an ${isExpenses ? 'expense ledger' : 'vendor'}`);
      return;
    }
    if (!cashBank) {
      setError('Please select a cash/bank account');
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    if (!narration) {
      setError('Please enter a narration');
      return;
    }

    const { tallyloc_id, company, guid } = getCompanyInfo();
    if (!tallyloc_id || !company || !guid) {
      setError('Missing company information');
      return;
    }

    setSubmitting(true);
    try {
      // Auto-generate voucher number
      const vchNumber = `PV${Date.now()}`;

      const payload = {
        tallyloc_id: parseInt(tallyloc_id),
        company: company,
        guid: guid,
        voucherTypeName: voucherType,
        voucherNumber: vchNumber,
        narration: narration,
        cashBankName: cashBank,
        ledgerEntries: [
          {
            ledgerName: selectedLedger,
            isDeemedPositive: true,
            isPartyLedger: !isExpenses, // Vendors are party ledgers
            amount: -parseFloat(amount) // Negative for payment
          }
        ]
      };

      const response = await apiPost('/api/tally/vendor-mang/payment-voucher/create', payload);
      
      if (response && response.success) {
        setSuccessMessage('Payment voucher created successfully!');
        // Reset form
        setSelectedLedger('');
        setLedgerSearchTerm('');
        setCashBank('');
        setCashBankSearchTerm('');
        setAmount('');
        setNarration('');
        setShowLedgerDropdown(false);
        setShowCashBankDropdown(false);
      } else {
        setError(response?.message || 'Failed to create payment voucher');
      }
    } catch (err) {
      console.error('Error creating payment voucher:', err);
      setError(err.message || 'Failed to create payment voucher');
    } finally {
      setSubmitting(false);
    }
  };

  // Get current ledger options based on toggle
  const currentLedgerOptions = isExpenses ? expensesLedgers : vendors;
  const ledgerLabel = isExpenses ? 'Expense Ledger' : 'Vendor';

  // Filter ledgers/vendors based on search term with debouncing
  useEffect(() => {
    const currentSearchTerm = ledgerSearchTerm.trim();

    // Clear results immediately if search term is empty
    if (!currentSearchTerm) {
      return;
    }

    // Clear previous results immediately when search term changes
    setFilteredLedgers([]);

    // Debounce search to improve performance
    const timeoutId = setTimeout(() => {
      const searchLower = currentSearchTerm.toLowerCase();

      // Search in NAME field
      const exactMatches = [];
      const startsWithMatches = [];
      const containsMatches = [];

      for (let i = 0; i < currentLedgerOptions.length; i++) {
        const ledger = currentLedgerOptions[i];
        const ledgerName = ledger.NAME || ledger.name || '';
        const ledgerNameLower = ledgerName.toLowerCase();

        if (ledgerNameLower.includes(searchLower)) {
          // Prioritize exact matches
          if (ledgerNameLower === searchLower) {
            exactMatches.push(ledger);
          } else if (ledgerNameLower.startsWith(searchLower)) {
            startsWithMatches.push(ledger);
          } else {
            containsMatches.push(ledger);
          }

          // Early exit if we have enough results
          if (exactMatches.length + startsWithMatches.length + containsMatches.length >= 50) {
            break;
          }
        }
      }

      // Combine results in priority order
      const filtered = [...exactMatches, ...startsWithMatches, ...containsMatches].slice(0, 50);
      setFilteredLedgers(filtered);
    }, 150); // 150ms debounce

    return () => clearTimeout(timeoutId);
  }, [ledgerSearchTerm, currentLedgerOptions]);

  // Show all ledgers when dropdown opens
  useEffect(() => {
    if (showLedgerDropdown && !ledgerSearchTerm.trim() && currentLedgerOptions.length > 0) {
      setFilteredLedgers(currentLedgerOptions);
    }
  }, [showLedgerDropdown, ledgerSearchTerm, currentLedgerOptions.length]);

  // Filter cash/bank accounts based on search term with debouncing
  useEffect(() => {
    const currentSearchTerm = cashBankSearchTerm.trim();

    // Clear results immediately if search term is empty
    if (!currentSearchTerm) {
      return;
    }

    // Clear previous results immediately when search term changes
    setFilteredCashBankAccounts([]);

    // Debounce search to improve performance
    const timeoutId = setTimeout(() => {
      const searchLower = currentSearchTerm.toLowerCase();

      // Search in name and parent fields
      const exactMatches = [];
      const startsWithMatches = [];
      const containsMatches = [];

      for (let i = 0; i < cashBankAccounts.length; i++) {
        const account = cashBankAccounts[i];
        const accountName = account.name || account.NAME || '';
        const accountParent = account.parent || account.PARENT || '';
        const accountNameLower = accountName.toLowerCase();
        const accountParentLower = accountParent.toLowerCase();

        const nameMatch = accountNameLower.includes(searchLower);
        const parentMatch = accountParentLower.includes(searchLower);

        if (nameMatch || parentMatch) {
          // Prioritize exact matches
          if (accountNameLower === searchLower || accountParentLower === searchLower) {
            exactMatches.push(account);
          } else if (accountNameLower.startsWith(searchLower) || accountParentLower.startsWith(searchLower)) {
            startsWithMatches.push(account);
          } else {
            containsMatches.push(account);
          }

          // Early exit if we have enough results
          if (exactMatches.length + startsWithMatches.length + containsMatches.length >= 50) {
            break;
          }
        }
      }

      // Combine results in priority order
      const filtered = [...exactMatches, ...startsWithMatches, ...containsMatches].slice(0, 50);
      setFilteredCashBankAccounts(filtered);
    }, 150); // 150ms debounce

    return () => clearTimeout(timeoutId);
  }, [cashBankSearchTerm, cashBankAccounts]);

  // Show all cash/bank accounts when dropdown opens
  useEffect(() => {
    if (showCashBankDropdown && !cashBankSearchTerm.trim() && cashBankAccounts.length > 0) {
      setFilteredCashBankAccounts(cashBankAccounts);
    }
  }, [showCashBankDropdown, cashBankSearchTerm, cashBankAccounts.length]);

  return (
    <div style={{ 
      padding: isMobile ? '16px 12px' : '24px',
      maxWidth: '1200px',
      margin: '0 auto',
      fontFamily: 'Segoe UI, Roboto, Arial, sans-serif'
    }}>
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
      <div style={{
        marginBottom: '32px',
        borderBottom: '2px solid #e5e7eb',
        paddingBottom: '24px'
      }}>
        <h1 style={{
          fontSize: isMobile ? '22px' : '28px',
          fontWeight: 700,
          color: '#1e293b',
          margin: 0,
          display: 'flex',
          alignItems: 'center',
          gap: isMobile ? '8px' : '12px',
          flexWrap: isMobile ? 'wrap' : 'nowrap'
        }}>
          <span className="material-icons" style={{ fontSize: isMobile ? '24px' : '32px', color: '#3b82f6' }}>
            payment
          </span>
          Vendor/Expenses
        </h1>
        <p style={{
          fontSize: isMobile ? '14px' : '16px',
          color: '#64748b',
          marginTop: '8px',
          marginLeft: isMobile ? '0' : '44px'
        }}>
          Create and manage payment vouchers for expenses and vendors
        </p>
      </div>

      {/* Message Display */}
      {error && (
        <div style={{
          background: '#fee2e2',
          border: '1px solid #fca5a5',
          borderRadius: '12px',
          padding: isMobile ? '12px 16px' : '16px 20px',
          marginBottom: isMobile ? '16px' : '24px',
          display: 'flex',
          alignItems: 'center',
          gap: isMobile ? '10px' : '12px'
        }}>
          <span className="material-icons" style={{
            fontSize: isMobile ? '20px' : '24px',
            color: '#dc2626',
            flexShrink: 0
          }}>
            error
          </span>
          <div style={{
            fontSize: isMobile ? '13px' : '15px',
            fontWeight: 500,
            color: '#991b1b',
            flex: 1,
            wordBreak: 'break-word'
          }}>
            {error}
          </div>
        </div>
      )}

      {successMessage && (
        <div style={{
          background: '#d1fae5',
          border: '1px solid #6ee7b7',
          borderRadius: '12px',
          padding: isMobile ? '12px 16px' : '16px 20px',
          marginBottom: isMobile ? '16px' : '24px',
          display: 'flex',
          alignItems: 'center',
          gap: isMobile ? '10px' : '12px'
        }}>
          <span className="material-icons" style={{
            fontSize: isMobile ? '20px' : '24px',
            color: '#059669',
            flexShrink: 0
          }}>
            check_circle
          </span>
          <div style={{
            fontSize: isMobile ? '13px' : '15px',
            fontWeight: 500,
            color: '#065f46',
            flex: 1,
            wordBreak: 'break-word'
          }}>
            {successMessage}
          </div>
        </div>
      )}

      {/* Form Container with Card Style */}
      <div style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: isMobile ? '16px' : '24px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}>
          <form onSubmit={handleSubmit}>
            {/* Top row: Voucher Type, Toggle, Ledger Dropdown */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : '1fr auto 1fr',
              gap: isMobile ? '16px' : '24px',
              marginBottom: isMobile ? '16px' : '24px',
              alignItems: 'end'
            }}>
              {/* Voucher Type Dropdown */}
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '6px',
                  fontWeight: 500,
                  fontSize: isMobile ? '13px' : '14px',
                  color: '#475569'
                }}>
                  Voucher Type
                </label>
                <div style={{ position: 'relative' }}>
                  <select
                    value={voucherType}
                    onChange={(e) => setVoucherType(e.target.value)}
                    disabled={loadingVoucherTypes}
                    style={{
                      width: '100%',
                      padding: isMobile ? '12px' : '10px',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      fontSize: isMobile ? '15px' : '14px',
                      backgroundColor: '#f8fafc',
                      color: '#1e293b',
                      cursor: loadingVoucherTypes ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s',
                      appearance: 'none',
                      backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\'%3E%3Cpath fill=\'%236b7280\' d=\'M6 9L1 4h10z\'/%3E%3C/svg%3E")',
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 12px center',
                      paddingRight: '40px',
                      outline: 'none'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                    onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                  >
                    {loadingVoucherTypes ? (
                      <option>Loading...</option>
                    ) : (
                      <>
                        <option value="">Select Voucher Type</option>
                        {voucherTypes.map((vt) => {
                          const voucherName = vt.name || vt.NAME || vt.voucherTypeName || '';
                          const voucherId = vt.masterId || vt.id || vt.MASTERID || '';
                          return (
                            <option key={voucherId} value={voucherName}>
                              {voucherName}
                            </option>
                          );
                        })}
                      </>
                    )}
                  </select>
                </div>
              </div>

              {/* Toggle: Expenses / Vendors */}
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '6px',
                  fontWeight: 500,
                  fontSize: isMobile ? '13px' : '14px',
                  color: '#475569'
                }}>
                  Type
                </label>
                <div style={{
                  display: 'flex',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  backgroundColor: '#f9fafb',
                  boxShadow: 'inset 0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                }}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsExpenses(true);
                      setSelectedLedger('');
                      setLedgerSearchTerm('');
                      setShowLedgerDropdown(false);
                      setFilteredLedgers([]);
                    }}
                    style={{
                      flex: 1,
                      padding: '12px 20px',
                      border: 'none',
                      backgroundColor: isExpenses ? '#2563eb' : 'transparent',
                      color: isExpenses ? '#fff' : '#6b7280',
                      cursor: 'pointer',
                      fontWeight: isExpenses ? 600 : 500,
                      fontSize: '14px',
                      transition: 'all 0.2s',
                      position: 'relative',
                      boxShadow: isExpenses ? '0 1px 3px 0 rgba(37, 99, 235, 0.3)' : 'none'
                    }}
                  >
                    Expenses
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsExpenses(false);
                      setSelectedLedger('');
                      setLedgerSearchTerm('');
                      setShowLedgerDropdown(false);
                      setFilteredLedgers([]);
                    }}
                    style={{
                      flex: 1,
                      padding: '12px 20px',
                      border: 'none',
                      backgroundColor: !isExpenses ? '#2563eb' : 'transparent',
                      color: !isExpenses ? '#fff' : '#6b7280',
                      cursor: 'pointer',
                      fontWeight: !isExpenses ? 600 : 500,
                      fontSize: '14px',
                      transition: 'all 0.2s',
                      boxShadow: !isExpenses ? '0 1px 3px 0 rgba(37, 99, 235, 0.3)' : 'none'
                    }}
                  >
                    Vendors
                  </button>
                </div>
              </div>

              {/* Ledger/Vendor Searchable Dropdown */}
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '6px',
                  fontWeight: 500,
                  fontSize: isMobile ? '13px' : '14px',
                  color: '#475569'
                }}>
                  {ledgerLabel}
                </label>
                <div style={{
                  position: 'relative',
                  background: 'white',
                  borderRadius: '8px',
                  border: showLedgerDropdown ? '2px solid #3b82f6' : '1px solid #d1d5db',
                  transition: 'all 0.2s ease',
                  boxShadow: showLedgerDropdown ? '0 4px 12px rgba(59, 130, 246, 0.15)' : '0 1px 2px rgba(0, 0, 0, 0.08)',
                  zIndex: showLedgerDropdown ? 1001 : 'auto'
                }}>
                  <input
                    type="text"
                    value={selectedLedger || ledgerSearchTerm}
                    onChange={(e) => {
                      const inputValue = e.target.value;
                      setLedgerSearchTerm(inputValue);
                      setSelectedLedger('');
                      setShowLedgerDropdown(true);
                      if (!inputValue.trim()) {
                        setFilteredLedgers(currentLedgerOptions);
                      } else {
                        setFilteredLedgers([]);
                      }
                    }}
                    onFocus={() => {
                      setLedgerFocused(true);
                      setShowLedgerDropdown(true);
                      setFilteredLedgers(currentLedgerOptions);
                    }}
                    onBlur={(e) => {
                      setLedgerFocused(false);
                      setTimeout(() => {
                        setShowLedgerDropdown(false);
                      }, 200);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setShowLedgerDropdown(false);
                        e.target.blur();
                      }
                    }}
                    disabled={(isExpenses ? loadingExpenses : loadingVendors)}
                    placeholder={(isExpenses ? loadingExpenses : loadingVendors) ? 'Loading...' : `Search ${ledgerLabel.toLowerCase()}...`}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      paddingRight: selectedLedger ? '50px' : '40px',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '15px',
                      color: '#374151',
                      outline: 'none',
                      background: 'transparent',
                      cursor: (isExpenses ? loadingExpenses : loadingVendors) ? 'not-allowed' : 'text',
                      boxSizing: 'border-box'
                    }}
                  />
                  {!selectedLedger && (
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
                  {selectedLedger && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedLedger('');
                        setLedgerSearchTerm('');
                        setShowLedgerDropdown(false);
                        setFilteredLedgers(currentLedgerOptions);
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
                      title={`Clear ${ledgerLabel.toLowerCase()}`}
                    >
                      ×
                    </button>
                  )}
                  {(isExpenses ? loadingExpenses : loadingVendors) && (
                    <div style={{
                      position: 'absolute',
                      right: selectedLedger ? '40px' : '50px',
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
                  {showLedgerDropdown && (
                    <div
                      onMouseDown={(e) => e.preventDefault()}
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
                      {ledgerSearchTerm.trim() && filteredLedgers.length === 0 && (
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
                          Searching {currentLedgerOptions.length.toLocaleString()} {ledgerLabel.toLowerCase()}...
                        </div>
                      )}
                      {filteredLedgers.map((ledger, index) => {
                        const ledgerName = ledger.NAME || ledger.name || '';
                        return (
                          <div
                            key={ledger.MASTERID || ledger.masterId || ledger.id || ledgerName || index}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setSelectedLedger(ledgerName);
                              setLedgerSearchTerm('');
                              setShowLedgerDropdown(false);
                              setFilteredLedgers([]);
                            }}
                            style={{
                              padding: '12px 16px',
                              cursor: 'pointer',
                              borderBottom: index < filteredLedgers.length - 1 ? '1px solid #f1f5f9' : 'none',
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
                              {ledgerName}
                            </div>
                          </div>
                        );
                      })}
                      {filteredLedgers.length === 50 && (
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
                  {showLedgerDropdown && ledgerSearchTerm.trim() && filteredLedgers.length === 0 && (
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
                      No {ledgerLabel.toLowerCase()} found matching "{ledgerSearchTerm}"
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Second row: Cash/Bank Account (under Voucher Type) and Amount (under Toggle) */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : '1fr auto 1fr',
              gap: isMobile ? '16px' : '24px',
              marginBottom: isMobile ? '16px' : '24px',
              alignItems: 'end'
            }}>
              {/* Cash/Bank Account - aligned under Voucher Type */}
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '6px',
                  fontWeight: 500,
                  fontSize: isMobile ? '13px' : '14px',
                  color: '#475569'
                }}>
                  Cash/Bank Account
                </label>
                {cashBankError && (
                  <div style={{
                    padding: '8px 12px',
                    backgroundColor: '#fef2f2',
                    color: '#dc2626',
                    borderRadius: '6px',
                    marginBottom: '8px',
                    fontSize: '13px',
                    border: '1px solid #fecaca'
                  }}>
                    {cashBankError}
                  </div>
                )}
                <div style={{
                  position: 'relative',
                  background: 'white',
                  borderRadius: '8px',
                  border: showCashBankDropdown ? '2px solid #3b82f6' : (cashBankError ? '1px solid #dc2626' : '1px solid #d1d5db'),
                  transition: 'all 0.2s ease',
                  boxShadow: showCashBankDropdown ? '0 4px 12px rgba(59, 130, 246, 0.15)' : '0 1px 2px rgba(0, 0, 0, 0.08)',
                  zIndex: showCashBankDropdown ? 1001 : 'auto',
                  backgroundColor: cashBankError ? '#fff5f5' : 'white'
                }}>
                  <input
                    type="text"
                    value={cashBank || cashBankSearchTerm}
                    onChange={(e) => {
                      const inputValue = e.target.value;
                      setCashBankSearchTerm(inputValue);
                      setCashBank('');
                      setShowCashBankDropdown(true);
                      if (!inputValue.trim()) {
                        setFilteredCashBankAccounts(cashBankAccounts);
                      } else {
                        setFilteredCashBankAccounts([]);
                      }
                    }}
                    onFocus={() => {
                      setCashBankFocused(true);
                      setShowCashBankDropdown(true);
                      setFilteredCashBankAccounts(cashBankAccounts);
                    }}
                    onBlur={(e) => {
                      setCashBankFocused(false);
                      setTimeout(() => {
                        setShowCashBankDropdown(false);
                      }, 200);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setShowCashBankDropdown(false);
                        e.target.blur();
                      }
                    }}
                    disabled={loadingCashBank}
                    placeholder={loadingCashBank ? 'Loading...' : 'Search cash/bank account...'}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      paddingRight: cashBank ? '50px' : '40px',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '15px',
                      color: '#111827',
                      outline: 'none',
                      background: 'transparent',
                      cursor: loadingCashBank ? 'not-allowed' : 'text',
                      boxSizing: 'border-box'
                    }}
                  />
                  {!cashBank && (
                    <span
                      className="material-icons"
                      style={{
                        position: 'absolute',
                        right: '16px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: showCashBankDropdown ? '#3b82f6' : '#9ca3af',
                        fontSize: '20px',
                        pointerEvents: 'none',
                        transition: 'color 0.2s ease'
                      }}
                    >
                      {showCashBankDropdown ? 'expand_less' : 'search'}
                    </span>
                  )}
                  {cashBank && (
                    <button
                      type="button"
                      onClick={() => {
                        setCashBank('');
                        setCashBankSearchTerm('');
                        setShowCashBankDropdown(false);
                        setFilteredCashBankAccounts(cashBankAccounts);
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
                      title="Clear cash/bank account"
                    >
                      ×
                    </button>
                  )}
                  {loadingCashBank && (
                    <div style={{
                      position: 'absolute',
                      right: cashBank ? '40px' : '50px',
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
                  {showCashBankDropdown && (
                    <div
                      onMouseDown={(e) => e.preventDefault()}
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
                      {cashBankSearchTerm.trim() && filteredCashBankAccounts.length === 0 && (
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
                          Searching {cashBankAccounts.length.toLocaleString()} accounts...
                        </div>
                      )}
                      {filteredCashBankAccounts.map((account, index) => {
                        const accountName = account.name || account.NAME || '';
                        const accountParent = account.parent || account.PARENT || '';
                        return (
                          <div
                            key={account.masterId || account.id || accountName || index}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setCashBank(accountName);
                              setCashBankSearchTerm('');
                              setShowCashBankDropdown(false);
                              setFilteredCashBankAccounts([]);
                            }}
                            style={{
                              padding: '12px 16px',
                              cursor: 'pointer',
                              borderBottom: index < filteredCashBankAccounts.length - 1 ? '1px solid #f1f5f9' : 'none',
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
                              {accountName}
                            </div>
                            {accountParent && (
                              <div style={{
                                fontSize: '12px',
                                color: '#64748b',
                                marginTop: '2px'
                              }}>
                                {accountParent}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {filteredCashBankAccounts.length === 50 && (
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
                  {showCashBankDropdown && cashBankSearchTerm.trim() && filteredCashBankAccounts.length === 0 && (
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
                      No accounts found matching "{cashBankSearchTerm}"
                    </div>
                  )}
                </div>
              </div>

              {/* Amount - aligned under Toggle */}
              <div style={{ width: isMobile ? '100%' : '200px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '6px',
                  fontWeight: 500,
                  fontSize: isMobile ? '13px' : '14px',
                  color: '#475569'
                }}>
                  Amount
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{
                    position: 'absolute',
                    left: '16px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#6b7280',
                    fontWeight: 600,
                    fontSize: '15px'
                  }}>₹</span>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    style={{
                      width: '100%',
                      padding: isMobile ? '12px 12px 12px 36px' : '12px 16px 12px 36px',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      fontSize: isMobile ? '15px' : '14px',
                      backgroundColor: '#f8fafc',
                      color: '#1e293b',
                      transition: 'all 0.2s',
                      boxSizing: 'border-box',
                      outline: 'none'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                    onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
                    required
                  />
                </div>
              </div>

              {/* Empty space to maintain grid alignment */}
              <div></div>
            </div>

            {/* Narration */}
            <div style={{ marginBottom: isMobile ? '20px' : '28px' }}>
              <label style={{
                display: 'block',
                marginBottom: '6px',
                fontWeight: 500,
                fontSize: isMobile ? '13px' : '14px',
                color: '#475569'
              }}>
                Narration
              </label>
              <textarea
                value={narration}
                onChange={(e) => setNarration(e.target.value)}
                placeholder="Enter narration details..."
                rows="4"
                style={{
                  width: '100%',
                  maxWidth: isMobile ? '100%' : '500px',
                  padding: isMobile ? '12px' : '12px 16px',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  fontSize: isMobile ? '15px' : '15px',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  backgroundColor: '#f8fafc',
                  color: '#1e293b',
                  transition: 'all 0.2s',
                  lineHeight: '1.5',
                  outline: 'none'
                }}
                onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
                required
              />
            </div>

            {/* Submit Button */}
            <div style={{ display: 'flex', justifyContent: 'flex-start', width: '100%' }}>
              <button
                type="submit"
                disabled={submitting}
                style={{
                  padding: isMobile ? '14px 16px' : '14px 32px',
                  background: submitting ? '#94a3b8' : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: isMobile ? '15px' : '16px',
                  fontWeight: 600,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: submitting ? 'none' : '0 2px 8px rgba(37, 99, 235, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  width: isMobile ? '100%' : 'auto',
                  minWidth: isMobile ? '100%' : '200px'
                }}
                onMouseEnter={(e) => {
                  if (!submitting) {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.35)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!submitting) {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(37, 99, 235, 0.25)';
                  }
                }}
              >
                {submitting ? (
                  <>
                    <span className="material-icons" style={{ fontSize: isMobile ? '20px' : '18px', animation: 'spin 1s linear infinite', flexShrink: 0 }}>
                      refresh
                    </span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>Creating...</span>
                  </>
                ) : (
                  <>
                    <span className="material-icons" style={{ fontSize: isMobile ? '20px' : '18px', flexShrink: 0 }}>add_circle</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>Create Payment Voucher</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
    </div>
  );
}

export default VendorExpenses;
