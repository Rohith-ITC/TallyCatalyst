/**
 * Hierarchical Field Extractor Utility
 * Extracts all fields from nested voucher structures in cache data
 * Supports hierarchical field paths with dot notation
 */

// Hierarchy mapping for field grouping
export const HIERARCHY_MAP = {
  'voucher': 'Voucher Fields',
  'ledgerentries': 'Ledger Entries',
  'billallocations': 'Bill Allocations',
  'allinventoryentries': 'Inventory Entries',
  'inventoryentries': 'Inventory Entries',
  'batchallocation': 'Batch Allocations',
  'accountingallocation': 'Accounting Allocations',
  'address': 'Address'
};

// Fields that should always be categories (even if numeric)
const FORCE_CATEGORY_FIELDS = [
  // Date fields
  'date', 'cp_date', 'cpdate', 'transaction_date', 'voucher_date', 'bill_date',
  // Location fields
  'pincode', 'pin_code', 'pin', 'zipcode', 'zip',
  // Voucher/ID fields
  'vouchernumber', 'vchno', 'voucher_number', 'masterid', 'alterid',
  'partyledgernameid', 'partyid', 'stockitemnameid', 'itemid',
  'partygstin', 'gstin', 'gst_no', 'pan',
  // Contact fields
  'phone', 'mobile', 'telephone', 'contact',
  // Reference fields
  'reference', 'ref_no', 'invoice_no', 'bill_no',
  // Address fields
  'address', 'basicbuyeraddress', 'buyer_address',
  // Other category fields
  'reservedname', 'vchtype', 'vouchertypename', 'issales'
];

/**
 * Determines if a field should be treated as a value (numeric) or category
 */
function determineFieldType(value, fieldName) {
  const lowerFieldName = fieldName.toLowerCase();
  
  // Check if field should be forced to category
  const shouldBeCategory = FORCE_CATEGORY_FIELDS.some(cat => 
    lowerFieldName === cat || lowerFieldName.includes(cat) || cat.includes(lowerFieldName)
  );
  
  if (shouldBeCategory) {
    return 'category';
  }
  
  // Check value type
  if (value === null || value === undefined || value === '') {
    return null; // Cannot determine type
  }
  
  if (typeof value === 'number') {
    return 'value';
  }
  
  if (typeof value === 'string') {
    // Check if it's a numeric string
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && isFinite(numValue)) {
      return 'value';
    }
    return 'category';
  }
  
  if (typeof value === 'boolean') {
    return 'category';
  }
  
  if (Array.isArray(value)) {
    return 'category'; // Arrays are typically categories (lists of items)
  }
  
  return 'category'; // Default to category
}

/**
 * Gets default aggregation for a numeric field
 */
function getDefaultAggregation(fieldName) {
  const lowerFieldName = fieldName.toLowerCase();
  if (lowerFieldName.includes('rate') || lowerFieldName.includes('price') || 
      lowerFieldName.includes('margin') || lowerFieldName.includes('percent')) {
    return 'average';
  }
  return 'sum';
}

/**
 * Recursively traverses an object to extract all fields
 */
function traverseObject(obj, path = '', fields = new Map(), hierarchy = {}, maxDepth = 5, currentDepth = 0) {
  if (!obj || currentDepth >= maxDepth) {
    return { fields, hierarchy };
  }
  
  // Handle arrays - traverse first item to get structure
  if (Array.isArray(obj)) {
    if (obj.length > 0) {
      // Get the array name from path
      const arrayName = path.split('.').pop() || 'array';
      const itemPath = path; // Keep same path for array items
      
      // Traverse first item to understand structure
      traverseObject(obj[0], itemPath, fields, hierarchy, maxDepth, currentDepth);
      
      // Mark this as an array in hierarchy
      if (!hierarchy[arrayName]) {
        hierarchy[arrayName] = {
          name: arrayName,
          path: path,
          isArray: true,
          fields: []
        };
      }
    }
    return { fields, hierarchy };
  }
  
  // Handle objects
  if (typeof obj === 'object' && obj !== null) {
    Object.keys(obj).forEach(key => {
      const value = obj[key];
      const fieldPath = path ? `${path}.${key}` : key;
      const lowerKey = key.toLowerCase();
      
      // Skip internal/metadata fields
      if (key.startsWith('_') || key.startsWith('$')) {
        return;
      }
      
      // Determine field type
      const fieldType = determineFieldType(value, fieldPath);
      
      if (fieldType) {
        // Create field entry
        const fieldKey = fieldPath.toLowerCase();
        if (!fields.has(fieldKey)) {
          const field = {
            value: fieldPath,
            label: formatFieldLabel(fieldPath),
            type: fieldType,
            path: path,
            hierarchy: getHierarchyLevel(fieldPath)
          };
          
          // Add default aggregation for value fields
          if (fieldType === 'value') {
            field.aggregation = getDefaultAggregation(fieldPath);
          }
          
          fields.set(fieldKey, field);
          
          // Update hierarchy
          const hierarchyLevel = getHierarchyLevel(fieldPath);
          if (!hierarchy[hierarchyLevel]) {
            hierarchy[hierarchyLevel] = {
              name: hierarchyLevel,
              fields: []
            };
          }
          hierarchy[hierarchyLevel].fields.push(field);
        }
      }
      
      // Recursively traverse nested objects and arrays
      if (value !== null && value !== undefined) {
        if (Array.isArray(value)) {
          if (value.length > 0 && typeof value[0] === 'object') {
            traverseObject(value[0], fieldPath, fields, hierarchy, maxDepth, currentDepth + 1);
          }
        } else if (typeof value === 'object') {
          traverseObject(value, fieldPath, fields, hierarchy, maxDepth, currentDepth + 1);
        }
      }
    });
  }
  
  return { fields, hierarchy };
}

