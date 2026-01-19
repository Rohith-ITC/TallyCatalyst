/**
 * Multi-Company Cache Manager
 * Handles loading and merging sales data from multiple Tally companies
 * Useful when users create separate companies for different years (e.g., 2020-2022, 2022-2023, 2023-2025)
 */

import { hybridCache } from './hybridCache';

/**
 * Get user email from sessionStorage
 */
const getUserEmail = () => {
  if (typeof sessionStorage === 'undefined') return 'unknown';
  return sessionStorage.getItem('email') || 'unknown';
};

/**
 * Parse date from API format (DD-MMM-YY) to YYYY-MM-DD
 */
const parseDateFromAPI = (dateString) => {
  if (!dateString) return null;
  
  // Parse date string like "1-Feb-25" or "01-Feb-2025"
  const parts = dateString.split('-');
  if (parts.length !== 3) return null;
  
  const day = parseInt(parts[0], 10);
  const monthName = parts[1];
  const year = parseInt(parts[2], 10);
  
  const monthMap = {
    'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
    'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
    'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
  };
  
  const month = monthMap[monthName] || monthMap[monthName.charAt(0).toUpperCase() + monthName.slice(1).toLowerCase()];
  if (!month) return null;
  
  const fullYear = year < 50 ? 2000 + year : (year < 100 ? 1900 + year : year);
  const formattedDay = String(day).padStart(2, '0');
  
  return `${fullYear}-${month}-${formattedDay}`;
};

/**
 * Parse date from various formats to YYYY-MM-DD
 * Enhanced to handle all possible date formats from different companies
 */
const parseDateFromNewFormat = (dateString) => {
  if (!dateString) return null;
  
  // If already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return dateString;
  }
  
  // Try parsing YYYYMMDD format
  if (/^\d{8}$/.test(dateString)) {
    const year = dateString.substring(0, 4);
    const month = dateString.substring(4, 6);
    const day = dateString.substring(6, 8);
    // Validate date components
    if (parseInt(month) >= 1 && parseInt(month) <= 12 && parseInt(day) >= 1 && parseInt(day) <= 31) {
      return `${year}-${month}-${day}`;
    }
  }
  
  // Try parsing DD-MMM-YY or DD-MMM-YYYY format (case-insensitive)
  if (/^\d{1,2}-[A-Za-z]{3,4}-\d{2,4}$/.test(dateString)) {
    const parts = dateString.split('-');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const monthName = parts[1].toLowerCase();
      const yearStr = parts[2];
      
      const monthNames = ['jan', 'january', 'feb', 'february', 'mar', 'march', 
                          'apr', 'april', 'may', 'jun', 'june', 'jul', 'july', 
                          'aug', 'august', 'sep', 'september', 'oct', 'october', 
                          'nov', 'november', 'dec', 'december'];
      
      let monthIndex = -1;
      for (let i = 0; i < monthNames.length; i += 2) {
        if (monthName === monthNames[i] || monthName === monthNames[i + 1]) {
          monthIndex = Math.floor(i / 2);
          break;
        }
      }
      
      if (monthIndex === -1) {
        // Try abbreviated format (first 3 chars)
        const shortMonthName = monthName.substring(0, 3);
        monthIndex = monthNames.indexOf(shortMonthName);
        if (monthIndex >= 0) monthIndex = Math.floor(monthIndex / 2);
      }
      
      if (monthIndex >= 0) {
        const month = String(monthIndex + 1).padStart(2, '0');
        let year = parseInt(yearStr, 10);
        
        if (yearStr.length === 2) {
          year = year < 50 ? 2000 + year : 1900 + year;
        }
        
        const formattedDay = String(day).padStart(2, '0');
        const formattedMonth = String(monthIndex + 1).padStart(2, '0');
        
        // Validate date
        const dateObj = new Date(year, monthIndex, day);
        if (dateObj.getFullYear() === year && dateObj.getMonth() === monthIndex && dateObj.getDate() === day) {
          return `${year}-${formattedMonth}-${formattedDay}`;
        }
      }
    }
  }
  
  // Try parsing with Date constructor as fallback
  try {
    const dateObj = new Date(dateString);
    if (!isNaN(dateObj.getTime())) {
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  } catch (e) {
    // Ignore parse errors
  }
  
  // Try parseDateFromAPI format
  const apiParsed = parseDateFromAPI(dateString);
  if (apiParsed) return apiParsed;
  
  return null;
};

/**
 * Get field value from voucher, checking all possible field name variations
 * This ensures we check all fields from all companies regardless of naming conventions
 */
