import React, { useState, useEffect } from 'react';
import { apiPost } from '../utils/apiUtils';
import { formatDateFromYYYYMMDD } from '../RecvDashboard/utils/helpers';
import VoucherDetailsModal from '../RecvDashboard/components/VoucherDetailsModal';

function PaymentVoucherReport() {
  // Get company info from sessionStorage
  const getCompanyInfo = () => {
    const tallyloc_id = sessionStorage.getItem('tallyloc_id');
    const company = sessionStorage.getItem('company');
    const guid = sessionStorage.getItem('guid');
    return { tallyloc_id, company, guid };
  };

  // Default dates
  function getFirstOfMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  }
  function getToday() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  // Payment vouchers list states
  const [vouchers, setVouchers] = useState([]);
  const [loadingVouchers, setLoadingVouchers] = useState(false);
  const [vouchersError, setVouchersError] = useState('');
  const [totalVouchers, setTotalVouchers] = useState(0);

  // Voucher details modal state
  const [showVoucherDetails, setShowVoucherDetails] = useState(false);
  const [voucherDetailsData, setVoucherDetailsData] = useState(null);
  const [voucherDetailsLoading, setVoucherDetailsLoading] = useState(false);
  const [voucherDetailsError, setVoucherDetailsError] = useState(null);
  
  // Date range for vouchers list
  const [fromDate, setFromDate] = useState(getFirstOfMonth());
  const [toDate, setToDate] = useState(getToday());
  const [fromDateFocused, setFromDateFocused] = useState(false);
  const [toDateFocused, setToDateFocused] = useState(false);

  // Convert date from YYYY-MM-DD to YYYYMMDD format for API
  const formatDateToYYYYMMDD = (dateStr) => {
    if (!dateStr) return '';
    // Remove dashes if present
    return dateStr.replace(/-/g, '');
  };

  // Format date for display (YYYYMMDD to DD-MMM-YY)
  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return '-';
    return formatDateFromYYYYMMDD(dateStr);
  };

  // Fetch payment vouchers
  const fetchPaymentVouchers = async () => {
    const { tallyloc_id, company, guid } = getCompanyInfo();
    if (!tallyloc_id || !company || !guid) {
      setVouchersError('Company information not found. Please select a company first.');
      return;
    }

    setLoadingVouchers(true);
    setVouchersError('');
    setVouchers([]);
    setTotalVouchers(0);

    try {
      const payload = {
        tallyloc_id: parseInt(tallyloc_id),
        company: company,
        guid: guid,
        fromdate: formatDateToYYYYMMDD(fromDate),
        todate: formatDateToYYYYMMDD(toDate)
      };

      const response = await apiPost('/api/tally/vendor-mang/payment-voucher/list', payload);

      if (response && response.success) {
        setVouchers(response.vouchers || []);
        setTotalVouchers(response.vouchers?.length || 0);
        setVouchersError('');
      } else {
        setVouchersError(response?.message || 'Failed to fetch payment vouchers');
        setVouchers([]);
        setTotalVouchers(0);
      }
    } catch (err) {
      console.error('Error fetching payment vouchers:', err);
      const errorMessage = err.message || 'Failed to fetch payment vouchers. Please try again.';
      setVouchersError(errorMessage);
      setVouchers([]);
      setTotalVouchers(0);
    } finally {
      setLoadingVouchers(false);
    }
  };

  // Handle vouchers form submission
  const handleFetchVouchers = (e) => {
    e.preventDefault();
    fetchPaymentVouchers();
  };

  // Fetch voucher details for drill-down
  const fetchVoucherDetails = async (masterid) => {
    const { tallyloc_id, company, guid } = getCompanyInfo();
    if (!tallyloc_id || !company || !guid || !masterid) {
      setVoucherDetailsError('Missing required information to fetch voucher details');
      return;
    }

    setShowVoucherDetails(true);
    setVoucherDetailsLoading(true);
    setVoucherDetailsError(null);
    setVoucherDetailsData(null);

    try {
      const payload = {
        tallyloc_id: parseInt(tallyloc_id),
        company: company,
        guid: guid,
        masterid: String(masterid)
      };

      const response = await apiPost('/api/tally/voucherdata/getvoucherdata', payload);

      if (response && response.vouchers && response.vouchers.length > 0) {
        // Transform API response to match VoucherDetailsModal format
        const voucher = response.vouchers[0];
        
        // Transform the voucher data structure
        const transformedVoucher = {
          VOUCHERS: {
            // Map all fields from API response to expected format
            masterid: voucher.masterid,
            alterid: voucher.alterid,
            VOUCHERTYPE: voucher.vouchertypename || voucher.vouchertypeidentify || voucher.reservedname,
            VOUCHERNUMBER: voucher.vouchernumber,
            DATE: voucher.date,
            PARTYLEDGERNAME: voucher.partyledgername,
            PARTYLEDGERNAMEID: voucher.partyledgernameid,
            STATE: voucher.state,
            COUNTRY: voucher.country,
            PARTYGSTIN: voucher.partygstin,
            PINCODE: voucher.pincode,
            ADDRESS: voucher.address,
            CONSIGNEESTATENAME: voucher.consigneestatename,
            CONSIGNEECOUNTRYNAME: voucher.consigneecountryname,
            BASICBUYERADDRESS: voucher.basicbuyeraddress,
            AMOUNT: voucher.amount,
            ISOPTIONAL: voucher.isoptional,
            ISCANCELLED: voucher.iscancelled,
            SALESPERSON: voucher.salesperson,
            NARRATION: voucher.narration,
            
            // Transform ledger entries
            ALLLEDGERENTRIES: (voucher.ledgerentries || []).map(entry => ({
              LEDGERNAME: entry.ledgername,
              LEDGERNAMEID: entry.ledgernameid,
              AMOUNT: entry.amount,
              ISDEEMEDPOSITIVE: entry.isdeemedpositive,
              ISPARTYLEDGER: entry.ispartyledger,
              GROUP: entry.ledgergroup || entry.group,
              GROUPOFGROUP: entry.groupofgroup,
              GROUPLIST: entry.ledgergrouplist || entry.grouplist,
              LEDGERGROUPIDENTIFY: entry.ledgergroupidentify,
              BILLALLOCATIONS: (entry.billallocations || []).map(bill => ({
                BILLNAME: bill.billname,
                AMOUNT: bill.amount,
                BILLCREDITPERIOD: bill.billcreditperiod
              }))
            })),
            
            // Transform inventory entries
            ALLINVENTORYENTRIES: (voucher.allinventoryentries || []).map(item => ({
              STOCKITEMNAME: item.stockitemname,
              STOCKITEMNAMEID: item.stockitemnameid,
              UOM: item.uom,
              ACTUALQTY: item.actualqty,
              BILLEDQTY: item.billedqty,
              AMOUNT: item.amount,
              ISDEEMEDPOSITIVE: item.isdeemedpositive,
              STOCKITEMGROUP: item.stockitemgroup,
              STOCKITEMGROUPOFGROUP: item.stockitemgroupofgroup,
              STOCKITEMGROUPLIST: item.stockitemgrouplist,
              GROSSCOST: item.grosscost,
              GROSSEXPENSE: item.grossexpense,
              PROFIT: item.profit,
              BATCHALLOCATION: (item.batchallocation || []).map(batch => ({
                GODOWNNAME: batch.godownname,
                BATCHNAME: batch.batchname,
                MFGDATE: batch.mfgdate,
                EXPIRYDATE: batch.expirydate,
                ORDERNO: batch.orderno,
                ORDERDUEDATE: batch.orderduedate,
                TRACKINGNUMBER: batch.trackingnumber,
                ACTUALQTY: batch.actualqty,
                BILLEDQTY: batch.billedqty,
                AMOUNT: batch.amount
              })),
              ACCOUNTINGALLOCATION: item.accountingallocation || []
            }))
          }
        };

        setVoucherDetailsData(transformedVoucher);
        setVoucherDetailsError(null);
      } else {
        setVoucherDetailsError('Voucher details not found');
        setVoucherDetailsData(null);
      }
    } catch (err) {
      console.error('Error fetching voucher details:', err);
      const errorMessage = err.message || 'Failed to fetch voucher details. Please try again.';
      setVoucherDetailsError(errorMessage);
      setVoucherDetailsData(null);
    } finally {
      setVoucherDetailsLoading(false);
    }
  };

  // Handle row click to show voucher details
  const handleRowClick = (voucher) => {
    const masterid = voucher.masterid || voucher.masterId;
    if (masterid) {
      fetchVoucherDetails(masterid);
    }
  };

  // Listen for company changes
  useEffect(() => {
    const handleCompanyChange = () => {
      setVouchers([]);
      setTotalVouchers(0);
      setVouchersError('');
    };

    window.addEventListener('companyChanged', handleCompanyChange);
    return () => window.removeEventListener('companyChanged', handleCompanyChange);
  }, []);

  return (
    <div style={{
      width: '1200px',
      minHeight: 'calc(100vh - 120px)',
      padding: '24px',
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
        background: '#fff',
        margin: '0 auto',
        width: '100%',
        maxWidth: '100%',
        borderRadius: '16px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        overflow: 'visible',
        border: '1px solid #e5e7eb',
      }}>
        {/* Header */}
        <div style={{ padding: '24px', borderBottom: '1px solid #e5e7eb' }}>
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#1e293b' }}>
            Payment Vouchers Report
          </h2>
          <p style={{ margin: '8px 0 0 0', fontSize: '14px', color: '#64748b' }}>
            View and manage payment vouchers within the selected date range
          </p>
        </div>

        {/* Date Range Form */}
        <form onSubmit={handleFetchVouchers} style={{ padding: '24px', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{
            display: 'flex',
            gap: '16px',
            alignItems: 'flex-end',
            flexWrap: 'wrap',
          }}>
            {/* From Date */}
            <div style={{ position: 'relative', width: '160px', flex: '0 0 auto' }}>
              <label style={{
                position: 'absolute',
                left: 12,
                top: fromDateFocused || fromDate ? '-10px' : '10px',
                fontSize: fromDateFocused || fromDate ? 14 : 15,
                fontWeight: 600,
                color: '#60a5fa',
                backgroundColor: '#fff',
                padding: '0 6px',
                transition: 'all 0.25s cubic-bezier(.4,0,.2,1)',
                pointerEvents: 'none',
                letterSpacing: 0.5,
                fontFamily: 'Segoe UI, Roboto, Arial, sans-serif',
              }}>
                From Date
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                onFocus={() => setFromDateFocused(true)}
                onBlur={() => setFromDateFocused(false)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: `1px solid ${fromDateFocused ? '#60a5fa' : '#cbd5e1'}`,
                  fontSize: 15,
                  outline: 'none',
                  transition: 'border 0.2s',
                  marginBottom: 2,
                  background: '#fff',
                  height: '42px',
                  boxSizing: 'border-box',
                }}
                required
              />
            </div>

            {/* To Date */}
            <div style={{ position: 'relative', width: '160px', flex: '0 0 auto' }}>
              <label style={{
                position: 'absolute',
                left: 12,
                top: toDateFocused || toDate ? '-10px' : '10px',
                fontSize: toDateFocused || toDate ? 14 : 15,
                fontWeight: 600,
                color: '#60a5fa',
                backgroundColor: '#fff',
                padding: '0 6px',
                transition: 'all 0.25s cubic-bezier(.4,0,.2,1)',
                pointerEvents: 'none',
                letterSpacing: 0.5,
                fontFamily: 'Segoe UI, Roboto, Arial, sans-serif',
              }}>
                To Date
              </label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                onFocus={() => setToDateFocused(true)}
                onBlur={() => setToDateFocused(false)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: `1px solid ${toDateFocused ? '#60a5fa' : '#cbd5e1'}`,
                  fontSize: 15,
                  outline: 'none',
                  transition: 'border 0.2s',
                  marginBottom: 2,
                  background: '#fff',
                  height: '42px',
                  boxSizing: 'border-box',
                }}
                required
              />
            </div>

            {/* Fetch Button */}
            <div style={{ flex: '0 0 auto' }}>
              <button
                type="submit"
                disabled={loadingVouchers}
                style={{
                  padding: '10px 20px',
                  background: loadingVouchers ? '#94a3b8' : '#2563eb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: '16px',
                  fontWeight: 600,
                  cursor: loadingVouchers ? 'not-allowed' : 'pointer',
                  transition: 'background 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  height: '42px',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={(e) => {
                  if (!loadingVouchers) e.currentTarget.style.background = '#1d4ed8';
                }}
                onMouseLeave={(e) => {
                  if (!loadingVouchers) e.currentTarget.style.background = '#2563eb';
                }}
              >
                {loadingVouchers ? (
                  <>
                    <span className="material-icons" style={{ fontSize: 20, animation: 'spin 1s linear infinite' }}>
                      refresh
                    </span>
                    Loading...
                  </>
                ) : (
                  <>
                    <span className="material-icons" style={{ fontSize: 20 }}>search</span>
                    Fetch Vouchers
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

        {/* Error Message */}
        {vouchersError && (
          <div style={{
            background: '#fee2e2',
            color: '#b91c1c',
            borderRadius: 8,
            padding: '12px 16px',
            margin: '0 24px 24px 24px',
            fontWeight: 600,
            fontSize: 15,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <span className="material-icons" style={{ fontSize: 18 }}>error_outline</span>
            {vouchersError}
          </div>
        )}

        {/* Results */}
        {vouchers.length > 0 && (
          <div style={{ padding: '0 24px 24px 24px' }}>
            <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>
                Total Vouchers: {totalVouchers}
              </div>
            </div>

            {/* Table */}
            <div style={{
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              overflow: 'hidden',
              background: '#fff',
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e5e7eb' }}>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: '14px', color: '#1e293b' }}>
                      Voucher No.
                    </th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: '14px', color: '#1e293b' }}>
                      Date
                    </th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: '14px', color: '#1e293b' }}>
                      Voucher Type
                    </th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: '14px', color: '#1e293b' }}>
                      Narration
                    </th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: '14px', color: '#1e293b' }}>
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {vouchers.map((voucher, index) => {
                    // Create unique key combining multiple fields to avoid duplicates
                    const uniqueKey = `${voucher.masterid || voucher.masterId || ''}_${voucher.voucherNumber || voucher.vouchernumber || ''}_${index}`;
                    
                    // Get status badge color
                    const status = voucher.status || voucher.STATUS || '';
                    const statusColor = status === 'Accepted' ? '#10b981' : status === 'Pending for Accept' ? '#f59e0b' : status === 'Cancelled' ? '#ef4444' : '#64748b';

                    return (
                      <tr
                        key={uniqueKey}
                        onClick={() => handleRowClick(voucher)}
                        style={{
                          cursor: 'pointer',
                          borderBottom: index < vouchers.length - 1 ? '1px solid #e5e7eb' : 'none',
                          transition: 'background 0.2s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#f8fafc';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = '#fff';
                        }}
                      >
                        <td style={{ padding: '12px 16px', fontSize: '14px', color: '#1e293b' }}>
                          {voucher.vouchernumber || voucher.voucherNumber || '-'}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '14px', color: '#1e293b' }}>
                          {formatDateDisplay(voucher.date || voucher.DATE)}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '14px', color: '#1e293b' }}>
                          {voucher.vouchertypename || voucher.voucherTypeName || voucher.voucherType || '-'}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '14px', color: '#1e293b' }}>
                          {voucher.narration || voucher.NARRATION || '-'}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '14px' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '4px 12px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: 600,
                            backgroundColor: statusColor === '#10b981' ? '#d1fae5' : statusColor === '#f59e0b' ? '#fef3c7' : statusColor === '#ef4444' ? '#fee2e2' : '#f1f5f9',
                            color: statusColor
                          }}>
                            {status || '-'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loadingVouchers && vouchers.length === 0 && !vouchersError && (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: '#64748b' }}>
            <span className="material-icons" style={{ fontSize: 48, marginBottom: '16px', display: 'block' }}>
              description
            </span>
            <p style={{ fontSize: '16px', fontWeight: 500 }}>No vouchers found</p>
            <p style={{ fontSize: '14px', marginTop: '8px' }}>
              Select a date range and click "Fetch Vouchers" to view payment vouchers
            </p>
          </div>
        )}
      </div>

      {/* Voucher Details Modal */}
      {showVoucherDetails && (
        <VoucherDetailsModal
          voucherData={voucherDetailsData}
          loading={voucherDetailsLoading}
          error={voucherDetailsError}
          onClose={() => {
            setShowVoucherDetails(false);
            setVoucherDetailsData(null);
            setVoucherDetailsError(null);
          }}
        />
      )}
    </div>
  );
}

export default PaymentVoucherReport;