/**
 * Gets hierarchy level from field path
 */
function getHierarchyLevel(fieldPath) {
  const parts = fieldPath.split('.');
  const firstPart = parts[0].toLowerCase();
  
  // Map to hierarchy names
  if (firstPart === 'ledgerentries' || firstPart === 'allledgerentries') {
    if (parts.length > 1 && parts[1].toLowerCase() === 'billallocations') {
      return 'billallocations';
    }
    return 'ledgerentries';
  }
  
  if (firstPart === 'allinventoryentries' || firstPart === 'inventoryentries') {
    if (parts.length > 1) {
      const secondPart = parts[1].toLowerCase();
      if (secondPart === 'batchallocation') {
        return 'batchallocation';
      }
      if (secondPart === 'accountingallocation') {
        return 'accountingallocation';
      }
    }
    return 'allinventoryentries';
  }
  
  if (firstPart === 'address') {
    return 'address';
  }
  
  // Default to voucher level
  return 'voucher';
}

/**
 * Formats field label from path
 */
function formatFieldLabel(fieldPath) {
  const parts = fieldPath.split('.');
  const lastPart = parts[parts.length - 1];
  
  // Convert camelCase/snake_case to Title Case
  const formatted = lastPart
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase())
    .trim();
  
  // If nested, show hierarchy
  if (parts.length > 1) {
    const hierarchyName = HIERARCHY_MAP[getHierarchyLevel(fieldPath)] || getHierarchyLevel(fieldPath);
    return `${hierarchyName} → ${formatted}`;
  }
  
  return formatted;
}

/**
 * Groups fields by hierarchy level
 */
function groupFieldsByHierarchy(fields) {
  const grouped = {};
  
  fields.forEach(field => {
    const level = field.hierarchy || 'voucher';
    if (!grouped[level]) {
      grouped[level] = {
        name: HIERARCHY_MAP[level] || level,
        level: level,
        fields: []
      };
    }
    grouped[level].fields.push(field);
  });
  
  // Sort fields within each group
  Object.keys(grouped).forEach(level => {
    grouped[level].fields.sort((a, b) => a.label.localeCompare(b.label));
  });
  
  return grouped;
}

/**
 * Main function to extract all fields from cache data
 * @param {Array} cacheData - Array of voucher objects from cache
 * @returns {Object} - { fields: Array, hierarchy: Object, grouped: Object }
 */
export function extractAllFieldsFromCache(cacheData) {
  if (!cacheData || !Array.isArray(cacheData) || cacheData.length === 0) {
    return {
      fields: [],
      hierarchy: {},
      grouped: {}
    };
  }
  
  const fields = new Map();
  const hierarchy = {};
  
  // Process first few records to extract field structure
  // Use multiple records to catch all possible fields
  const sampleSize = Math.min(10, cacheData.length);
  for (let i = 0; i < sampleSize; i++) {
    const record = cacheData[i];
    if (record) {
      traverseObject(record, '', fields, hierarchy);
    }
  }
  
  // Convert Map to Array
  const fieldsArray = Array.from(fields.values());
  
  // Sort fields
  fieldsArray.sort((a, b) => {
    // First sort by hierarchy level
    const hierarchyOrder = ['voucher', 'ledgerentries', 'billallocations', 
                           'allinventoryentries', 'batchallocation', 'accountingallocation', 'address'];
    const aOrder = hierarchyOrder.indexOf(a.hierarchy) >= 0 ? hierarchyOrder.indexOf(a.hierarchy) : 999;
    const bOrder = hierarchyOrder.indexOf(b.hierarchy) >= 0 ? hierarchyOrder.indexOf(b.hierarchy) : 999;
    
    if (aOrder !== bOrder) {
      return aOrder - bOrder;
    }
    
    // Then sort by label
    return a.label.localeCompare(b.label);
  });
  
  // Group by hierarchy
  const grouped = groupFieldsByHierarchy(fieldsArray);
  
  return {
    fields: fieldsArray,
    hierarchy: hierarchy,
    grouped: grouped
  };
}

