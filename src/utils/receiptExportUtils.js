import * as XLSX from 'xlsx';

const formatAmount = (amount) => {
  if (!amount) return '0.00';
  const num = parseFloat(amount);
  if (isNaN(num)) return '0.00';
  return num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export const exportReceiptsToExcel = ({
  receipts,
  company,
  fromDate,
  toDate,
}) => {
  if (!receipts || receipts.length === 0) {
    alert('No receipts to export');
    return;
  }

  // Create metadata sheet
  const metadataSheet = [
    ['Receipt Cache Export'],
    [''],
    ['Company:', company.company || company.conn_name || ''],
    ['Export Date:', new Date().toLocaleString('en-IN')],
    ['Period From:', fromDate],
    ['Period To:', toDate],
    ['Total Receipts:', receipts.length.toString()],
    [''],
    ['Note: This file can be used as a cache to avoid querying Tally repeatedly.'],
    ['The data includes all receipts for the selected period with 5-day chunking.'],
  ];

  // Create receipts data sheet
  const headers = [
    'Date',
    'Voucher No',
    'Voucher Type',
    'Customer',
    'Bank',
    'Amount',
    'Narration',
    'Master ID',
  ];

  const receiptsData = receipts.map((receipt) => [
    receipt.Dates || '',
    receipt.InvNo || '',
    receipt.VoucherType || '',
    receipt.Customer || '',
    receipt.Bank || '',
    receipt.Amount ? formatAmount(receipt.Amount) : '0.00',
    receipt.Narration || '',
    receipt.MasterID || '',
  ]);

  const worksheetData = [headers, ...receiptsData];

  // Create workbook with two sheets
  const workbook = XLSX.utils.book_new();

  // Add metadata sheet
  const metadataWorksheet = XLSX.utils.aoa_to_sheet(metadataSheet);
  XLSX.utils.book_append_sheet(workbook, metadataWorksheet, 'Metadata');

  // Add receipts sheet
  const receiptsWorksheet = XLSX.utils.aoa_to_sheet(worksheetData);
  
  // Set column widths for better readability
  const columnWidths = [
    { wch: 12 }, // Date
    { wch: 15 }, // Voucher No
    { wch: 15 }, // Voucher Type
    { wch: 30 }, // Customer
    { wch: 30 }, // Bank
    { wch: 15 }, // Amount
    { wch: 50 }, // Narration
    { wch: 20 }, // Master ID
  ];
  receiptsWorksheet['!cols'] = columnWidths;

  XLSX.utils.book_append_sheet(workbook, receiptsWorksheet, 'Receipts');

  // Generate filename with company name, date range, and timestamp to avoid overwriting
  const companyName = (company.company || company.conn_name || 'Receipts')
    .replace(/[^a-z0-9]/gi, '_')
    .substring(0, 30);
  const fromDateStr = fromDate.replace(/-/g, '');
  const toDateStr = toDate.replace(/-/g, '');
  // Add timestamp (YYYYMMDD_HHMMSS) to make filename unique and prevent overwriting
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const timestamp = `${year}${month}${day}_${hours}${minutes}${seconds}`;
  const fileName = `${companyName}_Receipts_${fromDateStr}_to_${toDateStr}_${timestamp}.xlsx`;

  // Write file
  try {
    XLSX.writeFile(workbook, fileName);
    // Show success message with filename
    console.log('File exported successfully:', fileName);
    alert(`File saved successfully!\n\nFilename: ${fileName}\n\nLocation: Your browser's default download folder (usually Downloads).\n\nIf you don't see it, check your browser's download settings or download history.`);
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    alert(`Error exporting file: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease check the browser console for more details.`);
  }
};
