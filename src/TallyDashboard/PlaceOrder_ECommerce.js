import React, { useState, useEffect, useMemo, useRef } from 'react';
import { getApiUrl, API_CONFIG } from '../config';
import { apiGet, apiPost } from '../utils/apiUtils';
import { deobfuscateStockItems, enhancedDeobfuscateValue } from '../utils/frontendDeobfuscate';
import { getUserModules, hasPermission, getPermissionValue } from '../config/SideBarConfigurations';
<<<<<<< HEAD
import { convertGoogleDriveToImageUrl, isGoogleDriveLink, detectGoogleDriveFileType, extractGoogleDriveFileId } from '../utils/googleDriveImageUtils';
=======
import { getGoogleTokenFromConfigs, getGoogleDriveImageUrl } from '../utils/googleDriveUtils';
>>>>>>> 97cc187618a1b9becc15fd103b173a40072c661c

function PlaceOrder_ECommerce() {
  // Get all companies from sessionStorage - moved outside to prevent recreation
  const companies = useMemo(() => {
    try {
      return JSON.parse(sessionStorage.getItem('allConnections') || '[]');
    } catch (e) {
      return [];
    }
  }, []);
  
  // Get company from sessionStorage (controlled by top bar) - make it reactive
  const [company, setCompany] = useState(() => {
    return sessionStorage.getItem('selectedCompanyGuid') || '';
  });
  
  // Company-related state (kept for JSX compatibility but not used)
  const [companyFocused, setCompanyFocused] = useState(false);
  const [companySearchTerm, setCompanySearchTerm] = useState('');
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const [filteredCompanyOptions, setFilteredCompanyOptions] = useState([]);
  // Note: setCompany is now the state setter from useState above, not a dummy function
  
  // VoucherType state
  const [voucherTypes, setVoucherTypes] = useState([]);
  const [voucherTypesLoading, setVoucherTypesLoading] = useState(false);
  const [voucherTypesError, setVoucherTypesError] = useState('');
  const [selectedVoucherType, setSelectedVoucherType] = useState('');
  const [showVoucherTypeDropdown, setShowVoucherTypeDropdown] = useState(false);
  const [voucherTypeFocused, setVoucherTypeFocused] = useState(false);

  // Customer and stock items state
  const [customerOptions, setCustomerOptions] = useState([]);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [customerFocused, setCustomerFocused] = useState(false);
  
  const [stockItems, setStockItems] = useState([]);
  const [stockItemsLoading, setStockItemsLoading] = useState(false);
  const [refreshStockItems, setRefreshStockItems] = useState(0);
  
  // Image URL state for Google Drive conversions
  const [imageUrlMap, setImageUrlMap] = useState({});
  
  // Customer refresh state
  const [refreshCustomers, setRefreshCustomers] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
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

  
  // Check if user has show_rateamt_Column permission
  const canShowRateAmtColumn = hasPermission('ecommerce_place_order', 'show_rateamt_Column', userModules);
  
  // Check if user has save_optional permission
  const canSaveOptional = hasPermission('ecommerce_place_order', 'save_optional', userModules);
  
  // Check if user has show_clsstck_Column permission
  const canShowClosingStock = hasPermission('ecommerce_place_order', 'show_ClsStck_Column', userModules);
  
  // Check if user has show_clsstck_yesno permission
  const canShowClosingStockYesNo = hasPermission('ecommerce_place_order', 'show_ClsStck_yesno', userModules);
  
  // Check if user has show_itemshasqty permission
  const canShowItemsHasQty = hasPermission('ecommerce_place_order', 'show_itemshasqty', userModules);
  
  // Check if user has show_godownbrkup permission
  const canShowGodownBrkup = hasPermission('ecommerce_place_order', 'show_godownbrkup', userModules);
  
  // Check if user has show_multicobrkup permission
  const canShowMulticoBrkup = hasPermission('ecommerce_place_order', 'show_multicobrkup', userModules);
  
  // Check if user has show_image permission
  const canShowImage = hasPermission('ecommerce_place_order', 'show_image', userModules);
  
  // Get default quantity value from def_qty permission
  const defaultQuantity = getPermissionValue('ecommerce_place_order', 'def_qty', userModules);
  const defQtyValue = defaultQuantity ? parseInt(defaultQuantity) : 1;
  
  // Check if user has show_creditdayslimit permission
  const canShowCreditLimit = hasPermission('ecommerce_place_order', 'show_creditdayslimit', userModules);
  
  // Check if user has ctrl_creditdayslimit permission
  const canControlCreditLimit = hasPermission('ecommerce_place_order', 'ctrl_creditdayslimit', userModules);
  
  // Check if user has any stock breakdown permission
  const canShowStockBreakdown = canShowGodownBrkup || canShowMulticoBrkup;

  // Credit limit state
  const [creditLimitData, setCreditLimitData] = useState(null);
  const [showOverdueBills, setShowOverdueBills] = useState(false);
  const [creditLimitLoading, setCreditLimitLoading] = useState(false);
  
  // Cart state
  const [cart, setCart] = useState([]);
  
  // Stock breakdown modal state
  const [showStockModal, setShowStockModal] = useState(false);
  const [stockBreakdownData, setStockBreakdownData] = useState(null);
  const [stockBreakdownLoading, setStockBreakdownLoading] = useState(false);
  const [stockBreakdownError, setStockBreakdownError] = useState('');
  const [showGodownStock, setShowGodownStock] = useState(() => {
    // Default to godown if user has godown permission, otherwise default to company
    return canShowGodownBrkup;
  });

  // Google token state for image display
  const [googleToken, setGoogleToken] = useState(null);
  const imageUrlCache = useRef(new Map()); // Cache for image URLs (useRef to avoid re-renders)

  // Fetch Google token when company changes
  useEffect(() => {
    const fetchGoogleToken = async () => {
      console.log('🔄 Token fetch effect triggered:', { 
        company, 
        companiesCount: companies.length,
        hasCompany: !!company,
        companiesSample: companies.slice(0, 2).map(c => ({ guid: c.guid, company: c.company }))
      });
      
      if (!company) {
        console.log('🔄 No company selected, clearing Google token');
        setGoogleToken(null);
        return;
      }

      if (companies.length === 0) {
        console.log('⏳ Companies list not loaded yet, waiting...');
        return;
      }

      const currentCompany = companies.find(c => c.guid === company);
      if (!currentCompany) {
        console.log('🔄 Company not found in companies list:', { 
          lookingFor: company, 
          availableGuids: companies.map(c => c.guid).slice(0, 5)
        });
        setGoogleToken(null);
        return;
      }

      const { tallyloc_id, guid } = currentCompany;
      console.log('🔄 Fetching Google token for company:', { tallyloc_id, guid, companyName: currentCompany.company });
      try {
        const token = await getGoogleTokenFromConfigs(tallyloc_id, guid);
        console.log('✅ Google token fetched:', token ? `Token available (${token.substring(0, 20)}...)` : 'No token found');
        setGoogleToken(token);
      } catch (error) {
        console.error('❌ Error fetching Google token:', error);
        setGoogleToken(null);
      }
    };

    fetchGoogleToken();
  }, [company, companies]);

  // Listen for company changes from top bar
  useEffect(() => {
    const handleCompanyChange = () => {
      // Company changed from top bar
      const newCompanyGuid = sessionStorage.getItem('selectedCompanyGuid') || '';
      console.log('🔄 PlaceOrder_ECommerce: Company changed event received:', newCompanyGuid);
      
      // Update company state (this will trigger token fetch)
      setCompany(newCompanyGuid);
      
      // Clear related state
      setSelectedCustomer('');
      setCustomerOptions([]);
      setStockItems([]);
      setCart([]);
      setCustomerSearchTerm('');
      imageUrlCache.current.clear(); // Clear image URL cache

      const currentCompany = companies.find(c => c.guid === newCompanyGuid);

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
        }
      }
    };

    // Check on mount and whenever companies are loaded
    const initialCompany = sessionStorage.getItem('selectedCompanyGuid') || '';
    if (initialCompany) {
      if (initialCompany !== company) {
        console.log('🔄 Setting initial company from sessionStorage:', initialCompany);
        setCompany(initialCompany);
      } else if (companies.length > 0) {
        // Companies are loaded and company is set, ensure token fetch runs
        console.log('🔄 Companies loaded, ensuring token fetch will run');
      }
    }

    window.addEventListener('companyChanged', handleCompanyChange);
    return () => window.removeEventListener('companyChanged', handleCompanyChange);
  }, [companies, company]);

  // Listen for global refresh from top bar
  useEffect(() => {
    const handleGlobalRefresh = () => {
      console.log('🔄 PlaceOrder_ECommerce: Global refresh received');
      setRefreshCustomers(prev => prev + 1);
      setRefreshStockItems(prev => prev + 1);
    };

    window.addEventListener('globalRefresh', handleGlobalRefresh);
    return () => window.removeEventListener('globalRefresh', handleGlobalRefresh);
  }, []);

  // Product search
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const filteredStockItems = useMemo(() => {
    let items = stockItems;
    
    // If user has show_itemshasqty permission, only show items with stock > 0
    if (canShowItemsHasQty) {
      items = stockItems.filter(item => (item.CLOSINGSTOCK || 0) > 0);
    }
    
    const term = productSearchTerm.trim().toLowerCase();
    if (!term) return items;
    
    const out = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const name = (it.NAME || '').toLowerCase();
      const part = (it.PARTNO || '').toLowerCase();
      if (name.includes(term) || part.includes(term)) out.push(it);
      if (out.length >= 1000) break; // safety cap
    }
    return out;
  }, [productSearchTerm, stockItems, canShowItemsHasQty]);
  

  // Compute rate for an item using selected customer's price level
  const computeRateForItem = useMemo(() => {
    return (item) => {
      if (!item) return 0;
      const customer = customerOptions.find(c => c.NAME === selectedCustomer);
      if (customer && customer.PRICELEVEL) {
        const pl = (item.PRICELEVELS || []).find(x => x.PLNAME === customer.PRICELEVEL);
        if (pl) {
          return enhancedDeobfuscateValue(pl.RATE) || 0;
        }
        return 0;
      }
      // Fallback to STDPRICE (already deobfuscated in fetch)
      return parseFloat(item.STDPRICE || 0) || 0;
    };
  }, [customerOptions, selectedCustomer]);

  // Compute discount percent for item using customer's price level
  const computeDiscountForItem = useMemo(() => {
    return (item) => {
      if (!item) return 0;
      const customer = customerOptions.find(c => c.NAME === selectedCustomer);
      if (customer && customer.PRICELEVEL) {
        const pl = (item.PRICELEVELS || []).find(x => x.PLNAME === customer.PRICELEVEL);
        if (pl) {
          return enhancedDeobfuscateValue(pl.DISCOUNT) || 0;
        }
        return 0;
      }
      return 0;
    };
  }, [customerOptions, selectedCustomer]);

  // Company filtering
  useEffect(() => {
    if (!companySearchTerm.trim()) {
      setFilteredCompanyOptions([]);
      return;
    }
    
    const timeoutId = setTimeout(() => {
      const searchLower = companySearchTerm.toLowerCase();
      const filtered = companies.filter(company => 
        company.company.toLowerCase().includes(searchLower) ||
        company.access_type.toLowerCase().includes(searchLower)
      );
      setFilteredCompanyOptions(filtered);
    }, 150);
    
    return () => clearTimeout(timeoutId);
  }, [companySearchTerm, companies]);

  // Show all companies when dropdown opens
  useEffect(() => {
    if (showCompanyDropdown && !companySearchTerm.trim()) {
      setFilteredCompanyOptions(companies);
    }
  }, [showCompanyDropdown, companySearchTerm, companies]);

  // Fetch customers when company changes
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
      
      // Get the current company object directly from companies
      const currentCompany = companies.find(c => c.guid === company);
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

  useEffect(() => {
    const fetchCustomers = async () => {
      console.log('Customer useEffect triggered - company:', company, 'refreshCustomers:', refreshCustomers);
      
      // Check if we're auto-populating from cart
      const cartData = sessionStorage.getItem('ecommerceCartData');
      const isAutoPopulating = !!cartData;
      
      if (!company) {
        setCustomerOptions([]);
        // Don't clear customer if we're auto-populating
        if (!isAutoPopulating) {
          setSelectedCustomer('');
        }
        return;
      }
      
      const currentCompany = companies.find(c => c.guid === company);
      if (!currentCompany) return;
      
      const { tallyloc_id, company: companyVal, guid } = currentCompany;
      const cacheKey = `ledgerlist-w-addrs_${tallyloc_id}_${companyVal}`;
      
      console.log('Customer cache key:', cacheKey);
      console.log('Cache exists:', !!sessionStorage.getItem(cacheKey));
      console.log('Refresh requested:', !!refreshCustomers);
      
      // Check cache first
      const cached = sessionStorage.getItem(cacheKey);
      if (cached && !refreshCustomers) {
        console.log('Using cached customer data');
        try {
          const customers = JSON.parse(cached);
          setCustomerOptions(customers);
          setCustomerLoading(false);
          return;
        } catch {}
      }
      
      // Clear cache if refresh requested
      if (refreshCustomers) {
        console.log('Clearing customer cache due to refresh');
        sessionStorage.removeItem(cacheKey);
      }
      
      // Set loading state and fetch data
      console.log('Fetching fresh customer data');
      setCustomerLoading(true);
      setCustomerOptions([]);
      
      const token = sessionStorage.getItem('token');
      
      // Create AbortController for request cancellation
      const abortController = new AbortController();
      
      try {
        const data = await apiPost(`${API_CONFIG.ENDPOINTS.TALLY_LEDGERLIST_W_ADDRS}?ts=${Date.now()}`, { 
          tallyloc_id, 
          company: companyVal, 
          guid
        });
        
        if (data && data.ledgers && Array.isArray(data.ledgers)) {
          console.log(`Successfully fetched ${data.ledgers.length} customers`);
          setCustomerOptions(data.ledgers);
          // Don't auto-select customer if we're auto-populating from cart
          if (!isAutoPopulating) {
            if (data.ledgers.length === 1) setSelectedCustomer(data.ledgers[0].NAME);
            else setSelectedCustomer('');
          }
          
          // Cache the result with graceful fallback if storage is full
          try {
            const cacheString = JSON.stringify(data.ledgers);
            sessionStorage.setItem(cacheKey, cacheString);
          } catch (cacheError) {
            console.warn('Failed to cache customers in sessionStorage:', cacheError.message);
            // Don't fail the entire operation if caching fails
          }
        } else if (data && data.error) {
          console.error('Customer API error:', data.error);
          setCustomerOptions([]);
          setSelectedCustomer('');
        } else {
          console.error('Unknown customer API response:', data);
          setCustomerOptions([]);
          setSelectedCustomer('');
        }
      } catch (err) {
        console.error('Error fetching customers:', err);
        const errorMessage = err.message || 'Failed to fetch customers';
        // Error state will be handled by the component's error handling
        setCustomerOptions([]);
        setSelectedCustomer('');
      } finally {
        setCustomerLoading(false);
      }
      
      // Cleanup function to cancel request when effect re-runs or component unmounts
      return () => {
        abortController.abort();
      };
    };
    
    fetchCustomers();
  }, [company, refreshCustomers, companies]); // Added 'companies' back to dependencies to check cache properly

  // Fetch stock items when company changes
  useEffect(() => {
    const fetchStockItems = async () => {
      console.log('Stock items useEffect triggered - company:', company, 'refreshStockItems:', refreshStockItems);
      
      if (!company) {
        setStockItems([]);
        return;
      }
      
      const currentCompany = companies.find(c => c.guid === company);
      if (!currentCompany) return;
      
      const { tallyloc_id, company: companyVal, guid } = currentCompany;
      const cacheKey = `stockitems_${tallyloc_id}_${companyVal}`;
      
      console.log('Stock items cache key:', cacheKey);
      console.log('Cache exists:', !!sessionStorage.getItem(cacheKey));
      console.log('Refresh requested:', !!refreshStockItems);
      
      // Check cache first
      const cached = sessionStorage.getItem(cacheKey);
      if (cached && !refreshStockItems) {
        console.log('Using cached stock items data');
        try {
          const items = JSON.parse(cached);
          setStockItems(items);
          return;
        } catch {}
      }
      
      // Clear cache if refresh requested
      if (refreshStockItems) {
        console.log('Clearing stock items cache due to refresh');
        sessionStorage.removeItem(cacheKey);
      }
      
      console.log('Fetching fresh stock items data');
      setStockItemsLoading(true);
      const token = sessionStorage.getItem('token');
      
      // Create AbortController for request cancellation
      const abortController = new AbortController();
      
      try {
        const data = await apiPost(`${API_CONFIG.ENDPOINTS.TALLY_STOCK_ITEMS}?ts=${Date.now()}`, { 
          tallyloc_id, 
          company: companyVal, 
          guid
        });
        
        if (data && data.stockItems && Array.isArray(data.stockItems)) {
          // Deobfuscate sensitive pricing data
          const decryptedItems = deobfuscateStockItems(data.stockItems);
          
          setStockItems(decryptedItems);
          // Cache the deobfuscated result with graceful fallback
          try {
            sessionStorage.setItem(cacheKey, JSON.stringify(decryptedItems));
          } catch (cacheError) {
            console.warn('Failed to cache stock items in sessionStorage:', cacheError.message);
          }
          console.log('Stock items fetched and deobfuscated:', decryptedItems);
        }
      } catch (err) {
        console.error('Error fetching stock items:', err);
      } finally {
        setStockItemsLoading(false);
      }
      
      // Cleanup function to cancel request when effect re-runs or component unmounts
      return () => {
        abortController.abort();
      };
    };
    
    fetchStockItems();
  }, [company, refreshStockItems, companies]); // Added 'companies' back to dependencies to check cache properly

  // Convert Google Drive links to image URLs
  useEffect(() => {
    const convertImagePaths = async () => {
      const newImageUrlMap = {};
      
      for (const item of stockItems) {
        if (item.IMAGEPATH && isGoogleDriveLink(item.IMAGEPATH)) {
          try {
            const fileType = await detectGoogleDriveFileType(item.IMAGEPATH);
            const imageUrl = convertGoogleDriveToImageUrl(item.IMAGEPATH, fileType);
            newImageUrlMap[item.NAME] = imageUrl;
          } catch (error) {
            console.warn(`Failed to convert Google Drive URL for ${item.NAME}:`, error);
            newImageUrlMap[item.NAME] = item.IMAGEPATH; // Fallback to original
          }
        }
      }
      
      setImageUrlMap(newImageUrlMap);
    };
    
    if (stockItems.length > 0) {
      convertImagePaths();
    }
  }, [stockItems]);

  // Customer filtering
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
      
      const exactMatches = [];
      const startsWithMatches = [];
      const containsMatches = [];
      
      for (let i = 0; i < customerOptions.length; i++) {
        const customer = customerOptions[i];
        const customerName = customer.NAME || '';
        const customerGstNo = customer.GSTNO || '';
        const customerNameLower = customerName.toLowerCase();
        const customerGstNoLower = customerGstNo.toLowerCase();
        
        const nameMatch = customerNameLower.includes(searchLower);
        const gstMatch = customerGstNoLower.includes(searchLower);
        
        if (nameMatch || gstMatch) {
          if (customerNameLower === searchLower || customerGstNoLower === searchLower) {
            exactMatches.push(customer);
          } else if (customerNameLower.startsWith(searchLower) || customerGstNoLower.startsWith(searchLower)) {
            startsWithMatches.push(customer);
          } else {
            containsMatches.push(customer);
          }
        }
        
        if (exactMatches.length + startsWithMatches.length + containsMatches.length >= 50) {
          break;
        }
      }
      
      const filtered = [...exactMatches, ...startsWithMatches, ...containsMatches].slice(0, 50);
      setFilteredCustomers(filtered);
    }, 150);
    
    return () => clearTimeout(timeoutId);
  }, [customerSearchTerm, customerOptions]);

  // Show all customers when dropdown opens
  useEffect(() => {
    if (showCustomerDropdown && !customerSearchTerm.trim()) {
      setFilteredCustomers(customerOptions);
    }
  }, [showCustomerDropdown, customerSearchTerm, customerOptions]);

  // Add item to cart
  const addToCart = (item) => {
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
        const currentTotal = cart.reduce((sum, cartItem) => {
          const amount = parseFloat(cartItem.quantity || 0) * parseFloat(cartItem.rate || 0) * (1 - (parseFloat(cartItem.discountPercent || 0)/100));
          return sum + amount;
        }, 0);
        
        const itemAmount = defQtyValue * parseFloat(item.rate || 0) * (1 - (parseFloat(item.discountPercent || 0)/100));
        const newTotal = currentTotal + itemAmount;
        const availableCredit = Math.abs(creditLimitData.creditLimitInfo.CREDITLIMIT) - Math.abs(creditLimitData.creditLimitInfo.CLOSINGBALANCE);
        
        if (newTotal > availableCredit) {
          alert(`Cannot add item: Total order amount (₹${newTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}) would exceed available credit limit (₹${availableCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}).\n\nCurrent total: ₹${currentTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\nItem amount: ₹${itemAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
          return;
        }
      }
    }
    
    const existingItem = cart.find(cartItem => cartItem.NAME === item.NAME);
    if (existingItem) {
      setCart(cart.map(cartItem => 
        cartItem.NAME === item.NAME 
          ? { ...cartItem, quantity: cartItem.quantity + defQtyValue }
          : cartItem
      ));
    } else {
      setCart([...cart, { ...item, quantity: defQtyValue }]);
    }
  };

  // Update item quantity
  const updateQuantity = (itemName, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(itemName);
      return;
    }
    setCart(cart.map(cartItem => 
      cartItem.NAME === itemName 
        ? { ...cartItem, quantity: newQuantity }
        : cartItem
    ));
  };

  // Remove item from cart
  const removeFromCart = (itemName) => {
    setCart(cart.filter(cartItem => cartItem.NAME !== itemName));
  };

  // Fetch stock breakdown data
  const fetchStockBreakdown = async (itemName) => {
    if (!itemName || !company) return;
    
    const currentCompany = companies.find(c => c.guid === company);
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
  const handleStockFieldClick = (itemName) => {
    if (itemName && canShowStockBreakdown) {
      setShowStockModal(true);
      fetchStockBreakdown(itemName);
    }
  };

  // Refetch data when toggle changes
  useEffect(() => {
    if (showStockModal && stockBreakdownData) {
      // Get the current item name from the modal data
      const itemName = stockBreakdownData.item;
      if (itemName) {
        fetchStockBreakdown(itemName);
      }
    }
  }, [showGodownStock]);
  
  // Credit limit useEffect
  useEffect(() => {
    const fetchCreditLimitData = async () => {
      if (!selectedCustomer || (!canShowCreditLimit && !canControlCreditLimit)) {
        setCreditLimitData(null);
        return;
      }
      
      try {
        setCreditLimitLoading(true);
        const currentCompany = companies.find(c => c.guid === company);
        if (!currentCompany) {
          console.error('No company found for credit limit API');
          setCreditLimitData(null);
          return;
        }
        
        const { tallyloc_id, company: companyVal, guid } = currentCompany;
        const payload = {
          tallyloc_id, 
          company: companyVal, 
          guid,
          ledgername: selectedCustomer
        };
        
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
  }, [selectedCustomer, canShowCreditLimit, canControlCreditLimit, company, companies]);
  
  // Product Image Component for Google Drive images
  const ProductImage = React.memo(({ imagePath, itemName, googleToken, imageUrlCacheRef, canShowImage }) => {
    const [imageUrl, setImageUrl] = useState(null);
    const [imageLoading, setImageLoading] = useState(true);
    const [imageError, setImageError] = useState(false);

    useEffect(() => {
      const loadImageUrl = async () => {
        console.log('🖼️ ProductImage: Loading image URL', { 
          imagePath: imagePath?.substring(0, 50), 
          hasToken: !!googleToken,
          tokenLength: googleToken?.length,
          itemName 
        });
        
        if (!imagePath) {
          console.log('❌ ProductImage: No imagePath');
          setImageLoading(false);
          setImageError(true);
          return;
        }

        // If it's a Google Drive file ID and we don't have a token yet, 
        // the effect will re-run when token becomes available
        // Check if it looks like a Google Drive file ID (not a full URL)
        const isGoogleDriveId = !imagePath.startsWith('http') && /^[a-zA-Z0-9_-]{20,}$/.test(imagePath);
        
        if (isGoogleDriveId && !googleToken) {
          console.log('⏳ ProductImage: Google Drive file ID detected but no token yet. Will retry when token is available.');
          setImageLoading(true);
          setImageError(false);
          // Don't set error yet - wait for token to be available
          return;
        }

        // Check cache first
        const cacheKey = `${imagePath}_${googleToken || 'no-token'}`;
        if (imageUrlCacheRef.current.has(cacheKey)) {
          const cachedUrl = imageUrlCacheRef.current.get(cacheKey);
          console.log('✅ ProductImage: Using cached URL');
          setImageUrl(cachedUrl);
          setImageLoading(false);
          return;
        }

        try {
          console.log('🖼️ ProductImage: Calling getGoogleDriveImageUrl with:', {
            imagePath: imagePath?.substring(0, 100),
            hasToken: !!googleToken,
            tokenPreview: googleToken ? `${googleToken.substring(0, 20)}...` : 'none'
          });
          
          const url = await getGoogleDriveImageUrl(imagePath, googleToken);
          
          if (url) {
            // Double-check we're not using public URL (which will fail with 403)
            if (url.includes('drive.google.com/uc?export=view')) {
              console.error('❌ ProductImage: ERROR - Public URL detected! This should not happen. URL:', url);
              console.error('❌ This means getGoogleDriveImageUrl returned a public URL, which will fail with 403');
              setImageError(true);
              setImageLoading(false);
              return;
            }
            
            console.log('✅ ProductImage: Got image URL (blob or direct):', url.substring(0, 80));
            setImageUrl(url);
            // Update cache
            imageUrlCacheRef.current.set(cacheKey, url);
          } else {
            console.log('❌ ProductImage: No URL returned (likely no token available)');
            setImageError(true);
          }
        } catch (error) {
          console.error('❌ ProductImage: Error loading Google Drive image:', error);
          setImageError(true);
        } finally {
          setImageLoading(false);
        }
      };

      loadImageUrl();
    }, [imagePath, googleToken, itemName]);

    if (!canShowImage || !imagePath || imageError) {
      return (
        <div style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '2px dashed #d1d5db',
          borderRadius: '8px'
        }}>
          <span className="material-icons" style={{
            fontSize: '32px',
            color: '#9ca3af'
          }}>
            inventory_2
          </span>
        </div>
      );
    }

    if (imageLoading || !imageUrl) {
      return (
        <div style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '2px dashed #d1d5db',
          borderRadius: '8px',
          backgroundColor: '#f8fafc'
        }}>
          <div style={{
            width: '24px',
            height: '24px',
            border: '2px solid #e5e7eb',
            borderTop: '2px solid #3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
        </div>
      );
    }

    return (
      <>
        <img
          src={imageUrl}
          alt={itemName}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: '8px',
            position: 'absolute',
            top: 0,
            left: 0
          }}
          onLoad={() => {
            console.log('✅ ProductImage: Image loaded successfully');
          }}
          onError={(e) => {
            console.error('❌ ProductImage: Image failed to load', { imageUrl: imageUrl?.substring(0, 50) });
            e.target.style.display = 'none';
            setImageError(true);
            const placeholder = e.target.nextElementSibling;
            if (placeholder) {
              placeholder.style.display = 'flex';
            }
          }}
        />
        <div style={{
          width: '100%',
          height: '100%',
          display: 'none',
          alignItems: 'center',
          justifyContent: 'center',
          border: '2px dashed #d1d5db',
          borderRadius: '8px'
        }}>
          <span className="material-icons" style={{
            fontSize: '32px',
            color: '#9ca3af'
          }}>
            inventory_2
          </span>
        </div>
      </>
    );
  });

  // Navigate to PlaceOrder page with cart data
  const navigateToPlaceOrder = () => {
    if (cart.length === 0) return;
    
    // Store cart data in sessionStorage for PlaceOrder page
    const cartData = {
      company: company,
      customer: selectedCustomer,
      items: cart.map(cartItem => ({
        NAME: cartItem.NAME,
        PARTNO: cartItem.PARTNO,
        STDPRICE: computeRateForItem(cartItem),
        discountPercent: computeDiscountForItem(cartItem),
        quantity: cartItem.quantity,
        amount: computeRateForItem(cartItem) * cartItem.quantity * (1 - (computeDiscountForItem(cartItem) || 0) / 100)
      }))
    };
    
    console.log('Storing cart data:', cartData);
    console.log('Customer being stored:', selectedCustomer);
    sessionStorage.setItem('ecommerceCartData', JSON.stringify(cartData));
    
    // Navigate to PlaceOrder page by dispatching a custom event
    // The TallyDashboard component will listen for this event and switch to Place Order
    window.dispatchEvent(new CustomEvent('navigateToPlaceOrder', { 
      detail: { 
        reason: 'ecommerce_cart',
        cartData: cartData 
      } 
    }));
  };


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

      {/* Company, Customer, and Cart Section */}
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
        {/* Form */}
        <div style={{ padding: '12px', width: '100%', overflow: 'visible', position: 'relative', boxSizing: 'border-box' }}>
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
                  storefront
                </span>
              </div>
              <h3 style={{
                margin: 0,
                fontSize: '20px',
                fontWeight: '600',
                color: '#1f2937'
              }}>
                E-Commerce Place Order
              </h3>
            </div>
            
            {/* Optional text centered between E-Commerce Place Order and customer count */}
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
                {customerLoading ? 'Loading...' : `${customerOptions.length.toLocaleString()} customers available`}
              </span>
            </div>
          </div>

          {/* Customer Selection */}
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
            }} data-customer-dropdown>
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
                    setFilteredCustomers(customerOptions);
                  }}
                  onBlur={() => {
                    setCustomerFocused(false);
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
                  placeholder={customerLoading ? 'Loading...' : ''}
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
                      setSelectedCustomer('');
                      setCustomerSearchTerm('');
                      setShowCustomerDropdown(false);
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
                    {filteredCustomers.map((customer, index) => (
                     <div
                       key={customer.NAME}
                       onClick={() => {
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
                  </div>
                )}
              </div>
            </div>

            {/* Cart Button and Refresh Icon */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '10px',
              flex: '0 0 180px'
            }}>
              <button
                onClick={navigateToPlaceOrder}
                disabled={!company || !selectedCustomer || cart.length === 0}
                style={{
                  background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: (!company || !selectedCustomer || cart.length === 0) ? 'not-allowed' : 'pointer',
                  opacity: (!company || !selectedCustomer || cart.length === 0) ? 0.5 : 1,
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '12px 20px'
                }}
                title={cart.length === 0 ? "Add items to cart first" : "Proceed to Place Order"}
              >
                <span className="material-icons" style={{ fontSize: '18px' }}>shopping_cart</span>
                {cart.length === 0 ? 'Cart Empty' : `Cart (${cart.length})`}
              </button>
              
            </div>
          </div>
          
          {/* Credit Information */}
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
        </div>
      </div>

      {/* Products Display Section */}
      {selectedCustomer && (
        <div style={{
          background: '#fff',
          margin: '0px 24px 24px 24px',
          maxWidth: '1400px',
          width: 'auto',
          borderRadius: '16px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          border: '1px solid #e5e7eb',
          padding: '24px',
          boxSizing: 'border-box'
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            marginBottom: '24px'
          }}>
            <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '600', color: '#1f2937' }}>
              Available Products ({filteredStockItems.length.toLocaleString()})
            </h2>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type="text"
                value={productSearchTerm}
                onChange={(e) => setProductSearchTerm(e.target.value)}
                placeholder="Search item or part no..."
                style={{
                  width: 340,
                  padding: '10px 36px 10px 14px',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  fontSize: 14
                }}
              />
              {productSearchTerm && (
                <button
                  onClick={() => setProductSearchTerm('')}
                  title="Clear"
                  style={{
                    position: 'absolute',
                    right: 8,
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#64748b',
                    fontSize: 18,
                    lineHeight: 1
                  }}
                >
                  ×
                </button>
              )}
            </div>
          </div>

          <div style={{
            width: '100%',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '24px',
            padding: '20px 0',
            maxHeight: '800px',
            overflowY: 'auto'
          }}>
            {filteredStockItems.map((item, index) => {
              const cartItem = cart.find(cartItem => cartItem.NAME === item.NAME);
              
              return (
                <div key={item.NAME || index} style={{
                  background: '#fff',
                  borderRadius: 12,
                  padding: '16px 12px',
                  boxShadow: '0 2px 8px 0 rgba(31,38,135,0.08)',
                  border: '1px solid #e2e8f0',
                  transition: 'all 0.2s ease',
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                  minHeight: canShowImage ? '320px' : '260px',
                  display: 'flex',
                  flexDirection: 'column'
                }} onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 16px 0 rgba(31,38,135,0.12)';
                }} onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 8px 0 rgba(31,38,135,0.08)';
                }}>
                  {/* Product Info */}
                  <div style={{ marginBottom: 12, flex: 1 }}>
                    {/* Product Image or Placeholder Icon */}
                    <div 
                      data-item-name={item.NAME}
                      style={{
                      width: '100%',
                      height: '120px',
                      marginBottom: '12px',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      backgroundColor: '#f8fafc',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative'
                    }}>
<<<<<<< HEAD
                      {canShowImage && item.IMAGEPATH ? (
                        <>
                          <img
                            src={imageUrlMap[item.NAME] || convertGoogleDriveToImageUrl(item.IMAGEPATH) || item.IMAGEPATH}
                            alt={item.NAME}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                              borderRadius: '8px',
                              position: 'absolute',
                              top: 0,
                              left: 0
                            }}
                            onLoad={() => {
                              // If image loads successfully, make sure iframe is not shown
                              if (isGoogleDriveLink(item.IMAGEPATH)) {
                                const parent = document.querySelector(`[data-item-name="${item.NAME}"]`);
                                if (parent) {
                                  const existingIframe = parent.querySelector('iframe');
                                  if (existingIframe) {
                                    existingIframe.remove();
                                    console.log('Image loaded successfully, removed iframe fallback');
                                  }
                                }
                              }
                            }}
                            onError={(e) => {
                              // If Google Drive conversion failed, try smaller thumbnails first
                              if (isGoogleDriveLink(item.IMAGEPATH)) {
                                const fileId = extractGoogleDriveFileId(item.IMAGEPATH);
                                if (fileId) {
                                  const currentSrc = e.target.src;
                                  const errorCount = parseInt(e.target.dataset.errorCount || '0');
                                  
                                  // Try smaller CDN sizes first (most reliable)
                                  const fallbackMethods = [
                                    `https://lh3.googleusercontent.com/d/${fileId}=w400`, // Smaller CDN
                                    `https://lh3.googleusercontent.com/d/${fileId}=w200`, // Very small CDN
                                    `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`, // Old thumbnail API as backup
                                    `https://drive.google.com/uc?export=view&id=${fileId}`, // Direct view as last image attempt
                                  ];
                                  
                                  // Try thumbnail methods with delays to avoid rate limiting
                                  if (errorCount < fallbackMethods.length) {
                                    const nextMethod = fallbackMethods[errorCount];
                                    e.target.dataset.errorCount = (errorCount + 1).toString();
                                    
                                    // Add delay to avoid rate limiting (3s, 6s, 9s)
                                    setTimeout(() => {
                                      console.log(`Retrying Google Drive file ${fileId} with method ${errorCount + 1}:`, nextMethod);
                                      e.target.src = nextMethod;
                                      e.target.style.display = 'block'; // Make sure img is visible
                                    }, 3000 * (errorCount + 1));
                                    return;
                                  }
                                  
                                  // Only use iframe if ALL image methods fail (including all thumbnail sizes)
                                  // Check if iframe already exists to avoid duplicates
                                  const parent = e.target.parentElement;
                                  const existingIframe = parent.querySelector('iframe');
                                  if (!existingIframe) {
                                    e.target.style.display = 'none';
                                    const iframeContainer = document.createElement('div');
                                    iframeContainer.style.cssText = `
                                      width: 100%;
                                      height: 100%;
                                      position: absolute;
                                      top: 0;
                                      left: 0;
                                      border-radius: 8px;
                                      overflow: hidden;
                                    `;
                                    const iframe = document.createElement('iframe');
                                    iframe.src = `https://drive.google.com/file/d/${fileId}/preview`;
                                    iframe.style.cssText = `
                                      width: 100%;
                                      height: 100%;
                                      border: none;
                                      pointer-events: none;
                                    `;
                                    iframe.setAttribute('sandbox', 'allow-same-origin allow-scripts');
                                    iframeContainer.appendChild(iframe);
                                    parent.appendChild(iframeContainer);
                                    console.log('Using iframe fallback for Google Drive file (CSP warnings are harmless)');
                                  }
                                  return;
                                }
                              }
                              
                              // Show placeholder if all attempts fail
                              console.warn('⚠️ All image loading methods failed for:', item.IMAGEPATH);
                              e.target.style.display = 'none';
                              const placeholder = e.target.nextElementSibling;
                              if (placeholder) {
                                placeholder.style.display = 'flex';
                              }
                            }}
                          />
                          <div style={{
                            width: '100%',
                            height: '100%',
                            display: 'none',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '2px dashed #d1d5db',
                            borderRadius: '8px'
                          }}>
                            <span className="material-icons" style={{
                              fontSize: '32px',
                              color: '#9ca3af'
                            }}>
                              inventory_2
                            </span>
                          </div>
                        </>
                      ) : (
                        <div style={{
                          width: '100%',
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: '2px dashed #d1d5db',
                          borderRadius: '8px'
                        }}>
                          <span className="material-icons" style={{
                            fontSize: '32px',
                            color: '#9ca3af'
                          }}>
                            inventory_2
                          </span>
                        </div>
                      )}
