import React, { useState, useEffect } from 'react';
import {
  formatCurrency,
  formatCurrencyWithDrCr,
  normalizeBillIdentifier,
  candidateMatchesValue,
  formatDateRange,
} from '../utils/helpers';

const LedgerOutstandingsModal = ({
  data,
  loading,
  error,
  selectedLedger,
  company,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState('outstandings');
  const [voucherData, setVoucherData] = useState(null);
  const [voucherLoading, setVoucherLoading] = useState(false);
  const [voucherError, setVoucherError] = useState(null);

  useEffect(() => {
    const initial = selectedLedger?.initialTab || 'outstandings';
    setActiveTab(initial);
    setVoucherData(null);
    setVoucherError(null);
    setVoucherLoading(false);
  }, [
    selectedLedger?.ledgerName,
    selectedLedger?.fromDate,
    selectedLedger?.toDate,
    selectedLedger?.initialTab,
  ]);

  useEffect(() => {
    const loadVouchers = async () => {
      if (activeTab !== 'vouchers') return;
      if (voucherData || voucherLoading) return;
      if (!selectedLedger?.onLoadLedgerVouchers) return;
      setVoucherLoading(true);
      setVoucherError(null);
      try {
        const response = await selectedLedger.onLoadLedgerVouchers();
        setVoucherData(response);
      } catch (err) {
        setVoucherError(err.message || 'Failed to load ledger vouchers.');
      } finally {
        setVoucherLoading(false);
      }
    };
    loadVouchers();
  }, [activeTab, voucherData, voucherLoading, selectedLedger]);

  if (loading) {
    return (
      <div className="drilldown-modal-overlay" onClick={onClose}>
        <div className="drilldown-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '95%', width: '1400px' }}>
          <div className="drilldown-modal-header">
            <h2>Loading Ledger Outstandings...</h2>
            <button className="drilldown-close-btn" onClick={onClose}>
              ×
            </button>
          </div>
          <div className="drilldown-modal-body">
            <div className="drilldown-loading-container">
              <div className="drilldown-loading-spinner">
                <div className="spinner-ring" />
                <div className="spinner-ring" />
                <div className="spinner-ring" />
              </div>
              <p className="drilldown-loading-text">Loading ledger outstandings...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="drilldown-modal-overlay" onClick={onClose}>
        <div className="drilldown-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '95%', width: '1400px' }}>
          <div className="drilldown-modal-header">
            <h2>Error Loading Ledger Outstandings</h2>
            <button className="drilldown-close-btn" onClick={onClose}>
              ×
            </button>
          </div>
          <div className="drilldown-modal-body">
            <div className="error-container">
              <p>{error}</p>
              <button onClick={onClose} className="retry-button">
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!data || !data.data || data.data.length === 0) {
    return (
      <div className="drilldown-modal-overlay" onClick={onClose}>
        <div className="drilldown-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '95%', width: '1400px' }}>
          <div className="drilldown-modal-header">
            <h2>Ledger Voucher Outstanding</h2>
            <button className="drilldown-close-btn" onClick={onClose}>
              ×
            </button>
          </div>
          <div className="drilldown-modal-body">
            <div className="empty-state">
              <p>No outstanding bills found</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const totalOpeningDebit = data.data.reduce((sum, bill) => sum + (bill.DEBITOPENBAL || 0), 0);
  const totalOpeningCredit = data.data.reduce((sum, bill) => sum + (bill.CREDITOPENBAL || 0), 0);
  const totalPendingDebit = data.data.reduce((sum, bill) => sum + (bill.DEBITCLSBAL || 0), 0);
  const totalPendingCredit = data.data.reduce((sum, bill) => sum + (bill.CREDITCLSBAL || 0), 0);

  const rawSelectedIdentifiers = Array.isArray(selectedLedger?.billIdentifiers)
    ? selectedLedger.billIdentifiers
    : selectedLedger?.billIdentifier
    ? [selectedLedger.billIdentifier]
    : [];

  const selectedBillIdentifiers = rawSelectedIdentifiers
    .map((identifier) => normalizeBillIdentifier(identifier))
    .filter(Boolean);

  const voucherOpeningDebit = voucherData?.opening?.DEBITAMT || 0;
  const voucherOpeningCredit = voucherData?.opening?.CREDITAMT || 0;
  const voucherClosingDebit = voucherData?.closing?.DEBITAMT || 0;
  const voucherClosingCredit = voucherData?.closing?.CREDITAMT || 0;
  const voucherCurrentDebit =
    voucherData?.data?.reduce((sum, voucher) => sum + (voucher.DEBITAMT || 0), 0) || 0;
  const voucherCurrentCredit =
    voucherData?.data?.reduce((sum, voucher) => sum + (voucher.CREDITAMT || 0), 0) || 0;

  return (
    <div className="drilldown-modal-overlay" onClick={onClose}>
      <div className="drilldown-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '95%', width: '1400px', maxHeight: '95vh' }}>
        <div className="drilldown-modal-header" style={{ backgroundColor: '#2563eb', color: 'white', padding: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 'bold' }}>Ledger Voucher Outstanding</h2>
              {selectedLedger && (
                <div style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
                  <div>
                    <strong>Ledger:</strong> {selectedLedger.ledgerName}
                  </div>
                  <div style={{ marginTop: '0.25rem' }}>
                    <strong>Details of:</strong> Pending Bills
                  </div>
                  {selectedLedger.fromDate && selectedLedger.toDate && (
                    <div style={{ marginTop: '0.25rem' }}>
                      {formatDateRange(selectedLedger.fromDate, selectedLedger.toDate)}
                    </div>
                  )}
                </div>
              )}
            </div>
            <button className="drilldown-close-btn" onClick={onClose} style={{ color: 'white', fontSize: '1.5rem' }}>
              ×
            </button>
          </div>
          {company && (
            <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', opacity: 0.9 }}>
              {company.company}
            </div>
          )}
        </div>
        <div className="drilldown-modal-body" style={{ padding: '1rem', overflow: 'auto', maxHeight: 'calc(95vh - 150px)' }}>
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
            <button
              type="button"
              onClick={() => setActiveTab('outstandings')}
              style={{
                padding: '0.5rem 1.25rem',
                borderRadius: '999px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
                backgroundColor: activeTab === 'outstandings' ? '#2563eb' : '#e2e8f0',
                color: activeTab === 'outstandings' ? '#ffffff' : '#1a202c',
                boxShadow: activeTab === 'outstandings' ? '0 4px 12px rgba(37, 99, 235, 0.35)' : 'none',
                transition: 'background-color 0.2s ease, color 0.2s ease',
              }}
            >
              Pending Bills
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('vouchers')}
              style={{
                padding: '0.5rem 1.25rem',
                borderRadius: '999px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
                backgroundColor: activeTab === 'vouchers' ? '#2563eb' : '#e2e8f0',
                color: activeTab === 'vouchers' ? '#ffffff' : '#1a202c',
                boxShadow: activeTab === 'vouchers' ? '0 4px 12px rgba(37, 99, 235, 0.35)' : 'none',
                transition: 'background-color 0.2s ease, color 0.2s ease',
              }}
            >
              Ledger Vouchers
            </button>
          </div>

          {activeTab === 'outstandings' ? (
            <div className="drilldown-table-container">
              <table className="drilldown-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f7fafc', borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 'bold', borderRight: '1px solid #e2e8f0' }}>Date</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 'bold', borderRight: '1px solid #e2e8f0' }}>Ref. No.</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 'bold', borderRight: '1px solid #e2e8f0' }}>Opening Amount</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 'bold', borderRight: '1px solid #e2e8f0' }}>Pending Amount</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 'bold', borderRight: '1px solid #e2e8f0' }}>Due on</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 'bold' }}>Overdue by days</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((bill, billIndex) => {
                    const openingAmount = formatCurrencyWithDrCr(bill.DEBITOPENBAL || 0, bill.CREDITOPENBAL || 0);
                    const pendingAmount = formatCurrencyWithDrCr(bill.DEBITCLSBAL || 0, bill.CREDITCLSBAL || 0);
                    const billRefNormalized = normalizeBillIdentifier(bill.REFNO || '');
                    const billNameNormalized = normalizeBillIdentifier(bill.BILLNAME || bill.BILL || bill.BILLNO || '');
                    const isSelectedBill =
                      candidateMatchesValue(selectedBillIdentifiers, billRefNormalized) ||
                      candidateMatchesValue(selectedBillIdentifiers, billNameNormalized);
                    const mainRowStyle = {
                      backgroundColor: isSelectedBill ? '#bfdbfe' : '#fffacd',
                      borderBottom: '1px solid #e2e8f0',
                      fontWeight: isSelectedBill ? '600' : 'normal',
                      boxShadow: isSelectedBill ? 'inset 4px 0 0 0 #2563eb' : 'none',
                    };

                    return (
                      <React.Fragment key={bill.REFNO || billIndex}>
                        <tr style={mainRowStyle}>
                          <td style={{ padding: '0.75rem', borderRight: '1px solid #e2e8f0' }}>{bill.DATE || ''}</td>
                          <td style={{ padding: '0.75rem', borderRight: '1px solid #e2e8f0' }}>{bill.REFNO || ''}</td>
                          <td style={{ padding: '0.75rem', textAlign: 'right', borderRight: '1px solid #e2e8f0' }}>{openingAmount}</td>
                          <td style={{ padding: '0.75rem', textAlign: 'right', borderRight: '1px solid #e2e8f0' }}>{pendingAmount}</td>
                          <td style={{ padding: '0.75rem', borderRight: '1px solid #e2e8f0' }}>{bill.DUEON || ''}</td>
                          <td style={{ padding: '0.75rem', textAlign: 'right' }}>{bill.OVERDUEDAYS ?? ''}</td>
                        </tr>
                        {bill.VOUCHERS &&
                          bill.VOUCHERS.map((voucher, voucherIndex) => {
                            const voucherOpeningAmount = formatCurrencyWithDrCr(
                              voucher.DEBITAMT || 0,
                              voucher.CREDITAMT || 0
                            );
                            const voucherRefNo = voucher.VOUCHERTYPE
                              ? voucher.VOUCHERNUMBER
                                ? `${voucher.VOUCHERTYPE} / ${voucher.VOUCHERNUMBER}`
                                : voucher.VOUCHERTYPE
                              : voucher.VOUCHERNUMBER || '';
                            const voucherNumberNormalized = normalizeBillIdentifier(
                              voucher.VOUCHERNUMBER || voucher.BILLNAME || voucher.BILL || ''
                            );
                            const voucherMatchesBill = candidateMatchesValue(
                              selectedBillIdentifiers,
                              voucherNumberNormalized
                            );
                            const voucherRowStyle = {
                              backgroundColor: voucherMatchesBill || isSelectedBill ? '#dbeafe' : '#ffffff',
                              borderBottom: '1px solid #e2e8f0',
                              fontWeight: voucherMatchesBill ? '600' : 'normal',
                            };

                            return (
                              <tr key={`${bill.REFNO}-${voucherIndex}`} style={voucherRowStyle}>
                                <td style={{ padding: '0.75rem', paddingLeft: '2rem', borderRight: '1px solid #e2e8f0' }}>
                                  {voucher.DATE || bill.DATE || ''}
                                </td>
                                <td style={{ padding: '0.75rem', borderRight: '1px solid #e2e8f0' }} colSpan="1">
                                  {voucherRefNo}
                                </td>
                                <td style={{ padding: '0.75rem', textAlign: 'right', borderRight: '1px solid #e2e8f0' }}>
                                  {voucherOpeningAmount}
                                </td>
                                <td style={{ padding: '0.75rem', textAlign: 'right', borderRight: '1px solid #e2e8f0' }} />
                                <td style={{ padding: '0.75rem', borderRight: '1px solid #e2e8f0' }} />
                                <td style={{ padding: '0.75rem', textAlign: 'right' }} />
                              </tr>
                            );
                          })}
                      </React.Fragment>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ backgroundColor: '#f7fafc', borderTop: '2px solid #e2e8f0' }}>
                    <td colSpan="2" style={{ padding: '0.75rem', fontWeight: 'bold', borderRight: '1px solid #e2e8f0' }}>
                      Total
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 'bold', borderRight: '1px solid #e2e8f0' }}>
                      {formatCurrencyWithDrCr(totalOpeningDebit, totalOpeningCredit)}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 'bold', borderRight: '1px solid #e2e8f0' }}>
                      {formatCurrencyWithDrCr(totalPendingDebit, totalPendingCredit)}
                    </td>
                    <td colSpan="2" style={{ padding: '0.75rem', borderRight: '1px solid #e2e8f0' }} />
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : voucherLoading ? (
            <div className="drilldown-loading-container">
              <div className="drilldown-loading-spinner">
                <div className="spinner-ring" />
                <div className="spinner-ring" />
                <div className="spinner-ring" />
              </div>
              <p className="drilldown-loading-text">Loading ledger vouchers...</p>
            </div>
          ) : voucherError ? (
            <div className="error-container">
              <p>{voucherError}</p>
              <button
                onClick={() => {
                  setVoucherData(null);
                  setVoucherError(null);
                  setVoucherLoading(false);
                }}
                className="retry-button"
              >
                Retry
              </button>
            </div>
          ) : voucherData && voucherData.data && voucherData.data.length > 0 ? (
            <div className="drilldown-table-container">
              <table className="drilldown-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f7fafc', borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 'bold', borderRight: '1px solid #e2e8f0' }}>
                      Date
                    </th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 'bold', borderRight: '1px solid #e2e8f0' }}>
                      Particulars
                    </th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 'bold', borderRight: '1px solid #e2e8f0' }}>
                      Vch Type
                    </th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 'bold', borderRight: '1px solid #e2e8f0' }}>
                      Vch No.
                    </th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 'bold', borderRight: '1px solid #e2e8f0' }}>
                      Debit
                    </th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 'bold' }}>Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {voucherData.data.map((voucher, index) => {
                    const voucherRefCandidates = [
                      voucher.VCHNO,
                      voucher.VOUCHERNUMBER,
                      voucher.PARTICULARS,
                      voucher?.BILLALLOCATIONS?.BILLNAME,
                    ];
                    const isHighlighted = voucherRefCandidates.some((candidate) =>
                      candidateMatchesValue(selectedBillIdentifiers, candidate)
                    );
                    const rowStyle = {
                      backgroundColor: isHighlighted ? '#bfdbfe' : '#ffffff',
                      borderBottom: '1px solid #e2e8f0',
                      fontWeight: isHighlighted ? '600' : 'normal',
                    };
                    return (
                      <tr key={voucher.MASTERID || index} style={rowStyle}>
                        <td style={{ padding: '0.75rem', borderRight: '1px solid #e2e8f0' }}>{voucher.DATE || ''}</td>
                        <td style={{ padding: '0.75rem', borderRight: '1px solid #e2e8f0' }}>{voucher.PARTICULARS || ''}</td>
                        <td style={{ padding: '0.75rem', borderRight: '1px solid #e2e8f0' }}>{voucher.VCHTYPE || ''}</td>
                        <td style={{ padding: '0.75rem', borderRight: '1px solid #e2e8f0' }}>{voucher.VCHNO || ''}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right', borderRight: '1px solid #e2e8f0' }}>
                          {voucher.DEBITAMT && voucher.DEBITAMT !== 0 ? formatCurrency(voucher.DEBITAMT) : ''}
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                          {voucher.CREDITAMT && voucher.CREDITAMT !== 0 ? formatCurrency(voucher.CREDITAMT) : ''}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ backgroundColor: '#f7fafc', borderTop: '2px solid #e2e8f0' }}>
                    <td colSpan="4" style={{ padding: '0.75rem', fontWeight: 'bold', borderRight: '1px solid #e2e8f0' }}>
                      Opening Balance
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 'bold', borderRight: '1px solid #e2e8f0' }}>
                      {voucherOpeningDebit > 0 ? formatCurrency(voucherOpeningDebit) : ''}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 'bold' }}>
                      {voucherOpeningCredit > 0 ? formatCurrency(voucherOpeningCredit) : ''}
                    </td>
                  </tr>
                  <tr style={{ backgroundColor: '#f7fafc' }}>
                    <td colSpan="4" style={{ padding: '0.75rem', fontWeight: 'bold', borderRight: '1px solid #e2e8f0' }}>
                      Current Total
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 'bold', borderRight: '1px solid #e2e8f0' }}>
                      {voucherCurrentDebit > 0 ? formatCurrency(voucherCurrentDebit) : ''}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 'bold' }}>
                      {voucherCurrentCredit > 0 ? formatCurrency(voucherCurrentCredit) : ''}
                    </td>
                  </tr>
                  <tr style={{ backgroundColor: '#f7fafc', borderTop: '2px solid #e2e8f0' }}>
                    <td colSpan="4" style={{ padding: '0.75rem', fontWeight: 'bold', borderRight: '1px solid #e2e8f0' }}>
                      Closing Balance
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 'bold', borderRight: '1px solid #e2e8f0' }}>
                      {voucherClosingDebit > 0 ? formatCurrency(voucherClosingDebit) : ''}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 'bold' }}>
                      {voucherClosingCredit > 0 ? formatCurrency(voucherClosingCredit) : ''}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <p>No ledger vouchers found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LedgerOutstandingsModal;

