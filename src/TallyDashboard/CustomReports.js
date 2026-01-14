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
    
    // Filter and process data
    let filteredData = [...salesData];
    
    // Apply filters
    if (report.filters && report.filters.length > 0) {
      report.filters.forEach(filter => {
        filteredData = filteredData.filter(item => {
          const fieldValue = getFieldValue(item, filter.field);
          const stringValue = String(fieldValue ?? '').trim();
          return filter.values.includes(stringValue);
        });
      });
    }
    
    // Build rows with only selected fields
    const rows = filteredData.map(item => {
      const row = {};
      report.fields.forEach(fieldValue => {
        row[fieldValue] = getFieldValue(item, fieldValue);
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
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '24px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px'
        }}>
          <h2 style={{
            fontSize: '24px',
            fontWeight: '700',
            color: '#1e293b',
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <span className="material-icons" style={{ fontSize: '28px', color: '#3b82f6' }}>summarize</span>
            Custom Reports
          </h2>
          
          {reports.length > 0 && (
            <div style={{ position: 'relative', width: '300px' }}>
              <input
                type="text"
                value={reportSearch}
                onChange={(e) => setReportSearch(e.target.value)}
                placeholder="Search reports..."
                style={{
                  width: '100%',
                  padding: '10px 40px 10px 14px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
              <span className="material-icons" style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#94a3b8',
                pointerEvents: 'none'
              }}>search</span>
            </div>
          )}
        </div>

        {reports.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            color: '#64748b'
          }}>
            <span className="material-icons" style={{ fontSize: '64px', color: '#cbd5e1', marginBottom: '16px', display: 'block' }}>
              summarize
            </span>
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#475569', marginBottom: '8px' }}>
              No Custom Reports
            </h3>
            <p style={{ fontSize: '14px', color: '#94a3b8' }}>
              Create your first custom report from the Sales Dashboard
            </p>
          </div>
        ) : filteredReports.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '40px 20px',
            color: '#64748b'
          }}>
            <span className="material-icons" style={{ fontSize: '48px', color: '#cbd5e1', marginBottom: '12px', display: 'block' }}>
              search_off
            </span>
            <p style={{ fontSize: '14px' }}>No reports found matching your search</p>
          </div>
        ) : (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            {filteredReports.map((report) => (
              <div
                key={report.id}
                onClick={() => handleOpenReport(report)}
                style={{
                  background: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '16px 20px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  position: 'relative',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#f8fafc';
                  e.currentTarget.style.borderColor = '#cbd5e1';
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'white';
                  e.currentTarget.style.borderColor = '#e2e8f0';
                  e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.05)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span className="material-icons" style={{ fontSize: '24px', color: '#3b82f6' }}>description</span>
                  <h3 style={{
                    fontSize: '16px',
                    fontWeight: '600',
                    color: '#1e293b',
                    margin: 0,
                    flex: 1
                  }}>
                    {report.title}
                  </h3>
                  <button
                    onClick={(e) => handleDeleteReport(report.id, e)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '6px',
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ef4444',
                      transition: 'all 0.2s ease',
                      flexShrink: 0
                    }}
                    onMouseEnter={(e) => {
                      e.stopPropagation();
                      e.currentTarget.style.background = '#fef2f2';
                    }}
                    onMouseLeave={(e) => {
                      e.stopPropagation();
                      e.currentTarget.style.background = 'transparent';
                    }}
                    title="Delete report"
                  >
                    <span className="material-icons" style={{ fontSize: '20px' }}>delete</span>
                  </button>
                </div>
                <div style={{
                  fontSize: '13px',
                  color: '#64748b',
                  marginLeft: '36px'
                }}>
                  <strong>{report.fields.length}</strong> fields
                  {report.filters && report.filters.length > 0 && (
                    <span style={{ marginLeft: '12px' }}>
                      • <strong>{report.filters.length}</strong> filter{report.filters.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <div style={{
                  fontSize: '12px',
                  color: '#94a3b8',
                  marginTop: '8px',
                  paddingTop: '8px',
                  borderTop: '1px solid #e2e8f0',
                  marginLeft: '36px'
                }}>
                  Created: {new Date(report.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
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
            background: 'rgba(0, 0, 0, 0.5)',
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
              borderRadius: '16px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
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
              padding: '20px 24px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexShrink: 0
            }}>
              <h2 style={{
                fontSize: '20px',
                fontWeight: '700',
                color: '#1e293b',
                margin: 0
              }}>
                {selectedReport.title}
              </h2>
              <button
                onClick={() => setShowReportModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '4px',
                  color: '#64748b'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#f1f5f9';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <span className="material-icons" style={{ fontSize: '24px' }}>close</span>
              </button>
            </div>

            {/* Modal Content */}
            <div style={{
              flex: 1,
              overflow: 'auto',
              padding: '20px 24px'
            }}>
              {/* Search and Filters */}
              <div style={{ marginBottom: '16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
                  <input
                    type="text"
                    value={reportSearch}
                    onChange={(e) => {
                      setReportSearch(e.target.value);
                      setReportPage(1);
                    }}
                    placeholder="Search data..."
                    style={{
                      width: '100%',
                      padding: '10px 40px 10px 14px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  />
                  <span className="material-icons" style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#94a3b8',
                    pointerEvents: 'none'
                  }}>search</span>
                </div>
                <div style={{ fontSize: '14px', color: '#64748b' }}>
                  {totalRows} row{totalRows !== 1 ? 's' : ''}
                </div>
              </div>

              {/* Table */}
              <div style={{
                overflowX: 'auto',
                border: '1px solid #e2e8f0',
                borderRadius: '8px'
              }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '13px'
                }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      {reportData.columns.map((column) => (
                        <th
                          key={column.key}
                          style={{
                            padding: '12px 16px',
                            textAlign: 'left',
                            fontWeight: '600',
                            color: '#1e293b',
                            borderBottom: '2px solid #e2e8f0',
                            whiteSpace: 'nowrap',
                            cursor: 'pointer',
                            userSelect: 'none'
                          }}
                          onClick={() => {
                            if (reportSortBy === column.key) {
                              setReportSortOrder(reportSortOrder === 'asc' ? 'desc' : 'asc');
                            } else {
                              setReportSortBy(column.key);
                              setReportSortOrder('asc');
                            }
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {column.label}
                            {reportSortBy === column.key && (
                              <span className="material-icons" style={{
                                fontSize: '16px',
                                transform: reportSortOrder === 'desc' ? 'rotate(180deg)' : 'none'
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
                            padding: '40px',
                            textAlign: 'center',
                            color: '#94a3b8'
                          }}
                        >
                          No data available
                        </td>
                      </tr>
                    ) : (
                      paginatedRows.map((row, rowIndex) => (
                        <tr
                          key={rowIndex}
                          style={{
                            borderBottom: '1px solid #f1f5f9',
                            transition: 'background 0.15s'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#f8fafc';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'white';
                          }}
                        >
                          {reportData.columns.map((column) => (
                            <td
                              key={column.key}
                              style={{
                                padding: '12px 16px',
                                color: '#1e293b'
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
                  marginTop: '16px',
                  paddingTop: '16px',
                  borderTop: '1px solid #e2e8f0'
                }}>
                  <div style={{ fontSize: '13px', color: '#64748b' }}>
                    Showing {reportStart} to {reportEnd} of {totalRows} rows
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
                        padding: '6px 12px',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        background: reportPage === 1 ? '#f8fafc' : 'white',
                        color: reportPage === 1 ? '#cbd5e1' : '#64748b',
                        cursor: reportPage === 1 ? 'not-allowed' : 'pointer',
                        fontSize: '13px'
                      }}
                    >
                      Previous
                    </button>
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
                        width: '60px',
                        padding: '6px',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        textAlign: 'center',
                        fontSize: '13px'
                      }}
                      min="1"
                      max={Math.ceil(totalRows / reportPageSize)}
                    />
                    <span style={{ fontSize: '13px', color: '#64748b' }}>
                      of {Math.ceil(totalRows / reportPageSize)}
                    </span>
                    <button
                      onClick={() => {
                        const maxPage = Math.ceil(totalRows / reportPageSize);
                        const newPage = Math.min(maxPage, reportPage + 1);
                        setReportPage(newPage);
                        setReportPageInput(String(newPage));
                      }}
                      disabled={reportPage >= Math.ceil(totalRows / reportPageSize)}
                      style={{
                        padding: '6px 12px',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        background: reportPage >= Math.ceil(totalRows / reportPageSize) ? '#f8fafc' : 'white',
                        color: reportPage >= Math.ceil(totalRows / reportPageSize) ? '#cbd5e1' : '#64748b',
                        cursor: reportPage >= Math.ceil(totalRows / reportPageSize) ? 'not-allowed' : 'pointer',
                        fontSize: '13px'
                      }}
                    >
                      Next
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

