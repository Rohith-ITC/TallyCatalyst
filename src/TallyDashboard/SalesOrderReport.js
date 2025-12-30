import React, { useState, useEffect, useMemo } from 'react';
import { apiPost } from '../utils/apiUtils';
import VoucherDetailsModal from '../RecvDashboard/components/VoucherDetailsModal';
import { formatDateFromYYYYMMDD } from '../RecvDashboard/utils/helpers';
import { generateOrderPdf } from '../utils/orderPdfUtils';

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
  const [voucherDetailsData, setVoucherDetailsData] = useState(null);
  const [voucherDetailsLoading, setVoucherDetailsLoading] = useState(false);
  const [voucherDetailsError, setVoucherDetailsError] = useState(null);

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
        setOrders(response.orders || []);
        setTotal(response.total || 0);
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

  // Fetch voucher details for drill-down
  const fetchVoucherDetails = async (masterid) => {
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
        tallyloc_id,
        company,
        guid,
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
            
            // Transform ledger entries
            ALLLEDGERENTRIES: (voucher.ledgerentries || []).map(entry => ({
              LEDGERNAME: entry.ledgername,
              LEDGERNAMEID: entry.ledgernameid,
              AMOUNT: entry.amount,
              ISDEEMEDPOSITIVE: entry.isdeemedpositive,
              ISPARTYLEDGER: entry.ispartyledger,
              GROUP: entry.group,
              GROUPOFGROUP: entry.groupofgroup,
              GROUPLIST: entry.grouplist,
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

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    fetchSalesOrders();
  };

  // Handle row click to show voucher details
  const handleRowClick = (order) => {
    if (order.masterid) {
      fetchVoucherDetails(order.masterid);
    }
  };

  // Format date for display (YYYYMMDD to DD-MMM-YY)
  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return '-';
    return formatDateFromYYYYMMDD(dateStr);
  };

  // Get company information from sessionStorage
  const getCurrentCompany = () => {
    try {
      const selectedCompanyGuid = sessionStorage.getItem('selectedCompanyGuid') || '';
      const allConnections = JSON.parse(sessionStorage.getItem('allConnections') || '[]');
      const currentCompany = allConnections.find(c => c.guid === selectedCompanyGuid);
      
      if (currentCompany) {
        return {
          company: currentCompany.company || currentCompany.conn_name || '',
          address: currentCompany.address || sessionStorage.getItem('address') || '',
          email: currentCompany.email || sessionStorage.getItem('company_email') || '',
          tallyloc_id: currentCompany.tallyloc_id || parseInt(sessionStorage.getItem('tallyloc_id') || '0'),
          guid: currentCompany.guid || sessionStorage.getItem('guid') || ''
        };
      }
    } catch (error) {
      console.error('Error getting company info:', error);
    }
    return {
      company: sessionStorage.getItem('company') || sessionStorage.getItem('conn_name') || '',
      address: sessionStorage.getItem('address') || '',
      email: sessionStorage.getItem('company_email') || '',
      tallyloc_id: parseInt(sessionStorage.getItem('tallyloc_id') || '0'),
      guid: sessionStorage.getItem('guid') || ''
    };
  };

  // Fetch voucher details and generate PDF
  const fetchAndGeneratePdf = async (order, action) => {
    if (!order.masterid) {
      alert('Order details not available');
      return;
    }

    try {

      // Fetch full voucher details
      const payload = {
        tallyloc_id,
        company,
        guid,
        masterid: String(order.masterid)
      };

      const response = await apiPost('/api/tally/voucherdata/getvoucherdata', payload);

      if (!response || !response.vouchers || response.vouchers.length === 0) {
        alert('Failed to fetch order details');
        return;
      }

      const voucher = response.vouchers[0];
      const currentCompany = getCurrentCompany();

      // Transform inventory entries to orderItems format
      const orderItems = (voucher.allinventoryentries || []).map(item => {
        const qty = parseFloat(item.actualqty || item.billedqty || 0);
        const rate = qty > 0 ? parseFloat(item.amount || 0) / qty : 0;
        const amount = parseFloat(item.amount || 0);

        // Format quantity display
        let quantityDisplay = '';
        if (item.uom) {
          quantityDisplay = `${qty} ${item.uom}`;
        } else {
          quantityDisplay = qty.toString();
        }

        return {
          name: item.stockitemname || '',
          quantity: qty,
          quantityDisplay: quantityDisplay,
          rate: rate,
          amount: amount,
          gstPercent: 0,
          discountPercent: 0,
          description: ''
        };
      });

      // Parse date from YYYYMMDD format
      let orderDate = new Date();
      if (voucher.date) {
        const dateStr = String(voucher.date);
        if (dateStr.length === 8) {
          const year = parseInt(dateStr.substring(0, 4));
          const month = parseInt(dateStr.substring(4, 6)) - 1;
          const day = parseInt(dateStr.substring(6, 8));
          orderDate = new Date(year, month, day);
        }
      }

      // Create order data structure
      const orderData = {
        orderItems: orderItems,
        selectedCustomer: voucher.partyledgername || order.partyledgername || '',
        selectedCustomerObj: {
          ADDRESS: voucher.address || voucher.basicbuyeraddress || '',
          STATENAME: voucher.state || voucher.consigneestatename || '',
          COUNTRY: voucher.country || voucher.consigneecountryname || '',
          PINCODE: voucher.pincode || '',
          GSTNO: voucher.partygstin || '',
          PHONE: ''
        },
        currentCompany: currentCompany,
        orderDate: orderDate,
        voucherNumber: voucher.vouchernumber || order.vouchernumber || '',
        voucherType: voucher.vouchertypename || voucher.vouchertypeidentify || 'Sales Order',
        editableAddress: voucher.address || voucher.basicbuyeraddress || '',
        editableState: voucher.state || voucher.consigneestatename || '',
        editableCountry: voucher.country || voucher.consigneecountryname || '',
        editableGstNo: voucher.partygstin || '',
        editablePincode: voucher.pincode || ''
      };

      const pdf = generateOrderPdf(orderData);

      if (action === 'print') {
        // Generate blob and create iframe for printing
        const pdfBlob = pdf.output('blob');
        const pdfUrl = URL.createObjectURL(pdfBlob);
        
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        iframe.src = pdfUrl;
        
        document.body.appendChild(iframe);
        
        iframe.onload = () => {
          setTimeout(() => {
            iframe.contentWindow.print();
            setTimeout(() => {
              document.body.removeChild(iframe);
              URL.revokeObjectURL(pdfUrl);
            }, 100);
          }, 250);
        };
      } else {
        // WhatsApp share
        const pdfBlob = pdf.output('blob');
        const fileName = `SalesOrder_${orderData.voucherNumber || 'Report'}.pdf`;
        const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
        
        // Detect if mobile device
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                        (window.innerWidth <= 768);
        
        // On mobile, use Web Share API (shows share menu where user can select WhatsApp)
        // On desktop, directly open WhatsApp Web (skip share menu)
        if (isMobile && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          // Mobile: Use native share menu
          navigator.share({
            title: `Sales Order - ${orderData.voucherNumber || 'Report'}`,
            text: `Sales Order - Voucher: ${orderData.voucherNumber || 'N/A'}`,
            files: [file]
          }).catch((error) => {
            console.log('Share failed:', error);
            // Fallback to download method
            downloadAndOpenWhatsApp(pdfBlob, fileName, orderData.voucherNumber);
          });
        } else {
          // Desktop: Directly open WhatsApp Web
          downloadAndOpenWhatsApp(pdfBlob, fileName, orderData.voucherNumber);
        }
      }
    } catch (error) {
      console.error('Error generating PDF for WhatsApp:', error);
      alert('Error generating PDF: ' + (error.message || 'Unknown error'));
    }
  };

  // Helper function to download PDF and open WhatsApp
  // Note: WhatsApp Web/Desktop doesn't support automatic file attachment due to browser security
  // The PDF must be manually attached by the user
  const downloadAndOpenWhatsApp = (pdfBlob, fileName, voucherNumber) => {
    // Download the PDF
    const pdfUrl = URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(pdfUrl);

    // Open WhatsApp with pre-filled message
    setTimeout(() => {
      const message = `Sales Order - Voucher: ${voucherNumber || 'N/A'}\n\n📎 Please attach the PDF file: ${fileName}`;
      
      // Try WhatsApp Desktop app first (if installed)
      try {
        window.location.href = `whatsapp://send?text=${encodeURIComponent(message)}`;
      } catch (e) {
        // If desktop app protocol fails, use WhatsApp Web
        window.open(`https://web.whatsapp.com/send?text=${encodeURIComponent(message)}`, '_blank');
      }
    }, 500);
  };

  // Handle Email Share for specific order
  const handleEmailShare = async (order, e) => {
    e.stopPropagation(); // Prevent row click
    
    if (!order.masterid) {
      alert('Order details not available');
      return;
    }

    try {
      // Fetch full voucher details
      const payload = {
        tallyloc_id,
        company,
        guid,
        masterid: String(order.masterid)
      };

      const response = await apiPost('/api/tally/voucherdata/getvoucherdata', payload);

      if (!response || !response.vouchers || response.vouchers.length === 0) {
        alert('Failed to fetch order details');
        return;
      }

      const voucher = response.vouchers[0];
      const currentCompany = getCurrentCompany();

      // Transform inventory entries to orderItems format
      const orderItems = (voucher.allinventoryentries || []).map(item => {
        const qty = parseFloat(item.actualqty || item.billedqty || 0);
        const rate = qty > 0 ? parseFloat(item.amount || 0) / qty : 0;
        const amount = parseFloat(item.amount || 0);

        // Format quantity display
        let quantityDisplay = '';
        if (item.uom) {
          quantityDisplay = `${qty} ${item.uom}`;
        } else {
          quantityDisplay = qty.toString();
        }

        return {
          name: item.stockitemname || '',
          quantity: qty,
          quantityDisplay: quantityDisplay,
          rate: rate,
          amount: amount,
          gstPercent: 0,
          discountPercent: 0,
          description: ''
        };
      });

      // Parse date from YYYYMMDD format
      let orderDate = new Date();
      if (voucher.date) {
        const dateStr = String(voucher.date);
        if (dateStr.length === 8) {
          const year = parseInt(dateStr.substring(0, 4));
          const month = parseInt(dateStr.substring(4, 6)) - 1;
          const day = parseInt(dateStr.substring(6, 8));
          orderDate = new Date(year, month, day);
        }
      }

      // Create order data structure
      const orderData = {
        orderItems: orderItems,
        selectedCustomer: voucher.partyledgername || order.partyledgername || '',
        selectedCustomerObj: {
          ADDRESS: voucher.address || voucher.basicbuyeraddress || '',
          STATENAME: voucher.state || voucher.consigneestatename || '',
          COUNTRY: voucher.country || voucher.consigneecountryname || '',
          PINCODE: voucher.pincode || '',
          GSTNO: voucher.partygstin || '',
          PHONE: ''
        },
        currentCompany: currentCompany,
        orderDate: orderDate,
        voucherNumber: voucher.vouchernumber || order.vouchernumber || '',
        voucherType: voucher.vouchertypename || voucher.vouchertypeidentify || 'Sales Order',
        editableAddress: voucher.address || voucher.basicbuyeraddress || '',
        editableState: voucher.state || voucher.consigneestatename || '',
        editableCountry: voucher.country || voucher.consigneecountryname || '',
        editableGstNo: voucher.partygstin || '',
        editablePincode: voucher.pincode || ''
      };

      const pdf = generateOrderPdf(orderData);
      const pdfBlob = pdf.output('blob');
      const fileName = `SalesOrder_${orderData.voucherNumber || 'Report'}.pdf`;
      
      // Download the PDF first
      const pdfUrl = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(pdfUrl);

      // Open default email client with pre-filled subject and body
      setTimeout(() => {
        const subject = encodeURIComponent(`Sales Order - Voucher: ${orderData.voucherNumber || 'N/A'}`);
        const body = encodeURIComponent(`Please find attached the sales order receipt.\n\nVoucher Number: ${orderData.voucherNumber || 'N/A'}\nCustomer: ${orderData.selectedCustomer || 'N/A'}\n\nPlease attach the downloaded PDF file: ${fileName}`);
        window.location.href = `mailto:?subject=${subject}&body=${body}`;
      }, 500);
    } catch (error) {
      console.error('Error generating PDF for email:', error);
      alert('Error generating PDF: ' + (error.message || 'Unknown error'));
    }
  };

  // Handle Print for specific order
  const handlePrint = (order, e) => {
    e.stopPropagation(); // Prevent row click
    fetchAndGeneratePdf(order, 'print');
  };

  // Handle WhatsApp Share for specific order
  const handleWhatsAppShare = (order, e) => {
    e.stopPropagation(); // Prevent row click
    fetchAndGeneratePdf(order, 'whatsapp');
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
        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '24px', width: '100%' }}>
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
          <div style={{
            display: 'flex',
            gap: '16px',
            marginBottom: '24px',
            alignItems: 'flex-end',
            flexWrap: 'wrap',
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
          <div style={{ padding: '0 24px 24px 24px' }}>
            <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>
                Total Orders: {total}
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
                      Party Ledger Name
                    </th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: '14px', color: '#1e293b' }}>
                      Status
                    </th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: '14px', color: '#1e293b' }}>
                      Order No.
                    </th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: '14px', color: '#1e293b' }}>
                      Generated By
                    </th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, fontSize: '14px', color: '#1e293b', width: '120px' }}>
                      Actions
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
                      <td style={{ padding: '12px 16px', fontSize: '14px', color: '#1e293b' }}>
                        {order.vouchernumber || '-'}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '14px', color: '#1e293b' }}>
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
                          background: order.status === 'Accepted' ? '#d1fae5' : '#fef3c7',
                          color: order.status === 'Accepted' ? '#065f46' : '#92400e',
                        }}>
                          {order.status || '-'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '14px', color: '#1e293b' }}>
                        {order.orderno || '-'}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '14px', color: '#1e293b' }}>
                        {order.generated_by_name || '-'}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '14px' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center' }}>
                          <button
                            onClick={(e) => handlePrint(order, e)}
                            style={{
                              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '6px 12px',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: '600',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '4px',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)';
                              e.currentTarget.style.transform = 'translateY(-1px)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)';
                              e.currentTarget.style.transform = 'translateY(0)';
                            }}
                            title="Print PDF"
                          >
                            <span className="material-icons" style={{ fontSize: '16px' }}>print</span>
                          </button>
                          <button
                            onClick={(e) => handleWhatsAppShare(order, e)}
                            style={{
                              background: 'linear-gradient(135deg, #25d366 0%, #128c7e 100%)',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '6px 12px',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: '600',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '4px',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'linear-gradient(135deg, #128c7e 0%, #0d6e5f 100%)';
                              e.currentTarget.style.transform = 'translateY(-1px)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'linear-gradient(135deg, #25d366 0%, #128c7e 100%)';
                              e.currentTarget.style.transform = 'translateY(0)';
                            }}
                            title="Share via WhatsApp"
                          >
                            <span className="material-icons" style={{ fontSize: '16px' }}>send</span>
                          </button>
                          <button
                            onClick={(e) => handleEmailShare(order, e)}
                            style={{
                              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '6px 12px',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: '600',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '4px',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)';
                              e.currentTarget.style.transform = 'translateY(-1px)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)';
                              e.currentTarget.style.transform = 'translateY(0)';
                            }}
                            title="Share via Email"
                          >
                            <span className="material-icons" style={{ fontSize: '16px' }}>email</span>
                          </button>
                        </div>
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

export default Reports;

