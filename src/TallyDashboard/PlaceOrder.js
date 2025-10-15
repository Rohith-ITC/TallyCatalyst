import React, { useState, useEffect, useMemo, useRef } from 'react';
import { getApiUrl } from '../config';
import { apiGet, apiPost } from '../utils/apiUtils';
import { deobfuscateStockItems, testDeobfuscation, enhancedDeobfuscateValue } from '../utils/frontendDeobfuscate';
import { getUserModules, hasPermission, getPermissionValue } from '../config/SideBarConfigurations';

function PlaceOrder() {
  // Test deobfuscation on component mount
  useEffect(() => {
    console.log('=== Testing Deobfuscation on Mount ===');
    testDeobfuscation('ZWt2'); // Test with one of the values from the API
    
    // Test zero value specifically
    console.log('=== Testing Zero Value Deobfuscation ===');
    console.log('Testing "ZA==" →', enhancedDeobfuscateValue('ZA=='));
    console.log('Testing "0" →', enhancedDeobfuscateValue('0'));
  }, []);

  // Listen for company changes from top bar
  useEffect(() => {
    const handleCompanyChange = () => {
      // Company changed from top bar, refresh data
      setSelectedCustomer('');
      setCustomerOptions([]);
      setStockItems([]);
      setOrderItems([]);
      // Trigger API calls for new company
      setRefreshCustomers(prev => prev + 1);
      setRefreshStockItems(prev => prev + 1);
    };

    window.addEventListener('companyChanged', handleCompanyChange);
    return () => window.removeEventListener('companyChanged', handleCompanyChange);
  }, []);

  // Listen for global refresh from top bar
  useEffect(() => {
    const handleGlobalRefresh = () => {
      console.log('🔄 PlaceOrder: Global refresh received');
      setRefreshCustomers(prev => prev + 1);
      setRefreshStockItems(prev => prev + 1);
    };

    window.addEventListener('globalRefresh', handleGlobalRefresh);
    return () => window.removeEventListener('globalRefresh', handleGlobalRefresh);
  }, []);
  
  // Auto-populate from E-commerce cart data
  useEffect(() => {
    const cartData = sessionStorage.getItem('ecommerceCartData');
    if (cartData) {
      try {
        const data = JSON.parse(cartData);
        console.log('Auto-populating from E-commerce cart:', data);
        
        // Set auto-population state
        console.log('🚀 Starting auto-population process...');
        setIsAutoPopulating(true);
        autoPopulatingRef.current = true;
        console.log('✅ Auto-population state set to true');
        
        // Store cart data for later use after customerOptions are loaded
        if (data.company) {
          setCompany(data.company);
        }
        
        // Don't set customer yet - wait for customerOptions to be loaded
        // Store the customer data for later use
        if (data.customer) {
          console.log('Customer data found in cart, will set after customerOptions load:', data.customer);
          // Store customer data temporarily
          sessionStorage.setItem('pendingCustomer', data.customer);
        } else {
          console.log('No customer data found in cart');
        }
        
        // Add all cart items to order
        if (data.items && data.items.length > 0) {
          // Store items data temporarily
          sessionStorage.setItem('pendingItems', JSON.stringify(data.items));
        }
        
        // Clear the cart data after storing pending data
        sessionStorage.removeItem('ecommerceCartData');
        
      } catch (error) {
        console.error('Error parsing E-commerce cart data:', error);
      }
    }
  }, []); // Run only once when component mounts

  // Get all companies from sessionStorage
  let companies = [];
  try {
    companies = JSON.parse(sessionStorage.getItem('allConnections') || '[]');
  } catch (e) {}
  // Show all companies without access_type filtering
  const filteredCompanies = companies;

  // Get company from sessionStorage (controlled by top bar)
  const selectedCompanyGuid = sessionStorage.getItem('selectedCompanyGuid') || '';
  const company = selectedCompanyGuid;
  
  // Company-related state (kept for JSX compatibility but not used)
  const [companyFocused, setCompanyFocused] = useState(false);
  const [companySearchTerm, setCompanySearchTerm] = useState('');
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const [filteredCompanyOptions, setFilteredCompanyOptions] = useState([]);
  const setCompany = () => {}; // Dummy function for JSX compatibility
  
  // Customer list state (with addresses)
  const [customerOptions, setCustomerOptions] = useState([]);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [customerError, setCustomerError] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [customerFocused, setCustomerFocused] = useState(false);
  const [refreshCustomers, setRefreshCustomers] = useState(0);
  
  // Auto-population state
  const [isAutoPopulating, setIsAutoPopulating] = useState(false);
  const autoPopulatingRef = useRef(false);
  
  // VoucherType state
  const [voucherTypes, setVoucherTypes] = useState([]);
  const [voucherTypesLoading, setVoucherTypesLoading] = useState(false);
  const [voucherTypesError, setVoucherTypesError] = useState('');
  const [selectedVoucherType, setSelectedVoucherType] = useState('');
  const [showVoucherTypeDropdown, setShowVoucherTypeDropdown] = useState(false);
  const [voucherTypeFocused, setVoucherTypeFocused] = useState(false);

  // Customer search and dropdown state
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  
  // Stock items state
  const [stockItems, setStockItems] = useState([]);
  const [stockItemsLoading, setStockItemsLoading] = useState(false);
  const [stockItemsError, setStockItemsError] = useState('');
  const [refreshStockItems, setRefreshStockItems] = useState(0);
  
  // Item search and dropdown state
  const [itemSearchTerm, setItemSearchTerm] = useState('');
  const [showItemDropdown, setShowItemDropdown] = useState(false);
  const [filteredItems, setFilteredItems] = useState([]);
  
  // Memoized stock item names for O(1) lookup performance with large lists (25k+ items)
  const stockItemNames = useMemo(() => {
    return new Set(stockItems.map(item => item.NAME));
  }, [stockItems]);
  
  // User permissions state
  const [userModules, setUserModules] = useState([]);
  
  // Load user permissions on component mount and when permissions change
  useEffect(() => {
    const updateUserModules = () => {
      const modules = getUserModules();
      setUserModules(modules);
    };
    
    updateUserModules();
    
    window.addEventListener('userAccessUpdated', updateUserModules);
    window.addEventListener('companyChanged', updateUserModules);
    
    return () => {
      window.removeEventListener('userAccessUpdated', updateUserModules);
      window.removeEventListener('companyChanged', updateUserModules);
    };
  }, []);

  // Check if coming from E-commerce (do this immediately, not in useEffect)
  const [isFromEcommerce, setIsFromEcommerce] = useState(() => {
    const cartData = sessionStorage.getItem('ecommerceCartData');
    return !!cartData;
  });

  // Determine which module to use for permissions (moved before auto-population logic)
  const permissionModule = isFromEcommerce ? 'ecommerce_place_order' : 'place_order';

  // Update default quantity when permissions change
  useEffect(() => {
    const defaultQuantity = getPermissionValue(permissionModule, 'def_qty', userModules);
    const newDefQtyValue = defaultQuantity ? parseInt(defaultQuantity) : 1;
    setItemQuantity(newDefQtyValue);
  }, [userModules, permissionModule]);

  // Check if user has edit_rate permission
  const canEditRate = hasPermission(permissionModule, 'edit_rate', userModules);
  
  // Check if user has edit_discount permission
  const canEditDiscount = hasPermission(permissionModule, 'edit_discount', userModules);
  
  // Check if user has save_optional permission
  const canSaveOptional = hasPermission(permissionModule, 'save_optional', userModules);
  
  // Check if user has show_payterms permission
  const canShowPayTerms = hasPermission(permissionModule, 'show_payterms', userModules);
  
  // Check if user has show_delvterms permission
  const canShowDelvTerms = hasPermission(permissionModule, 'show_delvterms', userModules);
  
  // Check if user has show_pricelvl permission
  const canShowPriceLevel = hasPermission(permissionModule, 'show_pricelvl', userModules);
  
  // Check if user has show_creditdayslimit permission
  const canShowCreditLimit = hasPermission(permissionModule, 'show_creditdayslimit', userModules);
  
  // Check if user has ctrl_creditdayslimit permission
  const canControlCreditLimit = hasPermission(permissionModule, 'ctrl_creditdayslimit', userModules);
  
  // Fetch credit limit data when customer changes and user has permission
  useEffect(() => {
    const fetchCreditLimitData = async () => {
      if (!selectedCustomer || (!canShowCreditLimit && !canControlCreditLimit)) {
        setCreditLimitData(null);
        return;
      }

      try {
        setCreditLimitLoading(true);
        const currentCompany = filteredCompanies.find(c => c.guid === company);
        
        if (!currentCompany) {
          console.error('No company found for credit limit API');
          setCreditLimitData(null);
          return;
        }
        
        const { tallyloc_id, company: companyVal, guid } = currentCompany;
        
        console.log('Credit Limit API - Current Company:', currentCompany);
        console.log('Credit Limit API - Selected Customer:', selectedCustomer);
        
        const payload = {
          tallyloc_id, 
          company: companyVal, 
          guid,
          ledgername: selectedCustomer
        };
        
        console.log('Credit Limit API - Payload:', payload);

        const data = await apiPost(`/api/tally/creditdayslimit?ts=${Date.now()}`, payload);
        
        if (data && data.creditLimitInfo) {
          setCreditLimitData(data);
        } else {
          setCreditLimitData(null);
        }
      } catch (error) {
        console.error('Error fetching credit limit data:', error);
        setCreditLimitData(null);
      } finally {
        setCreditLimitLoading(false);
      }
    };

    fetchCreditLimitData();
  }, [selectedCustomer, canShowCreditLimit, canControlCreditLimit]);
  
  // Check if user has show_rateamt_Column permission
  const canShowRateAmtColumn = hasPermission(permissionModule, 'show_rateamt_Column', userModules);
  
  // Check if user has show_disc_Column permission
  const canShowDiscColumn = hasPermission(permissionModule, 'show_disc_Column', userModules);
  
  // Check if user has show_itemdesc permission
  const canShowItemDesc = hasPermission(permissionModule, 'show_itemdesc', userModules);
  
  // Check if user has show_clsstck_Column permission
  const canShowClosingStock = hasPermission(permissionModule, 'show_ClsStck_Column', userModules);
  
  // Check if user has show_clsstck_yesno permission
  const canShowClosingStockYesNo = hasPermission(permissionModule, 'show_ClsStck_yesno', userModules);
  
  // Check if user has show_itemshasqty permission
  const canShowItemsHasQty = hasPermission(permissionModule, 'show_itemshasqty', userModules);
  
  // Check if user has show_godownbrkup permission
  const canShowGodownBrkup = hasPermission(permissionModule, 'show_godownbrkup', userModules);
  
  // Check if user has show_multicobrkup permission
  const canShowMulticoBrkup = hasPermission(permissionModule, 'show_multicobrkup', userModules);
  
  // Check if user has any stock breakdown permission
  const canShowStockBreakdown = canShowGodownBrkup || canShowMulticoBrkup;
  
  // Get default quantity value from def_qty permission
  const defaultQuantity = getPermissionValue(permissionModule, 'def_qty', userModules);
  const defQtyValue = defaultQuantity ? parseInt(defaultQuantity) : 1;
  
  // Compute rate for an item using the same logic as the Rate field
  const computeRateForItem = useMemo(() => {
    return (item) => {
      if (!item) return 0;
      const selectedCustomerData = customerOptions.find(customer => customer.NAME === selectedCustomer);
      if (selectedCustomerData && selectedCustomerData.PRICELEVEL) {
        const matchingPriceLevel = (item.PRICELEVELS || []).find(pl => pl.PLNAME === selectedCustomerData.PRICELEVEL);
        if (matchingPriceLevel) {
          return enhancedDeobfuscateValue(matchingPriceLevel.RATE) || 0;
        }
        return 0;
      }
      return item.STDPRICE || 0;
    };
  }, [customerOptions, selectedCustomer]);
  
  // Filter items based on search term with debouncing
  useEffect(() => {
    if (!itemSearchTerm.trim()) {
      setFilteredItems([]);
      return;
    }
    
    // Debounce search to improve performance
    const timeoutId = setTimeout(() => {
      const searchLower = itemSearchTerm.toLowerCase();
      
      // Optimized search: search in both NAME and PARTNO fields
      const exactMatches = [];
      const startsWithMatches = [];
      const containsMatches = [];
      
      for (let i = 0; i < stockItems.length; i++) {
        const item = stockItems[i];
        const itemName = item.NAME || '';
        const itemPartNo = item.PARTNO || '';
        const itemNameLower = itemName.toLowerCase();
        const itemPartNoLower = itemPartNo.toLowerCase();
        
        // Check if search term matches name or part number
        const nameMatch = itemNameLower.includes(searchLower);
        const partNoMatch = itemPartNoLower.includes(searchLower);
        
        if (nameMatch || partNoMatch) {
          // If user has show_itemshasqty permission, only show items with stock > 0
          if (canShowItemsHasQty) {
            const stockValue = item.CLOSINGSTOCK || 0;
            if (stockValue <= 0) {
              continue; // Skip items with no stock
            }
          }
          
          // Prioritize exact matches
          if (itemNameLower === searchLower || itemPartNoLower === searchLower) {
            exactMatches.push(item);
          } else if (itemNameLower.startsWith(searchLower) || itemPartNoLower.startsWith(searchLower)) {
            startsWithMatches.push(item);
          } else {
            containsMatches.push(item);
          }
        }
        
        // Early exit if we have enough results
        if (exactMatches.length + startsWithMatches.length + containsMatches.length >= 100) {
          break;
        }
      }
      
      // Combine results in priority order
      const filtered = [...exactMatches, ...startsWithMatches, ...containsMatches].slice(0, 100);
      setFilteredItems(filtered);
    }, 150); // 150ms debounce
    
    return () => clearTimeout(timeoutId);
  }, [itemSearchTerm, stockItems, canShowItemsHasQty]);

  // Handle dropdown positioning when it opens
  useEffect(() => {
    if (showItemDropdown) {
      // Ensure the dropdown is visible by scrolling if needed
      const inputElement = document.querySelector('input[placeholder*="Search items"]');
      if (inputElement) {
        inputElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [showItemDropdown]);

  // Filter customers based on search term with debouncing
  useEffect(() => {
    if (!customerSearchTerm.trim()) {
      setFilteredCustomers([]);
      return;
    }
    
    // Debounce search to improve performance
    const timeoutId = setTimeout(() => {
      const searchLower = customerSearchTerm.toLowerCase();
      
      // Search in both NAME and GSTNO fields
      const exactMatches = [];
      const startsWithMatches = [];
      const containsMatches = [];
      
      for (let i = 0; i < customerOptions.length; i++) {
        const customer = customerOptions[i];
        const customerName = customer.NAME || '';
        const customerGstNo = customer.GSTNO || '';
        const customerNameLower = customerName.toLowerCase();
        const customerGstNoLower = customerGstNo.toLowerCase();
        
        // Check if search term matches name or GST number
        const nameMatch = customerNameLower.includes(searchLower);
        const gstMatch = customerGstNoLower.includes(searchLower);
        
        if (nameMatch || gstMatch) {
          // Prioritize exact matches
          if (customerNameLower === searchLower || customerGstNoLower === searchLower) {
            exactMatches.push(customer);
          } else if (customerNameLower.startsWith(searchLower) || customerGstNoLower.startsWith(searchLower)) {
            startsWithMatches.push(customer);
          } else {
            containsMatches.push(customer);
          }
        }
        
        // Early exit if we have enough results
        if (exactMatches.length + startsWithMatches.length + containsMatches.length >= 50) {
          break;
        }
      }
      
      // Combine results in priority order
      const filtered = [...exactMatches, ...startsWithMatches, ...containsMatches].slice(0, 50);
      setFilteredCustomers(filtered);
    }, 150); // 150ms debounce
    
    return () => clearTimeout(timeoutId);
  }, [customerSearchTerm, customerOptions]);
  
  
  // Show all customers when dropdown opens
  useEffect(() => {
    if (showCustomerDropdown && !customerSearchTerm.trim()) {
      // Always show all customers when dropdown opens (like ecommerce)
      setFilteredCustomers(customerOptions);
    }
  }, [showCustomerDropdown, customerSearchTerm, customerOptions]);
  
  
  // Show all items when dropdown opens
  useEffect(() => {
    if (showItemDropdown && !itemSearchTerm.trim()) {
      // If user has show_itemshasqty permission, only show items with stock > 0
      if (canShowItemsHasQty) {
        const itemsWithStock = stockItems.filter(item => (item.CLOSINGSTOCK || 0) > 0);
        setFilteredItems(itemsWithStock);
      } else {
        // Always show all items when dropdown opens (like customer dropdown)
        setFilteredItems(stockItems);
      }
    }
  }, [showItemDropdown, itemSearchTerm, stockItems, canShowItemsHasQty]);
  
  // Additional form fields
  const [buyerOrderRef, setBuyerOrderRef] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [deliveryTerms, setDeliveryTerms] = useState('');
  const [narration, setNarration] = useState('');
  
  // Order item management state
  const [selectedItem, setSelectedItem] = useState('');
  const [itemQuantity, setItemQuantity] = useState(1);
  const [itemRate, setItemRate] = useState(0);
  const [itemDiscountPercent, setItemDiscountPercent] = useState(0);
  const [itemGstPercent, setItemGstPercent] = useState(0);
  const [itemDescription, setItemDescription] = useState('');
  const [orderItems, setOrderItems] = useState([]);
  const [itemFocused, setItemFocused] = useState(false);
  const [quantityFocused, setQuantityFocused] = useState(false);
  const [descriptionFocused, setDescriptionFocused] = useState(false);
  const [showDescription, setShowDescription] = useState(false);
  
  // Credit limit state
  const [creditLimitData, setCreditLimitData] = useState(null);
  const [showOverdueBills, setShowOverdueBills] = useState(false);
  const [creditLimitLoading, setCreditLimitLoading] = useState(false);
  
  // Edit item state
  const [editingItemIndex, setEditingItemIndex] = useState(null);
  const [editQuantity, setEditQuantity] = useState(1);
  const [editRate, setEditRate] = useState(0);
  const [editDiscountPercent, setEditDiscountPercent] = useState(0);
  const [editDescription, setEditDescription] = useState('');
  
  // Editable customer details state
  const [editableAddress, setEditableAddress] = useState('');
  const [editableState, setEditableState] = useState('');
  const [editableCountry, setEditableCountry] = useState('');
  const [editableGstNo, setEditableGstNo] = useState('');
  const [editablePincode, setEditablePincode] = useState('');
  
  // Focus states for floating labels
  const [addressFocused, setAddressFocused] = useState(false);
  const [stateFocused, setStateFocused] = useState(false);
  const [countryFocused, setCountryFocused] = useState(false);
  const [gstNoFocused, setGstNoFocused] = useState(false);
  const [pincodeFocused, setPincodeFocused] = useState(false);
  const [buyerOrderRefFocused, setBuyerOrderRefFocused] = useState(false);
  const [paymentTermsFocused, setPaymentTermsFocused] = useState(false);
  const [deliveryTermsFocused, setDeliveryTermsFocused] = useState(false);
  const [narrationFocused, setNarrationFocused] = useState(false);
  
  // Popup modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [tempCustomerData, setTempCustomerData] = useState({
    address: '',
    state: '',
    country: '',
    gstno: '',
    email: '',
    pincode: ''
  });

  // Custom confirmation modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [confirmAction, setConfirmAction] = useState(null);
  
    // Order submission state
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  
  // Order result modal state
  const [showOrderResultModal, setShowOrderResultModal] = useState(false);
  const [orderResult, setOrderResult] = useState({ success: false, message: '', tallyResponse: null });
  
  // Stock breakdown modal state
  const [showStockModal, setShowStockModal] = useState(false);
  const [stockBreakdownData, setStockBreakdownData] = useState(null);
  const [stockBreakdownLoading, setStockBreakdownLoading] = useState(false);
  const [stockBreakdownError, setStockBreakdownError] = useState('');
  const [showGodownStock, setShowGodownStock] = useState(() => {
    // Default to godown if user has godown permission, otherwise default to company
    return canShowGodownBrkup;
  });

  // Debug: Log permission status
  console.log('🔍 Permission Debug:', {
    permissionModule,
    isFromEcommerce,
    userModules: userModules.length,
    canEditRate,
    canEditDiscount,
    canShowRateAmtColumn,
    canShowDiscColumn,
    canSaveOptional,
    canShowItemDesc,
    canShowClosingStock,
    canShowClosingStockYesNo,
    canShowItemsHasQty,
    selectedItem,
    itemRate
  });

  // Debug: Check specific stock permission
  console.log('🔍 Stock Permission Debug:', {
    permissionModule,
    'show_clsstck_Column': hasPermission(permissionModule, 'show_clsstck_Column', userModules),
    userModules: userModules.filter(m => m.permission_key === 'show_ClsStck_Column'),
    allPermissions: userModules.map(m => ({ key: m.permission_key, granted: m.granted }))
  });

  // Dynamic grid template based on Rate/Amount columns, Discount column, and Stock column visibility
  const getGridTemplateColumns = () => {
    let columns = '450px'; // Item Name column (always visible)
    
    if (canShowRateAmtColumn) {
      columns += ' 80px'; // Qty column
    if (canShowClosingStock) {
        columns += ' 80px'; // Stock column
      }
      columns += ' 80px'; // Rate column
      if (canShowDiscColumn) {
        columns += ' 80px'; // Disc % column
      }
      columns += ' 80px 180px 140px'; // GST %, Amount, Action columns
    } else {
      columns += ' 80px'; // Qty column
      if (canShowClosingStock) {
        columns += ' 80px'; // Stock column
    }
      columns += ' 140px'; // Action column only
    }
    
    return columns;
  };





  // Fetch voucher types when company changes
  useEffect(() => {
    const fetchVoucherTypes = async () => {
      if (!company) {
        setVoucherTypes([]);
        setSelectedVoucherType('');
        setVoucherTypesLoading(false);
        setVoucherTypesError('');
        return;
      }
      
      // Get the current company object directly from filteredCompanies
      const currentCompany = filteredCompanies.find(c => c.guid === company);
      if (!currentCompany) {
        setVoucherTypes([]);
        setSelectedVoucherType('');
        setVoucherTypesLoading(false);
        setVoucherTypesError('');
        return;
      }
      
      const { tallyloc_id, company: companyVal, guid } = currentCompany;
      
      setVoucherTypesLoading(true);
      setVoucherTypesError('');
      setVoucherTypes([]); // Clear previous data while loading
      
      try {
        const data = await apiPost(`/api/tally/vouchertype?ts=${Date.now()}`, { 
          tallyloc_id, 
          company: companyVal, 
          guid
        });
        
        if (data && data.voucherTypes && Array.isArray(data.voucherTypes)) {
          setVoucherTypes(data.voucherTypes);
          
          // Check if there's a previously selected voucher type in sessionStorage
          const savedVoucherType = sessionStorage.getItem('selectedVoucherType');
          if (savedVoucherType && data.voucherTypes.find(vt => vt.NAME === savedVoucherType)) {
            // Use the saved voucher type if it exists in the current list
            setSelectedVoucherType(savedVoucherType);
          } else if (data.voucherTypes.length > 0) {
            // Auto-select the first voucher type
            const firstVoucherType = data.voucherTypes[0].NAME;
            setSelectedVoucherType(firstVoucherType);
            // Save it for future use
            sessionStorage.setItem('selectedVoucherType', firstVoucherType);
          } else {
            setSelectedVoucherType('');
          }
        } else {
          setVoucherTypesError('No voucher types received');
        }
      } catch (error) {
        console.error('Error fetching voucher types:', error);
        setVoucherTypesError('Failed to fetch voucher types');
      } finally {
        setVoucherTypesLoading(false);
      }
    };
    
    fetchVoucherTypes();
  }, [company]);

  // Fetch customers with addresses when company changes or refreshCustomers increments
  useEffect(() => {
    const fetchCustomers = async () => {
      if (!company) {
        setCustomerOptions([]);
        setSelectedCustomer('');
        setCustomerLoading(false);
        setCustomerError('');
        return;
      }
      
      // Get the current company object directly from filteredCompanies
      const currentCompany = filteredCompanies.find(c => c.guid === company);
      if (!currentCompany) {
        setCustomerOptions([]);
        setSelectedCustomer('');
        setCustomerLoading(false);
        setCustomerError('');
        return;
      }
      
      const { tallyloc_id, company: companyVal, guid } = currentCompany;
      const cacheKey = `ledgerlist-w-addrs_${tallyloc_id}_${companyVal}`;
      
      // Check cache first
      const cached = sessionStorage.getItem(cacheKey);
      if (cached && !refreshCustomers) {
        try {
          const customers = JSON.parse(cached);
          setCustomerOptions(customers);
          if (customers.length === 1) setSelectedCustomer(customers[0].NAME);
          else setSelectedCustomer('');
          setCustomerError('');
          setCustomerLoading(false);
          return;
        } catch {}
      }
      
      // Clear cache if refresh requested
      if (refreshCustomers) {
        sessionStorage.removeItem(cacheKey);
      }
      
      // Set loading state and fetch data
      setCustomerLoading(true);
      setCustomerError('');
      setCustomerOptions([]); // Clear previous data while loading
      
      const token = sessionStorage.getItem('token');
      try {
        const data = await apiPost(`/api/tally/ledgerlist-w-addrs?ts=${Date.now()}`, { 
          tallyloc_id, 
          company: companyVal, 
          guid
        });
        
        if (data && data.ledgers && Array.isArray(data.ledgers)) {
          setCustomerOptions(data.ledgers);
          if (data.ledgers.length === 1) setSelectedCustomer(data.ledgers[0].NAME);
          else setSelectedCustomer('');
          setCustomerError('');
          // Cache the result
          sessionStorage.setItem(cacheKey, JSON.stringify(data.ledgers));
        } else if (data && data.error) {
          setCustomerError(data.error);
          setCustomerOptions([]);
          setSelectedCustomer('');
        } else {
          setCustomerError('Unknown error');
          setCustomerOptions([]);
          setSelectedCustomer('');
        }
      } catch (err) {
        console.error('Error fetching customers:', err);
        setCustomerError('Failed to fetch customers');
        setCustomerOptions([]);
        setSelectedCustomer('');
      } finally {
        setCustomerLoading(false);
        // Reset refresh counter after API call completes
        if (refreshCustomers) {
          setRefreshCustomers(0);
        }
      }
    };
    
    fetchCustomers();
   }, [company, refreshCustomers]);

  // Fetch stock items when company changes or refreshStockItems increments
  useEffect(() => {
    const fetchStockItems = async () => {
      if (!company) {
        setStockItems([]);
        setStockItemsLoading(false);
        setStockItemsError('');
        return;
      }
      
      // Get the current company object directly from filteredCompanies
      const currentCompany = filteredCompanies.find(c => c.guid === company);
      if (!currentCompany) {
        setStockItems([]);
        setStockItemsLoading(false);
        setStockItemsError('');
        return;
      }
      
      const { tallyloc_id, company: companyVal, guid } = currentCompany;
      const cacheKey = `stockitems_${tallyloc_id}_${companyVal}`;
      
      // Check cache first
      const cached = sessionStorage.getItem(cacheKey);
      if (cached && !refreshStockItems) {
        try {
          const items = JSON.parse(cached);
          setStockItems(items);
          setStockItemsError('');
          setStockItemsLoading(false);
          return;
        } catch {}
      }
      
      // Clear cache if refresh requested
      if (refreshStockItems) {
        sessionStorage.removeItem(cacheKey);
      }
      
      // Set loading state and fetch data
      setStockItemsLoading(true);
      setStockItemsError('');
      setStockItems([]); // Clear previous data while loading
      
      const token = sessionStorage.getItem('token');
      try {
        const data = await apiPost(`/api/tally/stockitem?ts=${Date.now()}`, { 
          tallyloc_id, 
          company: companyVal, 
          guid
        });
        
        if (data && data.stockItems && Array.isArray(data.stockItems)) {
          console.log('Raw stock items from API:', data.stockItems);
          
          // Test deobfuscation on first item
          if (data.stockItems.length > 0) {
            const firstItem = data.stockItems[0];
            console.log('Testing deobfuscation on first item:', firstItem);
            console.log('STDPRICE:', firstItem.STDPRICE);
            console.log('LASTPRICE:', firstItem.LASTPRICE);
            console.log('CLOSINGSTOCK:', firstItem.CLOSINGSTOCK);
            if (firstItem.PRICELEVELS && firstItem.PRICELEVELS.length > 0) {
              console.log('First PRICELEVEL RATE:', firstItem.PRICELEVELS[0].RATE);
            }
          }
          
          // Deobfuscate sensitive pricing data
          const decryptedItems = deobfuscateStockItems(data.stockItems);
          setStockItems(decryptedItems);
          setStockItemsError('');
          // Cache the deobfuscated result
          sessionStorage.setItem(cacheKey, JSON.stringify(decryptedItems));
          console.log('Stock items fetched and deobfuscated:', decryptedItems);
        } else if (data && data.error) {
          setStockItemsError(data.error);
          setStockItems([]);
        } else {
          setStockItemsError('Unknown error');
          setStockItems([]);
        }
      } catch (err) {
        console.error('Error fetching stock items:', err);
        setStockItemsError('Failed to fetch stock items');
        setStockItems([]);
      } finally {
        setStockItemsLoading(false);
        // Reset refresh counter after API call completes
        if (refreshStockItems) {
          setRefreshStockItems(0);
        }
      }
    };
    
    fetchStockItems();
   }, [company, refreshStockItems]);

  // Update editable fields when customer changes
  useEffect(() => {
    if (selectedCustomer && customerOptions.length > 0) {
      const selectedCustomerObj = customerOptions.find(c => c.NAME === selectedCustomer);
      if (selectedCustomerObj) {
        setEditableAddress(selectedCustomerObj.ADDRESS || '');
        setEditableState(selectedCustomerObj.STATENAME || '');
        setEditableCountry(selectedCustomerObj.COUNTRY || '');
        setEditableGstNo(selectedCustomerObj.GSTNO || '');
        setEditablePincode(selectedCustomerObj.PINCODE || '');
        
        // Update temporary data for modal
        setTempCustomerData({
          address: selectedCustomerObj.ADDRESS || '',
          state: selectedCustomerObj.STATENAME || '',
          country: selectedCustomerObj.COUNTRY || '',
          gstno: selectedCustomerObj.GSTNO || '',
          email: selectedCustomerObj.EMAIL || '',
          pincode: selectedCustomerObj.PINCODE || ''
        });
      }
    } else {
      setEditableAddress('');
      setEditableState('');
      setEditableCountry('');
      setEditableGstNo('');
      setEditablePincode('');
      setTempCustomerData({
        address: '',
        state: '',
        country: '',
        gstno: '',
        email: '',
        pincode: ''
      });
    }
  }, [selectedCustomer, customerOptions]);
  
  // Auto-populate customer and items after customerOptions are loaded
  useEffect(() => {
    if (customerOptions.length > 0) {
      const pendingCustomer = sessionStorage.getItem('pendingCustomer');
      const pendingItems = sessionStorage.getItem('pendingItems');
      
      if (pendingCustomer) {
        console.log('Setting pending customer after customerOptions loaded:', pendingCustomer);
        setSelectedCustomer(pendingCustomer);
        setCustomerSearchTerm(pendingCustomer);
        sessionStorage.removeItem('pendingCustomer');
      }
      
      if (pendingItems) {
        try {
          const items = JSON.parse(pendingItems);
          console.log('Adding pending items after customerOptions loaded:', items);
          
          items.forEach(item => {
            const cartItem = {
              NAME: item.NAME,
              PARTNO: item.PARTNO || '',
              STDPRICE: item.STDPRICE || 0,
              quantity: item.quantity,
              rate: parseFloat(item.STDPRICE || item.rate || 0),
              discountPercent: parseFloat(item.discountPercent || 0),
              gstPercent: parseFloat(item.gstPercent || 0),
              amount: item.amount || 0
            };
            
            addOrderItemFromCart(cartItem);
          });
          
          sessionStorage.removeItem('pendingItems');
        } catch (error) {
          console.error('Error parsing pending items:', error);
        }
      }
      
      // Don't clear auto-population state automatically
      // It will be cleared when user manually interacts with company/customer fields
      console.log('✅ Auto-population process completed - state will be cleared on manual interaction');
    }
  }, [customerOptions]); // Run when customerOptions change

  // Show warning when company changes and order items exist
  useEffect(() => {
    console.log('🔍 Company change warning effect triggered');
    console.log('📊 isAutoPopulating:', isAutoPopulating);
    console.log('📊 autoPopulatingRef.current:', autoPopulatingRef.current);
    
    // Skip warning if we're auto-populating from cart
    if (isAutoPopulating || autoPopulatingRef.current) {
      console.log('⏭️ Skipping company warning - auto-population in progress');
      return;
    }
    
    if (orderItems.length > 0) {
      console.log('⚠️ Showing company change warning');
      setConfirmMessage('Changing company will clear all selected items and order items. Are you sure you want to continue?');
      setConfirmAction(() => {
        setOrderItems([]);
        setSelectedItem('');
        setItemSearchTerm('');
        setFilteredItems([]);
        setItemQuantity(1);
        setItemRate(0);
        setItemGstPercent(0);
      });
      setShowConfirmModal(true);
    }
  }, [company, isAutoPopulating]);

  // Show warning when customer changes and order items exist
  useEffect(() => {
    console.log('🔍 Customer change warning effect triggered');
    console.log('📊 isAutoPopulating:', isAutoPopulating);
    console.log('📊 autoPopulatingRef.current:', autoPopulatingRef.current);
    
    // Skip warning if we're auto-populating from cart
    if (isAutoPopulating || autoPopulatingRef.current) {
      console.log('⏭️ Skipping customer warning - auto-population in progress');
      return;
    }
    
    if (orderItems.length > 0) {
      console.log('⚠️ Showing customer change warning');
      setConfirmMessage('Changing customer will clear all selected items and order items. Are you sure you want to continue?');
      setConfirmAction(() => {
        setOrderItems([]);
        setSelectedItem('');
        setItemSearchTerm('');
        setFilteredItems([]);
        setItemQuantity(1);
        setItemRate(0);
        setItemGstPercent(0);
      });
      setShowConfirmModal(true);
    }
  }, [selectedCustomer, isAutoPopulating]);

  // Update rate when item or customer changes
  useEffect(() => {
    if (selectedItem && stockItems.length > 0) {
      const selectedStockItem = stockItems.find(item => item.NAME === selectedItem);
      if (selectedStockItem) {
        let finalRate = 0;
        let finalDiscount = 0;
        
        // If customer is selected, try to get customer-specific pricing
        if (selectedCustomer) {
          const selectedCustomerData = customerOptions.find(customer => customer.NAME === selectedCustomer);
          
          if (selectedCustomerData && selectedCustomerData.PRICELEVEL) {
            // Customer has PRICELEVEL - check PRICELEVELS array
            if (selectedStockItem.PRICELEVELS && Array.isArray(selectedStockItem.PRICELEVELS)) {
              const matchingPriceLevel = selectedStockItem.PRICELEVELS.find(pl => pl.PLNAME === selectedCustomerData.PRICELEVEL);
              if (matchingPriceLevel) {
                // Decrypt the RATE and DISCOUNT values
                finalRate = enhancedDeobfuscateValue(matchingPriceLevel.RATE) || 0;
                finalDiscount = enhancedDeobfuscateValue(matchingPriceLevel.DISCOUNT) || 0;
              } else {
                // No matching PRICELEVEL found - use STDPRICE
                finalRate = selectedStockItem.STDPRICE || 0;
                finalDiscount = 0;
              }
            } else {
              // PRICELEVELS array doesn't exist - use STDPRICE
              finalRate = selectedStockItem.STDPRICE || 0;
              finalDiscount = 0;
            }
          } else {
            // Customer doesn't have PRICELEVEL - use STDPRICE and zero discount
            finalRate = selectedStockItem.STDPRICE || 0;
            finalDiscount = 0;
          }
        } else {
          // No customer selected - use STDPRICE as fallback and zero discount
          finalRate = selectedStockItem.STDPRICE || 0;
          finalDiscount = 0;
        }
        
        console.log('💰 Rate Calculation:', {
          selectedItem,
          selectedCustomer,
          finalRate,
          finalDiscount,
          stdPrice: selectedStockItem.STDPRICE
        });
        
        setItemRate(finalRate);
        setItemDiscountPercent(finalDiscount);
        setItemGstPercent(selectedStockItem.IGST || 0);
      }
    }
  }, [selectedItem, stockItems, selectedCustomer, customerOptions]);



  // Styles
  const selectWrapperStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  };

  const selectStyle = {
    width: '100%',
    padding: '12px 16px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    backgroundColor: '#fff',
    color: '#374151',
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  };

  const floatingLabelStyle = (focused, value) => ({
    position: 'absolute',
    left: 12,
    top: focused || value ? '-10px' : '10px',
    fontSize: focused || value ? 14 : 15,
    fontWeight: 600,
    color: '#60a5fa',
    backgroundColor: '#fff',
    padding: '0 6px',
    transition: 'all 0.25s cubic-bezier(.4,0,.2,1)',
    pointerEvents: 'none',
    letterSpacing: 0.5,
    fontFamily: 'Segoe UI, Roboto, Arial, sans-serif',
  });

  // Modal styles
  const modalOverlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  };

  const modalStyle = {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '24px',
    maxWidth: '500px',
    width: '90%',
    maxHeight: '80vh',
    overflow: 'auto',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  };

  const modalHeaderStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    paddingBottom: '16px',
    borderBottom: '2px solid #3b82f6',
  };

  const modalTitleStyle = {
    margin: 0,
    color: '#1f2937',
    fontSize: '20px',
    fontWeight: '600',
  };

  const closeButtonStyle = {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
    color: '#6b7280',
    padding: '4px',
    borderRadius: '4px',
    transition: 'color 0.2s',
  };

  const formGroupStyle = {
    marginBottom: '20px',
  };

  const labelStyle = {
    display: 'block',
    marginBottom: '8px',
    fontWeight: '600',
    color: '#374151',
    fontSize: '14px',
  };

  const inputStyle = {
    width: '100%',
    padding: '12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
  };

  const textareaStyle = {
    ...inputStyle,
    minHeight: '80px',
    resize: 'vertical',
  };

  const readonlyInputStyle = {
    ...inputStyle,
    backgroundColor: '#f9fafb',
    color: '#6b7280',
  };

  const buttonGroupStyle = {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end',
    marginTop: '24px',
  };

  const buttonStyle = {
    padding: '12px 24px',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
  };

  const primaryButtonStyle = {
    ...buttonStyle,
    background: '#3b82f6',
    color: 'white',
  };

  const secondaryButtonStyle = {
    ...buttonStyle,
    background: '#6b7280',
    color: 'white',
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const currentCompany = filteredCompanies.find(c => c.guid === company);
    const selectedCustomerObj = customerOptions.find(c => c.NAME === selectedCustomer);
    
    if (!currentCompany || !selectedCustomerObj || orderItems.length === 0) {
      console.error('Missing required data for order submission');
      return;
    }

    // Credit limit validation
    if (creditLimitData && (canShowCreditLimit || canControlCreditLimit) && Math.abs(creditLimitData.creditLimitInfo.CREDITLIMIT) > 0) {
      const totalOrderAmount = orderItems.reduce((sum, item) => sum + item.amount, 0);
      const availableCredit = Math.abs(creditLimitData.creditLimitInfo.CREDITLIMIT) - Math.abs(creditLimitData.creditLimitInfo.CLOSINGBALANCE);
      const hasOverdueBills = creditLimitData.overdueBills && creditLimitData.overdueBills.length > 0;
      const exceedsCreditLimit = totalOrderAmount > availableCredit;

      if (canControlCreditLimit && (exceedsCreditLimit || hasOverdueBills)) {
        let errorMessage = 'Transaction cannot be saved due to:\n';
        if (exceedsCreditLimit) {
          errorMessage += `• Order amount (₹${totalOrderAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}) exceeds available credit limit (₹${availableCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })})\n`;
        }
        if (hasOverdueBills) {
          errorMessage += `• Customer has ${creditLimitData.overdueBills.length} overdue bill(s)\n`;
        }
        alert(errorMessage);
        return;
      }
    }

    setIsSubmittingOrder(true);

    try {
      // Prepare voucher number
      const now = new Date();
      const timestamp = now.getFullYear().toString() +
        (now.getMonth() + 1).toString().padStart(2, '0') +
        now.getDate().toString().padStart(2, '0') +
        now.getHours().toString().padStart(2, '0') +
        now.getMinutes().toString().padStart(2, '0') +
        now.getSeconds().toString().padStart(2, '0');
      
      // Find the selected voucher type to get PREFIX and SUFFIX
      const selectedVoucherTypeObj = voucherTypes.find(vt => vt.NAME === selectedVoucherType);
      const voucherNumber = selectedVoucherTypeObj 
        ? `${selectedVoucherTypeObj.PREFIX}${timestamp}${selectedVoucherTypeObj.SUFFIX}`
        : '';

      // Prepare the API payload
      const payload = {
        tallyloc_id: currentCompany.tallyloc_id,
        company: currentCompany.company,
        guid: currentCompany.guid,
        customer: selectedCustomer,
        address: (editableAddress || selectedCustomerObj.ADDRESS || '').replace(/\n/g, '|'),
        pincode: editablePincode || selectedCustomerObj.PINCODE || '',
        state: editableState || selectedCustomerObj.STATENAME || '',
        country: editableCountry || selectedCustomerObj.COUNTRY || '',
        gstno: editableGstNo || selectedCustomerObj.GSTNO || '',
        pricelevel: selectedCustomerObj.PRICELEVEL || '',
        buyerorderno: buyerOrderRef || '',
        ...(canShowPayTerms && { paymentterms: paymentTerms || '' }),
        ...(canShowDelvTerms && { deliveryterms: deliveryTerms || '' }),
        narration: narration || '',
        isoptional: (() => {
          // Default logic
          if (canSaveOptional) return "Yes";
          
          // Credit limit logic for show_creditdayslimit
          if (canShowCreditLimit && creditLimitData) {
            const hasOverdueBills = creditLimitData.overdueBills && creditLimitData.overdueBills.length > 0;
            
            // Check for overdue bills first (regardless of credit limit)
            if (hasOverdueBills) {
              return "Yes";
            }
            
            // Check for credit limit exceed only if credit limit is set (> 0)
            if (Math.abs(creditLimitData.creditLimitInfo.CREDITLIMIT) > 0) {
              const totalOrderAmount = orderItems.reduce((sum, item) => sum + item.amount, 0);
              const availableCredit = Math.abs(creditLimitData.creditLimitInfo.CREDITLIMIT) - Math.abs(creditLimitData.creditLimitInfo.CLOSINGBALANCE);
              const exceedsCreditLimit = totalOrderAmount > availableCredit;
              
              if (exceedsCreditLimit) {
                return "Yes";
              }
            }
          }
          
          return "No";
        })(),
        ...(canShowPayTerms && { basicduedateofpymt: paymentTerms || '' }),
        ...(canShowDelvTerms && { basicorderterms: deliveryTerms || '' }),
        vouchertype: selectedVoucherType || '',
        vouchernumber: voucherNumber,
        items: orderItems.map(item => ({
          item: item.name,
          qty: item.quantity,
          rate: item.rate,
          discount: item.discountPercent || 0,
          gst: item.gstPercent || 0,
          amount: item.amount,
          description: item.description || ''
        }))
      };

      console.log('Submitting order with payload:', payload);

      // Get the token for authorization
      const token = sessionStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      // Make the API call
      const result = await apiPost('/api/tally/place_order', payload);
      console.log('Order submission response:', result);

      if (result.success) {
        // Order created successfully
        setOrderResult({
          success: true,
          message: 'Order placed successfully!',
          tallyResponse: result.tallyResponse
        });
        setShowOrderResultModal(true);
        
        // Reset the form
        setSelectedItem('');
        setItemQuantity(1);
        setItemRate(0);
        setItemGstPercent(0);
        setOrderItems([]);
        setBuyerOrderRef('');
        setPaymentTerms('');
        setDeliveryTerms('');
        setNarration('');
        setSelectedCustomer('');
        setCustomerSearchTerm('');
        setEditableAddress('');
        setEditableState('');
        setEditableCountry('');
        setEditableGstNo('');
        setEditablePincode('');
        setItemDescription('');
        setShowDescription(false);
        
        // No need to refresh data since we're using cache
      } else {
        // Order creation failed
        setOrderResult({
          success: false,
          message: result.message || 'Order creation failed',
          tallyResponse: result.tallyResponse
        });
        setShowOrderResultModal(true);
      }

    } catch (error) {
      console.error('Error submitting order:', error);
      alert(`❌ Error submitting order: ${error.message}`);
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  const addOrderItem = () => {
    if (!selectedItem || itemQuantity <= 0) return;
    
    const amount = itemQuantity * itemRate * (1 - (itemDiscountPercent || 0)/100);
    
    // Credit limit validation for ctrl_creditdayslimit
    if (canControlCreditLimit && creditLimitData) {
      // Check for overdue bills - block adding any items (regardless of credit limit)
      const hasOverdueBills = creditLimitData.overdueBills && creditLimitData.overdueBills.length > 0;
      if (hasOverdueBills) {
        alert(`Cannot add items: Customer has ${creditLimitData.overdueBills.length} overdue bill(s). Please clear overdue bills first.`);
        return;
      }
      
      // Check credit limit - only if credit limit is set (> 0)
      if (Math.abs(creditLimitData.creditLimitInfo.CREDITLIMIT) > 0) {
        const currentTotal = orderItems.reduce((sum, item) => sum + item.amount, 0);
        const newTotal = currentTotal + amount;
        const availableCredit = Math.abs(creditLimitData.creditLimitInfo.CREDITLIMIT) - Math.abs(creditLimitData.creditLimitInfo.CLOSINGBALANCE);
        
        if (newTotal > availableCredit) {
          alert(`Cannot add item: Total order amount (₹${newTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}) would exceed available credit limit (₹${availableCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}).\n\nCurrent total: ₹${currentTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\nItem amount: ₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
          return;
        }
      }
    }
    
    const newItem = {
      id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: selectedItem,
      quantity: itemQuantity,
      rate: itemRate,
      discountPercent: itemDiscountPercent || 0,
      gstPercent: itemGstPercent,
      description: itemDescription || '',
      amount: amount
    };
    
    setOrderItems(prev => [...prev, newItem]);
    
    // Reset form
    setSelectedItem('');
    setItemQuantity(1);
    setItemRate(0);
    setItemDiscountPercent(0);
    setItemGstPercent(0);
    setItemDescription('');
    // Don't reset showDescription - keep it on until order is saved
  };
  
  // Add order item from cart (for E-commerce integration)
  const addOrderItemFromCart = (cartItem) => {
    const amount = cartItem.amount || (parseFloat(cartItem.quantity || 0) * parseFloat(cartItem.rate || 0) * (1 - (parseFloat(cartItem.discountPercent || 0)/100)));
    
    // Credit limit validation for ctrl_creditdayslimit
    if (canControlCreditLimit && creditLimitData) {
      // Check for overdue bills - block adding any items (regardless of credit limit)
      const hasOverdueBills = creditLimitData.overdueBills && creditLimitData.overdueBills.length > 0;
      if (hasOverdueBills) {
        alert(`Cannot add items: Customer has ${creditLimitData.overdueBills.length} overdue bill(s). Please clear overdue bills first.`);
        return;
      }
      
      // Check credit limit - only if credit limit is set (> 0)
      if (Math.abs(creditLimitData.creditLimitInfo.CREDITLIMIT) > 0) {
        const currentTotal = orderItems.reduce((sum, item) => sum + item.amount, 0);
        const newTotal = currentTotal + amount;
        const availableCredit = Math.abs(creditLimitData.creditLimitInfo.CREDITLIMIT) - Math.abs(creditLimitData.creditLimitInfo.CLOSINGBALANCE);
        
        if (newTotal > availableCredit) {
          alert(`Cannot add item: Total order amount (₹${newTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}) would exceed available credit limit (₹${availableCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}).\n\nCurrent total: ₹${currentTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\nItem amount: ₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
          return;
        }
      }
    }
    
    const newItem = {
      id: `cart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: cartItem.NAME,
      quantity: cartItem.quantity,
      rate: parseFloat(cartItem.rate || 0),
      discountPercent: parseFloat(cartItem.discountPercent || 0),
      gstPercent: parseFloat(cartItem.gstPercent || 0),
      amount: amount
    };
    
    setOrderItems(prev => [...prev, newItem]);
  };

  const removeOrderItem = (id) => {
    console.log('🗑️ Removing order item with ID:', id);
    console.log('📊 Current order items before removal:', orderItems);
    
    setOrderItems(prev => {
      const filtered = prev.filter(item => item.id !== id);
      console.log('✅ Order items after removal:', filtered);
      return filtered;
    });
  };

  // Start editing an item
  const startEditItem = (index) => {
    const item = orderItems[index];
    setEditingItemIndex(index);
    setEditQuantity(item.quantity);
    setEditRate(item.rate);
    setEditDiscountPercent(item.discountPercent || 0);
    setEditDescription(item.description || '');
  };

  // Cancel editing
  const cancelEditItem = () => {
    setEditingItemIndex(null);
    setEditQuantity(1);
    setEditRate(0);
    setEditDiscountPercent(0);
    setEditDescription('');
  };

  // Save edited item
  const saveEditItem = () => {
    if (editingItemIndex === null) return;
    
    const item = orderItems[editingItemIndex];
    const newRate = parseFloat(editRate) || 0;
    const newDiscountPercent = parseFloat(editDiscountPercent) || 0;
    const newQuantity = parseFloat(editQuantity) || 1;
    
    // Calculate new amount
    const discountAmount = (newRate * newQuantity * newDiscountPercent) / 100;
    const taxableAmount = (newRate * newQuantity) - discountAmount;
    const gstAmount = (taxableAmount * item.gstPercent) / 100;
    const newAmount = taxableAmount + gstAmount;
    
    const updatedItems = [...orderItems];
    updatedItems[editingItemIndex] = {
      ...item,
      quantity: newQuantity,
      rate: newRate,
      discountPercent: newDiscountPercent,
      amount: newAmount,
      description: editDescription
    };
    
    setOrderItems(updatedItems);
    setEditingItemIndex(null);
    setEditQuantity(1);
    setEditRate(0);
    setEditDiscountPercent(0);
    setEditDescription('');
  };

  const calculateTotals = () => {
    return orderItems.reduce((totals, item) => {
      totals.totalQuantity += item.quantity;
      totals.totalAmount += item.amount;
      return totals;
    }, {
      totalQuantity: 0,
      totalAmount: 0
    });
  };

  const handleCloseModal = () => {
    setShowEditModal(false);
  };

  // Fetch stock breakdown data
  const fetchStockBreakdown = async (itemName) => {
    if (!selectedItem || !company) return;
    
    const currentCompany = filteredCompanies.find(c => c.guid === company);
    if (!currentCompany) return;
    
    setStockBreakdownLoading(true);
    setStockBreakdownError('');
    
    try {
      const { tallyloc_id, company: companyVal, guid } = currentCompany;
      
      // Determine which endpoint to use based on permissions
      let endpoint;
      if (canShowGodownBrkup && canShowMulticoBrkup) {
        // Both permissions - use toggle state
        endpoint = showGodownStock ? '/api/tally/godownStock' : '/api/tally/companystock';
      } else if (canShowGodownBrkup) {
        // Only godown permission
        endpoint = '/api/tally/godownStock';
      } else if (canShowMulticoBrkup) {
        // Only company permission
        endpoint = '/api/tally/companystock';
      } else {
        setStockBreakdownError('No stock breakdown permissions available');
        return;
      }
      
      const data = await apiPost(`${endpoint}?ts=${Date.now()}`, {
        tallyloc_id,
        company: companyVal,
        guid,
        item: itemName
      });
      
      if (data) {
        setStockBreakdownData(data);
      } else {
        setStockBreakdownError('Failed to fetch stock breakdown data');
      }
    } catch (error) {
      console.error('Error fetching stock breakdown:', error);
      setStockBreakdownError('Error fetching stock breakdown data');
    } finally {
      setStockBreakdownLoading(false);
    }
  };

  // Handle stock field click
  const handleStockFieldClick = () => {
    if (selectedItem && canShowStockBreakdown) {
      setShowStockModal(true);
      fetchStockBreakdown(selectedItem);
    }
  };

  // Refetch data when toggle changes
  useEffect(() => {
    if (showStockModal && selectedItem) {
      fetchStockBreakdown(selectedItem);
    }
  }, [showGodownStock]);

  return (
    <div style={{
      width: '100vw',
      minHeight: 'calc(100vh - 120px)',
      background: '#f3f4f6',
      padding: 0,
      margin: 0,
      paddingLeft: 220,
    }}>
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          
          @keyframes dropdownFadeIn {
            from {
              opacity: 0;
              transform: translateY(-10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          
          .dropdown-animation {
            animation: dropdownFadeIn 0.2s ease-out;
          }
        `}
      </style>
             {/* Feedback/Error */}
       {customerError && (
         <div style={{ background: '#fee2e2', color: '#b91c1c', borderRadius: 8, padding: '8px 16px', margin: '0 auto 18px auto', fontWeight: 600, fontSize: 15, maxWidth: 1200, display: 'flex', alignItems: 'center', gap: 8 }}>
           <span className="material-icons" style={{ fontSize: 18 }}>error_outline</span>
           {customerError}
         </div>
       )}
       {stockItemsError && (
         <div style={{ background: '#fee2e2', color: '#b91c1c', borderRadius: 8, padding: '8px 16px', margin: '0 auto 18px auto', fontWeight: 600, fontSize: 15, maxWidth: 1200, display: 'flex', alignItems: 'center', gap: 8 }}>
           <span className="material-icons" style={{ fontSize: 18 }}>error_outline</span>
           {stockItemsError}
         </div>
       )}


      {/* Company, Customer, and Place Order Section */}
      <div style={{
        background: '#fff',
        margin: '24px 24px 16px 24px',
        maxWidth: '1400px',
        width: 'auto',
        borderRadius: '16px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        overflow: 'visible',
        border: '1px solid #e5e7eb',
        position: 'relative'
      }}>
        {/* Form - Place Order */}
        <form onSubmit={handleSubmit} style={{ padding: '12px', width: '98%', overflow: 'visible', position: 'relative' }}>
          {/* Header */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            marginBottom: '6px',
            paddingBottom: '16px',
            borderBottom: '1px solid #f3f4f6',
            position: 'relative'
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '12px'
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                  borderRadius: '50%',
                background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                boxShadow: '0 2px 4px rgba(59, 130, 246, 0.3)'
              }}>
                <span className="material-icons" style={{ fontSize: '20px', color: '#fff' }}>
                  business
                </span>
              </div>
              <h3 style={{
                margin: 0,
                fontSize: '20px',
                fontWeight: '600',
                color: '#1f2937'
              }}>
                Customer Details
              </h3>
            </div>
              
              {/* Optional text centered between Customer Details and customer count */}
              {canSaveOptional && (
                <div style={{
                  position: 'absolute',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  fontSize: '14px',
                  fontWeight: '400',
                  color: '#6b7280',
                  fontStyle: 'italic'
                }}>
                  (Optional)
                </div>
              )}
            
            {/* Customer Count Display */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              {/* Customer Count Display */}
              <div style={{
                fontSize: '14px',
                color: '#64748b',
                fontWeight: '500',
                padding: '8px 16px',
                backgroundColor: '#f8fafc',
                borderRadius: '20px',
                border: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                position: 'relative',
                zIndex: 1,
                maxWidth: '200px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                <span style={{ fontSize: '16px', flexShrink: 0 }}>👥</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {customerLoading ? 'Loading...' : customerError ? 'Error' : `${customerOptions.length.toLocaleString()} customers available`}
                </span>
              </div>
            </div>
          </div>

          <div style={{
            display: 'flex',
            gap: '20px',
            alignItems: 'end',
            minHeight: '60px',
            position: 'relative'
          }}>
            {/* VoucherType */}
            <div style={{ 
              position: 'relative',
              flex: '0 0 300px'
            }}>
              <div style={{
                position: 'relative',
                background: 'white',
                borderRadius: '12px',
                border: showVoucherTypeDropdown ? '2px solid #3b82f6' : '2px solid #e2e8f0',
                transition: 'all 0.2s ease',
                boxShadow: showVoucherTypeDropdown ? '0 4px 12px rgba(59, 130, 246, 0.15)' : '0 1px 3px rgba(0, 0, 0, 0.1)',
                zIndex: showVoucherTypeDropdown ? 1001 : 'auto'
              }}>
                <input
                  type="text"
                  value={selectedVoucherType}
                  onChange={e => {
                    const inputValue = e.target.value;
                    setSelectedVoucherType(inputValue);
                    setShowVoucherTypeDropdown(true);
                    // Filter voucher types based on search
                    if (!inputValue.trim()) {
                      setVoucherTypes(voucherTypes);
                    } else {
                      const filtered = voucherTypes.filter(vt => 
                        vt.NAME.toLowerCase().includes(inputValue.toLowerCase())
                      );
                      setVoucherTypes(filtered);
                    }
                  }}
                  onFocus={() => {
                    setVoucherTypeFocused(true);
                    setShowVoucherTypeDropdown(true);
                  }}
                  onBlur={() => {
                    setVoucherTypeFocused(false);
                    // Delay hiding dropdown to allow click events
                    setTimeout(() => setShowVoucherTypeDropdown(false), 200);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setShowVoucherTypeDropdown(false);
                      e.target.blur();
                    }
                  }}
                  required
                  disabled={voucherTypesLoading}
                  style={{
                    width: '100%',
                    padding: '16px 20px',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '15px',
                    color: '#1e293b',
                    outline: 'none',
                    background: 'transparent',
                    cursor: voucherTypesLoading ? 'not-allowed' : 'text'
                  }}
                  placeholder={voucherTypesLoading ? 'Loading voucher types...' : 'Select Voucher Type'}
                />
                <label style={{
                  position: 'absolute',
                  left: '20px',
                  top: voucherTypeFocused || selectedVoucherType ? '-10px' : '16px',
                  fontSize: voucherTypeFocused || selectedVoucherType ? '12px' : '15px',
                  fontWeight: '600',
                  color: '#3b82f6',
                  backgroundColor: 'white',
                  padding: '0 8px',
                  transition: 'all 0.2s ease',
                  pointerEvents: 'none'
                }}>
                  Voucher Type
                </label>
                {selectedVoucherType && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedVoucherType('');
                      setShowVoucherTypeDropdown(false);
                    }}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#6b7280',
                      fontSize: '18px',
                      lineHeight: 1,
                      padding: '4px'
                    }}
                    title="Clear selection"
                  >
                    ×
                  </button>
                )}
                {voucherTypesLoading && (
                  <div style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#6b7280',
                    fontSize: '16px'
                  }}>
                    ⟳
                  </div>
                )}
              </div>

              {/* VoucherType Dropdown */}
              {showVoucherTypeDropdown && voucherTypes.length > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
                  zIndex: 1002,
                  maxHeight: '200px',
                  overflowY: 'auto',
                  marginTop: '4px'
                }}>
                  {voucherTypes.map((voucherType, index) => (
                    <div
                      key={voucherType.NAME}
                  onClick={() => {
                    setSelectedVoucherType(voucherType.NAME);
                    setShowVoucherTypeDropdown(false);
                    // Save the selected voucher type for future use
                    sessionStorage.setItem('selectedVoucherType', voucherType.NAME);
                  }}
                      style={{
                        padding: '12px 16px',
                        cursor: 'pointer',
                        borderBottom: index < voucherTypes.length - 1 ? '1px solid #f1f5f9' : 'none',
                        transition: 'background-color 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.backgroundColor = '#f8fafc';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.backgroundColor = 'white';
                      }}
                    >
                      <div style={{
                        fontWeight: '600',
                        color: '#1e293b',
                        fontSize: '14px'
                      }}>
                        {voucherType.NAME}
                      </div>
                      <div style={{
                        fontSize: '12px',
                        color: '#64748b',
                        marginTop: '2px'
                      }}>
                        {voucherType.PREFIX}{voucherType.SUFFIX}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Customer */}
            <div style={{ 
              position: 'relative',
              flex: '0 0 500px'
            }}>
              <div style={{
                position: 'relative',
                background: 'white',
                borderRadius: '12px',
                border: showCustomerDropdown ? '2px solid #3b82f6' : '2px solid #e2e8f0',
                transition: 'all 0.2s ease',
                boxShadow: showCustomerDropdown ? '0 4px 12px rgba(59, 130, 246, 0.15)' : '0 1px 3px rgba(0, 0, 0, 0.1)',
                zIndex: showCustomerDropdown ? 1001 : 'auto'
              }}>
                <input
                  type="text"
                  value={selectedCustomer || customerSearchTerm}
                  onChange={e => {
                    const inputValue = e.target.value;
                    // Clear auto-population state when user manually types in customer field
                    if (isAutoPopulating || autoPopulatingRef.current) {
                      console.log('🔄 User manually typing in customer field - clearing auto-population state');
                      setIsAutoPopulating(false);
                      autoPopulatingRef.current = false;
                    }
                    setCustomerSearchTerm(inputValue);
                    setSelectedCustomer('');
                    setShowCustomerDropdown(true);
                    // Clear filtered results when clearing search
                    if (!inputValue.trim()) {
                      // Always show all customers when no search term (like ecommerce)
                      setFilteredCustomers(customerOptions);
                    }
                  }}
                  onFocus={() => {
                    setCustomerFocused(true);
                    setShowCustomerDropdown(true);
                    // Always show all customers when focused (like ecommerce)
                    setFilteredCustomers(customerOptions);
                  }}
                  onBlur={() => {
                    setCustomerFocused(false);
                    // Delay hiding dropdown to allow click events
                    setTimeout(() => setShowCustomerDropdown(false), 200);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setShowCustomerDropdown(false);
                      e.target.blur();
                    }
                  }}
                  required
                  disabled={customerLoading}
                  style={{
                    width: '100%',
                    padding: '16px 20px',
                    paddingRight: selectedCustomer ? '50px' : '20px',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '15px',
                    color: '#374151',
                    outline: 'none',
                    background: 'transparent',
                    cursor: customerLoading ? 'not-allowed' : 'text'
                  }}
                  placeholder={customerLoading ? 'Loading...' : customerError ? customerError : ''}
                />
                
                {/* Search Icon or Dropdown Arrow */}
                {!selectedCustomer && (
                  <span 
                    className="material-icons" 
                    style={{
                      position: 'absolute',
                      right: '16px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: showCustomerDropdown ? '#3b82f6' : '#9ca3af',
                      fontSize: '20px',
                      pointerEvents: 'none',
                      transition: 'color 0.2s ease'
                    }}
                  >
                    {showCustomerDropdown ? 'expand_less' : 'search'}
                  </span>
                )}
                
                {/* Clear Button for Customer */}
                {selectedCustomer && (
                  <button
                    type="button"
                    onClick={() => {
                      // Clear auto-population state when user manually clears customer
                      if (isAutoPopulating || autoPopulatingRef.current) {
                        console.log('🔄 User manually cleared customer - clearing auto-population state');
                        setIsAutoPopulating(false);
                        autoPopulatingRef.current = false;
                      }
                      setSelectedCustomer('');
                      setCustomerSearchTerm('');
                      setShowCustomerDropdown(false);
                      // Always show all customers when reopening (like ecommerce)
                      setFilteredCustomers(customerOptions);
                    }}
                    style={{
                      position: 'absolute',
                      right: '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px',
                      borderRadius: '50%',
                      color: '#64748b',
                      fontSize: '18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'color 0.2s ease'
                    }}
                    title="Clear customer"
                  >
                    ×
                  </button>
                )}
                
                <label style={{
                  position: 'absolute',
                  left: '20px',
                  top: customerFocused || !!selectedCustomer ? '-10px' : '16px',
                  fontSize: customerFocused || !!selectedCustomer ? '12px' : '15px',
                  fontWeight: '600',
                  color: customerFocused || !!selectedCustomer ? '#3b82f6' : '#6b7280',
                  backgroundColor: '#fff',
                  padding: '0 8px',
                  transition: 'all 0.2s ease',
                  pointerEvents: 'none'
                }}>
                  Customer
                </label>
                
                {customerLoading && (
                  <div style={{
                    position: 'absolute',
                    right: 60,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: 16,
                    height: 16,
                    border: '2px solid #e5e7eb',
                    borderTop: '2px solid #3b82f6',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                )}
                
                {/* Custom Customer Dropdown */}
                {showCustomerDropdown && (
                  <div 
                    className="dropdown-animation"
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 8px)',
                      left: 0,
                      right: 0,
                      backgroundColor: 'white',
                      border: '2px solid #3b82f6',
                      borderRadius: '8px',
                      maxHeight: '300px',
                      overflowY: 'auto',
                      zIndex: 9999,
                      boxShadow: '0 10px 25px rgba(59, 130, 246, 0.2)',
                      marginTop: '0',
                      minHeight: '50px'
                    }}
                  >

                    {/* Loading indicator */}
                    {customerSearchTerm.trim() && filteredCustomers.length === 0 && (
                      <div style={{
                        padding: '16px',
                        textAlign: 'center',
                        color: '#64748b',
                        fontSize: '14px'
                      }}>
                        <div style={{
                          width: '20px',
                          height: '20px',
                          border: '2px solid #e2e8f0',
                          borderTop: '2px solid #3b82f6',
                          borderRadius: '50%',
                          animation: 'spin 1s linear infinite',
                          margin: '0 auto 8px auto'
                        }} />
                        Searching {customerOptions.length.toLocaleString()} customers...
                      </div>
                    )}
                    

                    
                    {/* Results */}
                    {filteredCustomers.map((customer, index) => (
                      <div
                        key={customer.NAME}
                        onClick={() => {
                          // Clear auto-population state when user manually changes customer
                          if (isAutoPopulating || autoPopulatingRef.current) {
                            console.log('🔄 User manually changed customer - clearing auto-population state');
                            setIsAutoPopulating(false);
                            autoPopulatingRef.current = false;
                          }
                          setSelectedCustomer(customer.NAME);
                          setCustomerSearchTerm('');
                          setShowCustomerDropdown(false);
                          setFilteredCustomers([]);
                        }}
                        style={{
                          padding: '12px 16px',
                          cursor: 'pointer',
                          borderBottom: index < filteredCustomers.length - 1 ? '1px solid #f1f5f9' : 'none',
                          transition: 'background-color 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.backgroundColor = '#f8fafc';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.backgroundColor = 'white';
                        }}
                      >
                        <div style={{
                          fontWeight: '600',
                          color: '#1e293b',
                          fontSize: '14px'
                        }}>
                          {customer.NAME}
                        </div>
                        <div style={{
                          fontSize: '12px',
                          color: '#64748b',
                          marginTop: '2px'
                        }}>
                          {customer.GSTNO && `GST No: ${customer.GSTNO} | `}Address: {customer.ADDRESS || 'N/A'}
                        </div>
                      </div>
                    ))}
                    
                    {/* Show more results indicator */}
                    {filteredCustomers.length === 50 && (
                      <div style={{
                        padding: '12px 16px',
                        textAlign: 'center',
                        color: '#64748b',
                        fontSize: '12px',
                        fontStyle: 'italic',
                        borderTop: '1px solid #f1f5f9',
                        backgroundColor: '#f8fafc'
                      }}>
                        Showing first 50 results. Refine your search for more specific results.
                      </div>
                    )}
                  </div>
                )}
                
                {/* No Results Message */}
                {showCustomerDropdown && customerSearchTerm.trim() && filteredCustomers.length === 0 && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    backgroundColor: 'white',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '16px',
                    textAlign: 'center',
                    color: '#64748b',
                    fontSize: '14px',
                    zIndex: 1000,
                    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
                    marginTop: '4px'
                  }}>
                    No customers found matching "{customerSearchTerm}"
                  </div>
                )}
              </div>
              
                 
                 {/* Edit Customer Button */}
                 {selectedCustomer && (
                   <button
                     type="button"
                     onClick={() => setShowEditModal(true)}
                     style={{
                       position: 'absolute',
                       right: 36,
                       top: '50%',
                       transform: 'translateY(-50%)',
                       background: 'none',
                       border: 'none',
                       cursor: 'pointer',
                       padding: 0,
                       margin: 0,
                       fontSize: 16,
                       color: '#3b82f6',
                       zIndex: 2
                     }}
                     tabIndex={-1}
                     aria-label="Party Details"
                     title="Party Details"
                   >
                     ✏️
                   </button>
                 )}
             </div>

            {/* Submit Button */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '10px',
              flex: '0 0 180px'
            }}>
              <button
                type="submit"
                disabled={!company || !selectedCustomer || orderItems.length === 0 || !customerOptions.some(customer => customer.NAME === selectedCustomer) || isSubmittingOrder}
                style={{
                  background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '12px 24px',
                  cursor: (!company || !selectedCustomer || orderItems.length === 0 || !customerOptions.some(customer => customer.NAME === selectedCustomer) || isSubmittingOrder) ? 'not-allowed' : 'pointer',
                  fontSize: '16px',
                  fontWeight: '600',
                  boxShadow: '0 4px 6px rgba(59, 130, 246, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  opacity: (!company || !selectedCustomer || orderItems.length === 0 || !customerOptions.some(customer => customer.NAME === selectedCustomer) || isSubmittingOrder) ? 0.5 : 1,
                  transition: 'all 0.2s ease'
                }}
              >
                {isSubmittingOrder ? (
                  <>
                    <div style={{
                      width: '18px',
                      height: '18px',
                      border: '2px solid #ffffff',
                      borderTop: '2px solid transparent',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }} />
                    Processing...
                  </>
                ) : (
                  <>
                <span className="material-icons" style={{ fontSize: '18px' }}>shopping_cart</span>
                Place Order
                  </>
                )}
              </button>
            </div>
          </div>
          
          {/* Credit Limit Information Line - Below the main row */}
          {(canShowCreditLimit || canControlCreditLimit) && selectedCustomer && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
              gap: '20px',
              padding: '8px 0',
              fontSize: '14px',
              fontWeight: '500'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="material-icons" style={{ fontSize: '16px', color: '#6b7280' }}>
                    account_balance_wallet
                  </span>
                  <span style={{ color: '#374151', fontWeight: '500' }}>Credit Info:</span>
                </div>
                
                {creditLimitLoading ? (
                  <span style={{ color: '#6b7280', fontSize: '13px' }}>Loading...</span>
                ) : creditLimitData ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ color: '#6b7280', fontSize: '13px' }}>Closing Balance:</span>
                      <span style={{ 
                        fontWeight: '600', 
                        color: creditLimitData.creditLimitInfo.CLOSINGBALANCE < 0 ? '#dc2626' : '#059669', 
                        fontSize: '13px' 
                      }}>
                        ₹{Math.abs(creditLimitData.creditLimitInfo.CLOSINGBALANCE).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        {creditLimitData.creditLimitInfo.CLOSINGBALANCE < 0 ? ' Dr' : ' Cr'}
                      </span>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ color: '#6b7280', fontSize: '13px' }}>Credit Limit:</span>
                      <span style={{ 
                        fontWeight: '600', 
                        color: creditLimitData.creditLimitInfo.CREDITLIMIT < 0 ? '#dc2626' : '#059669', 
                        fontSize: '13px' 
                      }}>
                        ₹{Math.abs(creditLimitData.creditLimitInfo.CREDITLIMIT).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        {creditLimitData.creditLimitInfo.CREDITLIMIT < 0 ? ' Dr' : ' Cr'}
                      </span>
                    </div>
                    
                    <div 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '6px',
                        cursor: creditLimitData.overdueBills && creditLimitData.overdueBills.length > 0 ? 'pointer' : 'default',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        background: creditLimitData.overdueBills && creditLimitData.overdueBills.length > 0 ? '#fef2f2' : '#f0fdf4',
                        border: creditLimitData.overdueBills && creditLimitData.overdueBills.length > 0 ? '1px solid #fecaca' : '1px solid #bbf7d0'
                      }}
                      onClick={() => {
                        if (creditLimitData.overdueBills && creditLimitData.overdueBills.length > 0) {
                          setShowOverdueBills(!showOverdueBills);
                        }
                      }}
                    >
                      <span style={{ color: '#6b7280', fontSize: '13px' }}>Overdue:</span>
                      <span style={{ 
                        fontWeight: '600', 
                        color: creditLimitData.overdueBills && creditLimitData.overdueBills.length > 0 ? '#dc2626' : '#059669',
                        fontSize: '13px'
                      }}>
                        {creditLimitData.overdueBills ? creditLimitData.overdueBills.length : 0}
                      </span>
                    </div>
                  </div>
                ) : (
                  <span style={{ color: '#6b7280', fontSize: '13px' }}>No credit info</span>
                )}
            </div>
          )}
       </form>
      </div>

      {/* Order Items Section */}
      <div style={{
        background: '#fff',
        margin: '0px 24px 24px 24px',
        maxWidth: '1400px',
        width: 'auto',
        borderRadius: '16px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        overflow: 'visible',
        border: '1px solid #e5e7eb'
      }}>
        {/* Add Item Form */}
        <div style={{ 
          padding: '16px 32px', 
          paddingBottom: '24px',
          borderBottom: '1px solid #f3f4f6',
          background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
          position: 'relative'
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
              justifyContent: 'space-between',
              marginBottom: '6px'
            }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
            gap: '12px'
          }}>


              </div>
              
              {/* Total Items Counter */}
              <div style={{
                fontSize: '14px',
                color: '#64748b',
                fontWeight: '500',
                padding: '8px 16px',
                backgroundColor: '#f8fafc',
                borderRadius: '20px',
                border: '1px solid #e2e8f0'
              }}>
                📦 {stockItems.length.toLocaleString()} items available
              </div>
          </div>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: getGridTemplateColumns(),
            gap: '24px',
            alignItems: 'end',
            position: 'relative',
            minHeight: '30px'
          }}>
            {/* Item Name */}
            <div style={{ 
              position: 'relative'
            }}>
              <div style={{
                position: 'relative',
                background: 'white',
                borderRadius: '12px',
                border: showItemDropdown ? '2px solid #3b82f6' : '2px solid #e2e8f0',
                transition: 'all 0.2s ease',
                boxShadow: showItemDropdown ? '0 4px 12px rgba(59, 130, 246, 0.15)' : '0 1px 3px rgba(0, 0, 0, 0.1)',
                zIndex: showItemDropdown ? 1001 : 'auto'
              }}>
                <input
                  type="text"
                  value={selectedItem || itemSearchTerm}
                  onChange={(e) => {
                    setItemSearchTerm(e.target.value);
                    setSelectedItem('');
                    setShowItemDropdown(true);
                    // Clear filtered results when clearing search
                    if (!e.target.value.trim()) {
                      // Always show all items when no search term (like customer dropdown)
                      setFilteredItems(stockItems);
                    }
                  }}
                  onFocus={() => {
                    setItemFocused(true);
                    setShowItemDropdown(true);
                    // Always show all items when focused (like customer dropdown)
                    setFilteredItems(stockItems);
                  }}
                  onBlur={() => {
                    setItemFocused(false);
                    // Delay hiding dropdown to allow click events
                    setTimeout(() => setShowItemDropdown(false), 200);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setShowItemDropdown(false);
                      e.target.blur();
                    }
                  }}
                  disabled={!selectedCustomer}
                  style={{ 
                    width: '100%',
                    padding: '16px 20px',
                    paddingRight: selectedItem ? '50px' : '20px',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '15px',
                    color: selectedCustomer ? '#1e293b' : '#9ca3af',
                    outline: 'none',
                    background: selectedCustomer ? 'transparent' : '#f1f5f9',
                    cursor: selectedCustomer ? 'text' : 'not-allowed'
                  }}
                  placeholder=""
                />
                
                {/* Search Icon or Dropdown Arrow */}
                {!selectedItem && (
                  <span 
                    className="material-icons" 
                    style={{
                      position: 'absolute',
                      right: '16px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: showItemDropdown ? '#3b82f6' : '#9ca3af',
                      fontSize: '20px',
                      pointerEvents: 'none',
                      transition: 'color 0.2s ease'
                    }}
                  >
                    {showItemDropdown ? 'expand_less' : 'search'}
                  </span>
                )}
                

                
                {/* Clear Button for Item */}
                {selectedItem && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedItem('');
                      setItemSearchTerm('');
                      setShowItemDropdown(false);
                      // Always show all items when reopening (like customer dropdown)
                      setFilteredItems(stockItems);
                    }}
                    style={{
                      position: 'absolute',
                      right: '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px',
                      borderRadius: '50%',
                      color: '#64748b',
                      fontSize: '18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'color 0.2s ease'
                    }}
                    title="Clear item"
                  >
                    ×
                  </button>
                )}
                
                <label style={{
                  position: 'absolute',
                  left: '20px',
                  top: itemFocused || selectedItem ? '-10px' : '16px',
                  fontSize: itemFocused || selectedItem ? '12px' : '15px',
                  fontWeight: '600',
                  color: '#3b82f6',
                  backgroundColor: 'white',
                  padding: '0 8px',
                  transition: 'all 0.2s ease',
                  pointerEvents: 'none'
                }}>
                  Item Name
                </label>
                
                {/* Custom Dropdown */}
                {showItemDropdown && (
                  <div 
                    className="dropdown-animation"
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 8px)',
                      left: 0,
                      right: 0,
                      backgroundColor: 'white',
                      border: '2px solid #3b82f6',
                      borderRadius: '8px',
                      maxHeight: '500px',
                      overflowY: 'auto',
                      zIndex: 9999,
                      boxShadow: '0 10px 25px rgba(59, 130, 246, 0.2)',
                      marginTop: '0',
                      minHeight: '50px'
                    }}
                  >

                    {/* Loading indicator */}
                    {itemSearchTerm.trim() && filteredItems.length === 0 && (
                      <div style={{
                        padding: '16px',
                        textAlign: 'center',
                        color: '#64748b',
                        fontSize: '14px'
                      }}>
                        <div style={{
                          width: '20px',
                          height: '20px',
                          border: '2px solid #e2e8f0',
                          borderTop: '2px solid #3b82f6',
                          borderRadius: '50%',
                          animation: 'spin 1s linear infinite',
                          margin: '0 auto 8px auto'
                        }} />
                        Searching {stockItems.length.toLocaleString()} items...
              </div>
                    )}
                    
                    {/* Results */}
                    {filteredItems.map((item, index) => (
                      <div
                        key={item.NAME}
                        onClick={() => {
                          setSelectedItem(item.NAME);
                          setItemSearchTerm('');
                          setShowItemDropdown(false);
                          setFilteredItems([]);
                        }}
                        style={{
                          padding: '12px 16px',
                          cursor: 'pointer',
                          borderBottom: index < filteredItems.length - 1 ? '1px solid #f1f5f9' : 'none',
                          transition: 'background-color 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.backgroundColor = '#f8fafc';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.backgroundColor = 'white';
                        }}
                      >
                        <div style={{
                          fontWeight: '600',
                          color: '#1e293b',
                          fontSize: '14px'
                        }}>
                          {item.NAME}
                        </div>
                        <div style={{
                          fontSize: '12px',
                          color: '#64748b',
                          marginTop: '2px'
                        }}>
                          {item.PARTNO && `Part No: ${item.PARTNO} | `}
                          {canShowClosingStock && (
                            <>
                              Stock: {(() => {
                                const stockValue = item.CLOSINGSTOCK || 0;
                                // If user has show_clsstck_yesno permission, show Yes/No instead of actual value
                                if (canShowClosingStockYesNo) {
                                  return stockValue > 0 ? 'Yes' : 'No';
                                }
                                return stockValue;
                              })()} | 
                            </>
                          )}
                          {canShowRateAmtColumn && `Rate: ₹${computeRateForItem(item)}`}
                        </div>
                      </div>
                    ))}
                    
                    {/* Show more results indicator */}
                    {filteredItems.length === 100 && (
                      <div style={{
                        padding: '12px 16px',
                        textAlign: 'center',
                        color: '#64748b',
                        fontSize: '12px',
                        fontStyle: 'italic',
                        borderTop: '1px solid #f1f5f9',
                        backgroundColor: '#f8fafc'
                      }}>
                        Showing first 100 results. Refine your search for more specific results.
                      </div>
                    )}
                  </div>
                )}
                
                {/* No Results Message */}
                {showItemDropdown && itemSearchTerm.trim() && filteredItems.length === 0 && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    backgroundColor: 'white',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '16px',
                    textAlign: 'center',
                    color: '#64748b',
                    fontSize: '14px',
                    zIndex: 1000,
                    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
                    marginTop: '4px'
                  }}>
                    No items found matching "{itemSearchTerm}"
                  </div>
                )}
              </div>
            </div>


            {/* Quantity */}
            <div style={{ position: 'relative' }}>
              <div style={{
                position: 'relative',
                background: 'white',
                borderRadius: '12px',
                border: '2px solid #e2e8f0',
                transition: 'all 0.2s ease',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
              }}>
                <input
                  type="number"
                  value={itemQuantity}
                  onChange={(e) => setItemQuantity(parseFloat(e.target.value) || 0)}
                  onFocus={() => setQuantityFocused(true)}
                  onBlur={() => setQuantityFocused(false)}
                  disabled={!selectedItem}
                  min="1"
                  style={{ 
                    width: '100%',
                    padding: '16px 20px',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '15px',
                    color: selectedItem ? '#1e293b' : '#9ca3af',
                    outline: 'none',
                    background: selectedItem ? 'transparent' : '#f1f5f9',
                    textAlign: 'left',
                    cursor: selectedItem ? 'text' : 'not-allowed'
                  }}
                  placeholder="Qty"
                />
                <label style={{
                  position: 'absolute',
                  left: '20px',
                  top: quantityFocused || itemQuantity > 0 ? '-10px' : '16px',
                  fontSize: quantityFocused || itemQuantity > 0 ? '12px' : '15px',
                  fontWeight: '600',
                  color: '#3b82f6',
                  backgroundColor: 'white',
                  padding: '0 8px',
                  transition: 'all 0.2s ease',
                  pointerEvents: 'none'
                }}>
                  Qty
                </label>
              </div>
            </div>

            {/* Available Stock - Only show if user has show_clsstck_Column permission */}
            {canShowClosingStock && (
              <div style={{ position: 'relative' }}>
                <div style={{
                  position: 'relative',
                  background: '#f8fafc',
                  borderRadius: '12px',
                  border: '2px solid #e2e8f0',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                }}>
                  <input
                    type="text"
                    value={(() => {
                      if (selectedItem && stockItems.length > 0) {
                        const selectedStockItem = stockItems.find(item => item.NAME === selectedItem);
                        if (selectedStockItem) {
                          const stockValue = selectedStockItem.CLOSINGSTOCK || 0;
                          // If user has show_clsstck_yesno permission, show Yes/No instead of actual value
                          if (canShowClosingStockYesNo) {
                            return stockValue > 0 ? 'Yes' : 'No';
                          }
                          return stockValue;
                        }
                      }
                      return '';
                    })()}
                    style={{ 
                      width: '100%',
                      padding: '16px 20px',
                      border: 'none',
                      borderRadius: '12px',
                      fontSize: '15px',
                      color: '#64748b',
                      outline: 'none',
                      background: 'transparent',
                      textAlign: 'center',
                      fontWeight: '600',
                      cursor: canShowStockBreakdown ? 'pointer' : 'default',
                      textDecoration: canShowStockBreakdown ? 'underline' : 'none',
                      textDecorationColor: canShowStockBreakdown ? '#3b82f6' : 'transparent',
                      textUnderlineOffset: '2px'
                    }}
                    placeholder=""
                    readOnly
                    onClick={handleStockFieldClick}
                  />
                  <label style={{
                    position: 'absolute',
                    left: '20px',
                    top: '-10px',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#64748b',
                    backgroundColor: '#f8fafc',
                    padding: '0 8px',
                    pointerEvents: 'none'
                  }}>
                    Stock
                  </label>
                </div>
              </div>
            )}

            {/* Rate */}
            {canShowRateAmtColumn && (
            <div style={{ position: 'relative' }}>
              <div style={{
                position: 'relative',
                background: canEditRate ? 'white' : '#f8fafc',
                borderRadius: '12px',
                border: '2px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
              }}>
                <input
                  type="number"
                  value={itemRate}
                  onChange={canEditRate ? (e) => setItemRate(parseFloat(e.target.value) || 0) : undefined}
                  readOnly={!canEditRate}
                  style={{ 
                    width: '100%',
                    padding: '16px 20px',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '15px',
                    color: canEditRate ? '#1e293b' : '#64748b',
                    outline: 'none',
                    background: 'transparent',
                    textAlign: 'center',
                    fontWeight: '600',
                    cursor: canEditRate ? 'text' : 'not-allowed'
                  }}
                  placeholder="Rate"
                />
                <label style={{
                  position: 'absolute',
                  left: '20px',
                  top: '-10px',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#64748b',
                  backgroundColor: canEditRate ? 'white' : '#f8fafc',
                  padding: '0 8px',
                  pointerEvents: 'none'
                }}>
                  Rate
                </label>
              </div>
            </div>
            )}

            {/* Discount */}
            {canShowRateAmtColumn && canShowDiscColumn && (
            <div style={{ position: 'relative' }}>
              <div style={{
                position: 'relative',
                background: canEditDiscount ? 'white' : '#f8fafc',
                borderRadius: '12px',
                border: '2px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
              }}>
                <input
                  type="number"
                  value={itemDiscountPercent}
                  onChange={canEditDiscount ? (e) => setItemDiscountPercent(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0))) : undefined}
                  readOnly={!canEditDiscount}
                  style={{ 
                    width: '100%',
                    padding: '16px 20px',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '15px',
                    color: canEditDiscount ? '#1e293b' : '#64748b',
                    outline: 'none',
                    background: 'transparent',
                    textAlign: 'center',
                    fontWeight: '600',
                    cursor: canEditDiscount ? 'text' : 'not-allowed'
                  }}
                  placeholder="Disc %"
                />
                <label style={{
                  position: 'absolute',
                  left: '20px',
                  top: '-10px',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#64748b',
                  backgroundColor: canEditDiscount ? 'white' : '#f8fafc',
                  padding: '0 8px',
                  pointerEvents: 'none'
                }}>
                  Disc %
                </label>
              </div>
            </div>
            )}

            {/* GST */}
            {canShowRateAmtColumn && (
            <div style={{ position: 'relative' }}>
              <div style={{
                position: 'relative',
                background: '#f8fafc',
                borderRadius: '12px',
                border: '2px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
              }}>
                <input
                  type="number"
                  value={itemGstPercent}
                  style={{ 
                    width: '100%',
                    padding: '16px 20px',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '15px',
                    color: '#64748b',
                    outline: 'none',
                    background: 'transparent',
                    textAlign: 'center',
                    fontWeight: '600'
                  }}
                  placeholder="GST %"
                  readOnly
                />
                <label style={{
                  position: 'absolute',
                  left: '20px',
                  top: '-10px',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#64748b',
                  backgroundColor: '#f8fafc',
                  padding: '0 8px',
                  pointerEvents: 'none'
                }}>
                  GST %
                </label>
              </div>
            </div>
            )}

            {/* Amount Display */}
            {canShowRateAmtColumn && (
            <div style={{
              padding: '16px 20px',
              background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
              borderRadius: '12px',
              border: '2px solid #0ea5e9',
              fontSize: '16px',
              fontWeight: '700',
              color: '#0369a1',
              textAlign: 'center',
              minWidth: '110px',
              boxShadow: '0 2px 4px rgba(14, 165, 233, 0.2)'
            }}>
              ₹{(itemQuantity * itemRate * (1 - (itemDiscountPercent || 0)/100)).toFixed(2)}
            </div>
            )}

            {/* Add Button */}
            <button
              type="button"
              onClick={addOrderItem}
              disabled={!selectedItem || itemQuantity <= 0 || !stockItemNames.has(selectedItem)}
              style={{
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                padding: '16px 28px',
                cursor: 'pointer',
                fontSize: '15px',
                fontWeight: '700',
                transition: 'all 0.3s ease',
                opacity: (!selectedItem || itemQuantity <= 0 || !stockItemNames.has(selectedItem)) ? 0.5 : 1,
                boxShadow: '0 4px 6px rgba(16, 185, 129, 0.25)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                minWidth: '140px',
                justifyContent: 'center'
              }}
            >
              <span className="material-icons" style={{ fontSize: '18px' }}>
                add_shopping_cart
              </span>
              Add Item
            </button>
          </div>

          {/* Description Field - Below the entire item line */}
          {selectedItem && (
            <div style={{ 
              marginTop: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              {/* Toggle Switch - Only show if user doesn't have show_itemdesc permission */}
              {!canShowItemDesc && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 12px',
                  background: '#f8fafc',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onClick={() => setShowDescription(!showDescription)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#f1f5f9';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#f8fafc';
                }}>
                  <div style={{
                    width: '20px',
                    height: '12px',
                    background: showDescription ? '#3b82f6' : '#cbd5e1',
                    borderRadius: '6px',
                    position: 'relative',
                    transition: 'all 0.2s ease'
                  }}>
                    <div style={{
                      width: '10px',
                      height: '10px',
                      background: 'white',
                      borderRadius: '50%',
                      position: 'absolute',
                      top: '1px',
                      left: showDescription ? '9px' : '1px',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)'
                    }} />
                  </div>
                  <span style={{
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#374151',
                    userSelect: 'none'
                  }}>
                    Add Description
                  </span>
                </div>
              )}

              {/* Description Field - Show always if permission exists, or when toggle is on */}
              {(canShowItemDesc || showDescription) && (
                <div style={{ 
                  width: '34%',
                  maxWidth: '600px'
                }}>
                  <div style={{
                    position: 'relative',
                    background: 'white',
                    borderRadius: '12px',
                    border: '2px solid #e2e8f0',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                  }}>
                    <textarea
                      value={itemDescription}
                      onChange={(e) => setItemDescription(e.target.value)}
                      onFocus={() => setDescriptionFocused(true)}
                      onBlur={() => setDescriptionFocused(false)}
                      style={{
                        width: '100%',
                        padding: '16px 20px',
                        border: 'none',
                        borderRadius: '12px',
                        fontSize: '15px',
                        color: '#1e293b',
                        outline: 'none',
                        background: 'transparent',
                        resize: 'vertical',
                        minHeight: '60px',
                        fontFamily: 'inherit'
                      }}
                      placeholder="Enter item description (optional)"
                    />
                    <label style={{
                      position: 'absolute',
                      left: '20px',
                      top: descriptionFocused || itemDescription ? '-10px' : '16px',
                      fontSize: descriptionFocused || itemDescription ? '12px' : '15px',
                      fontWeight: '600',
                      color: descriptionFocused || itemDescription ? '#3b82f6' : '#6b7280',
                      backgroundColor: 'white',
                      padding: '0 8px',
                      transition: 'all 0.2s ease',
                      pointerEvents: 'none'
                    }}>
                      Item Description
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Order Items Table */}
        {orderItems.length > 0 && (
                      <div style={{ padding: '2px 2px' }}>

            
            <div style={{
              background: 'white',
              borderRadius: '2px',
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
            }}>
              {/* Table Header */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: getGridTemplateColumns(),
                gap: '24px',
                padding: '10px 10px 10px 20px',
                backgroundColor: '#f8fafc',
                borderBottom: '2px solid #e2e8f0',
                fontWeight: '700',
                color: '#475569',
                fontSize: '14px',
                letterSpacing: '0.025em'
              }}>
                <div>Item Name</div>
                <div style={{ textAlign: 'center' }}>Qty</div>
                {canShowClosingStock && <div style={{ textAlign: 'center' }}>Stock</div>}
                {canShowRateAmtColumn && <div style={{ textAlign: 'right' }}>Rate</div>}
                {canShowRateAmtColumn && canShowDiscColumn && <div style={{ textAlign: 'center' }}>Disc %</div>}
                {canShowRateAmtColumn && <div style={{ textAlign: 'center' }}>GST %</div>}
                {canShowRateAmtColumn && <div style={{ textAlign: 'right' }}>Amount</div>}
              </div>

              {/* Table Rows */}
              {orderItems.map((item, index) => (
                <div key={item.id} style={{
                  display: 'grid',
                  gridTemplateColumns: getGridTemplateColumns(),
                  gap: '24px',
                  padding: '12px 12px 12px 20px',
                  borderBottom: '1px solid #f1f5f9',
                  alignItems: 'center',
                  fontSize: '14px',
                  color: '#1e293b',
                  transition: 'background-color 0.2s ease',
                  ':hover': {
                    backgroundColor: '#f8fafc'
                  }
                }}>
                  <div style={{ 
                    fontWeight: '600',
                    color: '#1e293b',
                    fontSize: '15px'
                  }}>
                    {item.name}
                    {editingItemIndex === index ? (
                      <div style={{ marginTop: '8px' }}>
                        <textarea
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          placeholder="Add description (optional)"
                          style={{
                            width: '100%',
                            minHeight: '60px',
                            padding: '6px 8px',
                            border: '1px solid #d1d5db',
                            borderRadius: '4px',
                            fontSize: '12px',
                            color: '#64748b',
                            fontFamily: 'inherit',
                            resize: 'vertical'
                          }}
                        />
                      </div>
                    ) : (
                      item.description && (
                        <div style={{
                          fontSize: '12px',
                          color: '#64748b',
                          fontWeight: '400',
                          marginTop: '4px',
                          fontStyle: 'italic',
                          lineHeight: '1.3'
                        }}>
                          {item.description}
                        </div>
                      )
                    )}
                  </div>
                  <div style={{ 
                    textAlign: 'center',
                    fontWeight: '600',
                    color: '#059669'
                  }}>
                    {editingItemIndex === index ? (
                      <input
                        type="number"
                        value={editQuantity}
                        onChange={(e) => setEditQuantity(e.target.value)}
                        style={{
                          width: '60px',
                          padding: '4px 8px',
                          border: '1px solid #d1d5db',
                          borderRadius: '4px',
                          textAlign: 'center',
                          fontSize: '14px',
                          fontWeight: '600',
                          color: '#059669'
                        }}
                        min="1"
                        step="1"
                      />
                    ) : (
                      item.quantity
                    )}
                  </div>
                  {canShowClosingStock && (
                    <div style={{ 
                      textAlign: 'center',
                      fontWeight: '600',
                      color: '#7c3aed'
                    }}>
                      {(() => {
                        const selectedStockItem = stockItems.find(stockItem => stockItem.NAME === item.name);
                        if (selectedStockItem) {
                          const stockValue = selectedStockItem.CLOSINGSTOCK || 0;
                          // If user has show_clsstck_yesno permission, show Yes/No instead of actual value
                          if (canShowClosingStockYesNo) {
                            return stockValue > 0 ? 'Yes' : 'No';
                          }
                          return stockValue;
                        }
                        return '';
                      })()}
                    </div>
                  )}
                  {canShowRateAmtColumn && (
                  <div style={{ 
                    textAlign: 'right',
                    fontWeight: '600',
                    color: '#dc2626'
                  }}>
                    {editingItemIndex === index && canEditRate ? (
                      <input
                        type="number"
                        value={editRate}
                        onChange={(e) => setEditRate(e.target.value)}
                        style={{
                          width: '80px',
                          padding: '4px 8px',
                          border: '1px solid #d1d5db',
                          borderRadius: '4px',
                          textAlign: 'right',
                          fontSize: '14px',
                          fontWeight: '600',
                          color: '#dc2626'
                        }}
                        min="0"
                        step="0.01"
                      />
                    ) : (
                      `₹${item.rate.toFixed(2)}`
                    )}
                  </div>
                  )}
                  {canShowRateAmtColumn && canShowDiscColumn && (
                  <div style={{ 
                    textAlign: 'center',
                    fontWeight: '600',
                    color: '#0ea5e9'
                  }}>
                    {editingItemIndex === index && canEditDiscount ? (
                      <input
                        type="number"
                        value={editDiscountPercent}
                        onChange={(e) => setEditDiscountPercent(e.target.value)}
                        style={{
                          width: '60px',
                          padding: '4px 8px',
                          border: '1px solid #d1d5db',
                          borderRadius: '4px',
                          textAlign: 'center',
                          fontSize: '14px',
                          fontWeight: '600',
                          color: '#0ea5e9'
                        }}
                        min="0"
                        max="100"
                        step="0.01"
                      />
                    ) : (
                      `${item.discountPercent || 0}%`
                    )}
                  </div>
                  )}
                  {canShowRateAmtColumn && (
                  <div style={{ 
                    textAlign: 'center',
                    fontWeight: '600',
                    color: '#ea580c'
                  }}>
                    {item.gstPercent}%
                  </div>
                  )}
                  {canShowRateAmtColumn && (
                  <div style={{ 
                    textAlign: 'right',
                    fontWeight: '700', 
                    color: '#059669',
                    fontSize: '15px'
                  }}>
                    ₹{item.amount.toFixed(2)}
                  </div>
                  )}
                  <div style={{ textAlign: 'center', display: 'flex', gap: '8px', justifyContent: 'center' }}>
                    {editingItemIndex === index ? (
                      <>
                        <button
                          type="button"
                          onClick={saveEditItem}
                          style={{
                            background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '4px 8px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: '600',
                            transition: 'all 0.2s ease',
                            boxShadow: '0 2px 4px rgba(5, 150, 105, 0.2)'
                          }}
                          title="Save changes"
                        >
                          <span className="material-icons" style={{ fontSize: '14px' }}>
                            check
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={cancelEditItem}
                          style={{
                            background: 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '4px 8px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: '600',
                            transition: 'all 0.2s ease',
                            boxShadow: '0 2px 4px rgba(107, 114, 128, 0.2)'
                          }}
                          title="Cancel editing"
                        >
                          <span className="material-icons" style={{ fontSize: '14px' }}>
                            close
                          </span>
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => startEditItem(index)}
                          style={{
                            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '4px 8px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: '600',
                            transition: 'all 0.2s ease',
                            boxShadow: '0 2px 4px rgba(59, 130, 246, 0.2)'
                          }}
                          title="Edit item"
                        >
                          <span className="material-icons" style={{ fontSize: '14px' }}>
                            edit
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => removeOrderItem(item.id)}
                          style={{
                            background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '4px 8px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: '600',
                            transition: 'all 0.2s ease',
                            boxShadow: '0 2px 4px rgba(239, 68, 68, 0.2)'
                          }}
                          title="Remove item"
                        >
                          <span className="material-icons" style={{ fontSize: '14px' }}>
                            delete_outline
                          </span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}

              {/* Totals Row */}
              {(() => {
                const totals = calculateTotals();
                return (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: getGridTemplateColumns(),
                    gap: '24px',
                    padding: '12px 12px 12px 25px',
                    background: 'linear-gradient(135deg, #1e40af 0%, #1d4ed8 100%)',
                    color: 'white',
                    fontWeight: '700',
                    fontSize: '12px',
                    borderTop: '2px solid #3b82f6'
                  }}>
                    <div style={{ fontSize: '18px' }}>OrderTotal ({orderItems.length} items selected)</div>
                    <div style={{ textAlign: 'center', fontSize: '18px' }}>{totals.totalQuantity}</div>
                    {canShowClosingStock && <div style={{ textAlign: 'center' }}>-</div>}
                    {canShowRateAmtColumn && <div style={{ textAlign: 'right' }}>-</div>}
                    {canShowRateAmtColumn && canShowDiscColumn && <div style={{ textAlign: 'center' }}>-</div>}
                    {canShowRateAmtColumn && <div style={{ textAlign: 'center' }}>-</div>}
                    {canShowRateAmtColumn && (
                    <div style={{ textAlign: 'right', fontSize: '20px', color: '#fbbf24' }}>
                      ₹{totals.totalAmount.toFixed(2)}
                    </div>
                    )}
                    <div></div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}
      </div>
      
      {/* Edit Customer Modal */}
      {showEditModal && (
        <div style={modalOverlayStyle} onClick={handleCloseModal}>
          <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <h2 style={modalTitleStyle}>Party Details</h2>
                              <button 
                  style={closeButtonStyle} 
                  onClick={handleCloseModal}
                  title="Close"
                >
                ×
              </button>
            </div>
            
            <div style={formGroupStyle}>
              <label style={labelStyle}>Customer Name</label>
              <input 
                type="text" 
                value={selectedCustomer} 
                style={readonlyInputStyle} 
                readOnly 
              />
            </div>
            
            <div style={formGroupStyle}>
              <label style={labelStyle}>Address</label>
              <textarea
                value={tempCustomerData.address ? tempCustomerData.address.replace(/\|/g, '\n') : ''}
                onChange={(e) => {
                  const newValue = e.target.value;
                  setTempCustomerData(prev => ({ ...prev, address: newValue }));
                  setEditableAddress(newValue);
                }}
                style={{
                  ...textareaStyle,
                  lineHeight: '1.2'
                }}
                placeholder="Enter address"
              />
            </div>
            
            <div style={formGroupStyle}>
              <label style={labelStyle}>Pincode</label>
              <input
                type="text"
                value={tempCustomerData.pincode}
                onChange={(e) => {
                  const newValue = e.target.value;
                  setTempCustomerData(prev => ({ ...prev, pincode: newValue }));
                  setEditablePincode(newValue);
                }}
                style={inputStyle}
                placeholder="Enter pincode"
              />
            </div>
            
            <div style={formGroupStyle}>
              <label style={labelStyle}>State</label>
              <input
                type="text"
                value={tempCustomerData.state}
                onChange={(e) => {
                  const newValue = e.target.value;
                  setTempCustomerData(prev => ({ ...prev, state: newValue }));
                  setEditableState(newValue);
                }}
                style={inputStyle}
                placeholder="Enter state"
              />
            </div>
            
            <div style={formGroupStyle}>
              <label style={labelStyle}>Country</label>
              <input
                type="text"
                value={tempCustomerData.country}
                onChange={(e) => {
                  const newValue = e.target.value;
                  setTempCustomerData(prev => ({ ...prev, country: newValue }));
                  setEditableCountry(newValue);
                }}
                style={inputStyle}
                placeholder="Enter country"
              />
            </div>
            
            <div style={formGroupStyle}>
              <label style={labelStyle}>GST NO</label>
              <input
                type="text"
                value={tempCustomerData.gstno}
                onChange={(e) => {
                  const newValue = e.target.value;
                  setTempCustomerData(prev => ({ ...prev, gstno: newValue }));
                  setEditableGstNo(newValue);
                }}
                style={inputStyle}
                placeholder="Enter GST number"
              />
            </div>
            
            <div style={formGroupStyle}>
              <label style={labelStyle}>Email</label>
              <input
                type="email"
                value={tempCustomerData.email}
                onChange={(e) => setTempCustomerData(prev => ({ ...prev, email: e.target.value }))}
                style={inputStyle}
                placeholder="Enter email"
              />
            </div>
            
            {canShowPriceLevel && (
              <div style={formGroupStyle}>
                <label style={labelStyle}>Price Level</label>
                <input
                  type="text"
                  value={customerOptions.find(c => c.NAME === selectedCustomer)?.PRICELEVEL || ''}
                  style={readonlyInputStyle}
                  readOnly
                />
              </div>
            )}
            
            <div style={formGroupStyle}>
              <label style={labelStyle}>Buyer Order Ref</label>
              <input
                type="text"
                value={buyerOrderRef}
                onChange={(e) => setBuyerOrderRef(e.target.value)}
                style={inputStyle}
                placeholder="Enter buyer order reference"
              />
            </div>
            
            {canShowPayTerms && (
              <div style={formGroupStyle}>
                <label style={labelStyle}>Payment Terms</label>
                <input
                  type="text"
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  onFocus={() => setPaymentTermsFocused(true)}
                  onBlur={() => setPaymentTermsFocused(false)}
                  style={inputStyle}
                  placeholder="Enter payment terms"
                />
              </div>
            )}
            
            {canShowDelvTerms && (
              <div style={formGroupStyle}>
                <label style={labelStyle}>Delivery Terms</label>
                <input
                  type="text"
                  value={deliveryTerms}
                  onChange={(e) => setDeliveryTerms(e.target.value)}
                  onFocus={() => setDeliveryTermsFocused(true)}
                  onBlur={() => setDeliveryTermsFocused(false)}
                  style={inputStyle}
                  placeholder="Enter delivery terms"
                />
              </div>
            )}
            
            <div style={formGroupStyle}>
              <label style={labelStyle}>Narration</label>
              <textarea
                value={narration}
                onChange={(e) => setNarration(e.target.value)}
                style={textareaStyle}
                placeholder="Enter narration"
              />
            </div>
            

          </div>
        </div>
      )}
      
      {/* Overdue Bills Modal */}
      {showOverdueBills && creditLimitData && creditLimitData.overdueBills && creditLimitData.overdueBills.length > 0 && (
        <div style={modalOverlayStyle} onClick={() => setShowOverdueBills(false)}>
          <div style={{
            ...modalStyle,
            maxWidth: '800px',
            maxHeight: '80vh',
            overflow: 'hidden'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <h2 style={modalTitleStyle}>Overdue Bills Details</h2>
              <button 
                style={closeButtonStyle} 
                onClick={() => setShowOverdueBills(false)}
                title="Close"
              >
                ×
              </button>
            </div>
            
            <div style={{
              padding: '20px',
              maxHeight: '60vh',
              overflowY: 'auto'
            }}>
              <div style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '20px'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '8px'
                }}>
                  <span className="material-icons" style={{ fontSize: '20px', color: '#dc2626' }}>
                    warning
                  </span>
                  <span style={{ color: '#dc2626', fontWeight: '600', fontSize: '16px' }}>
                    {creditLimitData.overdueBills.length} Overdue Bill(s) Found
                  </span>
                </div>
                <p style={{ color: '#7f1d1d', fontSize: '14px', margin: 0 }}>
                  Customer has outstanding bills that are past their due date. Please review the details below.
                </p>
              </div>
              
              <div style={{
                overflowX: 'auto',
                border: '1px solid #e5e7eb',
                borderRadius: '8px'
              }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '14px'
                }}>
                  <thead>
                    <tr style={{
                      background: '#f8fafc',
                      borderBottom: '2px solid #e5e7eb'
                    }}>
                      <th style={{
                        padding: '12px 16px',
                        textAlign: 'left',
                        fontWeight: '600',
                        color: '#374151',
                        borderRight: '1px solid #e5e7eb',
                        width: '200px'
                      }}>
                        Bill Reference
                      </th>
                      <th style={{
                        padding: '12px 16px',
                        textAlign: 'right',
                        fontWeight: '600',
                        color: '#374151',
                        borderRight: '1px solid #e5e7eb',
                        width: '120px'
                      }}>
                        Bill Date
                      </th>
                      <th style={{
                        padding: '12px 16px',
                        textAlign: 'right',
                        fontWeight: '600',
                        color: '#374151',
                        borderRight: '1px solid #e5e7eb',
                        width: '150px'
                      }}>
                        Opening Balance
                      </th>
                      <th style={{
                        padding: '12px 16px',
                        textAlign: 'right',
                        fontWeight: '600',
                        color: '#374151',
                        borderRight: '1px solid #e5e7eb',
                        width: '150px'
                      }}>
                        Closing Balance
                      </th>
                      <th style={{
                        padding: '12px 16px',
                        textAlign: 'right',
                        fontWeight: '600',
                        color: '#374151',
                        borderRight: '1px solid #e5e7eb',
                        width: '120px'
                      }}>
                        Due Date
                      </th>
                      <th style={{
                        padding: '12px 16px',
                        textAlign: 'center',
                        fontWeight: '600',
                        color: '#374151'
                      }}>
                        Days Overdue
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {creditLimitData.overdueBills.map((bill, index) => (
                      <tr key={index} style={{
                        borderBottom: '1px solid #f3f4f6',
                        '&:hover': {
                          background: '#f9fafb'
                        }
                      }}>
                        <td style={{
                          padding: '12px 16px',
                          fontWeight: '600',
                          color: '#1f2937',
                          borderRight: '1px solid #e5e7eb',
                          width: '200px'
                        }}>
                          {bill.REFNO}
                        </td>
                        <td style={{
                          padding: '12px 16px',
                          textAlign: 'right',
                          color: '#6b7280',
                          borderRight: '1px solid #e5e7eb',
                          width: '120px'
                        }}>
                          {bill.DATE}
                        </td>
                        <td style={{
                          padding: '12px 16px',
                          textAlign: 'right',
                          fontWeight: '600',
                          color: bill.OPENINGBALANCE < 0 ? '#dc2626' : '#059669',
                          borderRight: '1px solid #e5e7eb',
                          width: '150px'
                        }}>
                          ₹{Math.abs(bill.OPENINGBALANCE).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          {bill.OPENINGBALANCE < 0 ? ' Dr' : ' Cr'}
                        </td>
                        <td style={{
                          padding: '12px 16px',
                          textAlign: 'right',
                          fontWeight: '600',
                          color: bill.CLOSINGBALANCE < 0 ? '#dc2626' : '#059669',
                          borderRight: '1px solid #e5e7eb',
                          width: '150px'
                        }}>
                          ₹{Math.abs(bill.CLOSINGBALANCE).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          {bill.CLOSINGBALANCE < 0 ? ' Dr' : ' Cr'}
                        </td>
                        <td style={{
                          padding: '12px 16px',
                          textAlign: 'right',
                          color: '#6b7280',
                          borderRight: '1px solid #e5e7eb',
                          width: '120px'
                        }}>
                          {bill.DUEON}
                        </td>
                        <td style={{
                          padding: '12px 16px',
                          textAlign: 'center',
                          fontWeight: '600',
                          color: '#dc2626'
                        }}>
                          {bill.OVERDUEDAYS} days
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div style={{
                marginTop: '20px',
                padding: '16px',
                background: '#f0f9ff',
                border: '1px solid #bae6fd',
                borderRadius: '8px'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '8px'
                }}>
                  <span className="material-icons" style={{ fontSize: '18px', color: '#0369a1' }}>
                    info
                  </span>
                  <span style={{ color: '#0369a1', fontWeight: '600', fontSize: '14px' }}>
                    Total Overdue Amount
                  </span>
                </div>
                <div style={{
                  fontSize: '18px',
                  fontWeight: '700',
                  color: '#dc2626'
                }}>
                  ₹{creditLimitData.overdueBills.reduce((sum, bill) => sum + Math.abs(bill.CLOSINGBALANCE), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Custom Confirmation Modal */}
      {showConfirmModal && (
        <div style={modalOverlayStyle}>
          <div style={{
            ...modalStyle,
            maxWidth: '400px',
            textAlign: 'center'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '20px',
              gap: '12px'
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px'
              }}>
                ⚠️
              </div>
              <h3 style={{
                margin: 0,
                color: '#1f2937',
                fontSize: '18px',
                fontWeight: '600'
              }}>
                Customer Change Warning
              </h3>
            </div>
            
            <p style={{
              margin: '0 0 24px 0',
              color: '#374151',
              fontSize: '14px',
              lineHeight: '1.5'
            }}>
              {confirmMessage}
            </p>
            
            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'center'
            }}>
              <button
                onClick={() => {
                  if (confirmAction) {
                    confirmAction();
                  }
                  setShowConfirmModal(false);
                }}
                style={{
                  background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 20px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  minWidth: '80px'
                }}
              >
                Continue
              </button>
              <button
                onClick={() => setShowConfirmModal(false)}
                style={{
                  background: 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 20px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  minWidth: '80px'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Order Result Modal */}
      {showOrderResultModal && (
        <div style={modalOverlayStyle}>
          <div style={{
            ...modalStyle,
            maxWidth: '500px',
            textAlign: 'center'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '20px',
              gap: '12px'
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: orderResult.success 
                  ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                  : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px',
                color: 'white'
              }}>
                {orderResult.success ? '✅' : '❌'}
              </div>
              <h3 style={{
                margin: 0,
                color: '#1f2937',
                fontSize: '18px',
                fontWeight: '600'
              }}>
                {orderResult.success ? 'Order Success' : 'Order Failed'}
              </h3>
            </div>
            
            <p style={{
              margin: '0 0 20px 0',
              color: '#374151',
              fontSize: '16px',
              lineHeight: '1.5',
              fontWeight: '500'
            }}>
              {orderResult.message}
            </p>
            
            {/* Tally Response Details for Failed Orders */}
            {!orderResult.success && orderResult.tallyResponse && (
              <div style={{
                background: '#f3f4f6',
                borderRadius: '8px',
                padding: '16px',
                margin: '0 0 20px 0',
                textAlign: 'left'
              }}>
                <h4 style={{
                  margin: '0 0 12px 0',
                  color: '#374151',
                  fontSize: '14px',
                  fontWeight: '600'
                }}>
                  Tally Response Details:
                </h4>
                <div style={{
                  fontSize: '13px',
                  color: '#6b7280',
                  lineHeight: '1.4'
                }}>
                  <div><strong>Voucher Number:</strong> {orderResult.tallyResponse.BODY?.DATA?.IMPORTRESULT?.VCHNUMBER || 'N/A'}</div>
                  <div><strong>Status:</strong> {orderResult.tallyResponse.BODY?.DATA?.IMPORTRESULT?.STATUS || 'N/A'}</div>
                  <div><strong>Created:</strong> {orderResult.tallyResponse.BODY?.DATA?.IMPORTRESULT?.CREATED || 'N/A'}</div>
                  <div><strong>Altered:</strong> {orderResult.tallyResponse.BODY?.DATA?.IMPORTRESULT?.ALTERED || 'N/A'}</div>
                  <div><strong>Errors:</strong> {orderResult.tallyResponse.BODY?.DATA?.IMPORTRESULT?.ERRORS || 'N/A'}</div>
                  <div><strong>Exceptions:</strong> {orderResult.tallyResponse.BODY?.DATA?.IMPORTRESULT?.EXCEPTIONS || 'N/A'}</div>
                </div>
              </div>
            )}
            
            <div style={{
              display: 'flex',
              justifyContent: 'center'
            }}>
              <button
                onClick={() => setShowOrderResultModal(false)}
                style={{
                  background: orderResult.success 
                    ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                    : 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '12px 24px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  minWidth: '100px'
                }}
              >
                {orderResult.success ? 'Great!' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stock Breakdown Modal */}
      {showStockModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '80vh',
            overflow: 'auto',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
          }}>
            {/* Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px',
              paddingBottom: '16px',
              borderBottom: '1px solid #e5e7eb'
            }}>
              <h3 style={{
                margin: 0,
                fontSize: '18px',
                fontWeight: '600',
                color: '#1f2937'
              }}>
                {(() => {
                  if (canShowGodownBrkup && canShowMulticoBrkup) {
                    return showGodownStock ? 'Godown-wise' : 'Company-wise';
                  } else if (canShowGodownBrkup) {
                    return 'Godown-wise';
                  } else if (canShowMulticoBrkup) {
                    return 'Company-wise';
                  }
                  return 'Stock Breakdown';
                })()} Stock Breakdown - {selectedItem}
              </h3>
              <button
                onClick={() => setShowStockModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#6b7280',
                  padding: '4px'
                }}
              >
                ×
              </button>
            </div>

            {/* Toggle Switch - Only show if both permissions are enabled */}
            {canShowGodownBrkup && canShowMulticoBrkup && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '20px',
                gap: '12px'
              }}>
                <span style={{
                  fontSize: '14px',
                  fontWeight: '500',
                  color: showGodownStock ? '#1f2937' : '#6b7280'
                }}>
                  By Godown
                </span>
                <button
                  onClick={() => setShowGodownStock(!showGodownStock)}
                  style={{
                    width: '50px',
                    height: '24px',
                    borderRadius: '12px',
                    border: 'none',
                    background: showGodownStock ? '#3b82f6' : '#d1d5db',
                    position: 'relative',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    background: 'white',
                    position: 'absolute',
                    top: '2px',
                    left: showGodownStock ? '28px' : '2px',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
                  }} />
                </button>
                <span style={{
                  fontSize: '14px',
                  fontWeight: '500',
                  color: !showGodownStock ? '#1f2937' : '#6b7280'
                }}>
                  By Company
                </span>
              </div>
            )}

            {/* Content */}
            {stockBreakdownLoading ? (
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '40px',
                color: '#6b7280'
              }}>
                Loading...
              </div>
            ) : stockBreakdownError ? (
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '40px',
                color: '#ef4444'
              }}>
                {stockBreakdownError}
              </div>
            ) : stockBreakdownData ? (
              <div>
                {/* Summary */}
                <div style={{
                  backgroundColor: '#f8fafc',
                  padding: '16px',
                  borderRadius: '8px',
                  marginBottom: '20px'
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center'
                  }}>
                    <span style={{
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#374151'
                    }}>
                      {(() => {
                        if (canShowGodownBrkup && canShowMulticoBrkup) {
                          return showGodownStock ? 'Total Godowns' : 'Total Companies';
                        } else if (canShowGodownBrkup) {
                          return 'Total Godowns';
                        } else if (canShowMulticoBrkup) {
                          return 'Total Companies';
                        }
                        return 'Total Items';
                      })()}: {stockBreakdownData.totalGodowns || stockBreakdownData.totalCompanies || 0}
                    </span>
                  </div>
                </div>

                {/* Stock List */}
                <div style={{
                  maxHeight: '300px',
                  overflowY: 'auto',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px'
                }}>
                  {(stockBreakdownData.godownStocks || stockBreakdownData.companyStocks || []).map((item, index) => {
                    // Check if this is the current company (for company-wise view)
                    const isCurrentCompany = !showGodownStock && company && item.GUID === company;
                    
                    // Determine stock display value
                    const stockValue = item.CLOSINGSTOCK || 0;
                    const displayValue = canShowClosingStockYesNo ? (stockValue > 0 ? 'Yes' : 'No') : stockValue;
                    
                    return (
                      <div
                        key={index}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '12px 16px',
                          borderBottom: index < (stockBreakdownData.godownStocks || stockBreakdownData.companyStocks || []).length - 1 ? '1px solid #f3f4f6' : 'none',
                          backgroundColor: index % 2 === 0 ? 'white' : '#f9fafb'
                        }}
                      >
                        <span style={{
                          fontSize: '14px',
                          fontWeight: '500',
                          color: isCurrentCompany ? '#6b7280' : '#1f2937',
                          fontStyle: isCurrentCompany ? 'italic' : 'normal'
                        }}>
                          {item.NAME}
                        </span>
                        <span style={{
                          fontSize: '14px',
                          fontWeight: '600',
                          color: stockValue > 0 ? '#059669' : '#6b7280'
                        }}>
                          {displayValue}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {/* Footer */}
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              marginTop: '20px',
              paddingTop: '16px',
              borderTop: '1px solid #e5e7eb'
            }}>
              <button
                onClick={() => setShowStockModal(false)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PlaceOrder;
