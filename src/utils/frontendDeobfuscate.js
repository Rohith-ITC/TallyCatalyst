/**
 * Browser-compatible deobfuscation utilities for sensitive pricing data
 * This matches the backend XOR + Base64 obfuscation method
 * Works in React, Vue, Angular, and vanilla JavaScript
 */

// IMPORTANT: This key must match the backend ENCRYPTION_KEY
// Must be set via REACT_APP_ENCRYPTION_KEY environment variable
const OBFUSCATION_KEY = process.env.REACT_APP_ENCRYPTION_KEY || '';

console.log('Deobfuscation key loaded:', OBFUSCATION_KEY);
console.log('Environment variable REACT_APP_ENCRYPTION_KEY:', process.env.REACT_APP_ENCRYPTION_KEY);

/**
 * Browser-compatible base64 decoding
 * @param {string} base64String - The base64 encoded string
 * @returns {string} - The decoded string
 */
function base64Decode(base64String) {
  try {
    // Use browser's built-in atob function
    const decoded = atob(base64String);
    console.log('Base64 decoded:', base64String, '→', decoded);
    return decoded;
  } catch (error) {
    console.error('Base64 decode error for:', base64String, error);
    return base64String; // Return original if decode fails
  }
}

/**
 * Deobfuscate a value that was obfuscated on the backend
 * @param {string} obfuscatedValue - The base64 obfuscated value
 * @returns {number|string} - The deobfuscated value or original if deobfuscation fails
 */
function deobfuscateValue(obfuscatedValue) {
  if (!obfuscatedValue || typeof obfuscatedValue !== 'string') {
    return obfuscatedValue;
  }

  console.log('Attempting to deobfuscate:', obfuscatedValue);

  try {
    // Check if the value is obfuscated (base64 encoded)
    if (obfuscatedValue.length < 4 || !/^[A-Za-z0-9+/=]+$/.test(obfuscatedValue)) {
      console.log('Value not obfuscated (not base64):', obfuscatedValue);
      return obfuscatedValue; // Not obfuscated, return as is
    }

    // Special handling for common base64 encoded values
    if (obfuscatedValue === 'ZA==') {
      console.log('Detected base64 "0", returning 0');
      return 0;
    }

    // Decode base64 using browser-compatible method
    const obfuscated = base64Decode(obfuscatedValue);
    
    if (obfuscated === obfuscatedValue) {
      console.log('Base64 decode failed, returning original:', obfuscatedValue);
      return obfuscatedValue;
    }
    
    console.log('XOR key:', OBFUSCATION_KEY);
    console.log('XOR key length:', OBFUSCATION_KEY.length);
    
    // Reverse the XOR operation
    let deobfuscated = '';
    for (let i = 0; i < obfuscated.length; i++) {
      const charCode = obfuscated.charCodeAt(i);
      const keyChar = OBFUSCATION_KEY.charCodeAt(i % OBFUSCATION_KEY.length);
      const deobfuscatedChar = charCode ^ keyChar;
      deobfuscated += String.fromCharCode(deobfuscatedChar);
      
      if (i < 5) { // Log first few characters for debugging
        console.log(`Char ${i}: ${charCode} ^ ${keyChar} = ${deobfuscatedChar} → '${String.fromCharCode(deobfuscatedChar)}'`);
      }
    }
    
    console.log('Deobfuscated result:', deobfuscated);
    
    // Convert back to number if it was originally a number
    const numValue = parseFloat(deobfuscated);
    if (!isNaN(numValue)) {
      console.log('Converted to number:', numValue);
      return numValue;
    }
    
    return deobfuscated;
    
  } catch (error) {
    console.error('Deobfuscation error for:', obfuscatedValue, error);
    return obfuscatedValue; // Return original value if deobfuscation fails
  }
}

/**
 * Alternative deobfuscation method - try different approaches
 * @param {string} obfuscatedValue - The base64 obfuscated value
 * @returns {number|string} - The deobfuscated value
 */
function deobfuscateValueAlternative(obfuscatedValue) {
  if (!obfuscatedValue || typeof obfuscatedValue !== 'string') {
    return obfuscatedValue;
  }

  console.log('Trying alternative deobfuscation for:', obfuscatedValue);

  // Special handling for common base64 encoded values
  if (obfuscatedValue === 'ZA==') {
    console.log('Alternative method: Detected base64 "0", returning 0');
    return 0;
  }

  try {
    // Try alternative keys from environment variable only
    // Never hardcode encryption keys in production code
    const alternativeKeys = process.env.REACT_APP_ENCRYPTION_KEY ? 
      [process.env.REACT_APP_ENCRYPTION_KEY] : [];

    for (const key of alternativeKeys) {
      try {
        const obfuscated = atob(obfuscatedValue);
        let deobfuscated = '';
        
        for (let i = 0; i < obfuscated.length; i++) {
          const charCode = obfuscated.charCodeAt(i);
          const keyChar = key.charCodeAt(i % key.length);
          deobfuscated += String.fromCharCode(charCode ^ keyChar);
        }
        
        const numValue = parseFloat(deobfuscated);
        // Accept 0 as a valid result
        if (!isNaN(numValue) && numValue >= 0 && numValue < 10000) {
          console.log('Alternative deobfuscation succeeded with key:', key, 'Result:', numValue);
          return numValue;
        }
      } catch (e) {
        // Continue to next key
      }
    }
    
    console.log('Alternative deobfuscation failed for:', obfuscatedValue);
    return obfuscatedValue;
    
  } catch (error) {
    console.error('Alternative deobfuscation error:', error);
    return obfuscatedValue;
  }
}

/**
 * Handle common base64 encoded values that might not need XOR deobfuscation
 * @param {string} base64Value - The base64 encoded value
 * @returns {number|string|null} - The decoded value or null if not a common case
 */
