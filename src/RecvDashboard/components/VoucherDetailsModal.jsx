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
  const ledgerEntries = normalizeToArray(voucher.ALLLEDGERENTRIES);
  const ledgerName = ledgerEntries.length > 0 && ledgerEntries[0].LEDGERNAME 
    ? ledgerEntries[0].LEDGERNAME 
    : '';
  
  // Debug: Log narration data
  console.log('🔍 VoucherDetailsModal - Narration check:', {
    hasNARRATION: !!voucher.NARRATION,
    NARRATION: voucher.NARRATION,
    voucherKeys: Object.keys(voucher)
  });

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
          maxWidth: '1024px',
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
        {/* Header */}
        <div
          style={{
            padding: isMobile ? '16px' : '24px 28px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%)',
            flexWrap: isMobile ? 'wrap' : 'nowrap',
            gap: isMobile ? '8px' : '0'
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: isMobile ? 18 : 22, fontWeight: 700, color: '#1e293b', lineHeight: 1.3 }}>
              Voucher Details
              {(voucher.VOUCHERNUMBER || voucher.VCHNO) && (
                <span style={{ 
                  marginLeft: isMobile ? 8 : 12, 
                  fontSize: isMobile ? 12 : 14, 
                  fontWeight: 500, 
                  color: '#64748b',
                  display: isMobile ? 'block' : 'inline',
                  marginTop: isMobile ? 4 : 0
                }}>
                  {voucher.VOUCHERNUMBER || voucher.VCHNO} - {voucher.VOUCHERTYPE || voucher.VCHTYPE || '-'}
                </span>
              )}
            </h2>
            {ledgerName && (
              <div style={{ marginTop: isMobile ? 6 : 8, fontSize: isMobile ? 12 : 14, color: '#64748b', fontWeight: 500 }}>
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

        <div style={{ flex: 1, overflow: 'auto', padding: isMobile ? '16px' : '28px', WebkitOverflowScrolling: 'touch' }}>
          {/* Voucher Summary */}
          <div
            style={{
              background: '#f8fafc',
              borderRadius: isMobile ? '10px' : '14px',
              border: '1px solid #e2e8f0',
              padding: isMobile ? '14px' : '20px 24px',
              marginBottom: isMobile ? '16px' : '24px'
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(180px, 1fr))', gap: isMobile ? '12px' : '16px' }}>
              <div>
                <div style={{ fontSize: isMobile ? 11 : 12, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Voucher Type</div>
                <div style={{ fontSize: isMobile ? 16 : 18, fontWeight: 700, color: '#1e293b' }}>{voucher.VOUCHERTYPE || voucher.VCHTYPE || '-'}</div>
              </div>
              <div>
                <div style={{ fontSize: isMobile ? 11 : 12, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Voucher No.</div>
                <div style={{ fontSize: isMobile ? 16 : 18, fontWeight: 700, color: '#1e293b' }}>{voucher.VOUCHERNUMBER || voucher.VCHNO || '-'}</div>
              </div>
              <div>
                <div style={{ fontSize: isMobile ? 11 : 12, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Date</div>
                <div style={{ fontSize: isMobile ? 16 : 18, fontWeight: 700, color: '#1e293b' }}>{voucher.DATE || '-'}</div>
              </div>
            </div>
            {ledgerName && (
              <div style={{ marginTop: isMobile ? 12 : 16, paddingTop: isMobile ? 12 : 16, borderTop: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: isMobile ? 11 : 12, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Particulars</div>
                <div style={{ fontSize: isMobile ? 14 : 16, fontWeight: 600, color: '#1e293b' }}>{ledgerName}</div>
              </div>
            )}
            {voucher.NARRATION && (
              <div style={{ marginTop: isMobile ? 12 : 16, paddingTop: isMobile ? 12 : 16, borderTop: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: isMobile ? 11 : 12, fontWeight: 600, color: '#64748b', marginBottom: isMobile ? 6 : 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="material-icons" style={{ fontSize: isMobile ? 14 : 16, color: '#64748b' }}>description</span>
                  Narration
                </div>
                <div style={{ 
                  fontSize: isMobile ? 12 : 14, 
                  fontWeight: 500, 
                  color: '#1e293b',
                  padding: isMobile ? '10px 12px' : '12px 16px',
                  background: '#f8fafc',
                  borderRadius: isMobile ? '6px' : '8px',
                  border: '1px solid #e2e8f0',
                  lineHeight: '1.6',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}>
                  {voucher.NARRATION}
                </div>
              </div>
            )}
          </div>

          {/* Ledger Entries */}
          {ledgerEntries.length > 0 && (
            <div style={{ marginBottom: isMobile ? 20 : 28 }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 8, fontSize: isMobile ? 16 : 18, fontWeight: 700, color: '#1e293b', marginBottom: isMobile ? 14 : 18 }}>
                <span className="material-icons" style={{ fontSize: isMobile ? 18 : 20 }}>account_balance</span>
                Ledger Entries
              </h3>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: isMobile ? 10 : 12, overflow: 'hidden', background: '#fff', overflowX: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'minmax(120px, 2fr) minmax(80px, 1fr) minmax(80px, 1fr)' : '2fr 1fr 1fr', padding: isMobile ? '10px 12px' : '14px 18px', background: '#f8fafc', borderBottom: '2px solid #e2e8f0', fontWeight: 700, color: '#1e293b', fontSize: isMobile ? 11 : 14, minWidth: isMobile ? '400px' : 'auto' }}>
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
                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'minmax(120px, 2fr) minmax(80px, 1fr) minmax(80px, 1fr)' : '2fr 1fr 1fr', padding: isMobile ? '12px' : '16px 18px', alignItems: 'center', minWidth: isMobile ? '400px' : 'auto' }}>
                        <div style={{ fontSize: isMobile ? 13 : 15, fontWeight: 600, color: '#1e293b', wordBreak: 'break-word' }}>{entry.LEDGERNAME}</div>
                        <div style={{ textAlign: 'right', fontSize: isMobile ? 12 : 14, color: '#1e293b', fontWeight: 600 }}>
                          {displayDebit}
                        </div>
                        <div style={{ textAlign: 'right', fontSize: isMobile ? 12 : 14, color: '#1e293b', fontWeight: 600 }}>
                          {displayCredit}
                        </div>
                      </div>

                      {billAllocations.length > 0 && (
                        <div style={{ background: '#f8fafc', padding: isMobile ? '10px 16px' : '12px 34px', borderTop: '1px solid #e2e8f0' }}>
                          <div style={{ fontSize: isMobile ? 11 : 12, fontWeight: 600, color: '#64748b', marginBottom: isMobile ? 6 : 8 }}>Bill Allocations</div>
                          {billAllocations.map((bill, bIdx) => {
                            const { displayDebit, displayCredit } = getDisplayAmounts(bill.DEBITAMT, bill.CREDITAMT);
                            return (
                              <div key={bIdx} style={{ display: 'grid', gridTemplateColumns: isMobile ? 'minmax(100px, 2fr) minmax(70px, 1fr) minmax(70px, 1fr)' : '2fr 1fr 1fr', padding: isMobile ? '4px 0' : '6px 0', fontSize: isMobile ? 11 : 13, color: '#475569', gap: isMobile ? 8 : 0, minWidth: isMobile ? '300px' : 'auto' }}>
                                <div style={{ wordBreak: 'break-word' }}>{bill.BILLNAME || bill || '-'}</div>
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
                        <div style={{ background: '#f8fafc', padding: isMobile ? '10px 12px' : '12px 34px', borderTop: '1px solid #e2e8f0', overflowX: 'auto' }}>
                          <div style={{ fontSize: isMobile ? 11 : 12, fontWeight: 600, color: '#64748b', marginBottom: isMobile ? 6 : 8 }}>Inventory Allocations</div>
                          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'minmax(80px, 2fr) minmax(50px, 1fr) minmax(50px, 1fr) minmax(50px, 1fr) minmax(60px, 1fr)' : '2fr 1fr 1fr 1fr 1fr', gap: isMobile ? 8 : 12, padding: isMobile ? '4px 0' : '6px 0', fontSize: isMobile ? 10 : 12, fontWeight: 600, color: '#64748b', borderBottom: '1px solid #e2e8f0', marginBottom: isMobile ? 6 : 8, minWidth: isMobile ? '500px' : 'auto' }}>
                            <div>Item Name</div>
                            <div style={{ textAlign: 'right' }}>Qty</div>
                            <div style={{ textAlign: 'right' }}>Rate</div>
                            <div style={{ textAlign: 'right' }}>Disc</div>
                            <div style={{ textAlign: 'right' }}>Amount</div>
                          </div>
                          {inventoryAllocations.map((inv, invIndex) => (
                            <div key={invIndex} style={{ display: 'grid', gridTemplateColumns: isMobile ? 'minmax(80px, 2fr) minmax(50px, 1fr) minmax(50px, 1fr) minmax(50px, 1fr) minmax(60px, 1fr)' : '2fr 1fr 1fr 1fr 1fr', gap: isMobile ? 8 : 12, padding: isMobile ? '4px 0' : '6px 0', fontSize: isMobile ? 11 : 13, color: '#1e293b', minWidth: isMobile ? '500px' : 'auto' }}>
                              <div style={{ wordBreak: 'break-word' }}>{inv.STOCKITEMNAME || inv || '-'}</div>
                              <div style={{ textAlign: 'right' }}>{inv.BILLEQTY || inv.ACTUALQTY || '-'}</div>
                              <div style={{ textAlign: 'right' }}>{inv.RATE || '-'}</div>
                              <div style={{ textAlign: 'right' }}>{inv.DISCOUNT || '0'}</div>
                              <div style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrencyAmount(inv.AMOUNT || inv.VALUE || 0)}</div>
                            </div>
                          ))}
                          {/* Tax Summary Rows (CGST, SGST, ROUND OFF) */}
                          {(entry.CGST || entry.SGST || entry.ROUNDOFF !== undefined) && (
                            <>
                              <div style={{ borderTop: '1px solid #e2e8f0', marginTop: '8px', paddingTop: '8px' }}></div>
                              {entry.CGST && (
                                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'minmax(80px, 2fr) minmax(50px, 1fr) minmax(50px, 1fr) minmax(50px, 1fr) minmax(60px, 1fr)' : '2fr 1fr 1fr 1fr 1fr', gap: isMobile ? 8 : 12, padding: isMobile ? '4px 0' : '6px 0', fontSize: isMobile ? 11 : 13, color: '#1e293b', fontWeight: 600, minWidth: isMobile ? '500px' : 'auto' }}>
                                  <div>CGST</div>
                                  <div></div>
                                  <div></div>
                                  <div></div>
                                  <div style={{ textAlign: 'right' }}>{formatCurrencyAmount(entry.CGST)}</div>
                                </div>
                              )}
                              {entry.SGST && (
                                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'minmax(80px, 2fr) minmax(50px, 1fr) minmax(50px, 1fr) minmax(50px, 1fr) minmax(60px, 1fr)' : '2fr 1fr 1fr 1fr 1fr', gap: isMobile ? 8 : 12, padding: isMobile ? '4px 0' : '6px 0', fontSize: isMobile ? 11 : 13, color: '#1e293b', fontWeight: 600, minWidth: isMobile ? '500px' : 'auto' }}>
                                  <div>SGST</div>
                                  <div></div>
                                  <div></div>
                                  <div></div>
                                  <div style={{ textAlign: 'right' }}>{formatCurrencyAmount(entry.SGST)}</div>
                                </div>
                              )}
                              {entry.ROUNDOFF !== undefined && (
                                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'minmax(80px, 2fr) minmax(50px, 1fr) minmax(50px, 1fr) minmax(50px, 1fr) minmax(60px, 1fr)' : '2fr 1fr 1fr 1fr 1fr', gap: isMobile ? 8 : 12, padding: isMobile ? '4px 0' : '6px 0', fontSize: isMobile ? 11 : 13, color: '#1e293b', fontWeight: 600, minWidth: isMobile ? '500px' : 'auto' }}>
                                  <div>ROUND OFF</div>
                                  <div></div>
                                  <div></div>
                                  <div></div>
                                  <div style={{ textAlign: 'right' }}>{formatCurrencyAmount(entry.ROUNDOFF)}</div>
                                </div>
                              )}
                            </>
                          )}
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