=======
                      <ProductImage 
                        imagePath={item.IMAGEPATH} 
                        itemName={item.NAME}
                        googleToken={googleToken}
                        imageUrlCacheRef={imageUrlCache}
                        canShowImage={canShowImage}
                      />
>>>>>>> 97cc187618a1b9becc15fd103b173a40072c661c
                    </div>
                    
                    {/* Product Details */}
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px'
                    }}>
                      {/* Item Name */}
                      <h3 style={{
                        fontSize: 16,
                        fontWeight: 600,
                        color: '#1e293b',
                        margin: 0,
                        lineHeight: 1.4,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {item.NAME}
                      </h3>
                      
                      {/* Part Number and Stock */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px'
                      }}>
                        <span style={{
                          fontSize: 13,
                          color: '#64748b',
                          fontWeight: 500
                        }}>
                          Part: {item.PARTNO || 'N/A'}
                        </span>
                        {canShowClosingStock && (
                          <span 
                            style={{
                              fontSize: 12,
                              color: '#64748b',
                              background: '#f1f5f9',
                              padding: '4px 8px',
                              borderRadius: 4,
                              cursor: canShowStockBreakdown ? 'pointer' : 'default',
                              textDecoration: canShowStockBreakdown ? 'underline' : 'none',
                              textDecorationColor: canShowStockBreakdown ? '#3b82f6' : 'transparent',
                              textUnderlineOffset: '2px',
                              whiteSpace: 'nowrap'
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStockFieldClick(item.NAME);
                            }}
                          >
                            {(() => {
                              const stockValue = item.CLOSINGSTOCK || 0;
                              if (canShowClosingStockYesNo) {
                                return stockValue > 0 ? 'Yes in stock' : 'No stock';
                              }
                              return `${stockValue} in stock`;
                            })()}
                          </span>
                        )}
                      </div>
                      
                      {/* Price */}
                      {canShowRateAmtColumn && (
                        <div style={{
                          fontSize: 18,
                          fontWeight: 700,
                          color: '#059669',
                          marginTop: '4px'
                        }}>
                          ₹{computeRateForItem(item).toFixed(2)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Add to Cart Button or Quantity Control */}
                  <div style={{ marginTop: 'auto', paddingTop: '12px' }}>
                    {(() => {
                      if (cartItem) {
                        return (
                          <div style={{
                            width: 'calc(88% - 8px)',
                            height: '36px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            background: '#fef3c7',
                            border: '2px solid #f59e0b',
                            borderRadius: '8px',
                            padding: '0 12px',
                            gap: '8px',
                            margin: '0 4px'
                          }}>
                            <button
                              onClick={() => updateQuantity(item.NAME, cartItem.quantity - 1)}
                              style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '4px',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#374151',
                                fontSize: '14px',
                                transition: 'all 0.2s ease',
                                minWidth: '20px',
                                minHeight: '20px'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#fbbf24';
                                e.currentTarget.style.transform = 'scale(1.1)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                                e.currentTarget.style.transform = 'scale(1)';
                              }}
                              title={cartItem.quantity === 1 ? "Remove from cart" : "Decrease quantity"}
                            >
                              {cartItem.quantity === 1 ? '🗑️' : '➖'}
                            </button>
                            
                            <span style={{
                              fontSize: '16px',
                              fontWeight: '600',
                              color: '#374151',
                              minWidth: '24px',
                              textAlign: 'center',
                              flex: 1
                            }}>
                              {cartItem.quantity}
                            </span>
                            
                            <button
                              onClick={() => updateQuantity(item.NAME, cartItem.quantity + 1)}
                              style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '4px',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#374151',
                                fontSize: '16px',
                                fontWeight: 'bold',
                                transition: 'all 0.2s ease',
                                minWidth: '20px',
                                minHeight: '20px'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#fbbf24';
                                e.currentTarget.style.transform = 'scale(1.1)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                                e.currentTarget.style.transform = 'scale(1)';
                              }}
                              title="Increase quantity"
                            >
                              ➕
                            </button>
                          </div>
                        );
                      } else {
                        return (
                          <button
                            onClick={() => addToCart(item)}
                            style={{
                              width: 'calc(100% - 8px)',
                              height: '36px',
                              padding: '0 12px',
                              background: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)',
                              color: '#fff',
                              border: 'none',
                              borderRadius: 8,
                              fontWeight: 600,
                              fontSize: 14,
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 8,
                              margin: '0 4px'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = 'scale(1.02)';
                              e.currentTarget.style.boxShadow = '0 4px 12px 0 rgba(59,130,246,0.3)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = 'scale(1)';
                              e.currentTarget.style.boxShadow = 'none';
                            }}
                          >
                            <span className="material-icons" style={{ fontSize: 16 }}>add_shopping_cart</span>
                            Add to Cart
                          </button>
                        );
                      }
                    })()}
                  </div>
                </div>
              );
            })}
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
                })()} Stock Breakdown - {stockBreakdownData?.item || 'Item'}
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
      
      {/* Overdue Bills Modal */}
      {showOverdueBills && creditLimitData && creditLimitData.overdueBills && creditLimitData.overdueBills.length > 0 && (
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
          zIndex: 1000
        }} onClick={() => setShowOverdueBills(false)}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '0',
            maxWidth: '800px',
            maxHeight: '80vh',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h2 style={{
                margin: 0,
                fontSize: '18px',
                fontWeight: '600',
                color: '#1f2937'
              }}>Overdue Bills Details</h2>
              <button 
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#6b7280',
                  padding: '4px',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '32px'
                }} 
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
    </div>
  );
}

export default PlaceOrder_ECommerce;