/**
 * Gets field value from nested object using dot notation path
 * Handles nested arrays by returning the first value found
 * @param {Object} obj - Object to extract value from
 * @param {string} fieldPath - Dot notation path (e.g., "ledgerentries.billallocations.billname")
 * @returns {any} - Field value or null
 */
export function getNestedFieldValue(obj, fieldPath) {
  if (!obj || !fieldPath) {
    return null;
  }
  
  const parts = fieldPath.split('.');
  
  // Recursive function to find first value in nested structures
  function findValue(currentObj, pathParts, currentIndex = 0) {
    if (!currentObj || currentIndex >= pathParts.length) {
      return null;
    }
    
    const part = pathParts[currentIndex];
    const isLastPart = currentIndex === pathParts.length - 1;
    
    // Try multiple case variations
    const value = currentObj[part] || 
                  currentObj[part.toLowerCase()] || 
                  currentObj[part.toUpperCase()] ||
                  currentObj[toCamelCase(part)] ||
                  currentObj[toPascalCase(part)];
    
    if (value === undefined || value === null) {
      return null;
    }
    
    // If this is the last part, return the value
    if (isLastPart) {
      if (Array.isArray(value)) {
        // If it's an array, return first item
        return value.length > 0 ? value[0] : null;
      }
      return value;
    }
    
    // Continue traversing
    if (Array.isArray(value)) {
      // If current value is an array, try first item
      if (value.length > 0 && value[0] && typeof value[0] === 'object') {
        return findValue(value[0], pathParts, currentIndex + 1);
      }
      return null;
    } else if (value && typeof value === 'object') {
      // If it's an object, continue traversing
      return findValue(value, pathParts, currentIndex + 1);
    }
    
    return null;
  }
  
  return findValue(obj, parts);
}

/**
 * Gets all values from nested array field (handles nested arrays recursively)
 * @param {Object} obj - Object to extract from
 * @param {string} fieldPath - Dot notation path (e.g., "ledgerentries.billallocations.billname")
 * @returns {Array} - Array of values
 */
export function getNestedFieldValues(obj, fieldPath) {
  if (!obj || !fieldPath) {
    return [];
  }
  
  const parts = fieldPath.split('.');
  
  // Recursive function to extract values from nested structures
  function extractValues(currentObj, pathParts, currentIndex = 0) {
    if (!currentObj || currentIndex >= pathParts.length) {
      return [];
    }
    
    const part = pathParts[currentIndex];
    const isLastPart = currentIndex === pathParts.length - 1;
    
    // Try multiple case variations
    const value = currentObj[part] || 
                  currentObj[part.toLowerCase()] || 
                  currentObj[part.toUpperCase()] ||
                  currentObj[toCamelCase(part)] ||
                  currentObj[toPascalCase(part)];
    
    if (value === undefined || value === null) {
      return [];
    }
    
    // If this is the last part, extract the field value
    if (isLastPart) {
      if (Array.isArray(value)) {
        // If it's an array, return all values
        return value.filter(v => v !== null && v !== undefined);
      }
      // If it's a single value, return as array
      return [value];
    }
    
    // Continue traversing
    const results = [];
    
    if (Array.isArray(value)) {
      // If current value is an array, recursively process each item
      value.forEach(item => {
        if (item && typeof item === 'object') {
          const nestedValues = extractValues(item, pathParts, currentIndex + 1);
          results.push(...nestedValues);
        }
      });
    } else if (value && typeof value === 'object') {
      // If it's an object, continue traversing
      const nestedValues = extractValues(value, pathParts, currentIndex + 1);
      results.push(...nestedValues);
    }
    
    return results;
  }
  
  return extractValues(obj, parts).filter(v => v !== null && v !== undefined);
}

// Helper functions for case conversion
function toCamelCase(str) {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

function toPascalCase(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

