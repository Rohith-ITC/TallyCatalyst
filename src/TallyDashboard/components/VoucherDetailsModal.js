import React, { useState, useEffect } from 'react';
import { apiPost } from '../../utils/apiUtils';
import VoucherDetailsModalBase from '../../RecvDashboard/components/VoucherDetailsModal';

const VoucherDetailsModal = ({
  masterId,
  onClose,
  showApproveReject = false,
  onApprove,
  onReject,
  isAuthorizing = false,
  isRejecting = false,
  voucherStatus = null
}) => {
  const [voucherDetailsData, setVoucherDetailsData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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

  // Create header actions (approve/reject buttons) if showApproveReject is true
  const headerActions = showApproveReject ? (
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

  // Render the base modal with optional header actions
  return (
    <VoucherDetailsModalBase
      voucherData={voucherDetailsData}
      loading={loading}
      error={error}
      onClose={onClose}
      headerActions={headerActions}
    />
  );
};

export default VoucherDetailsModal;

