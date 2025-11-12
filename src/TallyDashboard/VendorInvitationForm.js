import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { getApiUrl, GOOGLE_DRIVE_CONFIG, isGoogleDriveFullyConfigured } from '../config';

// Vendor Constants
const VENDOR_CONSTANTS = {
  FORM_LABELS: {
    PAN_NUMBER: 'PAN Number',
    VENDOR_NAME: 'Vendor Name',
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

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredOptions([]);
    } else {
      const searchLower = searchTerm.toLowerCase();
      const filtered = options.filter(option =>
        option.toLowerCase().includes(searchLower)
      );
      
      const sorted = filtered.sort((a, b) => {
        const aLower = a.toLowerCase();
        const bLower = b.toLowerCase();
        
        if (aLower === searchLower) return -1;
        if (bLower === searchLower) return 1;
        
        const aStartsWith = aLower.startsWith(searchLower);
        const bStartsWith = bLower.startsWith(searchLower);
        if (aStartsWith && !bStartsWith) return -1;
        if (!aStartsWith && bStartsWith) return 1;
        
        if (aStartsWith && bStartsWith) {
          return a.localeCompare(b);
        }
        
        const aIndex = aLower.indexOf(searchLower);
        const bIndex = bLower.indexOf(searchLower);
        if (aIndex !== bIndex) {
          return aIndex - bIndex;
        }
        
        return a.localeCompare(b);
      });
      
      setFilteredOptions(sorted);
    }
  }, [searchTerm, options]);

  useEffect(() => {
    if (value && !isOpen) {
      setSearchTerm(value);
    }
  }, [value, isOpen]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
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
    
    if (newSearchTerm.trim().length > 0) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
    
    if (newSearchTerm === '') {
      onChange('');
    }
  };

  const handleOptionSelect = (option) => {
    setSearchTerm(option);
    onChange(option);
    setIsOpen(false);
  };

  const handleInputFocus = () => {
    setSearchTerm('');
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
          border: `1px solid ${error ? '#ef4444' : isOpen ? '#3b82f6' : '#d1d5db'}`,
          boxShadow: isOpen ? '0 0 0 3px rgba(59, 130, 246, 0.1)' : '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
          cursor: 'text'
        }}
        autoComplete="off"
      />
      
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
                  key={option}
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
                  {highlightMatch(option, searchTerm)}
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
              No matches found
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

