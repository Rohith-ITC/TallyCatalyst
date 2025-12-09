import React, { useState, useEffect } from 'react';
import { getApiUrl } from '../config';
import { apiGet, apiPost } from '../utils/apiUtils';
import { getCustomersFromOPFS } from '../utils/cacheSyncManager';

function VendorExpenses() {
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
        setCashBank('');
        setAmount('');
        setNarration('');
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

  return (
    <div style={{ 
      padding: '20px',
      minHeight: '100vh',
      width: '1000px',
      backgroundColor: '#f5f5f5'
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
        marginBottom: '24px'
      }}>
        <h1 style={{
          fontSize: '28px',
          fontWeight: 700,
          color: '#111827',
          marginBottom: '8px',
          letterSpacing: '-0.5px'
        }}>
          Vendor/Expenses
        </h1>
        <p style={{
          fontSize: '15px',
          color: '#6b7280',
          margin: 0
        }}>
          Create and manage payment vouchers for expenses and vendors
        </p>
      </div>

        {error && (
          <div style={{
            padding: '12px',
            backgroundColor: '#fee',
            color: '#c33',
            borderRadius: '4px',
            marginBottom: '20px'
          }}>
            {error}
          </div>
        )}

        {successMessage && (
          <div style={{
            padding: '12px',
            backgroundColor: '#efe',
            color: '#3c3',
            borderRadius: '4px',
            marginBottom: '20px'
          }}>
            {successMessage}
          </div>
        )}

        {/* Form Container with Card Style */}
        <div style={{
          background: '#fff',
          borderRadius: '12px',
          padding: '32px',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
          border: '1px solid #e5e7eb'
        }}>
          <form onSubmit={handleSubmit}>
            {/* Top row: Voucher Type, Toggle, Ledger Dropdown */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto 1fr',
              gap: '24px',
              marginBottom: '24px',
              alignItems: 'end'
            }}>
              {/* Voucher Type Dropdown */}
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '10px',
                  fontWeight: 600,
                  fontSize: '14px',
                  color: '#374151',
                  letterSpacing: '0.3px'
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
                      padding: '12px 16px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '15px',
                      backgroundColor: '#fff',
                      color: '#111827',
                      cursor: loadingVoucherTypes ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s',
                      appearance: 'none',
                      backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\'%3E%3Cpath fill=\'%236b7280\' d=\'M6 9L1 4h10z\'/%3E%3C/svg%3E")',
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 12px center',
                      paddingRight: '40px'
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
                  marginBottom: '10px',
                  fontWeight: 600,
                  fontSize: '14px',
                  color: '#374151',
                  letterSpacing: '0.3px'
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

              {/* Ledger/Vendor Dropdown */}
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '10px',
                  fontWeight: 600,
                  fontSize: '14px',
                  color: '#374151',
                  letterSpacing: '0.3px'
                }}>
                  {ledgerLabel}
                </label>
                <select
                  value={selectedLedger}
                  onChange={(e) => setSelectedLedger(e.target.value)}
                  disabled={isExpenses ? loadingExpenses : loadingVendors}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '15px',
                    backgroundColor: '#fff',
                    color: '#111827',
                    cursor: (isExpenses ? loadingExpenses : loadingVendors) ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                    appearance: 'none',
                    backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\'%3E%3Cpath fill=\'%236b7280\' d=\'M6 9L1 4h10z\'/%3E%3C/svg%3E")',
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 12px center',
                    paddingRight: '40px'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                >
                  {(isExpenses ? loadingExpenses : loadingVendors) ? (
                    <option>Loading...</option>
                  ) : (
                    <>
                      <option value="">Select {ledgerLabel}</option>
                      {currentLedgerOptions.length === 0 ? (
                        <option value="">No {ledgerLabel.toLowerCase()} available</option>
                      ) : (
                        currentLedgerOptions.map((ledger) => {
                          const ledgerName = ledger.NAME || ledger.name || '';
                          const groupList = ledger.GROUPLIST || ledger.groupList || '';
                          let parentGroup = '';
                          if (Array.isArray(groupList)) {
                            parentGroup = groupList.find(g => 
                              g && g.toLowerCase().includes('sundry creditors')
                            ) || groupList[0] || '';
                          } else if (typeof groupList === 'string') {
                            const match = groupList.match(/sundry creditors?/i);
                            parentGroup = match ? match[0] : groupList;
                          }
                          const displayName = isExpenses 
                            ? ledgerName
                            : parentGroup ? `${ledgerName} (${parentGroup})` : ledgerName;
                          const value = ledgerName;
                          const key = ledger.MASTERID || ledger.masterId || ledger.id || value || Math.random();
                          
                          return (
                            <option key={key} value={value}>
                              {displayName}
                            </option>
                          );
                        })
                      )}
                    </>
                  )}
                </select>
              </div>
            </div>

            {/* Second row: Cash/Bank Account (under Voucher Type) and Amount (under Toggle) */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto 1fr',
              gap: '24px',
              marginBottom: '24px',
              alignItems: 'end'
            }}>
              {/* Cash/Bank Account - aligned under Voucher Type */}
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '10px',
                  fontWeight: 600,
                  fontSize: '14px',
                  color: '#374151',
                  letterSpacing: '0.3px'
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
                <select
                  value={cashBank}
                  onChange={(e) => setCashBank(e.target.value)}
                  disabled={loadingCashBank}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: cashBankError ? '1px solid #dc2626' : '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '15px',
                    backgroundColor: cashBankError ? '#fff5f5' : '#fff',
                    color: '#111827',
                    cursor: loadingCashBank ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                    appearance: 'none',
                    backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\'%3E%3Cpath fill=\'%236b7280\' d=\'M6 9L1 4h10z\'/%3E%3C/svg%3E")',
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 12px center',
                    paddingRight: '40px'
                  }}
                  onFocus={(e) => e.target.style.borderColor = cashBankError ? '#dc2626' : '#3b82f6'}
                  onBlur={(e) => e.target.style.borderColor = cashBankError ? '#dc2626' : '#d1d5db'}
                >
                  {loadingCashBank ? (
                    <option>Loading...</option>
                  ) : cashBankAccounts.length === 0 ? (
                    <option value="">No accounts available</option>
                  ) : (
                    <>
                      <option value="">Select Cash/Bank Account</option>
                      {cashBankAccounts.map((account) => (
                        <option key={account.masterId} value={account.name}>
                          {account.name} ({account.parent})
                        </option>
                      ))}
                    </>
                  )}
                </select>
              </div>

              {/* Amount - aligned under Toggle */}
              <div style={{ width: '200px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '10px',
                  fontWeight: 600,
                  fontSize: '14px',
                  color: '#374151',
                  letterSpacing: '0.3px'
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
                      padding: '12px 16px 12px 36px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '15px',
                      backgroundColor: '#fff',
                      color: '#111827',
                      transition: 'all 0.2s',
                      boxSizing: 'border-box'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                    onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                    required
                  />
                </div>
              </div>

              {/* Empty space to maintain grid alignment */}
              <div></div>
            </div>

            {/* Narration */}
            <div style={{ marginBottom: '28px' }}>
              <label style={{
                display: 'block',
                marginBottom: '10px',
                fontWeight: 600,
                fontSize: '14px',
                color: '#374151',
                letterSpacing: '0.3px'
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
                  maxWidth: '500px',
                  padding: '12px 16px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '15px',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  backgroundColor: '#fff',
                  color: '#111827',
                  transition: 'all 0.2s',
                  lineHeight: '1.5'
                }}
                onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                required
              />
            </div>

            {/* Submit Button */}
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <button
                type="submit"
                disabled={submitting}
                style={{
                  padding: '14px 32px',
                  backgroundColor: submitting ? '#9ca3af' : '#2563eb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: 600,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: submitting ? 'none' : '0 4px 6px -1px rgba(37, 99, 235, 0.3), 0 2px 4px -1px rgba(37, 99, 235, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                onMouseEnter={(e) => {
                  if (!submitting) {
                    e.currentTarget.style.backgroundColor = '#1d4ed8';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(37, 99, 235, 0.3), 0 4px 6px -2px rgba(37, 99, 235, 0.2)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!submitting) {
                    e.currentTarget.style.backgroundColor = '#2563eb';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(37, 99, 235, 0.3), 0 2px 4px -1px rgba(37, 99, 235, 0.2)';
                  }
                }}
              >
                {submitting ? (
                  <>
                    <span className="material-icons" style={{ fontSize: '18px', animation: 'spin 1s linear infinite' }}>
                      hourglass_empty
                    </span>
                    Creating...
                  </>
                ) : (
                  <>
                    <span className="material-icons" style={{ fontSize: '18px' }}>add_circle</span>
                    Create Payment Voucher
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
