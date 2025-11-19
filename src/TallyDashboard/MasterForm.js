import React, { useState, useEffect, useRef } from 'react';
import { getApiUrl, GOOGLE_DRIVE_CONFIG, isGoogleDriveFullyConfigured } from '../config';

// Master Constants
const MASTER_CONSTANTS = {
  FORM_LABELS: {
    PAN_NUMBER: 'PAN Number',
    MASTER_NAME: 'Master Name',
    ALIAS: 'Alias',
    ADDRESS: 'Address',
    COUNTRY: 'Country',
    STATE: 'State',
    PINCODE: 'Pincode',
    GST_TYPE: 'GST Type',
    GST_NUMBER: 'GST Number',
    CONTACT_PERSON: 'Contact Person',
    EMAIL_ID: 'Email ID',
    PHONE_NUMBER: 'Phone Number',
    MOBILE_NUMBER: 'Mobile Number',
    ACCOUNT_NUMBER: 'Account Number',
    IFSC_CODE: 'IFSC Code',
    BANK_NAME: 'Bank Name'
  },

  PLACEHOLDERS: {
    ACCOUNT_NUMBER: 'Enter account number',
    IFSC: 'Enter IFSC code'
  },

  BUTTON_LABELS: {
    CANCEL: 'Cancel',
    SAVE_MASTER: 'Save Master',
    APPROVE_MASTER: 'Approve Master'
  },

  MESSAGES: {
    MASTER_CREATED: 'Master created, sent for authorization'
  },

  COUNTRIES: [
    'India', 'United States', 'United Kingdom', 'Canada', 'Australia', 'Germany', 'France', 'Japan', 'China', 'Brazil',
    'Italy', 'Spain', 'Netherlands', 'Sweden', 'Norway', 'Denmark', 'Finland', 'Switzerland', 'Austria', 'Belgium',
    'Portugal', 'Ireland', 'New Zealand', 'South Korea', 'Singapore', 'Hong Kong', 'Thailand', 'Malaysia', 'Indonesia', 'Philippines',
    'Vietnam', 'Taiwan', 'Israel', 'South Africa', 'Egypt', 'Nigeria', 'Kenya', 'Morocco', 'Tunisia', 'Ghana',
    'Mexico', 'Argentina', 'Chile', 'Colombia', 'Peru', 'Venezuela', 'Uruguay', 'Paraguay', 'Bolivia', 'Ecuador',
    'Russia', 'Ukraine', 'Poland', 'Czech Republic', 'Hungary', 'Romania', 'Bulgaria', 'Croatia', 'Slovenia', 'Slovakia',
    'Turkey', 'Greece', 'Cyprus', 'Malta', 'Luxembourg', 'Iceland', 'Estonia', 'Latvia', 'Lithuania', 'Belarus',
    'Moldova', 'Serbia', 'Montenegro', 'Bosnia and Herzegovina', 'North Macedonia', 'Albania', 'Kosovo', 'Georgia', 'Armenia', 'Azerbaijan',
    'Kazakhstan', 'Uzbekistan', 'Kyrgyzstan', 'Tajikistan', 'Turkmenistan', 'Mongolia', 'Afghanistan', 'Pakistan', 'Bangladesh', 'Sri Lanka',
    'Nepal', 'Bhutan', 'Myanmar', 'Laos', 'Cambodia', 'Brunei', 'Papua New Guinea', 'Fiji', 'Samoa', 'Tonga'
  ],

  INDIAN_STATES: [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
    'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
    'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
    'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
    'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
    'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli',
    'Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
  ],

  GST_TYPES: [
    'Registered',
    'Unregistered',
    'Composition',
    'SEZ',
    'Deemed Export'
  ],

  GST_REGISTRATION_TYPES: [
    'Regular',
    'Composition',
    'Unregistered/Consumer',
    'Unknown'
  ]
};

