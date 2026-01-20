import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { hybridCache } from '../utils/hybridCache';
import { getNestedFieldValue, extractAllFieldsFromCache, getNestedFieldValues, HIERARCHY_MAP, getHierarchyLevel } from './salesdashboard/utils/fieldExtractor';
import { loadUdfConfig, getAvailableUdfFields } from '../utils/udfConfigLoader';
import * as XLSX from 'xlsx';

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
  const [hideDuplicates, setHideDuplicates] = useState(true);
  const [showCustomReportModal, setShowCustomReportModal] = useState(false);
  
  // Pivot Table Fields state
  const [showPivotFieldsPanel, setShowPivotFieldsPanel] = useState(false);
  const [pivotConfig, setPivotConfig] = useState({
    filters: [],    // Fields used as filters
    rows: [],       // Fields used as row labels
    columns: [],    // Fields used as column labels
    values: []      // Fields to aggregate
  });
  const [pivotTableData, setPivotTableData] = useState(null);
  const [isPivotMode, setIsPivotMode] = useState(false);
  const [fieldConfigModal, setFieldConfigModal] = useState(null); // { field, area, index }

  // Load reports from localStorage
  const loadReports = useCallback(() => {
    try {
      const storedReports = JSON.parse(localStorage.getItem('customReports') || '[]');
      setReports(storedReports);
    } catch (error) {
      console.error('Error loading custom reports:', error);
      setReports([]);
    }
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

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

          // Load customer/ledger data and create lookup map
          try {
            const customers = await hybridCache.getCustomerData(currentCompanyObj);
            if (customers && Array.isArray(customers)) {
              const customerLookupMap = new Map();
              customers.forEach(customer => {
                const name = customer.NAME || customer.name;
                const guid = customer.GUID || customer.guid;
                if (name) {
                  customerLookupMap.set(String(name).toLowerCase(), customer);
                }
                if (guid) {
                  customerLookupMap.set(String(guid), customer);
                }
                // Also index by partyledgernameid if available
                const id = customer.MASTERID || customer.masterid || customer.PARTYLEDGERNAMEID || customer.partyledgernameid;
                if (id) {
                  customerLookupMap.set(String(id), customer);
                }
              });
              window.__customerLookupMap = customerLookupMap;
              console.log(`✅ Loaded ${customers.length} customers into lookup map (parent component)`);
            } else {
              window.__customerLookupMap = new Map();
            }
          } catch (customerError) {
            console.error('Error loading customer data:', customerError);
            window.__customerLookupMap = new Map();
          }

          // Load stock items data and create lookup map
          try {
            const { tallyloc_id, company } = currentCompanyObj;
            const stockItemsCacheKey = `stockitems_${tallyloc_id}_${company}`;
            const stockItemsCache = await hybridCache.getSalesData(stockItemsCacheKey);
            if (stockItemsCache && stockItemsCache.stockItems && Array.isArray(stockItemsCache.stockItems)) {
              const stockItems = stockItemsCache.stockItems;
              const stockItemLookupMap = new Map();
              stockItems.forEach(item => {
                const name = item.NAME || item.name;
                const guid = item.GUID || item.guid;
                if (name) {
                  stockItemLookupMap.set(String(name).toLowerCase(), item);
                }
                if (guid) {
                  stockItemLookupMap.set(String(guid), item);
                }
                // Also index by stockitemnameid if available
                const id = item.MASTERID || item.masterid || item.STOCKITEMNAMEID || item.stockitemnameid;
                if (id) {
                  stockItemLookupMap.set(String(id), item);
                }
              });
              window.__stockItemLookupMap = stockItemLookupMap;
              console.log(`✅ Loaded ${stockItems.length} stock items into lookup map (parent component)`);
            } else {
              window.__stockItemLookupMap = new Map();
            }
          } catch (stockItemError) {
            console.error('Error loading stock items data:', stockItemError);
            window.__stockItemLookupMap = new Map();
          }
          
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
        } else {
          // No vouchers data, but still initialize empty lookup maps
          window.__customerLookupMap = new Map();
          window.__stockItemLookupMap = new Map();
        }
      } catch (error) {
        console.error('Error loading sales data:', error);
        setSalesData([]);
        // Initialize empty lookup maps on error
        window.__customerLookupMap = new Map();
        window.__stockItemLookupMap = new Map();
      }
    };
    
    loadSalesData();
  }, []);

  // Helper to get field value
  const getFieldValue = (item, fieldName) => {
    if (!item || !fieldName) return null;
    
    // Handle fields from customer table (customers.field or customers.address.field)
    if (fieldName.startsWith('customers.')) {
      const customerLookupMap = window.__customerLookupMap;
      if (!customerLookupMap || customerLookupMap.size === 0) {
        console.warn('⚠️ Customer lookup map not available or empty for field:', fieldName);
        return null;
      }
      
      // Get configured relationship for customers table
      const relationship = (window.__reportRelationships || []).find(r => r.toTable === 'customers');
      const fromField = relationship?.fromField || 'partyledgernameid'; // Default fallback
      const toField = relationship?.toField || 'MASTERID'; // Default fallback - vouchers → ledger: partyledgernameid → masterid
      
      // Get customer identifier from item using configured relationship field
      // Support both original items and row objects
      let customerIdentifier = null;
      
      // Try configured fromField first
      customerIdentifier = item[fromField] || item.__originalItem?.[fromField];
      
      // Fallback to common fields if configured field not found
      if (!customerIdentifier) {
        if (fromField.includes('name') || fromField.includes('Name')) {
          // Name-based identifiers (voucher-level party, etc.)
          customerIdentifier = item.__partyledgername || item.partyledgername || item.customer || item.partyname || item.party;
          const originalItem = item.__originalItem;
          if (!customerIdentifier && originalItem) {
            customerIdentifier = originalItem.partyledgername || originalItem.customer || originalItem.partyname || originalItem.party;
          }
        } else if (fromField.includes('id') || fromField.includes('Id') || fromField.includes('ID')) {
          // ID-based identifiers
          // Priority order based on mapping:
          // 1) vouchers.partyledgernameid (party/ledger id)
          // 2) ledgerentries.ledgernameid (ledgerentries → ledger: ledgernameid → masterid)
          // 3) accountingallocation.ledgernameid (accountingallocation → ledger: ledgernameid → masterid)
          customerIdentifier = item.__partyid || item.partyledgernameid || item.partyid;
          
          // Also check for flattened ledgerentries/accountingallocation identifiers on the row
          if (!customerIdentifier) {
            customerIdentifier = item.ledgernameid;
          }
          
          const originalItem = item.__originalItem;
          if (!customerIdentifier && originalItem) {
            customerIdentifier = originalItem.partyledgernameid || originalItem.partyid || originalItem.ledgernameid;
          }
        }
      }
      
      if (!customerIdentifier) {
        console.debug('⚠️ Customer identifier not found using field:', fromField);
        return null;
      }
      
      // Lookup customer using configured relationship
      let customer = null;
      const identifierStr = String(customerIdentifier);
      
      // Try exact match first
      customer = customerLookupMap.get(identifierStr) || 
                 customerLookupMap.get(identifierStr.toLowerCase());
      
      // Try matching by configured toField
      if (!customer) {
        for (const [key, value] of customerLookupMap.entries()) {
          const toFieldValue = value?.[toField] || value?.[toField.toLowerCase()] || value?.[toField.toUpperCase()];
          if (toFieldValue && String(toFieldValue) === identifierStr) {
            customer = value;
            break;
          }
        }
      }
      
      // Fallback to name-based matching if configured field is name-based
      if (!customer && (fromField.includes('name') || fromField.includes('Name'))) {
        const nameLower = identifierStr.toLowerCase();
        for (const [key, value] of customerLookupMap.entries()) {
          if (key.toLowerCase() === nameLower || String(value?.NAME || value?.name || '').toLowerCase() === nameLower) {
            customer = value;
            break;
          }
        }
      }
      
      if (!customer) {
        console.debug('⚠️ Customer not found in lookup map:', { 
          identifier: customerIdentifier, 
          fromField, 
          toField, 
          fieldName 
        });
        return null;
      }
      
      // Extract the field path after "customers."
      const fieldPath = fieldName.substring('customers.'.length);
      if (fieldPath.includes('.')) {
        // Nested field like customers.address.street
        return getNestedFieldValue(customer, fieldPath);
      } else {
        // Direct field like customers.name
        return customer[fieldPath] || customer[fieldPath.toUpperCase()] || customer[fieldPath.toLowerCase()] || null;
      }
    }
    
    // Handle fields from stock items table (stockitems.field)
    if (fieldName.startsWith('stockitems.')) {
      const stockItemLookupMap = window.__stockItemLookupMap;
      if (!stockItemLookupMap || stockItemLookupMap.size === 0) {
        console.warn('⚠️ Stock item lookup map not available or empty for field:', fieldName);
        return null;
      }
      
      // Get configured relationship for stockitems table
      const relationship = (window.__reportRelationships || []).find(r => r.toTable === 'stockitems');
      const fromField = relationship?.fromField || 'stockitemnameid'; // Default fallback
      const toField = relationship?.toField || 'MASTERID'; // Default fallback - allinventoryentries → stockitem: stockitemnameid → masterid
      
      // Get stock item identifier from item using configured relationship field
      // Support both original items and row objects
      let itemIdentifier = null;
      
      // Try configured fromField first
      itemIdentifier = item[fromField] || item.__originalItem?.[fromField];
      
      // Fallback to common fields if configured field not found
      if (!itemIdentifier) {
        if (fromField.includes('name') || fromField.includes('Name')) {
          itemIdentifier = item.__stockitemname || item.stockitemname || item.item;
          const originalItem = item.__originalItem;
          if (!itemIdentifier && originalItem) {
            itemIdentifier = originalItem.stockitemname || originalItem.item;
          }
        } else if (fromField.includes('id') || fromField.includes('Id') || fromField.includes('ID')) {
          itemIdentifier = item.__itemid || item.stockitemnameid || item.itemid;
          const originalItem = item.__originalItem;
          if (!itemIdentifier && originalItem) {
            itemIdentifier = originalItem.stockitemnameid || originalItem.itemid;
          }
        }
      }
      
      if (!itemIdentifier) {
        console.debug('⚠️ Stock item identifier not found using field:', fromField);
        return null;
      }
      
      // Lookup stock item using configured relationship
      let stockItem = null;
      const identifierStr = String(itemIdentifier);
      
      // Try exact match first
      stockItem = stockItemLookupMap.get(identifierStr) || 
                  stockItemLookupMap.get(identifierStr.toLowerCase());
      
      // Try matching by configured toField
      if (!stockItem) {
        for (const [key, value] of stockItemLookupMap.entries()) {
          const toFieldValue = value?.[toField] || value?.[toField.toLowerCase()] || value?.[toField.toUpperCase()];
          if (toFieldValue && String(toFieldValue) === identifierStr) {
            stockItem = value;
            break;
          }
        }
      }
      
      // Fallback to name-based matching if configured field is name-based
      if (!stockItem && (fromField.includes('name') || fromField.includes('Name'))) {
        const nameLower = identifierStr.toLowerCase();
        for (const [key, value] of stockItemLookupMap.entries()) {
          if (key.toLowerCase() === nameLower || String(value?.NAME || value?.name || '').toLowerCase() === nameLower) {
            stockItem = value;
            break;
          }
        }
      }
      
      if (!stockItem) {
        console.debug('⚠️ Stock item not found in lookup map:', { 
          identifier: itemIdentifier, 
          fromField, 
          toField, 
          fieldName 
        });
        return null;
      }
      
      // Extract the field path after "stockitems."
      const fieldPath = fieldName.substring('stockitems.'.length);
      return stockItem[fieldPath] || stockItem[fieldPath.toUpperCase()] || stockItem[fieldPath.toLowerCase()] || null;
    }
    
    // Handle nested field paths (existing logic)
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

  // Helper to determine field type
  const getFieldType = (fieldName) => {
    if (!fieldName) return 'text';
    const lower = fieldName.toLowerCase();
    if (lower.includes('amount') || lower.includes('quantity') || lower.includes('qty') || 
        lower.includes('profit') || lower.includes('rate') || lower.includes('price') ||
        lower.includes('cost') || lower.includes('expense')) {
      return 'number';
    }
    if (lower.includes('date') || lower === 'date' || lower === 'cp_date') {
      return 'date';
    }
    return 'text';
  };

  // Helper to parse date strings
  const parseDate = (dateString) => {
    if (!dateString || dateString === '(blank)') return null;
    
    // Try various date formats
    // Format: YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) return date;
    }
    
    // Format: DD-MMM-YY (e.g., "1-Apr-24")
    const ddmmyyMatch = dateString.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})$/);
    if (ddmmyyMatch) {
      const [, day, month, year] = ddmmyyMatch;
      const monthMap = {
        'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
        'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
      };
      const monthIndex = monthMap[month.toLowerCase()];
      if (monthIndex !== undefined) {
        const fullYear = year.length === 2 ? 2000 + parseInt(year) : parseInt(year);
        const date = new Date(fullYear, monthIndex, parseInt(day));
        if (!isNaN(date.getTime())) return date;
      }
    }
    
    // Try standard Date parsing
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) return date;
    
    return null;
  };

  // Get available fields for pivot table (only fields from the current report table)
  const getAvailablePivotFields = useMemo(() => {
    if (!reportData || !reportData.columns || reportData.columns.length === 0) return [];
    
    // Use only the fields that are in the current report table
    return reportData.columns.map(column => ({
      field: column.key,
      label: column.label,
      type: getFieldType(column.key)
    })).sort((a, b) => a.label.localeCompare(b.label));
  }, [reportData]);

  // Aggregate values helper
  const aggregateValues = useCallback((items, field, aggregation) => {
    if (!items || items.length === 0) return 0;
    
    const values = items.map(item => {
      const val = getFieldValue(item, field);
      if (val == null || val === '') return null;
      const numVal = typeof val === 'number' ? val : parseFloat(val);
      return isNaN(numVal) ? null : numVal;
    }).filter(v => v != null);

    switch(aggregation) {
      case 'sum':
        return values.reduce((a, b) => a + b, 0);
      case 'count':
        return items.length;
      case 'average':
        return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
      case 'min':
        return values.length > 0 ? Math.min(...values) : 0;
      case 'max':
        return values.length > 0 ? Math.max(...values) : 0;
      case 'distinctCount':
        return new Set(items.map(item => {
          const val = getFieldValue(item, field);
          return val != null ? String(val) : '';
        }).filter(v => v !== '')).size;
      default:
        return values.reduce((a, b) => a + b, 0);
    }
  }, []);

  // Pivot Table Generation Function
  const generatePivotTable = useCallback((data, config, getFieldTypeFn, parseDateFn) => {
    if (!data || data.length === 0 || (!config.rows.length && !config.columns.length && !config.values.length)) {
      return null;
    }

    // Step 1: Apply filters
    let filteredData = [...data];
    if (config.filters && config.filters.length > 0) {
      config.filters.forEach(filter => {
        if (filter.values && filter.values.length > 0) {
          filteredData = filteredData.filter(item => {
            const fieldValue = getFieldValue(item, filter.field);
            const stringValue = String(fieldValue ?? '').trim();
            return filter.values.includes(stringValue);
          });
        }
      });
    }

    // Step 2: Group data by row and column fields
    const groupedData = new Map(); // rowKey -> Map(columnKey -> items[])
    
    filteredData.forEach(item => {
      // Create row key from row fields
      const rowKey = config.rows.length > 0 
        ? config.rows.map(r => {
            const val = getFieldValue(item, r.field);
            return val != null ? String(val) : '(blank)';
          }).join('|')
        : 'Total';
      
      // Create column key from column fields
      const colKey = config.columns.length > 0
        ? config.columns.map(c => {
            const val = getFieldValue(item, c.field);
            return val != null ? String(val) : '(blank)';
          }).join('|')
        : 'Total';
      
      if (!groupedData.has(rowKey)) {
        groupedData.set(rowKey, new Map());
      }
      if (!groupedData.get(rowKey).has(colKey)) {
        groupedData.get(rowKey).set(colKey, []);
      }
      groupedData.get(rowKey).get(colKey).push(item);
    });

    // Step 3: Aggregate values
    const pivotData = {
      rows: [],
      columns: [],
      data: {},
      rowKeys: [],
      colKeys: new Set(),
      totals: {}
    };

    // Collect all unique row and column keys
    groupedData.forEach((columns, rowKey) => {
      pivotData.rowKeys.push(rowKey);
      columns.forEach((items, colKey) => {
        pivotData.colKeys.add(colKey);
      });
    });

    // Sort row keys intelligently (handle dates, numbers, and text)
    pivotData.rowKeys.sort((a, b) => {
      // Split keys by | to handle hierarchical grouping
      const aParts = a.split('|');
      const bParts = b.split('|');
      
      // Compare each level of the hierarchy
      for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
        const aVal = aParts[i] || '';
        const bVal = bParts[i] || '';
        
        // Check if this field is a date field (based on field name in config)
        const rowField = config.rows[i];
        if (rowField) {
          const fieldType = getFieldTypeFn ? getFieldTypeFn(rowField.field) : 'text';
          
          if (fieldType === 'date') {
            // Parse dates and compare chronologically
            const aDate = parseDateFn ? parseDateFn(aVal) : null;
            const bDate = parseDateFn ? parseDateFn(bVal) : null;
            
            if (aDate && bDate) {
              const diff = aDate.getTime() - bDate.getTime();
              if (diff !== 0) return diff;
            } else if (aDate) return -1;
            else if (bDate) return 1;
          } else if (fieldType === 'number') {
            // Compare as numbers
            const aNum = parseFloat(aVal);
            const bNum = parseFloat(bVal);
            if (!isNaN(aNum) && !isNaN(bNum)) {
              const diff = aNum - bNum;
              if (diff !== 0) return diff;
            }
          }
        }
        
        // Fallback to string comparison
        if (aVal !== bVal) {
          return aVal.localeCompare(bVal, undefined, { numeric: true, sensitivity: 'base' });
        }
      }
      return 0;
    });
    
    pivotData.colKeys = Array.from(pivotData.colKeys).sort();

    // Aggregate values for each cell
    pivotData.rowKeys.forEach(rowKey => {
      pivotData.data[rowKey] = {};
      const columns = groupedData.get(rowKey);
      
      pivotData.colKeys.forEach(colKey => {
        const items = columns ? columns.get(colKey) || [] : [];
        pivotData.data[rowKey][colKey] = {};
        
        config.values.forEach(valueField => {
          const aggregated = aggregateValues(items, valueField.field, valueField.aggregation || 'sum');
          pivotData.data[rowKey][colKey][valueField.field] = aggregated;
        });
      });
    });

    // Calculate row totals
    pivotData.rowKeys.forEach(rowKey => {
      pivotData.totals[rowKey] = {};
      config.values.forEach(valueField => {
        let total = 0;
        pivotData.colKeys.forEach(colKey => {
          const val = pivotData.data[rowKey][colKey][valueField.field];
          if (val != null) {
            if (valueField.aggregation === 'count' || valueField.aggregation === 'distinctCount') {
              total += val;
            } else {
              total += (typeof val === 'number' ? val : parseFloat(val) || 0);
            }
          }
        });
        pivotData.totals[rowKey][valueField.field] = total;
      });
    });

    // Calculate column totals
    const colTotals = {};
    pivotData.colKeys.forEach(colKey => {
      colTotals[colKey] = {};
      config.values.forEach(valueField => {
        let total = 0;
        pivotData.rowKeys.forEach(rowKey => {
          const val = pivotData.data[rowKey][colKey][valueField.field];
          if (val != null) {
            if (valueField.aggregation === 'count' || valueField.aggregation === 'distinctCount') {
              total += val;
            } else {
              total += (typeof val === 'number' ? val : parseFloat(val) || 0);
            }
          }
        });
        colTotals[colKey][valueField.field] = total;
      });
    });
    pivotData.colTotals = colTotals;

    // Calculate grand total
    const grandTotal = {};
    config.values.forEach(valueField => {
      let total = 0;
      pivotData.rowKeys.forEach(rowKey => {
        const rowTotal = pivotData.totals[rowKey][valueField.field];
        if (rowTotal != null) {
          total += rowTotal;
        }
      });
      grandTotal[valueField.field] = total;
    });
    pivotData.grandTotal = grandTotal;

    return pivotData;
  }, [aggregateValues]);

  // Generate pivot table when config changes (use report table data, not all sales data)
  useEffect(() => {
    if (isPivotMode && pivotConfig && (pivotConfig.rows.length > 0 || pivotConfig.columns.length > 0) && pivotConfig.values.length > 0) {
      // Use reportData.rows which contains only the data from the current report table
      const dataToUse = reportData && reportData.rows && reportData.rows.length > 0 
        ? reportData.rows 
        : [];
      const pivotData = generatePivotTable(dataToUse, pivotConfig, getFieldType, parseDate);
      setPivotTableData(pivotData);
    } else {
      setPivotTableData(null);
    }
  }, [pivotConfig, isPivotMode, reportData, generatePivotTable]);

  // Save pivot config to report
  const savePivotConfigToReport = useCallback((config) => {
    if (!selectedReport) return;
    
    try {
      const existingReports = JSON.parse(localStorage.getItem('customReports') || '[]');
      const updatedReports = existingReports.map(r => {
        if (r.id === selectedReport.id) {
          return {
            ...r,
            pivotConfig: config,
            isPivotMode: config && (config.rows.length > 0 || config.columns.length > 0) && config.values.length > 0
          };
        }
        return r;
      });
      localStorage.setItem('customReports', JSON.stringify(updatedReports));
      
      // Update the selectedReport state
      setSelectedReport(prev => prev ? {
        ...prev,
        pivotConfig: config,
        isPivotMode: config && (config.rows.length > 0 || config.columns.length > 0) && config.values.length > 0
      } : null);
    } catch (error) {
      console.error('Error saving pivot config:', error);
    }
  }, [selectedReport]);

  // Open report modal
  const handleOpenReport = (report) => {
    setSelectedReport(report);
    
    // Store relationship configuration for use in getFieldValue
    if (report.relationships && Array.isArray(report.relationships)) {
      window.__reportRelationships = report.relationships;
    } else {
      // Use default relationships if not configured
      window.__reportRelationships = [];
      // Auto-detect default relationships based on selected fields
      const hasCustomerFields = report.fields.some(f => f.startsWith('customers.'));
      const hasStockItemFields = report.fields.some(f => f.startsWith('stockitems.'));
      if (hasCustomerFields) {
        window.__reportRelationships.push({
          fromTable: 'vouchers',
          fromField: 'partyledgernameid',
          toTable: 'customers',
          toField: 'MASTERID', // vouchers → ledger: partyledgernameid → masterid
          joinType: 'left'
        });
      }
      if (hasStockItemFields) {
        window.__reportRelationships.push({
          fromTable: 'vouchers',
          fromField: 'stockitemnameid',
          toTable: 'stockitems',
          toField: 'MASTERID', // allinventoryentries → stockitem: stockitemnameid → masterid
          joinType: 'left'
        });
      }
    }
    
    // Restore pivot table state if saved
    if (report.pivotConfig) {
      setPivotConfig(report.pivotConfig);
      setIsPivotMode(report.isPivotMode || false);
      setShowPivotFieldsPanel(report.showPivotFieldsPanel || false);
    } else {
      // Reset to defaults if no saved state
      setPivotConfig({ filters: [], rows: [], columns: [], values: [] });
      setIsPivotMode(false);
      setShowPivotFieldsPanel(false);
    }
    
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
        // Skip array entry logic for customer/stockitems table fields - they need lookup
        if (fieldValue.startsWith('customers.') || fieldValue.startsWith('stockitems.')) {
          row[fieldValue] = getFieldValue(item, fieldValue);
        }
        // If field is nested array field and we have expanded array entry, get from array entry
        else if (fieldValue.includes('.') && item.__arrayEntry) {
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
      
      // Preserve identifiers needed for customer/stockitem lookups in pivot tables
      // Store them in a way that getFieldValue can access them
      row.__partyledgername = item.partyledgername || item.customer || item.partyname || item.party;
      row.__partyid = item.partyledgernameid || item.partyid;
      row.__stockitemname = item.stockitemname || item.item;
      row.__itemid = item.stockitemnameid || item.itemid;
      row.__masterid = item.masterid || item.mstid;
      row.__originalItem = item; // Preserve full item for complex lookups
      
      return row;
    });
    
    setReportData({ rows, columns });
    setShowReportModal(true);
    setReportPage(1);
    setReportSearch('');
    setColumnFilters({});
    setHideDuplicates(true);
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
    
    // Remove duplicates if checkbox is enabled
    if (hideDuplicates) {
      const uniqueRows = [];
      const seenRows = new Set();
      
      filtered.forEach(row => {
        // Create a unique key for the row by concatenating all column values
        const rowKey = reportData.columns.map(col => {
          const val = row[col.key] ?? '';
          return String(val).trim();
        }).join('|||');
        
        if (!seenRows.has(rowKey)) {
          seenRows.add(rowKey);
          uniqueRows.push(row);
        }
      });
      
      filtered = uniqueRows;
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
  }, [reportData, columnFilters, reportSearch, reportSortBy, reportSortOrder, showReportModal, hideDuplicates]);

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
      padding: '24px', 
      width: '100%',
      maxWidth: '100%', 
      margin: 0,
      background: '#f8fafc',
      minHeight: '100vh',
      boxSizing: 'border-box'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '20px',
        padding: '40px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '40px',
          flexWrap: 'wrap',
          gap: '20px',
          width: '100%'
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
          
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '20px', 
            flexWrap: 'wrap', 
            flex: '1 1 auto',
            justifyContent: 'flex-end',
            minWidth: 0
          }}>
            {/* Create Custom Report Button */}
            <button
              onClick={() => {
                console.log('🔒 Opening Custom Report Modal - using existing sales data only, no API calls should occur. Sales data count:', salesData.length);
                setShowCustomReportModal(true);
              }}
              disabled={salesData.length === 0}
              style={{
                background: salesData.length === 0 ? '#f1f5f9' : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                color: salesData.length === 0 ? '#94a3b8' : 'white',
                border: 'none',
                borderRadius: '10px',
                padding: '12px 20px',
                cursor: salesData.length === 0 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '14px',
                fontWeight: '600',
                transition: 'all 0.2s ease',
                whiteSpace: 'nowrap',
                boxShadow: salesData.length === 0 ? 'none' : '0 4px 8px rgba(59, 130, 246, 0.3)'
              }}
              onMouseEnter={(e) => {
                if (salesData.length > 0) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 12px rgba(59, 130, 246, 0.4)';
                }
              }}
              onMouseLeave={(e) => {
                if (salesData.length > 0) {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(59, 130, 246, 0.3)';
                }
              }}
            >
              <span className="material-icons" style={{ fontSize: '20px' }}>add</span>
              <span>Create Custom Report</span>
            </button>
          
          {reports.length > 0 && (
              <div style={{ 
                position: 'relative', 
                flex: '1 1 auto',
                minWidth: '450px',
                maxWidth: '500px',
                boxSizing: 'border-box'
              }}>
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
                    background: '#f8fafc',
                    boxSizing: 'border-box'
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
            <p style={{ fontSize: '15px', color: '#64748b', maxWidth: '400px', margin: '0 auto 24px' }}>
              Create your first custom report to view and analyze your data
            </p>
            <button
              onClick={() => {
                console.log('🔒 Opening Custom Report Modal - using existing sales data only, no API calls should occur. Sales data count:', salesData.length);
                setShowCustomReportModal(true);
              }}
              disabled={salesData.length === 0}
              style={{
                background: salesData.length === 0 ? '#f1f5f9' : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                color: salesData.length === 0 ? '#94a3b8' : 'white',
                border: 'none',
                borderRadius: '10px',
                padding: '14px 28px',
                cursor: salesData.length === 0 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '15px',
                fontWeight: '600',
                transition: 'all 0.2s ease',
                boxShadow: salesData.length === 0 ? 'none' : '0 4px 8px rgba(59, 130, 246, 0.3)',
                margin: '0 auto'
              }}
              onMouseEnter={(e) => {
                if (salesData.length > 0) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 12px rgba(59, 130, 246, 0.4)';
                }
              }}
              onMouseLeave={(e) => {
                if (salesData.length > 0) {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(59, 130, 246, 0.3)';
                }
              }}
            >
              <span className="material-icons" style={{ fontSize: '22px' }}>add</span>
              <span>Create Custom Report</span>
            </button>
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
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '24px',
            width: '100%'
          }}>
            {filteredReports.map((report) => (
              <div
                key={report.id}
                onClick={() => handleOpenReport(report)}
                style={{
                  background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                  border: '1px solid #e2e8f0',
                  borderRadius: '16px',
                  padding: '24px',
                  cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  position: 'relative',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                  overflow: 'hidden',
                  height: '60px',
                  minHeight: '20px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%)';
                  e.currentTarget.style.borderColor = '#3b82f6';
                  e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(59, 130, 246, 0.2), 0 10px 10px -5px rgba(59, 130, 246, 0.1)';
                  e.currentTarget.style.transform = 'translateY(-4px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)';
                  e.currentTarget.style.borderColor = '#e2e8f0';
                  e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                
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
              // Don't reset pivot config - it's saved in the report
              // Just clear the generated pivot table data
              setPivotTableData(null);
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
                    if (isPivotMode && pivotTableData) {
                      // Export pivot table to Excel
                      const wb = XLSX.utils.book_new();
                      
                      // Helper to format values
                      const formatValue = (value, valueField) => {
                        if (value == null || value === undefined) return '-';
                        if (valueField.aggregation === 'count' || valueField.aggregation === 'distinctCount') {
                          return Math.round(value);
                        }
                        if (typeof value === 'number') {
                          if (valueField.format === 'currency') {
                            return value;
                          }
                          if (valueField.format === 'percentage') {
                            return value / 100;
                          }
                          return value;
                        }
                        return value;
                      };
                      
                      const splitKey = (key) => {
                        return key === 'Total' ? ['Total'] : key.split('|');
                      };
                      
                      // Build pivot table data array
                      const pivotRows = [];
                      
                      // Add headers
                      const headerRow = [];
                      
                      // Row field headers
                      pivotConfig.rows.forEach(rowField => {
                        headerRow.push(rowField.label);
                      });
                      
                      // Column headers
                      if (pivotConfig.columns.length > 0) {
                        pivotTableData.colKeys.forEach(colKey => {
                          const colValues = splitKey(colKey);
                          pivotConfig.values.forEach(valueField => {
                            headerRow.push(`${colValues.join(' / ')} - ${valueField.aggregation ? valueField.aggregation + ' of ' : ''}${valueField.label}`);
                          });
                        });
                      } else {
                        // No columns, just value headers
                        pivotConfig.values.forEach(valueField => {
                          headerRow.push(valueField.aggregation ? `${valueField.aggregation} of ${valueField.label}` : valueField.label);
                        });
                      }
                      
                      // Total column header
                      if (pivotConfig.values.length > 1 || Array.from(pivotTableData.colKeys).length > 1) {
                        pivotConfig.values.forEach(valueField => {
                          headerRow.push(`Total - ${valueField.aggregation ? valueField.aggregation + ' of ' : ''}${valueField.label}`);
                        });
                      }
                      
                      pivotRows.push(headerRow);
                      
                      // Add data rows
                      pivotTableData.rowKeys.forEach(rowKey => {
                        const rowValues = splitKey(rowKey);
                        const dataRow = [];
                        
                        // Row labels
                        rowValues.forEach(val => {
                          dataRow.push(val);
                        });
                        
                        // Data cells
                        pivotTableData.colKeys.forEach(colKey => {
                          pivotConfig.values.forEach(valueField => {
                            const val = pivotTableData.data[rowKey]?.[colKey]?.[valueField.field];
                            dataRow.push(formatValue(val, valueField));
                          });
                        });
                        
                        // Row totals
                        if (pivotConfig.values.length > 1 || Array.from(pivotTableData.colKeys).length > 1) {
                          pivotConfig.values.forEach(valueField => {
                            const val = pivotTableData.totals[rowKey]?.[valueField.field];
                            dataRow.push(formatValue(val, valueField));
                          });
                        }
                        
                        pivotRows.push(dataRow);
                      });
                      
                      // Add grand total row
                      if (pivotTableData.rowKeys.length > 0) {
                        const grandTotalRow = [];
                        grandTotalRow.push('Grand Total');
                        
                        // Empty cells for additional row fields
                        for (let i = 1; i < pivotConfig.rows.length; i++) {
                          grandTotalRow.push('');
                        }
                        
                        // Column totals
                        pivotTableData.colKeys.forEach(colKey => {
                          pivotConfig.values.forEach(valueField => {
                            const val = pivotTableData.colTotals[colKey]?.[valueField.field];
                            grandTotalRow.push(formatValue(val, valueField));
                          });
                        });
                        
                        // Grand total
                        if (pivotConfig.values.length > 1 || Array.from(pivotTableData.colKeys).length > 1) {
                          pivotConfig.values.forEach(valueField => {
                            const val = pivotTableData.grandTotal[valueField.field];
                            grandTotalRow.push(formatValue(val, valueField));
                          });
                        }
                        
                        pivotRows.push(grandTotalRow);
                      }
                      
                      // Create worksheet
                      const ws = XLSX.utils.aoa_to_sheet(pivotRows);
                      
                      // Set column widths
                      const colWidths = pivotRows[0].map((_, i) => {
                        const maxLength = Math.max(...pivotRows.map(row => String(row[i] || '').length));
                        return { wch: Math.min(Math.max(maxLength + 2, 10), 50) };
                      });
                      ws['!cols'] = colWidths;
                      
                      // Add worksheet to workbook
                      XLSX.utils.book_append_sheet(wb, ws, 'Pivot Table');
                      
                      // Write file
                      XLSX.writeFile(wb, `${selectedReport.title.replace(/[^a-z0-9]/gi, '_')}_pivot_${new Date().toISOString().split('T')[0]}.xlsx`);
                    } else {
                      // Export regular table to Excel
                      const wb = XLSX.utils.book_new();
                      
                      // Build data array
                      const dataRows = [
                        reportData.columns.map(col => col.label),
                      ...filteredReportRows.map(row =>
                        reportData.columns.map(col => {
                          const value = row[col.key] ?? '';
                            return value;
                          })
                        )
                      ];
                      
                      // Create worksheet
                      const ws = XLSX.utils.aoa_to_sheet(dataRows);
                      
                      // Set column widths
                      const colWidths = reportData.columns.map((col, i) => {
                        const maxLength = Math.max(
                          col.label.length,
                          ...filteredReportRows.map(row => String(row[col.key] || '').length)
                        );
                        return { wch: Math.min(Math.max(maxLength + 2, 10), 50) };
                      });
                      ws['!cols'] = colWidths;
                      
                      // Add worksheet to workbook
                      XLSX.utils.book_append_sheet(wb, ws, 'Report Data');
                      
                      // Write file
                      XLSX.writeFile(wb, `${selectedReport.title.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`);
                    }
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
                  onClick={() => {
                    setShowReportModal(false);
              // Don't reset pivot config - it's saved in the report
              // Just clear the generated pivot table data
              setPivotTableData(null);
                  }}
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
              flexDirection: 'column',
              position: 'relative'
            }}>
              {/* Pivot Fields Panel */}
              {showPivotFieldsPanel && (
                <PivotFieldsPanel
                  availableFields={getAvailablePivotFields}
                  pivotConfig={pivotConfig}
                  setPivotConfig={(newConfig) => {
                    setPivotConfig(newConfig);
                    // Auto-enable pivot mode if we have rows/columns and values
                    const shouldBePivotMode = newConfig.values.length > 0 && (newConfig.rows.length > 0 || newConfig.columns.length > 0);
                    setIsPivotMode(shouldBePivotMode);
                    
                    // Save pivot config to report
                    if (selectedReport) {
                      try {
                        const existingReports = JSON.parse(localStorage.getItem('customReports') || '[]');
                        const updatedReports = existingReports.map(r => {
                          if (r.id === selectedReport.id) {
                            return {
                              ...r,
                              pivotConfig: newConfig,
                              isPivotMode: shouldBePivotMode,
                              showPivotFieldsPanel: showPivotFieldsPanel
                            };
                          }
                          return r;
                        });
                        localStorage.setItem('customReports', JSON.stringify(updatedReports));
                        setSelectedReport(prev => prev ? { ...prev, pivotConfig: newConfig, isPivotMode: shouldBePivotMode } : null);
                      } catch (error) {
                        console.error('Error saving pivot config:', error);
                      }
                    }
                  }}
                  onFieldConfig={(field, area, index) => {
                    setFieldConfigModal({ field, area, index });
                  }}
                  getFieldLabel={getFieldLabel}
                  getFieldType={getFieldType}
                />
              )}

              {/* Field Configuration Modal */}
              {fieldConfigModal && (
                <FieldConfigurationModal
                  fieldConfig={fieldConfigModal}
                  pivotConfig={pivotConfig}
                  setPivotConfig={(newConfig) => {
                    setPivotConfig(newConfig);
                    // Save pivot config to report
                    if (selectedReport) {
                      try {
                        const existingReports = JSON.parse(localStorage.getItem('customReports') || '[]');
                        const updatedReports = existingReports.map(r => {
                          if (r.id === selectedReport.id) {
                            return {
                              ...r,
                              pivotConfig: newConfig,
                              isPivotMode: isPivotMode,
                              showPivotFieldsPanel: showPivotFieldsPanel
                            };
                          }
                          return r;
                        });
                        localStorage.setItem('customReports', JSON.stringify(updatedReports));
                        setSelectedReport(prev => prev ? { ...prev, pivotConfig: newConfig } : null);
                      } catch (error) {
                        console.error('Error saving pivot config:', error);
                      }
                    }
                  }}
                  onClose={() => setFieldConfigModal(null)}
                  getFieldValue={getFieldValue}
                  salesData={salesData}
                />
              )}

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
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  marginLeft: 'auto'
                }}>
                  <button
                    onClick={() => {
                      setShowPivotFieldsPanel(!showPivotFieldsPanel);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      padding: '10px 16px',
                      borderRadius: '10px',
                      background: showPivotFieldsPanel ? '#eff6ff' : '#f8fafc',
                      border: `2px solid ${showPivotFieldsPanel ? '#3b82f6' : '#e2e8f0'}`,
                      transition: 'all 0.2s ease',
                      fontSize: '14px',
                      fontWeight: '500',
                      color: showPivotFieldsPanel ? '#3b82f6' : '#475569',
                      whiteSpace: 'nowrap'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#f1f5f9';
                      e.currentTarget.style.borderColor = '#cbd5e1';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#f8fafc';
                      e.currentTarget.style.borderColor = '#e2e8f0';
                    }}
                  >
                    <span className="material-icons" style={{ fontSize: '18px' }}>view_module</span>
                    <span>Pivot Table Fields</span>
                  </button>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  padding: '10px 16px',
                  borderRadius: '10px',
                  background: hideDuplicates ? '#eff6ff' : '#f8fafc',
                  border: `2px solid ${hideDuplicates ? '#3b82f6' : '#e2e8f0'}`,
                  transition: 'all 0.2s ease',
                  userSelect: 'none',
                  fontSize: '14px',
                  fontWeight: '500',
                    color: hideDuplicates ? '#3b82f6' : '#475569'
                }}
                onMouseEnter={(e) => {
                  if (!hideDuplicates) {
                    e.currentTarget.style.background = '#f1f5f9';
                    e.currentTarget.style.borderColor = '#cbd5e1';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!hideDuplicates) {
                    e.currentTarget.style.background = '#f8fafc';
                    e.currentTarget.style.borderColor = '#e2e8f0';
                  }
                }}
                >
                  <input
                    type="checkbox"
                    checked={hideDuplicates}
                    onChange={(e) => {
                      setHideDuplicates(e.target.checked);
                      setReportPage(1);
                    }}
                    style={{
                      width: '18px',
                      height: '18px',
                      cursor: 'pointer',
                      accentColor: '#3b82f6'
                    }}
                  />
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span className="material-icons" style={{ fontSize: '18px' }}>filter_alt_off</span>
                    Hide Duplicates
                  </span>
                </label>
                </div>
              </div>

              {/* Pivot Fields Panel */}
              {showPivotFieldsPanel && (
                <PivotFieldsPanel
                  availableFields={getAvailablePivotFields}
                  pivotConfig={pivotConfig}
                  setPivotConfig={setPivotConfig}
                  onFieldConfig={(field, area, index) => {
                    setFieldConfigModal({ field, area, index });
                  }}
                  getFieldLabel={getFieldLabel}
                  getFieldType={getFieldType}
                />
              )}

              {/* Toggle between Normal and Pivot Mode */}
              {pivotConfig.values.length > 0 && (
                <div style={{
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 16px',
                  background: '#f8fafc',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0'
                }}>
                  <span style={{ fontSize: '14px', fontWeight: '500', color: '#475569' }}>
                    View Mode:
                  </span>
                  <button
                    onClick={() => {
                      setIsPivotMode(false);
                      // Save state to report
                      if (selectedReport) {
                        try {
                          const existingReports = JSON.parse(localStorage.getItem('customReports') || '[]');
                          const updatedReports = existingReports.map(r => {
                            if (r.id === selectedReport.id) {
                              return { ...r, isPivotMode: false };
                            }
                            return r;
                          });
                          localStorage.setItem('customReports', JSON.stringify(updatedReports));
                          setSelectedReport(prev => prev ? { ...prev, isPivotMode: false } : null);
                        } catch (error) {
                          console.error('Error saving pivot mode:', error);
                        }
                      }
                    }}
                    style={{
                      padding: '6px 14px',
                      border: 'none',
                      borderRadius: '6px',
                      background: !isPivotMode ? '#3b82f6' : '#e2e8f0',
                      color: !isPivotMode ? 'white' : '#64748b',
                      fontSize: '13px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    Table
                  </button>
                  <button
                    onClick={() => {
                      if (pivotConfig.rows.length > 0 || pivotConfig.columns.length > 0) {
                        setIsPivotMode(true);
                        // Save state to report
                        if (selectedReport) {
                          try {
                            const existingReports = JSON.parse(localStorage.getItem('customReports') || '[]');
                            const updatedReports = existingReports.map(r => {
                              if (r.id === selectedReport.id) {
                                return { ...r, isPivotMode: true };
                              }
                              return r;
                            });
                            localStorage.setItem('customReports', JSON.stringify(updatedReports));
                            setSelectedReport(prev => prev ? { ...prev, isPivotMode: true } : null);
                          } catch (error) {
                            console.error('Error saving pivot mode:', error);
                          }
                        }
                      } else {
                        alert('Please add at least one field to Rows or Columns to use Pivot Table view');
                      }
                    }}
                    style={{
                      padding: '6px 14px',
                      border: 'none',
                      borderRadius: '6px',
                      background: isPivotMode ? '#3b82f6' : '#e2e8f0',
                      color: isPivotMode ? 'white' : '#64748b',
                      fontSize: '13px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    Pivot Table
                  </button>
                </div>
              )}

              {/* Table or Pivot Table */}
              {isPivotMode && pivotTableData ? (
                <PivotTableRenderer
                  pivotData={pivotTableData}
                  pivotConfig={pivotConfig}
                  getFieldLabel={getFieldLabel}
                />
              ) : (
              <div style={{
                overflowX: 'auto',
                  border: '1px solid #d1d5db',
                  background: 'white'
              }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                    fontSize: '13px'
                }}>
                  <thead>
                      <tr style={{ background: '#f3f4f6' }}>
                      {reportData.columns.map((column) => (
                        <th
                          key={column.key}
                          style={{
                            padding: '6px 8px',
                            textAlign: 'left',
                            fontWeight: '600',
                            color: '#1e293b',
                            border: '1px solid #d1d5db',
                            whiteSpace: 'nowrap',
                            cursor: 'pointer',
                            userSelect: 'none',
                            position: 'sticky',
                            top: '0px',
                            background: '#f3f4f6',
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
                            e.currentTarget.style.background = '#e5e7eb';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = '#f3f4f6';
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>{column.label}</span>
                            {reportSortBy === column.key ? (
                              <span className="material-icons" style={{
                                fontSize: '16px',
                                color: '#3b82f6',
                                transform: reportSortOrder === 'desc' ? 'rotate(180deg)' : 'none'
                              }}>
                                arrow_upward
                              </span>
                            ) : (
                              <span className="material-icons" style={{
                                fontSize: '16px',
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
                            color: '#64748b',
                            border: '1px solid #d1d5db'
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
                            border: 'none',
                            background: rowIndex % 2 === 0 ? 'white' : '#f9fafb'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#f3f4f6';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = rowIndex % 2 === 0 ? 'white' : '#f9fafb';
                          }}
                        >
                          {reportData.columns.map((column) => (
                            <td
                              key={column.key}
                              style={{
                                padding: '6px 8px',
                                color: '#1e293b',
                                fontSize: '13px',
                                lineHeight: '1.4',
                                border: '1px solid #d1d5db'
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
              )}

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

      {/* Field Configuration Modal */}
      {fieldConfigModal && (
        <FieldConfigurationModal
          fieldConfig={fieldConfigModal}
          pivotConfig={pivotConfig}
          setPivotConfig={setPivotConfig}
          onClose={() => setFieldConfigModal(null)}
          getFieldValue={getFieldValue}
          salesData={salesData}
        />
      )}

      {/* Custom Report Modal */}
      {showCustomReportModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            zIndex: 16000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowCustomReportModal(false);
            }
          }}
        >
          <CustomReportModal
            salesData={salesData}
            onClose={() => {
              console.log('🔒 Custom Report Modal closed');
              setShowCustomReportModal(false);
              // Refresh reports list after closing modal
              loadReports();
            }}
          />
        </div>
      )}
    </div>
  );
};

// HierarchicalFieldList Component
const HierarchicalFieldList = ({ fields, selectedFields, onFieldToggle, searchTerm, selectionMode = 'multiple' }) => {
  const [expandedGroups, setExpandedGroups] = useState(() => {
    const groups = new Set();
    fields.forEach(f => {
      if (f.hierarchy) {
        groups.add(f.hierarchy);
      }
    });
    return groups;
  });
  
  const handleFieldClick = (fieldValue) => {
    if (selectionMode === 'single') {
      if (selectedFields.has(fieldValue)) {
        onFieldToggle('');
      } else {
        onFieldToggle(fieldValue);
      }
    } else {
      onFieldToggle(fieldValue);
    }
  };
  
  const groupedFields = useMemo(() => {
    const groups = {};
    fields.forEach(field => {
      const hierarchy = field.hierarchy || 'voucher';
      if (!groups[hierarchy]) {
        groups[hierarchy] = {
          name: HIERARCHY_MAP[hierarchy] || hierarchy,
          level: hierarchy,
          fields: []
        };
      }
      groups[hierarchy].fields.push(field);
    });
    return groups;
  }, [fields]);
  
  const toggleGroup = (hierarchy) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(hierarchy)) {
        next.delete(hierarchy);
      } else {
        next.add(hierarchy);
      }
      return next;
    });
  };
  
  const hierarchyOrder = ['voucher', 'ledgerentries', 'billallocations', 
                         'allinventoryentries', 'batchallocation', 'accountingallocation', 'address',
                         'customers', 'stockitems', 'udf'];
  const sortedGroups = Object.values(groupedFields).sort((a, b) => {
    const aOrder = hierarchyOrder.indexOf(a.level) >= 0 ? hierarchyOrder.indexOf(a.level) : 999;
    const bOrder = hierarchyOrder.indexOf(b.level) >= 0 ? hierarchyOrder.indexOf(b.level) : 999;
    return aOrder - bOrder;
  });
  
  if (fields.length === 0) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>
        No fields found
      </div>
    );
  }
  
  return (
    <div style={{
      background: '#ffffff',
      border: '1px solid #e2e8f0',
      borderRadius: '8px',
      padding: '12px',
      maxHeight: '400px',
      overflowY: 'auto'
    }}>
      {sortedGroups.map((group) => {
        const isExpanded = expandedGroups.has(group.level);
        const isUdf = group.level === 'udf';
        const isCustomers = group.level === 'customers';
        const isStockItems = group.level === 'stockitems';
        
        // Color scheme based on hierarchy type
        const getGroupColors = () => {
          if (isUdf) {
            return {
              background: '#fef3c7',
              backgroundHover: '#fde68a',
              border: '#fbbf24',
              text: '#92400e',
              icon: '#d97706',
              badge: { bg: '#fde68a', text: '#a16207' }
            };
          } else if (isCustomers) {
            return {
              background: '#dbeafe',
              backgroundHover: '#bfdbfe',
              border: '#3b82f6',
              text: '#1e40af',
              icon: '#2563eb',
              badge: { bg: '#bfdbfe', text: '#1e40af' }
            };
          } else if (isStockItems) {
            return {
              background: '#dcfce7',
              backgroundHover: '#bbf7d0',
              border: '#22c55e',
              text: '#166534',
              icon: '#16a34a',
              badge: { bg: '#bbf7d0', text: '#166534' }
            };
          } else {
            return {
              background: '#f8fafc',
              backgroundHover: '#f1f5f9',
              border: '#e2e8f0',
              text: '#1e293b',
              icon: '#64748b',
              badge: { bg: '#e2e8f0', text: '#64748b' }
            };
          }
        };
        
        const colors = getGroupColors();
        
        return (
          <div key={group.level} style={{ marginBottom: '8px' }}>
            <div
              onClick={() => toggleGroup(group.level)}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '10px 12px',
                background: colors.background,
                border: `1px solid ${colors.border}`,
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                marginBottom: isExpanded ? '8px' : '0'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = colors.backgroundHover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = colors.background;
              }}
            >
              <span className="material-icons" style={{
                fontSize: '18px',
                color: colors.icon,
                marginRight: '8px',
                transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s'
              }}>
                chevron_right
              </span>
              <span style={{
                fontSize: '14px',
                fontWeight: 600,
                color: colors.text,
                flex: 1
              }}>
                {group.name}
              </span>
              <span style={{
                fontSize: '12px',
                color: colors.badge.text,
                background: colors.badge.bg,
                padding: '2px 8px',
                borderRadius: '12px',
                fontWeight: 500
              }}>
                {group.fields.length}
              </span>
            </div>
            
            {isExpanded && (
              <div style={{ paddingLeft: '8px', marginTop: '4px' }}>
                {group.fields.map((field) => {
                  const isNested = field.value.includes('.');
                  const indentLevel = field.value.split('.').length - 1;
                  
                  return (
                    <div
                      key={field.value}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '8px 12px',
                        paddingLeft: `${12 + (indentLevel * 16)}px`,
                        borderRadius: '4px',
                        cursor: 'pointer',
                        transition: 'background 0.15s ease',
                        marginBottom: '2px',
                        background: selectionMode === 'single' && selectedFields.has(field.value) ? '#eff6ff' : 'transparent'
                      }}
                      onMouseEnter={(e) => {
                        if (!(selectionMode === 'single' && selectedFields.has(field.value))) {
                          e.currentTarget.style.background = '#f8fafc';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!(selectionMode === 'single' && selectedFields.has(field.value))) {
                          e.currentTarget.style.background = 'transparent';
                        }
                      }}
                      onClick={() => handleFieldClick(field.value)}
                    >
                      {isNested && (
                        <span className="material-icons" style={{
                          fontSize: '14px',
                          color: '#94a3b8',
                          marginRight: '6px'
                        }}>
                          subdirectory_arrow_right
                        </span>
                      )}
                      {selectionMode === 'single' ? (
                        <div style={{
                          width: '18px',
                          height: '18px',
                          border: selectedFields.has(field.value) ? 'none' : '2px solid #cbd5e1',
                          borderRadius: '50%',
                          background: selectedFields.has(field.value) ? '#3b82f6' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: '10px',
                          flexShrink: 0
                        }}>
                          {selectedFields.has(field.value) && (
                            <div style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              background: 'white'
                            }}></div>
                          )}
                        </div>
                      ) : (
                        <div style={{
                          width: '18px',
                          height: '18px',
                          border: selectedFields.has(field.value) ? 'none' : '2px solid #cbd5e1',
                          borderRadius: '4px',
                          background: selectedFields.has(field.value) ? '#10b981' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: '10px',
                          flexShrink: 0
                        }}>
                          {selectedFields.has(field.value) && (
                            <span className="material-icons" style={{ fontSize: '14px', color: 'white' }}>check</span>
                          )}
                        </div>
                      )}
                      <span style={{
                        fontSize: '14px',
                        fontWeight: selectedFields.has(field.value) ? '600' : '400',
                        color: selectionMode === 'single' && selectedFields.has(field.value) ? '#1e40af' : '#1e293b',
                        flex: 1
                      }}>
                        {field.label}
                      </span>
                      {field.isUdf && (
                        <span style={{
                          fontSize: '10px',
                          color: '#d97706',
                          background: '#fef3c7',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          marginLeft: '8px',
                          fontWeight: 600
                        }}>
                          UDF
                        </span>
                      )}
                      {field.type === 'value' && (
                        <span style={{
                          fontSize: '10px',
                          color: '#3b82f6',
                          background: '#dbeafe',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          marginLeft: '8px',
                          fontWeight: 500
                        }}>
                          {field.aggregation || 'sum'}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// Custom Report Modal Component
const CustomReportModal = ({ salesData, onClose }) => {
  const [reportTitle, setReportTitle] = useState('');
  const [selectedFields, setSelectedFields] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState([]);
  const [currentFilterField, setCurrentFilterField] = useState('');
  const [currentFilterValues, setCurrentFilterValues] = useState(new Set());
  const [filterValuesSearchTerm, setFilterValuesSearchTerm] = useState('');
  const [filterFieldSearchTerm, setFilterFieldSearchTerm] = useState('');
  const [rawVoucherData, setRawVoucherData] = useState([]);
  const [udfFields, setUdfFields] = useState([]);
  const [customerData, setCustomerData] = useState([]);
  const [stockItemData, setStockItemData] = useState([]);
  const [relationships, setRelationships] = useState([]);
  const [showRelationships, setShowRelationships] = useState(false);

  // Cleanup relationships on unmount
  useEffect(() => {
    return () => {
      window.__reportRelationships = undefined;
    };
  }, []);

  // Detect which tables are involved based on selected fields
  const involvedTables = useMemo(() => {
    const tables = new Set(['vouchers']); // Vouchers is always the base table
    const nestedArrayToTable = {
      'ledgerentries': 'customers',        // ledgerentries → ledger (customers)
      'accountingallocation': 'customers', // accountingallocation → ledger (customers)
      'allinventoryentries': 'stockitems', // allinventoryentries → stockitem
      'inventoryentries': 'stockitems'     // inventoryentries → stockitem
    };
    
    selectedFields.forEach(field => {
      if (field.startsWith('customers.')) {
        tables.add('customers');
      } else if (field.startsWith('stockitems.')) {
        tables.add('stockitems');
      } else if (field.includes('.')) {
        // Check for nested array fields that need relationships
        const fieldParts = field.split('.');
        const arrayName = fieldParts[0].toLowerCase();
        if (nestedArrayToTable[arrayName]) {
          tables.add(nestedArrayToTable[arrayName]);
        }
      }
    });
    return Array.from(tables);
  }, [selectedFields]);

  // Detect which nested arrays are involved (for relationship configuration)
  const involvedNestedArrays = useMemo(() => {
    const arrays = new Set();
    selectedFields.forEach(field => {
      if (field.includes('.')) {
        const fieldParts = field.split('.');
        const arrayName = fieldParts[0].toLowerCase();
        // Check if this is a nested array (not customers/stockitems which are separate tables)
        if (!field.startsWith('customers.') && !field.startsWith('stockitems.')) {
          const knownArrays = ['ledgerentries', 'accountingallocation', 'allinventoryentries', 'inventoryentries'];
          if (knownArrays.includes(arrayName)) {
            arrays.add(arrayName);
          }
        }
      }
    });
    return Array.from(arrays);
  }, [selectedFields]);


  // Helper function to intelligently find matching fields between two tables
  const findMatchingFields = useCallback((fromFields, toFields) => {
    if (!fromFields || !toFields || fromFields.length === 0 || toFields.length === 0) {
      return { fromField: null, toField: null };
    }

    // Convert field arrays to lowercase for comparison
    const fromFieldsLower = fromFields.map(f => ({
      original: f.value || f,
      lower: (f.value || f).toLowerCase()
    }));
    const toFieldsLower = toFields.map(f => ({
      original: f.value || f,
      lower: (f.value || f).toLowerCase()
    }));

    // Step 1: Look for ID fields (masterid, master_id, id, guid) - highest priority
    const idPatterns = ['masterid', 'master_id', 'guid', 'id'];
    for (const pattern of idPatterns) {
      const fromMatch = fromFieldsLower.find(f => f.lower.includes(pattern));
      const toMatch = toFieldsLower.find(f => f.lower.includes(pattern));
      
      if (fromMatch && toMatch) {
        return {
          fromField: fromMatch.original,
          toField: toMatch.original
        };
      }
    }

    // Step 2: Look for exact name matches (case-insensitive)
    for (const fromField of fromFieldsLower) {
      const toMatch = toFieldsLower.find(f => f.lower === fromField.lower);
      if (toMatch) {
        return {
          fromField: fromField.original,
          toField: toMatch.original
        };
      }
    }

    // Step 3: Look for partial matches (e.g., "partyledgernameid" matches "PARTYLEDGERNAMEID")
    for (const fromField of fromFieldsLower) {
      const normalizedFrom = fromField.lower.replace(/[_\s]/g, '');
      const toMatch = toFieldsLower.find(f => {
        const normalizedTo = f.lower.replace(/[_\s]/g, '');
        return normalizedFrom === normalizedTo;
      });
      if (toMatch) {
        return {
          fromField: fromField.original,
          toField: toMatch.original
        };
      }
    }

    // Step 4: If no match found, return first available fields
    return {
      fromField: fromFieldsLower[0]?.original || null,
      toField: toFieldsLower[0]?.original || null
    };
  }, []);

  // Load raw voucher data, customers, stock items, and UDF fields
  useEffect(() => {
    const loadData = async () => {
      try {
        const companies = JSON.parse(sessionStorage.getItem('allConnections') || '[]');
        const selectedCompanyGuid = sessionStorage.getItem('selectedCompanyGuid') || '';
        const selectedCompanyTallylocId = sessionStorage.getItem('selectedCompanyTallylocId') || '';
        
        const currentCompanyObj = companies.find(c =>
          c.guid === selectedCompanyGuid &&
          (selectedCompanyTallylocId ? String(c.tallyloc_id) === String(selectedCompanyTallylocId) : true)
        );
        
        if (!currentCompanyObj || !currentCompanyObj.tallyloc_id || !currentCompanyObj.guid) {
          setRawVoucherData([]);
          setUdfFields([]);
          setCustomerData([]);
          setStockItemData([]);
          return;
        }
        
        // Load raw voucher data
        const completeCache = await hybridCache.getCompleteSalesData(currentCompanyObj);
        if (completeCache && completeCache.data && completeCache.data.vouchers) {
          const allVouchers = completeCache.data.vouchers;
          setRawVoucherData(allVouchers);
          const voucherLookupMap = new Map();
          allVouchers.forEach(voucher => {
            const masterid = voucher.masterid || voucher.mstid;
            if (masterid) {
              voucherLookupMap.set(String(masterid), voucher);
            }
          });
          window.__voucherLookupMap = voucherLookupMap;
        } else {
          setRawVoucherData([]);
          window.__voucherLookupMap = new Map();
        }

        // Load customer/ledger data
        try {
          const customers = await hybridCache.getCustomerData(currentCompanyObj);
          if (customers && Array.isArray(customers)) {
            setCustomerData(customers);
            // Create customer lookup map by NAME or GUID
            const customerLookupMap = new Map();
            customers.forEach(customer => {
              const name = customer.NAME || customer.name;
              const guid = customer.GUID || customer.guid;
              if (name) {
                customerLookupMap.set(String(name).toLowerCase(), customer);
              }
              if (guid) {
                customerLookupMap.set(String(guid), customer);
              }
              // Also index by partyledgernameid if available
              const id = customer.MASTERID || customer.masterid || customer.PARTYLEDGERNAMEID || customer.partyledgernameid;
              if (id) {
                customerLookupMap.set(String(id), customer);
              }
            });
            window.__customerLookupMap = customerLookupMap;
            console.log(`✅ Loaded ${customers.length} customers into lookup map`);
          } else {
            setCustomerData([]);
            window.__customerLookupMap = new Map();
          }
        } catch (customerError) {
          console.error('Error loading customer data:', customerError);
          setCustomerData([]);
          window.__customerLookupMap = new Map();
        }

        // Load stock items data
        try {
          const { tallyloc_id, company } = currentCompanyObj;
          const stockItemsCacheKey = `stockitems_${tallyloc_id}_${company}`;
          const stockItemsCache = await hybridCache.getSalesData(stockItemsCacheKey);
          if (stockItemsCache && stockItemsCache.stockItems && Array.isArray(stockItemsCache.stockItems)) {
            const stockItems = stockItemsCache.stockItems;
            setStockItemData(stockItems);
            // Create stock item lookup map
            const stockItemLookupMap = new Map();
            stockItems.forEach(item => {
              const name = item.NAME || item.name;
              const guid = item.GUID || item.guid;
              if (name) {
                stockItemLookupMap.set(String(name).toLowerCase(), item);
              }
              if (guid) {
                stockItemLookupMap.set(String(guid), item);
              }
              // Also index by stockitemnameid if available
              const id = item.MASTERID || item.masterid || item.STOCKITEMNAMEID || item.stockitemnameid;
              if (id) {
                stockItemLookupMap.set(String(id), item);
              }
            });
            window.__stockItemLookupMap = stockItemLookupMap;
            console.log(`✅ Loaded ${stockItems.length} stock items into lookup map`);
          } else {
            setStockItemData([]);
            window.__stockItemLookupMap = new Map();
          }
        } catch (stockItemError) {
          console.error('Error loading stock items data:', stockItemError);
          setStockItemData([]);
          window.__stockItemLookupMap = new Map();
        }

        // Load UDF fields
        try {
          const udfConfig = await loadUdfConfig(currentCompanyObj.tallyloc_id, currentCompanyObj.guid);
          if (udfConfig && udfConfig.fields) {
            const availableUdfFields = getAvailableUdfFields(udfConfig);
            setUdfFields(availableUdfFields.map(field => ({
              ...field,
              hierarchy: 'udf',
              isUdf: true
            })));
          }
        } catch (udfError) {
          console.error('Error loading UDF config:', udfError);
          setUdfFields([]);
        }
      } catch (error) {
        console.error('Error loading data:', error);
        setRawVoucherData([]);
        setUdfFields([]);
        setCustomerData([]);
        setStockItemData([]);
      }
    };
    
    loadData();
  }, [salesData]);

  // Extract all available fields from all cache tables
  const allFields = useMemo(() => {
    const fieldsMap = new Map();
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
      'cp_date': 'Date',
      'amount': 'Amount',
      'quantity': 'Quantity',
      'profit': 'Profit',
      'vouchernumber': 'Voucher Number',
      'vchno': 'Voucher Number',
    };

    const getFieldLabel = (fieldName, prefix = '') => {
      const lowerKey = fieldName.toLowerCase();
      const baseLabel = fieldLabelMap[lowerKey] || fieldName.charAt(0).toUpperCase() + fieldName.slice(1).replace(/([A-Z])/g, ' $1').trim();
      return prefix ? `${prefix} → ${baseLabel}` : baseLabel;
    };

    const determineFieldType = (value) => {
      if (value === null || value === undefined || value === '') {
        return 'category';
      }
      if (typeof value === 'number') {
        return 'value';
      }
      if (typeof value === 'string') {
        const numValue = parseFloat(value);
        if (!isNaN(numValue) && isFinite(numValue)) {
          return 'value';
        }
      }
      return 'category';
    };

    // Extract fields from vouchers/sales data
    // Use rawVoucherData (nested structure) if available, otherwise use salesData (flattened)
    const dataForExtraction = rawVoucherData.length > 0 ? rawVoucherData : salesData;
    if (dataForExtraction && Array.isArray(dataForExtraction) && dataForExtraction.length > 0) {
      // Extract hierarchical fields from nested structure (rawVoucherData)
      // This processes all nested arrays: allinventoryentries, ledgerentries, billallocations, etc.
      const extracted = extractAllFieldsFromCache(dataForExtraction);
      const cacheFields = extracted.fields || [];
      
      // Get ALL unique keys from ALL records to ensure we capture every field
      // Use rawVoucherData (full period data) if available, otherwise fall back to salesData (current period)
      const allKeysSet = new Set();
      
      // First, extract keys from rawVoucherData (all periods) if available
      if (rawVoucherData && rawVoucherData.length > 0) {
        rawVoucherData.forEach(voucher => {
          Object.keys(voucher).forEach(key => allKeysSet.add(key));
        });
      }
      
      // Also extract keys from salesData (current period) to ensure we have all fields
      // This acts as a fallback and also ensures we capture any fields that might be in the flattened format
      if (salesData && Array.isArray(salesData)) {
        salesData.forEach(sale => {
          Object.keys(sale).forEach(key => allKeysSet.add(key));
        });
      }
      
      const allKeys = Array.from(allKeysSet);
      
      // Determine field types by checking all records
      // Use rawVoucherData (full period) if available, otherwise use salesData
      const fieldTypes = {};
      const dataForTypeCheck = rawVoucherData.length > 0 ? rawVoucherData : salesData;
      
      dataForTypeCheck.forEach(record => {
        allKeys.forEach(key => {
          if (!fieldTypes[key]) {
            const value = record[key];
            if (value !== null && value !== undefined && value !== '') {
              if (typeof value === 'string') {
                // Check if it's a numeric string
                const numValue = parseFloat(value);
                if (isNaN(numValue) || !isFinite(numValue)) {
                  fieldTypes[key] = 'string'; // Non-numeric string
                } else {
                  fieldTypes[key] = 'numeric'; // Numeric string
                }
              } else if (typeof value === 'number') {
                fieldTypes[key] = 'numeric';
              } else {
                fieldTypes[key] = 'other';
              }
            }
          }
        });
      });
      
      // Define fields that should ALWAYS be categories (even if they contain numbers)
      const forceCategoryFields = [
        // Date fields - ALWAYS categories, never values
        'date', 'cp_date', 'cpdate', 'cp date', 'transaction_date', 'transactiondate',
        'voucher_date', 'voucherdate', 'bill_date', 'billdate', 'invoice_date', 'invoicedate',
        // Location fields
        'pincode', 'pin_code', 'pin', 'zipcode', 'zip',
        // Voucher/ID fields
        'vouchernumber', 'vchno', 'voucher_number', 'voucher_no',
        'masterid', 'master_id', 'alterid', 'alter_id',
        'partyledgernameid', 'partyid', 'party_id', 'stockitemnameid', 'itemid', 'item_id',
        'partygstin', 'gstin', 'gst_no', 'pan', 'pan_no',
        // Contact fields
        'phone', 'mobile', 'telephone', 'contact',
        // Reference fields
        'reference', 'ref_no', 'invoice_no', 'bill_no',
        // Address fields
        'address', 'basicbuyeraddress', 'buyer_address',
        // Other category fields
        'reservedname', 'vchtype', 'vouchertypename', 'voucher_type',
        'issales', 'is_sales'
      ];
      
      // Process each field from the sales data (top-level fields only)
      // This matches SalesDashboard's approach - process top-level first, then hierarchical
      allKeys.forEach(key => {
        const lowerKey = key.toLowerCase();
        
        // Skip if we've already added this field as a hierarchical field
        if (fieldsMap.has(lowerKey)) {
          const existing = fieldsMap.get(lowerKey);
          // If existing field is hierarchical (not voucher level), skip adding top-level version
          if (existing.hierarchy && existing.hierarchy !== 'voucher') {
            return; // Skip - hierarchical field already exists
          }
        }
        
        // Check if this is a date field variation - if so, skip it (we'll handle dates separately)
        const dateFieldVariations = ['cp_date', 'cpdate', 'date', 'transaction_date', 'transactiondate', 
                                      'voucher_date', 'voucherdate', 'bill_date', 'billdate'];
        const isDateField = dateFieldVariations.some(dv => lowerKey === dv) || 
                            (lowerKey === 'date' || lowerKey === 'cp_date' || 
                             (lowerKey.endsWith('_date') && !lowerKey.includes('updated') && 
                              !lowerKey.includes('created') && !lowerKey.includes('modified')));
        if (isDateField && fieldsMap.has('date')) {
          return; // Skip - we already have the consolidated "date" field
        }
        
        // Check if field should be forced to category
        const shouldBeCategory = forceCategoryFields.some(cat => 
          lowerKey === cat || lowerKey.includes(cat) || cat.includes(lowerKey)
        );
        
        // Determine if field is numeric based on type analysis (but respect forced categories)
        const isNumeric = !shouldBeCategory && fieldTypes[key] === 'numeric';
        
        // Determine default aggregation for numeric fields
        let defaultAggregation = 'sum';
        if (isNumeric) {
          // Rate, price, margin fields should default to average
          if (lowerKey.includes('rate') || lowerKey.includes('price') || 
              lowerKey.includes('margin') || lowerKey.includes('percent')) {
            defaultAggregation = 'average';
          }
        }
        
        // Use getHierarchyLevel to determine proper hierarchy for top-level fields
        // This correctly identifies flattened inventory fields, ledger fields, etc.
        const fieldHierarchy = getHierarchyLevel(key);
        
        // Create field entry - include ALL fields regardless of type
        // Mark with proper hierarchy (not just 'voucher')
        const field = {
          value: key,
          label: getFieldLabel(key),
          type: isNumeric ? 'value' : 'category',
          hierarchy: fieldHierarchy, // Use proper hierarchy detection
          ...(isNumeric && { aggregation: defaultAggregation }) // Add default aggregation for numeric fields
        };
        
        fieldsMap.set(lowerKey, field);
      });
      
      // Add cache fields from hierarchical extractor (from nested structure)
      // This ensures hierarchical fields take precedence and are not overwritten
      // These fields come from nested arrays like allinventoryentries.stockitemname
      // This matches SalesDashboard's approach - hierarchical fields override top-level
      cacheFields.forEach(field => {
        const key = field.value.toLowerCase();
        // Always add hierarchical fields - they take precedence over top-level fields
        // Hierarchical fields have hierarchy property set, top-level don't
        if (field.hierarchy && field.hierarchy !== 'voucher') {
          // This is a nested field - always add it (overwrites top-level if exists)
          fieldsMap.set(key, field);
        } else if (!fieldsMap.has(key)) {
          // Top-level field from cache extractor - only add if not already present
          fieldsMap.set(key, field);
        } else {
          // Check if existing field is hierarchical - if not, replace with hierarchical version
          const existing = fieldsMap.get(key);
          if (!existing.hierarchy || existing.hierarchy === 'voucher') {
            // Existing is top-level, replace with hierarchical if available
            if (field.hierarchy) {
              fieldsMap.set(key, field);
            }
          }
        }
      });
    }

    // Extract fields from customer/ledger data
    if (customerData && Array.isArray(customerData) && customerData.length > 0) {
      const sampleCustomer = customerData[0];
      if (sampleCustomer) {
        Object.keys(sampleCustomer).forEach(key => {
          const lowerKey = `customers.${key}`.toLowerCase();
          if (!key.startsWith('_') && !fieldsMap.has(lowerKey)) {
            const value = sampleCustomer[key];
            const fieldType = determineFieldType(value);
            fieldsMap.set(lowerKey, {
              value: `customers.${key}`,
              label: getFieldLabel(key, 'Customers'),
              type: fieldType,
              hierarchy: 'customers'
            });
          }
        });

        // Also extract nested fields from customer addresses
        if (sampleCustomer.ADDRESS && Array.isArray(sampleCustomer.ADDRESS) && sampleCustomer.ADDRESS.length > 0) {
          const sampleAddress = sampleCustomer.ADDRESS[0];
          Object.keys(sampleAddress).forEach(key => {
            const lowerKey = `customers.address.${key}`.toLowerCase();
            if (!key.startsWith('_') && !fieldsMap.has(lowerKey)) {
              const value = sampleAddress[key];
              const fieldType = determineFieldType(value);
              fieldsMap.set(lowerKey, {
                value: `customers.address.${key}`,
                label: getFieldLabel(key, 'Customers → Address'),
                type: fieldType,
                hierarchy: 'customers'
              });
            }
          });
        }

        // Extract contact fields
        if (sampleCustomer.CONTACT && Array.isArray(sampleCustomer.CONTACT) && sampleCustomer.CONTACT.length > 0) {
          const sampleContact = sampleCustomer.CONTACT[0];
          Object.keys(sampleContact).forEach(key => {
            const lowerKey = `customers.contact.${key}`.toLowerCase();
            if (!key.startsWith('_') && !fieldsMap.has(lowerKey)) {
              const value = sampleContact[key];
              const fieldType = determineFieldType(value);
              fieldsMap.set(lowerKey, {
                value: `customers.contact.${key}`,
                label: getFieldLabel(key, 'Customers → Contact'),
                type: fieldType,
                hierarchy: 'customers'
              });
            }
          });
        }
      }
    }

    // Extract fields from stock items data
    if (stockItemData && Array.isArray(stockItemData) && stockItemData.length > 0) {
      const sampleItem = stockItemData[0];
      if (sampleItem) {
        Object.keys(sampleItem).forEach(key => {
          const lowerKey = `stockitems.${key}`.toLowerCase();
          if (!key.startsWith('_') && !fieldsMap.has(lowerKey)) {
            const value = sampleItem[key];
            const fieldType = determineFieldType(value);
            fieldsMap.set(lowerKey, {
              value: `stockitems.${key}`,
              label: getFieldLabel(key, 'Stock Items'),
              type: fieldType,
              hierarchy: 'stockitems'
            });
          }
        });
      }
    }

    // Add UDF fields
    udfFields.forEach(field => {
      const lowerKey = field.value.toLowerCase();
      if (!fieldsMap.has(lowerKey)) {
        fieldsMap.set(lowerKey, field);
      }
    });

    return Array.from(fieldsMap.values()).sort((a, b) => {
      // Sort by hierarchy first, then by label
      const hierarchyOrder = ['voucher', 'customers', 'stockitems', 'udf'];
      const aOrder = hierarchyOrder.indexOf(a.hierarchy) >= 0 ? hierarchyOrder.indexOf(a.hierarchy) : 999;
      const bOrder = hierarchyOrder.indexOf(b.hierarchy) >= 0 ? hierarchyOrder.indexOf(b.hierarchy) : 999;
      if (aOrder !== bOrder) {
        return aOrder - bOrder;
      }
      return a.label.localeCompare(b.label);
    });
  }, [rawVoucherData, salesData, udfFields, customerData, stockItemData]);

  // Extract available fields for relationship configuration
  // NOTE: This must be defined AFTER allFields
  const relationshipFields = useMemo(() => {
    const fields = {
      vouchers: [],
      customers: [],
      stockitems: []
    };

    // Get voucher fields from allFields (including nested array fields flattened at voucher level)
    if (allFields && Array.isArray(allFields)) {
      const voucherFields = allFields
        .filter(f => {
          // Include:
          // 1. Top-level voucher fields (not nested arrays or other tables)
          // 2. Fields from nested arrays like ledgerentries, accountingallocation, allinventoryentries
          //    that have been flattened to voucher level (like ledgernameid, stockitemnameid)
          return (
            (!f.value.includes('.') && !f.value.startsWith('customers.') && !f.value.startsWith('stockitems.') && f.hierarchy === 'voucher') ||
            // Include flattened fields from nested arrays that are commonly used for relationships
            (['ledgernameid', 'stockitemnameid', 'partyledgernameid', 'partyid', 'itemid'].includes(f.value.toLowerCase()))
          );
        })
        .map(f => ({
          value: f.value,
          label: f.label || f.value
        }));
      
      // Add common nested array fields that might be flattened
      const commonNestedFields = ['ledgernameid', 'stockitemnameid', 'partyledgernameid', 'partyid', 'itemid'];
      commonNestedFields.forEach(fieldName => {
        if (!voucherFields.find(f => f.value.toLowerCase() === fieldName.toLowerCase())) {
          voucherFields.push({
            value: fieldName,
            label: fieldName
          });
        }
      });
      
      fields.vouchers = voucherFields.sort((a, b) => a.label.localeCompare(b.label));
    }

    // Get customer fields - extract all keys from customer data including nested
    if (customerData && Array.isArray(customerData) && customerData.length > 0) {
      const customerKeysSet = new Set();
      customerData.forEach(customer => {
        // Top-level keys
        Object.keys(customer).forEach(key => {
          if (!key.startsWith('_') && key !== 'ADDRESS' && key !== 'CONTACT') {
            customerKeysSet.add(key);
          }
        });
        // Nested ADDRESS fields
        if (customer.ADDRESS && Array.isArray(customer.ADDRESS)) {
          customer.ADDRESS.forEach(addr => {
            Object.keys(addr).forEach(key => {
              if (!key.startsWith('_')) {
                customerKeysSet.add(`ADDRESS.${key}`);
              }
            });
          });
        }
        // Nested CONTACT fields
        if (customer.CONTACT && Array.isArray(customer.CONTACT)) {
          customer.CONTACT.forEach(contact => {
            Object.keys(contact).forEach(key => {
              if (!key.startsWith('_')) {
                customerKeysSet.add(`CONTACT.${key}`);
              }
            });
          });
        }
      });
      fields.customers = Array.from(customerKeysSet)
        .map(key => ({
          value: key,
          label: key
        }))
        .sort((a, b) => a.label.localeCompare(b.label));
    }

    // Get stock item fields - extract all keys from stock item data
    if (stockItemData && Array.isArray(stockItemData) && stockItemData.length > 0) {
      const stockItemKeysSet = new Set();
      stockItemData.forEach(item => {
        Object.keys(item).forEach(key => {
          if (!key.startsWith('_')) {
            stockItemKeysSet.add(key);
          }
        });
      });
      fields.stockitems = Array.from(stockItemKeysSet)
        .map(key => ({
          value: key,
          label: key
        }))
        .sort((a, b) => a.label.localeCompare(b.label));
    }

    return fields;
  }, [allFields, customerData, stockItemData]);

  // Auto-show relationships section if multiple tables are involved
  useEffect(() => {
    if (involvedTables.length > 1 && relationshipFields) {
      setShowRelationships(true);
      // Auto-configure default relationships if not set and fields are available
      if (relationships.length === 0 && relationshipFields.vouchers.length > 0) {
        const defaultRelationships = [];
        
        // Hardcoded default relationships based on Tally data structure
        if (involvedTables.includes('customers') && relationshipFields.customers.length > 0) {
          // Determine which field to use based on involved nested arrays
          let fromField = 'partyledgernameid'; // Default: vouchers → ledger
          
          // Check if fields from nested arrays are selected
          if (involvedNestedArrays.includes('ledgerentries') || involvedNestedArrays.includes('accountingallocation')) {
            // ledgerentries → ledger: ledgernameid → masterid
            // accountingallocation → ledger: ledgernameid → masterid
            fromField = 'ledgernameid';
          }
          
          defaultRelationships.push({
            fromTable: 'vouchers',
            fromField: fromField,
            toTable: 'customers',
            toField: 'MASTERID', // Always use MASTERID for ledger/customers table
            joinType: 'left'
          });
        }
        
        if (involvedTables.includes('stockitems') && relationshipFields.stockitems.length > 0) {
          // allinventoryentries → stockitem: stockitemnameid → masterid
          // Since we're joining from vouchers (which contains allinventoryentries), 
          // we use stockitemnameid from vouchers level
          defaultRelationships.push({
            fromTable: 'vouchers',
            fromField: 'stockitemnameid',
            toTable: 'stockitems',
            toField: 'MASTERID', // Always use MASTERID for stockitem table
            joinType: 'left'
          });
        }
        
        if (defaultRelationships.length > 0) {
          setRelationships(defaultRelationships);
        }
      }
    }
  }, [involvedTables, relationships.length, relationshipFields]);

  const filteredFields = useMemo(() => {
    if (!searchTerm.trim()) return allFields;
    const searchLower = searchTerm.toLowerCase();
    return allFields.filter(field => 
      field.label.toLowerCase().includes(searchLower) ||
      field.value.toLowerCase().includes(searchLower)
    );
  }, [allFields, searchTerm]);

  const getFieldValueForFilter = useCallback((item, fieldName) => {
    if (!item || !fieldName) return null;
    
    // Handle fields from customer table
    if (fieldName.startsWith('customers.')) {
      const customerLookupMap = window.__customerLookupMap || new Map();
      if (customerLookupMap.size === 0) return null;
      
      // Use configured relationship if available
      const relationship = (window.__reportRelationships || []).find(r => r.toTable === 'customers');
      const fromField = relationship?.fromField || 'partyledgernameid';
      const toField = relationship?.toField || 'MASTERID'; // vouchers/ledgerentries/accountingallocation → ledger: *id → masterid
      
      // Get identifier using configured field
      let customerIdentifier = item[fromField];
      if (!customerIdentifier) {
        // Fallback to common fields
        if (fromField.includes('name')) {
          customerIdentifier = item.partyledgername || item.customer || item.partyname || item.party;
        } else if (fromField.includes('id')) {
          // Priority order based on mapping:
          // 1) vouchers.partyledgernameid
          // 2) ledgerentries.ledgernameid (flattened as ledgernameid)
          // 3) accountingallocation.ledgernameid (flattened as ledgernameid)
          customerIdentifier = item.partyledgernameid || item.partyid || item.ledgernameid;
        }
      }
      
      if (!customerIdentifier) return null;
      
      // Lookup customer
      let customer = customerLookupMap.get(String(customerIdentifier).toLowerCase()) || 
                     customerLookupMap.get(String(customerIdentifier));
      
      // Try matching by configured toField
      if (!customer) {
        for (const [key, value] of customerLookupMap.entries()) {
          const toFieldValue = value?.[toField] || value?.[toField.toLowerCase()] || value?.[toField.toUpperCase()];
          if (toFieldValue && String(toFieldValue) === String(customerIdentifier)) {
            customer = value;
            break;
          }
        }
      }
      
      if (!customer) return null;
      
      const fieldPath = fieldName.substring('customers.'.length);
      if (fieldPath.includes('.')) {
        return getNestedFieldValue(customer, fieldPath);
      } else {
        return customer[fieldPath] || customer[fieldPath.toUpperCase()] || customer[fieldPath.toLowerCase()] || null;
      }
    }
    
    // Handle fields from stock items table
    if (fieldName.startsWith('stockitems.')) {
      const stockItemLookupMap = window.__stockItemLookupMap || new Map();
      if (stockItemLookupMap.size === 0) return null;
      
      // Use configured relationship if available
      const relationship = (window.__reportRelationships || []).find(r => r.toTable === 'stockitems');
      const fromField = relationship?.fromField || 'stockitemnameid';
      const toField = relationship?.toField || 'MASTERID'; // allinventoryentries → stockitem: stockitemnameid → masterid
      
      // Get identifier using configured field
      let itemIdentifier = item[fromField];
      if (!itemIdentifier) {
        // Fallback to common fields
        if (fromField.includes('name')) {
          itemIdentifier = item.stockitemname || item.item;
        } else if (fromField.includes('id')) {
          itemIdentifier = item.stockitemnameid || item.itemid;
        }
      }
      
      if (!itemIdentifier) return null;
      
      // Lookup stock item
      let stockItem = stockItemLookupMap.get(String(itemIdentifier).toLowerCase()) || 
                      stockItemLookupMap.get(String(itemIdentifier));
      
      // Try matching by configured toField
      if (!stockItem) {
        for (const [key, value] of stockItemLookupMap.entries()) {
          const toFieldValue = value?.[toField] || value?.[toField.toLowerCase()] || value?.[toField.toUpperCase()];
          if (toFieldValue && String(toFieldValue) === String(itemIdentifier)) {
            stockItem = value;
            break;
          }
        }
      }
      
      if (!stockItem) return null;
      
      const fieldPath = fieldName.substring('stockitems.'.length);
      return stockItem[fieldPath] || stockItem[fieldPath.toUpperCase()] || stockItem[fieldPath.toLowerCase()] || null;
    }
    
    if (fieldName.includes('.')) {
      const masterid = item.masterid || item.mstid;
      if (masterid && window.__voucherLookupMap) {
        const voucher = window.__voucherLookupMap.get(String(masterid));
        if (voucher) {
          const value = getNestedFieldValue(voucher, fieldName);
          if (value !== null && value !== undefined) {
            return value;
          }
        }
      }
      return getNestedFieldValue(item, fieldName);
    }
    
    if (item[fieldName] !== undefined) return item[fieldName];
    const matchingKey = Object.keys(item).find(k => k.toLowerCase() === fieldName.toLowerCase());
    if (matchingKey) {
      return item[matchingKey];
    }
    
    return null;
  }, []);

  const currentFilterFieldValues = useMemo(() => {
    if (!currentFilterField) {
      return [];
    }
    
    const valuesSet = new Set();
    
    // Handle fields from customer table - get values directly from customerData
    if (currentFilterField.startsWith('customers.')) {
      if (customerData && Array.isArray(customerData) && customerData.length > 0) {
        const fieldPath = currentFilterField.substring('customers.'.length);
        customerData.forEach(customer => {
          let value = null;
          if (fieldPath.includes('.')) {
            // Nested field like customers.address.street
            value = getNestedFieldValue(customer, fieldPath);
          } else {
            // Direct field like customers.NAME
            value = customer[fieldPath] || customer[fieldPath.toUpperCase()] || customer[fieldPath.toLowerCase()];
          }
          if (value !== null && value !== undefined && value !== '') {
            const stringValue = String(value).trim();
            if (stringValue) {
              valuesSet.add(stringValue);
            }
          }
        });
      }
      
      // Also get values from vouchers (for values that exist in vouchers)
      if (salesData && Array.isArray(salesData) && salesData.length > 0) {
        salesData.forEach(sale => {
          const fieldValue = getFieldValueForFilter(sale, currentFilterField);
          if (fieldValue !== null && fieldValue !== undefined && fieldValue !== '') {
            const stringValue = String(fieldValue).trim();
            if (stringValue) {
              valuesSet.add(stringValue);
            }
          }
        });
      }
      
      return Array.from(valuesSet).sort((a, b) => {
        const numA = parseFloat(a);
        const numB = parseFloat(b);
        if (!isNaN(numA) && !isNaN(numB)) {
          return numA - numB;
        }
        return a.localeCompare(b);
      });
    }
    
    // Handle fields from stock items table - get values directly from stockItemData
    if (currentFilterField.startsWith('stockitems.')) {
      if (stockItemData && Array.isArray(stockItemData) && stockItemData.length > 0) {
        const fieldPath = currentFilterField.substring('stockitems.'.length);
        stockItemData.forEach(item => {
          let value = null;
          if (fieldPath.includes('.')) {
            // Nested field
            value = getNestedFieldValue(item, fieldPath);
          } else {
            // Direct field
            value = item[fieldPath] || item[fieldPath.toUpperCase()] || item[fieldPath.toLowerCase()];
          }
          if (value !== null && value !== undefined && value !== '') {
            const stringValue = String(value).trim();
            if (stringValue) {
              valuesSet.add(stringValue);
            }
          }
        });
      }
      
      // Also get values from vouchers (for values that exist in vouchers)
      if (salesData && Array.isArray(salesData) && salesData.length > 0) {
        salesData.forEach(sale => {
          const fieldValue = getFieldValueForFilter(sale, currentFilterField);
          if (fieldValue !== null && fieldValue !== undefined && fieldValue !== '') {
            const stringValue = String(fieldValue).trim();
            if (stringValue) {
              valuesSet.add(stringValue);
            }
          }
        });
      }
      
      return Array.from(valuesSet).sort((a, b) => {
        const numA = parseFloat(a);
        const numB = parseFloat(b);
        if (!isNaN(numA) && !isNaN(numB)) {
          return numA - numB;
        }
        return a.localeCompare(b);
      });
    }
    
    // Handle voucher and nested array fields - use salesData as before
    if (!salesData || !Array.isArray(salesData) || salesData.length === 0) {
      return [];
    }
    
    const isNestedArrayField = currentFilterField.includes('.');
    
    salesData.forEach(sale => {
      if (isNestedArrayField) {
        const masterid = sale.masterid || sale.mstid;
        let sourceObject = sale;
        if (masterid && window.__voucherLookupMap) {
          const voucher = window.__voucherLookupMap.get(String(masterid));
          if (voucher) {
            sourceObject = voucher;
          }
        }
        const allValues = getNestedFieldValues(sourceObject, currentFilterField);
        allValues.forEach(val => {
          if (val !== null && val !== undefined && val !== '') {
            const stringValue = String(val).trim();
            if (stringValue) {
              valuesSet.add(stringValue);
            }
          }
        });
      } else {
        const fieldValue = getFieldValueForFilter(sale, currentFilterField);
        if (fieldValue !== null && fieldValue !== undefined && fieldValue !== '') {
          const stringValue = String(fieldValue).trim();
          if (stringValue) {
            valuesSet.add(stringValue);
          }
        }
      }
    });
    
    return Array.from(valuesSet).sort((a, b) => {
      const numA = parseFloat(a);
      const numB = parseFloat(b);
      if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB;
      }
      return a.localeCompare(b);
    });
  }, [currentFilterField, salesData, customerData, stockItemData, getFieldValueForFilter]);

  const filteredFilterFieldValues = useMemo(() => {
    if (!filterValuesSearchTerm.trim()) {
      return currentFilterFieldValues;
    }
    const searchLower = filterValuesSearchTerm.toLowerCase().trim();
    return currentFilterFieldValues.filter(value => 
      value.toLowerCase().includes(searchLower)
    );
  }, [currentFilterFieldValues, filterValuesSearchTerm]);

  const filteredAvailableFilterFields = useMemo(() => {
    if (!filterFieldSearchTerm.trim()) {
      return allFields;
    }
    const searchLower = filterFieldSearchTerm.toLowerCase().trim();
    return allFields.filter(field => 
      field.label.toLowerCase().includes(searchLower) ||
      field.value.toLowerCase().includes(searchLower)
    );
  }, [allFields, filterFieldSearchTerm]);

  const handleFieldToggle = (fieldValue) => {
    setSelectedFields(prev => {
      const next = new Set(prev);
      if (next.has(fieldValue)) {
        next.delete(fieldValue);
      } else {
        next.add(fieldValue);
      }
      return next;
    });
  };

  const handleFilterFieldChange = (fieldValue) => {
    setCurrentFilterField(fieldValue);
    setCurrentFilterValues(new Set());
    setFilterValuesSearchTerm('');
  };

  const handleFilterValueToggle = (value) => {
    setCurrentFilterValues(prev => {
      const next = new Set(prev);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      return next;
    });
  };

  const handleAddFilter = () => {
    if (!currentFilterField) {
      alert('Please select a filter field first');
      return;
    }
    if (currentFilterValues.size === 0) {
      alert('Please select at least one filter value');
      return;
    }
    
    const existingFilterIndex = filters.findIndex(f => f.field === currentFilterField);
    
    if (existingFilterIndex >= 0) {
      const updatedFilters = [...filters];
      updatedFilters[existingFilterIndex] = {
        field: currentFilterField,
        values: Array.from(currentFilterValues)
      };
      setFilters(updatedFilters);
    } else {
      setFilters(prev => [...prev, {
        field: currentFilterField,
        values: Array.from(currentFilterValues)
      }]);
    }
    
    setCurrentFilterField('');
    setCurrentFilterValues(new Set());
    setFilterValuesSearchTerm('');
  };

  const handleRemoveFilter = (index) => {
    setFilters(prev => prev.filter((_, i) => i !== index));
  };

  const handleRemoveFilterValue = (filterIndex, value) => {
    setFilters(prev => {
      const updated = [...prev];
      const filter = updated[filterIndex];
      if (filter) {
        filter.values = filter.values.filter(v => v !== value);
        if (filter.values.length === 0) {
          return updated.filter((_, i) => i !== filterIndex);
        }
      }
      return updated;
    });
  };

  const handleSave = () => {
    if (!reportTitle.trim()) {
      alert('Please enter a report title');
      return;
    }

    if (selectedFields.size === 0) {
      alert('Please select at least one field');
      return;
    }

    try {
      const existingReports = JSON.parse(localStorage.getItem('customReports') || '[]');
      const newReport = {
        id: Date.now().toString(),
        title: reportTitle.trim(),
        fields: Array.from(selectedFields),
        filters: filters.map(f => ({
          field: f.field,
          values: f.values
        })),
        relationships: relationships.length > 0 ? relationships : undefined, // Save relationships if configured
        sortIndexes: {},
        createdAt: new Date().toISOString()
      };

      existingReports.push(newReport);
      localStorage.setItem('customReports', JSON.stringify(existingReports));
      
      setReportTitle('');
      setSelectedFields(new Set());
      setSearchTerm('');
      setFilters([]);
      setRelationships([]);
      setShowRelationships(false);
      setCurrentFilterField('');
      setCurrentFilterValues(new Set());
      setFilterValuesSearchTerm('');
      setFilterFieldSearchTerm('');
      onClose();
      
      alert('Custom report created successfully!');
    } catch (error) {
      console.error('Error saving custom report:', error);
      alert('Failed to save custom report. Please try again.');
    }
  };

  return (
    <div
      style={{
        background: 'white',
        borderRadius: '12px',
        width: '90%',
        maxWidth: '800px',
        maxHeight: '90vh',
        overflow: 'hidden',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        display: 'flex',
        flexDirection: 'column'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{
        padding: '20px 24px',
        borderBottom: '1px solid #f1f5f9',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: '#fafbfc'
      }}>
        <h2 style={{ 
          margin: 0, 
          fontSize: '18px', 
          fontWeight: '600', 
          color: '#1e293b',
          letterSpacing: '-0.01em'
        }}>
          Create Custom Report
        </h2>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: '#94a3b8',
            borderRadius: '6px',
            padding: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease',
            width: '28px',
            height: '28px'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#f1f5f9';
            e.currentTarget.style.color = '#64748b';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = '#94a3b8';
          }}
        >
          <span className="material-icons" style={{ fontSize: '20px' }}>close</span>
        </button>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} style={{ 
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        overflowY: 'auto',
        flex: 1
      }}>
        <div>
          <label style={{
            display: 'block',
            fontSize: '13px',
            fontWeight: '500',
            color: '#475569',
            marginBottom: '6px',
            letterSpacing: '0.01em'
          }}>
            Report Title <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <input
            type="text"
            value={reportTitle}
            onChange={(e) => setReportTitle(e.target.value)}
            placeholder="Enter report title..."
            required
            style={{
              width: '100%',
              padding: '11px 14px',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              fontSize: '14px',
              outline: 'none',
              transition: 'all 0.15s ease',
              background: '#ffffff',
              color: '#1e293b',
              boxSizing: 'border-box'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#3b82f6';
              e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = '#e2e8f0';
              e.target.style.boxShadow = 'none';
            }}
          />
        </div>

        <div>
          <label style={{
            display: 'block',
            fontSize: '13px',
            fontWeight: '500',
            color: '#475569',
            marginBottom: '8px',
            letterSpacing: '0.01em'
          }}>
            Choose fields to include in the report: <span style={{ color: '#ef4444' }}>*</span>
          </label>
          
          <div style={{ marginBottom: '12px', position: 'relative' }}>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search fields..."
              style={{
                width: '100%',
                padding: '10px 40px 10px 14px',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                fontSize: '14px',
                outline: 'none',
                transition: 'all 0.15s ease',
                background: '#ffffff',
                color: '#1e293b',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#3b82f6';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e2e8f0';
              }}
            />
            <span className="material-icons" style={{
              position: 'absolute',
              right: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: '20px',
              color: '#94a3b8',
              pointerEvents: 'none'
            }}>search</span>
          </div>
          
          <HierarchicalFieldList
            fields={filteredFields}
            selectedFields={selectedFields}
            onFieldToggle={handleFieldToggle}
            searchTerm={searchTerm}
          />
        </div>

        <div>
          <div style={{
            fontSize: '13px',
            fontWeight: '500',
            color: '#475569',
            marginBottom: '12px',
            paddingBottom: '8px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span className="material-icons" style={{ fontSize: '18px', color: '#7c3aed' }}>filter_list</span>
            Filters (Optional)
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: '500',
              color: '#64748b',
              marginBottom: '6px'
            }}>
              Filter Field:
            </label>
            <div style={{ marginBottom: '12px', position: 'relative' }}>
              <input
                type="text"
                value={filterFieldSearchTerm}
                onChange={(e) => setFilterFieldSearchTerm(e.target.value)}
                placeholder="Search filter fields..."
                style={{
                  width: '100%',
                  padding: '10px 40px 10px 14px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'all 0.15s ease',
                  background: '#ffffff',
                  color: '#1e293b',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#3b82f6';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e2e8f0';
                }}
              />
              <span className="material-icons" style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: '20px',
                color: '#94a3b8',
                pointerEvents: 'none'
              }}>search</span>
            </div>

            <HierarchicalFieldList
              fields={filteredAvailableFilterFields}
              selectedFields={currentFilterField ? new Set([currentFilterField]) : new Set()}
              onFieldToggle={handleFilterFieldChange}
              searchTerm={filterFieldSearchTerm}
              selectionMode="single"
            />
          </div>

          {currentFilterField && currentFilterFieldValues.length > 0 && (
            <>
              <div style={{ marginBottom: '12px' }}>
                <input
                  type="text"
                  placeholder="Search values..."
                  value={filterValuesSearchTerm}
                  onChange={(e) => setFilterValuesSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'all 0.15s ease',
                    background: '#ffffff',
                    color: '#1e293b',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#3b82f6';
                    e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e2e8f0';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>

              <div style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '12px',
                maxHeight: '200px',
                overflowY: 'auto',
                marginBottom: '12px'
              }}>
                <div style={{
                  fontSize: '12px',
                  fontWeight: '500',
                  color: '#64748b',
                  marginBottom: '8px'
                }}>
                  Select values to include:
                  {filterValuesSearchTerm && (
                    <span style={{ fontWeight: '400', color: '#94a3b8' }}>
                      {' '}({filteredFilterFieldValues.length} of {currentFilterFieldValues.length})
                    </span>
                  )}
                </div>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}>
                  {filteredFilterFieldValues.map((value) => (
                    <div
                      key={value}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '6px 8px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        transition: 'background 0.15s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#f8fafc';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                      onClick={() => handleFilterValueToggle(value)}
                    >
                      <div style={{
                        width: '18px',
                        height: '18px',
                        border: currentFilterValues.has(value) ? 'none' : '2px solid #cbd5e1',
                        borderRadius: '4px',
                        background: currentFilterValues.has(value) ? '#10b981' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: '10px',
                        flexShrink: 0
                      }}>
                        {currentFilterValues.has(value) && (
                          <span className="material-icons" style={{ fontSize: '14px', color: 'white' }}>check</span>
                        )}
                      </div>
                      <span style={{
                        fontSize: '13px',
                        fontWeight: currentFilterValues.has(value) ? '600' : '400',
                        color: '#1e293b'
                      }}>
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
                {currentFilterValues.size > 0 && (
                  <div style={{
                    marginTop: '10px',
                    paddingTop: '10px',
                    borderTop: '1px solid #e2e8f0',
                    fontSize: '12px',
                    color: '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <span>{currentFilterValues.size} value(s) selected</span>
                    <button
                      type="button"
                      onClick={() => setCurrentFilterValues(new Set())}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#ef4444',
                        fontSize: '12px',
                        cursor: 'pointer',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        transition: 'background 0.15s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.background = '#fef2f2';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.background = 'transparent';
                      }}
                    >
                      Clear all
                    </button>
                  </div>
                )}
              </div>

              {currentFilterValues.size > 0 && (
                <button
                  type="button"
                  onClick={handleAddFilter}
                  style={{
                    width: '100%',
                    padding: '10px 16px',
                    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 2px 4px rgba(59, 130, 246, 0.2)',
                    marginBottom: '12px'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.transform = 'translateY(-1px)';
                    e.target.style.boxShadow = '0 4px 8px rgba(59, 130, 246, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 2px 4px rgba(59, 130, 246, 0.2)';
                  }}
                >
                  {filters.find(f => f.field === currentFilterField) ? 'Update Filter' : 'Add Filter'}
                </button>
              )}
            </>
          )}

          {filters.length > 0 && (
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '12px',
              minHeight: '80px'
            }}>
              <div style={{
                background: '#ffffff',
                border: '1px dashed #cbd5e1',
                borderRadius: '6px',
                padding: '8px',
                minHeight: '60px'
              }}>
                {filters.map((filter, index) => {
                  const field = allFields.find(f => f.value === filter.field);
                  const fieldLabel = field ? field.label : filter.field;
                  const valuesArray = Array.isArray(filter.values) ? filter.values : [];
                  return (
                    <div
                      key={index}
                      style={{
                        display: 'inline-flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        background: '#fef3c7',
                        border: '1px solid #fbbf24',
                        color: '#92400e',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: '500',
                        margin: '4px',
                        gap: '6px',
                        maxWidth: '100%'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%' }}>
                        <span style={{ fontWeight: '600' }}>{fieldLabel}:</span>
                        <span 
                          className="material-icons" 
                          style={{ 
                            fontSize: '16px',
                            cursor: 'pointer',
                            padding: '2px',
                            borderRadius: '2px',
                            transition: 'background 0.2s',
                            marginLeft: 'auto'
                          }}
                          onClick={() => handleRemoveFilter(index)}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#fde68a';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                          }}
                          title="Remove filter"
                        >
                          close
                        </span>
                      </div>
                      <div style={{ 
                        fontSize: '11px', 
                        color: '#78350f',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        maxWidth: '100%',
                        width: '100%'
                      }}>
                        {valuesArray.length > 0 ? (
                          valuesArray.map((val, i) => (
                            <div key={i} style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              background: '#fef3c7',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              border: '1px solid #fbbf24',
                              width: '100%'
                            }}>
                              <span style={{ flex: 1, wordBreak: 'break-word' }}>{val}</span>
                              <span 
                                className="material-icons" 
                                style={{ 
                                  fontSize: '14px',
                                  cursor: 'pointer',
                                  padding: '2px',
                                  borderRadius: '2px',
                                  transition: 'background 0.2s',
                                  flexShrink: 0
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveFilterValue(index, val);
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = '#fde68a';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'transparent';
                                }}
                                title="Remove this value"
                              >
                                close
                              </span>
                            </div>
                          ))
                        ) : (
                          <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>No values selected</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Table Relationships Configuration */}
        {involvedTables.length > 1 && (
          <div>
            <div style={{
              fontSize: '13px',
              fontWeight: '500',
              color: '#475569',
              marginBottom: '12px',
              paddingBottom: '8px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="material-icons" style={{ fontSize: '18px', color: '#8b5cf6' }}>link</span>
                <span>Table Relationships</span>
                <span style={{
                  fontSize: '11px',
                  color: '#64748b',
                  fontWeight: '400',
                  marginLeft: '8px'
                }}>
                  (How to join {involvedTables.join(' + ')})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowRelationships(!showRelationships)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#8b5cf6',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                {showRelationships ? 'Hide' : 'Show'}
                <span className="material-icons" style={{
                  fontSize: '16px',
                  transform: showRelationships ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s'
                }}>
                  expand_more
                </span>
              </button>
            </div>

            {showRelationships && (
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '16px'
              }}>
                <div style={{
                  fontSize: '12px',
                  color: '#64748b',
                  marginBottom: '12px',
                  lineHeight: '1.5'
                }}>
                  Define how to join tables when fields from multiple tables are selected. 
                  The system will use these mappings to fetch related data.
                </div>

                {involvedTables.includes('customers') && (
                  <div style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    padding: '12px',
                    marginBottom: '12px'
                  }}>
                    <div style={{
                      fontSize: '12px',
                      fontWeight: '600',
                      color: '#1e293b',
                      marginBottom: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <span className="material-icons" style={{ fontSize: '16px', color: '#3b82f6' }}>people</span>
                      {involvedNestedArrays.includes('ledgerentries') || involvedNestedArrays.includes('accountingallocation') 
                        ? (involvedNestedArrays.includes('ledgerentries') ? 'Ledger Entries' : 'Accounting Allocation') + ' → Ledger (Customers)'
                        : 'Vouchers → Customers'}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '10px', alignItems: 'center' }}>
                      <div>
                        <label style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px', display: 'block' }}>
                          From {involvedNestedArrays.includes('ledgerentries') || involvedNestedArrays.includes('accountingallocation') 
                            ? (involvedNestedArrays.includes('ledgerentries') ? 'Ledger Entries' : 'Accounting Allocation')
                            : 'Vouchers'} (Field):
                        </label>
                        <select
                          value={relationships.find(r => r.toTable === 'customers')?.fromField || 
                                 (involvedNestedArrays.includes('ledgerentries') || involvedNestedArrays.includes('accountingallocation') 
                                   ? 'ledgernameid' : 'partyledgernameid')}
                          onChange={(e) => {
                            const existing = relationships.find(r => r.toTable === 'customers');
                            if (existing) {
                              setRelationships(prev => prev.map(r => 
                                r.toTable === 'customers' ? { ...r, fromField: e.target.value } : r
                              ));
                            } else {
                              setRelationships(prev => [...prev, {
                                fromTable: 'vouchers',
                                fromField: e.target.value,
                                toTable: 'customers',
                                toField: 'PARTYLEDGERNAMEID',
                                joinType: 'left'
                              }]);
                            }
                          }}
                          style={{
                            width: '100%',
                            padding: '8px',
                            border: '1px solid #e2e8f0',
                            borderRadius: '6px',
                            fontSize: '12px',
                            background: '#ffffff'
                          }}
                        >
                          {relationshipFields.vouchers.length > 0 ? (
                            relationshipFields.vouchers.map(field => (
                              <option key={field.value} value={field.value}>
                                {field.label}
                              </option>
                            ))
                          ) : (
                            <>
                              <option value="partyledgernameid">Party Ledger Name ID</option>
                              <option value="partyid">Party ID</option>
                              <option value="partyledgername">Party Ledger Name</option>
                              <option value="customer">Customer</option>
                              <option value="party">Party</option>
                            </>
                          )}
                        </select>
                      </div>
                      <div style={{ color: '#94a3b8', fontSize: '14px' }}>→</div>
                      <div>
                        <label style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px', display: 'block' }}>
                          To Customers (Field):
                        </label>
                        <select
                          value={relationships.find(r => r.toTable === 'customers')?.toField || 'MASTERID'}
                          onChange={(e) => {
                            const existing = relationships.find(r => r.toTable === 'customers');
                            if (existing) {
                              setRelationships(prev => prev.map(r => 
                                r.toTable === 'customers' ? { ...r, toField: e.target.value } : r
                              ));
                            } else {
                              setRelationships(prev => [...prev, {
                                fromTable: 'vouchers',
                                fromField: (involvedNestedArrays.includes('ledgerentries') || involvedNestedArrays.includes('accountingallocation')) 
                                  ? 'ledgernameid' : 'partyledgernameid',
                                toTable: 'customers',
                                toField: e.target.value,
                                joinType: 'left'
                              }]);
                            }
                          }}
                          style={{
                            width: '100%',
                            padding: '8px',
                            border: '1px solid #e2e8f0',
                            borderRadius: '6px',
                            fontSize: '12px',
                            background: '#ffffff'
                          }}
                        >
                          {relationshipFields.customers.length > 0 ? (
                            relationshipFields.customers.map(field => (
                              <option key={field.value} value={field.value}>
                                {field.label}
                              </option>
                            ))
                          ) : (
                            <option value="PARTYLEDGERNAMEID">PARTYLEDGERNAMEID</option>
                          )}
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {involvedTables.includes('stockitems') && (
                  <div style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    padding: '12px'
                  }}>
                    <div style={{
                      fontSize: '12px',
                      fontWeight: '600',
                      color: '#1e293b',
                      marginBottom: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <span className="material-icons" style={{ fontSize: '16px', color: '#22c55e' }}>inventory_2</span>
                      Vouchers → Stock Items
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '10px', alignItems: 'center' }}>
                      <div>
                        <label style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px', display: 'block' }}>
                          From Vouchers (Field):
                        </label>
                        <select
                          value={relationships.find(r => r.toTable === 'stockitems')?.fromField || 'stockitemnameid'}
                          onChange={(e) => {
                            const existing = relationships.find(r => r.toTable === 'stockitems');
                            if (existing) {
                              setRelationships(prev => prev.map(r => 
                                r.toTable === 'stockitems' ? { ...r, fromField: e.target.value } : r
                              ));
                            } else {
                              setRelationships(prev => [...prev, {
                                fromTable: 'vouchers',
                                fromField: e.target.value,
                                toTable: 'stockitems',
                                toField: 'STOCKITEMNAMEID',
                                joinType: 'left'
                              }]);
                            }
                          }}
                          style={{
                            width: '100%',
                            padding: '8px',
                            border: '1px solid #e2e8f0',
                            borderRadius: '6px',
                            fontSize: '12px',
                            background: '#ffffff'
                          }}
                        >
                          {relationshipFields.vouchers.length > 0 ? (
                            relationshipFields.vouchers.map(field => (
                              <option key={field.value} value={field.value}>
                                {field.label}
                              </option>
                            ))
                          ) : (
                            <>
                              <option value="stockitemnameid">Stock Item Name ID</option>
                              <option value="itemid">Item ID</option>
                              <option value="stockitemname">Stock Item Name</option>
                              <option value="item">Item</option>
                            </>
                          )}
                        </select>
                      </div>
                      <div style={{ color: '#94a3b8', fontSize: '14px' }}>→</div>
                      <div>
                        <label style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px', display: 'block' }}>
                          To Stock Items (Field):
                        </label>
                        <select
                          value={relationships.find(r => r.toTable === 'stockitems')?.toField || 'MASTERID'}
                          onChange={(e) => {
                            const existing = relationships.find(r => r.toTable === 'stockitems');
                            if (existing) {
                              setRelationships(prev => prev.map(r => 
                                r.toTable === 'stockitems' ? { ...r, toField: e.target.value } : r
                              ));
                            } else {
                              setRelationships(prev => [...prev, {
                                fromTable: 'vouchers',
                                fromField: 'stockitemnameid',
                                toTable: 'stockitems',
                                toField: e.target.value,
                                joinType: 'left'
                              }]);
                            }
                          }}
                          style={{
                            width: '100%',
                            padding: '8px',
                            border: '1px solid #e2e8f0',
                            borderRadius: '6px',
                            fontSize: '12px',
                            background: '#ffffff'
                          }}
                        >
                          {relationshipFields.stockitems.length > 0 ? (
                            relationshipFields.stockitems.map(field => (
                              <option key={field.value} value={field.value}>
                                {field.label}
                              </option>
                            ))
                          ) : (
                            <option value="STOCKITEMNAMEID">STOCKITEMNAMEID</option>
                          )}
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div style={{
          display: 'flex',
          gap: '10px',
          justifyContent: 'flex-end',
          marginTop: 'auto',
          paddingTop: '20px',
          borderTop: '1px solid #f1f5f9'
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '10px 20px',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              background: '#ffffff',
              color: '#64748b',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              minWidth: '80px'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = '#f8fafc';
              e.target.style.borderColor = '#cbd5e1';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = '#ffffff';
              e.target.style.borderColor = '#e2e8f0';
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!reportTitle.trim() || selectedFields.size === 0}
            style={{
              padding: '10px 24px',
              border: 'none',
              borderRadius: '8px',
              background: (!reportTitle.trim() || selectedFields.size === 0) ? '#cbd5e1' : 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
              color: 'white',
              fontSize: '14px',
              fontWeight: '600',
              cursor: (!reportTitle.trim() || selectedFields.size === 0) ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: (!reportTitle.trim() || selectedFields.size === 0) ? 'none' : '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
              minWidth: '110px'
            }}
            onMouseEnter={(e) => {
              if (reportTitle.trim() && selectedFields.size > 0) {
                e.target.style.background = 'linear-gradient(135deg, #6d28d9 0%, #5b21b6 100%)';
                e.target.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
              }
            }}
            onMouseLeave={(e) => {
              if (reportTitle.trim() && selectedFields.size > 0) {
                e.target.style.background = 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)';
                e.target.style.boxShadow = '0 1px 2px 0 rgba(0, 0, 0, 0.05)';
              }
            }}
          >
            Create Report
          </button>
        </div>
      </form>
    </div>
  );
};

// Pivot Table Renderer Component
const PivotTableRenderer = ({ pivotData, pivotConfig, getFieldLabel }) => {
  // Pagination state for columns
  const [currentColumnPage, setCurrentColumnPage] = useState(0);
  const COLUMNS_PER_PAGE = 20; // Number of columns to show per page

  // Calculate pagination (even if pivotData is null, to avoid hook conditional call)
  const totalColumns = pivotData?.colKeys?.length || 0;
  const totalPages = Math.ceil(totalColumns / COLUMNS_PER_PAGE);
  const startIndex = currentColumnPage * COLUMNS_PER_PAGE;
  const endIndex = Math.min(startIndex + COLUMNS_PER_PAGE, totalColumns);
  const visibleColKeys = pivotData?.colKeys?.slice(startIndex, endIndex) || [];

  // Reset to first page if current page is out of bounds
  // This hook must be called unconditionally (before any early returns)
  useEffect(() => {
    if (totalPages > 0 && currentColumnPage >= totalPages) {
      setCurrentColumnPage(0);
    }
  }, [totalPages, currentColumnPage]);

  if (!pivotData) {
    return (
      <div style={{
        padding: '40px',
        textAlign: 'center',
        color: '#64748b',
        border: '1px solid #d1d5db',
        background: 'white'
      }}>
        <p>Please add fields to Rows, Columns, and Values to generate the pivot table.</p>
      </div>
    );
  }

  const formatValue = (value, valueField) => {
    if (value == null || value === undefined) return '-';
    if (valueField.aggregation === 'count' || valueField.aggregation === 'distinctCount') {
      return Math.round(value).toLocaleString('en-IN');
    }
    if (typeof value === 'number') {
      if (valueField.format === 'currency') {
        return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      }
      if (valueField.format === 'percentage') {
        return `${value.toFixed(2)}%`;
      }
      return value.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    }
    return value;
  };

  const splitKey = (key) => {
    return key === 'Total' ? ['Total'] : key.split('|');
  };

  // Pagination Controls Component
  const PaginationControls = ({ position }) => (
    totalColumns > COLUMNS_PER_PAGE && (
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 16px',
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderBottom: position === 'top' ? 'none' : '1px solid #e2e8f0',
        borderTop: position === 'bottom' ? 'none' : '1px solid #e2e8f0',
        borderRadius: position === 'top' ? '8px 8px 0 0' : '0 0 8px 8px'
      }}>
        <div style={{
          fontSize: '13px',
          color: '#475569',
          fontWeight: '500'
        }}>
          Showing columns {startIndex + 1} - {endIndex} of {totalColumns}
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <button
            onClick={() => setCurrentColumnPage(prev => Math.max(0, prev - 1))}
            disabled={currentColumnPage === 0}
            style={{
              padding: '6px 12px',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              background: currentColumnPage === 0 ? '#f1f5f9' : '#ffffff',
              color: currentColumnPage === 0 ? '#94a3b8' : '#475569',
              cursor: currentColumnPage === 0 ? 'not-allowed' : 'pointer',
              fontSize: '13px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              if (currentColumnPage > 0) {
                e.currentTarget.style.background = '#f8fafc';
                e.currentTarget.style.borderColor = '#94a3b8';
              }
            }}
            onMouseLeave={(e) => {
              if (currentColumnPage > 0) {
                e.currentTarget.style.background = '#ffffff';
                e.currentTarget.style.borderColor = '#cbd5e1';
              }
            }}
          >
            <span className="material-icons" style={{ fontSize: '18px' }}>chevron_left</span>
            Previous
          </button>
          <div style={{
            padding: '6px 12px',
            fontSize: '13px',
            color: '#64748b',
            fontWeight: '500',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '6px',
            minWidth: '100px',
            textAlign: 'center'
          }}>
            Page {currentColumnPage + 1} of {totalPages}
          </div>
          <button
            onClick={() => setCurrentColumnPage(prev => Math.min(totalPages - 1, prev + 1))}
            disabled={currentColumnPage >= totalPages - 1}
            style={{
              padding: '6px 12px',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              background: currentColumnPage >= totalPages - 1 ? '#f1f5f9' : '#ffffff',
              color: currentColumnPage >= totalPages - 1 ? '#94a3b8' : '#475569',
              cursor: currentColumnPage >= totalPages - 1 ? 'not-allowed' : 'pointer',
              fontSize: '13px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              if (currentColumnPage < totalPages - 1) {
                e.currentTarget.style.background = '#f8fafc';
                e.currentTarget.style.borderColor = '#94a3b8';
              }
            }}
            onMouseLeave={(e) => {
              if (currentColumnPage < totalPages - 1) {
                e.currentTarget.style.background = '#ffffff';
                e.currentTarget.style.borderColor = '#cbd5e1';
              }
            }}
          >
            Next
            <span className="material-icons" style={{ fontSize: '18px' }}>chevron_right</span>
          </button>
        </div>
      </div>
    )
  );

  return (
    <div>
      {/* Pagination Controls - Top */}
      <PaginationControls position="top" />
      
      <div style={{
        overflowX: 'auto',
        border: '1px solid #d1d5db',
        background: 'white',
        borderTop: totalColumns > COLUMNS_PER_PAGE ? 'none' : '1px solid #d1d5db'
      }}>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: '13px'
      }}>
        <thead>
          {/* Column Headers */}
          {pivotConfig.columns.length > 0 && (
            <>
              <tr style={{ background: '#f3f4f6' }}>
                {/* Row field headers - rowspan for 3 rows (column label, item names, value names) */}
                {pivotConfig.rows.map((rowField, idx) => (
                  <th
                    key={`row-header-${idx}`}
                    rowSpan={3}
                    style={{
                      padding: '6px 8px',
                      border: '1px solid #d1d5db',
                      background: '#f3f4f6',
                      fontWeight: '600',
                      textAlign: 'left',
                      verticalAlign: 'top'
                    }}
                  >
                    {rowField.label}
                  </th>
                ))}
                {/* Column field label header */}
                <th
                  colSpan={pivotConfig.values.length * visibleColKeys.length}
                  style={{
                    padding: '6px 8px',
                    border: '1px solid #d1d5db',
                    background: '#f3f4f6',
                    fontWeight: '600',
                    textAlign: 'center'
                  }}
                >
                  {pivotConfig.columns.map(c => c.label).join(' / ')}
                  {totalColumns > COLUMNS_PER_PAGE && (
                    <span style={{ 
                      fontSize: '11px', 
                      fontWeight: '400', 
                      marginLeft: '8px', 
                      color: '#64748b',
                      display: 'block',
                      marginTop: '2px'
                    }}>
                      (Page {currentColumnPage + 1} of {totalPages})
                    </span>
                  )}
                </th>
                {/* Total column header - only show if there are multiple value fields or multiple columns */}
                {pivotConfig.values.length > 0 && (pivotConfig.values.length > 1 || Array.from(pivotData.colKeys).length > 1) && (
                  <th
                    rowSpan={3}
                    colSpan={pivotConfig.values.length}
                    style={{
                      padding: '6px 8px',
                      border: '1px solid #d1d5db',
                      background: '#f3f4f6',
                      fontWeight: '600',
                      textAlign: 'center',
                      verticalAlign: 'top'
                    }}
                  >
                    Total
                  </th>
                )}
              </tr>
              <tr style={{ background: '#f3f4f6' }}>
                {/* Second header row - Item names (merged across value fields) */}
                {visibleColKeys.map(colKey => {
                  const colValues = splitKey(colKey);
                  const itemName = colValues.join(' / ');
                  return (
                    <th
                      key={`item-${colKey}`}
                      colSpan={pivotConfig.values.length}
                      style={{
                        padding: '6px 8px',
                        border: '1px solid #d1d5db',
                        background: '#f3f4f6',
                        fontWeight: '600',
                        textAlign: 'center'
                      }}
                    >
                      {itemName}
                    </th>
                  );
                })}
              </tr>
              <tr style={{ background: '#f3f4f6' }}>
                {/* Third header row - Value field names (Amount, Quantity, etc.) */}
                {visibleColKeys.map(colKey => {
                  return pivotConfig.values.map((valueField, vIdx) => (
                    <th
                      key={`value-${colKey}-${vIdx}`}
                      style={{
                        padding: '6px 8px',
                        border: '1px solid #d1d5db',
                        background: '#f3f4f6',
                        fontWeight: '600',
                        textAlign: 'center'
                      }}
                    >
                      {valueField.aggregation ? `${valueField.aggregation} of ${valueField.label}` : valueField.label}
                    </th>
                  ));
                })}
              </tr>
            </>
          )}
          {/* No column fields - just value headers */}
          {pivotConfig.columns.length === 0 && (
            <tr style={{ background: '#f3f4f6' }}>
              {pivotConfig.rows.map((rowField, idx) => (
                <th
                  key={`row-header-${idx}`}
                  style={{
                    padding: '6px 8px',
                    border: '1px solid #d1d5db',
                    background: '#f3f4f6',
                    fontWeight: '600',
                    textAlign: 'left'
                  }}
                >
                  {rowField.label}
                </th>
              ))}
              {pivotConfig.values.map((valueField, vIdx) => (
                <th
                  key={`value-header-${vIdx}`}
                  style={{
                    padding: '6px 8px',
                    border: '1px solid #d1d5db',
                    background: '#f3f4f6',
                    fontWeight: '600',
                    textAlign: 'center'
                  }}
                >
                  {valueField.aggregation ? `${valueField.aggregation} of ${valueField.label}` : valueField.label}
                </th>
              ))}
              {/* Total column - only show if there are multiple value fields */}
              {pivotConfig.values.length > 1 && (
                <th
                  style={{
                    padding: '6px 8px',
                    border: '1px solid #d1d5db',
                    background: '#f3f4f6',
                    fontWeight: '600',
                    textAlign: 'center'
                  }}
                >
                  Total
                </th>
              )}
            </tr>
          )}
        </thead>
        <tbody>
          {/* Data Rows with Hierarchical Grouping */}
          {(() => {
            // Group rows by first row field (for hierarchical display like Excel)
            const groupedRows = new Map();
            pivotData.rowKeys.forEach(rowKey => {
              const rowValues = splitKey(rowKey);
              const firstLevelKey = rowValues[0] || 'Total';
              
              if (!groupedRows.has(firstLevelKey)) {
                groupedRows.set(firstLevelKey, []);
              }
              groupedRows.get(firstLevelKey).push({ rowKey, rowValues });
            });

            // Build rows with rowspan for parent cells
            const rows = [];
            let globalRowIdx = 0;
            
            groupedRows.forEach((subRows, firstLevelKey) => {
              const groupRowCount = subRows.length + (pivotConfig.rows.length > 1 && subRows.length > 1 ? 1 : 0);
              let isFirstRowInGroup = true;
              
              // Add detail rows
              subRows.forEach(({ rowKey, rowValues }, idx) => {
                rows.push({
                  type: 'detail',
                  rowKey,
                  rowValues,
                  firstLevelKey,
                  isFirstRowInGroup,
                  groupRowCount,
                  rowIdx: globalRowIdx++
                });
                isFirstRowInGroup = false;
              });
              
              // Add subtotal row after detail rows (if multiple row fields and multiple items)
              if (pivotConfig.rows.length > 1 && subRows.length > 1) {
                rows.push({
                  type: 'subtotal',
                  key: `subtotal-${firstLevelKey}`,
                  firstLevelKey,
                  groupRowCount,
                  rowIdx: globalRowIdx++
                });
              }
            });

            return rows.map((row, rowArrayIdx) => {
              if (row.type === 'subtotal') {
                // Subtotal row
                const firstLevelKey = row.firstLevelKey;
                const matchingRowKeys = pivotData.rowKeys.filter(rk => {
                  const parts = splitKey(rk);
                  return parts[0] === firstLevelKey;
                });
                
                // Calculate subtotal
                const subtotals = {};
                pivotConfig.values.forEach(valueField => {
                  let total = 0;
                  matchingRowKeys.forEach(rk => {
                    const rowTotal = pivotData.totals[rk]?.[valueField.field];
                    if (rowTotal != null) {
                      total += (typeof rowTotal === 'number' ? rowTotal : parseFloat(rowTotal) || 0);
                    }
                  });
                  subtotals[valueField.field] = total;
                });

                return (
                  <tr
                    key={row.key}
                    style={{
                      background: '#fef3c7',
                      fontWeight: '600'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#fde68a';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#fef3c7';
                    }}
                  >
                    {/* First level label - subtotal row doesn't need rowspan as parent is already shown in first detail row */}
                    {/* Empty cells for nested levels */}
                    {pivotConfig.rows.slice(1).map((_, idx) => (
                      <td
                        key={`empty-${idx}`}
                        style={{
                          padding: '6px 8px',
                          border: '1px solid #d1d5db',
                          background: '#fef3c7'
                        }}
                      />
                    ))}
                    {/* Data cells - show subtotals */}
                    {visibleColKeys.map(colKey => {
                      return pivotConfig.values.map((valueField, vIdx) => (
                        <td
                          key={`subtotal-cell-${colKey}-${vIdx}`}
                          style={{
                            padding: '6px 8px',
                            border: '1px solid #d1d5db',
                            textAlign: 'right',
                            fontWeight: '600',
                            background: '#fef3c7',
                            fontFamily: 'monospace'
                          }}
                        >
                          {/* Calculate subtotal for this column */}
                          {(() => {
                            let colTotal = 0;
                            matchingRowKeys.forEach(rk => {
                              const val = pivotData.data[rk]?.[colKey]?.[valueField.field];
                              if (val != null) {
                                colTotal += (typeof val === 'number' ? val : parseFloat(val) || 0);
                              }
                            });
                            return formatValue(colTotal, valueField);
                          })()}
                        </td>
                      ));
                    })}
                    {/* Subtotal column - only show if there are multiple value fields or multiple columns */}
                    {(pivotConfig.values.length > 1 || Array.from(pivotData.colKeys).length > 1) && pivotConfig.values.map((valueField, vIdx) => (
                      <td
                        key={`subtotal-total-${vIdx}`}
                        style={{
                          padding: '6px 8px',
                          border: '1px solid #d1d5db',
                          textAlign: 'right',
                          fontWeight: '600',
                          background: '#fef3c7',
                          fontFamily: 'monospace'
                        }}
                      >
                        {formatValue(subtotals[valueField.field], valueField)}
                      </td>
                    ))}
                  </tr>
                );
              } else {
                // Detail row
                const { rowKey, rowValues, isFirstRowInGroup, groupRowCount } = row;
                return (
                  <tr
                    key={rowKey}
                    style={{
                      background: row.rowIdx % 2 === 0 ? 'white' : '#fafafa'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#f3f4f6';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = row.rowIdx % 2 === 0 ? 'white' : '#fafafa';
                    }}
                  >
                    {/* Render row labels based on number of row fields */}
                    {pivotConfig.rows.length > 1 ? (
                      <>
                        {/* Multiple row fields - use hierarchical grouping with rowspan */}
                        {isFirstRowInGroup && (
                          <td
                            rowSpan={groupRowCount}
                            style={{
                              padding: '6px 8px',
                              border: '1px solid #d1d5db',
                              fontWeight: '600',
                              background: '#fafafa',
                              verticalAlign: 'top'
                            }}
                          >
                            {rowValues[0]}
                          </td>
                        )}
                        {/* Child row labels */}
                        {rowValues.slice(1).map((val, idx) => (
                          <td
                            key={`row-label-${idx + 1}`}
                            style={{
                              padding: '6px 8px',
                              border: '1px solid #d1d5db',
                              fontWeight: '400',
                              background: 'white',
                              paddingLeft: `${20 + idx * 20}px`
                            }}
                          >
                            <span style={{ marginRight: '4px', color: '#94a3b8' }}>└</span>
                            {val}
                          </td>
                        ))}
                      </>
                    ) : (
                      /* Single row field - show each value in its own row (no rowspan) */
                      <td
                        style={{
                          padding: '6px 8px',
                          border: '1px solid #d1d5db',
                          fontWeight: '600',
                          background: '#fafafa'
                        }}
                      >
                        {rowValues[0]}
                      </td>
                    )}
                    {/* Data cells */}
                    {visibleColKeys.map(colKey => {
                      return pivotConfig.values.map((valueField, vIdx) => (
                        <td
                          key={`cell-${rowKey}-${colKey}-${vIdx}`}
                          style={{
                            padding: '6px 8px',
                            border: '1px solid #d1d5db',
                            textAlign: 'right',
                            fontFamily: 'monospace'
                          }}
                        >
                          {formatValue(pivotData.data[rowKey]?.[colKey]?.[valueField.field], valueField)}
                        </td>
                      ));
                    })}
                    {/* Row totals - only show if there are multiple value fields or multiple columns */}
                    {(pivotConfig.values.length > 1 || Array.from(pivotData.colKeys).length > 1) && pivotConfig.values.map((valueField, vIdx) => (
                      <td
                        key={`row-total-${rowKey}-${vIdx}`}
                        style={{
                          padding: '6px 8px',
                          border: '1px solid #d1d5db',
                          textAlign: 'right',
                          fontWeight: '600',
                          background: '#fafafa',
                          fontFamily: 'monospace'
                        }}
                      >
                        {formatValue(pivotData.totals[rowKey]?.[valueField.field], valueField)}
                      </td>
                    ))}
                  </tr>
                );
              }
            });
          })()}
          {/* Grand Total Row */}
          {pivotData.rowKeys.length > 0 && (
            <tr style={{ background: '#f3f4f6', fontWeight: '600' }}>
              <td
                colSpan={pivotConfig.rows.length}
                style={{
                  padding: '6px 8px',
                  border: '1px solid #d1d5db',
                  fontWeight: '600',
                  background: '#f3f4f6'
                }}
              >
                Grand Total
              </td>
              {visibleColKeys.map(colKey => {
                return pivotConfig.values.map((valueField, vIdx) => (
                  <td
                    key={`col-total-${colKey}-${vIdx}`}
                    style={{
                      padding: '6px 8px',
                      border: '1px solid #d1d5db',
                      textAlign: 'right',
                      fontWeight: '600',
                      background: '#f3f4f6',
                      fontFamily: 'monospace'
                    }}
                  >
                    {formatValue(pivotData.colTotals[colKey][valueField.field], valueField)}
                  </td>
                ));
              })}
              {/* Grand Total column - only show if there are multiple value fields or multiple columns */}
              {(pivotConfig.values.length > 1 || Array.from(pivotData.colKeys).length > 1) && pivotConfig.values.map((valueField, vIdx) => (
                <td
                  key={`grand-total-${vIdx}`}
                  style={{
                    padding: '6px 8px',
                    border: '1px solid #d1d5db',
                    textAlign: 'right',
                    fontWeight: '600',
                    background: '#f3f4f6',
                    fontFamily: 'monospace'
                  }}
                >
                  {formatValue(pivotData.grandTotal[valueField.field], valueField)}
                </td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
    </div>

      {/* Pagination Controls - Bottom */}
      <PaginationControls position="bottom" />
    </div>
  );
};

// Pivot Fields Panel Component
const PivotFieldsPanel = ({ 
  availableFields, 
  pivotConfig, 
  setPivotConfig, 
  onFieldConfig,
  getFieldLabel,
  getFieldType
}) => {
  const [draggedField, setDraggedField] = useState(null);
  const [dragOverArea, setDragOverArea] = useState(null);
  const [fieldSearch, setFieldSearch] = useState('');

  // Filter available fields
  const filteredFields = useMemo(() => {
    if (!fieldSearch.trim()) return availableFields;
    const searchLower = fieldSearch.toLowerCase();
    return availableFields.filter(f => 
      f.label.toLowerCase().includes(searchLower) ||
      f.field.toLowerCase().includes(searchLower)
    );
  }, [availableFields, fieldSearch]);

  // All fields are available - fields can be used in multiple buckets
  // No need to filter out "used" fields

  // Handle drag start
  const handleDragStart = (e, field, sourceArea, sourceIndex) => {
    setDraggedField({ field, sourceArea, sourceIndex });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify({ field, sourceArea, sourceIndex }));
  };

  // Handle drag over
  const handleDragOver = (e, area) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverArea(area);
  };

  // Handle drag leave
  const handleDragLeave = () => {
    setDragOverArea(null);
  };

  // Handle drop
  const handleDrop = (e, targetArea, targetIndex) => {
    e.preventDefault();
    setDragOverArea(null);
    
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      const { field, sourceArea, sourceIndex } = data;
      
      // Remove from source area
      let updatedConfig = { ...pivotConfig };
      if (sourceArea && sourceArea !== 'available') {
        const sourceArray = [...pivotConfig[sourceArea]];
        sourceArray.splice(sourceIndex, 1);
        updatedConfig = {
          ...pivotConfig,
          [sourceArea]: sourceArray
        };
      }
      
      // Add to target area
      if (targetArea !== 'available') {
        const targetArray = [...updatedConfig[targetArea]];
        const fieldConfig = {
          field: field.field,
          label: field.label,
          type: field.type,
          aggregation: targetArea === 'values' ? (field.type === 'number' ? 'sum' : 'count') : undefined,
          format: targetArea === 'values' && field.type === 'number' ? 'number' : undefined,
          showSubtotals: true,
          showGrandTotal: true,
          values: targetArea === 'filters' ? [] : undefined  // Initialize empty filter values
        };
        
        if (targetIndex !== undefined) {
          targetArray.splice(targetIndex, 0, fieldConfig);
        } else {
          targetArray.push(fieldConfig);
        }
        
        updatedConfig = {
          ...updatedConfig,
          [targetArea]: targetArray
        };
      }
      
      // Update config (this will trigger the save callback)
      setPivotConfig(updatedConfig);
    } catch (error) {
      console.error('Error handling drop:', error);
    }
    
    setDraggedField(null);
  };

  // Remove field from area
  const handleRemoveField = (area, index) => {
    const array = [...pivotConfig[area]];
    array.splice(index, 1);
    const newConfig = {
      ...pivotConfig,
      [area]: array
    };
    setPivotConfig(newConfig);
  };

  // Move field within area
  const handleMoveField = (area, fromIndex, toIndex) => {
    const array = [...pivotConfig[area]];
    const [moved] = array.splice(fromIndex, 1);
    array.splice(toIndex, 0, moved);
    const newConfig = {
      ...pivotConfig,
      [area]: array
    };
    setPivotConfig(newConfig);
  };

  // Render field chip
  const renderFieldChip = (field, area, index, isDraggable = true) => {
    const isValue = area === 'values';
    const displayLabel = isValue && field.aggregation 
      ? `${field.aggregation.charAt(0).toUpperCase() + field.aggregation.slice(1)} of ${field.label}`
      : field.label;
    
    return (
      <div
        key={`${area}-${index}`}
        draggable={isDraggable}
        onDragStart={(e) => handleDragStart(e, field, area, index)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 10px',
          background: isValue ? '#eff6ff' : '#f8fafc',
          border: `1px solid ${isValue ? '#3b82f6' : '#e2e8f0'}`,
          borderRadius: '6px',
          fontSize: '13px',
          cursor: isDraggable ? 'move' : 'default',
          marginBottom: '4px',
          position: 'relative'
        }}
        onMouseEnter={(e) => {
          if (isDraggable) {
            e.currentTarget.style.background = isValue ? '#dbeafe' : '#f1f5f9';
          }
        }}
        onMouseLeave={(e) => {
          if (isDraggable) {
            e.currentTarget.style.background = isValue ? '#eff6ff' : '#f8fafc';
          }
        }}
      >
        <span className="material-icons" style={{ 
          fontSize: '16px', 
          color: isValue ? '#3b82f6' : '#64748b',
          cursor: 'grab'
        }}>drag_indicator</span>
        <span style={{ flex: 1, color: isValue ? '#1e40af' : '#1e293b' }}>{displayLabel}</span>
        {isValue && field.aggregation && (
          <span style={{
            fontSize: '11px',
            color: '#3b82f6',
            background: '#dbeafe',
            padding: '2px 6px',
            borderRadius: '4px',
            fontWeight: '500'
          }}>
            {field.aggregation}
          </span>
        )}
        <button
          onClick={() => handleRemoveField(area, index)}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: '2px',
            display: 'flex',
            alignItems: 'center',
            color: '#94a3b8'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#ef4444';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#94a3b8';
          }}
        >
          <span className="material-icons" style={{ fontSize: '16px' }}>close</span>
        </button>
        {isDraggable && (
          <button
            onClick={() => onFieldConfig(field, area, index)}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '2px',
              display: 'flex',
              alignItems: 'center',
              color: '#94a3b8',
              marginLeft: '4px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#3b82f6';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#94a3b8';
            }}
          >
            <span className="material-icons" style={{ fontSize: '16px' }}>settings</span>
          </button>
        )}
      </div>
    );
  };

  // Render drop zone
  const renderDropZone = (area, label, color) => {
    const fields = pivotConfig[area] || [];
    const isOver = dragOverArea === area;
    
    return (
      <div
        style={{
          marginBottom: '16px',
          padding: '12px',
          background: isOver ? '#f0f9ff' : '#ffffff',
          border: `2px dashed ${isOver ? '#3b82f6' : '#e2e8f0'}`,
          borderRadius: '8px',
          minHeight: '60px',
          transition: 'all 0.2s ease'
        }}
        onDragOver={(e) => handleDragOver(e, area)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, area)}
      >
        <div style={{
          fontSize: '12px',
          fontWeight: '600',
          color: color,
          marginBottom: '8px',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          {label}
        </div>
        {fields.length > 0 ? (
          <div>
            {fields.map((field, index) => renderFieldChip(field, area, index))}
          </div>
        ) : (
          <div style={{
            fontSize: '12px',
            color: '#94a3b8',
            fontStyle: 'italic',
            textAlign: 'center',
            padding: '12px 0'
          }}>
            Drop fields here
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{
      position: 'fixed',
      right: '20px',
      top: '50%',
      transform: 'translateY(-50%)',
      width: '320px',
      maxHeight: '90vh',
      background: 'white',
      borderRadius: '12px',
      boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
      zIndex: 16001,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        padding: '16px',
        borderBottom: '1px solid #e2e8f0',
        background: '#f8fafc'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '12px'
        }}>
          <h3 style={{
            margin: 0,
            fontSize: '16px',
            fontWeight: '600',
            color: '#1e293b'
          }}>
            Pivot Table Fields
          </h3>
        </div>
        <input
          type="text"
          value={fieldSearch}
          onChange={(e) => setFieldSearch(e.target.value)}
          placeholder="Search fields..."
          style={{
            width: '100%',
            padding: '8px 12px',
            border: '1px solid #e2e8f0',
            borderRadius: '6px',
            fontSize: '13px',
            outline: 'none'
          }}
          onFocus={(e) => {
            e.target.style.borderColor = '#3b82f6';
          }}
          onBlur={(e) => {
            e.target.style.borderColor = '#e2e8f0';
          }}
        />
      </div>

      {/* Content */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px'
      }}>
        {/* Available Fields */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{
            fontSize: '12px',
            fontWeight: '600',
            color: '#64748b',
            marginBottom: '8px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            Available Fields
          </div>
          <div style={{
            maxHeight: '150px',
            overflowY: 'auto'
          }}>
            {filteredFields.length > 0 ? (
              filteredFields.map((field, index) => (
                <div
                  key={field.field}
                  draggable
                  onDragStart={(e) => handleDragStart(e, field, 'available', index)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 10px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    fontSize: '13px',
                    cursor: 'move',
                    marginBottom: '4px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#f1f5f9';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#f8fafc';
                  }}
                >
                  <span className="material-icons" style={{ 
                    fontSize: '16px', 
                    color: '#64748b',
                    cursor: 'grab'
                  }}>drag_indicator</span>
                  <span style={{ flex: 1 }}>{field.label}</span>
                  <span style={{
                    fontSize: '10px',
                    color: '#94a3b8',
                    background: '#e2e8f0',
                    padding: '2px 6px',
                    borderRadius: '4px'
                  }}>
                    {field.type}
                  </span>
                </div>
              ))
            ) : (
              <div style={{
                fontSize: '12px',
                color: '#94a3b8',
                fontStyle: 'italic',
                textAlign: 'center',
                padding: '12px 0'
              }}>
                {fieldSearch ? 'No fields found' : 'No fields available'}
              </div>
            )}
          </div>
        </div>

        {/* Drop Zones */}
        {renderDropZone('filters', 'Filters', '#7c3aed')}
        {renderDropZone('rows', 'Rows', '#059669')}
        {renderDropZone('columns', 'Columns', '#dc2626')}
        {renderDropZone('values', 'Values', '#2563eb')}
      </div>
    </div>
  );
};

// Field Configuration Modal Component
const FieldConfigurationModal = ({ fieldConfig, pivotConfig, setPivotConfig, onClose, getFieldValue, salesData }) => {
  const [aggregation, setAggregation] = useState(fieldConfig?.field?.aggregation || 'sum');
  const [format, setFormat] = useState(fieldConfig?.field?.format || 'number');
  const [showSubtotals, setShowSubtotals] = useState(fieldConfig?.field?.showSubtotals !== false);
  const [showGrandTotal, setShowGrandTotal] = useState(fieldConfig?.field?.showGrandTotal !== false);
  const [filterValues, setFilterValues] = useState(fieldConfig?.field?.values || []);
  const [filterSearch, setFilterSearch] = useState('');

  // Get unique values for filter field
  const availableFilterValues = useMemo(() => {
    if (fieldConfig?.area !== 'filters' || !fieldConfig?.field || !salesData || salesData.length === 0) {
      return [];
    }
    const valuesSet = new Set();
    salesData.forEach(item => {
      const val = getFieldValue(item, fieldConfig.field.field);
      if (val != null && val !== '') {
        valuesSet.add(String(val).trim());
      }
    });
    return Array.from(valuesSet).sort();
  }, [fieldConfig, salesData, getFieldValue]);

  const filteredValues = useMemo(() => {
    if (!filterSearch.trim()) return availableFilterValues;
    const searchLower = filterSearch.toLowerCase();
    return availableFilterValues.filter(v => v.toLowerCase().includes(searchLower));
  }, [availableFilterValues, filterSearch]);

  const handleSave = () => {
    if (!fieldConfig) return;

    const updatedConfig = { ...pivotConfig };
    const field = { ...fieldConfig.field };
    
    if (fieldConfig.area === 'values') {
      field.aggregation = aggregation;
      field.format = format;
      field.showSubtotals = showSubtotals;
      field.showGrandTotal = showGrandTotal;
    } else if (fieldConfig.area === 'filters') {
      field.values = filterValues;
    }

    updatedConfig[fieldConfig.area][fieldConfig.index] = field;
    setPivotConfig(updatedConfig);
    onClose();
  };

  if (!fieldConfig) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        zIndex: 17000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        style={{
          background: 'white',
          borderRadius: '12px',
          width: '90%',
          maxWidth: '500px',
          maxHeight: '90vh',
          overflow: 'hidden',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          padding: '20px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#1e293b' }}>
            FIELD SETTINGS: {fieldConfig.field.label}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              color: '#94a3b8'
            }}
          >
            <span className="material-icons">close</span>
          </button>
        </div>

        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px'
        }}>
          {fieldConfig.area === 'values' && (
            <>
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: '500',
                  color: '#475569',
                  marginBottom: '8px'
                }}>
                  Summarize Values By
                </label>
                <select
                  value={aggregation}
                  onChange={(e) => setAggregation(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                >
                  <option value="sum">Sum</option>
                  <option value="count">Count</option>
                  <option value="average">Average</option>
                  <option value="min">Min</option>
                  <option value="max">Max</option>
                  <option value="distinctCount">Distinct Count</option>
                </select>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: '500',
                  color: '#475569',
                  marginBottom: '8px'
                }}>
                  Number Format
                </label>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                >
                  <option value="number">Number</option>
                  <option value="currency">Currency</option>
                  <option value="percentage">Percentage</option>
                </select>
              </div>



            </>
          )}

          {fieldConfig.area === 'filters' && (
            <div>
              <label style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: '500',
                color: '#475569',
                marginBottom: '8px'
              }}>
                Select Values to Filter
              </label>
              <input
                type="text"
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                placeholder="Search values..."
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none',
                  marginBottom: '12px'
                }}
              />
              <div style={{
                maxHeight: '300px',
                overflowY: 'auto',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '8px'
              }}>
                {filteredValues.map(value => (
                  <label
                    key={value}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 8px',
                      cursor: 'pointer',
                      borderRadius: '4px'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#f8fafc';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={filterValues.includes(value)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFilterValues([...filterValues, value]);
                        } else {
                          setFilterValues(filterValues.filter(v => v !== value));
                        }
                      }}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '14px', color: '#1e293b' }}>{value}</span>
                  </label>
                ))}
              </div>
              {filterValues.length > 0 && (
                <div style={{
                  marginTop: '12px',
                  padding: '10px',
                  background: '#eff6ff',
                  borderRadius: '8px',
                  fontSize: '13px',
                  color: '#1e40af'
                }}>
                  {filterValues.length} value(s) selected
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{
          padding: '20px',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          gap: '10px',
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              background: 'white',
              color: '#64748b',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderRadius: '8px',
              background: '#3b82f6',
              color: 'white',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomReports;