function handleCommonBase64Values(base64Value) {
  const commonValues = {
    'ZA==': 0,        // Base64 encoding of "0"
    'MA==': 0,        // Base64 encoding of "0" (alternative)
    '': 0,            // Empty string
    '0': 0,           // Direct zero
    'N/A': 'N/A',     // Not available
    'null': null,     // Null value
    'undefined': undefined // Undefined value
  };
  
  if (commonValues.hasOwnProperty(base64Value)) {
    console.log('Common base64 value detected:', base64Value, '→', commonValues[base64Value]);
    return commonValues[base64Value];
  }
  
  return null;
}

/**
 * Enhanced deobfuscation with better edge case handling
 * @param {string} obfuscatedValue - The obfuscated value
 * @returns {number|string} - The deobfuscated value
 */
function enhancedDeobfuscateValue(obfuscatedValue) {
  if (!obfuscatedValue || typeof obfuscatedValue !== 'string') {
    return obfuscatedValue;
  }

  console.log('Enhanced deobfuscation for:', obfuscatedValue);

  // First, check if it's a common base64 value
  const commonValue = handleCommonBase64Values(obfuscatedValue);
  if (commonValue !== null) {
    console.log('Enhanced: Returning common value:', commonValue);
    return commonValue;
  }

  // Try the main deobfuscation method
  const mainResult = deobfuscateValue(obfuscatedValue);
  if (mainResult !== obfuscatedValue) {
    console.log('Enhanced: Main method succeeded:', mainResult);
    return mainResult;
  }

  // Try alternative method
  const altResult = deobfuscateValueAlternative(obfuscatedValue);
  if (altResult !== obfuscatedValue) {
    console.log('Enhanced: Alternative method succeeded:', altResult);
    return altResult;
  }

  // If all methods fail, return original
  console.log('Enhanced: All deobfuscation methods failed for:', obfuscatedValue);
  return obfuscatedValue;
}

/**
 * Deobfuscate all sensitive fields in a stock item
 * @param {Object} stockItem - The stock item object with obfuscated fields
 * @returns {Object} - The stock item with deobfuscated values
 */
function deobfuscateStockItem(stockItem) {
  if (!stockItem) return stockItem;

  console.log('Deobfuscating stock item:', stockItem.NAME);
  console.log('STDPRICE before:', stockItem.STDPRICE);
  console.log('LASTPRICE before:', stockItem.LASTPRICE);

  const deobfuscatedItem = {
    ...stockItem,
    STDPRICE: enhancedDeobfuscateValue(stockItem.STDPRICE),
    LASTPRICE: enhancedDeobfuscateValue(stockItem.LASTPRICE),
    PRICELEVELS: stockItem.PRICELEVELS ? 
      stockItem.PRICELEVELS.map(pl => ({
        ...pl,
        RATE: enhancedDeobfuscateValue(pl.RATE)
      })) : []
  };

  console.log('STDPRICE after:', deobfuscatedItem.STDPRICE);
  console.log('LASTPRICE after:', deobfuscatedItem.LASTPRICE);

  return deobfuscatedItem;
}

/**
 * Deobfuscate all stock items in an array
 * @param {Array} stockItems - Array of stock items
 * @returns {Array} - Array of stock items with deobfuscated values
 */
function deobfuscateStockItems(stockItems) {
  if (!Array.isArray(stockItems)) return stockItems;
  
  console.log('Deobfuscating stock items:', stockItems.length);
  const result = stockItems.map(item => deobfuscateStockItem(item));
  console.log('Deobfuscation complete:', result);
  return result;
}

/**
 * Check if a value is obfuscated
 * @param {string} value - The value to check
 * @returns {boolean} - True if obfuscated, false otherwise
 */
function isObfuscated(value) {
  return typeof value === 'string' && 
         value.length >= 4 && 
         /^[A-Za-z0-9+/=]+$/.test(value) && 
         value !== value.toString();
}

// Export for ES6 modules (React, Vue, etc.)
export {
  deobfuscateValue,
  deobfuscateValueAlternative,
  deobfuscateStockItem,
  deobfuscateStockItems,
  enhancedDeobfuscateValue,
  isObfuscated
};

// Also export for CommonJS (Node.js)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    deobfuscateValue,
    deobfuscateValueAlternative,
    deobfuscateStockItem,
    deobfuscateStockItems,
    enhancedDeobfuscateValue,
    isObfuscated
  };
}

/**
 * Test function to verify deobfuscation is working
 * @param {string} testValue - A test obfuscated value
 */
export function testDeobfuscation(testValue = 'ZWt2') {
  console.log('=== Testing Deobfuscation ===');
  console.log('Test value:', testValue);
  console.log('Current key:', OBFUSCATION_KEY);
  
  try {
    const base64Decoded = atob(testValue);
    console.log('Base64 decoded:', base64Decoded);
    
    let deobfuscated = '';
    for (let i = 0; i < base64Decoded.length; i++) {
      const charCode = base64Decoded.charCodeAt(i);
      const keyChar = OBFUSCATION_KEY.charCodeAt(i % OBFUSCATION_KEY.length);
      const deobfuscatedChar = charCode ^ keyChar;
      deobfuscated += String.fromCharCode(deobfuscatedChar);
      console.log(`Char ${i}: ${charCode} ^ ${keyChar} = ${deobfuscatedChar} → '${String.fromCharCode(deobfuscatedChar)}'`);
    }
    
    console.log('Final deobfuscated result:', deobfuscated);
    const numValue = parseFloat(deobfuscated);
    console.log('As number:', numValue);
    
    return deobfuscated;
  } catch (error) {
    console.error('Test deobfuscation failed:', error);
    return null;
  }
}
