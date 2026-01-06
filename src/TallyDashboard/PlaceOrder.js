import React, { useState, useEffect, useMemo, useRef } from 'react';
import { apiPost } from '../utils/apiUtils';
import { deobfuscateStockItems, enhancedDeobfuscateValue } from '../utils/frontendDeobfuscate';
import { getUserModules, hasPermission, getPermissionValue } from '../config/SideBarConfigurations';
import { getCustomersFromOPFS, syncCustomers } from '../utils/cacheSyncManager';
import '../RecvDashboard/ReceivablesPage.css';


function PlaceOrder() {

  // Enhanced responsive breakpoints detection

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [isTablet, setIsTablet] = useState(window.innerWidth > 768 && window.innerWidth <= 1024);
  const [isSmallDesktop, setIsSmallDesktop] = useState(window.innerWidth > 1024 && window.innerWidth <= 1200);
  const [isMedium, setIsMedium] = useState(window.innerWidth > 1200 && window.innerWidth <= 1280);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth > 1280);



  useEffect(() => {

    const handleResize = () => {
      const width = window.innerWidth;
      setIsMobile(width <= 768);
      setIsTablet(width > 768 && width <= 1024);
      setIsSmallDesktop(width > 1024 && width <= 1200);
      setIsMedium(width > 1200 && width <= 1280);
      setIsDesktop(width > 1280);

    };

    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);

  }, []);

  // Listen for company changes from top bar

  useEffect(() => {

    const handleCompanyChange = () => {

      // Company changed from top bar

      setSelectedCustomer('');

      setOrderItems([]);

      setCustomerSearchTerm('');

      setItemSearchTerm('');



      const newCompanyGuid = sessionStorage.getItem('selectedCompanyGuid') || '';
      const selectedCompanyTallylocId = sessionStorage.getItem('selectedCompanyTallylocId');
      // Match by both guid and tallyloc_id to handle companies with same guid but different tallyloc_id
      const currentCompany = companies.find(c => 
        c.guid === newCompanyGuid && 
        (selectedCompanyTallylocId ? String(c.tallyloc_id) === String(selectedCompanyTallylocId) : true)
      );



      if (currentCompany) {

        const { tallyloc_id, company: companyVal } = currentCompany;



        // Load cached customers immediately if available

        const customerCacheKey = `ledgerlist-w-addrs_${tallyloc_id}_${companyVal}`;

        const cachedCustomers = sessionStorage.getItem(customerCacheKey);

        if (cachedCustomers) {

          try {

            setCustomerOptions(JSON.parse(cachedCustomers));

          } catch {

            setCustomerOptions([]);

          }

        } else {

          setCustomerOptions([]);

        }



        // Load cached stock items immediately if available

        const stockCacheKey = `stockitems_${tallyloc_id}_${companyVal}`;

        const cachedStockItems = sessionStorage.getItem(stockCacheKey);

        if (cachedStockItems) {

          try {

            setStockItems(JSON.parse(cachedStockItems));

          } catch {

            setStockItems([]);

          }

        } else {

          setStockItems([]);

        }

      } else {

        setCustomerOptions([]);

        setStockItems([]);

      }

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

  // Listen for cache updates from Cache Management

  useEffect(() => {

    const handleCacheUpdate = (event) => {

      const { type, company: updatedCompany } = event.detail || {};

      if (type === 'customers') {

        const currentCompanyGuid = sessionStorage.getItem('selectedCompanyGuid') || '';

        // Read companies from sessionStorage inside the handler to avoid dependency issues

        let companies = [];

        try {

          companies = JSON.parse(sessionStorage.getItem('allConnections') || '[]');

        } catch (e) { }

        const selectedCompanyTallylocId = sessionStorage.getItem('selectedCompanyTallylocId');
        // Match by both guid and tallyloc_id to handle companies with same guid but different tallyloc_id
        const currentCompany = companies.find(c => 
          c.guid === currentCompanyGuid && 
          (selectedCompanyTallylocId ? String(c.tallyloc_id) === String(selectedCompanyTallylocId) : true)
        );

        // Only refresh if the update is for the current company

        if (currentCompany && updatedCompany &&

          (updatedCompany.guid === currentCompanyGuid ||

            (updatedCompany.tallyloc_id === currentCompany.tallyloc_id &&

              updatedCompany.company === currentCompany.company))) {

          console.log('🔄 PlaceOrder: Customer cache updated, refreshing...');

          setRefreshCustomers(prev => prev + 1);

        }

      }

    };



    window.addEventListener('ledgerCacheUpdated', handleCacheUpdate);

    return () => window.removeEventListener('ledgerCacheUpdated', handleCacheUpdate);

  }, []);



  // Auto-populate from E-commerce cart data

  useEffect(() => {

    const cartData = sessionStorage.getItem('ecommerceCartData');

    if (cartData) {

      try {

        const data = JSON.parse(cartData);



        // Set auto-population state

        setIsAutoPopulating(true);

        autoPopulatingRef.current = true;



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

  } catch (e) { }

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

  const setCompany = () => { }; // Dummy function for JSX compatibility



  // Customer list state (with addresses)

  const [customerOptions, setCustomerOptions] = useState([]);

  const [customerLoading, setCustomerLoading] = useState(false);

  const [customerError, setCustomerError] = useState('');

  const [selectedCustomer, setSelectedCustomer] = useState('');

  const [customerFocused, setCustomerFocused] = useState(false);

  const [refreshCustomers, setRefreshCustomers] = useState(0);

  const [refreshingCustomers, setRefreshingCustomers] = useState(false);



  // Auto-population state

  const [isAutoPopulating, setIsAutoPopulating] = useState(false);

  const autoPopulatingRef = useRef(false);

  const hasAutoPopulatedRef = useRef(false);



  // VoucherType state

  const [voucherTypes, setVoucherTypes] = useState([]);

  const [voucherTypesLoading, setVoucherTypesLoading] = useState(false);

  const [voucherTypesError, setVoucherTypesError] = useState('');

  const [selectedVoucherType, setSelectedVoucherType] = useState('');

  const [showVoucherTypeDropdown, setShowVoucherTypeDropdown] = useState(false);

  const [voucherTypeFocused, setVoucherTypeFocused] = useState(false);

  // Class Name state
  const [selectedClassName, setSelectedClassName] = useState('');

  const [showClassNameDropdown, setShowClassNameDropdown] = useState(false);

  const [classNameFocused, setClassNameFocused] = useState(false);

  // Ledger values state - stores user-defined values for ledgers
  const [ledgerValues, setLedgerValues] = useState({});



  // Customer search and dropdown state

  const [customerSearchTerm, setCustomerSearchTerm] = useState('');

  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  const [filteredCustomers, setFilteredCustomers] = useState([]);



  // Stock items state

  const [stockItems, setStockItems] = useState([]);

  const [stockItemsLoading, setStockItemsLoading] = useState(false);

  const [stockItemsError, setStockItemsError] = useState('');

  const [refreshStockItems, setRefreshStockItems] = useState(0);


  // Units array (separate from stock items)
  const [units, setUnits] = useState([]);


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

      // Only clear if filteredItems is not already empty to prevent unnecessary re-renders

      if (filteredItems.length > 0) {

        setFilteredItems([]);

      }

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

  }, [itemSearchTerm, stockItems.length, canShowItemsHasQty]); // Use stockItems.length instead of array reference



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

    // Capture the current search term to avoid closure issues

    const currentSearchTerm = customerSearchTerm.trim();



    // Clear results immediately if search term is empty

    if (!currentSearchTerm) {

      // Don't set to empty here - let the dropdown useEffect handle showing all customers

      return;

    }



    // Clear previous results immediately when search term changes

    // This ensures old results don't show when user types new search term

    setFilteredCustomers([]);



    // Debounce search to improve performance

    const timeoutId = setTimeout(() => {

      // Use captured search term to ensure we're searching with the correct value

      const searchLower = currentSearchTerm.toLowerCase();



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

    if (showCustomerDropdown && !customerSearchTerm.trim() && customerOptions.length > 0) {

      // Always show all customers when dropdown opens (like ecommerce)

      setFilteredCustomers(customerOptions);

    }

  }, [showCustomerDropdown, customerSearchTerm, customerOptions.length]); // Use length instead of array reference





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

  const [enteredUnitType, setEnteredUnitType] = useState('base'); // Track which unit user entered: 'base' or 'additional'
  const [customConversion, setCustomConversion] = useState(null); // Store custom conversion: { baseQty, addlQty, denominator, conversion }
  const [customAddlQty, setCustomAddlQty] = useState(null); // Store custom additional quantity when user enters "12 box = 20 nos"
  const [compoundBaseQty, setCompoundBaseQty] = useState(null); // Store compound base unit quantity (e.g., 5.3 pkt from "5 pkt 3 nos")
  const [compoundAddlQty, setCompoundAddlQty] = useState(null); // Store compound additional unit quantity (e.g., 25.7 pkt from "25 pkt 7 nos")
  const [baseQtyOnly, setBaseQtyOnly] = useState(null); // Store only the base quantity (e.g., 3 box from "3 box 9 pkt 7 nos")
  const settingCustomConversionRef = useRef(false); // Prevent infinite loop when setting custom conversion
  const [itemRate, setItemRate] = useState(0);

  const [itemDiscountPercent, setItemDiscountPercent] = useState(0);

  const [itemGstPercent, setItemGstPercent] = useState(0);

  const [itemDescription, setItemDescription] = useState('');

  const [orderItems, setOrderItems] = useState([]);

  const [itemFocused, setItemFocused] = useState(false);

  const [quantityFocused, setQuantityFocused] = useState(false);

  const [descriptionFocused, setDescriptionFocused] = useState(false);

  const [showDescription, setShowDescription] = useState(false);



  // Simplified UOM state - Tally-style
  const [selectedItemUnitConfig, setSelectedItemUnitConfig] = useState(null);

  const [quantityInput, setQuantityInput] = useState(''); // Single text input (e.g., "10 Box", "5 Nos", "2 Kgs 500 Gms")

  // Rate UOM state (independent of quantity UOM)
  const [rateUOM, setRateUOM] = useState('base'); // 'base' or 'additional'
  const [showRateUOMDropdown, setShowRateUOMDropdown] = useState(false);
  const [rateUOMFocused, setRateUOMFocused] = useState(false);


  // Auto-calculated amount

  const [itemAmount, setItemAmount] = useState(0);



  // Credit limit state

  const [creditLimitData, setCreditLimitData] = useState(null);

  const [showOverdueBills, setShowOverdueBills] = useState(false);

  const [creditLimitLoading, setCreditLimitLoading] = useState(false);



  // Edit item state - track which item ID is being edited (null means not editing)

  const [editingItemId, setEditingItemId] = useState(null);
  const [editingItemIndex, setEditingItemIndex] = useState(null);

  const [editQuantity, setEditQuantity] = useState(1);
  const [editQuantityInput, setEditQuantityInput] = useState(''); // For Tally-style quantity input
  const [editItemQuantity, setEditItemQuantity] = useState(1); // Converted quantity in base units
  const [editRateUOM, setEditRateUOM] = useState('base'); // Rate UOM for editing
  const [editCustomConversion, setEditCustomConversion] = useState(null);
  const [editCustomAddlQty, setEditCustomAddlQty] = useState(null);
  const [editCompoundBaseQty, setEditCompoundBaseQty] = useState(null);
  const [editCompoundAddlQty, setEditCompoundAddlQty] = useState(null);
  const [editBaseQtyOnly, setEditBaseQtyOnly] = useState(null);
  const [editItemAmount, setEditItemAmount] = useState(0);
  const [editShowRateUOMDropdown, setEditShowRateUOMDropdown] = useState(false);
  const [editSelectedItemUnitConfig, setEditSelectedItemUnitConfig] = useState(null);

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





  // =============== Utility Functions for Unit Handling ===============


  // Build unit config from item and units array
  const buildUnitConfig = (item, unitsArray) => {
    if (!item) return null;

    const config = {
      BASEUNITS: item.BASEUNITS || '',
      ADDITIONALUNITS: item.ADDITIONALUNITS || '',
      DENOMINATOR: item.DENOMINATOR || '',
      CONVERSION: item.CONVERSION || '1'
    };

    // Only lookup units if unitsArray is provided and not empty
    // If unitsArray is empty, config will still be returned but without decimal places
    // It will be rebuilt when units array loads
    if (unitsArray && Array.isArray(unitsArray) && unitsArray.length > 0) {
      // Find base unit in units array (case-insensitive match)
      if (item.BASEUNITS) {
        const baseUnit = unitsArray.find(u =>
          u.NAME && item.BASEUNITS &&
          u.NAME.toLowerCase() === item.BASEUNITS.toLowerCase()
        );
        if (baseUnit) {
          // DECIMALPLACES can be string or number - convert to number
          const decimalPlaces = typeof baseUnit.DECIMALPLACES === 'string'
            ? parseInt(baseUnit.DECIMALPLACES) || 0
            : (baseUnit.DECIMALPLACES || 0);
          config.BASEUNIT_DECIMAL = decimalPlaces;
          console.log('buildUnitConfig: Found base unit', {
            itemName: item.NAME,
            baseUnitName: item.BASEUNITS,
            foundUnit: baseUnit.NAME,
            decimalPlaces: baseUnit.DECIMALPLACES,
            decimalPlacesType: typeof baseUnit.DECIMALPLACES,
            stored: config.BASEUNIT_DECIMAL,
            storedType: typeof config.BASEUNIT_DECIMAL
          });
          if (baseUnit.ISSIMPLEUNIT === 'No') {
            // Compound base unit
            config.BASEUNITHASCOMPOUNDUNIT = 'Yes';
            config.BASEUNITCOMP_BASEUNIT = baseUnit.BASEUNITS;
            config.BASEUNITCOMP_ADDLUNIT = baseUnit.ADDITIONALUNITS;
            config.BASEUNITCOMP_CONVERSION = baseUnit.CONVERSION || '1';
            // Find sub-unit for decimals
            if (baseUnit.ADDITIONALUNITS) {
              const subUnit = unitsArray.find(u => u.NAME === baseUnit.ADDITIONALUNITS);
              if (subUnit) {
                const subDecimalPlaces = typeof subUnit.DECIMALPLACES === 'string'
                  ? parseInt(subUnit.DECIMALPLACES) || 0
                  : (subUnit.DECIMALPLACES || 0);
                config.BASEUNITCOMP_ADDLUNIT_DECIMAL = subDecimalPlaces;
              }
            }
          } else {
            config.BASEUNITHASCOMPOUNDUNIT = 'No';
          }
        }
      }

      // Find additional unit in units array (only if ADDITIONALUNITS is not empty)
      if (item.ADDITIONALUNITS && item.ADDITIONALUNITS.trim() !== '') {
        const addlUnit = unitsArray.find(u =>
          u.NAME && item.ADDITIONALUNITS &&
          u.NAME.toLowerCase() === item.ADDITIONALUNITS.toLowerCase()
        );
        if (addlUnit) {
          // DECIMALPLACES can be string or number - convert to number
          const decimalPlaces = typeof addlUnit.DECIMALPLACES === 'string'
            ? parseInt(addlUnit.DECIMALPLACES) || 0
            : (addlUnit.DECIMALPLACES || 0);
          config.ADDITIONALUNITS_DECIMAL = decimalPlaces;
          if (addlUnit.ISSIMPLEUNIT === 'No') {
            // Compound additional unit
            config.ADDITIONALUNITHASCOMPOUNDUNIT = 'Yes';
            config.ADDLUNITCOMP_BASEUNIT = addlUnit.BASEUNITS;
            config.ADDLUNITCOMP_ADDLUNIT = addlUnit.ADDITIONALUNITS;
            config.ADDLUNITCOMP_CONVERSION = addlUnit.CONVERSION || '1';
            // Find sub-unit for decimals
            if (addlUnit.ADDITIONALUNITS) {
              const subUnit = unitsArray.find(u => u.NAME === addlUnit.ADDITIONALUNITS);
              if (subUnit) {
                const subDecimalPlaces = typeof subUnit.DECIMALPLACES === 'string'
                  ? parseInt(subUnit.DECIMALPLACES) || 0
                  : (subUnit.DECIMALPLACES || 0);
                config.ADDLUNITCOMP_ADDLUNIT_DECIMAL = subDecimalPlaces;
              }
            }
          } else {
            config.ADDITIONALUNITHASCOMPOUNDUNIT = 'No';
          }
        }
      }
    }

    return config;
  };

  // Validate quantity input based on unit's decimal places (auto-rounds when needed)
  // Also validates that only configured UOMs are used
  const validateQuantityInput = (input, unitConfig, unitsArray, isBlur = false) => {
    console.log('validateQuantityInput called:', {
      input,
      baseUnits: unitConfig?.BASEUNITS,
      baseUnitDecimal: unitConfig?.BASEUNIT_DECIMAL,
      unitsArrayLength: unitsArray?.length,
      unitsArrayType: Array.isArray(unitsArray) ? 'array' : typeof unitsArray,
      isBlur,
      unitsArraySample: unitsArray && unitsArray.length > 0 ? unitsArray.slice(0, 2) : 'empty'
    });

    if (!input || !unitConfig) return input;

    const trimmed = input.trim();
    if (!trimmed) return input;

    // Get allowed units for this item (preserve original case for display)
    const allowedBaseUnit = unitConfig.BASEUNITS || '';
    const allowedAddlUnit = unitConfig.ADDITIONALUNITS || '';
    const allowedUnits = [allowedBaseUnit]; // Keep original case
    if (allowedAddlUnit && allowedAddlUnit.trim() !== '') {
      allowedUnits.push(allowedAddlUnit); // Keep original case
    }

    // For compound base unit, also allow the component units
    // Note: Compound units like "LTR of 1000 ML" are stored as single unit names
    // When BASEUNITS itself is compound, allow both component units (LTR and ML)
    if (unitConfig.BASEUNITHASCOMPOUNDUNIT === 'Yes') {
      const baseCompBase = unitConfig.BASEUNITCOMP_BASEUNIT;
      const baseCompAddl = unitConfig.BASEUNITCOMP_ADDLUNIT;
      if (baseCompBase) allowedUnits.push(baseCompBase);
      if (baseCompAddl) allowedUnits.push(baseCompAddl);
    }

    // Also check if BASEUNITS itself is a compound unit name (like "LTR of 1000 ML")
    // In this case, we need to look up the unit in units array to get component units
    if (unitConfig.BASEUNITS && unitsArray && unitsArray.length > 0) {
      const baseUnitObj = unitsArray.find(u => u.NAME === unitConfig.BASEUNITS);
      if (baseUnitObj && baseUnitObj.ISSIMPLEUNIT === 'No') {
        // BASEUNITS is itself a compound unit - allow component units
        if (baseUnitObj.BASEUNITS) allowedUnits.push(baseUnitObj.BASEUNITS);
        if (baseUnitObj.ADDITIONALUNITS) allowedUnits.push(baseUnitObj.ADDITIONALUNITS);
      }
    }

    // For compound additional unit, also allow the component units
    if (unitConfig.ADDITIONALUNITHASCOMPOUNDUNIT === 'Yes') {
      const addlCompBase = unitConfig.ADDLUNITCOMP_BASEUNIT;
      const addlCompAddl = unitConfig.ADDLUNITCOMP_ADDLUNIT;
      if (addlCompBase) allowedUnits.push(addlCompBase);
      if (addlCompAddl) allowedUnits.push(addlCompAddl);
    }

    // Try to parse as simple number (defaults to primary UOM)
    // Check if it's a pure number (with or without decimals) or ends with a decimal point
    const numberPattern = /^-?\d*\.?\d*$/;
    if (numberPattern.test(trimmed)) {
      // Check if it ends with just a decimal point (user is typing)
      if (trimmed.endsWith('.') && !trimmed.endsWith('..')) {
        // Check if unit allows decimals
        let decimalPlaces = null;

        // First try to get decimal places from units array
        if (unitsArray && unitsArray.length > 0) {
          const baseUnit = unitsArray.find(u => u.NAME === unitConfig.BASEUNITS);
          if (baseUnit) {
            decimalPlaces = parseInt(baseUnit.DECIMALPLACES) || 0;
          }
        }

        // Fallback to unitConfig if units array not available or unit not found
        if (decimalPlaces === null && unitConfig.BASEUNIT_DECIMAL !== undefined) {
          decimalPlaces = parseInt(unitConfig.BASEUNIT_DECIMAL) || 0;
        }

        // If still no decimal places info, default to 0 (no decimals allowed)
        if (decimalPlaces === null) {
          decimalPlaces = 0;
        }

        if (decimalPlaces === 0) {
          // Remove the decimal point immediately
          return trimmed.slice(0, -1);
        }

        return trimmed; // Allow decimal point if unit allows decimals
      }

      const simpleNumber = parseFloat(trimmed);
      if (!isNaN(simpleNumber)) {
        let decimalPlaces = null;

        // First try to get decimal places from units array (case-insensitive match)
        if (unitsArray && unitsArray.length > 0 && unitConfig.BASEUNITS) {
          const baseUnit = unitsArray.find(u =>
            u.NAME && unitConfig.BASEUNITS &&
            u.NAME.toLowerCase() === unitConfig.BASEUNITS.toLowerCase()
          );
          if (baseUnit) {
            // DECIMALPLACES can be string or number
            decimalPlaces = typeof baseUnit.DECIMALPLACES === 'string'
              ? parseInt(baseUnit.DECIMALPLACES) || 0
              : (baseUnit.DECIMALPLACES || 0);
            console.log('validateQuantityInput: Found base unit in units array', {
              baseUnitName: unitConfig.BASEUNITS,
              foundUnit: baseUnit.NAME,
              decimalPlaces: baseUnit.DECIMALPLACES,
              decimalPlacesType: typeof baseUnit.DECIMALPLACES,
              parsed: decimalPlaces,
              input: trimmed
            });
          } else {
            console.log('validateQuantityInput: Base unit NOT found in units array', {
              baseUnitName: unitConfig.BASEUNITS,
              availableUnits: unitsArray.map(u => u.NAME)
            });
          }
        }

        // Fallback to unitConfig if units array not available or unit not found
        if (decimalPlaces === null && unitConfig.BASEUNIT_DECIMAL !== undefined) {
          // BASEUNIT_DECIMAL should already be a number, but handle both cases
          decimalPlaces = typeof unitConfig.BASEUNIT_DECIMAL === 'string'
            ? parseInt(unitConfig.BASEUNIT_DECIMAL) || 0
            : (unitConfig.BASEUNIT_DECIMAL || 0);
          console.log('validateQuantityInput: Using unitConfig BASEUNIT_DECIMAL', {
            baseUnitDecimal: unitConfig.BASEUNIT_DECIMAL,
            baseUnitDecimalType: typeof unitConfig.BASEUNIT_DECIMAL,
            parsed: decimalPlaces
          });
        }

        // If still no decimal places info, try to look it up from units array one more time
        // (in case units array just loaded)
        if (decimalPlaces === null && unitsArray && unitsArray.length > 0 && unitConfig.BASEUNITS) {
          const baseUnit = unitsArray.find(u =>
            u.NAME && unitConfig.BASEUNITS &&
            u.NAME.toLowerCase() === unitConfig.BASEUNITS.toLowerCase()
          );
          if (baseUnit) {
            // DECIMALPLACES can be string or number
            decimalPlaces = typeof baseUnit.DECIMALPLACES === 'string'
              ? parseInt(baseUnit.DECIMALPLACES) || 0
              : (baseUnit.DECIMALPLACES || 0);
            console.log('validateQuantityInput: Found unit on retry', {
              baseUnitName: unitConfig.BASEUNITS,
              foundUnit: baseUnit.NAME,
              decimalPlaces: baseUnit.DECIMALPLACES,
              decimalPlacesType: typeof baseUnit.DECIMALPLACES,
              parsed: decimalPlaces
            });
          }
        }

        // If still no decimal places info, default to 0 (round decimals)
        if (decimalPlaces === null) {
          decimalPlaces = 0;
          console.warn('validateQuantityInput: No decimal places found, defaulting to 0', {
            baseUnits: unitConfig.BASEUNITS,
            unitsArrayLength: unitsArray?.length,
            baseUnitDecimal: unitConfig.BASEUNIT_DECIMAL
          });
        }

        // Apply decimal place validation
        if (decimalPlaces === 0 && trimmed.includes('.')) {
          // No decimals allowed - round to nearest integer (10.2 -> 10, 10.6 -> 11)
          // Always round when decimal places is 0, but only on blur
          if (isBlur) {
            const rounded = Math.round(simpleNumber);
            return rounded.toString();
          }
          // While typing, allow decimal point temporarily (will round on blur)
          return trimmed;
        } else if (decimalPlaces > 0) {
          // Allow decimals - limit to allowed places
          // Always format on blur to ensure correct decimal places
          if (isBlur) {
            return parseFloat(simpleNumber).toFixed(decimalPlaces);
          }
          // While typing, only limit if exceeds allowed places
          if (trimmed.includes('.')) {
            const decimalPart = trimmed.split('.')[1];
            if (decimalPart && decimalPart.length > decimalPlaces) {
              return parseFloat(simpleNumber).toFixed(decimalPlaces);
            }
          }
        }

        return trimmed;
      }
    }

    // Parse custom conversion format (e.g., "12 box = 20 nos" or "12box=20nos" or "12 box 20 nos")
    // This allows users to override DENOMINATOR and CONVERSION
    if (unitConfig.BASEUNITS && unitConfig.ADDITIONALUNITS) {
      // Try simple format first: "number unit = number unit"
      const simpleCustomConversionPattern = /^(\d+(?:\.\d+)?)\s*(\w+)\s*[=]?\s*(\d+(?:\.\d+)?)\s*(\w+)$/i;
      let customConversionMatch = trimmed.match(simpleCustomConversionPattern);

      // If simple format doesn't match, try compound format on right side: "number unit = number unit number unit"
      if (!customConversionMatch) {
        const compoundRightPattern = /^(\d+(?:\.\d+)?)\s*(\w+)\s*[=]?\s*(\d+(?:\.\d+)?)\s*(\w+)\s+(\d+(?:\.\d+)?)\s*(\w+)$/i;
        customConversionMatch = trimmed.match(compoundRightPattern);
      }

      // If still no match, try compound format on left side: "number unit number unit = number unit"
      if (!customConversionMatch) {
        const compoundLeftPattern = /^(\d+(?:\.\d+)?)\s*(\w+)\s+(\d+(?:\.\d+)?)\s*(\w+)\s*[=]?\s*(\d+(?:\.\d+)?)\s*(\w+)$/i;
        customConversionMatch = trimmed.match(compoundLeftPattern);
      }

      if (customConversionMatch) {
        let qty1, unit1, qty2, unit2, qty3, unit3;

        if (customConversionMatch.length === 5) {
          // Simple format: "number unit = number unit"
          qty1 = parseFloat(customConversionMatch[1]);
          unit1 = customConversionMatch[2].toLowerCase();
          qty2 = parseFloat(customConversionMatch[3]);
          unit2 = customConversionMatch[4].toLowerCase();
          qty3 = null;
          unit3 = null;
        } else if (customConversionMatch.length === 7) {
          // Compound format: "number unit = number unit number unit" or "number unit number unit = number unit"
          qty1 = parseFloat(customConversionMatch[1]);
          unit1 = customConversionMatch[2].toLowerCase();
          qty2 = parseFloat(customConversionMatch[3]);
          unit2 = customConversionMatch[4].toLowerCase();
          qty3 = parseFloat(customConversionMatch[5]);
          unit3 = customConversionMatch[6].toLowerCase();
        }

        // Helper function to check if a unit matches (supports full name and abbreviations)
        const unitMatches = (inputUnit, targetUnit) => {
          if (!inputUnit || !targetUnit) return false;
          const inputLower = inputUnit.toLowerCase().trim();
          const targetLower = targetUnit.toLowerCase().trim();
          if (inputLower === targetLower) return true;
          // Check if target starts with input (e.g., "pkt" matches "pkt of 10 nos")
          if (inputLower.length >= 1 && targetLower.startsWith(inputLower)) {
            // Make sure it's a word boundary (not just a substring)
            const nextChar = targetLower[inputLower.length];
            if (!nextChar || nextChar === ' ' || nextChar === '-' || nextChar === '=') return true;
          }
          // Check if input starts with target (e.g., "pkt of 10 nos" matches "pkt")
          if (targetLower.length >= 1 && inputLower.startsWith(targetLower)) {
            const nextChar = inputLower[targetLower.length];
            if (!nextChar || nextChar === ' ' || nextChar === '-' || nextChar === '=') return true;
          }
          // Also check if target contains input as a whole word (for compound units)
          const wordBoundaryRegex = new RegExp(`\\b${inputLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
          if (wordBoundaryRegex.test(targetLower)) return true;
          return false;
        };

        const baseUnitLower = unitConfig.BASEUNITS.toLowerCase();
        const addlUnitLower = unitConfig.ADDITIONALUNITS.toLowerCase();

        // Check if BASEUNITS is compound and get component units
        let baseCompBaseUnit = null;
        let baseCompAddlUnit = null;
        let baseCompConversion = 1;
        if (unitsArray && unitsArray.length > 0 && unitConfig.BASEUNITS) {
          const baseUnitObj = unitsArray.find(u => u.NAME === unitConfig.BASEUNITS);
          if (baseUnitObj && baseUnitObj.ISSIMPLEUNIT === 'No') {
            baseCompBaseUnit = baseUnitObj.BASEUNITS?.toLowerCase();
            baseCompAddlUnit = baseUnitObj.ADDITIONALUNITS?.toLowerCase();
            baseCompConversion = parseFloat(baseUnitObj.CONVERSION) || 1;
          }
        }

        // Determine which side is base and which is additional
        let baseQty, addlQty, isBaseCompound = false, baseMainQty = 0, baseSubQty = 0;
        let baseMainUnit = '', baseSubUnit = '';

        // FIRST: Determine which side is compound (has qty3 and unit3, and right side has 3 parts)
        // For "number unit = number unit number unit": right is compound
        // For "number unit number unit = number unit": left is compound
        const hasThreeParts = qty3 !== null && unit3 !== null;
        let rightIsCompound = false;
        let leftIsCompound = false;

        if (hasThreeParts) {
          // Determine which side is compound by checking where the = sign is
          if (trimmed.includes('=')) {
            const parts = trimmed.split('=');
            const leftPart = parts[0].trim();
            const rightPart = parts[1].trim();

            // Check if left part matches compound pattern (has two units)
            const leftHasTwoUnits = /^\d+(?:\.\d+)?\s+\w+\s+\d+(?:\.\d+)?\s+\w+$/i.test(leftPart);
            // Check if right part matches compound pattern (has two units)
            const rightHasTwoUnits = /^\d+(?:\.\d+)?\s+\w+\s+\d+(?:\.\d+)?\s+\w+$/i.test(rightPart);

            if (leftHasTwoUnits && !rightHasTwoUnits) {
              leftIsCompound = true;
            } else if (!leftHasTwoUnits && rightHasTwoUnits) {
              rightIsCompound = true;
            }
          } else {
            // No = sign - try to determine based on unit matching
            // If unit1 and unit2 match base component units, left is compound
            if (baseCompBaseUnit && baseCompAddlUnit) {
              if ((unitMatches(unit1, baseCompBaseUnit) || unitMatches(unit1, baseCompAddlUnit)) &&
                (unitMatches(unit2, baseCompBaseUnit) || unitMatches(unit2, baseCompAddlUnit)) &&
                unitMatches(unit3, addlUnitLower)) {
                leftIsCompound = true;
              } else if (unitMatches(unit1, addlUnitLower) &&
                (unitMatches(unit2, baseCompBaseUnit) || unitMatches(unit2, baseCompAddlUnit)) &&
                (unitMatches(unit3, baseCompBaseUnit) || unitMatches(unit3, baseCompAddlUnit))) {
                rightIsCompound = true;
              }
            }
          }
        }

        // THEN: Check unit matches based on which side is compound
        // Check if left side matches additional unit (only if not compound)
        const leftMatchesAddl = !leftIsCompound && unitMatches(unit1, addlUnitLower);
        // Check if right side matches additional unit (simple or compound)
        // If left is compound, check unit3; otherwise check unit2
        const rightMatchesAddl = leftIsCompound
          ? unitMatches(unit3, addlUnitLower)
          : (rightIsCompound ? false : unitMatches(unit2, addlUnitLower));

        // Check if left side matches base unit (simple or compound)
        // If left is compound, check if unit1 and unit2 match component units
        const leftMatchesBase = leftIsCompound
          ? (baseCompBaseUnit && baseCompAddlUnit &&
            ((unitMatches(unit1, baseCompBaseUnit) && unitMatches(unit2, baseCompAddlUnit)) ||
              (unitMatches(unit1, baseCompAddlUnit) && unitMatches(unit2, baseCompBaseUnit))))
          : (unitMatches(unit1, baseUnitLower) ||
            (baseCompBaseUnit && unitMatches(unit1, baseCompBaseUnit)) ||
            (baseCompAddlUnit && unitMatches(unit1, baseCompAddlUnit)));

        // Check if right side matches base unit (simple or compound)
        // If right is compound, check if unit2 and unit3 match component units
        const rightMatchesBase = rightIsCompound
          ? (baseCompBaseUnit && baseCompAddlUnit &&
            ((unitMatches(unit2, baseCompBaseUnit) && unitMatches(unit3, baseCompAddlUnit)) ||
              (unitMatches(unit2, baseCompAddlUnit) && unitMatches(unit3, baseCompBaseUnit))))
          : (unitMatches(unit2, baseUnitLower) ||
            (baseCompBaseUnit && unitMatches(unit2, baseCompBaseUnit)) ||
            (baseCompAddlUnit && unitMatches(unit2, baseCompAddlUnit)));

        if (leftMatchesAddl && (rightMatchesBase || (rightIsCompound && baseCompBaseUnit && baseCompAddlUnit))) {
          // Format: addlQty addlUnit = baseQty baseUnit (or compound)
          // Example: "1 box = 15 pkt 3 nos"
          addlQty = qty1;
          if (rightIsCompound && baseCompBaseUnit && baseCompAddlUnit) {
            // Right side is compound base unit
            // Check order: main-sub or sub-main
            if (unitMatches(unit2, baseCompBaseUnit) && unitMatches(unit3, baseCompAddlUnit)) {
              // Order: main sub (e.g., "15 pkt 3 nos")
              baseMainQty = qty2;
              baseSubQty = qty3;
              baseMainUnit = unit2;
              baseSubUnit = unit3;
            } else if (unitMatches(unit2, baseCompAddlUnit) && unitMatches(unit3, baseCompBaseUnit)) {
              // Order: sub main (e.g., "3 nos 15 pkt")
              baseMainQty = qty3;
              baseSubQty = qty2;
              baseMainUnit = unit3;
              baseSubUnit = unit2;
            } else {
              return ''; // Invalid match
            }
            // Convert compound to base unit quantity
            baseQty = baseMainQty + (baseSubQty / baseCompConversion);
            isBaseCompound = true;
          } else {
            // Right side is simple base unit
            baseQty = qty2;
          }
        } else if ((leftMatchesBase || leftIsCompound) && rightMatchesAddl) {
          // Format: baseQty baseUnit (or compound) = addlQty addlUnit
          // Example: "15 pkt 3 nos = 1 box"
          if (leftIsCompound && baseCompBaseUnit && baseCompAddlUnit) {
            // Left side is compound base unit
            // Check order: main-sub or sub-main
            if (unitMatches(unit1, baseCompBaseUnit) && unitMatches(unit2, baseCompAddlUnit)) {
              // Order: main sub (e.g., "15 pkt 3 nos")
              baseMainQty = qty1;
              baseSubQty = qty2;
              baseMainUnit = unit1;
              baseSubUnit = unit2;
              addlQty = qty3; // qty3 is the additional unit quantity
            } else if (unitMatches(unit1, baseCompAddlUnit) && unitMatches(unit2, baseCompBaseUnit)) {
              // Order: sub main (e.g., "3 nos 15 pkt")
              baseMainQty = qty2;
              baseSubQty = qty1;
              baseMainUnit = unit2;
              baseSubUnit = unit1;
              addlQty = qty3; // qty3 is the additional unit quantity
            } else {
              return ''; // Invalid match
            }
            // Convert compound to base unit quantity
            baseQty = baseMainQty + (baseSubQty / baseCompConversion);
            isBaseCompound = true;
          } else {
            // Left side is simple base unit
            baseQty = qty1;
          }
        } else {
          // Try match fallback for simple format
          if (customConversionMatch.length === 5) {
            // Use unitMatches helper for flexible matching (supports abbreviations and partial matches)
            if (unitMatches(unit1, baseUnitLower) && unitMatches(unit2, addlUnitLower)) {
              baseQty = qty1;
              addlQty = qty2;
            } else if (unitMatches(unit1, addlUnitLower) && unitMatches(unit2, baseUnitLower)) {
              baseQty = qty2;
              addlQty = qty1;
            } else {
              // Also check if unit1 matches base component units (for compound base units)
              if (baseCompBaseUnit && unitMatches(unit1, baseCompBaseUnit) && unitMatches(unit2, addlUnitLower)) {
                // unit1 is a component of compound base unit, treat as base
                baseQty = qty1;
                addlQty = qty2;
              } else if (baseCompBaseUnit && unitMatches(unit1, addlUnitLower) && unitMatches(unit2, baseCompBaseUnit)) {
                // unit2 is a component of compound base unit, treat as base
                baseQty = qty2;
                addlQty = qty1;
              } else {
                baseQty = 0;
                addlQty = 0;
              }
            }
          } else {
            return ''; // No valid match for compound format
          }
        }

        // Check if it's a valid custom conversion
        if (baseQty > 0 && addlQty > 0) {
          // Validate decimal places for both quantities
          let baseDecimalPlaces = 0;
          let addlDecimalPlaces = 0;

          // Get decimal places for base unit
          if (unitsArray && unitsArray.length > 0) {
            const baseUnitObj = unitsArray.find(u => u.NAME && u.NAME.toLowerCase() === unitConfig.BASEUNITS.toLowerCase());
            if (baseUnitObj) {
              baseDecimalPlaces = typeof baseUnitObj.DECIMALPLACES === 'string'
                ? parseInt(baseUnitObj.DECIMALPLACES) || 0
                : (baseUnitObj.DECIMALPLACES || 0);
            }
          } else if (unitConfig.BASEUNIT_DECIMAL !== undefined) {
            baseDecimalPlaces = typeof unitConfig.BASEUNIT_DECIMAL === 'string'
              ? parseInt(unitConfig.BASEUNIT_DECIMAL) || 0
              : (unitConfig.BASEUNIT_DECIMAL || 0);
          }

          // Get decimal places for additional unit
          if (unitsArray && unitsArray.length > 0) {
            const addlUnitObj = unitsArray.find(u => u.NAME && u.NAME.toLowerCase() === unitConfig.ADDITIONALUNITS.toLowerCase());
            if (addlUnitObj) {
              addlDecimalPlaces = typeof addlUnitObj.DECIMALPLACES === 'string'
                ? parseInt(addlUnitObj.DECIMALPLACES) || 0
                : (addlUnitObj.DECIMALPLACES || 0);
            }
          } else if (unitConfig.ADDITIONALUNITS_DECIMAL !== undefined) {
            addlDecimalPlaces = typeof unitConfig.ADDITIONALUNITS_DECIMAL === 'string'
              ? parseInt(unitConfig.ADDITIONALUNITS_DECIMAL) || 0
              : (unitConfig.ADDITIONALUNITS_DECIMAL || 0);
          }

          // Format quantities based on decimal places
          let formattedBaseQty = baseDecimalPlaces === 0
            ? Math.round(baseQty).toString()
            : (isBlur ? baseQty.toFixed(baseDecimalPlaces) : baseQty.toString());

          let formattedAddlQty = addlDecimalPlaces === 0
            ? Math.round(addlQty).toString()
            : (isBlur ? addlQty.toFixed(addlDecimalPlaces) : addlQty.toString());

          // Format compound base unit if needed
          let formattedBaseDisplay = '';
          if (isBaseCompound && baseCompBaseUnit && baseCompAddlUnit) {
            // Format as compound: "mainQty mainUnit subQty subUnit"
            // Get original unit names from units array
            const mainUnitObj = unitsArray.find(u => u.NAME && unitMatches(u.NAME, baseMainUnit));
            const subUnitObj = unitsArray.find(u => u.NAME && unitMatches(u.NAME, baseSubUnit));
            const mainUnitName = mainUnitObj ? mainUnitObj.NAME : baseMainUnit;
            const subUnitName = subUnitObj ? subUnitObj.NAME : baseSubUnit;

            // Get decimal places for sub unit
            let subDecimalPlaces = 0;
            if (subUnitObj) {
              subDecimalPlaces = typeof subUnitObj.DECIMALPLACES === 'string'
                ? parseInt(subUnitObj.DECIMALPLACES) || 0
                : (subUnitObj.DECIMALPLACES || 0);
            }

            const formattedSubQty = subDecimalPlaces === 0
              ? Math.round(baseSubQty).toString()
              : (isBlur ? baseSubQty.toFixed(subDecimalPlaces) : baseSubQty.toString());

            formattedBaseDisplay = `${baseMainQty} ${mainUnitName} ${formattedSubQty} ${subUnitName}`;
          } else {
            // Simple base unit
            const baseUnitName = unitConfig.BASEUNITS;
            formattedBaseDisplay = `${formattedBaseQty} ${baseUnitName}`;
          }

          // Preserve original unit name for additional unit
          const addlUnitName = unitConfig.ADDITIONALUNITS;

          // Return formatted custom conversion (preserve = if it was there, otherwise use space)
          const hasEquals = trimmed.includes('=');
          return `${formattedBaseDisplay}${hasEquals ? ' = ' : ' '}${formattedAddlQty} ${addlUnitName}`;
        }
      }
    }

    // Parse format: "baseUnit qty1 compoundAddlUnitMain qty2 compoundAddlUnitSub"
    // Example: "1 box 5 pkt 3 nos" or "1box 5pkt 3nos" where baseUnit=box, compoundAddlUnit=pkt of 10 nos
    // This should be checked BEFORE compound unit matching to avoid false matches
    // Pattern: number unit number unit number unit (3 numbers, 3 units)
    let baseCompoundAddlMatch = null;

    if (isBlur) {
      console.log('validateQuantityInput: Starting baseCompoundAddlMatch check', { input: trimmed });
    }

    // Pattern 1: With spaces (e.g., "1 box 5 pkt 3 nos")
    baseCompoundAddlMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s+([A-Za-z]+)\s+(\d+(?:\.\d+)?)\s+([A-Za-z]+)\s+(\d+(?:\.\d+)?)\s+([A-Za-z]+)$/i);

    // Pattern 2: No space between first number and unit, but spaces between units (e.g., "1box 5pkt 3nos" or "9p 2n 3b")
    if (!baseCompoundAddlMatch) {
      baseCompoundAddlMatch = trimmed.match(/^(\d+(?:\.\d+)?)([A-Za-z]+)\s+(\d+(?:\.\d+)?)([A-Za-z]+)\s+(\d+(?:\.\d+)?)([A-Za-z]+)$/i);
      if (isBlur && baseCompoundAddlMatch) {
        console.log('validateQuantityInput: Pattern 2 matched!', { input: trimmed, match: baseCompoundAddlMatch.slice(1) });
      }
    }

    // Pattern 3: Mixed spacing (e.g., "1 box 5pkt 3nos", "1box 5 pkt 3nos")
    if (!baseCompoundAddlMatch) {
      baseCompoundAddlMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*([A-Za-z]+)\s+(\d+(?:\.\d+)?)\s*([A-Za-z]+)\s+(\d+(?:\.\d+)?)\s*([A-Za-z]+)$/i);
      if (isBlur && baseCompoundAddlMatch) {
        console.log('validateQuantityInput: Pattern 3 matched!', { input: trimmed, match: baseCompoundAddlMatch.slice(1) });
      }
    }

    // Pattern 4: Absolutely no spaces (e.g., "1box5pkt3nos")
    if (!baseCompoundAddlMatch) {
      baseCompoundAddlMatch = trimmed.match(/^(\d+(?:\.\d+)?)([A-Za-z]+)(\d+(?:\.\d+)?)([A-Za-z]+)(\d+(?:\.\d+)?)([A-Za-z]+)$/i);
      if (isBlur && baseCompoundAddlMatch) {
        console.log('validateQuantityInput: Pattern 4 matched!', { input: trimmed, match: baseCompoundAddlMatch.slice(1) });
      }
    }

    if (isBlur) {
      console.log('validateQuantityInput: After all patterns, baseCompoundAddlMatch =', {
        input: trimmed,
        matched: !!baseCompoundAddlMatch,
        match: baseCompoundAddlMatch ? baseCompoundAddlMatch.slice(1) : null,
        unitsArrayLength: unitsArray?.length
      });
    }

    if (baseCompoundAddlMatch && unitsArray && unitsArray.length > 0) {
      const baseQty = parseFloat(baseCompoundAddlMatch[1]);
      const baseUnit = baseCompoundAddlMatch[2].toLowerCase();
      const addlMainQty = parseFloat(baseCompoundAddlMatch[3]);
      const addlMainUnit = baseCompoundAddlMatch[4].toLowerCase();
      const addlSubQty = parseFloat(baseCompoundAddlMatch[5]);
      const addlSubUnit = baseCompoundAddlMatch[6].toLowerCase();

      // Helper function to check if a unit matches
      const unitMatches = (inputUnit, targetUnit) => {
        const inputLower = inputUnit.toLowerCase();
        const targetLower = targetUnit.toLowerCase();
        if (inputLower === targetLower) return true;
        if (inputLower.length >= 1 && targetLower.startsWith(inputLower)) return true;
        if (targetLower.length >= 1 && inputLower.startsWith(targetLower)) return true;
        return false;
      };

      // FIRST: Check if BASEUNITS is compound and ADDITIONALUNITS is simple
      // This should be checked BEFORE the simple base + compound additional check
      // to avoid false matches (e.g., "9 pkt 2 nos 3 box" where BASEUNITS is compound)
      let handledCompoundBaseSimpleAddl = false;
      if (unitConfig.BASEUNITS && unitConfig.ADDITIONALUNITS && unitsArray && unitsArray.length > 0) {
        const baseUnitObj = unitsArray.find(u => u.NAME === unitConfig.BASEUNITS);
        if (baseUnitObj && baseUnitObj.ISSIMPLEUNIT === 'No') {
          // BASEUNITS is compound - check if the pattern matches compound base + simple additional
          const baseCompBaseUnit = baseUnitObj.BASEUNITS?.toLowerCase();
          const baseCompAddlUnit = baseUnitObj.ADDITIONALUNITS?.toLowerCase();
          const addlUnitLower = unitConfig.ADDITIONALUNITS?.toLowerCase();

          // Debug logging
          if (isBlur) {
            console.log('validateQuantityInput: Checking compound base + simple additional', {
              input: trimmed,
              baseQty,
              baseUnit,
              addlMainQty,
              addlMainUnit,
              addlSubQty,
              addlSubUnit,
              baseCompBaseUnit,
              baseCompAddlUnit,
              addlUnitLower,
              baseUnitMatches: unitMatches(baseUnit, baseCompBaseUnit),
              addlMainMatches: unitMatches(addlMainUnit, baseCompAddlUnit),
              addlSubMatches: unitMatches(addlSubUnit, addlUnitLower)
            });
          }

          // Check if the pattern matches: baseCompMain baseCompSub addlUnit
          // Try all 6 orderings
          if (baseCompBaseUnit && baseCompAddlUnit) {
            // Order 1: main-sub-addl (e.g., "9 pkt 2 nos 3 box" or "9p 2n 3b")
            if (unitMatches(baseUnit, baseCompBaseUnit) &&
              unitMatches(addlMainUnit, baseCompAddlUnit) &&
              unitMatches(addlSubUnit, addlUnitLower)) {
              const baseMainQty = baseQty;
              const baseSubQty = addlMainQty;
              const addlQty = addlSubQty;

              const baseConversion = parseFloat(baseUnitObj.CONVERSION) || 1;
              const baseQtyInCompound = baseMainQty + (baseSubQty / baseConversion);

              const denominator = parseFloat(unitConfig.DENOMINATOR) || 1;
              const conversion = parseFloat(unitConfig.CONVERSION) || 1;

              const effectiveDenominator = denominator / baseConversion;
              const addlQtyInBase = (addlQty * effectiveDenominator) / conversion;
              const totalBaseQty = baseQtyInCompound + addlQtyInBase;

              let baseUnitDecimal = 0;
              if (unitsArray && unitsArray.length > 0) {
                const baseUnitObj2 = unitsArray.find(u => u.NAME === unitConfig.BASEUNITS);
                if (baseUnitObj2) {
                  baseUnitDecimal = typeof baseUnitObj2.DECIMALPLACES === 'string'
                    ? parseInt(baseUnitObj2.DECIMALPLACES) || 0
                    : (baseUnitObj2.DECIMALPLACES || 0);
                }
              }

              const formattedBaseQty = baseUnitDecimal === 0
                ? Math.round(totalBaseQty).toString()
                : (isBlur ? totalBaseQty.toFixed(baseUnitDecimal) : totalBaseQty.toString());

              handledCompoundBaseSimpleAddl = true;
              const result = `${formattedBaseQty} ${unitConfig.BASEUNITS}`;
              if (isBlur) {
                console.log('validateQuantityInput: Order 1 matched, returning:', result, {
                  baseMainQty,
                  baseSubQty,
                  addlQty,
                  totalBaseQty,
                  formattedBaseQty
                });
              }
              return result;
            }

            // Order 2: sub-main-addl (e.g., "2 nos 9 pkt 3 box" or "2n 9p 3b")
            if (unitMatches(baseUnit, baseCompAddlUnit) &&
              unitMatches(addlMainUnit, baseCompBaseUnit) &&
              unitMatches(addlSubUnit, addlUnitLower)) {
              const baseSubQty = baseQty;
              const baseMainQty = addlMainQty;
              const addlQty = addlSubQty;

              const baseConversion = parseFloat(baseUnitObj.CONVERSION) || 1;
              const baseQtyInCompound = baseMainQty + (baseSubQty / baseConversion);

              const denominator = parseFloat(unitConfig.DENOMINATOR) || 1;
              const conversion = parseFloat(unitConfig.CONVERSION) || 1;

              const effectiveDenominator = denominator / baseConversion;
              const addlQtyInBase = (addlQty * effectiveDenominator) / conversion;
              const totalBaseQty = baseQtyInCompound + addlQtyInBase;

              let baseUnitDecimal = 0;
              if (unitsArray && unitsArray.length > 0) {
                const baseUnitObj2 = unitsArray.find(u => u.NAME === unitConfig.BASEUNITS);
                if (baseUnitObj2) {
                  baseUnitDecimal = typeof baseUnitObj2.DECIMALPLACES === 'string'
                    ? parseInt(baseUnitObj2.DECIMALPLACES) || 0
                    : (baseUnitObj2.DECIMALPLACES || 0);
                }
              }

              const formattedBaseQty = baseUnitDecimal === 0
                ? Math.round(totalBaseQty).toString()
                : (isBlur ? totalBaseQty.toFixed(baseUnitDecimal) : totalBaseQty.toString());

              handledCompoundBaseSimpleAddl = true;
              return `${formattedBaseQty} ${unitConfig.BASEUNITS}`;
            }

            // Order 3: main-addl-sub (e.g., "9 pkt 3 box 2 nos" or "9p 3b 2n")
            if (unitMatches(baseUnit, baseCompBaseUnit) &&
              unitMatches(addlMainUnit, addlUnitLower) &&
              unitMatches(addlSubUnit, baseCompAddlUnit)) {
              const baseMainQty = baseQty;
              const addlQty = addlMainQty;
              const baseSubQty = addlSubQty;

              const baseConversion = parseFloat(baseUnitObj.CONVERSION) || 1;
              const baseQtyInCompound = baseMainQty + (baseSubQty / baseConversion);

              const denominator = parseFloat(unitConfig.DENOMINATOR) || 1;
              const conversion = parseFloat(unitConfig.CONVERSION) || 1;

              const effectiveDenominator = denominator / baseConversion;
              const addlQtyInBase = (addlQty * effectiveDenominator) / conversion;
              const totalBaseQty = baseQtyInCompound + addlQtyInBase;

              let baseUnitDecimal = 0;
              if (unitsArray && unitsArray.length > 0) {
                const baseUnitObj2 = unitsArray.find(u => u.NAME === unitConfig.BASEUNITS);
                if (baseUnitObj2) {
                  baseUnitDecimal = typeof baseUnitObj2.DECIMALPLACES === 'string'
                    ? parseInt(baseUnitObj2.DECIMALPLACES) || 0
                    : (baseUnitObj2.DECIMALPLACES || 0);
                }
              }

              const formattedBaseQty = baseUnitDecimal === 0
                ? Math.round(totalBaseQty).toString()
                : (isBlur ? totalBaseQty.toFixed(baseUnitDecimal) : totalBaseQty.toString());

              handledCompoundBaseSimpleAddl = true;
              return `${formattedBaseQty} ${unitConfig.BASEUNITS}`;
            }

            // Order 4: sub-addl-main (e.g., "2 nos 3 box 9 pkt" or "2n 3b 9p")
            if (unitMatches(baseUnit, baseCompAddlUnit) &&
              unitMatches(addlMainUnit, addlUnitLower) &&
              unitMatches(addlSubUnit, baseCompBaseUnit)) {
              const baseSubQty = baseQty;
              const addlQty = addlMainQty;
              const baseMainQty = addlSubQty;

              const baseConversion = parseFloat(baseUnitObj.CONVERSION) || 1;
              const baseQtyInCompound = baseMainQty + (baseSubQty / baseConversion);

              const denominator = parseFloat(unitConfig.DENOMINATOR) || 1;
              const conversion = parseFloat(unitConfig.CONVERSION) || 1;

              const effectiveDenominator = denominator / baseConversion;
              const addlQtyInBase = (addlQty * effectiveDenominator) / conversion;
              const totalBaseQty = baseQtyInCompound + addlQtyInBase;

              let baseUnitDecimal = 0;
              if (unitsArray && unitsArray.length > 0) {
                const baseUnitObj2 = unitsArray.find(u => u.NAME === unitConfig.BASEUNITS);
                if (baseUnitObj2) {
                  baseUnitDecimal = typeof baseUnitObj2.DECIMALPLACES === 'string'
                    ? parseInt(baseUnitObj2.DECIMALPLACES) || 0
                    : (baseUnitObj2.DECIMALPLACES || 0);
                }
              }

              const formattedBaseQty = baseUnitDecimal === 0
                ? Math.round(totalBaseQty).toString()
                : (isBlur ? totalBaseQty.toFixed(baseUnitDecimal) : totalBaseQty.toString());

              handledCompoundBaseSimpleAddl = true;
              return `${formattedBaseQty} ${unitConfig.BASEUNITS}`;
            }

            // Order 5: addl-main-sub (e.g., "3 box 9 pkt 2 nos" or "3b 9p 2n")
            if (unitMatches(baseUnit, addlUnitLower) &&
              unitMatches(addlMainUnit, baseCompBaseUnit) &&
              unitMatches(addlSubUnit, baseCompAddlUnit)) {
              const addlQty = baseQty;
              const baseMainQty = addlMainQty;
              const baseSubQty = addlSubQty;

              const baseConversion = parseFloat(baseUnitObj.CONVERSION) || 1;
              const baseQtyInCompound = baseMainQty + (baseSubQty / baseConversion);

              const denominator = parseFloat(unitConfig.DENOMINATOR) || 1;
              const conversion = parseFloat(unitConfig.CONVERSION) || 1;

              const effectiveDenominator = denominator / baseConversion;
              const addlQtyInBase = (addlQty * effectiveDenominator) / conversion;
              const totalBaseQty = baseQtyInCompound + addlQtyInBase;

              let baseUnitDecimal = 0;
              if (unitsArray && unitsArray.length > 0) {
                const baseUnitObj2 = unitsArray.find(u => u.NAME === unitConfig.BASEUNITS);
                if (baseUnitObj2) {
                  baseUnitDecimal = typeof baseUnitObj2.DECIMALPLACES === 'string'
                    ? parseInt(baseUnitObj2.DECIMALPLACES) || 0
                    : (baseUnitObj2.DECIMALPLACES || 0);
                }
              }

              const formattedBaseQty = baseUnitDecimal === 0
                ? Math.round(totalBaseQty).toString()
                : (isBlur ? totalBaseQty.toFixed(baseUnitDecimal) : totalBaseQty.toString());

              handledCompoundBaseSimpleAddl = true;
              return `${formattedBaseQty} ${unitConfig.BASEUNITS}`;
            }

            // Order 6: addl-sub-main (e.g., "3 box 2 nos 9 pkt" or "3b 2n 9p")
            if (unitMatches(baseUnit, addlUnitLower) &&
              unitMatches(addlMainUnit, baseCompAddlUnit) &&
              unitMatches(addlSubUnit, baseCompBaseUnit)) {
              const addlQty = baseQty;
              const baseSubQty = addlMainQty;
              const baseMainQty = addlSubQty;

              const baseConversion = parseFloat(baseUnitObj.CONVERSION) || 1;
              const baseQtyInCompound = baseMainQty + (baseSubQty / baseConversion);

              const denominator = parseFloat(unitConfig.DENOMINATOR) || 1;
              const conversion = parseFloat(unitConfig.CONVERSION) || 1;

              const effectiveDenominator = denominator / baseConversion;
              const addlQtyInBase = (addlQty * effectiveDenominator) / conversion;
              const totalBaseQty = baseQtyInCompound + addlQtyInBase;

              let baseUnitDecimal = 0;
              if (unitsArray && unitsArray.length > 0) {
                const baseUnitObj2 = unitsArray.find(u => u.NAME === unitConfig.BASEUNITS);
                if (baseUnitObj2) {
                  baseUnitDecimal = typeof baseUnitObj2.DECIMALPLACES === 'string'
                    ? parseInt(baseUnitObj2.DECIMALPLACES) || 0
                    : (baseUnitObj2.DECIMALPLACES || 0);
                }
              }

              const formattedBaseQty = baseUnitDecimal === 0
                ? Math.round(totalBaseQty).toString()
                : (isBlur ? totalBaseQty.toFixed(baseUnitDecimal) : totalBaseQty.toString());

              handledCompoundBaseSimpleAddl = true;
              return `${formattedBaseQty} ${unitConfig.BASEUNITS}`;
            }
          }
        }
      }

      // SECOND: Check if baseUnit matches BASEUNITS and ADDITIONALUNITS is compound
      // Only check this if compound base + simple additional was not handled
      if (!handledCompoundBaseSimpleAddl) {
        const baseUnitMatches = unitConfig.BASEUNITS && unitMatches(baseUnit, unitConfig.BASEUNITS);
        if (baseUnitMatches && unitConfig.ADDITIONALUNITS) {
          const addlUnitObj = unitsArray.find(u => u.NAME === unitConfig.ADDITIONALUNITS);
          if (addlUnitObj && addlUnitObj.ISSIMPLEUNIT === 'No') {
            // ADDITIONALUNITS is compound - check if addlMainUnit and addlSubUnit match components
            const addlCompBaseUnit = addlUnitObj.BASEUNITS?.toLowerCase();
            const addlCompAddlUnit = addlUnitObj.ADDITIONALUNITS?.toLowerCase();

            // Check order: main-sub or sub-main
            if (addlCompBaseUnit && addlCompAddlUnit) {
              if (unitMatches(addlMainUnit, addlCompBaseUnit) && unitMatches(addlSubUnit, addlCompAddlUnit)) {
                // Order: main sub (e.g., "5 pkt 3 nos")
                const addlConversion = parseFloat(addlUnitObj.CONVERSION) || 1;
                const addlQtyInCompound = addlMainQty + (addlSubQty / addlConversion);

                const denominator = parseFloat(unitConfig.DENOMINATOR) || 1;
                const conversion = parseFloat(unitConfig.CONVERSION) || 1;

                const addlQtyInSubComponent = addlQtyInCompound * addlConversion;
                const calculatedBaseQty = (addlQtyInSubComponent * denominator) / conversion;

                // Get decimal places for base unit
                let baseUnitDecimal = 0;
                if (unitsArray && unitsArray.length > 0) {
                  const baseUnitObj = unitsArray.find(u => u.NAME === unitConfig.BASEUNITS);
                  if (baseUnitObj) {
                    baseUnitDecimal = typeof baseUnitObj.DECIMALPLACES === 'string'
                      ? parseInt(baseUnitObj.DECIMALPLACES) || 0
                      : (baseUnitObj.DECIMALPLACES || 0);
                  }
                } else if (unitConfig.BASEUNIT_DECIMAL !== undefined) {
                  baseUnitDecimal = typeof unitConfig.BASEUNIT_DECIMAL === 'string'
                    ? parseInt(unitConfig.BASEUNIT_DECIMAL) || 0
                    : (unitConfig.BASEUNIT_DECIMAL || 0);
                }

                // Format the total base quantity
                const totalBaseQty = baseQty + calculatedBaseQty;
                const formattedBaseQty = baseUnitDecimal === 0
                  ? Math.round(totalBaseQty).toString()
                  : (isBlur ? totalBaseQty.toFixed(baseUnitDecimal) : totalBaseQty.toString());

                // Format the compound additional unit quantity for display
                let addlMainDecimal = 0;
                let addlSubDecimal = 0;
                const addlMainUnitObj = unitsArray.find(u => u.NAME && unitMatches(u.NAME, addlMainUnit));
                const addlSubUnitObj = unitsArray.find(u => u.NAME && unitMatches(u.NAME, addlSubUnit));
                if (addlMainUnitObj) {
                  addlMainDecimal = typeof addlMainUnitObj.DECIMALPLACES === 'string'
                    ? parseInt(addlMainUnitObj.DECIMALPLACES) || 0
                    : (addlMainUnitObj.DECIMALPLACES || 0);
                }
                if (addlSubUnitObj) {
                  addlSubDecimal = typeof addlSubUnitObj.DECIMALPLACES === 'string'
                    ? parseInt(addlSubUnitObj.DECIMALPLACES) || 0
                    : (addlSubUnitObj.DECIMALPLACES || 0);
                }

                const formattedAddlMainQty = addlMainDecimal === 0
                  ? Math.round(addlMainQty).toString()
                  : (isBlur ? addlMainQty.toFixed(addlMainDecimal) : addlMainQty.toString());

                const formattedAddlSubQty = addlSubDecimal === 0
                  ? Math.round(addlSubQty).toString()
                  : (isBlur ? addlSubQty.toFixed(addlSubDecimal) : addlSubQty.toString());

                // Get original unit names
                const baseUnitName = unitConfig.BASEUNITS;
                const addlMainUnitName = addlMainUnitObj ? addlMainUnitObj.NAME : addlMainUnit;
                const addlSubUnitName = addlSubUnitObj ? addlSubUnitObj.NAME : addlSubUnit;

                // Return formatted: "baseQty baseUnit" (the compound additional will be shown in brackets by the display logic)
                return `${formattedBaseQty} ${baseUnitName}`;
              } else if (unitMatches(addlMainUnit, addlCompAddlUnit) && unitMatches(addlSubUnit, addlCompBaseUnit)) {
                // Order: sub main (e.g., "3 nos 5 pkt")
                const addlConversion = parseFloat(addlUnitObj.CONVERSION) || 1;
                const addlQtyInCompound = addlSubQty + (addlMainQty / addlConversion);

                const denominator = parseFloat(unitConfig.DENOMINATOR) || 1;
                const conversion = parseFloat(unitConfig.CONVERSION) || 1;

                const addlQtyInSubComponent = addlQtyInCompound * addlConversion;
                const calculatedBaseQty = (addlQtyInSubComponent * denominator) / conversion;

                // Get decimal places for base unit
                let baseUnitDecimal = 0;
                if (unitsArray && unitsArray.length > 0) {
                  const baseUnitObj = unitsArray.find(u => u.NAME === unitConfig.BASEUNITS);
                  if (baseUnitObj) {
                    baseUnitDecimal = typeof baseUnitObj.DECIMALPLACES === 'string'
                      ? parseInt(baseUnitObj.DECIMALPLACES) || 0
                      : (baseUnitObj.DECIMALPLACES || 0);
                  }
                } else if (unitConfig.BASEUNIT_DECIMAL !== undefined) {
                  baseUnitDecimal = typeof unitConfig.BASEUNIT_DECIMAL === 'string'
                    ? parseInt(unitConfig.BASEUNIT_DECIMAL) || 0
                    : (unitConfig.BASEUNIT_DECIMAL || 0);
                }

                // Format the total base quantity
                const totalBaseQty = baseQty + calculatedBaseQty;
                const formattedBaseQty = baseUnitDecimal === 0
                  ? Math.round(totalBaseQty).toString()
                  : (isBlur ? totalBaseQty.toFixed(baseUnitDecimal) : totalBaseQty.toString());

                // Get original unit name
                const baseUnitName = unitConfig.BASEUNITS;

                // Return formatted: "baseQty baseUnit"
                return `${formattedBaseQty} ${baseUnitName}`;
              }
            }
          }
        }
      }
    }

    // Parse compound unit (e.g., "2 LTR 500 ML", "2LTR500ML", "2L10M", "10ML2L")
    // Pattern allows optional spaces between number and unit, and between units
    // Try multiple patterns to handle different spacing scenarios
    let compoundMatch = null;

    // Pattern 1: With spaces (e.g., "2 LTR 10 ML", "2LTR 10ML")
    compoundMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s+([A-Za-z]+)\s+(\d+(?:\.\d+)?)\s*([A-Za-z]+)$/i);

    // Pattern 2: No space between first number and unit, but space between units (e.g., "2LTR 10ML")
    if (!compoundMatch) {
      compoundMatch = trimmed.match(/^(\d+(?:\.\d+)?)([A-Za-z]+)\s+(\d+(?:\.\d+)?)\s*([A-Za-z]+)$/i);
    }

    // Pattern 3: Space between first number and unit, but no space between units (e.g., "2 LTR10ML")
    if (!compoundMatch) {
      compoundMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s+([A-Za-z]+)(\d+(?:\.\d+)?)([A-Za-z]+)$/i);
    }

    // Pattern 4: Absolutely no spaces (e.g., "2LTR10ML", "2L10M", "10ML2L", "20ML2LTR")
    if (!compoundMatch) {
      compoundMatch = trimmed.match(/^(\d+(?:\.\d+)?)([A-Za-z]+)(\d+(?:\.\d+)?)([A-Za-z]+)$/i);
    }
    if (compoundMatch) {
      let mainQty = compoundMatch[1];
      let mainUnit = compoundMatch[2]; // Keep original case for matching
      let subQty = compoundMatch[3];
      let subUnit = compoundMatch[4]; // Keep original case for matching

      // Helper function to check if a unit matches (supports full name and abbreviations)
      const unitMatches = (inputUnit, targetUnit) => {
        const inputLower = inputUnit.toLowerCase();
        const targetLower = targetUnit.toLowerCase();
        // Exact match
        if (inputLower === targetLower) return true;
        // Abbreviation match: input starts with target or target starts with input
        if (inputLower.length >= 1 && targetLower.startsWith(inputLower)) return true;
        if (targetLower.length >= 1 && inputLower.startsWith(targetLower)) return true;
        return false;
      };

      // Validate that both units are allowed for this item
      // Check both orders and support abbreviations
      let mainUnitAllowed = false;
      let subUnitAllowed = false;

      // Try order 1: mainUnit, subUnit
      mainUnitAllowed = allowedUnits.some(u => unitMatches(mainUnit, u));
      subUnitAllowed = allowedUnits.some(u => unitMatches(subUnit, u));

      // If order 1 doesn't work, try order 2: subUnit, mainUnit (reversed)
      if (!mainUnitAllowed || !subUnitAllowed) {
        const tempMainAllowed = allowedUnits.some(u => unitMatches(subUnit, u));
        const tempSubAllowed = allowedUnits.some(u => unitMatches(mainUnit, u));
        if (tempMainAllowed && tempSubAllowed) {
          // Reversed order is valid - swap them
          const tempQty = mainQty;
          const tempUnit = mainUnit;
          mainQty = subQty;
          mainUnit = subUnit;
          subQty = tempQty;
          subUnit = tempUnit;
          mainUnitAllowed = true;
          subUnitAllowed = true;
        }
      }

      if (!mainUnitAllowed || !subUnitAllowed) {
        return ''; // Invalid units
      }

      // Convert to lowercase for further processing
      const mainUnitLower = mainUnit.toLowerCase();
      const subUnitLower = subUnit.toLowerCase();

      // Validate main unit decimal places
      const mainUnitObj = unitsArray && unitsArray.length > 0
        ? unitsArray.find(u => {
          const unitNameLower = u.NAME?.toLowerCase() || '';
          return unitNameLower === mainUnitLower ||
            (mainUnitLower.length >= 1 && unitNameLower.startsWith(mainUnitLower)) ||
            (unitNameLower.length >= 1 && mainUnitLower.startsWith(unitNameLower));
        })
        : null;

      let mainDecimalPlaces = 0;
      if (mainUnitObj) {
        mainDecimalPlaces = parseInt(mainUnitObj.DECIMALPLACES) || 0;
      } else if (mainUnitLower === allowedBaseUnit.toLowerCase() && unitConfig.BASEUNIT_DECIMAL !== undefined) {
        mainDecimalPlaces = parseInt(unitConfig.BASEUNIT_DECIMAL) || 0;
      }

      const mainQtyNum = parseFloat(mainQty);
      if (mainDecimalPlaces === 0) {
        mainQty = Math.round(mainQtyNum).toString();
      } else {
        if (isBlur || (mainQty.includes('.') && mainQty.split('.')[1]?.length > mainDecimalPlaces)) {
          mainQty = mainQtyNum.toFixed(mainDecimalPlaces);
        }
      }

      // Validate sub unit decimal places
      // For compound units, check if this is a compound base or additional unit
      let subDecimalPlaces = 0;

      // Check if this matches compound base unit structure
      if (unitConfig.BASEUNITHASCOMPOUNDUNIT === 'Yes') {
        const baseCompAddl = unitConfig.BASEUNITCOMP_ADDLUNIT?.toLowerCase();
        if (subUnitLower === baseCompAddl) {
          // This is the sub-unit of compound base unit
          if (unitConfig.BASEUNITCOMP_ADDLUNIT_DECIMAL !== undefined) {
            subDecimalPlaces = typeof unitConfig.BASEUNITCOMP_ADDLUNIT_DECIMAL === 'string'
              ? parseInt(unitConfig.BASEUNITCOMP_ADDLUNIT_DECIMAL) || 0
              : (unitConfig.BASEUNITCOMP_ADDLUNIT_DECIMAL || 0);
          } else {
            // Fallback to units array lookup
            const subUnitObj = unitsArray && unitsArray.length > 0
              ? unitsArray.find(u => {
                const unitNameLower = u.NAME?.toLowerCase() || '';
                return unitNameLower === subUnitLower ||
                  (subUnitLower.length >= 1 && unitNameLower.startsWith(subUnitLower)) ||
                  (unitNameLower.length >= 1 && subUnitLower.startsWith(unitNameLower));
              })
              : null;
            if (subUnitObj) {
              subDecimalPlaces = typeof subUnitObj.DECIMALPLACES === 'string'
                ? parseInt(subUnitObj.DECIMALPLACES) || 0
                : (subUnitObj.DECIMALPLACES || 0);
            }
          }
        }
      }

      // Check if this matches compound additional unit structure
      if (unitConfig.ADDITIONALUNITHASCOMPOUNDUNIT === 'Yes') {
        const addlCompAddl = unitConfig.ADDLUNITCOMP_ADDLUNIT?.toLowerCase();
        if (subUnitLower === addlCompAddl) {
          // This is the sub-unit of compound additional unit
          if (unitConfig.ADDLUNITCOMP_ADDLUNIT_DECIMAL !== undefined) {
            subDecimalPlaces = typeof unitConfig.ADDLUNITCOMP_ADDLUNIT_DECIMAL === 'string'
              ? parseInt(unitConfig.ADDLUNITCOMP_ADDLUNIT_DECIMAL) || 0
              : (unitConfig.ADDLUNITCOMP_ADDLUNIT_DECIMAL || 0);
          } else {
            // Fallback to units array lookup
            const subUnitObj = unitsArray && unitsArray.length > 0
              ? unitsArray.find(u => {
                const unitNameLower = u.NAME?.toLowerCase() || '';
                return unitNameLower === subUnitLower ||
                  (subUnitLower.length >= 1 && unitNameLower.startsWith(subUnitLower)) ||
                  (unitNameLower.length >= 1 && subUnitLower.startsWith(unitNameLower));
              })
              : null;
            if (subUnitObj) {
              subDecimalPlaces = typeof subUnitObj.DECIMALPLACES === 'string'
                ? parseInt(subUnitObj.DECIMALPLACES) || 0
                : (subUnitObj.DECIMALPLACES || 0);
            }
          }
        }
      }

      // If still not found, try direct lookup in units array
      if (subDecimalPlaces === 0) {
        const subUnitObj = unitsArray && unitsArray.length > 0
          ? unitsArray.find(u => {
            const unitNameLower = u.NAME?.toLowerCase() || '';
            return unitNameLower === subUnitLower ||
              (subUnitLower.length >= 1 && unitNameLower.startsWith(subUnitLower)) ||
              (unitNameLower.length >= 1 && subUnitLower.startsWith(unitNameLower));
          })
          : null;
        if (subUnitObj) {
          subDecimalPlaces = typeof subUnitObj.DECIMALPLACES === 'string'
            ? parseInt(subUnitObj.DECIMALPLACES) || 0
            : (subUnitObj.DECIMALPLACES || 0);
        }
      }

      const subQtyNum = parseFloat(subQty);
      if (subDecimalPlaces === 0) {
        subQty = Math.round(subQtyNum).toString();
      } else {
        if (isBlur || (subQty.includes('.') && subQty.split('.')[1]?.length > subDecimalPlaces)) {
          subQty = subQtyNum.toFixed(subDecimalPlaces);
        }
      }

      // Get original unit names (preserve case)
      const mainUnitName = compoundMatch[2];
      const subUnitName = compoundMatch[4];

      return `${mainQty} ${mainUnitName} ${subQty} ${subUnitName}`;
    }

    // Parse simple unit with UOM (e.g., "10 Box", "5 Nos", "10ML", "10M")
    // Pattern 1: number + space + unit name (e.g., "10 ML")
    // Pattern 2: number directly followed by unit name (e.g., "10ML")
    let simpleMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s+(.+)$/i);
    if (!simpleMatch) {
      // Try pattern without space: number directly followed by letters (e.g., "10ML", "10M")
      simpleMatch = trimmed.match(/^(\d+(?:\.\d+)?)([A-Za-z]+)$/i);
    }

    if (simpleMatch) {
      let qty = simpleMatch[1];
      let unit = simpleMatch[2].trim();

      // Validate that the unit is allowed for this item
      const unitLower = unit.toLowerCase();

      // First, try to find exact match or auto-complete partial match
      let matchedUnit = null;
      let isAllowed = false;

      // Check exact match first (handles compound units like "LTR of 1000 ML")
      for (const allowed of allowedUnits) {
        const allowedLower = allowed.toLowerCase();
        // Exact match (case-insensitive)
        if (unitLower === allowedLower) {
          matchedUnit = allowed;
          isAllowed = true;
          break;
        }
        // Partial match - if user typed "M" and unit is "ML", auto-complete
        if (allowedLower.startsWith(unitLower) && unitLower.length >= 1) {
          // Only auto-complete if there's exactly one match (to avoid ambiguity)
          const allMatches = allowedUnits.filter(a => a.toLowerCase().startsWith(unitLower));
          if (allMatches.length === 1) {
            matchedUnit = allowed;
            isAllowed = true;
            unit = allowed; // Auto-complete to full unit name
            break;
          }
        }
        // For compound units, also check if the unit name contains the allowed unit
        // This handles cases where user types "LTR of 1000 ML" and allowed is "ltr of 1000 ml"
        if (unitLower.includes(allowedLower) && allowedLower.length > 3) {
          matchedUnit = allowed;
          isAllowed = true;
          break;
        }
      }

      if (!isAllowed) {
        // Invalid unit - on blur, clear it; while typing, allow it (user might be typing)
        if (isBlur) {
          // On blur, try one more time to find a match
          const partialMatches = allowedUnits.filter(allowed => {
            const allowedLower = allowed.toLowerCase();
            return allowedLower.startsWith(unitLower) && unitLower.length >= 1;
          });

          if (partialMatches.length === 1) {
            // Exactly one match - auto-complete
            matchedUnit = partialMatches[0];
            unit = partialMatches[0];
            isAllowed = true;
          } else {
            // No match or ambiguous - clear it
            return '';
          }
        } else {
          // While typing, allow partial unit names (user might be typing "ML" and we see "M")
          // Check if it's a partial match of an allowed unit
          const isPartialMatch = allowedUnits.some(allowed => {
            const allowedLower = allowed.toLowerCase();
            return allowedLower.startsWith(unitLower) || unitLower.startsWith(allowedLower.substring(0, 2));
          });
          if (!isPartialMatch) {
            // Not a valid unit and not a partial match - clear it
            return '';
          }
          // Allow partial matches while typing
          return trimmed;
        }
      }

      // Find unit in units array by exact name match (handle compound units like "LTR of 1000 ML")
      // Use the matched/auto-completed unit name
      const unitToLookup = matchedUnit || unit;
      const unitToLookupLower = unitToLookup.toLowerCase();
      const unitObj = unitsArray && unitsArray.length > 0
        ? unitsArray.find(u => u.NAME && u.NAME.toLowerCase() === unitToLookupLower)
        : null;

      let decimalPlaces = null;
      if (unitObj) {
        // Found unit in array - use its DECIMALPLACES
        decimalPlaces = parseInt(unitObj.DECIMALPLACES) || 0;
        console.log('validateQuantityInput: Found unit in units array', {
          unitName: unit,
          foundUnit: unitObj.NAME,
          decimalPlaces: unitObj.DECIMALPLACES,
          parsed: decimalPlaces,
          input: trimmed
        });
      } else {
        console.log('validateQuantityInput: Unit NOT found in units array', {
          unitName: unit,
          availableUnits: unitsArray ? unitsArray.map(u => u.NAME) : []
        });
        // Unit not found in array - try to match with item's BASEUNITS or ADDITIONALUNITS
        // and use unitConfig which was built from units array
        if (unitLower === allowedBaseUnit.toLowerCase()) {
          // Matches base unit - use unitConfig's BASEUNIT_DECIMAL
          decimalPlaces = unitConfig.BASEUNIT_DECIMAL !== undefined
            ? parseInt(unitConfig.BASEUNIT_DECIMAL) || 0
            : 0;
        } else if (unitLower === allowedAddlUnit.toLowerCase()) {
          // Matches additional unit - use unitConfig's ADDITIONALUNITS_DECIMAL
          decimalPlaces = unitConfig.ADDITIONALUNITS_DECIMAL !== undefined
            ? parseInt(unitConfig.ADDITIONALUNITS_DECIMAL) || 0
            : 0;
        } else {
          // Unit not found - default to 0
          decimalPlaces = 0;
        }
      }

      const qtyNum = parseFloat(qty);
      if (decimalPlaces === 0) {
        // No decimals allowed - round to nearest integer (only on blur)
        if (isBlur) {
          qty = Math.round(qtyNum).toString();
        }
        // While typing, allow decimals temporarily (will round on blur)
      } else {
        // Allow decimals - limit to allowed decimal places
        // Always format on blur, or if exceeds limit while typing
        if (isBlur) {
          qty = qtyNum.toFixed(decimalPlaces);
        } else if (qty.includes('.') && qty.split('.')[1]?.length > decimalPlaces) {
          // While typing, limit if exceeds allowed places
          qty = qtyNum.toFixed(decimalPlaces);
        }
      }

      // Use the matched/auto-completed unit name (preserve case from units array if available)
      const finalUnit = unitObj ? unitObj.NAME : (matchedUnit || unit);
      return `${qty} ${finalUnit}`;
    }

    // If input doesn't match any valid pattern, return empty (invalid input)
    if (isBlur) {
      console.log('validateQuantityInput: No pattern matched, returning empty string', {
        input: trimmed,
        baseUnits: unitConfig?.BASEUNITS,
        addlUnits: unitConfig?.ADDITIONALUNITS
      });
    }
    return '';
  };

  // Parse quantity input (Tally-style: "10 Box", "5 Nos", "2 LTR 500 ML")
  const parseQuantityInput = (input, unitConfig, unitsArray) => {
    if (!input || !unitConfig) return { qty: 0, uom: 'base', isCompound: false, parts: [] };

    const trimmed = input.trim();
    if (!trimmed) return { qty: 0, uom: 'base', isCompound: false, parts: [] };

    // Try to parse as simple number (defaults to primary UOM)
    const simpleNumber = parseFloat(trimmed);
    if (!isNaN(simpleNumber) && trimmed === simpleNumber.toString()) {
      return { qty: simpleNumber, uom: 'base', isCompound: false, parts: [] };
    }

    // Parse format: "baseUnit qty1 compoundAddlUnitMain qty2 compoundAddlUnitSub"
    // Example: "1 box 5 pkt 3 nos" or "1box 5pkt 3nos" where baseUnit=box, compoundAddlUnit=pkt of 10 nos
    // This should be checked BEFORE custom conversion to avoid false matches
    // Pattern: number unit number unit number unit (3 numbers, 3 units)
    let baseCompoundAddlMatch = null;

    // Pattern 1: With spaces (e.g., "1 box 5 pkt 3 nos")
    baseCompoundAddlMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s+([A-Za-z]+)\s+(\d+(?:\.\d+)?)\s+([A-Za-z]+)\s+(\d+(?:\.\d+)?)\s+([A-Za-z]+)$/i);

    // Pattern 2: No space between first number and unit, but spaces between units (e.g., "1box 5pkt 3nos")
    if (!baseCompoundAddlMatch) {
      baseCompoundAddlMatch = trimmed.match(/^(\d+(?:\.\d+)?)([A-Za-z]+)\s+(\d+(?:\.\d+)?)([A-Za-z]+)\s+(\d+(?:\.\d+)?)([A-Za-z]+)$/i);
    }

    // Pattern 3: Mixed spacing (e.g., "1 box 5pkt 3nos", "1box 5 pkt 3nos")
    if (!baseCompoundAddlMatch) {
      baseCompoundAddlMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*([A-Za-z]+)\s+(\d+(?:\.\d+)?)\s*([A-Za-z]+)\s+(\d+(?:\.\d+)?)\s*([A-Za-z]+)$/i);
    }

    // Pattern 4: Absolutely no spaces (e.g., "1box5pkt3nos")
    if (!baseCompoundAddlMatch) {
      baseCompoundAddlMatch = trimmed.match(/^(\d+(?:\.\d+)?)([A-Za-z]+)(\d+(?:\.\d+)?)([A-Za-z]+)(\d+(?:\.\d+)?)([A-Za-z]+)$/i);
    }

    if (baseCompoundAddlMatch && unitsArray && unitsArray.length > 0) {
      const baseQty = parseFloat(baseCompoundAddlMatch[1]);
      const baseUnit = baseCompoundAddlMatch[2].toLowerCase();
      const addlMainQty = parseFloat(baseCompoundAddlMatch[3]);
      const addlMainUnit = baseCompoundAddlMatch[4].toLowerCase();
      const addlSubQty = parseFloat(baseCompoundAddlMatch[5]);
      const addlSubUnit = baseCompoundAddlMatch[6].toLowerCase();

      // Helper function to check if a unit matches
      const unitMatches = (inputUnit, targetUnit) => {
        const inputLower = inputUnit.toLowerCase();
        const targetLower = targetUnit.toLowerCase();
        if (inputLower === targetLower) return true;
        if (inputLower.length >= 1 && targetLower.startsWith(inputLower)) return true;
        if (targetLower.length >= 1 && inputLower.startsWith(targetLower)) return true;
        return false;
      };

      // FIRST: Check if BASEUNITS is compound and ADDITIONALUNITS is simple
      // This should be checked BEFORE the simple base + compound additional check
      // to avoid false matches (e.g., "9 pkt 2 nos 3 box" where BASEUNITS is compound)
      let handledCompoundBaseSimpleAddl = false;
      if (unitConfig.BASEUNITS && unitConfig.ADDITIONALUNITS && unitsArray && unitsArray.length > 0) {
        const baseUnitObj = unitsArray.find(u => u.NAME === unitConfig.BASEUNITS);
        if (baseUnitObj && baseUnitObj.ISSIMPLEUNIT === 'No') {
          // BASEUNITS is compound - check if the pattern matches compound base + simple additional
          const baseCompBaseUnit = baseUnitObj.BASEUNITS?.toLowerCase();
          const baseCompAddlUnit = baseUnitObj.ADDITIONALUNITS?.toLowerCase();
          const addlUnitLower = unitConfig.ADDITIONALUNITS?.toLowerCase();

          // Check if the pattern matches: baseCompMain baseCompSub addlUnit
          // Try both orders: main-sub-addl or sub-main-addl
          if (baseCompBaseUnit && baseCompAddlUnit) {
            // Order 1: main-sub-addl (e.g., "9 pkt 2 nos 3 box")
            if (unitMatches(baseUnit, baseCompBaseUnit) &&
              unitMatches(addlMainUnit, baseCompAddlUnit) &&
              unitMatches(addlSubUnit, addlUnitLower)) {
              const baseMainQty = baseQty;
              const baseSubQty = addlMainQty;
              const addlQty = addlSubQty;

              const baseConversion = parseFloat(baseUnitObj.CONVERSION) || 1;
              const baseQtyInCompound = baseMainQty + (baseSubQty / baseConversion);

              const denominator = parseFloat(unitConfig.DENOMINATOR) || 1;
              const conversion = parseFloat(unitConfig.CONVERSION) || 1;

              const effectiveDenominator = denominator / baseConversion;
              const addlQtyInBase = (addlQty * effectiveDenominator) / conversion;
              const totalBaseQty = baseQtyInCompound + addlQtyInBase;

              handledCompoundBaseSimpleAddl = true;
              return {
                qty: baseMainQty, // Main quantity for compound display (9)
                subQty: baseSubQty, // Sub quantity for compound display (2)
                totalQty: totalBaseQty, // Total for calculation (9.2 + converted box quantity)
                uom: 'base',
                isCompound: true, // Mark as compound to preserve the structure
                parts: [],
                customAddlQty: addlQty // Additional unit quantity (3 box)
              };
            }

            // Order 2: sub-main-addl (e.g., "2 nos 9 pkt 3 box" or "2n 9p 3b")
            if (unitMatches(baseUnit, baseCompAddlUnit) &&
              unitMatches(addlMainUnit, baseCompBaseUnit) &&
              unitMatches(addlSubUnit, addlUnitLower)) {
              const baseSubQty = baseQty;
              const baseMainQty = addlMainQty;
              const addlQty = addlSubQty;

              const baseConversion = parseFloat(baseUnitObj.CONVERSION) || 1;
              const baseQtyInCompound = baseMainQty + (baseSubQty / baseConversion);

              const denominator = parseFloat(unitConfig.DENOMINATOR) || 1;
              const conversion = parseFloat(unitConfig.CONVERSION) || 1;

              const effectiveDenominator = denominator / baseConversion;
              const addlQtyInBase = (addlQty * effectiveDenominator) / conversion;
              const totalBaseQty = baseQtyInCompound + addlQtyInBase;

              handledCompoundBaseSimpleAddl = true;
              return {
                qty: baseMainQty, // Main quantity for compound display
                subQty: baseSubQty, // Sub quantity for compound display
                totalQty: totalBaseQty, // Total for calculation
                uom: 'base',
                isCompound: true, // Mark as compound to preserve the structure
                parts: [],
                customAddlQty: addlQty // Additional unit quantity
              };
            }

            // Order 3: main-addl-sub (e.g., "9 pkt 3 box 2 nos" or "9p 3b 2n")
            if (unitMatches(baseUnit, baseCompBaseUnit) &&
              unitMatches(addlMainUnit, addlUnitLower) &&
              unitMatches(addlSubUnit, baseCompAddlUnit)) {
              const baseMainQty = baseQty;
              const addlQty = addlMainQty;
              const baseSubQty = addlSubQty;

              const baseConversion = parseFloat(baseUnitObj.CONVERSION) || 1;
              const baseQtyInCompound = baseMainQty + (baseSubQty / baseConversion);

              const denominator = parseFloat(unitConfig.DENOMINATOR) || 1;
              const conversion = parseFloat(unitConfig.CONVERSION) || 1;

              const effectiveDenominator = denominator / baseConversion;
              const addlQtyInBase = (addlQty * effectiveDenominator) / conversion;
              const totalBaseQty = baseQtyInCompound + addlQtyInBase;

              handledCompoundBaseSimpleAddl = true;
              return {
                qty: baseMainQty, // Main quantity for compound display
                subQty: baseSubQty, // Sub quantity for compound display
                totalQty: totalBaseQty, // Total for calculation
                uom: 'base',
                isCompound: true, // Mark as compound to preserve the structure
                parts: [],
                customAddlQty: addlQty // Additional unit quantity
              };
            }

            // Order 4: sub-addl-main (e.g., "2 nos 3 box 9 pkt" or "2n 3b 9p")
            if (unitMatches(baseUnit, baseCompAddlUnit) &&
              unitMatches(addlMainUnit, addlUnitLower) &&
              unitMatches(addlSubUnit, baseCompBaseUnit)) {
              const baseSubQty = baseQty;
              const addlQty = addlMainQty;
              const baseMainQty = addlSubQty;

              const baseConversion = parseFloat(baseUnitObj.CONVERSION) || 1;
              const baseQtyInCompound = baseMainQty + (baseSubQty / baseConversion);

              const denominator = parseFloat(unitConfig.DENOMINATOR) || 1;
              const conversion = parseFloat(unitConfig.CONVERSION) || 1;

              const effectiveDenominator = denominator / baseConversion;
              const addlQtyInBase = (addlQty * effectiveDenominator) / conversion;
              const totalBaseQty = baseQtyInCompound + addlQtyInBase;

              handledCompoundBaseSimpleAddl = true;
              return {
                qty: baseMainQty, // Main quantity for compound display
                subQty: baseSubQty, // Sub quantity for compound display
                totalQty: totalBaseQty, // Total for calculation
                uom: 'base',
                isCompound: true, // Mark as compound to preserve the structure
                parts: [],
                customAddlQty: addlQty // Additional unit quantity
              };
            }

            // Order 5: addl-main-sub (e.g., "3 box 9 pkt 2 nos" or "3b 9p 2n")
            if (unitMatches(baseUnit, addlUnitLower) &&
              unitMatches(addlMainUnit, baseCompBaseUnit) &&
              unitMatches(addlSubUnit, baseCompAddlUnit)) {
              const addlQty = baseQty;
              const baseMainQty = addlMainQty;
              const baseSubQty = addlSubQty;

              const baseConversion = parseFloat(baseUnitObj.CONVERSION) || 1;
              const baseQtyInCompound = baseMainQty + (baseSubQty / baseConversion);

              const denominator = parseFloat(unitConfig.DENOMINATOR) || 1;
              const conversion = parseFloat(unitConfig.CONVERSION) || 1;

              const effectiveDenominator = denominator / baseConversion;
              const addlQtyInBase = (addlQty * effectiveDenominator) / conversion;
              const totalBaseQty = baseQtyInCompound + addlQtyInBase;

              handledCompoundBaseSimpleAddl = true;
              return {
                qty: baseMainQty, // Main quantity for compound display
                subQty: baseSubQty, // Sub quantity for compound display
                totalQty: totalBaseQty, // Total for calculation
                uom: 'base',
                isCompound: true, // Mark as compound to preserve the structure
                parts: [],
                customAddlQty: addlQty // Additional unit quantity
              };
            }

            // Order 6: addl-sub-main (e.g., "3 box 2 nos 9 pkt" or "3b 2n 9p")
            if (unitMatches(baseUnit, addlUnitLower) &&
              unitMatches(addlMainUnit, baseCompAddlUnit) &&
              unitMatches(addlSubUnit, baseCompBaseUnit)) {
              const addlQty = baseQty;
              const baseSubQty = addlMainQty;
              const baseMainQty = addlSubQty;

              const baseConversion = parseFloat(baseUnitObj.CONVERSION) || 1;
              const baseQtyInCompound = baseMainQty + (baseSubQty / baseConversion);

              const denominator = parseFloat(unitConfig.DENOMINATOR) || 1;
              const conversion = parseFloat(unitConfig.CONVERSION) || 1;

              const effectiveDenominator = denominator / baseConversion;
              const addlQtyInBase = (addlQty * effectiveDenominator) / conversion;
              const totalBaseQty = baseQtyInCompound + addlQtyInBase;

              handledCompoundBaseSimpleAddl = true;
              return {
                qty: baseMainQty, // Main quantity for compound display
                subQty: baseSubQty, // Sub quantity for compound display
                totalQty: totalBaseQty, // Total for calculation
                uom: 'base',
                isCompound: true, // Mark as compound to preserve the structure
                parts: [],
                customAddlQty: addlQty // Additional unit quantity
              };
            }
          }
        }
      }

      // SECOND: Check if BASEUNITS is simple and ADDITIONALUNITS is compound
      // Only check this if compound base + simple additional was not handled
      // Need to check all 6 orderings: base can be in any position
      if (!handledCompoundBaseSimpleAddl) {
        const baseUnitLower = unitConfig.BASEUNITS?.toLowerCase();
        if (baseUnitLower && unitConfig.ADDITIONALUNITS) {
          const addlUnitObj = unitsArray.find(u => u.NAME === unitConfig.ADDITIONALUNITS);
          if (addlUnitObj && addlUnitObj.ISSIMPLEUNIT === 'No') {
            // ADDITIONALUNITS is compound - check if addlMainUnit and addlSubUnit match components
            const addlCompBaseUnit = addlUnitObj.BASEUNITS?.toLowerCase();
            const addlCompAddlUnit = addlUnitObj.ADDITIONALUNITS?.toLowerCase();

            // Check all 6 orderings for simple base + compound additional
            if (addlCompBaseUnit && addlCompAddlUnit) {
              // Order 1: addl-main-sub-base (e.g., "5 pkt 3 nos 2 box")
              if (unitMatches(baseUnit, addlCompBaseUnit) &&
                unitMatches(addlMainUnit, addlCompAddlUnit) &&
                unitMatches(addlSubUnit, baseUnitLower)) {
                const addlMainQtyValue = baseQty; // 5 pkt
                const addlSubQtyValue = addlMainQty; // 3 nos
                const baseQtyValue = addlSubQty; // 2 box

                const addlConversion = parseFloat(addlUnitObj.CONVERSION) || 1;
                const addlQtyInCompound = addlMainQtyValue + (addlSubQtyValue / addlConversion);

                const denominator = parseFloat(unitConfig.DENOMINATOR) || 1;
                const conversion = parseFloat(unitConfig.CONVERSION) || 1;

                const addlQtyInSubComponent = addlQtyInCompound * addlConversion;
                const calculatedBaseQty = (addlQtyInSubComponent * denominator) / conversion;

                return {
                  qty: baseQtyValue, // Only the base quantity for display
                  totalQty: baseQtyValue + calculatedBaseQty, // Total for calculation
                  uom: 'base',
                  isCompound: false,
                  parts: [],
                  isCustomConversion: false,
                  customAddlQty: addlQtyInCompound
                };
              }

              // Order 2: addl-sub-main-base (e.g., "3 nos 5 pkt 2 box")
              if (unitMatches(baseUnit, addlCompAddlUnit) &&
                unitMatches(addlMainUnit, addlCompBaseUnit) &&
                unitMatches(addlSubUnit, baseUnitLower)) {
                const addlSubQtyValue = baseQty; // 3 nos
                const addlMainQtyValue = addlMainQty; // 5 pkt
                const baseQtyValue = addlSubQty; // 2 box

                const addlConversion = parseFloat(addlUnitObj.CONVERSION) || 1;
                const addlQtyInCompound = addlMainQtyValue + (addlSubQtyValue / addlConversion);

                const denominator = parseFloat(unitConfig.DENOMINATOR) || 1;
                const conversion = parseFloat(unitConfig.CONVERSION) || 1;

                const addlQtyInSubComponent = addlQtyInCompound * addlConversion;
                const calculatedBaseQty = (addlQtyInSubComponent * denominator) / conversion;

                return {
                  qty: baseQtyValue,
                  totalQty: baseQtyValue + calculatedBaseQty,
                  uom: 'base',
                  isCompound: false,
                  parts: [],
                  isCustomConversion: false,
                  customAddlQty: addlQtyInCompound
                };
              }

              // Order 3: addl-main-base-sub (e.g., "5 pkt 2 box 3 nos")
              if (unitMatches(baseUnit, addlCompBaseUnit) &&
                unitMatches(addlMainUnit, baseUnitLower) &&
                unitMatches(addlSubUnit, addlCompAddlUnit)) {
                const addlMainQtyValue = baseQty; // 5 pkt
                const baseQtyValue = addlMainQty; // 2 box
                const addlSubQtyValue = addlSubQty; // 3 nos

                const addlConversion = parseFloat(addlUnitObj.CONVERSION) || 1;
                const addlQtyInCompound = addlMainQtyValue + (addlSubQtyValue / addlConversion);

                const denominator = parseFloat(unitConfig.DENOMINATOR) || 1;
                const conversion = parseFloat(unitConfig.CONVERSION) || 1;

                const addlQtyInSubComponent = addlQtyInCompound * addlConversion;
                const calculatedBaseQty = (addlQtyInSubComponent * denominator) / conversion;

                return {
                  qty: baseQtyValue,
                  totalQty: baseQtyValue + calculatedBaseQty,
                  uom: 'base',
                  isCompound: false,
                  parts: [],
                  isCustomConversion: false,
                  customAddlQty: addlQtyInCompound
                };
              }

              // Order 4: addl-sub-base-main (e.g., "3 nos 2 box 5 pkt")
              if (unitMatches(baseUnit, addlCompAddlUnit) &&
                unitMatches(addlMainUnit, baseUnitLower) &&
                unitMatches(addlSubUnit, addlCompBaseUnit)) {
                const addlSubQtyValue = baseQty; // 3 nos
                const baseQtyValue = addlMainQty; // 2 box
                const addlMainQtyValue = addlSubQty; // 5 pkt

                const addlConversion = parseFloat(addlUnitObj.CONVERSION) || 1;
                const addlQtyInCompound = addlMainQtyValue + (addlSubQtyValue / addlConversion);

                const denominator = parseFloat(unitConfig.DENOMINATOR) || 1;
                const conversion = parseFloat(unitConfig.CONVERSION) || 1;

                const addlQtyInSubComponent = addlQtyInCompound * addlConversion;
                const calculatedBaseQty = (addlQtyInSubComponent * denominator) / conversion;

                return {
                  qty: baseQtyValue,
                  totalQty: baseQtyValue + calculatedBaseQty,
                  uom: 'base',
                  isCompound: false,
                  parts: [],
                  isCustomConversion: false,
                  customAddlQty: addlQtyInCompound
                };
              }

              // Order 5: base-addl-main-sub (e.g., "2 box 5 pkt 3 nos") - already handled by existing logic
              if (unitMatches(baseUnit, baseUnitLower) &&
                unitMatches(addlMainUnit, addlCompBaseUnit) &&
                unitMatches(addlSubUnit, addlCompAddlUnit)) {
                const addlConversion = parseFloat(addlUnitObj.CONVERSION) || 1;
                const addlQtyInCompound = addlMainQty + (addlSubQty / addlConversion);

                console.log('🔍 Parsing Order 5 (base-addl-main-sub):', {
                  baseQty,
                  addlMainQty,
                  addlSubQty,
                  addlConversion,
                  addlQtyInCompound,
                  input: input
                });

                const denominator = parseFloat(unitConfig.DENOMINATOR) || 1;
                const conversion = parseFloat(unitConfig.CONVERSION) || 1;

                const addlQtyInSubComponent = addlQtyInCompound * addlConversion;
                const calculatedBaseQty = (addlQtyInSubComponent * denominator) / conversion;

                return {
                  qty: baseQty, // Only the base quantity for display
                  totalQty: baseQty + calculatedBaseQty, // Total for calculation
                  uom: 'base',
                  isCompound: false,
                  parts: [],
                  isCustomConversion: false, // Not a custom conversion, just compound additional unit input
                  customAddlQty: addlQtyInCompound
                };
              }

              // Order 6: base-addl-sub-main (e.g., "2 box 3 nos 5 pkt")
              if (unitMatches(baseUnit, baseUnitLower) &&
                unitMatches(addlMainUnit, addlCompAddlUnit) &&
                unitMatches(addlSubUnit, addlCompBaseUnit)) {
                const addlConversion = parseFloat(addlUnitObj.CONVERSION) || 1;
                const addlQtyInCompound = addlSubQty + (addlMainQty / addlConversion);

                const denominator = parseFloat(unitConfig.DENOMINATOR) || 1;
                const conversion = parseFloat(unitConfig.CONVERSION) || 1;

                const addlQtyInSubComponent = addlQtyInCompound * addlConversion;
                const calculatedBaseQty = (addlQtyInSubComponent * denominator) / conversion;

                return {
                  qty: baseQty, // Only the base quantity for display
                  totalQty: baseQty + calculatedBaseQty, // Total for calculation
                  uom: 'base',
                  isCompound: false,
                  parts: [],
                  isCustomConversion: false, // Not a custom conversion, just compound additional unit input
                  customAddlQty: addlQtyInCompound
                };
              }
            }
          }
        }
      }

      // Check if BASEUNITS is compound and ADDITIONALUNITS is simple (fallback - should not reach here if handled above)
      // Parse format: "compoundBaseUnitMain qty1 compoundBaseUnitSub qty2 addlUnit qty3"
      // Example: "2 pkt 3 nos 1 box" where baseUnit=pkt of 10 nos (compound), addlUnit=box (simple)
      // Note: baseCompoundAddlMatch is already set from the regex, so we check if it matches this pattern
      if (baseCompoundAddlMatch && unitConfig.BASEUNITS && unitConfig.ADDITIONALUNITS && unitsArray && unitsArray.length > 0) {
        const baseUnitObj = unitsArray.find(u => u.NAME === unitConfig.BASEUNITS);
        if (baseUnitObj && baseUnitObj.ISSIMPLEUNIT === 'No') {
          // BASEUNITS is compound - check if the pattern matches compound base + simple additional
          const baseCompBaseUnit = baseUnitObj.BASEUNITS?.toLowerCase();
          const baseCompAddlUnit = baseUnitObj.ADDITIONALUNITS?.toLowerCase();
          const addlUnitLower = unitConfig.ADDITIONALUNITS?.toLowerCase();

          // Check if the pattern matches: baseCompMain baseCompSub addlUnit
          // Try both orders: main-sub-addl or sub-main-addl
          if (baseCompBaseUnit && baseCompAddlUnit) {
            // Order 1: main-sub-addl (e.g., "2 pkt 3 nos 1 box")
            if (unitMatches(baseUnit, baseCompBaseUnit) &&
              unitMatches(addlMainUnit, baseCompAddlUnit) &&
              unitMatches(addlSubUnit, addlUnitLower)) {
              // Parse: baseMainQty = 2 pkt, baseSubQty = 3 nos, addlQty = 1 box
              const baseMainQty = baseQty;
              const baseSubQty = addlMainQty;
              const addlQty = addlSubQty;

              const baseConversion = parseFloat(baseUnitObj.CONVERSION) || 1;
              const baseQtyInCompound = baseMainQty + (baseSubQty / baseConversion);

              const denominator = parseFloat(unitConfig.DENOMINATOR) || 1;
              const conversion = parseFloat(unitConfig.CONVERSION) || 1;

              // Check if BASEUNITS is compound - if so, DENOMINATOR is in terms of sub-component unit
              // Convert DENOMINATOR from sub-component to compound units
              const effectiveDenominator = denominator / baseConversion;

              // Convert additional unit quantity to base units
              // Formula: effectiveDenominator BASEUNITS = conversion ADDITIONALUNITS
              // So: addlQty ADDITIONALUNITS = (addlQty * effectiveDenominator) / conversion BASEUNITS
              const addlQtyInBase = (addlQty * effectiveDenominator) / conversion;

              // Total base quantity = compound base quantity + additional unit quantity in base
              const totalBaseQty = baseQtyInCompound + addlQtyInBase;

              // Return the compound structure preserved for display (user entered "9 pkt 2 nos 3 box")
              // The quantity field should show "9-2 pkt" and the additional quantity (3 box) will be shown in brackets
              // Store the total quantity separately for calculation purposes
              return {
                qty: baseMainQty, // Main quantity for compound display (9)
                subQty: baseSubQty, // Sub quantity for compound display (2)
                totalQty: totalBaseQty, // Total for calculation (9.2 + converted box quantity)
                uom: 'base',
                isCompound: true, // Mark as compound to preserve the structure
                parts: [],
                customAddlQty: addlQty // Additional unit quantity (3 box)
              };
            }

            // Order 2: sub-main-addl (e.g., "3 nos 2 pkt 1 box")
            if (unitMatches(baseUnit, baseCompAddlUnit) &&
              unitMatches(addlMainUnit, baseCompBaseUnit) &&
              unitMatches(addlSubUnit, addlUnitLower)) {
              // Parse: baseSubQty = 3 nos, baseMainQty = 2 pkt, addlQty = 1 box
              const baseSubQty = baseQty;
              const baseMainQty = addlMainQty;
              const addlQty = addlSubQty;

              const baseConversion = parseFloat(baseUnitObj.CONVERSION) || 1;
              const baseQtyInCompound = baseMainQty + (baseSubQty / baseConversion);

              const denominator = parseFloat(unitConfig.DENOMINATOR) || 1;
              const conversion = parseFloat(unitConfig.CONVERSION) || 1;

              // Check if BASEUNITS is compound - if so, DENOMINATOR is in terms of sub-component unit
              const effectiveDenominator = denominator / baseConversion;

              // Convert additional unit quantity to base units
              const addlQtyInBase = (addlQty * effectiveDenominator) / conversion;

              // Total base quantity
              const totalBaseQty = baseQtyInCompound + addlQtyInBase;

              // Return the compound structure preserved for display (user entered "3 nos 9 pkt 2 box")
              // The quantity field should show "9-2 pkt" and the additional quantity (2 box) will be shown in brackets
              return {
                qty: baseMainQty, // Main quantity for compound display (9)
                subQty: baseSubQty, // Sub quantity for compound display (2)
                totalQty: totalBaseQty, // Total for calculation (9.2 + converted box quantity)
                uom: 'base',
                isCompound: true, // Mark as compound to preserve the structure
                parts: [],
                customAddlQty: addlQty // Additional unit quantity (2 box)
              };
            }
          }
        }
      }
    }

    // Parse custom conversion format (e.g., "12 box = 20 nos", "12box=20nos", "20nos=12box", "10b=22n")
    // Also supports compound units: "1 box = 15 pkt 3 nos", "15 pkt 3 nos = 1 box"
    // This allows users to override DENOMINATOR and CONVERSION
    // Supports both orders: base=additional or additional=base
    // Supports abbreviated units (partial matching)

    // First try simple format: "number unit = number unit"
    const simpleCustomConversionPattern = /^(\d+(?:\.\d+)?)\s*(\w+)\s*[=]?\s*(\d+(?:\.\d+)?)\s*(\w+)$/i;
    let customConversionMatch = trimmed.match(simpleCustomConversionPattern);

    // If simple format doesn't match, try compound format on right side: "number unit = number unit number unit"
    if (!customConversionMatch) {
      const compoundRightPattern = /^(\d+(?:\.\d+)?)\s*(\w+)\s*[=]?\s*(\d+(?:\.\d+)?)\s*(\w+)\s+(\d+(?:\.\d+)?)\s*(\w+)$/i;
      customConversionMatch = trimmed.match(compoundRightPattern);
    }

    // If still no match, try compound format on left side: "number unit number unit = number unit"
    if (!customConversionMatch) {
      const compoundLeftPattern = /^(\d+(?:\.\d+)?)\s*(\w+)\s+(\d+(?:\.\d+)?)\s*(\w+)\s*[=]?\s*(\d+(?:\.\d+)?)\s*(\w+)$/i;
      customConversionMatch = trimmed.match(compoundLeftPattern);
    }

    if (customConversionMatch && unitConfig.BASEUNITS && unitConfig.ADDITIONALUNITS) {
      let qty1, unit1, qty2, unit2, qty3, unit3;

      if (customConversionMatch.length === 5) {
        // Simple format: "number unit = number unit"
        qty1 = parseFloat(customConversionMatch[1]);
        unit1 = customConversionMatch[2].toLowerCase();
        qty2 = parseFloat(customConversionMatch[3]);
        unit2 = customConversionMatch[4].toLowerCase();
        qty3 = null;
        unit3 = null;
      } else if (customConversionMatch.length === 7) {
        // Compound format: "number unit = number unit number unit" or "number unit number unit = number unit"
        // The regex captures: qty1, unit1, qty2, unit2, qty3, unit3
        // We need to determine which side is compound based on the = sign position
        qty1 = parseFloat(customConversionMatch[1]);
        unit1 = customConversionMatch[2].toLowerCase();
        qty2 = parseFloat(customConversionMatch[3]);
        unit2 = customConversionMatch[4].toLowerCase();
        qty3 = parseFloat(customConversionMatch[5]);
        unit3 = customConversionMatch[6].toLowerCase();

        // Determine which side is compound by checking where = sign is
        if (trimmed.includes('=')) {
          const parts = trimmed.split('=');
          const leftPart = parts[0].trim();
          const rightPart = parts[1].trim();

          // Check if left part has two units (compound pattern: "number unit number unit")
          const leftHasTwoUnits = /^\d+(?:\.\d+)?\s+\w+\s+\d+(?:\.\d+)?\s+\w+$/i.test(leftPart);
          // Check if right part has two units (compound pattern: "number unit number unit")
          const rightHasTwoUnits = /^\d+(?:\.\d+)?\s+\w+\s+\d+(?:\.\d+)?\s+\w+$/i.test(rightPart);

          // If left has two units, then qty1,unit1 and qty2,unit2 are on left, qty3,unit3 is on right
          // If right has two units, then qty1,unit1 is on left, qty2,unit2 and qty3,unit3 are on right
          // But the regex always captures in order, so we need to adjust based on which side is compound
          if (leftHasTwoUnits && !rightHasTwoUnits) {
            // Left is compound: "qty1 unit1 qty2 unit2 = qty3 unit3"
            // Already correct: qty1,unit1,qty2,unit2 are left, qty3,unit3 is right
          } else if (!leftHasTwoUnits && rightHasTwoUnits) {
            // Right is compound: "qty1 unit1 = qty2 unit2 qty3 unit3"
            // Already correct: qty1,unit1 is left, qty2,unit2,qty3,unit3 is right
          }
          // If both or neither have two units, keep as is (will be determined by unit matching)
        }
        // If no = sign, keep as is (will be determined by unit matching)
      }

      // Helper function to check if a unit matches (supports full name and abbreviations)
      const unitMatches = (inputUnit, targetUnit) => {
        if (!inputUnit || !targetUnit) return false;
        const inputLower = inputUnit.toLowerCase().trim();
        const targetLower = targetUnit.toLowerCase().trim();
        if (inputLower === targetLower) return true;
        // Check if target starts with input (e.g., "pkt" matches "pkt of 10 nos")
        if (inputLower.length >= 1 && targetLower.startsWith(inputLower)) {
          // Make sure it's a word boundary (not just a substring)
          const nextChar = targetLower[inputLower.length];
          if (!nextChar || nextChar === ' ' || nextChar === '-' || nextChar === '=') return true;
        }
        // Check if input starts with target (e.g., "pkt of 10 nos" matches "pkt")
        if (targetLower.length >= 1 && inputLower.startsWith(targetLower)) {
          const nextChar = inputLower[targetLower.length];
          if (!nextChar || nextChar === ' ' || nextChar === '-' || nextChar === '=') return true;
        }
        // Also check if target contains input as a whole word (for compound units)
        const wordBoundaryRegex = new RegExp(`\\b${inputLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (wordBoundaryRegex.test(targetLower)) return true;
        return false;
      };

      const baseUnitLower = unitConfig.BASEUNITS.toLowerCase();
      const addlUnitLower = unitConfig.ADDITIONALUNITS.toLowerCase();

      // Check if BASEUNITS is compound and get component units
      let baseCompBaseUnit = null;
      let baseCompAddlUnit = null;
      let baseCompConversion = 1;
      if (unitsArray && unitsArray.length > 0 && unitConfig.BASEUNITS) {
        const baseUnitObj = unitsArray.find(u => u.NAME === unitConfig.BASEUNITS);
        if (baseUnitObj && baseUnitObj.ISSIMPLEUNIT === 'No') {
          baseCompBaseUnit = baseUnitObj.BASEUNITS?.toLowerCase();
          baseCompAddlUnit = baseUnitObj.ADDITIONALUNITS?.toLowerCase();
          baseCompConversion = parseFloat(baseUnitObj.CONVERSION) || 1;
        }
      }

      // Determine which side is base and which is additional
      let baseQty, addlQty, isBaseCompound = false, baseMainQty = 0, baseSubQty = 0;

      // FIRST: Determine which side is compound (has qty3 and unit3, and right side has 3 parts)
      // For "number unit = number unit number unit": right is compound
      // For "number unit number unit = number unit": left is compound
      const hasThreeParts = qty3 !== null && unit3 !== null;
      let rightIsCompound = false;
      let leftIsCompound = false;

      if (hasThreeParts) {
        // Determine which side is compound by checking where the = sign is
        if (trimmed.includes('=')) {
          const parts = trimmed.split('=');
          const leftPart = parts[0].trim();
          const rightPart = parts[1].trim();

          // Check if left part matches compound pattern (has two units)
          const leftHasTwoUnits = /^\d+(?:\.\d+)?\s+\w+\s+\d+(?:\.\d+)?\s+\w+$/i.test(leftPart);
          // Check if right part matches compound pattern (has two units)
          const rightHasTwoUnits = /^\d+(?:\.\d+)?\s+\w+\s+\d+(?:\.\d+)?\s+\w+$/i.test(rightPart);

          if (leftHasTwoUnits && !rightHasTwoUnits) {
            leftIsCompound = true;
          } else if (!leftHasTwoUnits && rightHasTwoUnits) {
            rightIsCompound = true;
          }
        } else {
          // No = sign - try to determine based on unit matching
          // If unit1 and unit2 match base component units, left is compound
          if (baseCompBaseUnit && baseCompAddlUnit) {
            if ((unitMatches(unit1, baseCompBaseUnit) || unitMatches(unit1, baseCompAddlUnit)) &&
              (unitMatches(unit2, baseCompBaseUnit) || unitMatches(unit2, baseCompAddlUnit)) &&
              unitMatches(unit3, addlUnitLower)) {
              leftIsCompound = true;
            } else if (unitMatches(unit1, addlUnitLower) &&
              (unitMatches(unit2, baseCompBaseUnit) || unitMatches(unit2, baseCompAddlUnit)) &&
              (unitMatches(unit3, baseCompBaseUnit) || unitMatches(unit3, baseCompAddlUnit))) {
              rightIsCompound = true;
            }
          }
        }
      }

      // THEN: Check unit matches based on which side is compound
      // Check if left side matches additional unit (only if not compound)
      const leftMatchesAddl = !leftIsCompound && unitMatches(unit1, addlUnitLower);
      // Check if right side matches additional unit (simple or compound)
      // If left is compound, check unit3; otherwise check unit2
      const rightMatchesAddl = leftIsCompound
        ? unitMatches(unit3, addlUnitLower)
        : (rightIsCompound ? false : unitMatches(unit2, addlUnitLower));

      // Check if left side matches base unit (simple or compound)
      // If left is compound, check if unit1 and unit2 match component units
      const leftMatchesBase = leftIsCompound
        ? (baseCompBaseUnit && baseCompAddlUnit &&
          ((unitMatches(unit1, baseCompBaseUnit) && unitMatches(unit2, baseCompAddlUnit)) ||
            (unitMatches(unit1, baseCompAddlUnit) && unitMatches(unit2, baseCompBaseUnit))))
        : (unitMatches(unit1, baseUnitLower) ||
          (baseCompBaseUnit && unitMatches(unit1, baseCompBaseUnit)) ||
          (baseCompAddlUnit && unitMatches(unit1, baseCompAddlUnit)) ||
          // Also check if baseUnitLower contains unit1 as a word (ONLY for compound base units like "pkt of 10 nos" matching "pkt")
          (baseCompBaseUnit && baseUnitLower &&
            (baseUnitLower.startsWith(unit1 + ' ') || baseUnitLower.includes(' ' + unit1 + ' ') || baseUnitLower.endsWith(' ' + unit1))));

      // Check if right side matches base unit (simple or compound)
      // If right is compound, check if unit2 and unit3 match component units
      const rightMatchesBase = rightIsCompound
        ? (baseCompBaseUnit && baseCompAddlUnit &&
          ((unitMatches(unit2, baseCompBaseUnit) && unitMatches(unit3, baseCompAddlUnit)) ||
            (unitMatches(unit2, baseCompAddlUnit) && unitMatches(unit3, baseCompBaseUnit))))
        : (unitMatches(unit2, baseUnitLower) ||
          (baseCompBaseUnit && unitMatches(unit2, baseCompBaseUnit)) ||
          (baseCompAddlUnit && unitMatches(unit2, baseCompAddlUnit)));

      if (leftMatchesAddl && (rightMatchesBase || (rightIsCompound && baseCompBaseUnit && baseCompAddlUnit))) {
        // Format: addlQty addlUnit = baseQty baseUnit (or compound)
        // Example: "1 box = 15 pkt 3 nos"
        addlQty = qty1;
        if (rightIsCompound && baseCompBaseUnit && baseCompAddlUnit) {
          // Right side is compound base unit
          // Check order: main-sub or sub-main
          if (unitMatches(unit2, baseCompBaseUnit) && unitMatches(unit3, baseCompAddlUnit)) {
            // Order: main sub (e.g., "15 pkt 3 nos")
            baseMainQty = qty2;
            baseSubQty = qty3;
          } else if (unitMatches(unit2, baseCompAddlUnit) && unitMatches(unit3, baseCompBaseUnit)) {
            // Order: sub main (e.g., "3 nos 15 pkt")
            baseMainQty = qty3;
            baseSubQty = qty2;
          } else {
            return { qty: 0, uom: 'base', isCompound: false, parts: [] };
          }
          // Convert compound to base unit quantity
          baseQty = baseMainQty + (baseSubQty / baseCompConversion);
          isBaseCompound = true;
        } else {
          // Right side is simple base unit
          baseQty = qty2;
        }
      } else if ((leftMatchesBase || leftIsCompound) && rightMatchesAddl) {
        // Format: baseQty baseUnit (or compound) = addlQty addlUnit
        // Example: "15 pkt 3 nos = 1 box" or "10 pkt 2 nos = 3 box"
        if (leftIsCompound && baseCompBaseUnit && baseCompAddlUnit) {
          // Left side is compound base unit
          // Check order: main-sub or sub-main
          if (unitMatches(unit1, baseCompBaseUnit) && unitMatches(unit2, baseCompAddlUnit)) {
            // Order: main sub (e.g., "10 pkt 2 nos")
            baseMainQty = qty1;
            baseSubQty = qty2;
            addlQty = qty3; // qty3 is the additional unit quantity
          } else if (unitMatches(unit1, baseCompAddlUnit) && unitMatches(unit2, baseCompBaseUnit)) {
            // Order: sub main (e.g., "2 nos 10 pkt")
            baseMainQty = qty2;
            baseSubQty = qty1;
            addlQty = qty3; // qty3 is the additional unit quantity
          } else {
            return { qty: 0, uom: 'base', isCompound: false, parts: [] };
          }
          // Convert compound to base unit quantity
          baseQty = baseMainQty + (baseSubQty / baseCompConversion);
          isBaseCompound = true;
        } else {
          // Left side is simple base unit
          baseQty = qty1;
          addlQty = qty2;
        }
      } else {
        // Try match fallback for simple format only
        if (customConversionMatch.length === 5) {
          // Use unitMatches helper for flexible matching (supports abbreviations and partial matches)
          // Check multiple combinations to handle compound base units
          // For "10 pkt = 3 box" where BASEUNITS is "pkt of 10 nos":
          // - unit1="pkt" should match baseCompBaseUnit="pkt" OR baseUnitLower="pkt of 10 nos"
          // - unit2="box" should match addlUnitLower="box"
          const unit1MatchesBase = unitMatches(unit1, baseUnitLower) ||
            (baseCompBaseUnit && unitMatches(unit1, baseCompBaseUnit)) ||
            (baseCompAddlUnit && unitMatches(unit1, baseCompAddlUnit)) ||
            // Also check if baseUnitLower starts with unit1 followed by space (for "pkt of 10 nos" matching "pkt")
            (baseUnitLower && (baseUnitLower.startsWith(unit1 + ' ') || baseUnitLower.includes(' ' + unit1 + ' ') || baseUnitLower.endsWith(' ' + unit1)));
          const unit2MatchesBase = unitMatches(unit2, baseUnitLower) ||
            (baseCompBaseUnit && unitMatches(unit2, baseCompBaseUnit)) ||
            (baseCompAddlUnit && unitMatches(unit2, baseCompAddlUnit)) ||
            (baseUnitLower && (baseUnitLower.startsWith(unit2 + ' ') || baseUnitLower.includes(' ' + unit2 + ' ') || baseUnitLower.endsWith(' ' + unit2)));
          const unit1MatchesAddl = unitMatches(unit1, addlUnitLower);
          const unit2MatchesAddl = unitMatches(unit2, addlUnitLower);

          // Debug: Log the matching results for troubleshooting
          console.log('🔍 Custom conversion fallback matching:', {
            input: trimmed,
            unit1, unit2,
            baseUnitLower, addlUnitLower,
            baseCompBaseUnit, baseCompAddlUnit,
            unit1MatchesBase, unit2MatchesBase,
            unit1MatchesAddl, unit2MatchesAddl,
            qty1, qty2
          });

          if (unit1MatchesBase && unit2MatchesAddl) {
            baseQty = qty1;
            addlQty = qty2;
            console.log('✅ Matched: unit1 is base, unit2 is addl');
          } else if (unit1MatchesAddl && unit2MatchesBase) {
            baseQty = qty2;
            addlQty = qty1;
            console.log('✅ Matched: unit1 is addl, unit2 is base');
          } else {
            // No valid match
            console.log('❌ No valid match in fallback');
            baseQty = 0;
            addlQty = 0;
          }
        } else {
          // Compound format but no match - return empty
          return { qty: 0, uom: 'base', isCompound: false, parts: [] };
        }
      }

      // Check if it's a valid custom conversion
      if (baseQty > 0 && addlQty > 0) {
        // Store custom conversion ratio
        // Formula: baseQty BASEUNITS = addlQty ADDITIONALUNITS
        // This is equivalent to: DENOMINATOR BASEUNITS = CONVERSION ADDITIONALUNITS
        // So: customDenominator = baseQty, customConversion = addlQty
        // Check if we're already setting custom conversion to prevent infinite loop
        if (!settingCustomConversionRef.current) {
          settingCustomConversionRef.current = true;
          // Use setTimeout to avoid infinite loop - set state after parsing is complete
          setTimeout(() => {
            setCustomConversion({
              baseQty: baseQty,
              addlQty: addlQty,
              denominator: baseQty,
              conversion: addlQty
            });
            setCustomAddlQty(addlQty);
            settingCustomConversionRef.current = false;
          }, 0);
        }

        // Return the base quantity (user entered base unit, may be compound)
        return {
          qty: baseQty,
          uom: 'base',
          isCompound: isBaseCompound,
          parts: isBaseCompound ? [{ qty: baseMainQty, unit: baseCompBaseUnit }, { qty: baseSubQty, unit: baseCompAddlUnit }] : [],
          isCustomConversion: true,
          customAddlQty: addlQty
        };
      }
    }

    // Parse compound unit in two formats:
    // 1. Hyphen format (display format): "2-500.000 LTR" 
    // 2. Space format (input format): "2 LTR 500 ML" or "2LTR500ML"

    // First try hyphen format (display format: "2-500.000 LTR")
    const hyphenPattern = /^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s+(\w+)$/i;
    const hyphenMatch = trimmed.match(hyphenPattern);
    if (hyphenMatch && unitsArray && unitsArray.length > 0 && unitConfig.BASEUNITS) {
      const baseUnitObj = unitsArray.find(u => u.NAME === unitConfig.BASEUNITS);
      if (baseUnitObj && baseUnitObj.ISSIMPLEUNIT === 'No') {
        const mainQty = parseFloat(hyphenMatch[1]);
        const subQty = parseFloat(hyphenMatch[2]);
        const displayUnit = hyphenMatch[3].toLowerCase();
        const compBaseUnit = baseUnitObj.BASEUNITS?.toLowerCase();

        // Check if display unit matches the base component unit
        if (displayUnit === compBaseUnit) {
          // This is the display format - return as component compound
          return {
            qty: mainQty,
            subQty: subQty,
            uom: 'base',
            isCompound: true,
            parts: [{ qty: mainQty, unit: compBaseUnit }, { qty: subQty, unit: baseUnitObj.ADDITIONALUNITS }],
            isComponentCompound: true,
            conversion: parseFloat(baseUnitObj.CONVERSION) || 1
          };
        }
      }
    }

    // If not hyphen format, try space-separated or no-space format (e.g., "2 LTR 500 ML", "2LTR500ML", "1L20M", "20ML1L")
    // Pattern allows:
    // - Optional spaces between number and unit
    // - Optional space between the two units (supports "1LTR20ML" and "1LTR 20ML")
    // - Abbreviated units (e.g., "L" for "LTR", "M" for "ML")
    // - Both orders: main-sub and sub-main
    // 
    // For no-space cases like "2LTR10ML", we need to be careful:
    // The pattern should match: number + unit + number + unit
    // Try multiple patterns to handle different spacing scenarios
    let compoundMatch = null;

    // Pattern 1: With spaces (e.g., "2 LTR 10 ML", "2LTR 10ML", "2 LTR10ML")
    compoundMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s+([A-Za-z]+)\s+(\d+(?:\.\d+)?)\s*([A-Za-z]+)$/i);

    // Pattern 2: No space between first number and unit, but space between units (e.g., "2LTR 10ML")
    if (!compoundMatch) {
      compoundMatch = trimmed.match(/^(\d+(?:\.\d+)?)([A-Za-z]+)\s+(\d+(?:\.\d+)?)\s*([A-Za-z]+)$/i);
    }

    // Pattern 3: Space between first number and unit, but no space between units (e.g., "2 LTR10ML")
    if (!compoundMatch) {
      compoundMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s+([A-Za-z]+)(\d+(?:\.\d+)?)([A-Za-z]+)$/i);
    }

    // Pattern 4: Absolutely no spaces (e.g., "2LTR10ML", "2L10M", "10ML2L", "20ML2LTR")
    // This is the critical one - we need to ensure proper parsing
    // The regex will match greedily, so [A-Za-z]+ will match as much as possible
    // but will stop when we require a digit for the next group
    if (!compoundMatch) {
      compoundMatch = trimmed.match(/^(\d+(?:\.\d+)?)([A-Za-z]+)(\d+(?:\.\d+)?)([A-Za-z]+)$/i);
    }
    if (compoundMatch) {
      const qty1 = parseFloat(compoundMatch[1]);
      const unit1 = compoundMatch[2];
      const qty2 = parseFloat(compoundMatch[3]);
      const unit2 = compoundMatch[4];

      // Helper function to check if a unit matches (supports full name and abbreviations)
      const unitMatches = (inputUnit, targetUnit) => {
        const inputLower = inputUnit.toLowerCase();
        const targetLower = targetUnit.toLowerCase();
        // Exact match
        if (inputLower === targetLower) return true;
        // Abbreviation match: input starts with target or target starts with input
        if (inputLower.length >= 1 && targetLower.startsWith(inputLower)) return true;
        if (targetLower.length >= 1 && inputLower.startsWith(targetLower)) return true;
        return false;
      };

      // Check if it matches base compound unit (try both orders)
      if (unitConfig.BASEUNITHASCOMPOUNDUNIT === 'Yes') {
        const baseUnit = unitConfig.BASEUNITCOMP_BASEUNIT?.toLowerCase();
        const addlUnit = unitConfig.BASEUNITCOMP_ADDLUNIT?.toLowerCase();

        // Order 1: qty1 unit1 = main, qty2 unit2 = sub
        if (unitMatches(unit1, baseUnit) && unitMatches(unit2, addlUnit)) {
          return {
            qty: qty1,
            subQty: qty2,
            uom: 'base',
            isCompound: true,
            parts: [{ qty: qty1, unit: unit1 }, { qty: qty2, unit: unit2 }]
          };
        }

        // Order 2: qty1 unit1 = sub, qty2 unit2 = main
        if (unitMatches(unit1, addlUnit) && unitMatches(unit2, baseUnit)) {
          return {
            qty: qty2,
            subQty: qty1,
            uom: 'base',
            isCompound: true,
            parts: [{ qty: qty2, unit: unit2 }, { qty: qty1, unit: unit1 }]
          };
        }
      }

      // Check if it matches additional compound unit (try both orders)
      // First check unitConfig flags, then check units array
      let addlBaseUnit = null;
      let addlAddlUnit = null;

      if (unitConfig.ADDITIONALUNITHASCOMPOUNDUNIT === 'Yes') {
        addlBaseUnit = unitConfig.ADDLUNITCOMP_BASEUNIT?.toLowerCase();
        addlAddlUnit = unitConfig.ADDLUNITCOMP_ADDLUNIT?.toLowerCase();
      } else if (unitsArray && unitsArray.length > 0 && unitConfig.ADDITIONALUNITS) {
        // Check units array for compound additional unit
        const addlUnitObj = unitsArray.find(u => u.NAME === unitConfig.ADDITIONALUNITS);
        if (addlUnitObj && addlUnitObj.ISSIMPLEUNIT === 'No') {
          addlBaseUnit = addlUnitObj.BASEUNITS?.toLowerCase();
          addlAddlUnit = addlUnitObj.ADDITIONALUNITS?.toLowerCase();
        }
      }

      if (addlBaseUnit && addlAddlUnit) {
        // Order 1: qty1 unit1 = main, qty2 unit2 = sub
        if (unitMatches(unit1, addlBaseUnit) && unitMatches(unit2, addlAddlUnit)) {
          return {
            qty: qty1,
            subQty: qty2,
            uom: 'additional',
            isCompound: true,
            parts: [{ qty: qty1, unit: unit1 }, { qty: qty2, unit: unit2 }],
            isComponentCompound: true,
            conversion: unitsArray && unitsArray.length > 0 && unitConfig.ADDITIONALUNITS
              ? (() => {
                const addlUnitObj = unitsArray.find(u => u.NAME === unitConfig.ADDITIONALUNITS);
                return addlUnitObj ? parseFloat(addlUnitObj.CONVERSION) || 1 : 1;
              })()
              : 1
          };
        }

        // Order 2: qty1 unit1 = sub, qty2 unit2 = main
        if (unitMatches(unit1, addlAddlUnit) && unitMatches(unit2, addlBaseUnit)) {
          return {
            qty: qty2,
            subQty: qty1,
            uom: 'additional',
            isCompound: true,
            parts: [{ qty: qty2, unit: unit2 }, { qty: qty1, unit: unit1 }],
            isComponentCompound: true,
            conversion: unitsArray && unitsArray.length > 0 && unitConfig.ADDITIONALUNITS
              ? (() => {
                const addlUnitObj = unitsArray.find(u => u.NAME === unitConfig.ADDITIONALUNITS);
                return addlUnitObj ? parseFloat(addlUnitObj.CONVERSION) || 1 : 1;
              })()
              : 1
          };
        }
      }

      // Check if BASEUNITS itself is a compound unit (like "LTR of 1000 ML")
      // and user entered component units in compound format (e.g., "2 LTR 500 ML", "2LTR500ML", "1L20M", "20ML1L", "2L10M", "10ML2L")
      // This should be checked FIRST for component compounds, before regular compound units
      if (unitsArray && unitsArray.length > 0 && unitConfig.BASEUNITS) {
        const baseUnitObj = unitsArray.find(u => u.NAME === unitConfig.BASEUNITS);
        if (baseUnitObj && baseUnitObj.ISSIMPLEUNIT === 'No') {
          const compBaseUnit = baseUnitObj.BASEUNITS?.toLowerCase();
          const compAddlUnit = baseUnitObj.ADDITIONALUNITS?.toLowerCase();

          // Helper function to check if a unit matches (supports full name and abbreviations)
          const unitMatches = (inputUnit, targetUnit) => {
            const inputLower = inputUnit.toLowerCase();
            const targetLower = targetUnit.toLowerCase();
            // Exact match
            if (inputLower === targetLower) return true;
            // Abbreviation match: input starts with target or target starts with input
            if (inputLower.length >= 1 && targetLower.startsWith(inputLower)) return true;
            if (targetLower.length >= 1 && inputLower.startsWith(targetLower)) return true;
            return false;
          };

          // Try order 1: qty1 unit1 = main, qty2 unit2 = sub (e.g., "1 LTR 20 ML", "1LTR20ML", "1L20M")
          if (unitMatches(unit1, compBaseUnit) && unitMatches(unit2, compAddlUnit)) {
            return {
              qty: qty1,
              subQty: qty2,
              uom: 'base',
              isCompound: true,
              parts: [{ qty: qty1, unit: unit1 }, { qty: qty2, unit: unit2 }],
              isComponentCompound: true,
              conversion: parseFloat(baseUnitObj.CONVERSION) || 1
            };
          }

          // Try order 2: qty1 unit1 = sub, qty2 unit2 = main (e.g., "20 ML 1 LTR", "20ML1L", "20M 1L")
          if (unitMatches(unit1, compAddlUnit) && unitMatches(unit2, compBaseUnit)) {
            return {
              qty: qty2,
              subQty: qty1,
              uom: 'base',
              isCompound: true,
              parts: [{ qty: qty2, unit: unit2 }, { qty: qty1, unit: unit1 }],
              isComponentCompound: true,
              conversion: parseFloat(baseUnitObj.CONVERSION) || 1
            };
          }
        }
      }

      // If not component compound, check regular compound units
      // Use original mainQty, mainUnit, subQty, subUnit for backward compatibility
      const mainQty = qty1;
      const mainUnit = unit1;
      const subQty = qty2;
      const subUnit = unit2;
    }

    // Parse simple unit with UOM (e.g., "10 Box", "5 Nos", "2000 ML", "2 LTR")
    // Also handle when BASEUNITS is a compound unit (like "LTR of 1000 ML")
    // In that case, allow input in component units (LTR or ML)
    const simplePattern = /^(\d+(?:\.\d+)?)\s*(\w+)$/i;
    const simpleMatch = trimmed.match(simplePattern);
    if (simpleMatch) {
      const qty = parseFloat(simpleMatch[1]);
      const unit = simpleMatch[2].toLowerCase();

      console.log('🔍 Parsing simple unit input:', {
        input: trimmed,
        qty,
        unit,
        baseUnit: unitConfig.BASEUNITS?.toLowerCase(),
        addlUnit: unitConfig.ADDITIONALUNITS?.toLowerCase()
      });

      // Check if it matches base unit
      const baseUnit = unitConfig.BASEUNITS?.toLowerCase();
      if (baseUnit === unit) {
        return { qty: qty, uom: 'base', isCompound: false, parts: [] };
      }

      // Check if it matches additional unit
      const addlUnit = unitConfig.ADDITIONALUNITS?.toLowerCase();
      if (addlUnit === unit) {
        return { qty: qty, uom: 'additional', isCompound: false, parts: [] };
      }

      // Check if ADDITIONALUNITS is a compound unit and user entered a component unit
      // Look up the compound unit in units array
      if (unitsArray && unitsArray.length > 0 && unitConfig.ADDITIONALUNITS) {
        const addlUnitObj = unitsArray.find(u => u.NAME === unitConfig.ADDITIONALUNITS);
        if (addlUnitObj && addlUnitObj.ISSIMPLEUNIT === 'No') {
          // ADDITIONALUNITS is a compound unit - check if user entered component units
          const addlCompBaseUnit = addlUnitObj.BASEUNITS?.toLowerCase();
          const addlCompAddlUnit = addlUnitObj.ADDITIONALUNITS?.toLowerCase();
          const addlConversion = parseFloat(addlUnitObj.CONVERSION) || 1;

          if (addlCompBaseUnit && unit === addlCompBaseUnit) {
            // User entered main component of compound additional unit (e.g., "25 pkt" for "pkt of 10 nos")
            // Convert to compound additional unit: qty is already in main component
            // Display alternative quantity as "25-0 pkt" (25 pkt + 0 nos)
            // Then convert to base unit using DENOMINATOR/CONVERSION
            const denominator = parseFloat(unitConfig.DENOMINATOR) || 1;
            const conversion = parseFloat(unitConfig.CONVERSION) || 1;
            // CONVERSION is in sub-component units, so convert qty to sub-component first
            const qtyInSubComponent = qty * addlConversion;
            const baseQty = (qtyInSubComponent * denominator) / conversion;

            // Preserve compound additional unit structure for alternative quantity display
            const mainQty = qty; // Already in main component (e.g., 25 pkt)
            const subQty = 0; // No sub component when entering main component directly

            console.log('🔍 Parsing component unit of compound additional:', {
              input: trimmed,
              qty,
              unit,
              addlCompBaseUnit,
              addlCompAddlUnit,
              addlConversion,
              baseQty,
              compoundAddlQty: qty,
              compoundAddlMainQty: mainQty,
              compoundAddlSubQty: subQty
            });

            return {
              qty: baseQty,
              uom: 'base',
              isCompound: false,
              parts: [],
              isComponentUnit: true,
              componentType: 'main',
              conversion: addlConversion,
              // Store compound additional unit structure for alternative quantity display
              compoundAddlMainQty: mainQty, // 25 pkt
              compoundAddlSubQty: subQty, // 0 nos
              compoundAddlQty: qty // 25 pkt (for calculations and display)
            };
          } else if (addlCompAddlUnit && unit === addlCompAddlUnit) {
            // User entered sub component of compound additional unit (e.g., "55 nos" for "pkt of 25 nos")
            // Convert to compound additional unit: qty / conversion
            // For "55 nos" with conversion = 25: 55 / 25 = 2.2 pkt
            // Display alternative quantity as "2-5 pkt" (2 pkt + 5 nos)
            // Then convert to base unit
            const qtyInCompound = qty / addlConversion;
            const denominator = parseFloat(unitConfig.DENOMINATOR) || 1;
            const conversion = parseFloat(unitConfig.CONVERSION) || 1;
            const qtyInSubComponent = qtyInCompound * addlConversion;
            const baseQty = (qtyInSubComponent * denominator) / conversion;

            // Preserve compound additional unit structure for alternative quantity display
            // Extract main and sub quantities from compound additional unit
            const mainQty = Math.floor(qtyInCompound); // 2 pkt
            const subQty = (qtyInCompound - mainQty) * addlConversion; // 0.2 * 25 = 5 nos
            // Round subQty to avoid floating point errors
            const roundedSubQty = Math.round(subQty * 100) / 100;

            return {
              qty: baseQty,
              uom: 'base',
              isCompound: false,
              parts: [],
              isComponentUnit: true,
              componentType: 'sub',
              originalQty: qty,
              conversion: addlConversion,
              // Store compound additional unit structure for alternative quantity display
              compoundAddlMainQty: mainQty, // 2 pkt
              compoundAddlSubQty: roundedSubQty, // 5 nos
              compoundAddlQty: qtyInCompound // 2.2 pkt (for calculations)
            };
          }
        }
      }

      // Check if BASEUNITS is a compound unit and user entered a component unit
      // Look up the compound unit in units array
      if (unitsArray && unitsArray.length > 0 && unitConfig.BASEUNITS) {
        const baseUnitObj = unitsArray.find(u => u.NAME === unitConfig.BASEUNITS);
        if (baseUnitObj && baseUnitObj.ISSIMPLEUNIT === 'No') {
          // BASEUNITS is a compound unit - check if user entered component units
          const compBaseUnit = baseUnitObj.BASEUNITS?.toLowerCase();
          const compAddlUnit = baseUnitObj.ADDITIONALUNITS?.toLowerCase();
          const conversion = parseFloat(baseUnitObj.CONVERSION) || 1;

          if (compBaseUnit && unit === compBaseUnit) {
            // User entered main component unit (e.g., "2 LTR")
            // Convert to compound base unit: qty is already in main component
            return {
              qty: qty,
              uom: 'base',
              isCompound: false,
              parts: [],
              isComponentUnit: true,
              componentType: 'main',
              conversion: conversion
            };
          } else if (compAddlUnit && unit === compAddlUnit) {
            // User entered sub component unit (e.g., "55 nos" for "pkt of 25 nos")
            // Convert to compound base unit: qty / conversion
            // For "55 nos" with conversion = 25: 55 / 25 = 2.2 pkt
            // Display as "2-5 pkt" (2 pkt + 5 nos)
            // This works for both cases:
            // 1. BASEUNITS = compound, no ADDITIONALUNITS
            // 2. BASEUNITS = compound, ADDITIONALUNITS = simple unit
            const convertedQty = qty / conversion;
            const mainQty = Math.floor(convertedQty); // 2 pkt
            const subQty = (convertedQty - mainQty) * conversion; // 0.2 * 25 = 5 nos
            // Round subQty to avoid floating point errors (e.g., 4.9999999 should be 5)
            const roundedSubQty = Math.round(subQty * 100) / 100;
            return {
              qty: mainQty, // Main quantity for compound display (2)
              subQty: roundedSubQty, // Sub quantity for compound display (5)
              uom: 'base',
              isCompound: true, // Mark as compound to preserve the structure for display
              parts: [],
              isComponentUnit: true,
              componentType: 'sub',
              originalQty: qty,
              conversion: conversion
            };
          }
        }
      }
    }

    // If no match, try to parse as number (default to primary)
    const numValue = parseFloat(trimmed);
    if (!isNaN(numValue)) {
      return { qty: numValue, uom: 'base', isCompound: false, parts: [] };
    }

    return { qty: 0, uom: 'base', isCompound: false, parts: [] };
  };

  // Format compound base unit for display (e.g., "2-500.000 LTR" for 2.5 LTR)
  // When BASEUNITS is compound (like "LTR of 1000 ML"), display in format: "mainQty-subQty BASEUNIT"
  // Use the base component unit (e.g., "LTR") instead of the full compound unit name (e.g., "LTR of 1000 ML")
  const formatCompoundBaseUnit = (primaryQty, unitConfig, unitsArray) => {
    if (!unitConfig || !unitsArray || unitsArray.length === 0) return null;

    // Check if BASEUNITS is a compound unit
    const baseUnitObj = unitsArray.find(u => u.NAME === unitConfig.BASEUNITS);
    if (!baseUnitObj || baseUnitObj.ISSIMPLEUNIT === 'Yes') return null;

    const conversion = parseFloat(baseUnitObj.CONVERSION) || 1;
    const mainQty = Math.floor(primaryQty);
    const subQty = (primaryQty - mainQty) * conversion;

    // Get decimal places for sub unit
    let subDecimalPlaces = 0;
    if (baseUnitObj.ADDITIONALUNITS) {
      const subUnitObj = unitsArray.find(u => u.NAME === baseUnitObj.ADDITIONALUNITS);
      if (subUnitObj) {
        subDecimalPlaces = typeof subUnitObj.DECIMALPLACES === 'string'
          ? parseInt(subUnitObj.DECIMALPLACES) || 0
          : (subUnitObj.DECIMALPLACES || 0);
      }
    }

    const formattedSubQty = subDecimalPlaces === 0
      ? Math.round(subQty).toString()
      : subQty.toFixed(subDecimalPlaces);

    // Use the base component unit (e.g., "LTR") instead of the full compound unit name (e.g., "LTR of 1000 ML")
    const displayUnit = baseUnitObj.BASEUNITS || unitConfig.BASEUNITS;

    // Format: "mainQty-subQty BASEUNIT" (e.g., "2-500.000 LTR" or "2-0.000 LTR")
    // Always show the format even if subQty is 0
    return `${mainQty}-${formattedSubQty} ${displayUnit}`;
  };

  // Convert parsed quantity to primary UOM quantity
  // Uses custom conversion if available (from user input like "12 box = 20 nos")
  // unitsArray parameter is optional but recommended for compound units to get accurate CONVERSION
  const convertToPrimaryQty = (parsedQty, unitConfig, customConv = null, unitsArray = null) => {
    if (!parsedQty || !unitConfig) return 0;

    // If parsedQty has totalQty (for "1 box 5 pkt 3 nos" format), use it for calculation
    // Otherwise use qty for display
    if (parsedQty.totalQty !== undefined && parsedQty.totalQty !== null) {
      return parsedQty.totalQty;
    }

    if (parsedQty.uom === 'base') {
      if (parsedQty.isCompound) {
        // Compound base unit (e.g., 2 Kgs 500 Gms, or 2 LTR 500 ML)
        let mainQty = parsedQty.qty || 0;
        let subQty = parsedQty.subQty || 0;

        // Round main and sub quantities based on their decimal places before calculation
        if (unitsArray && unitsArray.length > 0) {
          // Get decimal places for main unit (base component of compound)
          if (unitConfig && unitConfig.BASEUNITS) {
            const baseUnitObj = unitsArray.find(u => u.NAME === unitConfig.BASEUNITS);
            if (baseUnitObj && baseUnitObj.ISSIMPLEUNIT === 'No') {
              // BASEUNITS is compound - get main and sub unit decimal places
              const mainUnitObj = unitsArray.find(u => u.NAME === baseUnitObj.BASEUNITS);
              const subUnitObj = unitsArray.find(u => u.NAME === baseUnitObj.ADDITIONALUNITS);

              if (mainUnitObj) {
                const mainDecimalPlaces = typeof mainUnitObj.DECIMALPLACES === 'string'
                  ? parseInt(mainUnitObj.DECIMALPLACES) || 0
                  : (mainUnitObj.DECIMALPLACES || 0);
                if (mainDecimalPlaces === 0) {
                  mainQty = Math.round(mainQty);
                } else {
                  mainQty = parseFloat(mainQty.toFixed(mainDecimalPlaces));
                }
              }

              if (subUnitObj) {
                const subDecimalPlaces = typeof subUnitObj.DECIMALPLACES === 'string'
                  ? parseInt(subUnitObj.DECIMALPLACES) || 0
                  : (subUnitObj.DECIMALPLACES || 0);
                if (subDecimalPlaces === 0) {
                  subQty = Math.round(subQty);
                } else {
                  subQty = parseFloat(subQty.toFixed(subDecimalPlaces));
                }
              }
            }
          }
        }

        let conversion = 1;
        // If it's a component compound (BASEUNITS is compound unit like "LTR of 1000 ML")
        if (parsedQty.isComponentCompound && parsedQty.conversion) {
          // Use the conversion from parsed quantity (from units array)
          conversion = parsedQty.conversion;
        } else if (unitsArray && unitConfig && unitConfig.BASEUNITS) {
          // Check if BASEUNITS itself is a compound unit - get conversion from units array
          const baseUnitObj = unitsArray.find(u => u.NAME === unitConfig.BASEUNITS);
          if (baseUnitObj && baseUnitObj.ISSIMPLEUNIT === 'No' && baseUnitObj.CONVERSION) {
            // BASEUNITS is compound - use CONVERSION from units array
            conversion = parseFloat(baseUnitObj.CONVERSION) || 1;
          } else {
            // Regular compound unit - check unitConfig
            const subUnitName = unitConfig.BASEUNITCOMP_ADDLUNIT?.toLowerCase() || '';
            if (subUnitName === 'gms' || subUnitName === 'gm' || subUnitName === 'ml' || subUnitName === 'g') {
              conversion = 1000;
            } else if (unitConfig.BASEUNITCOMP_CONVERSION) {
              conversion = parseFloat(unitConfig.BASEUNITCOMP_CONVERSION) || 1;
            }
          }
        } else {
          // Regular compound unit - check unitConfig
          const subUnitName = unitConfig.BASEUNITCOMP_ADDLUNIT?.toLowerCase() || '';
          if (subUnitName === 'gms' || subUnitName === 'gm' || subUnitName === 'ml' || subUnitName === 'g') {
            conversion = 1000;
          } else if (unitConfig.BASEUNITCOMP_CONVERSION) {
            conversion = parseFloat(unitConfig.BASEUNITCOMP_CONVERSION) || 1;
          }
        }

        return mainQty + (subQty / conversion);
      } else {
        // Simple base unit or component unit
        // Round the base unit quantity based on its decimal places
        let baseQty = parsedQty.qty || 0;
        if (unitsArray && unitsArray.length > 0 && unitConfig.BASEUNITS) {
          const baseUnitObj = unitsArray.find(u => u.NAME === unitConfig.BASEUNITS);
          if (baseUnitObj) {
            const baseDecimalPlaces = typeof baseUnitObj.DECIMALPLACES === 'string'
              ? parseInt(baseUnitObj.DECIMALPLACES) || 0
              : (baseUnitObj.DECIMALPLACES || 0);
            // Round the base unit quantity based on its decimal places
            if (baseDecimalPlaces === 0) {
              baseQty = Math.round(baseQty);
            } else {
              baseQty = parseFloat(baseQty.toFixed(baseDecimalPlaces));
            }
          }
        }
        return baseQty;
      }
    } else {
      // Additional unit
      // Formula: DENOMINATOR BASEUNITS = CONVERSION ADDITIONALUNITS
      // So: 1 ADDITIONALUNIT = (DENOMINATOR / CONVERSION) BASEUNITS
      // 
      // IMPORTANT: When BASEUNITS is compound (e.g., "pkt of 10 nos"), DENOMINATOR refers to
      // the sub-component unit (e.g., "nos"), not the compound unit count.
      // Example: BASEUNITS = "pkt of 10 nos", DENOMINATOR = 100, CONVERSION = 1
      // This means: 100 nos = 1 box
      // Since 1 "pkt of 10 nos" = 10 nos (from units array CONVERSION = 10),
      // then: 100 nos / 10 = 10 "pkt of 10 nos" = 1 box
      // So we need to divide DENOMINATOR by the compound unit's CONVERSION
      //
      // Use custom conversion if available (from user input like "12 box = 20 nos")
      let denominator, conversion;
      if (parsedQty.isCustomConversion && customConversion) {
        denominator = parseFloat(customConversion.denominator) || 1;
        conversion = parseFloat(customConversion.conversion) || 1;
      } else {
        denominator = parseFloat(unitConfig.DENOMINATOR) || 1;
        conversion = parseFloat(unitConfig.CONVERSION) || 1;
      }

      // Check if BASEUNITS is compound - if so, DENOMINATOR is in terms of sub-component unit
      // Need to convert DENOMINATOR from sub-component to compound units
      let effectiveDenominator = denominator;
      if (unitConfig.BASEUNITS && unitsArray && unitsArray.length > 0) {
        const baseUnitObj = unitsArray.find(u => u.NAME === unitConfig.BASEUNITS);
        if (baseUnitObj && baseUnitObj.ISSIMPLEUNIT === 'No' && baseUnitObj.CONVERSION) {
          // BASEUNITS is compound - DENOMINATOR is in sub-component units (nos)
          // Convert to compound units: DENOMINATOR / compound_CONVERSION
          // Example: DENOMINATOR = 100 nos, compound_CONVERSION = 10 (1 pkt = 10 nos)
          // effectiveDenominator = 100 / 10 = 10 "pkt of 10 nos"
          const compoundConversion = parseFloat(baseUnitObj.CONVERSION) || 1;
          effectiveDenominator = denominator / compoundConversion;
        }
      }

      if (parsedQty.isCompound) {
        // Compound additional unit
        let mainQty = parsedQty.qty || 0;
        let subQty = parsedQty.subQty || 0;

        // Round main and sub quantities based on their decimal places before calculation
        if (unitsArray && unitsArray.length > 0 && unitConfig.ADDITIONALUNITS) {
          const addlUnitObj = unitsArray.find(u => u.NAME === unitConfig.ADDITIONALUNITS);
          if (addlUnitObj && addlUnitObj.ISSIMPLEUNIT === 'No') {
            // ADDITIONALUNITS is compound - get main and sub unit decimal places
            const mainUnitObj = unitsArray.find(u => u.NAME === addlUnitObj.BASEUNITS);
            const subUnitObj = unitsArray.find(u => u.NAME === addlUnitObj.ADDITIONALUNITS);

            if (mainUnitObj) {
              const mainDecimalPlaces = typeof mainUnitObj.DECIMALPLACES === 'string'
                ? parseInt(mainUnitObj.DECIMALPLACES) || 0
                : (mainUnitObj.DECIMALPLACES || 0);
              if (mainDecimalPlaces === 0) {
                mainQty = Math.round(mainQty);
              } else {
                mainQty = parseFloat(mainQty.toFixed(mainDecimalPlaces));
              }
            }

            if (subUnitObj) {
              const subDecimalPlaces = typeof subUnitObj.DECIMALPLACES === 'string'
                ? parseInt(subUnitObj.DECIMALPLACES) || 0
                : (subUnitObj.DECIMALPLACES || 0);
              if (subDecimalPlaces === 0) {
                subQty = Math.round(subQty);
              } else {
                subQty = parseFloat(subQty.toFixed(subDecimalPlaces));
              }
            }
          }
        }

        // Get the conversion factor for the compound additional unit's sub-unit
        let subConversion = 1;
        if (unitConfig.ADDITIONALUNITHASCOMPOUNDUNIT === 'Yes' && unitConfig.ADDLUNITCOMP_CONVERSION) {
          subConversion = parseFloat(unitConfig.ADDLUNITCOMP_CONVERSION) || 1;
        } else {
          // Fallback: check if sub-unit is common unit (gms, ml, etc.)
          const subUnitName = unitConfig.ADDLUNITCOMP_ADDLUNIT?.toLowerCase() || '';
          if (subUnitName === 'gms' || subUnitName === 'gm' || subUnitName === 'ml' || subUnitName === 'g') {
            subConversion = 1000;
          }
        }

        // Convert compound additional unit to simple additional unit
        // e.g., "2 Box 5 Nos" where Box is main and Nos is sub
        // Total in additional unit = mainQty + (subQty / subConversion)
        const totalAddlUnits = mainQty + (subQty / subConversion);

        // Convert to base: (effectiveDenominator / CONVERSION) per additional unit
        // effectiveDenominator is already in compound units when BASEUNITS is compound
        return totalAddlUnits * (effectiveDenominator / conversion);
      } else {
        // Simple additional unit
        // Round the additional unit quantity based on its decimal places before converting to base
        let addlQty = parsedQty.qty || 0;
        if (unitsArray && unitsArray.length > 0 && unitConfig.ADDITIONALUNITS) {
          const addlUnitObj = unitsArray.find(u => u.NAME === unitConfig.ADDITIONALUNITS);
          if (addlUnitObj) {
            const addlDecimalPlaces = typeof addlUnitObj.DECIMALPLACES === 'string'
              ? parseInt(addlUnitObj.DECIMALPLACES) || 0
              : (addlUnitObj.DECIMALPLACES || 0);
            // Round the additional unit quantity based on its decimal places
            if (addlDecimalPlaces === 0) {
              addlQty = Math.round(addlQty);
            } else {
              addlQty = parseFloat(addlQty.toFixed(addlDecimalPlaces));
            }
          }
        }
        // Convert to base: qty * (effectiveDenominator / CONVERSION)
        // effectiveDenominator is already in compound units when BASEUNITS is compound
        return addlQty * (effectiveDenominator / conversion);
      }
    }
  };

  // Convert base quantity to additional unit quantity
  // Always converts from BASEUNITS to ADDITIONALUNITS
  // Formula: DENOMINATOR BASEUNITS = CONVERSION ADDITIONALUNITS
  // So: 1 BASEUNIT = (CONVERSION / DENOMINATOR) ADDITIONALUNITS
  // If custom conversion is set, use that instead of default DENOMINATOR/CONVERSION
  const convertToAlternativeQty = (baseQty, unitConfig, unitsArray, customConv = null) => {
    if (!baseQty || !unitConfig || !unitConfig.ADDITIONALUNITS) return null;

    // Use custom conversion if available, otherwise use default
    let denominator, conversion;
    if (customConv && customConv.denominator && customConv.conversion) {
      denominator = parseFloat(customConv.denominator) || 1;
      conversion = parseFloat(customConv.conversion) || 1;
    } else {
      denominator = parseFloat(unitConfig.DENOMINATOR) || 1;
      conversion = parseFloat(unitConfig.CONVERSION) || 1;
    }

    // Check if BASEUNITS is compound - if so, DENOMINATOR is in terms of sub-component unit
    // Need to convert DENOMINATOR from sub-component to compound units
    let effectiveDenominator = denominator;
    if (unitConfig.BASEUNITS && unitsArray && unitsArray.length > 0) {
      const baseUnitObj = unitsArray.find(u => u.NAME === unitConfig.BASEUNITS);
      if (baseUnitObj && baseUnitObj.ISSIMPLEUNIT === 'No' && baseUnitObj.CONVERSION) {
        // BASEUNITS is compound - DENOMINATOR is in sub-component units (nos)
        // Convert to compound units: DENOMINATOR / compound_CONVERSION
        // Example: DENOMINATOR = 100 nos, compound_CONVERSION = 10 (1 pkt = 10 nos)
        // effectiveDenominator = 100 / 10 = 10 "pkt of 10 nos"
        const compoundConversion = parseFloat(baseUnitObj.CONVERSION) || 1;
        effectiveDenominator = denominator / compoundConversion;
      }
    }

    // Check if ADDITIONALUNITS is a compound unit
    const addlUnitObj = unitsArray && unitsArray.length > 0
      ? unitsArray.find(u => u.NAME === unitConfig.ADDITIONALUNITS)
      : null;
    const hasCompoundAddlUnit = addlUnitObj && addlUnitObj.ISSIMPLEUNIT === 'No';

    // IMPORTANT: When ADDITIONALUNITS is compound, CONVERSION refers to the sub-component unit (nos),
    // not the compound unit itself (pkt of 10 nos).
    // Example: BASEUNITS = "box", ADDITIONALUNITS = "pkt of 10 nos", DENOMINATOR = 1, CONVERSION = 100
    // This means: 1 box = 100 nos (sub-component of compound additional unit)
    // Since 1 "pkt of 10 nos" = 10 nos, then: 1 box = 100 nos = 10 "pkt of 10 nos"
    // So we need to divide CONVERSION by the compound unit's CONVERSION to get the quantity in compound units
    let alternativeQty;
    if (hasCompoundAddlUnit && addlUnitObj && addlUnitObj.CONVERSION) {
      // ADDITIONALUNITS is compound - CONVERSION is in sub-component units (nos)
      // First convert to sub-component units: baseQty * (CONVERSION / effectiveDenominator)
      // Then convert to compound units: divide by compound unit's CONVERSION
      const addlCompoundConversion = parseFloat(addlUnitObj.CONVERSION) || 1;
      const qtyInSubComponent = baseQty * (conversion / effectiveDenominator);
      // Convert from sub-component to compound unit
      alternativeQty = qtyInSubComponent / addlCompoundConversion;
    } else {
      // ADDITIONALUNITS is simple - direct conversion
      // Convert from base to additional: baseQty * (CONVERSION / effectiveDenominator)
      // effectiveDenominator is already in compound units when BASEUNITS is compound
      alternativeQty = baseQty * (conversion / effectiveDenominator);
    }

    // Get decimal places for additional unit from units array
    let decimalPlaces = 0;
    if (unitsArray && unitsArray.length > 0) {
      const addlUnit = unitsArray.find(u => u.NAME === unitConfig.ADDITIONALUNITS);
      if (addlUnit) {
        decimalPlaces = typeof addlUnit.DECIMALPLACES === 'string'
          ? parseInt(addlUnit.DECIMALPLACES) || 0
          : (addlUnit.DECIMALPLACES || 0);
      }
    } else if (unitConfig.ADDITIONALUNITS_DECIMAL !== undefined) {
      decimalPlaces = typeof unitConfig.ADDITIONALUNITS_DECIMAL === 'string'
        ? parseInt(unitConfig.ADDITIONALUNITS_DECIMAL) || 0
        : (unitConfig.ADDITIONALUNITS_DECIMAL || 0);
    }

    if (hasCompoundAddlUnit && addlUnitObj) {
      // ADDITIONALUNITS is compound - format in hyphenated format (e.g., "20-0 pkt")
      // alternativeQty is already in compound units (e.g., 20 "pkt of 10 nos")
      const addlConversion = parseFloat(addlUnitObj.CONVERSION) || 1;
      const mainQty = Math.floor(alternativeQty);
      const subQty = (alternativeQty - mainQty) * addlConversion;

      // Get decimal places for sub unit
      let subDecimalPlaces = 0;
      if (addlUnitObj.ADDITIONALUNITS) {
        const subUnitObj = unitsArray.find(u => u.NAME === addlUnitObj.ADDITIONALUNITS);
        if (subUnitObj) {
          subDecimalPlaces = typeof subUnitObj.DECIMALPLACES === 'string'
            ? parseInt(subUnitObj.DECIMALPLACES) || 0
            : (subUnitObj.DECIMALPLACES || 0);
        }
      }

      const formattedSubQty = subDecimalPlaces === 0
        ? Math.round(subQty).toString()
        : subQty.toFixed(subDecimalPlaces);

      // Use the base component unit (e.g., "pkt") instead of the full compound unit name (e.g., "pkt of 10 nos")
      const displayUnit = addlUnitObj.BASEUNITS || unitConfig.ADDITIONALUNITS;

      // Format: "mainQty-subQty BASEUNIT" (e.g., "20-0 pkt" or "20-5.000 pkt")
      // Always show the format even if subQty is 0
      return {
        qty: `${mainQty}-${formattedSubQty}`,
        unit: displayUnit
      };
    }

    // Format the alternative quantity based on decimal places (for simple additional units)
    const formattedQty = decimalPlaces === 0
      ? Math.round(alternativeQty).toString()
      : alternativeQty.toFixed(decimalPlaces);

    return {
      qty: formattedQty,
      unit: unitConfig.ADDITIONALUNITS
    };
  };


  // Validate and format decimal places

  const validateDecimalPlaces = (value, maxDecimals) => {

    if (!value) return '';



    const strValue = value.toString();

    const parts = strValue.split('.');



    if (!maxDecimals || maxDecimals === '0' || maxDecimals === 0) {

      // No decimals allowed - return integer part only

      return parts[0];

    }



    if (parts.length === 1) {

      // No decimal point yet

      return strValue;

    }



    // Limit decimal places

    const decimals = parseInt(maxDecimals);

    return parts[0] + '.' + parts[1].substring(0, decimals);

  };



  // Format number with specific decimal places

  const formatWithDecimals = (value, maxDecimals) => {

    if (!value && value !== 0) return '';

    if (!maxDecimals || maxDecimals === '0' || maxDecimals === 0) {

      return Math.floor(parseFloat(value || 0)).toString();

    }

    const decimals = parseInt(maxDecimals);

    return parseFloat(value || 0).toFixed(decimals);

  };



  // Parse compound unit string (e.g., "LTR of 1000 ML" -> {base: "LTR", addl: "ML", conversion: "1000"})

  const parseCompoundUnit = (compoundUnitString) => {

    if (!compoundUnitString || typeof compoundUnitString !== 'string') return null;



    const parts = compoundUnitString.split(' of ');

    if (parts.length === 2) {

      const [baseUnit, rest] = parts;

      const match = rest.match(/^(\d+)\s+(.+)$/);

      if (match) {

        return {

          base: baseUnit.trim(),

          addl: match[2].trim(),

          conversion: match[1].trim()

        };

      }

    }

    return null;

  };



  // Old formula functions removed - using simplified Tally-style quantity input instead


  // =============== End of Utility Functions ===============





  // Dynamic grid template based on Rate/Amount columns, Discount column, and Stock column visibility

  const getGridTemplateColumns = () => {

    // Use flexible columns to fit within container without scrolling
    // Item Name gets more space, other columns are compact but visible
    // Note: Mobile uses card layout, this function is for desktop only

    if (isMobile) {
      // Mobile uses card layout, but keep this as fallback with minimal widths
      if (canShowRateAmtColumn) {
        let columns = 'minmax(80px, 1fr)'; // Item Name column (flexible)

        columns += ' minmax(40px, 50px)'; // Qty column

        if (canShowClosingStock) {
          columns += ' minmax(30px, 35px)'; // Stock column
        }

        columns += ' minmax(40px, 45px)'; // Rate column

        columns += ' minmax(40px, 50px)'; // Rate UOM column

        if (canShowDiscColumn) {
          columns += ' minmax(25px, 30px)'; // Disc % column
        }

        columns += ' minmax(25px, 30px)'; // GST % column

        columns += ' minmax(50px, 55px)'; // Amount column

        columns += ' minmax(50px, 55px)'; // Action column

        return columns;
      } else {
        let columns = '1fr'; // Item Name column (flexible)

        columns += ' minmax(40px, 50px)'; // Qty column

        if (canShowClosingStock) {
          columns += ' minmax(30px, 35px)'; // Stock column
        }

        columns += ' minmax(50px, 55px)'; // Action column

        return columns;
      }
    }

    // Desktop layout
    if (canShowRateAmtColumn) {

      let columns = 'minmax(200px, 2fr)'; // Item Name column (flexible)

      columns += ' minmax(70px, 0.8fr)'; // Qty column

      if (canShowClosingStock) {

        columns += ' minmax(60px, 0.7fr)'; // Stock column

      }

      columns += ' minmax(70px, 0.8fr)'; // Rate column

      columns += ' minmax(80px, 0.9fr)'; // Rate UOM column

      if (canShowDiscColumn) {

        columns += ' minmax(60px, 0.7fr)'; // Disc % column

      }

      columns += ' minmax(60px, 0.7fr)'; // GST % column

      columns += ' minmax(90px, 1fr)'; // Amount column

      columns += ' minmax(120px, 140px)'; // Action column (fixed min, flexible max)

      return columns;

    } else {

      let columns = 'minmax(200px, 1fr)'; // Item Name column (flexible)

      columns += ' minmax(70px, 0.8fr)'; // Qty column

      if (canShowClosingStock) {

        columns += ' minmax(60px, 0.7fr)'; // Stock column

      }

      columns += ' minmax(120px, 140px)'; // Action column (fixed min, flexible max)

      return columns;

    }

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



  // Get available classes for selected voucher type
  const availableClasses = useMemo(() => {
    if (!selectedVoucherType || !voucherTypes.length) {
      return [];
    }
    const selectedVoucher = voucherTypes.find(vt => vt.NAME === selectedVoucherType);
    if (!selectedVoucher || !selectedVoucher.VOUCHERCLASSLIST || !Array.isArray(selectedVoucher.VOUCHERCLASSLIST)) {
      return [];
    }
    return selectedVoucher.VOUCHERCLASSLIST.map(cls => cls.CLASSNAME).filter(Boolean);
  }, [selectedVoucherType, voucherTypes]);

  // Get ledgers for selected class
  const selectedClassLedgers = useMemo(() => {
    if (!selectedVoucherType || !selectedClassName || !voucherTypes.length) {
      return [];
    }
    const selectedVoucher = voucherTypes.find(vt => vt.NAME === selectedVoucherType);
    if (!selectedVoucher || !selectedVoucher.VOUCHERCLASSLIST || !Array.isArray(selectedVoucher.VOUCHERCLASSLIST)) {
      return [];
    }
    const selectedClass = selectedVoucher.VOUCHERCLASSLIST.find(cls => cls.CLASSNAME === selectedClassName);
    if (!selectedClass || !selectedClass.LEDGERENTRIESLIST || !Array.isArray(selectedClass.LEDGERENTRIESLIST)) {
      return [];
    }
    return selectedClass.LEDGERENTRIESLIST;
  }, [selectedVoucherType, selectedClassName, voucherTypes]);

  // Reset or restore class selection when voucher type changes
  useEffect(() => {
    if (!selectedVoucherType || !voucherTypes.length) {
      setSelectedClassName('');
      setShowClassNameDropdown(false);
      setLedgerValues({});
      return;
    }

    const selectedVoucher = voucherTypes.find(vt => vt.NAME === selectedVoucherType);
    if (!selectedVoucher || !selectedVoucher.VOUCHERCLASSLIST || !Array.isArray(selectedVoucher.VOUCHERCLASSLIST)) {
      setSelectedClassName('');
      setShowClassNameDropdown(false);
      setLedgerValues({});
      return;
    }

    // Try to restore saved class name if available for this voucher type
    const savedClassName = sessionStorage.getItem('selectedClassName');
    if (savedClassName && selectedVoucher.VOUCHERCLASSLIST.some(cls => cls.CLASSNAME === savedClassName)) {
      setSelectedClassName(savedClassName);
    } else {
      setSelectedClassName('');
      setLedgerValues({});
    }
    setShowClassNameDropdown(false);
  }, [selectedVoucherType, voucherTypes]);

  // Reset ledger values when class changes
  useEffect(() => {
    setLedgerValues({});
  }, [selectedClassName]);

  // Calculate all ledger amounts (shared between UI display and payload)
  const calculatedLedgerAmounts = useMemo(() => {
    // Return empty object if no class selected or no items
    if (!selectedClassName || !selectedClassLedgers.length || orderItems.length === 0) {
      return {
        subtotal: 0,
        ledgerAmounts: {},
        gstAmounts: {},
        flatRateAmounts: {},
        basedOnQuantityAmounts: {},
        onTotalSalesAmounts: {},
        onCurrentSubTotalAmounts: {},
        roundingAmounts: {}
      };
    }

    // Get company and customer for state comparison
    const currentCompany = filteredCompanies.find(c => c.guid === company);
    const selectedCustomerObj = customerOptions.find(c => c.NAME === selectedCustomer);
    const companyState = currentCompany?.statename || currentCompany?.STATENAME || currentCompany?.state || '';
    const customerState = selectedCustomerObj?.STATENAME || editableState || '';
    const isSameState = companyState && customerState && companyState.toLowerCase().trim() === customerState.toLowerCase().trim();

    // Helper function to determine GSTDUTYHEAD from ledger name
    const getGSTDUTYHEAD = (ledgerName) => {
      const nameUpper = (ledgerName || '').toUpperCase();
      if (nameUpper.includes('CGST')) return 'CGST';
      if (nameUpper.includes('SGST') || nameUpper.includes('UTGST')) return 'SGST/UTGST';
      if (nameUpper.includes('IGST')) return 'IGST';
      return null;
    };

    // Helper function to check if ledger should be calculated based on state
    const shouldCalculateLedger = (ledger) => {
      const gstDutyHead = getGSTDUTYHEAD(ledger.NAME);
      if (!gstDutyHead) return false;

      if (isSameState) {
        return gstDutyHead === 'CGST' || gstDutyHead === 'SGST/UTGST';
      } else {
        return gstDutyHead === 'IGST';
      }
    };

    // Calculate subtotal directly (sum of all item amounts)
    const subtotal = orderItems.reduce((sum, item) => sum + (parseFloat(item.amount || 0)), 0);

    // Calculate GST for each GST ledger
    const gstLedgers = selectedClassLedgers.filter(
      ledger => ledger.METHODTYPE === 'GST' && shouldCalculateLedger(ledger)
    );

    const gstAmounts = {};
    gstLedgers.forEach(ledger => {
      const gstDutyHead = getGSTDUTYHEAD(ledger.NAME);
      const rateOfTaxCalc = parseFloat(ledger.RATEOFTAXCALCULATION || '0');
      let totalGST = 0;

      orderItems.forEach(item => {
        const itemGstPercent = parseFloat(item.gstPercent || 0);

        if (itemGstPercent > 0) {
          const itemTaxableAmount = parseFloat(item.amount || 0);

          if (rateOfTaxCalc === 0) {
            let effectiveGstRate = itemGstPercent;
            if (gstDutyHead === 'CGST' || gstDutyHead === 'SGST/UTGST') {
              effectiveGstRate = itemGstPercent / 2;
            }
            const itemGST = (itemTaxableAmount * effectiveGstRate) / 100;
            totalGST += itemGST;
          } else {
            const matchingRate = rateOfTaxCalc;
            if (gstDutyHead === 'CGST' || gstDutyHead === 'SGST/UTGST') {
              if (Math.abs((itemGstPercent / 2) - matchingRate) < 0.01) {
                const itemGST = (itemTaxableAmount * matchingRate) / 100;
                totalGST += itemGST;
              }
            } else {
              if (Math.abs(itemGstPercent - matchingRate) < 0.01) {
                const itemGST = (itemTaxableAmount * matchingRate) / 100;
                totalGST += itemGST;
              }
            }
          }
        }
      });

      gstAmounts[ledger.NAME] = totalGST;
    });

    // Calculate total ledger values (only user-defined ones that have values)
    const totalLedgerValues = Object.values(ledgerValues).reduce((sum, value) => {
      return sum + (parseFloat(value) || 0);
    }, 0);

    // Calculate flat rate ledger amounts
    const flatRateLedgers = selectedClassLedgers.filter(
      ledger => ledger.METHODTYPE === 'As Flat Rate'
    );
    const flatRateAmounts = {};
    flatRateLedgers.forEach(ledger => {
      const classRate = parseFloat(ledger.CLASSRATE || '0');
      flatRateAmounts[ledger.NAME] = classRate;
    });
    const totalFlatRate = Object.values(flatRateAmounts).reduce((sum, value) => sum + (parseFloat(value) || 0), 0);

    // Calculate "Based on Quantity" ledger amounts
    const basedOnQuantityLedgers = selectedClassLedgers.filter(
      ledger => ledger.METHODTYPE === 'Based on Quantity'
    );
    const basedOnQuantityAmounts = {};
    const totalQuantity = orderItems.reduce((sum, item) => sum + (parseFloat(item.quantity || 0)), 0);
    basedOnQuantityLedgers.forEach(ledger => {
      const classRate = parseFloat(ledger.CLASSRATE || '0');
      basedOnQuantityAmounts[ledger.NAME] = totalQuantity * classRate;
    });
    const totalBasedOnQuantity = Object.values(basedOnQuantityAmounts).reduce((sum, value) => sum + (parseFloat(value) || 0), 0);

    // Calculate "On Total Sales" ledger amounts
    const onTotalSalesLedgers = selectedClassLedgers.filter(
      ledger => ledger.METHODTYPE === 'On Total Sales'
    );
    const onTotalSalesAmounts = {};
    onTotalSalesLedgers.forEach(ledger => {
      const classRate = parseFloat(ledger.CLASSRATE || '0');
      onTotalSalesAmounts[ledger.NAME] = (subtotal * classRate) / 100;
    });
    const totalOnTotalSales = Object.values(onTotalSalesAmounts).reduce((sum, value) => sum + (parseFloat(value) || 0), 0);

    // Calculate "On Current SubTotal" ledger amounts
    const onCurrentSubTotalLedgers = selectedClassLedgers.filter(
      ledger => ledger.METHODTYPE === 'On Current SubTotal'
    );
    let cumulativeOnCurrentSubTotal = 0;
    const onCurrentSubTotalAmounts = {};
    onCurrentSubTotalLedgers.forEach(ledger => {
      const classRate = parseFloat(ledger.CLASSRATE || '0');
      const currentBase = subtotal + totalLedgerValues + totalFlatRate + totalBasedOnQuantity + totalOnTotalSales + cumulativeOnCurrentSubTotal;
      const amount = (currentBase * classRate) / 100;
      onCurrentSubTotalAmounts[ledger.NAME] = amount;
      cumulativeOnCurrentSubTotal += amount;
    });
    const finalOnCurrentSubTotal = cumulativeOnCurrentSubTotal;

    // Calculate GST on other ledgers
    const gstOnOtherLedgers = {};
    const calculateAverageGSTRate = () => {
      let totalTaxableAmount = 0;
      let weightedGstRate = 0;

      orderItems.forEach(item => {
        const itemGstPercent = parseFloat(item.gstPercent || 0);
        const itemAmount = parseFloat(item.amount || 0);

        if (itemGstPercent > 0 && itemAmount > 0) {
          totalTaxableAmount += itemAmount;
          weightedGstRate += itemAmount * itemGstPercent;
        }
      });

      if (totalTaxableAmount > 0) {
        return weightedGstRate / totalTaxableAmount;
      }
      return 0;
    };

    const avgGstRate = calculateAverageGSTRate();

    selectedClassLedgers.forEach(ledger => {
      if (ledger.METHODTYPE === 'GST' || ledger.METHODTYPE === 'As Total Amount Rounding') {
        return;
      }

      let ledgerValue = 0;

      if (ledger.METHODTYPE === 'As User Defined Value') {
        ledgerValue = parseFloat(ledgerValues[ledger.NAME] || 0);
      } else if (ledger.METHODTYPE === 'As Flat Rate') {
        ledgerValue = parseFloat(ledger.CLASSRATE || '0');
      } else if (ledger.METHODTYPE === 'Based on Quantity') {
        ledgerValue = basedOnQuantityAmounts[ledger.NAME] || 0;
      } else if (ledger.METHODTYPE === 'On Total Sales') {
        ledgerValue = onTotalSalesAmounts[ledger.NAME] || 0;
      } else if (ledger.METHODTYPE === 'On Current SubTotal') {
        ledgerValue = onCurrentSubTotalAmounts[ledger.NAME] || 0;
      }

      if (ledgerValue !== 0) {
        if (ledger.APPROPRIATEFOR === 'GST' && ledger.EXCISEALLOCTYPE === 'Based on Value') {
          const totalItemValue = orderItems.reduce((sum, item) => sum + (parseFloat(item.amount || 0)), 0);

          if (totalItemValue > 0) {
            gstLedgers.forEach(gstLedger => {
              const gstDutyHead = getGSTDUTYHEAD(gstLedger.NAME);
              if (!gstDutyHead) return;

              const shouldCalculate = (isSameState && (gstDutyHead === 'CGST' || gstDutyHead === 'SGST/UTGST')) ||
                (!isSameState && gstDutyHead === 'IGST');

              if (!shouldCalculate) return;

              let ledgerGstAmount = 0;

              orderItems.forEach(item => {
                const itemAmount = parseFloat(item.amount || 0);
                const itemGstPercent = parseFloat(item.gstPercent || 0);

                if (itemAmount > 0 && itemGstPercent > 0) {
                  const itemDiscountPortion = (ledgerValue * itemAmount) / totalItemValue;
                  let effectiveGstRate = itemGstPercent;

                  if (gstDutyHead === 'CGST' || gstDutyHead === 'SGST/UTGST') {
                    effectiveGstRate = itemGstPercent / 2;
                  }

                  const itemGstOnDiscount = (itemDiscountPortion * effectiveGstRate) / 100;
                  ledgerGstAmount += itemGstOnDiscount;
                }
              });

              // Allow negative GST amounts (for discounts) - remove the > 0 check
              if (ledgerGstAmount !== 0) {
                if (!gstAmounts[gstLedger.NAME]) {
                  gstAmounts[gstLedger.NAME] = 0;
                }
                gstAmounts[gstLedger.NAME] += ledgerGstAmount;
              }
            });
          }
        } else if (ledger.GSTAPPLICABLE === 'Yes' && (ledger.APPROPRIATEFOR === '' || !ledger.APPROPRIATEFOR)) {
          const gstRate = ledger.GSTRATE ? parseFloat(ledger.GSTRATE) : 0;
          if (gstRate > 0) {
            const gstAmount = (ledgerValue * gstRate) / 100;
            gstOnOtherLedgers[ledger.NAME] = gstAmount;
          }
        }
      }
    });

    const totalGST = Object.values(gstAmounts).reduce((sum, value) => sum + (parseFloat(value) || 0), 0);
    const totalGstOnOtherLedgers = Object.values(gstOnOtherLedgers).reduce((sum, value) => sum + (parseFloat(value) || 0), 0);

    // Calculate amount before rounding
    const amountBeforeRounding = subtotal + totalLedgerValues + totalFlatRate + totalBasedOnQuantity + totalOnTotalSales + finalOnCurrentSubTotal + totalGST + totalGstOnOtherLedgers;

    // Helper function to calculate rounding
    const calculateRounding = (amount, roundType, roundLimit) => {
      const limit = parseFloat(roundLimit) || 1;

      if (roundType === 'Normal Rounding') {
        return Math.round(amount / limit) * limit - amount;
      } else if (roundType === 'Upward Rounding') {
        return Math.ceil(amount / limit) * limit - amount;
      } else if (roundType === 'Downward Rounding') {
        return Math.floor(amount / limit) * limit - amount;
      }
      return 0;
    };

    // Calculate rounding amounts
    const roundingLedgers = selectedClassLedgers.filter(
      ledger => ledger.METHODTYPE === 'As Total Amount Rounding'
    );

    let cumulativeRounding = 0;
    const roundingAmounts = {};
    roundingLedgers.forEach(ledger => {
      const amountToRound = amountBeforeRounding + cumulativeRounding;
      const roundingAmount = calculateRounding(
        amountToRound,
        ledger.ROUNDTYPE || 'Normal Rounding',
        ledger.ROUNDLIMIT || '1'
      );
      roundingAmounts[ledger.NAME] = roundingAmount;
      cumulativeRounding += roundingAmount;
    });

    // Build ledger amounts map for easy lookup
    const ledgerAmountsMap = {};
    selectedClassLedgers.forEach(ledger => {
      const isUserDefined = ledger.METHODTYPE === 'As User Defined Value';
      const isRounding = ledger.METHODTYPE === 'As Total Amount Rounding';
      const isGST = ledger.METHODTYPE === 'GST';
      const isFlatRate = ledger.METHODTYPE === 'As Flat Rate';
      const isBasedOnQuantity = ledger.METHODTYPE === 'Based on Quantity';
      const isOnTotalSales = ledger.METHODTYPE === 'On Total Sales';
      const isOnCurrentSubTotal = ledger.METHODTYPE === 'On Current SubTotal';

      let amount = 0;

      if (isUserDefined) {
        amount = parseFloat(ledgerValues[ledger.NAME] || 0);
      } else if (isRounding) {
        amount = roundingAmounts[ledger.NAME] || 0;
      } else if (isGST) {
        amount = gstAmounts[ledger.NAME] || 0;
      } else if (isFlatRate) {
        amount = flatRateAmounts[ledger.NAME] || 0;
      } else if (isBasedOnQuantity) {
        amount = basedOnQuantityAmounts[ledger.NAME] || 0;
      } else if (isOnTotalSales) {
        amount = onTotalSalesAmounts[ledger.NAME] || 0;
      } else if (isOnCurrentSubTotal) {
        amount = onCurrentSubTotalAmounts[ledger.NAME] || 0;
      }

      ledgerAmountsMap[ledger.NAME] = amount;
    });

    return {
      subtotal,
      ledgerAmounts: ledgerAmountsMap,
      gstAmounts,
      flatRateAmounts,
      basedOnQuantityAmounts,
      onTotalSalesAmounts,
      onCurrentSubTotalAmounts,
      roundingAmounts
    };
  }, [
    selectedClassName,
    selectedClassLedgers,
    orderItems,
    ledgerValues,
    company,
    filteredCompanies,
    selectedCustomer,
    customerOptions,
    editableState
  ]);



  // Handle customer cache refresh

  const handleRefreshCustomers = async () => {

    if (!company) return;

    const selectedCompanyTallylocId = sessionStorage.getItem('selectedCompanyTallylocId');
    // Match by both guid and tallyloc_id to handle companies with same guid but different tallyloc_id
    const currentCompany = companies.find(c => 
      c.guid === company && 
      (selectedCompanyTallylocId ? String(c.tallyloc_id) === String(selectedCompanyTallylocId) : true)
    );

    if (!currentCompany) return;

    setRefreshingCustomers(true);

    setCustomerError('');

    try {

      console.log('🔄 Refreshing customer cache...');

      await syncCustomers(currentCompany);

      console.log('✅ Customer cache refreshed successfully');

      // Dispatch event to notify other components
      window.dispatchEvent(new CustomEvent('ledgerCacheUpdated', {
        detail: { type: 'customers', company: currentCompany }
      }));

      // Small delay to ensure cache is fully written and readable
      await new Promise(resolve => setTimeout(resolve, 100));

      // Trigger re-fetch by incrementing refreshCustomers

      setRefreshCustomers(prev => prev + 1);

    } catch (error) {

      console.error('❌ Error refreshing customer cache:', error);

      setCustomerError('Failed to refresh customer cache. Please try again.');

    } finally {

      setRefreshingCustomers(false);

    }

  };

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



      // Get the current company object directly from companies

      // Use companies directly to avoid dependency issues
      const selectedCompanyTallylocId = sessionStorage.getItem('selectedCompanyTallylocId');
      // Match by both guid and tallyloc_id to handle companies with same guid but different tallyloc_id
      const currentCompany = companies.find(c => 
        c.guid === company && 
        (selectedCompanyTallylocId ? String(c.tallyloc_id) === String(selectedCompanyTallylocId) : true)
      );

      if (!currentCompany) {

        setCustomerOptions([]);

        setSelectedCustomer('');

        setCustomerLoading(false);

        setCustomerError('');

        return;

      }



      const { tallyloc_id, company: companyVal, guid } = currentCompany;

      const cacheKey = `ledgerlist-w-addrs_${tallyloc_id}_${companyVal}`;



      // Only read from cache - do not fetch from API

      // Cache updates are handled by Cache Management page

      // Retry logic for reading cache (handles timing issues after cache write)
      let cachedCustomers = null;
      let retries = refreshCustomers > 0 ? 3 : 1; // Retry more times if we just refreshed
      let attempt = 0;

      while (attempt < retries && !cachedCustomers) {
        try {
          attempt++;
          console.log(`📖 Attempting to load customers from cache (attempt ${attempt}/${retries})...`);

          cachedCustomers = await getCustomersFromOPFS(cacheKey);

          if (cachedCustomers && Array.isArray(cachedCustomers) && cachedCustomers.length > 0) {
            console.log(`✅ Successfully loaded ${cachedCustomers.length} customers from cache`);
            break;
          } else {
            cachedCustomers = null;
            if (attempt < retries) {
              console.log(`⚠️ No data found, retrying in 200ms...`);
              await new Promise(resolve => setTimeout(resolve, 200));
            }
          }
        } catch (cacheError) {
          console.error(`❌ Error loading customers from cache (attempt ${attempt}):`, cacheError);
          if (attempt < retries) {
            await new Promise(resolve => setTimeout(resolve, 200));
          } else {
            setCustomerOptions([]);
            setSelectedCustomer('');
            setCustomerError('Error loading customer data. Please use the refresh button in the top bar.');
            setCustomerLoading(false);
            return;
          }
        }
      }

      if (cachedCustomers && Array.isArray(cachedCustomers) && cachedCustomers.length > 0) {
        setCustomerOptions(cachedCustomers);
        if (cachedCustomers.length === 1) setSelectedCustomer(cachedCustomers[0].NAME);
        else setSelectedCustomer('');
        setCustomerError('');
      } else {
        // No data in cache after retries
        console.warn('⚠️ No customer data found in cache after retries');
        setCustomerOptions([]);
        setSelectedCustomer('');
        setCustomerError('No customer data found. Please use the refresh button in the top bar to load customer data.');
      }

      setCustomerLoading(false);



      // Reset refresh counter

      if (refreshCustomers) {

        setRefreshCustomers(0);

      }

    };



    fetchCustomers();

  }, [company, refreshCustomers, filteredCompanies.length]); // Use length instead of array reference to prevent infinite loops



  // Fetch stock items when company changes or refreshStockItems increments

  useEffect(() => {

    const fetchStockItems = async () => {

      if (!company) {

        setStockItems([]);

        setStockItemsLoading(false);

        setStockItemsError('');

        return;

      }



      // Get the current company object directly from companies

      // Use companies directly to avoid dependency issues
      const selectedCompanyTallylocId = sessionStorage.getItem('selectedCompanyTallylocId');
      // Match by both guid and tallyloc_id to handle companies with same guid but different tallyloc_id
      const currentCompany = companies.find(c => 
        c.guid === company && 
        (selectedCompanyTallylocId ? String(c.tallyloc_id) === String(selectedCompanyTallylocId) : true)
      );

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

      const cachedUnits = sessionStorage.getItem(`${cacheKey}_units`);
      if (cached && !refreshStockItems) {

        try {

          const items = JSON.parse(cached);

          setStockItems(items);

          if (cachedUnits) {
            try {
              const cachedUnitsData = JSON.parse(cachedUnits);
              console.log('📦 Units loaded from cache:', {
                count: cachedUnitsData.length,
                units: cachedUnitsData.map(u => ({ name: u.NAME, decimals: u.DECIMALPLACES }))
              });
              setUnits(cachedUnitsData);
            } catch (e) {
              console.warn('Failed to parse cached units:', e);
            }
          } else {
            console.warn('⚠️ No cached units found');
          }
          setStockItemsError('');

          setStockItemsLoading(false);

          return;

        } catch { }

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


        console.log('📥 Full API response:', {
          hasStockItems: !!data?.stockItems,
          stockItemsCount: data?.stockItems?.length,
          hasUnits: !!data?.units,
          unitsCount: data?.units?.length,
          unitsType: Array.isArray(data?.units) ? 'array' : typeof data?.units,
          responseKeys: data ? Object.keys(data) : []
        });


        if (data && data.stockItems && Array.isArray(data.stockItems)) {

          console.log('Raw stock items from API:', data.stockItems);


          // Store units array if present
          if (data.units && Array.isArray(data.units)) {
            console.log('📦 Units array loaded:', {
              count: data.units.length,
              units: data.units.map(u => ({ name: u.NAME, decimals: u.DECIMALPLACES }))
            });
            setUnits(data.units);
            console.log('✅ setUnits() called with', data.units.length, 'units');
            // Cache units separately
            try {
              sessionStorage.setItem(`${cacheKey}_units`, JSON.stringify(data.units));
              console.log('✅ Units cached in sessionStorage');
            } catch (cacheError) {
              console.warn('Failed to cache units in sessionStorage:', cacheError.message);
            }
          } else {
            console.warn('⚠️ No units array in API response', {
              dataUnits: data?.units,
              dataUnitsType: typeof data?.units,
              isArray: Array.isArray(data?.units)
            });
          }


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

          // Cache the deobfuscated result with graceful fallback

          try {

            sessionStorage.setItem(cacheKey, JSON.stringify(decryptedItems));

          } catch (cacheError) {

            console.warn('Failed to cache stock items in sessionStorage:', cacheError.message);

          }

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

  }, [company, refreshStockItems, companies.length]); // Use length instead of array reference to prevent infinite loops



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



  // Auto-populate customer and items after customerOptions are loaded (only once)

  useEffect(() => {

    // Only run once when customerOptions are first loaded and we have pending data

    if (customerOptions.length > 0 && !hasAutoPopulatedRef.current) {

      const pendingCustomer = sessionStorage.getItem('pendingCustomer');

      const pendingItems = sessionStorage.getItem('pendingItems');



      // Only process if there's actually pending data

      if (!pendingCustomer && !pendingItems) {

        return;

      }



      hasAutoPopulatedRef.current = true; // Mark as processed



      if (pendingCustomer) {

        setSelectedCustomer(pendingCustomer);

        setCustomerSearchTerm(pendingCustomer);

        sessionStorage.removeItem('pendingCustomer');

      }



      if (pendingItems) {

        try {

          const items = JSON.parse(pendingItems);



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

    }

  }, [customerOptions.length]); // Only run when customerOptions length changes, not reference



  // Show warning when company changes and order items exist

  useEffect(() => {

    // Skip warning if we're auto-populating from cart

    if (isAutoPopulating || autoPopulatingRef.current) {

      return;

    }



    if (orderItems.length > 0) {

      setConfirmMessage('Changing company will clear all selected items and order items. Are you sure you want to continue?');

      setConfirmAction(() => {

        setOrderItems([]);

        setSelectedItem('');

        setCustomConversion(null);
        setCustomAddlQty(null);
        setCompoundBaseQty(null);
        setCompoundAddlQty(null);
        setBaseQtyOnly(null);
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

    // Skip warning if we're auto-populating from cart

    if (isAutoPopulating || autoPopulatingRef.current) {

      return;

    }



    if (orderItems.length > 0) {

      setConfirmMessage('Changing customer will clear all selected items and order items. Are you sure you want to continue?');

      setConfirmAction(() => {

        setOrderItems([]);

        setSelectedItem('');

        setCustomConversion(null);
        setCustomAddlQty(null);
        setCompoundBaseQty(null);
        setCompoundAddlQty(null);
        setBaseQtyOnly(null);
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



        // Build unit configuration from item and units array
        const unitConfig = buildUnitConfig(selectedStockItem, units);
        setSelectedItemUnitConfig(unitConfig);

        // Helper function to map API unit name to rateUOM value
        const mapUnitToRateUOM = (unitName, unitConfig, units) => {
          if (!unitName || !unitConfig) return null;

          const baseUnitObj = units && units.length > 0
            ? units.find(u => u.NAME === unitConfig.BASEUNITS)
            : null;
          const hasCompoundBaseUnit = baseUnitObj && baseUnitObj.ISSIMPLEUNIT === 'No';

          const addlUnitObj = units && units.length > 0 && unitConfig.ADDITIONALUNITS
            ? units.find(u => u.NAME === unitConfig.ADDITIONALUNITS)
            : null;
          const hasCompoundAddlUnit = addlUnitObj && addlUnitObj.ISSIMPLEUNIT === 'No';

          // Normalize unit name for comparison (case-insensitive)
          const unitNameLower = unitName.toLowerCase().trim();

          // Check if it matches base unit
          if (hasCompoundBaseUnit && baseUnitObj) {
            // Check component units of compound base unit
            const baseCompBaseUnit = (baseUnitObj.BASEUNITS || '').toLowerCase().trim();
            const baseCompAddlUnit = (baseUnitObj.ADDITIONALUNITS || '').toLowerCase().trim();

            if (unitNameLower === baseCompBaseUnit) {
              return 'component-main';
            } else if (unitNameLower === baseCompAddlUnit) {
              return 'component-sub';
            }
          } else {
            // Simple base unit
            const baseUnitName = (unitConfig.BASEUNITS || '').toLowerCase().trim();
            if (unitNameLower === baseUnitName) {
              return 'base';
            }
          }

          // Check if it matches additional unit
          if (hasCompoundAddlUnit && addlUnitObj) {
            // Check component units of compound additional unit
            const addlCompBaseUnit = (addlUnitObj.BASEUNITS || '').toLowerCase().trim();
            const addlCompAddlUnit = (addlUnitObj.ADDITIONALUNITS || '').toLowerCase().trim();

            if (unitNameLower === addlCompBaseUnit) {
              return 'additional-component-main';
            } else if (unitNameLower === addlCompAddlUnit) {
              return 'additional-component-sub';
            }
          } else if (unitConfig.ADDITIONALUNITS) {
            // Simple additional unit
            const addlUnitName = (unitConfig.ADDITIONALUNITS || '').toLowerCase().trim();
            if (unitNameLower === addlUnitName) {
              return 'additional';
            }
          }

          return null; // Unit not found
        };

        // Set Rate UOM based on API response (STDPRICEUNIT, LASTPRICEUNIT, or RATEUNIT)
        let rateUOMFromAPI = null;

        if (selectedCustomer) {
          const selectedCustomerData = customerOptions.find(customer => customer.NAME === selectedCustomer);

          if (selectedCustomerData && selectedCustomerData.PRICELEVEL) {
            // Check PRICELEVELS for RATEUNIT
            if (selectedStockItem.PRICELEVELS && Array.isArray(selectedStockItem.PRICELEVELS)) {
              const matchingPriceLevel = selectedStockItem.PRICELEVELS.find(pl => pl.PLNAME === selectedCustomerData.PRICELEVEL);
              if (matchingPriceLevel && matchingPriceLevel.RATEUNIT) {
                rateUOMFromAPI = mapUnitToRateUOM(matchingPriceLevel.RATEUNIT, unitConfig, units);
              }
            }
          }
        }

        // If no rateUOM from PRICELEVELS, check STDPRICEUNIT or LASTPRICEUNIT
        if (!rateUOMFromAPI) {
          // Check if we're using LASTPRICE (if LASTPRICE exists and is different from STDPRICE)
          const stdPrice = selectedStockItem.STDPRICE ? enhancedDeobfuscateValue(selectedStockItem.STDPRICE) : 0;
          const lastPrice = selectedStockItem.LASTPRICE ? enhancedDeobfuscateValue(selectedStockItem.LASTPRICE) : 0;

          // Use LASTPRICEUNIT if LASTPRICE is being used and LASTPRICEUNIT exists
          if (lastPrice && lastPrice !== stdPrice && selectedStockItem.LASTPRICEUNIT) {
            rateUOMFromAPI = mapUnitToRateUOM(selectedStockItem.LASTPRICEUNIT, unitConfig, units);
          }
          // Otherwise use STDPRICEUNIT if it exists
          else if (selectedStockItem.STDPRICEUNIT) {
            rateUOMFromAPI = mapUnitToRateUOM(selectedStockItem.STDPRICEUNIT, unitConfig, units);
          }
        }

        // Set rateUOM: use API value if available, otherwise use default based on unit configuration
        if (rateUOMFromAPI) {
          setRateUOM(rateUOMFromAPI);
        } else if (unitConfig) {
          // Fallback to default logic
          const baseUnitObj = units && units.length > 0
            ? units.find(u => u.NAME === unitConfig.BASEUNITS)
            : null;
          const hasCompoundBaseUnit = baseUnitObj && baseUnitObj.ISSIMPLEUNIT === 'No';

          const addlUnitObj = units && units.length > 0 && unitConfig.ADDITIONALUNITS
            ? units.find(u => u.NAME === unitConfig.ADDITIONALUNITS)
            : null;
          const hasCompoundAddlUnit = addlUnitObj && addlUnitObj.ISSIMPLEUNIT === 'No';

          if (hasCompoundBaseUnit) {
            // For compound base units, default to main component
            setRateUOM('component-main');
          } else {
            // Always default to base unit (even if ADDITIONALUNITS is compound)
            // User can change it manually if needed
            setRateUOM('base');
          }
        } else {
          setRateUOM('base');
        }

        // Reset quantity input
        setQuantityInput('');
        setEnteredUnitType('base');
      }
    }
  }, [selectedItem, stockItems, selectedCustomer, customerOptions, units]);

  // Rebuild unit config when units array loads (if item is already selected)
  useEffect(() => {

    if (selectedItem && stockItems.length > 0 && units.length > 0) {
      const selectedStockItem = stockItems.find(item => item.NAME === selectedItem);
      if (selectedStockItem) {
        // Rebuild unit config now that units array is available
        const unitConfig = buildUnitConfig(selectedStockItem, units);
        if (unitConfig) {
          // Always update if BASEUNIT_DECIMAL changed or was previously undefined
          const shouldUpdate = !selectedItemUnitConfig ||
            unitConfig.BASEUNIT_DECIMAL !== selectedItemUnitConfig.BASEUNIT_DECIMAL;

          if (shouldUpdate) {
            console.log('🔄 Rebuilding unit config with units array:', {
              item: selectedItem,
              baseUnits: unitConfig.BASEUNITS,
              oldDecimal: selectedItemUnitConfig?.BASEUNIT_DECIMAL,
              newDecimal: unitConfig.BASEUNIT_DECIMAL,
              unitsArrayLength: units.length
            });
            setSelectedItemUnitConfig(unitConfig);

            // If there's a quantity input, re-validate it with the new config
            if (quantityInput && quantityInput.trim()) {
              setTimeout(() => {
                const validated = validateQuantityInput(quantityInput, unitConfig, units, true);
                if (validated !== quantityInput) {
                  console.log('🔄 Re-validating quantity after unit config rebuild:', {
                    old: quantityInput,
                    new: validated
                  });
                  setQuantityInput(validated);
                }
              }, 0);
            }
          }
        }
      }
    }
  }, [units, selectedItem, stockItems, selectedItemUnitConfig, quantityInput]);

  // Re-validate quantity input when units array is loaded or changes
  // Skip validation if we're editing an item (editingItemId is set)
  useEffect(() => {

    if (quantityInput && selectedItemUnitConfig && units && units.length > 0 && !editingItemId) {
      const validated = validateQuantityInput(quantityInput, selectedItemUnitConfig, units);
      if (validated !== quantityInput) {
        setQuantityInput(validated);
      }
    }
  }, [units, selectedItemUnitConfig, editingItemId]); // Re-validate when units array is loaded

  // Calculate effective quantity from parsed input (always in BASEUNITS)
  // Also update quantityInput to always display in BASEUNITS format
  // Skip processing if we're editing an item and quantityInput hasn't been set yet
  useEffect(() => {
    if (!selectedItemUnitConfig || !quantityInput) {
      // Don't reset everything if we're in edit mode - wait for quantityInput to be set
      if (editingItemId && !quantityInput) {
        return;
      }
      setItemQuantity(0);
      setEnteredUnitType('base');
      setCustomConversion(null);
      setCustomAddlQty(null);
      setCompoundBaseQty(null);
      setBaseQtyOnly(null);
      return;
    }

    const parsedQty = parseQuantityInput(quantityInput, selectedItemUnitConfig, units);

    // Reset custom conversion only if user explicitly enters a different format
    // Don't reset if:
    // 1. Input is just the base unit display (which happens after onBlur converts custom format to base)
    // 2. The parsed quantity matches the base quantity from custom conversion
    const isJustBaseUnit = parsedQty.uom === 'base' && !parsedQty.isCompound && !parsedQty.isCustomConversion;
    const matchesBaseUnitDisplay = isJustBaseUnit &&
      quantityInput.toLowerCase().includes(selectedItemUnitConfig.BASEUNITS.toLowerCase());

    // Calculate primary quantity first to use for comparison
    const primaryQty = convertToPrimaryQty(parsedQty, selectedItemUnitConfig, customConversion, units);

    // Check if the current quantity matches what would be from custom conversion
    // Use primaryQty instead of parsedQty.qty because parsedQty.qty might be the main quantity
    // (e.g., 10 for "10-2 pkt") while primaryQty is the total (e.g., 10.2)
    const matchesCustomConversion = customConversion &&
      Math.abs(primaryQty - customConversion.baseQty) < 0.0001;

    // Also check if the current input is the base unit display format that was converted from a custom conversion
    // This happens when onBlur converts "10 pkt 2 nos = 2 box" to "10-2 pkt"
    // The hyphen format "10-2 pkt" is parsed as compound, but the quantity (10.2) still matches the custom conversion
    // In this case, we should preserve the custom conversion
    const isBaseUnitDisplayFromCustom = customConversion &&
      matchesCustomConversion &&
      parsedQty.uom === 'base' &&
      (matchesBaseUnitDisplay || parsedQty.isCompound || quantityInput.includes('-'));

    if (!parsedQty.isCustomConversion && customConversion && !matchesBaseUnitDisplay && !matchesCustomConversion && !isBaseUnitDisplayFromCustom) {
      // User changed to a different format (not custom conversion, not base unit display, and doesn't match custom conversion base qty)
      setCustomConversion(null);
      setCustomAddlQty(null);
      setCompoundBaseQty(null);
      setBaseQtyOnly(null);
    }

    // Always display quantity in BASEUNITS format
    // Get decimal places for base unit
    let baseUnitDecimal = 0;
    if (units && units.length > 0) {
      const baseUnit = units.find(u => u.NAME === selectedItemUnitConfig.BASEUNITS);
      if (baseUnit) {
        baseUnitDecimal = typeof baseUnit.DECIMALPLACES === 'string'
          ? parseInt(baseUnit.DECIMALPLACES) || 0
          : (baseUnit.DECIMALPLACES || 0);
      }
    } else if (selectedItemUnitConfig.BASEUNIT_DECIMAL !== undefined) {
      baseUnitDecimal = typeof selectedItemUnitConfig.BASEUNIT_DECIMAL === 'string'
        ? parseInt(selectedItemUnitConfig.BASEUNIT_DECIMAL) || 0
        : (selectedItemUnitConfig.BASEUNIT_DECIMAL || 0);
    }

    // Format the quantity in BASEUNITS
    const formattedQty = baseUnitDecimal === 0
      ? Math.round(primaryQty).toString()
      : primaryQty.toFixed(baseUnitDecimal);

    // Round primaryQty based on base unit's decimal places before setting itemQuantity
    // This ensures amount calculation uses rounded quantity when decimal places are 0
    const roundedPrimaryQty = baseUnitDecimal === 0
      ? Math.round(primaryQty)
      : parseFloat(primaryQty.toFixed(baseUnitDecimal));

    // Note: We don't update quantityInput here to avoid interfering with user typing
    // The conversion to BASEUNITS will happen in the onBlur handler

    console.log('📊 Quantity parsing:', {
      input: quantityInput,
      parsed: parsedQty,
      primaryQty: primaryQty,
      roundedPrimaryQty: roundedPrimaryQty,
      formattedQty: formattedQty,
      baseUnits: selectedItemUnitConfig?.BASEUNITS,
      addlUnits: selectedItemUnitConfig?.ADDITIONALUNITS,
      denominator: selectedItemUnitConfig?.DENOMINATOR,
      conversion: selectedItemUnitConfig?.CONVERSION
    });

    setItemQuantity(roundedPrimaryQty);
    // Track which unit type was entered (for reference, but display will always be base)
    setEnteredUnitType(parsedQty.uom || 'base');

    // Set customAddlQty if parsed quantity has it (e.g., from "9 pkt 2 nos 3 box")
    // IMPORTANT: Only update if parsedQty has customAddlQty, otherwise preserve existing value
    // This ensures that when input is reformatted (e.g., "9-3 pkt"), customAddlQty is not cleared
    if (parsedQty.customAddlQty !== undefined && parsedQty.customAddlQty !== null) {
      setCustomAddlQty(parsedQty.customAddlQty);
    } else if (parsedQty.isCompound && parsedQty.qty !== undefined && parsedQty.subQty !== undefined) {
      // If parsed quantity is a compound base unit (e.g., "9-3 pkt" from "9 pkt 3 nos 2 box"),
      // preserve existing customAddlQty because it represents the additional unit quantity
      // Don't clear it - it will be set correctly in the onBlur handler from originalParsedQty
      // This prevents losing the additional unit quantity when input is reformatted
    } else if (!parsedQty.isCustomConversion && !parsedQty.isCompound && !parsedQty.totalQty && !parsedQty.customAddlQty) {
      // Only clear customAddlQty if:
      // 1. Not a custom conversion
      // 2. Not a compound unit
      // 3. Not a compound with additional unit (which would have totalQty)
      // 4. Parsed quantity doesn't have customAddlQty
      // This prevents clearing customAddlQty when input is reformatted to base unit display
      // (e.g., "9-3 pkt" still needs to preserve the additional unit quantity)
    }

    // Store base quantity separately for base rate calculation
    // When input is "3 box 9 pkt 7 nos", parsedQty.qty = 3 (base quantity only)
    // This is needed for base rate calculation to use only the base part
    if (parsedQty.totalQty !== undefined && parsedQty.totalQty !== null && parsedQty.customAddlQty !== undefined && parsedQty.customAddlQty !== null) {
      // Simple base + compound additional input (e.g., "3 box 9 pkt 7 nos")
      // Store the base quantity (qty) separately
      console.log('🔢 Setting baseQtyOnly:', {
        qty: parsedQty.qty,
        totalQty: parsedQty.totalQty,
        customAddlQty: parsedQty.customAddlQty,
        input: quantityInput
      });
      setBaseQtyOnly(parsedQty.qty);
    } else if (parsedQty.qty !== undefined && !parsedQty.isCompound && !parsedQty.totalQty) {
      // Simple base unit input without additional units
      setBaseQtyOnly(parsedQty.qty);
    } else if (compoundAddlQty !== null && compoundAddlQty !== undefined && parsedQty.qty !== undefined && parsedQty.uom === 'base') {
      // Input was reformatted (e.g., "3 box" from "3 box 9 pkt 7 nos")
      // We have compoundAddlQty, so this is a base + compound additional input
      // Preserve baseQtyOnly using parsedQty.qty (the base quantity)
      console.log('🔢 Preserving baseQtyOnly from reformatted input:', {
        qty: parsedQty.qty,
        compoundAddlQty,
        input: quantityInput
      });
      setBaseQtyOnly(parsedQty.qty);
    } else {
      // Only clear if we're sure there's no base + additional input
      // Check if the input is truly just a base unit without any additional unit parts
      const isSimpleBaseOnly = parsedQty.uom === 'base' &&
        !parsedQty.isCompound &&
        !parsedQty.isCustomConversion &&
        !parsedQty.customAddlQty &&
        !parsedQty.totalQty;
      if (isSimpleBaseOnly && !quantityInput.toLowerCase().includes('pkt') && !quantityInput.toLowerCase().includes('nos')) {
        setBaseQtyOnly(null);
      }
      // Otherwise, preserve existing baseQtyOnly (don't clear it)
    }

    // Store compound base unit quantity separately for amount calculation
    // This is needed when rate is in component units (pkt or nos) - we only use the compound base part
    if (parsedQty.isCompound && parsedQty.qty !== undefined && parsedQty.subQty !== undefined && units && units.length > 0) {
      const baseUnitObj = units.find(u => u.NAME === selectedItemUnitConfig.BASEUNITS);
      if (baseUnitObj && baseUnitObj.ISSIMPLEUNIT === 'No') {
        const baseConversion = parseFloat(baseUnitObj.CONVERSION) || 1;
        const compoundQty = (parsedQty.qty || 0) + ((parsedQty.subQty || 0) / baseConversion);
        setCompoundBaseQty(compoundQty);
      } else {

        setCompoundBaseQty(null);
      }
    } else if (parsedQty.isCompound && parsedQty.totalQty !== undefined && parsedQty.totalQty !== null && customAddlQty !== null && customAddlQty !== undefined && units && units.length > 0) {
      // If we have totalQty and customAddlQty, calculate compound base part by subtracting additional part
      // This handles the case when input is reformatted (e.g., "5-3 pkt" from "5 pkt 3 nos 2 box")
      // We need to extract the compound base part from the total
      const baseUnitObj2 = units.find(u => u.NAME === selectedItemUnitConfig.BASEUNITS);
      if (baseUnitObj2 && baseUnitObj2.ISSIMPLEUNIT === 'No' && selectedItemUnitConfig.ADDITIONALUNITS) {
        const denominator = parseFloat(selectedItemUnitConfig.DENOMINATOR) || 1;
        const conversion = parseFloat(selectedItemUnitConfig.CONVERSION) || 1;
        const baseConversion = parseFloat(baseUnitObj2.CONVERSION) || 1;
        const effectiveDenominator = denominator / baseConversion;
        // Convert additional unit quantity to base units
        const addlQtyInBase = (customAddlQty * effectiveDenominator) / conversion;
        // Compound base part = total - additional part
        const compoundQty = parsedQty.totalQty - addlQtyInBase;
        setCompoundBaseQty(compoundQty);
      } else {

        setCompoundBaseQty(null);
      }
    } else {
      setCompoundBaseQty(null);
      setBaseQtyOnly(null);
    }

    // Store compound additional unit quantity separately for amount calculation
    // This is needed when BASEUNITS is simple and ADDITIONALUNITS is compound
    // For "2 box 25 pkt 7 nos": store 25.7 pkt separately
    // Also handle when user enters component unit of compound additional unit (e.g., "55 nos")
    if (parsedQty.customAddlQty !== undefined && parsedQty.customAddlQty !== null && units && units.length > 0) {
      const addlUnitObj = units.find(u => u.NAME === selectedItemUnitConfig.ADDITIONALUNITS);
      if (addlUnitObj && addlUnitObj.ISSIMPLEUNIT === 'No') {
        // ADDITIONALUNITS is compound - store the compound additional quantity
        // customAddlQty is already in compound units (e.g., 25.7 "pkt of 10 nos")
        console.log('🔢 Setting compoundAddlQty:', {
          customAddlQty: parsedQty.customAddlQty,
          input: quantityInput,
          parsedQty: parsedQty
        });
        setCompoundAddlQty(parsedQty.customAddlQty);
      } else {
        setCompoundAddlQty(null);
      }
    } else if (parsedQty.compoundAddlQty !== undefined && parsedQty.compoundAddlQty !== null && units && units.length > 0) {
      // User entered component unit of compound additional unit (e.g., "55 nos")
      // Store the compound additional quantity for alternative quantity display
      const addlUnitObj = units.find(u => u.NAME === selectedItemUnitConfig.ADDITIONALUNITS);
      if (addlUnitObj && addlUnitObj.ISSIMPLEUNIT === 'No') {
        console.log('🔢 Setting compoundAddlQty from component unit input:', {
          compoundAddlQty: parsedQty.compoundAddlQty,
          compoundAddlMainQty: parsedQty.compoundAddlMainQty,
          compoundAddlSubQty: parsedQty.compoundAddlSubQty,
          input: quantityInput
        });
        setCompoundAddlQty(parsedQty.compoundAddlQty);
        // Store the main and sub quantities for display in customAddlQty format
        // The display logic will format it as "2-5 pkt" using compoundAddlMainQty and compoundAddlSubQty
        if (parsedQty.compoundAddlMainQty !== undefined && parsedQty.compoundAddlSubQty !== undefined) {
          // Store in a way that can be used for display
          // The alternative quantity display will use compoundAddlQty and format it correctly
        }
      } else {
        setCompoundAddlQty(null);
      }
    } else if (customAddlQty !== null && customAddlQty !== undefined && units && units.length > 0) {
      // Fallback: If parsedQty doesn't have customAddlQty but customAddlQty state exists,
      // and ADDITIONALUNITS is compound, use customAddlQty to set compoundAddlQty
      // This handles cases where parsedQty.customAddlQty is not set but customAddlQty state has the value
      const addlUnitObj = units.find(u => u.NAME === selectedItemUnitConfig.ADDITIONALUNITS);
      if (addlUnitObj && addlUnitObj.ISSIMPLEUNIT === 'No') {
        console.log('🔢 Setting compoundAddlQty from customAddlQty state:', {
          customAddlQty,
          input: quantityInput
        });
        setCompoundAddlQty(customAddlQty);
      }
    } else {
      // Only clear if we're sure there's no compound additional quantity
      // IMPORTANT: If compoundAddlQty exists in state, preserve it even if parsedQty doesn't have it
      // This ensures "25 pkt" -> "3 box" still shows "(25-0 pkt)" instead of recalculating
      // The parsedQty for "3 box" won't have compoundAddlQty, but we should preserve it from state
      if (compoundAddlQty !== null && compoundAddlQty !== undefined) {
        // compoundAddlQty exists in state (user entered component unit like "25 pkt")
        // Preserve it even if parsedQty doesn't have it (input was reformatted to base unit)
        console.log('🔢 Preserving compoundAddlQty from state (input reformatted):', {
          compoundAddlQty,
          parsedQty: {
            uom: parsedQty.uom,
            isCompound: parsedQty.isCompound,
            isComponentUnit: parsedQty.isComponentUnit,
            totalQty: parsedQty.totalQty,
            customAddlQty: parsedQty.customAddlQty
          },
          input: quantityInput
        });
        // Don't clear it - preserve existing compoundAddlQty
        return; // Exit early to preserve compoundAddlQty
      }

      // Only clear if compoundAddlQty doesn't exist in state
      // Preserve existing compoundAddlQty if parsedQty has totalQty (which indicates compound additional was present)
      // This happens when input is reformatted (e.g., "3 box" from "3 box 9 pkt 7 nos")
      // Also preserve if parsedQty has isComponentUnit (user entered component unit like "25 pkt" or "55 nos")
      if (!parsedQty.totalQty && !parsedQty.isComponentUnit) {
        // Only clear if there's no indication that compound additional quantity exists
        // Check if we have a simple base unit input without any additional unit parts
        const isSimpleBaseOnly = parsedQty.uom === 'base' &&
          !parsedQty.isCompound &&
          !parsedQty.isCustomConversion &&
          !parsedQty.customAddlQty &&
          !parsedQty.isComponentUnit;
        // Also check if the input string doesn't contain the compound additional unit components
        // For "3 box 9 pkt 7 nos", even after reformatting to "3 box", we should preserve compoundAddlQty
        // Only clear if the input is truly just a base unit (e.g., "3 box" entered directly, not from reformatting)
        if (isSimpleBaseOnly && !quantityInput.toLowerCase().includes('pkt') && !quantityInput.toLowerCase().includes('nos')) {
          // Only clear if compoundAddlQty is null (user didn't enter component unit)
          setCompoundAddlQty(null);
        }
        // Otherwise, preserve existing compoundAddlQty (don't clear it)
      } else {
        // If parsedQty has totalQty or isComponentUnit, it means compound additional was present
        // Preserve compoundAddlQty even if customAddlQty is not in current parsedQty
        // (This happens when input is reformatted but we still need the compound additional quantity for calculations)
      }
    }
  }, [quantityInput, selectedItemUnitConfig, units, customConversion]);

  // Auto-calculate amount whenever quantity, rate, or discount changes
  // Handle different UOMs for quantity and rate
  useEffect(() => {
    if (!selectedItemUnitConfig || itemQuantity === 0 || itemRate === 0) {
      setItemAmount(0);
      return;
    }

    // Debug log to check itemQuantity
    console.log('💰 Amount calculation:', {
      itemQuantity,
      itemRate,
      rateUOM,
      customConversion,
      compoundAddlQty,
      compoundBaseQty,
      customAddlQty,
      selectedItem: selectedItemUnitConfig?.NAME,
      baseUnits: selectedItemUnitConfig?.BASEUNITS,
      addlUnits: selectedItemUnitConfig?.ADDITIONALUNITS,
      conversion: selectedItemUnitConfig?.CONVERSION,
      denominator: selectedItemUnitConfig?.DENOMINATOR
    });

    // Quantity is always in primary UOM (base units) after conversion
    // For amount calculation: convert quantity to rate's UOM, then multiply by rate
    let quantityInRateUOM = itemQuantity;
    let calculatedAmount = 0;

    // Check if BASEUNITS is compound and rate is in component unit
    const baseUnitObj = units && units.length > 0
      ? units.find(u => u.NAME === selectedItemUnitConfig.BASEUNITS)
      : null;
    const hasCompoundBaseUnit = baseUnitObj && baseUnitObj.ISSIMPLEUNIT === 'No';

    // Check if ADDITIONALUNITS is compound
    const addlUnitObj = units && units.length > 0 && selectedItemUnitConfig.ADDITIONALUNITS
      ? units.find(u => u.NAME === selectedItemUnitConfig.ADDITIONALUNITS)
      : null;
    const hasCompoundAddlUnit = addlUnitObj && addlUnitObj.ISSIMPLEUNIT === 'No';

    if ((rateUOM === 'component-main' || (rateUOM === 'base' && hasCompoundBaseUnit)) && hasCompoundBaseUnit && baseUnitObj) {
      // Rate is in main component unit (e.g., "pkt" when BASEUNITS is "pkt of 10 nos")
      // Or rate is in base unit but BASEUNITS is compound, so treat as component-main
      // For "5 pkt 3 nos 2 box" with rate = 10/pkt:
      // - Use ONLY compound base part: 5 pkt 3 nos = 5.3 pkt
      // - Amount = 5.3 pkt × 10/pkt = 53
      // Use compoundBaseQty if available (from compound base part only), otherwise use itemQuantity
      if (compoundBaseQty !== null && compoundBaseQty !== undefined) {
        quantityInRateUOM = compoundBaseQty;
      } else {

        quantityInRateUOM = itemQuantity;
      }
    } else if (rateUOM === 'component-sub' && hasCompoundBaseUnit && baseUnitObj) {
      // Rate is in sub component unit (e.g., "nos" when BASEUNITS is "pkt of 10 nos")
      // For "5 pkt 3 nos 2 box" with rate = 10/nos:
      // - Use ONLY compound base part: 5 pkt = 50 nos, + 3 nos = 53 nos
      // - Amount = 53 nos × 10/nos = 530
      // Convert compound base part to sub component unit
      const conversion = parseFloat(baseUnitObj.CONVERSION) || 1;
      if (compoundBaseQty !== null && compoundBaseQty !== undefined) {
        // Convert compound base quantity to sub component: compoundQty * conversion
        // Example: 5.3 pkt × 10 = 53 nos
        quantityInRateUOM = compoundBaseQty * conversion;
      } else {
        // Fallback: use itemQuantity (includes everything)
        quantityInRateUOM = itemQuantity * conversion;
      }
    } else if (rateUOM === 'additional-component-main' && hasCompoundAddlUnit && addlUnitObj) {
      // Rate is in main component of compound additional unit (e.g., "pkt" when ADDITIONALUNITS is "pkt of 10 nos")
      // For "2 box 25 pkt 7 nos" with rate = 10/pkt:
      // - Use ONLY compound additional part: 25 pkt 7 nos = 25.7 pkt
      // - Amount = 25.7 pkt × 10/pkt = 257
      const addlCompoundConversion = parseFloat(addlUnitObj.CONVERSION) || 1;

      if (compoundAddlQty !== null && compoundAddlQty !== undefined && !hasCompoundBaseUnit) {
        // BASEUNITS is simple, ADDITIONALUNITS is compound
        // Use compound additional quantity directly (already in compound units, e.g., 9.7 pkt)
        console.log('💰 Using compoundAddlQty for additional-component-main:', {
          compoundAddlQty,
          rateUOM,
          hasCompoundBaseUnit
        });
        quantityInRateUOM = compoundAddlQty;
      } else {
        // Fallback: use customAddlQty if available (when compoundAddlQty not set but customAddlQty exists)
        // This handles cases where compoundAddlQty wasn't set correctly but customAddlQty has the compound additional quantity
        if (customAddlQty !== null && customAddlQty !== undefined && !hasCompoundBaseUnit) {
          // customAddlQty should be in compound units (e.g., 9.7 pkt)
          // Use it directly
          console.log('💰 Using customAddlQty as fallback for additional-component-main:', {
            customAddlQty,
            rateUOM
          });
          quantityInRateUOM = customAddlQty;
        } else {
          // Final fallback: convert from itemQuantity (when neither compoundAddlQty nor customAddlQty available)
          let conversion;
          if (customConversion) {
            // For custom conversion: baseQty BASEUNITS = addlQty ADDITIONALUNITS
            // Convert baseQty box to addlQty "pkt of 10 nos" = addlQty * 10 nos
            // So: 1 box = (addlQty * 10) / baseQty nos
            const baseQty = parseFloat(customConversion.baseQty) || 1;
            const addlQty = parseFloat(customConversion.addlQty) || 1;
            const totalNos = addlQty * addlCompoundConversion;
            conversion = totalNos / baseQty;
          } else {
            // Use default conversion from item's CONVERSION field (in nos)
            conversion = parseFloat(selectedItemUnitConfig.CONVERSION) || 1;
          }

          // Convert quantity from box to nos, then to pkt
          const quantityInNos = itemQuantity * conversion;
          quantityInRateUOM = quantityInNos / addlCompoundConversion;
        }
      }
    } else if (rateUOM === 'additional-component-sub' && hasCompoundAddlUnit && addlUnitObj) {
      // Rate is in sub component of compound additional unit (e.g., "nos" when ADDITIONALUNITS is "pkt of 10 nos")
      // For "2 box 25 pkt 7 nos" with rate = 10/nos:
      // - Use ONLY compound additional part: 25 pkt = 250 nos, + 7 nos = 257 nos
      // - Amount = 257 nos × 10/nos = 2570
      const addlCompoundConversion = parseFloat(addlUnitObj.CONVERSION) || 1;

      if (compoundAddlQty !== null && compoundAddlQty !== undefined && !hasCompoundBaseUnit) {
        // BASEUNITS is simple, ADDITIONALUNITS is compound
        // Convert compound additional quantity to sub component: compoundAddlQty * conversion
        // Example: 9.7 pkt × 10 = 97 nos
        console.log('💰 Using compoundAddlQty for additional-component-sub:', {
          compoundAddlQty,
          addlCompoundConversion,
          quantityInRateUOM: compoundAddlQty * addlCompoundConversion,
          rateUOM,
          hasCompoundBaseUnit
        });
        quantityInRateUOM = compoundAddlQty * addlCompoundConversion;
      } else {
        // Fallback: use customAddlQty if available (when compoundAddlQty not set but customAddlQty exists)
        // This handles cases where compoundAddlQty wasn't set correctly but customAddlQty has the compound additional quantity
        if (customAddlQty !== null && customAddlQty !== undefined && !hasCompoundBaseUnit) {
          // customAddlQty should be in compound units (e.g., 9.7 pkt)
          // Convert to sub component: customAddlQty * addlCompoundConversion
          console.log('💰 Using customAddlQty as fallback for additional-component-sub:', {
            customAddlQty,
            addlCompoundConversion,
            quantityInRateUOM: customAddlQty * addlCompoundConversion
          });
          quantityInRateUOM = customAddlQty * addlCompoundConversion;
        } else {
          // Final fallback: convert from itemQuantity (when neither compoundAddlQty nor customAddlQty available)
          let conversion;
          if (customConversion) {
            // For custom conversion: baseQty BASEUNITS = addlQty ADDITIONALUNITS
            // Convert baseQty box to addlQty "pkt of 10 nos" = addlQty * 10 nos
            // So: 1 box = (addlQty * 10) / baseQty nos
            const addlQty = parseFloat(customConversion.addlQty) || 1;
            const baseQty = parseFloat(customConversion.baseQty) || 1;
            const totalNos = addlQty * addlCompoundConversion;
            conversion = totalNos / baseQty;
          } else {
            // Use default conversion from item's CONVERSION field (in nos)
            conversion = parseFloat(selectedItemUnitConfig.CONVERSION) || 1;
          }

          // Convert quantity from box to nos
          quantityInRateUOM = itemQuantity * conversion;
        }
      }
    } else if (rateUOM === 'additional' && selectedItemUnitConfig.ADDITIONALUNITS) {
      // Rate is in additional unit (simple or compound)
      // For "5 pkt 3 nos 2 box" with rate = 10/box:
      // - Use ONLY additional part: 2 box
      // - Amount = 2 box × 10/box = 20
      // Use customAddlQty if available (from additional unit part only), otherwise convert from itemQuantity
      if (customAddlQty !== null && customAddlQty !== undefined && hasCompoundBaseUnit) {
        // We have the additional unit quantity directly (e.g., 2 box)
        // Use it directly for calculation
        quantityInRateUOM = customAddlQty;
      } else {
        // Fallback: convert from itemQuantity (when no separate additional part)
        // Quantity is in BASEUNITS, rate is per ADDITIONALUNITS
        // Convert quantity from BASEUNITS to ADDITIONALUNITS, then multiply by rate
        //
        // Formula: DENOMINATOR BASEUNITS = CONVERSION ADDITIONALUNITS
        // So: quantity_in_additional = quantity_in_base * (CONVERSION / DENOMINATOR)
        let denominator, conversion;
        if (customConversion) {
          // Custom conversion: baseQty BASEUNITS = addlQty ADDITIONALUNITS
          // So: 1 BASEUNIT = (addlQty / baseQty) ADDITIONALUNITS
          // Therefore: quantity_in_additional = quantity_in_base * (addlQty / baseQty)
          const baseQty = parseFloat(customConversion.baseQty) || 1;
          const addlQty = parseFloat(customConversion.addlQty) || 1;
          denominator = baseQty;
          conversion = addlQty;
        } else {
          // Use default conversion from unitConfig
          denominator = parseFloat(selectedItemUnitConfig.DENOMINATOR) || 1;
          conversion = parseFloat(selectedItemUnitConfig.CONVERSION) || 1;
        }

        // Check if BASEUNITS is compound - if so, DENOMINATOR is in terms of sub-component unit
        let effectiveDenominator = denominator;
        if (hasCompoundBaseUnit && baseUnitObj && baseUnitObj.CONVERSION && !customConversion) {
          // BASEUNITS is compound - DENOMINATOR is in sub-component units (nos)
          // Convert to compound units: DENOMINATOR / compound_CONVERSION
          // Example: DENOMINATOR = 100 nos, compound_CONVERSION = 10 (1 pkt = 10 nos)
          // effectiveDenominator = 100 / 10 = 10 "pkt of 10 nos"
          const compoundConversion = parseFloat(baseUnitObj.CONVERSION) || 1;
          effectiveDenominator = denominator / compoundConversion;
        }

        // Convert quantity from base units to additional units
        // Formula: effectiveDenominator BASEUNITS = conversion ADDITIONALUNITS
        // So: quantity_in_additional = quantity_in_base * (conversion / effectiveDenominator)
        let quantityInAddlUnits = itemQuantity * (conversion / effectiveDenominator);

        // Round the additional unit quantity based on its decimal places
        // This ensures the calculation matches what's displayed in the alternate quantity
        if (units && units.length > 0 && selectedItemUnitConfig.ADDITIONALUNITS) {
          const addlUnitObj = units.find(u => u.NAME === selectedItemUnitConfig.ADDITIONALUNITS);
          if (addlUnitObj) {
            const addlDecimalPlaces = typeof addlUnitObj.DECIMALPLACES === 'string'
              ? parseInt(addlUnitObj.DECIMALPLACES) || 0
              : (addlUnitObj.DECIMALPLACES || 0);
            // Round the additional unit quantity based on its decimal places
            if (addlDecimalPlaces === 0) {
              quantityInAddlUnits = Math.round(quantityInAddlUnits);
            } else {

              quantityInAddlUnits = parseFloat(quantityInAddlUnits.toFixed(addlDecimalPlaces));
            }
          }
        }

        quantityInRateUOM = quantityInAddlUnits;
      }
    } else if (rateUOM === 'base' && !hasCompoundBaseUnit) {
      // Rate is in base unit (simple base unit case)
      // For "3 box 9 pkt 7 nos" with rate = 10/box:
      // - Use ONLY base part: 3 box
      // - Amount = 3 box × 10/box = 30
      // When BASEUNITS is simple and ADDITIONALUNITS is compound, use only the base quantity
      if (hasCompoundAddlUnit && baseQtyOnly !== null && baseQtyOnly !== undefined) {
        // Use the stored base quantity directly (e.g., 3 box from "3 box 9 pkt 7 nos")
        console.log('💰 Using baseQtyOnly for base rate:', {
          baseQtyOnly,
          itemQuantity,
          rateUOM
        });
        quantityInRateUOM = baseQtyOnly;
      } else if (hasCompoundAddlUnit && compoundAddlQty !== null && compoundAddlQty !== undefined) {
        // Fallback: When baseQtyOnly is not available, use itemQuantity directly
        // itemQuantity should already be the base quantity when input is just "2 box"
        // The issue is that itemQuantity might be the total, so we need to check
        // Actually, for "2 box" input, itemQuantity should be 2 (the base quantity)
        // So we should use itemQuantity directly, not subtract the additional part
        console.log('💰 Fallback: Using itemQuantity for base rate (baseQtyOnly not available):', {
          itemQuantity,
          compoundAddlQty,
          rateUOM,
          baseQtyOnly
        });
        // For simple base unit input like "2 box", itemQuantity is already the base quantity
        // Don't subtract the additional part - that would be wrong
        quantityInRateUOM = itemQuantity;
      } else {
        quantityInRateUOM = itemQuantity;
      }
    } else {
      // Rate is in base unit (default case - should not reach here if compound base unit, as it's handled above)
      quantityInRateUOM = itemQuantity;
    }

    // Calculate amount: quantity in rate's UOM * rate
    calculatedAmount = quantityInRateUOM * itemRate * (1 - (itemDiscountPercent || 0) / 100);

    // Debug log for final amount calculation
    console.log('💰 Final amount calculation:', {
      itemQuantity,
      quantityInRateUOM,
      itemRate,
      calculatedAmount,
      rateUOM,
      compoundBaseQty,
      compoundAddlQty,
      customAddlQty,
      baseQtyOnly,
      hasCompoundAddlUnit
    });

    setItemAmount(calculatedAmount);

  }, [itemQuantity, itemRate, itemDiscountPercent, rateUOM, selectedItemUnitConfig, units, customConversion, compoundBaseQty, compoundAddlQty, customAddlQty, baseQtyOnly]);


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

    borderRadius: isMobile ? '16px' : '12px',

    padding: isMobile ? '16px' : '24px',

    maxWidth: isMobile ? '95%' : '500px',

    width: isMobile ? '95%' : '90%',

    maxHeight: isMobile ? '90vh' : '80vh',

    overflow: 'auto',

    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',

  };



  const modalHeaderStyle = {

    display: 'flex',

    justifyContent: 'space-between',

    alignItems: 'center',

    marginBottom: isMobile ? '16px' : '20px',

    paddingBottom: isMobile ? '12px' : '16px',

    borderBottom: '2px solid #3b82f6',

  };



  const modalTitleStyle = {

    margin: 0,

    color: '#1f2937',

    fontSize: isMobile ? '18px' : '20px',

    fontWeight: '600',

  };



  const closeButtonStyle = {

    background: 'none',

    border: 'none',

    fontSize: isMobile ? '22px' : '24px',

    cursor: 'pointer',

    color: '#6b7280',

    padding: isMobile ? '6px' : '4px',

    borderRadius: '4px',

    transition: 'color 0.2s',

  };



  const formGroupStyle = {

    marginBottom: isMobile ? '16px' : '20px',

  };



  const labelStyle = {

    display: 'block',

    marginBottom: isMobile ? '6px' : '8px',

    fontWeight: '600',

    color: '#374151',

    fontSize: isMobile ? '13px' : '14px',

  };



  const inputStyle = {

    width: '100%',

    padding: isMobile ? '12px 14px' : '12px',

    border: '1px solid #d1d5db',

    borderRadius: isMobile ? '10px' : '8px',

    fontSize: isMobile ? '15px' : '14px',

    boxSizing: 'border-box',

    transition: 'border-color 0.2s',

  };



  const textareaStyle = {

    ...inputStyle,

    minHeight: isMobile ? '100px' : '80px',

    resize: 'vertical',

    height: 'auto',

    padding: isMobile ? '12px 14px' : '12px',

  };



  const readonlyInputStyle = {

    ...inputStyle,

    backgroundColor: '#f9fafb',

    color: '#6b7280',

  };



  const buttonGroupStyle = {

    display: 'flex',

    gap: isMobile ? '10px' : '12px',

    justifyContent: 'flex-end',

    marginTop: isMobile ? '20px' : '24px',

    flexDirection: isMobile ? 'column-reverse' : 'row',

  };



  const buttonStyle = {

    padding: isMobile ? '14px 20px' : '12px 24px',

    border: 'none',

    borderRadius: isMobile ? '10px' : '8px',

    fontSize: isMobile ? '15px' : '14px',

    fontWeight: '600',

    cursor: 'pointer',

    transition: 'all 0.2s',

    width: isMobile ? '100%' : 'auto',

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



      // Find the selected voucher type to get PREFIX and SUFFIX, ISOUTENTRY, PERSISTEDVIEW

      const selectedVoucherTypeObj = voucherTypes.find(vt => vt.NAME === selectedVoucherType);

      const voucherNumber = selectedVoucherTypeObj

        ? `${selectedVoucherTypeObj.PREFIX}${timestamp}${selectedVoucherTypeObj.SUFFIX}`

        : '';

      // Get selected class object to access LEDGERFORINVENTORYLIST

      const selectedClassObj = selectedVoucherTypeObj && selectedVoucherTypeObj.VOUCHERCLASSLIST

        ? selectedVoucherTypeObj.VOUCHERCLASSLIST.find(cls => cls.CLASSNAME === selectedClassName)

        : null;

      // Get ledger name for inventory items from LEDGERFORINVENTORYLIST

      const inventoryLedgerName = selectedClassObj && selectedClassObj.LEDGERFORINVENTORYLIST && selectedClassObj.LEDGERFORINVENTORYLIST.length > 0

        ? selectedClassObj.LEDGERFORINVENTORYLIST[0].NAME

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

        ...(selectedVoucherTypeObj?.ISOUTENTRY && { isoutentry: selectedVoucherTypeObj.ISOUTENTRY }),

        ...(selectedVoucherTypeObj?.PERSISTEDVIEW && { persistedview: selectedVoucherTypeObj.PERSISTEDVIEW }),

        ...(selectedClassName && { classname: selectedClassName }),

        vouchernumber: voucherNumber,

        items: orderItems.map(item => {
          // Format quantity string
          let qtyString = '';
          if (item.quantityDisplay) {
            // Use the stored display string (e.g., "10 box", "2-500.000 LTR", "10 box = 22 nos")
            qtyString = item.quantityDisplay;
          } else if (item.unitConfig && item.unitConfig.BASEUNITS) {
            // Fallback: format quantity with unit
            const baseUnitDecimal = item.unitConfig.BASEUNIT_DECIMAL || 0;
            const formattedQty = baseUnitDecimal === 0
              ? Math.round(item.quantity).toString()
              : item.quantity.toFixed(baseUnitDecimal);
            qtyString = `${formattedQty} ${item.unitConfig.BASEUNITS}`;
          } else {
            qtyString = item.quantity.toString();
          }


          // Append alternative quantity for:
          // 1. Simple base + simple additional units
          // 2. Compound base + simple additional units
          // 3. Simple base + compound additional units
          if (item.unitConfig && item.unitConfig.BASEUNITS && item.unitConfig.ADDITIONALUNITS) {
            const baseUnitObj = units && units.length > 0
              ? units.find(u => u.NAME === item.unitConfig.BASEUNITS)
              : null;
            const addlUnitObj = units && units.length > 0
              ? units.find(u => u.NAME === item.unitConfig.ADDITIONALUNITS)
              : null;

            const hasSimpleBaseUnit = !baseUnitObj || baseUnitObj.ISSIMPLEUNIT === 'Yes';
            const hasCompoundBaseUnit = baseUnitObj && baseUnitObj.ISSIMPLEUNIT === 'No';
            const hasSimpleAddlUnit = !addlUnitObj || addlUnitObj.ISSIMPLEUNIT === 'Yes';
            const hasCompoundAddlUnit = addlUnitObj && addlUnitObj.ISSIMPLEUNIT === 'No';

            // Append alternative quantity if:
            // 1. Both units are simple, OR
            // 2. Base unit is compound and additional unit is simple, OR
            // 3. Base unit is simple and additional unit is compound
            if ((hasSimpleBaseUnit && hasSimpleAddlUnit) ||
              (hasCompoundBaseUnit && hasSimpleAddlUnit) ||
              (hasSimpleBaseUnit && hasCompoundAddlUnit)) {
              // Check if qtyString already contains "=" (custom conversion format)
              if (!qtyString.includes('=')) {
                // Use stored altQtyDisplay if available
                if (item.altQtyDisplay) {
                  // Extract just the quantity and unit from altQtyDisplay (remove parentheses if present)
                  const altQtyStr = item.altQtyDisplay.replace(/[()]/g, '').trim();
                  qtyString = `${qtyString} = ${altQtyStr}`;
                } else {
                  // Calculate alternative quantity
                  const altQty = convertToAlternativeQty(item.quantity, item.unitConfig, units, item.customConversion);
                  if (altQty) {
                    // If additional unit is compound, format as hyphenated
                    if (hasCompoundAddlUnit && addlUnitObj) {
                      const addlConversion = parseFloat(addlUnitObj.CONVERSION) || 1;
                      const qtyNum = parseFloat(altQty.qty) || 0;
                      const mainQty = Math.floor(qtyNum);
                      const subQty = (qtyNum - mainQty) * addlConversion;
                      let subDecimalPlaces = 0;
                      if (addlUnitObj.ADDITIONALUNITS) {
                        const subUnitObj = units.find(u => u.NAME === addlUnitObj.ADDITIONALUNITS);
                        if (subUnitObj) {
                          subDecimalPlaces = typeof subUnitObj.DECIMALPLACES === 'string'
                            ? parseInt(subUnitObj.DECIMALPLACES) || 0
                            : (subUnitObj.DECIMALPLACES || 0);
                        }
                      }
                      const formattedSubQty = subDecimalPlaces === 0
                        ? Math.round(subQty).toString()
                        : subQty.toFixed(subDecimalPlaces);
                      const displayUnit = addlUnitObj.BASEUNITS || item.unitConfig.ADDITIONALUNITS;
                      qtyString = `${qtyString} = ${mainQty}-${formattedSubQty} ${displayUnit}`;
                    } else {
                      // Simple additional unit - format with proper decimal places
                      let addlDecimalPlaces = 0;
                      if (addlUnitObj) {
                        addlDecimalPlaces = typeof addlUnitObj.DECIMALPLACES === 'string'
                          ? parseInt(addlUnitObj.DECIMALPLACES) || 0
                          : (addlUnitObj.DECIMALPLACES || 0);
                      }
                      const formattedAltQty = addlDecimalPlaces === 0
                        ? Math.round(parseFloat(altQty.qty)).toString()
                        : parseFloat(altQty.qty).toFixed(addlDecimalPlaces);
                      qtyString = `${qtyString} = ${formattedAltQty} ${altQty.unit}`;
                    }
                  }
                }
              }
            }
          }

          // Format rate with unit
          let rateString = '';
          if (item.rateUOM && item.unitConfig) {
            const baseUnitObj = units && units.length > 0
              ? units.find(u => u.NAME === item.unitConfig.BASEUNITS)
              : null;
            const hasCompoundBaseUnit = baseUnitObj && baseUnitObj.ISSIMPLEUNIT === 'No';

            const addlUnitObj = units && units.length > 0 && item.unitConfig.ADDITIONALUNITS
              ? units.find(u => u.NAME === item.unitConfig.ADDITIONALUNITS)
              : null;
            const hasCompoundAddlUnit = addlUnitObj && addlUnitObj.ISSIMPLEUNIT === 'No';

            let rateUnit = '';
            if (hasCompoundBaseUnit && baseUnitObj) {
              if (item.rateUOM === 'component-main') {
                rateUnit = baseUnitObj.BASEUNITS;
              } else if (item.rateUOM === 'component-sub') {
                rateUnit = baseUnitObj.ADDITIONALUNITS;
              }
            } else if (hasCompoundAddlUnit && addlUnitObj) {
              if (item.rateUOM === 'additional-component-main') {
                rateUnit = addlUnitObj.BASEUNITS;
              } else if (item.rateUOM === 'additional-component-sub') {
                rateUnit = addlUnitObj.ADDITIONALUNITS;
              }
            } else if (item.rateUOM === 'base') {
              rateUnit = item.unitConfig.BASEUNITS || '';
            } else if (item.rateUOM === 'additional') {
              rateUnit = item.unitConfig.ADDITIONALUNITS || '';
            }

            if (rateUnit) {
              rateString = `${item.rate.toFixed(2)}/${rateUnit}`;
            } else {
              rateString = item.rate.toString();
            }
          } else {
            rateString = item.rate.toString();
          }

          // Build payload item
          const payloadItem = {
            item: item.name,
            ...(inventoryLedgerName && { ledgername: inventoryLedgerName }),
            qty: qtyString, // Always base quantity display
            rate: rateString,
            discount: item.discountPercent || 0,
            gst: item.gstPercent || 0,
            amount: Math.round(parseFloat(item.amount || 0) * 100) / 100,
            description: item.description || ''
          };

          // Add aqty if rate is in alternative unit (or component of alternative unit)
          /*if (item.rateUOM === 'additional' || item.rateUOM === 'additional-component-main' || item.rateUOM === 'additional-component-sub') {
            if (item.altQtyDisplay) {
              // Use stored alternative quantity display
              payloadItem.aqty = item.altQtyDisplay;
            } else if (item.unitConfig && item.unitConfig.ADDITIONALUNITS) {
              // Calculate alternative quantity if not stored
              const altQty = convertToAlternativeQty(item.quantity, item.unitConfig, units, item.customConversion);
              if (altQty) {
                // Format based on whether it's compound or simple
                const addlUnitObj = units && units.length > 0
                  ? units.find(u => u.NAME === item.unitConfig.ADDITIONALUNITS)
                  : null;
                const hasCompoundAddlUnit = addlUnitObj && addlUnitObj.ISSIMPLEUNIT === 'No';
                
                if (hasCompoundAddlUnit && addlUnitObj) {
                  // Format as hyphenated (e.g., "3-0 pkt")
                  const addlConversion = parseFloat(addlUnitObj.CONVERSION) || 1;
                  const qtyNum = parseFloat(altQty.qty) || 0;
                  const mainQty = Math.floor(qtyNum);
                  const subQty = (qtyNum - mainQty) * addlConversion;
                  let subDecimalPlaces = 0;
                  if (addlUnitObj.ADDITIONALUNITS) {
                    const subUnitObj = units.find(u => u.NAME === addlUnitObj.ADDITIONALUNITS);
                    if (subUnitObj) {
                      subDecimalPlaces = typeof subUnitObj.DECIMALPLACES === 'string' 
                        ? parseInt(subUnitObj.DECIMALPLACES) || 0
                        : (subUnitObj.DECIMALPLACES || 0);
                    }
                  }
                  const formattedSubQty = subDecimalPlaces === 0 
                    ? Math.round(subQty).toString()
                    : subQty.toFixed(subDecimalPlaces);
                  const displayUnit = addlUnitObj.BASEUNITS || item.unitConfig.ADDITIONALUNITS;
                  payloadItem.aqty = `${mainQty}-${formattedSubQty} ${displayUnit}`;
                } else {
                  // Simple alternative unit
                  payloadItem.aqty = `${altQty.qty} ${altQty.unit}`;
                }
              }
            }
          }*/

          return payloadItem;
        }),

        // Build ledgers array with all ledger entries that have values (use pre-calculated values)
        ledgers: (() => {
          const ledgersArray = [];

          // Use the pre-calculated ledger amounts from useMemo
          selectedClassLedgers.forEach(ledger => {
            const ledgerAmount = calculatedLedgerAmounts.ledgerAmounts[ledger.NAME] || 0;

            // Add ledger if it has a non-zero amount (including negative values)
            if (ledgerAmount !== 0) {
              ledgersArray.push({
                ledgername: ledger.NAME,
                amount: Math.round(parseFloat(ledgerAmount) * 100) / 100
              });
            }
          });

          return ledgersArray;
        })()

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

        setCustomConversion(null);
        setCustomAddlQty(null);
        setCompoundBaseQty(null);
        setCompoundAddlQty(null);
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

    if (!selectedItem) {

      alert('Please select an item');

      return;

    }



    if (!quantityInput || !quantityInput.trim()) {
      alert('Please enter quantity');

      return;

    }


    if (itemQuantity <= 0) {
      alert('Please enter a valid quantity');
      return;
    }

    // Use itemAmount from state (already calculated with correct rateUOM)
    // Don't recalculate here as it might not match the displayed amount



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

        const newTotal = currentTotal + itemAmount;

        const availableCredit = Math.abs(creditLimitData.creditLimitInfo.CREDITLIMIT) - Math.abs(creditLimitData.creditLimitInfo.CLOSINGBALANCE);



        if (newTotal > availableCredit) {

          alert(`Cannot add item: Total order amount (₹${newTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}) would exceed available credit limit (₹${availableCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}).\n\nCurrent total: ₹${currentTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\nItem amount: ₹${itemAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);



          return;

        }

      }

    }



    // Calculate and store alternative quantity display (same logic as in input form)
    let altQtyDisplay = '';
    if (selectedItemUnitConfig && selectedItemUnitConfig.ADDITIONALUNITS && itemQuantity > 0) {
      const altQty = convertToAlternativeQty(itemQuantity, selectedItemUnitConfig, units, customConversion);
      const qtyToDisplay = customAddlQty !== null && customAddlQty !== undefined
        ? customAddlQty
        : (compoundAddlQty !== null && compoundAddlQty !== undefined ? compoundAddlQty : null);

      if (qtyToDisplay !== null && qtyToDisplay !== undefined) {
        const addlUnitObj = units && units.length > 0
          ? units.find(u => u.NAME === selectedItemUnitConfig.ADDITIONALUNITS)
          : null;
        const hasCompoundAddlUnit = addlUnitObj && addlUnitObj.ISSIMPLEUNIT === 'No';

        if (hasCompoundAddlUnit && addlUnitObj) {
          const addlConversion = parseFloat(addlUnitObj.CONVERSION) || 1;
          const mainQty = Math.floor(qtyToDisplay);
          const subQty = (qtyToDisplay - mainQty) * addlConversion;

          let subDecimalPlaces = 0;
          if (addlUnitObj.ADDITIONALUNITS) {
            const subUnitObj = units.find(u => u.NAME === addlUnitObj.ADDITIONALUNITS);
            if (subUnitObj) {
              subDecimalPlaces = typeof subUnitObj.DECIMALPLACES === 'string'
                ? parseInt(subUnitObj.DECIMALPLACES) || 0
                : (subUnitObj.DECIMALPLACES || 0);
            }
          }

          const formattedSubQty = subDecimalPlaces === 0
            ? Math.round(subQty).toString()
            : subQty.toFixed(subDecimalPlaces);

          const displayUnit = addlUnitObj.BASEUNITS || selectedItemUnitConfig.ADDITIONALUNITS;
          altQtyDisplay = `${mainQty}-${formattedSubQty} ${displayUnit}`;
        } else {
          let decimalPlaces = 0;
          if (units && units.length > 0) {
            const addlUnit = units.find(u => u.NAME === selectedItemUnitConfig.ADDITIONALUNITS);
            if (addlUnit) {
              decimalPlaces = typeof addlUnit.DECIMALPLACES === 'string'
                ? parseInt(addlUnit.DECIMALPLACES) || 0
                : (addlUnit.DECIMALPLACES || 0);
            }
          } else if (selectedItemUnitConfig.ADDITIONALUNITS_DECIMAL !== undefined) {
            decimalPlaces = typeof selectedItemUnitConfig.ADDITIONALUNITS_DECIMAL === 'string'
              ? parseInt(selectedItemUnitConfig.ADDITIONALUNITS_DECIMAL) || 0
              : (selectedItemUnitConfig.ADDITIONALUNITS_DECIMAL || 0);
          }
          const formattedQty = decimalPlaces === 0
            ? Math.round(qtyToDisplay).toString()
            : qtyToDisplay.toFixed(decimalPlaces);
          altQtyDisplay = `${formattedQty} ${selectedItemUnitConfig.ADDITIONALUNITS}`;
        }
      } else if (altQty) {
        altQtyDisplay = `${altQty.qty} ${altQty.unit}`;
      }
    }

    const newItem = {

      id: editingItemId || `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // Preserve ID if editing

      name: selectedItem,

      quantity: itemQuantity, // Primary UOM quantity (converted)
      quantityDisplay: quantityInput, // User's input (e.g., "10 Box", "5 Nos")
      altQtyDisplay: altQtyDisplay, // Alternative quantity display (e.g., "5-5 pkt", "25 nos")
      rate: itemRate,

      rateUOM: rateUOM, // Store rate UOM for reference
      discountPercent: itemDiscountPercent || 0,

      gstPercent: itemGstPercent,

      description: itemDescription || '',

      amount: itemAmount, // Use itemAmount from state (calculated with correct rateUOM)
      unitConfig: selectedItemUnitConfig, // Store unit config for alternative unit display
      enteredUnitType: enteredUnitType, // Store which unit type was entered
      customConversion: customConversion, // Store custom conversion if any
      customAddlQty: customAddlQty, // Store custom additional quantity
      compoundBaseQty: compoundBaseQty, // Store compound base quantity
      compoundAddlQty: compoundAddlQty, // Store compound additional quantity
      baseQtyOnly: baseQtyOnly // Store base quantity only (for simple base + compound additional)
    };

    // If editing, update the item; otherwise add new item
    if (editingItemId) {
      setOrderItems(prev => prev.map(item => item.id === editingItemId ? newItem : item));
      setEditingItemId(null); // Clear editing state
    } else {
      setOrderItems(prev => [...prev, newItem]);
    }

    // Reset form

    setSelectedItem('');

    setItemQuantity(1);

    setItemRate(0);

    setItemDiscountPercent(0);

    setItemGstPercent(0);

    setItemDescription('');

    setSelectedItemUnitConfig(null);

    setQuantityInput('');
    setRateUOM('base');
    setEnteredUnitType('base');
    setCustomConversion(null);
    setCustomAddlQty(null);
    setCompoundBaseQty(null);
    setCompoundAddlQty(null);
    setBaseQtyOnly(null);
    // Don't reset showDescription - keep it on until order is saved

  };



  // Add order item from cart (for E-commerce integration)

  const addOrderItemFromCart = (cartItem) => {

    const amount = cartItem.amount || (parseFloat(cartItem.quantity || 0) * parseFloat(cartItem.rate || 0) * (1 - (parseFloat(cartItem.discountPercent || 0) / 100)));



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

        const newTotal = currentTotal + itemAmount;

        const availableCredit = Math.abs(creditLimitData.creditLimitInfo.CREDITLIMIT) - Math.abs(creditLimitData.creditLimitInfo.CLOSINGBALANCE);



        if (newTotal > availableCredit) {

          alert(`Cannot add item: Total order amount (₹${newTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}) would exceed available credit limit (₹${availableCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}).\n\nCurrent total: ₹${currentTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\nItem amount: ₹${itemAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);



          return;

        }

      }

    }


    // Build unit config for cart item
    const stockItem = stockItems.find(item => item.NAME === cartItem.NAME);
    const unitConfig = stockItem ? buildUnitConfig(stockItem, units) : null;


    const newItem = {

      id: `cart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,

      name: cartItem.NAME,

      quantity: cartItem.quantity,

      rate: parseFloat(cartItem.rate || 0),

      discountPercent: parseFloat(cartItem.discountPercent || 0),

      gstPercent: parseFloat(cartItem.gstPercent || 0),

      amount: itemAmount, // Use itemAmount from state (calculated with correct rateUOM)
      unitConfig: unitConfig // Store unit config for alternative unit display
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

    // Set editing item ID (don't remove item from cart - it will be updated when saved)
    setEditingItemId(item.id);

    // Populate main form fields with item data
    setSelectedItem(item.name);
    setItemSearchTerm(item.name);
    setItemQuantity(item.quantity);
    setItemRate(item.rate);
    setRateUOM(item.rateUOM || 'base');
    setItemDiscountPercent(item.discountPercent || 0);
    setItemGstPercent(item.gstPercent || 0);
    setItemDescription(item.description || '');
    setSelectedItemUnitConfig(item.unitConfig);
    setCustomConversion(item.customConversion || null);
    setCustomAddlQty(item.customAddlQty || null);
    setCompoundBaseQty(item.compoundBaseQty || null);
    setCompoundAddlQty(item.compoundAddlQty || null);
    setBaseQtyOnly(item.baseQtyOnly || null);
    setEnteredUnitType(item.enteredUnitType || 'base');

    // Set quantity input AFTER unitConfig is set to prevent validation from clearing it
    // Use setTimeout to ensure it runs after all state updates
    setTimeout(() => {
      const qtyDisplay = item.quantityDisplay || (item.unitConfig?.BASEUNITS
        ? `${item.quantity} ${item.unitConfig.BASEUNITS}`
        : `${item.quantity}`);
      setQuantityInput(qtyDisplay);
    }, 0);

    // Scroll to the form fields for better UX
    const formElement = document.querySelector('[data-item-entry-form]');
    if (formElement) {
      formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

  };



  // Cancel editing - clear form fields
  const cancelEditItem = () => {
    setEditingItemId(null);
    // Clear form fields
    setSelectedItem('');
    setItemSearchTerm('');
    setQuantityInput('');
    setItemQuantity(1);
    setItemRate(0);
    setRateUOM('base');
    setItemDiscountPercent(0);
    setItemGstPercent(0);
    setItemDescription('');
    setSelectedItemUnitConfig(null);
    setCustomConversion(null);
    setCustomAddlQty(null);
    setCompoundBaseQty(null);
    setCompoundAddlQty(null);
    setBaseQtyOnly(null);
    setEnteredUnitType('base');
  };



  // Save edited item

  const saveEditItem = () => {

    if (editingItemIndex === null) return;



    const item = orderItems[editingItemIndex];

    const newRate = parseFloat(editRate) || 0;

    const newDiscountPercent = parseFloat(editDiscountPercent) || 0;

    // Use editItemQuantity (already calculated with correct UOM logic)
    const newQuantity = editItemQuantity || item.quantity;

    // Calculate alternative quantity display (same logic as addOrderItem)
    let altQtyDisplay = '';
    if (editSelectedItemUnitConfig && editSelectedItemUnitConfig.ADDITIONALUNITS && editItemQuantity > 0) {
      const altQty = convertToAlternativeQty(editItemQuantity, editSelectedItemUnitConfig, units, editCustomConversion);
      const qtyToDisplay = editCustomAddlQty !== null && editCustomAddlQty !== undefined
        ? editCustomAddlQty
        : (editCompoundAddlQty !== null && editCompoundAddlQty !== undefined ? editCompoundAddlQty : null);

      if (qtyToDisplay !== null && qtyToDisplay !== undefined) {
        const addlUnitObj = units && units.length > 0
          ? units.find(u => u.NAME === editSelectedItemUnitConfig.ADDITIONALUNITS)
          : null;
        const hasCompoundAddlUnit = addlUnitObj && addlUnitObj.ISSIMPLEUNIT === 'No';

        if (hasCompoundAddlUnit && addlUnitObj) {
          const addlConversion = parseFloat(addlUnitObj.CONVERSION) || 1;
          const mainQty = Math.floor(qtyToDisplay);
          const subQty = (qtyToDisplay - mainQty) * addlConversion;

          let subDecimalPlaces = 0;
          if (addlUnitObj.ADDITIONALUNITS) {
            const subUnitObj = units.find(u => u.NAME === addlUnitObj.ADDITIONALUNITS);
            if (subUnitObj) {
              subDecimalPlaces = typeof subUnitObj.DECIMALPLACES === 'string'
                ? parseInt(subUnitObj.DECIMALPLACES) || 0
                : (subUnitObj.DECIMALPLACES || 0);
            }
          }

          const formattedSubQty = subDecimalPlaces === 0
            ? Math.round(subQty).toString()
            : subQty.toFixed(subDecimalPlaces);

          const displayUnit = addlUnitObj.BASEUNITS || editSelectedItemUnitConfig.ADDITIONALUNITS;
          altQtyDisplay = `${mainQty}-${formattedSubQty} ${displayUnit}`;
        } else {
          let decimalPlaces = 0;
          if (units && units.length > 0) {
            const addlUnit = units.find(u => u.NAME === editSelectedItemUnitConfig.ADDITIONALUNITS);
            if (addlUnit) {
              decimalPlaces = typeof addlUnit.DECIMALPLACES === 'string'
                ? parseInt(addlUnit.DECIMALPLACES) || 0
                : (addlUnit.DECIMALPLACES || 0);
            }
          } else if (editSelectedItemUnitConfig.ADDITIONALUNITS_DECIMAL !== undefined) {
            decimalPlaces = typeof editSelectedItemUnitConfig.ADDITIONALUNITS_DECIMAL === 'string'
              ? parseInt(editSelectedItemUnitConfig.ADDITIONALUNITS_DECIMAL) || 0
              : (editSelectedItemUnitConfig.ADDITIONALUNITS_DECIMAL || 0);
          }
          const formattedQty = decimalPlaces === 0
            ? Math.round(qtyToDisplay).toString()
            : qtyToDisplay.toFixed(decimalPlaces);
          altQtyDisplay = `${formattedQty} ${editSelectedItemUnitConfig.ADDITIONALUNITS}`;
        }
      } else if (altQty) {
        altQtyDisplay = `${altQty.qty} ${altQty.unit}`;
      }
    }

    // Use editItemAmount (already calculated with correct rateUOM)
    const newAmount = editItemAmount || item.amount;



    const updatedItems = [...orderItems];

    updatedItems[editingItemIndex] = {

      ...item,

      quantity: newQuantity,
      quantityDisplay: editQuantityInput,
      altQtyDisplay: altQtyDisplay,

      rate: newRate,
      rateUOM: editRateUOM,

      discountPercent: newDiscountPercent,

      amount: newAmount,

      description: editDescription,
      unitConfig: editSelectedItemUnitConfig,
      customConversion: editCustomConversion,
      customAddlQty: editCustomAddlQty,
      compoundBaseQty: editCompoundBaseQty,
      compoundAddlQty: editCompoundAddlQty,
      baseQtyOnly: editBaseQtyOnly

    };



    setOrderItems(updatedItems);

    setEditingItemIndex(null);

    setEditQuantity(1);
    setEditQuantityInput('');
    setEditItemQuantity(1);
    setEditRate(0);
    setEditRateUOM('base');
    setEditDiscountPercent(0);
    setEditDescription('');
    setEditSelectedItemUnitConfig(null);
    setEditCustomConversion(null);
    setEditCustomAddlQty(null);
    setEditCompoundBaseQty(null);
    setEditCompoundAddlQty(null);
    setEditBaseQtyOnly(null);
    setEditItemAmount(0);
    setEditShowRateUOMDropdown(false);

  };

  // Parse edit quantity input and calculate editItemQuantity (similar to main form)
  useEffect(() => {
    if (editingItemIndex === null || !editQuantityInput || !editSelectedItemUnitConfig) {
      if (editingItemIndex !== null) {
        setEditItemQuantity(1);
      }
      return;
    }

    const parsedQty = parseQuantityInput(editQuantityInput, editSelectedItemUnitConfig, units);
    const primaryQty = convertToPrimaryQty(parsedQty, editSelectedItemUnitConfig, editCustomConversion, units);

    // Get decimal places for base unit
    let baseUnitDecimal = 0;
    if (units && units.length > 0) {
      const baseUnit = units.find(u => u.NAME === editSelectedItemUnitConfig.BASEUNITS);
      if (baseUnit) {
        baseUnitDecimal = typeof baseUnit.DECIMALPLACES === 'string'
          ? parseInt(baseUnit.DECIMALPLACES) || 0
          : (baseUnit.DECIMALPLACES || 0);
      }
    } else if (editSelectedItemUnitConfig.BASEUNIT_DECIMAL !== undefined) {
      baseUnitDecimal = typeof editSelectedItemUnitConfig.BASEUNIT_DECIMAL === 'string'
        ? parseInt(editSelectedItemUnitConfig.BASEUNIT_DECIMAL) || 0
        : (editSelectedItemUnitConfig.BASEUNIT_DECIMAL || 0);
    }

    const roundedPrimaryQty = baseUnitDecimal === 0
      ? Math.round(primaryQty)
      : parseFloat(primaryQty.toFixed(baseUnitDecimal));

    setEditItemQuantity(roundedPrimaryQty);

    // Store UOM-related quantities (similar to main form logic)
    if (parsedQty.customAddlQty !== undefined && parsedQty.customAddlQty !== null) {
      setEditCustomAddlQty(parsedQty.customAddlQty);
    }

    if (parsedQty.isCompound && parsedQty.qty !== undefined && parsedQty.subQty !== undefined && units && units.length > 0) {
      const baseUnitObj = units.find(u => u.NAME === editSelectedItemUnitConfig.BASEUNITS);
      if (baseUnitObj && baseUnitObj.ISSIMPLEUNIT === 'No') {
        const baseConversion = parseFloat(baseUnitObj.CONVERSION) || 1;
        const compoundQty = (parsedQty.qty || 0) + ((parsedQty.subQty || 0) / baseConversion);
        setEditCompoundBaseQty(compoundQty);
      }
    }

    if (parsedQty.customAddlQty !== undefined && parsedQty.customAddlQty !== null && units && units.length > 0) {
      const addlUnitObj = units.find(u => u.NAME === editSelectedItemUnitConfig.ADDITIONALUNITS);
      if (addlUnitObj && addlUnitObj.ISSIMPLEUNIT === 'No') {
        setEditCompoundAddlQty(parsedQty.customAddlQty);
      }
    }

    if (parsedQty.totalQty !== undefined && parsedQty.totalQty !== null && parsedQty.customAddlQty !== undefined && parsedQty.customAddlQty !== null) {
      setEditBaseQtyOnly(parsedQty.qty);
    }
  }, [editQuantityInput, editSelectedItemUnitConfig, units, editCustomConversion, editingItemIndex]);

  // Calculate edit amount based on rateUOM (similar to main form)
  useEffect(() => {
    if (editingItemIndex === null || !editItemQuantity || !editRate || !editSelectedItemUnitConfig) {
      if (editingItemIndex !== null) {
        setEditItemAmount(0);
      }
      return;
    }

    let quantityInRateUOM = editItemQuantity;
    let calculatedAmount = 0;

    const baseUnitObj = units && units.length > 0
      ? units.find(u => u.NAME === editSelectedItemUnitConfig.BASEUNITS)
      : null;
    const hasCompoundBaseUnit = baseUnitObj && baseUnitObj.ISSIMPLEUNIT === 'No';

    const addlUnitObj = units && units.length > 0 && editSelectedItemUnitConfig.ADDITIONALUNITS
      ? units.find(u => u.NAME === editSelectedItemUnitConfig.ADDITIONALUNITS)
      : null;
    const hasCompoundAddlUnit = addlUnitObj && addlUnitObj.ISSIMPLEUNIT === 'No';

    // Calculate quantityInRateUOM based on rateUOM (same logic as main form)
    if ((editRateUOM === 'component-main' || (editRateUOM === 'base' && hasCompoundBaseUnit)) && hasCompoundBaseUnit && baseUnitObj) {
      quantityInRateUOM = editCompoundBaseQty || editItemQuantity;
    } else if (editRateUOM === 'component-sub' && hasCompoundBaseUnit && baseUnitObj) {
      const baseConversion = parseFloat(baseUnitObj.CONVERSION) || 1;
      quantityInRateUOM = (editCompoundBaseQty || editItemQuantity) * baseConversion;
    } else if (editRateUOM === 'additional-component-main' && hasCompoundAddlUnit && addlUnitObj) {
      quantityInRateUOM = editCompoundAddlQty || editCustomAddlQty || 0;
    } else if (editRateUOM === 'additional-component-sub' && hasCompoundAddlUnit && addlUnitObj) {
      const addlConversion = parseFloat(addlUnitObj.CONVERSION) || 1;
      quantityInRateUOM = (editCompoundAddlQty || editCustomAddlQty || 0) * addlConversion;
    } else if (editRateUOM === 'base' && !hasCompoundBaseUnit) {
      if (hasCompoundAddlUnit && editBaseQtyOnly !== null && editBaseQtyOnly !== undefined) {
        quantityInRateUOM = editBaseQtyOnly;
      } else {
        quantityInRateUOM = editItemQuantity;
      }
    } else if (editRateUOM === 'additional') {
      const denominator = parseFloat(editSelectedItemUnitConfig.DENOMINATOR) || 1;
      const conversion = parseFloat(editSelectedItemUnitConfig.CONVERSION) || 1;

      // Use custom conversion if available
      const effectiveDenominator = editCustomConversion ? editCustomConversion.denominator : denominator;
      const effectiveConversion = editCustomConversion ? editCustomConversion.conversion : conversion;

      if (hasCompoundBaseUnit && baseUnitObj && !editCustomConversion) {
        const baseConversion = parseFloat(baseUnitObj.CONVERSION) || 1;
        const effectiveDenominator = denominator / baseConversion;
        quantityInRateUOM = editItemQuantity * (effectiveConversion / effectiveDenominator);
      } else {
        quantityInRateUOM = editItemQuantity * (effectiveConversion / effectiveDenominator);
      }

      // Round based on additional unit's decimal places
      if (units && units.length > 0 && editSelectedItemUnitConfig.ADDITIONALUNITS) {
        const addlUnit = units.find(u => u.NAME === editSelectedItemUnitConfig.ADDITIONALUNITS);
        if (addlUnit) {
          const addlDecimalPlaces = typeof addlUnit.DECIMALPLACES === 'string'
            ? parseInt(addlUnit.DECIMALPLACES) || 0
            : (addlUnit.DECIMALPLACES || 0);
          if (addlDecimalPlaces === 0) {
            quantityInRateUOM = Math.round(quantityInRateUOM);
          } else {
            quantityInRateUOM = parseFloat(quantityInRateUOM.toFixed(addlDecimalPlaces));
          }
        }
      }
    }

    calculatedAmount = quantityInRateUOM * editRate * (1 - (editDiscountPercent || 0) / 100);
    setEditItemAmount(calculatedAmount);
  }, [editItemQuantity, editRate, editDiscountPercent, editRateUOM, editSelectedItemUnitConfig, units, editCustomConversion, editCompoundBaseQty, editCompoundAddlQty, editCustomAddlQty, editBaseQtyOnly, editingItemIndex]);



  const calculateTotals = () => {

    if (orderItems.length === 0) {
      return {
        totalQuantity: 0,
        totalAmount: 0,
        canShowQuantityTotal: false
      };
    }

    // Check if all items have the same base unit
    const firstItemUnit = orderItems[0].unitConfig?.BASEUNITS;
    const allSameUnit = orderItems.every(item =>
      item.unitConfig?.BASEUNITS === firstItemUnit
    );

    return orderItems.reduce((totals, item) => {

      if (allSameUnit) {
        totals.totalQuantity += item.quantity;
      }

      totals.totalAmount += item.amount;

      return totals;

    }, {

      totalQuantity: 0,

      totalAmount: 0,

      canShowQuantityTotal: allSameUnit

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



  // Get current company for display
  const selectedCompanyTallylocId = sessionStorage.getItem('selectedCompanyTallylocId');
  // Match by both guid and tallyloc_id to handle companies with same guid but different tallyloc_id
  const currentCompany = companies.find(c => 
    c.guid === selectedCompanyGuid && 
    (selectedCompanyTallylocId ? String(c.tallyloc_id) === String(selectedCompanyTallylocId) : true)
  );

  return (

    <div className="receivables-page" style={{

      width: '100%',

      minHeight: '100vh',

      background: 'transparent',

      padding: isMobile ? '8px 16px 16px 16px' : isTablet ? '8px 20px 20px 20px' : isSmallDesktop ? '8px 20px 20px 20px' : '8px 24px 24px 24px',

      margin: 0,

      maxWidth: isMobile ? '100%' : isTablet ? '100%' : isSmallDesktop ? '100%' : isMedium ? '1280px' : '1400px',

      marginLeft: 'auto',

      marginRight: 'auto',

      boxSizing: 'border-box',

      overflowX: 'hidden',

      overflowY: 'auto'

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

        <div style={{

          background: '#fee2e2',

          color: '#b91c1c',

          borderRadius: isMobile ? 8 : 8,

          padding: isMobile ? '8px 14px' : '8px 16px',

          margin: isMobile ? '12px 8px' : '0 auto 18px auto',

          fontWeight: 600,

          fontSize: isMobile ? 14 : 15,

          maxWidth: isMobile ? 'calc(100% - 16px)' : 1200,

          display: 'flex',

          alignItems: 'center',

          gap: 8

        }}>

          <span className="material-icons" style={{ fontSize: isMobile ? 16 : 18 }}>error_outline</span>

          {customerError}

        </div>

      )}

      {stockItemsError && (

        <div style={{

          background: '#fee2e2',

          color: '#b91c1c',

          borderRadius: isMobile ? 8 : 8,

          padding: isMobile ? '8px 14px' : '8px 16px',

          margin: isMobile ? '12px 8px' : '0 auto 18px auto',

          fontWeight: 600,

          fontSize: isMobile ? 14 : 15,

          maxWidth: isMobile ? 'calc(100% - 16px)' : 1200,

          display: 'flex',

          alignItems: 'center',

          gap: 8

        }}>

          <span className="material-icons" style={{ fontSize: isMobile ? 16 : 18 }}>error_outline</span>

          {stockItemsError}

        </div>

      )}





      {/* Page Header - Matching Receivables Dashboard */}
      <div className="page-header" style={{
        marginBottom: isMobile ? '0.5rem' : '1rem',
        flexShrink: 0,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: isMobile ? '1rem' : '1.5rem',
        flexWrap: isMobile || isTablet ? 'wrap' : 'nowrap',
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
      }}>
        <div className="page-header-left" style={{ width: isMobile ? '100%' : 'auto' }}>
          <div className="page-header-titles">
          </div>
        </div>
        <div className="page-header-actions" style={{
          width: isMobile ? '100%' : 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          flexShrink: 0,
        }}>
        </div>
      </div>

      {/* Company, Customer, and Place Order Section */}
      <div className="receivables-content" style={{
        display: 'flex',
        flexDirection: isMobile || isTablet || isSmallDesktop ? 'column' : 'row',
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        overflowX: 'hidden',
        gap: isMobile ? '16px' : isTablet ? '20px' : isSmallDesktop ? '20px' : '24px',
        alignItems: isMobile || isTablet || isSmallDesktop ? 'stretch' : 'flex-start'
      }}>
        {/* Left Content Area */}
        <div style={{
          flex: isMobile || isTablet || isSmallDesktop ? '1 1 100%' : '1 1 auto',
          minWidth: isMobile || isTablet || isSmallDesktop ? 'auto' : '600px',
          maxWidth: '100%',
          width: isMobile || isTablet || isSmallDesktop ? '100%' : 'auto',
          padding: isMobile ? '8px 16px 16px 16px' : isTablet ? '8px 20px 20px 20px' : isSmallDesktop ? '8px 20px 20px 20px' : '8px 24px 24px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: isMobile ? '20px' : isTablet ? '24px' : isSmallDesktop ? '24px' : '32px',
          boxSizing: 'border-box',
          overflowX: 'hidden'
        }}>
          {/* Form - Place Order */}
          <form id="order-form" onSubmit={handleSubmit} style={{ width: '100%', maxWidth: '100%', overflow: 'visible', position: 'relative', boxSizing: 'border-box' }}>

            {/* Customer Details Section */}
            <div style={{ maxWidth: '100%', boxSizing: 'border-box' }}>






              <div style={{
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                flexWrap: isTablet || isSmallDesktop ? 'wrap' : 'nowrap',
                gap: '16px',
                alignItems: isMobile ? 'stretch' : 'flex-start',
                position: 'relative',
                width: '100%',
                maxWidth: '100%'
              }}>

                {/* VoucherType */}
                <div style={{
                  position: 'relative',
                  flex: isMobile ? '1 1 100%' : (isTablet || isSmallDesktop) ? '1 1 calc(50% - 8px)' : '1 1 0',
                  width: isMobile ? '100%' : 'auto',
                  minWidth: isMobile ? 'auto' : (isTablet || isSmallDesktop) ? 'auto' : '200px',
                  maxWidth: isMobile || isTablet || isSmallDesktop ? '100%' : '240px'
                }}>
                  <label style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontSize: '13px',
                    fontWeight: '500',
                    color: voucherTypeFocused || selectedVoucherType ? '#7c3aed' : '#374151',
                    transition: 'color 0.2s ease'
                  }}>
                    Order Type
                  </label>

                  <div style={{

                    position: 'relative',

                    background: 'white',

                    borderRadius: '12px',

                    border: showVoucherTypeDropdown ? '2px solid #7c3aed' : '1px solid #e5e7eb',

                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',

                    boxShadow: showVoucherTypeDropdown ? '0 0 0 4px rgba(124, 58, 237, 0.1), 0 4px 12px rgba(124, 58, 237, 0.15)' : '0 1px 3px rgba(0, 0, 0, 0.08)',

                    zIndex: showVoucherTypeDropdown ? 1001 : 'auto',

                    ':hover': {
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.12)',
                      borderColor: showVoucherTypeDropdown ? '#7c3aed' : '#d1d5db'
                    }

                  }}
                  onMouseEnter={(e) => {
                    if (!showVoucherTypeDropdown) {
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.12)';
                      e.currentTarget.style.borderColor = '#d1d5db';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!showVoucherTypeDropdown) {
                      e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.08)';
                      e.currentTarget.style.borderColor = '#e5e7eb';
                    }
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

                        padding: isMobile ? '12px 16px' : '14px 16px',

                        border: 'none',

                        borderRadius: '12px',

                        fontSize: isMobile ? '14px' : '15px',

                        color: '#111827',

                        outline: 'none',

                        background: 'transparent',

                        cursor: voucherTypesLoading ? 'not-allowed' : 'text',

                        height: isMobile ? '44px' : '48px',

                        boxSizing: 'border-box',

                        fontWeight: '500'

                      }}

                      placeholder={voucherTypesLoading ? 'Loading voucher types...' : 'Select Voucher Type'}

                    />

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

                          background: '#f3f4f6',

                          border: 'none',

                          cursor: 'pointer',

                          color: '#6b7280',

                          fontSize: '18px',

                          lineHeight: 1,

                          padding: '6px',

                          borderRadius: '6px',

                          width: '28px',

                          height: '28px',

                          display: 'flex',

                          alignItems: 'center',

                          justifyContent: 'center',

                          transition: 'all 0.2s ease'

                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#e5e7eb';
                          e.currentTarget.style.color = '#374151';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = '#f3f4f6';
                          e.currentTarget.style.color = '#6b7280';
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

                            // Class name restoration is handled by useEffect

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

                    {/* Class Name */}
                  <div style={{
                    position: 'relative',
                    flex: isMobile ? '1 1 100%' : (isTablet || isSmallDesktop) ? '1 1 calc(50% - 8px)' : '1 1 0',
                    width: isMobile ? '100%' : 'auto',
                    minWidth: isMobile ? 'auto' : (isTablet || isSmallDesktop) ? 'auto' : '200px',
                    maxWidth: isMobile || isTablet || isSmallDesktop ? '100%' : '240px'
                  }}>
                    <label style={{
                      display: 'block',
                      marginBottom: '8px',
                      fontSize: '13px',
                      fontWeight: '500',
                      color: classNameFocused || selectedClassName ? '#7c3aed' : '#374151',
                      transition: 'color 0.2s ease'
                    }}>
                      Class Name
                    </label>
                    <div style={{
                      position: 'relative',
                      background: 'white',
                      borderRadius: '12px',
                      border: showClassNameDropdown ? '2px solid #7c3aed' : '1px solid #e5e7eb',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxShadow: showClassNameDropdown ? '0 0 0 4px rgba(124, 58, 237, 0.1), 0 4px 12px rgba(124, 58, 237, 0.15)' : '0 1px 3px rgba(0, 0, 0, 0.08)',
                      zIndex: showClassNameDropdown ? 1001 : 'auto'
                    }}
                    onMouseEnter={(e) => {
                      if (!showClassNameDropdown) {
                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.12)';
                        e.currentTarget.style.borderColor = '#d1d5db';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!showClassNameDropdown) {
                        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.08)';
                        e.currentTarget.style.borderColor = '#e5e7eb';
                      }
                    }}>
                      <input
                        type="text"
                        value={selectedClassName}
                        onChange={e => {
                          const inputValue = e.target.value;
                          setSelectedClassName(inputValue);
                          if (availableClasses.length > 0) {
                            setShowClassNameDropdown(true);
                          }
                        }}
                        onFocus={() => {
                          setClassNameFocused(true);
                          if (availableClasses.length > 0) {
                            setShowClassNameDropdown(true);
                          }
                        }}
                        onBlur={() => {
                          setClassNameFocused(false);
                          // Delay hiding dropdown to allow click events
                          setTimeout(() => setShowClassNameDropdown(false), 200);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            setShowClassNameDropdown(false);
                            e.target.blur();
                          }
                        }}
                        disabled={availableClasses.length === 0}
                        style={{
                          width: '100%',
                          padding: isMobile ? '12px 16px' : '14px 16px',
                          border: 'none',
                          borderRadius: '12px',
                          fontSize: isMobile ? '14px' : '15px',
                          color: availableClasses.length === 0 ? '#9ca3af' : '#111827',
                          outline: 'none',
                          background: availableClasses.length === 0 ? '#f9fafb' : 'transparent',
                          cursor: availableClasses.length === 0 ? 'not-allowed' : 'text',
                          height: isMobile ? '44px' : '48px',
                          boxSizing: 'border-box',
                          fontWeight: '500'
                        }}
                        placeholder={availableClasses.length === 0 ? 'No classes available' : ''}
                      />
                      {selectedClassName && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedClassName('');
                            setShowClassNameDropdown(false);
                          }}
                          style={{
                            position: 'absolute',
                            right: '12px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: '#f3f4f6',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#6b7280',
                            fontSize: '18px',
                            lineHeight: 1,
                            padding: '6px',
                            borderRadius: '6px',
                            width: '28px',
                            height: '28px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#e5e7eb';
                            e.currentTarget.style.color = '#374151';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = '#f3f4f6';
                            e.currentTarget.style.color = '#6b7280';
                          }}
                          title="Clear selection"
                        >
                          ×
                        </button>
                      )}
                    </div>

                    {/* Class Name Dropdown */}
                    {showClassNameDropdown && availableClasses.length > 0 && (
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
                        {availableClasses
                          .filter(className => !selectedClassName || className.toLowerCase().includes(selectedClassName.toLowerCase()))
                          .map((className, index, filtered) => (
                            <div
                              key={className}
                              onClick={() => {
                                setSelectedClassName(className);
                                setShowClassNameDropdown(false);
                                // Save the selected class name for future use
                                sessionStorage.setItem('selectedClassName', className);
                              }}
                              style={{
                                padding: '12px 16px',
                                cursor: 'pointer',
                                borderBottom: index < filtered.length - 1 ? '1px solid #f1f5f9' : 'none',
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
                                {className}
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>



                {/* Customer */}

                <div style={{

                  position: 'relative',

                  flex: isMobile ? '1 1 100%' : (isTablet || isSmallDesktop) ? '1 1 100%' : '1 1 0',

                  minWidth: isMobile ? 'auto' : (isTablet || isSmallDesktop) ? 'auto' : '250px',

                  width: isMobile || isTablet || isSmallDesktop ? '100%' : 'auto',

                  maxWidth: '100%'

                }}>
                  <label style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontSize: '13px',
                    fontWeight: '500',
                    color: customerFocused || !!selectedCustomer ? '#7c3aed' : '#374151',
                    transition: 'color 0.2s ease'
                  }}>
                    Customer
                  </label>

                  <div style={{

                    position: 'relative',

                    background: 'white',

                    borderRadius: '12px',

                    border: showCustomerDropdown ? '2px solid #7c3aed' : '1px solid #e5e7eb',

                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',

                    boxShadow: showCustomerDropdown ? '0 0 0 4px rgba(124, 58, 237, 0.1), 0 4px 12px rgba(124, 58, 237, 0.15)' : '0 1px 3px rgba(0, 0, 0, 0.08)',

                    zIndex: showCustomerDropdown ? 1001 : 'auto'

                  }}
                  onMouseEnter={(e) => {
                    if (!showCustomerDropdown) {
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.12)';
                      e.currentTarget.style.borderColor = '#d1d5db';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!showCustomerDropdown) {
                      e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.08)';
                      e.currentTarget.style.borderColor = '#e5e7eb';
                    }
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

                        // Clear filtered results immediately when clearing search or starting new search

                        if (!inputValue.trim()) {

                          // Always show all customers when no search term (like ecommerce)

                          setFilteredCustomers(customerOptions);

                        } else {

                          // Clear previous results immediately when starting new search

                          // The debounced search will populate new results

                          setFilteredCustomers([]);

                        }

                      }}

                      onFocus={() => {

                        setCustomerFocused(true);

                        setShowCustomerDropdown(true);

                        // Always show all customers when focused (like ecommerce)

                        setFilteredCustomers(customerOptions);

                      }}

                      onBlur={(e) => {

                        console.log('👋 Customer input blur triggered');

                        console.log('👋 Related target:', e.relatedTarget);

                        console.log('👋 Active element:', document.activeElement);

                        setCustomerFocused(false);

                        // Delay hiding dropdown to allow click events

                        setTimeout(() => {

                          console.log('👋 Blur timeout - closing dropdown');

                          setShowCustomerDropdown(false);

                        }, 200);

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

                        padding: isMobile ? '12px 16px' : '14px 16px',

                        paddingRight: selectedCustomer ? '50px' : '48px',

                        border: 'none',

                        borderRadius: '12px',

                        fontSize: isMobile ? '14px' : '15px',

                        color: '#111827',

                        outline: 'none',

                        background: 'transparent',

                        cursor: customerLoading ? 'not-allowed' : 'text',

                        height: isMobile ? '44px' : '48px',

                        boxSizing: 'border-box',

                        fontWeight: '500'

                      }}

                      placeholder={customerLoading ? 'Loading...' : customerError ? customerError : 'Search customer...'}

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

                          color: showCustomerDropdown ? '#7c3aed' : '#9ca3af',

                          fontSize: '22px',

                          pointerEvents: 'none',

                          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',

                          opacity: 0.7

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

                          right: '12px',

                          top: '50%',

                          transform: 'translateY(-50%)',

                          background: '#f3f4f6',

                          border: 'none',

                          cursor: 'pointer',

                          padding: '6px',

                          borderRadius: '6px',

                          color: '#6b7280',

                          fontSize: '18px',

                          display: 'flex',

                          alignItems: 'center',

                          justifyContent: 'center',

                          transition: 'all 0.2s ease',

                          width: '28px',

                          height: '28px'

                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#e5e7eb';
                          e.currentTarget.style.color = '#374151';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = '#f3f4f6';
                          e.currentTarget.style.color = '#6b7280';
                        }}

                        title="Clear customer"

                      >

                        ×

                      </button>

                    )}






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

                        onMouseDown={(e) => {

                          console.log('🖱️ Dropdown container mousedown');

                          // Don't prevent default here - let items handle it

                        }}

                        onClick={(e) => {

                          console.log('🖱️ Dropdown container clicked');

                          // Don't stop propagation - let items handle it

                        }}

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

                            onMouseDown={(e) => {

                              console.log('🖱️ Customer item mousedown:', customer.NAME);

                              console.log('🖱️ Event target:', e.target);

                              console.log('🖱️ Event currentTarget:', e.currentTarget);

                              e.preventDefault(); // Prevent blur from firing

                              console.log('✅ preventDefault called on mousedown');

                            }}

                            onClick={(e) => {

                              console.log('🖱️ Customer item clicked:', customer.NAME);

                              console.log('🖱️ Click event target:', e.target);

                              console.log('🖱️ Click event currentTarget:', e.currentTarget);

                              console.log('📊 Before selection - selectedCustomer:', selectedCustomer);

                              console.log('📊 Before selection - showCustomerDropdown:', showCustomerDropdown);

                              e.preventDefault();

                              e.stopPropagation();

                              // Clear auto-population state when user manually changes customer

                              if (isAutoPopulating || autoPopulatingRef.current) {

                                console.log('🔄 User manually changed customer - clearing auto-population state');

                                setIsAutoPopulating(false);

                                autoPopulatingRef.current = false;

                              }

                              console.log('📝 Setting selected customer to:', customer.NAME);

                              setSelectedCustomer(customer.NAME);

                              setCustomerSearchTerm('');

                              setShowCustomerDropdown(false);

                              setFilteredCustomers([]);

                              console.log('✅ Customer selection completed:', customer.NAME);

                              console.log('📊 After selection - state should update on next render');

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

              </div>

              {/* Credit Limit Information Line - Below the main row */}

              {(canShowCreditLimit || canControlCreditLimit) && selectedCustomer && (

                <div style={{

                  display: 'flex',

                  flexDirection: isMobile ? 'column' : 'row',

                  alignItems: isMobile ? 'flex-start' : 'center',

                  justifyContent: 'flex-start',

                  gap: isMobile ? '14px' : '20px',

                  padding: isMobile ? '10px 0' : '8px 0',

                  fontSize: isMobile ? '13px' : '14px',

                  fontWeight: '500'

                }}>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>

                    <span className="material-icons" style={{ fontSize: isMobile ? '14px' : '16px', color: '#6b7280' }}>

                      account_balance_wallet

                    </span>

                    <span style={{ color: '#374151', fontWeight: '500' }}>Credit Info:</span>

                  </div>



                  {creditLimitLoading ? (

                    <span style={{ color: '#6b7280', fontSize: isMobile ? '12px' : '13px' }}>Loading...</span>

                  ) : creditLimitData ? (

                    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', gap: isMobile ? '8px' : '20px', width: isMobile ? '100%' : 'auto' }}>

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

              {/* Order Items Section - Table Container */}
              <div style={{
                width: '100%',
                maxWidth: '100%',
                boxSizing: 'border-box',
                overflowX: 'hidden'
              }}>

                {/* Add Item Form */}
                <div data-item-entry-form style={{
                  width: '100%',
                  maxWidth: '100%',
                  boxSizing: 'border-box',
                  overflow: 'visible',
                  position: 'relative'
                }}>

                  {/* End of Customer Details Section */}





                  {/* Order Items Section */}
                  <div style={{
                    background: '#ffffff',
                    borderRadius: '0.75rem',
                    padding: isMobile ? '20px' : '24px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
                    transition: 'all 0.2s ease',
                    overflow: 'visible',
                    position: 'relative',
                    zIndex: 1
                  }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.08)';
                    }}>

                    <div style={{

                      display: 'flex',

                      flexDirection: isMobile ? 'column' : 'row',

                      flexWrap: isMobile ? 'nowrap' : 'wrap',

                      gap: '16px',

                      rowGap: '16px',

                      alignItems: isMobile ? 'stretch' : 'flex-start',

                      position: 'relative',

                      padding: isMobile ? '20px' : '24px',

                      background: '#f9fafb',

                      borderRadius: '8px',

                      border: '1px solid #e2e8f0',

                      width: '100%',
                      maxWidth: '100%',
                      boxSizing: 'border-box',
                      overflow: 'visible'

                    }}>

                      {/* Item Name */}

                      <div style={{
                        position: 'relative',
                        flex: isMobile ? '1 1 100%' : '1 1 300px',
                        minWidth: isMobile ? '100%' : '250px',
                        maxWidth: isMobile ? '100%' : '400px',
                        width: isMobile ? '100%' : 'auto',
                        boxSizing: 'border-box',
                        overflow: 'visible',
                        zIndex: 10
                      }}>

                        <div style={{
                          position: 'relative',
                          background: 'white',
                          borderRadius: '8px',
                          border: showItemDropdown ? '2px solid #7c3aed' : '1px solid #e2e8f0',
                          transition: 'all 0.2s ease',
                          boxShadow: showItemDropdown ? '0 0 0 3px rgba(124, 58, 237, 0.1)' : '0 1px 2px rgba(0, 0, 0, 0.05)',
                          zIndex: showItemDropdown ? 1001 : 'auto',
                          overflow: 'visible'
                        }}>

                          <input

                            type="text"

                            value={selectedItem || itemSearchTerm}

                            onChange={(e) => {

                              setItemSearchTerm(e.target.value);

                              setSelectedItem('');

                              setCustomConversion(null);
                              setCustomAddlQty(null);
                              setCompoundBaseQty(null);
                              setCompoundAddlQty(null);
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

                              padding: isMobile ? '12px 16px' : '14px 16px',

                              paddingRight: selectedItem ? (isMobile ? '45px' : '50px') : (isMobile ? '40px' : '40px'),

                              border: 'none',

                              borderRadius: '8px',

                              fontSize: isMobile ? '14px' : '15px',

                              color: selectedCustomer ? '#111827' : '#9ca3af',

                              outline: 'none',

                              background: selectedCustomer ? 'transparent' : '#f9fafb',

                              cursor: selectedCustomer ? 'text' : 'not-allowed',

                              height: isMobile ? '44px' : '48px',

                              boxSizing: 'border-box',

                              fontWeight: '400'

                            }}

                            placeholder="Search and add items..."

                          />



                          {/* Search Icon or Dropdown Arrow */}

                          {!selectedItem && (

                            <span

                              className="material-icons"

                              style={{

                                position: 'absolute',

                                right: isMobile ? '14px' : '16px',

                                top: '50%',

                                transform: 'translateY(-50%)',

                                color: showItemDropdown ? '#3b82f6' : '#9ca3af',

                                fontSize: isMobile ? '18px' : '20px',

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

                                setCustomConversion(null);
                                setCustomAddlQty(null);
                                setCompoundBaseQty(null);
                                setCompoundAddlQty(null);
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

                            left: isMobile ? '16px' : '16px',

                            top: '-8px',

                            fontSize: '12px',

                            fontWeight: '500',

                            color: itemFocused || selectedItem ? '#7c3aed' : '#6b7280',

                            backgroundColor: 'white',

                            padding: '0 6px',

                            transition: 'all 0.2s ease',

                            pointerEvents: 'none',

                            zIndex: 1

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

                                maxHeight: isMobile ? '300px' : '400px',

                                overflowY: 'auto',

                                overflowX: 'hidden',

                                zIndex: 10000,

                                boxShadow: '0 10px 25px rgba(59, 130, 246, 0.2)',

                                marginTop: '0',

                                minHeight: '50px',
                                width: '100%',
                                maxWidth: '100%',
                                boxSizing: 'border-box'

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





                      {/* Simplified Quantity Input (Tally-style) */}
                      {selectedItemUnitConfig && (

                        <div style={{
                          position: 'relative',
                          flex: isMobile ? '1 1 100%' : '0 0 auto',
                          minWidth: isMobile ? '100%' : '140px',
                          maxWidth: isMobile ? '100%' : '220px',
                          width: isMobile ? '100%' : 'auto',
                          display: 'flex',
                          alignItems: isMobile ? 'stretch' : 'flex-start',
                          gap: isMobile ? '10px' : '8px',
                          flexDirection: isMobile ? 'column' : 'row',
                          boxSizing: 'border-box'
                        }}>
                          <div style={{

                            position: 'relative',

                            background: 'white',

                            borderRadius: '8px',
                            border: quantityFocused ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                            transition: 'all 0.2s ease',

                            boxShadow: quantityFocused ? '0 4px 12px rgba(59, 130, 246, 0.15)' : '0 1px 2px rgba(0, 0, 0, 0.08)',
                            flex: '1 1 auto',
                            minWidth: 0
                          }}>
                            <input

                              type="text"

                              value={quantityInput}
                              onChange={(e) => {
                                const inputValue = e.target.value;
                                // Filter out only obviously invalid characters (special symbols, etc.)
                                // Allow numbers, decimal point, spaces, letters (for unit names), and = (for custom conversion)
                                const filtered = inputValue.replace(/[^0-9.\sA-Za-z=]/g, '');
                                if (filtered !== inputValue) {
                                  // Invalid character entered, don't update
                                  return;
                                }
                                // While typing, just update the input - don't validate yet
                                // Validation will happen on blur
                                setQuantityInput(filtered);
                              }}
                              onBlur={(e) => {
                                // Final validation on blur - always round/format based on unit's decimal places
                                const validated = validateQuantityInput(e.target.value, selectedItemUnitConfig, units, true);

                                // Preserve customAddlQty and compoundAddlQty before conversion (in case it gets cleared during parsing)
                                const preservedCustomAddlQty = customAddlQty;
                                const preservedCustomConversion = customConversion;
                                const preservedCompoundAddlQty = compoundAddlQty;

                                // Parse the original input first to check if it's a custom conversion or component unit input
                                // Don't use validated here because validateQuantityInput might have converted it
                                const originalParsedQty = parseQuantityInput(quantityInput, selectedItemUnitConfig, units);

                                // Always convert to BASEUNITS format, even for custom conversions
                                if (validated && selectedItemUnitConfig) {
                                  const parsedQty = parseQuantityInput(validated, selectedItemUnitConfig, units);

                                  // If the original input was a custom conversion, preserve the customAddlQty
                                  if (originalParsedQty.isCustomConversion && originalParsedQty.customAddlQty !== undefined) {
                                    // The customAddlQty is set by parseQuantityInput, but we need to ensure it's preserved
                                    // Set it immediately to ensure it's available
                                    if (customAddlQty !== originalParsedQty.customAddlQty) {
                                      setCustomAddlQty(originalParsedQty.customAddlQty);
                                    }
                                    // Also ensure customConversion is set if not already
                                    if (!customConversion && originalParsedQty.isCustomConversion) {
                                      // Calculate the custom conversion ratio from the parsed quantity
                                      const baseQty = convertToPrimaryQty(originalParsedQty, selectedItemUnitConfig, null, units);
                                      setCustomConversion({
                                        baseQty: baseQty,
                                        addlQty: originalParsedQty.customAddlQty,
                                        denominator: baseQty,
                                        conversion: originalParsedQty.customAddlQty
                                      });
                                    }
                                  } else if (originalParsedQty.customAddlQty !== undefined && originalParsedQty.customAddlQty !== null) {
                                    // Preserve customAddlQty even if it's not a custom conversion (e.g., "9 pkt 2 nos 3 box")
                                    if (customAddlQty !== originalParsedQty.customAddlQty) {
                                      setCustomAddlQty(originalParsedQty.customAddlQty);
                                    }
                                  } else if (originalParsedQty.compoundAddlQty !== undefined && originalParsedQty.compoundAddlQty !== null) {
                                    // Preserve compoundAddlQty when user entered component unit (e.g., "25 pkt" or "55 nos")
                                    console.log('🔢 Preserving compoundAddlQty from original input in onBlur:', {
                                      originalCompoundAddlQty: originalParsedQty.compoundAddlQty,
                                      originalCompoundAddlMainQty: originalParsedQty.compoundAddlMainQty,
                                      originalCompoundAddlSubQty: originalParsedQty.compoundAddlSubQty,
                                      currentCompoundAddlQty: compoundAddlQty,
                                      input: quantityInput,
                                      validated: validated
                                    });
                                    if (compoundAddlQty !== originalParsedQty.compoundAddlQty) {
                                      setCompoundAddlQty(originalParsedQty.compoundAddlQty);
                                    }
                                  } else if (parsedQty.isCustomConversion && parsedQty.customAddlQty !== undefined) {
                                    // Fallback: if validated version has custom conversion, use it
                                    if (customAddlQty !== parsedQty.customAddlQty) {
                                      setCustomAddlQty(parsedQty.customAddlQty);
                                    }
                                    if (!customConversion && parsedQty.isCustomConversion) {
                                      const baseQty = convertToPrimaryQty(parsedQty, selectedItemUnitConfig, null, units);
                                      setCustomConversion({
                                        baseQty: baseQty,
                                        addlQty: parsedQty.customAddlQty,
                                        denominator: baseQty,
                                        conversion: parsedQty.customAddlQty
                                      });
                                    }
                                  } else if (preservedCustomConversion && preservedCustomAddlQty !== null && preservedCustomAddlQty !== undefined) {
                                    // If we had a custom conversion before, and the parsed quantity matches, preserve it
                                    const primaryQty = convertToPrimaryQty(parsedQty, selectedItemUnitConfig, preservedCustomConversion, units);
                                    if (Math.abs(primaryQty - preservedCustomConversion.baseQty) < 0.0001) {
                                      // Quantity matches - preserve the custom conversion
                                      if (!customConversion || customConversion.baseQty !== preservedCustomConversion.baseQty) {
                                        setCustomConversion(preservedCustomConversion);
                                      }
                                      if (customAddlQty !== preservedCustomAddlQty) {
                                        setCustomAddlQty(preservedCustomAddlQty);
                                      }
                                    }
                                  } else if (preservedCompoundAddlQty !== null && preservedCompoundAddlQty !== undefined && originalParsedQty.isComponentUnit) {
                                    // If we had compoundAddlQty from component unit input (e.g., "25 pkt"), preserve it
                                    // This ensures the alternative quantity shows the user-entered value instead of recalculating
                                    console.log('🔢 Preserving compoundAddlQty from preserved state in onBlur:', {
                                      preservedCompoundAddlQty,
                                      originalIsComponentUnit: originalParsedQty.isComponentUnit,
                                      currentCompoundAddlQty: compoundAddlQty,
                                      input: quantityInput,
                                      validated: validated
                                    });
                                    if (compoundAddlQty !== preservedCompoundAddlQty) {
                                      setCompoundAddlQty(preservedCompoundAddlQty);
                                    }
                                  }

                                  // Use originalParsedQty if it has compound structure, otherwise use parsedQty
                                  // This ensures we preserve the structure from the original input
                                  const qtyForCalculation = (originalParsedQty && originalParsedQty.isCompound && originalParsedQty.qty !== undefined && originalParsedQty.subQty !== undefined)
                                    ? originalParsedQty
                                    : parsedQty;

                                  const primaryQty = convertToPrimaryQty(qtyForCalculation, selectedItemUnitConfig, customConversion || preservedCustomConversion, units);

                                  // For display, use the base quantity (qty) if it's a custom conversion with totalQty
                                  // This ensures "1 box 5 pkt 3 nos" shows as "1 box" not "2 box"
                                  // Also use originalParsedQty if it has compound structure to preserve the structure
                                  let displayQty;
                                  if (originalParsedQty.isCustomConversion && originalParsedQty.totalQty !== undefined) {
                                    displayQty = originalParsedQty.qty;
                                  } else if (originalParsedQty && originalParsedQty.totalQty !== undefined && originalParsedQty.customAddlQty !== undefined && originalParsedQty.customAddlQty !== null) {
                                    // Simple base + compound additional input (e.g., "1 box 9 pkt 2 nos")
                                    // Use only the base quantity (qty) for display, not the total
                                    displayQty = originalParsedQty.qty;
                                  } else if (originalParsedQty && originalParsedQty.isCompound && originalParsedQty.qty !== undefined && originalParsedQty.subQty !== undefined) {
                                    // Preserve compound structure for display
                                    const baseUnitObj = units.find(u => u.NAME === selectedItemUnitConfig.BASEUNITS);
                                    const conversion = baseUnitObj && baseUnitObj.CONVERSION ? parseFloat(baseUnitObj.CONVERSION) : 1;
                                    displayQty = originalParsedQty.qty + (originalParsedQty.subQty / conversion);
                                  } else {

                                    displayQty = primaryQty;
                                  }

                                  // Get decimal places for base unit
                                  let baseUnitDecimal = 0;
                                  if (units && units.length > 0) {
                                    const baseUnit = units.find(u => u.NAME === selectedItemUnitConfig.BASEUNITS);
                                    if (baseUnit) {
                                      baseUnitDecimal = typeof baseUnit.DECIMALPLACES === 'string'
                                        ? parseInt(baseUnit.DECIMALPLACES) || 0
                                        : (baseUnit.DECIMALPLACES || 0);
                                    }
                                  } else if (selectedItemUnitConfig.BASEUNIT_DECIMAL !== undefined) {
                                    baseUnitDecimal = typeof selectedItemUnitConfig.BASEUNIT_DECIMAL === 'string'
                                      ? parseInt(selectedItemUnitConfig.BASEUNIT_DECIMAL) || 0
                                      : (selectedItemUnitConfig.BASEUNIT_DECIMAL || 0);
                                  }

                                  // Format the quantity in BASEUNITS
                                  // If BASEUNITS is compound (like "LTR of 1000 ML"), format as "mainQty-subQty BASEUNIT" (e.g., "2-500.000 LTR")
                                  let baseUnitDisplay;

                                  // Check if originalParsedQty has preserved compound structure (e.g., from "9 pkt 2 nos 3 box")
                                  // Use originalParsedQty instead of parsedQty because validated string might have lost the structure
                                  const qtyToUse = (originalParsedQty && originalParsedQty.isCompound && originalParsedQty.qty !== undefined && originalParsedQty.subQty !== undefined)
                                    ? originalParsedQty
                                    : parsedQty;

                                  if (qtyToUse && qtyToUse.isCompound && qtyToUse.qty !== undefined && qtyToUse.subQty !== undefined) {
                                    // Use the preserved compound structure for display
                                    const baseUnitObj = units.find(u => u.NAME === selectedItemUnitConfig.BASEUNITS);
                                    if (baseUnitObj && baseUnitObj.ISSIMPLEUNIT === 'No') {
                                      // Get decimal places for sub unit
                                      let subDecimalPlaces = 0;
                                      if (baseUnitObj.ADDITIONALUNITS) {
                                        const subUnitObj = units.find(u => u.NAME === baseUnitObj.ADDITIONALUNITS);
                                        if (subUnitObj) {
                                          subDecimalPlaces = typeof subUnitObj.DECIMALPLACES === 'string'
                                            ? parseInt(subUnitObj.DECIMALPLACES) || 0
                                            : (subUnitObj.DECIMALPLACES || 0);
                                        }
                                      }

                                      const formattedSubQty = subDecimalPlaces === 0
                                        ? Math.round(qtyToUse.subQty).toString()
                                        : parseFloat(qtyToUse.subQty).toFixed(subDecimalPlaces);

                                      // Use the base component unit (e.g., "pkt") instead of the full compound unit name
                                      const displayUnit = baseUnitObj.BASEUNITS || selectedItemUnitConfig.BASEUNITS;
                                      baseUnitDisplay = `${Math.round(qtyToUse.qty)}-${formattedSubQty} ${displayUnit}`;

                                      // Also preserve customAddlQty if it exists in the original parsed quantity
                                      if (originalParsedQty && originalParsedQty.customAddlQty !== undefined && originalParsedQty.customAddlQty !== null) {
                                        setCustomAddlQty(originalParsedQty.customAddlQty);
                                      }
                                    } else {

                                      // Fallback to regular formatting
                                      const compoundFormat = formatCompoundBaseUnit(displayQty, selectedItemUnitConfig, units);
                                      if (compoundFormat) {
                                        baseUnitDisplay = compoundFormat;
                                      } else {
                                        const formattedQty = baseUnitDecimal === 0
                                          ? Math.round(displayQty).toString()
                                          : displayQty.toFixed(baseUnitDecimal);
                                        baseUnitDisplay = `${formattedQty} ${selectedItemUnitConfig.BASEUNITS}`;
                                      }
                                    }
                                  } else {

                                    // Use regular formatting (recalculate from total)
                                    const compoundFormat = formatCompoundBaseUnit(displayQty, selectedItemUnitConfig, units);
                                    if (compoundFormat) {
                                      baseUnitDisplay = compoundFormat;
                                    } else {
                                      const formattedQty = baseUnitDecimal === 0
                                        ? Math.round(displayQty).toString()
                                        : displayQty.toFixed(baseUnitDecimal);
                                      baseUnitDisplay = `${formattedQty} ${selectedItemUnitConfig.BASEUNITS}`;
                                    }
                                  }

                                  // Always display in BASEUNITS format (even for custom conversions)
                                  setQuantityInput(baseUnitDisplay);
                                } else {

                                  setQuantityInput(validated || '');
                                }


                                setQuantityFocused(false);
                              }}

                              onFocus={() => setQuantityFocused(true)}

                              disabled={!selectedItem}
                              style={{

                                width: '100%',

                                padding: isMobile ? '12px 16px' : '14px 16px',
                                border: 'none',

                                borderRadius: '8px',
                                fontSize: isMobile ? '14px' : '15px',
                                color: selectedItem ? '#1e293b' : '#9ca3af',
                                outline: 'none',

                                background: selectedItem ? 'transparent' : '#f1f5f9',
                                textAlign: 'left',
                                cursor: selectedItem ? 'text' : 'not-allowed',
                                height: isMobile ? '44px' : '48px',
                                boxSizing: 'border-box',
                                minHeight: isMobile ? '48px' : 'auto'
                              }}

                              placeholder={selectedItemUnitConfig ? `${selectedItemUnitConfig.BASEUNITS || 'Qty'}${selectedItemUnitConfig.ADDITIONALUNITS ? ` or ${selectedItemUnitConfig.ADDITIONALUNITS}` : ''}` : 'Qty'}
                            />

                            <label style={{

                              position: 'absolute',

                              left: isMobile ? '18px' : '20px',

                              top: '-10px',
                              fontSize: isMobile ? '11px' : '12px',
                              fontWeight: '600',

                              color: quantityFocused || quantityInput ? '#3b82f6' : '#64748b',

                              backgroundColor: 'white',

                              padding: '0 8px',

                              transition: 'all 0.2s ease',
                              pointerEvents: 'none',
                              zIndex: 1

                            }}>

                              Qty
                            </label>

                          </div>

                          {/* Alternative unit quantity display (Tally-style) - inline next to quantity */}
                          {selectedItemUnitConfig.ADDITIONALUNITS && (
                            <div style={{
                              flex: isMobile ? '0 0 auto' : '0 0 auto',
                              fontSize: isMobile ? '12px' : '13px',
                              color: '#64748b',
                              fontStyle: 'italic',
                              paddingBottom: isMobile ? '0' : '16px',
                              paddingTop: isMobile ? '4px' : '0',
                              whiteSpace: isMobile ? 'normal' : 'nowrap',
                              minWidth: itemQuantity > 0 ? 'auto' : '0',
                              visibility: itemQuantity > 0 ? 'visible' : 'hidden',
                              width: isMobile ? '100%' : 'auto',
                              textAlign: isMobile ? 'left' : 'left'
                            }}>
                              {(() => {
                                if (itemQuantity > 0) {
                                  // Always convert from BASEUNITS to ADDITIONALUNITS
                                  // Use custom conversion if available
                                  const altQty = convertToAlternativeQty(itemQuantity, selectedItemUnitConfig, units, customConversion);
                                  // If we have customAddlQty (from custom conversion OR compound base + simple additional), use it
                                  // This ensures "9 pkt 3 nos 2 box" shows "(2 box)" instead of converting from total
                                  // Also check compoundAddlQty (from component unit input like "25 pkt" or "55 nos")
                                  // Priority: customAddlQty > compoundAddlQty > calculated altQty
                                  const qtyToDisplay = customAddlQty !== null && customAddlQty !== undefined
                                    ? customAddlQty
                                    : (compoundAddlQty !== null && compoundAddlQty !== undefined ? compoundAddlQty : null);

                                  // Debug log to trace the issue
                                  if (qtyToDisplay !== null && qtyToDisplay !== undefined) {
                                    console.log('💰 Displaying alternative quantity:', {
                                      qtyToDisplay,
                                      customAddlQty,
                                      compoundAddlQty,
                                      itemQuantity,
                                      calculatedAltQty: altQty
                                    });
                                  }

                                  if (qtyToDisplay !== null && qtyToDisplay !== undefined) {
                                    // Check if ADDITIONALUNITS is compound - if so, format in hyphenated format
                                    const addlUnitObj = units && units.length > 0
                                      ? units.find(u => u.NAME === selectedItemUnitConfig.ADDITIONALUNITS)
                                      : null;
                                    const hasCompoundAddlUnit = addlUnitObj && addlUnitObj.ISSIMPLEUNIT === 'No';

                                    console.log('💰 Checking compound additional unit for display:', {
                                      qtyToDisplay,
                                      addlUnitObj: addlUnitObj ? { NAME: addlUnitObj.NAME, ISSIMPLEUNIT: addlUnitObj.ISSIMPLEUNIT } : null,
                                      hasCompoundAddlUnit,
                                      ADDITIONALUNITS: selectedItemUnitConfig.ADDITIONALUNITS
                                    });

                                    if (hasCompoundAddlUnit && addlUnitObj) {
                                      // ADDITIONALUNITS is compound - format in hyphenated format (e.g., "25-0 pkt")
                                      const addlConversion = parseFloat(addlUnitObj.CONVERSION) || 1;
                                      const mainQty = Math.floor(qtyToDisplay);
                                      const subQty = (qtyToDisplay - mainQty) * addlConversion;

                                      // Get decimal places for sub unit
                                      let subDecimalPlaces = 0;
                                      if (addlUnitObj.ADDITIONALUNITS) {
                                        const subUnitObj = units.find(u => u.NAME === addlUnitObj.ADDITIONALUNITS);
                                        if (subUnitObj) {
                                          subDecimalPlaces = typeof subUnitObj.DECIMALPLACES === 'string'
                                            ? parseInt(subUnitObj.DECIMALPLACES) || 0
                                            : (subUnitObj.DECIMALPLACES || 0);
                                        }
                                      }

                                      const formattedSubQty = subDecimalPlaces === 0
                                        ? Math.round(subQty).toString()
                                        : subQty.toFixed(subDecimalPlaces);

                                      // Use the base component unit (e.g., "pkt") instead of the full compound unit name
                                      const displayUnit = addlUnitObj.BASEUNITS || selectedItemUnitConfig.ADDITIONALUNITS;

                                      const formattedDisplay = `(${mainQty}-${formattedSubQty} ${displayUnit})`;
                                      console.log('💰 Formatted compound additional quantity:', {
                                        qtyToDisplay,
                                        mainQty,
                                        subQty,
                                        formattedSubQty,
                                        displayUnit,
                                        formattedDisplay
                                      });

                                      return formattedDisplay;
                                    } else {
                                      // ADDITIONALUNITS is simple - use regular formatting
                                      let decimalPlaces = 0;
                                      if (units && units.length > 0) {
                                        const addlUnit = units.find(u => u.NAME === selectedItemUnitConfig.ADDITIONALUNITS);
                                        if (addlUnit) {
                                          decimalPlaces = typeof addlUnit.DECIMALPLACES === 'string'
                                            ? parseInt(addlUnit.DECIMALPLACES) || 0
                                            : (addlUnit.DECIMALPLACES || 0);
                                        }
                                      } else if (selectedItemUnitConfig.ADDITIONALUNITS_DECIMAL !== undefined) {
                                        decimalPlaces = typeof selectedItemUnitConfig.ADDITIONALUNITS_DECIMAL === 'string'
                                          ? parseInt(selectedItemUnitConfig.ADDITIONALUNITS_DECIMAL) || 0
                                          : (selectedItemUnitConfig.ADDITIONALUNITS_DECIMAL || 0);
                                      }
                                      const formattedQty = decimalPlaces === 0
                                        ? Math.round(qtyToDisplay).toString()
                                        : qtyToDisplay.toFixed(decimalPlaces);
                                      return `(${formattedQty} ${selectedItemUnitConfig.ADDITIONALUNITS})`;
                                    }
                                  }
                                  // Fallback: use calculated alternative quantity
                                  console.log('💰 Using fallback calculated alternative quantity:', {
                                    altQty,
                                    qtyToDisplay,
                                    customAddlQty,
                                    compoundAddlQty
                                  });
                                  return altQty ? `(${altQty.qty} ${altQty.unit})` : '';
                                }
                                return '';
                              })()}
                            </div>
                          )}
                          {/* Helper text showing available units */}
                          {selectedItemUnitConfig && quantityFocused && (
                            <div style={{

                              position: 'absolute',

                              top: '100%',
                              left: 0,
                              right: 0,
                              marginTop: '4px',
                              padding: '8px 12px',
                              backgroundColor: '#f8fafc',
                              borderRadius: '8px',
                              fontSize: '12px',

                              color: '#64748b',
                              border: '1px solid #e2e8f0',
                              zIndex: 1000
                            }}>
                              Examples: {selectedItemUnitConfig.BASEUNITS}{selectedItemUnitConfig.ADDITIONALUNITS ? ` or ${selectedItemUnitConfig.ADDITIONALUNITS}` : ''}{selectedItemUnitConfig.BASEUNITHASCOMPOUNDUNIT === 'Yes' ? `, ${selectedItemUnitConfig.BASEUNITCOMP_BASEUNIT} ${selectedItemUnitConfig.BASEUNITCOMP_ADDLUNIT}` : ''}
                            </div>

                          )}

                        </div>

                      )}



                      {/* Fallback - Old Quantity Input (when no item selected) */}

                      {!selectedItemUnitConfig && (

                        <div style={{ position: 'relative', width: isMobile ? '100%' : 'auto', flex: isMobile ? '1 1 100%' : '0 0 120px', minWidth: isMobile ? '100%' : '100px' }}>

                          <div style={{

                            position: 'relative',

                            background: 'white',

                            borderRadius: '8px',

                            border: '1px solid #e2e8f0',

                            transition: 'all 0.2s ease',

                            boxShadow: isMobile ? '0 1px 2px rgba(0, 0, 0, 0.08)' : '0 1px 2px rgba(0, 0, 0, 0.08)'

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

                                padding: isMobile ? '12px 16px' : '14px 16px',

                                border: 'none',

                                borderRadius: '8px',

                                fontSize: isMobile ? '14px' : '15px',

                                color: selectedItem ? '#111827' : '#9ca3af',

                                outline: 'none',

                                background: selectedItem ? 'transparent' : '#f9fafb',

                                textAlign: 'left',

                                cursor: selectedItem ? 'text' : 'not-allowed',

                                height: isMobile ? '44px' : '48px',

                                boxSizing: 'border-box',

                                fontWeight: '400'

                              }}

                              placeholder="Qty"

                            />

                            <label style={{

                              position: 'absolute',

                              left: isMobile ? '16px' : '16px',

                              top: quantityFocused || itemQuantity > 0 ? '-8px' : '14px',

                              fontSize: quantityFocused || itemQuantity > 0 ? '12px' : (isMobile ? '14px' : '15px'),

                              fontWeight: '500',

                              color: quantityFocused || itemQuantity > 0 ? '#7c3aed' : '#6b7280',

                              backgroundColor: 'white',

                              padding: '0 6px',

                              transition: 'all 0.2s ease',

                              pointerEvents: 'none'

                            }}>

                              Qty

                            </label>

                          </div>

                        </div>

                      )}



                      {/* Available Stock - Only show if user has show_clsstck_Column permission */}

                      {canShowClosingStock && (

                        <div style={{ position: 'relative', width: isMobile ? '100%' : 'auto', flex: isMobile ? '1 1 100%' : '0 0 100px', minWidth: isMobile ? '100%' : '80px', maxWidth: isMobile ? '100%' : '120px', boxSizing: 'border-box' }}>

                          <div style={{

                            position: 'relative',

                            background: '#f8fafc',

                            borderRadius: '8px',

                            border: '1px solid #e2e8f0',

                            boxShadow: isMobile ? '0 1px 3px rgba(0, 0, 0, 0.08)' : '0 1px 3px rgba(0, 0, 0, 0.1)'

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

                                padding: isMobile ? '12px 16px' : '14px 16px',

                                border: 'none',

                                borderRadius: '8px',

                                fontSize: isMobile ? '14px' : '15px',

                                color: '#374151',

                                outline: 'none',

                                background: 'transparent',

                                textAlign: 'center',

                                fontWeight: '500',

                                cursor: canShowStockBreakdown ? 'pointer' : 'default',

                                height: isMobile ? '44px' : '48px',

                                boxSizing: 'border-box',

                                textDecoration: canShowStockBreakdown ? 'underline' : 'none',

                                textDecorationColor: canShowStockBreakdown ? '#7c3aed' : 'transparent',

                                textUnderlineOffset: '2px'

                              }}

                              placeholder=""

                              readOnly

                              onClick={handleStockFieldClick}

                            />

                            <label style={{

                              position: 'absolute',

                              left: isMobile ? '16px' : '16px',

                              top: '-8px',

                              fontSize: '12px',

                              fontWeight: '500',

                              color: '#6b7280',

                              backgroundColor: '#f9fafb',

                              padding: '0 6px',

                              pointerEvents: 'none',

                              zIndex: 1

                            }}>

                              Stock

                            </label>

                          </div>

                        </div>

                      )}



                      {/* Rate with UOM Selector */}
                      {canShowRateAmtColumn && (

                        <>
                          <div style={{ position: 'relative', width: isMobile ? '100%' : 'auto', flex: isMobile ? '1 1 100%' : '0 0 100px', minWidth: isMobile ? '100%' : '80px', maxWidth: isMobile ? '100%' : '120px', boxSizing: 'border-box' }}>
                            <div style={{

                              position: 'relative',

                              background: canEditRate ? 'white' : '#f9fafb',

                              borderRadius: '8px',

                              border: '1px solid #d1d5db',

                              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'

                            }}>

                              <input

                                type="number"

                                value={itemRate}

                                onChange={canEditRate ? (e) => setItemRate(parseFloat(e.target.value) || 0) : undefined}

                                readOnly={!canEditRate}

                                style={{

                                  width: '100%',

                                  padding: isMobile ? '12px 16px' : '14px 16px',

                                  border: 'none',

                                  borderRadius: '8px',

                                  fontSize: isMobile ? '14px' : '15px',

                                  color: canEditRate ? '#111827' : '#6b7280',

                                  outline: 'none',

                                  background: 'transparent',

                                  textAlign: 'center',

                                  fontWeight: '500',

                                  cursor: canEditRate ? 'text' : 'not-allowed',

                                  height: isMobile ? '44px' : '48px',

                                  boxSizing: 'border-box'

                                }}

                                placeholder="Rate"

                              />

                              <label style={{

                                position: 'absolute',

                                left: isMobile ? '16px' : '16px',

                                top: '-8px',

                                fontSize: '12px',

                                fontWeight: '500',

                                color: '#6b7280',

                                backgroundColor: canEditRate ? 'white' : '#f9fafb',

                                padding: '0 6px',

                                pointerEvents: 'none',

                                zIndex: 1

                              }}>

                                Rate

                              </label>

                            </div>

                          </div>

                          {/* Rate UOM Selector - Always show, readonly if only one unit */}
                          {selectedItemUnitConfig && (() => {
                            // Check if BASEUNITS is compound and has component units
                            const baseUnitObj = units && units.length > 0
                              ? units.find(u => u.NAME === selectedItemUnitConfig.BASEUNITS)
                              : null;
                            const hasCompoundBaseUnit = baseUnitObj && baseUnitObj.ISSIMPLEUNIT === 'No';
                            const hasMultipleUnits = selectedItemUnitConfig.ADDITIONALUNITS || hasCompoundBaseUnit;

                            return (
                              <div style={{ position: 'relative', width: isMobile ? '100%' : '120px', flex: isMobile ? '1 1 100%' : '0 0 120px', minWidth: isMobile ? '100%' : '100px', maxWidth: isMobile ? '100%' : '140px', boxSizing: 'border-box' }}>
                                <div style={{
                                  position: 'relative',
                                  background: 'white',
                                  borderRadius: '8px',
                                  border: showRateUOMDropdown ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                                  transition: 'all 0.2s ease',
                                  boxShadow: isMobile ? '0 1px 3px rgba(0, 0, 0, 0.08)' : '0 1px 2px rgba(0, 0, 0, 0.05)',
                                  cursor: hasMultipleUnits ? 'pointer' : 'default'
                                }}
                                  onClick={() => {
                                    if (hasMultipleUnits) {
                                      setShowRateUOMDropdown(!showRateUOMDropdown);
                                    }
                                  }}
                                >
                                  <input
                                    type="text"
                                    value={(() => {
                                      // For compound base units, default to main component if not set
                                      if (hasCompoundBaseUnit && baseUnitObj) {
                                        if (rateUOM === 'component-main') return baseUnitObj.BASEUNITS;
                                        if (rateUOM === 'component-sub') return baseUnitObj.ADDITIONALUNITS;
                                        // Default to main component for compound units
                                        if (!rateUOM || rateUOM === 'base') {
                                          setRateUOM('component-main');
                                          return baseUnitObj.BASEUNITS;
                                        }
                                      }

                                      // Check if ADDITIONALUNITS is compound
                                      const addlUnitObj = units && units.length > 0 && selectedItemUnitConfig.ADDITIONALUNITS
                                        ? units.find(u => u.NAME === selectedItemUnitConfig.ADDITIONALUNITS)
                                        : null;
                                      const hasCompoundAddlUnit = addlUnitObj && addlUnitObj.ISSIMPLEUNIT === 'No';

                                      if (hasCompoundAddlUnit && addlUnitObj) {
                                        // Show component units for compound additional unit
                                        if (rateUOM === 'additional-component-main') return addlUnitObj.BASEUNITS;
                                        if (rateUOM === 'additional-component-sub') return addlUnitObj.ADDITIONALUNITS;
                                        // If rateUOM is 'additional' but ADDITIONALUNITS is compound, default to main component
                                        if (rateUOM === 'additional') {
                                          setRateUOM('additional-component-main');
                                          return addlUnitObj.BASEUNITS;
                                        }
                                      }

                                      // For non-compound units
                                      if (rateUOM === 'base') return selectedItemUnitConfig.BASEUNITS;
                                      return (selectedItemUnitConfig.ADDITIONALUNITS || selectedItemUnitConfig.BASEUNITS);
                                    })()}
                                    readOnly
                                    onFocus={() => {
                                      if (hasMultipleUnits) {
                                        setRateUOMFocused(true);
                                      }
                                    }}
                                    onBlur={() => setTimeout(() => setRateUOMFocused(false), 200)}
                                    style={{
                                      width: '100%',
                                      padding: isMobile ? '14px 36px 14px 16px' : '15px 36px 15px 16px',
                                      border: 'none',
                                      borderRadius: '8px',
                                      fontSize: isMobile ? '14px' : '15px',
                                      color: '#1e293b',
                                      outline: 'none',
                                      background: hasMultipleUnits ? 'transparent' : '#f8fafc',
                                      cursor: hasMultipleUnits ? 'pointer' : 'default',
                                      pointerEvents: 'none',
                                      fontWeight: '500',
                                      height: isMobile ? '44px' : '48px',
                                      padding: isMobile ? '12px 36px 12px 16px' : '14px 36px 14px 16px',
                                      boxSizing: 'border-box'
                                    }}
                                  />
                                  {hasMultipleUnits && (
                                    <span className="material-icons" style={{
                                      position: 'absolute',
                                      right: '10px',
                                      top: '50%',
                                      transform: 'translateY(-50%)',
                                      fontSize: '18px',
                                      color: showRateUOMDropdown ? '#3b82f6' : '#64748b',
                                      transition: 'color 0.2s ease',
                                      pointerEvents: 'none'
                                    }}>
                                      {showRateUOMDropdown ? 'expand_less' : 'expand_more'}
                                    </span>
                                  )}
                                  <label style={{
                                    position: 'absolute',
                                    left: isMobile ? '14px' : '16px',
                                    top: '-9px',
                                    fontSize: isMobile ? '10px' : '11px',
                                    fontWeight: '600',
                                    color: '#3b82f6',
                                    backgroundColor: 'white',
                                    padding: '0 6px',
                                    pointerEvents: 'none',
                                    letterSpacing: '0.3px',
                                    zIndex: 1
                                  }}>
                                    Rate UOM
                                  </label>

                                  {/* Rate UOM Dropdown Menu - Only show if multiple units exist */}
                                  {showRateUOMDropdown && hasMultipleUnits && (
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
                                        maxHeight: '200px',
                                        overflowY: 'auto',
                                        zIndex: 9999,
                                        boxShadow: '0 10px 25px rgba(59, 130, 246, 0.2)'
                                      }}
                                    >
                                      {/* Base Unit Option - Only show if BASEUNITS is NOT compound */}
                                      {!hasCompoundBaseUnit && (
                                        <div
                                          onMouseDown={(e) => e.preventDefault()}
                                          onClick={() => {
                                            setRateUOM('base');
                                            setShowRateUOMDropdown(false);
                                          }}
                                          style={{
                                            padding: '12px 16px',
                                            cursor: 'pointer',
                                            borderBottom: (selectedItemUnitConfig.ADDITIONALUNITS || hasCompoundBaseUnit) ? '1px solid #f1f5f9' : 'none',
                                            transition: 'background-color 0.2s ease',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            backgroundColor: rateUOM === 'base' ? '#eff6ff' : 'white'
                                          }}
                                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = rateUOM === 'base' ? '#eff6ff' : 'white'}
                                        >
                                          <span style={{ fontWeight: '600', color: '#1e293b', fontSize: '14px' }}>
                                            {selectedItemUnitConfig.BASEUNITS}
                                          </span>
                                          <span style={{
                                            fontSize: '11px',
                                            fontWeight: '600',
                                            padding: '2px 8px',
                                            borderRadius: '4px',
                                            backgroundColor: '#dbeafe',
                                            color: '#1e40af'
                                          }}>
                                            Base
                                          </span>
                                        </div>
                                      )}

                                      {/* Component Units for Compound Base Unit (if BASEUNITS is compound) */}
                                      {hasCompoundBaseUnit && baseUnitObj && (
                                        <>
                                          <div
                                            onMouseDown={(e) => e.preventDefault()}
                                            onClick={() => {
                                              setRateUOM('component-main');
                                              setShowRateUOMDropdown(false);
                                            }}
                                            style={{
                                              padding: '12px 16px',
                                              cursor: 'pointer',
                                              borderBottom: (selectedItemUnitConfig.ADDITIONALUNITS || baseUnitObj.ADDITIONALUNITS) ? '1px solid #f1f5f9' : 'none',
                                              transition: 'background-color 0.2s ease',
                                              display: 'flex',
                                              justifyContent: 'space-between',
                                              alignItems: 'center',
                                              backgroundColor: rateUOM === 'component-main' ? '#eff6ff' : 'white'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = rateUOM === 'component-main' ? '#eff6ff' : 'white'}
                                          >
                                            <span style={{ fontWeight: '600', color: '#1e293b', fontSize: '14px' }}>
                                              {baseUnitObj.BASEUNITS}
                                            </span>
                                            <span style={{
                                              fontSize: '11px',
                                              fontWeight: '600',
                                              padding: '2px 8px',
                                              borderRadius: '4px',
                                              backgroundColor: '#fef3c7',
                                              color: '#92400e'
                                            }}>
                                              Component
                                            </span>
                                          </div>
                                          {baseUnitObj.ADDITIONALUNITS && (
                                            <div
                                              onMouseDown={(e) => e.preventDefault()}
                                              onClick={() => {
                                                setRateUOM('component-sub');
                                                setShowRateUOMDropdown(false);
                                              }}
                                              style={{
                                                padding: '12px 16px',
                                                cursor: 'pointer',
                                                borderBottom: selectedItemUnitConfig.ADDITIONALUNITS ? '1px solid #f1f5f9' : 'none',
                                                transition: 'background-color 0.2s ease',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                backgroundColor: rateUOM === 'component-sub' ? '#eff6ff' : 'white'
                                              }}
                                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = rateUOM === 'component-sub' ? '#eff6ff' : 'white'}
                                            >
                                              <span style={{ fontWeight: '600', color: '#1e293b', fontSize: '14px' }}>
                                                {baseUnitObj.ADDITIONALUNITS}
                                              </span>
                                              <span style={{
                                                fontSize: '11px',
                                                fontWeight: '600',
                                                padding: '2px 8px',
                                                borderRadius: '4px',
                                                backgroundColor: '#fef3c7',
                                                color: '#92400e'
                                              }}>
                                                Component
                                              </span>
                                            </div>
                                          )}
                                        </>
                                      )}

                                      {/* Additional Unit Option (if exists) */}
                                      {selectedItemUnitConfig.ADDITIONALUNITS && (() => {
                                        // Check if ADDITIONALUNITS is compound
                                        const addlUnitObj = units && units.length > 0
                                          ? units.find(u => u.NAME === selectedItemUnitConfig.ADDITIONALUNITS)
                                          : null;
                                        const hasCompoundAddlUnit = addlUnitObj && addlUnitObj.ISSIMPLEUNIT === 'No';

                                        if (hasCompoundAddlUnit && addlUnitObj) {
                                          // ADDITIONALUNITS is compound - show component options
                                          return (
                                            <>
                                              <div
                                                onMouseDown={(e) => e.preventDefault()}
                                                onClick={() => {
                                                  setRateUOM('additional-component-main');
                                                  setShowRateUOMDropdown(false);
                                                }}
                                                style={{
                                                  padding: '12px 16px',
                                                  cursor: 'pointer',
                                                  borderBottom: addlUnitObj.ADDITIONALUNITS ? '1px solid #f1f5f9' : 'none',
                                                  transition: 'background-color 0.2s ease',
                                                  display: 'flex',
                                                  justifyContent: 'space-between',
                                                  alignItems: 'center',
                                                  backgroundColor: rateUOM === 'additional-component-main' ? '#eff6ff' : 'white'
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = rateUOM === 'additional-component-main' ? '#eff6ff' : 'white'}
                                              >
                                                <span style={{ fontWeight: '600', color: '#1e293b', fontSize: '14px' }}>
                                                  {addlUnitObj.BASEUNITS}
                                                </span>
                                                <span style={{
                                                  fontSize: '11px',
                                                  fontWeight: '600',
                                                  padding: '2px 8px',
                                                  borderRadius: '4px',
                                                  backgroundColor: '#fef3c7',
                                                  color: '#92400e'
                                                }}>
                                                  Component
                                                </span>
                                              </div>
                                              {addlUnitObj.ADDITIONALUNITS && (
                                                <div
                                                  onMouseDown={(e) => e.preventDefault()}
                                                  onClick={() => {
                                                    setRateUOM('additional-component-sub');
                                                    setShowRateUOMDropdown(false);
                                                  }}
                                                  style={{
                                                    padding: '12px 16px',
                                                    cursor: 'pointer',
                                                    borderBottom: '1px solid #f1f5f9',
                                                    transition: 'background-color 0.2s ease',
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    backgroundColor: rateUOM === 'additional-component-sub' ? '#eff6ff' : 'white'
                                                  }}
                                                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                                                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = rateUOM === 'additional-component-sub' ? '#eff6ff' : 'white'}
                                                >
                                                  <span style={{ fontWeight: '600', color: '#1e293b', fontSize: '14px' }}>
                                                    {addlUnitObj.ADDITIONALUNITS}
                                                  </span>
                                                  <span style={{
                                                    fontSize: '11px',
                                                    fontWeight: '600',
                                                    padding: '2px 8px',
                                                    borderRadius: '4px',
                                                    backgroundColor: '#fef3c7',
                                                    color: '#92400e'
                                                  }}>
                                                    Component
                                                  </span>
                                                </div>
                                              )}
                                            </>
                                          );
                                        } else {
                                          // ADDITIONALUNITS is simple - show full unit
                                          return (
                                            <div
                                              onMouseDown={(e) => e.preventDefault()}
                                              onClick={() => {
                                                setRateUOM('additional');
                                                setShowRateUOMDropdown(false);
                                              }}
                                              style={{
                                                padding: '12px 16px',
                                                cursor: 'pointer',
                                                transition: 'background-color 0.2s ease',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                backgroundColor: rateUOM === 'additional' ? '#eff6ff' : 'white'
                                              }}
                                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = rateUOM === 'additional' ? '#eff6ff' : 'white'}
                                            >
                                              <span style={{ fontWeight: '600', color: '#1e293b', fontSize: '14px' }}>
                                                {selectedItemUnitConfig.ADDITIONALUNITS}
                                              </span>
                                              <span style={{
                                                fontSize: '11px',
                                                fontWeight: '600',
                                                padding: '2px 8px',
                                                borderRadius: '4px',
                                                backgroundColor: '#dbeafe',
                                                color: '#1e40af'
                                              }}>
                                                Additional
                                              </span>
                                            </div>
                                          );
                                        }
                                      })()}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })()}
                        </>
                      )}



                      {/* Discount */}

                      {canShowRateAmtColumn && canShowDiscColumn && (

                        <div style={{ position: 'relative', width: isMobile ? '100%' : 'auto', flex: isMobile ? '1 1 100%' : '0 0 80px', minWidth: isMobile ? '100%' : '70px', maxWidth: isMobile ? '100%' : '100px' }}>

                          <div style={{

                            position: 'relative',

                            background: canEditDiscount ? 'white' : '#f9fafb',

                            borderRadius: '8px',

                            border: '1px solid #e2e8f0',

                            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'

                          }}>

                            <input

                              type="number"

                              value={itemDiscountPercent}

                              onChange={canEditDiscount ? (e) => setItemDiscountPercent(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0))) : undefined}

                              readOnly={!canEditDiscount}

                              style={{

                                width: '100%',

                                padding: isMobile ? '12px 16px' : '14px 16px',

                                border: 'none',

                                borderRadius: '8px',

                                fontSize: isMobile ? '14px' : '15px',

                                color: canEditDiscount ? '#111827' : '#6b7280',

                                outline: 'none',

                                background: 'transparent',

                                textAlign: 'center',

                                fontWeight: '500',

                                cursor: canEditDiscount ? 'text' : 'not-allowed',

                                height: isMobile ? '44px' : '48px',

                                boxSizing: 'border-box'

                              }}

                              placeholder="Disc %"

                            />

                            <label style={{

                              position: 'absolute',

                              left: isMobile ? '16px' : '16px',

                              top: '-8px',

                              fontSize: '12px',

                              fontWeight: '500',

                              color: '#6b7280',

                              backgroundColor: canEditDiscount ? 'white' : '#f9fafb',

                              padding: '0 6px',

                              pointerEvents: 'none',

                              zIndex: 1

                            }}>

                              Disc %

                            </label>

                          </div>

                        </div>

                      )}



                      {/* GST */}

                      {canShowRateAmtColumn && (

                        <div style={{ position: 'relative', width: isMobile ? '100%' : 'auto', flex: isMobile ? '1 1 100%' : '0 0 80px', minWidth: isMobile ? '100%' : '70px', maxWidth: isMobile ? '100%' : '100px' }}>

                          <div style={{

                            position: 'relative',

                            background: '#f8fafc',

                            borderRadius: '8px',

                            border: '1px solid #e2e8f0',

                            boxShadow: isMobile ? '0 1px 3px rgba(0, 0, 0, 0.08)' : '0 1px 3px rgba(0, 0, 0, 0.1)'

                          }}>

                            <input

                              type="number"

                              value={itemGstPercent}

                              style={{

                                width: '100%',

                                padding: isMobile ? '12px 16px' : '14px 16px',

                                border: 'none',

                                borderRadius: '8px',

                                fontSize: isMobile ? '14px' : '15px',

                                color: '#374151',

                                outline: 'none',

                                background: 'transparent',

                                textAlign: 'center',

                                fontWeight: '500',

                                height: isMobile ? '44px' : '48px',

                                boxSizing: 'border-box'

                              }}

                              placeholder="GST %"

                              readOnly

                            />

                            <label style={{

                              position: 'absolute',

                              left: isMobile ? '16px' : '16px',

                              top: '-8px',

                              fontSize: '12px',

                              fontWeight: '500',

                              color: '#6b7280',

                              backgroundColor: '#f9fafb',

                              padding: '0 6px',

                              pointerEvents: 'none',

                              zIndex: 1

                            }}>

                              GST %

                            </label>

                          </div>

                        </div>

                      )}



                      {/* Amount Display */}

                      {canShowRateAmtColumn && (

                        <div style={{

                          padding: isMobile ? '14px 20px' : '16px 20px',

                          background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',

                          borderRadius: '8px',

                          border: '1px solid #0ea5e9',

                          fontSize: isMobile ? '15px' : '16px',

                          fontWeight: '700',

                          color: '#0369a1',

                          textAlign: 'center',

                          width: isMobile ? '100%' : 'auto',

                          minWidth: isMobile ? '100%' : '110px',

                          boxSizing: 'border-box',

                          boxShadow: isMobile ? '0 2px 6px rgba(14, 165, 233, 0.25)' : '0 2px 4px rgba(14, 165, 233, 0.2)'

                        }}>

                          ₹{itemAmount.toFixed(2)}

                        </div>

                      )}



                      {/* Add Button */}

                      <button

                        type="button"

                        onClick={addOrderItem}

                        disabled={!selectedItem || itemQuantity <= 0 || !stockItemNames.has(selectedItem)}

                        style={{

                          background: editingItemId ? 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',

                          color: 'white',

                          border: 'none',

                          borderRadius: '8px',

                          padding: isMobile ? '12px 20px' : '12px 24px',

                          height: isMobile ? '44px' : '48px',

                          cursor: (!selectedItem || itemQuantity <= 0 || !stockItemNames.has(selectedItem)) ? 'not-allowed' : 'pointer',

                          fontSize: isMobile ? '14px' : '15px',

                          fontWeight: '600',

                          transition: 'all 0.2s ease',

                          opacity: (!selectedItem || itemQuantity <= 0 || !stockItemNames.has(selectedItem)) ? 0.5 : 1,

                          boxShadow: '0 2px 4px rgba(16, 185, 129, 0.2)',

                          display: 'flex',

                          alignItems: 'center',

                          gap: '8px',

                          minWidth: isMobile ? '100%' : '120px',

                          width: isMobile ? '100%' : 'auto',

                          justifyContent: 'center',

                          boxSizing: 'border-box'

                        }}

                      >

                        <span className="material-icons" style={{ fontSize: '18px' }}>

                          {editingItemId ? 'edit' : 'add'}

                        </span>

                        {editingItemId ? 'Update Item' : 'Add Item'}

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

                            width: isMobile ? '100%' : '34%',

                            maxWidth: isMobile ? '100%' : '600px',
                            boxSizing: 'border-box',
                            minWidth: isMobile ? '0' : 'auto'

                          }}>

                            <div style={{

                              position: 'relative',

                              background: 'white',

                              borderRadius: isMobile ? '10px' : '12px',

                              border: '2px solid #e2e8f0',

                              transition: 'all 0.2s ease',

                              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                              width: '100%',
                              maxWidth: '100%',
                              boxSizing: 'border-box'

                            }}>

                              <textarea

                                value={itemDescription}

                                onChange={(e) => setItemDescription(e.target.value)}

                                onFocus={() => setDescriptionFocused(true)}

                                onBlur={() => setDescriptionFocused(false)}

                                style={{

                                  width: '100%',

                                  padding: isMobile ? '14px 18px' : '16px 20px',

                                  border: 'none',

                                  borderRadius: isMobile ? '10px' : '12px',

                                  fontSize: isMobile ? '14px' : '15px',

                                  color: '#1e293b',

                                  outline: 'none',

                                  background: 'transparent',

                                  resize: 'vertical',

                                  minHeight: isMobile ? '80px' : '60px',

                                  fontFamily: 'inherit',
                                  boxSizing: 'border-box',
                                  maxWidth: '100%'

                                }}

                                placeholder="Enter item description (optional)"

                              />

                              <label style={{

                                position: 'absolute',

                                left: isMobile ? '18px' : '20px',

                                top: descriptionFocused || itemDescription ? '-10px' : (isMobile ? '14px' : '16px'),

                                fontSize: descriptionFocused || itemDescription ? '12px' : (isMobile ? '14px' : '15px'),

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
                </div>
              </div>
            </div>
            {/* End of Order Items Section Header */}

          </form>

          {/* Order Items Table */}

          {orderItems.length === 0 && (
            <div style={{
              border: '2px dashed #e5e7eb',
              borderRadius: '12px',
              padding: isMobile ? '40px 20px' : '60px 40px',
              textAlign: 'center',
              backgroundColor: '#fafafa',
              marginTop: '16px'
            }}>
              <div style={{
                width: '64px',
                height: '64px',
                margin: '0 auto 16px',
                backgroundColor: '#f3f4f6',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '32px',
                color: '#9ca3af'
              }}>
                📦
              </div>
              <p style={{
                margin: '0 0 8px 0',
                fontSize: isMobile ? '16px' : '18px',
                fontWeight: '600',
                color: '#374151'
              }}>
                No items added yet
              </p>
              <p style={{
                margin: 0,
                fontSize: isMobile ? '14px' : '15px',
                color: '#6b7280'
              }}>
                Search and add items to start creating your order.
              </p>
            </div>
          )}

          {orderItems.length > 0 && (

            <div className="table-container" style={{
              padding: isMobile ? '0' : '2px 2px',
              width: '100%',
              maxWidth: '100%',
              boxSizing: 'border-box',
              overflowX: isMobile || isTablet ? 'auto' : 'visible',
              overflowY: 'visible',
              position: 'relative',
              marginTop: '1rem',
              WebkitOverflowScrolling: 'touch'
            }}>

              <div style={{
                boxSizing: 'border-box',
                position: 'relative'
              }}>

                {/* Table Header - Hidden on mobile, shown on desktop */}
                {!isMobile && (
                  <div style={{

                    display: 'grid',

                    gridTemplateColumns: getGridTemplateColumns(),

                    gap: '12px',

                    padding: '10px 8px 10px 16px',

                    backgroundColor: '#f8fafc',

                    borderBottom: '2px solid #e2e8f0',

                    fontWeight: '700',

                    color: '#475569',

                    fontSize: '14px',

                    letterSpacing: '0.025em',

                    minWidth: 0,
                    boxSizing: 'border-box'

                  }}>

                    <div style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      minWidth: 0,
                      maxWidth: isMobile ? '90px' : 'none'
                    }}>Item Name</div>

                    <div style={{ textAlign: 'center', minWidth: 0 }}>Qty</div>

                    {canShowClosingStock && <div style={{ textAlign: 'center', minWidth: 0 }}>Stock</div>}

                    {canShowRateAmtColumn && <div style={{ textAlign: 'right', minWidth: 0 }}>Rate</div>}

                    {canShowRateAmtColumn && <div style={{ textAlign: 'center', minWidth: 0 }}>Rate UOM</div>}

                    {canShowRateAmtColumn && canShowDiscColumn && <div style={{ textAlign: 'center', minWidth: 0 }}>Disc %</div>}

                    {canShowRateAmtColumn && <div style={{ textAlign: 'center', minWidth: 0 }}>GST %</div>}

                    {canShowRateAmtColumn && <div style={{ textAlign: 'right', minWidth: 0 }}>Amount</div>}

                    <div style={{ textAlign: 'center', minWidth: 0 }}>Actions</div>

                  </div>
                )}

                {/* Mobile Header - Simple title with item count */}
                {isMobile && (
                  <div style={{
                    padding: '12px 16px',
                    backgroundColor: '#f8fafc',
                    borderBottom: '2px solid #e2e8f0',
                    fontWeight: '700',
                    color: '#475569',
                    fontSize: '14px'
                  }}>
                    Order Items ({orderItems.length})
                  </div>
                )}

                {/* Table Rows (Desktop) / Card Layout (Mobile) */}

                {orderItems.map((item, index) => {
                  // Get stock value for display
                  const selectedStockItem = stockItems.find(stockItem => stockItem.NAME === item.name);
                  const stockValue = selectedStockItem ? (canShowClosingStockYesNo ? (selectedStockItem.CLOSINGSTOCK || 0) > 0 ? 'Yes' : 'No' : selectedStockItem.CLOSINGSTOCK || 0) : '';

                  // Get rate UOM display
                  const getRateUOMDisplay = () => {
                    if (!item.unitConfig || !item.rateUOM) return '';
                    const baseUnitObj = units && units.length > 0
                      ? units.find(u => u.NAME === item.unitConfig.BASEUNITS)
                      : null;
                    const hasCompoundBaseUnit = baseUnitObj && baseUnitObj.ISSIMPLEUNIT === 'No';

                    if (hasCompoundBaseUnit && baseUnitObj) {
                      if (item.rateUOM === 'component-main') return baseUnitObj.BASEUNITS;
                      if (item.rateUOM === 'component-sub') return baseUnitObj.ADDITIONALUNITS;
                    }

                    const addlUnitObj = units && units.length > 0 && item.unitConfig.ADDITIONALUNITS
                      ? units.find(u => u.NAME === item.unitConfig.ADDITIONALUNITS)
                      : null;
                    const hasCompoundAddlUnit = addlUnitObj && addlUnitObj.ISSIMPLEUNIT === 'No';

                    if (hasCompoundAddlUnit && addlUnitObj) {
                      if (item.rateUOM === 'additional-component-main') return addlUnitObj.BASEUNITS;
                      if (item.rateUOM === 'additional-component-sub') return addlUnitObj.ADDITIONALUNITS;
                    }

                    if (item.rateUOM === 'base') return item.unitConfig.BASEUNITS;
                    if (item.rateUOM === 'additional') return item.unitConfig.ADDITIONALUNITS;
                    return item.unitConfig.BASEUNITS || '';
                  };

                  // Mobile Card Layout
                  if (isMobile) {
                    return (
                      <div
                        key={item.id}
                        style={{
                          padding: '12px',
                          margin: '8px',
                          backgroundColor: '#ffffff',
                          borderRadius: '12px',
                          border: '1px solid #e2e8f0',
                          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                          width: 'calc(100% - 16px)',
                          boxSizing: 'border-box'
                        }}
                      >
                        {/* Primary Row: Item Name + Amount */}
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          marginBottom: '8px',
                          gap: '8px'
                        }}>
                          <div style={{
                            flex: 1,
                            minWidth: 0
                          }}>
                            <div style={{
                              fontWeight: '700',
                              color: '#1e293b',
                              fontSize: '15px',
                              marginBottom: item.description ? '4px' : '0',
                              wordBreak: 'break-word',
                              lineHeight: '1.3'
                            }}>
                              {item.name}
                            </div>
                            {item.description && (
                              <div style={{
                                fontSize: '12px',
                                color: '#64748b',
                                fontWeight: '400',
                                fontStyle: 'italic',
                                lineHeight: '1.3',
                                marginTop: '4px'
                              }}>
                                {item.description}
                              </div>
                            )}
                          </div>
                          {canShowRateAmtColumn && (
                            <div style={{
                              fontWeight: '700',
                              color: '#059669',
                              fontSize: '18px',
                              whiteSpace: 'nowrap',
                              flexShrink: 0
                            }}>
                              ₹{item.amount.toFixed(2)}
                            </div>
                          )}
                        </div>

                        {/* Secondary Row: Qty, Rate, GST */}
                        <div style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '12px',
                          marginBottom: '8px',
                          fontSize: '13px',
                          color: '#475569'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ fontWeight: '600', color: '#64748b' }}>Qty:</span>
                            <span style={{ fontWeight: '600', color: '#059669' }}>
                              {item.quantityDisplay || `${item.quantity} ${item.unitConfig?.BASEUNITS || ''}`}
                            </span>
                            {item.altQtyDisplay && (
                              <span style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>
                                ({item.altQtyDisplay})
                              </span>
                            )}
                          </div>
                          {canShowRateAmtColumn && (
                            <>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span style={{ fontWeight: '600', color: '#64748b' }}>Rate:</span>
                                <span style={{ fontWeight: '600', color: '#dc2626' }}>₹{item.rate.toFixed(2)}</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span style={{ fontWeight: '600', color: '#64748b' }}>GST:</span>
                                <span style={{ fontWeight: '600', color: '#ea580c' }}>{item.gstPercent}%</span>
                              </div>
                            </>
                          )}
                        </div>

                        {/* Tertiary Row: Stock, Rate UOM, Disc % */}
                        {(canShowClosingStock || (canShowRateAmtColumn && getRateUOMDisplay()) || (canShowRateAmtColumn && canShowDiscColumn && item.discountPercent)) && (
                          <div style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '12px',
                            marginBottom: '8px',
                            fontSize: '12px',
                            color: '#64748b'
                          }}>
                            {canShowClosingStock && stockValue !== '' && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span style={{ fontWeight: '500' }}>Stock:</span>
                                <span style={{ fontWeight: '600', color: '#7c3aed' }}>{stockValue}</span>
                              </div>
                            )}
                            {canShowRateAmtColumn && getRateUOMDisplay() && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span style={{ fontWeight: '500' }}>UOM:</span>
                                <span style={{ fontWeight: '600' }}>{getRateUOMDisplay()}</span>
                              </div>
                            )}
                            {canShowRateAmtColumn && canShowDiscColumn && item.discountPercent > 0 && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span style={{ fontWeight: '500' }}>Disc:</span>
                                <span style={{ fontWeight: '600', color: '#0ea5e9' }}>{item.discountPercent || 0}%</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Actions Row */}
                        <div style={{
                          display: 'flex',
                          justifyContent: 'flex-end',
                          gap: '8px',
                          marginTop: '8px',
                          paddingTop: '8px',
                          borderTop: '1px solid #f1f5f9'
                        }}>
                          <button
                            type="button"
                            onClick={() => startEditItem(index)}
                            style={{
                              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                              color: 'white',
                              border: 'none',
                              borderRadius: '8px',
                              padding: '8px 16px',
                              cursor: 'pointer',
                              fontSize: '13px',
                              fontWeight: '600',
                              transition: 'all 0.2s ease',
                              boxShadow: '0 2px 4px rgba(59, 130, 246, 0.2)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              minHeight: '44px'
                            }}
                            title="Edit item"
                          >
                            <span className="material-icons" style={{ fontSize: '18px' }}>edit</span>
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => removeOrderItem(item.id)}
                            style={{
                              background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                              color: 'white',
                              border: 'none',
                              borderRadius: '8px',
                              padding: '8px 16px',
                              cursor: 'pointer',
                              fontSize: '13px',
                              fontWeight: '600',
                              transition: 'all 0.2s ease',
                              boxShadow: '0 2px 4px rgba(239, 68, 68, 0.2)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              minHeight: '44px'
                            }}
                            title="Remove item"
                          >
                            <span className="material-icons" style={{ fontSize: '18px' }}>delete_outline</span>
                            <span>Delete</span>
                          </button>
                        </div>
                      </div>
                    );
                  }

                  // Desktop Grid Table Layout
                  return (
                    <div key={item.id} style={{

                      display: 'grid',

                      gridTemplateColumns: getGridTemplateColumns(),

                      gap: '12px',

                      padding: '12px 8px 12px 16px',

                      borderBottom: '1px solid #f1f5f9',

                      alignItems: 'center',

                      fontSize: '14px',

                      color: '#1e293b',

                      transition: 'background-color 0.2s ease',

                      minWidth: 0,
                      width: '100%',
                      boxSizing: 'border-box'

                    }}

                      onMouseEnter={(e) => {

                        e.currentTarget.style.backgroundColor = '#f8fafc';

                      }}

                      onMouseLeave={(e) => {

                        e.currentTarget.style.backgroundColor = 'transparent';

                      }}

                    >

                      <div style={{

                        fontWeight: '600',

                        color: '#1e293b',

                        fontSize: '15px',

                        overflow: 'hidden',

                        wordBreak: 'break-word',

                        lineHeight: '1.2',

                        minWidth: 0

                      }}>

                        {item.name}

                        {item.description && (

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

                        )}

                      </div>

                      <div style={{

                        textAlign: 'center',

                        fontWeight: '600',

                        color: '#059669',

                        display: 'flex',

                        flexDirection: 'column',

                        alignItems: 'center',

                        gap: '2px',
                        minWidth: 0

                      }}>

                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontWeight: '600', color: '#1e293b' }}>
                            {item.quantityDisplay || `${item.quantity} ${item.unitConfig?.BASEUNITS || ''}`}
                          </div>
                          {item.altQtyDisplay && (
                            <div style={{
                              fontSize: '12px',
                              color: '#64748b',
                              fontStyle: 'italic',
                              marginTop: '2px'
                            }}>
                              ({item.altQtyDisplay})
                            </div>
                          )}
                        </div>

                      </div>

                      {canShowClosingStock && (

                        <div style={{

                          textAlign: 'center',

                          fontWeight: '600',

                          color: '#7c3aed',
                          minWidth: 0

                        }}>

                          {stockValue !== '' ? stockValue : ''}

                        </div>

                      )}

                      {canShowRateAmtColumn && (

                        <div style={{

                          textAlign: 'right',

                          fontWeight: '600',

                          color: '#dc2626',
                          minWidth: 0

                        }}>

                          ₹{item.rate.toFixed(2)}

                        </div>

                      )}

                      {canShowRateAmtColumn && (

                        <div style={{

                          textAlign: 'center',

                          fontWeight: '500',

                          color: '#64748b',

                          fontSize: '13px',

                          position: 'relative',
                          minWidth: 0

                        }}>

                          {getRateUOMDisplay()}

                        </div>

                      )}

                      {canShowRateAmtColumn && canShowDiscColumn && (

                        <div style={{

                          textAlign: 'center',

                          fontWeight: '600',

                          color: '#0ea5e9',
                          minWidth: 0

                        }}>

                          {item.discountPercent || 0}%

                        </div>

                      )}

                      {canShowRateAmtColumn && (

                        <div style={{

                          textAlign: 'center',

                          fontWeight: '600',

                          color: '#ea580c',
                          minWidth: 0

                        }}>

                          {item.gstPercent}%

                        </div>

                      )}

                      {canShowRateAmtColumn && (

                        <div style={{

                          textAlign: 'right',

                          fontWeight: '700',

                          color: '#059669',

                          fontSize: '15px',
                          minWidth: 0

                        }}>

                          ₹{item.amount.toFixed(2)}

                        </div>

                      )}

                      <div style={{
                        textAlign: 'center',
                        display: 'flex',
                        gap: '6px',
                        justifyContent: 'center',
                        alignItems: 'center',
                        minWidth: '80px',
                        maxWidth: '80px',
                        padding: '4px 0'
                      }}>
                        <button
                          type="button"
                          onClick={() => startEditItem(index)}
                          style={{
                            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '6px',
                            height: '32px',
                            width: '32px',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            boxShadow: '0 2px 4px rgba(59, 130, 246, 0.2)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxSizing: 'border-box',
                            flexShrink: 0
                          }}
                          title="Edit item"
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-1px)';
                            e.currentTarget.style.boxShadow = '0 4px 6px rgba(59, 130, 246, 0.3)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 2px 4px rgba(59, 130, 246, 0.2)';
                          }}
                        >
                          <span className="material-icons" style={{ fontSize: '16px' }}>edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => removeOrderItem(item.id)}
                          style={{
                            background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '6px',
                            height: '32px',
                            width: '32px',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            boxShadow: '0 2px 4px rgba(239, 68, 68, 0.2)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxSizing: 'border-box',
                            flexShrink: 0
                          }}
                          title="Remove item"
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-1px)';
                            e.currentTarget.style.boxShadow = '0 4px 6px rgba(239, 68, 68, 0.3)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 2px 4px rgba(239, 68, 68, 0.2)';
                          }}
                        >
                          <span className="material-icons" style={{ fontSize: '16px' }}>delete_outline</span>
                        </button>
                      </div>

                    </div>
                  );
                })}

                {/* Totals Row */}

                {(() => {

                  const totals = calculateTotals();

                  // Mobile Card Style Totals
                  if (isMobile) {
                    return (
                      <div style={{
                        padding: '16px',
                        margin: '8px',
                        background: 'linear-gradient(135deg, #1e40af 0%, #1d4ed8 100%)',
                        borderRadius: '12px',
                        color: 'white',
                        boxShadow: '0 2px 8px rgba(30, 64, 175, 0.3)'
                      }}>
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '8px'
                        }}>
                          <div style={{
                            fontSize: '16px',
                            fontWeight: '700'
                          }}>
                            Total ({orderItems.length} {orderItems.length === 1 ? 'item' : 'items'})
                          </div>
                          {canShowRateAmtColumn && (
                            <div style={{
                              fontSize: '24px',
                              fontWeight: '700'
                            }}>
                              ₹{totals.totalAmount.toFixed(2)}
                            </div>
                          )}
                        </div>
                        {totals.canShowQuantityTotal && (
                          <div style={{
                            fontSize: '14px',
                            opacity: 0.9,
                            marginTop: '4px'
                          }}>
                            Total Qty: {totals.totalQuantity}
                          </div>
                        )}
                      </div>
                    );
                  }

                  // Desktop Grid Totals
                  return (
                    <div style={{

                      display: 'grid',

                      gridTemplateColumns: getGridTemplateColumns(),

                      gap: '12px',

                      padding: '12px 8px 12px 16px',

                      background: 'linear-gradient(135deg, #1e40af 0%, #1d4ed8 100%)',

                      color: 'white',

                      fontWeight: '700',

                      fontSize: '12px',

                      borderTop: '2px solid #3b82f6',

                      borderRadius: '0',
                      minWidth: 0,
                      width: '100%',
                      boxSizing: 'border-box'

                    }}>

                      <div style={{
                        fontSize: '18px',
                        minWidth: 0,
                        overflow: 'hidden',
                        wordBreak: 'break-word',
                        whiteSpace: 'nowrap',
                        textOverflow: 'ellipsis'
                      }}>OrderTotal ({orderItems.length} items selected)</div>

                      <div style={{
                        textAlign: 'center',
                        fontSize: '18px',
                        minWidth: 0
                      }}>
                        {totals.canShowQuantityTotal ? totals.totalQuantity : '-'}
                      </div>

                      {canShowClosingStock && <div style={{ textAlign: 'center', minWidth: 0 }}>-</div>}

                      {canShowRateAmtColumn && <div style={{ textAlign: 'right', minWidth: 0 }}>-</div>}

                      {canShowRateAmtColumn && <div style={{ textAlign: 'center', minWidth: 0 }}>-</div>}

                      {canShowRateAmtColumn && canShowDiscColumn && <div style={{ textAlign: 'center', minWidth: 0 }}>-</div>}

                      {canShowRateAmtColumn && <div style={{ textAlign: 'center', minWidth: 0 }}>-</div>}

                      {canShowRateAmtColumn && (

                        <div style={{
                          textAlign: 'right',
                          fontSize: '20px',
                          color: '#fbbf24',
                          fontWeight: '700',
                          minWidth: 0
                        }}>

                          ₹{totals.totalAmount.toFixed(2)}

                        </div>

                      )}

                      <div style={{ minWidth: 0 }}></div>

                    </div>

                  );

                })()}

              </div>

            </div>

          )}

        </div>
        {/* End of Left Content Area */}

        {/* Right Sidebar */}
        <div style={{
          flex: isMobile || isTablet || isSmallDesktop ? '1 1 100%' : isMedium ? '0 0 360px' : '0 0 380px',
          width: isMobile || isTablet || isSmallDesktop ? '100%' : isMedium ? '360px' : '380px',
          maxWidth: '100%',
          position: isMobile || isTablet || isSmallDesktop ? 'relative' : 'sticky',
          top: isMobile || isTablet || isSmallDesktop ? 'auto' : '8px',
          alignSelf: isMobile || isTablet || isSmallDesktop ? 'auto' : 'flex-start',
          maxHeight: isMobile || isTablet || isSmallDesktop ? 'none' : 'calc(100vh - 48px)',
          overflowY: isMobile || isTablet || isSmallDesktop ? 'visible' : 'auto',
          padding: isMobile ? '8px 16px 16px 16px' : isTablet ? '8px 20px 20px 20px' : isSmallDesktop ? '8px 20px 20px 20px' : '8px 24px 24px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: isMobile ? '16px' : '20px',
          boxSizing: 'border-box'
        }}>
          {/* Transaction Summary */}
          <div style={{
            background: '#fff',
            borderRadius: '0.75rem',
            border: '1px solid #e2e8f0',
            padding: isMobile ? '16px' : isTablet ? '20px' : isSmallDesktop ? '20px' : '24px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
            transition: 'all 0.2s ease',
            maxWidth: '100%',
            boxSizing: 'border-box'
          }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.08)';
            }}>
            <h3 style={{
              margin: '0 0 16px 0',
              fontSize: isMobile ? '16px' : '18px',
              fontWeight: '600',
              color: '#1f2937'
            }}>
              Transaction Summary
            </h3>
            {(() => {
              const totals = calculateTotals();
              const subtotal = totals.totalAmount;

              // Get current company and customer for state comparison
              const currentCompany = filteredCompanies.find(c => c.guid === company);
              const selectedCustomerObj = customerOptions.find(c => c.NAME === selectedCustomer);
              // Company state from user-connections API response (statename field, lowercase)
              const companyState = currentCompany?.statename || currentCompany?.STATENAME || currentCompany?.state || '';
              // Customer state from customer options (STATENAME field, uppercase)
              const customerState = selectedCustomerObj?.STATENAME || editableState || '';
              const isSameState = companyState && customerState && companyState.toLowerCase().trim() === customerState.toLowerCase().trim();

              // Helper function to determine GSTDUTYHEAD from ledger name
              const getGSTDUTYHEAD = (ledgerName) => {
                const nameUpper = (ledgerName || '').toUpperCase();
                if (nameUpper.includes('CGST')) return 'CGST';
                if (nameUpper.includes('SGST') || nameUpper.includes('UTGST')) return 'SGST/UTGST';
                if (nameUpper.includes('IGST')) return 'IGST';
                return null;
              };

              // Helper function to check if ledger should be calculated based on state
              const shouldCalculateLedger = (ledger) => {
                const gstDutyHead = getGSTDUTYHEAD(ledger.NAME);
                if (!gstDutyHead) return false;

                if (isSameState) {
                  // Same state: Calculate CGST and SGST/UTGST
                  return gstDutyHead === 'CGST' || gstDutyHead === 'SGST/UTGST';
                } else {
                  // Different states: Calculate IGST
                  return gstDutyHead === 'IGST';
                }
              };

              // Calculate GST for each GST ledger
              const gstLedgers = selectedClassLedgers.filter(
                ledger => ledger.METHODTYPE === 'GST' && shouldCalculateLedger(ledger)
              );

              const gstAmounts = {};
              gstLedgers.forEach(ledger => {
                const gstDutyHead = getGSTDUTYHEAD(ledger.NAME);
                const rateOfTaxCalc = parseFloat(ledger.RATEOFTAXCALCULATION || '0');
                let totalGST = 0;

                orderItems.forEach(item => {
                  const itemGstPercent = parseFloat(item.gstPercent || 0);

                  if (itemGstPercent > 0) {
                    // Item amount is already calculated as: rate * quantity * (1 - discount%)
                    // This is the taxable amount (after discount, before GST)
                    const itemTaxableAmount = parseFloat(item.amount || 0);

                    if (rateOfTaxCalc === 0) {
                      // RATEOFTAXCALCULATION = 0: Take all item tax
                      let effectiveGstRate = itemGstPercent;

                      // For CGST/SGST, split the rate (18% -> 9% each)
                      // For IGST, use full rate (18% -> 18%)
                      if (gstDutyHead === 'CGST' || gstDutyHead === 'SGST/UTGST') {
                        effectiveGstRate = itemGstPercent / 2;
                      }
                      // For IGST, use full rate (no division)

                      const itemGST = (itemTaxableAmount * effectiveGstRate) / 100;
                      totalGST += itemGST;
                    } else {
                      // RATEOFTAXCALCULATION != 0: Only items with matching rate
                      // RATEOFTAXCALCULATION stores the split rate (e.g., 9 for CGST/SGST, 18 for IGST)
                      const matchingRate = rateOfTaxCalc;

                      // Check if item's GST rate matches
                      // For CGST/SGST, compare split rate (item 18% should match ledger 9%)
                      // For IGST, compare full rate (item 18% should match ledger 18%)
                      if (gstDutyHead === 'CGST' || gstDutyHead === 'SGST/UTGST') {
                        // For CGST/SGST, ledger rate is split, so compare with item rate / 2
                        if (Math.abs((itemGstPercent / 2) - matchingRate) < 0.01) {
                          const itemGST = (itemTaxableAmount * matchingRate) / 100;
                          totalGST += itemGST;
                        }
                      } else {
                        // For IGST, compare full rates
                        if (Math.abs(itemGstPercent - matchingRate) < 0.01) {
                          const itemGST = (itemTaxableAmount * matchingRate) / 100;
                          totalGST += itemGST;
                        }
                      }
                    }
                  }
                });

                gstAmounts[ledger.NAME] = totalGST;
              });

              // Calculate total ledger values (only user-defined ones that have values)
              const totalLedgerValues = Object.values(ledgerValues).reduce((sum, value) => {
                return sum + (parseFloat(value) || 0);
              }, 0);

              // Calculate flat rate ledger amounts (METHODTYPE = "As Flat Rate")
              const flatRateLedgers = selectedClassLedgers.filter(
                ledger => ledger.METHODTYPE === 'As Flat Rate'
              );
              const flatRateAmounts = {};
              flatRateLedgers.forEach(ledger => {
                const classRate = parseFloat(ledger.CLASSRATE || '0');
                flatRateAmounts[ledger.NAME] = classRate;
              });
              const totalFlatRate = Object.values(flatRateAmounts).reduce((sum, value) => sum + (parseFloat(value) || 0), 0);

              // Calculate "Based on Quantity" ledger amounts (METHODTYPE = "Based on Quantity")
              // Value = Total qty * CLASSRATE
              const basedOnQuantityLedgers = selectedClassLedgers.filter(
                ledger => ledger.METHODTYPE === 'Based on Quantity'
              );
              const basedOnQuantityAmounts = {};
              const totalQuantity = orderItems.reduce((sum, item) => sum + (parseFloat(item.quantity || 0)), 0);
              basedOnQuantityLedgers.forEach(ledger => {
                const classRate = parseFloat(ledger.CLASSRATE || '0');
                basedOnQuantityAmounts[ledger.NAME] = totalQuantity * classRate;
              });
              const totalBasedOnQuantity = Object.values(basedOnQuantityAmounts).reduce((sum, value) => sum + (parseFloat(value) || 0), 0);

              // Calculate "On Total Sales" ledger amounts (METHODTYPE = "On Total Sales")
              // Value = total item value (subtotal) * CLASSRATE/100
              const onTotalSalesLedgers = selectedClassLedgers.filter(
                ledger => ledger.METHODTYPE === 'On Total Sales'
              );
              const onTotalSalesAmounts = {};
              onTotalSalesLedgers.forEach(ledger => {
                const classRate = parseFloat(ledger.CLASSRATE || '0');
                onTotalSalesAmounts[ledger.NAME] = (subtotal * classRate) / 100;
              });
              const totalOnTotalSales = Object.values(onTotalSalesAmounts).reduce((sum, value) => sum + (parseFloat(value) || 0), 0);

              // Calculate "On Current SubTotal" ledger amounts (METHODTYPE = "On Current SubTotal")
              // Value = (total item value + additional ledger value excluding certain types) * CLASSRATE
              // Exclude: "As Total Amount Rounding", "GST", and "On Current SubTotal"
              const onCurrentSubTotalLedgers = selectedClassLedgers.filter(
                ledger => ledger.METHODTYPE === 'On Current SubTotal'
              );

              // Calculate base amount for "On Current SubTotal" excluding: "As Total Amount Rounding", "GST", and "On Current SubTotal"
              // Include: subtotal + user-defined + flat rate + based on quantity + on total sales
              // Note: GST and rounding are explicitly excluded, and "On Current SubTotal" ledgers are calculated sequentially
              let cumulativeOnCurrentSubTotal = 0;
              const recalculatedOnCurrentSubTotalAmounts = {};

              onCurrentSubTotalLedgers.forEach(ledger => {
                const classRate = parseFloat(ledger.CLASSRATE || '0');
                // Base includes: subtotal + user-defined + flat rate + based on quantity + on total sales + previous "On Current SubTotal" amounts
                // Excludes: GST, rounding, and other "On Current SubTotal" ledgers (handled sequentially)
                const currentBase = subtotal + totalLedgerValues + totalFlatRate + totalBasedOnQuantity + totalOnTotalSales + cumulativeOnCurrentSubTotal;
                const amount = (currentBase * classRate) / 100;
                recalculatedOnCurrentSubTotalAmounts[ledger.NAME] = amount;
                cumulativeOnCurrentSubTotal += amount;
              });
              const finalOnCurrentSubTotal = cumulativeOnCurrentSubTotal;

              // Calculate GST on other ledgers (excluding GST and rounding ledgers)
              // Logic: Calculate GST if APPROPRIATEFOR = "GST" and EXCISEALLOCTYPE = "Based on Value" (regardless of GSTAPPLICABLE)
              // OR if GSTAPPLICABLE = "Yes" and APPROPRIATEFOR is empty
              const gstOnOtherLedgers = {};

              // Helper function to calculate average GST rate from items
              const calculateAverageGSTRate = () => {
                let totalTaxableAmount = 0;
                let weightedGstRate = 0;

                orderItems.forEach(item => {
                  const itemGstPercent = parseFloat(item.gstPercent || 0);
                  const itemAmount = parseFloat(item.amount || 0);

                  if (itemGstPercent > 0 && itemAmount > 0) {
                    totalTaxableAmount += itemAmount;
                    weightedGstRate += itemAmount * itemGstPercent;
                  }
                });

                if (totalTaxableAmount > 0) {
                  return weightedGstRate / totalTaxableAmount;
                }
                return 0;
              };

              const avgGstRate = calculateAverageGSTRate();

              // Calculate GST for each non-GST, non-rounding ledger
              selectedClassLedgers.forEach(ledger => {
                // Skip GST and rounding ledgers
                if (ledger.METHODTYPE === 'GST' || ledger.METHODTYPE === 'As Total Amount Rounding') {
                  return;
                }

                let ledgerValue = 0;

                // Get the ledger value based on METHODTYPE
                if (ledger.METHODTYPE === 'As User Defined Value') {
                  ledgerValue = parseFloat(ledgerValues[ledger.NAME] || 0);
                } else if (ledger.METHODTYPE === 'As Flat Rate') {
                  ledgerValue = parseFloat(ledger.CLASSRATE || '0');
                } else if (ledger.METHODTYPE === 'Based on Quantity') {
                  ledgerValue = basedOnQuantityAmounts[ledger.NAME] || 0;
                } else if (ledger.METHODTYPE === 'On Total Sales') {
                  ledgerValue = onTotalSalesAmounts[ledger.NAME] || 0;
                } else if (ledger.METHODTYPE === 'On Current SubTotal') {
                  ledgerValue = recalculatedOnCurrentSubTotalAmounts[ledger.NAME] || 0;
                }

                if (ledgerValue !== 0) {
                  let gstAmount = 0;

                  // Check if APPROPRIATEFOR = "GST" and EXCISEALLOCTYPE = "Based on Value"
                  // This should calculate GST even if GSTAPPLICABLE = "No"
                  if (ledger.APPROPRIATEFOR === 'GST' && ledger.EXCISEALLOCTYPE === 'Based on Value') {
                    // Allocate discount proportionally to items based on their values
                    // Then calculate GST on each item's discount portion using that item's GST rate
                    const totalItemValue = orderItems.reduce((sum, item) => sum + (parseFloat(item.amount || 0)), 0);

                    if (totalItemValue > 0) {
                      // Calculate GST for each GST ledger (CGST, SGST, IGST)
                      gstLedgers.forEach(gstLedger => {
                        const gstDutyHead = getGSTDUTYHEAD(gstLedger.NAME);
                        if (!gstDutyHead) return;

                        let ledgerGstAmount = 0;

                        // Allocate discount to each item proportionally
                        orderItems.forEach(item => {
                          const itemAmount = parseFloat(item.amount || 0);
                          const itemGstPercent = parseFloat(item.gstPercent || 0);

                          if (itemAmount > 0 && itemGstPercent > 0) {
                            // Calculate this item's portion of the discount
                            const itemDiscountPortion = (ledgerValue * itemAmount) / totalItemValue;

                            // Calculate GST on this item's discount portion
                            let effectiveGstRate = itemGstPercent;

                            // For CGST/SGST, split the rate (12% -> 6% each, 5% -> 2.5% each)
                            // For IGST, use full rate
                            if (gstDutyHead === 'CGST' || gstDutyHead === 'SGST/UTGST') {
                              effectiveGstRate = itemGstPercent / 2;
                            }

                            // Only add if this GST ledger matches the state requirement
                            if ((isSameState && (gstDutyHead === 'CGST' || gstDutyHead === 'SGST/UTGST')) ||
                              (!isSameState && gstDutyHead === 'IGST')) {
                              const itemGstOnDiscount = (itemDiscountPortion * effectiveGstRate) / 100;
                              ledgerGstAmount += itemGstOnDiscount;
                            }
                          }
                        });

                        // Add GST on discount to the GST ledger amount (allow negative values for discounts)
                        if (ledgerGstAmount !== 0) {
                          // Add to gstAmounts so it's included in the displayed GST amounts
                          if (!gstAmounts[gstLedger.NAME]) {
                            gstAmounts[gstLedger.NAME] = 0;
                          }
                          gstAmounts[gstLedger.NAME] += ledgerGstAmount;
                        }
                      });
                    }
                  } else if (ledger.GSTAPPLICABLE === 'Yes' && (ledger.APPROPRIATEFOR === '' || !ledger.APPROPRIATEFOR)) {
                    // GST = ledger value * GSTRATE/100
                    // Only calculate if GSTRATE is provided (not empty)
                    const gstRate = ledger.GSTRATE ? parseFloat(ledger.GSTRATE) : 0;
                    if (gstRate > 0) {
                      const gstAmount = (ledgerValue * gstRate) / 100;
                      gstOnOtherLedgers[ledger.NAME] = gstAmount;
                    }
                    // If GSTRATE is empty, no GST calculation required
                  }
                }
              });

              // Calculate totalGST after adding GST on discount (which was added to gstAmounts)
              let totalGST = Object.values(gstAmounts).reduce((sum, value) => sum + (parseFloat(value) || 0), 0);

              const totalGstOnOtherLedgers = Object.values(gstOnOtherLedgers).reduce((sum, value) => sum + (parseFloat(value) || 0), 0);

              // Calculate amount before rounding (subtotal + user-defined ledgers + flat rate + based on quantity + on total sales + on current subtotal + GST + GST on other ledgers)
              const amountBeforeRounding = subtotal + totalLedgerValues + totalFlatRate + totalBasedOnQuantity + totalOnTotalSales + finalOnCurrentSubTotal + totalGST + totalGstOnOtherLedgers;

              // Helper function to calculate rounding based on ROUNDTYPE and ROUNDLIMIT
              const calculateRounding = (amount, roundType, roundLimit) => {
                const limit = parseFloat(roundLimit) || 1;

                if (roundType === 'Normal Rounding') {
                  // Round to nearest limit (e.g., if limit is 1, round to nearest rupee)
                  return Math.round(amount / limit) * limit - amount;
                } else if (roundType === 'Upward Rounding') {
                  // Round up to next limit
                  return Math.ceil(amount / limit) * limit - amount;
                } else if (roundType === 'Downward Rounding') {
                  // Round down to previous limit
                  return Math.floor(amount / limit) * limit - amount;
                }
                return 0;
              };

              // Calculate rounding amounts for each rounding ledger
              const roundingLedgers = selectedClassLedgers.filter(
                ledger => ledger.METHODTYPE === 'As Total Amount Rounding'
              );

              let cumulativeRounding = 0;
              const roundingAmounts = {};

              // Process rounding ledgers in order (they might be cumulative)
              roundingLedgers.forEach(ledger => {
                const amountToRound = amountBeforeRounding + cumulativeRounding;
                const roundingAmount = calculateRounding(
                  amountToRound,
                  ledger.ROUNDTYPE || 'Normal Rounding',
                  ledger.ROUNDLIMIT || '1'
                );
                roundingAmounts[ledger.NAME] = roundingAmount;
                cumulativeRounding += roundingAmount;
              });

              // Calculate total rounding
              const totalRounding = cumulativeRounding;

              // Final total = subtotal + user-defined ledgers + rounding
              const total = amountBeforeRounding + totalRounding;

              return (
                <>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '12px',
                    fontSize: '14px',
                    color: '#374151'
                  }}>
                    <span>Subtotal:</span>
                    <span>₹{subtotal.toFixed(2)}</span>
                  </div>

                  {/* Ledger entries - show all, but only user-defined ones are editable */}
                  {selectedClassLedgers.map((ledger, index) => {
                    const isUserDefined = ledger.METHODTYPE === 'As User Defined Value';
                    const isRounding = ledger.METHODTYPE === 'As Total Amount Rounding';
                    const isGST = ledger.METHODTYPE === 'GST';
                    const isFlatRate = ledger.METHODTYPE === 'As Flat Rate';
                    const isBasedOnQuantity = ledger.METHODTYPE === 'Based on Quantity';
                    const isOnTotalSales = ledger.METHODTYPE === 'On Total Sales';
                    const isOnCurrentSubTotal = ledger.METHODTYPE === 'On Current SubTotal';
                    const ledgerValue = ledgerValues[ledger.NAME] || '';
                    const ledgerAmount = parseFloat(ledgerValue) || 0;

                    // Get rounding amount if it's a rounding ledger
                    const roundingAmount = isRounding ? (roundingAmounts[ledger.NAME] || 0) : 0;

                    // Get GST amount if it's a GST ledger
                    const gstAmount = isGST ? (gstAmounts[ledger.NAME] || 0) : 0;

                    // Get flat rate amount if it's a flat rate ledger
                    const flatRateAmount = isFlatRate ? (flatRateAmounts[ledger.NAME] || 0) : 0;

                    // Get based on quantity amount if it's a based on quantity ledger
                    const basedOnQuantityAmount = isBasedOnQuantity ? (basedOnQuantityAmounts[ledger.NAME] || 0) : 0;

                    // Get on total sales amount if it's an on total sales ledger
                    const onTotalSalesAmount = isOnTotalSales ? (onTotalSalesAmounts[ledger.NAME] || 0) : 0;

                    // Get on current subtotal amount if it's an on current subtotal ledger
                    const onCurrentSubTotalAmount = isOnCurrentSubTotal ? (recalculatedOnCurrentSubTotalAmounts[ledger.NAME] || 0) : 0;

                    // Get GST on this ledger if applicable (for non-GST, non-rounding ledgers)
                    const gstOnThisLedger = (!isGST && !isRounding && ledger.GSTAPPLICABLE === 'Yes') ? (gstOnOtherLedgers[ledger.NAME] || 0) : 0;

                    return (
                      <div key={`${ledger.NAME}-${index}`} style={{
                        marginBottom: '12px'
                      }}>
                        {isUserDefined ? (
                          <>
                            <div style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              gap: '8px'
                            }}>
                              <span style={{
                                fontSize: '14px',
                                color: '#374151',
                                flex: '1 1 auto',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}>
                                {ledger.NAME}:
                              </span>
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                flexShrink: 0
                              }}>
                                <span style={{ fontSize: '14px', color: '#374151' }}>₹</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={ledgerValue}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    setLedgerValues(prev => ({
                                      ...prev,
                                      [ledger.NAME]: value
                                    }));
                                  }}
                                  onBlur={(e) => {
                                    // Ensure value is a valid number
                                    const numValue = parseFloat(e.target.value) || 0;
                                    setLedgerValues(prev => ({
                                      ...prev,
                                      [ledger.NAME]: numValue === 0 ? '' : numValue.toString()
                                    }));
                                  }}
                                  placeholder="0.00"
                                  style={{
                                    width: '80px',
                                    padding: '6px 8px',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '6px',
                                    fontSize: '14px',
                                    textAlign: 'right',
                                    color: '#374151'
                                  }}
                                />
                              </div>
                            </div>
                            {gstOnThisLedger > 0 && (
                              <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                fontSize: '12px',
                                color: '#6b7280',
                                marginTop: '4px',
                                paddingLeft: '12px'
                              }}>
                                <span>GST on {ledger.NAME}:</span>
                                <span>₹{gstOnThisLedger.toFixed(2)}</span>
                              </div>
                            )}
                          </>
                        ) : isRounding ? (
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: '14px',
                            color: '#374151'
                          }}>
                            <span>{ledger.NAME}:</span>
                            <span>₹{roundingAmount.toFixed(2)}</span>
                          </div>
                        ) : isGST ? (
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: '14px',
                            color: '#374151'
                          }}>
                            <span>{ledger.NAME}:</span>
                            <span>₹{gstAmount.toFixed(2)}</span>
                          </div>
                        ) : isFlatRate ? (
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: '14px',
                            color: '#374151'
                          }}>
                            <span>{ledger.NAME}:</span>
                            <span>₹{flatRateAmount.toFixed(2)}</span>
                          </div>
                        ) : isBasedOnQuantity ? (
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: '14px',
                            color: '#374151'
                          }}>
                            <span>{ledger.NAME}:</span>
                            <span>₹{basedOnQuantityAmount.toFixed(2)}</span>
                          </div>
                        ) : isOnTotalSales ? (
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: '14px',
                            color: '#374151'
                          }}>
                            <span>{ledger.NAME}:</span>
                            <span>₹{onTotalSalesAmount.toFixed(2)}</span>
                          </div>
                        ) : isOnCurrentSubTotal ? (
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: '14px',
                            color: '#374151'
                          }}>
                            <span>{ledger.NAME}:</span>
                            <span>₹{onCurrentSubTotalAmount.toFixed(2)}</span>
                          </div>
                        ) : (
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: '14px',
                            color: '#374151'
                          }}>
                            <span>{ledger.NAME}:</span>
                            <span>₹0.00</span>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    paddingTop: '16px',
                    borderTop: '1px solid #e5e7eb',
                    marginBottom: '20px'
                  }}>
                    <span style={{
                      fontSize: '18px',
                      fontWeight: '600',
                      color: '#1f2937'
                    }}>
                      Total:
                    </span>
                    <span style={{
                      fontSize: '24px',
                      fontWeight: '700',
                      color: '#7c3aed'
                    }}>
                      ₹{total.toFixed(2)}
                    </span>
                  </div>
                </>
              );
            })()}

            {/* Action Buttons */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              marginBottom: '16px'
            }}>
              <button
                type="submit"
                form="order-form"
                onClick={(e) => {
                  e.preventDefault();
                  const form = document.querySelector('form');
                  if (form) {
                    form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
                  }
                }}
                disabled={!company || !selectedCustomer || orderItems.length === 0 || !customerOptions.some(customer => customer.NAME === selectedCustomer) || isSubmittingOrder}
                style={{
                  background: (!company || !selectedCustomer || orderItems.length === 0 || !customerOptions.some(customer => customer.NAME === selectedCustomer) || isSubmittingOrder)
                    ? '#d1d5db'
                    : 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '12px 24px',
                  height: '48px',
                  cursor: (!company || !selectedCustomer || orderItems.length === 0 || !customerOptions.some(customer => customer.NAME === selectedCustomer) || isSubmittingOrder) ? 'not-allowed' : 'pointer',
                  fontSize: '15px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.2s ease',
                  opacity: (!company || !selectedCustomer || orderItems.length === 0 || !customerOptions.some(customer => customer.NAME === selectedCustomer) || isSubmittingOrder) ? 0.6 : 1,
                  boxShadow: (!company || !selectedCustomer || orderItems.length === 0 || !customerOptions.some(customer => customer.NAME === selectedCustomer) || isSubmittingOrder) ? 'none' : '0 2px 4px rgba(124, 58, 237, 0.2)',
                  boxSizing: 'border-box'
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

          {/* Transaction Information */}
          <div style={{
            background: '#fff',
            borderRadius: '0.75rem',
            border: '1px solid #e2e8f0',
            padding: isMobile ? '16px' : isTablet ? '20px' : isSmallDesktop ? '20px' : '24px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
            transition: 'all 0.2s ease',
            maxWidth: '100%',
            boxSizing: 'border-box'
          }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.08)';
            }}>
            <h3 style={{
              margin: '0 0 16px 0',
              fontSize: isMobile ? '16px' : '18px',
              fontWeight: '600',
              color: '#1f2937'
            }}>
              Transaction Information
            </h3>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '14px'
              }}>
                <span style={{ color: '#6b7280' }}>Order Date:</span>
                <span style={{ color: '#1f2937', fontWeight: '500' }}>
                  {new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}
                </span>
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '14px'
              }}>
                <span style={{ color: '#6b7280' }}>Order Type:</span>
                <span style={{
                  color: '#fff',
                  backgroundColor: '#7c3aed',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: '600'
                }}>
                  {selectedVoucherType || 'Sales Order'}
                </span>
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '14px'
              }}>
                <span style={{ color: '#6b7280' }}>Items Count:</span>
                <span style={{ color: '#1f2937', fontWeight: '500' }}>{orderItems.length}</span>
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '14px'
              }}>
                <span style={{ color: '#6b7280' }}>Total Quantity:</span>
                <span style={{ color: '#1f2937', fontWeight: '500' }}>
                  {(() => {
                    const totals = calculateTotals();
                    return totals.canShowQuantityTotal ? totals.totalQuantity : 0;
                  })()}
                </span>
              </div>
            </div>
          </div>
        </div>
        {/* End of Right Sidebar */}
      </div>
      {/* End of receivables-content */}

      {/* Edit Customer Modal */}

      {

        showEditModal && (

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

        )

      }



      {/* Overdue Bills Modal */}

      {

        showOverdueBills && creditLimitData && creditLimitData.overdueBills && creditLimitData.overdueBills.length > 0 && (

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

        )

      }



      {/* Custom Confirmation Modal */}

      {

        showConfirmModal && (

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

        )

      }



      {/* Order Result Modal */}

      {

        showOrderResultModal && (

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

        )

      }



      {/* Stock Breakdown Modal */}

      {

        showStockModal && (

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

        )

      }

    </div >

  );

}

export default PlaceOrder;