const getFieldValue = (voucher, fieldNames) => {
  if (!voucher || !fieldNames || fieldNames.length === 0) return null;
  
  // Check exact match first
  for (const fieldName of fieldNames) {
    if (voucher[fieldName] !== undefined && voucher[fieldName] !== null && voucher[fieldName] !== '') {
      return voucher[fieldName];
    }
  }
  
  // Check case-insensitive match
  const voucherKeys = Object.keys(voucher);
  for (const fieldName of fieldNames) {
    const lowerFieldName = fieldName.toLowerCase();
    const matchingKey = voucherKeys.find(k => k.toLowerCase() === lowerFieldName);
    if (matchingKey && voucher[matchingKey] !== undefined && voucher[matchingKey] !== null && voucher[matchingKey] !== '') {
      return voucher[matchingKey];
    }
  }
  
  return null;
};

/**
 * Normalize voucher fields to ensure consistent field names across all companies
 * This preserves all original fields while adding normalized versions
 */
const normalizeVoucherFields = (voucher) => {
  if (!voucher || typeof voucher !== 'object') return voucher;
  
  const normalized = { ...voucher };
  
  // Normalize date field - check all possible date field names
  const dateFieldNames = [
    'cp_date', 'date', 'DATE', 'CP_DATE', 'voucher_date', 'VOUCHER_DATE',
    'vchdate', 'VCHDATE', 'transaction_date', 'TRANSACTION_DATE'
  ];
  const dateValue = getFieldValue(voucher, dateFieldNames);
  if (dateValue) {
    normalized.date = normalized.cp_date = dateValue;
    // Also preserve original field name
    const originalDateKey = dateFieldNames.find(fn => getFieldValue(voucher, [fn]) !== null);
    if (originalDateKey && !normalized[originalDateKey]) {
      normalized[originalDateKey] = dateValue;
    }
  }
  
  // Normalize amount/total field
  const amountFieldNames = [
    'amount', 'Amount', 'AMOUNT', 'total', 'Total', 'TOTAL',
    'vchamt', 'VCHAMT', 'transaction_amount', 'TRANSACTION_AMOUNT',
    'gross_amount', 'GROSS_AMOUNT', 'net_amount', 'NET_AMOUNT'
  ];
  const amountValue = getFieldValue(voucher, amountFieldNames);
  if (amountValue !== null) {
    normalized.amount = normalized.total = amountValue;
  }
  
  // Normalize customer/party field
  const customerFieldNames = [
    'customer', 'Customer', 'CUSTOMER', 'party', 'Party', 'PARTY',
    'party_name', 'PARTY_NAME', 'ledger_name', 'LEDGER_NAME',
    'party_ledger', 'PARTY_LEDGER', 'customer_name', 'CUSTOMER_NAME'
  ];
  const customerValue = getFieldValue(voucher, customerFieldNames);
  if (customerValue !== null) {
    normalized.customer = normalized.party = customerValue;
  }
  
  // Normalize item/product field
  const itemFieldNames = [
    'item', 'Item', 'ITEM', 'product', 'Product', 'PRODUCT',
    'item_name', 'ITEM_NAME', 'product_name', 'PRODUCT_NAME',
    'stock_item', 'STOCK_ITEM', 'inventory_item', 'INVENTORY_ITEM'
  ];
  const itemValue = getFieldValue(voucher, itemFieldNames);
  if (itemValue !== null) {
    normalized.item = normalized.product = itemValue;
  }
  
  // Normalize voucher number
  const voucherNumberFieldNames = [
    'voucher_number', 'voucherNumber', 'VOUCHER_NUMBER', 'VOUCHERNUMBER',
    'vch_no', 'VCH_NO', 'vchno', 'VCHNO', 'voucher_no', 'VOUCHER_NO'
  ];
  const voucherNumberValue = getFieldValue(voucher, voucherNumberFieldNames);
  if (voucherNumberValue !== null) {
    normalized.voucher_number = normalized.voucherNumber = voucherNumberValue;
  }
  
  // Normalize category/stock group
  const categoryFieldNames = [
    'category', 'Category', 'CATEGORY', 'stock_group', 'STOCK_GROUP',
    'stockgroup', 'STOCKGROUP', 'group', 'Group', 'GROUP',
    'item_group', 'ITEM_GROUP', 'product_category', 'PRODUCT_CATEGORY'
  ];
  const categoryValue = getFieldValue(voucher, categoryFieldNames);
  if (categoryValue !== null) {
    normalized.category = normalized.stock_group = categoryValue;
  }
  
  // Normalize region/state
  const regionFieldNames = [
    'region', 'Region', 'REGION', 'state', 'State', 'STATE',
    'region_name', 'REGION_NAME', 'state_name', 'STATE_NAME',
    'territory', 'Territory', 'TERRITORY'
  ];
  const regionValue = getFieldValue(voucher, regionFieldNames);
  if (regionValue !== null) {
    normalized.region = normalized.state = regionValue;
  }
  
  // Normalize country
  const countryFieldNames = [
    'country', 'Country', 'COUNTRY', 'country_name', 'COUNTRY_NAME',
    'nation', 'Nation', 'NATION'
  ];
  const countryValue = getFieldValue(voucher, countryFieldNames);
  if (countryValue !== null) {
    normalized.country = countryValue;
  }
  
  // Normalize quantity
  const quantityFieldNames = [
    'quantity', 'Quantity', 'QUANTITY', 'qty', 'QTY', 'qnty', 'QNTY',
    'amount_quantity', 'AMOUNT_QUANTITY', 'units', 'UNITS'
  ];
  const quantityValue = getFieldValue(voucher, quantityFieldNames);
  if (quantityValue !== null) {
    normalized.quantity = normalized.qty = quantityValue;
  }
  
  // Normalize profit
  const profitFieldNames = [
    'profit', 'Profit', 'PROFIT', 'profit_amount', 'PROFIT_AMOUNT',
    'margin', 'Margin', 'MARGIN', 'gross_profit', 'GROSS_PROFIT'
  ];
  const profitValue = getFieldValue(voucher, profitFieldNames);
  if (profitValue !== null) {
    normalized.profit = profitValue;
  }
  
  // Preserve all original fields (don't delete anything)
  // This ensures no data is lost
  return normalized;
};

