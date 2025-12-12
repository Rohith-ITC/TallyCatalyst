import jsPDF from 'jspdf';
import 'jspdf-autotable';

/**
 * Generate PDF for order in ledger statement format
 * @param {Object} orderData - Order data object
 * @returns {jsPDF} PDF document
 */
function generateOrderPdf(orderData) {
  const {
    orderItems = [],
    selectedCustomer = '',
    selectedCustomerObj = {},
    currentCompany = {},
    orderDate = new Date(),
    voucherNumber = '',
    voucherType = '',
    buyerOrderRef = '',
    paymentTerms = '',
    deliveryTerms = '',
    narration = '',
    editableAddress = '',
    editableState = '',
    editableCountry = '',
    editableGstNo = '',
    editablePincode = ''
  } = orderData;

  // Create PDF document (A4 size)
  const doc = new jsPDF('portrait', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let yPos = margin;

  // Helper function to format currency (Indian format with 2 decimal places, but show 0.0 for zero)
  const formatCurrency = (amount) => {
    const num = parseFloat(amount || 0);
    if (num === 0) {
      return '0.0'; // Show 0.0 instead of 0.00 for zero values
    }
    // Indian number format: 87,281.26 (always 2 decimal places)
    return num.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      useGrouping: true
    });
  };

  // Helper function to format date (DD-MMM-YY format)
  const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const day = d.getDate();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const year = String(d.getFullYear()).slice(-2);
    return `${day}-${month}-${year}`;
  };

  // Header - Issuing Company (Current Company)
  const issuingCompanyName = currentCompany.company || currentCompany.conn_name || '';
  const issuingCompanyAddress = currentCompany.address || '';
  const issuingCompanyEmail = currentCompany.email || '';
  
  // Company name - bold, larger
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(issuingCompanyName, margin, yPos);
  yPos += 6;

  // Company address - single line (no splitting, just replace | with space)
  if (issuingCompanyAddress) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const addressLine = issuingCompanyAddress.replace(/\|/g, ' ').trim();
    doc.text(addressLine, margin, yPos);
    yPos += 5;
  }

  // Company email - format: "E-Mail : email@domain.com"
  if (issuingCompanyEmail) {
    doc.setFontSize(10);
    doc.text(`E-Mail : ${issuingCompanyEmail}`, margin, yPos);
    yPos += 8;
  } else {
    yPos += 5;
  }

  // Subject Company (Customer) - Customer name comes FIRST, then "Ledger Account"
  const customerName = selectedCustomer || '';
  const customerAddress = editableAddress || selectedCustomerObj.ADDRESS || '';
  const customerState = editableState || selectedCustomerObj.STATENAME || '';
  const customerCountry = editableCountry || selectedCustomerObj.COUNTRY || '';
  const customerPincode = editablePincode || selectedCustomerObj.PINCODE || '';
  const customerGstNo = editableGstNo || selectedCustomerObj.GSTNO || '';
  const customerPhone = selectedCustomerObj.PHONE || '';

  // Customer name - bold, larger (comes before "Ledger Account")
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(customerName, margin, yPos);
  yPos += 6;

  // "Ledger Account" label
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Ledger Account', margin, yPos);
  yPos += 5;

  // Customer address - single line (replace | with comma)
  if (customerAddress) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    let addressLine = customerAddress.replace(/\|/g, ',').trim();
    
    // Add state, pincode, country if available
    const addressParts = [];
    if (customerState) addressParts.push(customerState);
    if (customerPincode) addressParts.push(customerPincode);
    if (customerCountry) addressParts.push(customerCountry);
    
    if (addressParts.length > 0) {
      addressLine += (addressLine ? ',' : '') + ' ' + addressParts.join(',');
    }
    
    doc.text(addressLine, margin, yPos);
    yPos += 5;
  }

  // Phone number (if exists)
  if (customerPhone) {
    doc.text(`Phone No.: ${customerPhone}`, margin, yPos);
    yPos += 5;
  }

  // GST number (if exists)
  if (customerGstNo) {
    doc.text(`GST No.: ${customerGstNo}`, margin, yPos);
    yPos += 5;
  }

  yPos += 3;

  // Date range - format as "1-Dec-25 to 8-Dec-25"
  const formattedDate = formatDate(orderDate);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`${formattedDate} to ${formattedDate}`, margin, yPos);
  yPos += 8;

  // Prepare table data
  const tableData = [];
  let totalDebit = 0;
  let totalCredit = 0;

  // Add order items as transaction rows
  // For sales orders, items go in Debit column (customer owes us)
  orderItems.forEach((item, index) => {
    const itemName = item.name || '';
    const quantity = item.quantityDisplay || item.quantity || '';
    const rate = item.rate || 0;
    const amount = item.amount || 0;
    
    // Format particulars: "To ItemName (quantity) @ rate"
    let particulars = `To ${itemName}`;
    if (quantity) {
      particulars += ` (${quantity})`;
    }
    if (rate && rate > 0) {
      particulars += ` @ ${rate.toFixed(2)}`;
    }
    
    tableData.push([
      formattedDate,
      particulars,
      voucherType || 'Sales Order',
      voucherNumber || '',
      formatCurrency(amount), // Debit - right aligned
      '' // Credit - empty
    ]);
    
    totalDebit += parseFloat(amount || 0);
  });

  // If no items, add a placeholder row
  if (tableData.length === 0) {
    tableData.push([
      formattedDate,
      'To Order',
      voucherType || 'Sales Order',
      voucherNumber || '',
      '',
      ''
    ]);
  }

  // Calculate totals
  totalCredit = 0; // For orders, typically no credit side

  // Add table using autoTable - NO "Diff in Tax Amount" column
  // Header includes "Page 1" in the Credit column: "Page 1 Credit"
  doc.autoTable({
    startY: yPos,
    head: [['Date', 'Particulars', 'Vch Type', 'Vch No.', 'Debit', 'Page 1 Credit']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [240, 240, 240],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 9,
      lineWidth: 0.1
    },
    bodyStyles: {
      fontSize: 9,
      textColor: [0, 0, 0],
      lineWidth: 0.1
    },
    columnStyles: {
      0: { cellWidth: 20, halign: 'left' }, // Date - left aligned (header and body)
      1: { cellWidth: 70, halign: 'left' }, // Particulars - left aligned (header and body)
      2: { cellWidth: 25, halign: 'left' }, // Vch Type - left aligned (header and body)
      3: { cellWidth: 25, halign: 'left' }, // Vch No. - left aligned (header and body)
      4: { cellWidth: 30, halign: 'right' }, // Debit - right aligned (header and body)
      5: { cellWidth: 30, halign: 'right' } // Credit - right aligned (header and body)
    },
    didParseCell: function (data) {
      // Ensure proper alignment for headers
      if (data.section === 'head') {
        if (data.column.index === 4 || data.column.index === 5) {
          // Debit and Credit columns - right align
          data.cell.styles.halign = 'right';
        } else {
          // Other columns - left align
          data.cell.styles.halign = 'left';
        }
      }
      // Body cells alignment is handled by columnStyles
    },
    margin: { left: margin, right: margin },
    styles: {
      cellPadding: { top: 3, right: 3, bottom: 3, left: 3 },
      overflow: 'linebreak',
      lineWidth: 0.1
    }
  });

  // Get final Y position after table
  const finalY = doc.lastAutoTable.finalY || yPos;
  yPos = finalY + 5;

  // Add summary rows - match exact format from image
  // Format: empty row, "To Closing Balance" with debit, empty row, totals row
  // Credit should show "0.00" not empty
  const summaryData = [
    ['', '', '', '', '', ''], // Empty row
    ['', 'To Closing Balance', '', '', formatCurrency(totalDebit), ''], // Closing balance with debit
    ['', '', '', '', '', ''], // Empty row
    ['', '', '', '', formatCurrency(totalDebit), formatCurrency(totalCredit)] // Totals row (Credit will be "0.00")
  ];

  doc.autoTable({
    startY: yPos,
    body: summaryData,
    theme: 'grid',
    bodyStyles: {
      fontSize: 9,
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      halign: 'left',
      lineWidth: 0.1
    },
    columnStyles: {
      0: { cellWidth: 20, halign: 'left' },
      1: { cellWidth: 70, halign: 'left' },
      2: { cellWidth: 25, halign: 'left' },
      3: { cellWidth: 25, halign: 'left' },
      4: { cellWidth: 30, halign: 'right' }, // Debit - right aligned
      5: { cellWidth: 30, halign: 'right' } // Credit - right aligned
    },
    margin: { left: margin, right: margin },
    styles: {
      cellPadding: { top: 3, right: 3, bottom: 3, left: 3 },
      lineWidth: 0.1
    }
  });

  return doc;
}

export default generateOrderPdf;
export { generateOrderPdf };