// SearchableDropdown Component
const SearchableDropdown = ({ 
  options, 
  value, 
  onChange, 
  placeholder = "Type to search...", 
  style = {},
  error = false 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredOptions, setFilteredOptions] = useState(options);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  // Filter options based on search term with smart prioritization
  useEffect(() => {
    const searchLower = searchTerm.toLowerCase();
    
    // Helper function to get the string value from an option (handles both strings and objects)
    const getOptionString = (option) => {
      if (typeof option === 'string') return option;
      if (typeof option === 'object' && option !== null) {
        return option.label || option.value || option.name || String(option);
      }
      return String(option);
    };
    
    // If search term is empty, show all options (sorted alphabetically)
    if (searchTerm.trim() === '') {
      const sorted = [...options].sort((a, b) => {
        const aStr = getOptionString(a);
        const bStr = getOptionString(b);
        return aStr.localeCompare(bStr);
      });
      setFilteredOptions(sorted);
    } else {
      // Filter options based on search term
      const filtered = options.filter(option => {
        const optionStr = getOptionString(option);
        return optionStr.toLowerCase().includes(searchLower);
      });
      
      // Sort results to prioritize exact matches and better suggestions
      const sorted = filtered.sort((a, b) => {
        const aStr = getOptionString(a);
        const bStr = getOptionString(b);
        const aLower = aStr.toLowerCase();
        const bLower = bStr.toLowerCase();
        
        // Exact match gets highest priority
        if (aLower === searchLower) return -1;
        if (bLower === searchLower) return 1;
        
        // Starts with search term gets second priority
        const aStartsWith = aLower.startsWith(searchLower);
        const bStartsWith = bLower.startsWith(searchLower);
        if (aStartsWith && !bStartsWith) return -1;
        if (!aStartsWith && bStartsWith) return 1;
        
        // If both start with search term, sort alphabetically
        if (aStartsWith && bStartsWith) {
          return aStr.localeCompare(bStr);
        }
        
        // For other matches, sort by position of match (earlier match = higher priority)
        const aIndex = aLower.indexOf(searchLower);
        const bIndex = bLower.indexOf(searchLower);
        if (aIndex !== bIndex) {
          return aIndex - bIndex;
        }
        
        // If same position, sort alphabetically
        return aStr.localeCompare(bStr);
      });
      
      setFilteredOptions(sorted);
    }
  }, [searchTerm, options]);

  // Set search term when value changes externally
  useEffect(() => {
    if (value && !isOpen) {
      setSearchTerm(value);
    }
  }, [value, isOpen]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        // Reset search term to current value when closing
        setSearchTerm(value || '');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [value]);

  const handleInputChange = (e) => {
    const newSearchTerm = e.target.value;
    setSearchTerm(newSearchTerm);
    
    // Always keep dropdown open when user is typing or has focus
    setIsOpen(true);
    
    // If user clears the input, clear the value
    if (newSearchTerm === '') {
      onChange('');
    }
  };

  const handleOptionSelect = (option) => {
    // Extract the value from option (handles both strings and objects)
    const optionValue = typeof option === 'string' 
      ? option 
      : (option?.value || option?.label || option?.name || String(option));
    const optionLabel = typeof option === 'string'
      ? option
      : (option?.label || option?.value || option?.name || String(option));
    
    setSearchTerm(optionLabel);
    onChange(optionValue);
    setIsOpen(false);
  };

  const handleInputFocus = () => {
    // Show dropdown on focus with all options
    setIsOpen(true);
    // Keep current value in search term if it exists, otherwise clear it
    if (!value) {
      setSearchTerm('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setSearchTerm(value || '');
    } else if (e.key === 'Enter' && filteredOptions.length > 0) {
      e.preventDefault();
      handleOptionSelect(filteredOptions[0]);
    }
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative', width: '100%', zIndex: 1 }}>
      <div style={{ position: 'relative', width: '100%' }}>
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          style={{
            ...style,
            width: '100%',
            border: `1px solid ${error ? '#ef4444' : isOpen ? '#3b82f6' : '#d1d5db'}`,
            boxShadow: isOpen ? '0 0 0 3px rgba(59, 130, 246, 0.1)' : '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
            cursor: style.cursor || 'text',
            outline: 'none',
            transition: 'all 0.2s',
            paddingRight: style.paddingRight || '40px'
          }}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
          data-lpignore="true"
          data-form-type="other"
          name="state-search"
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-autocomplete="list"
        />
        <span 
          className="material-icons" 
          style={{
            position: 'absolute',
            right: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: '20px',
            color: isOpen ? '#3b82f6' : '#9ca3af',
            pointerEvents: 'none',
            transition: 'color 0.2s',
            display: 'flex',
            alignItems: 'center'
          }}
        >
          {isOpen ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}
        </span>
      </div>
      
      {isOpen && (
        <div 
          style={{
          position: 'fixed',
          top: inputRef.current ? inputRef.current.getBoundingClientRect().bottom + window.scrollY : '100%',
          left: inputRef.current ? inputRef.current.getBoundingClientRect().left + window.scrollX : 0,
          width: inputRef.current ? inputRef.current.getBoundingClientRect().width : '100%',
          backgroundColor: '#fff',
          border: '2px solid #3b82f6',
          borderRadius: '8px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          zIndex: 99999,
          maxHeight: '200px',
          overflowY: 'auto',
          minHeight: '50px',
          display: 'block'
        }}>
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option, index) => {
              // Extract the display label from option (handles both strings and objects)
              const optionLabel = typeof option === 'string'
                ? option
                : (option?.label || option?.value || option?.name || String(option));
              
              // Highlight matching text
              const highlightMatch = (text, searchTerm) => {
                if (!searchTerm.trim()) return text;
                const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
                const parts = text.split(regex);
                return parts.map((part, i) => 
                  regex.test(part) ? (
                    <span key={i} style={{ backgroundColor: '#fef3c7', fontWeight: '600' }}>
                      {part}
                    </span>
                  ) : part
                );
              };

              return (
                <div
                  key={typeof option === 'string' ? option : (option?.value || option?.label || index)}
                  onClick={() => handleOptionSelect(option)}
                  style={{
                    padding: '12px 16px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    color: '#374151',
                    borderBottom: index < filteredOptions.length - 1 ? '1px solid #f3f4f6' : 'none',
                    backgroundColor: 'transparent',
                    transition: 'background-color 0.2s',
                    fontFamily: 'system-ui, -apple-system, sans-serif'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.backgroundColor = '#f3f4f6';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor = 'transparent';
                  }}
                >
                  {highlightMatch(optionLabel, searchTerm)}
                </div>
              );
            })
          ) : (
            <div style={{
              padding: '12px 16px',
              fontSize: '14px',
              color: '#6b7280',
              fontStyle: 'italic',
              fontFamily: 'system-ui, -apple-system, sans-serif'
            }}>
              No states found
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Validation functions
const validatePAN = (pan) => {
  const cleaned = pan.replace(/\s/g, '');
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  return panRegex.test(cleaned);
};

const validateGST = (gst) => {
  const cleaned = gst.replace(/\s/g, '');
  const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z0-9]{1}Z[A-Z0-9]{1}$/;
  return gstRegex.test(cleaned);
};

const validatePincode = (pincode) => {
  const pincodeRegex = /^[1-9][0-9]{5}$/;
  return pincodeRegex.test(pincode);
};

const validateIFSC = (ifsc) => {
  const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
  return ifscRegex.test(ifsc);
};

const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validateMobile = (mobile) => {
  const mobileRegex = /^[6-9][0-9]{9}$/;
  return mobileRegex.test(mobile);
};

const extractPANFromGST = (gstNumber) => {
  if (!gstNumber) return '';
  const cleaned = gstNumber.replace(/\s/g, '');
  if (cleaned.length < 10) return '';
  if (cleaned.length >= 12) {
    return cleaned.substring(2, 12);
  }
  return '';
};

const formatPAN = (value) => {
  const filtered = filterInputByFormat(value, 'PAN');
  const limited = filtered.substring(0, 10);
  return limited;
};

const isValidPANChar = (char, position) => {
  if (position < 5) {
    return /[A-Z]/i.test(char);
  } else if (position < 9) {
    return /[0-9]/.test(char);
  } else if (position === 9) {
    return /[A-Z]/i.test(char);
  }
  return false;
};

const isValidGSTChar = (char, position) => {
  if (position < 2) {
    return /[0-9]/.test(char);
  } else if (position < 7) {
    return /[A-Z]/i.test(char);
  } else if (position < 11) {
    return /[0-9]/.test(char);
  } else if (position === 11) {
    return /[A-Z]/i.test(char);
  } else if (position === 12) {
    return /[A-Z0-9]/i.test(char);
  } else if (position === 13) {
    return char === 'Z' || char === 'z';
  } else if (position === 14) {
    return /[A-Z0-9]/i.test(char);
  }
  return false;
};

const filterInputByFormat = (value, format) => {
  let filtered = '';
  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    if (format === 'PAN' && isValidPANChar(char, i)) {
      filtered += char.toUpperCase();
    } else if (format === 'GST' && isValidGSTChar(char, i)) {
      filtered += char.toUpperCase();
    }
  }
  return filtered;
};

const formatGST = (value) => {
  const filtered = filterInputByFormat(value, 'GST');
  const limited = filtered.substring(0, 15);
  return limited;
};

// Initial form data
const initialFormData = {
  tax_type: '', // New field to store PAN or GST selection
  panno: '',
  name: '',
  alias: '',
  group: '', // Group field for master
  addresses: [{ address: '', country: 'India', state: '', pincode: '', priorStateName: '', addressName: '', phoneNumber: '', countryISDCode: '+91', mobileNumber: '', contactPerson: '', placeOfSupply: '', gstRegistrationType: 'Regular', applicableFrom: '', mailingName: '' }], // Array of address objects
  gstinno: '',
  // GST Registration Details (shown when GST is selected)
  gstRegistrationType: 'Regular', // Regular, Composition, Unregistered/Consumer, Unknown
  gstApplicableFrom: '', // Date in YYYYMMDD format
  assesseeOfOtherTerritory: false,
  useLedgerAsCommonParty: false,
  setAlterAdditionalGSTDetails: false,
  ignorePrefixesSuffixesInDocNo: false,
  setAlterMSMERegistrationDetails: false,
  // MSME Registration Details
  msmeTypeOfEnterprise: '', // Type of Enterprise (Micro, Small, Medium)
  msmeUdyamRegistrationNumber: '', // UDYAM Registration Number
  msmeActivityType: 'Unknown', // Activity Type (Unknown, Manufacturing, Services, Traders)
  msmeFromDate: '', // Date in YYYYMMDD format
  // TDS Details
  isTDSDeductable: false, // Is TDS Deductable (Yes/No)
  deducteeType: '', // Deductee type
  natureOfPayment: '', // Nature of payment for TDS
  deductTDSInSameVoucher: false, // Deduct TDS in Same Voucher (Yes/No)
  isCostCentresOn: false, // Cost centres on/off
  contacts: [{ contactPerson: '', email: '', phone: '', mobile: '', countryISDCode: '+91', isDefaultWhatsappNum: false }], // Array of contact objects
  bankDetails: [{ accountNumber: '', ifscCode: '', bankName: '', swiftCode: '', paymentFavouring: '', bankId: '', defaultTransactionType: 'Inter Bank Transfer', setAsDefault: false }], // Array of bank detail objects (now paymentDetails)
  panDocumentLink: '', // Document link for PAN
  gstDocumentLink: '', // Document link for GST
  documents: [], // Additional documents array
  // Additional Details
  maintainBalancesBillByBill: false,
  defaultCreditPeriod: '',
  checkCreditDaysDuringVoucher: false,
  specifyCreditLimit: false,
  creditLimitAmount: '',
  overrideCreditLimitPostDated: false,
  inventoryValuesAffected: false,
  priceLevelApplicable: false,
  priceLevel: '',
  // New fields from API payload
  nameOnPan: '', // Name on PAN card
  emailCC: '', // CC email address
  countryISDCode: '+91', // Country ISD code for primary contact
  narration: '', // Narration field
  description: '', // Description field
  priorStateName: '', // Prior state name
  countryOfResidence: 'India', // Country of residence
  mailingName: '' // Mailing name (defaults to name if not provided)
};

const MasterForm = ({ 
  onSuccess, 
  onCancel, 
  initialData, 
  isEditing = false,
  isApprovalMode = false,
  onApprove
}) => {
  console.log('MasterForm: Component initialized', { isEditing, isApprovalMode, hasInitialData: !!initialData });

  // Common input styles
  const inputStyles = {
    width: '100%',
    padding: '12px 16px',
    borderRadius: '8px',
    fontSize: '14px',
    outline: 'none',
    transition: 'all 0.2s',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    backgroundColor: '#fff',
    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    minHeight: '44px',
    boxSizing: 'border-box',
    maxWidth: '100%'
  };

  const selectStyles = {
    ...inputStyles,
    cursor: 'pointer',
    appearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
    backgroundPosition: 'right 12px center',
    backgroundRepeat: 'no-repeat',
    backgroundSize: '16px',
    paddingRight: '40px'
  };
  
  // Form state
  const [formData, setFormData] = useState(initialFormData);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [isPANAutoFilled, setIsPANAutoFilled] = useState(false);
  const [touchedFields, setTouchedFields] = useState({});
  const [successMessage, setSuccessMessage] = useState(null);
  const [googleDriveMessage, setGoogleDriveMessage] = useState(null);
  const [isUploadingDocument, setIsUploadingDocument] = useState({ pan: false, gst: false });
  const [groups, setGroups] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [priceLevels, setPriceLevels] = useState([]);
  const [loadingPriceLevels, setLoadingPriceLevels] = useState(false);
  const [banks, setBanks] = useState([]);
  const [msmeEnterpriseTypes, setMsmeEnterpriseTypes] = useState([]);
  const [msmeActivityTypes, setMsmeActivityTypes] = useState([]);
  const [tdsDeducteeTypes, setTdsDeducteeTypes] = useState([]);
  const [loadingMasters, setLoadingMasters] = useState(false);

  // Pre-fill form data when in approval mode or editing
  useEffect(() => {
    if (isApprovalMode && initialData) {
      console.log('MasterForm: Pre-filling form for approval mode', initialData);
      console.log('MasterForm: Available fields in initialData:', Object.keys(initialData));
      
      const preFilledData = {
        tax_type: initialData.gstNumber ? 'GST' : (initialData.panNumber ? 'PAN' : ''),
        panno: initialData.panNumber || '',
        name: initialData.name || '',
        alias: initialData.alias || '',
        group: initialData.group || '',
        addresses: initialData.addresses && Array.isArray(initialData.addresses) && initialData.addresses.length > 0
          ? initialData.addresses.map(addr => ({
              address: (addr.address || '').replace(/\|/g, '\n'),
              country: addr.country || 'India',
              state: addr.state || '',
              pincode: addr.pincode || ''
            }))
          : initialData.address
            ? [{
                address: (initialData.address || '').replace(/\|/g, '\n'),
                country: initialData.country || 'India',
                state: initialData.state || '',
                pincode: initialData.pincode || ''
              }]
            : [{ address: '', country: 'India', state: '', pincode: '' }],
        gstinno: initialData.gstNumber || '',
        gstRegistrationType: initialData.gstRegistrationType || 'Regular',
        assesseeOfOtherTerritory: initialData.assesseeOfOtherTerritory || false,
        useLedgerAsCommonParty: initialData.useLedgerAsCommonParty || false,
        setAlterAdditionalGSTDetails: initialData.setAlterAdditionalGSTDetails || false,
        ignorePrefixesSuffixesInDocNo: initialData.ignorePrefixesSuffixesInDocNo || false,
        setAlterMSMERegistrationDetails: initialData.setAlterMSMERegistrationDetails || false,
        msmeTypeOfEnterprise: initialData.msmeTypeOfEnterprise || '',
        msmeUdyamRegistrationNumber: initialData.msmeUdyamRegistrationNumber || '',
        msmeActivityType: initialData.msmeActivityType || 'Unknown',
        isTDSDeductable: initialData.isTDSDeductable || false,
        deducteeType: initialData.deducteeType || '',
        deductTDSInSameVoucher: initialData.deductTDSInSameVoucher || false,
        contacts: initialData.contacts && Array.isArray(initialData.contacts) && initialData.contacts.length > 0
          ? initialData.contacts.map(contact => ({
              contactPerson: contact.contactPerson || '',
              email: contact.email || '',
              phone: contact.phone || '',
              mobile: contact.mobile || ''
            }))
          : (initialData.contactPerson || initialData.email || initialData.phone || initialData.mobile)
            ? [{
                contactPerson: initialData.contactPerson || '',
                email: initialData.email || '',
                phone: initialData.phone || '',
                mobile: initialData.mobile || ''
              }]
            : [{ contactPerson: '', email: '', phone: '', mobile: '' }],
        bankDetails: initialData.bankDetails && Array.isArray(initialData.bankDetails) && initialData.bankDetails.length > 0
          ? initialData.bankDetails.map(bank => ({
              accountNumber: bank.accountNumber || '',
              ifscCode: bank.ifscCode || '',
              bankName: bank.bankName || ''
            }))
          : (initialData.bankDetails?.accountNumber || initialData.bankDetails?.ifscCode || initialData.bankDetails?.bankName)
            ? [{
                accountNumber: initialData.bankDetails?.accountNumber || '',
                ifscCode: initialData.bankDetails?.ifscCode || '',
                bankName: initialData.bankDetails?.bankName || ''
              }]
            : [{ accountNumber: '', ifscCode: '', bankName: '' }],
        panDocumentLink: initialData.panDocumentLink || '',
        gstDocumentLink: initialData.gstDocumentLink || '',
        maintainBalancesBillByBill: initialData.maintainBalancesBillByBill || false,
        defaultCreditPeriod: initialData.defaultCreditPeriod || '',
        checkCreditDaysDuringVoucher: initialData.checkCreditDaysDuringVoucher || false,
        specifyCreditLimit: initialData.specifyCreditLimit || false,
        creditLimitAmount: initialData.creditLimitAmount || '',
        overrideCreditLimitPostDated: initialData.overrideCreditLimitPostDated || false,
        inventoryValuesAffected: initialData.inventoryValuesAffected || false
      };
      
      setFormData(preFilledData);
    } else if (isEditing && initialData) {
      console.log('MasterForm: Pre-filling form for editing mode', initialData);
      const preFilledData = {
        tax_type: initialData.gstNumber ? 'GST' : (initialData.panNumber ? 'PAN' : ''),
        panno: initialData.panNumber || '',
        name: initialData.name || '',
        alias: initialData.alias || '',
        addresses: initialData.addresses && Array.isArray(initialData.addresses) && initialData.addresses.length > 0
          ? initialData.addresses.map(addr => ({
              address: (addr.address || '').replace(/\|/g, '\n'),
              country: addr.country || 'India',
              state: addr.state || '',
              pincode: addr.pincode || ''
            }))
          : initialData.address
            ? [{
                address: (initialData.address || '').replace(/\|/g, '\n'),
                country: initialData.country || 'India',
                state: initialData.state || '',
                pincode: initialData.pincode || ''
              }]
            : [{ address: '', country: 'India', state: '', pincode: '' }],
        gstinno: initialData.gstNumber || '',
        gstRegistrationType: initialData.gstRegistrationType || 'Regular',
        assesseeOfOtherTerritory: initialData.assesseeOfOtherTerritory || false,
        useLedgerAsCommonParty: initialData.useLedgerAsCommonParty || false,
        setAlterAdditionalGSTDetails: initialData.setAlterAdditionalGSTDetails || false,
        ignorePrefixesSuffixesInDocNo: initialData.ignorePrefixesSuffixesInDocNo || false,
        setAlterMSMERegistrationDetails: initialData.setAlterMSMERegistrationDetails || false,
        contacts: initialData.contacts && Array.isArray(initialData.contacts) && initialData.contacts.length > 0
          ? initialData.contacts.map(contact => ({
              contactPerson: contact.contactPerson || '',
              email: contact.email || '',
              phone: contact.phone || '',
              mobile: contact.mobile || ''
            }))
          : (initialData.contactPerson || initialData.email || initialData.phone || initialData.mobile)
            ? [{
                contactPerson: initialData.contactPerson || '',
                email: initialData.email || '',
                phone: initialData.phone || '',
                mobile: initialData.mobile || ''
              }]
            : [{ contactPerson: '', email: '', phone: '', mobile: '' }],
        bankDetails: initialData.bankDetails && Array.isArray(initialData.bankDetails) && initialData.bankDetails.length > 0
          ? initialData.bankDetails.map(bank => ({
              accountNumber: bank.accountNumber || '',
              ifscCode: bank.ifscCode || '',
              bankName: bank.bankName || ''
            }))
          : (initialData.bankDetails?.accountNumber || initialData.bankDetails?.ifscCode || initialData.bankDetails?.bankName)
            ? [{
                accountNumber: initialData.bankDetails?.accountNumber || '',
                ifscCode: initialData.bankDetails?.ifscCode || '',
                bankName: initialData.bankDetails?.bankName || ''
              }]
            : [{ accountNumber: '', ifscCode: '', bankName: '' }],
        maintainBalancesBillByBill: initialData.maintainBalancesBillByBill || false,
        defaultCreditPeriod: initialData.defaultCreditPeriod || '',
        checkCreditDaysDuringVoucher: initialData.checkCreditDaysDuringVoucher || false,
        specifyCreditLimit: initialData.specifyCreditLimit || false,
        creditLimitAmount: initialData.creditLimitAmount || '',
        overrideCreditLimitPostDated: initialData.overrideCreditLimitPostDated || false,
        inventoryValuesAffected: initialData.inventoryValuesAffected || false,
        priceLevelApplicable: initialData.priceLevelApplicable || false,
        priceLevel: initialData.priceLevel || ''
      };
      setFormData(preFilledData);
    }
  }, [isApprovalMode, isEditing, initialData]);
  
  // Duplicate checking state
  const [duplicateCheck, setDuplicateCheck] = useState({
    gstinno: { isChecking: false, isDuplicate: false, message: '' },
    panno: { isChecking: false, isDuplicate: false, message: '' },
    name: { isChecking: false, isDuplicate: false, message: '' },
    alias: { isChecking: false, isDuplicate: false, message: '' }
  });

  // Trigger duplicate checks when form is pre-filled (skip in approval mode and edit mode)
  useEffect(() => {
    if (isApprovalMode || isEditing) {
      return;
    }
    
    if (formData.gstinno && formData.gstinno.length >= 15) {
      checkDuplicate('gstinno', formData.gstinno);
    }
    if (formData.panno && formData.panno.length >= 10) {
      checkDuplicate('panno', formData.panno);
    }
    if (formData.name && formData.name.trim().length >= 3) {
      checkDuplicate('name', formData.name);
    }
    if (formData.alias && formData.alias.trim().length >= 3) {
      checkDuplicate('alias', formData.alias);
    }
  }, [formData.gstinno, formData.panno, formData.name, formData.alias, isApprovalMode, isEditing]);
  
  // Tab state
  const [activeTab, setActiveTab] = useState('basic');
  
  // Additional Details state
  const [showAdditionalDetails, setShowAdditionalDetails] = useState(false);

  // API function to check for duplicates
  const checkDuplicate = async (field, value) => {
    if (!value || value.trim() === '') {
      return;
    }
    console.log('MasterForm: Checking duplicate for', field, ':', value);

    try {
      setDuplicateCheck(prev => ({
        ...prev,
        [field]: { isChecking: true, isDuplicate: false, message: '' }
      }));

      const token = sessionStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      // Get session data
      const tallylocId = sessionStorage.getItem('tallyloc_id');
      const company = sessionStorage.getItem('company');
      const guid = sessionStorage.getItem('guid');

      if (!tallylocId || !company || !guid) {
        throw new Error('Missing required session data');
      }

      // Validate required fields
      if (!value || value.trim() === '') {
        return;
      }

      // Map field names to API expected values
      // Note: alias uses 'name' type because backend treats name and alias as one
      const fieldMapping = {
        'gstinno': 'gstin',
        'panno': 'pan', 
        'name': 'name',
        'alias': 'name' // Use 'name' type for alias since backend treats them as one
      };
      
      const apiType = fieldMapping[field];
      if (!apiType) {
        throw new Error(`Invalid field type: ${field}. Must be gstinno, panno, name, or alias`);
      }

      // Prepare the check data
      const checkData = {
        tallyloc_id: parseInt(tallylocId),
        company: company,
        guid: guid,
        type: apiType, // Use mapped type (gstin, pan, name)
        value: value.trim() // Use value field
      };

      // Validate data types and values
      if (isNaN(checkData.tallyloc_id)) {
        throw new Error('Invalid tallyloc_id: must be a number');
      }
      if (!checkData.company || checkData.company.trim() === '') {
        throw new Error('Company name is required');
      }
      if (!checkData.guid || checkData.guid.trim() === '') {
        throw new Error('GUID is required');
      }
      if (!checkData.type || !['gstin', 'pan', 'name'].includes(checkData.type)) {
        throw new Error('Invalid type: must be gstin, pan, or name');
      }
      if (!checkData.value || checkData.value.trim() === '') {
        throw new Error('Value is required');
      }


      const response = await fetch(getApiUrl('/api/tally/ledger-check'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(checkData)
      });

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (jsonError) {
          console.error('Failed to parse error response as JSON:', jsonError);
          errorData = { message: `HTTP ${response.status}: ${response.statusText}` };
        }
        
        console.error('API Error Response:', {
          status: response.status,
          statusText: response.statusText,
          errorData: errorData,
          requestData: checkData
        });
        throw new Error(errorData.message || `Failed to check for duplicates: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('MasterForm: Duplicate check result for', field, ':', result);

      // Only show as duplicate if the existing ledger is authorized/approved
      // If it exists but is pending, it's not a duplicate
      const isDuplicate = (result.exists === true && result.status === 'approved') || result.canProceed === false;
      
      // Update duplicate check state based on result
      setDuplicateCheck(prev => {
        const newState = {
          ...prev,
          [field]: {
            isChecking: false,
            isDuplicate: isDuplicate,
            message: isDuplicate ? 
              (result.message || `${field} already exists and is approved`) : ''
          }
        };
        return newState;
      });

      return result;
    } catch (err) {
      console.error('Error checking for duplicates:', err);
      setDuplicateCheck(prev => ({
        ...prev,
        [field]: {
          isChecking: false,
          isDuplicate: false,
          message: ''
        }
      }));
    }
  };

  // Debounced duplicate checking function
  const debouncedCheckDuplicate = (() => {
    let timeoutId;
    return (field, value) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        checkDuplicate(field, value).catch(error => {
          console.error('Duplicate check failed:', error);
        });
      }, 500); // 500ms delay
    };
  })();

  // Store access token
  const [googleAccessToken, setGoogleAccessToken] = useState(null);
  
  // Check if Google Drive is fully configured
  const googleDriveConfigStatus = isGoogleDriveFullyConfigured();
  const isGoogleDriveConfigured = googleDriveConfigStatus.configured;
  
  // Debug: Log Google Drive configuration status
  useEffect(() => {
    console.log('🔍 MasterForm - Google Drive Config Check:', {
      configured: isGoogleDriveConfigured,
      hasClientId: googleDriveConfigStatus.hasClientId,
      hasApiKey: googleDriveConfigStatus.hasApiKey,
      clientId: GOOGLE_DRIVE_CONFIG.CLIENT_ID ? `${GOOGLE_DRIVE_CONFIG.CLIENT_ID.substring(0, 30)}...` : 'MISSING',
      apiKey: GOOGLE_DRIVE_CONFIG.API_KEY ? 'SET (hidden)' : 'MISSING',
      willShowUploadButtons: isGoogleDriveConfigured
    });
  }, [isGoogleDriveConfigured, googleDriveConfigStatus]);

  // Load Google API scripts
  useEffect(() => {
    // Debug: Check if credentials are loaded
    console.log('Google Drive Config:', {
      hasClientId: !!GOOGLE_DRIVE_CONFIG.CLIENT_ID,
      hasApiKey: !!GOOGLE_DRIVE_CONFIG.API_KEY,
      clientIdLength: GOOGLE_DRIVE_CONFIG.CLIENT_ID?.length || 0,
      apiKeyLength: GOOGLE_DRIVE_CONFIG.API_KEY?.length || 0
    });

    // Load Google Identity Services (new auth library)
    if (!document.querySelector('script[src="https://accounts.google.com/gsi/client"]')) {
      const gisScript = document.createElement('script');
      gisScript.src = 'https://accounts.google.com/gsi/client';
      gisScript.async = true;
      gisScript.defer = true;
      gisScript.onload = () => {
        console.log('Google Identity Services loaded');
      };
      document.body.appendChild(gisScript);
    }

    // Load Google Picker
    if (!document.querySelector('script[src="https://apis.google.com/js/api.js"]')) {
      const pickerScript = document.createElement('script');
      pickerScript.src = 'https://apis.google.com/js/api.js';
      pickerScript.async = true;
      pickerScript.defer = true;
      pickerScript.onload = () => {
        window.gapi.load('picker', () => {
          console.log('Google Picker API loaded');
        });
      };
      document.body.appendChild(pickerScript);
    }
  }, []);

  // Function to authenticate with Google using new GIS library
  const authenticateGoogle = () => {
    return new Promise((resolve, reject) => {
      try {
        // Check if credentials are configured
        if (!GOOGLE_DRIVE_CONFIG.CLIENT_ID || !GOOGLE_DRIVE_CONFIG.API_KEY) {
          reject(new Error('Google API credentials not configured. Please add REACT_APP_GOOGLE_CLIENT_ID and REACT_APP_GOOGLE_API_KEY to your .env file.'));
          return;
        }

        // Check if Google Identity Services is loaded
        if (!window.google || !window.google.accounts) {
          reject(new Error('Google Identity Services not loaded yet. Please wait and try again.'));
          return;
        }

        // If we already have a token, use it
        if (googleAccessToken) {
          resolve(googleAccessToken);
          return;
        }

        // Create OAuth2 token client
        const tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_DRIVE_CONFIG.CLIENT_ID,
          scope: GOOGLE_DRIVE_CONFIG.SCOPES,
          callback: (response) => {
            console.log('Token client callback received:', response);
            
            if (response.error) {
              console.error('Token error:', response);
              if (response.error === 'access_denied') {
                // Check if this is due to missing scopes or user denial
                const errorDetails = response.error_description || '';
                
                // If error indicates missing scopes, show setup instructions
                if (errorDetails.includes('scope') || errorDetails.includes('permission')) {
                  setGoogleDriveMessage({
                    type: 'error',
                    title: 'Permission Required',
                    message: 'Please allow permissions to upload documents.'
                  });
                  reject(new Error('Google Drive permissions not configured'));
                } else {
                  // User explicitly denied permissions
                  setGoogleDriveMessage({
                    type: 'error',
                    title: 'Access Denied',
                    message: 'Please grant Google Drive permissions to upload documents.'
                  });
                  reject(new Error('Google Drive access denied by user'));
                }
              } else if (response.error === 'popup_closed_by_user') {
                reject(new Error('Sign-in popup was closed. Please try again.'));
              } else {
                reject(response);
              }
              return;
            }
            
            if (response.access_token) {
              console.log('Access token obtained successfully');
              setGoogleAccessToken(response.access_token);
              resolve(response.access_token);
            } else {
              console.error('No access token in response:', response);
              reject(new Error('Failed to get access token. Response: ' + JSON.stringify(response)));
            }
          },
        });

        console.log('Requesting access token...');
        // Request access token
        tokenClient.requestAccessToken();
      } catch (error) {
        console.error('Google authentication failed:', error);
        reject(error);
      }
    });
  };

  // Function to open Google Drive Picker
  const openDrivePicker = async (type) => {
    try {
      setIsUploadingDocument(prev => ({ ...prev, [type]: true }));
      
      // Check if credentials are configured
      if (!GOOGLE_DRIVE_CONFIG.CLIENT_ID || !GOOGLE_DRIVE_CONFIG.API_KEY) {
        setIsUploadingDocument(prev => ({ ...prev, [type]: false }));
        setGoogleDriveMessage({
          type: 'error',
          title: 'Service Unavailable',
          message: 'Google Drive is not available. Please try again later.'
        });
        return;
      }
      
      // Wait for both scripts to load
      if (!window.gapi || !window.google || !window.google.accounts) {
        console.error('Google APIs not loaded yet');
        setIsUploadingDocument(prev => ({ ...prev, [type]: false }));
        setGoogleDriveMessage({
          type: 'error',
          title: 'Loading',
          message: 'Please wait while Google services load.'
        });
        return;
      }

      // Authenticate user
      let accessToken;
      try {
        accessToken = await authenticateGoogle();
      } catch (authError) {
        console.error('Authentication error:', authError);
        setIsUploadingDocument(prev => ({ ...prev, [type]: false }));
        
        if (authError.message && authError.message.includes('not configured')) {
          setGoogleDriveMessage({
            type: 'error',
            title: 'Service Unavailable',
            message: 'Google Drive is not available. Please try again later.'
          });
        } else if (authError.message && authError.message.includes('not loaded yet')) {
          setGoogleDriveMessage({
            type: 'error',
            title: 'Loading',
            message: 'Please wait while Google services load.'
          });
        } else if (authError.message && authError.message.includes('access denied')) {
          setGoogleDriveMessage({
            type: 'error',
            title: 'Access Denied',
            message: 'Please grant Google Drive permissions to upload documents.'
          });
        } else {
          setGoogleDriveMessage({
            type: 'error',
            title: 'Connection Failed',
            message: 'Unable to connect to Google Drive. Please try again.'
          });
        }
        return;
      }

      if (!window.google.picker) {
        console.error('Google Picker not loaded');
        setIsUploadingDocument(prev => ({ ...prev, [type]: false }));
        setGoogleDriveMessage({
          type: 'error',
          title: 'Service Unavailable',
          message: 'Google Drive is temporarily unavailable. Please refresh and try again.'
        });
        return;
      }

      // Create and show picker
      const picker = new window.google.picker.PickerBuilder()
      .addView(new window.google.picker.DocsUploadView())  
      .addView(window.google.picker.ViewId.PDFS)
        .addView(new window.google.picker.DocsView(window.google.picker.ViewId.DOCS)
          .setIncludeFolders(false)
          .setSelectFolderEnabled(false))
        
        .setOAuthToken(accessToken)
        .setDeveloperKey(GOOGLE_DRIVE_CONFIG.API_KEY)
        .setCallback((data) => {
          setIsUploadingDocument(prev => ({ ...prev, [type]: false }));
          
          if (data[window.google.picker.Response.ACTION] === window.google.picker.Action.PICKED) {
            const file = data[window.google.picker.Response.DOCUMENTS][0];
            const fileId = file.id;
            
            // Create a shareable link
            const viewUrl = `https://drive.google.com/file/d/${fileId}/view`;
            
            // Store the document link
            const fieldName = type === 'pan' ? 'panDocumentLink' : 'gstDocumentLink';
            updateField(fieldName, viewUrl);
            
            console.log('Document selected:', file, 'Link:', viewUrl);
          } else if (data[window.google.picker.Response.ACTION] === window.google.picker.Action.CANCEL) {
            console.log('Picker cancelled');
          }
        })
        .build();

      picker.setVisible(true);
    } catch (error) {
      console.error('Error opening Google Picker:', error);
      setIsUploadingDocument(prev => ({ ...prev, [type]: false }));
      setGoogleDriveMessage({
        type: 'error',
        title: 'Upload Failed',
        message: 'Unable to access Google Drive. Please try again.'
      });
    }
  };

  // Address management functions
  const addAddress = () => {
    setFormData(prev => ({
      ...prev,
      addresses: [...prev.addresses, { address: '', country: 'India', state: '', pincode: '' }]
    }));
  };

  const removeAddress = (index) => {
    if (formData.addresses.length > 1) {
      setFormData(prev => ({
        ...prev,
        addresses: prev.addresses.filter((_, i) => i !== index)
      }));
    }
  };

  const updateAddressField = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      addresses: prev.addresses.map((addr, i) => 
        i === index ? { ...addr, [field]: value } : addr
      )
    }));
  };

  // Contact management functions
  const addContact = () => {
    setFormData(prev => ({
      ...prev,
      contacts: [...prev.contacts, { contactPerson: '', email: '', phone: '', mobile: '' }]
    }));
  };

  const removeContact = (index) => {
    if (formData.contacts.length > 1) {
      setFormData(prev => ({
        ...prev,
        contacts: prev.contacts.filter((_, i) => i !== index)
      }));
    }
  };

  const updateContactField = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      contacts: prev.contacts.map((contact, i) => 
        i === index ? { ...contact, [field]: value } : contact
      )
    }));
  };

  // Bank Details management functions
  const addBankDetail = () => {
    setFormData(prev => ({
      ...prev,
      bankDetails: [...prev.bankDetails, { accountNumber: '', ifscCode: '', bankName: '' }]
    }));
  };

  const removeBankDetail = (index) => {
    if (formData.bankDetails.length > 1) {
      setFormData(prev => ({
        ...prev,
        bankDetails: prev.bankDetails.filter((_, i) => i !== index)
      }));
    }
  };

  const updateBankDetailField = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      bankDetails: prev.bankDetails.map((bank, i) => 
        i === index ? { ...bank, [field]: value } : bank
      )
    }));
  };

  // Form management functions
  const updateField = (field, value) => {
    console.log('MasterForm: Field updated', field, ':', value);
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
    
    // Clear success message when user starts typing
    if (successMessage) {
      setSuccessMessage(null);
    }

    // Check for duplicates for specific fields (skip in approval mode and edit mode)
    if (!isApprovalMode && !isEditing) {
      if (field === 'gstinno' && value && value.length >= 15) {
        debouncedCheckDuplicate('gstinno', value);
      } else if (field === 'panno' && value && value.length >= 10) {
        debouncedCheckDuplicate('panno', value);
      } else if (field === 'name' && value && value.trim().length >= 3) {
        debouncedCheckDuplicate('name', value);
      } else if (field === 'alias' && value && value.trim().length >= 3) {
        debouncedCheckDuplicate('alias', value);
      }
    }
  };

  // Handle field blur events
  const handleFieldBlur = (field) => {
    setTouchedFields(prev => ({
      ...prev,
      [field]: true
    }));

    // Validate GST number on blur if it's incomplete
    if (field === 'gstinno' && formData.tax_type === 'GST') {
      if (formData.gstinno && formData.gstinno.length > 0 && formData.gstinno.length < 15) {
        setErrors(prev => ({
          ...prev,
          [field]: 'GST Number must be 15 characters long'
        }));
      }
    }
  };

  const validateForm = () => {
    console.log('MasterForm: Validating form');
    const newErrors = {};

    // Only essential mandatory fields for master creation
    if (!formData.name.trim()) {
      newErrors.name = 'Master Name is required';
    }

    // Check if name and alias are the same
    if (formData.name.trim() && formData.alias.trim() && 
        formData.name.trim().toLowerCase() === formData.alias.trim().toLowerCase()) {
      newErrors.name = 'Master Name and Alias cannot be the same';
      newErrors.alias = 'Master Name and Alias cannot be the same';
    }

    // Tax identification validation - optional but validate format when provided
    if (formData.tax_type === 'PAN') {
      if (formData.panno.trim() && !validatePAN(formData.panno)) {
        newErrors.panno = 'Invalid PAN format';
      }
    } else if (formData.tax_type === 'GST') {
      if (formData.gstinno.trim()) {
        if (formData.gstinno.length < 15) {
          newErrors.gstinno = 'GST Number must be 15 characters long';
        } else if (!validateGST(formData.gstinno)) {
          newErrors.gstinno = 'Invalid GST format';
        }
      }
    }

    // Check for duplicates (skip in approval mode and edit mode)
    if (!isApprovalMode && !isEditing) {
      if (duplicateCheck.name.isDuplicate) {
        newErrors.name = duplicateCheck.name.message || 'Master name already exists';
      }
      if (duplicateCheck.alias.isDuplicate) {
        newErrors.alias = duplicateCheck.alias.message || 'Alias already exists';
      }
      if (duplicateCheck.panno.isDuplicate) {
        newErrors.panno = duplicateCheck.panno.message || 'PAN number already exists';
      }
      if (duplicateCheck.gstinno.isDuplicate) {
        newErrors.gstinno = duplicateCheck.gstinno.message || 'GST number already exists';
      }
    }

    // Optional validation for other fields (only if provided)
    // Validate contacts
    if (formData.contacts && Array.isArray(formData.contacts)) {
      formData.contacts.forEach((contact, index) => {
        if (contact.email && !validateEmail(contact.email)) {
          newErrors[`contact_${index}_email`] = 'Invalid email format';
        }
        if (contact.mobile && !validateMobile(contact.mobile)) {
          newErrors[`contact_${index}_mobile`] = 'Invalid mobile number format';
        }
      });
    }

    // Validate addresses pincode
    if (formData.addresses && Array.isArray(formData.addresses)) {
      formData.addresses.forEach((addr, index) => {
        if (addr.pincode && !validatePincode(addr.pincode)) {
          newErrors[`address_${index}_pincode`] = 'Invalid pincode format';
        }
      });
    }

    // Optional validation for bank details (only if provided)
    if (formData.bankDetails && Array.isArray(formData.bankDetails)) {
      formData.bankDetails.forEach((bank, index) => {
        if (bank.ifscCode && !validateIFSC(bank.ifscCode)) {
          newErrors[`bank_${index}_ifscCode`] = 'Invalid IFSC format';
        }
      });
    }

    setErrors(newErrors);
    const isValid = Object.keys(newErrors).length === 0;
    console.log('MasterForm: Form validation result:', { isValid, errors: newErrors });
    return isValid;
  };

  const resetForm = (keepSuccessMessage = false) => {
    setFormData(initialFormData);
    setErrors({});
    setTouchedFields({});
    if (!keepSuccessMessage) {
      setSuccessMessage(null);
    }
    setDuplicateCheck({
      gstinno: { isChecking: false, isDuplicate: false, message: '' },
      panno: { isChecking: false, isDuplicate: false, message: '' },
      name: { isChecking: false, isDuplicate: false, message: '' },
      alias: { isChecking: false, isDuplicate: false, message: '' }
    });
  };


  // Initialize form with initial data if provided
  useEffect(() => {
    if (initialData) {
      Object.entries(initialData).forEach(([key, value]) => {
        if (value !== undefined) {
          updateField(key, value);
        }
      });
    }
  }, [initialData]);

  // Auto-hide success message after 5 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Fetch all masters data from API (groups, banks, MSME types, price levels)
  useEffect(() => {
    const fetchMasters = async () => {
      setLoadingMasters(true);
      setLoadingGroups(true);
      setLoadingPriceLevels(true);
      try {
        const token = sessionStorage.getItem('token');
        if (!token) {
          console.warn('No authentication token found, skipping masters fetch');
          return;
        }

        const tallylocId = sessionStorage.getItem('tallyloc_id');
        const company = sessionStorage.getItem('company');
        const guid = sessionStorage.getItem('guid');

        if (!tallylocId || !company || !guid) {
          console.warn('Missing required session data, skipping masters fetch');
          return;
        }

        const payload = {
          tallyloc_id: parseInt(tallylocId),
          company: company,
          guid: guid
        };

        const response = await fetch(getApiUrl('/api/tally/masters'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        // Log the full response to understand the structure
        console.log('📡 Full API response from /api/tally/masters:', data);
        
        // Extract GROUPLIST - structure: GROUPLIST.GROUP[]
        let groupsList = [];
        if (data && data.GROUPLIST && data.GROUPLIST.GROUP) {
          groupsList = Array.isArray(data.GROUPLIST.GROUP) 
            ? data.GROUPLIST.GROUP 
            : [data.GROUPLIST.GROUP];
          console.log('✅ Found groups in GROUPLIST.GROUP:', groupsList);
        } else if (data && data.groups) {
          // Fallback for alternative structure
          if (data.groups.GROUP && Array.isArray(data.groups.GROUP)) {
            groupsList = data.groups.GROUP;
          } else if (Array.isArray(data.groups)) {
            groupsList = data.groups;
          }
        }
        
        if (groupsList.length > 0) {
          console.log('✅ Setting groups list with', groupsList.length, 'items');
          setGroups(groupsList);
        } else {
          console.warn('⚠️ Groups not found in expected format');
          setGroups([]);
        }
        
        // Extract BANKLIST - structure: BANKLIST.BANK[]
        let banksList = [];
        if (data && data.BANKLIST && data.BANKLIST.BANK) {
          banksList = Array.isArray(data.BANKLIST.BANK)
            ? data.BANKLIST.BANK.map(bank => bank.NAME || bank.name || bank)
            : [data.BANKLIST.BANK.NAME || data.BANKLIST.BANK.name || data.BANKLIST.BANK];
          console.log('✅ Found banks in BANKLIST.BANK:', banksList);
        }
        
        if (banksList.length > 0) {
          console.log('✅ Setting banks list with', banksList.length, 'items');
          setBanks(banksList);
        } else {
          console.warn('⚠️ Banks not found in expected format');
          setBanks([]);
        }
        
        // Extract MSMEENTRPTYPELIST - structure: MSMEENTRPTYPELIST.MSMEENTRPTYPE[]
        let msmeEntrpTypes = [];
        if (data && data.MSMEENTRPTYPELIST && data.MSMEENTRPTYPELIST.MSMEENTRPTYPE) {
          msmeEntrpTypes = Array.isArray(data.MSMEENTRPTYPELIST.MSMEENTRPTYPE)
            ? data.MSMEENTRPTYPELIST.MSMEENTRPTYPE.map(type => type.NAME || type.name || type)
            : [data.MSMEENTRPTYPELIST.MSMEENTRPTYPE.NAME || data.MSMEENTRPTYPELIST.MSMEENTRPTYPE.name || data.MSMEENTRPTYPELIST.MSMEENTRPTYPE];
          console.log('✅ Found MSME enterprise types in MSMEENTRPTYPELIST.MSMEENTRPTYPE:', msmeEntrpTypes);
        }
        
        if (msmeEntrpTypes.length > 0) {
          console.log('✅ Setting MSME enterprise types list with', msmeEntrpTypes.length, 'items');
          setMsmeEnterpriseTypes(msmeEntrpTypes);
        } else {
          console.warn('⚠️ MSME enterprise types not found in expected format');
          setMsmeEnterpriseTypes([]);
        }
        
        // Extract MSMEACTVTYPELIST - structure: MSMEACTVTYPELIST.MSMEACTVTYPE[]
        let msmeActvTypes = [];
        if (data && data.MSMEACTVTYPELIST && data.MSMEACTVTYPELIST.MSMEACTVTYPE) {
          msmeActvTypes = Array.isArray(data.MSMEACTVTYPELIST.MSMEACTVTYPE)
            ? data.MSMEACTVTYPELIST.MSMEACTVTYPE.map(type => type.NAME || type.name || type)
            : [data.MSMEACTVTYPELIST.MSMEACTVTYPE.NAME || data.MSMEACTVTYPELIST.MSMEACTVTYPE.name || data.MSMEACTVTYPELIST.MSMEACTVTYPE];
          console.log('✅ Found MSME activity types in MSMEACTVTYPELIST.MSMEACTVTYPE:', msmeActvTypes);
        }
        
        if (msmeActvTypes.length > 0) {
          console.log('✅ Setting MSME activity types list with', msmeActvTypes.length, 'items');
          setMsmeActivityTypes(msmeActvTypes);
        } else {
          console.warn('⚠️ MSME activity types not found in expected format');
          setMsmeActivityTypes([]);
        }
        
        // Extract PRICELEVELLIST - structure: PRICELEVELLIST.PRICELEVEL[] (if exists)
        let priceLevelList = [];
        if (data && data.PRICELEVELLIST && data.PRICELEVELLIST.PRICELEVEL) {
          priceLevelList = Array.isArray(data.PRICELEVELLIST.PRICELEVEL)
            ? data.PRICELEVELLIST.PRICELEVEL
            : [data.PRICELEVELLIST.PRICELEVEL];
          console.log('✅ Found price levels in PRICELEVELLIST.PRICELEVEL:', priceLevelList);
        } else if (data && data.priceLevelList && Array.isArray(data.priceLevelList)) {
          priceLevelList = data.priceLevelList;
        }
        
        if (priceLevelList.length > 0) {
          console.log('✅ Setting price levels list with', priceLevelList.length, 'items');
          setPriceLevels(priceLevelList);
        } else {
          console.warn('⚠️ Price levels not found in expected format');
          setPriceLevels([]);
        }
        
        // Extract TDSDEDUCTEETYPELIST - structure: TDSDEDUCTEETYPELIST.TDSDEDUCTEETYPE[]
        let tdsDeducteeTypesList = [];
        if (data && data.TDSDEDUCTEETYPELIST && data.TDSDEDUCTEETYPELIST.TDSDEDUCTEETYPE) {
          tdsDeducteeTypesList = Array.isArray(data.TDSDEDUCTEETYPELIST.TDSDEDUCTEETYPE)
            ? data.TDSDEDUCTEETYPELIST.TDSDEDUCTEETYPE.map(type => type.NAME || type.name || type)
            : [data.TDSDEDUCTEETYPELIST.TDSDEDUCTEETYPE.NAME || data.TDSDEDUCTEETYPELIST.TDSDEDUCTEETYPE.name || data.TDSDEDUCTEETYPELIST.TDSDEDUCTEETYPE];
          console.log('✅ Found TDS deductee types in TDSDEDUCTEETYPELIST.TDSDEDUCTEETYPE:', tdsDeducteeTypesList);
        }
        
        if (tdsDeducteeTypesList.length > 0) {
          console.log('✅ Setting TDS deductee types list with', tdsDeducteeTypesList.length, 'items');
          setTdsDeducteeTypes(tdsDeducteeTypesList);
        } else {
          console.warn('⚠️ TDS deductee types not found in expected format');
          setTdsDeducteeTypes([]);
        }
      } catch (error) {
        console.error('Error fetching masters:', error);
        setGroups([]);
        setBanks([]);
        setMsmeEnterpriseTypes([]);
        setMsmeActivityTypes([]);
        setPriceLevels([]);
        setTdsDeducteeTypes([]);
      } finally {
        setLoadingMasters(false);
        setLoadingGroups(false);
        setLoadingPriceLevels(false);
      }
    };

    fetchMasters();
  }, []);

  // Get field states based on selected group's ACTIONS
  const getFieldStates = () => {
    if (!formData.group) {
      // If no group selected, enable all fields by default
      return {
        hasBankDetails: true,
        hasGST: true,
        hasTDS: true,
        hasAddress: true,
        hasMSME: true,
        hasPriceLevel: true,
        hasCostCenter: true,
        hasBillByBill: true,
        hasMultipleAddresses: true,
        hasMultipleBanks: true,
        hasODLimit: true,
        hasGSTAssVal: true,
        hasGSTHSN: true,
        hasAffInv: true
      };
    }

    // Find the selected group
    const selectedGroup = groups.find(group => {
      const groupName = group.NAME || group.name || group.groupName || group.label || String(group) || '';
      const groupValue = group.NAME || group.name || group.groupName || group.MASTERID || group.id || group.value || String(group) || '';
      return groupName === formData.group || groupValue === formData.group;
    });

    if (!selectedGroup || !selectedGroup.ACTIONS) {
      // If group not found or no ACTIONS, enable all fields
      return {
        hasBankDetails: true,
        hasGST: true,
        hasTDS: true,
        hasAddress: true,
        hasMSME: true,
        hasPriceLevel: true,
        hasCostCenter: true,
        hasBillByBill: true,
        hasMultipleAddresses: true,
        hasMultipleBanks: true,
        hasODLimit: true,
        hasGSTAssVal: true,
        hasGSTHSN: true,
        hasAffInv: true
      };
    }

    const actions = selectedGroup.ACTIONS;
    
    // Map ACTIONS to field states (Yes = enabled, No = disabled)
    return {
      hasBankDetails: actions.HAS_BANKDTLS === 'Yes',
      hasGST: actions.HAS_GST === 'Yes',
      hasTDS: actions.HAS_TDS === 'Yes',
      hasAddress: actions.HAS_ADDRDTLS === 'Yes',
      hasMSME: actions.HAS_MSMEDTLS === 'Yes',
      hasPriceLevel: actions.HAS_PRICLVL === 'Yes',
      hasCostCenter: actions.HAS_COSTCENT === 'Yes',
      hasBillByBill: actions.HAS_BILLBYBILL === 'Yes',
      hasMultipleAddresses: actions.HAS_MULTADDRS === 'Yes',
      hasMultipleBanks: actions.MULTIBANK === 'Yes',
      hasODLimit: actions.HAS_ODLIMIT === 'Yes',
      hasGSTAssVal: actions.HAS_GSTASSVAL === 'Yes',
      hasGSTHSN: actions.HAS_GSTHSNDTLS === 'Yes',
      hasAffInv: actions.HAS_AFFINV === 'Yes'
    };
  };

  const fieldStates = getFieldStates();

  // Real-time validation for name and alias equality
  useEffect(() => {
    if (formData.name.trim() && formData.alias.trim() && 
        formData.name.trim().toLowerCase() === formData.alias.trim().toLowerCase()) {
      setErrors(prev => ({
        ...prev,
        name: 'Master Name and Alias cannot be the same',
        alias: 'Master Name and Alias cannot be the same'
      }));
    } else {
      // Clear the error if name and alias are different
      setErrors(prev => {
        const newErrors = { ...prev };
        if (newErrors.name === 'Master Name and Alias cannot be the same') {
          delete newErrors.name;
        }
        if (newErrors.alias === 'Master Name and Alias cannot be the same') {
          delete newErrors.alias;
        }
        return newErrors;
      });
    }
  }, [formData.name, formData.alias]);

  // Create master function
  const createMaster = async (masterData) => {
    console.log('MasterForm: Creating master with data:', masterData);
    try {
      setSubmitError(null);

      const token = sessionStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      // Get session data
      const tallylocId = sessionStorage.getItem('tallyloc_id');
      const company = sessionStorage.getItem('company');
      const guid = sessionStorage.getItem('guid');

      if (!tallylocId || !company || !guid) {
        throw new Error('Missing required session data (tallyloc_id, company, or guid)');
      }

      // Validate session data types
      if (isNaN(parseInt(tallylocId))) {
        throw new Error('Invalid tallyloc_id: must be a number');
      }

      // Prepare the master data for API according to the ledger-create API structure
      const trimmedName = masterData.name.trim();
      const alias = masterData.alias || '';
      
      // Get first address for primary fields
      const firstAddress = masterData.addresses && masterData.addresses.length > 0
        ? masterData.addresses[0]
        : { address: masterData.address1 || '', pincode: masterData.pincode || '', state: masterData.state || '', country: masterData.country || 'India' };
      
      // Get first contact for primary fields
      const firstContact = masterData.contacts && masterData.contacts.length > 0
        ? masterData.contacts[0]
        : { contactPerson: masterData.contactperson || '', email: masterData.emailid || '', phone: masterData.phoneno || '', mobile: masterData.mobileno || '' };
      
      // Build address string with pipe separator
      const addressString = firstAddress.address ? firstAddress.address.replace(/\n/g, '|') : '';
      const addressArray = addressString ? addressString.split('|').filter(addr => addr.trim()) : [];
      
      // Build languageNames array (name and alias if different)
      const languageNames = [trimmedName];
      if (alias && alias.trim() && alias.trim().toLowerCase() !== trimmedName.toLowerCase()) {
        languageNames.push(alias.trim());
      }
      
      // Build contactDetails array
      const contactDetails = masterData.contacts && Array.isArray(masterData.contacts) && masterData.contacts.length > 0
        ? masterData.contacts.map((contact, index) => ({
            name: contact.contactPerson || '',
            phoneNumber: contact.mobile || contact.phone || '',
            countryISDCode: contact.countryISDCode || '+91',
            isDefaultWhatsappNum: index === 0 ? 'Yes' : 'No'
          }))
        : firstContact.mobile || firstContact.phone
          ? [{
              name: firstContact.contactPerson || '',
              phoneNumber: firstContact.mobile || firstContact.phone || '',
              countryISDCode: '+91',
              isDefaultWhatsappNum: 'Yes'
            }]
          : [];
      
      // Build paymentDetails array from bankDetails
      const paymentDetails = masterData.bankDetails && Array.isArray(masterData.bankDetails) && masterData.bankDetails.length > 0
        ? masterData.bankDetails.map((bank, index) => ({
            ifscCode: bank.ifscCode || '',
            swiftCode: bank.swiftCode || '',
            accountNumber: bank.accountNumber || '',
            paymentFavouring: bank.paymentFavouring || bank.bankName || trimmedName,
            transactionName: index === 0 ? 'Primary' : `Secondary${index > 1 ? index : ''}`,
            bankId: bank.bankId || '',
            setAsDefault: index === 0 ? 'Yes' : 'No',
            defaultTransactionType: bank.defaultTransactionType || 'Inter Bank Transfer'
          }))
        : masterData.accountno || masterData.ifsccode
          ? [{
              ifscCode: masterData.ifsccode || '',
              swiftCode: masterData.swiftCode || '',
              accountNumber: masterData.accountno || '',
              paymentFavouring: masterData.bankname || trimmedName,
              transactionName: 'Primary',
              bankId: masterData.bankId || '',
              setAsDefault: 'Yes',
              defaultTransactionType: 'Inter Bank Transfer'
            }]
          : [];
      
      // Build msmeDetails array
      const msmeDetails = masterData.msmeUdyamRegistrationNumber && masterData.msmeTypeOfEnterprise
        ? [{
            fromDate: masterData.msmeFromDate || new Date().toISOString().slice(0, 10).replace(/-/g, ''),
            enterpriseType: masterData.msmeTypeOfEnterprise,
            udyamRegNumber: masterData.msmeUdyamRegistrationNumber,
            msmeActivityType: masterData.msmeActivityType || 'Unknown'
          }]
        : [];
      
      // Build gstRegDetails array
      const gstRegDetails = masterData.gstinno
        ? [{
            applicableFrom: masterData.gstApplicableFrom || new Date().toISOString().slice(0, 10).replace(/-/g, ''),
            gstRegistrationType: masterData.gstRegistrationType || 'Regular',
            placeOfSupply: firstAddress.state || '',
            gstin: masterData.gstinno
          }]
        : [];
      
      // Build mailingDetailsList array
      const mailingDetailsList = masterData.addresses && Array.isArray(masterData.addresses) && masterData.addresses.length > 0
        ? masterData.addresses.map((addr, index) => {
            const addrLines = addr.address ? addr.address.replace(/\n/g, '|').split('|').filter(line => line.trim()) : [];
            return {
              addresses: addrLines.length > 0 ? addrLines : [''],
              applicableFrom: addr.applicableFrom || new Date().toISOString().slice(0, 10).replace(/-/g, ''),
              pincode: addr.pincode || '',
              mailingName: addr.mailingName || trimmedName,
              state: addr.state || '',
              country: addr.country || 'India'
            };
          })
        : addressArray.length > 0
          ? [{
              addresses: addressArray,
              applicableFrom: new Date().toISOString().slice(0, 10).replace(/-/g, ''),
              pincode: firstAddress.pincode || '',
              mailingName: trimmedName,
              state: firstAddress.state || '',
              country: firstAddress.country || 'India'
            }]
          : [];
      
      // Build multiAddressList array
      const multiAddressList = masterData.addresses && Array.isArray(masterData.addresses) && masterData.addresses.length > 0
        ? masterData.addresses.map((addr, index) => {
            const addrLines = addr.address ? addr.address.replace(/\n/g, '|').split('|').filter(line => line.trim()) : [];
            return {
              addressName: addr.addressName || String.fromCharCode(65 + index), // A, B, C, etc.
              addresses: addrLines.length > 0 ? addrLines : [''],
              priorStateName: addr.priorStateName || addr.state || '',
              pincode: addr.pincode || '',
              phoneNumber: addr.phoneNumber || firstContact.phone || '',
              countryISDCode: addr.countryISDCode || '+91',
              countryName: addr.country || 'India',
              gstRegistrationType: addr.gstRegistrationType || masterData.gstRegistrationType || 'Regular',
              mobileNumber: addr.mobileNumber || firstContact.mobile || '',
              contactPerson: addr.contactPerson || firstContact.contactPerson || '',
              state: addr.state || '',
              placeOfSupply: addr.placeOfSupply || addr.state || ''
            };
          })
        : addressArray.length > 0
          ? [{
              addressName: 'A',
              addresses: addressArray,
              priorStateName: firstAddress.state || '',
              pincode: firstAddress.pincode || '',
              phoneNumber: firstContact.phone || '',
              countryISDCode: '+91',
              countryName: firstAddress.country || 'India',
              gstRegistrationType: masterData.gstRegistrationType || 'Regular',
              mobileNumber: firstContact.mobile || '',
              contactPerson: firstContact.contactPerson || '',
              state: firstAddress.state || '',
              placeOfSupply: firstAddress.state || ''
            }]
          : [];
      
      // Build doclist from document links
      const documents = [];
      if (masterData.panDocumentLink) documents.push(masterData.panDocumentLink);
      if (masterData.gstDocumentLink) documents.push(masterData.gstDocumentLink);
      if (masterData.documents && Array.isArray(masterData.documents)) {
        documents.push(...masterData.documents);
      }
      
      const apiData = {
        tallyloc_id: parseInt(tallylocId),
        company: company,
        guid: guid,
        ledgerData: {
          name: trimmedName,
          languageNames: languageNames,
          group: masterData.group || '',
          isBillWiseOn: masterData.maintainBalancesBillByBill ? 'Yes' : 'No',
          billCreditPeriod: masterData.defaultCreditPeriod || '',
          isCreditDaysChkOn: masterData.checkCreditDaysDuringVoucher ? 'Yes' : 'No',
          creditLimit: masterData.creditLimitAmount || '',
          overrideCreditLimit: masterData.overrideCreditLimitPostDated ? 'Yes' : 'No',
          affectsStock: masterData.inventoryValuesAffected ? 'Yes' : 'No',
          isCostCentresOn: 'No', // Default value, can be updated if form has this field
          isTdsApplicable: masterData.isTDSDeductable ? 'Yes' : 'No',
          tdsDeducteeType: masterData.deducteeType || '',
          natureOfPayment: masterData.natureOfPayment || '',
          address: addressString,
          addresses: addressArray,
          pincode: firstAddress.pincode || '',
          priorStateName: firstAddress.state || '',
          stateName: firstAddress.state || '',
          countryOfResidence: firstAddress.country || 'India',
          mailingName: masterData.mailingName || trimmedName,
          contactPerson: firstContact.contactPerson || '',
          phoneNo: firstContact.phone || '',
          countryISDCode: firstContact.countryISDCode || '+91',
          mobileNo: firstContact.mobile || '',
          email: firstContact.email || '',
          emailCC: masterData.emailCC || '',
          panNo: masterData.panno || '',
          nameOnPan: masterData.nameOnPan || trimmedName,
          gstinNo: masterData.gstinno || '',
          priceLevel: masterData.priceLevel || '',
          narration: masterData.narration || '',
          description: masterData.description || '',
          contactDetails: contactDetails,
          doclist: documents.length > 0 ? { documents: documents } : undefined,
          paymentDetails: paymentDetails,
          msmeDetails: msmeDetails,
          gstRegDetails: gstRegDetails,
          mailingDetailsList: mailingDetailsList,
          multiAddressList: multiAddressList
        }
      };
      
      // Remove undefined doclist if empty
      if (!apiData.ledgerData.doclist || !apiData.ledgerData.doclist.documents || apiData.ledgerData.doclist.documents.length === 0) {
        delete apiData.ledgerData.doclist;
      }


      // Validate required fields before API call
      if (!apiData.ledgerData.name) {
        throw new Error('Master Name is mandatory');
      }

      // Additional validation for data quality
      if (apiData.ledgerData.name.length < 2) {
        throw new Error('Master name must be at least 2 characters long');
      }
      
      if (apiData.ledgerData.mobileNo && !/^[6-9][0-9]{9}$/.test(apiData.ledgerData.mobileNo)) {
        throw new Error('Invalid mobile number format');
      }

      // Validate PAN format if provided
      if (apiData.ledgerData.panNo && apiData.ledgerData.panNo.length > 0) {
        const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
        if (!panRegex.test(apiData.ledgerData.panNo)) {
          throw new Error(`Invalid PAN format: ${apiData.ledgerData.panNo}. Correct format: ABCDE1234F`);
        }
      }

        // Validate GST format if provided
        if (apiData.ledgerData.gstinNo && apiData.ledgerData.gstinNo.length > 0) {
          const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z0-9]{1}Z[A-Z0-9]{1}$/;
          if (!gstRegex.test(apiData.ledgerData.gstinNo)) {
            throw new Error(`Invalid GST format: ${apiData.ledgerData.gstinNo}. Correct format: 12ABCDE1234F1Z5`);
          }
        }


      // Check if ledger already exists before creating (skip in approval mode and edit mode)
      if (!isApprovalMode && !isEditing) {
        try {
          const duplicateCheckResponse = await fetch(getApiUrl('/api/tally/ledger-check'), {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              tallyloc_id: parseInt(tallylocId),
              company: company,
              guid: guid,
              type: "name",
              value: apiData.ledgerData.name
            })
          });

          if (duplicateCheckResponse.ok) {
            const duplicateResult = await duplicateCheckResponse.json();
            
            // Check if duplicate exists and cannot proceed
            // Only treat as duplicate if the existing ledger is approved/authorized
            const isDuplicate = (duplicateResult.exists === true && duplicateResult.status === 'approved') || duplicateResult.canProceed === false;
            
            if (isDuplicate) {
              const errorMessage = `Ledger with name "${apiData.ledgerData.name}" already exists and is approved. Please use a different name.`;
              throw new Error(errorMessage);
            }
          } else {
            const errorData = await duplicateCheckResponse.json().catch(() => ({}));
            // Don't proceed if duplicate check fails
            throw new Error('Failed to verify if ledger already exists. Please try again.');
          }
        } catch (duplicateError) {
          throw duplicateError; // Re-throw the error to stop creation
        }
      }

      const response = await fetch(getApiUrl('/api/tally/ledger-create'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(apiData)
      });

      if (!response.ok) {
        let errorMessage = 'Failed to create master';
        try {
          const errorData = await response.json();
          console.error('API Error Response:', errorData);
          errorMessage = errorData.message || errorData.error || `HTTP ${response.status}: ${response.statusText}`;
        } catch (parseError) {
          console.error('Failed to parse error response:', parseError);
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('MasterForm: Master creation API response:', result);
      
      // Check if the API response indicates success
      if (result.success === false) {
        let errorMessage = result.message || 'Failed to create ledger';
        
        // Check if it's a duplicate name issue
        if (result.ledgerName && result.created === 0) {
          errorMessage += `\n\nPossible causes:\n• Ledger with name "${result.ledgerName}" already exists\n• Invalid data format\n• Server-side validation failed`;
          
          // If the ledger name is truncated, suggest a different name
          if (result.ledgerName.length < apiData.ledgerData.name.length) {
            errorMessage += `\n• Name was truncated from "${apiData.ledgerData.name}" to "${result.ledgerName}"`;
          }
          
          // Suggest a unique name
          const timestamp = new Date().getTime().toString().slice(-4);
          const uniqueName = `${apiData.ledgerData.name}_${timestamp}`;
          errorMessage += `\n\nTry using a unique name like: "${uniqueName}"`;
          
          // Also suggest checking existing ledgers
          errorMessage += `\n\nOr check the master list to see if "${result.ledgerName}" already exists.`;
        }
        
        
        throw new Error(errorMessage);
      }
      
      console.log('MasterForm: Master created successfully');
      return result;
    } catch (err) {
      console.error('Error creating master:', err);
      setSubmitError(err.message);
      throw err;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('MasterForm: Form submitted');

    if (!validateForm()) {
      console.log('MasterForm: Form validation failed');
      return;
    }

    try {
      if (isApprovalMode) {
        // In approval mode, call the approve callback
        console.log('MasterForm: Approving master');
        await onApprove?.(formData);
      } else if (isEditing) {
        // Master editing/updating
        console.log('MasterForm: Updating master');
        const result = await createMaster(formData); // ledger-create handles updates if master exists
        
        // Save master name before resetting form
        const updatedMasterName = formData.name;
        
        // Reset form (but keep success message for now)
        resetForm(true);
        
        // Show success message with master details
        console.log('MasterForm: Master update successful');
        setSuccessMessage(`Master updated successfully\n\nMaster: ${updatedMasterName}`);
        
        // Trigger global refresh to update master lists
        window.dispatchEvent(new CustomEvent('globalRefresh'));
        
        // Call success callback
        onSuccess?.();
      } else {
        // Normal master creation
        console.log('MasterForm: Creating new master');
        const result = await createMaster(formData);
        
        // Save master name before resetting form
        const createdMasterName = formData.name;
        
        // Reset form (but keep success message for now)
        resetForm(true);
        
        // Show success message with master details
        console.log('MasterForm: Master creation successful');
        setSuccessMessage(`Master created, sent for authorization\n\nMaster: ${createdMasterName}`);
        
        // Trigger global refresh to update master lists
        window.dispatchEvent(new CustomEvent('globalRefresh'));
        
        // Call success callback
        onSuccess?.();
      }
    } catch (error) {
      console.error(isApprovalMode ? 'Master approval failed:' : (isEditing ? 'Master update failed:' : 'Master creation failed:'), error);
      // Error is already handled in the createMaster function
    }
  };

  const handleCancel = () => {
    console.log('MasterForm: Form cancelled');
    resetForm();
    onCancel?.();
  };

  return (
    <div style={{
      background: '#f3f4f6',
      width: '100vw',
      minHeight: 'calc(100vh - 120px)',
      padding: 0,
      margin: 0,
      paddingLeft: 220,
    }}>
      <style>{`
        .master-form-grid > div {
          min-width: 0;
          overflow: hidden;
        }
        .master-form-grid input,
        .master-form-grid select,
        .master-form-grid textarea {
          max-width: 100%;
          box-sizing: border-box;
        }
        @media (max-width: 1200px) {
          .master-form-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 20px !important;
          }
        }
        @media (max-width: 900px) {
          .master-form-grid {
            grid-template-columns: 1fr !important;
            gap: 20px !important;
          }
        }
        @media (max-width: 600px) {
          .master-form-grid {
            gap: 16px !important;
          }
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
      <div style={{
        background: '#fff',
        margin: '24px 32px 16px 32px',
        maxWidth: '1400px',
        width: 'auto',
        borderRadius: '16px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        overflow: 'hidden',
        border: '1px solid #e5e7eb',
        position: 'relative',
        boxSizing: 'border-box'
      }}>
        <div style={{ padding: '16px', width: '100%', boxSizing: 'border-box' }}>
          <h2 style={{ 
            fontSize: '20px', 
            fontWeight: '600', 
            color: '#374151', 
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            fontFamily: 'system-ui, -apple-system, sans-serif'
          }}>
            <span className="material-icons" style={{ fontSize: '24px', color: '#3b82f6' }}>
              {isApprovalMode ? 'verified_user' : (isEditing ? 'edit' : 'person_add')}
            </span>
            {isApprovalMode ? 'Approve Master' : (isEditing ? 'Edit Master' : 'Master Information Form')}
          </h2>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {successMessage && (
          <div style={{
            background: '#dcfce7',
            border: '1px solid #86efac',
            borderRadius: '6px',
            padding: '16px',
            marginBottom: '20px',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)'
          }}>
            <div style={{ 
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px'
            }}>
              <span className="material-icons" style={{ 
                fontSize: '24px', 
                color: '#10b981',
                flexShrink: 0,
                marginTop: '2px'
              }}>
                check_circle
              </span>
              <div style={{ flex: 1 }}>
                <p style={{ 
                  color: '#065f46', 
                  fontSize: '14px', 
                  fontWeight: '500',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  margin: '0 0 8px 0',
                  lineHeight: '1.5'
                }}>
                  Master created, sent for authorization
                </p>
                <p style={{ 
                  color: '#047857', 
                  fontSize: '13px',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  margin: '0',
                  whiteSpace: 'pre-line'
                }}>
                  {successMessage.includes('\n\n') ? successMessage.split('\n\n')[1] : ''}
                </p>
              </div>
              <button
                onClick={() => setSuccessMessage(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  color: '#047857',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '4px',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = '#a7f3d0';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = 'transparent';
                }}
              >
                <span className="material-icons" style={{ fontSize: '18px' }}>close</span>
              </button>
            </div>
          </div>
        )}
        {submitError && (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '6px',
            padding: '12px 16px',
            marginBottom: '20px'
          }}>
            <p style={{ 
              color: '#dc2626', 
              fontSize: '14px', 
              fontWeight: '500',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              margin: '0',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span className="material-icons" style={{ fontSize: '18px' }}>error</span>
              {submitError}
            </p>
          </div>
        )}
        {googleDriveMessage && (
          <div style={{
            background: googleDriveMessage.type === 'error' ? '#fef2f2' : '#f0f9ff',
            border: googleDriveMessage.type === 'error' ? '1px solid #fecaca' : '1px solid #bae6fd',
            borderRadius: '6px',
            padding: '16px',
            marginBottom: '20px',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)'
          }}>
            <div style={{ 
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px'
            }}>
              <span className="material-icons" style={{ 
                fontSize: '24px', 
                color: googleDriveMessage.type === 'error' ? '#dc2626' : '#0ea5e9',
                flexShrink: 0,
                marginTop: '2px'
              }}>
                {googleDriveMessage.type === 'error' ? 'error' : 'info'}
              </span>
              <div style={{ flex: 1 }}>
                <p style={{ 
                  color: googleDriveMessage.type === 'error' ? '#dc2626' : '#0c4a6e', 
                  fontSize: '14px', 
                  fontWeight: '500',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  margin: '0 0 8px 0',
                  lineHeight: '1.5'
                }}>
                  {googleDriveMessage.title}
                </p>
                <p style={{ 
                  color: googleDriveMessage.type === 'error' ? '#991b1b' : '#075985', 
                  fontSize: '13px',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  margin: '0',
                  lineHeight: '1.5'
                }}>
                  {googleDriveMessage.message}
                </p>
              </div>
              <button
                onClick={() => setGoogleDriveMessage(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  color: googleDriveMessage.type === 'error' ? '#991b1b' : '#075985',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '4px',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = googleDriveMessage.type === 'error' ? '#fecaca' : '#bae6fd';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = 'transparent';
                }}
              >
                <span className="material-icons" style={{ fontSize: '18px' }}>close</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div style={{
          display: 'flex',
          borderBottom: '2px solid #e5e7eb',
          marginBottom: '24px',
          backgroundColor: '#f9fafb',
          borderRadius: '8px 8px 0 0',
          overflow: 'hidden'
        }}>
          {[
            { id: 'basic', label: 'Basic Information', icon: 'person' },
            { id: 'address', label: 'Address', icon: 'location_on' },
            { id: 'contact', label: 'Contact Details', icon: 'contact_phone' },
            { id: 'bank', label: 'Bank Details', icon: 'account_balance' },
            { id: 'statutory', label: 'Statutory', icon: 'description' }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1,
                padding: '16px 24px',
                border: 'none',
                backgroundColor: activeTab === tab.id ? '#3b82f6' : 'transparent',
                color: activeTab === tab.id ? '#fff' : '#6b7280',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                borderRight: tab.id !== 'statutory' ? '1px solid #e5e7eb' : 'none'
              }}
              onMouseEnter={(e) => {
                if (activeTab !== tab.id) {
                  e.target.style.backgroundColor = '#f3f4f6';
                  e.target.style.color = '#374151';
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== tab.id) {
                  e.target.style.backgroundColor = 'transparent';
                  e.target.style.color = '#6b7280';
                }
              }}
            >
              <span className="material-icons" style={{ fontSize: '18px' }}>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div style={{ minHeight: '400px' }}>
          {/* Basic Information Tab */}
          {activeTab === 'basic' && (
            <div>
              <div className="master-form-grid" style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(3, 1fr)', 
                gap: '24px',
                alignItems: 'start'
              }}>
                {/* Master Name */}
                <div>
                  <label style={{ 
                    display: 'block', 
                    fontSize: '14px', 
                    fontWeight: '500', 
                    color: '#374151', 
                    marginBottom: '6px',
                    fontFamily: 'system-ui, -apple-system, sans-serif'
                  }}>
                    {MASTER_CONSTANTS.FORM_LABELS.MASTER_NAME} *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => updateField('name', e.target.value)}
                      style={{
                        ...inputStyles,
                        border: `1px solid ${errors.name ? '#ef4444' : duplicateCheck.name.isDuplicate ? '#ef4444' : '#d1d5db'}`,
                        paddingRight: duplicateCheck.name.isChecking ? '40px' : '16px'
                      }}
                      placeholder="Enter master name"
                    />
                    {duplicateCheck.name.isChecking && (
                      <div style={{
                        position: 'absolute',
                        right: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        display: 'flex',
                        alignItems: 'center'
                      }}>
                        <div style={{
                          width: '16px',
                          height: '16px',
                          border: '2px solid #3b82f6',
                          borderTop: '2px solid transparent',
                          borderRadius: '50%',
                          animation: 'spin 1s linear infinite'
                        }}></div>
                      </div>
                    )}
                    {duplicateCheck.name.isDuplicate && !duplicateCheck.name.isChecking && (
                      <div style={{
                        position: 'absolute',
                        right: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: '#ef4444'
                      }}>
                        <span className="material-icons" style={{ fontSize: '18px' }}>error</span>
                      </div>
                    )}
                    {(() => {
                      // Only show green checkmark if:
                      // 1. Not a duplicate
                      // 2. Not currently checking
                      // 3. Name is complete (3+ characters)
                      // 4. No validation errors
                      // 5. Duplicate check has been completed (not in initial state)
                      const hasCompletedCheck = duplicateCheck.name.isChecking === false && 
                                               (duplicateCheck.name.isDuplicate === true || duplicateCheck.name.isDuplicate === false);
                      const shouldShowGreen = !duplicateCheck.name.isDuplicate && 
                                             !duplicateCheck.name.isChecking && 
                                             formData.name.length >= 3 && 
                                             !errors.name &&
                                             hasCompletedCheck;
                      return shouldShowGreen;
                    })() && (
                      <div style={{
                        position: 'absolute',
                        right: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: '#10b981'
                      }}>
                        <span className="material-icons" style={{ fontSize: '18px' }}>check_circle</span>
                      </div>
                    )}
                  </div>
                  {errors.name && <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{errors.name}</p>}
                  {duplicateCheck.name.isDuplicate && !errors.name && (
                    <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', fontFamily: 'system-ui, -apple-system, sans-serif', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span className="material-icons" style={{ fontSize: '14px' }}>warning</span>
                      {duplicateCheck.name.message || 'Master name already exists'}
                    </p>
                  )}
                </div>

                {/* Alias */}
                <div>
                  <label style={{ 
                    display: 'block', 
                    fontSize: '14px', 
                    fontWeight: '500', 
                    color: '#374151', 
                    marginBottom: '6px',
                    fontFamily: 'system-ui, -apple-system, sans-serif'
                  }}>
                    {MASTER_CONSTANTS.FORM_LABELS.ALIAS}
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      value={formData.alias}
                      onChange={(e) => updateField('alias', e.target.value)}
                      style={{
                        ...inputStyles,
                        border: `1px solid ${errors.alias ? '#ef4444' : duplicateCheck.alias.isDuplicate ? '#ef4444' : '#d1d5db'}`,
                        paddingRight: duplicateCheck.alias.isChecking ? '40px' : '16px'
                      }}
                      placeholder="Enter alias name"
                    />
                    {duplicateCheck.alias.isChecking && (
                      <div style={{
                        position: 'absolute',
                        right: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        display: 'flex',
                        alignItems: 'center'
                      }}>
                        <div style={{
                          width: '16px',
                          height: '16px',
                          border: '2px solid #3b82f6',
                          borderTop: '2px solid transparent',
                          borderRadius: '50%',
                          animation: 'spin 1s linear infinite'
                        }}></div>
                      </div>
                    )}
                    {duplicateCheck.alias.isDuplicate && !duplicateCheck.alias.isChecking && (
                      <div style={{
                        position: 'absolute',
                        right: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: '#ef4444'
                      }}>
                        <span className="material-icons" style={{ fontSize: '18px' }}>error</span>
                      </div>
                    )}
                    {(() => {
                      // Only show green checkmark if:
                      // 1. Not a duplicate
                      // 2. Not currently checking
                      // 3. Alias is complete (3+ characters)
                      // 4. No validation errors
                      // 5. Duplicate check has been completed (not in initial state)
                      const hasCompletedCheck = duplicateCheck.alias.isChecking === false && 
                                               (duplicateCheck.alias.isDuplicate === true || duplicateCheck.alias.isDuplicate === false);
                      const shouldShowGreen = !duplicateCheck.alias.isDuplicate && 
                                             !duplicateCheck.alias.isChecking && 
                                             formData.alias.length >= 3 && 
                                             !errors.alias &&
                                             hasCompletedCheck;
                      return shouldShowGreen;
                    })() && (
                      <div style={{
                        position: 'absolute',
                        right: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: '#10b981'
                      }}>
                        <span className="material-icons" style={{ fontSize: '18px' }}>check_circle</span>
                      </div>
                    )}
                  </div>
                  {errors.alias && <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{errors.alias}</p>}
                  {duplicateCheck.alias.isDuplicate && !errors.alias && (
                    <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', fontFamily: 'system-ui, -apple-system, sans-serif', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span className="material-icons" style={{ fontSize: '14px' }}>warning</span>
                      {duplicateCheck.alias.message || 'Alias already exists'}
                    </p>
                  )}
                </div>

                {/* Group */}
                <div>
                  <label style={{ 
                    display: 'block', 
                    fontSize: '14px', 
                    fontWeight: '500', 
                    color: '#374151', 
                    marginBottom: '6px',
                    fontFamily: 'system-ui, -apple-system, sans-serif'
                  }}>
                    Group
                  </label>
                  <div style={{ 
                    opacity: loadingGroups ? 0.6 : 1, 
                    pointerEvents: loadingGroups ? 'none' : 'auto',
                    position: 'relative'
                  }}>
                    <SearchableDropdown
                      options={groups.map((group, index) => {
                        // Extract NAME from GROUPLIST.GROUP[] structure
                        const groupName = group.NAME || group.name || group.groupName || group.label || String(group) || '';
                        const groupValue = group.NAME || group.name || group.groupName || group.MASTERID || group.id || group.value || String(group) || '';
                        return {
                          value: groupName || groupValue,
                          label: groupName || groupValue || 'Unnamed Group'
                        };
                      })}
                      value={formData.group}
                      onChange={(value) => updateField('group', value)}
                      placeholder={loadingGroups ? "Loading groups..." : "Search or select group"}
                      style={{
                        ...inputStyles,
                        border: `1px solid ${errors.group ? '#ef4444' : '#d1d5db'}`,
                        width: '100%',
                        padding: '12px 16px',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontFamily: 'system-ui, -apple-system, sans-serif',
                        backgroundColor: loadingGroups ? '#f3f4f6' : '#fff',
                        cursor: loadingGroups ? 'not-allowed' : 'text',
                        transition: 'all 0.2s',
                        paddingRight: '40px'
                      }}
                      error={!!errors.group}
                    />
                  </div>
                  {loadingGroups && (
                    <p style={{ color: '#6b7280', fontSize: '12px', marginTop: '4px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                      Loading groups...
                    </p>
                  )}
                  {errors.group && <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{errors.group}</p>}
                </div>

                {/* Additional Details Button */}
                <div style={{ gridColumn: 'span 3', marginTop: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setShowAdditionalDetails(!showAdditionalDetails)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 16px',
                      backgroundColor: showAdditionalDetails ? '#3b82f6' : '#f3f4f6',
                      color: showAdditionalDetails ? '#fff' : '#374151',
                      border: `1px solid ${showAdditionalDetails ? '#3b82f6' : '#d1d5db'}`,
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      fontFamily: 'system-ui, -apple-system, sans-serif'
                    }}
                    onMouseEnter={(e) => {
                      if (!showAdditionalDetails) {
                        e.target.style.backgroundColor = '#e5e7eb';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!showAdditionalDetails) {
                        e.target.style.backgroundColor = '#f3f4f6';
                      }
                    }}
                  >
                    <span style={{ fontSize: '18px', fontWeight: 'bold' }}>+</span>
                    Additional Details
                  </button>
                </div>

                {/* Additional Details Section */}
                {showAdditionalDetails && (
                  <div style={{ gridColumn: 'span 3', marginTop: '16px', padding: '20px', backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      {/* Narration */}
                      <div>
                        <label style={{ 
                          display: 'block', 
                          fontSize: '14px', 
                          fontWeight: '500', 
                          color: '#374151', 
                          marginBottom: '6px',
                          fontFamily: 'system-ui, -apple-system, sans-serif'
                        }}>
                          Narration
                        </label>
                        <textarea
                          value={formData.narration}
                          onChange={(e) => updateField('narration', e.target.value)}
                          style={{
                            ...inputStyles,
                            minHeight: '80px',
                            resize: 'vertical',
                            border: `1px solid ${errors.narration ? '#ef4444' : '#d1d5db'}`
                          }}
                          placeholder="Enter narration"
                          rows={3}
                        />
                        {errors.narration && <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{errors.narration}</p>}
                      </div>

                      {/* Description */}
                      <div>
                        <label style={{ 
                          display: 'block', 
                          fontSize: '14px', 
                          fontWeight: '500', 
                          color: '#374151', 
                          marginBottom: '6px',
                          fontFamily: 'system-ui, -apple-system, sans-serif'
                        }}>
                          Description
                        </label>
                        <textarea
                          value={formData.description}
                          onChange={(e) => updateField('description', e.target.value)}
                          style={{
                            ...inputStyles,
                            minHeight: '80px',
                            resize: 'vertical',
                            border: `1px solid ${errors.description ? '#ef4444' : '#d1d5db'}`
                          }}
                          placeholder="Enter description"
                          rows={3}
                        />
                        {errors.description && <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{errors.description}</p>}
                      </div>

                      {/* Maintain balances bill-by-bill */}
                      <div>
                        <label style={{ 
                          display: 'flex', 
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '14px', 
                          fontWeight: '500', 
                          color: '#374151', 
                          marginBottom: '12px',
                          fontFamily: 'system-ui, -apple-system, sans-serif',
                          cursor: 'pointer'
                        }}>
                            <input
                              type="checkbox"
                              checked={formData.maintainBalancesBillByBill}
                              onChange={(e) => updateField('maintainBalancesBillByBill', e.target.checked)}
                              disabled={!fieldStates.hasBillByBill}
                              style={{
                                width: '18px',
                                height: '18px',
                                cursor: !fieldStates.hasBillByBill ? 'not-allowed' : 'pointer',
                                accentColor: '#3b82f6',
                                opacity: !fieldStates.hasBillByBill ? 0.6 : 1
                              }}
                            />
                          <span>Maintain balances bill-by-bill</span>
                        </label>
                        
                        {formData.maintainBalancesBillByBill && (
                          <div style={{ marginLeft: '26px', display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
                            {/* Default credit period */}
                            <div>
                              <label style={{ 
                                display: 'block', 
                                fontSize: '13px', 
                                fontWeight: '500', 
                                color: '#374151', 
                                marginBottom: '6px',
                                fontFamily: 'system-ui, -apple-system, sans-serif'
                              }}>
                                Default credit period
                              </label>
                              <input
                                type="text"
                                value={formData.defaultCreditPeriod}
                                onChange={(e) => updateField('defaultCreditPeriod', e.target.value)}
                                disabled={!fieldStates.hasBillByBill}
                                style={{
                                  ...inputStyles,
                                  border: `1px solid ${errors.defaultCreditPeriod ? '#ef4444' : '#d1d5db'}`,
                                  opacity: !fieldStates.hasBillByBill ? 0.6 : 1,
                                  cursor: !fieldStates.hasBillByBill ? 'not-allowed' : 'text',
                                  backgroundColor: !fieldStates.hasBillByBill ? '#f3f4f6' : '#fff'
                                }}
                                placeholder="Enter credit period (e.g., 30 days)"
                              />
                              {errors.defaultCreditPeriod && <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{errors.defaultCreditPeriod}</p>}
                            </div>

                            {/* Check for credit days during voucher entry */}
                            <label style={{ 
                              display: 'flex', 
                              alignItems: 'center',
                              gap: '8px',
                              fontSize: '13px', 
                              fontWeight: '500', 
                              color: '#374151',
                              fontFamily: 'system-ui, -apple-system, sans-serif',
                              cursor: 'pointer'
                            }}>
                              <input
                                type="checkbox"
                                checked={formData.checkCreditDaysDuringVoucher}
                                onChange={(e) => updateField('checkCreditDaysDuringVoucher', e.target.checked)}
                                disabled={!fieldStates.hasBillByBill}
                                style={{
                                  width: '18px',
                                  height: '18px',
                                  cursor: !fieldStates.hasBillByBill ? 'not-allowed' : 'pointer',
                                  accentColor: '#3b82f6',
                                  opacity: !fieldStates.hasBillByBill ? 0.6 : 1
                                }}
                              />
                              <span style={{ opacity: !fieldStates.hasBillByBill ? 0.6 : 1 }}>Check for credit days during voucher entry</span>
                            </label>
                          </div>
                        )}
                      </div>

                      {/* Specify credit limit */}
                      <div>
                        <label style={{ 
                          display: 'flex', 
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '14px', 
                          fontWeight: '500', 
                          color: '#374151', 
                          marginBottom: '12px',
                          fontFamily: 'system-ui, -apple-system, sans-serif',
                          cursor: 'pointer'
                        }}>
                          <input
                            type="checkbox"
                            checked={formData.specifyCreditLimit}
                            onChange={(e) => updateField('specifyCreditLimit', e.target.checked)}
                            style={{
                              width: '18px',
                              height: '18px',
                              cursor: 'pointer',
                              accentColor: '#3b82f6'
                            }}
                          />
                          <span>Specify credit limit</span>
                        </label>
                        
                        {formData.specifyCreditLimit && (
                          <div style={{ marginLeft: '26px', display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
                            {/* Credit Limit Amount */}
                            <div>
                              <label style={{ 
                                display: 'block', 
                                fontSize: '13px', 
                                fontWeight: '500', 
                                color: '#374151', 
                                marginBottom: '6px',
                                fontFamily: 'system-ui, -apple-system, sans-serif'
                              }}>
                                Credit Limit Amount
                              </label>
                              <input
                                type="number"
                                value={formData.creditLimitAmount}
                                onChange={(e) => updateField('creditLimitAmount', e.target.value)}
                                style={{
                                  ...inputStyles,
                                  border: `1px solid ${errors.creditLimitAmount ? '#ef4444' : '#d1d5db'}`
                                }}
                                placeholder="Enter credit limit amount"
                                min="0"
                                step="0.01"
                              />
                              {errors.creditLimitAmount && <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{errors.creditLimitAmount}</p>}
                            </div>

                            {/* Override credit limit using post-dated transactions */}
                            <label style={{ 
                              display: 'flex', 
                              alignItems: 'center',
                              gap: '8px',
                              fontSize: '13px', 
                              fontWeight: '500', 
                              color: '#374151',
                              fontFamily: 'system-ui, -apple-system, sans-serif',
                              cursor: 'pointer'
                            }}>
                              <input
                                type="checkbox"
                                checked={formData.overrideCreditLimitPostDated}
                                onChange={(e) => updateField('overrideCreditLimitPostDated', e.target.checked)}
                                style={{
                                  width: '18px',
                                  height: '18px',
                                  cursor: 'pointer',
                                  accentColor: '#3b82f6'
                                }}
                              />
                              <span>Override credit limit using post-dated transactions</span>
                            </label>
                          </div>
                        )}
                      </div>

                      {/* Inventory values are affected */}
                      <div>
                        <label style={{ 
                          display: 'flex', 
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '14px', 
                          fontWeight: '500', 
                          color: '#374151',
                          fontFamily: 'system-ui, -apple-system, sans-serif',
                          cursor: 'pointer'
                        }}>
                          <input
                            type="checkbox"
                            checked={formData.inventoryValuesAffected}
                            onChange={(e) => updateField('inventoryValuesAffected', e.target.checked)}
                            style={{
                              width: '18px',
                              height: '18px',
                              cursor: 'pointer',
                              accentColor: '#3b82f6'
                            }}
                          />
                          <span>Inventory values are affected</span>
                        </label>
                      </div>

                      {/* Price level applicable */}
                      <div>
                        <label style={{ 
                          display: 'flex', 
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '14px', 
                          fontWeight: '500', 
                          color: '#374151',
                          fontFamily: 'system-ui, -apple-system, sans-serif',
                          cursor: 'pointer'
                        }}>
                        <input
                          type="checkbox"
                          checked={formData.priceLevelApplicable}
                          onChange={(e) => updateField('priceLevelApplicable', e.target.checked)}
                          disabled={!fieldStates.hasPriceLevel}
                          style={{
                            width: '18px',
                            height: '18px',
                            cursor: !fieldStates.hasPriceLevel ? 'not-allowed' : 'pointer',
                            accentColor: '#3b82f6',
                            opacity: !fieldStates.hasPriceLevel ? 0.6 : 1
                          }}
                        />
                        <span style={{ opacity: !fieldStates.hasPriceLevel ? 0.6 : 1 }}>Price level applicable</span>
                        </label>
                        
                        {formData.priceLevelApplicable && (
                          <div style={{ marginLeft: '26px', marginTop: '12px' }}>
                            {/* Price Level Dropdown */}
                            <div>
                              <label style={{ 
                                display: 'block', 
                                fontSize: '13px', 
                                fontWeight: '500', 
                                color: '#374151', 
                                marginBottom: '6px',
                                fontFamily: 'system-ui, -apple-system, sans-serif'
                              }}>
                                Price Level
                              </label>
                              <select
                                value={formData.priceLevel}
                                onChange={(e) => updateField('priceLevel', e.target.value)}
                                style={{
                                  ...selectStyles,
                                  border: `1px solid ${errors.priceLevel ? '#ef4444' : '#d1d5db'}`,
                                  opacity: !fieldStates.hasPriceLevel ? 0.6 : 1,
                                  cursor: !fieldStates.hasPriceLevel ? 'not-allowed' : 'pointer'
                                }}
                                disabled={loadingPriceLevels || !fieldStates.hasPriceLevel}
                              >
                                <option value="">Select Price Level</option>
                                {priceLevels.map((level, index) => {
                                  // Handle different possible price level object structures
                                  // Tally API typically uses MASTERID and NAME
                                  const levelName = level.NAME || level.name || level.priceLevelName || level.label || String(level) || '';
                                  const levelValue = level.NAME || level.name || level.priceLevelName || level.MASTERID || level.id || level.value || String(level) || '';
                                  
                                  // Use index as fallback key if value is empty
                                  const key = levelValue || `priceLevel-${index}`;
                                  
                                  return (
                                    <option key={key} value={levelValue}>
                                      {levelName || levelValue || 'Unnamed Price Level'}
                                    </option>
                                  );
                                })}
                              </select>
                              {loadingPriceLevels && (
                                <p style={{ color: '#6b7280', fontSize: '12px', marginTop: '4px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                                  Loading price levels...
                                </p>
                              )}
                              {errors.priceLevel && <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{errors.priceLevel}</p>}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}

          {/* Address Tab */}
          {activeTab === 'address' && (
            <div>
              {!fieldStates.hasAddress && (
                <div style={{
                  padding: '12px 16px',
                  backgroundColor: '#fef3c7',
                  border: '1px solid #fbbf24',
                  borderRadius: '6px',
                  marginBottom: '16px'
                }}>
                  <p style={{ 
                    color: '#92400e', 
                    fontSize: '14px', 
                    margin: '0',
                    fontFamily: 'system-ui, -apple-system, sans-serif'
                  }}>
                    Address Details are disabled for the selected group.
                  </p>
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {formData.addresses.map((addr, index) => (
                  <div key={index} style={{ 
                    padding: '20px', 
                    backgroundColor: '#f9fafb', 
                    borderRadius: '8px', 
                    border: '1px solid #e5e7eb',
                    position: 'relative'
                  }}>
                    {formData.addresses.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeAddress(index)}
                        style={{
                          position: 'absolute',
                          top: '16px',
                          right: '16px',
                          padding: '6px 12px',
                          backgroundColor: '#ef4444',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '500',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          transition: 'background-color 0.2s',
                          fontFamily: 'system-ui, -apple-system, sans-serif'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.backgroundColor = '#dc2626';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.backgroundColor = '#ef4444';
                        }}
                      >
                        <span className="material-icons" style={{ fontSize: '16px' }}>delete</span>
                        Remove
                      </button>
                    )}
                    
                    <h3 style={{ 
                      fontSize: '16px', 
                      fontWeight: '600', 
                      color: '#374151', 
                      marginBottom: '16px',
                      fontFamily: 'system-ui, -apple-system, sans-serif'
                    }}>
                      Address {index + 1}
                    </h3>

                    <div className="master-form-grid" style={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'repeat(2, 1fr)', 
                      gap: '24px',
                      alignItems: 'start'
                    }}>
                      {/* Address */}
                      <div style={{ gridColumn: 'span 2' }}>
                        <label style={{ 
                          display: 'block', 
                          fontSize: '14px', 
                          fontWeight: '500', 
                          color: '#374151', 
                          marginBottom: '6px',
                          fontFamily: 'system-ui, -apple-system, sans-serif'
                        }}>
                          {MASTER_CONSTANTS.FORM_LABELS.ADDRESS}
                        </label>
                        <textarea
                          value={addr.address}
                          onChange={(e) => updateAddressField(index, 'address', e.target.value)}
                          disabled={!fieldStates.hasAddress}
                          style={{
                            ...inputStyles,
                            minHeight: '80px',
                            resize: 'vertical',
                            fontFamily: 'system-ui, -apple-system, sans-serif',
                            opacity: !fieldStates.hasAddress ? 0.6 : 1,
                            cursor: !fieldStates.hasAddress ? 'not-allowed' : 'text',
                            backgroundColor: !fieldStates.hasAddress ? '#f3f4f6' : '#fff'
                          }}
                          placeholder="Enter complete address"
                          rows={3}
                        />
                      </div>

                      {/* Country */}
                      <div>
                        <label style={{ 
                          display: 'block', 
                          fontSize: '14px', 
                          fontWeight: '500', 
                          color: '#374151', 
                          marginBottom: '6px',
                          fontFamily: 'system-ui, -apple-system, sans-serif'
                        }}>
                          {MASTER_CONSTANTS.FORM_LABELS.COUNTRY}
                        </label>
                        <div style={{ opacity: !fieldStates.hasAddress ? 0.6 : 1, pointerEvents: !fieldStates.hasAddress ? 'none' : 'auto' }}>
                          <SearchableDropdown
                            options={MASTER_CONSTANTS.COUNTRIES}
                            value={addr.country}
                            onChange={(value) => updateAddressField(index, 'country', value)}
                            placeholder="Start typing to search countries..."
                            style={{
                              ...inputStyles,
                              border: `1px solid ${errors[`address_${index}_country`] ? '#ef4444' : '#d1d5db'}`,
                              backgroundColor: !fieldStates.hasAddress ? '#f3f4f6' : '#fff'
                            }}
                            error={!!errors[`address_${index}_country`]}
                          />
                        </div>
                        {errors[`address_${index}_country`] && <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{errors[`address_${index}_country`]}</p>}
                      </div>

                      {/* State */}
                      <div>
                        <label style={{ 
                          display: 'block', 
                          fontSize: '14px', 
                          fontWeight: '500', 
                          color: '#374151', 
                          marginBottom: '6px',
                          fontFamily: 'system-ui, -apple-system, sans-serif'
                        }}>
                          {MASTER_CONSTANTS.FORM_LABELS.STATE}
                        </label>
                        <div style={{ opacity: !fieldStates.hasAddress ? 0.6 : 1, pointerEvents: !fieldStates.hasAddress ? 'none' : 'auto' }}>
                          <SearchableDropdown
                            options={MASTER_CONSTANTS.INDIAN_STATES}
                            value={addr.state}
                            onChange={(value) => updateAddressField(index, 'state', value)}
                            placeholder="Start typing to search states..."
                            style={{
                              ...inputStyles,
                              border: `1px solid ${errors[`address_${index}_state`] ? '#ef4444' : '#d1d5db'}`,
                              backgroundColor: !fieldStates.hasAddress ? '#f3f4f6' : '#fff'
                            }}
                            error={!!errors[`address_${index}_state`]}
                          />
                        </div>
                        {errors[`address_${index}_state`] && <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{errors[`address_${index}_state`]}</p>}
                      </div>

                      {/* Pincode */}
                      <div>
                        <label style={{ 
                          display: 'block', 
                          fontSize: '14px', 
                          fontWeight: '500', 
                          color: '#374151', 
                          marginBottom: '6px',
                          fontFamily: 'system-ui, -apple-system, sans-serif'
                        }}>
                          {MASTER_CONSTANTS.FORM_LABELS.PINCODE}
                        </label>
                        <input
                          type="text"
                          value={addr.pincode}
                          onChange={(e) => updateAddressField(index, 'pincode', e.target.value)}
                          maxLength={6}
                          disabled={!fieldStates.hasAddress}
                          style={{
                            ...inputStyles,
                            border: `1px solid ${errors[`address_${index}_pincode`] ? '#ef4444' : '#d1d5db'}`,
                            opacity: !fieldStates.hasAddress ? 0.6 : 1,
                            cursor: !fieldStates.hasAddress ? 'not-allowed' : 'text',
                            backgroundColor: !fieldStates.hasAddress ? '#f3f4f6' : '#fff'
                          }}
                          placeholder="Enter 6-digit pincode"
                        />
                        {errors[`address_${index}_pincode`] && <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{errors[`address_${index}_pincode`]}</p>}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Add Address Button */}
                {fieldStates.hasMultipleAddresses && (
                  <div>
                    <button
                      type="button"
                      onClick={addAddress}
                      disabled={!fieldStates.hasAddress}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        padding: '12px 24px',
                        backgroundColor: !fieldStates.hasAddress ? '#9ca3af' : '#3b82f6',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: '500',
                        cursor: !fieldStates.hasAddress ? 'not-allowed' : 'pointer',
                        transition: 'background-color 0.2s',
                        fontFamily: 'system-ui, -apple-system, sans-serif',
                        width: '100%',
                        opacity: !fieldStates.hasAddress ? 0.6 : 1
                      }}
                      onMouseEnter={(e) => {
                        if (fieldStates.hasAddress) {
                          e.target.style.backgroundColor = '#2563eb';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (fieldStates.hasAddress) {
                          e.target.style.backgroundColor = '#3b82f6';
                        }
                      }}
                    >
                      <span className="material-icons" style={{ fontSize: '18px' }}>add</span>
                      Add Address
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Contact Details Tab */}
          {activeTab === 'contact' && (
            <div>
              {!fieldStates.hasAddress && (
                <div style={{
                  padding: '12px 16px',
                  backgroundColor: '#fef3c7',
                  border: '1px solid #fbbf24',
                  borderRadius: '6px',
                  marginBottom: '16px'
                }}>
                  <p style={{ 
                    color: '#92400e', 
                    fontSize: '14px', 
                    margin: '0',
                    fontFamily: 'system-ui, -apple-system, sans-serif'
                  }}>
                    Contact Details are disabled for the selected group.
                  </p>
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {formData.contacts.map((contact, index) => (
                  <div key={index} style={{ 
                    padding: '20px', 
                    backgroundColor: '#f9fafb', 
                    borderRadius: '8px', 
                    border: '1px solid #e5e7eb',
                    position: 'relative'
                  }}>
                    {formData.contacts.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeContact(index)}
                        style={{
                          position: 'absolute',
                          top: '16px',
                          right: '16px',
                          padding: '6px 12px',
                          backgroundColor: '#ef4444',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '500',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          transition: 'background-color 0.2s',
                          fontFamily: 'system-ui, -apple-system, sans-serif'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.backgroundColor = '#dc2626';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.backgroundColor = '#ef4444';
                        }}
                      >
                        <span className="material-icons" style={{ fontSize: '16px' }}>delete</span>
                        Remove
                      </button>
                    )}
                    
                    <h3 style={{ 
                      fontSize: '16px', 
                      fontWeight: '600', 
                      color: '#374151', 
                      marginBottom: '16px',
                      fontFamily: 'system-ui, -apple-system, sans-serif'
                    }}>
                      {index === 0 ? 'Primary Contact' : `Contact ${index + 1}`}
                    </h3>

                    <div className="master-form-grid" style={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'repeat(2, 1fr)', 
                      gap: '24px',
                      alignItems: 'start'
                    }}>
                      {/* Contact Person/Name */}
                      <div>
                        <label style={{ 
                          display: 'block', 
                          fontSize: '14px', 
                          fontWeight: '500', 
                          color: '#374151', 
                          marginBottom: '6px',
                          fontFamily: 'system-ui, -apple-system, sans-serif'
                        }}>
                          {index === 0 ? MASTER_CONSTANTS.FORM_LABELS.CONTACT_PERSON : 'Contact Name'}
                        </label>
                        <input
                          type="text"
                          value={contact.contactPerson}
                          onChange={(e) => updateContactField(index, 'contactPerson', e.target.value)}
                          disabled={!fieldStates.hasAddress}
                          style={{
                            ...inputStyles,
                            border: `1px solid ${errors[`contact_${index}_contactPerson`] ? '#ef4444' : '#d1d5db'}`,
                            opacity: !fieldStates.hasAddress ? 0.6 : 1,
                            cursor: !fieldStates.hasAddress ? 'not-allowed' : 'text',
                            backgroundColor: !fieldStates.hasAddress ? '#f3f4f6' : '#fff'
                          }}
                          placeholder={index === 0 ? "Enter contact person name" : "Enter contact name"}
                        />
                        {errors[`contact_${index}_contactPerson`] && <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{errors[`contact_${index}_contactPerson`]}</p>}
                      </div>

                      {/* Email ID - Only for first contact */}
                      {index === 0 && (
                        <>
                          <div>
                            <label style={{ 
                              display: 'block', 
                              fontSize: '14px', 
                              fontWeight: '500', 
                              color: '#374151', 
                              marginBottom: '6px',
                              fontFamily: 'system-ui, -apple-system, sans-serif'
                            }}>
                              {MASTER_CONSTANTS.FORM_LABELS.EMAIL_ID}
                            </label>
                            <input
                              type="email"
                              value={contact.email}
                              onChange={(e) => updateContactField(index, 'email', e.target.value)}
                              disabled={!fieldStates.hasAddress}
                              style={{
                                ...inputStyles,
                                border: `1px solid ${errors[`contact_${index}_email`] ? '#ef4444' : '#d1d5db'}`,
                                opacity: !fieldStates.hasAddress ? 0.6 : 1,
                                cursor: !fieldStates.hasAddress ? 'not-allowed' : 'text',
                                backgroundColor: !fieldStates.hasAddress ? '#f3f4f6' : '#fff'
                              }}
                              placeholder="Enter email address"
                            />
                            {errors[`contact_${index}_email`] && <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{errors[`contact_${index}_email`]}</p>}
                          </div>
                          <div>
                            <label style={{ 
                              display: 'block', 
                              fontSize: '14px', 
                              fontWeight: '500', 
                              color: '#374151', 
                              marginBottom: '6px',
                              fontFamily: 'system-ui, -apple-system, sans-serif'
                            }}>
                              Email CC
                            </label>
                            <input
                              type="email"
                              value={formData.emailCC}
                              onChange={(e) => updateField('emailCC', e.target.value)}
                              disabled={!fieldStates.hasAddress}
                              style={{
                                ...inputStyles,
                                border: `1px solid ${errors.emailCC ? '#ef4444' : '#d1d5db'}`,
                                opacity: !fieldStates.hasAddress ? 0.6 : 1,
                                cursor: !fieldStates.hasAddress ? 'not-allowed' : 'text',
                                backgroundColor: !fieldStates.hasAddress ? '#f3f4f6' : '#fff'
                              }}
                              placeholder="Enter CC email address"
                            />
                            {errors.emailCC && <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{errors.emailCC}</p>}
                          </div>
                        </>
                      )}

                      {/* Phone Number */}
                      <div>
                        <label style={{ 
                          display: 'block', 
                          fontSize: '14px', 
                          fontWeight: '500', 
                          color: '#374151', 
                          marginBottom: '6px',
                          fontFamily: 'system-ui, -apple-system, sans-serif'
                        }}>
                          {MASTER_CONSTANTS.FORM_LABELS.PHONE_NUMBER}
                        </label>
                        <input
                          type="tel"
                          value={contact.phone}
                          onChange={(e) => updateContactField(index, 'phone', e.target.value)}
                          disabled={!fieldStates.hasAddress}
                          style={{
                            ...inputStyles,
                            border: `1px solid ${errors[`contact_${index}_phone`] ? '#ef4444' : '#d1d5db'}`,
                            opacity: !fieldStates.hasAddress ? 0.6 : 1,
                            cursor: !fieldStates.hasAddress ? 'not-allowed' : 'text',
                            backgroundColor: !fieldStates.hasAddress ? '#f3f4f6' : '#fff'
                          }}
                          placeholder="Enter phone number"
                        />
                        {errors[`contact_${index}_phone`] && <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{errors[`contact_${index}_phone`]}</p>}
                      </div>

                      {/* Mobile Number - Only for first contact */}
                      {index === 0 && (
                        <div>
                          <label style={{ 
                            display: 'block', 
                            fontSize: '14px', 
                            fontWeight: '500', 
                            color: '#374151', 
                            marginBottom: '6px',
                            fontFamily: 'system-ui, -apple-system, sans-serif'
                          }}>
                            {MASTER_CONSTANTS.FORM_LABELS.MOBILE_NUMBER}
                          </label>
                          <input
                            type="tel"
                            value={contact.mobile}
                            onChange={(e) => updateContactField(index, 'mobile', e.target.value)}
                            disabled={!fieldStates.hasAddress}
                            style={{
                              ...inputStyles,
                              border: `1px solid ${errors[`contact_${index}_mobile`] ? '#ef4444' : '#d1d5db'}`,
                              opacity: !fieldStates.hasAddress ? 0.6 : 1,
                              cursor: !fieldStates.hasAddress ? 'not-allowed' : 'text',
                              backgroundColor: !fieldStates.hasAddress ? '#f3f4f6' : '#fff'
                            }}
                            placeholder="Enter mobile number"
                          />
                          {errors[`contact_${index}_mobile`] && <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{errors[`contact_${index}_mobile`]}</p>}
                        </div>
                      )}

                      {/* Country ISD Code */}
                      <div>
                        <label style={{ 
                          display: 'block', 
                          fontSize: '14px', 
                          fontWeight: '500', 
                          color: '#374151', 
                          marginBottom: '6px',
                          fontFamily: 'system-ui, -apple-system, sans-serif'
                        }}>
                          Country ISD Code
                        </label>
                        <input
                          type="text"
                          value={contact.countryISDCode || '+91'}
                          onChange={(e) => updateContactField(index, 'countryISDCode', e.target.value)}
                          disabled={!fieldStates.hasAddress}
                          style={{
                            ...inputStyles,
                            border: `1px solid ${errors[`contact_${index}_countryISDCode`] ? '#ef4444' : '#d1d5db'}`,
                            opacity: !fieldStates.hasAddress ? 0.6 : 1,
                            cursor: !fieldStates.hasAddress ? 'not-allowed' : 'text',
                            backgroundColor: !fieldStates.hasAddress ? '#f3f4f6' : '#fff'
                          }}
                          placeholder="+91"
                        />
                        {errors[`contact_${index}_countryISDCode`] && <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{errors[`contact_${index}_countryISDCode`]}</p>}
                      </div>

                      {/* Default WhatsApp Number */}
                      <div>
                        <label style={{ 
                          display: 'flex', 
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '14px', 
                          fontWeight: '500', 
                          color: '#374151', 
                          marginBottom: '6px',
                          fontFamily: 'system-ui, -apple-system, sans-serif',
                          cursor: 'pointer'
                        }}>
                          <input
                            type="checkbox"
                            checked={contact.isDefaultWhatsappNum || false}
                            onChange={(e) => updateContactField(index, 'isDefaultWhatsappNum', e.target.checked)}
                            disabled={!fieldStates.hasAddress}
                            style={{
                              width: '18px',
                              height: '18px',
                              cursor: !fieldStates.hasAddress ? 'not-allowed' : 'pointer',
                              accentColor: '#3b82f6',
                              opacity: !fieldStates.hasAddress ? 0.6 : 1
                            }}
                          />
                          <span>Set as Default WhatsApp Number</span>
                        </label>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Add Contact Button */}
                {fieldStates.hasMultipleAddresses && (
                  <div>
                    <button
                      type="button"
                      onClick={addContact}
                      disabled={!fieldStates.hasAddress}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        padding: '12px 24px',
                        backgroundColor: !fieldStates.hasAddress ? '#9ca3af' : '#3b82f6',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: '500',
                        cursor: !fieldStates.hasAddress ? 'not-allowed' : 'pointer',
                        transition: 'background-color 0.2s',
                        fontFamily: 'system-ui, -apple-system, sans-serif',
                        width: '100%',
                        opacity: !fieldStates.hasAddress ? 0.6 : 1
                      }}
                      onMouseEnter={(e) => {
                        if (fieldStates.hasAddress) {
                          e.target.style.backgroundColor = '#2563eb';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (fieldStates.hasAddress) {
                          e.target.style.backgroundColor = '#3b82f6';
                        }
                      }}
                    >
                      <span className="material-icons" style={{ fontSize: '18px' }}>add</span>
                      Add Contact
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Bank Details Tab */}
          {activeTab === 'bank' && (
            <div>
              {!fieldStates.hasBankDetails && (
                <div style={{
                  padding: '12px 16px',
                  backgroundColor: '#fef3c7',
                  border: '1px solid #fbbf24',
                  borderRadius: '6px',
                  marginBottom: '16px'
                }}>
                  <p style={{ 
                    color: '#92400e', 
                    fontSize: '14px', 
                    margin: '0',
                    fontFamily: 'system-ui, -apple-system, sans-serif'
                  }}>
                    Bank Details are disabled for the selected group.
                  </p>
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {formData.bankDetails.map((bank, index) => (
                  <div key={index} style={{ 
                    padding: '20px', 
                    backgroundColor: '#f9fafb', 
                    borderRadius: '8px', 
                    border: '1px solid #e5e7eb',
                    position: 'relative'
                  }}>
                    {formData.bankDetails.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeBankDetail(index)}
                        style={{
                          position: 'absolute',
                          top: '16px',
                          right: '16px',
                          padding: '6px 12px',
                          backgroundColor: '#ef4444',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '500',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          transition: 'background-color 0.2s',
                          fontFamily: 'system-ui, -apple-system, sans-serif'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.backgroundColor = '#dc2626';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.backgroundColor = '#ef4444';
                        }}
                      >
                        <span className="material-icons" style={{ fontSize: '16px' }}>delete</span>
                        Remove
                      </button>
                    )}
                    
                    <h3 style={{ 
                      fontSize: '16px', 
                      fontWeight: '600', 
                      color: '#374151', 
                      marginBottom: '16px',
                      fontFamily: 'system-ui, -apple-system, sans-serif'
                    }}>
                      Bank Details {index + 1}
                    </h3>

                    <div className="master-form-grid" style={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'repeat(2, 1fr)', 
                      gap: '24px',
                      alignItems: 'start'
                    }}>
                      {/* Account Number */}
                      <div>
                        <label style={{ 
                          display: 'block', 
                          fontSize: '14px', 
                          fontWeight: '500', 
                          color: '#374151', 
                          marginBottom: '6px',
                          fontFamily: 'system-ui, -apple-system, sans-serif'
                        }}>
                          {MASTER_CONSTANTS.FORM_LABELS.ACCOUNT_NUMBER}
                        </label>
                        <input
                          type="text"
                          value={bank.accountNumber}
                          onChange={(e) => updateBankDetailField(index, 'accountNumber', e.target.value)}
                          disabled={!fieldStates.hasBankDetails}
                          style={{
                            ...inputStyles,
                            border: `1px solid ${errors[`bank_${index}_accountNumber`] ? '#ef4444' : '#d1d5db'}`,
                            opacity: !fieldStates.hasBankDetails ? 0.6 : 1,
                            cursor: !fieldStates.hasBankDetails ? 'not-allowed' : 'text',
                            backgroundColor: !fieldStates.hasBankDetails ? '#f3f4f6' : '#fff'
                          }}
                          placeholder={MASTER_CONSTANTS.PLACEHOLDERS.ACCOUNT_NUMBER}
                        />
                        {errors[`bank_${index}_accountNumber`] && <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{errors[`bank_${index}_accountNumber`]}</p>}
                      </div>

                      {/* IFSC Code */}
                      <div>
                        <label style={{ 
                          display: 'block', 
                          fontSize: '14px', 
                          fontWeight: '500', 
                          color: '#374151', 
                          marginBottom: '6px',
                          fontFamily: 'system-ui, -apple-system, sans-serif'
                        }}>
                          {MASTER_CONSTANTS.FORM_LABELS.IFSC_CODE}
                        </label>
                        <input
                          type="text"
                          value={bank.ifscCode}
                          onChange={(e) => updateBankDetailField(index, 'ifscCode', e.target.value.toUpperCase())}
                          maxLength={11}
                          disabled={!fieldStates.hasBankDetails}
                          style={{
                            ...inputStyles,
                            border: `1px solid ${errors[`bank_${index}_ifscCode`] ? '#ef4444' : '#d1d5db'}`,
                            opacity: !fieldStates.hasBankDetails ? 0.6 : 1,
                            cursor: !fieldStates.hasBankDetails ? 'not-allowed' : 'text'
                          }}
                          placeholder={MASTER_CONSTANTS.PLACEHOLDERS.IFSC}
                        />
                        {errors[`bank_${index}_ifscCode`] && <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{errors[`bank_${index}_ifscCode`]}</p>}
                      </div>

                      {/* Bank Name */}
                      <div>
                        <label style={{ 
                          display: 'block', 
                          fontSize: '14px', 
                          fontWeight: '500', 
                          color: '#374151', 
                          marginBottom: '6px',
                          fontFamily: 'system-ui, -apple-system, sans-serif'
                        }}>
                          {MASTER_CONSTANTS.FORM_LABELS.BANK_NAME}
                        </label>
                        <div style={{ 
                          opacity: !fieldStates.hasBankDetails ? 0.6 : 1, 
                          pointerEvents: !fieldStates.hasBankDetails ? 'none' : 'auto',
                          position: 'relative'
                        }}>
                          <SearchableDropdown
                            options={banks.map(bankName => ({ value: bankName, label: bankName }))}
                            value={bank.bankName}
                            onChange={(value) => updateBankDetailField(index, 'bankName', value)}
                            placeholder="Search or select bank name"
                            style={{
                              ...inputStyles,
                              border: `1px solid ${errors[`bank_${index}_bankName`] ? '#ef4444' : '#d1d5db'}`,
                              width: '100%',
                              padding: '12px 16px',
                              borderRadius: '8px',
                              fontSize: '14px',
                              fontFamily: 'system-ui, -apple-system, sans-serif',
                              backgroundColor: !fieldStates.hasBankDetails ? '#f3f4f6' : '#fff',
                              cursor: !fieldStates.hasBankDetails ? 'not-allowed' : 'text',
                              transition: 'all 0.2s'
                            }}
                            error={!!errors[`bank_${index}_bankName`]}
                          />
                        </div>
                        {errors[`bank_${index}_bankName`] && <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{errors[`bank_${index}_bankName`]}</p>}
                      </div>

                      {/* Swift Code */}
                      <div>
                        <label style={{ 
                          display: 'block', 
                          fontSize: '14px', 
                          fontWeight: '500', 
                          color: '#374151', 
                          marginBottom: '6px',
                          fontFamily: 'system-ui, -apple-system, sans-serif'
                        }}>
                          Swift Code
                        </label>
                        <input
                          type="text"
                          value={bank.swiftCode || ''}
                          onChange={(e) => updateBankDetailField(index, 'swiftCode', e.target.value.toUpperCase())}
                          disabled={!fieldStates.hasBankDetails}
                          style={{
                            ...inputStyles,
                            border: `1px solid ${errors[`bank_${index}_swiftCode`] ? '#ef4444' : '#d1d5db'}`,
                            opacity: !fieldStates.hasBankDetails ? 0.6 : 1,
                            cursor: !fieldStates.hasBankDetails ? 'not-allowed' : 'text',
                            backgroundColor: !fieldStates.hasBankDetails ? '#f3f4f6' : '#fff'
                          }}
                          placeholder="Enter SWIFT code"
                        />
                        {errors[`bank_${index}_swiftCode`] && <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{errors[`bank_${index}_swiftCode`]}</p>}
                      </div>

                      {/* Payment Favouring */}
                      <div>
                        <label style={{ 
                          display: 'block', 
                          fontSize: '14px', 
                          fontWeight: '500', 
                          color: '#374151', 
                          marginBottom: '6px',
                          fontFamily: 'system-ui, -apple-system, sans-serif'
                        }}>
                          Payment Favouring
                        </label>
                        <input
                          type="text"
                          value={bank.paymentFavouring || ''}
                          onChange={(e) => updateBankDetailField(index, 'paymentFavouring', e.target.value)}
                          disabled={!fieldStates.hasBankDetails}
                          style={{
                            ...inputStyles,
                            border: `1px solid ${errors[`bank_${index}_paymentFavouring`] ? '#ef4444' : '#d1d5db'}`,
                            opacity: !fieldStates.hasBankDetails ? 0.6 : 1,
                            cursor: !fieldStates.hasBankDetails ? 'not-allowed' : 'text',
                            backgroundColor: !fieldStates.hasBankDetails ? '#f3f4f6' : '#fff'
                          }}
                          placeholder="Enter payment favouring name"
                        />
                        {errors[`bank_${index}_paymentFavouring`] && <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{errors[`bank_${index}_paymentFavouring`]}</p>}
                      </div>

                      {/* Bank ID */}
                      <div>
                        <label style={{ 
                          display: 'block', 
                          fontSize: '14px', 
                          fontWeight: '500', 
                          color: '#374151', 
                          marginBottom: '6px',
                          fontFamily: 'system-ui, -apple-system, sans-serif'
                        }}>
                          Bank ID
                        </label>
                        <input
                          type="text"
                          value={bank.bankId || ''}
                          onChange={(e) => updateBankDetailField(index, 'bankId', e.target.value)}
                          disabled={!fieldStates.hasBankDetails}
                          style={{
                            ...inputStyles,
                            border: `1px solid ${errors[`bank_${index}_bankId`] ? '#ef4444' : '#d1d5db'}`,
                            opacity: !fieldStates.hasBankDetails ? 0.6 : 1,
                            cursor: !fieldStates.hasBankDetails ? 'not-allowed' : 'text',
                            backgroundColor: !fieldStates.hasBankDetails ? '#f3f4f6' : '#fff'
                          }}
                          placeholder="Enter bank ID"
                        />
                        {errors[`bank_${index}_bankId`] && <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{errors[`bank_${index}_bankId`]}</p>}
                      </div>

                      {/* Default Transaction Type */}
                      <div>
                        <label style={{ 
                          display: 'block', 
                          fontSize: '14px', 
                          fontWeight: '500', 
                          color: '#374151', 
                          marginBottom: '6px',
                          fontFamily: 'system-ui, -apple-system, sans-serif'
                        }}>
                          Default Transaction Type
                        </label>
                        <select
                          value={bank.defaultTransactionType || 'Inter Bank Transfer'}
                          onChange={(e) => updateBankDetailField(index, 'defaultTransactionType', e.target.value)}
                          disabled={!fieldStates.hasBankDetails}
                          style={{
                            ...selectStyles,
                            border: `1px solid ${errors[`bank_${index}_defaultTransactionType`] ? '#ef4444' : '#d1d5db'}`,
                            opacity: !fieldStates.hasBankDetails ? 0.6 : 1,
                            cursor: !fieldStates.hasBankDetails ? 'not-allowed' : 'pointer',
                            backgroundColor: !fieldStates.hasBankDetails ? '#f3f4f6' : '#fff'
                          }}
                        >
                          <option value="Inter Bank Transfer">Inter Bank Transfer</option>
                          <option value="Intra Bank Transfer">Intra Bank Transfer</option>
                          <option value="RTGS">RTGS</option>
                          <option value="NEFT">NEFT</option>
                          <option value="IMPS">IMPS</option>
                          <option value="UPI">UPI</option>
                        </select>
                        {errors[`bank_${index}_defaultTransactionType`] && <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{errors[`bank_${index}_defaultTransactionType`]}</p>}
                      </div>

                      {/* Set as Default */}
                      <div>
                        <label style={{ 
                          display: 'flex', 
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '14px', 
                          fontWeight: '500', 
                          color: '#374151', 
                          marginBottom: '6px',
                          fontFamily: 'system-ui, -apple-system, sans-serif',
                          cursor: 'pointer'
                        }}>
                          <input
                            type="checkbox"
                            checked={bank.setAsDefault || (index === 0)}
                            onChange={(e) => {
                              updateBankDetailField(index, 'setAsDefault', e.target.checked);
                              // Uncheck others if this is set as default
                              if (e.target.checked) {
                                formData.bankDetails.forEach((b, i) => {
                                  if (i !== index) {
                                    updateBankDetailField(i, 'setAsDefault', false);
                                  }
                                });
                              }
                            }}
                            disabled={!fieldStates.hasBankDetails}
                            style={{
                              width: '18px',
                              height: '18px',
                              cursor: !fieldStates.hasBankDetails ? 'not-allowed' : 'pointer',
                              accentColor: '#3b82f6',
                              opacity: !fieldStates.hasBankDetails ? 0.6 : 1
                            }}
                          />
                          <span>Set as Default</span>
                        </label>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Add Bank Details Button */}
                {fieldStates.hasMultipleBanks && (
                  <div>
                    <button
                      type="button"
                      onClick={addBankDetail}
                      disabled={!fieldStates.hasBankDetails}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        padding: '12px 24px',
                        backgroundColor: !fieldStates.hasBankDetails ? '#9ca3af' : '#3b82f6',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: '500',
                        cursor: !fieldStates.hasBankDetails ? 'not-allowed' : 'pointer',
                        transition: 'background-color 0.2s',
                        fontFamily: 'system-ui, -apple-system, sans-serif',
                        width: '100%',
                        opacity: !fieldStates.hasBankDetails ? 0.6 : 1
                      }}
                      onMouseEnter={(e) => {
                        if (fieldStates.hasBankDetails) {
                          e.target.style.backgroundColor = '#2563eb';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (fieldStates.hasBankDetails) {
                          e.target.style.backgroundColor = '#3b82f6';
                        }
                      }}
                    >
                      <span className="material-icons" style={{ fontSize: '18px' }}>add</span>
                      Add Bank Details
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Statutory Tab */}
          {activeTab === 'statutory' && (
            <div>
              <div className="master-form-grid" style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(3, 1fr)', 
                gap: '24px',
                alignItems: 'start'
              }}>
                {/* Tax Type Selection */}
                <div>
                  <label style={{ 
                    display: 'block', 
                    fontSize: '14px', 
                    fontWeight: '500', 
                    color: '#374151', 
                    marginBottom: '6px',
                    fontFamily: 'system-ui, -apple-system, sans-serif'
                  }}>
                    Tax Identification Type
                  </label>
                  <select
                    value={formData.tax_type}
                    onChange={(e) => {
                      updateField('tax_type', e.target.value);
                      // Clear the other field when switching
                      if (e.target.value === 'PAN') {
                        updateField('gstinno', '');
                        setIsPANAutoFilled(false);
                      } else if (e.target.value === 'GST') {
                        updateField('panno', '');
                        setIsPANAutoFilled(false);
                      }
                    }}
                    style={{
                      ...selectStyles,
                      border: `1px solid ${errors.tax_type ? '#ef4444' : '#d1d5db'}`
                    }}
                  >
                    <option value="">Select Tax Type</option>
                    <option value="PAN">PAN Number</option>
                    {fieldStates.hasGST && <option value="GST">GST Number</option>}
                  </select>
                  {errors.tax_type && <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{errors.tax_type}</p>}
                </div>

                {/* Tax Registration Details - Show when GST or PAN is selected */}
                {(formData.tax_type === 'GST' || formData.tax_type === 'PAN') && (
                  <>
                    {/* GST Number and PAN Number - Show above Tax Registration Details */}
                    <div style={{ gridColumn: 'span 3', display: 'grid', gridTemplateColumns: formData.tax_type === 'GST' ? '1.5fr 1fr' : 'max-content', gap: '24px', marginBottom: '16px' }}>
                      {/* GST Number - Show only when GST is selected */}
                      {formData.tax_type === 'GST' && (
                        <div>
                          <label style={{ 
                            display: 'block', 
                            fontSize: '14px', 
                            fontWeight: '500', 
                            color: '#374151', 
                            marginBottom: '6px',
                            fontFamily: 'system-ui, -apple-system, sans-serif'
                          }}>
                            {MASTER_CONSTANTS.FORM_LABELS.GST_NUMBER}
                          </label>
                          <div style={{ position: 'relative', display: 'flex', gap: '8px', alignItems: 'stretch', width: '100%', overflow: 'visible' }}>
                            <input
                              type="text"
                              value={formData.gstinno}
                              onChange={(e) => {
                            const inputValue = e.target.value;
                            
                            // Apply regex-based formatting
                            const formatted = formatGST(inputValue);
                            updateField('gstinno', formatted);
                            
                            // Auto-fill PAN from GST number (extract from cleaned value)
                            if (formatted.length >= 12) {
                              const extractedPAN = extractPANFromGST(formatted);
                              if (extractedPAN && validatePAN(extractedPAN)) {
                                const formattedPAN = formatPAN(extractedPAN);
                                updateField('panno', formattedPAN);
                                setIsPANAutoFilled(true);
                              }
                            } else {
                              // Clear PAN if GST is not long enough
                              if (isPANAutoFilled) {
                                updateField('panno', '');
                                setIsPANAutoFilled(false);
                              }
                            }
                          }}
                          onBlur={() => handleFieldBlur('gstinno')}
                          maxLength={30}
                          disabled={!fieldStates.hasGST}
                          style={{
                            ...inputStyles,
                            border: `1px solid ${
                              errors.gstinno 
                                ? '#ef4444' 
                                : duplicateCheck.gstinno.isDuplicate 
                                  ? '#ef4444' 
                                  : (touchedFields.gstinno && formData.gstinno && formData.gstinno.length > 0 && formData.gstinno.length < 15)
                                    ? '#ef4444'
                                    : '#d1d5db'
                            }`,
                            fontFamily: 'monospace',
                            letterSpacing: '1px',
                            paddingRight: duplicateCheck.gstinno.isChecking ? '40px' : '16px',
                            flex: 1,
                            opacity: !fieldStates.hasGST ? 0.6 : 1,
                            cursor: !fieldStates.hasGST ? 'not-allowed' : 'text'
                          }}
                            placeholder="22ABCDE1234F1Z5"
                          />
                          {/* Debug: Log button render */}
                          {console.log('🔍 Rendering GST Upload Button:', { 
                            isGoogleDriveConfigured, 
                            taxType: formData.tax_type,
                            willRender: formData.tax_type === 'GST'
                          })}
                          <button
                            type="button"
                            onClick={() => {
                              if (isGoogleDriveConfigured) {
                                openDrivePicker('gst');
                              } else {
                                setGoogleDriveMessage({
                                  type: 'error',
                                  title: 'Google Drive Not Configured',
                                  message: 'Please add REACT_APP_GOOGLE_API_KEY to your .env file and restart the server to enable document uploads.'
                                });
                              }
                            }}
                            disabled={isUploadingDocument.gst || !isGoogleDriveConfigured}
                            style={{
                              padding: '10px 16px',
                              backgroundColor: (!isGoogleDriveConfigured || isUploadingDocument.gst) ? '#9ca3af' : '#3b82f6',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '8px',
                              cursor: (!isGoogleDriveConfigured || isUploadingDocument.gst) ? 'not-allowed' : 'pointer',
                              opacity: (!isGoogleDriveConfigured || isUploadingDocument.gst) ? 0.6 : 1,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              fontSize: '14px',
                              fontWeight: '500',
                              whiteSpace: 'nowrap',
                              transition: 'background-color 0.2s',
                              position: 'relative'
                            }}
                            onMouseEnter={(e) => {
                              if (isGoogleDriveConfigured && !isUploadingDocument.gst) {
                                e.target.style.backgroundColor = '#2563eb';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (isGoogleDriveConfigured && !isUploadingDocument.gst) {
                                e.target.style.backgroundColor = '#3b82f6';
                              }
                            }}
                            title={!isGoogleDriveConfigured ? 'Google Drive not configured. Add REACT_APP_GOOGLE_API_KEY to .env file.' : 'Upload GST Document'}
                          >
                            {isUploadingDocument.gst ? (
                              <div style={{
                                width: '16px',
                                height: '16px',
                                border: '2px solid #fff',
                                borderTop: '2px solid transparent',
                                borderRadius: '50%',
                                animation: 'spin 1s linear infinite'
                              }}></div>
                            ) : (
                              <>
                                <span className="material-icons" style={{ fontSize: '18px' }}>upload_file</span>
                                {formData.gstDocumentLink && (
                                  <span className="material-icons" style={{ fontSize: '16px', color: '#10b981' }}>check_circle</span>
                                )}
                              </>
                            )}
                          </button>
                          {formData.gstDocumentLink && !isUploadingDocument.gst && (
                            <a
                              href={formData.gstDocumentLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '10px 16px',
                                backgroundColor: '#10b981',
                                color: '#fff',
                                textDecoration: 'none',
                                borderRadius: '8px',
                                fontSize: '14px',
                                fontWeight: '500',
                                whiteSpace: 'nowrap',
                                transition: 'background-color 0.2s'
                              }}
                              onMouseEnter={(e) => {
                                e.target.style.backgroundColor = '#059669';
                              }}
                              onMouseLeave={(e) => {
                                e.target.style.backgroundColor = '#10b981';
                              }}
                              title="View GST Document"
                            >
                              <span className="material-icons" style={{ fontSize: '18px' }}>visibility</span>
                              View Doc
                            </a>
                          )}
                          </div>
                          {errors.gstinno && <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{errors.gstinno}</p>}
                          {duplicateCheck.gstinno.isDuplicate && !errors.gstinno && (
                            <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', fontFamily: 'system-ui, -apple-system, sans-serif', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span className="material-icons" style={{ fontSize: '14px' }}>warning</span>
                              {duplicateCheck.gstinno.message || 'GST number already exists'}
                            </p>
                          )}
                          {!errors.gstinno && !duplicateCheck.gstinno.isDuplicate && formData.gstinno.length > 0 && formData.gstinno.length < 15 && !touchedFields.gstinno && (
                            <p style={{ color: '#6b7280', fontSize: '12px', marginTop: '4px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                              Enter complete 15-character GST number
                            </p>
                          )}
                        </div>
                      )}

                      {/* PAN Number - Show when PAN is selected or when GST is selected */}
                      {(formData.tax_type === 'PAN' || formData.tax_type === 'GST') && (
                        <div style={{ maxWidth: formData.tax_type === 'GST' ? '350px' : '400px' }}>
                          <label style={{ 
                            display: 'block', 
                            fontSize: '14px', 
                            fontWeight: '500', 
                            color: '#374151', 
                            marginBottom: '6px',
                            fontFamily: 'system-ui, -apple-system, sans-serif'
                          }}>
                            {MASTER_CONSTANTS.FORM_LABELS.PAN_NUMBER}
                            <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: '400' }}> (Format: ABCDE1234F)</span>
                            {formData.tax_type === 'GST' && (
                              <span style={{ fontSize: '12px', color: '#059669', fontWeight: '400', marginLeft: '8px' }}>
                                Auto-filled from GST
                              </span>
                            )}
                          </label>
                          <div style={{ position: 'relative', display: 'flex', gap: '8px', alignItems: 'stretch', width: '100%', overflow: 'visible' }}>
                            <input
                              type="text"
                              value={formData.panno}
                              onChange={(e) => {
                                if (formData.tax_type === 'PAN') {
                                  const formatted = formatPAN(e.target.value);
                                  updateField('panno', formatted);
                                }
                                // Don't allow manual editing when GST is selected
                              }}
                              maxLength={10}
                              readOnly={formData.tax_type === 'GST'}
                              style={{
                                ...inputStyles,
                                border: `1px solid ${errors.panno ? '#ef4444' : duplicateCheck.panno.isDuplicate ? '#ef4444' : '#d1d5db'}`,
                                fontFamily: 'monospace',
                                letterSpacing: '1px',
                                backgroundColor: formData.tax_type === 'GST' ? '#f0f9ff' : '#fff',
                                cursor: formData.tax_type === 'GST' ? 'not-allowed' : 'text',
                                paddingRight: duplicateCheck.panno.isChecking ? '40px' : '16px',
                                flex: 1
                              }}
                              onFocus={(e) => {
                                if (formData.tax_type === 'PAN') {
                                  e.target.style.borderColor = '#3b82f6';
                                  e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                                }
                              }}
                              onBlur={(e) => {
                                if (formData.tax_type === 'PAN') {
                                  e.target.style.borderColor = errors.panno ? '#ef4444' : duplicateCheck.panno.isDuplicate ? '#ef4444' : '#d1d5db';
                                  e.target.style.boxShadow = '0 1px 2px 0 rgba(0, 0, 0, 0.05)';
                                }
                              }}
                              placeholder={formData.tax_type === 'GST' ? "Will be auto-filled from GST" : "ABCDE1234F"}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                if (isGoogleDriveConfigured) {
                                  openDrivePicker('pan');
                                } else {
                                  setGoogleDriveMessage({
                                    type: 'error',
                                    title: 'Google Drive Not Configured',
                                    message: 'Please add REACT_APP_GOOGLE_API_KEY to your .env file and restart the server to enable document uploads.'
                                  });
                                }
                              }}
                              disabled={isUploadingDocument.pan || !isGoogleDriveConfigured}
                              style={{
                                padding: '10px 16px',
                                backgroundColor: (!isGoogleDriveConfigured || isUploadingDocument.pan) ? '#9ca3af' : '#3b82f6',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: (!isGoogleDriveConfigured || isUploadingDocument.pan) ? 'not-allowed' : 'pointer',
                                opacity: (!isGoogleDriveConfigured || isUploadingDocument.pan) ? 0.6 : 1,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '14px',
                                fontWeight: '500',
                                whiteSpace: 'nowrap',
                                transition: 'background-color 0.2s',
                                position: 'relative'
                              }}
                              onMouseEnter={(e) => {
                                if (isGoogleDriveConfigured && !isUploadingDocument.pan) {
                                  e.target.style.backgroundColor = '#2563eb';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (isGoogleDriveConfigured && !isUploadingDocument.pan) {
                                  e.target.style.backgroundColor = '#3b82f6';
                                }
                              }}
                              title={!isGoogleDriveConfigured ? 'Google Drive not configured. Add REACT_APP_GOOGLE_API_KEY to .env file.' : 'Upload PAN Document'}
                            >
                              {isUploadingDocument.pan ? (
                                <div style={{
                                  width: '16px',
                                  height: '16px',
                                  border: '2px solid #fff',
                                  borderTop: '2px solid transparent',
                                  borderRadius: '50%',
                                  animation: 'spin 1s linear infinite'
                                }}></div>
                              ) : (
                                <>
                                  <span className="material-icons" style={{ fontSize: '18px' }}>upload_file</span>
                                  {formData.panDocumentLink && (
                                    <span className="material-icons" style={{ fontSize: '16px', color: '#10b981' }}>check_circle</span>
                                  )}
                                </>
                              )}
                            </button>
                            {formData.panDocumentLink && !isUploadingDocument.pan && (
                              <a
                                href={formData.panDocumentLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  padding: '10px 16px',
                                  backgroundColor: '#10b981',
                                  color: '#fff',
                                  textDecoration: 'none',
                                  borderRadius: '8px',
                                  fontSize: '14px',
                                  fontWeight: '500',
                                  whiteSpace: 'nowrap',
                                  transition: 'background-color 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                  e.target.style.backgroundColor = '#059669';
                                }}
                                onMouseLeave={(e) => {
                                  e.target.style.backgroundColor = '#10b981';
                                }}
                                title="View PAN Document"
                              >
                                <span className="material-icons" style={{ fontSize: '18px' }}>visibility</span>
                                View Doc
                              </a>
                            )}
                          </div>
                          {errors.panno && <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{errors.panno}</p>}
                          {duplicateCheck.panno.isDuplicate && !errors.panno && (
                            <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', fontFamily: 'system-ui, -apple-system, sans-serif', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span className="material-icons" style={{ fontSize: '14px' }}>warning</span>
                              {duplicateCheck.panno.message || 'PAN number already exists'}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Name on PAN */}
                      {formData.panno && (
                        <div>
                          <label style={{ 
                            display: 'block', 
                            fontSize: '14px', 
                            fontWeight: '500', 
                            color: '#374151', 
                            marginBottom: '6px',
                            fontFamily: 'system-ui, -apple-system, sans-serif'
                          }}>
                            Name on PAN
                          </label>
                          <input
                            type="text"
                            value={formData.nameOnPan}
                            onChange={(e) => updateField('nameOnPan', e.target.value)}
                            style={{
                              ...inputStyles,
                              border: `1px solid ${errors.nameOnPan ? '#ef4444' : '#d1d5db'}`
                            }}
                            placeholder="Enter name as on PAN card"
                          />
                          {errors.nameOnPan && <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{errors.nameOnPan}</p>}
                        </div>
                      )}
                    </div>

                    {/* Tax Registration Details */}
                    {formData.tax_type === 'GST' && fieldStates.hasGST && (
                      <div style={{ gridColumn: 'span 3', marginTop: '16px', paddingTop: '24px', borderTop: '1px solid #e5e7eb' }}>
                        <h3 style={{ 
                          fontSize: '16px', 
                          fontWeight: '600', 
                          color: '#374151', 
                          marginBottom: '20px',
                          fontFamily: 'system-ui, -apple-system, sans-serif'
                        }}>
                          Tax Registration Details
                        </h3>
                      
                      <div className="master-form-grid" style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(3, 1fr)', 
                        gap: '24px',
                        alignItems: 'start'
                      }}>
                        {/* Registration Type */}
                        <div>
                          <label style={{ 
                            display: 'block', 
                            fontSize: '14px', 
                            fontWeight: '500', 
                            color: '#374151', 
                            marginBottom: '6px',
                            fontFamily: 'system-ui, -apple-system, sans-serif'
                          }}>
                            Registration type
                          </label>
                          <select
                            value={formData.gstRegistrationType}
                            onChange={(e) => updateField('gstRegistrationType', e.target.value)}
                            disabled={!fieldStates.hasGST}
                            style={{
                              ...selectStyles,
                              opacity: !fieldStates.hasGST ? 0.6 : 1,
                              cursor: !fieldStates.hasGST ? 'not-allowed' : 'pointer',
                              backgroundColor: !fieldStates.hasGST ? '#f3f4f6' : '#fff'
                            }}
                          >
                            {MASTER_CONSTANTS.GST_REGISTRATION_TYPES.map((type) => (
                              <option key={type} value={type}>{type}</option>
                            ))}
                          </select>
                        </div>

                        {/* Assessee of Other Territory */}
                        <div>
                          <label style={{ 
                            display: 'block', 
                            fontSize: '14px', 
                            fontWeight: '500', 
                            color: '#374151', 
                            marginBottom: '6px',
                            fontFamily: 'system-ui, -apple-system, sans-serif'
                          }}>
                            Assessee of Other Territory
                          </label>
                          <select
                            value={formData.assesseeOfOtherTerritory ? 'Yes' : 'No'}
                            onChange={(e) => updateField('assesseeOfOtherTerritory', e.target.value === 'Yes')}
                            disabled={!fieldStates.hasGST}
                            style={{
                              ...selectStyles,
                              opacity: !fieldStates.hasGST ? 0.6 : 1,
                              cursor: !fieldStates.hasGST ? 'not-allowed' : 'pointer',
                              backgroundColor: !fieldStates.hasGST ? '#f3f4f6' : '#fff'
                            }}
                          >
                            <option value="No">No</option>
                            <option value="Yes">Yes</option>
                          </select>
                        </div>

                        {/* Use Ledger as common Party */}
                        <div>
                          <label style={{ 
                            display: 'block', 
                            fontSize: '14px', 
                            fontWeight: '500', 
                            color: '#374151', 
                            marginBottom: '6px',
                            fontFamily: 'system-ui, -apple-system, sans-serif'
                          }}>
                            Use Ledger as common Party
                          </label>
                          <select
                            value={formData.useLedgerAsCommonParty ? 'Yes' : 'No'}
                            onChange={(e) => updateField('useLedgerAsCommonParty', e.target.value === 'Yes')}
                            disabled={!fieldStates.hasGST}
                            style={{
                              ...selectStyles,
                              opacity: !fieldStates.hasGST ? 0.6 : 1,
                              cursor: !fieldStates.hasGST ? 'not-allowed' : 'pointer',
                              backgroundColor: !fieldStates.hasGST ? '#f3f4f6' : '#fff'
                            }}
                          >
                            <option value="No">No</option>
                            <option value="Yes">Yes</option>
                          </select>
                        </div>

                        {/* Set/Alter additional GST details */}
                        <div>
                          <label style={{ 
                            display: 'block', 
                            fontSize: '14px', 
                            fontWeight: '500', 
                            color: '#374151', 
                            marginBottom: '6px',
                            fontFamily: 'system-ui, -apple-system, sans-serif'
                          }}>
                            Set/Alter additional GST details
                          </label>
                          <select
                            value={formData.setAlterAdditionalGSTDetails ? 'Yes' : 'No'}
                            onChange={(e) => updateField('setAlterAdditionalGSTDetails', e.target.value === 'Yes')}
                            disabled={!fieldStates.hasGST}
                            style={{
                              ...selectStyles,
                              opacity: !fieldStates.hasGST ? 0.6 : 1,
                              cursor: !fieldStates.hasGST ? 'not-allowed' : 'pointer',
                              backgroundColor: !fieldStates.hasGST ? '#f3f4f6' : '#fff'
                            }}
                          >
                            <option value="No">No</option>
                            <option value="Yes">Yes</option>
                          </select>
                        </div>

                        {/* Ignore prefixes and suffixes in Doc No. for reconciliation */}
                        <div>
                          <label style={{ 
                            display: 'block', 
                            fontSize: '14px', 
                            fontWeight: '500', 
                            color: '#374151', 
                            marginBottom: '6px',
                            fontFamily: 'system-ui, -apple-system, sans-serif'
                          }}>
                            Ignore prefixes and suffixes in Doc No. for reconciliation
                          </label>
                          <select
                            value={formData.ignorePrefixesSuffixesInDocNo ? 'Yes' : 'No'}
                            onChange={(e) => updateField('ignorePrefixesSuffixesInDocNo', e.target.value === 'Yes')}
                            disabled={!fieldStates.hasGST}
                            style={{
                              ...selectStyles,
                              opacity: !fieldStates.hasGST ? 0.6 : 1,
                              cursor: !fieldStates.hasGST ? 'not-allowed' : 'pointer',
                              backgroundColor: !fieldStates.hasGST ? '#f3f4f6' : '#fff'
                            }}
                          >
                            <option value="No">No</option>
                            <option value="Yes">Yes</option>
                          </select>
                        </div>
                      </div>
                    </div>
                    )}
                  </>
                )}

                {/* Separator Line */}
                <div style={{ gridColumn: 'span 3', margin: '24px 0', borderTop: '1px solid #e5e7eb' }}></div>

                {/* Set/Alter MSME Registration Details */}
                <div style={{ gridColumn: 'span 3' }}>
                  <label style={{ 
                    display: 'block', 
                    fontSize: '14px', 
                    fontWeight: '500', 
                    color: '#374151', 
                    marginBottom: '6px',
                    fontFamily: 'system-ui, -apple-system, sans-serif'
                  }}>
                    Set/Alter MSME Registration Details
                  </label>
                  <select
                    value={formData.setAlterMSMERegistrationDetails ? 'Yes' : 'No'}
                    onChange={(e) => updateField('setAlterMSMERegistrationDetails', e.target.value === 'Yes')}
                    disabled={!fieldStates.hasMSME}
                    style={{
                      ...selectStyles,
                      border: `1px solid ${errors.setAlterMSMERegistrationDetails ? '#ef4444' : '#d1d5db'}`,
                      maxWidth: '200px',
                      opacity: !fieldStates.hasMSME ? 0.6 : 1,
                      cursor: !fieldStates.hasMSME ? 'not-allowed' : 'pointer',
                      backgroundColor: !fieldStates.hasMSME ? '#f3f4f6' : '#fff'
                    }}
                  >
                    <option value="No">No</option>
                    <option value="Yes">Yes</option>
                  </select>
                  {errors.setAlterMSMERegistrationDetails && <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{errors.setAlterMSMERegistrationDetails}</p>}
                </div>

                {/* MSME Registration Details - Show only when Yes is selected */}
                {formData.setAlterMSMERegistrationDetails && (
                  <>
                    <div>
                      <label style={{ 
                        display: 'block', 
                        fontSize: '14px', 
                        fontWeight: '500', 
                        color: '#374151', 
                        marginBottom: '6px',
                        fontFamily: 'system-ui, -apple-system, sans-serif'
                      }}>
                        Type of Enterprise
                      </label>
                      <select
                        value={formData.msmeTypeOfEnterprise}
                        onChange={(e) => updateField('msmeTypeOfEnterprise', e.target.value)}
                        style={{
                          ...selectStyles,
                          border: `1px solid ${errors.msmeTypeOfEnterprise ? '#ef4444' : '#d1d5db'}`
                        }}
                        disabled={!fieldStates.hasMSME}
                      >
                        <option value="">Select Type</option>
                        {msmeEnterpriseTypes.map((type, index) => (
                          <option key={index} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                      {errors.msmeTypeOfEnterprise && <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{errors.msmeTypeOfEnterprise}</p>}
                    </div>

                    <div>
                      <label style={{ 
                        display: 'block', 
                        fontSize: '14px', 
                        fontWeight: '500', 
                        color: '#374151', 
                        marginBottom: '6px',
                        fontFamily: 'system-ui, -apple-system, sans-serif'
                      }}>
                        UDYAM Registration Number
                      </label>
                      <input
                        type="text"
                        value={formData.msmeUdyamRegistrationNumber}
                        onChange={(e) => updateField('msmeUdyamRegistrationNumber', e.target.value)}
                        disabled={!fieldStates.hasMSME}
                        style={{
                          ...inputStyles,
                          border: `1px solid ${errors.msmeUdyamRegistrationNumber ? '#ef4444' : '#d1d5db'}`,
                          opacity: !fieldStates.hasMSME ? 0.6 : 1,
                          cursor: !fieldStates.hasMSME ? 'not-allowed' : 'text',
                          backgroundColor: !fieldStates.hasMSME ? '#f3f4f6' : '#fff'
                        }}
                        placeholder="Enter UDYAM Registration Number"
                      />
                      {errors.msmeUdyamRegistrationNumber && <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{errors.msmeUdyamRegistrationNumber}</p>}
                    </div>

                    <div>
                      <label style={{ 
                        display: 'block', 
                        fontSize: '14px', 
                        fontWeight: '500', 
                        color: '#374151', 
                        marginBottom: '6px',
                        fontFamily: 'system-ui, -apple-system, sans-serif'
                      }}>
                        Activity Type
                      </label>
                      <select
                        value={formData.msmeActivityType}
                        onChange={(e) => updateField('msmeActivityType', e.target.value)}
                        disabled={!fieldStates.hasMSME}
                        style={{
                          ...selectStyles,
                          border: `1px solid ${errors.msmeActivityType ? '#ef4444' : '#d1d5db'}`,
                          opacity: !fieldStates.hasMSME ? 0.6 : 1,
                          cursor: !fieldStates.hasMSME ? 'not-allowed' : 'pointer',
                          backgroundColor: !fieldStates.hasMSME ? '#f3f4f6' : '#fff'
                        }}
                      >
                        <option value="Unknown">Unknown</option>
                        {msmeActivityTypes.map((type, index) => (
                          <option key={index} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                      {errors.msmeActivityType && <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{errors.msmeActivityType}</p>}
                    </div>
                  </>
                )}

                {/* Separator Line */}
                <div style={{ gridColumn: 'span 3', margin: '24px 0', borderTop: '1px solid #e5e7eb' }}></div>

                {/* TDS Details */}
                <div style={{ gridColumn: 'span 3' }}>
                  <label style={{ 
                    display: 'block', 
                    fontSize: '14px', 
                    fontWeight: '500', 
                    color: '#374151', 
                    marginBottom: '6px',
                    fontFamily: 'system-ui, -apple-system, sans-serif'
                  }}>
                    Is TDS Deductable
                  </label>
                  <select
                    value={formData.isTDSDeductable ? 'Yes' : 'No'}
                    onChange={(e) => updateField('isTDSDeductable', e.target.value === 'Yes')}
                    disabled={!fieldStates.hasTDS}
                    style={{
                      ...selectStyles,
                      border: `1px solid ${errors.isTDSDeductable ? '#ef4444' : '#d1d5db'}`,
                      maxWidth: '200px',
                      opacity: !fieldStates.hasTDS ? 0.6 : 1,
                      cursor: !fieldStates.hasTDS ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <option value="No">No</option>
                    <option value="Yes">Yes</option>
                  </select>
                  {errors.isTDSDeductable && <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{errors.isTDSDeductable}</p>}
                </div>

                {/* TDS Details - Show only when Yes is selected */}
                {formData.isTDSDeductable && fieldStates.hasTDS && (
                  <>
                    <div>
                      <label style={{ 
                        display: 'block', 
                        fontSize: '14px', 
                        fontWeight: '500', 
                        color: '#374151', 
                        marginBottom: '6px',
                        fontFamily: 'system-ui, -apple-system, sans-serif'
                      }}>
                        Deductee type
                      </label>
                      <select
                        value={formData.deducteeType}
                        onChange={(e) => updateField('deducteeType', e.target.value)}
                        disabled={!fieldStates.hasTDS}
                        style={{
                          ...selectStyles,
                          border: `1px solid ${errors.deducteeType ? '#ef4444' : '#d1d5db'}`,
                          opacity: !fieldStates.hasTDS ? 0.6 : 1,
                          cursor: !fieldStates.hasTDS ? 'not-allowed' : 'pointer',
                          backgroundColor: !fieldStates.hasTDS ? '#f3f4f6' : '#fff'
                        }}
                      >
                        <option value="">Select Deductee Type</option>
                        {tdsDeducteeTypes.map((type, index) => (
                          <option key={index} value={type}>{type}</option>
                        ))}
                      </select>
                      {errors.deducteeType && <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{errors.deducteeType}</p>}
                    </div>

                    <div>
                      <label style={{ 
                        display: 'block', 
                        fontSize: '14px', 
                        fontWeight: '500', 
                        color: '#374151', 
                        marginBottom: '6px',
                        fontFamily: 'system-ui, -apple-system, sans-serif'
                      }}>
                        Nature of Payment
                      </label>
                      <input
                        type="text"
                        value={formData.natureOfPayment}
                        onChange={(e) => updateField('natureOfPayment', e.target.value)}
                        disabled={!fieldStates.hasTDS}
                        style={{
                          ...inputStyles,
                          border: `1px solid ${errors.natureOfPayment ? '#ef4444' : '#d1d5db'}`,
                          opacity: !fieldStates.hasTDS ? 0.6 : 1,
                          cursor: !fieldStates.hasTDS ? 'not-allowed' : 'text',
                          backgroundColor: !fieldStates.hasTDS ? '#f3f4f6' : '#fff'
                        }}
                        placeholder="Enter nature of payment"
                      />
                      {errors.natureOfPayment && <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{errors.natureOfPayment}</p>}
                    </div>

                    <div>
                      <label style={{ 
                        display: 'block', 
                        fontSize: '14px', 
                        fontWeight: '500', 
                        color: '#374151', 
                        marginBottom: '6px',
                        fontFamily: 'system-ui, -apple-system, sans-serif'
                      }}>
                        Deduct TDS in Same Voucher
                      </label>
                      <select
                        value={formData.deductTDSInSameVoucher ? 'Yes' : 'No'}
                        onChange={(e) => updateField('deductTDSInSameVoucher', e.target.value === 'Yes')}
                        disabled={!fieldStates.hasTDS}
                        style={{
                          ...selectStyles,
                          border: `1px solid ${errors.deductTDSInSameVoucher ? '#ef4444' : '#d1d5db'}`,
                          opacity: !fieldStates.hasTDS ? 0.6 : 1,
                          cursor: !fieldStates.hasTDS ? 'not-allowed' : 'pointer'
                        }}
                      >
                        <option value="No">No</option>
                        <option value="Yes">Yes</option>
                      </select>
                      {errors.deductTDSInSameVoucher && <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{errors.deductTDSInSameVoucher}</p>}
                    </div>
                  </>
                )}

              </div>
            </div>
          )}
        </div>

        {/* Form Actions */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          gap: '16px', 
          paddingTop: '24px',
          marginTop: '24px',
          borderTop: '1px solid #e5e7eb'
        }}>
          <button
            type="button"
            onClick={handleCancel}
            style={{
              padding: '12px 32px',
              border: '1px solid #d1d5db',
              color: '#374151',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              backgroundColor: '#fff',
              boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
              minWidth: '120px'
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = '#f9fafb';
              e.target.style.borderColor = '#9ca3af';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = '#fff';
              e.target.style.borderColor = '#d1d5db';
            }}
          >
            {MASTER_CONSTANTS.BUTTON_LABELS.CANCEL}
          </button>
          <button
            type="submit"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '12px 32px',
              background: '#3b82f6',
              color: '#fff',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s',
              border: 'none',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
              minWidth: '160px'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = '#2563eb';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = '#3b82f6';
            }}
          >
            <span className="material-icons" style={{ fontSize: '18px' }}>
              {isApprovalMode ? 'check_circle' : (isEditing ? 'edit' : 'person_add')}
            </span>
            <span>
              {isApprovalMode ? MASTER_CONSTANTS.BUTTON_LABELS.APPROVE_MASTER : 
               (isEditing ? 'Update Master' : 'Create Master')}
            </span>
          </button>
        </div>
      </form>
        </div>
      </div>
    </div>
  );
};

export default MasterForm;