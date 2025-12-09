import React, { useState, useEffect, useMemo } from 'react';
import { apiPost } from '../utils/apiUtils';
import VoucherDetailsModal from './components/VoucherDetailsModal';
import { formatDateFromYYYYMMDD } from '../RecvDashboard/utils/helpers';

function Reports() {
  // Get company info from sessionStorage
  const tallyloc_id = parseInt(sessionStorage.getItem('tallyloc_id') || '0');
  const company = sessionStorage.getItem('company') || '';
  const guid = sessionStorage.getItem('guid') || '';

  // Default dates
  function getFirstOfMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  }
  function getToday() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  const [fromDate, setFromDate] = useState(getFirstOfMonth());
  const [toDate, setToDate] = useState(getToday());
  const [fromDateFocused, setFromDateFocused] = useState(false);
  const [toDateFocused, setToDateFocused] = useState(false);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [total, setTotal] = useState(0);

  // Voucher details modal state
  const [showVoucherDetails, setShowVoucherDetails] = useState(false);
  const [selectedMasterId, setSelectedMasterId] = useState(null);

  // Convert date from YYYY-MM-DD to YYYYMMDD format for API
  const formatDateToYYYYMMDD = (dateStr) => {
    if (!dateStr) return '';
    // Remove dashes if present
    return dateStr.replace(/-/g, '');
  };

  // Fetch sales orders
  const fetchSalesOrders = async () => {
    if (!tallyloc_id || !company || !guid) {
      setError('Company information not found. Please select a company first.');
      return;
    }

    setLoading(true);
    setError('');
    setOrders([]);
    setTotal(0);

    try {
      const payload = {
        tallyloc_id,
        company,
        guid,
        fromdate: formatDateToYYYYMMDD(fromDate),
        todate: formatDateToYYYYMMDD(toDate)
      };

      const response = await apiPost('/api/reports/salesorder', payload);

      if (response && response.success) {
        // Normalize order data to handle different field name variations
        const normalizedOrders = (response.orders || []).map(order => ({
          ...order,
          vouchernumber: order.vouchernumber || order.voucher_number || order.voucherNumber || order.VOUCHERNUMBER || '-',
          date: order.date || order.DATE || order.Date || '',
          partyledgername: order.partyledgername || order.party_ledger_name || order.PARTYLEDGERNAME || order.partyLedgerName || '-',
          status: order.status || order.STATUS || order.Status || 'Pending for Accept',
          orderno: order.orderno || order.order_no || order.ORDERNO || order.orderNo || order.OrdNo || '-',
          generated_by_name: order.generated_by_name || order.generated_by || order.generatedBy || order.GENERATED_BY || '-',
          masterid: order.masterid || order.master_id || order.MASTERID || order.masterId || null
        }));
        setOrders(normalizedOrders);
        setTotal(response.total || normalizedOrders.length);
        setError('');
      } else {
        setError(response?.message || 'Failed to fetch sales orders');
        setOrders([]);
        setTotal(0);
      }
    } catch (err) {
      console.error('Error fetching sales orders:', err);
      const errorMessage = err.message || 'Failed to fetch sales orders. Please try again.';
      setError(errorMessage);
      setOrders([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    fetchSalesOrders();
  };

  // Handle row click to show voucher details
  const handleRowClick = (order) => {
    if (order.masterid) {
      setSelectedMasterId(order.masterid);
      setShowVoucherDetails(true);
    }
  };

  // Format date for display (YYYYMMDD to DD-MMM-YY)
  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return '-';
    return formatDateFromYYYYMMDD(dateStr);
  };

  // Listen for company changes
  useEffect(() => {
    const handleCompanyChange = () => {
      setOrders([]);
      setTotal(0);
      setError('');
    };

    window.addEventListener('companyChanged', handleCompanyChange);
    return () => window.removeEventListener('companyChanged', handleCompanyChange);
  }, []);

  // Floating label style for date inputs
  const dateInputWrapperStyle = { position: 'relative', width: '100%' };
  const dateInputStyle = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid #cbd5e1',
    fontSize: 15,
    outline: 'none',
    transition: 'border 0.2s',
    marginBottom: 2,
    background: '#fff',
    height: '42px',
    boxSizing: 'border-box',
  };
  const floatingLabelStyle = (focused, value) => ({
    position: 'absolute',
    left: 12,
    top: focused || value ? '-10px' : '10px',
    fontSize: focused || value ? 14 : 15,
    fontWeight: 600,
    color: '#60a5fa',
    backgroundColor: '#fff',
    padding: '0 6px',
    transition: 'all 0.25s cubic-bezier(.4,0,.2,1)',
    pointerEvents: 'none',
    letterSpacing: 0.5,
    fontFamily: 'Segoe UI, Roboto, Arial, sans-serif',
  });

  return (
    <div className="reports-container" style={{
      width: '100%',
      maxWidth: '100%',
      minHeight: 'calc(100vh - 120px)',
      padding: '20px',
      margin: '0',
      boxSizing: 'border-box',
    }}>
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          
          @media (max-width: 1200px) {
            .reports-container {
              padding: 16px !important;
            }
            .reports-form {
              padding: 16px !important;
            }
            .reports-table-wrapper {
              min-width: 600px !important;
            }
          }
          
          @media (max-width: 768px) {
            .reports-container {
              padding: 12px !important;
            }
            .reports-form {
              padding: 12px !important;
            }
            .reports-date-inputs {
              flex-direction: column !important;
              align-items: stretch !important;
            }
            .reports-date-inputs > div {
              width: 100% !important;
            }
            .reports-table-wrapper {
              min-width: 500px !important;
            }
          }
        `}
      </style>
      <div style={{
        background: '#fff',
        margin: '0',
        width: '100%',
        maxWidth: '100%',
        borderRadius: '12px',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
        overflow: 'hidden',
        border: '1px solid #e5e7eb',
        boxSizing: 'border-box',
      }}>
        {/* Form */}
        <form className="reports-form" onSubmit={handleSubmit} style={{ padding: '24px', width: '100%', boxSizing: 'border-box' }}>
          {/* Header */}
          <div style={{ marginBottom: '24px' }}>
            <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#1e293b' }}>
              Sales Orders Report
            </h2>
            <p style={{ margin: '8px 0 0 0', fontSize: '14px', color: '#64748b' }}>
              View and manage sales orders within the selected date range
            </p>
          </div>

          {/* Date Range Inputs */}
          <div className="reports-date-inputs" style={{
            display: 'flex',
            gap: '16px',
            marginBottom: '24px',
            alignItems: 'flex-end',
            flexWrap: 'wrap',
            width: '100%',
            boxSizing: 'border-box',
          }}>
            {/* From Date */}
            <div style={{ ...dateInputWrapperStyle, width: '160px', flex: '0 0 auto' }}>
              <label style={floatingLabelStyle(fromDateFocused, fromDate)}>
                From Date
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                onFocus={() => setFromDateFocused(true)}
                onBlur={() => setFromDateFocused(false)}
                style={{
                  ...dateInputStyle,
                  borderColor: fromDateFocused ? '#60a5fa' : '#cbd5e1',
                  width: '100%',
                }}
                required
              />
            </div>

            {/* To Date */}
            <div style={{ ...dateInputWrapperStyle, width: '160px', flex: '0 0 auto' }}>
              <label style={floatingLabelStyle(toDateFocused, toDate)}>
                To Date
              </label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                onFocus={() => setToDateFocused(true)}
                onBlur={() => setToDateFocused(false)}
                style={{
                  ...dateInputStyle,
                  borderColor: toDateFocused ? '#60a5fa' : '#cbd5e1',
                  width: '100%',
                }}
                required
              />
            </div>

            {/* Submit Button */}
            <div style={{ flex: '0 0 auto' }}>
              <button
                type="submit"
                disabled={loading}
                style={{
                  padding: '10px 20px',
                  background: loading ? '#94a3b8' : '#2563eb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: '16px',
                  fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'background 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  height: '42px',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={(e) => {
                  if (!loading) e.currentTarget.style.background = '#1d4ed8';
                }}
                onMouseLeave={(e) => {
                  if (!loading) e.currentTarget.style.background = '#2563eb';
                }}
              >
                {loading ? (
                  <>
                    <span className="material-icons" style={{ fontSize: 20, animation: 'spin 1s linear infinite' }}>
                      refresh
                    </span>
                    Loading...
                  </>
                ) : (
                  <>
                    <span className="material-icons" style={{ fontSize: 20 }}>search</span>
                    Fetch Orders
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

        {/* Error Message */}
        {error && (
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
            {error}
          </div>
        )}

        {/* Results */}
        {orders.length > 0 && (
          <div style={{ padding: '0 24px 24px 24px', width: '100%', boxSizing: 'border-box' }}>
            <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>
                Total Orders: {total}
              </div>
            </div>

            {/* Table */}
            <div className="reports-table-wrapper" style={{
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              overflowX: 'auto',
              overflowY: 'visible',
              background: '#fff',
              width: '100%',
              boxSizing: 'border-box',
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto', minWidth: '800px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e5e7eb' }}>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: '14px', color: '#1e293b', whiteSpace: 'nowrap' }}>
                      Voucher No.
                    </th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: '14px', color: '#1e293b', whiteSpace: 'nowrap' }}>
                      Date
                    </th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: '14px', color: '#1e293b', minWidth: '200px' }}>
                      Party Ledger Name
                    </th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: '14px', color: '#1e293b', whiteSpace: 'nowrap' }}>
                      Status
                    </th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: '14px', color: '#1e293b', minWidth: '150px' }}>
                      Order No.
                    </th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: '14px', color: '#1e293b', minWidth: '120px' }}>
                      Generated By
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order, index) => (
                    <tr
                      key={order.masterid || index}
                      onClick={() => handleRowClick(order)}
                      style={{
                        cursor: 'pointer',
                        borderBottom: index < orders.length - 1 ? '1px solid #e5e7eb' : 'none',
                        transition: 'background 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#f8fafc';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#fff';
                      }}
                    >
                      <td style={{ padding: '12px 16px', fontSize: '14px', color: '#1e293b', whiteSpace: 'nowrap' }}>
                        {order.vouchernumber || '-'}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '14px', color: '#1e293b', whiteSpace: 'nowrap' }}>
                        {formatDateDisplay(order.date)}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '14px', color: '#1e293b' }}>
                        {order.partyledgername || '-'}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '14px' }}>
                        <span style={{
                          padding: '4px 12px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: 600,
                          background: (order.status === 'Accepted' || order.status === 'ACCEPTED' || order.status === 'accepted') ? '#d1fae5' : '#fef3c7',
                          color: (order.status === 'Accepted' || order.status === 'ACCEPTED' || order.status === 'accepted') ? '#065f46' : '#92400e',
                          display: 'inline-block',
                          whiteSpace: 'nowrap',
                        }}>
                          {order.status || 'Pending for Accept'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '14px', color: '#1e293b' }}>
                        {order.orderno || '-'}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '14px', color: '#1e293b' }}>
                        {order.generated_by_name || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && orders.length === 0 && !error && (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: '#64748b' }}>
            <span className="material-icons" style={{ fontSize: 48, marginBottom: '16px', display: 'block' }}>
              description
            </span>
            <p style={{ fontSize: '16px', fontWeight: 500 }}>No orders found</p>
            <p style={{ fontSize: '14px', marginTop: '8px' }}>
              Select a date range and click "Fetch Orders" to view sales orders
            </p>
          </div>
        )}
      </div>

      {/* Voucher Details Modal */}
      {showVoucherDetails && (
        <VoucherDetailsModal
          masterId={selectedMasterId}
          onClose={() => {
            setShowVoucherDetails(false);
            setSelectedMasterId(null);
          }}
        />
      )}
    </div>
  );
}

export default Reports;

