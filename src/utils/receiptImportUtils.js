import * as XLSX from 'xlsx';

export const importReceiptsFromExcel = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result);
        const workbook = XLSX.read(data, { type: 'array' });

        // Read metadata sheet if it exists
        let metadata = {};
        if (workbook.SheetNames.includes('Metadata')) {
          const metadataSheet = workbook.Sheets['Metadata'];
          const metadataData = XLSX.utils.sheet_to_json(metadataSheet, { header: 1 });
          
          metadataData.forEach((row) => {
            if (row.length >= 2) {
              const key = String(row[0] || '').trim();
              const value = String(row[1] || '').trim();
              
              if (key === 'Company:') metadata.company = value;
              if (key === 'Export Date:') metadata.exportDate = value;
              if (key === 'Period From:') metadata.fromDate = value;
              if (key === 'Period To:') metadata.toDate = value;
              if (key === 'Total Receipts:') metadata.totalReceipts = parseInt(value, 10) || 0;
            }
          });
        }

        // Read receipts sheet
        const receiptsSheetName = workbook.SheetNames.find(name => 
          name.toLowerCase().includes('receipt')
        ) || workbook.SheetNames[0];
        
        const receiptsSheet = workbook.Sheets[receiptsSheetName];
        const receiptsData = XLSX.utils.sheet_to_json(receiptsSheet, { header: 1 });

        if (receiptsData.length < 2) {
          reject(new Error('Excel file does not contain receipt data'));
          return;
        }

        // First row is headers
        const headers = receiptsData[0].map((h) => String(h || '').trim().toLowerCase());
        
        // Find column indices
        const dateIndex = headers.findIndex(h => h.includes('date') && !h.includes('export'));
        const voucherNoIndex = headers.findIndex(h => h.includes('voucher') && (h.includes('no') || h.includes('number')));
        const voucherTypeIndex = headers.findIndex(h => h.includes('voucher') && h.includes('type'));
        const customerIndex = headers.findIndex(h => h.includes('customer'));
        const bankIndex = headers.findIndex(h => h.includes('bank'));
        const amountIndex = headers.findIndex(h => h.includes('amount'));
        const narrationIndex = headers.findIndex(h => h.includes('narration'));
        const masterIdIndex = headers.findIndex(h => h.includes('master') && h.includes('id'));

        // Parse receipts
        const receipts = [];
        for (let i = 1; i < receiptsData.length; i++) {
          const row = receiptsData[i];
          if (!row || row.length === 0) continue;

          const receipt = {};
          
          if (dateIndex !== -1 && row[dateIndex]) {
            receipt.Dates = String(row[dateIndex]).trim();
          }
          if (voucherNoIndex !== -1 && row[voucherNoIndex]) {
            receipt.InvNo = String(row[voucherNoIndex]).trim();
          }
          if (voucherTypeIndex !== -1 && row[voucherTypeIndex]) {
            receipt.VoucherType = String(row[voucherTypeIndex]).trim();
          }
          if (customerIndex !== -1 && row[customerIndex]) {
            receipt.Customer = String(row[customerIndex]).trim();
          }
          if (bankIndex !== -1 && row[bankIndex]) {
            receipt.Bank = String(row[bankIndex]).trim();
          }
          if (amountIndex !== -1 && row[amountIndex]) {
            // Remove formatting from amount (₹, commas)
            const amountStr = String(row[amountIndex]).replace(/[₹,]/g, '').trim();
            receipt.Amount = amountStr;
          }
          if (narrationIndex !== -1 && row[narrationIndex]) {
            receipt.Narration = String(row[narrationIndex]).trim();
          }
          if (masterIdIndex !== -1 && row[masterIdIndex]) {
            receipt.MasterID = String(row[masterIdIndex]).trim();
          }

          // Only add if at least one field is present
          if (Object.keys(receipt).length > 0) {
            receipts.push(receipt);
          }
        }

        resolve({ receipts, metadata });
      } catch (error) {
        reject(new Error(`Failed to parse Excel file: ${error.message}`));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsArrayBuffer(file);
  });
};
