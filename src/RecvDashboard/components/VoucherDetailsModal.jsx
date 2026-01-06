import React from 'react';
import { formatCurrency } from '../utils/helpers';
import { useIsMobile } from '../../TallyDashboard/MobileViewConfig';

const VoucherDetailsModal = ({ voucherData, loading, error, onClose, headerActions }) => {
  const isMobile = useIsMobile();
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

  const formatCurrencyAmount = (amount) => {
    const value = parseAmount(amount);
    return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatNumber = (num) => {
    const value = parseAmount(num);
    return value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const normalizeToArray = (value) => {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  };

  if (loading) {
    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.55)',
          backdropFilter: 'blur(2px)',
          display: 'flex',
          alignItems: isMobile ? 'flex-start' : 'center',
          justifyContent: 'center',
          padding: isMobile ? '8px' : '32px',
          zIndex: 15000,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch'
        }}
        onClick={onClose}
      >
        <div
          style={{
            background: '#fff',
            borderRadius: isMobile ? '12px' : '18px',
            width: isMobile ? '95%' : '96%',
            maxWidth: '1024px',
            maxHeight: isMobile ? '95vh' : '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 50px rgba(15, 23, 42, 0.25)',
            overflow: 'hidden',
            border: '1px solid #e2e8f0',
            padding: isMobile ? '16px' : '28px',
            margin: isMobile ? 'auto' : '0'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ textAlign: 'center', padding: isMobile ? '1.5rem' : '2rem' }}>
            <div className="drilldown-loading-spinner">
              <div className="spinner-ring" />
              <div className="spinner-ring" />
              <div className="spinner-ring" />
            </div>
            <p style={{ marginTop: '1rem', color: '#64748b', fontSize: isMobile ? '14px' : '16px' }}>Loading voucher details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.55)',
          backdropFilter: 'blur(2px)',
          display: 'flex',
          alignItems: isMobile ? 'flex-start' : 'center',
          justifyContent: 'center',
          padding: isMobile ? '8px' : '32px',
          zIndex: 15000,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch'
        }}
        onClick={onClose}
      >
        <div
          style={{
            background: '#fff',
            borderRadius: isMobile ? '12px' : '18px',
            width: isMobile ? '95%' : '96%',
            maxWidth: '1024px',
            maxHeight: isMobile ? '95vh' : '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 50px rgba(15, 23, 42, 0.25)',
            overflow: 'hidden',
            border: '1px solid #e2e8f0',
            padding: isMobile ? '16px' : '28px',
            margin: isMobile ? 'auto' : '0'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ textAlign: 'center', padding: isMobile ? '1.5rem' : '2rem' }}>
            <p style={{ color: '#dc2626', marginBottom: '1rem', fontSize: isMobile ? '14px' : '16px' }}>{error}</p>
            <button onClick={onClose} style={{ padding: isMobile ? '10px 16px' : '0.5rem 1rem', background: '#3182ce', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: isMobile ? '14px' : '16px', width: isMobile ? '100%' : 'auto' }}>
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!voucherData || !voucherData.VOUCHERS) {
    return null;
  }

  const voucher = voucherData.VOUCHERS;
  const ledgerEntries = normalizeToArray(voucher.ALLLEDGERENTRIES || voucher.LEDGERENTRIES || voucher.ledgerentries || []);
  
  // Find party ledger (first ledger entry where ispartyledger = Yes, or first entry)
  const partyLedger = ledgerEntries.find(entry => {
    const ispartyledger = (entry.ISPARTYLEDGER || entry.ispartyledger || '').toString().toLowerCase().trim();
    return ispartyledger === 'yes';
  }) || ledgerEntries[0] || {};
  
  // Check if there's any ledger entry with ispartyledger = yes
  const hasPartyLedger = ledgerEntries.some(entry => {
    const ispartyledger = (entry.ISPARTYLEDGER || entry.ispartyledger || '').toString().toLowerCase().trim();
    return ispartyledger === 'yes';
  });

  // Filter out ledger entries where ispartyledger is "yes" for display
  const filteredLedgerEntries = ledgerEntries.filter(entry => {
    const ispartyledger = (entry.ISPARTYLEDGER || entry.ispartyledger || '').toString().toLowerCase().trim();
    return ispartyledger !== 'yes';
  });
  
  // Get party ledger name from the ledger entry itself (don't fallback to voucher level here)
  const partyLedgerName = partyLedger.LEDGERNAME || partyLedger.ledgername || 'Unknown';
  
  // Get party ledger name from voucher level when ispartyledger is yes
  // Only show this if it's different from the ledger name
  const voucherPartyLedgerName = voucher.PARTYLEDGERNAME || voucher.partyledgername || voucher.PARTY || voucher.party || null;
  
  // Get inventory entries
  const inventoryEntries = normalizeToArray(voucher.ALLINVENTORYENTRIES || voucher.INVENTORYENTRIES || voucher.INVENTRY || voucher.allinventoryentries || []);
  
  // Calculate totals
  let totalQuantity = 0;
  let totalAmount = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalRoundoff = 0;
  let totalDebit = 0;
  let totalCredit = 0;
  
  inventoryEntries.forEach(item => {
    const qty = parseAmount(item.BILLEQTY || item.ACTUALQTY || item.QTY || item.billedqty || item.actualqty || 0);
    const amount = parseAmount(item.AMOUNT || item.VALUE || item.amount || 0);
    totalQuantity += qty;
    totalAmount += amount;
  });
  
  // Extract taxes and calculate ledger totals from ledger entries
  // Exclude party ledger entries from ledger total calculation
  ledgerEntries.forEach(entry => {
    const ledgerName = (entry.LEDGERNAME || entry.ledgername || '').toLowerCase();
    const ispartyledger = (entry.ISPARTYLEDGER || entry.ispartyledger || '').toString().toLowerCase().trim();
    const debitAmt = parseAmount(entry.DEBITAMT || entry.debitamt || entry.amount || 0);
    const creditAmt = parseAmount(entry.CREDITAMT || entry.creditamt || 0);
    
    // Only include non-party ledger entries in ledger totals
    if (ispartyledger !== 'yes') {
      totalDebit += debitAmt;
      totalCredit += creditAmt;
    }
    
    if (ledgerName.includes('cgst')) {
      totalCgst += Math.abs(debitAmt || creditAmt);
    } else if (ledgerName.includes('sgst')) {
      totalSgst += Math.abs(debitAmt || creditAmt);
    } else if (ledgerName.includes('round off') || ledgerName.includes('roundoff')) {
      totalRoundoff = debitAmt || creditAmt;
    }
  });
  
  // Calculate grand total (item total + taxes + round off)
  const grandTotal = totalAmount + totalCgst + totalSgst + totalRoundoff;

  // Ledger total should be sum of taxes and round off (non-item ledger entries)
  // This represents the additional charges on top of item total
  const ledgerTotal = totalCgst + totalSgst + totalRoundoff;
  
  // Transaction total is the grand total (item total + all charges)
  const transactionTotal = grandTotal;
  
  // Get bill allocations from party ledger
  const billAllocations = normalizeToArray(partyLedger.BILLALLOCATIONS || partyLedger.billalloc || []);
  
  // Format date to DD-MMM-YY format (e.g., 15-Apr-25)
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    
    let dateObj = null;
    
    // Try to parse various date formats
    if (typeof dateStr === 'string') {
      // Format: YYYYMMDD
      if (dateStr.length === 8 && /^\d+$/.test(dateStr)) {
        const year = dateStr.substring(0, 4);
        const month = dateStr.substring(4, 6);
        const day = dateStr.substring(6, 8);
        dateObj = new Date(`${year}-${month}-${day}`);
      }
      // Format: YYYY-MM-DD
      else if (dateStr.includes('-') && dateStr.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
        dateObj = new Date(dateStr);
      }
      // Format: D-Mon-YY or D-Mon-YYYY
      else if (dateStr.includes('-')) {
        const parts = dateStr.split('-');
        if (parts.length === 3) {
          const day = parts[0];
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          const monthIndex = monthNames.findIndex(m => m.toLowerCase() === parts[1].toLowerCase());
          if (monthIndex !== -1) {
            let year = parts[2];
            if (year.length === 2) {
              const yearNum = parseInt(year, 10);
              year = yearNum < 50 ? `20${year}` : `19${year}`;
            }
            dateObj = new Date(`${year}-${String(monthIndex + 1).padStart(2, '0')}-${day.padStart(2, '0')}`);
          }
        }
      }
    }
    
    // If we couldn't parse it, try Date constructor directly
    if (!dateObj || isNaN(dateObj.getTime())) {
      dateObj = new Date(dateStr);
    }
    
    // If still invalid, return original string
    if (isNaN(dateObj.getTime())) {
      return dateStr;
    }
    
    // Format to DD-MMM-YY
    const day = String(dateObj.getDate()).padStart(2, '0');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames[dateObj.getMonth()];
    const year = String(dateObj.getFullYear()).slice(-2);
    
    return `${day}-${month}-${year}`;
  };

  const voucherNumber = voucher.VOUCHERNUMBER || voucher.VCHNO || voucher.vouchernumber || '-';
  const voucherType = voucher.VOUCHERTYPE || voucher.VCHTYPE || voucher.vouchertypename || 'Sales';
  const voucherDate = formatDate(voucher.DATE || voucher.CP_DATE || voucher.date || voucher.cp_date);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(15, 23, 42, 0.55)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: isMobile ? 'flex-start' : 'center',
        justifyContent: 'center',
        padding: isMobile ? '8px' : '32px',
        zIndex: 15000,
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: isMobile ? '8px' : '10px',
          width: isMobile ? '95%' : '96%',
          maxWidth: '900px',
          maxHeight: isMobile ? '95vh' : '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(0, 0, 0, 0.05)',
          overflow: 'hidden',
          border: '1px solid #cbd5e1',
          margin: isMobile ? 'auto' : '0'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Tally-style Header Bar */}
        <div
          style={{
            background: 'linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%)',
            color: '#fff',
            padding: isMobile ? '14px 16px' : '18px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
            borderBottom: '2px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
          }}
        >
          <div>
            <div style={{ 
              fontSize: isMobile ? '17px' : '19px', 
              fontWeight: 700, 
              marginBottom: '6px',
              letterSpacing: '0.3px',
              textShadow: '0 1px 2px rgba(0, 0, 0, 0.2)'
            }}>
              Voucher Details
            </div>
            <div style={{ 
              fontSize: isMobile ? '13px' : '15px', 
              fontWeight: 500, 
              opacity: 0.95,
              marginBottom: '3px'
            }}>
              {voucherNumber} - {voucherType}
            </div>
            <div style={{ 
              fontSize: isMobile ? '11px' : '12px', 
              opacity: 0.85, 
              marginTop: '2px',
              fontStyle: 'italic'
            }}>
              Ledger: {partyLedgerName}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {headerActions}
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.15)',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                cursor: 'pointer',
                color: '#fff',
                width: 34,
                height: 34,
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
                fontSize: '22px',
                fontWeight: 'bold',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)';
              }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div style={{ 
          flex: 1, 
          overflow: 'auto', 
          padding: isMobile ? '16px' : '24px', 
          WebkitOverflowScrolling: 'touch', 
          background: '#f1f5f9'
        }}>
          {/* Voucher Identification Section */}
          <div
            style={{
              marginBottom: isMobile ? '20px' : '24px',
              background: '#fff',
              padding: isMobile ? '18px' : '22px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)'
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr',
                gap: isMobile ? '16px' : '24px',
                marginBottom: isMobile ? '16px' : '20px'
              }}
            >
              <div>
                <div style={{ 
                  fontSize: isMobile ? '11px' : '12px', 
                  color: '#475569', 
                  fontWeight: 600, 
                  marginBottom: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>Voucher Type</div>
                <div style={{ 
                  fontSize: isMobile ? '15px' : '17px', 
                  color: '#0f172a', 
                  fontWeight: 700,
                  fontFamily: 'system-ui, -apple-system, sans-serif'
                }}>
                  {voucherType}
                </div>
              </div>
              <div>
                <div style={{ 
                  fontSize: isMobile ? '11px' : '12px', 
                  color: '#475569', 
                  fontWeight: 600, 
                  marginBottom: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>Voucher No.</div>
                <div style={{ 
                  fontSize: isMobile ? '15px' : '17px', 
                  color: '#0f172a', 
                  fontWeight: 700,
                  fontFamily: 'system-ui, -apple-system, sans-serif'
                }}>
                  {voucherNumber}
                </div>
              </div>
              <div>
                <div style={{ 
                  fontSize: isMobile ? '11px' : '12px', 
                  color: '#475569', 
                  fontWeight: 600, 
                  marginBottom: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>Date</div>
                <div style={{ 
                  fontSize: isMobile ? '15px' : '17px', 
                  color: '#0f172a', 
                  fontWeight: 700,
                  fontFamily: 'system-ui, -apple-system, sans-serif'
                }}>
                  {voucherDate}
                </div>
              </div>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr',
                gap: isMobile ? '16px' : '24px',
                marginBottom: isMobile ? '16px' : '20px'
              }}
            >
              <div>
                <div style={{ 
                  fontSize: isMobile ? '11px' : '12px', 
                  color: '#475569', 
                  fontWeight: 600, 
                  marginBottom: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>Particulars</div>
                <div style={{ 
                  fontSize: isMobile ? '15px' : '17px', 
                  color: '#0f172a', 
                  fontWeight: 600,
                  fontFamily: 'system-ui, -apple-system, sans-serif'
                }}>
                  {partyLedgerName}
                </div>
              </div>
              {partyLedger && (partyLedger.ISPARTYLEDGER || partyLedger.ispartyledger || '').toString().toLowerCase().trim() === 'yes' && (voucher.ADDRESS || voucher.address || voucher.BASICBUYERADDRESS || voucher.basicbuyeraddress) && (
                <div style={{ gridColumn: isMobile ? 'auto' : '2 / 4' }}>
                  <div style={{ 
                    fontSize: isMobile ? '11px' : '12px', 
                    color: '#475569', 
                    fontWeight: 600, 
                    marginBottom: '8px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>Party Ledger Address</div>
                  <div style={{ 
                    fontSize: isMobile ? '14px' : '15px', 
                    color: '#0f172a', 
                    fontWeight: 500, 
                    whiteSpace: 'pre-wrap', 
                    wordBreak: 'break-word',
                    lineHeight: '1.6'
                  }}>
                    {voucher.ADDRESS || voucher.address || voucher.BASICBUYERADDRESS || voucher.basicbuyeraddress || '-'}
                  </div>
                </div>
              )}
            </div>
            {/* Narration */}
            {(voucher.NARRATION || voucher.narration) && (
              <div>
                <div style={{ 
                  fontSize: isMobile ? '11px' : '12px', 
                  color: '#475569', 
                  fontWeight: 600, 
                  marginBottom: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>Narration</div>
                <div style={{ 
                  fontSize: isMobile ? '14px' : '15px', 
                  color: '#0f172a', 
                  fontWeight: 500, 
                  whiteSpace: 'pre-wrap', 
                  wordBreak: 'break-word',
                  lineHeight: '1.6'
                }}>
                  {voucher.NARRATION || voucher.narration}
                </div>
              </div>
            )}
          </div>

          {/* Inventory Allocations Section */}
          {/* Show inventory allocations for all vouchers */}
          {inventoryEntries.length > 0 && (
            <div style={{ marginBottom: isMobile ? '20px' : '24px' }}>
                <div style={{ 
                fontSize: isMobile ? '14px' : '16px', 
                fontWeight: 600, 
                  color: '#1e293b',
                marginBottom: isMobile ? '12px' : '16px'
              }}>
                Inventory Allocations
              </div>
              <div style={{ 
                border: '1px solid #cbd5e1', 
                borderRadius: '4px', 
                overflow: 'hidden', 
                background: '#fff',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)'
              }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '2fr 0.8fr 0.8fr 1fr 0.8fr 1.2fr' : '3fr 0.8fr 0.8fr 1fr 0.8fr 1.2fr',
                    padding: isMobile ? '12px 14px' : '14px 18px',
                    background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
                    borderBottom: '2px solid #cbd5e1',
                    fontWeight: 700,
                    fontSize: isMobile ? '11px' : '12px',
                    color: '#0f172a',
                    gap: isMobile ? '8px' : '12px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}
                >
                  <div>Item Name</div>
                  <div style={{ textAlign: 'right' }}>Quantity</div>
                  <div style={{ textAlign: 'left' }}>UOM</div>
                  <div style={{ textAlign: 'right' }}>Rate</div>
                  <div style={{ textAlign: 'right' }}>Discount</div>
                  <div style={{ textAlign: 'right' }}>Amount</div>
                </div>
                {inventoryEntries.map((item, idx) => {
                  const itemName = item.STOCKITEMNAME || item.ITEMNAME || item.ITEM || item.stockitemname || item.itemname || '-';
                  const description = item.DESCRIPTION || item.description || '';
                  const quantity = parseAmount(item.BILLEQTY || item.ACTUALQTY || item.QTY || item.billedqty || item.actualqty || 0);
                  const rate = parseAmount(item.RATE || item.rate || 0);
                  const rateUom = item.RATEUOM || item.rateuom || item.rateUOM || '';
                  const uom = item.UOM || item.uom || item.UNIT || item.unit || '';
                  const discount = parseAmount(item.DISCOUNT || item.discount || 0);
                  const amount = parseAmount(item.AMOUNT || item.VALUE || item.amount || 0);
                  
                  // Format rate with UOM if available
                  const formattedRate = rateUom ? `${formatNumber(rate)}/${rateUom}` : formatNumber(rate);
                  
                  return (
                    <div
                      key={idx}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: isMobile ? '2fr 0.8fr 0.8fr 1fr 0.8fr 1.2fr' : '3fr 0.8fr 0.8fr 1fr 0.8fr 1.2fr',
                        padding: isMobile ? '12px 14px' : '14px 18px',
                        borderBottom: idx === inventoryEntries.length - 1 ? 'none' : '1px solid #e2e8f0',
                        fontSize: isMobile ? '13px' : '14px',
                        color: '#0f172a',
                        gap: isMobile ? '8px' : '12px',
                        alignItems: 'center',
                        background: idx % 2 === 0 ? '#fff' : '#fafbfc',
                        transition: 'background 0.15s ease'
                      }}
                      onMouseEnter={(e) => {
                        if (idx % 2 === 0) {
                          e.currentTarget.style.background = '#f8fafc';
                        } else {
                          e.currentTarget.style.background = '#f1f5f9';
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : '#fafbfc';
                      }}
                    >
                      <div>
                        <div style={{ 
                          fontWeight: 600, 
                          color: '#0f172a',
                          fontSize: isMobile ? '13px' : '14px'
                        }}>{itemName}</div>
                        <div style={{ 
                          fontStyle: 'italic', 
                          fontSize: isMobile ? '11px' : '12px', 
                          color: '#64748b',
                          marginTop: '4px',
                          fontWeight: 400
                        }}>
                          {description || '- Description not found'}
                        </div>
                      </div>
                      <div style={{ 
                        textAlign: 'right', 
                        fontWeight: 600,
                        color: '#0f172a',
                        fontFamily: 'system-ui, -apple-system, sans-serif'
                      }}>{formatNumber(quantity)}</div>
                      <div style={{ 
                        textAlign: 'left', 
                        fontWeight: 500, 
                        fontSize: isMobile ? '11px' : '12px', 
                        color: '#64748b' 
                      }}>{uom || '-'}</div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ 
                          fontWeight: 600,
                          color: '#0f172a',
                          fontFamily: 'system-ui, -apple-system, sans-serif'
                        }}>{formatNumber(rate)}</div>
                        {rateUom && (
                          <div style={{ 
                            fontSize: isMobile ? '10px' : '11px', 
                            color: '#64748b',
                            marginTop: '2px',
                            fontWeight: 400
                          }}>
                            /{rateUom}
                          </div>
                        )}
                      </div>
                      <div style={{ 
                        textAlign: 'right', 
                        fontWeight: 600,
                        color: '#0f172a',
                        fontFamily: 'system-ui, -apple-system, sans-serif'
                      }}>{formatNumber(discount)}</div>
                      <div style={{ 
                        textAlign: 'right', 
                        fontWeight: 700,
                        color: '#0f172a',
                        fontFamily: 'system-ui, -apple-system, sans-serif'
                      }}>{formatCurrencyAmount(amount)}</div>
                    </div>
                  );
                })}
                
                {/* Tax and Round Off Section */}
                <div style={{ 
                  borderTop: '2px solid #cbd5e1', 
                  background: '#fff'
                }}>
                  {totalCgst > 0 && (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: isMobile ? '2fr 0.8fr 0.8fr 1fr 0.8fr 1.2fr' : '3fr 0.8fr 0.8fr 1fr 0.8fr 1.2fr',
                        padding: isMobile ? '12px 14px' : '14px 18px',
                        borderTop: '1px solid #e2e8f0',
                        fontSize: isMobile ? '13px' : '14px',
                        color: '#0f172a',
                        gap: isMobile ? '8px' : '12px',
                        alignItems: 'center',
                        background: '#fafbfc'
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>CGST</div>
                      <div style={{ textAlign: 'right' }}></div>
                      <div style={{ textAlign: 'left' }}></div>
                      <div style={{ textAlign: 'right' }}></div>
                      <div style={{ textAlign: 'right' }}></div>
                      <div style={{ 
                        textAlign: 'right', 
                        fontWeight: 700,
                        color: '#0f172a',
                        fontFamily: 'system-ui, -apple-system, sans-serif'
                      }}>{formatCurrencyAmount(totalCgst)}</div>
                    </div>
                  )}
                  {totalSgst > 0 && (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: isMobile ? '2fr 0.8fr 0.8fr 1fr 0.8fr 1.2fr' : '3fr 0.8fr 0.8fr 1fr 0.8fr 1.2fr',
                        padding: isMobile ? '12px 14px' : '14px 18px',
                        borderTop: '1px solid #e2e8f0',
                        fontSize: isMobile ? '13px' : '14px',
                        color: '#0f172a',
                        gap: isMobile ? '8px' : '12px',
                        alignItems: 'center',
                        background: '#fff'
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>SGST</div>
                      <div style={{ textAlign: 'right' }}></div>
                      <div style={{ textAlign: 'left' }}></div>
                      <div style={{ textAlign: 'right' }}></div>
                      <div style={{ textAlign: 'right' }}></div>
                      <div style={{ 
                        textAlign: 'right', 
                        fontWeight: 700,
                        color: '#0f172a',
                        fontFamily: 'system-ui, -apple-system, sans-serif'
                      }}>{formatCurrencyAmount(totalSgst)}</div>
                    </div>
                  )}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: isMobile ? '2fr 0.8fr 0.8fr 1fr 0.8fr 1.2fr' : '3fr 0.8fr 0.8fr 1fr 0.8fr 1.2fr',
                      padding: isMobile ? '12px 14px' : '14px 18px',
                      borderTop: '1px solid #e2e8f0',
                      fontSize: isMobile ? '13px' : '14px',
                      color: '#0f172a',
                      gap: isMobile ? '8px' : '12px',
                      alignItems: 'center',
                      background: '#fafbfc'
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>ROUND OFF</div>
                    <div style={{ textAlign: 'right' }}></div>
                    <div style={{ textAlign: 'left' }}></div>
                    <div style={{ textAlign: 'right' }}></div>
                    <div style={{ textAlign: 'right' }}></div>
                    <div style={{ 
                      textAlign: 'right', 
                      fontWeight: 700,
                      color: '#0f172a',
                      fontFamily: 'system-ui, -apple-system, sans-serif'
                    }}>{formatCurrencyAmount(totalRoundoff)}</div>
                  </div>
                </div>
                
                {/* Ledger Entries (shown directly after inventory when ispartyledger is "no") */}
                {!hasPartyLedger && filteredLedgerEntries.length > 0 && (
                  <>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: isMobile ? '2fr 1fr 1fr' : '3fr 1fr 1fr',
                        padding: isMobile ? '12px 14px' : '14px 18px',
                        background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
                        borderTop: '2px solid #cbd5e1',
                        borderBottom: '1px solid #cbd5e1',
                        fontWeight: 700,
                        fontSize: isMobile ? '11px' : '12px',
                        color: '#0f172a',
                        gap: isMobile ? '8px' : '12px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}
                    >
                      <div>Ledger Name</div>
                      <div style={{ textAlign: 'right' }}>Debit Amount</div>
                      <div style={{ textAlign: 'right' }}>Credit Amount</div>
                    </div>
                    {filteredLedgerEntries.map((entry, idx) => {
                      const ledgerName = entry.LEDGERNAME || entry.ledgername || '-';
                      const debitAmt = parseAmount(entry.DEBITAMT || entry.debitamt || entry.amount || 0);
                      const creditAmt = parseAmount(entry.CREDITAMT || entry.creditamt || 0);
                      
                      return (
                        <div
                          key={idx}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: isMobile ? '2fr 1fr 1fr' : '3fr 1fr 1fr',
                            padding: isMobile ? '12px 14px' : '14px 18px',
                            borderBottom: idx === filteredLedgerEntries.length - 1 ? 'none' : '1px solid #e2e8f0',
                            fontSize: isMobile ? '13px' : '14px',
                            color: '#0f172a',
                            gap: isMobile ? '8px' : '12px',
                            alignItems: 'center',
                            background: idx % 2 === 0 ? '#fff' : '#fafbfc',
                            transition: 'background 0.15s ease'
                          }}
                          onMouseEnter={(e) => {
                            if (idx % 2 === 0) {
                              e.currentTarget.style.background = '#f8fafc';
                            } else {
                              e.currentTarget.style.background = '#f1f5f9';
                            }
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : '#fafbfc';
                          }}
                        >
                          <div style={{ fontWeight: 600 }}>{ledgerName}</div>
                          <div style={{ 
                            textAlign: 'right', 
                            fontWeight: 600,
                            fontFamily: 'system-ui, -apple-system, sans-serif'
                          }}>
                            {debitAmt > 0 ? formatCurrencyAmount(debitAmt) : ''}
                          </div>
                          <div style={{ 
                            textAlign: 'right', 
                            fontWeight: 600,
                            fontFamily: 'system-ui, -apple-system, sans-serif'
                          }}>
                            {creditAmt > 0 ? formatCurrencyAmount(creditAmt) : ''}
                          </div>
                        </div>
                      );
                    })}
                    
                    {/* Totals Section */}
                    <div style={{ 
                      borderTop: '2px solid #cbd5e1', 
                      background: '#fff'
                    }}>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: isMobile ? '2fr 1fr 1fr' : '3fr 1fr 1fr',
                          padding: isMobile ? '12px 14px' : '14px 18px',
                          borderTop: '1px solid #e2e8f0',
                          fontSize: isMobile ? '13px' : '14px',
                          color: '#0f172a',
                          gap: isMobile ? '8px' : '12px',
                          alignItems: 'center',
                          fontWeight: 700,
                          background: '#fafbfc'
                        }}
                      >
                        <div>Total</div>
                        <div style={{ 
                          textAlign: 'right',
                          fontFamily: 'system-ui, -apple-system, sans-serif'
                        }}>{formatCurrencyAmount(totalDebit)}</div>
                        <div style={{ 
                          textAlign: 'right',
                          fontFamily: 'system-ui, -apple-system, sans-serif'
                        }}>{formatCurrencyAmount(totalCredit)}</div>
                      </div>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: isMobile ? '2fr 1fr 1fr' : '3fr 1fr 1fr',
                          padding: isMobile ? '12px 14px' : '14px 18px',
                          borderTop: '2px solid #cbd5e1',
                          fontSize: isMobile ? '14px' : '15px',
                          color: '#0f172a',
                          gap: isMobile ? '8px' : '12px',
                          alignItems: 'center',
                          fontWeight: 800,
                          background: 'linear-gradient(180deg, #f1f5f9 0%, #e2e8f0 100%)',
                          borderBottom: '2px solid #cbd5e1'
                        }}
                      >
                        <div style={{ fontSize: isMobile ? '13px' : '14px' }}>Grand Total</div>
                        <div style={{ 
                          textAlign: 'right', 
                          gridColumn: '2 / 4',
                          fontFamily: 'system-ui, -apple-system, sans-serif',
                          color: '#1e40af'
                        }}>{formatCurrencyAmount(grandTotal)}</div>
                      </div>
                    </div>
                  </>
                )}
                </div>
              </div>
            )}

          {/* Bill Allocations for Party Ledger (shown when ispartyledger is "yes") */}
          {hasPartyLedger && billAllocations.length > 0 && (
            <div style={{ marginBottom: isMobile ? '20px' : '24px' }}>
              <div style={{ 
                fontSize: isMobile ? '15px' : '17px', 
                fontWeight: 700, 
                color: '#0f172a', 
                marginBottom: isMobile ? '14px' : '18px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                paddingBottom: '8px',
                borderBottom: '2px solid #cbd5e1'
              }}>
                <span className="material-icons" style={{ fontSize: isMobile ? '18px' : '20px' }}>receipt</span>
                Bill Allocations
              </div>
              <div style={{ 
                border: '1px solid #cbd5e1', 
                borderRadius: '4px', 
                overflow: 'hidden', 
                background: '#fff',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)'
              }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '2fr 1fr' : '3fr 1fr',
                    padding: isMobile ? '12px 14px' : '14px 18px',
                    background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
                    borderBottom: '2px solid #cbd5e1',
                    fontWeight: 700,
                    fontSize: isMobile ? '11px' : '12px',
                    color: '#0f172a',
                    gap: isMobile ? '8px' : '12px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}
                >
                  <div>Bill Name</div>
                  <div style={{ textAlign: 'right' }}>Amount</div>
                </div>
                {billAllocations.map((bill, billIdx) => {
                  const billName = bill.BILLNAME || bill.REFNO || bill.billname || bill.refno || voucherNumber;
                  const billAmount = parseAmount(bill.AMOUNT || bill.DEBITAMT || bill.CREDITAMT || bill.amount || 0);
                  return (
                    <div
                      key={billIdx}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: isMobile ? '2fr 1fr' : '3fr 1fr',
                        padding: isMobile ? '12px 14px' : '14px 18px',
                        borderBottom: billIdx === billAllocations.length - 1 ? 'none' : '1px solid #e2e8f0',
                        fontSize: isMobile ? '13px' : '14px',
                        color: '#0f172a',
                        gap: isMobile ? '8px' : '12px',
                        alignItems: 'center',
                        background: billIdx % 2 === 0 ? '#fff' : '#fafbfc',
                        transition: 'background 0.15s ease'
                      }}
                      onMouseEnter={(e) => {
                        if (billIdx % 2 === 0) {
                          e.currentTarget.style.background = '#f8fafc';
                        } else {
                          e.currentTarget.style.background = '#f1f5f9';
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = billIdx % 2 === 0 ? '#fff' : '#fafbfc';
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>{billName}</div>
                      <div style={{ 
                        textAlign: 'right', 
                        fontWeight: 600,
                        fontFamily: 'system-ui, -apple-system, sans-serif'
                      }}>
                        {billAmount > 0 ? formatCurrencyAmount(billAmount) : ''}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Totals Summary */}
          <div style={{ 
            marginTop: isMobile ? '16px' : '20px',
            padding: isMobile ? '16px' : '20px',
            border: '1px solid #cbd5e1',
            borderRadius: '4px',
            background: 'linear-gradient(180deg, #fff 0%, #f8fafc 100%)',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.08)'
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              fontWeight: 700,
              fontSize: isMobile ? '13px' : '14px',
              marginBottom: isMobile ? '12px' : '16px',
              color: '#0f172a',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              paddingBottom: '12px',
              borderBottom: '2px solid #cbd5e1'
            }}>
              <span>Transaction Totals</span>
            </div>
            <div style={{ 
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr',
              rowGap: isMobile ? '12px' : '14px',
              fontSize: isMobile ? '13px' : '14px',
              color: '#0f172a'
            }}>
              <div style={{ fontWeight: 600 }}>Item Total</div>
              <div style={{ 
                textAlign: 'right', 
                fontWeight: 700,
                fontFamily: 'system-ui, -apple-system, sans-serif'
              }}>{formatCurrencyAmount(totalAmount)}</div>
              <div style={{ fontWeight: 600 }}>Ledger Total</div>
              <div style={{ 
                textAlign: 'right', 
                fontWeight: 700,
                fontFamily: 'system-ui, -apple-system, sans-serif'
              }}>{formatCurrencyAmount(ledgerTotal)}</div>
              <div style={{ 
                fontWeight: 800,
                fontSize: isMobile ? '14px' : '15px',
                color: '#1e40af',
                paddingTop: '8px',
                borderTop: '2px solid #cbd5e1'
              }}>Transaction Total</div>
              <div style={{ 
                textAlign: 'right', 
                fontWeight: 800, 
                color: '#1e40af',
                fontSize: isMobile ? '14px' : '15px',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                paddingTop: '8px',
                borderTop: '2px solid #cbd5e1'
              }}>{formatCurrencyAmount(transactionTotal)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoucherDetailsModal;
