/**
 * UDF (User Defined Fields) Formula Evaluator
 * Evaluates Tally formulas against cached voucher data
 * Supports formulas like: $Parent:Ledger:$PartyLedgerName
 */

export class UdfEvaluator {
  /**
   * Evaluates a formula path like "$Parent:Ledger:$PartyLedgerName"
   * @param {Object} voucher - The voucher object from cache
   * @param {string} formula - Tally formula (e.g., "$Parent:Ledger:$PartyLedgerName")
   * @param {string} context - Current context ('voucher', 'ledgerentries', etc.)
   * @param {Object} entry - Current entry if evaluating within an array
   * @returns {any} - Evaluated value
   */
  static evaluateFormula(voucher, formula, context = 'voucher', entry = null) {
    if (!formula || typeof formula !== 'string') return null;
    
    // Remove $ prefix if present
    const cleanFormula = formula.trim().replace(/^\$/, '');
    
    // Split by : to get path segments
    const pathSegments = cleanFormula.split(':').map(s => s.trim()).filter(s => s);
    
    if (pathSegments.length === 0) return null;
    
    // Start from appropriate context
    let current = entry || voucher;
    
    for (let i = 0; i < pathSegments.length; i++) {
      const segment = pathSegments[i];
      
      if (!current) return null;
      
      // Handle special keywords
      if (segment === 'Parent' || segment === 'parent') {
        // Navigate to parent object
        if (context === 'ledgerentries' && entry) {
          current = voucher;
        } else if (context === 'inventoryentries' && entry) {
          current = voucher;
        } else if (context === 'billallocations' && entry) {
          current = voucher;
        } else if (context === 'batchallocations' && entry) {
          current = voucher;
        } else {
          // Try to find parent reference
          current = current.parent || current.Parent || current.PARENT || voucher;
        }
      } else {
        // Navigate property path - try multiple case variations
        const nextValue = 
          current[segment] || 
          current[segment.toLowerCase()] || 
          current[segment.toUpperCase()] ||
          current[this.camelCase(segment)] ||
          current[this.pascalCase(segment)] ||
          current[this.snakeCase(segment)];
        
        if (nextValue !== undefined) {
          current = nextValue;
        } else {
          // Try with common prefixes/suffixes
          const variations = [
            segment,
            segment.toLowerCase(),
            segment.toUpperCase(),
            this.camelCase(segment),
            this.pascalCase(segment),
            this.snakeCase(segment),
            `$${segment}`,
            `$${segment.toLowerCase()}`,
            `$${segment.toUpperCase()}`
          ];
          
          let found = false;
          for (const variant of variations) {
            if (current[variant] !== undefined) {
              current = current[variant];
              found = true;
              break;
            }
          }
          
          if (!found) {
            return null;
          }
        }
      }
    }
    
    return current !== undefined && current !== null ? current : null;
  }
  
  /**
   * Extracts UDF fields from a voucher based on configuration
   * @param {Object} voucher - Voucher from cache
   * @param {Object} udfConfig - UDF configuration from permission_value_json
   * @param {Object} selectedFields - User-selected fields to include
   * @returns {Object} - Extracted UDF data
   */
  static extractUdfFields(voucher, udfConfig, selectedFields = null) {
    if (!udfConfig || !voucher) return {};
    
    const extracted = {};
    
    // Process each table (vouchers, ledgerentries, etc.)
    Object.keys(udfConfig).forEach(tableName => {
      const tableConfig = udfConfig[tableName];
      if (!Array.isArray(tableConfig) || tableConfig.length === 0) return;
      
      const configObj = tableConfig[0];
      
      Object.keys(configObj).forEach(fieldName => {
        const formula = configObj[fieldName];
        
        // Check if user selected this field
        if (selectedFields && Object.keys(selectedFields).length > 0) {
          // If selectedFields has entries, only include selected ones
          if (!selectedFields[fieldName] && !this.isAggregateFieldSelected(fieldName, selectedFields)) {
            return; // Skip if not selected
          }
        }
        
        if (Array.isArray(formula)) {
          // Aggregate - extract array data
          extracted[fieldName] = this.extractAggregate(
            voucher, 
            fieldName, 
            formula[0], 
            tableName,
            selectedFields
          );
        } else if (typeof formula === 'string') {
          // Simple field
          const context = this.getContextFromTableName(tableName);
          const value = this.evaluateFormula(voucher, formula, context);
          if (value !== null && value !== undefined) {
            extracted[fieldName] = value;
          }
        }
      });
    });
    
    return extracted;
  }
  
