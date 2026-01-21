# Ledgerbook Tab: Vouchers and Bill-wise Details Guide

## Overview

The Ledgerbook tab in TallyCatalyst provides two main views for analyzing ledger transactions:
1. **Ledger Vouchers** - Shows all voucher entries for a selected ledger
2. **Bill wise O/s** - Displays outstanding bills with bill-wise breakup and aging details

This document explains how these features work, including data retrieval, processing, and display logic.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Ledger Vouchers](#ledger-vouchers)
3. [Bill-wise Outstanding](#bill-wise-outstanding)
4. [Data Flow](#data-flow)
5. [Configuration Options](#configuration-options)
6. [API Endpoints](#api-endpoints)
7. [Data Structures](#data-structures)

---

## Architecture Overview

### Components Involved

- **Ledgerbook.js** (`src/TallyDashboard/Ledgerbook.js`) - Main component for ledger book functionality
- **LedgerVouchers.js** (`src/LedgerVouchers.js`) - Standalone ledger vouchers report
- **LedgerHeader.js** (`src/LedgerHeader.js`) - Reusable header component for company/ledger selection

### Key Technologies

- React with hooks (useState, useEffect, useMemo, useCallback)
- OPFS (Origin Private File System) for caching ledger data
- Hybrid cache system for performance optimization
- Material-UI components for date pickers and autocomplete

---

## Ledger Vouchers

### Purpose

The Ledger Vouchers view displays all voucher transactions for a selected ledger within a date range. It shows:
- Transaction date
- Particulars (counter-party ledger)
- Voucher type (Sales, Payment, Receipt, etc.)
- Voucher number
- Debit and credit amounts

### Data Retrieval Process

#### 1. Company and Ledger Selection

```javascript
// Companies are loaded from sessionStorage
const companies = JSON.parse(sessionStorage.getItem('allConnections') || '[]');

// Selected company is controlled by top bar
const selectedCompanyGuid = sessionStorage.getItem('selectedCompanyGuid') || '';
```

#### 2. Ledger Cache Loading

Ledgers are loaded from OPFS cache (not from API directly):

```javascript
// Cache key format
const cacheKey = `ledgerlist-w-addrs_${tallyloc_id}_${companyVal}`;

// Load from OPFS cache
ledgers = await getCustomersFromOPFS(cacheKey);
```

**Note**: Ledgers must be synced first using the Cache Management feature or the refresh button.

#### 3. Fetching Voucher Data

When the user submits the form, the component calls the unified API endpoint:

```javascript
const payload = {
  tallyloc_id,
  company: companyVal,
  guid,
  reporttype: 'Ledger Vouchers',  // Report type selector
  ledgername: dropdown3,
  fromdate: fromDateFormatted,    // Format: YYYYMMDD (integer)
  todate: toDateFormatted         // Format: YYYYMMDD (integer)
};

const data = await apiPost('/api/tally/led_statbillrep', payload);
```

### Data Structure

The API returns data in the following format:

```javascript
{
  data: [
    {
      DATE: "01-Jan-24",
      PARTICULARS: "Sales Account",
      VCHTYPE: "Sales",
      VCHNO: "1",
      DEBITAMT: "10000.00",
      CREDITAMT: "0.00",
      MASTERID: "voucher-guid",
      ALLLEDGERENTRIES: [
        {
          LEDGERNAME: "Customer A",
          DEBITAMT: "5000.00",
          CREDITAMT: "0.00"
        },
        // ... more ledger entries
      ]
    },
    // ... more vouchers
  ],
  ledgername: "Cash",
  fromdate: 20240101,
  todate: 20240131
}
```

### Display Features

#### Basic View

Shows one row per voucher with:
- Date
- Particulars (main counter-party)
- Voucher type
- Voucher number
- Debit amount
- Credit amount

#### Expanded View (Show Ledger Details)

When "Show Ledger Details" configuration option is enabled:

```javascript
if (configOptions.ledgers) {
  // Expand ALLLEDGERENTRIES
  expandedData.push({
    ...row,
    isMainRow: true  // Main voucher row
  });
  
  // Add sub-rows for each ledger entry
  row.ALLLEDGERENTRIES.forEach(ledgerEntry => {
    expandedData.push({
      DATE: row.DATE,
      PARTICULARS: ledgerEntry.LEDGERNAME,
      VCHTYPE: row.VCHTYPE,
      VCHNO: row.VCHNO,
      DEBITAMT: ledgerEntry.DEBITAMT,
      CREDITAMT: ledgerEntry.CREDITAMT,
      isLedgerEntry: true,
      originalRow: row
    });
  });
}
```

This shows:
1. Main voucher row (bold)
2. Sub-rows for each ledger entry (indented/styled differently)

### Voucher Details Modal

Clicking on any voucher row opens a detailed modal showing:
- Complete voucher information
- All ledger entries
- Bill allocations (if any)
- Inventory allocations (if any)
- PDF download option

---

## Bill-wise Outstanding

### Purpose

The Bill-wise Outstanding view shows:
- Outstanding bills/invoices for a ledger
- Reference numbers
- Due dates and overdue days
- Opening and pending balances
- Optional voucher-level breakup

### Data Retrieval Process

Similar to Ledger Vouchers, but with `reporttype: 'Bill wise O/s'`:

```javascript
const payload = {
  tallyloc_id,
  company: companyVal,
  guid,
  reporttype: 'Bill wise O/s',  // Different report type
  ledgername: dropdown3,
  fromdate: fromDateFormatted,
  todate: toDateFormatted
};

const data = await apiPost('/api/tally/led_statbillrep', payload);
```

### Data Structure

```javascript
{
  data: [
    {
      REFNO: "INV-001",
      DUEON: "15-Jan-24",
      OVERDUEDAYS: 10,
      DEBITOPENBAL: "10000.00",
      CREDITOPENBAL: "0.00",
      DEBITCLSBAL: "5000.00",
      CREDITCLSBAL: "0.00",
      VOUCHERS: [
        {
          DATE: "01-Jan-24",
          VOUCHERTYPE: "Sales",
          VOUCHERNUMBER: "1",
          DEBITAMT: "10000.00",
          CREDITAMT: "0.00",
          MASTERID: "voucher-guid",
          ALLLEDGERENTRIES: [...],
          BILLALLOCATIONS: [...],
          INVENTORYALLOCATIONS: [...]
        },
        // ... more vouchers affecting this bill
      ]
    },
    // ... more bills
  ],
  ledgername: "Customer A",
  fromdate: 20240101,
  todate: 20240131
}
```

### Display Features

#### Basic View (Bill-wise Breakup Disabled)

Shows one row per bill with:
- Reference number
- Due date
- Overdue days
- Opening balance (Debit/Credit)
- Pending balance (Debit/Credit)

#### Expanded View (Show Billwise Breakup)

When "Show Billwise Breakup" configuration option is enabled:

```javascript
if (configOptions.billwiseBreakup) {
  // Add main bill row
  expandedData.push({
    ...row,
    isMainRow: true  // Bill summary row (bold)
  });
  
  // Add voucher entry rows
  row.VOUCHERS.forEach(voucher => {
    expandedData.push({
      DATE: voucher.DATE,
      REFNO: row.REFNO,
      VOUCHERTYPE: voucher.VOUCHERTYPE,
      VOUCHERNUMBER: voucher.VOUCHERNUMBER,
      DEBITAMT: voucher.DEBITAMT,
      CREDITAMT: voucher.CREDITAMT,
      isVoucherEntry: true,
      originalRow: row,
      originalVoucher: voucher
    });
  });
}
```

This displays:
1. **Bill row** (bold) - Shows bill reference, due date, opening/pending balances
2. **Voucher sub-rows** (indented) - Shows each voucher that affects this bill with:
   - Date
   - Voucher type
   - Voucher number
   - Amount

#### On Account Entries

Bills may have "On Account" entries (payments/receipts not allocated to specific bills):

```javascript
// ONACCVOUCHERSOPEN - On account entries in opening balance
// ONACCVOUCHERS - On account entries in current period

if (configOptions.billwiseBreakup) {
  // Display these as separate expandable rows
}
```

### Balance Calculations

The component includes helper functions for balance display:

```javascript
const parseAmount = (amount) => {
  // Handles various formats: numbers, strings, currency symbols
  // Returns numeric value
};

const formatCurrency = (amount) => {
  // Returns formatted string: ₹10,000.00
};

const describeBalance = (balance) => {
  // Returns: "₹10,000.00 Dr" or "₹5,000.00 Cr"
  // Handles both debit and credit balances
};
```

---

## Data Flow

### Complete Flow Diagram

```
User Action
    ↓
1. Select Company (from top bar)
    ↓
2. Load Ledgers from OPFS Cache
    ↓
3. Select Ledger (with search/filter)
    ↓
4. Select Date Range
    ↓
5. Choose Report Type (Ledger Vouchers / Bill wise O/s)
    ↓
6. Click Submit
    ↓
7. API Call: /api/tally/led_statbillrep
    ↓
8. Process Response Data
    ↓
9. Apply Configuration Options
    ├─ Show Ledger Details (for Ledger Vouchers)
    └─ Show Billwise Breakup (for Bill wise O/s)
    ↓
10. Render Table with Pagination
    ↓
11. User Interactions:
    ├─ Click voucher → Open details modal
    ├─ Export to CSV/Excel
    ├─ Print report
    └─ Download voucher PDF
```

### Caching Strategy

#### Ledger Cache

```javascript
// Cache key format
const cacheKey = `ledgerlist-w-addrs_${tallyloc_id}_${companyVal}`;

// Cache is stored in OPFS (Origin Private File System)
// Benefits:
// - Faster loading
// - Offline capability
// - Reduced API calls

// Refresh mechanism
const handleRefreshLedgers = async () => {
  await syncCustomers(currentCompanyObj);
  window.dispatchEvent(new CustomEvent('ledgerCacheUpdated', { 
    detail: { type: 'customers', company: currentCompanyObj } 
  }));
};
```

#### Retry Logic

```javascript
// Retry reading cache after write operations
let retries = refreshLedgers > 0 ? 3 : 1;
let attempt = 0;

while (attempt < retries && !ledgers) {
  ledgers = await getCustomersFromOPFS(cacheKey);
  if (!ledgers && attempt < retries) {
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  attempt++;
}
```

---

## Configuration Options

### Available Options

#### 1. Show Ledger Details (Ledger Vouchers only)

```javascript
configOptions.ledgers = true/false
```

**Effect**: Expands each voucher to show all ledger entries (ALLLEDGERENTRIES)

**Use Case**: When you need to see the complete double-entry breakdown of each voucher

#### 2. Show Billwise Breakup (Bill wise O/s only)

```javascript
configOptions.billwiseBreakup = true/false
```

**Effect**: Expands each bill to show all vouchers that affect it

**Use Case**: When you need to trace which specific vouchers created or adjusted each bill

### UI Implementation

```javascript
// Configuration dropdown
<div data-config-dropdown>
  <input
    type="checkbox"
    id="ledger-details-option"
    checked={configOptions.ledgers}
    onChange={(e) => handleConfigOption('ledgers', e.target.checked)}
  />
  <label htmlFor="ledger-details-option">
    Show Ledger Details
  </label>
</div>

<div data-config-dropdown>
  <input
    type="checkbox"
    id="billwise-breakup-option"
    checked={configOptions.billwiseBreakup}
    onChange={(e) => handleConfigOption('billwiseBreakup', e.target.checked)}
  />
  <label htmlFor="billwise-breakup-option">
    Show Billwise Breakup
  </label>
</div>
```

### State Management

```javascript
const handleConfigOption = (option, checked) => {
  setConfigOptions(prev => ({
    ...prev,
    [option]: checked
  }));
};

// Data is recomputed when config changes
const modifiedData = useMemo(() => 
  getModifiedTableData(), 
  [tableData, table, configOptions.billwiseBreakup, configOptions.ledgers]
);
```

---

## API Endpoints

### Primary Endpoint

**POST** `/api/tally/led_statbillrep`

#### Request Payload

```javascript
{
  tallyloc_id: number,        // Tally location ID
  company: string,            // Company name
  guid: string,               // Company GUID
  reporttype: string,         // "Ledger Vouchers" or "Bill wise O/s"
  ledgername: string,         // Selected ledger name
  fromdate: number,           // Format: YYYYMMDD (e.g., 20240101)
  todate: number              // Format: YYYYMMDD (e.g., 20240131)
}
```

#### Response Format

```javascript
{
  data: Array,               // Array of vouchers or bills
  ledgername: string,        // Echo of requested ledger
  fromdate: number,          // Echo of from date
  todate: number,            // Echo of to date
  error?: string             // Error message if any
}
```

### Supporting Endpoints

#### PDF Generation

**POST** `/api/tally/pdf/request`

```javascript
{
  tallyloc_id: number,
  company: string,
  guid: string,
  master_id: string          // Voucher MASTERID
}
```

**Response**:
```javascript
{
  success: boolean,
  request_id: string,
  message?: string
}
```

#### PDF Status Check

**GET** `/api/tally/pdf/status/:request_id`

**Response**:
```javascript
{
  status: "pending" | "ready" | "error",
  pdf_base64?: string,       // Base64 encoded PDF (when ready)
  message?: string
}
```

---

## Data Structures

### Voucher Object (Ledger Vouchers)

```typescript
interface Voucher {
  DATE: string;                    // "01-Jan-24"
  PARTICULARS: string;             // Counter-party ledger name
  VCHTYPE: string;                 // "Sales", "Payment", "Receipt", etc.
  VCHNO: string;                   // Voucher number
  DEBITAMT: string;                // "10000.00"
  CREDITAMT: string;               // "0.00"
  MASTERID: string;                // Unique voucher identifier (GUID)
  ALLLEDGERENTRIES?: LedgerEntry[]; // Array of ledger entries
}

interface LedgerEntry {
  LEDGERNAME: string;
  DEBITAMT: string;
  CREDITAMT: string;
}
```

### Bill Object (Bill wise O/s)

```typescript
interface Bill {
  REFNO: string;                   // Bill reference number
  DUEON: string;                   // Due date "15-Jan-24"
  OVERDUEDAYS: number;             // Days overdue (negative if not due)
  DEBITOPENBAL: string;            // Opening debit balance
  CREDITOPENBAL: string;           // Opening credit balance
  DEBITCLSBAL: string;             // Closing debit balance
  CREDITCLSBAL: string;            // Closing credit balance
  VOUCHERS?: BillVoucher[];        // Vouchers affecting this bill
  ONACCVOUCHERSOPEN?: BillVoucher[]; // On-account opening entries
  ONACCVOUCHERS?: BillVoucher[];   // On-account current entries
}

interface BillVoucher {
  DATE: string;
  VOUCHERTYPE: string;
  VOUCHERNUMBER: string;
  DEBITAMT: string;
  CREDITAMT: string;
  MASTERID: string;
  ALLLEDGERENTRIES?: LedgerEntry[];
  BILLALLOCATIONS?: BillAllocation[];
  INVENTORYALLOCATIONS?: InventoryAllocation[];
}
```

### Modified Row Objects (for display)

```typescript
// Ledger Vouchers with expanded entries
interface ExpandedVoucherRow {
  ...Voucher;
  isMainRow?: boolean;             // Main voucher row
  isLedgerEntry?: boolean;         // Sub-row for ledger entry
  originalRow?: Voucher;           // Reference to parent voucher
}

// Bill wise O/s with expanded vouchers
interface ExpandedBillRow {
  ...Bill;
  isMainRow?: boolean;             // Main bill row
  isVoucherEntry?: boolean;        // Sub-row for voucher
  originalRow?: Bill;              // Reference to parent bill
  originalVoucher?: BillVoucher;   // Original voucher data
  parentRefNo?: string;            // Parent bill reference
  billRowSnapshot?: Bill;          // Snapshot of bill data
}
```

---

## Export and Print Features

### CSV/Excel Export

Both Ledger Vouchers and Bill wise O/s support CSV/Excel export:

```javascript
const handleExport = (type) => {
  if (type === 'excel') {
    let csvContent = '';
    
    if (table === 'Ledger Vouchers') {
      csvContent = 'Date,Particulars,Sub Debit,Sub Credit,Vch Type,Vch No.,Debit,Credit\n';
      // Add rows...
    } else {
      csvContent = 'Date,Ref No,Vch Type,Amount,Opening Amount,Pending Amount,Due On,Overdue Days\n';
      // Add rows...
    }
    
    // Download CSV file
    const blob = new Blob([csvContent], { type: 'text/csv' });
    // ... download logic
  }
};
```

### Print Functionality

Generates a print-friendly HTML table:

```javascript
const handlePrint = () => {
  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <html>
      <head>
        <title>${table} - ${tableData.ledgername}</title>
        <style>/* Print styles */</style>
      </head>
      <body>
        ${generateTableHTML()}
      </body>
    </html>
  `);
  printWindow.print();
};
```

---

## User Interactions

### Voucher Click Behavior

Clicking on any voucher row (in either view) opens a modal with:

```javascript
const handleVoucherRowClick = (row) => {
  // Determine voucher data based on view type
  if (table === 'Ledger Vouchers') {
    voucherData = row?.originalRow || row;
  } else if (table === 'Bill wise O/s') {
    if (row?.isVoucherEntry) {
      voucherData = row.originalVoucher || row;
      parentBillRow = row.originalRow || row.billRowSnapshot;
    } else {
      voucherData = row.VOUCHERS?.[0];
      parentBillRow = row;
    }
  }
  
  setViewingVoucher({
    ...voucherData,
    ledgerName: tableData?.ledgername,
    refNo: parentBillRow?.REFNO,
    dueOn: parentBillRow?.DUEON,
    overdueDays: parentBillRow?.OVERDUEDAYS
  });
  setShowVoucherDetails(true);
};
```

### Pagination

```javascript
const recordsPerPage = 10;
const [currentPage, setCurrentPage] = useState(1);

// Display slice of data
const displayData = modifiedData.slice(
  (currentPage - 1) * recordsPerPage,
  currentPage * recordsPerPage
);
```

---

## Best Practices

### 1. Cache Management

- Always sync ledger cache before first use
- Use the refresh button if ledgers are outdated
- Cache is company-specific: `ledgerlist-w-addrs_${tallyloc_id}_${companyVal}`

### 2. Date Range Selection

- Default: First day of current month to today
- Format conversion: YYYY-MM-DD (input) → YYYYMMDD (API)
- Validate date ranges to avoid excessive data

### 3. Performance Optimization

- Ledger search is debounced (150ms)
- Results limited to 50 items for dropdown
- Pagination for large datasets
- useMemo for expensive computations

### 4. Error Handling

```javascript
try {
  const data = await apiPost('/api/tally/led_statbillrep', payload);
  if (data && data.data && Array.isArray(data.data)) {
    setTableData(data);
  } else if (data && data.error) {
    setTableError(data.error);
  }
} catch (error) {
  setTableError('Failed to fetch data');
}
```

---

## Troubleshooting

### Common Issues

#### 1. "No customer data found in cache"

**Cause**: Ledger cache not synced

**Solution**: 
- Go to Cache Management
- Sync customers for the selected company
- Or click the refresh button in Ledgerbook

#### 2. Empty table after submit

**Cause**: No data for selected ledger/date range

**Solution**:
- Verify ledger has transactions in the date range
- Check if company is correctly selected
- Try expanding date range

#### 3. Voucher details not showing

**Cause**: Missing MASTERID or voucher data

**Solution**:
- Ensure API returns complete voucher objects
- Check ALLLEDGERENTRIES array exists
- Verify VOUCHERS array for bill-wise view

#### 4. PDF download fails

**Cause**: PDF generation timeout or missing data

**Solution**:
- Check network connectivity
- Verify MASTERID exists in voucher
- Ensure Tally is running and accessible
- Check backend PDF generation service

---

## Future Enhancements

### Potential Improvements

1. **Advanced Filtering**
   - Filter by voucher type
   - Filter by amount range
   - Filter by overdue days

2. **Sorting**
   - Sort by date, amount, voucher number
   - Multi-column sorting

3. **Bulk Operations**
   - Select multiple vouchers
   - Bulk PDF download
   - Bulk export

4. **Analytics**
   - Aging analysis charts
   - Payment trends
   - Outstanding summary

5. **Real-time Updates**
   - WebSocket integration
   - Auto-refresh on Tally changes

---

## Related Documentation

- [Cache Management Guide](./CACHE_MANAGEMENT.md)
- [Cache Download Update Specification](./CACHE_DOWNLOAD_UPDATE_SPEC.md)
- [System Architecture](./SYSTEM_ARCHITECTURE.md)

---

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review related documentation
3. Check browser console for error messages
4. Contact development team with specific error details

---

**Document Version**: 1.0  
**Last Updated**: January 2026  
**Maintained By**: TallyCatalyst Development Team
