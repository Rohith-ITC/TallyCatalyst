import React from 'react';
import { formatCurrency } from '../utils/helpers';

const VoucherDetailsModal = ({ voucherData, loading, error, onClose }) => {
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

  const normalizeToArray = (value) => {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  };

  // Helper function to handle negative amounts - move to opposite side but keep negative sign
  const getDisplayAmounts = (debitAmt, creditAmt) => {
    const debitValue = parseAmount(debitAmt);
    const creditValue = parseAmount(creditAmt);
    
    let displayDebit = '';
    let displayCredit = '';
    
    // Handle debit amount
    if (debitValue < 0) {
      // Negative debit goes to credit side (keep negative)
      displayCredit = formatCurrencyAmount(debitValue);
    } else if (debitValue > 0) {
      // Positive debit stays on debit side
      displayDebit = formatCurrencyAmount(debitValue);
    }
    
    // Handle credit amount
    if (creditValue < 0) {
      // Negative credit goes to debit side (keep negative)
      displayDebit = formatCurrencyAmount(creditValue);
    } else if (creditValue > 0) {
      // Positive credit stays on credit side
      displayCredit = formatCurrencyAmount(creditValue);
    }
    
    return { displayDebit, displayCredit };
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
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px',
          zIndex: 10000
        }}
        onClick={onClose}
      >
        <div
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
            border: '1px solid #e2e8f0',
            padding: '28px'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <div className="drilldown-loading-spinner">
              <div className="spinner-ring" />
              <div className="spinner-ring" />
              <div className="spinner-ring" />
            </div>
            <p style={{ marginTop: '1rem', color: '#64748b' }}>Loading voucher details...</p>
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
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px',
          zIndex: 10000
        }}
        onClick={onClose}
      >
        <div
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
            border: '1px solid #e2e8f0',
            padding: '28px'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <p style={{ color: '#dc2626', marginBottom: '1rem' }}>{error}</p>
            <button onClick={onClose} style={{ padding: '0.5rem 1rem', background: '#3182ce', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}>
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
  const ledgerEntries = normalizeToArray(voucher.ALLLEDGERENTRIES);
  const ledgerName = ledgerEntries.length > 0 && ledgerEntries[0].LEDGERNAME 
    ? ledgerEntries[0].LEDGERNAME 
    : '';

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
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px',
        zIndex: 10000
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
              {(voucher.VOUCHERNUMBER || voucher.VCHNO) && (
                <span style={{ marginLeft: 12, fontSize: 14, fontWeight: 500, color: '#64748b' }}>
                  {voucher.VOUCHERNUMBER || voucher.VCHNO} - {voucher.VOUCHERTYPE || voucher.VCHTYPE || '-'}
                </span>
              )}
            </h2>
            {ledgerName && (
              <div style={{ marginTop: 8, fontSize: 14, color: '#64748b', fontWeight: 500 }}>
                Ledger: {ledgerName}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
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

        <div style={{ flex: 1, overflow: 'auto', padding: '28px' }}>
          {/* Voucher Summary */}
          <div
            style={{
              background: '#f8fafc',
              borderRadius: '14px',
              border: '1px solid #e2e8f0',
              padding: '20px 24px',
              marginBottom: '24px'
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Voucher Type</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#1e293b' }}>{voucher.VOUCHERTYPE || voucher.VCHTYPE || '-'}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Voucher No.</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#1e293b' }}>{voucher.VOUCHERNUMBER || voucher.VCHNO || '-'}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Date</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#1e293b' }}>{voucher.DATE || '-'}</div>
              </div>
            </div>
            {ledgerName && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Particulars</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#1e293b' }}>{ledgerName}</div>
              </div>
            )}
          </div>

          {/* Ledger Entries */}
          {ledgerEntries.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 18, fontWeight: 700, color: '#1e293b', marginBottom: 18 }}>
                <span className="material-icons" style={{ fontSize: 20 }}>account_balance</span>
                Ledger Entries
              </h3>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', padding: '14px 18px', background: '#f8fafc', borderBottom: '2px solid #e2e8f0', fontWeight: 700, color: '#1e293b' }}>
                  <div>Ledger Name</div>
                  <div style={{ textAlign: 'right' }}>Debit Amount</div>
                  <div style={{ textAlign: 'right' }}>Credit Amount</div>
                </div>
                {ledgerEntries.map((entry, idx) => {
                  const billAllocations = normalizeToArray(entry.BILLALLOCATIONS);
                  const inventoryAllocations = normalizeToArray(entry.INVENTORYALLOCATIONS);
                  const { displayDebit, displayCredit } = getDisplayAmounts(entry.DEBITAMT, entry.CREDITAMT);
                  return (
                    <div key={idx} style={{ borderBottom: idx === ledgerEntries.length - 1 ? 'none' : '1px solid #e2e8f0' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', padding: '16px 18px', alignItems: 'center' }}>
                        <div style={{ fontSize: 15, fontWeight: 600, color: '#1e293b' }}>{entry.LEDGERNAME}</div>
                        <div style={{ textAlign: 'right', fontSize: 14, color: '#1e293b', fontWeight: 600 }}>
                          {displayDebit}
                        </div>
                        <div style={{ textAlign: 'right', fontSize: 14, color: '#1e293b', fontWeight: 600 }}>
                          {displayCredit}
                        </div>
                      </div>

                      {billAllocations.length > 0 && (
                        <div style={{ background: '#f8fafc', padding: '12px 34px', borderTop: '1px solid #e2e8f0' }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 8 }}>Bill Allocations</div>
                          {billAllocations.map((bill, bIdx) => {
                            const { displayDebit, displayCredit } = getDisplayAmounts(bill.DEBITAMT, bill.CREDITAMT);
                            return (
                              <div key={bIdx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', padding: '6px 0', fontSize: 13, color: '#475569' }}>
                                <div>{bill.BILLNAME || bill || '-'}</div>
                                <div style={{ textAlign: 'right' }}>
                                  {displayDebit}
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                  {displayCredit}
                                </div>
                              </div>
                            );
                          })}
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
                              <div>{inv.STOCKITEMNAME || inv || '-'}</div>
                              <div style={{ textAlign: 'right' }}>{inv.BILLEQTY || inv.ACTUALQTY || '-'}</div>
                              <div style={{ textAlign: 'right' }}>{inv.RATE || '-'}</div>
                              <div style={{ textAlign: 'right' }}>{inv.DISCOUNT || '0'}</div>
                              <div style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrencyAmount(inv.AMOUNT || inv.VALUE || 0)}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VoucherDetailsModal;
