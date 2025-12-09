import React, { useState, useEffect, useMemo, useRef } from 'react';
import { getApiUrl, API_CONFIG, GOOGLE_DRIVE_CONFIG, isGoogleDriveFullyConfigured } from '../config';
import { apiGet, apiPost } from '../utils/apiUtils';
import { deobfuscateStockItems, enhancedDeobfuscateValue } from '../utils/frontendDeobfuscate';
import { getUserModules, hasPermission, getPermissionValue } from '../config/SideBarConfigurations';
import { getGoogleTokenFromConfigs, getGoogleDriveImageUrl, getGoogleDriveThumbnailUrl, getGoogleDriveCDNUrl } from '../utils/googleDriveUtils';
import { useIsMobile } from './MobileViewConfig';
import { isGoogleDriveLink, convertGoogleDriveToImageUrl, detectGoogleDriveFileType } from '../utils/googleDriveImageUtils';

function PlaceOrder_ECommerce() {
  // Detect mobile view
  const isMobile = useIsMobile();

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
      console.log('🔄 Refreshing user modules:', modules.length);
      setUserModules(prevModules => {
        // Only update if modules actually changed
        if (JSON.stringify(prevModules) !== JSON.stringify(modules)) {
          return modules;
        }
        return prevModules;
      });
    };

    updateUserModules();

    // Listen for permission updates
    window.addEventListener('userAccessUpdated', updateUserModules);
    window.addEventListener('companyChanged', updateUserModules);
    
    // Also listen for storage changes (in case permissions are updated via localStorage/sessionStorage)
    const handleStorageChange = (e) => {
      if (e.key === 'userModules' || e.key === 'userAccess' || e.key?.includes('permission')) {
        console.log('🔄 Storage change detected, refreshing permissions');
        updateUserModules();
      }
    };
    window.addEventListener('storage', handleStorageChange);
    
    // Poll for permission changes every 2 seconds (as a fallback)
    const pollInterval = setInterval(() => {
      updateUserModules();
    }, 2000);
    
    // Also refresh when page becomes visible (user switches back to tab)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('🔄 Page visible, refreshing permissions');
        updateUserModules();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Refresh on window focus
    const handleFocus = () => {
      console.log('🔄 Window focused, refreshing permissions');
      updateUserModules();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('userAccessUpdated', updateUserModules);
      window.removeEventListener('companyChanged', updateUserModules);
      window.removeEventListener('storage', handleStorageChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      clearInterval(pollInterval);
    };
  }, []); // Empty dependency array - only run once on mount


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
  
  // Check if user has upload_image permission (for uploading/editing media)
  // First, try to find any permission with "upload" in the key dynamically
  const ecommerceModule = userModules.find(m => m.module_name === 'ecommerce_place_order');
  const uploadPermissions = ecommerceModule?.permissions?.filter(p => {
    if (!p.granted || !p.permission_key) return false;
    const key = p.permission_key.toLowerCase();
    // Match permissions that explicitly have "upload" in the key
    // OR have both "item" and "image" (likely upload_item_image variants)
    // BUT exclude "show_image" which is for viewing only
    return (key.includes('upload') || 
            (key.includes('item') && key.includes('image'))) &&
           !key.includes('show_image'); // Explicitly exclude show_image
  }) || [];
  
  // Try multiple possible permission keys for upload functionality
  // NOTE: show_image is for VIEWING images only, NOT for uploading - do NOT use as fallback
  const canUploadImage = hasPermission('ecommerce_place_order', 'upload_image', userModules) ||
                         hasPermission('ecommerce_place_order', 'item_image_upload', userModules) ||
                         hasPermission('ecommerce_place_order', 'upload_item_image', userModules) ||
                         hasPermission('ecommerce_place_order', 'itemimageupload', userModules) ||
                         hasPermission('ecommerce_place_order', 'uploaditemimage', userModules) ||
                         uploadPermissions.length > 0; // If any upload permission is granted
  
  // Debug logging for permission check - log all available permissions
  useEffect(() => {
    const ecommerceModule = userModules.find(m => m.module_name === 'ecommerce_place_order');
    const allPermissionKeys = ecommerceModule?.permissions?.map(p => p.permission_key || p.key) || [];
    const grantedPermissions = ecommerceModule?.permissions?.filter(p => p.granted) || [];
    const grantedKeys = grantedPermissions.map(p => p.permission_key || p.key);
    
    console.log('🔍 Media Upload Permission Check:', {
      canUploadImage,
      canShowImage,
      upload_image: hasPermission('ecommerce_place_order', 'upload_image', userModules),
      item_image_upload: hasPermission('ecommerce_place_order', 'item_image_upload', userModules),
      upload_item_image: hasPermission('ecommerce_place_order', 'upload_item_image', userModules),
      itemimageupload: hasPermission('ecommerce_place_order', 'itemimageupload', userModules),
      uploaditemimage: hasPermission('ecommerce_place_order', 'uploaditemimage', userModules),
      show_image: hasPermission('ecommerce_place_order', 'show_image', userModules),
      uploadPermissionsCount: uploadPermissions.length,
      note: 'show_image is for VIEWING only, NOT for uploading',
      userModulesCount: userModules.length,
      ecommerceModule: ecommerceModule,
      allPermissionKeys: allPermissionKeys,
      grantedKeys: grantedKeys,
      allPermissions: ecommerceModule?.permissions || []
    });
    
    // Also log permissions that contain "image" or "upload"
    const imageRelatedPermissions = allPermissionKeys.filter(key => 
      key && (key.toLowerCase().includes('image') || key.toLowerCase().includes('upload'))
    );
    if (imageRelatedPermissions.length > 0) {
      console.log('📸 Image/Upload related permissions found:', imageRelatedPermissions);
      console.log('📸 Granted image/upload permissions:', grantedKeys.filter(key => 
        key && (key.toLowerCase().includes('image') || key.toLowerCase().includes('upload'))
      ));
    }
  }, [userModules, canUploadImage, canShowImage]);

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

  // Product detail modal state
  const [showProductModal, setShowProductModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [mediaTypeMap, setMediaTypeMap] = useState({}); // Map of mediaPath -> 'video' | 'image'

  // Product image upload modal state
  const [showImageUploadModal, setShowImageUploadModal] = useState(false);
  const [selectedProductForImage, setSelectedProductForImage] = useState(null);
  const [imageList, setImageList] = useState([]);
  const [newImageLink, setNewImageLink] = useState('');
  const [imageUploadLoading, setImageUploadLoading] = useState(false);
  const [imageUploadError, setImageUploadError] = useState('');
  const [imageUploadSuccess, setImageUploadSuccess] = useState(false);
  const [imageAddMethod, setImageAddMethod] = useState('link'); // 'link' or 'picker'
  const [isLoadingGooglePicker, setIsLoadingGooglePicker] = useState(false);
  const [mediaType, setMediaType] = useState('image'); // 'image' or 'video'

  // Helper function to parse comma-separated image paths
  const parseImagePaths = (imagePath) => {
    if (!imagePath) return [];
    // Handle case where imagePath might be an object
    let imagePathString = imagePath;
    if (typeof imagePath === 'object' && imagePath !== null) {
      imagePathString = imagePath.value || imagePath.path || imagePath.url || imagePath.IMAGEPATH || 
                       imagePath.toString?.() || 
                       (typeof imagePath === 'string' ? imagePath : '');
      if (!imagePathString || imagePathString === '[object Object]') {
        return [];
      }
    }
    if (typeof imagePathString !== 'string') return [];
    return imagePathString.split(',').map(path => path.trim()).filter(path => path.length > 0);
  };

  // Helper function to detect if a URL is a Google Drive link
  const isGoogleDriveLink = (url) => {
    if (!url || typeof url !== 'string') return false;
    return url.includes('drive.google.com') || 
           (!url.startsWith('http') && /^[a-zA-Z0-9_-]{15,}$/.test(url.trim()));
  };

  // Helper function to check Google Drive file MIME type
  const checkGoogleDriveFileType = async (filePath, accessToken) => {
    if (!filePath || !accessToken) {
      console.log('⚠️ checkGoogleDriveFileType: Missing filePath or accessToken', {
        hasPath: !!filePath,
        hasToken: !!accessToken
      });
      return null;
    }
    
    const fileId = extractGoogleDriveFileId(filePath);
    if (!fileId) {
      console.log('⚠️ checkGoogleDriveFileType: Could not extract file ID', {
        filePath: filePath?.substring(0, 50)
      });
      return null;
    }
    
    try {
      const apiUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=mimeType`;
      console.log('🔍 Checking Google Drive file MIME type:', {
        fileId: fileId.substring(0, 30),
        apiUrl,
        tokenLength: accessToken.length,
        tokenPreview: accessToken.substring(0, 20)
      });
      
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      console.log('🔍 MIME type API response:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Google Drive file MIME type retrieved:', {
          fileId: fileId.substring(0, 30),
          mimeType: data.mimeType,
          isVideo: data.mimeType?.startsWith('video/'),
          isImage: data.mimeType?.startsWith('image/')
        });
        return data.mimeType;
      } else {
        const errorText = await response.text();
        console.error('❌ MIME type API error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText.substring(0, 200)
        });
      }
    } catch (error) {
      console.error('❌ Error checking Google Drive file type:', error);
    }
    
    return null;
  };

  // Helper function to detect link type (async version that checks MIME type)
  const getLinkTypeAsync = async (url, accessToken) => {
    if (!url || typeof url !== 'string') return 'unknown';
    
    // Check if it's a Google Drive link
    if (isGoogleDriveLink(url)) {
      // If we have a token, check the actual file type via API
      if (accessToken) {
        const mimeType = await checkGoogleDriveFileType(url, accessToken);
        if (mimeType) {
          // Check if it's a video MIME type
          if (mimeType.startsWith('video/')) {
            console.log('✅ Detected as Google Drive video via MIME type:', mimeType);
            return 'google_drive_video';
          }
          // Check if it's an image MIME type
          if (mimeType.startsWith('image/')) {
            console.log('✅ Detected as Google Drive image via MIME type:', mimeType);
            return 'google_drive_image';
          }
        }
      }
      
      // Fallback: Check URL patterns
      const lowerUrl = url.toLowerCase();
      if (lowerUrl.includes('video') || lowerUrl.includes('.mp4') || lowerUrl.includes('.webm') || 
          lowerUrl.includes('.mov') || lowerUrl.includes('.avi')) {
        return 'google_drive_video';
      }
      // Default to image for Google Drive links
      return 'google_drive_image';
    }
    
    // Check if it's a direct video URL
    if (isVideoUrl(url)) {
      return 'direct_video';
    }
    
    // Default to direct image
    return 'direct_image';
  };

  // Helper function to detect link type (synchronous version for quick checks)
  const getLinkType = (url) => {
    if (!url || typeof url !== 'string') return 'unknown';
    
    // Check if it's a Google Drive link
    if (isGoogleDriveLink(url)) {
      // Check URL patterns (this is a best guess without API call)
      const lowerUrl = url.toLowerCase();
      if (lowerUrl.includes('video') || lowerUrl.includes('.mp4') || lowerUrl.includes('.webm') || 
          lowerUrl.includes('.mov') || lowerUrl.includes('.avi')) {
        return 'google_drive_video';
      }
      // Default to image for Google Drive links (will be verified with API if token available)
      return 'google_drive_image';
    }
    
    // Check if it's a direct video URL
    if (isVideoUrl(url)) {
      return 'direct_video';
    }
    
    // Default to direct image
    return 'direct_image';
  };

  // Helper function to detect if a URL is a video
  const isVideoUrl = (url) => {
    if (!url || typeof url !== 'string') return false;
    const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv', '.flv', '.wmv', '.m4v'];
    const lowerUrl = url.toLowerCase();
    return videoExtensions.some(ext => lowerUrl.includes(ext)) || 
           lowerUrl.includes('video') || 
           lowerUrl.includes('youtube.com') || 
           lowerUrl.includes('youtu.be') ||
           lowerUrl.includes('vimeo.com') ||
           (isGoogleDriveLink(url) && (lowerUrl.includes('video') || lowerUrl.includes('.mp4') || 
            lowerUrl.includes('.webm') || lowerUrl.includes('.mov') || lowerUrl.includes('.avi')));
  };

  // Helper function to extract Google Drive file ID from URL
  const extractGoogleDriveFileId = (url) => {
    if (!url || typeof url !== 'string') return null;
    
    // Pattern 1: https://drive.google.com/file/d/FILE_ID/view
    let match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (match) return match[1];
    
    // Pattern 2: https://drive.google.com/open?id=FILE_ID
    match = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (match) return match[1];
    
    // Pattern 3: https://drive.google.com/uc?id=FILE_ID
    match = url.match(/\/uc\?id=([a-zA-Z0-9_-]+)/);
    if (match) return match[1];
    
    // Pattern 4: Just the file ID itself (alphanumeric, typically 15-33 chars)
    if (/^[a-zA-Z0-9_-]{15,}$/.test(url.trim())) {
      return url.trim();
    }
    
    return null;
  };

  // Helper function to get Google Drive video preview URL (iframe method)
  const getGoogleDriveVideoPreviewUrl = (videoPath) => {
    if (!videoPath) return null;

    // Extract file ID
    const fileId = extractGoogleDriveFileId(videoPath);
    
    if (!fileId) {
      console.log('⚠️ getGoogleDriveVideoPreviewUrl: Could not extract file ID from:', videoPath?.substring(0, 100));
      return null;
    }

    // Create preview URL: https://drive.google.com/file/d/FILE_ID/preview
    const previewUrl = `https://drive.google.com/file/d/${fileId}/preview`;
    console.log('✅ getGoogleDriveVideoPreviewUrl: Created preview URL', {
      fileId: fileId.substring(0, 30),
      previewUrl
    });
    
    return previewUrl;
  };

  // Helper function to get Google Drive video URL (for direct video URLs, not Google Drive)
  const getGoogleDriveVideoUrl = async (videoPath, accessToken) => {
    // If it's a Google Drive link, use iframe method instead
    if (isGoogleDriveLink(videoPath)) {
      return getGoogleDriveVideoPreviewUrl(videoPath);
    }

    // For direct video URLs (not Google Drive), return as-is
    if (videoPath && videoPath.startsWith('http')) {
      return videoPath;
    }

    return null;
  };

  // Google token state for image display
  const [googleToken, setGoogleToken] = useState(null);
  const imageUrlCache = useRef(new Map()); // Cache for image URLs (useRef to avoid re-renders)
  const videoUrlCache = useRef(new Map()); // Cache for video URLs (useRef to avoid re-renders)

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
        if (token) {
          console.log('✅ Google token fetched successfully in PlaceOrder_ECommerce:', {
            tokenLength: token.length,
            tokenPreview: `${token.substring(0, 50)}...`,
            tokenEnd: `...${token.substring(Math.max(0, token.length - 50))}`,
            fullToken: token, // Full token for verification
            isString: typeof token === 'string',
            isEmpty: token.trim().length === 0,
            startsWith: token.substring(0, 30),
            endsWith: token.substring(Math.max(0, token.length - 30))
          });
          setGoogleToken(token);
        } else {
          console.warn('⚠️ Google token fetch returned null/undefined. Token may not be configured in company settings.');
          setGoogleToken(null);
        }
      } catch (error) {
        console.error('❌ Error fetching Google token:', error);
        setGoogleToken(null);
      }
    };

    fetchGoogleToken();
  }, [company, companies]);

  // Detect media types (video vs image) when modal opens or product changes
  useEffect(() => {
    const detectMediaTypes = async () => {
      if (!showProductModal || !selectedProduct || !selectedProduct.IMAGEPATH) {
        setMediaTypeMap({});
        return;
      }

      const mediaPaths = parseImagePaths(selectedProduct.IMAGEPATH);
      if (mediaPaths.length === 0) {
        setMediaTypeMap({});
        return;
      }

      console.log('🔍 Detecting media types for', mediaPaths.length, 'items');
      const typeMap = {};

      // First pass: Set initial types synchronously (will be updated if async detection finds different type)
      for (const mediaPath of mediaPaths) {
        const linkType = getLinkType(mediaPath);
        typeMap[mediaPath] = linkType === 'google_drive_video' || linkType === 'direct_video' || isVideoUrl(mediaPath) ? 'video' : 'image';
        console.log('🔍 Media type detected (initial sync):', {
          path: mediaPath ? mediaPath.substring(0, 50) : 'null',
          type: typeMap[mediaPath],
          linkType
        });
      }

      // Set initial map immediately so modal can render
      setMediaTypeMap(typeMap);

      // Second pass: Use async detection if we have a token and it's a Google Drive link
      // This will update the map with accurate MIME type detection
      for (const mediaPath of mediaPaths) {
        if (googleToken && isGoogleDriveLink(mediaPath)) {
          try {
            const linkType = await getLinkTypeAsync(mediaPath, googleToken);
            const detectedType = linkType === 'google_drive_video' || linkType === 'direct_video' ? 'video' : 'image';
            
            // Only update if different from initial detection
            if (typeMap[mediaPath] !== detectedType) {
              typeMap[mediaPath] = detectedType;
              console.log('🔍 Media type updated (async with token):', {
                path: mediaPath ? mediaPath.substring(0, 50) : 'null',
                oldType: typeMap[mediaPath] === 'video' ? 'image' : 'video',
                newType: detectedType,
                linkType,
                mimeType: linkType // This will show if MIME type was checked
              });
              // Update map immediately when type changes
              setMediaTypeMap({ ...typeMap });
            } else {
              console.log('🔍 Media type confirmed (async with token):', {
                path: mediaPath ? mediaPath.substring(0, 50) : 'null',
                type: detectedType,
                linkType
              });
            }
          } catch (error) {
            console.warn('⚠️ Error detecting media type, keeping initial detection:', error);
          }
        }
      }

      console.log('✅ Final media type map:', typeMap);
      setMediaTypeMap(typeMap);
    };

    detectMediaTypes();
  }, [showProductModal, selectedProduct, googleToken]);

  // Re-check MIME type when selected media changes (if not already detected)
  useEffect(() => {
    const recheckSelectedMedia = async () => {
      if (!showProductModal || !selectedProduct || !selectedProduct.IMAGEPATH || !googleToken) {
        return;
      }

      const mediaPaths = parseImagePaths(selectedProduct.IMAGEPATH);
      const currentMediaPath = mediaPaths[selectedImageIndex] || mediaPaths[0];
      
      if (!currentMediaPath || !isGoogleDriveLink(currentMediaPath)) {
        return;
      }

      // Re-check MIME type for the currently selected media
      console.log('🔍 Re-checking MIME type for selected media', {
        path: currentMediaPath ? currentMediaPath.substring(0, 50) : 'null',
        index: selectedImageIndex
      });
      try {
        const mimeType = await checkGoogleDriveFileType(currentMediaPath, googleToken);
        if (mimeType) {
          const detectedType = mimeType.startsWith('video/') ? 'video' : 'image';
          setMediaTypeMap(prev => {
            // Check if already detected to avoid unnecessary updates
            if (prev[currentMediaPath] === detectedType) {
              console.log('⏭️ Media type already detected, skipping update');
              return prev;
            }
            console.log('✅ Updating media type map:', {
              path: currentMediaPath ? currentMediaPath.substring(0, 50) : 'null',
              oldType: prev[currentMediaPath],
              newType: detectedType,
              mimeType
            });
            return {
              ...prev,
              [currentMediaPath]: detectedType
            };
          });
        }
      } catch (error) {
        console.warn('⚠️ Error re-checking selected media type:', error);
      }
    };

    // Small delay to avoid too many API calls
    const timeoutId = setTimeout(recheckSelectedMedia, 300);
    return () => clearTimeout(timeoutId);
  }, [selectedImageIndex, showProductModal, selectedProduct, googleToken]);

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
        if (pl && pl.RATE !== undefined && pl.RATE !== null) {
          // Handle both obfuscated strings and already-deobfuscated numbers
          const rate = typeof pl.RATE === 'string' ? enhancedDeobfuscateValue(pl.RATE) : pl.RATE;
          const parsedRate = parseFloat(rate);
          return isNaN(parsedRate) ? 0 : parsedRate;
        }
        return 0;
      }
      // Fallback to STDPRICE (already deobfuscated in fetch or cache)
      // Handle both string and number formats
      const stdPrice = typeof item.STDPRICE === 'string' 
        ? (enhancedDeobfuscateValue(item.STDPRICE) || item.STDPRICE)
        : item.STDPRICE;
      const parsedPrice = parseFloat(stdPrice);
      return isNaN(parsedPrice) ? 0 : parsedPrice;
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
      console.log('Refresh requested:', !!refreshCustomers);

      // Check OPFS cache first (new storage)
      if (!refreshCustomers) {
        try {
          const { getCustomersFromOPFS } = await import('../utils/cacheSyncManager');
          const customers = await getCustomersFromOPFS(cacheKey);
          if (customers && Array.isArray(customers) && customers.length > 0) {
            console.log('Using cached customer data from OPFS');
            setCustomerOptions(customers);
            setCustomerLoading(false);
            return;
          }
        } catch (e) {
          console.warn('Error loading from OPFS, will fetch fresh:', e);
        }
      }

      // Only read from cache - do not fetch from API
      // Cache updates are handled by Cache Management page
      try {
        const { getCustomersFromOPFS } = await import('../utils/cacheSyncManager');
        const customers = await getCustomersFromOPFS(cacheKey);

        if (customers && Array.isArray(customers) && customers.length > 0) {
          console.log(`✅ Loaded ${customers.length} customers from cache`);
          setCustomerOptions(customers);
          // Don't auto-select customer if we're auto-populating from cart
          if (!isAutoPopulating) {
            if (customers.length === 1) setSelectedCustomer(customers[0].NAME);
            else setSelectedCustomer('');
          }
        } else {
          // No cache found - user needs to refresh from Cache Management
          console.warn('No customer cache found. Please refresh from Cache Management.');
          setCustomerOptions([]);
          setSelectedCustomer('');
        }
      } catch (err) {
        console.error('Error loading customers from cache:', err);
        setCustomerOptions([]);
        setSelectedCustomer('');
      } finally {
        setCustomerLoading(false);
      }
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
      console.log('Refresh requested:', !!refreshStockItems);

      // Check cache first (sessionStorage)
      if (!refreshStockItems) {
        try {
          const { getItemsFromOPFS } = await import('../utils/cacheSyncManager');
          const items = await getItemsFromOPFS(cacheKey);
          if (items && Array.isArray(items) && items.length > 0) {
            console.log(`✅ Loaded ${items.length} stock items from cache`);
            // Log sample item to verify structure
            if (items.length > 0) {
              const sampleItem = items[0];
              console.log('Sample cached item structure:', {
                NAME: sampleItem.NAME,
                hasSTDPRICE: !!sampleItem.STDPRICE,
                STDPRICE: sampleItem.STDPRICE,
                STDPRICE_type: typeof sampleItem.STDPRICE,
                hasLASTPRICE: !!sampleItem.LASTPRICE,
                hasPRICELEVELS: !!sampleItem.PRICELEVELS,
                PRICELEVELS_count: sampleItem.PRICELEVELS?.length || 0,
                hasIMAGEPATH: !!sampleItem.IMAGEPATH,
                IMAGEPATH: sampleItem.IMAGEPATH ? (sampleItem.IMAGEPATH.length > 50 ? sampleItem.IMAGEPATH.substring(0, 50) + '...' : sampleItem.IMAGEPATH) : 'undefined',
                IMAGEPATH_type: typeof sampleItem.IMAGEPATH,
                // Check for alternative field names
                hasImagePath: !!sampleItem.imagePath,
                hasimagepath: !!sampleItem.imagepath,
                allKeys: Object.keys(sampleItem).filter(k => k.toLowerCase().includes('image')),
                hasPARTNO: !!sampleItem.PARTNO,
                hasCLOSINGSTOCK: sampleItem.CLOSINGSTOCK !== undefined
              });
            }
            // Items from cache are already deobfuscated (done in syncItems)
            // Normalize items to ensure consistent field names (handle case variations)
            const normalizedItems = items.map(item => {
              if (!item || !item.NAME) return null;
              // Ensure IMAGEPATH exists (check for case variations)
              if (!item.IMAGEPATH) {
                item.IMAGEPATH = item.imagePath || item.imagepath || item.IMAGE_PATH || item.ImagePath || null;
              }
              return item;
            }).filter(item => item !== null);
            
            // Count items with images
            const itemsWithImages = normalizedItems.filter(item => item.IMAGEPATH && item.IMAGEPATH.trim().length > 0).length;
            
            if (normalizedItems.length > 0) {
              console.log(`✅ Normalized ${normalizedItems.length} items from cache (${items.length - normalizedItems.length} invalid items filtered, ${itemsWithImages} items have images)`);
              setStockItems(normalizedItems);
              setStockItemsLoading(false);
            return;
            } else {
              console.warn('Cached items found but none are valid after normalization, fetching fresh');
            }
          }
        } catch (e) {
          console.warn('Error loading from cache, will fetch fresh:', e);
        }
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

          // Log sample item structure for debugging
          if (decryptedItems.length > 0) {
            const sampleItem = decryptedItems[0];
            console.log('Sample fresh item structure after deobfuscation:', {
              NAME: sampleItem.NAME,
              hasSTDPRICE: !!sampleItem.STDPRICE,
              STDPRICE: sampleItem.STDPRICE,
              STDPRICE_type: typeof sampleItem.STDPRICE,
              hasLASTPRICE: !!sampleItem.LASTPRICE,
              hasPRICELEVELS: !!sampleItem.PRICELEVELS,
              PRICELEVELS_count: sampleItem.PRICELEVELS?.length || 0,
              hasIMAGEPATH: !!sampleItem.IMAGEPATH,
              IMAGEPATH: sampleItem.IMAGEPATH ? (sampleItem.IMAGEPATH.length > 50 ? sampleItem.IMAGEPATH.substring(0, 50) + '...' : sampleItem.IMAGEPATH) : 'undefined',
              IMAGEPATH_type: typeof sampleItem.IMAGEPATH,
              // Check for alternative field names
              hasImagePath: !!sampleItem.imagePath,
              hasimagepath: !!sampleItem.imagepath,
              allKeys: Object.keys(sampleItem).filter(k => k.toLowerCase().includes('image')),
              hasPARTNO: !!sampleItem.PARTNO,
              hasCLOSINGSTOCK: sampleItem.CLOSINGSTOCK !== undefined
            });
          }
          
          // Normalize items to ensure consistent field names
          const normalizedItems = decryptedItems.map(item => {
            if (!item || !item.NAME) return null;
            // Ensure IMAGEPATH exists (check for case variations)
            if (!item.IMAGEPATH) {
              item.IMAGEPATH = item.imagePath || item.imagepath || item.IMAGE_PATH || item.ImagePath || null;
            }
            return item;
          }).filter(item => item !== null);
          
          // Count items with images
          const itemsWithImages = normalizedItems.filter(item => item.IMAGEPATH && item.IMAGEPATH.trim().length > 0).length;
          
          console.log(`✅ Normalized ${normalizedItems.length} fresh items (${decryptedItems.length - normalizedItems.length} invalid items filtered, ${itemsWithImages} items have images)`);

          setStockItems(normalizedItems);
          // Also cache in sessionStorage for consistency with getItemsFromOPFS
          try {
            sessionStorage.setItem(cacheKey, JSON.stringify(normalizedItems));
            console.log('✅ Cached normalized stock items in sessionStorage');
          } catch (cacheError) {
            console.warn('Failed to cache stock items in sessionStorage:', cacheError.message);
          }
          // Cache the deobfuscated result in OPFS (handles large data)
          try {
            const { hybridCache } = await import('../utils/hybridCache');
            await hybridCache.setSalesData(cacheKey, { stockItems: normalizedItems }, null);
            console.log('✅ Cached normalized stock items in OPFS');
          } catch (cacheError) {
            console.warn('Failed to cache stock items in OPFS:', cacheError.message);
          }
          console.log(`✅ Stock items fetched, deobfuscated, and normalized: ${normalizedItems.length} items`);
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
          const amount = parseFloat(cartItem.quantity || 0) * parseFloat(cartItem.rate || 0) * (1 - (parseFloat(cartItem.discountPercent || 0) / 100));
          return sum + amount;
        }, 0);

        const itemAmount = defQtyValue * parseFloat(item.rate || 0) * (1 - (parseFloat(item.discountPercent || 0) / 100));
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

  // Handle adding new image
  const handleAddImage = () => {
    if (!newImageLink.trim()) {
      setImageUploadError(`Please enter a Google Drive ${mediaType} link`);
      return;
    }

    // Validate Google Drive link format
    const trimmedLink = newImageLink.trim();
    const isGoogleDrive = isGoogleDriveLink(trimmedLink);
    
    if (!isGoogleDrive) {
      setImageUploadError('Please enter a valid Google Drive link');
      return;
    }

    // Extract file ID from various Google Drive URL formats
    let fileId = null;
    
    if (trimmedLink.includes('drive.google.com')) {
      const patterns = [
        /\/file\/d\/([a-zA-Z0-9_-]+)/,  // /file/d/FILE_ID
        /\/d\/([a-zA-Z0-9_-]+)/,        // /d/FILE_ID
        /\/uc\?id=([a-zA-Z0-9_-]+)/,    // /uc?id=FILE_ID
        /\/open\?id=([a-zA-Z0-9_-]+)/,   // /open?id=FILE_ID
        /[?&]id=([a-zA-Z0-9_-]+)/,      // ?id=FILE_ID or &id=FILE_ID
      ];
      
      for (const pattern of patterns) {
        const match = trimmedLink.match(pattern);
        if (match && match[1]) {
          fileId = match[1];
          break;
        }
      }
    } else if (/^[a-zA-Z0-9_-]{15,}$/.test(trimmedLink)) {
      // It's already a file ID
      fileId = trimmedLink;
    }

    if (!fileId) {
      setImageUploadError('Could not extract file ID from Google Drive link');
      return;
    }

    // For images: Convert to CDN URL (lh3 format)
    // For videos: Convert to preview URL format
    let processedUrl;
    if (mediaType === 'image') {
      processedUrl = `https://lh3.googleusercontent.com/d/${fileId}=w800`;
    } else {
      // For videos, use preview URL format for iframe loading
      processedUrl = `https://drive.google.com/file/d/${fileId}/preview`;
    }

    // Check if media already exists (check processed URL, file ID, and original link)
    const alreadyExists = imageList.some(path => {
      // Validate path is a string
      if (!path || typeof path !== 'string') {
        return false;
      }
      
      // Extract file ID from various formats for comparison
      let existingFileId = null;
      
      if (path.includes('lh3.googleusercontent.com')) {
        const match = path.match(/\/d\/([a-zA-Z0-9_-]+)=/);
        existingFileId = match ? match[1] : null;
      } else if (path.includes('drive.google.com')) {
        const patterns = [
          /\/file\/d\/([a-zA-Z0-9_-]+)/,
          /\/d\/([a-zA-Z0-9_-]+)/,
          /\/uc\?id=([a-zA-Z0-9_-]+)/,
          /\/open\?id=([a-zA-Z0-9_-]+)/,
          /[?&]id=([a-zA-Z0-9_-]+)/,
        ];
        for (const pattern of patterns) {
          const match = path.match(pattern);
          if (match && match[1]) {
            existingFileId = match[1];
            break;
          }
        }
      } else if (/^[a-zA-Z0-9_-]{15,}$/.test(path.trim())) {
        existingFileId = path.trim();
      }
      
      return existingFileId === fileId || path === processedUrl || path === trimmedLink;
    });
    
    if (alreadyExists) {
      setImageUploadError(`This ${mediaType} is already in the list`);
      return;
    }

    // Add processed URL to list
    setImageList([...imageList, processedUrl]);
    setNewImageLink('');
    setImageUploadError('');
    console.log(`✅ Converted Google Drive ${mediaType} link:`, {
      original: trimmedLink,
      fileId,
      processedUrl,
      type: mediaType,
      'Note': mediaType === 'image' 
        ? 'CDN URL stored for direct loading from backend'
        : 'Preview URL stored for iframe loading'
    });
  };

  // Handle deleting image
  const handleDeleteImage = (index) => {
    const newList = imageList.filter((_, i) => i !== index);
    setImageList(newList);
    setImageUploadError('');
  };

  // Authenticate with Google - ONLY use token from company configurations
  const authenticateGoogle = async () => {
    try {
      // Check if credentials are configured
      if (!GOOGLE_DRIVE_CONFIG.CLIENT_ID || !GOOGLE_DRIVE_CONFIG.API_KEY) {
        throw new Error('Google API credentials not configured.');
      }

      // Get current company
      const currentCompany = companies.find(c => c.guid === company);
      if (!currentCompany) {
        throw new Error('Company information not found');
      }

      // ONLY use token from backend configs (company configuration)
      // Do not fall back to user authentication
      const { tallyloc_id, guid } = currentCompany;
        const storedToken = await getGoogleTokenFromConfigs(tallyloc_id, guid);
        if (storedToken) {
        console.log('✅ Using Google token from company configuration');
          return storedToken;
      }

      // No token found in company configs - throw error
      throw new Error('Google Drive token not configured for this company. Please configure it in company settings.');
    } catch (error) {
      console.error('Google authentication failed:', error);
      throw error;
    }
  };

  // Handle opening Google Drive Picker
  const handleOpenGoogleDrivePicker = async () => {
    if (!company) {
      setImageUploadError('Please select a company first');
      return;
    }

    // Check if Google Drive is configured
    const googleConfig = isGoogleDriveFullyConfigured();
    if (!googleConfig.configured) {
      setImageUploadError('Google Drive is not configured. Please configure Google API credentials.');
      return;
    }

    setIsLoadingGooglePicker(true);
    setImageUploadError('');

    try {
      // Wait for Google Picker API to be loaded
      if (!window.gapi || !window.google) {
        setImageUploadError('Google APIs are still loading. Please wait a moment and try again.');
        setIsLoadingGooglePicker(false);
        return;
      }

      // Load picker if not already loaded
      if (!window.google.picker) {
        await new Promise((resolve, reject) => {
          if (window.gapi) {
            window.gapi.load('picker', {
              callback: resolve,
              onerror: reject
            });
          } else {
            reject(new Error('Google API not loaded'));
          }
        });
      }

      // Authenticate with Google
      let accessToken;
      try {
        accessToken = await authenticateGoogle();
      } catch (authError) {
        setImageUploadError(authError.message || 'Failed to authenticate with Google Drive');
        setIsLoadingGooglePicker(false);
        return;
      }

      if (!accessToken) {
        setImageUploadError('Unable to authenticate with Google Drive');
        setIsLoadingGooglePicker(false);
        return;
      }

      // Create and show picker with higher z-index
      // Show images or videos based on mediaType
      const pickerBuilder = new window.google.picker.PickerBuilder()
        .setOAuthToken(accessToken)
        .setDeveloperKey(GOOGLE_DRIVE_CONFIG.API_KEY);
      
      // Add appropriate view based on media type
      if (mediaType === 'image') {
        pickerBuilder.addView(window.google.picker.ViewId.DOCS_IMAGES); // Only show images
      } else {
        // For videos, try VIDEOS view first, fallback to DOCS if it doesn't exist
        // Note: ViewId.VIDEOS might not be available in all Picker API versions
        if (window.google.picker.ViewId.VIDEOS) {
          pickerBuilder.addView(window.google.picker.ViewId.VIDEOS);
        } else if (window.google.picker.ViewId.DOCS_VIDEOS) {
          pickerBuilder.addView(window.google.picker.ViewId.DOCS_VIDEOS);
        } else {
          // Fallback to DOCS view and filter for videos manually
          console.warn('⚠️ VIDEOS view not available, using DOCS view');
          pickerBuilder.addView(window.google.picker.ViewId.DOCS);
        }
      }
      
      const picker = pickerBuilder.setCallback((data) => {
          setIsLoadingGooglePicker(false);
          
          if (!data) {
            console.error('❌ Google Drive Picker: No data received');
            setImageUploadError('No data received from Google Drive picker');
            return;
          }
          
          if (data[window.google.picker.Response.ACTION] === window.google.picker.Action.PICKED) {
            // Check if DOCUMENTS array exists and has items
            const documents = data[window.google.picker.Response.DOCUMENTS];
            if (!documents || !Array.isArray(documents) || documents.length === 0) {
              console.error('❌ Google Drive Picker: No documents in response', data);
              setImageUploadError('No file selected from Google Drive');
              return;
            }
            
            const file = documents[0];
            if (!file) {
              console.error('❌ Google Drive Picker: File object is undefined', documents);
              setImageUploadError('Invalid file data from Google Drive');
              return;
            }
            
            // Log file structure for debugging
            console.log('📁 Google Drive Picker: File object structure:', {
              file,
              keys: Object.keys(file),
              hasId: 'id' in file,
              hasIdProperty: file.id !== undefined,
              idValue: file.id,
              idType: typeof file.id,
              fullFile: JSON.stringify(file, null, 2)
            });
            
            // Try multiple ways to get file ID (different Picker API versions might use different properties)
            let fileId = file.id || file[window.google.picker.Document.ID] || file[window.google.picker.Document.URL]?.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1];
            
            // If still no fileId, try to extract from URL
            if (!fileId && file.url) {
              const urlMatch = file.url.match(/\/d\/([a-zA-Z0-9_-]+)/);
              if (urlMatch && urlMatch[1]) {
                fileId = urlMatch[1];
              }
            }
            
            if (!fileId) {
              console.error('❌ Google Drive Picker: File ID is missing', {
                file,
                availableKeys: Object.keys(file),
                fileString: JSON.stringify(file)
              });
              setImageUploadError('Could not get file ID from selected file. Please try again.');
              return;
            }
            
            // Ensure fileId is a string and handle toString safely
            let fileIdString;
            try {
              if (fileId && typeof fileId.toString === 'function') {
                fileIdString = fileId.toString();
              } else if (fileId != null) {
                fileIdString = String(fileId);
              } else {
                throw new Error('File ID is null or undefined');
              }
              
              if (!fileIdString || fileIdString.trim().length === 0) {
                throw new Error('File ID string is empty');
              }
            } catch (error) {
              console.error('❌ Google Drive Picker: Error converting file ID to string', {
                error,
                fileId,
                fileIdType: typeof fileId,
                file
              });
              setImageUploadError('Error processing file ID. Please try again.');
              return;
            }
            
            // Process based on media type
            let processedUrl;
            if (mediaType === 'image') {
              // Convert file ID to CDN lh3 URL immediately for images
              processedUrl = `https://lh3.googleusercontent.com/d/${fileIdString}=w800`;
            } else {
              // Convert file ID to preview URL for videos (for iframe loading)
              processedUrl = `https://drive.google.com/file/d/${fileIdString}/preview`;
            }
            
            // Also create other formats for duplicate checking
            const driveLink = `https://drive.google.com/file/d/${fileIdString}/view`;
            
            // Check if media already exists (check processed URL, file ID, and Drive URL format)
            const alreadyExists = imageList.some(path => {
              if (!path || typeof path !== 'string') {
                return false;
              }
              
              // Extract file ID from various formats for comparison
              let existingFileId = null;
              
              if (path.includes('lh3.googleusercontent.com')) {
                // Extract from CDN URL: https://lh3.googleusercontent.com/d/FILE_ID=w800
                const match = path.match(/\/d\/([a-zA-Z0-9_-]+)=/);
                existingFileId = match ? match[1] : null;
              } else if (path.includes('drive.google.com')) {
                // Extract from Drive URL: https://drive.google.com/file/d/FILE_ID/view or /preview
                const match = path.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
                existingFileId = match ? match[1] : null;
              } else if (typeof path === 'string' && /^[a-zA-Z0-9_-]{15,}$/.test(path.trim())) {
                // It's a file ID
                existingFileId = path.trim();
              }
              
              return existingFileId === fileIdString || path === processedUrl || path === driveLink;
            });
            
            if (alreadyExists) {
              setImageUploadError(`This ${mediaType} is already in the list`);
              return;
            }

            // Add processed URL to list
            setImageList([...imageList, processedUrl]);
            setImageUploadError('');
            console.log(`${mediaType === 'image' ? 'Image' : 'Video'} selected from Google Drive:`, {
              file,
              fileId: fileIdString,
              processedUrl,
              type: mediaType,
              'Note': mediaType === 'image' 
                ? 'CDN URL stored for direct loading from backend'
                : 'Preview URL stored for iframe loading'
            });
          } else if (data[window.google.picker.Response.ACTION] === window.google.picker.Action.CANCEL) {
            console.log('Google Drive Picker cancelled');
            setIsLoadingGooglePicker(false);
          } else {
            // Handle other actions or errors
            const error = data[window.google.picker.Response.ERROR];
            if (error) {
              console.error('❌ Google Drive Picker error:', error);
              setImageUploadError(`Google Drive error: ${error}`);
            }
          }
        })
        .build();

      // Set higher z-index for picker to appear above modal
      picker.setVisible(true);
      
      // Force picker to appear above modal by adjusting z-index
      // Google Picker creates iframes, so we need to target those
      setTimeout(() => {
        // Target Google Picker iframe
        const pickerIframes = document.querySelectorAll('iframe[src*="picker"]');
        pickerIframes.forEach(iframe => {
          iframe.style.zIndex = '10001';
        });
        
        // Also target any dialog elements created by picker
        const pickerDialogs = document.querySelectorAll('[role="dialog"]');
        pickerDialogs.forEach(el => {
          const computedStyle = window.getComputedStyle(el);
          const currentZIndex = parseInt(computedStyle.zIndex) || 0;
          if (currentZIndex < 10001) {
            el.style.zIndex = '10001';
          }
        });
        
        // Target Google Picker container
        const pickerContainers = document.querySelectorAll('[id*="picker"], [class*="picker"]');
        pickerContainers.forEach(el => {
          const computedStyle = window.getComputedStyle(el);
          const currentZIndex = parseInt(computedStyle.zIndex) || 0;
          if (currentZIndex < 10001) {
            el.style.zIndex = '10001';
          }
        });
      }, 200);
    } catch (error) {
      console.error('Error opening Google Drive Picker:', error);
      setImageUploadError(error.message || 'Failed to open Google Drive Picker. Please try again.');
      setIsLoadingGooglePicker(false);
    }
  };

  // Handle saving images
  const handleSaveImages = async () => {
    if (!selectedProductForImage || !company) {
      setImageUploadError('Missing product or company information');
      return;
    }

    const currentCompany = companies.find(c => c.guid === company);
    if (!currentCompany) {
      setImageUploadError('Company information not found');
      return;
    }

    setImageUploadLoading(true);
    setImageUploadError('');
    setImageUploadSuccess(false);

    try {
      const { tallyloc_id, company: companyVal, guid } = currentCompany;

      // Ensure imagepaths is always an array (can be empty)
      let imagepathsArray = Array.isArray(imageList) ? imageList : [];

      // Convert image paths to CDN URLs before saving (but keep video preview URLs as-is)
      // Images: Convert to CDN URLs for direct loading
      // Videos: Keep preview URLs for iframe loading
      imagepathsArray = imagepathsArray.map(path => {
        // Validate path is a string
        if (!path || typeof path !== 'string') {
          console.warn('⚠️ Invalid path in imagepathsArray:', path);
          return path; // Return as-is if invalid
        }

        // If already a CDN URL, use as-is
        if (path.includes('lh3.googleusercontent.com')) {
          return path;
        }

        // If it's a video preview URL, keep as-is (for iframe loading)
        if (path.includes('drive.google.com/file/d/') && path.includes('/preview')) {
          return path;
        }

        // If it's a direct HTTP link (not Google Drive), use as-is
        if (path.startsWith('http') && !path.includes('drive.google.com')) {
          return path;
        }

        // Extract file ID and convert to CDN URL for Google Drive image links
        let fileId = null;
        
        if (path.includes('drive.google.com')) {
          const patterns = [
            /\/file\/d\/([a-zA-Z0-9_-]+)/,
            /\/d\/([a-zA-Z0-9_-]+)/,
            /\/uc\?id=([a-zA-Z0-9_-]+)/,
            /\/open\?id=([a-zA-Z0-9_-]+)/,
            /[?&]id=([a-zA-Z0-9_-]+)/,
          ];
          
          for (const pattern of patterns) {
            const match = path.match(pattern);
            if (match && match[1]) {
              fileId = match[1];
              break;
            }
          }
        } else if (/^[a-zA-Z0-9_-]{15,}$/.test(path.trim())) {
          fileId = path.trim();
        }

        if (fileId) {
          // Convert to CDN URL for images
          return `https://lh3.googleusercontent.com/d/${fileId}=w800`;
        }

        // If can't convert, return as-is (shouldn't happen, but handle gracefully)
        console.warn('⚠️ Could not convert image path to CDN URL:', path);
        return path;
      });

      const payload = {
        tallyloc_id,
        company: companyVal,
        guid: guid, // Use company guid (stock items don't have guid)
        name: selectedProductForImage.NAME,
        imagepaths: imagepathsArray // Array of CDN URLs (can be empty)
      };

      console.log('📤 Sending image upload payload:', {
        tallyloc_id,
        company: companyVal,
        guid,
        name: selectedProductForImage.NAME,
        imagepaths: imagepathsArray,
        imagepathsType: Array.isArray(imagepathsArray),
        imagepathsLength: imagepathsArray.length
      });

      const response = await apiPost('/api/tally/masterdata/itemimageupload', payload);

      if (response && (response.success !== false)) {
        // Update the product in memory immediately (before reloading from backend)
        const updatedImagePath = imagepathsArray.join(',');
        
        // Update stockItems array
        setStockItems(prevItems => {
          return prevItems.map(item => {
            if (item.NAME === selectedProductForImage.NAME) {
              return {
                ...item,
                IMAGEPATH: updatedImagePath
              };
            }
            return item;
          });
        });
        
        // Update selectedProduct if it's the same product (for product details modal)
        if (selectedProduct && selectedProduct.NAME === selectedProductForImage.NAME) {
          setSelectedProduct(prev => ({
            ...prev,
            IMAGEPATH: updatedImagePath
          }));
        }
        
        // Also update sessionStorage cache
        try {
          const currentCompany = companies.find(c => c.guid === company);
          if (currentCompany) {
            const { tallyloc_id, company: companyVal } = currentCompany;
            const cacheKey = `stockitems_${tallyloc_id}_${companyVal}`;
            const cachedItems = sessionStorage.getItem(cacheKey);
            if (cachedItems) {
              const items = JSON.parse(cachedItems);
              const updatedItems = items.map(item => {
                if (item.NAME === selectedProductForImage.NAME) {
                  return {
                    ...item,
                    IMAGEPATH: updatedImagePath
                  };
                }
                return item;
              });
              sessionStorage.setItem(cacheKey, JSON.stringify(updatedItems));
            }
          }
        } catch (cacheError) {
          console.warn('Failed to update cache:', cacheError);
        }
        
        // Refresh stock items from backend (will happen in background)
        setRefreshStockItems(prev => prev + 1);
        
        // Close modal immediately
        setShowImageUploadModal(false);
        setSelectedProductForImage(null);
        setImageList([]);
        setNewImageLink('');
        setImageUploadError('');
        setImageUploadSuccess(false);
      } else {
        setImageUploadError(response?.error || 'Failed to save images');
      }
    } catch (error) {
      console.error('Error saving images:', error);
      setImageUploadError(error.message || 'Failed to save images. Please try again.');
    } finally {
      setImageUploadLoading(false);
    }
  };

  // Load Google Picker API scripts
  useEffect(() => {
    // Load Google Identity Services
    if (!document.querySelector('script[src="https://accounts.google.com/gsi/client"]')) {
      const gisScript = document.createElement('script');
      gisScript.src = 'https://accounts.google.com/gsi/client';
      gisScript.async = true;
      gisScript.defer = true;
      document.body.appendChild(gisScript);
    }

    // Load Google Picker
    if (!document.querySelector('script[src="https://apis.google.com/js/api.js"]')) {
      const pickerScript = document.createElement('script');
      pickerScript.src = 'https://apis.google.com/js/api.js';
      pickerScript.async = true;
      pickerScript.defer = true;
      pickerScript.onload = () => {
        if (window.gapi) {
          window.gapi.load('picker', () => {
            console.log('Google Picker API loaded');
          });
        }
      };
      document.body.appendChild(pickerScript);
    }
  }, []);

  // Initialize image list when modal opens
  useEffect(() => {
    if (showImageUploadModal && selectedProductForImage) {
      const images = parseImagePaths(selectedProductForImage.IMAGEPATH);
      setImageList(images);
      setNewImageLink('');
      setImageUploadError('');
      setImageUploadSuccess(false);
      setImageAddMethod('link'); // Reset to link method when modal opens
      setMediaType('image'); // Reset to image when modal opens
    }
  }, [showImageUploadModal, selectedProductForImage]);

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
  const ProductImage = React.memo(({ imagePath, itemName, googleToken, imageUrlCacheRef, canShowImage, useFirstImageAsThumbnail = false }) => {
    const [imageUrl, setImageUrl] = useState(null);
    const [thumbnailUrl, setThumbnailUrl] = useState(null);
    const [imageLoading, setImageLoading] = useState(true);
    const [thumbnailLoading, setThumbnailLoading] = useState(true);
    const [imageError, setImageError] = useState(false);
    
    // Track last loaded values to prevent unnecessary reloads
    const lastLoadedRef = useRef({ path: null, token: null, hasImage: false });

    // Extract first image path at component level to use consistently
    // Always extract first path if comma-separated, not just when useFirstImageAsThumbnail is true
    const actualImagePath = useMemo(() => {
      if (!imagePath) return null;
      
      // Handle case where imagePath might be an object instead of a string
      let imagePathString = imagePath;
      if (typeof imagePath === 'object' && imagePath !== null) {
        // If it's an object, try to extract the string value
        imagePathString = imagePath.value || imagePath.path || imagePath.url || imagePath.IMAGEPATH || 
                         imagePath.toString?.() || 
                         (typeof imagePath === 'string' ? imagePath : null);
        if (!imagePathString || imagePathString === '[object Object]') {
          console.warn('⚠️ ProductImage: Could not extract string from imagePath object:', imagePath);
          return null;
        }
      }
      
      // Ensure it's a string
      if (typeof imagePathString !== 'string') {
        return null;
      }
      
      // If comma-separated, always use first image for display
      if (imagePathString.includes(',')) {
        const allPaths = imagePathString.split(',').map(path => path.trim()).filter(path => path.length > 0);
        if (allPaths.length > 0) {
          return allPaths[0];
        }
      }
      return imagePathString;
    }, [imagePath]);

    useEffect(() => {
      const loadImageUrl = async () => {
        // Check if we need to reload - only reload if path or token actually changed
        const hasValidToken = googleToken && typeof googleToken === 'string' && googleToken.trim().length > 0;
        const currentPath = actualImagePath;
        const currentToken = hasValidToken ? googleToken : null;
        
        // If nothing changed and we already have an image loaded, skip reload
        if (
          lastLoadedRef.current.path === currentPath &&
          lastLoadedRef.current.token === currentToken &&
          lastLoadedRef.current.hasImage &&
          imageUrl
        ) {
          console.log('⏸️ ProductImage: No changes detected, skipping reload', {
            path: currentPath?.substring(0, 50),
            hasToken: !!currentToken
          });
          return;
        }
        
        // Handle case where imagePath might be an object instead of a string
        let imagePathString = imagePath;
        if (imagePath && typeof imagePath === 'object') {
          // If it's an object, try to extract the string value
          imagePathString = imagePath.value || imagePath.path || imagePath.url || imagePath.IMAGEPATH || 
                           (typeof imagePath.toString === 'function' && imagePath.toString() !== '[object Object]' ? imagePath.toString() : null);
          console.warn('⚠️ ProductImage: imagePath is an object, extracted:', {
            original: imagePath,
            extracted: imagePathString,
            objectKeys: Object.keys(imagePath)
          });
        }

        console.log('🖼️ ProductImage: Loading image URL', {
          imagePath: typeof imagePathString === 'string' ? imagePathString?.substring(0, 50) : imagePathString,
          imagePathType: typeof imagePath,
          actualImagePath: typeof actualImagePath === 'string' ? actualImagePath?.substring(0, 50) : actualImagePath,
          hasToken: !!googleToken,
          tokenLength: googleToken?.length,
          itemName,
          useFirstImageAsThumbnail
        });

        if (!actualImagePath) {
          console.log('❌ ProductImage: No imagePath', {
            imagePath,
            imagePathType: typeof imagePath,
            actualImagePath,
            actualImagePathType: typeof actualImagePath
          });
          setImageLoading(false);
          setImageError(true);
          return;
        }

        // Check if it's already a CDN URL (lh3.googleusercontent.com)
        // If so, extract file ID and generate appropriate sizes
        const isCDNUrl = actualImagePath.includes('lh3.googleusercontent.com');
        
        if (isCDNUrl) {
          console.log('✅ ProductImage: Already a CDN URL, extracting file ID for proper sizing:', actualImagePath?.substring(0, 50));
          
          // Extract file ID from CDN URL: https://lh3.googleusercontent.com/d/FILE_ID=w800
          const cdnMatch = actualImagePath.match(/\/d\/([a-zA-Z0-9_-]+)=/);
          if (cdnMatch && cdnMatch[1]) {
            const fileId = cdnMatch[1];
            // Generate w400 for thumbnail and w800 for full image
            const thumbnailCDN = `https://lh3.googleusercontent.com/d/${fileId}=w400`;
            const fullCDN = `https://lh3.googleusercontent.com/d/${fileId}=w800`;
            
            setThumbnailUrl(thumbnailCDN);
            setImageUrl(fullCDN);
            setImageLoading(false);
            setThumbnailLoading(false);
            setImageError(false);
            
            // Cache both
            const cdnCacheKey = `${actualImagePath}_cdn`;
            imageUrlCacheRef.current.set(cdnCacheKey, fullCDN);
            lastLoadedRef.current = {
              path: currentPath,
              token: currentToken,
              hasImage: true
            };
            return;
          } else {
            // If we can't extract file ID, use the URL as-is
            console.warn('⚠️ ProductImage: Could not extract file ID from CDN URL, using as-is');
            setImageUrl(actualImagePath);
            setThumbnailUrl(actualImagePath);
            setImageLoading(false);
            setThumbnailLoading(false);
            setImageError(false);
            return;
          }
        }
        
        // Check if it's a Google Drive link or file ID
        // Google Drive file IDs are typically 15-33 characters, but can vary
        // Also check if it looks like a Google Drive file ID (even if it's just the ID)
        const isGoogleDriveUrl = actualImagePath.includes('drive.google.com');
        const isGoogleDriveId = !actualImagePath.startsWith('http') && /^[a-zA-Z0-9_-]{15,}$/.test(actualImagePath.trim());
        // Also check if it's a comma-separated list where first item might be a file ID
        const isGoogleDrive = isGoogleDriveUrl || isGoogleDriveId;
        
        // hasValidToken is already declared at the top of the function
        
        console.log('🔍 ProductImage: Google Drive detection:', {
          actualImagePath: actualImagePath?.substring(0, 50),
          isGoogleDriveUrl,
          isGoogleDriveId,
          isGoogleDrive,
          hasToken: !!googleToken,
          hasValidToken
        });

        // For Google Drive images, always try CDN first (no token needed for public/shared files)
        // CDN works for both public and shared files, and is much faster
        if (isGoogleDrive) {
          // Check cache first (use 'no-token' key for CDN URLs)
          const cdnCacheKey = `${actualImagePath}_cdn`;
          if (imageUrlCacheRef.current.has(cdnCacheKey)) {
            const cachedUrl = imageUrlCacheRef.current.get(cdnCacheKey);
            console.log('✅ ProductImage: Using cached CDN URL');
          setImageUrl(cachedUrl);
            setThumbnailUrl(cachedUrl);
          setImageLoading(false);
          setThumbnailLoading(false);
            lastLoadedRef.current = {
              path: currentPath,
              token: currentToken,
              hasImage: true
            };
          return;
        }

          // Try lh3 CDN first (fastest, no token needed for public/shared files)
          const cdnThumbnailUrl = getGoogleDriveCDNUrl(actualImagePath, 'w400'); // w400 for thumbnails
          const cdnFullUrl = getGoogleDriveCDNUrl(actualImagePath, 'w800'); // w800 for full images
          
          if (cdnThumbnailUrl && cdnFullUrl) {
            console.log('✅ ProductImage: Using lh3 CDN URLs (no token required)', {
              thumbnail: cdnThumbnailUrl,
              full: cdnFullUrl,
              imagePath: actualImagePath?.substring(0, 50)
            });
            // Set CDN URLs immediately - they're fast for public/shared files
            setThumbnailUrl(cdnThumbnailUrl);
            setImageUrl(cdnFullUrl);
            setThumbnailLoading(false);
            setImageLoading(false);
            // Cache the URLs with CDN key
            imageUrlCacheRef.current.set(cdnCacheKey, cdnFullUrl);
            // Update tracking ref
            lastLoadedRef.current = {
              path: currentPath,
              token: currentToken,
              hasImage: true
            };
            // Return early - CDN is set, onError handler will handle if it fails
            return;
          } else {
            console.log('⚠️ ProductImage: CDN URLs not generated, will try API fallback', {
              hasThumbnail: !!cdnThumbnailUrl,
              hasFull: !!cdnFullUrl,
              imagePath: actualImagePath?.substring(0, 50),
              isGoogleDrive
            });
          }
        }

        // Check cache for non-CDN URLs (use valid token or 'no-token')
        const cacheKey = `${actualImagePath}_${hasValidToken ? googleToken : 'no-token'}`;
        if (imageUrlCacheRef.current.has(cacheKey)) {
          const cachedUrl = imageUrlCacheRef.current.get(cacheKey);
          console.log('✅ ProductImage: Using cached URL');
          setImageUrl(cachedUrl);
          setThumbnailUrl(cachedUrl); // Use full image as thumbnail if cached
            setImageLoading(false);
          setThumbnailLoading(false);
          // Update tracking ref
          lastLoadedRef.current = {
            path: currentPath,
            token: currentToken,
            hasImage: true
          };
            return;
          }
          
        // If useFirstImageAsThumbnail, use the first image directly as thumbnail
        if (useFirstImageAsThumbnail && actualImagePath) {
          // If we have a token, use API directly (file is likely private)
          // Otherwise, try CDN first
          if (hasValidToken) {
            try {
              console.log('🖼️ ProductImage: Token available, using API for first image (private file)');
            const thumbUrl = await getGoogleDriveImageUrl(actualImagePath, googleToken);
            if (thumbUrl) {
                console.log('✅ ProductImage: First image loaded as thumbnail via API');
              setThumbnailUrl(thumbUrl);
              setThumbnailLoading(false);
              setImageUrl(thumbUrl);
              setImageLoading(false);
              imageUrlCacheRef.current.set(cacheKey, thumbUrl);
                // Update tracking ref
                lastLoadedRef.current = {
                  path: currentPath,
                  token: currentToken,
                  hasImage: true
                };
              return;
            }
          } catch (error) {
            console.warn('⚠️ ProductImage: Error loading first image as thumbnail:', error);
          }
            } else {
            // No token, try CDN
            const cdnUrl = getGoogleDriveCDNUrl(actualImagePath, 'w800');
            if (cdnUrl) {
              console.log('✅ ProductImage: Using first image via lh3 CDN (no token, public file)');
              setThumbnailUrl(cdnUrl);
              setImageUrl(cdnUrl);
              setThumbnailLoading(false);
              setImageLoading(false);
              imageUrlCacheRef.current.set(cacheKey, cdnUrl);
              lastLoadedRef.current = {
                path: currentPath,
                token: currentToken,
                hasImage: true
              };
              return;
            }
          }
        }

        // Thumbnail should already be set via CDN above for Google Drive images
        // For direct images, thumbnail is same as full image
        if (!thumbnailUrl && imageUrl) {
          setThumbnailUrl(imageUrl);
          setThumbnailLoading(false);
        } else if (!thumbnailUrl) {
          setThumbnailLoading(false);
        }

        // Load full image in background (only if not already loaded)
        // For Google Drive images, CDN should already be set above, so this is mainly for direct images
        // or as fallback if CDN failed
        if (!imageUrl) {
          try {
            // For Google Drive images, try CDN first (already done above, but try again if it failed)
            if (isGoogleDrive) {
            const cdnFullUrl = getGoogleDriveCDNUrl(actualImagePath, 'w1200'); // Larger size for full image
            if (cdnFullUrl) {
                console.log('✅ ProductImage: Using lh3 CDN for full image (fallback)');
              setImageUrl(cdnFullUrl);
              setImageLoading(false);
                const cdnCacheKey = `${actualImagePath}_cdn`;
                imageUrlCacheRef.current.set(cdnCacheKey, cdnFullUrl);
                lastLoadedRef.current = {
                  path: currentPath,
                  token: currentToken,
                  hasImage: true
                };
                return;
              }
              
              // If CDN failed and we have a token, try API as fallback (for private files)
              if (hasValidToken) {
                console.log('🖼️ ProductImage: CDN failed, trying API fallback (private file):', {
              imagePath: actualImagePath?.substring(0, 100),
              tokenPreview: googleToken ? `${googleToken.substring(0, 20)}...` : 'none'
            });

            const url = await getGoogleDriveImageUrl(actualImagePath, googleToken);
            if (url) {
              // Double-check we're not using public URL (which will fail with 403)
              if (url.includes('drive.google.com/uc?export=view')) {
                console.error('❌ ProductImage: ERROR - Public URL detected! This should not happen. URL:', url);
                console.error('❌ This means getGoogleDriveImageUrl returned a public URL, which will fail with 403');
                setImageError(true);
                setImageLoading(false);
                return;
              }

                  console.log('✅ ProductImage: Got image URL via API (blob or direct):', url.substring(0, 80));
              setImageUrl(url);
              // Update cache
              imageUrlCacheRef.current.set(cacheKey, url);
                  // Update tracking ref
                  lastLoadedRef.current = {
                    path: currentPath,
                    token: currentToken,
                    hasImage: true
                  };
            } else {
                  console.log('❌ ProductImage: API fallback returned no URL');
                  setImageError(true);
                  lastLoadedRef.current = {
                    path: currentPath,
                    token: currentToken,
                    hasImage: false
                  };
                }
              } else {
                console.log('⚠️ ProductImage: CDN failed and no token available');
              setImageError(true);
                lastLoadedRef.current = {
                  path: currentPath,
                  token: currentToken,
                  hasImage: false
                };
              }
            } else {
              // For direct image links, use them as-is
              if (actualImagePath && actualImagePath.startsWith('http')) {
                console.log('✅ ProductImage: Using direct image URL');
                setImageUrl(actualImagePath);
                setImageLoading(false);
                imageUrlCacheRef.current.set(cacheKey, actualImagePath);
                lastLoadedRef.current = {
                  path: currentPath,
                  token: currentToken,
                  hasImage: true
                };
              } else {
                console.log('❌ ProductImage: Invalid image path');
                setImageError(true);
                lastLoadedRef.current = {
                  path: currentPath,
                  token: currentToken,
                  hasImage: false
                };
              }
            }
          } catch (error) {
            console.error('❌ ProductImage: Error loading image:', error);
            setImageError(true);
            // Update tracking ref even on error to prevent retry loops
            lastLoadedRef.current = {
              path: currentPath,
              token: currentToken,
              hasImage: false
            };
          } finally {
            setImageLoading(false);
          }
        } else {
          // If we didn't load an image but have a cached one, update tracking
          if (imageUrl) {
            lastLoadedRef.current = {
              path: currentPath,
              token: currentToken,
              hasImage: true
            };
          }
        }
      };

        loadImageUrl();
      }, [actualImagePath, googleToken, itemName, useFirstImageAsThumbnail]);

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

    // Show loading spinner only if we don't have thumbnail or full image
    if (imageLoading && !thumbnailUrl && !imageUrl && !imagePath.startsWith('http')) {
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

    // Determine which URL to display
    const displayUrl = imageUrl || thumbnailUrl || (actualImagePath && !actualImagePath.includes('drive.google.com') ? actualImagePath : null);

    return (
      <>
        {/* Thumbnail layer (shown while full image loads) */}
        {thumbnailUrl && !imageUrl && (
          <img
            key="thumbnail"
            src={thumbnailUrl}
            alt={itemName}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              borderRadius: '8px',
              position: 'absolute',
              top: 0,
              left: 0,
              zIndex: 1,
              transformOrigin: 'center center',
              transition: 'transform 0.5s ease-in-out'
            }}
            onError={(e) => {
              console.warn('⚠️ ProductImage: Thumbnail failed to load, will try API fallback', {
                url: thumbnailUrl?.substring(0, 80),
                isCDN: thumbnailUrl?.includes('lh3.googleusercontent.com')
              });
              // If CDN fails, clear it and trigger API fallback
              if (thumbnailUrl?.includes('lh3.googleusercontent.com')) {
                setThumbnailUrl(null);
                setThumbnailLoading(false);
                // Trigger reload with API
                const loadWithAPI = async () => {
                  try {
                    const apiUrl = await getGoogleDriveImageUrl(actualImagePath, googleToken);
                    if (apiUrl) {
                      setImageUrl(apiUrl);
                      setImageLoading(false);
                    }
                  } catch (err) {
                    console.error('❌ ProductImage: API fallback also failed:', err);
                    setImageError(true);
                  }
                };
                loadWithAPI();
              }
              e.target.style.display = 'none';
            }}
          />
        )}
        
        {/* Full image layer (fades in when loaded) */}
        {imageUrl && (
          <img
            key="full-image"
            src={imageUrl}
            alt={itemName}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              borderRadius: '8px',
              position: 'absolute',
              top: 0,
              left: 0,
              zIndex: 2,
              opacity: thumbnailUrl ? 0 : 1,
              transition: 'opacity 0.4s ease-in-out, transform 0.5s ease-in-out',
              transformOrigin: 'center center'
            }}
            onLoad={(e) => {
              console.log('✅ ProductImage: Full image loaded successfully');
              // Fade in full image when it loads
              e.target.style.opacity = '1';
            }}
            onError={(e) => {
              console.error('❌ ProductImage: Full image failed to load', { 
                imageUrl: imageUrl?.substring(0, 80),
                isCDN: imageUrl?.includes('lh3.googleusercontent.com')
              });
              
              // If CDN fails, try API fallback (CDN only works for public files)
              if (imageUrl?.includes('lh3.googleusercontent.com')) {
                console.log('🔄 ProductImage: CDN failed (file might be private), trying API fallback...');
                e.target.style.display = 'none';
                setImageUrl(null);
                setImageLoading(true);
                
                const loadWithAPI = async () => {
                  try {
                    console.log('🔄 ProductImage: Loading via API with token...', {
                      path: actualImagePath?.substring(0, 50),
                      hasToken: !!googleToken
                    });
                    const apiUrl = await getGoogleDriveImageUrl(actualImagePath, googleToken);
                    if (apiUrl) {
                      console.log('✅ ProductImage: API fallback succeeded');
                      setImageUrl(apiUrl);
                      setImageLoading(false);
                      const apiCacheKey = `${actualImagePath}_${googleToken || 'no-token'}`;
                      imageUrlCacheRef.current.set(apiCacheKey, apiUrl);
                    } else {
                      console.error('❌ ProductImage: API fallback returned no URL');
                      setImageError(true);
                      setImageLoading(false);
                    }
                  } catch (err) {
                    console.error('❌ ProductImage: API fallback also failed:', err);
                    setImageError(true);
                    setImageLoading(false);
                  }
                };
                loadWithAPI();
              } else {
                e.target.style.display = 'none';
                setImageError(true);
              }
            }}
          />
        )}
        
        {/* Direct URL fallback (for non-Google Drive images) */}
        {!imageUrl && !thumbnailUrl && actualImagePath && !actualImagePath.includes('drive.google.com') && (
          <img
            key="direct-image"
            src={actualImagePath}
            alt={itemName}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              borderRadius: '8px',
              position: 'absolute',
              top: 0,
              left: 0,
              zIndex: 1
            }}
            onLoad={() => {
              console.log('✅ ProductImage: Direct image loaded successfully');
              setImageLoading(false);
            }}
            onError={(e) => {
              console.error('❌ ProductImage: Direct image failed to load', { imagePath: imagePath?.substring(0, 50) });
              e.target.style.display = 'none';
              setImageError(true);
            }}
          />
        )}
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

  // Product Video Component for Google Drive videos
  const ProductVideo = React.memo(({ videoPath, itemName, googleToken, videoUrlCacheRef, canShowImage, isThumbnail = false }) => {
    const [videoUrl, setVideoUrl] = useState(null);
    const [videoLoading, setVideoLoading] = useState(true);
    const [videoError, setVideoError] = useState(false);
    const [thumbnailUrl, setThumbnailUrl] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const videoRef = useRef(null);

    useEffect(() => {
      const loadVideoUrl = async () => {
        console.log('🎥 ProductVideo: Loading video', {
          videoPath: videoPath?.substring(0, 100),
          isThumbnail,
          hasToken: !!googleToken,
          itemName
        });

        if (!videoPath) {
          console.log('❌ ProductVideo: No videoPath provided');
          setVideoLoading(false);
          setVideoError(true);
          return;
        }

        // Check if it's a Google Drive link
        const isGoogleDrive = isGoogleDriveLink(videoPath);
        const isGoogleDriveId = !videoPath.startsWith('http') && /^[a-zA-Z0-9_-]{15,}$/.test(videoPath);
        
        console.log('🎥 ProductVideo: Link detection', {
          isGoogleDrive,
          isGoogleDriveId,
          videoPath: videoPath?.substring(0, 50)
        });

        // For thumbnails, try CDN first for Google Drive videos (no token needed)
        // Also try to get thumbnail via API if token is available (better quality)
        if (isThumbnail && isGoogleDrive) {
          // Try to get video thumbnail from CDN first (fast, no token needed)
          const cdnThumbnailUrl = getGoogleDriveCDNUrl(videoPath, 'w400');
          let finalThumbnailUrl = cdnThumbnailUrl;
          
          if (cdnThumbnailUrl) {
            console.log('✅ ProductVideo: Using CDN for video thumbnail (fast)');
            setThumbnailUrl(cdnThumbnailUrl);
          }
          
          // Try to get thumbnail via API if token is available (better quality, uses company config token)
          if (googleToken) {
            try {
              console.log('🖼️ ProductVideo: Attempting to fetch video thumbnail via API (using company config token)');
              const apiThumbUrl = await getGoogleDriveVideoThumbnail(videoPath, googleToken);
              if (apiThumbUrl) {
                console.log('✅ ProductVideo: Got better quality thumbnail via API');
                finalThumbnailUrl = apiThumbUrl;
                setThumbnailUrl(apiThumbUrl); // Override CDN with API thumbnail if available
              }
            } catch (e) {
              console.warn('⚠️ ProductVideo: Could not load video thumbnail via API, using CDN fallback:', e);
            }
          }
          
          // For thumbnails, we can return early if we have a thumbnail
          if (finalThumbnailUrl) {
            setVideoLoading(false);
              return;
          }
        }

        // For Google Drive videos, generate preview URL immediately (synchronous, no token needed)
        if (isGoogleDrive && !isThumbnail) {
          const previewUrl = getGoogleDriveVideoPreviewUrl(videoPath);
          if (previewUrl) {
            console.log('✅ ProductVideo: Generated Google Drive preview URL immediately');
            setVideoUrl(previewUrl);
            setIsPlaying(true); // Iframe videos are ready to play
            const cacheKey = `${videoPath}_${googleToken || 'no-token'}`;
            videoUrlCacheRef.current.set(cacheKey, previewUrl);
            setVideoLoading(false);
            
            // Try to get CDN thumbnail for better UX
            const cdnThumbnailUrl = getGoogleDriveCDNUrl(videoPath, 'w800');
            if (cdnThumbnailUrl) {
              console.log('✅ ProductVideo: Using CDN for video thumbnail');
              setThumbnailUrl(cdnThumbnailUrl);
            }
            return;
          }
        }

        // For main video, try to get thumbnail as placeholder
        // Try CDN first (fast, no token), then API if token available (better quality)
        if (!isThumbnail && isGoogleDrive) {
          // Try CDN first
          const cdnThumbnailUrl = getGoogleDriveCDNUrl(videoPath, 'w800');
          if (cdnThumbnailUrl) {
            console.log('✅ ProductVideo: Using CDN for video thumbnail placeholder');
            setThumbnailUrl(cdnThumbnailUrl);
          }
          
          // Try API thumbnail if token is available (better quality, uses company config token)
          if (googleToken && !thumbnailUrl) {
            try {
              console.log('🖼️ ProductVideo: Attempting to fetch video thumbnail via API for main display');
              const apiThumbUrl = await getGoogleDriveVideoThumbnail(videoPath, googleToken);
              if (apiThumbUrl) {
                console.log('✅ ProductVideo: Got better quality thumbnail via API for main display');
                setThumbnailUrl(apiThumbUrl);
              }
            } catch (e) {
              console.warn('⚠️ ProductVideo: Could not load video thumbnail via API for main display:', e);
            }
          }
        }

        // For thumbnails, if no token and CDN didn't work, just stop loading
        if (isGoogleDriveId && !googleToken && isThumbnail) {
          setVideoLoading(false);
          return;
        }

        // Check cache first
        const cacheKey = `${videoPath}_${googleToken || 'no-token'}`;
        if (videoUrlCacheRef.current.has(cacheKey)) {
          const cachedUrl = videoUrlCacheRef.current.get(cacheKey);
          setVideoUrl(cachedUrl);
          setVideoLoading(false);
          // For thumbnails, try to get video thumbnail via API if CDN didn't work
          if (isThumbnail && !thumbnailUrl && googleToken) {
            try {
              const thumbUrl = await getGoogleDriveVideoThumbnail(videoPath, googleToken);
              if (thumbUrl) setThumbnailUrl(thumbUrl);
            } catch (e) {
              console.warn('Could not load video thumbnail via API');
            }
          }
          return;
        }

        try {
          console.log('🎥 ProductVideo: Attempting to load video URL', {
            videoPath: videoPath?.substring(0, 100),
            hasToken: !!googleToken,
            tokenLength: googleToken?.length,
            isThumbnail,
            cacheKey,
            isGoogleDrive: isGoogleDrive
          });
          
          // For Google Drive videos, get preview URL (synchronous)
          let url = null;
          if (isGoogleDrive) {
            url = getGoogleDriveVideoPreviewUrl(videoPath);
            console.log('🎥 ProductVideo: Google Drive preview URL generated', {
              hasUrl: !!url,
              urlPreview: url ? url.substring(0, 100) : 'null'
            });
          } else if (videoPath.startsWith('http')) {
            // Direct video URL
            url = videoPath;
            console.log('✅ ProductVideo: Using direct video URL');
          } else {
            // Try the async method for other cases (though it now just returns preview URL)
            url = await getGoogleDriveVideoUrl(videoPath, googleToken);
          }
          
          console.log('🎥 ProductVideo: Video URL result', {
            hasUrl: !!url,
            urlType: typeof url,
            urlPreview: url ? url.substring(0, 100) : 'null',
            isPreview: url && url.includes('/preview'),
            isDirect: url && url.startsWith('http') && !url.includes('drive.google.com')
          });
          
          if (url) {
            console.log('✅ ProductVideo: Video URL loaded successfully');
            setVideoUrl(url);
            videoUrlCacheRef.current.set(cacheKey, url);
            // For iframe videos, mark as playing since they auto-play
            if (url.includes('/preview')) {
              setIsPlaying(true);
            }
            // For thumbnails, try to get video thumbnail via API if CDN didn't work
            if (isThumbnail && !thumbnailUrl && googleToken) {
              try {
                const thumbUrl = await getGoogleDriveVideoThumbnail(videoPath, googleToken);
                if (thumbUrl) setThumbnailUrl(thumbUrl);
              } catch (e) {
                console.warn('⚠️ ProductVideo: Could not load video thumbnail via API', e);
              }
            }
          } else {
            console.error('❌ ProductVideo: No video URL returned');
            setVideoError(true);
          }
        } catch (error) {
          console.error('❌ ProductVideo: Error loading video:', error);
          setVideoError(true);
        } finally {
          setVideoLoading(false);
        }
      };

      loadVideoUrl();
    }, [videoPath, googleToken, itemName, isThumbnail]);

    if (!canShowImage || !videoPath || videoError) {
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
            videocam_off
          </span>
        </div>
      );
    }

    // For thumbnails, show thumbnail image with play icon overlay (even if videoUrl is not loaded yet)
    if (isThumbnail) {
      // Show loading only if we don't have thumbnail and are still loading
      if (videoLoading && !thumbnailUrl) {
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
        <div style={{
          width: '100%',
          height: '100%',
          position: 'relative'
        }}>
          {thumbnailUrl ? (
            <>
            <img
              src={thumbnailUrl}
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
            />
              {/* Play Icon Overlay */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(0, 0, 0, 0.4)',
                pointerEvents: 'none',
                borderRadius: '8px'
              }}>
                <span className="material-icons" style={{
                  fontSize: '32px',
                  color: 'white',
                  textShadow: '0 2px 4px rgba(0, 0, 0, 0.5)'
                }}>
                  play_circle
                </span>
              </div>
            </>
          ) : (
            <div style={{
              width: '100%',
              height: '100%',
              backgroundColor: '#1f2937',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative'
            }}>
              <span className="material-icons" style={{
                fontSize: '32px',
                color: '#9ca3af'
              }}>
                videocam
              </span>
              {/* Play Icon Overlay */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                pointerEvents: 'none',
                borderRadius: '8px'
              }}>
                <span className="material-icons" style={{
                  fontSize: '32px',
                  color: 'white',
                  textShadow: '0 2px 4px rgba(0, 0, 0, 0.5)'
                }}>
                  play_circle
              </span>
              </div>
            </div>
          )}
        </div>
      );
    }

    // For main display, show video player with play button overlay
    const handlePlayClick = async () => {
      // If video URL is not loaded yet, try to load it first
      if (!videoUrl && videoPath) {
        try {
          console.log('🎥 ProductVideo: Loading video URL on play click');
          const url = await getGoogleDriveVideoUrl(videoPath, googleToken);
          if (url) {
            console.log('✅ ProductVideo: Video URL loaded on play click', {
              url: url.substring(0, 100),
              isPreview: url.includes('/preview')
            });
            setVideoUrl(url);
            const cacheKey = `${videoPath}_${googleToken || 'no-token'}`;
            videoUrlCacheRef.current.set(cacheKey, url);
            
            // For iframe videos, they play automatically, so mark as playing
            if (url.includes('/preview')) {
              setIsPlaying(true);
            } else {
              // For direct video URLs, wait for video element to be ready
              setTimeout(() => {
                if (videoRef.current) {
                  videoRef.current.play();
                  setIsPlaying(true);
                }
              }, 100);
            }
          }
        } catch (error) {
          console.error('❌ ProductVideo: Error loading video on play click:', error);
        }
      } else if (videoUrl && videoUrl.includes('/preview')) {
        // For iframe videos, they're already playing
        setIsPlaying(true);
      } else if (videoRef.current) {
        // For direct video URLs, play the video
        videoRef.current.play();
        setIsPlaying(true);
      }
    };

    // Show placeholder with play button if video URL is not loaded yet
    if (!videoUrl) {
      // Use thumbnail if available, otherwise try CDN, otherwise show video icon
      const showThumbnail = thumbnailUrl || (isGoogleDriveLink(videoPath) ? getGoogleDriveCDNUrl(videoPath, 'w800') : null);
      
      // If we're loading and have no thumbnail, show loading spinner
      if (videoLoading && !showThumbnail) {
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
        <div style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          backgroundColor: '#1f2937',
          borderRadius: '8px',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {showThumbnail ? (
            <img
              src={showThumbnail}
              alt={itemName}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                position: 'absolute',
                top: 0,
                left: 0,
                opacity: 0.6
              }}
              onError={(e) => {
                // If thumbnail fails to load, hide it and show video icon instead
                e.target.style.display = 'none';
              }}
            />
          ) : (
            <span className="material-icons" style={{
              fontSize: '64px',
              color: '#9ca3af',
              position: 'absolute',
              zIndex: 1
            }}>
              videocam
            </span>
          )}
          {/* Play Button Overlay */}
          <div
            onClick={handlePlayClick}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              cursor: 'pointer',
              borderRadius: '8px',
              zIndex: 10
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
            }}
          >
            <div style={{
              position: 'relative',
              zIndex: 11,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
              transition: 'transform 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
            >
              <span className="material-icons" style={{
                fontSize: '48px',
                color: '#3b82f6',
                marginLeft: '4px'
              }}>
                play_circle
              </span>
            </div>
          </div>
          {videoLoading && showThumbnail && (
            <div style={{
              position: 'absolute',
              top: '10px',
              right: '10px',
              zIndex: 12
            }}>
              <div style={{
                width: '24px',
                height: '24px',
                border: '2px solid rgba(255, 255, 255, 0.3)',
                borderTop: '2px solid white',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
            </div>
          )}
        </div>
      );
    }

    // Check if it's a Google Drive preview URL (iframe method)
    const isGoogleDrivePreview = videoUrl && videoUrl.includes('drive.google.com/file/d/') && videoUrl.includes('/preview');
    
    // For Google Drive videos, use iframe
    if (isGoogleDrivePreview) {
      console.log('✅ ProductVideo: Using iframe for Google Drive video', {
        previewUrl: videoUrl
      });
      return (
        <div style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          backgroundColor: '#000',
          borderRadius: '8px',
          overflow: 'hidden'
        }}>
          <iframe
            src={videoUrl}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              borderRadius: '8px',
              position: 'absolute',
              top: 0,
              left: 0
            }}
            allow="autoplay; encrypted-media"
            allowFullScreen
            title={itemName}
            onError={(e) => {
              console.error('❌ ProductVideo: Iframe failed to load');
              setVideoError(true);
            }}
          />
        </div>
      );
    }

    // For direct video URLs, use video element
    return (
      <div style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        backgroundColor: '#000',
        borderRadius: '8px',
        overflow: 'hidden'
      }}>
      <video
          ref={videoRef}
        src={videoUrl}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          borderRadius: '8px',
          position: 'absolute',
          top: 0,
          left: 0,
          backgroundColor: '#000'
        }}
          controls={isPlaying}
        preload="metadata"
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        onError={(e) => {
            console.error('❌ ProductVideo: Video failed to load');
          setVideoError(true);
        }}
      />
        {/* Play Button Overlay - shown when video is not playing (only for direct video URLs) */}
        {!isPlaying && (
          <div
            onClick={handlePlayClick}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              cursor: 'pointer',
              borderRadius: '8px',
              zIndex: 10
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
            }}
          >
            {thumbnailUrl ? (
              <img
                src={thumbnailUrl}
                alt={itemName}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  opacity: 0.7
                }}
              />
            ) : null}
            <div style={{
              position: 'relative',
              zIndex: 11,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
              transition: 'transform 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
            >
              <span className="material-icons" style={{
                fontSize: '48px',
                color: '#3b82f6',
                marginLeft: '4px'
              }}>
                play_circle
              </span>
            </div>
          </div>
        )}
      </div>
    );
  });

  // Helper function to get Google Drive video thumbnail
  const getGoogleDriveVideoThumbnail = async (videoPath, accessToken) => {
    if (!videoPath || !accessToken) return null;

    let fileId = null;
    
    // Extract file ID from various Google Drive URL formats
    if (videoPath && typeof videoPath === 'string' && videoPath.includes('drive.google.com')) {
      // Handle preview URLs: https://drive.google.com/file/d/FILE_ID/preview
      const previewMatch = videoPath.match(/\/file\/d\/([a-zA-Z0-9_-]+)\/preview/);
      if (previewMatch && previewMatch[1]) {
        fileId = previewMatch[1];
      } else {
        // Try other patterns
        const patterns = [
          /\/file\/d\/([a-zA-Z0-9_-]+)/,
          /\/d\/([a-zA-Z0-9_-]+)/,
          /[?&]id=([a-zA-Z0-9_-]+)/
        ];
        for (const pattern of patterns) {
          const match = videoPath.match(pattern);
          if (match && match[1]) {
            fileId = match[1];
            break;
          }
        }
      }
    } else if (/^[a-zA-Z0-9_-]{15,}$/.test(videoPath.trim())) {
      // It's already a file ID
      fileId = videoPath.trim();
    }

    // If we couldn't extract file ID, return null
    if (!fileId || !/^[a-zA-Z0-9_-]{15,}$/.test(fileId)) {
      console.warn('⚠️ Could not extract file ID from video path:', videoPath);
      return null;
    }

    try {
      // Get video thumbnail from Google Drive API using token from company configs
      const thumbnailUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/thumbnail?alt=media`;
      console.log('🖼️ Fetching video thumbnail from Google Drive API:', {
        fileId,
        thumbnailUrl,
        hasToken: !!accessToken,
        tokenLength: accessToken?.length
      });
      
      const response = await fetch(thumbnailUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (response.ok) {
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        console.log('✅ Video thumbnail fetched successfully');
        return objectUrl;
      } else {
        console.warn('⚠️ Failed to fetch video thumbnail:', response.status, response.statusText);
      }
    } catch (error) {
      console.warn('⚠️ Could not fetch video thumbnail:', error);
    }

    return null;
  };

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
      width: '100%',
      minHeight: '100%',
      background: 'transparent',
      padding: isMobile ? '8px 0' : 0,
      margin: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: isMobile ? 'center' : 'stretch',
      boxSizing: 'border-box'
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
        margin: isMobile ? '12px 8px' : '24px 24px 16px 24px',
        width: isMobile ? 'calc(100% - 16px)' : '1400px',
        borderRadius: isMobile ? '12px' : '16px',
        boxSizing: 'border-box',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        overflow: 'visible',
        border: '1px solid #e5e7eb',
        position: 'relative',
        boxSizing: 'border-box'
      }}>
        {/* Form */}
        <div style={{
          padding: isMobile ? '14px 12px' : '20px',
          width: '100%',
          overflow: 'visible',
          position: 'relative',
          boxSizing: 'border-box'
        }}>
          {/* Header */}
          <div style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            alignItems: isMobile ? 'flex-start' : 'center',
            justifyContent: 'space-between',
            marginBottom: isMobile ? '12px' : '16px',
            paddingBottom: isMobile ? '12px' : '16px',
            borderBottom: '1px solid #f3f4f6',
            position: 'relative',
            gap: isMobile ? '12px' : '0'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: isMobile ? '8px' : '12px',
              width: isMobile ? '100%' : 'auto'
            }}>
              <div style={{
                width: isMobile ? '32px' : '40px',
                height: isMobile ? '32px' : '40px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 4px rgba(59, 130, 246, 0.3)',
                flexShrink: 0
              }}>
                <span className="material-icons" style={{ fontSize: isMobile ? '18px' : '20px', color: '#fff' }}>
                  storefront
                </span>
              </div>
              <h3 style={{
                margin: 0,
                fontSize: isMobile ? '16px' : '20px',
                fontWeight: '600',
                color: '#1f2937'
              }}>
                E-Commerce Place Order
              </h3>
            </div>

            {/* Optional text centered between E-Commerce Place Order and customer count */}
            {canSaveOptional && !isMobile && (
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
              fontSize: isMobile ? '11px' : '14px',
              color: '#64748b',
              fontWeight: '500',
              padding: isMobile ? '5px 10px' : '8px 16px',
              backgroundColor: '#f8fafc',
              borderRadius: '20px',
              border: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              gap: isMobile ? '5px' : '8px',
              position: 'relative',
              zIndex: 1,
              maxWidth: isMobile ? '100%' : '200px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flexShrink: 1,
              minWidth: 0
            }}>
              <span style={{ fontSize: isMobile ? '14px' : '16px', flexShrink: 0 }}>👥</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {customerLoading ? 'Loading...' : `${customerOptions.length.toLocaleString()} customers available`}
              </span>
            </div>
          </div>

          {/* Customer Selection */}
          <div style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            gap: isMobile ? '12px' : '16px',
            alignItems: isMobile ? 'stretch' : 'end',
            minHeight: '60px',
            position: 'relative',
            marginTop: isMobile ? '8px' : '0'
          }}>
            {/* VoucherType */}
            <div style={{
              position: 'relative',
              flex: isMobile ? '1 1 100%' : '0 0 280px',
              width: isMobile ? '100%' : 'auto',
              minWidth: isMobile ? '0' : '200px'
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
                    padding: isMobile ? '12px 16px' : '16px 20px',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: isMobile ? '14px' : '15px',
                    color: '#1e293b',
                    outline: 'none',
                    background: 'transparent',
                    cursor: voucherTypesLoading ? 'not-allowed' : 'text'
                  }}
                  placeholder={voucherTypesLoading ? 'Loading voucher types...' : 'Select Voucher Type'}
                />
                <label style={{
                  position: 'absolute',
                  left: isMobile ? '16px' : '20px',
                  top: voucherTypeFocused || selectedVoucherType ? '-10px' : (isMobile ? '12px' : '16px'),
                  fontSize: voucherTypeFocused || selectedVoucherType ? '11px' : (isMobile ? '14px' : '15px'),
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
              flex: isMobile ? '1 1 100%' : '1 1 auto',
              width: isMobile ? '100%' : 'auto',
              minWidth: isMobile ? '0' : '250px'
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
                    padding: isMobile ? '12px 16px' : '16px 20px',
                    paddingRight: selectedCustomer ? (isMobile ? '45px' : '50px') : (isMobile ? '16px' : '20px'),
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: isMobile ? '14px' : '15px',
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
                  left: isMobile ? '16px' : '20px',
                  top: customerFocused || !!selectedCustomer ? '-10px' : (isMobile ? '12px' : '16px'),
                  fontSize: customerFocused || !!selectedCustomer ? '11px' : (isMobile ? '14px' : '15px'),
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
              flex: isMobile ? '1 1 100%' : '0 0 160px',
              width: isMobile ? '100%' : 'auto',
              minWidth: isMobile ? '0' : '140px'
            }}>
              <button
                onClick={navigateToPlaceOrder}
                disabled={!company || !selectedCustomer || cart.length === 0}
                style={{
                  background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: isMobile ? '14px' : '16px',
                  fontWeight: '600',
                  cursor: (!company || !selectedCustomer || cart.length === 0) ? 'not-allowed' : 'pointer',
                  opacity: (!company || !selectedCustomer || cart.length === 0) ? 0.5 : 1,
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: isMobile ? '6px' : '8px',
                  padding: isMobile ? '10px 16px' : '12px 20px',
                  width: isMobile ? '100%' : 'auto',
                  flex: isMobile ? '1 1 100%' : '0 0 auto'
                }}
                title={cart.length === 0 ? "Add items to cart first" : "Proceed to Place Order"}
              >
                <span className="material-icons" style={{ fontSize: isMobile ? '16px' : '18px' }}>shopping_cart</span>
                {cart.length === 0 ? (isMobile ? 'Empty' : 'Cart Empty') : (isMobile ? `Cart (${cart.length})` : `Cart (${cart.length})`)}
              </button>

            </div>
          </div>

          {/* Credit Information */}
          {(canShowCreditLimit || canControlCreditLimit) && selectedCustomer && (
            <div style={{
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              alignItems: isMobile ? 'flex-start' : 'center',
              justifyContent: 'flex-start',
              gap: isMobile ? '12px' : '20px',
              padding: isMobile ? '12px 0' : '8px 0',
              fontSize: isMobile ? '12px' : '14px',
              fontWeight: '500'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="material-icons" style={{ fontSize: '16px', color: '#6b7280' }}>
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
        </div>
      </div>

      {/* Products Display Section */}
      {selectedCustomer && (
        <div style={{
          background: '#fff',
          margin: isMobile ? '0px 8px 12px 8px' : '10px 24px 24px 24px',
          width: isMobile ? 'calc(100% - 16px)' : '1400px',
          borderRadius: isMobile ? '12px' : '16px',
          boxSizing: 'border-box',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          border: '1px solid #e5e7eb',
          padding: isMobile ? '10px' : '24px',
          boxSizing: 'border-box'
        }}>
          <div style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            alignItems: isMobile ? 'flex-start' : 'center',
            justifyContent: 'space-between',
            marginBottom: isMobile ? '16px' : '24px',
            gap: isMobile ? '12px' : '12px'
          }}>
            <h2 style={{ margin: 0, fontSize: isMobile ? '16px' : '24px', fontWeight: '600', color: '#1f2937', lineHeight: '1.3' }}>
              Available Products ({filteredStockItems.length.toLocaleString()})
            </h2>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: isMobile ? '100%' : 'auto' }}>
              <input
                type="text"
                value={productSearchTerm}
                onChange={(e) => setProductSearchTerm(e.target.value)}
                placeholder="Search item or part no..."
                style={{
                  width: isMobile ? '100%' : 340,
                  padding: isMobile ? '8px 32px 8px 12px' : '10px 36px 10px 14px',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  fontSize: isMobile ? 13 : 14
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
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
            gap: isMobile ? '20px' : '60px',
            padding: isMobile ? '8px 0' : '16px 0',
            maxHeight: isMobile ? '600px' : '800px',
            overflowY: 'auto',
            boxSizing: 'border-box'
          }}>
            {filteredStockItems.map((item, index) => {
              const cartItem = cart.find(cartItem => cartItem.NAME === item.NAME);

              return (
                <div key={item.NAME || index} style={{
                  background: '#fff',
                  borderRadius: 12,
                  padding: isMobile ? '12px' : '18px',
                  boxShadow: '0 2px 8px 0 rgba(31,38,135,0.08)',
                  border: '1px solid #e2e8f0',
                  transition: 'all 0.2s ease',
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                  minHeight: canShowImage ? (isMobile ? 'auto' : '320px') : (isMobile ? 'auto' : '260px'),
                  display: 'flex',
                  flexDirection: 'column',
                  width: '100%',
                  boxSizing: 'border-box'
                }} 
                onClick={() => {
                  setSelectedProduct(item);
                  setSelectedImageIndex(0); // Reset to first image
                  setShowProductModal(true);
                }}
                onMouseEnter={(e) => {
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
                        height: isMobile ? '90px' : '120px',
                        marginBottom: isMobile ? '8px' : '12px',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        backgroundColor: '#f8fafc',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative'
                      }}>
                      <ProductImage
                        imagePath={item.IMAGEPATH}
                        itemName={item.NAME}
                        googleToken={googleToken}
                        imageUrlCacheRef={imageUrlCache}
                        canShowImage={canShowImage}
                        useFirstImageAsThumbnail={true}
                      />
                    </div>

                    {/* Product Details */}
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px'
                    }}>
                      {/* Item Name with Image Button */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                        width: '100%'
                      }}>
                        <h3 style={{
                          fontSize: isMobile ? 14 : 16,
                          fontWeight: 600,
                          color: '#1e293b',
                          margin: 0,
                          lineHeight: 1.4,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          flex: 1
                        }}>
                          {item.NAME}
                        </h3>
                        {canUploadImage && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedProductForImage(item);
                            setShowImageUploadModal(true);
                          }}
                          style={{
                            background: 'transparent',
                            border: '1px solid #3b82f6',
                            borderRadius: '6px',
                            padding: isMobile ? '4px 6px' : '6px 8px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#3b82f6',
                            fontSize: isMobile ? '11px' : '12px',
                            fontWeight: 500,
                            transition: 'all 0.2s ease',
                            flexShrink: 0,
                            minWidth: isMobile ? '60px' : '70px'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#3b82f6';
                            e.currentTarget.style.color = '#fff';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                            e.currentTarget.style.color = '#3b82f6';
                          }}
                            title="Add Media"
                        >
                          <span className="material-icons" style={{ fontSize: isMobile ? '14px' : '16px', marginRight: '4px' }}>image</span>
                            {!isMobile && 'Media'}
                        </button>
                        )}
                      </div>

                      {/* Part Number and Stock */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px'
                      }}>
                        <span style={{
                          fontSize: isMobile ? 12 : 13,
                          color: '#64748b',
                          fontWeight: 500
                        }}>
                          Part: {item.PARTNO || 'N/A'}
                        </span>
                        {canShowClosingStock && (
                          <span
                            style={{
                              fontSize: isMobile ? 11 : 12,
                              color: '#64748b',
                              background: '#f1f5f9',
                              padding: isMobile ? '3px 6px' : '4px 8px',
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
                          fontSize: isMobile ? 16 : 18,
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
                            height: isMobile ? '32px' : '36px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            background: '#fef3c7',
                            border: '2px solid #f59e0b',
                            borderRadius: '8px',
                            padding: isMobile ? '0 10px' : '0 12px',
                            gap: isMobile ? '6px' : '8px',
                            margin: '0 4px'
                          }}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                updateQuantity(item.NAME, cartItem.quantity - 1);
                              }}
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
                                fontSize: isMobile ? '12px' : '14px',
                                transition: 'all 0.2s ease',
                                minWidth: isMobile ? '24px' : '20px',
                                minHeight: isMobile ? '24px' : '20px'
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
                              fontSize: isMobile ? '14px' : '16px',
                              fontWeight: '600',
                              color: '#374151',
                              minWidth: '24px',
                              textAlign: 'center',
                              flex: 1
                            }}>
                              {cartItem.quantity}
                            </span>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                updateQuantity(item.NAME, cartItem.quantity + 1);
                              }}
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
                                fontSize: isMobile ? '14px' : '16px',
                                fontWeight: 'bold',
                                transition: 'all 0.2s ease',
                                minWidth: isMobile ? '24px' : '20px',
                                minHeight: isMobile ? '24px' : '20px'
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
                            onClick={(e) => {
                              e.stopPropagation();
                              addToCart(item);
                            }}
                            style={{
                              width: 'calc(100% - 8px)',
                              height: isMobile ? '32px' : '36px',
                              padding: isMobile ? '0 10px' : '0 12px',
                              background: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)',
                              color: '#fff',
                              border: 'none',
                              borderRadius: 8,
                              fontWeight: 600,
                              fontSize: isMobile ? 13 : 14,
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: isMobile ? 6 : 8,
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
                            <span className="material-icons" style={{ fontSize: isMobile ? 14 : 16 }}>add_shopping_cart</span>
                            {isMobile ? 'Add' : 'Add to Cart'}
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
            padding: isMobile ? '16px' : '24px',
            maxWidth: isMobile ? '95%' : '600px',
            width: isMobile ? '95%' : '90%',
            maxHeight: '80vh',
            overflow: 'auto',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
          }}>
            {/* Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: isMobile ? '16px' : '20px',
              paddingBottom: isMobile ? '12px' : '16px',
              borderBottom: '1px solid #e5e7eb'
            }}>
              <h3 style={{
                margin: 0,
                fontSize: isMobile ? '16px' : '18px',
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
                  fontSize: isMobile ? '20px' : '24px',
                  cursor: 'pointer',
                  color: '#6b7280',
                  padding: '4px',
                  minWidth: isMobile ? '32px' : 'auto',
                  minHeight: isMobile ? '32px' : 'auto',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
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
                marginBottom: isMobile ? '16px' : '20px',
                gap: isMobile ? '8px' : '12px',
                flexWrap: 'wrap'
              }}>
                <span style={{
                  fontSize: isMobile ? '12px' : '14px',
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
                  fontSize: isMobile ? '12px' : '14px',
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
                  padding: isMobile ? '12px' : '16px',
                  borderRadius: '8px',
                  marginBottom: isMobile ? '16px' : '20px'
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center'
                  }}>
                    <span style={{
                      fontSize: isMobile ? '12px' : '14px',
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
                  maxHeight: isMobile ? '250px' : '300px',
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
                          fontSize: isMobile ? '12px' : '14px',
                          fontWeight: '500',
                          color: isCurrentCompany ? '#6b7280' : '#1f2937',
                          fontStyle: isCurrentCompany ? 'italic' : 'normal'
                        }}>
                          {item.NAME}
                        </span>
                        <span style={{
                          fontSize: isMobile ? '12px' : '14px',
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
              marginTop: isMobile ? '16px' : '20px',
              paddingTop: isMobile ? '12px' : '16px',
              borderTop: '1px solid #e5e7eb'
            }}>
              <button
                onClick={() => setShowStockModal(false)}
                style={{
                  padding: isMobile ? '8px 14px' : '8px 16px',
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: isMobile ? '13px' : '14px',
                  fontWeight: '500',
                  width: isMobile ? '100%' : 'auto'
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
            maxWidth: isMobile ? '95%' : '800px',
            width: isMobile ? '95%' : 'auto',
            maxHeight: '80vh',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{
              padding: isMobile ? '16px' : '20px 24px',
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h2 style={{
                margin: 0,
                fontSize: isMobile ? '16px' : '18px',
                fontWeight: '600',
                color: '#1f2937'
              }}>Overdue Bills Details</h2>
              <button
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: isMobile ? '20px' : '24px',
                  cursor: 'pointer',
                  color: '#6b7280',
                  padding: '4px',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: isMobile ? '28px' : '32px',
                  height: isMobile ? '28px' : '32px'
                }}
                onClick={() => setShowOverdueBills(false)}
                title="Close"
              >
                ×
              </button>
            </div>

            <div style={{
              padding: isMobile ? '12px' : '20px',
              maxHeight: '60vh',
              overflowY: 'auto'
            }}>
              <div style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                padding: isMobile ? '12px' : '16px',
                marginBottom: isMobile ? '16px' : '20px'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: isMobile ? '6px' : '8px',
                  marginBottom: isMobile ? '6px' : '8px',
                  flexWrap: 'wrap'
                }}>
                  <span className="material-icons" style={{ fontSize: isMobile ? '18px' : '20px', color: '#dc2626' }}>
                    warning
                  </span>
                  <span style={{ color: '#dc2626', fontWeight: '600', fontSize: isMobile ? '14px' : '16px' }}>
                    {creditLimitData.overdueBills.length} Overdue Bill(s) Found
                  </span>
                </div>
                <p style={{ color: '#7f1d1d', fontSize: isMobile ? '12px' : '14px', margin: 0 }}>
                  Customer has outstanding bills that are past their due date. Please review the details below.
                </p>
              </div>

              <div style={{
                overflowX: 'auto',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                WebkitOverflowScrolling: 'touch'
              }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: isMobile ? '12px' : '14px',
                  minWidth: isMobile ? '600px' : 'auto'
                }}>
                  <thead>
                    <tr style={{
                      background: '#f8fafc',
                      borderBottom: '2px solid #e5e7eb'
                    }}>
                      <th style={{
                        padding: isMobile ? '8px 10px' : '12px 16px',
                        textAlign: 'left',
                        fontWeight: '600',
                        color: '#374151',
                        borderRight: '1px solid #e5e7eb',
                        width: isMobile ? '150px' : '200px',
                        fontSize: isMobile ? '11px' : '14px'
                      }}>
                        Bill Reference
                      </th>
                      <th style={{
                        padding: isMobile ? '8px 10px' : '12px 16px',
                        textAlign: 'right',
                        fontWeight: '600',
                        color: '#374151',
                        borderRight: '1px solid #e5e7eb',
                        width: isMobile ? '100px' : '120px',
                        fontSize: isMobile ? '11px' : '14px'
                      }}>
                        Bill Date
                      </th>
                      <th style={{
                        padding: isMobile ? '8px 10px' : '12px 16px',
                        textAlign: 'right',
                        fontWeight: '600',
                        color: '#374151',
                        borderRight: '1px solid #e5e7eb',
                        width: isMobile ? '120px' : '150px',
                        fontSize: isMobile ? '11px' : '14px'
                      }}>
                        Opening Balance
                      </th>
                      <th style={{
                        padding: isMobile ? '8px 10px' : '12px 16px',
                        textAlign: 'right',
                        fontWeight: '600',
                        color: '#374151',
                        borderRight: '1px solid #e5e7eb',
                        width: isMobile ? '120px' : '150px',
                        fontSize: isMobile ? '11px' : '14px'
                      }}>
                        Closing Balance
                      </th>
                      <th style={{
                        padding: isMobile ? '8px 10px' : '12px 16px',
                        textAlign: 'right',
                        fontWeight: '600',
                        color: '#374151',
                        borderRight: '1px solid #e5e7eb',
                        width: isMobile ? '100px' : '120px',
                        fontSize: isMobile ? '11px' : '14px'
                      }}>
                        Due Date
                      </th>
                      <th style={{
                        padding: isMobile ? '8px 10px' : '12px 16px',
                        textAlign: 'center',
                        fontWeight: '600',
                        color: '#374151',
                        fontSize: isMobile ? '11px' : '14px'
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
                          padding: isMobile ? '8px 10px' : '12px 16px',
                          fontWeight: '600',
                          color: '#1f2937',
                          borderRight: '1px solid #e5e7eb',
                          width: isMobile ? '150px' : '200px',
                          fontSize: isMobile ? '11px' : '14px'
                        }}>
                          {bill.REFNO}
                        </td>
                        <td style={{
                          padding: isMobile ? '8px 10px' : '12px 16px',
                          textAlign: 'right',
                          color: '#6b7280',
                          borderRight: '1px solid #e5e7eb',
                          width: isMobile ? '100px' : '120px',
                          fontSize: isMobile ? '11px' : '14px'
                        }}>
                          {bill.DATE}
                        </td>
                        <td style={{
                          padding: isMobile ? '8px 10px' : '12px 16px',
                          textAlign: 'right',
                          fontWeight: '600',
                          color: bill.OPENINGBALANCE < 0 ? '#dc2626' : '#059669',
                          borderRight: '1px solid #e5e7eb',
                          width: isMobile ? '120px' : '150px',
                          fontSize: isMobile ? '11px' : '14px'
                        }}>
                          ₹{Math.abs(bill.OPENINGBALANCE).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          {bill.OPENINGBALANCE < 0 ? ' Dr' : ' Cr'}
                        </td>
                        <td style={{
                          padding: isMobile ? '8px 10px' : '12px 16px',
                          textAlign: 'right',
                          fontWeight: '600',
                          color: bill.CLOSINGBALANCE < 0 ? '#dc2626' : '#059669',
                          borderRight: '1px solid #e5e7eb',
                          width: isMobile ? '120px' : '150px',
                          fontSize: isMobile ? '11px' : '14px'
                        }}>
                          ₹{Math.abs(bill.CLOSINGBALANCE).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          {bill.CLOSINGBALANCE < 0 ? ' Dr' : ' Cr'}
                        </td>
                        <td style={{
                          padding: isMobile ? '8px 10px' : '12px 16px',
                          textAlign: 'right',
                          color: '#6b7280',
                          borderRight: '1px solid #e5e7eb',
                          width: isMobile ? '100px' : '120px',
                          fontSize: isMobile ? '11px' : '14px'
                        }}>
                          {bill.DUEON}
                        </td>
                        <td style={{
                          padding: isMobile ? '8px 10px' : '12px 16px',
                          textAlign: 'center',
                          fontWeight: '600',
                          color: '#dc2626',
                          fontSize: isMobile ? '11px' : '14px'
                        }}>
                          {bill.OVERDUEDAYS} days
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{
                marginTop: isMobile ? '16px' : '20px',
                padding: isMobile ? '12px' : '16px',
                background: '#f0f9ff',
                border: '1px solid #bae6fd',
                borderRadius: '8px'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: isMobile ? '6px' : '8px',
                  marginBottom: isMobile ? '6px' : '8px',
                  flexWrap: 'wrap'
                }}>
                  <span className="material-icons" style={{ fontSize: isMobile ? '16px' : '18px', color: '#0369a1' }}>
                    info
                  </span>
                  <span style={{ color: '#0369a1', fontWeight: '600', fontSize: isMobile ? '12px' : '14px' }}>
                    Total Overdue Amount
                  </span>
                </div>
                <div style={{
                  fontSize: isMobile ? '16px' : '18px',
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

      {/* Product Detail Modal */}
      {showProductModal && selectedProduct && (
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
        }} onClick={() => setShowProductModal(false)}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: 0,
            maxWidth: isMobile ? '98%' : '1200px',
            width: isMobile ? '98%' : '95%',
            maxHeight: '90vh',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column'
          }} onClick={(e) => e.stopPropagation()}>
            {/* Close Button */}
            <button
              onClick={() => {
                setShowProductModal(false);
                setSelectedImageIndex(0); // Reset image index when closing
              }}
              style={{
                position: 'absolute',
                top: isMobile ? '12px' : '16px',
                right: isMobile ? '12px' : '16px',
                background: 'none',
                border: 'none',
                fontSize: isMobile ? '24px' : '28px',
                cursor: 'pointer',
                color: '#6b7280',
                padding: '4px',
                minWidth: isMobile ? '32px' : 'auto',
                minHeight: isMobile ? '32px' : 'auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f3f4f6';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              title="Close"
            >
              ×
            </button>

            {/* Modal Content */}
            <div style={{
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              gap: 0,
              height: '100%',
              maxHeight: '90vh',
              overflow: 'hidden'
            }}>
              {/* Left Side - Product Image/Video Gallery */}
              {canShowImage && (() => {
                const mediaPaths = parseImagePaths(selectedProduct.IMAGEPATH);
                const currentMediaPath = mediaPaths[selectedImageIndex] || mediaPaths[0] || selectedProduct.IMAGEPATH;
                // Use detected media type from map, fallback to synchronous detection
                const detectedType = mediaTypeMap[currentMediaPath];
                
                // More aggressive detection: if it's a Google Drive link and type is unknown or image,
                // check if we should try as video (since videos need special handling)
                let isCurrentVideo = detectedType === 'video';
                
                // Always do synchronous check first for immediate rendering
                // Check if it's a preview URL (videos stored as preview URLs)
                if (!isCurrentVideo && currentMediaPath) {
                  const syncType = getLinkType(currentMediaPath);
                  const isPreviewUrl = currentMediaPath && typeof currentMediaPath === 'string' && 
                                       currentMediaPath.includes('drive.google.com/file/d/') && 
                                       currentMediaPath.includes('/preview');
                  isCurrentVideo = syncType === 'google_drive_video' || syncType === 'direct_video' || isVideoUrl(currentMediaPath) || isPreviewUrl;
                  if (isPreviewUrl && !isCurrentVideo) {
                    console.log('✅ Modal: Detected preview URL as video:', currentMediaPath?.substring(0, 50));
                    isCurrentVideo = true;
                  }
                }
                
                // If still not detected as video and it's a Google Drive link with token, 
                // check MIME type asynchronously (but don't block rendering)
                if (!isCurrentVideo && isGoogleDriveLink(currentMediaPath) && googleToken) {
                  // Trigger async MIME type check (will update mediaTypeMap when complete)
                  checkGoogleDriveFileType(currentMediaPath, googleToken).then(mimeType => {
                    if (mimeType && mimeType.startsWith('video/')) {
                      console.log('✅ Modal: Video detected via async MIME check:', mimeType);
                      setMediaTypeMap(prev => ({
                        ...prev,
                        [currentMediaPath]: 'video'
                      }));
                    }
                  }).catch(err => {
                    console.warn('⚠️ Modal: Error checking MIME type:', err);
                  });
                }
                
                console.log('🎬 Modal: Current media detection', {
                  currentMediaPath: currentMediaPath?.substring(0, 50),
                  detectedType,
                  isCurrentVideo,
                  isGoogleDrive: isGoogleDriveLink(currentMediaPath),
                  hasToken: !!googleToken,
                  mediaTypeMap,
                  allMediaPaths: mediaPaths.map(p => p.substring(0, 30))
                });
                
                return (
                  <div style={{
                    flex: isMobile ? '0 0 auto' : '0 0 500px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    padding: isMobile ? '20px' : '32px',
                    backgroundColor: '#fafafa',
                    borderRight: isMobile ? 'none' : '1px solid #e5e7eb',
                    borderBottom: isMobile ? '1px solid #e5e7eb' : 'none',
                    overflowY: 'auto',
                    maxHeight: isMobile ? '50vh' : '90vh'
                  }}>
                    {/* Main Image/Video */}
                    <div 
                      style={{
                      width: '100%',
                        aspectRatio: '1 / 1',
                        minHeight: isMobile ? '300px' : '450px',
                        borderRadius: '8px',
                      overflow: 'hidden',
                        backgroundColor: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                        border: '1px solid #e5e7eb',
                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                        cursor: isCurrentVideo ? 'default' : 'zoom-in'
                      }}
                      onMouseEnter={(e) => {
                        if (!isCurrentVideo) {
                          const images = e.currentTarget.querySelectorAll('img');
                          images.forEach(img => {
                            img.style.transform = 'scale(1.5)';
                            img.style.transition = 'transform 0.5s ease-in-out';
                            img.style.transformOrigin = 'center center';
                          });
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isCurrentVideo) {
                          const images = e.currentTarget.querySelectorAll('img');
                          images.forEach(img => {
                            img.style.transform = 'scale(1)';
                            img.style.transition = 'transform 0.5s ease-in-out';
                            img.style.transformOrigin = 'center center';
                          });
                        }
                      }}
                    >
                      {(() => {
                        if (isCurrentVideo) {
                          console.log('✅ Modal: Rendering ProductVideo component', {
                            videoPath: currentMediaPath?.substring(0, 50),
                            hasToken: !!googleToken,
                            detectedType: mediaTypeMap[currentMediaPath]
                          });
                          return (
                        <ProductVideo
                          videoPath={currentMediaPath}
                          itemName={selectedProduct.NAME}
                          googleToken={googleToken}
                          videoUrlCacheRef={videoUrlCache}
                          canShowImage={canShowImage}
                          isThumbnail={false}
                        />
                          );
                        } else {
                          console.log('🖼️ Modal: Rendering ProductImage component', {
                            imagePath: currentMediaPath?.substring(0, 50),
                            detectedType: mediaTypeMap[currentMediaPath]
                          });
                          return (
                            <div style={{
                              width: '100%',
                              height: '100%',
                              overflow: 'hidden',
                              position: 'relative'
                            }}>
                        <ProductImage
                          imagePath={currentMediaPath}
                          itemName={selectedProduct.NAME}
                          googleToken={googleToken}
                          imageUrlCacheRef={imageUrlCache}
                          canShowImage={canShowImage}
                        />
                            </div>
                          );
                        }
                      })()}
                    </div>

                    {/* Media Thumbnails - Show all images including first */}
                    {mediaPaths.length > 1 && (
                      <div style={{
                        display: 'flex',
                        gap: '12px',
                        overflowX: 'auto',
                        padding: '8px 0',
                        scrollbarWidth: 'thin',
                        scrollbarColor: '#cbd5e1 #f1f5f9',
                        WebkitOverflowScrolling: 'touch'
                      }}>
                        {mediaPaths.map((mediaPath, index) => {
                          // Use detected media type from map, fallback to synchronous detection
                          const detectedType = mediaTypeMap[mediaPath];
                          let isVideo = detectedType === 'video';
                          
                          // If not detected as video, do additional checks
                          // Check if it's a preview URL (videos stored as preview URLs)
                          if (!isVideo && mediaPath) {
                            const isPreviewUrl = mediaPath && typeof mediaPath === 'string' && 
                                                 mediaPath.includes('drive.google.com/file/d/') && 
                                                 mediaPath.includes('/preview');
                            if (isPreviewUrl) {
                              isVideo = true;
                              console.log('✅ Thumbnail: Detected preview URL as video:', mediaPath?.substring(0, 50));
                            } else if (isGoogleDriveLink(mediaPath)) {
                              // For Google Drive, check sync detection
                              const syncType = getLinkType(mediaPath);
                              isVideo = syncType === 'google_drive_video' || syncType === 'direct_video' || isVideoUrl(mediaPath);
                            } else {
                              // For non-Google Drive, use standard detection
                              isVideo = getLinkType(mediaPath) === 'direct_video' || isVideoUrl(mediaPath);
                            }
                          }
                          
                          console.log('🎬 Thumbnail detection:', {
                            index,
                            path: mediaPath ? mediaPath.substring(0, 30) : 'null',
                            detectedType,
                            isVideo,
                            isGoogleDrive: isGoogleDriveLink(mediaPath)
                          });
                          // Create click handler that re-checks MIME type if needed
                          const handleThumbnailClick = async () => {
                            setSelectedImageIndex(index);
                            
                            // If it's a Google Drive link and we have a token, re-check MIME type
                            if (isGoogleDriveLink(mediaPath) && googleToken && detectedType !== 'video') {
                              console.log('🔍 Re-checking MIME type for clicked thumbnail');
                              try {
                                const mimeType = await checkGoogleDriveFileType(mediaPath, googleToken);
                                if (mimeType && mimeType.startsWith('video/')) {
                                  // Update the type map
                                  setMediaTypeMap(prev => ({
                                    ...prev,
                                    [mediaPath]: 'video'
                                  }));
                                  console.log('✅ Re-detected as video via MIME type check on click');
                                } else if (mimeType && mimeType.startsWith('image/')) {
                                  setMediaTypeMap(prev => ({
                                    ...prev,
                                    [mediaPath]: 'image'
                                  }));
                                  console.log('✅ Confirmed as image via MIME type check on click');
                                }
                              } catch (error) {
                                console.warn('⚠️ Error re-checking MIME type:', error);
                              }
                            }
                          };
                          
                          return (
                            <div
                              key={index}
                              onClick={handleThumbnailClick}
                              style={{
                                width: isMobile ? '70px' : '90px',
                                height: isMobile ? '70px' : '90px',
                                borderRadius: '6px',
                                overflow: 'hidden',
                                backgroundColor: '#ffffff',
                                border: selectedImageIndex === index ? '3px solid #ff6f00' : '2px solid #e5e7eb',
                                cursor: 'pointer',
                                flexShrink: 0,
                                position: 'relative',
                                transition: 'all 0.2s ease',
                                boxShadow: selectedImageIndex === index ? '0 4px 8px rgba(255, 111, 0, 0.3)' : '0 2px 4px rgba(0, 0, 0, 0.1)'
                              }}
                              onMouseEnter={(e) => {
                                if (selectedImageIndex !== index) {
                                  e.currentTarget.style.borderColor = '#ff6f00';
                                  e.currentTarget.style.transform = 'scale(1.08)';
                                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(255, 111, 0, 0.3)';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (selectedImageIndex !== index) {
                                  e.currentTarget.style.borderColor = '#e5e7eb';
                                  e.currentTarget.style.transform = 'scale(1)';
                                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
                                }
                              }}
                            >
                              {isVideo ? (
                                  <ProductVideo
                                    videoPath={mediaPath}
                                    itemName={`${selectedProduct.NAME} - Video ${index + 1}`}
                                    googleToken={googleToken}
                                    videoUrlCacheRef={videoUrlCache}
                                    canShowImage={canShowImage}
                                    isThumbnail={true}
                                  />
                              ) : (
                                <div style={{
                                  width: '100%',
                                  height: '100%',
                                  position: 'relative',
                                  overflow: 'hidden',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}>
                                  {(() => {
                                    // For thumbnails, extract file ID from CDN URL and use w400
                                    let thumbnailUrl = null;
                                    if (mediaPath.includes('lh3.googleusercontent.com')) {
                                      const cdnMatch = mediaPath.match(/\/d\/([a-zA-Z0-9_-]+)=/);
                                      if (cdnMatch && cdnMatch[1]) {
                                        thumbnailUrl = `https://lh3.googleusercontent.com/d/${cdnMatch[1]}=w400`;
                                      }
                                    } else {
                                      // For non-CDN URLs, use getGoogleDriveCDNUrl to get thumbnail
                                      thumbnailUrl = getGoogleDriveCDNUrl(mediaPath, 'w400');
                                    }
                                    
                                    return thumbnailUrl ? (
                                      <img
                                        src={thumbnailUrl}
                                        alt={`${selectedProduct.NAME} - Thumbnail ${index + 1}`}
                                        style={{
                                          width: '100%',
                                          height: '100%',
                                          objectFit: 'cover',
                                          borderRadius: '4px'
                                        }}
                                        onError={(e) => {
                                          // Fallback to ProductImage component if CDN fails
                                          console.warn('Thumbnail CDN failed, using ProductImage fallback');
                                          e.target.style.display = 'none';
                                        }}
                                      />
                                    ) : (
                                      <ProductImage
                                        imagePath={mediaPath}
                                        itemName={`${selectedProduct.NAME} - Image ${index + 1}`}
                                        googleToken={googleToken}
                                        imageUrlCacheRef={imageUrlCache}
                                        canShowImage={canShowImage}
                                        useFirstImageAsThumbnail={true}
                                      />
                                    );
                                  })()}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Right Side - Product Details */}
              <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: 0,
                padding: isMobile ? '20px' : '32px',
                overflowY: 'auto',
                maxHeight: isMobile ? '50vh' : '90vh'
              }}>
                {/* Product Name */}
                <div style={{ marginBottom: '16px' }}>
                  <h1 style={{
                    margin: 0,
                    fontSize: isMobile ? '22px' : '32px',
                    fontWeight: '600',
                    color: '#212121',
                    lineHeight: 1.4,
                    paddingRight: isMobile ? '32px' : '0',
                    letterSpacing: '-0.5px'
                  }}>
                    {selectedProduct.NAME}
                  </h1>
                </div>

                {/* Price Section - Amazon/Flipkart Style */}
                {canShowRateAmtColumn && (
                  <div style={{
                    marginBottom: '24px',
                    paddingBottom: '20px',
                    borderBottom: '1px solid #e0e0e0'
                  }}>
                  <div style={{
                    display: 'flex',
                      alignItems: 'baseline',
                      gap: '12px',
                      flexWrap: 'wrap'
                    }}>
                      <div style={{
                        fontSize: isMobile ? '28px' : '36px',
                      fontWeight: '500',
                        color: '#212121',
                        lineHeight: 1
                    }}>
                        ₹{computeRateForItem(selectedProduct).toFixed(2)}
                  </div>
                      {selectedProduct.STDPRICE && parseFloat(selectedProduct.STDPRICE) > computeRateForItem(selectedProduct) && (
                        <>
                  <div style={{
                            fontSize: isMobile ? '18px' : '22px',
                            fontWeight: '400',
                            color: '#878787',
                            textDecoration: 'line-through'
                          }}>
                            ₹{parseFloat(selectedProduct.STDPRICE || 0).toFixed(2)}
                          </div>
                    <div style={{
                            fontSize: isMobile ? '14px' : '16px',
                            fontWeight: '500',
                            color: '#388e3c',
                            backgroundColor: '#e8f5e9',
                            padding: '2px 8px',
                            borderRadius: '4px'
                          }}>
                            {Math.round(((parseFloat(selectedProduct.STDPRICE) - computeRateForItem(selectedProduct)) / parseFloat(selectedProduct.STDPRICE)) * 100)}% off
                    </div>
                        </>
                      )}
                    </div>
                    {selectedProduct.STDPRICE && parseFloat(selectedProduct.STDPRICE) > computeRateForItem(selectedProduct) && (
                    <div style={{
                        fontSize: isMobile ? '12px' : '14px',
                        color: '#388e3c',
                        fontWeight: '500',
                        marginTop: '8px'
                      }}>
                        You save ₹{(parseFloat(selectedProduct.STDPRICE) - computeRateForItem(selectedProduct)).toFixed(2)}
                    </div>
                    )}
                  </div>
                )}

                {/* Stock Information - Amazon/Flipkart Style */}
                {canShowClosingStock && (
                  <div style={{
                    marginBottom: '20px',
                    paddingBottom: '20px',
                    borderBottom: '1px solid #e0e0e0'
                  }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                      gap: '8px',
                      marginBottom: '8px'
                  }}>
                    <span style={{
                        fontSize: isMobile ? '14px' : '16px',
                        fontWeight: '500',
                        color: '#212121'
                      }}>
                        Availability:
                    </span>
                    <span
                      style={{
                          fontSize: isMobile ? '14px' : '16px',
                          fontWeight: '600',
                          color: (selectedProduct.CLOSINGSTOCK || 0) > 0 ? '#388e3c' : '#d32f2f',
                        cursor: canShowStockBreakdown ? 'pointer' : 'default',
                        textDecoration: canShowStockBreakdown ? 'underline' : 'none'
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (canShowStockBreakdown) {
                          handleStockFieldClick(selectedProduct.NAME);
                        }
                      }}
                    >
                      {(() => {
                        const stockValue = selectedProduct.CLOSINGSTOCK || 0;
                        if (canShowClosingStockYesNo) {
                            return stockValue > 0 ? '✓ In Stock' : '✗ Out of Stock';
                        }
                          return stockValue > 0 ? `✓ ${stockValue} units available` : '✗ Out of Stock';
                      })()}
                    </span>
                  </div>
                    {(selectedProduct.CLOSINGSTOCK || 0) > 0 && (
                  <div style={{
                      fontSize: isMobile ? '12px' : '14px',
                        color: '#878787',
                        fontStyle: 'italic'
                      }}>
                        Usually dispatched within 1-2 business days
                      </div>
                    )}
                  </div>
                )}

                {/* Narration/Description */}
                {selectedProduct.DESCRIPTION && (
                  <div style={{
                    marginBottom: '24px',
                    paddingBottom: '20px',
                    borderBottom: '1px solid #e0e0e0'
                  }}>
                    <div style={{
                      fontSize: isMobile ? '16px' : '18px',
                      fontWeight: '600',
                      color: '#212121',
                      marginBottom: '12px'
                    }}>
                      Narration
                    </div>
                    <div style={{
                      fontSize: isMobile ? '14px' : '16px',
                      fontWeight: '400',
                      color: '#374151',
                      lineHeight: 1.6,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word'
                    }}>
                      {selectedProduct.DESCRIPTION}
                    </div>
                  </div>
                )}

                {/* Add to Cart Section - Amazon/Flipkart Style */}
                <div style={{
                  marginTop: 'auto',
                  paddingTop: '24px',
                  borderTop: '1px solid #e0e0e0',
                  position: 'sticky',
                  bottom: 0,
                  backgroundColor: 'white',
                  zIndex: 10
                }}>
                  {(() => {
                    const cartItem = cart.find(c => c.NAME === selectedProduct.NAME);
                    if (cartItem) {
                      return (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px'
                        }}>
                          <div style={{
                            flex: 1,
                            height: isMobile ? '48px' : '56px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            background: '#fff3e0',
                            border: '1px solid #ff6f00',
                            borderRadius: '4px',
                            padding: '0 16px',
                            gap: '12px'
                          }}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                updateQuantity(selectedProduct.NAME, cartItem.quantity - 1);
                                if (cartItem.quantity === 1) {
                                  setShowProductModal(false);
                                }
                              }}
                              style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '8px',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#374151',
                                fontSize: isMobile ? '16px' : '18px',
                                transition: 'all 0.2s ease',
                                minWidth: '32px',
                                minHeight: '32px'
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
                              fontSize: isMobile ? '18px' : '22px',
                              fontWeight: '700',
                              color: '#374151',
                              minWidth: '40px',
                              textAlign: 'center'
                            }}>
                              {cartItem.quantity}
                            </span>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                updateQuantity(selectedProduct.NAME, cartItem.quantity + 1);
                              }}
                              style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '8px',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#374151',
                                fontSize: isMobile ? '18px' : '20px',
                                fontWeight: 'bold',
                                transition: 'all 0.2s ease',
                                minWidth: '32px',
                                minHeight: '32px'
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
                        </div>
                      );
                    } else {
                      return (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            addToCart(selectedProduct);
                          }}
                          style={{
                            width: '100%',
                            height: isMobile ? '48px' : '56px',
                            padding: '0 24px',
                            background: '#ff6f00',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            fontWeight: '500',
                            fontSize: isMobile ? '16px' : '18px',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '10px',
                            boxShadow: '0 2px 4px rgba(255, 111, 0, 0.3)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#ff8f00';
                            e.currentTarget.style.boxShadow = '0 4px 8px rgba(255, 111, 0, 0.4)';
                            e.currentTarget.style.transform = 'translateY(-1px)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = '#ff6f00';
                            e.currentTarget.style.boxShadow = '0 2px 4px rgba(255, 111, 0, 0.3)';
                            e.currentTarget.style.transform = 'translateY(0)';
                          }}
                        >
                          <span className="material-icons" style={{ fontSize: isMobile ? '20px' : '24px' }}>shopping_cart</span>
                          Add to Cart
                        </button>
                      );
                    }
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Product Image Upload Modal */}
      {showImageUploadModal && (
        <div 
          style={{
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
          }}
          onClick={(e) => {
            // Prevent closing during save
            if (!imageUploadLoading && e.target === e.currentTarget) {
              setShowImageUploadModal(false);
              setSelectedProductForImage(null);
              setImageList([]);
              setNewImageLink('');
              setImageUploadError('');
              setImageUploadSuccess(false);
            }
          }}
        >
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: isMobile ? '20px' : '28px',
            maxWidth: isMobile ? '95%' : '700px',
            width: isMobile ? '95%' : '90%',
            maxHeight: '85vh',
            overflow: 'auto',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)',
            position: 'relative'
          }}>
            {/* Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: isMobile ? '20px' : '24px',
              paddingBottom: isMobile ? '16px' : '20px',
              borderBottom: '2px solid #e5e7eb'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                <span className="material-icons" style={{ 
                  fontSize: isMobile ? '24px' : '28px', 
                  color: '#3b82f6' 
                }}>
                  collections
                </span>
                <div>
                  <h3 style={{
                    margin: 0,
                    fontSize: isMobile ? '16px' : '20px',
                    fontWeight: '700',
                    color: '#1f2937',
                    lineHeight: '1.2'
                  }}>
                    Add Media for the Product
                  </h3>
                  <p style={{
                    margin: '4px 0 0 0',
                    fontSize: isMobile ? '12px' : '14px',
                    color: '#6b7280',
                    fontWeight: '500'
                  }}>
                    {selectedProductForImage?.NAME || 'Product Name'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  if (!imageUploadLoading) {
                    setShowImageUploadModal(false);
                    setSelectedProductForImage(null);
                    setImageList([]);
                    setNewImageLink('');
                    setImageUploadError('');
                    setImageUploadSuccess(false);
                  }
                }}
                disabled={imageUploadLoading}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: isMobile ? '22px' : '26px',
                  cursor: imageUploadLoading ? 'not-allowed' : 'pointer',
                  color: imageUploadLoading ? '#d1d5db' : '#6b7280',
                  padding: '6px',
                  minWidth: isMobile ? '36px' : '40px',
                  minHeight: isMobile ? '36px' : '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: imageUploadLoading ? 0.5 : 1,
                  borderRadius: '8px',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  if (!imageUploadLoading) {
                    e.currentTarget.style.backgroundColor = '#f3f4f6';
                    e.currentTarget.style.color = '#374151';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!imageUploadLoading) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = '#6b7280';
                  }
                }}
                title="Close"
              >
                ×
              </button>
            </div>

            {/* Modal Content */}
            <div style={{
              padding: isMobile ? '12px 0' : '16px 0'
            }}>
              {/* Success Message */}
              {imageUploadSuccess && (
                <div style={{
                  padding: '12px 16px',
                  backgroundColor: '#d1fae5',
                  border: '1px solid #10b981',
                  borderRadius: '8px',
                  marginBottom: '16px',
                  color: '#065f46',
                  fontSize: isMobile ? '13px' : '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span className="material-icons" style={{ fontSize: '18px' }}>check_circle</span>
                  Media saved successfully!
                </div>
              )}

              {/* Error Message */}
              {imageUploadError && (
                <div style={{
                  padding: '12px 16px',
                  backgroundColor: '#fee2e2',
                  border: '1px solid #ef4444',
                  borderRadius: '8px',
                  marginBottom: '16px',
                  color: '#991b1b',
                  fontSize: isMobile ? '13px' : '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span className="material-icons" style={{ fontSize: '18px' }}>error</span>
                  {imageUploadError}
                </div>
              )}

              {/* Existing Media Section */}
              <div style={{ marginBottom: isMobile ? '24px' : '28px' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '16px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="material-icons" style={{ 
                      fontSize: '20px', 
                      color: '#3b82f6' 
                    }}>
                      photo_library
                    </span>
                    <h4 style={{
                      margin: 0,
                      fontSize: isMobile ? '15px' : '17px',
                      fontWeight: '600',
                      color: '#1f2937'
                    }}>
                      Existing Media
                    </h4>
                  </div>
                  {imageList.length > 0 && (
                    <span style={{
                      padding: '4px 12px',
                      backgroundColor: '#e0f2fe',
                      color: '#0369a1',
                      borderRadius: '12px',
                      fontSize: isMobile ? '11px' : '12px',
                      fontWeight: '600'
                    }}>
                      {imageList.length} {imageList.length === 1 ? 'item' : 'items'}
                    </span>
                  )}
                </div>
                
                {imageList.length === 0 ? (
                  <div style={{
                    padding: isMobile ? '32px 24px' : '40px 32px',
                    textAlign: 'center',
                    color: '#6b7280',
                    fontSize: isMobile ? '13px' : '14px',
                    backgroundColor: '#f9fafb',
                    borderRadius: '12px',
                    border: '2px dashed #d1d5db'
                  }}>
                    <span className="material-icons" style={{ 
                      fontSize: '48px', 
                      color: '#cbd5e1',
                      display: 'block',
                      marginBottom: '12px'
                    }}>
                      image_not_supported
                    </span>
                    <p style={{ margin: 0, fontWeight: '500' }}>No media added yet</p>
                    <p style={{ margin: '4px 0 0 0', fontSize: isMobile ? '12px' : '13px', color: '#9ca3af' }}>
                      Add images or videos using the options below
                    </p>
                  </div>
                ) : (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
                    gap: '12px',
                    maxHeight: isMobile ? '300px' : '400px',
                    overflowY: 'auto',
                    padding: '4px'
                  }}>
                    {imageList.map((imagePath, index) => {
                      return (
                        <div
                          key={index}
                          style={{
                            position: 'relative',
                            aspectRatio: '1 / 1',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            backgroundColor: '#f3f4f6',
                            border: '1px solid #e5e7eb',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'scale(1.02)';
                            e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.1)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                            e.currentTarget.style.boxShadow = 'none';
                          }}
                        >
                          {/* Delete Button */}
                          <button
                            onClick={() => handleDeleteImage(index)}
                            style={{
                              position: 'absolute',
                              top: '4px',
                              right: '4px',
                              background: 'rgba(239, 68, 68, 0.9)',
                              border: 'none',
                              borderRadius: '50%',
                              width: '28px',
                              height: '28px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              color: 'white',
                              fontSize: '18px',
                              zIndex: 10,
                              transition: 'all 0.2s ease',
                              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'rgba(220, 38, 38, 1)';
                              e.currentTarget.style.transform = 'scale(1.1)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.9)';
                              e.currentTarget.style.transform = 'scale(1)';
                            }}
                            title={`Delete ${imagePath && (imagePath.includes('/preview') || imagePath.includes('video')) ? 'video' : 'image'}`}
                          >
                            ×
                          </button>

                          {/* Media - Using ProductImage or ProductVideo component based on type */}
                          <div style={{
                            width: '100%',
                            height: '100%',
                            position: 'relative',
                            overflow: 'hidden'
                          }}>
                            {imagePath && (imagePath.includes('/preview') || imagePath.includes('video')) ? (
                              // Video preview URL - use ProductVideo component
                              <ProductVideo
                                videoPath={imagePath}
                                itemName={selectedProductForImage?.NAME || 'Product'}
                                googleToken={googleToken}
                                videoUrlCacheRef={videoUrlCache}
                                canShowImage={canShowImage}
                                isThumbnail={false}
                              />
                            ) : (
                              // Image - use ProductImage component
                            <ProductImage
                              imagePath={imagePath}
                              itemName={selectedProductForImage?.NAME || 'Product'}
                              googleToken={googleToken}
                              imageUrlCacheRef={imageUrlCache}
                              canShowImage={canShowImage}
                              useFirstImageAsThumbnail={false}
                            />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Add Media Section */}
              <div style={{
                padding: isMobile ? '20px' : '24px',
                backgroundColor: '#f8fafc',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                marginBottom: isMobile ? '24px' : '28px',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '16px'
                }}>
                  <span className="material-icons" style={{ 
                    fontSize: '20px', 
                    color: '#3b82f6' 
                  }}>
                    add_photo_alternate
                  </span>
                  <h4 style={{
                    margin: 0,
                    fontSize: isMobile ? '15px' : '17px',
                    fontWeight: '600',
                    color: '#1f2937'
                  }}>
                    Add New {mediaType === 'image' ? 'Image' : 'Video'}
                  </h4>
                </div>

                {/* Media Type Toggle (Image/Video) */}
                <div style={{
                  display: 'flex',
                  gap: '8px',
                  marginBottom: '12px',
                  backgroundColor: '#ffffff',
                  padding: '4px',
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb'
                }}>
                  <button
                    onClick={() => setMediaType('image')}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      background: mediaType === 'image' ? '#3b82f6' : 'transparent',
                      color: mediaType === 'image' ? 'white' : '#6b7280',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: isMobile ? '12px' : '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    <span className="material-icons" style={{ fontSize: '18px' }}>image</span>
                    Image
                  </button>
                  <button
                    onClick={() => setMediaType('video')}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      background: mediaType === 'video' ? '#3b82f6' : 'transparent',
                      color: mediaType === 'video' ? 'white' : '#6b7280',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: isMobile ? '12px' : '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    <span className="material-icons" style={{ fontSize: '18px' }}>videocam</span>
                    Video
                  </button>
                </div>

                {/* Method Toggle */}
                <div style={{
                  display: 'flex',
                  gap: '8px',
                  marginBottom: '12px',
                  backgroundColor: '#ffffff',
                  padding: '4px',
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb'
                }}>
                  <button
                    onClick={() => setImageAddMethod('link')}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      background: imageAddMethod === 'link' ? '#3b82f6' : 'transparent',
                      color: imageAddMethod === 'link' ? 'white' : '#6b7280',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: isMobile ? '12px' : '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    Enter Link
                  </button>
                  <button
                    onClick={() => setImageAddMethod('picker')}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      background: imageAddMethod === 'picker' ? '#3b82f6' : 'transparent',
                      color: imageAddMethod === 'picker' ? 'white' : '#6b7280',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: isMobile ? '12px' : '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    Pick from Drive
                  </button>
                </div>

                {/* Link Input Method */}
                {imageAddMethod === 'link' && (
                  <div style={{
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    gap: '8px'
                  }}>
                    <input
                      type="text"
                      value={newImageLink}
                      onChange={(e) => {
                        setNewImageLink(e.target.value);
                        setImageUploadError('');
                      }}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleAddImage();
                        }
                      }}
                      placeholder={`Enter Google Drive ${mediaType} link...`}
                      style={{
                        flex: 1,
                        padding: isMobile ? '10px 12px' : '12px 16px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: isMobile ? '13px' : '14px',
                        outline: 'none',
                        transition: 'border-color 0.2s ease'
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = '#3b82f6';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = '#d1d5db';
                      }}
                    />
                    <button
                      onClick={handleAddImage}
                      disabled={imageUploadLoading}
                      style={{
                        padding: isMobile ? '10px 16px' : '12px 20px',
                        background: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: isMobile ? '13px' : '14px',
                        fontWeight: '600',
                        cursor: imageUploadLoading ? 'not-allowed' : 'pointer',
                        opacity: imageUploadLoading ? 0.6 : 1,
                        transition: 'all 0.2s ease',
                        whiteSpace: 'nowrap',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                      onMouseEnter={(e) => {
                        if (!imageUploadLoading) {
                          e.currentTarget.style.transform = 'translateY(-1px)';
                          e.currentTarget.style.boxShadow = '0 4px 8px rgba(59, 130, 246, 0.3)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <span className="material-icons" style={{ fontSize: '18px' }}>add</span>
                      Add
                    </button>
                  </div>
                )}

                {/* Google Drive Picker Method */}
                {imageAddMethod === 'picker' && (
                  <button
                    onClick={handleOpenGoogleDrivePicker}
                    disabled={imageUploadLoading || isLoadingGooglePicker}
                    style={{
                      width: '100%',
                      padding: isMobile ? '12px 16px' : '14px 20px',
                      background: isLoadingGooglePicker 
                        ? '#9ca3af' 
                        : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: isMobile ? '13px' : '14px',
                      fontWeight: '600',
                      cursor: (imageUploadLoading || isLoadingGooglePicker) ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                    onMouseEnter={(e) => {
                      if (!imageUploadLoading && !isLoadingGooglePicker) {
                        e.currentTarget.style.transform = 'translateY(-1px)';
                        e.currentTarget.style.boxShadow = '0 4px 8px rgba(16, 185, 129, 0.3)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    {isLoadingGooglePicker ? (
                      <>
                        <span className="material-icons" style={{ fontSize: '18px', animation: 'spin 1s linear infinite' }}>refresh</span>
                        Opening Google Drive...
                      </>
                    ) : (
                      <>
                        <span className="material-icons" style={{ fontSize: '18px' }}>cloud_upload</span>
                        Pick from Google Drive
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Action Buttons */}
              <div style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'flex-end',
                paddingTop: '16px',
                borderTop: '1px solid #e5e7eb'
              }}>
                <button
                  onClick={() => {
                    setShowImageUploadModal(false);
                    setSelectedProductForImage(null);
                    setImageList([]);
                    setNewImageLink('');
                    setImageUploadError('');
                    setImageUploadSuccess(false);
                  }}
                  disabled={imageUploadLoading}
                  style={{
                    padding: isMobile ? '10px 16px' : '12px 20px',
                    background: 'white',
                    color: '#374151',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: isMobile ? '13px' : '14px',
                    fontWeight: '600',
                    cursor: imageUploadLoading ? 'not-allowed' : 'pointer',
                    opacity: imageUploadLoading ? 0.6 : 1,
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (!imageUploadLoading) {
                      e.currentTarget.style.backgroundColor = '#f9fafb';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'white';
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveImages}
                  disabled={imageUploadLoading}
                  style={{
                    padding: isMobile ? '10px 16px' : '12px 20px',
                    background: imageUploadLoading 
                      ? '#9ca3af' 
                      : 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: isMobile ? '13px' : '14px',
                    fontWeight: '600',
                    cursor: imageUploadLoading ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    minWidth: isMobile ? '100px' : '120px',
                    justifyContent: 'center'
                  }}
                  onMouseEnter={(e) => {
                    if (!imageUploadLoading) {
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 4px 8px rgba(5, 150, 105, 0.3)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  {imageUploadLoading ? (
                    <>
                      <span className="material-icons" style={{ fontSize: '18px', animation: 'spin 1s linear infinite' }}>refresh</span>
                      Saving...
                    </>
                  ) : (
                    <>
                      <span className="material-icons" style={{ fontSize: '18px' }}>save</span>
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PlaceOrder_ECommerce;
