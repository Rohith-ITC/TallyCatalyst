import React, { useState, useEffect } from 'react';
import { apiPost, apiGet } from '../../utils/apiUtils';
import VoucherDetailsModalBase from '../../RecvDashboard/components/VoucherDetailsModal';

const VoucherDetailsModal = ({
  masterId,
  onClose,
  showApproveReject = false,
  onApprove,
  onReject,
  isAuthorizing = false,
  isRejecting = false,
  voucherStatus = null,
  headerActions: externalHeaderActions = null
}) => {
  const [voucherDetailsData, setVoucherDetailsData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isDownloadingPDF, setIsDownloadingPDF] = useState(false);

  // Get company info from sessionStorage
  const getCompanyInfo = () => {
    const tallyloc_id = parseInt(sessionStorage.getItem('tallyloc_id') || '0');
    const company = sessionStorage.getItem('company') || '';
    const guid = sessionStorage.getItem('guid') || '';

    if (!tallyloc_id || !company || !guid) {
      throw new Error('Company information not found. Please select a company first.');
    }

    return { tallyloc_id, company, guid };
  };

  // Download PDF function for voucher
  const downloadPDF = async () => {
    if (!masterId) {
      alert('❌ Unable to download PDF: Missing voucher information');
      return;
    }

    try {
      const companyInfo = getCompanyInfo();
      
      // Validate company info
      if (!companyInfo.tallyloc_id || companyInfo.tallyloc_id === 0) {
        alert('❌ Unable to download PDF: Invalid tallyloc_id. Please select a company first.');
        return;
      }
      
      if (!companyInfo.company || !companyInfo.guid) {
        alert('❌ Unable to download PDF: Missing company information. Please select a company first.');
        return;
      }

      // Validate masterId
      if (!masterId || (typeof masterId !== 'string' && typeof masterId !== 'number')) {
        alert('❌ Unable to download PDF: Invalid voucher ID');
        return;
      }

      setIsDownloadingPDF(true);

      // Step 1: Request PDF generation
      const requestPayload = {
        tallyloc_id: companyInfo.tallyloc_id,
        company: companyInfo.company,
        guid: companyInfo.guid,
        master_id: String(masterId) // Convert to string to match API expectations
      };

      console.log('Requesting PDF generation:', requestPayload);
      const requestResult = await apiPost('/api/tally/pdf/request', requestPayload);

      if (!requestResult) {
        throw new Error('No response from PDF generation service');
      }

      if (!requestResult.success) {
        throw new Error(requestResult?.message || 'Failed to request PDF generation');
      }

      if (!requestResult.request_id) {
        throw new Error('PDF generation request failed: No request ID returned');
      }

      const requestId = requestResult.request_id;
      console.log('PDF request ID:', requestId);

      // Step 2: Poll PDF status until ready (with timeout)
      let statusResult = null;
      const maxAttempts = 30; // Maximum 30 attempts
      const pollInterval = 1000; // Check every 1 second
      let attempts = 0;

      while (attempts < maxAttempts) {
        // Wait before checking (except first attempt)
        if (attempts > 0) {
          await new Promise(resolve => setTimeout(resolve, pollInterval));
        }

        statusResult = await apiGet(`/api/tally/pdf/status/${requestId}`);

        if (statusResult && statusResult.status === 'ready' && statusResult.pdf_base64) {
          console.log(`PDF ready after ${attempts + 1} attempt(s)`);
          break;
        }

        if (statusResult && statusResult.status === 'error') {
          throw new Error(statusResult?.message || 'PDF generation failed');
        }

        attempts++;
        console.log(`PDF status: ${statusResult?.status || 'unknown'}, attempt ${attempts}/${maxAttempts}`);
      }

      // Step 3: Verify PDF is ready
      if (!statusResult || statusResult.status !== 'ready' || !statusResult.pdf_base64) {
        throw new Error(statusResult?.message || 'PDF generation timed out. Please try again later.');
      }

      // Step 4: Decode base64 and download PDF
      const pdfBase64 = statusResult.pdf_base64;
      
      if (!pdfBase64 || typeof pdfBase64 !== 'string') {
        throw new Error('Invalid PDF data received from server');
      }

      console.log('PDF base64 length:', pdfBase64.length);
      
      // Convert base64 to binary
      let binaryString;
      try {
        binaryString = atob(pdfBase64);
      } catch (error) {
        throw new Error('Failed to decode PDF data. The PDF may be corrupted.');
      }
      
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Create blob and download
      const blob = new Blob([bytes], { type: 'application/pdf' });
      
      // Verify blob size (should be > 0)
      if (blob.size === 0) {
        throw new Error('Generated PDF is empty. Please try again.');
      }
      
      console.log('PDF blob size:', blob.size, 'bytes');
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // Generate filename from voucher number if available
      // Try multiple possible fields for voucher number
      const voucherNumber = voucherDetailsData?.VOUCHERS?.VOUCHERNUMBER || 
                           voucherDetailsData?.VOUCHERS?.vouchernumber || 
                           masterId;
      
      // Sanitize filename: replace invalid characters (/, \, :, *, ?, ", <, >, |) with underscores
      const sanitizedVoucherNumber = String(voucherNumber).replace(/[\/\\:*?"<>|]/g, '_');
      a.download = `Voucher_${sanitizedVoucherNumber}.pdf`;
      
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      console.log('PDF downloaded successfully:', a.download);

    } catch (error) {
      console.error('Error downloading PDF:', error);
      alert(`❌ Error downloading PDF: ${error.message}`);
    } finally {
      setIsDownloadingPDF(false);
    }
  };

  // Fetch voucher details
  useEffect(() => {
    const fetchVoucherDetails = async () => {
      if (!masterId) {
        setError('Master ID is required');
        return;
      }

      try {
        const companyInfo = getCompanyInfo();
        setLoading(true);
        setError(null);
        setVoucherDetailsData(null);

        const payload = {
          tallyloc_id: companyInfo.tallyloc_id,
          company: companyInfo.company,
          guid: companyInfo.guid,
          masterid: String(masterId)
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
                RATEUOM: item.rateuom || item.rateUOM || item.RATEUOM || '', // Rate UOM from API
                DESCRIPTION: item.description || '', // Item User Description from API
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
          setError(null);
        } else {
          setError('Voucher details not found');
          setVoucherDetailsData(null);
        }
      } catch (err) {
        console.error('Error fetching voucher details:', err);
        const errorMessage = err.message || 'Failed to fetch voucher details. Please try again.';
        setError(errorMessage);
        setVoucherDetailsData(null);
      } finally {
        setLoading(false);
      }
    };

    if (masterId) {
      fetchVoucherDetails();
    }
  }, [masterId]);

  // Create download PDF button
  const downloadPDFButton = masterId ? (
    <button
      onClick={downloadPDF}
      disabled={isDownloadingPDF || loading}
      style={{
        background: isDownloadingPDF || loading ? '#cbd5e1' : '#3b82f6',
        color: '#fff',
        border: 'none',
        cursor: isDownloadingPDF || loading ? 'not-allowed' : 'pointer',
        padding: '10px 20px',
        borderRadius: '8px',
        fontSize: 14,
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        transition: 'background 0.2s',
        opacity: isDownloadingPDF || loading ? 0.7 : 1,
        whiteSpace: 'nowrap'
      }}
      onMouseEnter={(e) => {
        if (!isDownloadingPDF && !loading) {
          e.currentTarget.style.background = '#2563eb';
        }
      }}
      onMouseLeave={(e) => {
        if (!isDownloadingPDF && !loading) {
          e.currentTarget.style.background = '#3b82f6';
        }
      }}
    >
      <span className="material-icons" style={{ fontSize: 18 }}>
        {isDownloadingPDF ? 'hourglass_empty' : 'download'}
      </span>
      {isDownloadingPDF ? 'Downloading...' : 'Download PDF'}
    </button>
  ) : null;

  // Create header actions (approve/reject buttons) if showApproveReject is true
  const approveRejectActions = showApproveReject ? (
    <>
      {/* Authorize Button */}
      <button
        onClick={onApprove}
        disabled={isAuthorizing || isRejecting || voucherStatus === 'Authorized'}
        style={{
          background: isAuthorizing || isRejecting || voucherStatus === 'Authorized' ? '#94a3b8' : 'linear-gradient(135deg, #F27020 0%, #e55a00 100%)',
          border: 'none',
          borderRadius: '8px',
          padding: '10px 16px',
          cursor: isAuthorizing || isRejecting || voucherStatus === 'Authorized' ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: '#fff',
          fontSize: '14px',
          fontWeight: '600',
          transition: 'all 0.2s ease',
          boxShadow: '0 2px 4px rgba(242, 112, 32, 0.3)',
          opacity: isAuthorizing || isRejecting || voucherStatus === 'Authorized' ? 0.7 : 1,
          whiteSpace: 'nowrap'
        }}
        onMouseEnter={(e) => {
          if (!isAuthorizing && !isRejecting && voucherStatus !== 'Authorized') {
            e.target.style.background = 'linear-gradient(135deg, #e55a00 0%, #cc4a00 100%)';
            e.target.style.boxShadow = '0 4px 8px rgba(242, 112, 32, 0.4)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isAuthorizing && !isRejecting && voucherStatus !== 'Authorized') {
            e.target.style.background = 'linear-gradient(135deg, #F27020 0%, #e55a00 100%)';
            e.target.style.boxShadow = '0 2px 4px rgba(242, 112, 32, 0.3)';
          }
        }}
      >
        <span className="material-icons" style={{ fontSize: '18px' }}>check_circle</span>
        {isAuthorizing ? 'Authorizing...' : 'Authorize'}
      </button>
      {/* Reject Button */}
      <button
        onClick={onReject}
        disabled={isRejecting || isAuthorizing || voucherStatus === 'Authorized'}
        style={{
          background: isRejecting || isAuthorizing || voucherStatus === 'Authorized' ? '#94a3b8' : 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
          border: 'none',
          borderRadius: '8px',
          padding: '10px 16px',
          cursor: isRejecting || isAuthorizing || voucherStatus === 'Authorized' ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: '#fff',
          fontSize: '14px',
          fontWeight: '600',
          transition: 'all 0.2s ease',
          boxShadow: '0 2px 4px rgba(220, 38, 38, 0.3)',
          opacity: isRejecting || isAuthorizing || voucherStatus === 'Authorized' ? 0.7 : 1,
          whiteSpace: 'nowrap'
        }}
        onMouseEnter={(e) => {
          if (!isRejecting && !isAuthorizing && voucherStatus !== 'Authorized') {
            e.target.style.background = 'linear-gradient(135deg, #b91c1c 0%, #991b1b 100%)';
            e.target.style.boxShadow = '0 4px 8px rgba(220, 38, 38, 0.4)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isRejecting && !isAuthorizing && voucherStatus !== 'Authorized') {
            e.target.style.background = 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)';
            e.target.style.boxShadow = '0 2px 4px rgba(220, 38, 38, 0.3)';
          }
        }}
      >
        <span className="material-icons" style={{ fontSize: '18px' }}>cancel</span>
        {isRejecting ? 'Rejecting...' : 'Reject'}
      </button>
    </>
  ) : null;

  // Combine external header actions with download PDF, approve/reject actions (if any)
  const combinedHeaderActions = (
    <>
      {downloadPDFButton}
      {externalHeaderActions}
      {approveRejectActions}
    </>
  );

  // Render the base modal with optional header actions
  return (
    <VoucherDetailsModalBase
      voucherData={voucherDetailsData}
      loading={loading}
      error={error}
      onClose={onClose}
      headerActions={combinedHeaderActions}
    />
  );
};

export default VoucherDetailsModal;