const VendorInvitationForm = () => {
  const { token } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [invitationData, setInvitationData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [activeTab, setActiveTab] = useState('basic');
  const [isPANAutoFilled, setIsPANAutoFilled] = useState(false);
  const [errors, setErrors] = useState({});
  const [touchedFields, setTouchedFields] = useState({});
  const [googleDriveMessage, setGoogleDriveMessage] = useState(null);
  const [isUploadingDocument, setIsUploadingDocument] = useState({ pan: false, gst: false });
  const [googleAccessToken, setGoogleAccessToken] = useState(null);
  
  // Check if Google Drive is fully configured
  const googleDriveConfigStatus = isGoogleDriveFullyConfigured();
  const isGoogleDriveConfigured = googleDriveConfigStatus.configured;
  
  // Duplicate checking state
  const [duplicateCheck, setDuplicateCheck] = useState({
    gstinno: { isChecking: false, isDuplicate: false, message: '' },
    panno: { isChecking: false, isDuplicate: false, message: '' },
    name: { isChecking: false, isDuplicate: false, message: '' }
  });

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

  const [formData, setFormData] = useState({
    tax_type: '',
    panno: '',
    name: '',
    address1: '',
    country: 'India',
    state: '',
    pincode: '',
    gsttype: '',
    gstinno: '',
    contactperson: '',
    emailid: '',
    phoneno: '',
    mobileno: '',
    accountno: '',
    ifsccode: '',
    bankname: '',
    panDocumentLink: '', // Document link for PAN
    gstDocumentLink: ''  // Document link for GST
  });

  useEffect(() => {
    loadInvitation();
  }, [token]);

  // Load Google APIs
  useEffect(() => {
    const loadGoogleAPIs = () => {
      // Check if Google APIs are already loaded
      if (window.google && window.google.accounts && window.google.picker) {
        console.log('Google APIs already loaded');
        return;
      }

      // Load Google Identity Services
      if (!window.google || !window.google.accounts) {
        const gisScript = document.createElement('script');
        gisScript.src = 'https://accounts.google.com/gsi/client';
        gisScript.async = true;
        gisScript.defer = true;
        gisScript.onload = () => {
          console.log('Google Identity Services loaded');
        };
        gisScript.onerror = () => {
          console.error('Failed to load Google Identity Services');
        };
        document.head.appendChild(gisScript);
      }

      // Load Google Picker API
      if (!window.google || !window.google.picker) {
        const pickerScript = document.createElement('script');
        pickerScript.src = 'https://apis.google.com/js/api.js';
        pickerScript.async = true;
        pickerScript.defer = true;
        pickerScript.onload = () => {
          console.log('Google API script loaded');
          // Load the picker API
          if (window.gapi) {
            window.gapi.load('picker', () => {
              console.log('Google Picker API loaded');
            });
          }
        };
        pickerScript.onerror = () => {
          console.error('Failed to load Google API script');
        };
        document.head.appendChild(pickerScript);
      }
    };

    loadGoogleAPIs();
  }, []);

  const loadInvitation = () => {
    try {
      const encodedData = searchParams.get('data');
      
      if (encodedData) {
        try {
          const decodedData = JSON.parse(atob(encodedData));
          
          if (!decodedData.company || !decodedData.email) {
            setError('Invalid invitation data');
            setLoading(false);
            return;
          }
          
          setInvitationData({
            token: token,
            company: decodedData.company,
            email: decodedData.email,
            tallyloc_id: decodedData.tallyloc_id,
            company_session: decodedData.company_session,
            guid: decodedData.guid
          });
          
          setFormData(prev => ({
            ...prev,
            name: decodedData.company || '',
            emailid: decodedData.email || ''
          }));
          
          setLoading(false);
          return;
        } catch (decodeError) {
          console.error('Error decoding invitation data:', decodeError);
        }
      }
      
      const savedInvitations = localStorage.getItem('vendor_invitations');
      if (!savedInvitations) {
        setError('Invalid or expired invitation link');
        setLoading(false);
        return;
      }

      const invitations = JSON.parse(savedInvitations);
      const invitation = invitations.find(inv => inv.token === token);

      if (!invitation) {
        setError('Invalid or expired invitation link');
        setLoading(false);
        return;
      }

      setInvitationData(invitation);
      
      setFormData(prev => ({
        ...prev,
        name: invitation.company || '',
        emailid: invitation.email || ''
      }));
      
      setLoading(false);
    } catch (err) {
      console.error('Error loading invitation:', err);
      setError('Failed to load invitation');
      setLoading(false);
    }
  };

  // API function to check for duplicates
  const checkDuplicate = async (field, value) => {
    if (!value || value.trim() === '') {
      return;
    }
    
    if (!invitationData) {
      return;
    }
    
    try {
      setDuplicateCheck(prev => ({
        ...prev,
        [field]: { isChecking: true, isDuplicate: false, message: '' }
      }));

      // Map field names to API expected values
      const fieldMapping = {
        'gstinno': 'gstin',
        'panno': 'pan', 
        'name': 'name'
      };
      
      const apiType = fieldMapping[field];
      if (!apiType) {
        throw new Error(`Invalid field type: ${field}. Must be gstinno, panno, or name`);
      }

      // Prepare the check data
      const checkData = {
        tallyloc_id: parseInt(invitationData.tallyloc_id),
        company: invitationData.company_session,
        guid: invitationData.guid,
        type: apiType,
        value: value.trim()
      };

      const response = await fetch(getApiUrl('/api/tally/ledger-check'), {
        method: 'POST',
        headers: {
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
      console.log('Duplicate check result for', field, ':', result);

      // Only show as duplicate if the existing ledger is authorized/approved
      const isDuplicate = (result.exists === true && result.status === 'approved') || result.canProceed === false;
      
      // Update duplicate check state based on result
      setDuplicateCheck(prev => ({
        ...prev,
        [field]: {
          isChecking: false,
          isDuplicate: isDuplicate,
          message: isDuplicate ? 
            (result.message || `${field} already exists and is approved`) : ''
        }
      }));

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

  // Google Drive authentication function
  const authenticateGoogle = () => {
    return new Promise((resolve, reject) => {
      try {
        if (!GOOGLE_DRIVE_CONFIG.CLIENT_ID || !GOOGLE_DRIVE_CONFIG.API_KEY) {
          reject(new Error('Google API credentials not configured. Please add REACT_APP_GOOGLE_CLIENT_ID and REACT_APP_GOOGLE_API_KEY to your .env file.'));
          return;
        }

        if (!window.google || !window.google.accounts) {
          reject(new Error('Google Identity Services not loaded yet. Please wait and try again.'));
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
      if (!window.gapi || !window.google || !window.google.accounts || !window.google.picker) {
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

  const updateField = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
    
    // Check for duplicates for specific fields
    if (field === 'gstinno' && value && value.length >= 15) {
      debouncedCheckDuplicate('gstinno', value);
    } else if (field === 'panno' && value && value.length >= 10) {
      debouncedCheckDuplicate('panno', value);
    } else if (field === 'name' && value && value.trim().length >= 3) {
      debouncedCheckDuplicate('name', value);
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
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Vendor Name is required';
    }

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

    // Check for duplicates
    if (duplicateCheck.name.isDuplicate) {
      newErrors.name = duplicateCheck.name.message || 'Vendor name already exists';
    }
    if (duplicateCheck.panno.isDuplicate) {
      newErrors.panno = duplicateCheck.panno.message || 'PAN number already exists';
    }
    if (duplicateCheck.gstinno.isDuplicate) {
      newErrors.gstinno = duplicateCheck.gstinno.message || 'GST number already exists';
    }

    if (formData.emailid && !validateEmail(formData.emailid)) {
      newErrors.emailid = 'Invalid email format';
    }

    if (formData.mobileno && !validateMobile(formData.mobileno)) {
      newErrors.mobileno = 'Invalid mobile number format';
    }

    if (formData.pincode && !validatePincode(formData.pincode)) {
      newErrors.pincode = 'Invalid pincode format';
    }

    if (formData.ifsccode && !validateIFSC(formData.ifsccode)) {
      newErrors.ifsccode = 'Invalid IFSC format';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const createVendor = async (vendorData) => {
    try {
      setSubmitError(null);

      if (!invitationData) {
        throw new Error('Missing invitation data');
      }

      const apiData = {
        tallyloc_id: parseInt(invitationData.tallyloc_id),
        company: invitationData.company_session,
        guid: invitationData.guid,
        ledgerData: {
          name: vendorData.name.trim(),
          address: (vendorData.address1 || '').replace(/\n/g, '|'),
          pincode: vendorData.pincode || '',
          stateName: vendorData.state || '',
          countryName: vendorData.country || 'India',
          contactPerson: vendorData.contactperson || '',
          phoneNo: vendorData.phoneno || '',
          mobileNo: vendorData.mobileno || '',
          email: vendorData.emailid || '',
          emailCC: '',
          panNo: vendorData.panno || '',
          gstinNo: vendorData.gstinno || '',
          bankName: vendorData.bankname || '',
          accountNo: vendorData.accountno || '',
          ifscCode: vendorData.ifsccode || '',
          panDocumentLink: vendorData.panDocumentLink || '',
          gstDocumentLink: vendorData.gstDocumentLink || ''
        }
      };

      if (!apiData.ledgerData.name) {
        throw new Error('Vendor Name is mandatory');
      }

      if (apiData.ledgerData.name.length < 2) {
        throw new Error('Vendor name must be at least 2 characters long');
      }
      
      if (apiData.ledgerData.mobileNo && !/^[6-9][0-9]{9}$/.test(apiData.ledgerData.mobileNo)) {
        throw new Error('Invalid mobile number format');
      }

      if (apiData.ledgerData.panNo && apiData.ledgerData.panNo.length > 0) {
        const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
        if (!panRegex.test(apiData.ledgerData.panNo)) {
          throw new Error(`Invalid PAN format: ${apiData.ledgerData.panNo}. Correct format: ABCDE1234F`);
        }
      }

      if (apiData.ledgerData.gstinNo && apiData.ledgerData.gstinNo.length > 0) {
        const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z0-9]{1}Z[A-Z0-9]{1}$/;
        if (!gstRegex.test(apiData.ledgerData.gstinNo)) {
          throw new Error(`Invalid GST format: ${apiData.ledgerData.gstinNo}. Correct format: 12ABCDE1234F1Z5`);
        }
      }

      const response = await fetch(getApiUrl('/api/tally/ledger-create'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(apiData)
      });

      if (!response.ok) {
        let errorMessage = 'Failed to create vendor';
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
      console.log('Vendor creation API response:', result);
      
      if (result.success === false) {
        let errorMessage = result.message || 'Failed to create ledger';
        throw new Error(errorMessage);
      }
      
      return result;
    } catch (err) {
      console.error('Error creating vendor:', err);
      setSubmitError(err.message);
      throw err;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);
      await createVendor(formData);
      setIsSubmitted(true);
    } catch (error) {
      console.error('Vendor creation failed:', error);
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate('/');
  };

  if (loading && !invitationData) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: '#f3f4f6',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '4px solid #e5e7eb',
          borderTop: '4px solid #3b82f6',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <p style={{ 
          color: '#6b7280', 
          fontSize: '14px',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          Loading invitation...
        </p>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: '#f3f4f6'
      }}>
        <div style={{
          background: '#fff',
          borderRadius: '12px',
          padding: '48px 32px',
          maxWidth: '500px',
          width: '90%',
          textAlign: 'center',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
        }}>
          <span className="material-icons" style={{ fontSize: '64px', color: '#ef4444', marginBottom: '16px' }}>
            error
          </span>
          <h2 style={{ 
            fontSize: '24px', 
            fontWeight: '600', 
            color: '#1f2937', 
            marginBottom: '12px',
            fontFamily: 'system-ui, -apple-system, sans-serif'
          }}>
            {error}
          </h2>
          <p style={{ 
            fontSize: '14px', 
            color: '#6b7280', 
            marginBottom: '24px',
            fontFamily: 'system-ui, -apple-system, sans-serif'
          }}>
            The invitation link you clicked is invalid or has expired.
          </p>
          <button
            onClick={() => navigate('/')}
            style={{
              padding: '12px 24px',
              background: '#3b82f6',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              fontFamily: 'system-ui, -apple-system, sans-serif'
            }}
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  if (isSubmitted) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: '#f3f4f6',
        padding: '20px'
      }}>
        <div style={{
          background: '#fff',
          borderRadius: '12px',
          padding: '48px 32px',
          maxWidth: '500px',
          width: '100%',
          textAlign: 'center',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
        }}>
          <span className="material-icons" style={{ fontSize: '64px', color: '#10b981', marginBottom: '16px' }}>
            check_circle
          </span>
          <h2 style={{ 
            fontSize: '24px', 
            fontWeight: '600', 
            color: '#1f2937', 
            marginBottom: '12px',
            fontFamily: 'system-ui, -apple-system, sans-serif'
          }}>
            Registration Successful!
          </h2>
          <p style={{ 
            fontSize: '14px', 
            color: '#6b7280', 
            marginBottom: '24px',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            lineHeight: '1.6'
          }}>
            Your vendor registration has been submitted successfully and sent for authorization. You will be notified once your registration is approved.
          </p>
          <button
            onClick={() => navigate('/')}
            style={{
              padding: '12px 24px',
              background: '#3b82f6',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              fontFamily: 'system-ui, -apple-system, sans-serif'
            }}
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: '#f3f4f6',
      minHeight: '100vh',
      padding: '40px 20px',
    }}>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .vendor-form-grid > div {
          min-width: 0;
          overflow: hidden;
        }
        .vendor-form-grid input,
        .vendor-form-grid select,
        .vendor-form-grid textarea {
          max-width: 100%;
          box-sizing: border-box;
        }
        @media (max-width: 1200px) {
          .vendor-form-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 20px !important;
          }
        }
        @media (max-width: 900px) {
          .vendor-form-grid {
            grid-template-columns: 1fr !important;
            gap: 20px !important;
          }
        }
      `}</style>
      
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        background: '#fff',
        borderRadius: '16px',
        padding: '32px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        border: '1px solid #e5e7eb'
      }}>
        <h2 style={{ 
          fontSize: '24px', 
          fontWeight: '600', 
          color: '#1f2937', 
          marginBottom: '8px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <span className="material-icons" style={{ fontSize: '28px', color: '#3b82f6' }}>person_add</span>
          Vendor Registration Form
        </h2>
        <p style={{ 
          fontSize: '14px', 
          color: '#6b7280', 
          marginBottom: '32px',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          Please fill in your details to complete vendor registration
        </p>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
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
              { id: 'contact', label: 'Contact Details', icon: 'contact_phone' },
              { id: 'bank', label: 'Bank Details', icon: 'account_balance' }
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
                  borderRight: tab.id !== 'bank' ? '1px solid #e5e7eb' : 'none'
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
                <div className="vendor-form-grid" style={{ 
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
                        if (e.target.value === 'PAN') {
                          updateField('gstinno', '');
                          updateField('gsttype', '');
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
                      <option value="GST">GST Number</option>
                    </select>
                    {errors.tax_type && <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{errors.tax_type}</p>}
            </div>
            
                  {/* GST Number and Type */}
                  {formData.tax_type === 'GST' && (
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
                          {VENDOR_CONSTANTS.FORM_LABELS.GST_NUMBER}
              </label>
                        <div style={{ position: 'relative', display: 'flex', gap: '8px', alignItems: 'stretch', width: '100%', overflow: 'visible' }}>
              <input
                            type="text"
                            value={formData.gstinno}
                            onChange={(e) => {
                              const formatted = formatGST(e.target.value);
                              updateField('gstinno', formatted);
                              
                              if (formatted.length >= 12) {
                                const extractedPAN = extractPANFromGST(formatted);
                                if (extractedPAN && validatePAN(extractedPAN)) {
                                  const formattedPAN = formatPAN(extractedPAN);
                                  updateField('panno', formattedPAN);
                                  setIsPANAutoFilled(true);
                                }
                              } else {
                                if (isPANAutoFilled) {
                                  updateField('panno', '');
                                  setIsPANAutoFilled(false);
                                }
                              }
                            }}
                            onBlur={() => handleFieldBlur('gstinno')}
                            maxLength={30}
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
                              flex: 1
                            }}
                            placeholder="22ABCDE1234F1Z5"
                          />
                          {duplicateCheck.gstinno.isChecking && (
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
                          {duplicateCheck.gstinno.isDuplicate && !duplicateCheck.gstinno.isChecking && (
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
                            const hasCompletedCheck = duplicateCheck.gstinno.isChecking === false && 
                                                     (duplicateCheck.gstinno.isDuplicate === true || duplicateCheck.gstinno.isDuplicate === false);
                            const shouldShowGreen = !duplicateCheck.gstinno.isDuplicate && 
                                                   !duplicateCheck.gstinno.isChecking && 
                                                   formData.gstinno.length === 15 && 
                                                   !errors.gstinno &&
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

                      <div>
                        <label style={{ 
                          display: 'block', 
                          fontSize: '14px', 
                          fontWeight: '500', 
                          color: '#374151', 
                          marginBottom: '6px',
                          fontFamily: 'system-ui, -apple-system, sans-serif'
                        }}>
                          {VENDOR_CONSTANTS.FORM_LABELS.GST_TYPE}
                        </label>
                        <select
                          value={formData.gsttype}
                          onChange={(e) => updateField('gsttype', e.target.value)}
                          style={selectStyles}
                        >
                          <option value="">Select GST Type</option>
                          {VENDOR_CONSTANTS.GST_TYPES.map((type) => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}
            
            {/* PAN Number */}
                  {(formData.tax_type === 'PAN' || formData.tax_type === 'GST') && (
            <div>
              <label style={{ 
                display: 'block', 
                fontSize: '14px', 
                fontWeight: '500', 
                color: '#374151', 
                marginBottom: '6px',
                fontFamily: 'system-ui, -apple-system, sans-serif'
              }}>
                        {VENDOR_CONSTANTS.FORM_LABELS.PAN_NUMBER}
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
                          placeholder={formData.tax_type === 'GST' ? "Will be auto-filled from GST" : "ABCDE1234F"}
                        />
                        {duplicateCheck.panno.isChecking && (
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
                        {duplicateCheck.panno.isDuplicate && !duplicateCheck.panno.isChecking && (
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
                          const hasCompletedCheck = duplicateCheck.panno.isChecking === false && 
                                                   (duplicateCheck.panno.isDuplicate === true || duplicateCheck.panno.isDuplicate === false);
                          const shouldShowGreen = !duplicateCheck.panno.isDuplicate && 
                                                 !duplicateCheck.panno.isChecking && 
                                                 formData.panno.length === 10 && 
                                                 !errors.panno &&
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

                  {/* Vendor Name */}
            <div>
              <label style={{ 
                display: 'block', 
                fontSize: '14px', 
                fontWeight: '500', 
                color: '#374151', 
                marginBottom: '6px',
                fontFamily: 'system-ui, -apple-system, sans-serif'
              }}>
                      {VENDOR_CONSTANTS.FORM_LABELS.VENDOR_NAME} *
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
                        placeholder="Enter vendor name"
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
                        {duplicateCheck.name.message || 'Vendor name already exists'}
                      </p>
                    )}
            </div>
            
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
                      {VENDOR_CONSTANTS.FORM_LABELS.ADDRESS}
              </label>
              <textarea
                      value={formData.address1}
                      onChange={(e) => updateField('address1', e.target.value)}
                      style={{
                        ...inputStyles,
                        minHeight: '80px',
                        resize: 'vertical',
                        fontFamily: 'system-ui, -apple-system, sans-serif'
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
                      {VENDOR_CONSTANTS.FORM_LABELS.COUNTRY}
                    </label>
                    <SearchableDropdown
                      options={VENDOR_CONSTANTS.COUNTRIES}
                      value={formData.country}
                      onChange={(value) => updateField('country', value)}
                      placeholder="Start typing to search countries..."
                style={{
                        ...inputStyles,
                        border: `1px solid ${errors.country ? '#ef4444' : '#d1d5db'}`
                      }}
                      error={!!errors.country}
                    />
                    {errors.country && <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{errors.country}</p>}
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
                      {VENDOR_CONSTANTS.FORM_LABELS.STATE}
                    </label>
                    <SearchableDropdown
                      options={VENDOR_CONSTANTS.INDIAN_STATES}
                      value={formData.state}
                      onChange={(value) => updateField('state', value)}
                      placeholder="Start typing to search states..."
                      style={{
                        ...inputStyles,
                        border: `1px solid ${errors.state ? '#ef4444' : '#d1d5db'}`
                      }}
                      error={!!errors.state}
                    />
                    {errors.state && <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{errors.state}</p>}
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
                      {VENDOR_CONSTANTS.FORM_LABELS.PINCODE}
                    </label>
                    <input
                      type="text"
                      value={formData.pincode}
                      onChange={(e) => updateField('pincode', e.target.value)}
                      maxLength={6}
                      style={{
                        ...inputStyles,
                        border: `1px solid ${errors.pincode ? '#ef4444' : '#d1d5db'}`
                      }}
                      placeholder="Enter 6-digit pincode"
                    />
                    {errors.pincode && <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{errors.pincode}</p>}
                  </div>
                </div>
              </div>
            )}

            {/* Contact Details Tab */}
            {activeTab === 'contact' && (
              <div>
                <div className="vendor-form-grid" style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(2, 1fr)', 
                  gap: '24px',
                  alignItems: 'start'
                }}>
            {/* Contact Person */}
            <div>
              <label style={{ 
                display: 'block', 
                fontSize: '14px', 
                fontWeight: '500', 
                color: '#374151', 
                marginBottom: '6px',
                fontFamily: 'system-ui, -apple-system, sans-serif'
              }}>
                      {VENDOR_CONSTANTS.FORM_LABELS.CONTACT_PERSON}
              </label>
              <input
                type="text"
                      value={formData.contactperson}
                      onChange={(e) => updateField('contactperson', e.target.value)}
                style={{
                        ...inputStyles,
                        border: `1px solid ${errors.contactperson ? '#ef4444' : '#d1d5db'}`
                      }}
                      placeholder="Enter contact person name"
                    />
                    {errors.contactperson && <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{errors.contactperson}</p>}
                  </div>

                  {/* Email ID */}
                  <div>
                    <label style={{ 
                      display: 'block', 
                  fontSize: '14px',
                      fontWeight: '500', 
                      color: '#374151', 
                      marginBottom: '6px',
                      fontFamily: 'system-ui, -apple-system, sans-serif'
                    }}>
                      {VENDOR_CONSTANTS.FORM_LABELS.EMAIL_ID}
                    </label>
                    <input
                      type="email"
                      value={formData.emailid}
                      onChange={(e) => updateField('emailid', e.target.value)}
                      style={{
                        ...inputStyles,
                        border: `1px solid ${errors.emailid ? '#ef4444' : '#d1d5db'}`
                      }}
                      placeholder="Enter email address"
                    />
                    {errors.emailid && <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{errors.emailid}</p>}
            </div>
            
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
                      {VENDOR_CONSTANTS.FORM_LABELS.PHONE_NUMBER}
              </label>
              <input
                type="tel"
                      value={formData.phoneno}
                      onChange={(e) => updateField('phoneno', e.target.value)}
                      style={inputStyles}
                      placeholder="Enter phone number"
                    />
                  </div>

                  {/* Mobile Number */}
                  <div>
                    <label style={{ 
                      display: 'block', 
                      fontSize: '14px', 
                      fontWeight: '500', 
                      color: '#374151', 
                      marginBottom: '6px',
                      fontFamily: 'system-ui, -apple-system, sans-serif'
                    }}>
                      {VENDOR_CONSTANTS.FORM_LABELS.MOBILE_NUMBER}
                    </label>
                    <input
                      type="tel"
                      value={formData.mobileno}
                      onChange={(e) => updateField('mobileno', e.target.value)}
                style={{
                        ...inputStyles,
                        border: `1px solid ${errors.mobileno ? '#ef4444' : '#d1d5db'}`
                      }}
                      placeholder="Enter mobile number"
                    />
                    {errors.mobileno && <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{errors.mobileno}</p>}
                  </div>
                </div>
              </div>
            )}

            {/* Bank Details Tab */}
            {activeTab === 'bank' && (
              <div>
                <div className="vendor-form-grid" style={{ 
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
                      {VENDOR_CONSTANTS.FORM_LABELS.ACCOUNT_NUMBER}
                    </label>
                    <input
                      type="text"
                      value={formData.accountno}
                      onChange={(e) => updateField('accountno', e.target.value)}
                      style={{
                        ...inputStyles,
                        border: `1px solid ${errors.accountno ? '#ef4444' : '#d1d5db'}`
                      }}
                      placeholder={VENDOR_CONSTANTS.PLACEHOLDERS.ACCOUNT_NUMBER}
                    />
                    {errors.accountno && <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{errors.accountno}</p>}
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
                      {VENDOR_CONSTANTS.FORM_LABELS.IFSC_CODE}
                    </label>
                    <input
                      type="text"
                      value={formData.ifsccode}
                      onChange={(e) => updateField('ifsccode', e.target.value.toUpperCase())}
                      maxLength={11}
                      style={{
                        ...inputStyles,
                        border: `1px solid ${errors.ifsccode ? '#ef4444' : '#d1d5db'}`
                      }}
                      placeholder={VENDOR_CONSTANTS.PLACEHOLDERS.IFSC}
                    />
                    {errors.ifsccode && <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{errors.ifsccode}</p>}
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
                      {VENDOR_CONSTANTS.FORM_LABELS.BANK_NAME}
                    </label>
                    <input
                      type="text"
                      value={formData.bankname}
                      onChange={(e) => updateField('bankname', e.target.value)}
                      style={{
                        ...inputStyles,
                        border: `1px solid ${errors.bankname ? '#ef4444' : '#d1d5db'}`
                      }}
                      placeholder="Enter bank name"
                    />
                    {errors.bankname && <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{errors.bankname}</p>}
                  </div>
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
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '12px 32px',
                background: loading ? '#9ca3af' : '#3b82f6',
                color: '#fff',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                border: 'none',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                minWidth: '180px',
                opacity: loading ? 0.7 : 1
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.target.style.background = '#2563eb';
                }
              }}
              onMouseLeave={(e) => {
                if (!loading) {
                  e.target.style.background = '#3b82f6';
                }
              }}
            >
              {loading ? (
                <>
                  <div style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid #fff',
                    borderTop: '2px solid transparent',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite'
                  }}></div>
                  Submitting...
                </>
              ) : (
                <>
                  <span className="material-icons" style={{ fontSize: '18px' }}>check</span>
                  Submit Registration
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default VendorInvitationForm;