  /**
   * Checks if any field in an aggregate is selected
   */
  static isAggregateFieldSelected(aggregateName, selectedFields) {
    if (!selectedFields) return false;
    return Object.keys(selectedFields).some(key => 
      key.startsWith(`${aggregateName}.`) && selectedFields[key]
    );
  }
  
  /**
   * Extracts aggregate array data
   * @param {Object} voucher - Voucher object
   * @param {string} aggregateName - Name of the aggregate
   * @param {Object} fieldConfigs - Field configurations for aggregate
   * @param {string} tableName - Source table name
   * @param {Object} selectedFields - User-selected fields
   * @returns {Array} - Array of extracted objects
   */
  static extractAggregate(voucher, aggregateName, fieldConfigs, tableName, selectedFields = null) {
    // Map table names to voucher properties
    const tableToProperty = {
      'ledgerentries': ['allledgerentries', 'ledgerentries', 'LEDGERENTRIES', 'AllLedgerEntries'],
      'inventoryentries': ['allinventoryentries', 'inventoryentries', 'INVENTORYENTRIES', 'AllInventoryEntries'],
      'billallocations': ['billallocations', 'BILLALLOCATIONS', 'BillAllocations', 'allbillallocations'],
      'batchallocations': ['batchallocations', 'BATCHALLOCATIONS', 'BatchAllocations', 'allbatchallocations']
    };
    
    const propertyNames = tableToProperty[tableName] || [aggregateName.toLowerCase()];
    
    // Get the array from voucher - try multiple property name variations
    let entries = null;
    for (const propName of propertyNames) {
      entries = voucher[propName];
      if (entries !== undefined && entries !== null) {
        break;
      }
    }
    
    if (!entries) {
      // Try direct aggregate name
      entries = voucher[aggregateName] || voucher[aggregateName.toLowerCase()] || voucher[aggregateName.toUpperCase()];
    }
    
    if (!entries) {
      return [];
    }
    
    if (!Array.isArray(entries)) {
      entries = [entries];
    }
    
    // Extract fields for each entry
    return entries.map(entry => {
      const extractedEntry = {};
      
      Object.keys(fieldConfigs).forEach(fieldName => {
        // Check if user selected this field
        const fieldKey = `${aggregateName}.${fieldName}`;
        if (selectedFields && Object.keys(selectedFields).length > 0) {
          if (!selectedFields[fieldKey]) {
            return; // Skip if not selected
          }
        }
        
        const formula = fieldConfigs[fieldName];
        const context = this.getContextFromTableName(tableName);
        const value = this.evaluateFormula(voucher, formula, context, entry);
        if (value !== null && value !== undefined) {
          extractedEntry[fieldName] = value;
        }
      });
      
      return extractedEntry;
    }).filter(entry => Object.keys(entry).length > 0); // Remove empty entries
  }
  
  static getContextFromTableName(tableName) {
    const mapping = {
      'vouchers': 'voucher',
      'ledgerentries': 'ledgerentries',
      'inventoryentries': 'inventoryentries',
      'billallocations': 'billallocations',
      'batchallocations': 'batchallocations'
    };
    return mapping[tableName] || 'voucher';
  }
  
  static camelCase(str) {
    return str.charAt(0).toLowerCase() + str.slice(1);
  }
  
  static pascalCase(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
  
  static snakeCase(str) {
    return str.replace(/([A-Z])/g, '_$1').toLowerCase();
  }
}