/**
 * Filter vouchers by date range with enhanced date parsing
 */
const filterVouchersByDateRange = (vouchers, startDate, endDate) => {
  if (!vouchers || vouchers.length === 0) return [];
  
  return vouchers.filter(voucher => {
    // Check all possible date field variations
    const dateFieldNames = [
      'cp_date', 'date', 'DATE', 'CP_DATE', 'voucher_date', 'VOUCHER_DATE',
      'vchdate', 'VCHDATE', 'transaction_date', 'TRANSACTION_DATE'
    ];
    
    const voucherDate = getFieldValue(voucher, dateFieldNames);
    if (!voucherDate) return false;
    
    // Try multiple parsing methods
    let dateStr = parseDateFromNewFormat(voucherDate);
    if (!dateStr) {
      dateStr = parseDateFromAPI(voucherDate);
    }
    
    // If still not parsed, try Date constructor
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      try {
        const dateObj = new Date(voucherDate);
        if (!isNaN(dateObj.getTime())) {
          const year = dateObj.getFullYear();
          const month = String(dateObj.getMonth() + 1).padStart(2, '0');
          const day = String(dateObj.getDate()).padStart(2, '0');
          dateStr = `${year}-${month}-${day}`;
        }
      } catch (e) {
        // If parsing fails, exclude this voucher
        return false;
      }
    }
    
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return false;
    }
    
    return dateStr >= startDate && dateStr <= endDate;
  });
};

/**
 * Create a unique voucher ID for deduplication
 * Enhanced to check all possible field variations
 */
const getVoucherId = (voucher) => {
  // Use voucher number if available (check all variations)
  const voucherNumberFieldNames = [
    'voucher_number', 'voucherNumber', 'VOUCHER_NUMBER', 'VOUCHERNUMBER',
    'vch_no', 'VCH_NO', 'vchno', 'VCHNO', 'voucher_no', 'VOUCHER_NO', 'id', 'ID'
  ];
  const voucherNumber = getFieldValue(voucher, voucherNumberFieldNames);
  if (voucherNumber) {
    return String(voucherNumber);
  }
  
  // Fallback to composite key using normalized field access
  const dateFieldNames = [
    'cp_date', 'date', 'DATE', 'CP_DATE', 'voucher_date', 'VOUCHER_DATE',
    'vchdate', 'VCHDATE', 'transaction_date', 'TRANSACTION_DATE'
  ];
  const date = getFieldValue(voucher, dateFieldNames) || '';
  
  const partyFieldNames = [
    'party', 'Party', 'PARTY', 'customer', 'Customer', 'CUSTOMER',
    'party_name', 'PARTY_NAME', 'customer_name', 'CUSTOMER_NAME'
  ];
  const party = getFieldValue(voucher, partyFieldNames) || '';
  
  const amountFieldNames = [
    'amount', 'Amount', 'AMOUNT', 'total', 'Total', 'TOTAL',
    'vchamt', 'VCHAMT', 'transaction_amount', 'TRANSACTION_AMOUNT'
  ];
  const amount = getFieldValue(voucher, amountFieldNames) || '';
  
  return `${date}_${party}_${amount}`;
};

