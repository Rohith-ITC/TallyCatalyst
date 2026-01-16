import React, { useState, useEffect, useMemo } from 'react';
import { hybridCache } from '../utils/hybridCache';
import { getNestedFieldValue } from './salesdashboard/utils/fieldExtractor';

const CustomReports = () => {
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [reportData, setReportData] = useState({ rows: [], columns: [] });
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportSearch, setReportSearch] = useState('');
  const [reportPage, setReportPage] = useState(1);
  const [reportPageSize, setReportPageSize] = useState(20);
  const [reportPageInput, setReportPageInput] = useState('1');
  const [reportPageSizeInput, setReportPageSizeInput] = useState('20');
  const [reportSortBy, setReportSortBy] = useState(null);
  const [reportSortOrder, setReportSortOrder] = useState('asc');
  const [columnFilters, setColumnFilters] = useState({});
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(null);
  const [filterDropdownSearch, setFilterDropdownSearch] = useState({});
  const [salesData, setSalesData] = useState([]);

  // Load reports from localStorage
  useEffect(() => {
    try {
      const storedReports = JSON.parse(localStorage.getItem('customReports') || '[]');
      setReports(storedReports);
    } catch (error) {
      console.error('Error loading custom reports:', error);
      setReports([]);
    }
  }, []);

  // Delete report handler
  const handleDeleteReport = (reportId, e) => {
    e.stopPropagation(); // Prevent opening the report when clicking delete
    
    if (window.confirm('Are you sure you want to delete this report? This action cannot be undone.')) {
      try {
        const updatedReports = reports.filter(r => r.id !== reportId);
        localStorage.setItem('customReports', JSON.stringify(updatedReports));
        setReports(updatedReports);
        
        // If the deleted report was open, close the modal
        if (selectedReport && selectedReport.id === reportId) {
          setShowReportModal(false);
          setSelectedReport(null);
        }
      } catch (error) {
        console.error('Error deleting report:', error);
        alert('Failed to delete report. Please try again.');
      }
    }
  };

  // Load sales data when component mounts
  useEffect(() => {
    const loadSalesData = async () => {
      try {
        const companies = JSON.parse(sessionStorage.getItem('allConnections') || '[]');
        const selectedCompanyGuid = sessionStorage.getItem('selectedCompanyGuid') || '';
        const selectedCompanyTallylocId = sessionStorage.getItem('selectedCompanyTallylocId') || '';
        
        const currentCompanyObj = companies.find(c =>
          c.guid === selectedCompanyGuid &&
          (selectedCompanyTallylocId ? String(c.tallyloc_id) === String(selectedCompanyTallylocId) : true)
        );
        
        if (!currentCompanyObj || !currentCompanyObj.tallyloc_id || !currentCompanyObj.guid) {
          setSalesData([]);
          return;
        }
        
        const completeCache = await hybridCache.getCompleteSalesData(currentCompanyObj);
        if (completeCache && completeCache.data && completeCache.data.vouchers) {
          // Flatten the sales data similar to SalesDashboard - include all inventory entries
          // Create voucher lookup map for nested field access
          const voucherLookupMap = new Map();
          completeCache.data.vouchers.forEach(voucher => {
            const masterid = voucher.masterid || voucher.mstid;
            if (masterid) {
              voucherLookupMap.set(String(masterid), voucher);
            }
          });
          window.__voucherLookupMap = voucherLookupMap;
          
          // Filter to only sales vouchers (same as SalesDashboard)
          const salesVouchers = completeCache.data.vouchers.filter(voucher => {
            const reservedname = (voucher.reservedname || '').toLowerCase().trim();
            const isoptional = (voucher.isoptional || voucher.isOptional || '').toString().toLowerCase().trim();
            const iscancelled = (voucher.iscancelled || voucher.isCancelled || '').toString().toLowerCase().trim();
            const ledgerEntries = voucher.ledgerentries || voucher.ledgers || [];
            const hasPartyLedger = Array.isArray(ledgerEntries) && ledgerEntries.some(ledger => {
              const ispartyledger = (ledger.ispartyledger || ledger.isPartyLedger || '').toString().toLowerCase().trim();
              return ispartyledger === 'yes';
            });
            
            return (reservedname === 'sales' || reservedname === 'credit note') && 
                   isoptional === 'no' && 
                   iscancelled === 'no' && 
                   hasPartyLedger;
          });
          
          // Flatten vouchers - one record per inventory entry (same as SalesDashboard)
          const flattened = salesVouchers.flatMap(voucher => {
            // Get voucher-level fields
            const voucherDateRaw = voucher.cp_date || voucher.date || voucher.DATE || voucher.CP_DATE;
            let voucherDate = null;
            if (voucherDateRaw) {
              // Try to parse date
              if (/^\d{8}$/.test(voucherDateRaw)) {
                const year = voucherDateRaw.substring(0, 4);
                const month = voucherDateRaw.substring(4, 6);
                const day = voucherDateRaw.substring(6, 8);
                voucherDate = `${year}-${month}-${day}`;
              } else if (/^\d{4}-\d{2}-\d{2}$/.test(voucherDateRaw)) {
                voucherDate = voucherDateRaw;
              } else {
                voucherDate = voucherDateRaw;
              }
            }
            
            const baseRecord = {
              masterid: voucher.masterid || voucher.mstid,
              mstid: voucher.mstid || voucher.masterid,
              date: voucherDate,
              cp_date: voucherDate,
              customer: voucher.partyledgername || voucher.party || 'Unknown',
              partyledgername: voucher.partyledgername || voucher.party || 'Unknown',
              partyledgernameid: voucher.partyledgernameid || voucher.partyid || '',
              partyid: voucher.partyid || voucher.partyledgernameid || '',
              vouchernumber: voucher.vouchernumber || voucher.vchno || '',
              vchno: voucher.vchno || voucher.vouchernumber || '',
              alterid: voucher.alterid,
              gstno: voucher.partygstin || voucher.gstno || '',
              pincode: voucher.pincode || '',
              reference: voucher.reference || '',
              vchtype: voucher.vouchertypename || voucher.vchtype || '',
              region: voucher.state || 'Unknown',
              country: voucher.country || 'Unknown',
              salesperson: voucher.salesprsn || voucher.salesperson || voucher.salespersonname || 'Unassigned',
              // Include all voucher fields
              ...voucher
            };
            
            // Process inventory entries (same as SalesDashboard)
            const inventoryItems = voucher.allinventoryentries || voucher.inventry || [];
            if (Array.isArray(inventoryItems) && inventoryItems.length > 0) {
              return inventoryItems.map((inventoryItem) => {
                // Get stock group and category
                const stockGroup = inventoryItem.stockitemgroup || inventoryItem.group || 
                                 inventoryItem.stockitemgrouplist?.split('|')[0] || 
                                 inventoryItem.grouplist?.split('|')[0] || 'Other';
                const stockCategory = inventoryItem.stockitemcategory || 
                                    inventoryItem.stockitemcategorylist?.split('|')[0] || 
                                    stockGroup;
                
                // Get ledger group from accalloc if available
                let ledgerGroup = 'Other';
                if (inventoryItem.accalloc && Array.isArray(inventoryItem.accalloc) && inventoryItem.accalloc.length > 0) {
                  const accountAlloc = inventoryItem.accalloc[0];
                  ledgerGroup = accountAlloc.ledgergroupidentify || accountAlloc.group || 
                              accountAlloc.grouplist?.split('|')[0] || 'Other';
                }
                
                // Parse amounts
                const parseAmount = (amountStr) => {
                  if (!amountStr) return 0;
                  const cleaned = String(amountStr).replace(/,/g, '').replace(/[()]/g, '');
                  const isNegative = cleaned.includes('(-)') || (cleaned.startsWith('-') && !cleaned.startsWith('(-)'));
                  const numValue = parseFloat(cleaned.replace(/[()]/g, '')) || 0;
                  return isNegative ? -Math.abs(numValue) : numValue;
                };
                
                const parseQuantity = (qtyStr) => {
                  if (!qtyStr) return 0;
                  const cleaned = String(qtyStr).replace(/,/g, '');
                  return parseInt(cleaned, 10) || 0;
                };
                
                return {
                  ...baseRecord,
                  // Item-level fields (mapped same as SalesDashboard)
                  item: inventoryItem.stockitemname || inventoryItem.item || 'Unknown',
                  stockitemname: inventoryItem.stockitemname || inventoryItem.item || 'Unknown',
                  stockitemnameid: inventoryItem.stockitemnameid || inventoryItem.itemid || '',
                  itemid: inventoryItem.stockitemnameid || inventoryItem.itemid || '',
                  category: stockCategory,
                  stockitemcategory: stockCategory,
                  stockitemgroup: stockGroup,
                  quantity: parseQuantity(inventoryItem.billedqty || inventoryItem.qty || inventoryItem.actualqty),
                  amount: parseAmount(inventoryItem.amount || inventoryItem.amt),
                  profit: parseAmount(inventoryItem.profit) || 0,
                  ledgerGroup: ledgerGroup,
                  uom: inventoryItem.uom || '',
                  grosscost: parseAmount(inventoryItem.grosscost) || 0,
                  grossexpense: parseAmount(inventoryItem.grossexpense) || 0,
                  // Include all inventory item fields
                  ...inventoryItem
                };
              });
            }
            
            // If no inventory entries, return base record
            return [baseRecord];
          });
          
          setSalesData(flattened);
        }
      } catch (error) {
        console.error('Error loading sales data:', error);
        setSalesData([]);
      }
    };
    
    loadSalesData();
  }, []);

  // Helper to get field value
  const getFieldValue = (item, fieldName) => {
    if (!item || !fieldName) return null;
    
    // Handle nested field paths
    if (fieldName.includes('.')) {
      // If we have expanded array entry and field belongs to that array, get from array entry
      if (item.__arrayEntry && item.__arrayFieldName) {
        const pathParts = fieldName.split('.');
        const fieldArrayName = pathParts[0].toLowerCase();
        
        // If this field belongs to the expanded array
        if (item.__arrayFieldName === fieldArrayName) {
          const remainingPath = pathParts.slice(1).join('.');
          let value = getNestedFieldValue(item.__arrayEntry, remainingPath);
          
          // Also try direct access
          if (!value || value === null || value === undefined) {
            const fieldNameDirect = remainingPath.split('.')[0];
            value = item.__arrayEntry[fieldNameDirect] || 
                    item.__arrayEntry[fieldNameDirect.toLowerCase()] ||
                    item.__arrayEntry[fieldNameDirect.toUpperCase()];
          }
          
          if (value !== null && value !== undefined) return value;
        }
      }
      
      // Try from item first
      const value = getNestedFieldValue(item, fieldName);
      if (value !== null && value !== undefined) return value;
      
      // If nested field not found in item, try voucher lookup map
      const masterid = item.masterid || item.mstid;
      if (masterid && window.__voucherLookupMap) {
        const voucher = window.__voucherLookupMap.get(String(masterid));
        if (voucher) {
          const voucherValue = getNestedFieldValue(voucher, fieldName);
          if (voucherValue !== null && voucherValue !== undefined) {
            return voucherValue;
          }
        }
      }
    }
    
    // Direct field access
    if (item[fieldName] !== undefined && item[fieldName] !== null && item[fieldName] !== '') {
      return item[fieldName];
    }
    
    // Case-insensitive matching
    const matchingKey = Object.keys(item).find(k => k.toLowerCase() === fieldName.toLowerCase());
    if (matchingKey && item[matchingKey] !== null && item[matchingKey] !== undefined && item[matchingKey] !== '') {
      return item[matchingKey];
    }
    
    // Handle common field name variations
    const fieldNameLower = fieldName.toLowerCase();
    
    // Item field variations
    if (fieldNameLower === 'item') {
      return item.stockitemname || item.item || item.stockitemnameid || item.itemid || null;
    }
    
    // Category field variations
    if (fieldNameLower === 'category') {
      return item.stockitemcategory || item.category || item.stockitemgroup || null;
    }
    
    // Date field variations
    if (fieldNameLower === 'date') {
      return item.cp_date || item.date || item.DATE || item.CP_DATE || null;
    }
    
    // Party/Customer field variations
    if (fieldNameLower === 'customer' || fieldNameLower === 'party') {
      return item.partyledgername || item.partyname || item.customer || item.party || null;
    }
    
    // Try partial matches for nested structures
    if (fieldNameLower.includes('item') && !fieldNameLower.includes('.')) {
      // Try to find any field containing "item"
      const itemKey = Object.keys(item).find(k => 
        k.toLowerCase().includes('item') && 
        item[k] !== null && 
        item[k] !== undefined && 
        item[k] !== ''
      );
      if (itemKey) return item[itemKey];
    }
    
    if (fieldNameLower.includes('category') && !fieldNameLower.includes('.')) {
      // Try to find any field containing "category"
      const categoryKey = Object.keys(item).find(k => 
        k.toLowerCase().includes('category') && 
        item[k] !== null && 
        item[k] !== undefined && 
        item[k] !== ''
      );
      if (categoryKey) return item[categoryKey];
    }
    
    return null;
  };

  // Helper to get field label
  const getFieldLabel = (fieldName) => {
    const fieldLabelMap = {
      'partyledgername': 'Party Ledger Name',
      'customer': 'Customer',
      'stockitemname': 'Stock Item Name',
      'item': 'Item',
      'region': 'State/Region',
      'state': 'State',
      'country': 'Country',
      'pincode': 'PIN Code',
      'ledgername': 'Ledger Name',
      'ledgerGroup': 'Ledger Group',
      'salesperson': 'Salesperson',
      'date': 'Date',
      'amount': 'Amount',
      'quantity': 'Quantity',
      'profit': 'Profit',
      'vouchernumber': 'Voucher Number',
    };
    
    const lowerKey = fieldName.toLowerCase();
    if (fieldLabelMap[lowerKey]) {
      return fieldLabelMap[lowerKey];
    }
    return fieldName.charAt(0).toUpperCase() + fieldName.slice(1).replace(/([A-Z])/g, ' $1').trim();
  };

  // Open report modal
  const handleOpenReport = (report) => {
    setSelectedReport(report);
    
    // Build columns from selected fields (sorted by sort index)
    const fieldsArray = report.fields.map(fieldValue => ({
      value: fieldValue,
      label: getFieldLabel(fieldValue),
      sortIndex: report.sortIndexes[fieldValue] ?? null
    })).sort((a, b) => {
      if (a.sortIndex === null && b.sortIndex === null) return 0;
      if (a.sortIndex === null) return 1;
      if (b.sortIndex === null) return -1;
      return a.sortIndex - b.sortIndex;
    });
    
    const columns = fieldsArray.map(field => ({
      key: field.value,
      label: field.label,
      format: field.value.toLowerCase().includes('amount') || 
              field.value.toLowerCase().includes('quantity') ||
              field.value.toLowerCase().includes('qty') ||
              field.value.toLowerCase().includes('profit') ||
              field.value.toLowerCase().includes('rate') ||
              field.value.toLowerCase().includes('price')
        ? 'number' : undefined
    }));
    
    // Check if we need to expand data (either for fields or filters)
    const nestedArrayFields = report.fields.filter(field => field.includes('.'));
    const nestedArrayFilters = report.filters ? report.filters.filter(f => f.field && f.field.includes('.')) : [];
    let needsExpansion = false;
    let arrayFieldName = null;
    
    // Check if any selected field or filter is a nested array field
    const allNestedFields = [...nestedArrayFields, ...nestedArrayFilters.map(f => f.field)];
    
    if (allNestedFields.length > 0) {
      // Find the first nested array field to use for expansion
      const firstNestedField = allNestedFields[0];
      const pathParts = firstNestedField.split('.');
      const fieldName = pathParts[0].toLowerCase();
      
      const knownArrayFields = ['ledgerentries', 'allledgerentries', 'allinventoryentries', 
                                'inventoryentries', 'billallocations', 'batchallocation', 
                                'accountingallocation', 'address'];
      
      if (knownArrayFields.includes(fieldName)) {
        needsExpansion = true;
        arrayFieldName = fieldName;
      }
    }
    
    // Expand data BEFORE filtering if we have nested array fields/filters
    let dataToProcess = [...salesData];
    if (needsExpansion && arrayFieldName) {
      const newExpandedData = [];
      
      // Group sales by voucher (masterid) to avoid duplicate expansion
      const salesByVoucher = new Map();
      salesData.forEach(sale => {
        const masterid = sale.masterid || sale.mstid || 'unknown';
        if (!salesByVoucher.has(masterid)) {
          salesByVoucher.set(masterid, []);
        }
        salesByVoucher.get(masterid).push(sale);
      });
      
      // Expand each voucher's sales
      salesByVoucher.forEach((sales, masterid) => {
        // Get the original voucher
        let voucher = null;
        if (masterid !== 'unknown' && window.__voucherLookupMap) {
          voucher = window.__voucherLookupMap.get(String(masterid));
        }
        
        // If no voucher, use first sale as reference
        if (!voucher && sales.length > 0) {
          voucher = sales[0];
        }
        
        if (!voucher) {
          // No voucher found, keep original sales
          newExpandedData.push(...sales);
          return;
        }
        
        // Get the array from voucher (try different case variations)
        const arrayKey = Object.keys(voucher).find(k => k.toLowerCase() === arrayFieldName);
        const arrayValue = arrayKey ? voucher[arrayKey] : [];
        
        if (Array.isArray(arrayValue) && arrayValue.length > 0) {
          // Create one expanded record per array entry
          arrayValue.forEach((arrayEntry) => {
            // For each sale record under this voucher, create expanded version
            sales.forEach(sale => {
              const expandedRecord = {
                ...sale,
                __arrayEntry: arrayEntry,
                __arrayFieldName: arrayFieldName
              };
              newExpandedData.push(expandedRecord);
            });
          });
        } else {
          // No array entries or empty array, keep original sales
          newExpandedData.push(...sales);
        }
      });
      
      dataToProcess = newExpandedData;
      
      console.log('📊 Expanded data for custom report (before filtering):', {
        originalCount: salesData.length,
        expandedCount: dataToProcess.length,
        arrayFieldName: arrayFieldName,
        expansionFactor: dataToProcess.length > 0 ? (dataToProcess.length / salesData.length).toFixed(2) : '0'
      });
    }
    
    // Filter and process data
    let filteredData = [...dataToProcess];
    
    // Apply filters (now works on expanded data)
    if (report.filters && report.filters.length > 0) {
      report.filters.forEach(filter => {
        filteredData = filteredData.filter(item => {
          const fieldValue = getFieldValue(item, filter.field);
          const stringValue = String(fieldValue ?? '').trim();
          return filter.values.includes(stringValue);
        });
      });
    }
    
    // Build rows with only selected fields (use filteredData which is already expanded if needed)
    const rows = filteredData.map(item => {
      const row = {};
      report.fields.forEach(fieldValue => {
        // If field is nested array field and we have expanded array entry, get from array entry
        if (fieldValue.includes('.') && item.__arrayEntry) {
          const pathParts = fieldValue.split('.');
          const fieldArrayName = pathParts[0].toLowerCase();
          
          // If this field belongs to the expanded array
          if (item.__arrayFieldName === fieldArrayName) {
            const remainingPath = pathParts.slice(1).join('.');
            let fieldValueFromEntry = getNestedFieldValue(item.__arrayEntry, remainingPath);
            
            // Also try direct access
            if (!fieldValueFromEntry || fieldValueFromEntry === null || fieldValueFromEntry === undefined) {
              const fieldName = remainingPath.split('.')[0];
              fieldValueFromEntry = item.__arrayEntry[fieldName] || 
                                     item.__arrayEntry[fieldName.toLowerCase()] ||
                                     item.__arrayEntry[fieldName.toUpperCase()];
            }
            
            row[fieldValue] = fieldValueFromEntry;
          } else {
            // Different array field, get from voucher
            row[fieldValue] = getFieldValue(item, fieldValue);
          }
        } else {
          // Regular field access
          row[fieldValue] = getFieldValue(item, fieldValue);
        }
      });
      return row;
    });
    
    setReportData({ rows, columns });
    setShowReportModal(true);
    setReportPage(1);
    setReportSearch('');
    setColumnFilters({});
  };

  // Filtered reports
  const filteredReports = useMemo(() => {
    if (!reportSearch.trim()) return reports;
    const searchLower = reportSearch.toLowerCase();
    return reports.filter(r => 
      r.title.toLowerCase().includes(searchLower)
    );
  }, [reports, reportSearch]);

  // Filtered and sorted rows
  const filteredReportRows = useMemo(() => {
    if (!showReportModal || !reportData.rows.length) return [];
    
    let filtered = [...reportData.rows];
    
    // Apply column filters
    Object.entries(columnFilters).forEach(([columnKey, filterValue]) => {
      if (!filterValue || (Array.isArray(filterValue) && filterValue.length === 0)) return;
      
      const column = reportData.columns.find(col => col.key === columnKey);
      if (!column) return;
      
      filtered = filtered.filter(row => {
        const cellValue = row[columnKey];
        const stringValue = String(cellValue ?? '').toLowerCase();
        
        if (Array.isArray(filterValue)) {
          return filterValue.some(fv => String(fv).toLowerCase() === stringValue);
        }
        return stringValue.includes(String(filterValue).toLowerCase());
      });
    });
    
    // Apply global search
    if (reportSearch.trim()) {
      const query = reportSearch.toLowerCase();
      filtered = filtered.filter(row =>
        reportData.columns.some(column =>
          String(row[column.key] ?? '').toLowerCase().includes(query)
        )
      );
    }
    
    // Apply sorting
    if (reportSortBy) {
      filtered.sort((a, b) => {
        const aValue = a[reportSortBy] ?? '';
        const bValue = b[reportSortBy] ?? '';
        const isNumeric = typeof aValue === 'number' || !isNaN(parseFloat(aValue));
        
        if (isNumeric) {
          const numA = parseFloat(aValue) || 0;
          const numB = parseFloat(bValue) || 0;
          return reportSortOrder === 'asc' ? numA - numB : numB - numA;
        }
        
        const strA = String(aValue).toLowerCase();
        const strB = String(bValue).toLowerCase();
        if (reportSortOrder === 'asc') {
          return strA.localeCompare(strB);
        }
        return strB.localeCompare(strA);
      });
    }
    
    return filtered;
  }, [reportData, columnFilters, reportSearch, reportSortBy, reportSortOrder, showReportModal]);

  // Pagination
  const totalRows = filteredReportRows.length;
  const reportStart = totalRows === 0 ? 0 : (reportPage - 1) * reportPageSize + 1;
  const reportEnd = totalRows === 0 ? 0 : Math.min(reportPage * reportPageSize, totalRows);
  const paginatedRows = filteredReportRows.slice((reportPage - 1) * reportPageSize, reportPage * reportPageSize);

  // Format cell value
  const formatCellValue = (value, column) => {
    if (value === null || value === undefined || value === '') return '-';
    
    if (column.format === 'number') {
      const numValue = typeof value === 'number' ? value : parseFloat(value);
      if (Number.isFinite(numValue)) {
        return numValue.toLocaleString('en-IN');
      }
    }
    
    if (column.key === 'date' || column.key === 'cp_date') {
      if (typeof value === 'string' && value.length === 8 && /^\d+$/.test(value)) {
        const year = value.substring(0, 4);
        const month = value.substring(4, 6);
        const day = value.substring(6, 8);
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${day}-${monthNames[parseInt(month) - 1]}-${year.slice(-2)}`;
      }
    }
    
    return value;
  };

  // Get unique values for a column (for filters)
  const getColumnUniqueValues = (column) => {
    const valuesSet = new Set();
    reportData.rows.forEach(row => {
      const value = row[column.key];
      if (value !== null && value !== undefined && value !== '') {
        valuesSet.add(String(value));
      }
    });
    return Array.from(valuesSet).sort();
  };

  return (
    <div style={{ 
      padding: '20px', 
      maxWidth: '1200px', 
      margin: '0 auto',
      background: '#f8fafc',
      minHeight: '100vh'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '32px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '32px',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 8px rgba(59, 130, 246, 0.3)'
            }}>
              <span className="material-icons" style={{ fontSize: '28px', color: 'white' }}>summarize</span>
            </div>
            <div>
              <h2 style={{
                fontSize: '28px',
                fontWeight: '700',
                color: '#1e293b',
                margin: 0,
                lineHeight: '1.2'
              }}>
                Custom Reports
              </h2>
              <p style={{
                fontSize: '14px',
                color: '#64748b',
                margin: '4px 0 0 0'
              }}>
                {reports.length} {reports.length === 1 ? 'report' : 'reports'} available
              </p>
            </div>
          </div>
          
          {reports.length > 0 && (
            <div style={{ position: 'relative', width: '100%', maxWidth: '400px' }}>
              <input
                type="text"
                value={reportSearch}
                onChange={(e) => setReportSearch(e.target.value)}
                placeholder="Search reports..."
                style={{
                  width: '100%',
                  padding: '12px 16px 12px 44px',
                  border: '2px solid #e2e8f0',
                  borderRadius: '10px',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'all 0.2s ease',
                  background: '#f8fafc'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#3b82f6';
                  e.currentTarget.style.background = 'white';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#e2e8f0';
                  e.currentTarget.style.background = '#f8fafc';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
              <span className="material-icons" style={{
                position: 'absolute',
                left: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#94a3b8',
                pointerEvents: 'none',
                fontSize: '20px'
              }}>search</span>
            </div>
          )}
        </div>

        {reports.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '80px 20px',
            color: '#64748b'
          }}>
            <div style={{
              width: '120px',
              height: '120px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px'
            }}>
              <span className="material-icons" style={{ fontSize: '64px', color: '#cbd5e1' }}>
                summarize
              </span>
            </div>
            <h3 style={{ 
              fontSize: '22px', 
              fontWeight: '600', 
              color: '#1e293b', 
              marginBottom: '8px' 
            }}>
              No Custom Reports
            </h3>
            <p style={{ fontSize: '15px', color: '#64748b', maxWidth: '400px', margin: '0 auto' }}>
              Create your first custom report from the Sales Dashboard to view and analyze your data
            </p>
          </div>
        ) : filteredReports.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            color: '#64748b'
          }}>
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: '#f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px'
            }}>
              <span className="material-icons" style={{ fontSize: '40px', color: '#cbd5e1' }}>
                search_off
              </span>
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1e293b', marginBottom: '8px' }}>
              No reports found
            </h3>
            <p style={{ fontSize: '14px', color: '#64748b' }}>
              Try adjusting your search terms
            </p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: '20px'
          }}>
            {filteredReports.map((report) => (
              <div
                key={report.id}
                onClick={() => handleOpenReport(report)}
                style={{
                  background: 'white',
                  border: '2px solid #e2e8f0',
                  borderRadius: '16px',
                  padding: '24px',
                  cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  position: 'relative',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)',
                  overflow: 'hidden'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)';
                  e.currentTarget.style.borderColor = '#3b82f6';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(59, 130, 246, 0.15)';
                  e.currentTarget.style.transform = 'translateY(-4px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'white';
                  e.currentTarget.style.borderColor = '#e2e8f0';
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.04)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                {/* Decorative accent line */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '4px',
                  background: 'linear-gradient(90deg, #3b82f6 0%, #2563eb 50%, #1d4ed8 100%)'
                }} />
                
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <span className="material-icons" style={{ fontSize: '28px', color: '#2563eb' }}>description</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{
                      fontSize: '18px',
                      fontWeight: '600',
                      color: '#1e293b',
                      margin: 0,
                      marginBottom: '8px',
                      lineHeight: '1.3',
                      wordBreak: 'break-word'
                    }}>
                      {report.title}
                    </h3>
                    <div style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '12px',
                      alignItems: 'center'
                    }}>
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 10px',
                        background: '#f1f5f9',
                        borderRadius: '6px',
                        fontSize: '13px',
                        color: '#475569'
                      }}>
                        <span className="material-icons" style={{ fontSize: '16px', color: '#64748b' }}>table_chart</span>
                        <strong>{report.fields.length}</strong> fields
                      </div>
                      {report.filters && report.filters.length > 0 && (
                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 10px',
                          background: '#fef3c7',
                          borderRadius: '6px',
                          fontSize: '13px',
                          color: '#92400e'
                        }}>
                          <span className="material-icons" style={{ fontSize: '16px', color: '#f59e0b' }}>filter_list</span>
                          <strong>{report.filters.length}</strong> filter{report.filters.length !== 1 ? 's' : ''}
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDeleteReport(report.id, e)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '8px',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ef4444',
                      transition: 'all 0.2s ease',
                      flexShrink: 0,
                      width: '36px',
                      height: '36px'
                    }}
                    onMouseEnter={(e) => {
                      e.stopPropagation();
                      e.currentTarget.style.background = '#fee2e2';
                      e.currentTarget.style.transform = 'scale(1.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.stopPropagation();
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.transform = 'scale(1)';
                    }}
                    title="Delete report"
                  >
                    <span className="material-icons" style={{ fontSize: '22px' }}>delete_outline</span>
                  </button>
                </div>
                
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  paddingTop: '12px',
                  borderTop: '1px solid #f1f5f9',
                  fontSize: '13px',
                  color: '#64748b'
                }}>
                  <span className="material-icons" style={{ fontSize: '16px', color: '#94a3b8' }}>schedule</span>
                  <span>
                    Created: <strong style={{ color: '#475569' }}>
                      {new Date(report.createdAt).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                      })}
                    </strong>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Report Data Modal */}
      {showReportModal && selectedReport && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            zIndex: 15000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowReportModal(false);
            }
          }}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '20px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              width: '95%',
              maxWidth: '1400px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{
              padding: '24px 28px',
              borderBottom: '2px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexShrink: 0,
              background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 8px rgba(59, 130, 246, 0.3)'
                }}>
                  <span className="material-icons" style={{ fontSize: '24px', color: 'white' }}>description</span>
                </div>
                <div>
                  <h2 style={{
                    fontSize: '22px',
                    fontWeight: '700',
                    color: '#1e293b',
                    margin: 0,
                    lineHeight: '1.2'
                  }}>
                    {selectedReport.title}
                  </h2>
                  {selectedReport.filters && selectedReport.filters.length > 0 && (
                    <div style={{
                      fontSize: '13px',
                      color: '#64748b',
                      marginTop: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <span className="material-icons" style={{ fontSize: '16px' }}>filter_list</span>
                      {selectedReport.filters.length} active filter{selectedReport.filters.length !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button
                  onClick={() => {
                    // Export to CSV
                    const csvContent = [
                      reportData.columns.map(col => col.label).join(','),
                      ...filteredReportRows.map(row =>
                        reportData.columns.map(col => {
                          const value = row[col.key] ?? '';
                          // Escape quotes and wrap in quotes if contains comma
                          const stringValue = String(value);
                          if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
                            return `"${stringValue.replace(/"/g, '""')}"`;
                          }
                          return stringValue;
                        }).join(',')
                      )
                    ].join('\n');
                    
                    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                    const link = document.createElement('a');
                    const url = URL.createObjectURL(blob);
                    link.setAttribute('href', url);
                    link.setAttribute('download', `${selectedReport.title.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
                    link.style.visibility = 'hidden';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  style={{
                    background: 'white',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '8px 16px',
                    cursor: 'pointer',
                    color: '#475569',
                    fontSize: '14px',
                    fontWeight: '500',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#f8fafc';
                    e.currentTarget.style.borderColor = '#3b82f6';
                    e.currentTarget.style.color = '#3b82f6';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'white';
                    e.currentTarget.style.borderColor = '#e2e8f0';
                    e.currentTarget.style.color = '#475569';
                  }}
                  title="Download Excel"
                >
                  <span className="material-icons" style={{ fontSize: '18px' }}>download</span>
                  Download Excel
                </button>
                <button
                  onClick={() => setShowReportModal(false)}
                  style={{
                    background: 'transparent',
                    border: '2px solid #e2e8f0',
                    cursor: 'pointer',
                    padding: '8px',
                    borderRadius: '8px',
                    color: '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '36px',
                    height: '36px',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#fee2e2';
                    e.currentTarget.style.borderColor = '#ef4444';
                    e.currentTarget.style.color = '#ef4444';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.borderColor = '#e2e8f0';
                    e.currentTarget.style.color = '#64748b';
                  }}
                  title="Close"
                >
                  <span className="material-icons" style={{ fontSize: '22px' }}>close</span>
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div style={{
              flex: 1,
              overflow: 'auto',
              padding: '20px 24px',
              display: 'flex',
              flexDirection: 'column'
            }}>
              {/* Search and Filters */}
              <div style={{ 
                marginBottom: '20px', 
                display: 'flex', 
                gap: '16px', 
                alignItems: 'center',
                flexWrap: 'wrap',
                position: 'sticky',
                top: 0,
                background: 'white',
                zIndex: 10,
                paddingTop: '0px',
                paddingBottom: '20px',
                borderBottom: '2px solid #f1f5f9'
              }}>
                <div style={{ 
                  position: 'relative', 
                  flex: 1, 
                  minWidth: '280px',
                  maxWidth: '450px'
                }}>
                  <input
                    type="text"
                    value={reportSearch}
                    onChange={(e) => {
                      setReportSearch(e.target.value);
                      setReportPage(1);
                    }}
                    placeholder="Search across all columns..."
                    style={{
                      width: '100%',
                      padding: '12px 16px 12px 44px',
                      border: '2px solid #e2e8f0',
                      borderRadius: '10px',
                      fontSize: '14px',
                      outline: 'none',
                      background: '#f8fafc',
                      transition: 'all 0.2s ease'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#3b82f6';
                      e.currentTarget.style.background = 'white';
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = '#e2e8f0';
                      e.currentTarget.style.background = '#f8fafc';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                  <span className="material-icons" style={{
                    position: 'absolute',
                    left: '14px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#94a3b8',
                    pointerEvents: 'none',
                    fontSize: '20px'
                  }}>search</span>
                  {reportSearch && (
                    <button
                      onClick={() => {
                        setReportSearch('');
                        setReportPage(1);
                      }}
                      style={{
                        position: 'absolute',
                        right: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '4px',
                        borderRadius: '4px',
                        color: '#94a3b8',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#f1f5f9';
                        e.currentTarget.style.color = '#64748b';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = '#94a3b8';
                      }}
                      title="Clear search"
                    >
                      <span className="material-icons" style={{ fontSize: '18px' }}>close</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Table */}
              <div style={{
                overflowX: 'auto',
                border: '2px solid #e2e8f0',
                borderRadius: '12px',
                background: 'white',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
              }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '14px'
                }}>
                  <thead>
                    <tr style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)' }}>
                      {reportData.columns.map((column) => (
                        <th
                          key={column.key}
                          style={{
                            padding: '14px 18px',
                            textAlign: 'left',
                            fontWeight: '600',
                            color: '#1e293b',
                            borderBottom: '2px solid #e2e8f0',
                            whiteSpace: 'nowrap',
                            cursor: 'pointer',
                            userSelect: 'none',
                            transition: 'all 0.2s ease',
                            position: 'sticky',
                            top: '0px',
                            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                            zIndex: 4
                          }}
                          onClick={() => {
                            if (reportSortBy === column.key) {
                              setReportSortOrder(reportSortOrder === 'asc' ? 'desc' : 'asc');
                            } else {
                              setReportSortBy(column.key);
                              setReportSortOrder('asc');
                            }
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#e2e8f0';
                            e.currentTarget.style.color = '#3b82f6';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)';
                            e.currentTarget.style.color = '#1e293b';
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span>{column.label}</span>
                            {reportSortBy === column.key ? (
                              <span className="material-icons" style={{
                                fontSize: '18px',
                                color: '#3b82f6',
                                transform: reportSortOrder === 'desc' ? 'rotate(180deg)' : 'none',
                                transition: 'transform 0.2s ease'
                              }}>
                                arrow_upward
                              </span>
                            ) : (
                              <span className="material-icons" style={{
                                fontSize: '18px',
                                color: '#cbd5e1',
                                opacity: 0
                              }}>
                                arrow_upward
                              </span>
                            )}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={reportData.columns.length}
                          style={{
                            padding: '60px 40px',
                            textAlign: 'center',
                            color: '#64748b'
                          }}
                        >
                          <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '12px'
                          }}>
                            <span className="material-icons" style={{ 
                              fontSize: '48px', 
                              color: '#cbd5e1' 
                            }}>
                              {reportSearch ? 'search_off' : 'inbox'}
                            </span>
                            <div>
                              <p style={{ 
                                fontSize: '16px', 
                                fontWeight: '500', 
                                color: '#475569',
                                margin: '0 0 4px 0'
                              }}>
                                {reportSearch ? 'No matching results' : 'No data available'}
                              </p>
                              {reportSearch && (
                                <p style={{ 
                                  fontSize: '14px', 
                                  color: '#94a3b8',
                                  margin: 0
                                }}>
                                  Try adjusting your search terms
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      paginatedRows.map((row, rowIndex) => (
                        <tr
                          key={rowIndex}
                          style={{
                            borderBottom: '1px solid #f1f5f9',
                            transition: 'all 0.15s ease',
                            background: rowIndex % 2 === 0 ? 'white' : '#fafbfc'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#eff6ff';
                            e.currentTarget.style.boxShadow = 'inset 4px 0 0 0 #3b82f6';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = rowIndex % 2 === 0 ? 'white' : '#fafbfc';
                            e.currentTarget.style.boxShadow = 'none';
                          }}
                        >
                          {reportData.columns.map((column) => (
                            <td
                              key={column.key}
                              style={{
                                padding: '14px 18px',
                                color: '#1e293b',
                                fontSize: '14px',
                                lineHeight: '1.5'
                              }}
                            >
                              {formatCellValue(row[column.key], column)}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalRows > 0 && (
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '24px',
                  paddingTop: '20px',
                  borderTop: '2px solid #e2e8f0',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}>
                  <div style={{ 
                    fontSize: '14px', 
                    color: '#475569',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <span className="material-icons" style={{ fontSize: '18px', color: '#94a3b8' }}>info</span>
                    <span>
                      Showing <strong style={{ color: '#1e293b' }}>{reportStart.toLocaleString()}</strong> to{' '}
                      <strong style={{ color: '#1e293b' }}>{reportEnd.toLocaleString()}</strong> of{' '}
                      <strong style={{ color: '#1e293b' }}>{totalRows.toLocaleString()}</strong> rows
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button
                      onClick={() => {
                        const newPage = Math.max(1, reportPage - 1);
                        setReportPage(newPage);
                        setReportPageInput(String(newPage));
                      }}
                      disabled={reportPage === 1}
                      style={{
                        padding: '8px 14px',
                        border: '2px solid #e2e8f0',
                        borderRadius: '8px',
                        background: reportPage === 1 ? '#f8fafc' : 'white',
                        color: reportPage === 1 ? '#cbd5e1' : '#475569',
                        cursor: reportPage === 1 ? 'not-allowed' : 'pointer',
                        fontSize: '14px',
                        fontWeight: '500',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        if (reportPage !== 1) {
                          e.currentTarget.style.borderColor = '#3b82f6';
                          e.currentTarget.style.color = '#3b82f6';
                          e.currentTarget.style.background = '#eff6ff';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (reportPage !== 1) {
                          e.currentTarget.style.borderColor = '#e2e8f0';
                          e.currentTarget.style.color = '#475569';
                          e.currentTarget.style.background = 'white';
                        }
                      }}
                    >
                      <span className="material-icons" style={{ fontSize: '18px' }}>chevron_left</span>
                      Previous
                    </button>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '0 12px',
                      background: '#f8fafc',
                      borderRadius: '8px',
                      border: '2px solid #e2e8f0'
                    }}>
                      <span style={{ fontSize: '13px', color: '#64748b' }}>Page</span>
                      <input
                        type="number"
                        value={reportPageInput}
                        onChange={(e) => setReportPageInput(e.target.value)}
                        onBlur={() => {
                          const page = parseInt(reportPageInput, 10);
                          if (!isNaN(page) && page >= 1 && page <= Math.ceil(totalRows / reportPageSize)) {
                            setReportPage(page);
                          } else {
                            setReportPageInput(String(reportPage));
                          }
                        }}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            const page = parseInt(reportPageInput, 10);
                            if (!isNaN(page) && page >= 1 && page <= Math.ceil(totalRows / reportPageSize)) {
                              setReportPage(page);
                            } else {
                              setReportPageInput(String(reportPage));
                            }
                          }
                        }}
                        style={{
                          width: '50px',
                          padding: '4px 8px',
                          border: 'none',
                          background: 'transparent',
                          textAlign: 'center',
                          fontSize: '14px',
                          fontWeight: '600',
                          color: '#1e293b',
                          outline: 'none'
                        }}
                        min="1"
                        max={Math.ceil(totalRows / reportPageSize)}
                      />
                      <span style={{ fontSize: '13px', color: '#64748b' }}>
                        of {Math.ceil(totalRows / reportPageSize)}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        const maxPage = Math.ceil(totalRows / reportPageSize);
                        const newPage = Math.min(maxPage, reportPage + 1);
                        setReportPage(newPage);
                        setReportPageInput(String(newPage));
                      }}
                      disabled={reportPage >= Math.ceil(totalRows / reportPageSize)}
                      style={{
                        padding: '8px 14px',
                        border: '2px solid #e2e8f0',
                        borderRadius: '8px',
                        background: reportPage >= Math.ceil(totalRows / reportPageSize) ? '#f8fafc' : 'white',
                        color: reportPage >= Math.ceil(totalRows / reportPageSize) ? '#cbd5e1' : '#475569',
                        cursor: reportPage >= Math.ceil(totalRows / reportPageSize) ? 'not-allowed' : 'pointer',
                        fontSize: '14px',
                        fontWeight: '500',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        if (reportPage < Math.ceil(totalRows / reportPageSize)) {
                          e.currentTarget.style.borderColor = '#3b82f6';
                          e.currentTarget.style.color = '#3b82f6';
                          e.currentTarget.style.background = '#eff6ff';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (reportPage < Math.ceil(totalRows / reportPageSize)) {
                          e.currentTarget.style.borderColor = '#e2e8f0';
                          e.currentTarget.style.color = '#475569';
                          e.currentTarget.style.background = 'white';
                        }
                      }}
                    >
                      Next
                      <span className="material-icons" style={{ fontSize: '18px' }}>chevron_right</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomReports;

