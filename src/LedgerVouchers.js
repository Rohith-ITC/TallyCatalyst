import React, { useEffect, useState } from 'react';
import LedgerHeader from './LedgerHeader';
import './AdminHomeResponsive.css';
import { getApiUrl } from './config';
import { apiPost } from './utils/apiUtils';

function LedgerVouchers() {
  // Get current date and first day of month in YYYY-MM-DD
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const firstDay = `${yyyy}-${mm}-01`;
  const todayStr = `${yyyy}-${mm}-${dd}`;

  const [company, setCompany] = useState('');
  const [ledger, setLedger] = useState('');
  const [fromDate, setFromDate] = useState(firstDay);
  const [toDate, setToDate] = useState(todayStr);
  const [companyOptions, setCompanyOptions] = useState([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [companyError, setCompanyError] = useState('');
  const [ledgerOptions, setLedgerOptions] = useState([]);
  const [loadingLedgers, setLoadingLedgers] = useState(false);
  const [ledgerError, setLedgerError] = useState('');
  const [tableData, setTableData] = useState([]);
  const [openingBalance, setOpeningBalance] = useState({ DEBITAMT: '', CREDITAMT: '' });
  const [closingBalance, setClosingBalance] = useState({ DEBITAMT: '', CREDITAMT: '' });
  const [tableLoading, setTableLoading] = useState(false);
  const [tableError, setTableError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  useEffect(() => {
    async function fetchCompanies() {
      setLoadingCompanies(true);
      setCompanyError('');
      try {
        const tallyConfig = JSON.parse(localStorage.getItem('tallyConfig')) || {};
        const user = JSON.parse(localStorage.getItem('user')) || {};
        const username = user.username || 'default';
        const cacheKey = `tallyCompaniesCache_${username}`;
        const cacheTTL = 60 * 60 * 1000; // 1 hour
        const cached = JSON.parse(localStorage.getItem(cacheKey) || '{}');
        const now = Date.now();
        if (cached.data && cached.timestamp && (now - cached.timestamp < cacheTTL)) {
          setCompanyOptions(cached.data);
          if (cached.data.length === 1) setCompany(cached.data[0].value);
          setLoadingCompanies(false);
          return;
        }
        // Not cached or expired, fetch from API
        const payload = {
          ip: tallyConfig.ipAddress || 'localhost',
          port: tallyConfig.portNumber || '9005',
          loginuser: user.username || '',
        };
        const data = await apiPost('/api/tally/companies', payload);
        if (!data) throw new Error('Failed to fetch companies');
        // Extract companies from nested response
        const companies = (((data || {}).data || {}).ENVELOPE || {}).BODY?.COMPANY || [];
        const mapped = companies.map(company => ({ value: company.NAME, label: company.MAILINGNAME || company.NAME }));
        setCompanyOptions(mapped);
        if (mapped.length === 1) setCompany(mapped[0].value);
        // Store in cache
        localStorage.setItem(cacheKey, JSON.stringify({ data: mapped, timestamp: now }));
      } catch (err) {
        setCompanyError('Could not load companies');
        setCompanyOptions([]);
      } finally {
        setLoadingCompanies(false);
      }
    }
    fetchCompanies();
  }, []);

  // Fetch ledgers when company changes
  useEffect(() => {
    if (!company) {
      setLedgerOptions([]);
      setLedger('');
      return;
    }
    async function fetchLedgers() {
      setLoadingLedgers(true);
      setLedgerError('');
      try {
        const tallyConfig = JSON.parse(localStorage.getItem('tallyConfig')) || {};
        const user = JSON.parse(localStorage.getItem('user')) || {};
        const username = user.username || 'default';
        const cacheKey = `tallyLedgersCache_${username}_${company}`;
        const cacheTTL = 60 * 60 * 1000; // 1 hour
        const cached = JSON.parse(localStorage.getItem(cacheKey) || '{}');
        const now = Date.now();
        if (cached.data && cached.timestamp && (now - cached.timestamp < cacheTTL)) {
          setLedgerOptions(cached.data);
          if (cached.data.length === 1) setLedger(cached.data[0].value);
          setLoadingLedgers(false);
          return;
        }
        // Find the selected company NAME (not mailing name)
        const selectedCompany = companyOptions.find(opt => opt.value === company);
        const payload = {
          ip: tallyConfig.ipAddress || 'localhost',
          port: tallyConfig.portNumber || '9005',
          company: selectedCompany ? selectedCompany.value : company,
          loginid: user.username || '',
        };
        const data = await apiPost('/api/tally/ledgers', payload);
        if (!data) throw new Error('Failed to fetch ledgers');
        // Assume data is an array of objects with NAME and MAILINGNAME
        const ledgers = (((data || {}).data || {}).ENVELOPE || {}).BODY?.LEDGER || [];
        const mapped = ledgers.map(ledger => ({ value: ledger.NAME, label: ledger.MAILINGNAME || ledger.NAME }));
        setLedgerOptions(mapped);
        if (mapped.length === 1) setLedger(mapped[0].value);
        localStorage.setItem(cacheKey, JSON.stringify({ data: mapped, timestamp: now }));
      } catch (err) {
        setLedgerError('Could not load ledgers');
        setLedgerOptions([]);
      } finally {
        setLoadingLedgers(false);
      }
    }
    fetchLedgers();
  }, [company, companyOptions]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTableLoading(true);
    setTableError('');
    setTableData([]);
    try {
      // Format dates as DD-MMM-YY (e.g., 01-Apr-24)
      function formatDate(dateStr) {
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const [yyyy, mm, dd] = dateStr.split('-');
        return `${parseInt(dd)}-${months[parseInt(mm)-1]}-${yyyy.slice(2)}`;
      }
      const tallyConfig = JSON.parse(localStorage.getItem('tallyConfig')) || {};
      const user = JSON.parse(localStorage.getItem('user')) || {};
      const payload = {
        ip: tallyConfig.ipAddress || 'localhost',
        port: tallyConfig.portNumber || '9005',
        company,
        ledger,
        fromdate: formatDate(fromDate),
        todate: formatDate(toDate),
        loginid: user.username || ''
      };
              const data = await apiPost('/api/tally/ledgervouchers', payload);
        if (!data) throw new Error('Failed to fetch vouchers');
      const envelope = (((data || {}).data || {}).ENVELOPE || {});
      const body = envelope.BODY || {};
      const rows = body.DATA || [];
      setTableData(rows);
      setOpeningBalance(body.OPENING || { DEBITAMT: '', CREDITAMT: '' });
      setClosingBalance(body.CLOSING || { DEBITAMT: '', CREDITAMT: '' });
      setCurrentPage(1); // Reset to first page on new data
    } catch (err) {
      setTableError('Could not load vouchers');
    } finally {
      setTableLoading(false);
    }
  };

  // Export and Print Handlers
  const handleExport = (format) => {
    if (!tableData.length) return;
    // Get display values for company and ledger
    const companyLabel = (companyOptions.find(opt => opt.value === company)?.label) || company;
    const ledgerLabel = (ledgerOptions.find(opt => opt.value === ledger)?.label) || ledger;
    // Format dates as DD-MMM-YY
    function formatDate(dateStr) {
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const [yyyy, mm, dd] = dateStr.split('-');
      return `${parseInt(dd)}-${months[parseInt(mm)-1]}-${yyyy.slice(2)}`;
    }
    // Define columns and headers
    const headers = [
      'Date', 'Particulars', 'Voucher Type', 'Voucher No', 'Debit Amount', 'Credit Amount'
    ];
    const keys = [
      'DATE', 'PARTICULARS', 'VCHTYPE', 'VCHNO', 'DEBITAMT', 'CREDITAMT'
    ];
    // Build rows
    const rows = tableData.map(row => keys.map(k => row[k]));
    // CSV/Excel export
    if (format === 'csv' || format === 'excel') {
      let csvContent = '';
      csvContent += `Company:,"${companyLabel}"
`;
      csvContent += `Ledger:,"${ledgerLabel}"
`;
      csvContent += `From Date:,"${formatDate(fromDate)}"
`;
      csvContent += `To Date:,"${formatDate(toDate)}"
`;
      csvContent += '\n';
      csvContent += headers.join(',') + '\n';
      rows.forEach(rowArr => {
        csvContent += rowArr.map(val => '"' + String(val).replace(/"/g, '""') + '"').join(',') + '\n';
      });
      // Add summary rows
      // Opening Balance
      csvContent += [
        '',
        'Opening Balance',
        '',
        '',
        '"' + (openingBalance.DEBITAMT || '') + '"',
        '"' + (openingBalance.CREDITAMT || '') + '"'
      ].join(',') + '\n';
      // Current Total
      csvContent += [
        '',
        'Current Total',
        '',
        '',
        '"' + totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 }) + '"',
        '"' + totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 }) + '"'
      ].join(',') + '\n';
      // Closing Balance
      csvContent += [
        '',
        'Closing Balance',
        '',
        '',
        '"' + (closingBalance.DEBITAMT || '') + '"',
        '"' + (closingBalance.CREDITAMT || '') + '"'
      ].join(',') + '\n';
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = format === 'csv' ? 'ledger-vouchers.csv' : 'ledger-vouchers.xls';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return;
    }
    // PDF export not supported without dependencies
    if (format === 'pdf') {
      alert('PDF export is not supported without additional dependencies.');
      return;
    }
  };

  // Print Handler
  const handlePrint = () => {
    // Get display values for company and ledger
    const companyLabel = (companyOptions.find(opt => opt.value === company)?.label) || company;
    const ledgerLabel = (ledgerOptions.find(opt => opt.value === ledger)?.label) || ledger;
    function formatDate(dateStr) {
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const [yyyy, mm, dd] = dateStr.split('-');
      return `${parseInt(dd)}-${months[parseInt(mm)-1]}-${yyyy.slice(2)}`;
    }
    // Build full table HTML with all rows and multi-row thead for repeating header
    let tableHtml = `<table style='border-collapse:collapse;width:100%;min-width:900px;background:#fff;'>`;
    tableHtml += `<thead>`;
    tableHtml += `<tr><th colspan='6' style='font-size:16px;color:#1e293b;padding:8px 12px;text-align:left;border:1px solid #e2e8f0;background:#fff;'>`;
    tableHtml += `<span style='min-width:320px;display:inline-block'><b>Company:</b> ${companyLabel}</span>`;
    tableHtml += `<span style='min-width:220px;display:inline-block;text-align:right;float:right'><b>Ledger:</b> ${ledgerLabel}</span>`;
    tableHtml += `</th></tr>`;
    tableHtml += `<tr><th colspan='6' style='font-size:16px;color:#1e293b;padding:8px 12px;text-align:right;border:1px solid #e2e8f0;background:#fff;'>`;
    tableHtml += `<span style='min-width:220px;text-align:right;display:inline-block'><b>Period:</b> ${formatDate(fromDate)}&nbsp;&nbsp;&nbsp;<b>To:</b> ${formatDate(toDate)}</span>`;
    tableHtml += `</th></tr>`;
    tableHtml += `<tr style='background:#f1f5f9;color:#1e293b;'>`;
    tableHtml += `<th style='padding:8px 12px;border:1px solid #e2e8f0;text-align:right;width:90px;'>Date</th>`;
    tableHtml += `<th style='padding:8px 12px;border:1px solid #e2e8f0;width:300px;'>Particulars</th>`;
    tableHtml += `<th style='padding:8px 12px;border:1px solid #e2e8f0;width:120px;'>Voucher Type</th>`;
    tableHtml += `<th style='padding:8px 12px;border:1px solid #e2e8f0;width:120px;'>Voucher No</th>`;
    tableHtml += `<th style='padding:8px 12px;border:1px solid #e2e8f0;width:110px;'>Debit Amount</th>`;
    tableHtml += `<th style='padding:8px 12px;border:1px solid #e2e8f0;width:110px;'>Credit Amount</th>`;
    tableHtml += `</tr></thead><tbody>`;
    tableData.forEach(row => {
      tableHtml += `<tr>`;
      tableHtml += `<td style='padding:8px 12px;border:1px solid #e2e8f0;text-align:right;width:90px;'>${row.DATE || ''}</td>`;
      tableHtml += `<td style='padding:8px 12px;border:1px solid #e2e8f0;width:300px;'>${row.PARTICULARS || ''}</td>`;
      tableHtml += `<td style='padding:8px 12px;border:1px solid #e2e8f0;width:120px;'>${row.VCHTYPE || ''}</td>`;
      tableHtml += `<td style='padding:8px 12px;border:1px solid #e2e8f0;width:120px;'>${row.VCHNO || ''}</td>`;
      tableHtml += `<td style='padding:8px 12px;border:1px solid #e2e8f0;width:110px;text-align:right;'>${row.DEBITAMT || ''}</td>`;
      tableHtml += `<td style='padding:8px 12px;border:1px solid #e2e8f0;width:110px;text-align:right;'>${row.CREDITAMT || ''}</td>`;
      tableHtml += `</tr>`;
    });
    // Summary rows
    tableHtml += `<tr><td style='border:none'></td><td style='padding:8px 12px;border:1px solid #e2e8f0;width:300px;font-weight:600'>Opening Balance</td><td style='border:none'></td><td style='border:none'></td><td style='border:1px solid #e2e8f0;text-align:right;font-weight:600;width:110px;padding-right:1ch'>${openingBalance.DEBITAMT}</td><td style='border:1px solid #e2e8f0;text-align:right;font-weight:600;width:110px;padding-right:1ch'>${openingBalance.CREDITAMT}</td></tr>`;
    tableHtml += `<tr><td style='border:none'></td><td style='padding:8px 12px;border:1px solid #e2e8f0;width:300px;font-weight:600'>Current Total</td><td style='border:none'></td><td style='border:none'></td><td style='border:1px solid #e2e8f0;text-align:right;font-weight:600;width:110px;padding-right:1ch'>${totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td><td style='border:1px solid #e2e8f0;text-align:right;font-weight:600;width:110px;padding-right:1ch'>${totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr>`;
    tableHtml += `<tr><td style='border:none'></td><td style='padding:8px 12px;border:1px solid #e2e8f0;width:300px;font-weight:600'>Closing Balance</td><td style='border:none'></td><td style='border:none'></td><td style='border:1px solid #e2e8f0;text-align:right;font-weight:600;width:110px;padding-right:1ch'>${closingBalance.DEBITAMT}</td><td style='border:1px solid #e2e8f0;text-align:right;font-weight:600;width:110px;padding-right:1ch'>${closingBalance.CREDITAMT}</td></tr>`;
    tableHtml += `</tbody></table>`;
    const printContents = tableHtml;
    const win = window.open('', '', 'height=700,width=1000');
    win.document.write('<html><head><title>Ledger Vouchers</title>');
    win.document.write('<style>table { border-collapse: collapse; width: 100%; } th, td { border: 1px solid #e2e8f0; padding: 8px 12px; } th { background: #f1f5f9; color: #1e293b; }</style>');
    win.document.write('</head><body >');
    win.document.write(printContents);
    win.document.write('</body></html>');
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 500);
  };

  // Calculate overall totals for Current Total row
  const totalDebit = tableData.reduce((sum, row) => sum + (parseFloat((row.DEBITAMT || '0').replace(/,/g, '')) || 0), 0);
  const totalCredit = tableData.reduce((sum, row) => sum + (parseFloat((row.CREDITAMT || '0').replace(/,/g, '')) || 0), 0);

  return (
    <div style={{ width: '100%', minHeight: '100%', padding: '32px 24px 0 24px', boxSizing: 'border-box' }}>
      <h2 style={{ color: '#1e40af', fontWeight: 700, marginBottom: 24, textAlign: 'left' }}>Ledger Vouchers</h2>
      <LedgerHeader
        company={company}
        ledger={ledger}
        fromDate={fromDate}
        toDate={toDate}
        companyOptions={companyOptions}
        ledgerOptions={ledgerOptions}
        onCompanyChange={e => {
          setCompany(e.target.value);
          setLedger('');
          setLedgerOptions([]);
        }}
        onLedgerChange={e => setLedger(e.target.value)}
        onFromDateChange={e => setFromDate(e.target.value)}
        onToDateChange={e => setToDate(e.target.value)}
        onSubmit={handleSubmit}
        submitLabel="Submit"
      />
      {loadingCompanies && <div style={{ color: '#888', marginTop: 8 }}>Loading companies...</div>}
      {companyError && <div style={{ color: 'red', marginTop: 8 }}>{companyError}</div>}
      {loadingLedgers && <div style={{ color: '#888', marginTop: 8 }}>Loading ledgers...</div>}
      {ledgerError && <div style={{ color: 'red', marginTop: 8 }}>{ledgerError}</div>}
      {/* Divider after submit before report table */}
      <hr style={{ margin: '32px 0 24px 0', border: 0, borderTop: '1px solid #e2e8f0' }} />
      {tableLoading && <div style={{ color: '#888', marginTop: 16 }}>Loading vouchers...</div>}
      {tableError && <div style={{ color: 'red', marginTop: 16 }}>{tableError}</div>}
      {tableData.length > 0 && (
        <div style={{ marginTop: 0, overflowX: 'auto' }}>
          {/* Export and Print controls */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <button style={{ padding: '6px 18px', borderRadius: 4, border: '1px solid #cbd5e1', background: '#fff', color: '#1e293b', fontWeight: 500, cursor: 'pointer' }}
              onClick={() => handleExport('csv')}
            >
              Export CSV
            </button>
            <button style={{ padding: '6px 18px', borderRadius: 4, border: '1px solid #cbd5e1', background: '#fff', color: '#1e293b', fontWeight: 500, cursor: 'pointer' }}
              onClick={handlePrint}
            >
              Print
            </button>
          </div>
          <table id="ledger-voucher-table-print" style={{ borderCollapse: 'collapse', width: '100%', minWidth: 900, background: '#fff' }}>
            <thead>
              <tr style={{ background: '#f1f5f9', color: '#1e293b' }}>
                <th style={{ padding: '8px 12px', border: '1px solid #e2e8f0', textAlign: 'right', width: 90 }}>Date</th>
                <th style={{ padding: '8px 12px', border: '1px solid #e2e8f0', width: 300 }}>Particulars</th>
                <th style={{ padding: '8px 12px', border: '1px solid #e2e8f0', width: 120 }}>Voucher Type</th>
                <th style={{ padding: '8px 12px', border: '1px solid #e2e8f0', width: 120}}>Voucher No</th>
                <th style={{ padding: '8px 12px', border: '1px solid #e2e8f0', width: 110 }}>Debit Amount</th>
                <th style={{ padding: '8px 12px', border: '1px solid #e2e8f0', width: 110 }}>Credit Amount</th>
              </tr>
            </thead>
            <tbody>
              {/* Data rows */}
              {tableData.slice((currentPage-1)*rowsPerPage, currentPage*rowsPerPage).map((row, idx) => (
                <tr key={row.MASTERID || ((currentPage-1)*rowsPerPage+idx)}>
                  <td style={{ padding: '8px 12px', border: '1px solid #e2e8f0', textAlign: 'right', width: 90 }}>{row.DATE}</td>
                  <td style={{ padding: '8px 12px', border: '1px solid #e2e8f0', width: 300 }}>{row.PARTICULARS}</td>
                  <td style={{ padding: '8px 12px', border: '1px solid #e2e8f0', width: 120 }}>{row.VCHTYPE}</td>
                  <td style={{ padding: '8px 12px', border: '1px solid #e2e8f0', width: 120 }}>{row.VCHNO}</td>
                  <td style={{ padding: '8px 12px', border: '1px solid #e2e8f0', width: 110, textAlign: 'right' }}>{row.DEBITAMT}</td>
                  <td style={{ padding: '8px 12px', border: '1px solid #e2e8f0', width: 110, textAlign: 'right' }}>{row.CREDITAMT}</td>
                </tr>
              ))}
              {/* Summary lines below data, under 'Particulars' column */}
              <tr>
                <td style={{ border: 'none' }}></td>
                <td style={{ padding: '8px 12px', border: '1px solid #e2e8f0', width: 300, fontWeight: 600 }}>Opening Balance</td>
                <td style={{ border: 'none' }}></td>
                <td style={{ border: 'none' }}></td>
                <td style={{ border: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 600, width: 110, paddingRight: '1ch' }}>{openingBalance.DEBITAMT}</td>
                <td style={{ border: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 600, width: 110, paddingRight: '1ch' }}>{openingBalance.CREDITAMT}</td>
              </tr>
              {/* Calculate current page totals */}
              <tr>
                <td style={{ border: 'none' }}></td>
                <td style={{ padding: '8px 12px', border: '1px solid #e2e8f0', width: 300, fontWeight: 600 }}>Current Total</td>
                <td style={{ border: 'none' }}></td>
                <td style={{ border: 'none' }}></td>
                <td style={{ border: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 600, width: 110, paddingRight: '1ch' }}>{totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                <td style={{ border: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 600, width: 110, paddingRight: '1ch' }}>{totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              </tr>
              <tr>
                <td style={{ border: 'none' }}></td>
                <td style={{ padding: '8px 12px', border: '1px solid #e2e8f0', width: 300, fontWeight: 600 }}>Closing Balance</td>
                <td style={{ border: 'none' }}></td>
                <td style={{ border: 'none' }}></td>
                <td style={{ border: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 600, width: 110, paddingRight: '1ch' }}>{closingBalance.DEBITAMT}</td>
                <td style={{ border: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 600, width: 110, paddingRight: '1ch' }}>{closingBalance.CREDITAMT}</td>
              </tr>
            </tbody>
          </table>
         {/* Pagination Controls */}
         <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: 16, gap: 12 }}>
           <button
             onClick={() => setCurrentPage(p => Math.max(1, p-1))}
             disabled={currentPage === 1}
             style={{ padding: '6px 14px', borderRadius: 4, border: '1px solid #cbd5e1', background: currentPage === 1 ? '#f1f5f9' : '#fff', color: '#1e293b', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
           >
             Previous
           </button>
           {/* Page Numbers */}
           {Array.from({ length: Math.ceil(tableData.length / rowsPerPage) }, (_, i) => i + 1).map(pageNum => (
             <button
               key={pageNum}
               onClick={() => setCurrentPage(pageNum)}
               style={{
                 padding: '6px 12px',
                 borderRadius: 4,
                 border: '1px solid #cbd5e1',
                 background: currentPage === pageNum ? '#1e40af' : '#fff',
                 color: currentPage === pageNum ? '#fff' : '#1e293b',
                 fontWeight: currentPage === pageNum ? 700 : 500,
                 cursor: currentPage === pageNum ? 'default' : 'pointer',
                 margin: '0 2px',
                 minWidth: 32,
               }}
               disabled={currentPage === pageNum}
             >
               {pageNum}
             </button>
           ))}
           <button
             onClick={() => setCurrentPage(p => Math.min(Math.ceil(tableData.length/rowsPerPage), p+1))}
             disabled={currentPage === Math.ceil(tableData.length/rowsPerPage)}
             style={{ padding: '6px 14px', borderRadius: 4, border: '1px solid #cbd5e1', background: currentPage === Math.ceil(tableData.length/rowsPerPage) ? '#f1f5f9' : '#fff', color: '#1e293b', cursor: currentPage === Math.ceil(tableData.length/rowsPerPage) ? 'not-allowed' : 'pointer' }}
           >
             Next
           </button>
         </div>
        </div>
      )}
    </div>
  );
}

export default LedgerVouchers; 