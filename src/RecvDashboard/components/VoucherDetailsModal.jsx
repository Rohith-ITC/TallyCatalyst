import React from 'react';
import { formatCurrency } from '../utils/helpers';
import { useIsMobile } from '../../TallyDashboard/MobileViewConfig';

const VoucherDetailsModal = ({ voucherData, loading, error, onClose }) => {
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
          borderRadius: isMobile ? '12px' : '18px',
          width: isMobile ? '95%' : '96%',
          maxWidth: '900px',
          maxHeight: isMobile ? '95vh' : '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 50px rgba(15, 23, 42, 0.25)',
          overflow: 'hidden',
          border: '1px solid #e2e8f0',
          margin: isMobile ? 'auto' : '0'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Blue Header Bar */}
        <div
          style={{
            background: '#2563eb',
            color: '#fff',
            padding: isMobile ? '12px 16px' : '16px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0
          }}
        >
          <div>
            <div style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: 600, marginBottom: '4px' }}>
              Voucher Details
            </div>
            <div style={{ fontSize: isMobile ? '14px' : '16px', fontWeight: 500, opacity: 0.95 }}>
              {voucherNumber} - {voucherType}
            </div>
            <div style={{ fontSize: isMobile ? '12px' : '13px', opacity: 0.9, marginTop: '2px' }}>
              Ledger: {partyLedgerName}
              </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#fff',
              width: 32,
              height: 32,
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s',
              fontSize: '20px',
              fontWeight: 'bold'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            ×
          </button>
        </div>

        {/* Main Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: isMobile ? '16px' : '24px', WebkitOverflowScrolling: 'touch', background: '#f8fafc' }}>
          {/* Voucher Identification Section */}
          <div
            style={{
              marginBottom: isMobile ? '20px' : '24px',
              background: '#fff',
              padding: isMobile ? '16px' : '20px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0'
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
                <div style={{ fontSize: isMobile ? '11px' : '12px', color: '#64748b', fontWeight: 500, marginBottom: '6px' }}>Voucher Type</div>
                <div style={{ fontSize: isMobile ? '14px' : '16px', color: '#1e293b', fontWeight: 600 }}>
                  {voucherType}
                </div>
              </div>
              <div>
                <div style={{ fontSize: isMobile ? '11px' : '12px', color: '#64748b', fontWeight: 500, marginBottom: '6px' }}>Voucher No.</div>
                <div style={{ fontSize: isMobile ? '14px' : '16px', color: '#1e293b', fontWeight: 600 }}>
                  {voucherNumber}
                </div>
              </div>
              <div>
                <div style={{ fontSize: isMobile ? '11px' : '12px', color: '#64748b', fontWeight: 500, marginBottom: '6px' }}>Date</div>
                <div style={{ fontSize: isMobile ? '14px' : '16px', color: '#1e293b', fontWeight: 600 }}>
                  {voucherDate}
                </div>
              </div>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                gap: isMobile ? '16px' : '24px',
                marginBottom: isMobile ? '16px' : '20px'
              }}
            >
              <div>
                <div style={{ fontSize: isMobile ? '11px' : '12px', color: '#64748b', fontWeight: 500, marginBottom: '6px' }}>Particulars</div>
                <div style={{ fontSize: isMobile ? '14px' : '16px', color: '#1e293b', fontWeight: 500 }}>
                  {partyLedgerName}
                </div>
              </div>
              {partyLedger && (partyLedger.ISPARTYLEDGER || partyLedger.ispartyledger || '').toString().toLowerCase().trim() === 'yes' && voucherPartyLedgerName && (
                <div>
                  <div style={{ fontSize: isMobile ? '11px' : '12px', color: '#64748b', fontWeight: 500, marginBottom: '6px' }}>Party Ledger Name</div>
                  <div style={{ fontSize: isMobile ? '14px' : '16px', color: '#1e293b', fontWeight: 500 }}>
                    {voucherPartyLedgerName}
                  </div>
                </div>
              )}
            </div>
            {/* Narration */}
            {(voucher.NARRATION || voucher.narration) && (
              <div>
                <div style={{ fontSize: isMobile ? '11px' : '12px', color: '#64748b', fontWeight: 500, marginBottom: '6px' }}>Narration</div>
                <div style={{ fontSize: isMobile ? '14px' : '16px', color: '#1e293b', fontWeight: 500, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
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
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', background: '#fff' }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '2fr 0.8fr 1fr 0.8fr 1.2fr' : '3fr 0.8fr 1fr 0.8fr 1.2fr',
                  padding: isMobile ? '10px 12px' : '12px 16px',
                  background: '#f8fafc',
                    borderBottom: '1px solid #e2e8f0',
                    fontWeight: 600,
                    fontSize: isMobile ? '11px' : '13px',
                    color: '#1e293b',
                    gap: isMobile ? '8px' : '12px'
                  }}
                >
                  <div>Item Name</div>
                  <div style={{ textAlign: 'right' }}>Quantity</div>
                  <div style={{ textAlign: 'right' }}>Rate</div>
                  <div style={{ textAlign: 'right' }}>Discount</div>
                  <div style={{ textAlign: 'right' }}>Amount</div>
                </div>
                {inventoryEntries.map((item, idx) => {
                  const itemName = item.STOCKITEMNAME || item.ITEMNAME || item.ITEM || item.stockitemname || item.itemname || '-';
                  const quantity = parseAmount(item.BILLEQTY || item.ACTUALQTY || item.QTY || item.billedqty || item.actualqty || 0);
                  const rate = parseAmount(item.RATE || item.rate || 0);
                  const discount = parseAmount(item.DISCOUNT || item.discount || 0);
                  const amount = parseAmount(item.AMOUNT || item.VALUE || item.amount || 0);
                  
                  return (
                    <div
                      key={idx}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: isMobile ? '2fr 0.8fr 1fr 0.8fr 1.2fr' : '3fr 0.8fr 1fr 0.8fr 1.2fr',
                        padding: isMobile ? '10px 12px' : '12px 16px',
                        borderBottom: idx === inventoryEntries.length - 1 ? 'none' : '1px solid #e2e8f0',
                        fontSize: isMobile ? '12px' : '14px',
                        color: '#1e293b',
                        gap: isMobile ? '8px' : '12px',
                        alignItems: 'center',
                        background: '#fff'
                      }}
                    >
                      <div style={{ fontWeight: 500 }}>{itemName}</div>
                      <div style={{ textAlign: 'right', fontWeight: 500 }}>{formatNumber(quantity)}</div>
                      <div style={{ textAlign: 'right', fontWeight: 500 }}>{formatNumber(rate)}</div>
                      <div style={{ textAlign: 'right', fontWeight: 500 }}>{formatNumber(discount)}</div>
                      <div style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrencyAmount(amount)}</div>
                    </div>
                  );
                })}
                
                {/* Tax and Round Off Section */}
                <div style={{ borderTop: '2px solid #e2e8f0', background: '#fff' }}>
                  {totalCgst > 0 && (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: isMobile ? '2fr 0.8fr 1fr 0.8fr 1.2fr' : '3fr 0.8fr 1fr 0.8fr 1.2fr',
                        padding: isMobile ? '10px 12px' : '12px 16px',
                        borderTop: '1px solid #e2e8f0',
                        fontSize: isMobile ? '12px' : '14px',
                        color: '#1e293b',
                        gap: isMobile ? '8px' : '12px',
                        alignItems: 'center'
                      }}
                    >
                      <div style={{ fontWeight: 500 }}>CGST</div>
                      <div style={{ textAlign: 'right' }}></div>
                      <div style={{ textAlign: 'right' }}></div>
                      <div style={{ textAlign: 'right' }}></div>
                      <div style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrencyAmount(totalCgst)}</div>
                    </div>
                  )}
                  {totalSgst > 0 && (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: isMobile ? '2fr 0.8fr 1fr 0.8fr 1.2fr' : '3fr 0.8fr 1fr 0.8fr 1.2fr',
                        padding: isMobile ? '10px 12px' : '12px 16px',
                        borderTop: '1px solid #e2e8f0',
                        fontSize: isMobile ? '12px' : '14px',
                        color: '#1e293b',
                        gap: isMobile ? '8px' : '12px',
                        alignItems: 'center'
                      }}
                    >
                      <div style={{ fontWeight: 500 }}>SGST</div>
                      <div style={{ textAlign: 'right' }}></div>
                      <div style={{ textAlign: 'right' }}></div>
                      <div style={{ textAlign: 'right' }}></div>
                      <div style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrencyAmount(totalSgst)}</div>
                    </div>
                  )}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: isMobile ? '2fr 0.8fr 1fr 0.8fr 1.2fr' : '3fr 0.8fr 1fr 0.8fr 1.2fr',
                      padding: isMobile ? '10px 12px' : '12px 16px',
                      borderTop: '1px solid #e2e8f0',
                      fontSize: isMobile ? '12px' : '14px',
                      color: '#1e293b',
                      gap: isMobile ? '8px' : '12px',
                      alignItems: 'center'
                    }}
                  >
                    <div style={{ fontWeight: 500 }}>ROUND OFF</div>
                    <div style={{ textAlign: 'right' }}></div>
                    <div style={{ textAlign: 'right' }}></div>
                    <div style={{ textAlign: 'right' }}></div>
                    <div style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrencyAmount(totalRoundoff)}</div>
                  </div>
                </div>
                
                {/* Ledger Entries (shown directly after inventory when ispartyledger is "no") */}
                {!hasPartyLedger && filteredLedgerEntries.length > 0 && (
                  <>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: isMobile ? '2fr 1fr 1fr' : '3fr 1fr 1fr',
                        padding: isMobile ? '10px 12px' : '12px 16px',
                        background: '#f8fafc',
                        borderTop: '2px solid #e2e8f0',
                        borderBottom: '1px solid #e2e8f0',
                        fontWeight: 600,
                        fontSize: isMobile ? '11px' : '13px',
                        color: '#1e293b',
                        gap: isMobile ? '8px' : '12px'
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
                            padding: isMobile ? '10px 12px' : '12px 16px',
                            borderBottom: idx === filteredLedgerEntries.length - 1 ? 'none' : '1px solid #e2e8f0',
                            fontSize: isMobile ? '12px' : '14px',
                            color: '#1e293b',
                            gap: isMobile ? '8px' : '12px',
                            alignItems: 'center',
                            background: '#fff'
                          }}
                        >
                          <div style={{ fontWeight: 500 }}>{ledgerName}</div>
                          <div style={{ textAlign: 'right', fontWeight: 500 }}>
                            {debitAmt > 0 ? formatCurrencyAmount(debitAmt) : ''}
                          </div>
                          <div style={{ textAlign: 'right', fontWeight: 500 }}>
                            {creditAmt > 0 ? formatCurrencyAmount(creditAmt) : ''}
                          </div>
                        </div>
                      );
                    })}
                    
                    {/* Totals Section */}
                    <div style={{ borderTop: '2px solid #e2e8f0', background: '#fff' }}>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: isMobile ? '2fr 1fr 1fr' : '3fr 1fr 1fr',
                          padding: isMobile ? '10px 12px' : '12px 16px',
                          borderTop: '1px solid #e2e8f0',
                          fontSize: isMobile ? '12px' : '14px',
                          color: '#1e293b',
                          gap: isMobile ? '8px' : '12px',
                          alignItems: 'center',
                          fontWeight: 600
                        }}
                      >
                        <div>Total</div>
                        <div style={{ textAlign: 'right' }}>{formatCurrencyAmount(totalDebit)}</div>
                        <div style={{ textAlign: 'right' }}>{formatCurrencyAmount(totalCredit)}</div>
                      </div>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: isMobile ? '2fr 1fr 1fr' : '3fr 1fr 1fr',
                          padding: isMobile ? '10px 12px' : '12px 16px',
                          borderTop: '1px solid #e2e8f0',
                          fontSize: isMobile ? '12px' : '14px',
                          color: '#1e293b',
                          gap: isMobile ? '8px' : '12px',
                          alignItems: 'center',
                          fontWeight: 600,
                          background: '#f8fafc'
                        }}
                      >
                        <div>Grand Total</div>
                        <div style={{ textAlign: 'right', gridColumn: '2 / 4' }}>{formatCurrencyAmount(grandTotal)}</div>
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
                fontSize: isMobile ? '14px' : '16px', 
                fontWeight: 600, 
                color: '#1e293b', 
                marginBottom: isMobile ? '12px' : '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span className="material-icons" style={{ fontSize: isMobile ? '18px' : '20px' }}>receipt</span>
                Bill Allocations
              </div>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', background: '#fff' }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '2fr 1fr' : '3fr 1fr',
                    padding: isMobile ? '10px 12px' : '12px 16px',
                    background: '#f8fafc',
                    borderBottom: '1px solid #e2e8f0',
                    fontWeight: 600,
                    fontSize: isMobile ? '11px' : '13px',
                    color: '#1e293b',
                    gap: isMobile ? '8px' : '12px'
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
                        padding: isMobile ? '10px 12px' : '12px 16px',
                        borderBottom: billIdx === billAllocations.length - 1 ? 'none' : '1px solid #e2e8f0',
                        fontSize: isMobile ? '12px' : '14px',
                        color: '#1e293b',
                        gap: isMobile ? '8px' : '12px',
                        alignItems: 'center',
                        background: '#fff'
                      }}
                    >
                      <div style={{ fontWeight: 500 }}>{billName}</div>
                      <div style={{ textAlign: 'right', fontWeight: 500 }}>
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
            padding: isMobile ? '12px' : '16px',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            background: '#f8fafc'
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              fontWeight: 600,
              fontSize: isMobile ? '13px' : '14px',
              marginBottom: isMobile ? '8px' : '12px',
              color: '#1e293b'
            }}>
              <span>Transaction Totals</span>
            </div>
            <div style={{ 
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr',
              rowGap: isMobile ? '8px' : '10px',
              fontSize: isMobile ? '12px' : '14px',
              color: '#111827'
            }}>
              <div style={{ fontWeight: 500 }}>Item Total</div>
              <div style={{ textAlign: 'right', fontWeight: 700 }}>{formatCurrencyAmount(totalAmount)}</div>
              <div style={{ fontWeight: 500 }}>Ledger Total</div>
              <div style={{ textAlign: 'right', fontWeight: 700 }}>{formatCurrencyAmount(ledgerTotal)}</div>
              <div style={{ fontWeight: 600 }}>Transaction Total</div>
              <div style={{ textAlign: 'right', fontWeight: 800, color: '#1d4ed8' }}>{formatCurrencyAmount(transactionTotal)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoucherDetailsModal;