/**
 * Load sales data from multiple companies and merge them
 * 
 * @param {Array} companies - Array of company info objects { guid, tallyloc_id, company }
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @param {Function} processVouchersWithUdf - Optional function to process vouchers with UDF data
 * @returns {Promise<Object>} Merged data with vouchers and metadata
 */
export const loadMultiCompanySalesData = async (
  companies,
  startDate,
  endDate,
  processVouchersWithUdf = null
) => {
  if (!companies || companies.length === 0) {
    return { data: { vouchers: [] }, cacheTimestamp: null };
  }

  const userEmail = getUserEmail();
  const allVouchers = [];
  const voucherIds = new Set(); // For deduplication
  let earliestTimestamp = null;

  console.log(`📊 Loading data from ${companies.length} company/companies for date range ${startDate} to ${endDate}`);

  // Load data from each company
  for (const companyInfo of companies) {
    try {
      console.log(`📋 Loading data from company: ${companyInfo.company} (${companyInfo.guid})`);
      
      // Try to get complete cached data first
      const completeCache = await hybridCache.getCompleteSalesData(companyInfo, userEmail);
      
      if (completeCache && completeCache.data && completeCache.data.vouchers) {
        console.log(`✅ Found complete cache for ${companyInfo.company}: ${completeCache.data.vouchers.length} vouchers`);
        
        // Filter vouchers by date range
        const filteredVouchers = filterVouchersByDateRange(
          completeCache.data.vouchers,
          startDate,
          endDate
        );
        
        console.log(`📅 Filtered ${filteredVouchers.length} vouchers from ${companyInfo.company} for date range`);
        
        // Normalize and tag each voucher with source company info
        // This ensures all fields are properly parsed and normalized across companies
        const taggedVouchers = filteredVouchers.map((voucher, index) => {
          try {
            // First normalize all fields to ensure consistent field names
            const normalized = normalizeVoucherFields(voucher);
            
            // Log first voucher for debugging field parsing
            if (index === 0) {
              console.log(`📋 Sample voucher fields from ${companyInfo.company}:`, {
                originalFields: Object.keys(voucher).slice(0, 10), // First 10 fields
                normalizedFields: Object.keys(normalized).slice(0, 10),
                hasDate: !!getFieldValue(normalized, ['date', 'cp_date', 'DATE', 'CP_DATE']),
                hasAmount: !!getFieldValue(normalized, ['amount', 'total', 'AMOUNT', 'TOTAL']),
                hasCustomer: !!getFieldValue(normalized, ['customer', 'party', 'CUSTOMER', 'PARTY'])
              });
            }
            
            // Then add source company info
            return {
              ...normalized, // Preserve all original fields plus normalized ones
              sourceCompany: companyInfo.company,
              sourceCompanyGuid: companyInfo.guid,
              sourceCompanyTallylocId: companyInfo.tallyloc_id,
              // Preserve original voucher ID for deduplication
              _originalVoucherId: getVoucherId(normalized)
            };
          } catch (error) {
            console.error(`❌ Error processing voucher ${index} from ${companyInfo.company}:`, error);
            // Return voucher with minimal processing if normalization fails
            return {
              ...voucher,
              sourceCompany: companyInfo.company,
              sourceCompanyGuid: companyInfo.guid,
              sourceCompanyTallylocId: companyInfo.tallyloc_id,
              _originalVoucherId: getVoucherId(voucher),
              _processingError: true
            };
          }
        });
        
        // Add vouchers with deduplication (if date ranges overlap between companies)
        for (const voucher of taggedVouchers) {
          const voucherId = getVoucherId(voucher);
          
          // Check if we already have this voucher from another company
          if (!voucherIds.has(voucherId)) {
            voucherIds.add(voucherId);
            allVouchers.push(voucher);
          } else {
            // If duplicate found, prefer the one from the company that was selected first
            // or the one with more complete data
            console.log(`⚠️ Duplicate voucher found: ${voucherId} (from ${companyInfo.company})`);
          }
        }
        
        // Track earliest cache timestamp
        if (completeCache.metadata?.timestamp) {
          const cacheTimestamp = completeCache.metadata.timestamp;
          if (!earliestTimestamp || cacheTimestamp < earliestTimestamp) {
            earliestTimestamp = cacheTimestamp;
          }
        }
      } else {
        console.log(`⚠️ No complete cache found for ${companyInfo.company}`);
      }
    } catch (error) {
      console.error(`❌ Error loading data from company ${companyInfo.company}:`, error);
      // Continue with other companies even if one fails
    }
  }

  // Validate and ensure all entries are properly parsed
  const validatedVouchers = allVouchers.map((voucher, index) => {
    try {
      // Ensure date is properly parsed
      const dateFieldNames = [
        'cp_date', 'date', 'DATE', 'CP_DATE', 'voucher_date', 'VOUCHER_DATE',
        'vchdate', 'VCHDATE', 'transaction_date', 'TRANSACTION_DATE'
      ];
      const dateValue = getFieldValue(voucher, dateFieldNames);
      
      if (dateValue) {
        let parsedDate = parseDateFromNewFormat(dateValue);
        if (!parsedDate) {
          parsedDate = parseDateFromAPI(dateValue);
        }
        if (!parsedDate && dateValue) {
          try {
            const dateObj = new Date(dateValue);
            if (!isNaN(dateObj.getTime())) {
              const year = dateObj.getFullYear();
              const month = String(dateObj.getMonth() + 1).padStart(2, '0');
              const day = String(dateObj.getDate()).padStart(2, '0');
              parsedDate = `${year}-${month}-${day}`;
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
        
        // Add normalized date if parsed successfully
        if (parsedDate && /^\d{4}-\d{2}-\d{2}$/.test(parsedDate)) {
          voucher.date = voucher.cp_date = parsedDate;
          // Also preserve original date field
          const originalDateKey = dateFieldNames.find(fn => getFieldValue(voucher, [fn]) !== null);
          if (originalDateKey && voucher[originalDateKey] !== parsedDate) {
            // Keep original value in original field, normalized value in standard fields
          }
        }
      }
      
      // Ensure all numeric fields are properly parsed
      const amountFieldNames = [
        'amount', 'Amount', 'AMOUNT', 'total', 'Total', 'TOTAL',
        'vchamt', 'VCHAMT', 'transaction_amount', 'TRANSACTION_AMOUNT'
      ];
      const amountValue = getFieldValue(voucher, amountFieldNames);
      if (amountValue !== null && amountValue !== undefined && amountValue !== '') {
        const parsedAmount = typeof amountValue === 'number' ? amountValue : parseFloat(String(amountValue));
        if (!isNaN(parsedAmount)) {
          voucher.amount = voucher.total = parsedAmount;
        }
      }
      
      // Ensure quantity is properly parsed
      const quantityFieldNames = [
        'quantity', 'Quantity', 'QUANTITY', 'qty', 'QTY', 'qnty', 'QNTY'
      ];
      const quantityValue = getFieldValue(voucher, quantityFieldNames);
      if (quantityValue !== null && quantityValue !== undefined && quantityValue !== '') {
        const parsedQuantity = typeof quantityValue === 'number' ? quantityValue : parseFloat(String(quantityValue));
        if (!isNaN(parsedQuantity)) {
          voucher.quantity = voucher.qty = parsedQuantity;
        }
      }
      
      // Ensure profit is properly parsed
      const profitFieldNames = [
        'profit', 'Profit', 'PROFIT', 'profit_amount', 'PROFIT_AMOUNT'
      ];
      const profitValue = getFieldValue(voucher, profitFieldNames);
      if (profitValue !== null && profitValue !== undefined && profitValue !== '') {
        const parsedProfit = typeof profitValue === 'number' ? profitValue : parseFloat(String(profitValue));
        if (!isNaN(parsedProfit)) {
          voucher.profit = parsedProfit;
        }
      }
      
      return voucher;
    } catch (error) {
      console.warn(`⚠️ Error validating voucher at index ${index}:`, error);
      // Return voucher as-is if validation fails
      return voucher;
    }
  });

  // Process vouchers with UDF if function provided
  let processedVouchers = validatedVouchers;
  if (processVouchersWithUdf && typeof processVouchersWithUdf === 'function') {
    try {
      processedVouchers = processVouchersWithUdf(validatedVouchers);
      console.log(`✅ Processed ${processedVouchers.length} vouchers with UDF`);
    } catch (error) {
      console.warn('⚠️ Error processing vouchers with UDF:', error);
      // Use validated vouchers if UDF processing fails
      processedVouchers = validatedVouchers;
    }
  }

  // Log summary statistics
  const companyStats = {};
  companies.forEach(company => {
    const companyVouchers = processedVouchers.filter(v => 
      v.sourceCompanyGuid === company.guid && v.sourceCompanyTallylocId === company.tallyloc_id
    );
    companyStats[company.company] = companyVouchers.length;
  });

  console.log(`✅ Merged ${processedVouchers.length} vouchers from ${companies.length} company/companies:`, companyStats);
  
  // Validate that all entries have required fields
  const invalidVouchers = processedVouchers.filter(v => {
    const dateFieldNames = ['cp_date', 'date', 'DATE', 'CP_DATE'];
    return !getFieldValue(v, dateFieldNames);
  });
  
  if (invalidVouchers.length > 0) {
    console.warn(`⚠️ Found ${invalidVouchers.length} vouchers without valid date fields`);
  }

  return {
    data: {
      vouchers: processedVouchers
    },
    cacheTimestamp: earliestTimestamp,
    sourceCompanies: companies.map(c => c.company),
    statistics: {
      totalVouchers: processedVouchers.length,
      byCompany: companyStats,
      invalidVouchers: invalidVouchers.length
    }
  };
};

/**
 * Get company info from sessionStorage
 * Supports both single and multiple companies
 */
export const getSelectedCompanies = () => {
  if (typeof sessionStorage === 'undefined') return [];
  
  const allConnections = JSON.parse(sessionStorage.getItem('allConnections') || '[]');
  const selectedCompanyGuids = JSON.parse(sessionStorage.getItem('selectedCompanyGuids') || '[]');
  const selectedCompanyTallylocIds = JSON.parse(sessionStorage.getItem('selectedCompanyTallylocIds') || '[]');
  
  // If multi-company selection is active, use it
  if (selectedCompanyGuids.length > 0) {
    const selectedCompanies = allConnections.filter(c => {
      const guidMatch = selectedCompanyGuids.includes(c.guid);
      const tallylocMatch = selectedCompanyTallylocIds.length === 0 || 
                           selectedCompanyTallylocIds.includes(String(c.tallyloc_id));
      return guidMatch && tallylocMatch;
    });
    
    if (selectedCompanies.length > 0) {
      return selectedCompanies;
    }
  }
  
  // Fallback to single company selection (legacy behavior)
  const selectedCompanyGuid = sessionStorage.getItem('selectedCompanyGuid') || '';
  const selectedCompanyTallylocId = sessionStorage.getItem('selectedCompanyTallylocId') || '';
  
  if (!selectedCompanyGuid) {
    return [];
  }
  
  const company = allConnections.find(c =>
    c.guid === selectedCompanyGuid &&
    (selectedCompanyTallylocId ? String(c.tallyloc_id) === String(selectedCompanyTallylocId) : true)
  );
  
  return company ? [company] : [];
};

/**
 * Set selected companies in sessionStorage
 */
export const setSelectedCompanies = (companies) => {
  if (typeof sessionStorage === 'undefined') return;
  
  if (!companies || companies.length === 0) {
    // Clear multi-company selection, fallback to single company
    sessionStorage.removeItem('selectedCompanyGuids');
    sessionStorage.removeItem('selectedCompanyTallylocIds');
    return;
  }
  
  // Store arrays of selected company identifiers
  const guids = companies.map(c => c.guid);
  const tallylocIds = companies.map(c => String(c.tallyloc_id));
  
  sessionStorage.setItem('selectedCompanyGuids', JSON.stringify(guids));
  sessionStorage.setItem('selectedCompanyTallylocIds', JSON.stringify(tallylocIds));
  
  // Also set the first company as the primary selection (for backward compatibility)
  if (companies.length > 0) {
    sessionStorage.setItem('selectedCompanyGuid', companies[0].guid);
    sessionStorage.setItem('selectedCompanyTallylocId', String(companies[0].tallyloc_id));
  }
};

/**
 * Get all available companies from sessionStorage
 */
export const getAllAvailableCompanies = () => {
  if (typeof sessionStorage === 'undefined') return [];
  
  try {
    const allConnections = JSON.parse(sessionStorage.getItem('allConnections') || '[]');
    // Filter only connected companies
    return allConnections.filter(c => c.status === 'Connected');
  } catch (error) {
    console.error('Error getting available companies:', error);
    return [];
  }
};

