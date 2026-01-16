import React, { useState, useEffect, useMemo } from 'react';
import { apiGet, apiPost, apiPut } from '../utils/apiUtils';
import { checkUserLimit, checkSubscriptionStatus } from '../utils/subscriptionUtils';
import { useNavigate } from 'react-router-dom';
import PurchaseUsersModal from './components/PurchaseUsersModal';

function CreateAccess() {
  const navigate = useNavigate();
  const [connections, setConnections] = useState([]);
  const [internalUsers, setInternalUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [deletingEmail, setDeletingEmail] = useState('');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editSelectedGuids, setEditSelectedGuids] = useState([]);
  const [editCompanySettings, setEditCompanySettings] = useState({});
  
  // Group Assignment Modal States
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [selectedCompanyForGroups, setSelectedCompanyForGroups] = useState(null);
  const [ledgerGroups, setLedgerGroups] = useState([]);
  const [stockGroups, setStockGroups] = useState([]);
  const [stockCategories, setStockCategories] = useState([]);
  const [selectedLedgerGroups, setSelectedLedgerGroups] = useState([]);
  const [selectedStockGroups, setSelectedStockGroups] = useState([]);
  const [selectedStockCategories, setSelectedStockCategories] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupsSaving, setGroupsSaving] = useState(false);
  const [ledgerSearchTerm, setLedgerSearchTerm] = useState('');
  const [stockSearchTerm, setStockSearchTerm] = useState('');
  const [stockCategorySearchTerm, setStockCategorySearchTerm] = useState('');
  const [voucherTypes, setVoucherTypes] = useState([]);
  const [selectedVoucherTypes, setSelectedVoucherTypes] = useState([]);
  const [voucherTypeSearchTerm, setVoucherTypeSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('ledger'); // 'ledger', 'stock', 'stockcategory', or 'vouchertype'
  const [userManagementTab, setUserManagementTab] = useState('form'); // 'form', 'users', 'routes'
  const [form, setForm] = useState({ 
    roleId: '', 
    companyGuids: [], 
    userName: '', 
    email: '', 
    mobile: '',
    isExternalUser: false
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [tableError, setTableError] = useState('');
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [subscriptionInfo, setSubscriptionInfo] = useState({ total_user_limit: 0 });
  const [userCountInfo, setUserCountInfo] = useState({ count: 0 });
  const token = sessionStorage.getItem('token');
  
  // Routes state
  const [routes, setRoutes] = useState([]);
  const [routesLoading, setRoutesLoading] = useState(false);
  const [routeSearchTerm, setRouteSearchTerm] = useState('');
  const [assignmentsUpdateTrigger, setAssignmentsUpdateTrigger] = useState(0);
  
  // Create Route Modal State
  const [showCreateRouteModal, setShowCreateRouteModal] = useState(false);
  const [routeName, setRouteName] = useState('');
  const [routeDescription, setRouteDescription] = useState('');
  const [pincodeInput, setPincodeInput] = useState('');
  const [selectedPincode, setSelectedPincode] = useState('');
  const [customerSearchInput, setCustomerSearchInput] = useState('');
  const [filterMode, setFilterMode] = useState('keyword'); // 'pincode' or 'keyword'
  const [selectedCustomers, setSelectedCustomers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [customerCoordinates, setCustomerCoordinates] = useState({});
  const [isSavingRoute, setIsSavingRoute] = useState(false);
  const [selectedCompanies, setSelectedCompanies] = useState([]);
  
  // Edit Route Modal State
  const [showEditRouteModal, setShowEditRouteModal] = useState(false);
  const [editingRoute, setEditingRoute] = useState(null);
  const [editRouteName, setEditRouteName] = useState('');
  const [editRouteDescription, setEditRouteDescription] = useState('');
  const [editPincodeInput, setEditPincodeInput] = useState('');
  const [editSelectedPincode, setEditSelectedPincode] = useState('');
  const [editCustomerSearchInput, setEditCustomerSearchInput] = useState('');
  const [editFilterMode, setEditFilterMode] = useState('keyword'); // 'pincode' or 'keyword'
  const [editSelectedCustomers, setEditSelectedCustomers] = useState([]);
  const [editCustomerCoordinates, setEditCustomerCoordinates] = useState({});
  const [isUpdatingRoute, setIsUpdatingRoute] = useState(false);
  const [editSelectedCompanies, setEditSelectedCompanies] = useState([]);

  // Edit Customer Coordinates Modal State
  const [showEditCustomerModal, setShowEditCustomerModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [editLatitude, setEditLatitude] = useState('');
  const [editLongitude, setEditLongitude] = useState('');
  const [isGeocoding, setIsGeocoding] = useState(false);
  
  // Assign Route Modal State
  const [showAssignRouteModal, setShowAssignRouteModal] = useState(false);
  const [assigningUser, setAssigningUser] = useState(null);
  const [selectedRouteForAssign, setSelectedRouteForAssign] = useState(null);
  const [salespersonEmail, setSalespersonEmail] = useState('');
  const [selectedDaysOfWeek, setSelectedDaysOfWeek] = useState([]); // Array to support multiple day selection
  const [isRecurring, setIsRecurring] = useState(false);
  const [isSavingAssignment, setIsSavingAssignment] = useState(false);

  // Route Actions Modal State
  const [showRouteActionsModal, setShowRouteActionsModal] = useState(false);
  const [routeActionsUser, setRouteActionsUser] = useState(null);
  const [showAssignedRoutes, setShowAssignedRoutes] = useState(false);

  // Fetch available connections (API call for fresh data - always overwrites cache)
  const fetchConnections = async () => {
    setLoading(true);
    setTableError('');
    try {
      // Always make API call to get fresh data and overwrite cache
      const cacheBuster = Date.now();
      const data = await apiGet(`/api/tally/user-connections?ts=${cacheBuster}`);
      
      if (data && data.success) {
        const created = Array.isArray(data.createdByMe) ? data.createdByMe : [];
        const shared = Array.isArray(data.sharedWithMe) ? data.sharedWithMe : [];
        const allApiConnections = [...created, ...shared];
        
        // Filter for companies with Full Access (same as Share Access)
        const filteredConnections = allApiConnections.filter(conn => 
          conn.status === 'Connected' && conn.access_type === 'Full Access'
        );
        
        // Always update connections state with fresh data
        setConnections(filteredConnections);
        
        // Always overwrite session storage with fresh API data
        sessionStorage.setItem('allConnections', JSON.stringify(allApiConnections));
        
        // Dispatch custom event to notify other components
        window.dispatchEvent(new CustomEvent('connectionsUpdated'));
      } else {
        setTableError('Failed to fetch companies from server');
      }
    } catch (err) {
      setTableError('Error fetching companies from server');
      console.error('Error fetching connections:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch internal users
  const fetchInternalUsers = async () => {
    setUsersLoading(true);
    try {
      const cacheBuster = Date.now();
      const data = await apiGet(`/api/tally/internal-users?ts=${cacheBuster}`);
      
      if (data && data.users) {
        setInternalUsers(data.users);
      }
    } catch (err) {
      console.error('Error fetching internal users:', err);
    } finally {
      setUsersLoading(false);
    }
  };

  // Fetch available roles
  const fetchRoles = async () => {
    setRolesLoading(true);
    try {
      const data = await apiGet('/api/access-control/roles/all');
      
      if (data && data.roles) {
        setRoles(data.roles);
      }
    } catch (err) {
      console.error('Error fetching roles:', err);
      // Mock data fallback
      setRoles([
        { id: 1, display_name: 'Admin', description: 'Full system access' },
        { id: 2, display_name: 'Manager', description: 'Management level access' },
        { id: 3, display_name: 'User', description: 'Standard user access' },
        { id: 4, display_name: 'Viewer', description: 'Read-only access' }
      ]);
    } finally {
      setRolesLoading(false);
    }
  };

  // Fetch groups for a specific company
  const fetchCompanyGroups = async (companyGuid) => {
    setGroupsLoading(true);
    try {
      // Find the company details to get tallyloc_id
      const company = connections.find(conn => conn.guid === companyGuid);
      console.log('🔍 Looking for company with GUID:', companyGuid);
      console.log('🔍 Available connections:', connections);
      console.log('🔍 Found company:', company);
      
      if (!company) {
        console.error('❌ Company not found for GUID:', companyGuid);
        setLedgerGroups([]);
        setStockGroups([]);
        return;
      }

      // Debug company properties
      console.log('🔍 Company properties:', Object.keys(company));
      console.log('🔍 Company.company:', company.company);
      console.log('🔍 Company.tallyloc_id:', company.tallyloc_id);

      // Use the correct company field
      const companyName = company.company || 'Unknown Company';

      const payload = {
        tallyloc_id: company.tallyloc_id,
        company: companyName,
        guid: companyGuid
      };
      
      const cacheBuster = Date.now();
      console.log('📤 API Payload:', payload);
      console.log('📤 Cache Buster (ts):', cacheBuster);

      // Fetch ledger groups
      console.log('📡 Fetching ledger groups...');
      const ledgerResponse = await apiPost(`/api/tally/ledgergroups?ts=${cacheBuster}`, payload);
      console.log('📡 Ledger groups response:', ledgerResponse);
      
      let ledgerGroupsData = [];
      if (ledgerResponse && ledgerResponse.ledgerGroups) {
        ledgerGroupsData = ledgerResponse.ledgerGroups.map(group => ({
          id: group.MASTERID,
          name: group.NAME,
          description: `Ledger Group - ${group.NAME}`
        }));
        console.log('✅ Processed ledger groups:', ledgerGroupsData);
      } else {
        console.log('⚠️ No ledger groups in response or invalid response structure');
      }

      // Fetch stock groups
      console.log('📡 Fetching stock groups...');
      const stockResponse = await apiPost(`/api/tally/stockgroups?ts=${cacheBuster}`, payload);
      console.log('📡 Stock groups response:', stockResponse);
      
      let stockGroupsData = [];
      if (stockResponse && stockResponse.stockGroups) {
        stockGroupsData = stockResponse.stockGroups.map(group => ({
          id: group.MASTERID,
          name: group.NAME,
          description: `Stock Group - ${group.NAME}`
        }));
        console.log('✅ Processed stock groups:', stockGroupsData);
      } else {
        console.log('⚠️ No stock groups in response or invalid response structure');
      }

      // Fetch stock categories
      console.log('📡 Fetching stock categories...');
      const stockCategoryResponse = await apiPost(`/api/tally/stockcategories?ts=${cacheBuster}`, payload);
      console.log('📡 Stock categories response:', stockCategoryResponse);
      
      let stockCategoriesData = [];
      if (stockCategoryResponse && stockCategoryResponse.stockCategories) {
        stockCategoriesData = stockCategoryResponse.stockCategories.map(category => ({
          id: category.MASTERID,
          name: category.NAME,
          description: `Stock Category - ${category.NAME}`
        }));
        console.log('✅ Processed stock categories:', stockCategoriesData);
      } else {
        console.log('⚠️ No stock categories in response or invalid response structure');
      }

      // Fetch voucher types
      console.log('📡 Fetching voucher types...');
      const voucherTypeResponse = await apiPost(`/api/tally/vchauth/vouchertype?ts=${cacheBuster}`, payload);
      console.log('📡 Voucher types response:', voucherTypeResponse);
      
      let voucherTypesData = [];
      if (voucherTypeResponse && voucherTypeResponse.voucherTypes) {
        voucherTypesData = voucherTypeResponse.voucherTypes.map(voucherType => ({
          id: voucherType.MASTERID,
          name: voucherType.NAME,
          description: `Voucher Type - ${voucherType.NAME}`
        }));
        console.log('✅ Processed voucher types:', voucherTypesData);
      } else {
        console.log('⚠️ No voucher types in response or invalid response structure');
      }

      // If no data received, add some mock data for testing
      if (ledgerGroupsData.length === 0) {
        console.log('🧪 Using mock ledger groups for testing');
        ledgerGroupsData = [
          { id: '7', name: 'Branch / Divisions', description: 'Ledger Group - Branch / Divisions' },
          { id: '16', name: 'Sundry Creditors', description: 'Ledger Group - Sundry Creditors' },
          { id: '20', name: 'Sundry Debtors', description: 'Ledger Group - Sundry Debtors' }
        ];
      }

      if (stockGroupsData.length === 0) {
        console.log('🧪 Using mock stock groups for testing');
        stockGroupsData = [
          { id: '219', name: 'Group A', description: 'Stock Group - Group A' },
          { id: '220', name: 'Group B', description: 'Stock Group - Group B' },
          { id: '222', name: 'Group D', description: 'Stock Group - Group D' }
        ];
      }

      if (stockCategoriesData.length === 0) {
        console.log('🧪 Using mock stock categories for testing');
        stockCategoriesData = [
          { id: '235', name: 'Category 2', description: 'Stock Category - Category 2' },
          { id: '234', name: 'Category 1', description: 'Stock Category - Category 1' }
        ];
      }

      if (voucherTypesData.length === 0) {
        console.log('🧪 Using mock voucher types for testing');
        voucherTypesData = [
          { id: '1', name: 'Sales', description: 'Voucher Type - Sales' },
          { id: '2', name: 'Purchase', description: 'Voucher Type - Purchase' },
          { id: '3', name: 'Payment', description: 'Voucher Type - Payment' }
        ];
      }

      setLedgerGroups(ledgerGroupsData);
      setStockGroups(stockGroupsData);
      setStockCategories(stockCategoriesData);
      setVoucherTypes(voucherTypesData);
      
      console.log('🎯 Final state - Ledger groups:', ledgerGroupsData.length);
      console.log('🎯 Final state - Stock groups:', stockGroupsData.length);
      console.log('🎯 Final state - Stock categories:', stockCategoriesData.length);
      console.log('🎯 Final state - Voucher types:', voucherTypesData.length);

    } catch (error) {
      console.error('❌ Error fetching groups:', error);
      setLedgerGroups([]);
      setStockGroups([]);
      setStockCategories([]);
      setVoucherTypes([]);
    } finally {
      setGroupsLoading(false);
    }
  };

  // Fetch existing group assignments for user-company
  const fetchUserCompanyGroups = async (userId, company) => {
    try {
      const payload = {
        userid: userId,
        tallyloc_id: company.tallyloc_id,
        company_name: company.company,
        guid: company.guid
      };

      console.log('📥 Fetching existing group assignments...');
      console.log('📥 Payload:', payload);

      const cacheBuster = Date.now();
      const data = await apiPost(`/api/tally/user-groups/get?ts=${cacheBuster}`, payload);
      
      console.log('📥 Existing groups response:', data);

      if (data && data.success && data.data && data.data.groups) {
        // Extract masterid values from the response for each group type
        const selectedLedgerGroupIds = (data.data.groups.ledger_groups || []).map(group => group.masterid);
        const selectedStockGroupIds = (data.data.groups.stock_groups || []).map(group => group.masterid);
        const selectedStockCategoryIds = (data.data.groups.stock_categories || []).map(category => category.masterid);
        const selectedVoucherTypeIds = (data.data.groups.voucher_types || []).map(voucherType => voucherType.masterid);
        
        console.log('📥 Setting selected ledger groups:', selectedLedgerGroupIds);
        console.log('📥 Setting selected stock groups:', selectedStockGroupIds);
        console.log('📥 Setting selected stock categories:', selectedStockCategoryIds);
        console.log('📥 Setting selected voucher types:', selectedVoucherTypeIds);
        
        setSelectedLedgerGroups(selectedLedgerGroupIds);
        setSelectedStockGroups(selectedStockGroupIds);
        setSelectedStockCategories(selectedStockCategoryIds);
        setSelectedVoucherTypes(selectedVoucherTypeIds);
      } else {
        console.log('📥 No existing groups found or invalid response');
        setSelectedLedgerGroups([]);
        setSelectedStockGroups([]);
        setSelectedStockCategories([]);
        setSelectedVoucherTypes([]);
      }
    } catch (error) {
      console.error('❌ Error fetching user company groups:', error);
      setSelectedLedgerGroups([]);
      setSelectedStockGroups([]);
      setSelectedStockCategories([]);
      setSelectedVoucherTypes([]);
    }
  };

  // Save group assignments
  const saveGroupAssignments = async () => {
    if (!selectedCompanyForGroups || !editingUser) {
      console.error('❌ Missing required data for saving:', {
        selectedCompanyForGroups,
        editingUser
      });
      return;
    }
    
    console.log('🔍 Debug editingUser object:', editingUser);
    console.log('🔍 editingUser.id:', editingUser.id);
    console.log('🔍 editingUser keys:', Object.keys(editingUser));
    
    setGroupsSaving(true);
    try {
      // Build ledger groups array with name and masterid
      const ledgerGroupsPayload = selectedLedgerGroups.map(groupId => {
        const group = ledgerGroups.find(g => g.id === groupId);
        return {
          name: group ? group.name : '',
          masterid: groupId
        };
      });

      // Build stock groups array with name and masterid
      const stockGroupsPayload = selectedStockGroups.map(groupId => {
        const group = stockGroups.find(g => g.id === groupId);
        return {
          name: group ? group.name : '',
          masterid: groupId
        };
      });

      // Build stock categories array with name and masterid
      const stockCategoriesPayload = selectedStockCategories.map(categoryId => {
        const category = stockCategories.find(c => c.id === categoryId);
        return {
          name: category ? category.name : '',
          masterid: categoryId
        };
      });

      // Build voucher types array with name and masterid
      const voucherTypesPayload = selectedVoucherTypes.map(voucherTypeId => {
        const voucherType = voucherTypes.find(v => v.id === voucherTypeId);
        return {
          name: voucherType ? voucherType.name : '',
          masterid: voucherTypeId
        };
      });

      // Try different possible user ID fields
      const userId = editingUser.id || editingUser.user_id || editingUser.email || editingUser.userId;
      
      const payload = {
        userid: userId,
        tallyloc_id: selectedCompanyForGroups.tallyloc_id,
        company_name: selectedCompanyForGroups.company,
        guid: selectedCompanyForGroups.guid,
        ledger_groups: ledgerGroupsPayload,
        stock_groups: stockGroupsPayload,
        stock_categories: stockCategoriesPayload,
        voucher_types: voucherTypesPayload
      };

      console.log('💾 Saving group assignments...');
      console.log('💾 Payload:', payload);

      const cacheBuster = Date.now();
      const data = await apiPost(`/api/tally/user-groups?ts=${cacheBuster}`, payload);
      
      console.log('💾 Save response:', data);

      if (data && (data.success || data.status === 'success')) {
        setGroupModalOpen(false);
        console.log('✅ Group assignments saved successfully');
        // You can add a success message/toast here if needed
      } else {
        console.error('❌ Failed to save group assignments:', data);
        // You can add an error message/toast here if needed
      }
    } catch (error) {
      console.error('❌ Error saving group assignments:', error);
      // You can add an error message/toast here if needed
    } finally {
      setGroupsSaving(false);
    }
  };

  // Open group assignment modal
  const openGroupModal = async (company) => {
    console.log('🔍 Opening group modal for company:', company);
    console.log('🔍 Current editingUser:', editingUser);
    console.log('🔍 editingUser.id:', editingUser?.id);
    
    const userId = editingUser?.id || editingUser?.user_id || editingUser?.email || editingUser?.userId;
    console.log('🔍 Resolved userId:', userId);
    
    setSelectedCompanyForGroups(company);
    setGroupModalOpen(true);
    await fetchCompanyGroups(company.guid);
    if (editingUser && userId) {
      console.log('🔍 Fetching existing groups for user:', userId, 'company:', company);
      await fetchUserCompanyGroups(userId, company);
    } else {
      console.log('⚠️ No valid userId, skipping fetchUserCompanyGroups');
    }
  };

  // Close group assignment modal
  const closeGroupModal = () => {
    setGroupModalOpen(false);
    setSelectedCompanyForGroups(null);
    setLedgerGroups([]);
    setStockGroups([]);
    setStockCategories([]);
    setVoucherTypes([]);
    setSelectedLedgerGroups([]);
    setSelectedStockGroups([]);
    setSelectedStockCategories([]);
    setSelectedVoucherTypes([]);
    setLedgerSearchTerm('');
    setStockSearchTerm('');
    setStockCategorySearchTerm('');
    setVoucherTypeSearchTerm('');
    setActiveTab('ledger');
  };

  // Filter functions for search
  const filteredLedgerGroups = ledgerGroups.filter(group =>
    group.name.toLowerCase().includes(ledgerSearchTerm.toLowerCase()) ||
    (group.description && group.description.toLowerCase().includes(ledgerSearchTerm.toLowerCase()))
  );

  const filteredStockGroups = stockGroups.filter(group =>
    group.name.toLowerCase().includes(stockSearchTerm.toLowerCase()) ||
    (group.description && group.description.toLowerCase().includes(stockSearchTerm.toLowerCase()))
  );

  const filteredStockCategories = stockCategories.filter(category =>
    category.name.toLowerCase().includes(stockCategorySearchTerm.toLowerCase()) ||
    (category.description && category.description.toLowerCase().includes(stockCategorySearchTerm.toLowerCase()))
  );

  const filteredVoucherTypes = voucherTypes.filter(voucherType =>
    voucherType.name.toLowerCase().includes(voucherTypeSearchTerm.toLowerCase()) ||
    (voucherType.description && voucherType.description.toLowerCase().includes(voucherTypeSearchTerm.toLowerCase()))
  );

  useEffect(() => {
    // On initial load, try session storage first, then API if needed
    const allConnections = JSON.parse(sessionStorage.getItem('allConnections') || '[]');
    const filteredConnections = allConnections.filter(conn => 
      conn.status === 'Connected' && conn.access_type === 'Full Access'
    );
    
    if (filteredConnections.length > 0) {
      setConnections(filteredConnections);
      console.log('Initial load from session storage:', filteredConnections.length, 'companies');
    } else {
      // If no data in session storage, fetch from API
      fetchConnections();
    }
    
    // Fetch internal users and roles on component mount
    fetchInternalUsers();
    fetchRoles();
    fetchRoutes();
    
    // TEST DATA: Uncomment the line below to initialize test data on component mount
    // initializeTestData();
    // eslint-disable-next-line
  }, []);

  // Listen for changes in session storage (when dashboard refreshes)
  useEffect(() => {
    const handleStorageChange = () => {
      fetchConnections();
    };

    // Listen for storage events (when other tabs/windows update session storage)
    window.addEventListener('storage', handleStorageChange);
    
    // Also listen for custom events (when same tab updates session storage)
    window.addEventListener('connectionsUpdated', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('connectionsUpdated', handleStorageChange);
    };
  }, []);

  // Fetch subscription info for user limit display
  useEffect(() => {
    const fetchSubscriptionInfo = async () => {
      try {
        const subData = await checkSubscriptionStatus();
        // API endpoint /api/subscription/user-count does not exist in backend
        const countData = null;
        
        // Set subscription info (checkSubscriptionStatus returns the subscription object directly)
        if (subData) {
          setSubscriptionInfo(subData);
        } else {
          // Keep existing or set default values if API fails
          setSubscriptionInfo(prev => prev || { total_user_limit: 0 });
        }
        
        // Set user count info
        if (countData) {
          setUserCountInfo(countData);
        } else {
          // Use internalUsers length as fallback if API fails
          setUserCountInfo({ count: internalUsers.length || 0 });
        }
      } catch (error) {
        console.error('Error fetching subscription info:', error);
        // Keep existing values or set fallback
        setSubscriptionInfo(prev => prev || { total_user_limit: 0 });
        setUserCountInfo({ count: internalUsers.length || 0 });
      }
    };
    fetchSubscriptionInfo();
  }, []);

  // Update user count when internalUsers changes (as fallback if API doesn't update)
  useEffect(() => {
    if (internalUsers.length > 0 && (!userCountInfo || userCountInfo.count === 0)) {
      setUserCountInfo(prev => ({ count: internalUsers.length || prev?.count || 0 }));
    }
  }, [internalUsers.length]);

  // Handle form input
  const handleInput = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setFormError('');
    setFormSuccess('');
    // Clear validation state when user makes changes
    if (validationAttempted) {
      setValidationAttempted(false);
    }
  };

  // Handle company selection (multiple)
  const handleCompanyToggle = (guid) => {
    const updatedGuids = form.companyGuids.includes(guid)
      ? form.companyGuids.filter(g => g !== guid)
      : [...form.companyGuids, guid];
    setForm({ ...form, companyGuids: updatedGuids });
    setFormError('');
    setFormSuccess('');
  };

  // Handle select all companies
  const handleSelectAll = () => {
    if (form.companyGuids.length === connections.length) {
      // Deselect all
      setForm({ ...form, companyGuids: [] });
    } else {
      // Select all
      const allGuids = connections.map(conn => conn.guid);
      setForm({ ...form, companyGuids: allGuids });
    }
    setFormError('');
    setFormSuccess('');
  };

  // Edit: open modal with user's current companies
  const openEditModal = (user) => {
    setEditingUser(user);
    // API returns companyGuid/companyName in internal-users response
    const userGuids = (user.companies || []).map(c => c.companyGuid || c.guid).filter(Boolean);
    setEditSelectedGuids(userGuids);
    
    // Set company-specific settings from current user data
    const companySettings = {};
    (user.companies || []).forEach(company => {
      const guid = company.companyGuid || company.guid;
      if (guid) {
        companySettings[guid] = {
          roleId: company.roleId || '',
          isExternalUser: company.isExternalUser || false
        };
      }
    });
    setEditCompanySettings(companySettings);
    
    setEditModalOpen(true);
  };

  const closeEditModal = () => {
    setEditModalOpen(false);
    setEditingUser(null);
    setEditSelectedGuids([]);
    setEditCompanySettings({});
  };

  const toggleEditCompany = (guid) => {
    setEditSelectedGuids(prev => {
      const isCurrentlySelected = prev.includes(guid);
      if (isCurrentlySelected) {
        // Remove company - also remove its settings
        setEditCompanySettings(prevSettings => {
          const newSettings = { ...prevSettings };
          delete newSettings[guid];
          return newSettings;
        });
        return prev.filter(g => g !== guid);
      } else {
        // Add company - initialize its settings if not already present
        setEditCompanySettings(prevSettings => ({
          ...prevSettings,
          [guid]: prevSettings[guid] || {
            roleId: '',
            isExternalUser: false
          }
        }));
        return [...prev, guid];
      }
    });
  };

  const toggleEditSelectAll = () => {
    const list = mergedEditCompanies;
    if (!list.length) return;
    if (editSelectedGuids.length === list.length) {
      setEditSelectedGuids([]);
    } else {
      setEditSelectedGuids(list.map(c => c.guid));
    }
  };

  // Build merged list for edit modal: all connections + any user companies missing
  const mergedEditCompanies = useMemo(() => {
    const base = connections.map(c => ({
      guid: c.guid,
      company: c.company || c.companyName,
      tallyloc_id: c.tallyloc_id || c.tallylocId
    }));
    const existingGuids = new Set(base.map(c => c.guid));
    const extras = (editingUser?.companies || [])
      .filter(c => (c.companyGuid || c.guid) && !existingGuids.has(c.companyGuid || c.guid))
      .map(c => ({
        guid: c.companyGuid || c.guid,
        company: c.companyName || c.company,
        tallyloc_id: c.tallylocId || c.tallyloc_id
      }));
    const merged = [...base, ...extras].filter(c => c && c.guid && (c.company || '').length >= 0);
    // Sort A → Z by company name, case-insensitive
    merged.sort((a, b) => (a.company || '').toLowerCase().localeCompare((b.company || '').toLowerCase()));
    return merged;
  }, [connections, editingUser]);

  // Save edited access
  const handleSaveEdit = async () => {
    if (!editingUser) return;
    setEditSaving(true);
    try {
      // Build companies ONLY from currently selected GUIDs with their settings
      const selectedSet = new Set(editSelectedGuids);
      const companies = mergedEditCompanies
        .filter(c => c && c.guid && selectedSet.has(c.guid))
        .map(found => {
          const settings = editCompanySettings[found.guid] || { roleId: '', isExternalUser: false };
          return {
            tallyloc_id: found.tallyloc_id,
            company: found.company,
            guid: found.guid,
            roleId: settings.roleId ? parseInt(settings.roleId) : null,
            isExternalUser: settings.isExternalUser
          };
        });

      if (companies.length === 0) {
        alert('Please select at least one company');
        setEditSaving(false);
        return;
      }

      // Validate that all selected companies have a role assigned
      const companiesWithoutRole = companies.filter(c => !c.roleId);
      if (companiesWithoutRole.length > 0) {
        const companyNames = companiesWithoutRole.map(c => c.company).join(', ');
        alert(`Please select a role for the following companies: ${companyNames}`);
        setEditSaving(false);
        return;
      }

      const payload = {
        email: editingUser.email,
        name: editingUser.name,
        mobileno: editingUser.mobileno,
        companies
      };

      const cacheBuster = Date.now();
      const data = await apiPost(`/api/tally/internal-user-access/update?ts=${cacheBuster}`, payload);

      if (data && (data.status === 'success' || data.status === 'no_changes')) {
        await fetchInternalUsers();
        closeEditModal();
      } else if (data && data.status === 'error') {
        console.error('Edit save failed:', data.message);
        alert(data.message || 'Failed to update access');
      } else {
        alert('Invalid response from server');
      }
    } catch (err) {
      console.error('Error saving edit:', err);
      alert(err.message || 'Error while saving');
    } finally {
      setEditSaving(false);
    }
  };

  // Create new access
  const handleCreateAccess = async e => {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');
    setFormSuccess('');
    
    // Validate required fields
    setValidationAttempted(true);
    if (!form.roleId) {
      setFormError('Please select a role before submitting the form.');
      setFormLoading(false);
      return;
    }
    
    // Check subscription limit before creating user
    try {
      const limitCheck = await checkUserLimit();
      if (!limitCheck.canCreate) {
        // Show purchase modal instead of error message
        setShowPurchaseModal(true);
        setFormLoading(false);
        return;
      }
    } catch (error) {
      console.error('Error checking subscription limit:', error);
      // Continue with creation if check fails (graceful degradation)
    }
    
    try {
      // Prepare companies array with required structure
      const companies = form.companyGuids.map(guid => {
        const connection = connections.find(conn => conn.guid === guid);
        console.log('Selected connection:', connection);
        return {
          tallyloc_id: connection.tallyloc_id,
          company: connection.company,
          guid: connection.guid,
          roleId: parseInt(form.roleId),
          isExternalUser: form.isExternalUser
        };
      });

      const payload = {
        email: form.email,
        name: form.userName,
        mobileno: form.mobile,
        isExternalUser: form.isExternalUser,
        companies: companies
      };

      console.log('API Payload:', payload);
      console.log('Companies being sent:', companies);

      const cacheBuster = Date.now();
      const data = await apiPost(`/api/tally/internal-user-access?ts=${cacheBuster}`, payload);
      
      console.log('API Response:', data);
      
      if (data && (data.status === 'success' || data.status === 'no_changes')) {
        // Check if there are any errors in the results
        if (data.results && data.results.errors && data.results.errors.length > 0) {
          setFormError(data.results.errors.join(', ') || 'Some errors occurred while creating access');
        } else {
          // Success case (including no_changes)
          const successMessage = data.message || 'Access granted successfully';
          setFormSuccess(successMessage);
          setForm({ roleId: '', companyGuids: [], userName: '', email: '', mobile: '', isExternalUser: false });
          setValidationAttempted(false);
          
          // Refresh subscription info to update user count badge
          try {
            const subData = await checkSubscriptionStatus();
            setSubscriptionInfo(subData);
            // API endpoint /api/subscription/user-count does not exist in backend
            setUserCountInfo(null);
          } catch (error) {
            console.error('Error refreshing subscription info:', error);
          }
          
          // Refresh internal users list after successful creation
          fetchInternalUsers();
          
          // Auto-hide success message after 3 seconds
          setTimeout(() => {
            setFormSuccess('');
          }, 3000);
        }
      } else if (data && data.status === 'error') {
        throw new Error(data.message || 'Failed to create access');
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  // Remove all access for a user (Delete action)
  const handleRemoveAllAccess = async (user) => {
    if (!user || !user.email) return;
    const confirmed = window.confirm('Remove access for shared companies?');
    if (!confirmed) return;
    setDeletingEmail(user.email);
    try {
      const cacheBuster = Date.now();
      const payload = { email: user.email };
      const data = await apiPost(`/api/tally/internal-user-access/remove-all?ts=${cacheBuster}`, payload);
      if (data && data.status === 'success') {
        await fetchInternalUsers();
      } else {
        alert((data && data.message) || 'Failed to remove access');
      }
    } catch (err) {
      console.error('Remove access error:', err);
      alert(err.message || 'Error while removing access');
    } finally {
      setDeletingEmail('');
    }
  };

  // Helper function to get consolidated role display
  const getConsolidatedRole = (companies) => {
    if (!companies || companies.length === 0) return { display: '-', style: 'none' };
    
    const roleIds = companies.map(c => c.roleId).filter(id => id !== null && id !== undefined);
    const uniqueRoleIds = [...new Set(roleIds)];
    
    // If no roles configured for any company
    if (uniqueRoleIds.length === 0) {
      return { display: '-', style: 'none' };
    }
    
    // If all companies have the same role
    if (uniqueRoleIds.length === 1) {
      const roleId = uniqueRoleIds[0];
      const roleName = roles.find(role => role.id === roleId)?.display_name || `Role ${roleId}`;
      return { display: roleName, style: 'single' };
    }
    
    // If companies have different roles
    return { display: 'Multi', style: 'multi' };
  };

  // Helper function to get consolidated user type display
  const getConsolidatedUserType = (companies) => {
    if (!companies || companies.length === 0) return { display: '-', style: 'none' };
    
    const userTypes = companies.map(c => c.isExternalUser);
    const uniqueUserTypes = [...new Set(userTypes)];
    
    // If all companies have the same user type
    if (uniqueUserTypes.length === 1) {
      const isExternal = uniqueUserTypes[0];
      return { 
        display: isExternal ? 'External' : 'Internal', 
        style: isExternal ? 'external' : 'internal' 
      };
    }
    
    // If companies have different user types
    return { display: 'Multi', style: 'multi' };
  };

  // Geocoding function - using OpenStreetMap Nominatim API (free, no key required)
  const geocodeAddress = async (address) => {
    if (!address || !address.trim()) {
      console.error('Geocoding: Empty address provided');
      return null;
    }

    try {
      // Clean and format the address
      const cleanAddress = address.trim();
      console.log('Geocoding address:', cleanAddress);

      // Try multiple geocoding strategies
      const strategies = [
        // Strategy 1: Full address
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cleanAddress)}&limit=1&addressdetails=1`,
        // Strategy 2: Address with city/state (if full address fails)
        cleanAddress.includes(',') ? `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cleanAddress.split(',').slice(-2).join(',').trim())}&limit=1&addressdetails=1` : null,
        // Strategy 3: Just the city/area name
        cleanAddress.includes(',') ? `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cleanAddress.split(',').pop().trim())}&limit=1&addressdetails=1` : null
      ].filter(Boolean);

      for (const url of strategies) {
        try {
          console.log('Trying geocoding URL:', url);
          
          // Create abort controller for timeout
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);

          // Try direct fetch first, then CORS proxy if needed
          let response;
          try {
            response = await fetch(url, {
              method: 'GET',
        headers: {
                'User-Agent': 'DataLynkr/1.0 (Contact: support@datalynkr.com)',
                'Accept': 'application/json',
                'Accept-Language': 'en-US,en;q=0.9'
              },
              signal: controller.signal,
              mode: 'cors'
            });
          } catch (corsError) {
            // If CORS fails, try using a CORS proxy
            console.warn('Direct fetch failed, trying CORS proxy:', corsError);
            const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
            const proxyResponse = await fetch(proxyUrl, {
              signal: controller.signal,
              mode: 'cors'
            });
            
            if (proxyResponse.ok) {
              const proxyData = await proxyResponse.json();
              // Parse the JSON content from the proxy response
              const parsedData = JSON.parse(proxyData.contents);
              // Create a mock response object
              response = {
                ok: true,
                json: async () => parsedData
              };
            } else {
              throw corsError; // Re-throw if proxy also fails
            }
          }

          clearTimeout(timeoutId);

          // Handle response (either direct or from proxy)
          let data;
          if (response.json && typeof response.json === 'function') {
            // Normal response
            if (!response.ok) {
              console.warn('Geocoding response not OK:', response.status, response.statusText);
              await new Promise(resolve => setTimeout(resolve, 1000));
              continue;
            }
            data = await response.json();
          } else {
            // Proxy response (already parsed)
            data = response;
          }
          
          console.log('Geocoding response:', data);

          if (data && Array.isArray(data) && data.length > 0) {
            const result = data[0];
            const lat = parseFloat(result.lat);
            const lng = parseFloat(result.lon);

            if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
              console.log('Geocoding success:', { lat, lng, displayName: result.display_name });
        return {
                latitude: lat,
                longitude: lng,
                displayName: result.display_name || cleanAddress
              };
            } else {
              console.warn('Invalid coordinates returned:', { lat, lng });
            }
          } else {
            console.warn('No results found for address:', cleanAddress);
          }

          // Wait before next strategy (rate limit: 1 request per second)
          if (strategies.indexOf(url) < strategies.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (fetchError) {
          console.error('Geocoding fetch error:', fetchError);
          // If it's a network/CORS error, try next strategy
          if (fetchError.name === 'TypeError' || fetchError.name === 'AbortError') {
            continue;
          }
          // For other errors, wait and continue
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.error('All geocoding strategies failed for address:', cleanAddress);
      return null;
    } catch (error) {
      console.error('Geocoding error:', error);
      return null;
    }
  };

  // Load customers from API or localStorage
  const loadCustomers = async () => {
    setCustomersLoading(true);
    try {
      // API CODE: Using real API endpoint /api/tally/ledgerlist-w-addrs
      // Clear old cache to force fresh fetch with company names
      // (Remove this line after first successful load if you want to keep caching)
      const cacheVersion = localStorage.getItem('route_customers_version');
      const currentVersion = '2.0'; // Increment when cache structure changes
      
      // Try to get from localStorage first (cache) - but only if version matches
      if (cacheVersion === currentVersion) {
        const storedCustomers = localStorage.getItem('route_customers');
        if (storedCustomers) {
          try {
            const parsed = JSON.parse(storedCustomers);
            // Verify that cached data has companyName field
            const hasCompanyNames = parsed.length > 0 && parsed[0].companyName;
            if (hasCompanyNames) {
              setCustomers(parsed);
        setCustomersLoading(false);
              console.log('✅ Customers loaded from cache:', parsed.length);
        return;
            } else {
              console.log('⚠️ Cached data missing companyName, fetching fresh data');
              localStorage.removeItem('route_customers');
            }
          } catch (e) {
            console.warn('Failed to parse cached customers:', e);
          }
        }
      } else {
        // Clear old cache if version doesn't match
        console.log('⚠️ Cache version mismatch, clearing old cache');
        localStorage.removeItem('route_customers');
      }

      // If no localStorage cache, fetch from API using ledgerlist endpoint
      // Fetch from ALL available companies
      if (connections.length > 0) {
        const allCustomersData = [];
        
        // Fetch customers from all companies in parallel
        const fetchPromises = connections.map(async (company) => {
          // Extract company name - check multiple possible property names
          const companyName = company.company || company.companyName || company.name || 'Unknown Company';
          const payload = {
            tallyloc_id: company.tallyloc_id,
            company: companyName,
            guid: company.guid
          };
          
          try {
            console.log('📡 Fetching customers from API for company:', companyName, 'Full company object:', company);
            const data = await apiPost(`/api/tally/ledgerlist-w-addrs?ts=${Date.now()}`, payload);
            
            if (data && data.ledgers && Array.isArray(data.ledgers)) {
              return data.ledgers.map(ledger => ({
                customer_id: ledger.MASTERID || ledger.NAME,
                name: ledger.NAME,
                pincode: ledger.PINCODE || '',
                address: ledger.ADDRESS || '',
                companyName: companyName, // Use the extracted company name
                latitude: ledger.latitude || null,
                longitude: ledger.longitude || null
              }));
            }
            return [];
          } catch (error) {
            console.error(`Error fetching customers for company ${companyName}:`, error);
            return [];
          }
        });
        
        // Wait for all API calls to complete
        const results = await Promise.all(fetchPromises);
        
        // Flatten all results into a single array
        results.forEach(companyCustomers => {
          allCustomersData.push(...companyCustomers);
        });
        
        // Store in localStorage (cache) with version
        try {
          localStorage.setItem('route_customers', JSON.stringify(allCustomersData));
          localStorage.setItem('route_customers_version', '2.0');
          console.log('✅ Cached customers with company names');
        } catch (cacheError) {
          console.warn('Failed to cache customers:', cacheError.message);
        }
        
        setCustomers(allCustomersData);
        console.log(`✅ Customers loaded from API (${connections.length} companies):`, allCustomersData.length);
        // Log sample to verify company names are present
        if (allCustomersData.length > 0) {
          console.log('📋 Sample customer:', allCustomersData[0]);
        }
      } else {
        console.warn('⚠️ No connections available to fetch customers');
        setCustomers([]);
      }
    } catch (error) {
      console.error('Error loading customers:', error);
      setCustomers([]);
    } finally {
      setCustomersLoading(false);
    }
  };

  // Get unique company names from customers
  const uniqueCompanies = useMemo(() => {
    const companies = new Set();
    customers.forEach(customer => {
      if (customer.companyName && customer.companyName.trim() !== '') {
        companies.add(customer.companyName.trim());
      }
    });
    return Array.from(companies).sort();
  }, [customers]);

  // Initialize selectedCompanies when uniqueCompanies changes (default: all selected)
  useEffect(() => {
    if (uniqueCompanies.length > 0) {
      setSelectedCompanies(prev => {
        // If no previous selection, select all
        if (prev.length === 0) {
          return [...uniqueCompanies];
        }
        // Add any new companies that appeared, remove companies that no longer exist
        const validCompanies = prev.filter(c => uniqueCompanies.includes(c));
        const newCompanies = uniqueCompanies.filter(c => !prev.includes(c));
        return [...validCompanies, ...newCompanies];
      });
    } else {
      // If no companies available, clear selection
      setSelectedCompanies([]);
    }
  }, [uniqueCompanies]);

  // Initialize editSelectedCompanies when Edit Route modal opens (default: all selected)
  useEffect(() => {
    if (showEditRouteModal && uniqueCompanies.length > 0) {
      // When Edit Route modal opens, select all available companies by default
      setEditSelectedCompanies([...uniqueCompanies]);
    }
  }, [showEditRouteModal, uniqueCompanies]);

  // Get unique pincodes from customers (all companies)
  const uniquePincodes = useMemo(() => {
    const pincodes = new Set();
    customers.forEach(customer => {
      if (customer.pincode && customer.pincode.trim() !== '') {
        pincodes.add(customer.pincode.trim());
      }
    });
    return Array.from(pincodes).sort();
  }, [customers]);

  // Get unique pincodes from selected companies only (for Create Route modal)
  const uniquePincodesForSelectedCompanies = useMemo(() => {
    const pincodes = new Set();
    customers
      .filter(customer => {
        const customerCompany = customer.companyName || 'Unknown Company';
        return selectedCompanies.includes(customerCompany);
      })
      .forEach(customer => {
        if (customer.pincode && customer.pincode.trim() !== '') {
          pincodes.add(customer.pincode.trim());
        }
      });
    return Array.from(pincodes).sort();
  }, [customers, selectedCompanies]);

  // Filter pincodes based on input and selected companies
  const filteredPincodes = useMemo(() => {
    if (!pincodeInput.trim()) {
      return [];
    }
    const input = pincodeInput.trim().toLowerCase();
    return uniquePincodesForSelectedCompanies.filter(pincode => 
      pincode.toLowerCase().includes(input)
    ).slice(0, 10);
  }, [pincodeInput, uniquePincodesForSelectedCompanies]);

  // Filter customers by pincode or keyword search, and by selected companies
  const filteredCustomersForRoute = useMemo(() => {
    // First filter by selected companies
    const companyFilteredCustomers = customers.filter(customer => {
      const customerCompany = customer.companyName || 'Unknown Company';
      return selectedCompanies.includes(customerCompany);
    });

    // Pincode mode
    if (filterMode === 'pincode') {
    if (!selectedPincode) {
      return [];
    }
    return companyFilteredCustomers
      .filter(customer => customer.pincode && customer.pincode.trim() === selectedPincode)
      .map(customer => {
        const customerId = customer.customer_id;
        const coords = customerCoordinates[customerId] || { 
          latitude: customer.latitude || null, 
          longitude: customer.longitude || null 
        };
        return {
          id: customerId,
          name: customer.name,
          pincode: customer.pincode || '',
          address: customer.address || '',
            companyName: customer.companyName || 'Unknown Company',
          latitude: coords.latitude,
          longitude: coords.longitude,
        };
      });
    }
    
    // Keyword search mode
    if (filterMode === 'keyword') {
      if (!customerSearchInput.trim()) {
        return [];
      }
      
      const searchTerm = customerSearchInput.trim().toLowerCase();
      
      return companyFilteredCustomers
        .filter(customer => {
          // Search across multiple fields
          const searchableFields = [
            customer.name || '',
            customer.pincode || '',
            customer.address || '',
            customer.companyName || '',
            customer.customer_id || '',
          ];
          
          // Check if search term matches any field
          return searchableFields.some(field => 
            field.toLowerCase().includes(searchTerm)
          );
        })
        .map(customer => {
          const customerId = customer.customer_id;
          const coords = customerCoordinates[customerId] || { 
            latitude: customer.latitude || null, 
            longitude: customer.longitude || null 
          };
          return {
            id: customerId,
            name: customer.name,
            pincode: customer.pincode || '',
            address: customer.address || '',
            companyName: customer.companyName || 'Unknown Company',
            latitude: coords.latitude,
            longitude: coords.longitude,
          };
        });
    }
    
    return [];
  }, [customers, selectedPincode, customerSearchInput, filterMode, customerCoordinates, selectedCompanies]);

  // Get unique pincodes from selected companies only (for Edit Route modal)
  const editUniquePincodesForSelectedCompanies = useMemo(() => {
    const pincodes = new Set();
    customers
      .filter(customer => {
        const customerCompany = customer.companyName || 'Unknown Company';
        return editSelectedCompanies.includes(customerCompany);
      })
      .forEach(customer => {
        if (customer.pincode && customer.pincode.trim() !== '') {
          pincodes.add(customer.pincode.trim());
        }
      });
    return Array.from(pincodes).sort();
  }, [customers, editSelectedCompanies]);

  // Edit Route: Filtered pincodes based on input and selected companies
  const editFilteredPincodes = useMemo(() => {
    if (!editPincodeInput.trim()) {
      return [];
    }
    const input = editPincodeInput.trim().toLowerCase();
    return editUniquePincodesForSelectedCompanies.filter(pincode => 
      pincode.toLowerCase().includes(input)
    ).slice(0, 10);
  }, [editPincodeInput, editUniquePincodesForSelectedCompanies]);

  // Edit Route: Filter customers by pincode or keyword search, and by selected companies
  const editFilteredCustomersForRoute = useMemo(() => {
    // First filter by selected companies
    const companyFilteredCustomers = customers.filter(customer => {
      const customerCompany = customer.companyName || 'Unknown Company';
      return editSelectedCompanies.includes(customerCompany);
    });

    // Pincode mode
    if (editFilterMode === 'pincode') {
    if (!editSelectedPincode) {
      return [];
    }
    return companyFilteredCustomers
      .filter(customer => customer.pincode && customer.pincode.trim() === editSelectedPincode)
      .map(customer => {
        const customerId = customer.customer_id;
        const coords = editCustomerCoordinates[customerId] || { 
          latitude: customer.latitude || null, 
          longitude: customer.longitude || null 
        };
        return {
          id: customerId,
          name: customer.name,
          pincode: customer.pincode || '',
          address: customer.address || '',
            companyName: customer.companyName || 'Unknown Company',
          latitude: coords.latitude,
          longitude: coords.longitude,
        };
      });
    }
    
    // Keyword search mode
    if (editFilterMode === 'keyword') {
      if (!editCustomerSearchInput.trim()) {
        return [];
      }
      
      const searchTerm = editCustomerSearchInput.trim().toLowerCase();
      
      return companyFilteredCustomers
        .filter(customer => {
          // Search across multiple fields
          const searchableFields = [
            customer.name || '',
            customer.pincode || '',
            customer.address || '',
            customer.companyName || '',
            customer.customer_id || '',
          ];
          
          // Check if search term matches any field
          return searchableFields.some(field => 
            field.toLowerCase().includes(searchTerm)
          );
        })
        .map(customer => {
          const customerId = customer.customer_id;
          const coords = editCustomerCoordinates[customerId] || { 
            latitude: customer.latitude || null, 
            longitude: customer.longitude || null 
          };
          return {
            id: customerId,
            name: customer.name,
            pincode: customer.pincode || '',
            address: customer.address || '',
            companyName: customer.companyName || 'Unknown Company',
            latitude: coords.latitude,
            longitude: coords.longitude,
          };
        });
    }
    
    return [];
  }, [customers, editSelectedPincode, editCustomerSearchInput, editFilterMode, editCustomerCoordinates, editSelectedCompanies]);

  // Fetch routes from API or localStorage
  const fetchRoutes = async () => {
    setRoutesLoading(true);
    try {
      // API CODE: Using real API or localStorage
      // Fallback to localStorage (SQLite simulation)
        const storedRoutes = JSON.parse(localStorage.getItem('routes') || '[]');
        const storedAssignments = JSON.parse(localStorage.getItem('route_assignments') || '[]');
        
        if (storedRoutes.length > 0) {
          // Merge assignments with routes
          const routesWithAssignments = storedRoutes.map(route => {
            const assignment = storedAssignments.find(a => a.route_id === route.id);
            return {
              ...route,
              assignedTo: assignment?.user_id || null,
              customerCount: route.customer_ids?.length || route.customerCount || 0
            };
          });
          
          setRoutes(routesWithAssignments);
        } else {
          setRoutes([]);
        }
    } catch (error) {
      console.error('Error fetching routes:', error);
      setRoutes([]);
    } finally {
      setRoutesLoading(false);
    }
  };

  // Create route
  const handleCreateRoute = async () => {
    if (!routeName.trim()) {
      alert('Please enter a route name');
      return;
    }

    if (selectedCustomers.length === 0) {
      alert('Please select at least one customer');
      return;
    }

    const userEmail = sessionStorage.getItem('email');
    if (!userEmail) {
      alert('User information not available');
      return;
    }

    setIsSavingRoute(true);
    try {
      // Get customer details from all customers (not just filtered by current pincode)
      const customerNames = selectedCustomers.map(customerId => {
        const customer = customers.find(c => c.customer_id === customerId);
        return customer?.name || customerId;
      });

      const customerCoords = selectedCustomers.map(customerId => {
        const customer = customers.find(c => c.customer_id === customerId);
        const coords = customerCoordinates[customerId] || { latitude: null, longitude: null };
        return {
          latitude: coords.latitude ?? customer?.latitude ?? null,
          longitude: coords.longitude ?? customer?.longitude ?? null,
        };
      });

      const newRoute = {
        id: Date.now().toString(),
        name: routeName.trim(),
        description: routeDescription.trim() || null,
        created_by: userEmail,
        created_at: new Date().toISOString(),
        customer_ids: selectedCustomers,
        customer_names: customerNames,
        customer_coordinates: customerCoords,
        assignedTo: null,
        customerCount: selectedCustomers.length
      };

      // Try API first
      let routeSaved = false;
      try {
        const apiResponse = await apiPost('/api/routes', newRoute);
        if (apiResponse && apiResponse.success !== false) {
          routeSaved = true;
          console.log('✅ Route saved via API');
        }
      } catch (apiError) {
        console.log('⚠️ API not available, using localStorage:', apiError);
      }

      // Fallback to localStorage if API didn't work
      if (!routeSaved) {
        const existingRoutes = JSON.parse(localStorage.getItem('routes') || '[]');
        existingRoutes.push(newRoute);
        localStorage.setItem('routes', JSON.stringify(existingRoutes));
        console.log('✅ Route saved to localStorage. Total routes:', existingRoutes.length);
        console.log('📋 Saved route:', newRoute);
      }

      // Refresh routes to get updated data
      await fetchRoutes();
      
      // Get updated routes count after refresh
      const updatedRoutes = JSON.parse(localStorage.getItem('routes') || '[]');
      console.log('🔄 Routes refreshed. Current routes count:', updatedRoutes.length);
      console.log('📋 All routes:', updatedRoutes.map(r => ({ id: r.id, name: r.name, customers: r.customerCount })));
      
      // Reset form
      setRouteName('');
      setRouteDescription('');
      setSelectedPincode('');
      setPincodeInput('');
      setCustomerSearchInput('');
      setFilterMode('keyword');
      setSelectedCustomers([]);
      setShowCreateRouteModal(false);
      
      alert(`Route created successfully! Total routes: ${updatedRoutes.length}`);
    } catch (error) {
      console.error('Error creating route:', error);
      alert('Failed to create route. Please try again.');
    } finally {
      setIsSavingRoute(false);
    }
  };

  // Assign route to user
  const handleAssignRoute = (user) => {
    setAssigningUser(user);
    setSelectedRouteForAssign(null);
    setSalespersonEmail(user.email);
    setSelectedDaysOfWeek([]);
    setIsRecurring(false);
    setShowAssignRouteModal(true);
  };

  // Handle Route Actions for salesperson
  const handleRouteActions = (user) => {
    setRouteActionsUser(user);
    setShowAssignedRoutes(false);
    setShowRouteActionsModal(true);
  };

  // Handle delete route assignment (not the route itself, just the assignment)
  const handleDeleteAssignment = async (routeName, userEmail) => {
    if (!window.confirm(`Are you sure you want to remove the assignment of "${routeName}" from this user?`)) {
      return;
    }

    try {
      // Get assignments from localStorage
      const assignments = JSON.parse(localStorage.getItem('route_assignments') || '[]');
      
      // Find and remove the assignment
      const updatedAssignments = assignments.filter(a => 
        !(a.user_id === userEmail && a.route_name === routeName)
      );
      
      // Save back to localStorage
      localStorage.setItem('route_assignments', JSON.stringify(updatedAssignments));
      
      // Also update the route's assignedTo field if needed
      const route = routes.find(r => r.name === routeName);
      if (route) {
        // Check if there are any other assignments for this route
        const remainingAssignments = updatedAssignments.filter(a => a.route_id === route.id);
        if (remainingAssignments.length === 0) {
          // No more assignments, clear assignedTo
          const existingRoutes = JSON.parse(localStorage.getItem('routes') || '[]');
          const updatedRoutes = existingRoutes.map(r => 
            r.id === route.id 
              ? { ...r, assignedTo: null }
              : r
          );
          localStorage.setItem('routes', JSON.stringify(updatedRoutes));
        }
      }

      // Try API if available
      try {
        await apiPost('/api/routes/unassign', {
          route_name: routeName,
          user_id: userEmail
        });
      } catch (apiError) {
        console.log('⚠️ API not available, using localStorage:', apiError);
      }

      // Refresh routes to get updated assignment data
      await fetchRoutes();
      
      // Force component re-render
      setAssignmentsUpdateTrigger(prev => prev + 1);
      
      alert('Route assignment removed successfully');
    } catch (error) {
      console.error('Error deleting assignment:', error);
      alert('Failed to remove assignment. Please try again.');
    }
  };

  // Save route assignment
  const handleSaveAssignment = async () => {
    if (!selectedRouteForAssign) {
      alert('Please select a route');
      return;
    }

    if (!salespersonEmail.trim()) {
      alert('Please enter salesperson email');
      return;
    }

    setIsSavingAssignment(true);
    try {
      const assignment = {
        id: Date.now().toString(),
        route_id: selectedRouteForAssign.id,
        route_name: selectedRouteForAssign.name,
        user_id: salespersonEmail.trim(),
        days_of_week: selectedDaysOfWeek.length > 0 ? selectedDaysOfWeek : null, // Array of selected days, or null for daily
        day_of_week: selectedDaysOfWeek.length === 1 ? selectedDaysOfWeek[0] : null, // Keep for backward compatibility
        is_recurring: isRecurring,
        assigned_at: new Date().toISOString()
      };

      // Try API first
      let assignmentSaved = false;
      try {
        const apiResponse = await apiPost('/api/routes/assign', assignment);
        if (apiResponse && apiResponse.success !== false) {
          assignmentSaved = true;
          console.log('✅ Route assignment saved via API');
        }
      } catch (apiError) {
        console.log('⚠️ API not available, using localStorage:', apiError);
      }

      // Fallback to localStorage if API didn't work
      if (!assignmentSaved) {
        const existingAssignments = JSON.parse(localStorage.getItem('route_assignments') || '[]');
        // Remove any existing assignment for this route (to avoid duplicates)
        const filteredAssignments = existingAssignments.filter(a => a.route_id !== assignment.route_id);
        filteredAssignments.push(assignment);
        localStorage.setItem('route_assignments', JSON.stringify(filteredAssignments));
        console.log('✅ Route assignment saved to localStorage');
        
        // Also update the route's assignedTo field in routes
        const existingRoutes = JSON.parse(localStorage.getItem('routes') || '[]');
        const updatedRoutes = existingRoutes.map(r => 
          r.id === assignment.route_id 
            ? { ...r, assignedTo: assignment.user_id }
            : r
        );
        localStorage.setItem('routes', JSON.stringify(updatedRoutes));
        console.log('✅ Route updated with assignment in localStorage');
      }

      // Refresh routes to get updated assignment data
      await fetchRoutes();
      
      // Force component re-render to update users table with new assignments
      // This ensures the "Routes Assigned" column updates immediately
      setAssignmentsUpdateTrigger(prev => prev + 1);

      setShowAssignRouteModal(false);
      alert('Route assigned successfully');
    } catch (error) {
      console.error('Error assigning route:', error);
      alert('Failed to assign route. Please try again.');
    } finally {
      setIsSavingAssignment(false);
    }
  };

  // Handle edit customer coordinates (for create route modal)
  const handleEditCustomer = (customer) => {
    setEditingCustomer(customer);
    setEditLatitude(customer.latitude?.toString() || '');
    setEditLongitude(customer.longitude?.toString() || '');
    setShowEditCustomerModal(true);
  };

  // Handle edit customer coordinates (for edit route modal)
  const handleEditCustomerInEditRoute = (customer) => {
    setEditingCustomer(customer);
    setEditLatitude(customer.latitude?.toString() || '');
    setEditLongitude(customer.longitude?.toString() || '');
    setShowEditCustomerModal(true);
  };

  // Handle fetch coordinates from address
  const handleFetchFromAddress = async () => {
    if (!editingCustomer || !editingCustomer.address) {
      alert('No address available for this customer');
      return;
    }

    setIsGeocoding(true);
    try {
      console.log('Fetching coordinates for address:', editingCustomer.address);
      const result = await geocodeAddress(editingCustomer.address);
      
      if (result) {
        setEditLatitude(result.latitude.toString());
        setEditLongitude(result.longitude.toString());
        console.log('Coordinates successfully fetched:', result);
        alert(`Coordinates fetched successfully!\nLocation: ${result.displayName}\nLat: ${result.latitude.toFixed(6)}, Lng: ${result.longitude.toFixed(6)}`);
      } else {
        console.error('Geocoding returned null for address:', editingCustomer.address);
        alert('Could not find coordinates for this address. The address might be too specific or incomplete. Please try:\n\n1. Using "Select on Map" to pick the location manually\n2. Entering coordinates manually\n3. Checking if the address format is correct');
      }
    } catch (error) {
      console.error('Geocoding error in handleFetchFromAddress:', error);
      alert(`Failed to fetch coordinates: ${error.message || 'Unknown error'}\n\nPlease try:\n1. Using "Select on Map" to pick the location\n2. Entering coordinates manually`);
    } finally {
      setIsGeocoding(false);
    }
  };

  // Handle save coordinates
  const handleSaveCoordinates = async () => {
    if (!editingCustomer) return;

    const lat = editLatitude.trim() ? parseFloat(editLatitude.trim()) : null;
    const lng = editLongitude.trim() ? parseFloat(editLongitude.trim()) : null;

    // Validate coordinates
    if (editLatitude.trim() && (isNaN(lat) || lat < -90 || lat > 90)) {
      alert('Latitude must be between -90 and 90');
      return;
    }
    if (editLongitude.trim() && (isNaN(lng) || lng < -180 || lng > 180)) {
      alert('Longitude must be between -180 and 180');
      return;
    }

    // Determine which context we're in (create or edit route modal)
    const isEditRouteContext = showEditRouteModal && editingRoute;

    if (isEditRouteContext) {
      // Update coordinates in edit route modal context
      setEditCustomerCoordinates(prev => ({
        ...prev,
        [editingCustomer.id]: {
          latitude: lat,
          longitude: lng,
        },
      }));
    } else {
      // Update coordinates in create route modal context
      setCustomerCoordinates(prev => ({
        ...prev,
        [editingCustomer.id]: {
          latitude: lat,
          longitude: lng,
        },
      }));
    }

    // Update customer in localStorage (SQLite simulation)
    try {
      const storedCustomers = JSON.parse(localStorage.getItem('route_customers') || '[]');
      const updatedCustomers = storedCustomers.map(c => 
        c.customer_id === editingCustomer.id 
          ? { ...c, latitude: lat, longitude: lng }
          : c
      );
      localStorage.setItem('route_customers', JSON.stringify(updatedCustomers));
      setCustomers(updatedCustomers);
    } catch (error) {
      console.error('Error updating customer coordinates:', error);
    }

    setShowEditCustomerModal(false);
    setEditingCustomer(null);
    setEditLatitude('');
    setEditLongitude('');
  };

  // Handle edit route
  const handleEditRoute = async (route) => {
    setEditingRoute(route);
    setEditRouteName(route.name || '');
    setEditRouteDescription(route.description || '');
    setEditSelectedCustomers(route.customer_ids || []);
    setEditPincodeInput('');
    setEditSelectedPincode('');
    setEditCustomerSearchInput('');
    setEditFilterMode('keyword');
    
    // Load customer coordinates if available
    if (route.customer_coordinates && Array.isArray(route.customer_coordinates)) {
      const coordsMap = {};
      route.customer_ids?.forEach((customerId, index) => {
        if (route.customer_coordinates[index]) {
          coordsMap[customerId] = {
            latitude: route.customer_coordinates[index].latitude,
            longitude: route.customer_coordinates[index].longitude
          };
        }
      });
      setEditCustomerCoordinates(coordsMap);
    } else {
      setEditCustomerCoordinates({});
    }
    
    // Load customers if not already loaded
    if (customers.length === 0) {
      await loadCustomers();
    }
    
    setShowEditRouteModal(true);
  };

  // Update route
  const handleUpdateRoute = async () => {
    if (!editRouteName.trim()) {
      alert('Please enter a route name');
      return;
    }

    if (editSelectedCustomers.length === 0) {
      alert('Please select at least one customer');
      return;
    }

    setIsUpdatingRoute(true);
    try {
      const userEmail = sessionStorage.getItem('email') || 'admin@itc.com';

      // Get customer details
      const customerNames = editSelectedCustomers.map(customerId => {
        const customer = customers.find(c => c.customer_id === customerId);
        return customer?.name || customerId;
      });

      const customerCoords = editSelectedCustomers.map(customerId => {
        const customer = customers.find(c => c.customer_id === customerId);
        const coords = editCustomerCoordinates[customerId] || { latitude: null, longitude: null };
        return {
          latitude: coords.latitude ?? customer?.latitude ?? null,
          longitude: coords.longitude ?? customer?.longitude ?? null,
        };
      });

      const updatedRoute = {
        ...editingRoute,
        name: editRouteName.trim(),
        description: editRouteDescription.trim() || null,
        customer_ids: editSelectedCustomers,
        customer_names: customerNames,
        customer_coordinates: customerCoords,
        customerCount: editSelectedCustomers.length,
        updated_at: new Date().toISOString()
      };

      // Try API first
      let routeUpdated = false;
      try {
        const apiResponse = await apiPut(`/api/routes/${editingRoute.id}`, updatedRoute);
        if (apiResponse && apiResponse.success !== false) {
          routeUpdated = true;
          console.log('✅ Route updated via API');
        }
      } catch (apiError) {
        console.log('⚠️ API not available, using localStorage:', apiError);
      }

      // Fallback to localStorage if API didn't work
      if (!routeUpdated) {
        const existingRoutes = JSON.parse(localStorage.getItem('routes') || '[]');
        const updatedRoutes = existingRoutes.map(r => 
          r.id === editingRoute.id ? updatedRoute : r
        );
        localStorage.setItem('routes', JSON.stringify(updatedRoutes));
        console.log('✅ Route updated in localStorage');
      }

      // Refresh routes to get updated data
      await fetchRoutes();

      // Reset form
      setEditRouteName('');
      setEditRouteDescription('');
      setEditSelectedPincode('');
      setEditPincodeInput('');
      setEditCustomerSearchInput('');
      setEditFilterMode('keyword');
      setEditSelectedCustomers([]);
      setEditCustomerCoordinates({});
      setEditingRoute(null);
      setShowEditRouteModal(false);

      alert('Route updated successfully');
    } catch (error) {
      console.error('Error updating route:', error);
      alert('Failed to update route. Please try again.');
    } finally {
      setIsUpdatingRoute(false);
    }
  };

  // Handle delete route
  const handleDeleteRoute = async (route) => {
    if (!window.confirm(`Are you sure you want to delete route "${route.name}"?`)) {
      return;
    }

    try {
      // Try API first
      let routeDeleted = false;
      try {
        const apiResponse = await apiPost('/api/routes/delete', { route_id: route.id });
        if (apiResponse && apiResponse.success !== false) {
          routeDeleted = true;
          console.log('✅ Route deleted via API');
        }
      } catch (apiError) {
        console.log('⚠️ API not available, using localStorage:', apiError);
      }

      // Fallback to localStorage if API didn't work
      if (!routeDeleted) {
        const existingRoutes = JSON.parse(localStorage.getItem('routes') || '[]');
        const updatedRoutes = existingRoutes.filter(r => r.id !== route.id);
        localStorage.setItem('routes', JSON.stringify(updatedRoutes));
        console.log('✅ Route deleted from localStorage. Remaining routes:', updatedRoutes.length);
      }

      // Also delete related route assignments
      try {
        const existingAssignments = JSON.parse(localStorage.getItem('route_assignments') || '[]');
        const updatedAssignments = existingAssignments.filter(a => a.route_id !== route.id);
        localStorage.setItem('route_assignments', JSON.stringify(updatedAssignments));
        console.log('✅ Route assignments cleaned up');
      } catch (error) {
        console.error('Error cleaning up route assignments:', error);
      }

      // Refresh routes to get updated data from localStorage/API
      await fetchRoutes();
      
      // Force component re-render to update users table
      setAssignmentsUpdateTrigger(prev => prev + 1);
      
      alert('Route deleted successfully');
    } catch (error) {
      console.error('Error deleting route:', error);
      alert('Failed to delete route. Please try again.');
    }
  };

  // Helper function to check if a user has the Salesperson role
  const isSalesperson = (user) => {
    if (!user || !user.companies || user.companies.length === 0) return false;
    
    // Get all roleIds from user's companies
    const roleIds = user.companies.map(c => c.roleId).filter(id => id !== null && id !== undefined);
    
    // Check if any roleId corresponds to a 'Salesperson' role
    return roleIds.some(roleId => {
      const role = roles.find(r => r.id === roleId);
      return role && role.display_name && role.display_name.toLowerCase() === 'salesperson';
    });
  };

  // Filter users based on search term
  const filteredUsers = internalUsers.filter(user => 
    user.name.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(userSearchTerm.toLowerCase())
  );

  const isMobile = window.innerWidth <= 768;

  return (
    <div 
      className="user-management-wrapper"
      style={{ 
        margin: '0', 
        padding: isMobile ? '16px 12px' : '24px', 
        width: '100%', 
        maxWidth: '1200px', 
        marginLeft: 'auto',
        marginRight: 'auto',
        boxSizing: 'border-box', 
        minHeight: '100vh',
        fontFamily: 'Segoe UI, Roboto, Arial, sans-serif',
        overflowX: 'hidden'
      }}
    >
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-10px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
      
      {/* Mobile Responsive Styles */}
      <style>{`
        @media (max-width: 768px) {
          .user-management-header {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 16px !important;
            padding: 20px 16px 20px 60px !important;
            margin-top: 20px !important;
            margin-bottom: 24px !important;
            position: relative !important;
          }
          .user-management-header-title {
            font-size: 24px !important;
          }
          .user-management-header-icon {
            width: 44px !important;
            height: 44px !important;
          }
          .user-management-header-icon .material-icons {
            font-size: 24px !important;
          }
          .user-management-header-subtitle {
            font-size: 14px !important;
            margin-left: 0 !important;
            margin-top: 8px !important;
          }
          .user-management-companies-badge {
            width: 100% !important;
            max-width: 100% !important;
            justify-content: center !important;
            padding: 10px 16px !important;
            font-size: 13px !important;
            margin-top: 0 !important;
            white-space: normal !important;
            text-align: center !important;
            box-sizing: border-box !important;
            word-wrap: break-word !important;
            overflow-wrap: break-word !important;
          }
          .user-management-companies-badge span {
            display: inline-flex !important;
            align-items: center !important;
            gap: 6px !important;
            flex-wrap: wrap !important;
            justify-content: center !important;
          }
          .user-management-companies-badge .material-icons {
            font-size: 18px !important;
            flex-shrink: 0 !important;
          }
          .user-management-tabs {
            flex-direction: column !important;
            gap: 6px !important;
            padding: 6px !important;
          }
          .user-management-tab-button {
            padding: 12px 16px !important;
            font-size: 13px !important;
            min-height: 48px !important;
          }
          .user-management-tab-button .material-icons {
            font-size: 18px !important;
          }
          
          /* Form Container */
          .user-form-container {
            padding: 20px 16px !important;
            margin-bottom: 20px !important;
            border-radius: 16px !important;
          }
          
          /* Form Header */
          .user-form-header {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 12px !important;
            margin-bottom: 24px !important;
            padding-bottom: 16px !important;
          }
          .user-form-header h3 {
            font-size: 20px !important;
          }
          .user-form-header-icon {
            width: 40px !important;
            height: 40px !important;
          }
          .user-form-header-icon .material-icons {
            font-size: 24px !important;
          }
          
          /* Form Grid Fields */
          .user-form-grid {
            grid-template-columns: 1fr !important;
            gap: 16px !important;
            margin-bottom: 20px !important;
          }
          
          /* Form Labels */
          .user-form-label {
            font-size: 13px !important;
            margin-bottom: 8px !important;
          }
          .user-form-label .material-icons {
            font-size: 16px !important;
          }
          
          /* Form Inputs */
          .user-form-input,
          .user-form-select {
            padding: 12px 14px !important;
            font-size: 14px !important;
            border-radius: 10px !important;
          }
          
          /* Company Selection Section */
          .company-selection-header {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 12px !important;
            padding: 12px 16px !important;
          }
          .company-selection-header h4 {
            font-size: 16px !important;
          }
          .company-selection-grid {
            grid-template-columns: 1fr !important;
            gap: 12px !important;
            padding: 16px !important;
          }
          
          /* External User Checkbox */
          .external-user-checkbox {
            padding: 16px !important;
            margin-top: 16px !important;
            margin-bottom: 16px !important;
          }
          
          /* Submit Button */
          .user-form-submit-button {
            width: 100% !important;
            padding: 14px 20px !important;
            font-size: 14px !important;
            min-width: auto !important;
          }
          
          /* Form Messages */
          .user-form-message {
            padding: 14px 16px !important;
            font-size: 13px !important;
            margin-top: 16px !important;
          }
          .user-form-message .material-icons {
            font-size: 18px !important;
          }
          
          /* Users Table Container */
          .users-table-container {
            padding: 20px 16px !important;
            margin-top: 0 !important;
            border-radius: 16px !important;
          }
          
          /* Users Table Header */
          .users-table-header {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 16px !important;
            margin-bottom: 20px !important;
            padding-bottom: 16px !important;
          }
          .users-table-header h3 {
            font-size: 20px !important;
          }
          .users-table-header-icon {
            width: 40px !important;
            height: 40px !important;
          }
          .users-table-header-icon .material-icons {
            font-size: 24px !important;
          }
          
          /* Search Input */
          .users-search-input {
            width: 100% !important;
            padding: 10px 14px !important;
            font-size: 14px !important;
          }
          .users-search-input input {
            width: 100% !important;
            font-size: 14px !important;
          }
          
          /* Users Table */
          .users-table-wrapper {
            overflow-x: auto !important;
            -webkit-overflow-scrolling: touch !important;
            border-radius: 12px !important;
          }
          .users-table {
            min-width: 800px !important;
            font-size: 13px !important;
          }
          .users-table th {
            padding: 12px 14px !important;
            font-size: 11px !important;
          }
          .users-table td {
            padding: 16px 14px !important;
            font-size: 13px !important;
          }
          
          /* Action Buttons */
          .user-action-button {
            padding: 8px 12px !important;
            font-size: 12px !important;
            min-width: auto !important;
          }
          .user-action-button .material-icons {
            font-size: 16px !important;
          }
          
          /* Users Table Action Buttons */
          .users-table-actions {
            flex-direction: column !important;
            gap: 8px !important;
            width: 100% !important;
          }
          .users-table-actions button {
            width: 100% !important;
            padding: 10px 12px !important;
            font-size: 12px !important;
          }
          .users-table-actions .material-icons {
            font-size: 14px !important;
          }
          
          /* Empty/Loading States */
          .users-empty-state,
          .users-loading-state {
            padding: 40px 20px !important;
          }
          .users-empty-state .material-icons,
          .users-loading-state .material-icons {
            font-size: 40px !important;
          }
          
          /* Routes Tab Container */
          .routes-container {
            padding: 20px 16px !important;
            margin-top: 20px !important;
            border-radius: 16px !important;
          }
          
          /* Routes Header */
          .routes-header {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 16px !important;
            margin-bottom: 20px !important;
            padding-bottom: 16px !important;
          }
          .routes-header h3 {
            font-size: 20px !important;
          }
          .routes-header-icon {
            width: 40px !important;
            height: 40px !important;
          }
          .routes-header-icon .material-icons {
            font-size: 24px !important;
          }
          
          /* Routes Search and Create */
          .routes-search-create {
            flex-direction: column !important;
            gap: 12px !important;
            width: 100% !important;
          }
          .routes-search-input {
            width: 100% !important;
            padding: 10px 14px !important;
          }
          .routes-search-input input {
            width: 100% !important;
            font-size: 14px !important;
          }
          .routes-create-button {
            width: 100% !important;
            padding: 12px 20px !important;
            font-size: 13px !important;
            justify-content: center !important;
          }
          
          /* Routes Table */
          .routes-table-wrapper {
            overflow-x: auto !important;
            -webkit-overflow-scrolling: touch !important;
            border-radius: 12px !important;
          }
          .routes-table {
            min-width: 900px !important;
            font-size: 13px !important;
          }
          .routes-table th {
            padding: 12px 14px !important;
            font-size: 11px !important;
          }
          .routes-table td {
            padding: 16px 14px !important;
            font-size: 13px !important;
          }
          
          /* Routes Empty/Loading States */
          .routes-empty-state,
          .routes-loading-state {
            padding: 40px 20px !important;
          }
          .routes-empty-state .material-icons,
          .routes-loading-state .material-icons {
            font-size: 40px !important;
          }
        }
        
        @media (max-width: 480px) {
          .user-management-wrapper {
            padding: 16px 12px !important;
          }
          .user-management-tab-button {
            padding: 10px 12px !important;
            font-size: 12px !important;
            gap: 6px !important;
          }
          .user-management-tab-button .material-icons {
            font-size: 16px !important;
          }
          
          /* Form Container */
          .user-form-container {
            padding: 16px 12px !important;
            border-radius: 12px !important;
          }
          
          /* Form Header */
          .user-form-header h3 {
            font-size: 18px !important;
          }
          .user-form-header-icon {
            width: 36px !important;
            height: 36px !important;
          }
          .user-form-header-icon .material-icons {
            font-size: 20px !important;
          }
          
          /* Form Grid Fields */
          .user-form-grid {
            gap: 12px !important;
          }
          
          /* Form Labels */
          .user-form-label {
            font-size: 12px !important;
          }
          
          /* Form Inputs */
          .user-form-input,
          .user-form-select {
            padding: 10px 12px !important;
            font-size: 13px !important;
          }
          
          /* Company Selection */
          .company-selection-header {
            padding: 10px 12px !important;
          }
          .company-selection-header h4 {
            font-size: 14px !important;
          }
          .company-selection-grid {
            padding: 12px !important;
            gap: 10px !important;
          }
          
          /* External User Checkbox */
          .external-user-checkbox {
            padding: 12px !important;
          }
          
          /* Submit Button */
          .user-form-submit-button {
            padding: 12px 16px !important;
            font-size: 13px !important;
          }
          
          /* Users Table Container */
          .users-table-container {
            padding: 16px 12px !important;
          }
          
          /* Users Table Header */
          .users-table-header h3 {
            font-size: 18px !important;
          }
          .users-table-header-icon {
            width: 36px !important;
            height: 36px !important;
          }
          .users-table-header-icon .material-icons {
            font-size: 20px !important;
          }
          
          /* Users Table */
          .users-table {
            min-width: 700px !important;
            font-size: 12px !important;
          }
          .users-table th {
            padding: 10px 12px !important;
            font-size: 10px !important;
          }
          .users-table td {
            padding: 12px !important;
            font-size: 12px !important;
          }
          
          /* Action Buttons */
          .user-action-button {
            padding: 6px 10px !important;
            font-size: 11px !important;
          }
          
          /* Users Table Action Buttons */
          .users-table-actions button {
            padding: 8px 10px !important;
            font-size: 11px !important;
          }
          .users-table-actions .material-icons {
            font-size: 12px !important;
          }
          
          /* Routes Tab Container */
          .routes-container {
            padding: 16px 12px !important;
          }
          
          /* Routes Header */
          .routes-header h3 {
            font-size: 18px !important;
          }
          .routes-header-icon {
            width: 36px !important;
            height: 36px !important;
          }
          .routes-header-icon .material-icons {
            font-size: 20px !important;
          }
          
          /* Routes Search and Create */
          .routes-create-button {
            padding: 10px 16px !important;
            font-size: 12px !important;
          }
          
          /* Routes Table */
          .routes-table {
            min-width: 800px !important;
            font-size: 12px !important;
          }
          .routes-table th {
            padding: 10px 12px !important;
            font-size: 10px !important;
          }
          .routes-table td {
            padding: 12px !important;
            font-size: 12px !important;
          }
        }
      `}</style>

      {/* Header Section */}
      <div style={{ 
        marginBottom: '32px',
        borderBottom: '2px solid #e5e7eb',
        paddingBottom: '24px',
        paddingTop: isMobile ? '70px' : '24px',
        paddingLeft: isMobile ? '0' : '0'
      }}>
        <h1 style={{
          fontSize: isMobile ? '22px' : '28px',
          fontWeight: 700,
          color: '#1e293b',
          margin: 0,
          display: 'flex',
          alignItems: 'center',
          gap: isMobile ? '8px' : '12px',
          flexWrap: isMobile ? 'wrap' : 'nowrap'
        }}>
          <span className="material-icons" style={{ fontSize: isMobile ? '24px' : '32px', color: '#3b82f6' }}>
            people
          </span>
          User Management
        </h1>
        <p style={{
          fontSize: isMobile ? '14px' : '16px',
          color: '#64748b',
          marginTop: '8px',
          marginLeft: isMobile ? '0' : '44px'
        }}>
          Grant access to users and manage routes
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="user-management-tabs" style={{
        background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
        borderRadius: 20,
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        border: '1px solid rgba(59, 130, 246, 0.1)',
        marginBottom: 24,
        padding: '8px',
        display: 'flex',
        gap: 8
      }}>
        <button
          className="user-management-tab-button"
          onClick={() => setUserManagementTab('form')}
          style={{
            flex: 1,
            padding: '14px 24px',
            borderRadius: 14,
            border: 'none',
            background: userManagementTab === 'form' 
              ? 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)' 
              : 'transparent',
            color: userManagementTab === 'form' ? '#fff' : '#64748b',
            fontSize: 15,
            fontWeight: userManagementTab === 'form' ? 700 : 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            transition: 'all 0.3s ease',
            boxShadow: userManagementTab === 'form' ? '0 4px 12px rgba(59, 130, 246, 0.3)' : 'none',
            whiteSpace: 'nowrap'
          }}
          onMouseEnter={(e) => {
            if (userManagementTab !== 'form') {
              e.currentTarget.style.background = '#f1f5f9';
            }
          }}
          onMouseLeave={(e) => {
            if (userManagementTab !== 'form') {
              e.currentTarget.style.background = 'transparent';
            }
          }}
        >
          <span className="material-icons" style={{ fontSize: isMobile ? '18px' : '20px' }}>person_add</span>
          <span>User Access Form</span>
        </button>
        <button
          className="user-management-tab-button"
          onClick={() => setUserManagementTab('users')}
          style={{
            flex: 1,
            padding: isMobile ? '10px 16px' : '12px 20px',
            borderRadius: '8px',
            border: 'none',
            background: userManagementTab === 'users' 
              ? '#3b82f6' 
              : 'transparent',
            color: userManagementTab === 'users' ? '#fff' : '#64748b',
            fontSize: isMobile ? '13px' : '14px',
            fontWeight: userManagementTab === 'users' ? 600 : 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: isMobile ? '6px' : '8px',
            transition: 'all 0.2s ease',
            whiteSpace: 'nowrap'
          }}
          onMouseEnter={(e) => {
            if (userManagementTab !== 'users') {
              e.currentTarget.style.background = '#f1f5f9';
            }
          }}
          onMouseLeave={(e) => {
            if (userManagementTab !== 'users') {
              e.currentTarget.style.background = 'transparent';
            }
          }}
        >
          <span className="material-icons" style={{ fontSize: isMobile ? '18px' : '20px' }}>group</span>
          <span>Users ({filteredUsers.length})</span>
        </button>
        <button
          className="user-management-tab-button"
          onClick={() => setUserManagementTab('routes')}
          style={{
            flex: 1,
            padding: isMobile ? '10px 16px' : '12px 20px',
            borderRadius: '8px',
            border: 'none',
            background: userManagementTab === 'routes' 
              ? '#3b82f6' 
              : 'transparent',
            color: userManagementTab === 'routes' ? '#fff' : '#64748b',
            fontSize: isMobile ? '13px' : '14px',
            fontWeight: userManagementTab === 'routes' ? 600 : 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: isMobile ? '6px' : '8px',
            transition: 'all 0.2s ease',
            whiteSpace: 'nowrap'
          }}
          onMouseEnter={(e) => {
            if (userManagementTab !== 'routes') {
              e.currentTarget.style.background = '#f1f5f9';
            }
          }}
          onMouseLeave={(e) => {
            if (userManagementTab !== 'routes') {
              e.currentTarget.style.background = 'transparent';
            }
          }}
        >
          <span className="material-icons" style={{ fontSize: isMobile ? '18px' : '20px' }}>route</span>
          <span>Routes ({routes.filter(route =>
            routeSearchTerm === '' ||
            route.name?.toLowerCase().includes(routeSearchTerm.toLowerCase()) ||
            route.assignedTo?.toLowerCase().includes(routeSearchTerm.toLowerCase())
          ).length})</span>
        </button>
      </div>

      {/* Tab Content Container */}
      <div style={{ position: 'relative', minHeight: 400 }}>
        {/* User Management Form Tab */}
        {userManagementTab === 'form' && (
          <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            {/* User Management Form */}
            <div className="user-form-container" style={{ 
        background: '#fff', 
        borderRadius: '12px', 
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)', 
        padding: isMobile ? '20px 16px' : '24px', 
        marginBottom: isMobile ? '20px' : '24px', 
        width: '100%', 
        boxSizing: 'border-box',
        border: '1px solid #e5e7eb'
      }}>
        <div className="user-form-header" style={{ 
          marginBottom: isMobile ? '20px' : '24px',
          paddingBottom: isMobile ? '16px' : '20px',
          borderBottom: '2px solid #e5e7eb'
        }}>
          <h3 style={{ 
            color: '#1e293b', 
            fontWeight: 600, 
            margin: 0, 
            fontSize: isMobile ? '18px' : '20px',
            display: 'flex',
            alignItems: 'center',
            gap: isMobile ? '8px' : '10px',
            marginBottom: '8px'
          }}>
            <span className="material-icons" style={{ fontSize: isMobile ? '20px' : '24px', color: '#3b82f6' }}>person_add</span>
            User Access Form
          </h3>
          <p style={{ 
            color: '#64748b', 
            fontSize: isMobile ? '13px' : '14px', 
            margin: 0,
            marginLeft: isMobile ? '0' : '34px'
          }}>
            Create new user access and assign permissions
          </p>
          {/* Show Subscribe button if no subscription, otherwise show user count badge */}
          {(!subscriptionInfo || !subscriptionInfo.planId || !subscriptionInfo.total_user_limit || subscriptionInfo.total_user_limit === 0) ? (
            <button
              onClick={() => navigate('/admin-dashboard?view=subscription')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 20px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: 20,
                cursor: 'pointer',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
                marginLeft: 'auto',
                fontSize: 14,
                fontWeight: 600,
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
              }}
              title="Subscribe to unlock user management features"
            >
              <span className="material-icons" style={{ fontSize: 18 }}>subscriptions</span>
              <span>Subscribe</span>
            </button>
          ) : subscriptionInfo && userCountInfo && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 14px',
                background: (userCountInfo?.count || 0) >= (subscriptionInfo?.total_user_limit || 0) 
                  ? '#fef2f2' 
                  : (userCountInfo?.count || 0) >= ((subscriptionInfo?.total_user_limit || 0) * 0.8) 
                    ? '#fef3c7' 
                    : '#f0fdf4',
                border: `1px solid ${
                  (userCountInfo?.count || 0) >= (subscriptionInfo?.total_user_limit || 0) 
                    ? '#fecaca' 
                    : (userCountInfo?.count || 0) >= ((subscriptionInfo?.total_user_limit || 0) * 0.8) 
                      ? '#fde68a' 
                      : '#86efac'
                }`,
                borderRadius: 20,
                cursor: (userCountInfo?.count || 0) >= (subscriptionInfo?.total_user_limit || 0) ? 'pointer' : 'default',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
                marginLeft: 'auto'
              }}
              onClick={() => {
                if ((userCountInfo?.count || 0) >= (subscriptionInfo?.total_user_limit || 0)) {
                  setShowPurchaseModal(true);
                } else {
                  navigate('/admin-dashboard?view=subscription');
                }
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
              title={(userCountInfo?.count || 0) >= (subscriptionInfo?.total_user_limit || 0) 
                ? 'User limit reached. Click to purchase more users.' 
                : 'Click to manage subscription'}
            >
              <span className="material-icons" style={{ 
                fontSize: 18, 
                color: (userCountInfo?.count || 0) >= (subscriptionInfo?.total_user_limit || 0) 
                  ? '#dc2626' 
                  : (userCountInfo?.count || 0) >= ((subscriptionInfo?.total_user_limit || 0) * 0.8) 
                    ? '#d97706' 
                    : '#16a34a'
              }}>
                {(userCountInfo?.count || 0) >= (subscriptionInfo?.total_user_limit || 0) ? 'warning' : 'people'}
              </span>
              <span style={{
                fontSize: 13,
                fontWeight: 600,
                color: (userCountInfo?.count || 0) >= (subscriptionInfo?.total_user_limit || 0) 
                  ? '#dc2626' 
                  : (userCountInfo?.count || 0) >= ((subscriptionInfo?.total_user_limit || 0) * 0.8) 
                    ? '#d97706' 
                    : '#16a34a'
              }}>
                {userCountInfo?.count || internalUsers.length || 0} / {subscriptionInfo?.total_user_limit} users
              </span>
              {(userCountInfo?.count || 0) >= (subscriptionInfo?.total_user_limit || 0) && subscriptionInfo?.total_user_limit > 0 && (
                <span className="material-icons" style={{ fontSize: 16, color: '#dc2626' }}>add_circle</span>
              )}
            </div>
          )}
        </div>
        
        <form onSubmit={handleCreateAccess}>
          {/* User Details Section */}
          <div style={{ marginBottom: 32, position: 'relative', zIndex: 1 }}>
            <div className="user-form-grid" style={{ 
              display: 'grid', 
              gridTemplateColumns: window.innerWidth <= 700 ? '1fr' : 'repeat(4, 1fr)', 
              gap: 24,
              marginBottom: 24
            }}>
              <div style={{ position: 'relative' }}>
                <label className="user-form-label" style={{ 
                  fontWeight: 700, 
                  color: '#1e293b', 
                  marginBottom: 10, 
                  display: 'flex', 
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 14 
                }}>
                  <span className="material-icons" style={{ fontSize: 18, color: '#3b82f6' }}>badge</span>
                  Role <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <select
                  name="roleId"
                  value={form.roleId}
                  onChange={handleInput}
                  required
                  disabled={rolesLoading}
                  className="user-form-select"
                  style={{
                    padding: '14px 18px',
                    borderRadius: 12,
                    border: `2px solid ${validationAttempted && !form.roleId ? '#dc2626' : '#e5e7eb'}`,
                    width: '100%',
                    fontSize: 15,
                    background: '#fff',
                    marginBottom: 0,
                    cursor: rolesLoading ? 'not-allowed' : 'pointer',
                    transition: 'all 0.3s ease',
                    boxSizing: 'border-box',
                    opacity: rolesLoading ? 0.6 : 1,
                    fontWeight: 500,
                    boxShadow: validationAttempted && !form.roleId ? '0 0 0 3px rgba(220, 38, 38, 0.1)' : '0 2px 8px rgba(0,0,0,0.04)'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#3b82f6';
                    e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                    e.target.style.transform = 'translateY(-1px)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = validationAttempted && !form.roleId ? '#dc2626' : '#e5e7eb';
                    e.target.style.boxShadow = validationAttempted && !form.roleId ? '0 0 0 3px rgba(220, 38, 38, 0.1)' : '0 2px 8px rgba(0,0,0,0.04)';
                    e.target.style.transform = 'translateY(0)';
                  }}
                >
                  <option value="">
                    {rolesLoading ? 'Loading roles...' : 'Select a role'}
                  </option>
                  {roles.map(role => (
                    <option key={role.id} value={role.id}>
                      {role.display_name}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ position: 'relative' }}>
                <label className="user-form-label" style={{ 
                  fontWeight: 700, 
                  color: '#1e293b', 
                  marginBottom: 10, 
                  display: 'flex', 
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 14 
                }}>
                  <span className="material-icons" style={{ fontSize: 18, color: '#3b82f6' }}>person</span>
                  User Name
                </label>
                <input 
                  name="userName" 
                  type="text"
                  value={form.userName} 
                  onChange={handleInput} 
                  required 
                  className="user-form-input"
                  style={{ 
                    padding: '14px 18px', 
                    borderRadius: 12, 
                    border: '2px solid #e5e7eb', 
                    width: '100%', 
                    fontSize: 15, 
                    background: '#fff', 
                    marginBottom: 0,
                    cursor: 'text',
                    transition: 'all 0.3s ease',
                    boxSizing: 'border-box',
                    fontWeight: 500,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                  }} 
                  placeholder="Enter user name"
                  onFocus={(e) => {
                    e.target.style.borderColor = '#3b82f6';
                    e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                    e.target.style.transform = 'translateY(-1px)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e5e7eb';
                    e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)';
                    e.target.style.transform = 'translateY(0)';
                  }}
                />
              </div>
              
              <div style={{ position: 'relative' }}>
                <label className="user-form-label" style={{ 
                  fontWeight: 700, 
                  color: '#1e293b', 
                  marginBottom: 10, 
                  display: 'flex', 
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 14 
                }}>
                  <span className="material-icons" style={{ fontSize: 18, color: '#3b82f6' }}>email</span>
                  Email ID
                </label>
                <input 
                  name="email" 
                  type="email"
                  value={form.email} 
                  onChange={handleInput} 
                  required 
                  className="user-form-input"
                  style={{ 
                    padding: '14px 18px', 
                    borderRadius: 12, 
                    border: '2px solid #e5e7eb', 
                    width: '100%', 
                    fontSize: 15, 
                    background: '#fff', 
                    marginBottom: 0,
                    cursor: 'text',
                    transition: 'all 0.3s ease',
                    boxSizing: 'border-box',
                    fontWeight: 500,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                  }} 
                  placeholder="user@example.com"
                  onFocus={(e) => {
                    e.target.style.borderColor = '#3b82f6';
                    e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                    e.target.style.transform = 'translateY(-1px)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e5e7eb';
                    e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)';
                    e.target.style.transform = 'translateY(0)';
                  }}
                />
              </div>
              
              <div style={{ position: 'relative' }}>
                <label className="user-form-label" style={{ 
                  fontWeight: 700, 
                  color: '#1e293b', 
                  marginBottom: 10, 
                  display: 'flex', 
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 14 
                }}>
                  <span className="material-icons" style={{ fontSize: 18, color: '#3b82f6' }}>phone</span>
                  Mobile
                </label>
                <input 
                  name="mobile" 
                  type="tel"
                  value={form.mobile} 
                  onChange={handleInput} 
                  required 
                  className="user-form-input"
                  style={{ 
                    padding: '14px 18px', 
                    borderRadius: 12, 
                    border: '2px solid #e5e7eb', 
                    width: '100%', 
                    fontSize: 15, 
                    background: '#fff', 
                    marginBottom: 0,
                    cursor: 'text',
                    transition: 'all 0.3s ease',
                    boxSizing: 'border-box',
                    fontWeight: 500,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                  }} 
                  placeholder="9876543210"
                  onFocus={(e) => {
                    e.target.style.borderColor = '#3b82f6';
                    e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                    e.target.style.transform = 'translateY(-1px)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e5e7eb';
                    e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)';
                    e.target.style.transform = 'translateY(0)';
                  }}
                />
              </div>
            </div>
            
            {/* External User Checkbox */}
            <div className="external-user-checkbox" style={{ 
              marginTop: isMobile ? '16px' : '20px', 
              marginBottom: isMobile ? '16px' : '20px',
              padding: isMobile ? '16px' : '20px',
              background: '#f0f9ff',
              borderRadius: '12px',
              border: '1px solid #bae6fd',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.4)';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.2)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
            >
              <label style={{ 
                display: 'flex', 
                alignItems: 'flex-start', 
                gap: 16, 
                cursor: 'pointer',
                fontSize: 15,
                lineHeight: 1.6
              }}>
                <div style={{
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  border: `2px solid ${form.isExternalUser ? '#3b82f6' : '#cbd5e1'}`,
                  background: form.isExternalUser ? 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)' : '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: 2,
                  transition: 'all 0.2s ease',
                  flexShrink: 0
                }}>
                  {form.isExternalUser && (
                    <span className="material-icons" style={{ fontSize: 16, color: '#fff' }}>check</span>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ 
                    color: '#1e293b', 
                    fontWeight: 700,
                    fontSize: 15,
                    marginBottom: 4,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8
                  }}>
                    <span className="material-icons" style={{ fontSize: 20, color: '#3b82f6' }}>person_outline</span>
                    External Users
                  </div>
                  <div style={{ 
                    color: '#64748b', 
                    fontWeight: 500,
                    fontSize: 13,
                    lineHeight: 1.5
                  }}>
                    Access only to Ledgers where Email matches in Ledger Master
                  </div>
                </div>
                <input
                  type="checkbox"
                  name="isExternalUser"
                  checked={form.isExternalUser}
                  onChange={(e) => setForm({ ...form, isExternalUser: e.target.checked })}
                  style={{
                    position: 'absolute',
                    opacity: 0,
                    width: 0,
                    height: 0
                  }}
                />
              </label>
            </div>
          </div>

          {/* Company Selection Section */}
          <div style={{ marginBottom: 32, position: 'relative', zIndex: 1 }}>
            <div className="company-selection-header" style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              marginBottom: isMobile ? '16px' : '20px',
              padding: isMobile ? '12px 16px' : '16px 20px',
              background: '#f0f9ff',
              borderRadius: '12px',
              border: '1px solid #bae6fd'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '12px' : '16px' }}>
                <span className="material-icons" style={{ fontSize: isMobile ? '20px' : '24px', color: '#3b82f6' }}>business</span>
                <div>
                  <h4 style={{ 
                    color: '#1e293b', 
                    fontWeight: 600, 
                    margin: 0, 
                    fontSize: isMobile ? '16px' : '18px',
                    marginBottom: form.companyGuids.length > 0 ? '4px' : '0'
                  }}>
                    Company Access
                  </h4>
                  {form.companyGuids.length > 0 && (
                    <div style={{ 
                      fontSize: isMobile ? '12px' : '13px', 
                      color: '#0369a1',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontWeight: 500
                    }}>
                      <span className="material-icons" style={{ fontSize: 16 }}>check_circle</span>
                      {form.companyGuids.length} company{form.companyGuids.length > 1 ? 'ies' : ''} selected
                    </div>
                  )}
                </div>
              </div>
              
              {connections.length > 0 && (
                <button
                  type="button"
                  onClick={handleSelectAll}
                  style={{
                    padding: isMobile ? '8px 16px' : '10px 20px',
                    background: form.companyGuids.length === connections.length 
                      ? '#ef4444' 
                      : '#3b82f6',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: isMobile ? '12px' : '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: isMobile ? '6px' : '8px',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.opacity = '0.9';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.opacity = '1';
                  }}
                >
                  <span className="material-icons" style={{ fontSize: isMobile ? '16px' : '18px' }}>
                    {form.companyGuids.length === connections.length ? 'check_box' : 'check_box_outline_blank'}
                  </span>
                  {form.companyGuids.length === connections.length ? 'Deselect All' : 'Select All'}
                </button>
              )}
            </div>
            
            <div style={{ 
              padding: isMobile ? '16px' : '20px',
              background: '#fff',
              borderRadius: '12px',
              border: '1px solid #e5e7eb',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              {connections.length > 0 ? (
                <>
                  <div className="company-selection-grid" style={{ 
                    display: 'grid', 
                    gridTemplateColumns: window.innerWidth <= 700 ? '1fr' : 'repeat(auto-fill, minmax(250px, 1fr))',
                    gap: 16, 
                    marginBottom: 12,
                    maxHeight: '280px',
                    overflowY: 'auto',
                    paddingRight: '8px',
                    alignItems: 'start'
                  }}>
                    {connections.map(conn => {
                      const isSelected = form.companyGuids.includes(conn.guid);
                      return (
                        <div
                          key={conn.guid}
                          onClick={() => handleCompanyToggle(conn.guid)}
                          style={{
                            padding: '16px 20px',
                            borderRadius: 14,
                            background: isSelected 
                              ? 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)' 
                              : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                            color: isSelected ? '#ffffff' : '#374151',
                            border: isSelected 
                              ? 'none' 
                              : '2px solid #e5e7eb',
                            cursor: 'pointer',
                            fontSize: 14,
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            transition: 'all 0.3s ease',
                            boxShadow: isSelected 
                              ? '0 6px 20px rgba(59, 130, 246, 0.35)' 
                              : '0 2px 8px rgba(0,0,0,0.08)',
                            width: '100%',
                            whiteSpace: 'normal',
                            wordWrap: 'break-word',
                            boxSizing: 'border-box',
                            position: 'relative',
                            overflow: 'hidden'
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.background = 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)';
                              e.currentTarget.style.borderColor = '#3b82f6';
                              e.currentTarget.style.transform = 'translateY(-3px)';
                              e.currentTarget.style.boxShadow = '0 8px 24px rgba(59, 130, 246, 0.2)';
                            } else {
                              e.currentTarget.style.transform = 'translateY(-2px)';
                              e.currentTarget.style.boxShadow = '0 8px 24px rgba(59, 130, 246, 0.45)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.background = 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)';
                              e.currentTarget.style.borderColor = '#e5e7eb';
                              e.currentTarget.style.transform = 'translateY(0)';
                              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
                            } else {
                              e.currentTarget.style.transform = 'translateY(0)';
                              e.currentTarget.style.boxShadow = '0 6px 20px rgba(59, 130, 246, 0.35)';
                            }
                          }}
                        >
                          <div style={{
                            width: 32,
                            height: 32,
                            borderRadius: 8,
                            background: isSelected ? 'rgba(255,255,255,0.2)' : 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            boxShadow: isSelected ? 'none' : '0 2px 8px rgba(59, 130, 246, 0.25)'
                          }}>
                            <span className="material-icons" style={{ 
                              fontSize: 18,
                              color: isSelected ? '#fff' : '#fff'
                            }}>
                              {isSelected ? 'check_circle' : 'business'}
                            </span>
                          </div>
                          <div style={{ 
                            fontWeight: 700, 
                            fontSize: 14,
                            color: isSelected ? '#ffffff' : '#1e293b',
                            textShadow: isSelected ? '0 1px 2px rgba(0,0,0,0.2)' : 'none',
                            flex: 1,
                            lineHeight: 1.4
                          }}>
                            {conn.company || 'Unknown Company'}
                          </div>
                          {isSelected && (
                            <div style={{
                              position: 'absolute',
                              top: 4,
                              right: 4,
                              width: 20,
                              height: 20,
                              borderRadius: '50%',
                              background: 'rgba(255,255,255,0.3)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}>
                              <span className="material-icons" style={{ fontSize: 14, color: '#fff' }}>check</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div style={{ 
                  textAlign: 'center', 
                  color: '#6b7280', 
                  fontSize: 15,
                  padding: '40px 20px',
                  background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                  borderRadius: 12,
                  border: '2px dashed #cbd5e1'
                }}>
                  <span className="material-icons" style={{ fontSize: 48, marginBottom: 12, display: 'block', color: '#cbd5e1' }}>business_center</span>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>No companies available</div>
                  <div style={{ fontSize: 13 }}>Please create connections first</div>
                </div>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 16, position: 'relative', zIndex: 1 }}>
            <button 
              type="submit" 
              disabled={formLoading || form.companyGuids.length === 0}
              className="user-form-submit-button"
              style={{ 
                padding: '18px 48px', 
                background: form.companyGuids.length === 0 
                  ? 'linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)' 
                  : 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)', 
                color: '#fff', 
                border: 'none', 
                borderRadius: 14, 
                fontWeight: 800, 
                fontSize: 17, 
                cursor: form.companyGuids.length === 0 ? 'not-allowed' : 'pointer', 
                opacity: formLoading ? 0.7 : 1, 
                boxShadow: form.companyGuids.length === 0 
                  ? 'none' 
                  : '0 6px 24px rgba(34,197,94,0.35)', 
                whiteSpace: 'nowrap',
                transition: 'all 0.3s ease',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                minWidth: 200,
                letterSpacing: '0.3px',
                position: 'relative',
                overflow: 'hidden'
              }}
              onMouseEnter={(e) => {
                if (!formLoading && form.companyGuids.length > 0) {
                  e.currentTarget.style.transform = 'translateY(-3px) scale(1.02)';
                  e.currentTarget.style.boxShadow = '0 8px 28px rgba(34,197,94,0.45)';
                }
              }}
              onMouseLeave={(e) => {
                if (!formLoading && form.companyGuids.length > 0) {
                  e.currentTarget.style.transform = 'translateY(0) scale(1)';
                  e.currentTarget.style.boxShadow = '0 6px 24px rgba(34,197,94,0.35)';
                }
              }}
            >
              <span className="material-icons" style={{ fontSize: 22, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.2))' }}>
                {formLoading ? 'sync' : 'person_add'}
              </span>
              {formLoading ? 'Granting Access...' : 'Grant Access'}
            </button>
          </div>
        </form>
        
        {/* Form Messages */}
        {formError && (
          <div className="user-form-message" style={{ 
            background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)', 
            border: '2px solid #fecaca',
            borderRadius: 14, 
            padding: '18px 20px', 
            marginTop: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            boxShadow: '0 4px 12px rgba(220, 38, 38, 0.15)',
            animation: 'slideIn 0.3s ease-out',
            position: 'relative',
            zIndex: 1
          }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <span className="material-icons" style={{ color: '#fff', fontSize: 22 }}>error</span>
            </div>
            <div style={{ color: '#dc2626', fontSize: 15, fontWeight: 600, flex: 1 }}>{formError}</div>
          </div>
        )}
        {formSuccess && (
          <div className="user-form-message" style={{ 
            background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)', 
            border: '2px solid #bbf7d0',
            borderRadius: 14, 
            padding: '18px 20px', 
            marginTop: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            boxShadow: '0 4px 12px rgba(22, 163, 74, 0.15)',
            animation: 'slideIn 0.3s ease-out',
            position: 'relative',
            zIndex: 1
          }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 4px 12px rgba(22, 163, 74, 0.3)'
            }}>
              <span className="material-icons" style={{ color: '#fff', fontSize: 22 }}>check_circle</span>
            </div>
            <div style={{ color: '#16a34a', fontSize: 15, fontWeight: 600, flex: 1 }}>{formSuccess}</div>
          </div>
        )}
      </div>
          </div>
        )}

        {/* Users Table Tab */}
        {userManagementTab === 'users' && (
          <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            {/* Internal Users Table */}
            <div className="users-table-container" style={{ 
        background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)', 
        borderRadius: 24, 
        boxShadow: '0 8px 32px rgba(0,0,0,0.12)', 
        padding: window.innerWidth <= 700 ? 24 : 40, 
        marginTop: 0, 
        width: '100%', 
        margin: '0 auto', 
        minHeight: 200, 
        boxSizing: 'border-box',
        border: '1px solid rgba(59, 130, 246, 0.1)',
        animation: 'fadeIn 0.7s ease-out',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Decorative gradient overlay */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '250px',
          height: '250px',
          background: 'radial-gradient(circle, rgba(59, 130, 246, 0.06) 0%, transparent 70%)',
          borderRadius: '50%',
          transform: 'translate(-20%, -20%)',
          pointerEvents: 'none'
        }} />
        
        <div className="users-table-header" style={{ 
          marginBottom: isMobile ? '20px' : '24px',
          paddingBottom: isMobile ? '16px' : '20px',
          borderBottom: '2px solid #e5e7eb'
        }}>
          <h3 style={{ 
            color: '#1e293b', 
            fontWeight: 600, 
            margin: 0, 
            fontSize: isMobile ? '18px' : '20px',
            display: 'flex',
            alignItems: 'center',
            gap: isMobile ? '8px' : '10px',
            marginBottom: '8px'
          }}>
            <span className="material-icons" style={{ fontSize: isMobile ? '20px' : '24px', color: '#3b82f6' }}>group</span>
            Users <span style={{ color: '#64748b', fontWeight: 500 }}>({filteredUsers.length})</span>
          </h3>
          <p style={{ 
            color: '#64748b', 
            fontSize: isMobile ? '13px' : '14px', 
            margin: 0,
            marginLeft: isMobile ? '0' : '34px'
          }}>
            Manage user access and permissions
          </p>
          
          {/* Search Input */}
          <div className="users-search-input" style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 12,
            background: '#fff',
            padding: '10px 16px',
            borderRadius: 12,
            border: '2px solid #e5e7eb',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            transition: 'all 0.3s ease'
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = '#3b82f6';
            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = '#e5e7eb';
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)';
          }}
          >
            <span className="material-icons" style={{ color: '#3b82f6', fontSize: 22 }}>search</span>
            <input
              type="text"
              value={userSearchTerm}
              onChange={(e) => setUserSearchTerm(e.target.value)}
              placeholder="Search users..."
              style={{
                border: 'none',
                outline: 'none',
                fontSize: 15,
                fontWeight: 500,
                width: 220,
                background: 'transparent',
                color: '#1e293b'
              }}
            />
          </div>
        </div>
        
        {/* Loading State */}
        {usersLoading && (
          <div className="users-loading-state" style={{ 
            textAlign: 'center', 
            padding: 60, 
            color: '#64748b',
            background: '#f8fafc',
            borderRadius: 12,
            margin: '16px 0'
          }}>
            <span className="material-icons" style={{ fontSize: 48, color: '#3b82f6', marginBottom: 16, display: 'block' }}>sync</span>
            <div style={{ fontSize: 16, fontWeight: 500 }}>Loading internal users...</div>
          </div>
        )}

        {/* Empty State */}
        {!usersLoading && filteredUsers.length === 0 && (
          <div className="users-empty-state" style={{ 
            textAlign: 'center', 
            padding: 60, 
            color: '#64748b',
            background: '#f8fafc',
            borderRadius: 12,
            margin: '16px 0'
          }}>
            <span className="material-icons" style={{ fontSize: 64, color: '#cbd5e1', marginBottom: 16, display: 'block' }}>group</span>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
              {userSearchTerm ? 'No users found matching your search' : 'No users found'}
            </div>
            <div style={{ fontSize: 14 }}>
              {userSearchTerm ? 'Try adjusting your search term' : 'Create access using the form above'}
            </div>
          </div>
        )}

        {/* Users Table */}
        {!usersLoading && filteredUsers.length > 0 && (
          <div className="users-table-wrapper" style={{ 
            overflowX: 'auto',
            maxHeight: '600px',
            overflowY: 'auto',
            border: '2px solid rgba(59, 130, 246, 0.15)',
            borderRadius: 16,
            background: '#fff',
            boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
            position: 'relative',
            zIndex: 1
          }}>
            <table className="users-table" style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 14 }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                <tr style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)' }}>
                  <th style={{ 
                    padding: '16px 20px', 
                    textAlign: 'left', 
                    fontWeight: 700, 
                    color: '#fff',
                    fontSize: 13,
                    textTransform: 'uppercase',
                    letterSpacing: '0.8px',
                    borderBottom: 'none',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}>User Details</th>
                  <th style={{ 
                    padding: '16px 20px', 
                    textAlign: 'left', 
                    fontWeight: 700, 
                    color: '#fff',
                    fontSize: 13,
                    textTransform: 'uppercase',
                    letterSpacing: '0.8px',
                    borderBottom: 'none',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}>Company Access</th>
                  <th style={{ 
                    padding: '16px 20px', 
                    textAlign: 'left', 
                    fontWeight: 700, 
                    color: '#fff',
                    fontSize: 13,
                    textTransform: 'uppercase',
                    letterSpacing: '0.8px',
                    borderBottom: 'none',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}>Role</th>
                  <th style={{ 
                    padding: '16px 20px', 
                    textAlign: 'left', 
                    fontWeight: 700, 
                    color: '#fff',
                    fontSize: 13,
                    textTransform: 'uppercase',
                    letterSpacing: '0.8px',
                    borderBottom: 'none',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}>User Type</th>
                  <th style={{ 
                    padding: '16px 20px', 
                    textAlign: 'left', 
                    fontWeight: 700, 
                    color: '#fff',
                    fontSize: 13,
                    textTransform: 'uppercase',
                    letterSpacing: '0.8px',
                    borderBottom: 'none',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}>Status</th>
                  <th style={{ 
                    padding: '16px 20px', 
                    textAlign: 'left', 
                    fontWeight: 700, 
                    color: '#fff',
                    fontSize: 13,
                    textTransform: 'uppercase',
                    letterSpacing: '0.8px',
                    borderBottom: 'none',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user, index) => (
                  <tr 
                    key={`${user.userId}-${user.email}`} 
                    style={{ 
                      background: index % 2 === 0 ? '#fff' : '#f8fafc',
                      borderBottom: '1px solid #e2e8f0',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)';
                      e.currentTarget.style.transform = 'scale(1.01)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = index % 2 === 0 ? '#fff' : '#f8fafc';
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <td style={{ padding: '20px', verticalAlign: 'top' }}>
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'flex-start', 
                        gap: 14
                      }}>
                        <div style={{
                          width: 44,
                          height: 44,
                          borderRadius: 12,
                          background: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          boxShadow: '0 4px 12px rgba(59, 130, 246, 0.25)'
                        }}>
                          <span className="material-icons" style={{ fontSize: 22, color: '#fff' }}>person</span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, color: '#1e293b', marginBottom: 6, fontSize: 15 }}>{user.name}</div>
                          <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span className="material-icons" style={{ fontSize: 16, color: '#94a3b8' }}>email</span>
                            {user.email}
                          </div>
                          {user.mobileno && (
                            <div style={{ fontSize: 13, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span className="material-icons" style={{ fontSize: 16, color: '#94a3b8' }}>phone</span>
                              {user.mobileno}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '20px', verticalAlign: 'top' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          padding: '8px 14px',
                          background: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)',
                          color: '#0369a1',
                          borderRadius: 10,
                          fontSize: 13,
                          fontWeight: 700,
                          border: '1px solid #7dd3fc',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          boxShadow: '0 2px 8px rgba(59, 130, 246, 0.15)'
                        }}>
                          <span className="material-icons" style={{ fontSize: 18 }}>business</span>
                          {user.companies.length} companies
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '20px', verticalAlign: 'top' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
                        {(() => {
                          const roleInfo = getConsolidatedRole(user.companies);
                          let bgColor, textColor, borderColor;
                          
                          switch (roleInfo.style) {
                            case 'single':
                              bgColor = '#f0f9ff';
                              textColor = '#1e40af';
                              borderColor = '#dbeafe';
                              break;
                            case 'multi':
                              bgColor = '#fef3c7';
                              textColor = '#92400e';
                              borderColor = '#fde68a';
                              break;
                            case 'none':
                            default:
                              bgColor = '#f1f5f9';
                              textColor = '#64748b';
                              borderColor = '#e2e8f0';
                              break;
                          }
                          
                          return (
                            <span style={{
                              padding: '4px 12px',
                              background: bgColor,
                              color: textColor,
                              borderRadius: 12,
                              fontSize: 12,
                              fontWeight: 500,
                              border: `1px solid ${borderColor}`,
                              width: 'fit-content'
                            }}>
                              {roleInfo.display}
                            </span>
                          );
                        })()}
                      </div>
                    </td>
                    <td style={{ padding: '20px', verticalAlign: 'top' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
                        {(() => {
                          const userTypeInfo = getConsolidatedUserType(user.companies);
                          let bgColor, textColor, borderColor;
                          
                          switch (userTypeInfo.style) {
                            case 'external':
                              bgColor = '#fef3c7';
                              textColor = '#92400e';
                              borderColor = '#fde68a';
                              break;
                            case 'internal':
                              bgColor = '#dcfce7';
                              textColor = '#166534';
                              borderColor = '#bbf7d0';
                              break;
                            case 'multi':
                              bgColor = '#f3e8ff';
                              textColor = '#7c3aed';
                              borderColor = '#ddd6fe';
                              break;
                            case 'none':
                            default:
                              bgColor = '#f1f5f9';
                              textColor = '#64748b';
                              borderColor = '#e2e8f0';
                              break;
                          }
                          
                          return (
                            <span style={{
                              padding: '4px 12px',
                              background: bgColor,
                              color: textColor,
                              borderRadius: 12,
                              fontSize: 12,
                              fontWeight: 500,
                              border: `1px solid ${borderColor}`,
                              width: 'fit-content'
                            }}>
                              {userTypeInfo.display}
                            </span>
                          );
                        })()}
                      </div>
                    </td>
                    <td style={{ padding: '20px', verticalAlign: 'top' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{
                          padding: '6px 12px',
                          background: user.userActive 
                            ? 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)' 
                            : 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
                          color: user.userActive ? '#166534' : '#dc2626',
                          borderRadius: 10,
                          fontSize: 12,
                          fontWeight: 700,
                          border: `1px solid ${user.userActive ? '#86efac' : '#fca5a5'}`,
                          width: 'fit-content',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                        }}>
                          <span className="material-icons" style={{ fontSize: 16 }}>
                            {user.userActive ? 'check_circle' : 'cancel'}
                          </span>
                          {user.userActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '20px', verticalAlign: 'top' }}>
                      <div className="users-table-actions" style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start', width: '100%' }}>
                        <div style={{ display: 'flex', gap: 6, width: '100%' }}>
                          <button
                            className="user-action-button"
                            style={{
                              padding: '7px 14px',
                              background: '#4285F4',
                              color: '#fff',
                              border: 'none',
                              borderRadius: 8,
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: 'pointer',
                              flex: 1,
                              transition: 'all 0.2s ease',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 5,
                              boxShadow: '0 2px 4px rgba(66, 133, 244, 0.25)',
                              whiteSpace: 'nowrap',
                              minWidth: 0
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = '#357ae8';
                              e.currentTarget.style.boxShadow = '0 3px 6px rgba(66, 133, 244, 0.35)';
                              e.currentTarget.style.transform = 'translateY(-1px)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = '#4285F4';
                              e.currentTarget.style.boxShadow = '0 2px 4px rgba(66, 133, 244, 0.25)';
                              e.currentTarget.style.transform = 'translateY(0)';
                            }}
                            onClick={() => openEditModal(user)}
                          >
                            <span className="material-icons" style={{ fontSize: 16 }}>edit</span>
                            Edit
                          </button>
                          <button
                            className="user-action-button"
                            style={{
                              padding: '7px 14px',
                              background: deletingEmail === user.email ? '#9ca3af' : '#EA4335',
                              color: '#fff',
                              border: 'none',
                              borderRadius: 8,
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: deletingEmail === user.email ? 'not-allowed' : 'pointer',
                              opacity: deletingEmail === user.email ? 0.8 : 1,
                              flex: 1,
                              transition: 'all 0.2s ease',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 5,
                              boxShadow: deletingEmail === user.email ? 'none' : '0 2px 4px rgba(234, 67, 53, 0.25)',
                              whiteSpace: 'nowrap',
                              minWidth: 0
                            }}
                            onMouseEnter={(e) => {
                              if (deletingEmail !== user.email) {
                                e.currentTarget.style.background = '#d33b2c';
                                e.currentTarget.style.boxShadow = '0 3px 6px rgba(234, 67, 53, 0.35)';
                                e.currentTarget.style.transform = 'translateY(-1px)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (deletingEmail !== user.email) {
                                e.currentTarget.style.background = '#EA4335';
                                e.currentTarget.style.boxShadow = '0 2px 4px rgba(234, 67, 53, 0.25)';
                                e.currentTarget.style.transform = 'translateY(0)';
                              }
                            }}
                            disabled={deletingEmail === user.email}
                            onClick={() => handleRemoveAllAccess(user)}
                          >
                            <span className="material-icons" style={{ fontSize: 16 }}>delete</span>
                            {deletingEmail === user.email ? 'Removing...' : 'Delete'}
                          </button>
                        </div>
                        {isSalesperson(user) && (
                          <button
                            style={{
                              padding: '8px 18px',
                              background: 'linear-gradient(135deg, #2563eb 0%, #1e3a8a 100%)',
                              color: '#fb9602',
                              border: 'none',
                              borderRadius: 8,
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: 'pointer',
                              width: '100%',
                              boxSizing: 'border-box',
                              transition: 'all 0.3s ease',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 6,
                              marginTop: 6,
                              boxShadow: '0 2px 8px rgba(30, 58, 138, 0.35)',
                              whiteSpace: 'nowrap',
                              letterSpacing: '0.3px',
                              position: 'relative',
                              overflow: 'hidden'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%)';
                              e.currentTarget.style.boxShadow = '0 4px 12px rgba(30, 58, 138, 0.45)';
                              e.currentTarget.style.transform = 'translateY(-2px)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'linear-gradient(135deg, #2563eb 0%, #1e3a8a 100%)';
                              e.currentTarget.style.boxShadow = '0 2px 8px rgba(30, 58, 138, 0.35)';
                              e.currentTarget.style.transform = 'translateY(0)';
                            }}
                            onClick={() => handleRouteActions(user)}
                          >
                            <span className="material-icons" style={{ fontSize: 17, color: '#fb9602', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.2))' }}>settings</span>
                            Route Actions
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
          </div>
        )}

        {/* Routes Tab */}
        {userManagementTab === 'routes' && (
          <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            {/* Routes Container */}
            <div className="routes-container" style={{ 
        background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)', 
        borderRadius: 24, 
        boxShadow: '0 8px 32px rgba(0,0,0,0.12)', 
        padding: window.innerWidth <= 700 ? 24 : 40, 
        marginTop: 32,
        minHeight: 200, 
        boxSizing: 'border-box',
        border: '1px solid rgba(59, 130, 246, 0.1)',
        animation: 'fadeIn 0.8s ease-out',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Decorative gradient overlay */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          right: 0,
          width: '250px',
          height: '250px',
          background: 'radial-gradient(circle, rgba(59, 130, 246, 0.06) 0%, transparent 70%)',
          borderRadius: '50%',
          transform: 'translate(20%, 20%)',
          pointerEvents: 'none'
        }} />
        
        <div className="routes-header" style={{ 
          marginBottom: isMobile ? '20px' : '24px',
          paddingBottom: isMobile ? '16px' : '20px',
          borderBottom: '2px solid #e5e7eb'
        }}>
          <h3 style={{ 
            color: '#1e293b', 
            fontWeight: 600, 
            margin: 0, 
            fontSize: isMobile ? '18px' : '20px',
            display: 'flex',
            alignItems: 'center',
            gap: isMobile ? '8px' : '10px',
            marginBottom: '8px'
          }}>
            <span className="material-icons" style={{ fontSize: isMobile ? '20px' : '24px', color: '#3b82f6' }}>route</span>
            Routes <span style={{ color: '#64748b', fontWeight: 500 }}>({routes.filter(route => 
              routeSearchTerm === '' || 
              route.name?.toLowerCase().includes(routeSearchTerm.toLowerCase()) ||
              route.assignedTo?.toLowerCase().includes(routeSearchTerm.toLowerCase())
            ).length})</span>
          </h3>
          <p style={{ 
            color: '#64748b', 
            fontSize: isMobile ? '13px' : '14px', 
            margin: 0,
            marginLeft: isMobile ? '0' : '34px'
          }}>
            Manage delivery routes and assignments
          </p>
          
          <div className="routes-search-create" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Search Input */}
            <div className="routes-search-input" style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 12,
              background: '#fff',
              padding: '10px 16px',
              borderRadius: 12,
              border: '2px solid #e5e7eb',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              transition: 'all 0.3s ease'
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = '#3b82f6';
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = '#e5e7eb';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)';
            }}
            >
              <span className="material-icons" style={{ color: '#3b82f6', fontSize: 22 }}>search</span>
              <input
                type="text"
                value={routeSearchTerm}
                onChange={(e) => setRouteSearchTerm(e.target.value)}
                placeholder="Search routes..."
                style={{
                  border: 'none',
                  outline: 'none',
                  fontSize: 15,
                  fontWeight: 500,
                  width: 220,
                  background: 'transparent',
                  color: '#1e293b'
                }}
              />
            </div>
            
            {/* Create New Route Button */}
            <button
              className="routes-create-button"
              style={{
                padding: '12px 24px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                transition: 'all 0.3s ease',
                boxShadow: '0 4px 15px rgba(59, 130, 246, 0.3)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(59, 130, 246, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 15px rgba(59, 130, 246, 0.3)';
              }}
              onClick={() => {
                setRouteName('');
                setRouteDescription('');
                setPincodeInput('');
                setSelectedPincode('');
                setCustomerSearchInput('');
                setFilterMode('keyword');
                setSelectedCustomers([]);
                setCustomerCoordinates({});
                loadCustomers();
                // Reset company selection to all companies (will be set by useEffect when uniqueCompanies is available)
                setSelectedCompanies([]);
                setShowCreateRouteModal(true);
              }}
            >
              <span className="material-icons" style={{ fontSize: 18 }}>add</span>
              Create new route
            </button>
          </div>
        </div>
        
        {/* Loading State */}
        {routesLoading && (
          <div className="routes-loading-state" style={{ 
            textAlign: 'center', 
            padding: 60, 
            color: '#64748b',
            background: '#f8fafc',
            borderRadius: 12,
            margin: '16px 0'
          }}>
            <span className="material-icons" style={{ fontSize: 48, color: '#3b82f6', marginBottom: 16, display: 'block' }}>sync</span>
            <div style={{ fontSize: 16, fontWeight: 500 }}>Loading routes...</div>
          </div>
        )}

        {/* Empty State */}
        {!routesLoading && routes.filter(route => 
          routeSearchTerm === '' || 
          route.name?.toLowerCase().includes(routeSearchTerm.toLowerCase()) ||
          route.assignedTo?.toLowerCase().includes(routeSearchTerm.toLowerCase())
        ).length === 0 && (
          <div className="routes-empty-state" style={{ 
            textAlign: 'center', 
            padding: 60, 
            color: '#64748b',
            background: '#f8fafc',
            borderRadius: 12,
            margin: '16px 0'
          }}>
            <span className="material-icons" style={{ fontSize: 64, color: '#cbd5e1', marginBottom: 16, display: 'block' }}>route</span>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
              {routeSearchTerm ? 'No routes found matching your search' : 'No routes found'}
            </div>
            <div style={{ fontSize: 14 }}>
              {routeSearchTerm ? 'Try adjusting your search term' : 'Create a new route using the button above'}
            </div>
          </div>
        )}

        {/* Routes Table */}
        {!routesLoading && routes.filter(route => 
          routeSearchTerm === '' || 
          route.name?.toLowerCase().includes(routeSearchTerm.toLowerCase()) ||
          route.assignedTo?.toLowerCase().includes(routeSearchTerm.toLowerCase())
        ).length > 0 && (
          <div className="routes-table-wrapper" style={{ 
            overflowX: 'auto',
            maxHeight: '600px',
            overflowY: 'auto',
            border: '2px solid rgba(16, 185, 129, 0.15)',
            borderRadius: 16,
            background: '#fff',
            boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
            position: 'relative',
            zIndex: 1
          }}>
            <table className="routes-table" style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 14 }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                <tr style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' }}>
                  <th style={{ 
                    padding: '16px 20px', 
                    textAlign: 'left', 
                    fontWeight: 700, 
                    color: '#fff',
                    fontSize: 13,
                    textTransform: 'uppercase',
                    letterSpacing: '0.8px',
                    borderBottom: 'none',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}>Route Name</th>
                  <th style={{ 
                    padding: '16px 20px', 
                    textAlign: 'left', 
                    fontWeight: 700, 
                    color: '#fff',
                    fontSize: 13,
                    textTransform: 'uppercase',
                    letterSpacing: '0.8px',
                    borderBottom: 'none',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}>Customers</th>
                  <th style={{ 
                    padding: '16px 20px', 
                    textAlign: 'left', 
                    fontWeight: 700, 
                    color: '#fff',
                    fontSize: 13,
                    textTransform: 'uppercase',
                    letterSpacing: '0.8px',
                    borderBottom: 'none',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}>Pincodes</th>
                  <th style={{ 
                    padding: '16px 20px', 
                    textAlign: 'left', 
                    fontWeight: 700, 
                    color: '#fff',
                    fontSize: 13,
                    textTransform: 'uppercase',
                    letterSpacing: '0.8px',
                    borderBottom: 'none',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}>Currently Assigned To</th>
                  <th style={{ 
                    padding: '16px 20px', 
                    textAlign: 'left', 
                    fontWeight: 700, 
                    color: '#fff',
                    fontSize: 13,
                    textTransform: 'uppercase',
                    letterSpacing: '0.8px',
                    borderBottom: 'none',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {routes.filter(route => 
                  routeSearchTerm === '' || 
                  route.name?.toLowerCase().includes(routeSearchTerm.toLowerCase()) ||
                  route.assignedTo?.toLowerCase().includes(routeSearchTerm.toLowerCase())
                ).map((route, index) => (
                  <tr
                    key={route.id || index}
                    style={{
                      background: index % 2 === 0 ? '#ffffff' : '#f8fafc',
                      borderBottom: '1px solid #e2e8f0',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)';
                      e.currentTarget.style.transform = 'scale(1.01)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = index % 2 === 0 ? '#ffffff' : '#f8fafc';
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <td style={{ padding: '20px', verticalAlign: 'top' }}>
                      <div style={{ 
                        fontWeight: 600, 
                        color: '#1e293b', 
                        fontSize: 14,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8
                      }}>
                        <div style={{
                          width: 32,
                          height: 32,
                          borderRadius: 6,
                          background: '#e0f2fe',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          <span className="material-icons" style={{ fontSize: 18, color: '#3b82f6' }}>route</span>
                        </div>
                        {route.name || 'Unnamed Route'}
                      </div>
                    </td>
                    <td style={{ padding: '20px', verticalAlign: 'top' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {/* Customer Names List */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {route.customer_names && route.customer_names.length > 0 ? (
                            route.customer_names.map((customerName, idx) => (
                              <div
                                key={idx}
                                style={{
                                  padding: '6px 12px',
                                  background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
                                  color: '#1e40af',
                                  borderRadius: 8,
                                  fontSize: 12,
                                  fontWeight: 600,
                                  border: '1px solid #93c5fd',
                                  boxShadow: '0 2px 4px rgba(59, 130, 246, 0.15)'
                                }}
                              >
                                {customerName}
                              </div>
                            ))
                          ) : (
                            <div style={{ color: '#94a3b8', fontSize: 13, fontStyle: 'italic' }}>
                              No customers
                            </div>
                          )}
                        </div>
                        {/* Customer Count */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6
                        }}>
                          <span style={{
                            padding: '6px 12px',
                            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                            color: '#ffffff',
                            borderRadius: 8,
                            fontSize: 12,
                            fontWeight: 700,
                            border: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            boxShadow: '0 2px 8px rgba(59, 130, 246, 0.25)'
                          }}>
                            <span className="material-icons" style={{ fontSize: 16 }}>people</span>
                            {route.customerCount || route.customer_names?.length || 0} total
                          </span>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '20px', verticalAlign: 'top' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {(() => {
                          // Get unique pincodes from customers in this route
                          const routeCustomerIds = route.customer_ids || [];
                          const routePincodes = new Set();
                          
                          // Get pincodes from customers array
                          routeCustomerIds.forEach(customerId => {
                            const customer = customers.find(c => c.customer_id === customerId);
                            if (customer && customer.pincode) {
                              routePincodes.add(customer.pincode);
                            }
                          });
                          
                          // Also check if pincodes are stored in route data
                          if (routeCustomerIds.length > 0 && routePincodes.size === 0) {
                            // Fallback: try to get from localStorage
                            const storedCustomers = JSON.parse(localStorage.getItem('route_customers') || '[]');
                            routeCustomerIds.forEach(customerId => {
                              const customer = storedCustomers.find(c => c.customer_id === customerId);
                              if (customer && customer.pincode) {
                                routePincodes.add(customer.pincode);
                              }
                            });
                          }
                          
                          const uniquePincodes = Array.from(routePincodes).sort();
                          
                          if (uniquePincodes.length > 0) {
                            return uniquePincodes.map((pincode, idx) => (
                              <div
                                key={idx}
                                style={{
                                  padding: '6px 12px',
                                  background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                                  color: '#92400e',
                                  borderRadius: 8,
                                  fontSize: 12,
                                  fontWeight: 700,
                                  border: '1px solid #fcd34d',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  boxShadow: '0 2px 4px rgba(245, 158, 11, 0.15)'
                                }}
                              >
                                <span className="material-icons" style={{ fontSize: 16 }}>location_on</span>
                                {pincode}
                              </div>
                            ));
                          } else {
                            return (
                              <div style={{ color: '#94a3b8', fontSize: 13, fontStyle: 'italic' }}>
                                No pincodes
                              </div>
                            );
                          }
                        })()}
                      </div>
                    </td>
                    <td style={{ padding: '20px', verticalAlign: 'top' }}>
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center',
                        gap: 8
                      }}>
                        {route.assignedTo ? (
                          (() => {
                            // Find user by email to get the name
                            const assignedUser = internalUsers.find(u => u.email === route.assignedTo);
                            const displayName = assignedUser ? assignedUser.name : route.assignedTo;
                            
                            return (
                              <div style={{
                                padding: '6px 12px',
                                background: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)',
                                color: '#166534',
                                borderRadius: 8,
                                fontSize: 13,
                                fontWeight: 700,
                                border: '1px solid #86efac',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.2)'
                              }}>
                                <span className="material-icons" style={{ fontSize: 18, color: '#10b981' }}>check_circle</span>
                                {displayName}
                              </div>
                            );
                          })()
                        ) : (
                          <div style={{
                            padding: '6px 12px',
                            background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
                            color: '#64748b',
                            borderRadius: 8,
                            fontSize: 13,
                            fontWeight: 600,
                            border: '1px solid #cbd5e1',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6
                          }}>
                            <span className="material-icons" style={{ fontSize: 18, color: '#94a3b8' }}>cancel</span>
                            <span style={{ fontStyle: 'italic' }}>Not assigned</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '20px', verticalAlign: 'top' }}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          style={{
                            padding: '8px 16px',
                            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 10,
                            fontSize: 13,
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'all 0.3s ease',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            boxShadow: '0 2px 8px rgba(59, 130, 246, 0.25)'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)';
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.35)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)';
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 2px 8px rgba(59, 130, 246, 0.25)';
                          }}
                          onClick={() => handleEditRoute(route)}
                        >
                          <span className="material-icons" style={{ fontSize: 16 }}>edit</span>
                          Edit
                        </button>
                        <button
                          style={{
                            padding: '8px 16px',
                            background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 10,
                            fontSize: 13,
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'all 0.3s ease',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            boxShadow: '0 2px 8px rgba(239, 68, 68, 0.25)'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)';
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.35)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 2px 8px rgba(239, 68, 68, 0.25)';
                          }}
                          onClick={() => handleDeleteRoute(route)}
                        >
                          <span className="material-icons" style={{ fontSize: 16 }}>delete</span>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50
        }}>
          <div style={{
            width: '90%', maxWidth: 900, background: '#fff', borderRadius: 16,
            boxShadow: '0 20px 50px rgba(0,0,0,0.2)', overflow: 'hidden'
          }}>
            <div style={{ padding: 20, borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="material-icons" style={{ color: '#1e40af' }}>edit</span>
                <div style={{ fontWeight: 700, color: '#0f172a' }}>Edit Company Access</div>
              </div>
              <button onClick={closeEditModal} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>
                <span className="material-icons">close</span>
              </button>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ marginBottom: 12, color: '#475569', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  {editingUser ? `${editingUser.name} • ${editingUser.email}` : ''}
                </div>
                {editingUser && (
                  <span style={{
                    padding: '6px 12px',
                    background: '#e0f2fe',
                    color: '#0369a1',
                    borderRadius: 12,
                    fontSize: 13,
                    fontWeight: 600,
                    border: '1px solid #bae6fd',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}>
                    <span className="material-icons" style={{ fontSize: 16 }}>business</span>
                    {(editingUser.companies || []).length} companies
                  </span>
                )}
              </div>
              
              {/* Integrated Company Access & Settings */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ fontWeight: 600, color: '#334155', fontSize: 16 }}>Company Access & Settings</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    Selected: {editSelectedGuids.length} / {mergedEditCompanies.length}
                  </div>
                </div>
                {!!mergedEditCompanies.length && (
                  <button type="button" onClick={toggleEditSelectAll} style={{
                    padding: '6px 12px', background: '#1e40af', color: '#fff', border: 'none', borderRadius: 16, fontSize: 12, fontWeight: 600, cursor: 'pointer'
                  }}>
                    {editSelectedGuids.length === mergedEditCompanies.length ? 'Deselect All' : 'Select All'}
                  </button>
                )}
              </div>
                
                {/* Column Headers */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '8px 16px',
                  background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
                  borderRadius: '8px 8px 0 0',
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#64748b',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  <div style={{ width: 20 }}></div>
                  <div style={{ flex: 1 }}>Company</div>
                  <div style={{ minWidth: 220 }}>Role *</div>
                  <div style={{ minWidth: 100 }}>User Type</div>
                </div>
                
                <div style={{
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: 2, 
                  maxHeight: 400, 
                  overflowY: 'auto', 
                  border: '1px solid #e5e7eb',
                  borderRadius: '0 0 8px 8px',
                  background: '#fafbfc'
                }}>
                  {mergedEditCompanies.map(conn => {
                    const isSelected = editSelectedGuids.includes(conn.guid);
                    const settings = editCompanySettings[conn.guid] || { roleId: '', isExternalUser: false };
                    
                    return (
                      <div key={conn.guid} style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid #e5e7eb',
                        background: isSelected ? '#eff6ff' : '#fff',
                        transition: 'all 0.2s'
                      }}>
                        {/* Company Header with Inline Settings */}
                        <div style={{
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 12,
                          minHeight: 48
                        }}>
                          {/* Checkbox */}
                          <span 
                            className="material-icons" 
                       onClick={() => toggleEditCompany(conn.guid)}
                       style={{
                              color: isSelected ? '#1e40af' : '#94a3b8', 
                              fontSize: 20,
                              cursor: 'pointer'
                            }}
                          >
                            {isSelected ? 'check_box' : 'check_box_outline_blank'}
                    </span>
                          
                          {/* Company Name - Expanded Width */}
                          <div 
                            onClick={() => toggleEditCompany(conn.guid)}
                            style={{ 
                              fontWeight: 600, 
                              color: isSelected ? '#1e40af' : '#374151', 
                              fontSize: 14,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              cursor: 'pointer',
                              flex: 1
                            }}
                          >
                            <span className="material-icons" style={{ fontSize: 16 }}>business</span>
                            {conn.company || conn.companyName}
                          </div>
                          
                          {/* Role Dropdown - Right Side */}
                          <div style={{ minWidth: 220 }}>
                            {isSelected ? (
                              <select
                                value={settings.roleId}
                                onChange={(e) => setEditCompanySettings(prev => ({
                                  ...prev,
                                  [conn.guid]: { ...settings, roleId: e.target.value }
                                }))}
                                disabled={rolesLoading}
                                required
                                style={{
                                  padding: '6px 8px',
                                  borderRadius: 4,
                                  border: `1px solid ${!settings.roleId ? '#dc2626' : '#d1d5db'}`,
                                  width: '100%',
                                  fontSize: 12,
                                  background: '#fff',
                                  cursor: rolesLoading ? 'not-allowed' : 'pointer',
                                  boxSizing: 'border-box',
                                  height: '32px'
                                }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <option value="">Select Role *</option>
                                {roles.map(role => (
                                  <option key={role.id} value={role.id}>
                                    {role.display_name}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <div style={{ height: '32px' }}></div>
                            )}
                          </div>
                          
                          {/* User Type Checkbox - Right Side */}
                          <div style={{ minWidth: 100 }}>
                            {isSelected ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <label 
                                  onClick={(e) => e.stopPropagation()}
                                  style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: 6, 
                                    cursor: 'pointer',
                                    fontSize: 12,
                                    padding: '6px 8px',
                                    border: '1px solid #d1d5db',
                                    borderRadius: 4,
                                    background: '#fff',
                                    height: '32px',
                                    boxSizing: 'border-box'
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={settings.isExternalUser}
                                    onChange={(e) => setEditCompanySettings(prev => ({
                                      ...prev,
                                      [conn.guid]: { ...settings, isExternalUser: e.target.checked }
                                    }))}
                                    style={{
                                      cursor: 'pointer'
                                    }}
                                  />
                                  <span style={{ color: '#374151', fontWeight: 400 }}>
                                    External
                                  </span>
                                </label>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openGroupModal(conn);
                                  }}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: '4px',
                                    borderRadius: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#64748b',
                                    transition: 'all 0.2s ease',
                                    width: '24px',
                                    height: '24px'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.target.style.background = '#f1f5f9';
                                    e.target.style.color = '#374151';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.target.style.background = 'none';
                                    e.target.style.color = '#64748b';
                                  }}
                                  title="Company Settings"
                                >
                                  <span className="material-icons" style={{ fontSize: 16 }}>
                                    settings
                                  </span>
                                </button>
                              </div>
                            ) : (
                              <div style={{ height: '32px' }}></div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            
            {/* Note about External Users */}
            <div style={{ 
              padding: '12px 16px', 
              background: '#f0f9ff', 
              borderTop: '1px solid #e5e7eb',
              fontSize: 13,
              color: '#64748b',
              fontStyle: 'italic',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              <span className="material-icons" style={{ fontSize: 16, color: '#3b82f6' }}>info</span>
              <span><strong>Note:</strong> External Users (Access only to Ledgers where Email matches in Ledger Master)</span>
            </div>
            
            <div style={{ padding: 16, borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={closeEditModal} style={{ padding: '10px 16px', background: '#e5e7eb', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSaveEdit} disabled={!editingUser || editSaving} style={{ padding: '10px 16px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: editSaving ? 'not-allowed' : 'pointer', opacity: editSaving ? 0.8 : 1 }}>
                {editSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Group Assignment Modal */}
      {groupModalOpen && selectedCompanyForGroups && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1001,
          padding: 20
        }}>
          <div style={{
            background: '#fff',
            borderRadius: 16,
            boxShadow: '0 20px 40px 0 rgba(0, 0, 0, 0.15)',
            width: '100%',
            maxWidth: '750px',
            height: '600px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: '#1e40af', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="material-icons" style={{ fontSize: 24, color: '#F27020' }}>
                    group_work
                  </span>
                  Assign Groups
                </h3>
                <p style={{ margin: '4px 0 0 32px', fontSize: 14, color: '#64748b' }}>
                  {selectedCompanyForGroups.name} • {editingUser?.name || editingUser?.email}
                </p>
                <div style={{ margin: '8px 0 0 32px', fontSize: 13, color: '#0369a1', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="material-icons" style={{ fontSize: 16, color: '#0369a1' }}>
                    info
                  </span>
                  <span>
                    {activeTab === 'ledger' && 'Selected Groups of Ledgers will list at the time of Transactions and Reports'}
                    {activeTab === 'stock' && 'Selected Group of Stockitems will list in the Transcations'}
                    {activeTab === 'stockcategory' && 'Selected Category of Stockitems will list in the Transcations'}
                    {activeTab === 'vouchertype' && 'This Configurations is used for Voucher Authorization - Default No TDL'}
                  </span>
                </div>
              </div>
              <button
                onClick={closeGroupModal}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 24,
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: 4
                }}
              >
                ×
              </button>
            </div>

            {/* Content */}
            <div style={{ 
              padding: '24px', 
              overflowY: 'auto', 
              flex: 1,
              minHeight: 0,
              maxHeight: 'calc(600px - 140px)'
            }}>
              {groupsLoading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                  <span className="material-icons" style={{ 
                    fontSize: 48, 
                    color: '#F27020',
                    animation: 'spin 1s linear infinite'
                  }}>
                    refresh
                  </span>
                  <p style={{ margin: '16px 0 0 0' }}>Loading groups...</p>
                </div>
              ) : (
                <div>
                  {/* Tab Navigation */}
                  <div style={{
                    display: 'flex',
                    borderBottom: '2px solid #e2e8f0',
                    marginBottom: 24,
                    background: '#f8fafc',
                    borderRadius: '8px 8px 0 0'
                  }}>
                    <button
                      onClick={() => setActiveTab('ledger')}
                      style={{
                        flex: 1,
                        padding: '12px 16px',
                        border: 'none',
                        background: activeTab === 'ledger' ? '#fff' : 'transparent',
                        color: activeTab === 'ledger' ? '#1e40af' : '#64748b',
                        fontWeight: activeTab === 'ledger' ? 600 : 500,
                        fontSize: 14,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        borderRadius: '8px 0 0 0',
                        borderBottom: activeTab === 'ledger' ? '2px solid #F27020' : '2px solid transparent',
                        transition: 'all 0.2s ease',
                        boxShadow: activeTab === 'ledger' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'
                      }}
                      onMouseEnter={(e) => {
                        if (activeTab !== 'ledger') {
                          e.target.style.background = '#f1f5f9';
                          e.target.style.color = '#374151';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (activeTab !== 'ledger') {
                          e.target.style.background = 'transparent';
                          e.target.style.color = '#64748b';
                        }
                      }}
                    >
                      <span className="material-icons" style={{ fontSize: 18 }}>
                        account_balance
                      </span>
                      <span style={{ whiteSpace: 'nowrap' }}>
                        Ledger Group ({filteredLedgerGroups.length}{ledgerGroups.length !== filteredLedgerGroups.length ? `/${ledgerGroups.length}` : ''})
                      </span>
                    </button>
                    <button
                      onClick={() => setActiveTab('stock')}
                      style={{
                        flex: 1,
                        padding: '12px 16px',
                        border: 'none',
                        background: activeTab === 'stock' ? '#fff' : 'transparent',
                        color: activeTab === 'stock' ? '#1e40af' : '#64748b',
                        fontWeight: activeTab === 'stock' ? 600 : 500,
                        fontSize: 14,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        borderRadius: '0 0 0 0',
                        borderBottom: activeTab === 'stock' ? '2px solid #F27020' : '2px solid transparent',
                        transition: 'all 0.2s ease',
                        boxShadow: activeTab === 'stock' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'
                      }}
                      onMouseEnter={(e) => {
                        if (activeTab !== 'stock') {
                          e.target.style.background = '#f1f5f9';
                          e.target.style.color = '#374151';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (activeTab !== 'stock') {
                          e.target.style.background = 'transparent';
                          e.target.style.color = '#64748b';
                        }
                      }}
                    >
                      <span className="material-icons" style={{ fontSize: 18 }}>
                        inventory_2
                      </span>
                      <span style={{ whiteSpace: 'nowrap' }}>
                        Stock Group ({filteredStockGroups.length}{stockGroups.length !== filteredStockGroups.length ? `/${stockGroups.length}` : ''})
                      </span>
                    </button>
                    <button
                      onClick={() => setActiveTab('stockcategory')}
                      style={{
                        flex: 1,
                        padding: '12px 16px',
                        border: 'none',
                        background: activeTab === 'stockcategory' ? '#fff' : 'transparent',
                        color: activeTab === 'stockcategory' ? '#1e40af' : '#64748b',
                        fontWeight: activeTab === 'stockcategory' ? 600 : 500,
                        fontSize: 14,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        borderRadius: '0 0 0 0',
                        borderBottom: activeTab === 'stockcategory' ? '2px solid #F27020' : '2px solid transparent',
                        transition: 'all 0.2s ease',
                        boxShadow: activeTab === 'stockcategory' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'
                      }}
                      onMouseEnter={(e) => {
                        if (activeTab !== 'stockcategory') {
                          e.target.style.background = '#f1f5f9';
                          e.target.style.color = '#374151';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (activeTab !== 'stockcategory') {
                          e.target.style.background = 'transparent';
                          e.target.style.color = '#64748b';
                        }
                      }}
                    >
                      <span className="material-icons" style={{ fontSize: 18 }}>
                        category
                      </span>
                      <span style={{ whiteSpace: 'nowrap' }}>
                        Categories ({filteredStockCategories.length}{stockCategories.length !== filteredStockCategories.length ? `/${stockCategories.length}` : ''})
                      </span>
                    </button>
                    <button
                      onClick={() => setActiveTab('vouchertype')}
                      style={{
                        flex: 1,
                        padding: '12px 16px',
                        border: 'none',
                        background: activeTab === 'vouchertype' ? '#fff' : 'transparent',
                        color: activeTab === 'vouchertype' ? '#1e40af' : '#64748b',
                        fontWeight: activeTab === 'vouchertype' ? 600 : 500,
                        fontSize: 14,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        borderRadius: '0 8px 0 0',
                        borderBottom: activeTab === 'vouchertype' ? '2px solid #F27020' : '2px solid transparent',
                        transition: 'all 0.2s ease',
                        boxShadow: activeTab === 'vouchertype' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'
                      }}
                      onMouseEnter={(e) => {
                        if (activeTab !== 'vouchertype') {
                          e.target.style.background = '#f1f5f9';
                          e.target.style.color = '#374151';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (activeTab !== 'vouchertype') {
                          e.target.style.background = 'transparent';
                          e.target.style.color = '#64748b';
                        }
                      }}
                    >
                      <span className="material-icons" style={{ fontSize: 18 }}>
                        receipt
                      </span>
                      <span style={{ whiteSpace: 'nowrap' }}>
                        VoucherType ({filteredVoucherTypes.length}{voucherTypes.length !== filteredVoucherTypes.length ? `/${voucherTypes.length}` : ''})
                      </span>
                    </button>
                  </div>

                  {/* Tab Content */}
                  <div>
                    {/* Ledger Groups Tab Content */}
                    {activeTab === 'ledger' && (
                      <div>
                        {/* Search Input for Ledger Groups */}
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 12, 
                          marginBottom: 16,
                          padding: '12px 16px',
                          background: '#f8fafc',
                          borderRadius: 8,
                          border: '1px solid #e2e8f0'
                        }}>
                          <span className="material-icons" style={{ color: '#64748b', fontSize: 20 }}>search</span>
                          <input
                            type="text"
                            value={ledgerSearchTerm}
                            onChange={(e) => setLedgerSearchTerm(e.target.value)}
                            placeholder="Search ledger groups..."
                            style={{
                              flex: 1,
                              padding: '8px 12px',
                              border: '1px solid #d1d5db',
                              borderRadius: 6,
                              fontSize: 14,
                              outline: 'none',
                              background: '#fff',
                              transition: 'border-color 0.2s'
                            }}
                            onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                            onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                          />
                          {ledgerSearchTerm && (
                            <button
                              onClick={() => setLedgerSearchTerm('')}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#64748b',
                                cursor: 'pointer',
                                padding: '6px',
                                borderRadius: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                transition: 'background-color 0.2s'
                              }}
                              onMouseEnter={(e) => e.target.style.background = '#f1f5f9'}
                              onMouseLeave={(e) => e.target.style.background = 'transparent'}
                              title="Clear search"
                            >
                              <span className="material-icons" style={{ fontSize: 16 }}>clear</span>
                            </button>
                          )}
                        </div>
                        
                        <div style={{
                          border: '1px solid #e2e8f0',
                          borderRadius: 8,
                          maxHeight: '320px',
                          overflowY: 'auto',
                          background: '#fff'
                        }}>
                          {filteredLedgerGroups.length === 0 ? (
                            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                              <span className="material-icons" style={{ fontSize: 48, color: '#cbd5e1', marginBottom: 12, display: 'block' }}>
                                account_balance
                              </span>
                              <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 4 }}>
                                {ledgerSearchTerm ? `No ledger groups found matching "${ledgerSearchTerm}"` : 'No ledger groups found'}
                              </div>
                              <div style={{ fontSize: 14, color: '#94a3b8' }}>
                                {ledgerSearchTerm ? 'Try adjusting your search term' : 'No ledger groups are available for this company'}
                              </div>
                            </div>
                          ) : (
                            filteredLedgerGroups.map((group) => (
                              <label
                                key={group.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  padding: '16px 20px',
                                  cursor: 'pointer',
                                  borderBottom: '1px solid #f1f5f9',
                                  transition: 'background-color 0.2s',
                                  background: selectedLedgerGroups.includes(group.id) ? '#f0f9ff' : 'transparent'
                                }}
                                onMouseEnter={(e) => {
                                  if (!selectedLedgerGroups.includes(group.id)) {
                                    e.target.style.background = '#f8fafc';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (!selectedLedgerGroups.includes(group.id)) {
                                    e.target.style.background = 'transparent';
                                  }
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedLedgerGroups.includes(group.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedLedgerGroups(prev => [...prev, group.id]);
                                    } else {
                                      setSelectedLedgerGroups(prev => prev.filter(id => id !== group.id));
                                    }
                                  }}
                                  style={{ 
                                    marginRight: 16, 
                                    cursor: 'pointer',
                                    transform: 'scale(1.2)',
                                    accentColor: '#F27020'
                                  }}
                                />
                                <div style={{ flex: 1 }}>
                                  <div style={{ 
                                    fontWeight: 600, 
                                    color: selectedLedgerGroups.includes(group.id) ? '#1e40af' : '#374151', 
                                    fontSize: 15,
                                    marginBottom: 4
                                  }}>
                                    {group.name}
                                  </div>
                                  {group.description && (
                                    <div style={{ 
                                      fontSize: 13, 
                                      color: '#64748b',
                                      fontStyle: 'italic'
                                    }}>
                                      {group.description}
                                    </div>
                                  )}
                                </div>
                                {selectedLedgerGroups.includes(group.id) && (
                                  <span className="material-icons" style={{ 
                                    fontSize: 20, 
                                    color: '#F27020' 
                                  }}>
                                    check_circle
                                  </span>
                                )}
                              </label>
                            ))
                          )}
                        </div>
                        {selectedLedgerGroups.length > 0 && (
                          <div style={{ 
                            fontSize: 14, 
                            color: '#F27020', 
                            marginTop: 12,
                            fontWeight: 500,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8
                          }}>
                            <span className="material-icons" style={{ fontSize: 18 }}>check_circle</span>
                            {selectedLedgerGroups.length} ledger group{selectedLedgerGroups.length !== 1 ? 's' : ''} selected
                          </div>
                        )}
                      </div>
                    )}

                    {/* Stock Groups Tab Content */}
                    {activeTab === 'stock' && (
                      <div>
                        {/* Search Input for Stock Groups */}
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 12, 
                          marginBottom: 16,
                          padding: '12px 16px',
                          background: '#f8fafc',
                          borderRadius: 8,
                          border: '1px solid #e2e8f0'
                        }}>
                          <span className="material-icons" style={{ color: '#64748b', fontSize: 20 }}>search</span>
                          <input
                            type="text"
                            value={stockSearchTerm}
                            onChange={(e) => setStockSearchTerm(e.target.value)}
                            placeholder="Search stock groups..."
                            style={{
                              flex: 1,
                              padding: '8px 12px',
                              border: '1px solid #d1d5db',
                              borderRadius: 6,
                              fontSize: 14,
                              outline: 'none',
                              background: '#fff',
                              transition: 'border-color 0.2s'
                            }}
                            onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                            onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                          />
                          {stockSearchTerm && (
                            <button
                              onClick={() => setStockSearchTerm('')}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#64748b',
                                cursor: 'pointer',
                                padding: '6px',
                                borderRadius: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                transition: 'background-color 0.2s'
                              }}
                              onMouseEnter={(e) => e.target.style.background = '#f1f5f9'}
                              onMouseLeave={(e) => e.target.style.background = 'transparent'}
                              title="Clear search"
                            >
                              <span className="material-icons" style={{ fontSize: 16 }}>clear</span>
                            </button>
                          )}
                        </div>
                        
                        <div style={{
                          border: '1px solid #e2e8f0',
                          borderRadius: 8,
                          maxHeight: '320px',
                          overflowY: 'auto',
                          background: '#fff'
                        }}>
                          {filteredStockGroups.length === 0 ? (
                            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                              <span className="material-icons" style={{ fontSize: 48, color: '#cbd5e1', marginBottom: 12, display: 'block' }}>
                                inventory_2
                              </span>
                              <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 4 }}>
                                {stockSearchTerm ? `No stock groups found matching "${stockSearchTerm}"` : 'No stock groups found'}
                              </div>
                              <div style={{ fontSize: 14, color: '#94a3b8' }}>
                                {stockSearchTerm ? 'Try adjusting your search term' : 'No stock groups are available for this company'}
                              </div>
                            </div>
                          ) : (
                            filteredStockGroups.map((group) => (
                              <label
                                key={group.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  padding: '16px 20px',
                                  cursor: 'pointer',
                                  borderBottom: '1px solid #f1f5f9',
                                  transition: 'background-color 0.2s',
                                  background: selectedStockGroups.includes(group.id) ? '#f0f9ff' : 'transparent'
                                }}
                                onMouseEnter={(e) => {
                                  if (!selectedStockGroups.includes(group.id)) {
                                    e.target.style.background = '#f8fafc';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (!selectedStockGroups.includes(group.id)) {
                                    e.target.style.background = 'transparent';
                                  }
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedStockGroups.includes(group.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedStockGroups(prev => [...prev, group.id]);
                                    } else {
                                      setSelectedStockGroups(prev => prev.filter(id => id !== group.id));
                                    }
                                  }}
                                  style={{ 
                                    marginRight: 16, 
                                    cursor: 'pointer',
                                    transform: 'scale(1.2)',
                                    accentColor: '#F27020'
                                  }}
                                />
                                <div style={{ flex: 1 }}>
                                  <div style={{ 
                                    fontWeight: 600, 
                                    color: selectedStockGroups.includes(group.id) ? '#1e40af' : '#374151', 
                                    fontSize: 15,
                                    marginBottom: 4
                                  }}>
                                    {group.name}
                                  </div>
                                  {group.description && (
                                    <div style={{ 
                                      fontSize: 13, 
                                      color: '#64748b',
                                      fontStyle: 'italic'
                                    }}>
                                      {group.description}
                                    </div>
                                  )}
                                </div>
                                {selectedStockGroups.includes(group.id) && (
                                  <span className="material-icons" style={{ 
                                    fontSize: 20, 
                                    color: '#F27020' 
                                  }}>
                                    check_circle
                                  </span>
                                )}
                              </label>
                            ))
                          )}
                        </div>
                        {selectedStockGroups.length > 0 && (
                          <div style={{ 
                            fontSize: 14, 
                            color: '#F27020', 
                            marginTop: 12,
                            fontWeight: 500,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8
                          }}>
                            <span className="material-icons" style={{ fontSize: 18 }}>check_circle</span>
                            {selectedStockGroups.length} stock group{selectedStockGroups.length !== 1 ? 's' : ''} selected
                          </div>
                        )}
                      </div>
                    )}

                    {/* Stock Categories Tab Content */}
                    {activeTab === 'stockcategory' && (
                      <div>
                        {/* Search Input for Stock Categories */}
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 12, 
                          marginBottom: 16,
                          padding: '12px 16px',
                          background: '#f8fafc',
                          borderRadius: 8,
                          border: '1px solid #e2e8f0'
                        }}>
                          <span className="material-icons" style={{ color: '#64748b', fontSize: 20 }}>search</span>
                          <input
                            type="text"
                            value={stockCategorySearchTerm}
                            onChange={(e) => setStockCategorySearchTerm(e.target.value)}
                            placeholder="Search stock categories..."
                            style={{
                              flex: 1,
                              padding: '8px 12px',
                              border: '1px solid #d1d5db',
                              borderRadius: 6,
                              fontSize: 14,
                              outline: 'none',
                              background: '#fff',
                              transition: 'border-color 0.2s'
                            }}
                            onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                            onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                          />
                          {stockCategorySearchTerm && (
                            <button
                              onClick={() => setStockCategorySearchTerm('')}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#64748b',
                                cursor: 'pointer',
                                padding: '6px',
                                borderRadius: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                transition: 'background-color 0.2s'
                              }}
                              onMouseEnter={(e) => e.target.style.background = '#f1f5f9'}
                              onMouseLeave={(e) => e.target.style.background = 'transparent'}
                              title="Clear search"
                            >
                              <span className="material-icons" style={{ fontSize: 16 }}>clear</span>
                            </button>
                          )}
                        </div>
                        
                        <div style={{
                          border: '1px solid #e2e8f0',
                          borderRadius: 8,
                          maxHeight: '320px',
                          overflowY: 'auto',
                          background: '#fff'
                        }}>
                          {filteredStockCategories.length === 0 ? (
                            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                              <span className="material-icons" style={{ fontSize: 48, color: '#cbd5e1', marginBottom: 12, display: 'block' }}>
                                category
                              </span>
                              <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 4 }}>
                                {stockCategorySearchTerm ? `No stock categories found matching "${stockCategorySearchTerm}"` : 'No stock categories found'}
                              </div>
                              <div style={{ fontSize: 14, color: '#94a3b8' }}>
                                {stockCategorySearchTerm ? 'Try adjusting your search term' : 'No stock categories are available for this company'}
                              </div>
                            </div>
                          ) : (
                            filteredStockCategories.map((category) => (
                              <label
                                key={category.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  padding: '16px 20px',
                                  cursor: 'pointer',
                                  borderBottom: '1px solid #f1f5f9',
                                  transition: 'background-color 0.2s',
                                  background: selectedStockCategories.includes(category.id) ? '#f0f9ff' : 'transparent'
                                }}
                                onMouseEnter={(e) => {
                                  if (!selectedStockCategories.includes(category.id)) {
                                    e.target.style.background = '#f8fafc';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (!selectedStockCategories.includes(category.id)) {
                                    e.target.style.background = 'transparent';
                                  }
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedStockCategories.includes(category.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedStockCategories(prev => [...prev, category.id]);
                                    } else {
                                      setSelectedStockCategories(prev => prev.filter(id => id !== category.id));
                                    }
                                  }}
                                  style={{ 
                                    marginRight: 16, 
                                    cursor: 'pointer',
                                    transform: 'scale(1.2)',
                                    accentColor: '#F27020'
                                  }}
                                />
                                <div style={{ flex: 1 }}>
                                  <div style={{ 
                                    fontWeight: 600, 
                                    color: selectedStockCategories.includes(category.id) ? '#1e40af' : '#374151', 
                                    fontSize: 15,
                                    marginBottom: 4
                                  }}>
                                    {category.name}
                                  </div>
                                  {category.description && (
                                    <div style={{ 
                                      fontSize: 13, 
                                      color: '#64748b',
                                      fontStyle: 'italic'
                                    }}>
                                      {category.description}
                                    </div>
                                  )}
                                </div>
                                {selectedStockCategories.includes(category.id) && (
                                  <span className="material-icons" style={{ 
                                    fontSize: 20, 
                                    color: '#F27020' 
                                  }}>
                                    check_circle
                                  </span>
                                )}
                              </label>
                            ))
                          )}
                        </div>
                        {selectedStockCategories.length > 0 && (
                          <div style={{ 
                            fontSize: 14, 
                            color: '#F27020', 
                            marginTop: 12,
                            fontWeight: 500,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8
                          }}>
                            <span className="material-icons" style={{ fontSize: 18 }}>check_circle</span>
                            {selectedStockCategories.length} stock categor{selectedStockCategories.length !== 1 ? 'ies' : 'y'} selected
                          </div>
                        )}
                      </div>
                    )}

                    {/* Voucher Types Tab Content */}
                    {activeTab === 'vouchertype' && (
                      <div>
                        {/* Search Input for Voucher Types */}
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 12, 
                          marginBottom: 16,
                          padding: '12px 16px',
                          background: '#f8fafc',
                          borderRadius: 8,
                          border: '1px solid #e2e8f0'
                        }}>
                          <span className="material-icons" style={{ color: '#64748b', fontSize: 20 }}>search</span>
                          <input
                            type="text"
                            value={voucherTypeSearchTerm}
                            onChange={(e) => setVoucherTypeSearchTerm(e.target.value)}
                            placeholder="Search voucher types..."
                            style={{
                              flex: 1,
                              padding: '8px 12px',
                              border: '1px solid #d1d5db',
                              borderRadius: 6,
                              fontSize: 14,
                              outline: 'none',
                              background: '#fff',
                              transition: 'border-color 0.2s'
                            }}
                            onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                            onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                          />
                          {voucherTypeSearchTerm && (
                            <button
                              onClick={() => setVoucherTypeSearchTerm('')}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#64748b',
                                cursor: 'pointer',
                                padding: '6px',
                                borderRadius: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                transition: 'background-color 0.2s'
                              }}
                              onMouseEnter={(e) => e.target.style.background = '#f1f5f9'}
                              onMouseLeave={(e) => e.target.style.background = 'transparent'}
                              title="Clear search"
                            >
                              <span className="material-icons" style={{ fontSize: 16 }}>clear</span>
                            </button>
                          )}
                        </div>
                        
                        <div style={{
                          border: '1px solid #e2e8f0',
                          borderRadius: 8,
                          maxHeight: '320px',
                          overflowY: 'auto',
                          background: '#fff'
                        }}>
                          {filteredVoucherTypes.length === 0 ? (
                            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                              <span className="material-icons" style={{ fontSize: 48, color: '#cbd5e1', marginBottom: 12, display: 'block' }}>
                                receipt
                              </span>
                              <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 4 }}>
                                {voucherTypeSearchTerm ? `No voucher types found matching "${voucherTypeSearchTerm}"` : 'No voucher types found'}
                              </div>
                              <div style={{ fontSize: 14, color: '#94a3b8' }}>
                                {voucherTypeSearchTerm ? 'Try adjusting your search term' : 'No voucher types are available for this company'}
                              </div>
                            </div>
                          ) : (
                            filteredVoucherTypes.map((voucherType) => (
                              <label
                                key={voucherType.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  padding: '16px 20px',
                                  cursor: 'pointer',
                                  borderBottom: '1px solid #f1f5f9',
                                  transition: 'background-color 0.2s',
                                  background: selectedVoucherTypes.includes(voucherType.id) ? '#f0f9ff' : 'transparent'
                                }}
                                onMouseEnter={(e) => {
                                  if (!selectedVoucherTypes.includes(voucherType.id)) {
                                    e.target.style.background = '#f8fafc';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (!selectedVoucherTypes.includes(voucherType.id)) {
                                    e.target.style.background = 'transparent';
                                  }
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedVoucherTypes.includes(voucherType.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedVoucherTypes(prev => [...prev, voucherType.id]);
                                    } else {
                                      setSelectedVoucherTypes(prev => prev.filter(id => id !== voucherType.id));
                                    }
                                  }}
                                  style={{ 
                                    marginRight: 16, 
                                    cursor: 'pointer',
                                    transform: 'scale(1.2)',
                                    accentColor: '#F27020'
                                  }}
                                />
                                <div style={{ flex: 1 }}>
                                  <div style={{ 
                                    fontWeight: 600, 
                                    color: selectedVoucherTypes.includes(voucherType.id) ? '#1e40af' : '#374151', 
                                    fontSize: 15,
                                    marginBottom: 4
                                  }}>
                                    {voucherType.name}
                                  </div>
                                  {voucherType.description && (
                                    <div style={{ 
                                      fontSize: 13, 
                                      color: '#64748b',
                                      fontStyle: 'italic'
                                    }}>
                                      {voucherType.description}
                                    </div>
                                  )}
                                </div>
                                {selectedVoucherTypes.includes(voucherType.id) && (
                                  <span className="material-icons" style={{ 
                                    fontSize: 20, 
                                    color: '#F27020' 
                                  }}>
                                    check_circle
                                  </span>
                                )}
                              </label>
                            ))
                          )}
                        </div>
                        {selectedVoucherTypes.length > 0 && (
                          <div style={{ 
                            fontSize: 14, 
                            color: '#F27020', 
                            marginTop: 12,
                            fontWeight: 500,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8
                          }}>
                            <span className="material-icons" style={{ fontSize: 18 }}>check_circle</span>
                            {selectedVoucherTypes.length} voucher type{selectedVoucherTypes.length !== 1 ? 's' : ''} selected
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{
              padding: '20px 24px',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              gap: 12,
              justifyContent: 'flex-end',
              background: '#f8fafc'
            }}>
              <button
                onClick={closeGroupModal}
                style={{
                  padding: '12px 24px',
                  border: '1.5px solid #e2e8f0',
                  borderRadius: 8,
                  background: '#fff',
                  color: '#64748b',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.target.style.borderColor = '#cbd5e1';
                  e.target.style.color = '#374151';
                }}
                onMouseLeave={(e) => {
                  e.target.style.borderColor = '#e2e8f0';
                  e.target.style.color = '#64748b';
                }}
              >
                Cancel
              </button>
              <button
                onClick={saveGroupAssignments}
                disabled={groupsSaving}
                style={{
                  padding: '12px 24px',
                  border: 'none',
                  borderRadius: 8,
                  background: 'linear-gradient(135deg, #F27020 0%, #e55a00 100%)',
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: groupsSaving ? 'not-allowed' : 'pointer',
                  opacity: groupsSaving ? 0.7 : 1,
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}
                onMouseEnter={(e) => {
                  if (!groupsSaving) {
                    e.target.style.transform = 'scale(1.05)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!groupsSaving) {
                    e.target.style.transform = 'scale(1)';
                  }
                }}
              >
                {groupsSaving && (
                  <span className="material-icons" style={{ 
                    fontSize: 16,
                    animation: 'spin 1s linear infinite'
                  }}>
                    refresh
                  </span>
                )}
                {groupsSaving ? 'Saving...' : 'Save Groups'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Route Modal */}
      {showCreateRouteModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          padding: 20, animation: 'fadeIn 0.2s ease-in'
        }}>
          <div style={{
            width: '100%', maxWidth: 900, maxHeight: '90vh', background: '#fff', borderRadius: 20,
            boxShadow: '0 25px 60px rgba(0,0,0,0.25)', overflow: 'hidden', display: 'flex', flexDirection: 'column',
            animation: 'slideUp 0.3s ease-out'
          }}>
            <div style={{ 
              padding: '24px 28px', 
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backdropFilter: 'blur(10px)'
                }}>
                  <span className="material-icons" style={{ color: '#fff', fontSize: 28 }}>route</span>
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: '#fff', fontSize: 22, marginBottom: 2 }}>Create Route</div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>Add a new route with customers</div>
                </div>
              </div>
              <button 
                onClick={() => setShowCreateRouteModal(false)} 
                style={{ 
                  border: 'none', 
                  background: 'rgba(255,255,255,0.2)', 
                  cursor: 'pointer', 
                  fontSize: 24, 
                  color: '#fff',
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(255,255,255,0.3)';
                  e.target.style.transform = 'rotate(90deg)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'rgba(255,255,255,0.2)';
                  e.target.style.transform = 'rotate(0deg)';
                }}
              >
                ×
              </button>
            </div>
            
            <div style={{ padding: 28, overflowY: 'auto', flex: 1, background: '#f8fafc' }}>
              {/* Route Name */}
              <div style={{ marginBottom: 24 }}>
                <label style={{ 
                  fontWeight: 600, 
                  color: '#1e293b', 
                  marginBottom: 10, 
                  display: 'flex', 
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 15 
                }}>
                  <span className="material-icons" style={{ fontSize: 18, color: '#3b82f6' }}>label</span>
                  Route Name <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type="text"
                    value={routeName} 
                    onChange={(e) => setRouteName(e.target.value)} 
                    placeholder="Enter route name"
                    style={{ 
                      padding: '14px 16px 14px 48px', 
                      borderRadius: 12, 
                      border: '2px solid #e2e8f0', 
                      width: '100%', 
                      fontSize: 15, 
                      background: '#fff',
                      boxSizing: 'border-box',
                      transition: 'all 0.2s',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#3b82f6';
                      e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#e2e8f0';
                      e.target.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
                    }}
                  />
                  <span className="material-icons" style={{ 
                    position: 'absolute', 
                    left: 16, 
                    top: '50%', 
                    transform: 'translateY(-50%)',
                    fontSize: 20,
                    color: '#94a3b8'
                  }}>route</span>
                </div>
              </div>

              {/* Description */}
              <div style={{ marginBottom: 24 }}>
                <label style={{ 
                  fontWeight: 600, 
                  color: '#1e293b', 
                  marginBottom: 10, 
                  display: 'flex', 
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 15 
                }}>
                  <span className="material-icons" style={{ fontSize: 18, color: '#3b82f6' }}>description</span>
                  Description <span style={{ color: '#64748b', fontSize: 13, fontWeight: 400 }}>(Optional)</span>
                </label>
                <textarea 
                  value={routeDescription} 
                  onChange={(e) => setRouteDescription(e.target.value)} 
                  placeholder="Enter route description"
                  rows={3}
                  style={{ 
                    padding: '14px 16px', 
                    borderRadius: 12, 
                    border: '2px solid #e2e8f0', 
                    width: '100%', 
                    fontSize: 15, 
                    background: '#fff',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box',
                    transition: 'all 0.2s',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#3b82f6';
                    e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e2e8f0';
                    e.target.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
                  }}
                />
              </div>

              {/* Company Filter Buttons */}
              {uniqueCompanies.length > 0 && (
                <div style={{ 
                  marginBottom: 24,
                  padding: 20,
                  background: '#fff',
                  borderRadius: 16,
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                }}>
                  <label style={{ 
                    fontWeight: 600, 
                    color: '#1e293b', 
                    marginBottom: 12, 
                    display: 'flex', 
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 15 
                  }}>
                    <span className="material-icons" style={{ fontSize: 18, color: '#3b82f6' }}>business</span>
                    Filter by Company
                    <span style={{ 
                      marginLeft: 'auto',
                      fontSize: 12,
                      fontWeight: 500,
                      color: '#64748b',
                      background: '#f1f5f9',
                      padding: '4px 10px',
                      borderRadius: 12
                    }}>
                      {selectedCompanies.length} of {uniqueCompanies.length} selected
                    </span>
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    {uniqueCompanies.map(company => {
                      const isSelected = selectedCompanies.includes(company);
                      return (
                        <button
                          key={company}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedCompanies(prev => prev.filter(c => c !== company));
                            } else {
                              setSelectedCompanies(prev => [...prev, company]);
                            }
                          }}
                          style={{
                            padding: '10px 18px',
                            borderRadius: 10,
                            border: `2px solid ${isSelected ? '#3b82f6' : '#e2e8f0'}`,
                            background: isSelected 
                              ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' 
                              : '#fff',
                            color: isSelected ? '#fff' : '#475569',
                            fontSize: 14,
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            boxShadow: isSelected 
                              ? '0 4px 12px rgba(59, 130, 246, 0.3)' 
                              : '0 1px 3px rgba(0,0,0,0.05)',
                            transform: isSelected ? 'translateY(-1px)' : 'translateY(0)'
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected) {
                              e.target.style.borderColor = '#3b82f6';
                              e.target.style.background = '#eff6ff';
                              e.target.style.transform = 'translateY(-1px)';
                              e.target.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
                            } else {
                              e.target.style.transform = 'translateY(-2px)';
                              e.target.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.4)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) {
                              e.target.style.borderColor = '#e2e8f0';
                              e.target.style.background = '#fff';
                              e.target.style.transform = 'translateY(0)';
                              e.target.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
                            } else {
                              e.target.style.transform = 'translateY(-1px)';
                              e.target.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
                            }
                          }}
                        >
                          {isSelected && (
                            <span className="material-icons" style={{ fontSize: 18 }}>check_circle</span>
                          )}
                          {!isSelected && (
                            <span className="material-icons" style={{ fontSize: 18, color: '#cbd5e1' }}>radio_button_unchecked</span>
                          )}
                          {company}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Customer Filter with Toggle */}
              <div style={{ 
                marginBottom: 24,
                padding: 20,
                background: '#fff',
                borderRadius: 16,
                border: '1px solid #e2e8f0',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <label style={{ 
                    fontWeight: 600, 
                    color: '#1e293b', 
                    fontSize: 15,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8
                  }}>
                    <span className="material-icons" style={{ fontSize: 18, color: '#3b82f6' }}>
                      {filterMode === 'keyword' ? 'search' : 'location_on'}
                    </span>
                    {filterMode === 'keyword' ? 'Filter by Keyword' : 'Filter by Pincode'} 
                    <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#f1f5f9', padding: '4px', borderRadius: 10 }}>
                    <span style={{ fontSize: 12, color: filterMode === 'keyword' ? '#3b82f6' : '#64748b', fontWeight: filterMode === 'keyword' ? 600 : 400, padding: '4px 8px' }}>Keyword</span>
                    <label style={{
                      position: 'relative',
                      display: 'inline-block',
                      width: 48,
                      height: 26
                    }}>
                      <input
                        type="checkbox"
                        checked={filterMode === 'pincode'}
                        onChange={(e) => {
                          const newMode = e.target.checked ? 'pincode' : 'keyword';
                          setFilterMode(newMode);
                          // Clear inputs when switching modes
                          if (newMode === 'pincode') {
                            setCustomerSearchInput('');
                          } else {
                            setPincodeInput('');
                            setSelectedPincode('');
                          }
                        }}
                        style={{ display: 'none' }}
                      />
                      <span style={{
                        position: 'absolute',
                        cursor: 'pointer',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: filterMode === 'pincode' ? '#3b82f6' : '#cbd5e1',
                        borderRadius: 26,
                        transition: 'all 0.3s',
                        display: 'flex',
                        alignItems: 'center',
                        padding: '2px',
                        boxShadow: filterMode === 'pincode' ? '0 2px 8px rgba(59, 130, 246, 0.3)' : 'none'
                      }}>
                        <span style={{
                          content: '""',
                          position: 'absolute',
                          height: 22,
                          width: 22,
                          left: filterMode === 'pincode' ? '22px' : '2px',
                          bottom: '2px',
                          backgroundColor: '#fff',
                          borderRadius: '50%',
                          transition: 'all 0.3s',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
                        }} />
                      </span>
                    </label>
                    <span style={{ fontSize: 12, color: filterMode === 'pincode' ? '#3b82f6' : '#64748b', fontWeight: filterMode === 'pincode' ? 600 : 400, padding: '4px 8px' }}>Pincode</span>
                  </div>
                </div>
                
                {filterMode === 'pincode' ? (
                <div style={{ position: 'relative' }}>
                  <input 
                    type="text"
                    value={pincodeInput} 
                    onChange={(e) => {
                      setPincodeInput(e.target.value);
                      if (!e.target.value.trim()) {
                        setSelectedPincode('');
                      }
                    }} 
                    placeholder="Type pincode to search..."
                    style={{ 
                      padding: '14px 16px 14px 48px', 
                      borderRadius: 12, 
                      border: '2px solid #e2e8f0', 
                      width: '100%', 
                      fontSize: 15, 
                      background: '#fff',
                      boxSizing: 'border-box',
                      transition: 'all 0.2s',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#3b82f6';
                      e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#e2e8f0';
                      e.target.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
                    }}
                  />
                  <span className="material-icons" style={{ 
                    position: 'absolute', 
                    left: 16, 
                    top: '50%', 
                    transform: 'translateY(-50%)',
                    fontSize: 20,
                    color: '#94a3b8'
                  }}>location_on</span>
                  {filteredPincodes.length > 0 && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      background: '#fff',
                      border: '1px solid #e2e8f0',
                      borderRadius: 12,
                      marginTop: 8,
                      maxHeight: 240,
                      overflowY: 'auto',
                      zIndex: 1000,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.12)'
                    }}>
                      {filteredPincodes.map(pincode => (
                        <div
                          key={pincode}
                          onClick={() => {
                            setPincodeInput(pincode);
                            setSelectedPincode(pincode);
                          }}
                          style={{
                            padding: '14px 16px',
                            cursor: 'pointer',
                            borderBottom: '1px solid #f1f5f9',
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.background = '#f0f9ff';
                            e.target.style.paddingLeft = '20px';
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.background = '#fff';
                            e.target.style.paddingLeft = '16px';
                          }}
                        >
                          <span className="material-icons" style={{ fontSize: 18, color: '#3b82f6' }}>location_on</span>
                          <span style={{ fontWeight: 500 }}>{pincode}</span>
                        </div>
                      ))}
                    </div>
                  )}
                {selectedPincode && (
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginTop: 12,
                    padding: '12px 16px',
                    background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                    borderRadius: 10,
                    border: '1px solid #bfdbfe'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="material-icons" style={{ fontSize: 18, color: '#3b82f6' }}>check_circle</span>
                      <span style={{ fontSize: 14, color: '#1e40af', fontWeight: 600 }}>Selected: {selectedPincode}</span>
                    </div>
                    <button
                      onClick={() => {
                        setPincodeInput('');
                        setSelectedPincode('');
                      }}
                      style={{
                        background: 'rgba(59, 130, 246, 0.1)',
                        border: 'none',
                        color: '#3b82f6',
                        cursor: 'pointer',
                        fontSize: 12,
                        fontWeight: 600,
                        padding: '6px 12px',
                        borderRadius: 6,
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.background = 'rgba(59, 130, 246, 0.2)';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.background = 'rgba(59, 130, 246, 0.1)';
                      }}
                    >
                      Clear
                    </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <div style={{ position: 'relative' }}>
                      <input 
                        type="text"
                        value={customerSearchInput} 
                        onChange={(e) => {
                          setCustomerSearchInput(e.target.value);
                        }} 
                        placeholder="Search by name, pincode, address, company, or any keyword..."
                        style={{ 
                          padding: '14px 16px 14px 48px', 
                          borderRadius: 12, 
                          border: '2px solid #e2e8f0', 
                          width: '100%', 
                          fontSize: 15, 
                          background: '#fff',
                          boxSizing: 'border-box',
                          transition: 'all 0.2s',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                        }}
                        onFocus={(e) => {
                          e.target.style.borderColor = '#3b82f6';
                          e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = '#e2e8f0';
                          e.target.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
                        }}
                      />
                      <span className="material-icons" style={{ 
                        position: 'absolute', 
                        left: 16, 
                        top: '50%', 
                        transform: 'translateY(-50%)',
                        fontSize: 20,
                        color: '#94a3b8'
                      }}>search</span>
                    </div>
                    {customerSearchInput.trim() && (
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        marginTop: 12,
                        padding: '12px 16px',
                        background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                        borderRadius: 10,
                        border: '1px solid #bfdbfe'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="material-icons" style={{ fontSize: 18, color: '#3b82f6' }}>info</span>
                          <span style={{ fontSize: 14, color: '#1e40af', fontWeight: 600 }}>
                            {filteredCustomersForRoute.length} customer(s) found
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            setCustomerSearchInput('');
                          }}
                          style={{
                            background: 'rgba(59, 130, 246, 0.1)',
                            border: 'none',
                            color: '#3b82f6',
                            cursor: 'pointer',
                            fontSize: 12,
                            fontWeight: 600,
                            padding: '6px 12px',
                            borderRadius: 6,
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.background = 'rgba(59, 130, 246, 0.2)';
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.background = 'rgba(59, 130, 246, 0.1)';
                          }}
                        >
                          Clear
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Selected Customers Summary (from all pincodes) */}
              {selectedCustomers.length > 0 && (
                <div style={{ marginBottom: 20, padding: 16, background: '#f0f9ff', borderRadius: 8, border: '1px solid #bae6fd' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <label style={{ fontWeight: 600, color: '#0369a1', fontSize: 14 }}>
                      Selected Customers ({selectedCustomers.length} total)
                    </label>
                    <button
                      onClick={() => setSelectedCustomers([])}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#0369a1',
                        cursor: 'pointer',
                        fontSize: 14,
                        fontWeight: 600,
                        textDecoration: 'underline'
                      }}
                    >
                      Clear All
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {selectedCustomers.map(customerId => {
                      const customer = customers.find(c => c.customer_id === customerId);
                      if (!customer) return null;
                      return (
                        <div
                          key={customerId}
                          style={{
                            padding: '8px 12px',
                            background: '#fff',
                            border: '1px solid #7dd3fc',
                            borderRadius: 6,
                            fontSize: 13,
                            color: '#0369a1',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6
                          }}
                        >
                          <span style={{ fontWeight: 600 }}>{customer.name}</span>
                          <span style={{ color: '#64748b', fontSize: 12 }}>({customer.pincode})</span>
                          <button
                            onClick={() => setSelectedCustomers(prev => prev.filter(id => id !== customerId))}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#ef4444',
                              cursor: 'pointer',
                              fontSize: 16,
                              padding: 0,
                              marginLeft: 4,
                              display: 'flex',
                              alignItems: 'center'
                            }}
                            title="Remove"
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Customer Selection */}
              {((filterMode === 'pincode' && selectedPincode) || (filterMode === 'keyword' && customerSearchInput.trim())) && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <label style={{ fontWeight: 600, color: '#374151', fontSize: 14 }}>
                      {filterMode === 'pincode' 
                        ? `Customers in Pincode ${selectedPincode} (${filteredCustomersForRoute.filter(c => selectedCustomers.includes(c.id)).length} selected)`
                        : `Search Results (${filteredCustomersForRoute.filter(c => selectedCustomers.includes(c.id)).length} selected)`
                      }
                    </label>
                  </div>

                  {customersLoading ? (
                    <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
                      <span className="material-icons" style={{ fontSize: 48, color: '#3b82f6', marginBottom: 16, display: 'block' }}>sync</span>
                      <div style={{ fontSize: 16, fontWeight: 500 }}>Loading customers...</div>
                    </div>
                  ) : filteredCustomersForRoute.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 40, color: '#64748b', background: '#f8fafc', borderRadius: 8 }}>
                      <div style={{ fontSize: 14 }}>
                        {filterMode === 'pincode' 
                          ? `No customers found for pincode ${selectedPincode}`
                          : `No customers found matching "${customerSearchInput}"`
                        }
                      </div>
                    </div>
                  ) : (
                    <div style={{ 
                      maxHeight: 300, 
                      overflowY: 'auto', 
                      border: '1px solid #e2e8f0', 
                      borderRadius: 8,
                      background: '#fff'
                    }}>
                      {filteredCustomersForRoute.map(customer => {
                        const isSelected = selectedCustomers.includes(customer.id);
                        const hasCoordinates = customer.latitude !== null && customer.longitude !== null;
                        return (
                          <div key={customer.id} style={{
                            padding: 16,
                            borderBottom: '1px solid #f1f5f9',
                            background: isSelected ? '#f0f9ff' : '#fff'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                              <div
                                onClick={() => {
                                  if (isSelected) {
                                    setSelectedCustomers(prev => prev.filter(id => id !== customer.id));
                                  } else {
                                    setSelectedCustomers(prev => [...prev, customer.id]);
                                  }
                                }}
                                style={{
                                  width: 24,
                                  height: 24,
                                  borderRadius: 4,
                                  border: `2px solid ${isSelected ? '#3b82f6' : '#d1d5db'}`,
                                  background: isSelected ? '#3b82f6' : '#fff',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer',
                                  marginTop: 2,
                                  flexShrink: 0
                                }}
                              >
                                {isSelected && <span style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>✓</span>}
                              </div>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600, color: isSelected ? '#1e40af' : '#1e293b', marginBottom: 4 }}>
                                  {customer.name}
                                </div>
                                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>
                                  <span className="material-icons" style={{ fontSize: 14, verticalAlign: 'middle', marginRight: 4 }}>business</span>
                                  {customer.companyName}
                                </div>
                                {customer.address && (
                                  <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>
                                    {customer.address}
                                  </div>
                                )}
                                <div style={{ fontSize: 12, color: '#94a3b8' }}>Pincode: {customer.pincode}</div>
                                {hasCoordinates ? (
                                  <div style={{ fontSize: 12, color: '#10b981', marginTop: 4, fontWeight: 500 }}>
                                    📍 {customer.latitude?.toFixed(6)}, {customer.longitude?.toFixed(6)}
                                  </div>
                                ) : (
                                  <div style={{ fontSize: 12, color: '#f59e0b', marginTop: 4, fontStyle: 'italic' }}>
                                    No coordinates set
                                  </div>
                                )}
                              </div>
                              <button
                                onClick={() => handleEditCustomer(customer)}
                                style={{
                                  padding: '6px 12px',
                                  background: '#3b82f6',
                                  color: '#fff',
                                  border: 'none',
                                  borderRadius: 6,
                                  fontSize: 12,
                                  fontWeight: 500,
                                  cursor: 'pointer',
                                  flexShrink: 0
                                }}
                              >
                                Edit
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{ 
              padding: '20px 28px', 
              borderTop: '1px solid #e2e8f0', 
              background: '#fff',
              display: 'flex', 
              justifyContent: 'flex-end', 
              gap: 12,
              boxShadow: '0 -4px 12px rgba(0,0,0,0.04)'
            }}>
              <button 
                onClick={() => setShowCreateRouteModal(false)} 
                style={{ 
                  padding: '12px 24px', 
                  background: '#f1f5f9', 
                  border: 'none', 
                  borderRadius: 12, 
                  fontWeight: 600, 
                  cursor: 'pointer',
                  color: '#475569',
                  fontSize: 15,
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = '#e2e8f0';
                  e.target.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = '#f1f5f9';
                  e.target.style.transform = 'translateY(0)';
                }}
              >
                Cancel
              </button>
              <button 
                onClick={handleCreateRoute} 
                disabled={isSavingRoute || !routeName.trim() || selectedCustomers.length === 0}
                style={{ 
                  padding: '12px 28px', 
                  background: isSavingRoute || !routeName.trim() || selectedCustomers.length === 0 
                    ? '#cbd5e1' 
                    : 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)', 
                  color: '#fff', 
                  border: 'none', 
                  borderRadius: 12, 
                  fontWeight: 700, 
                  cursor: isSavingRoute || !routeName.trim() || selectedCustomers.length === 0 ? 'not-allowed' : 'pointer',
                  opacity: isSavingRoute ? 0.8 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 15,
                  boxShadow: isSavingRoute || !routeName.trim() || selectedCustomers.length === 0
                    ? 'none'
                    : '0 4px 12px rgba(22, 163, 74, 0.3)',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (!isSavingRoute && routeName.trim() && selectedCustomers.length > 0) {
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.boxShadow = '0 6px 16px rgba(22, 163, 74, 0.4)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSavingRoute && routeName.trim() && selectedCustomers.length > 0) {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 4px 12px rgba(22, 163, 74, 0.3)';
                  }
                }}
              >
                {isSavingRoute && <span className="material-icons" style={{ fontSize: 18, animation: 'spin 1s linear infinite' }}>sync</span>}
                {!isSavingRoute && <span className="material-icons" style={{ fontSize: 18 }}>add_circle</span>}
                {isSavingRoute ? 'Creating...' : 'Create Route'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Route Modal - Similar structure to Create Route Modal but with edit functionality */}
      {showEditRouteModal && editingRoute && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          padding: 20, animation: 'fadeIn 0.2s ease-in'
        }}>
          <div style={{
            width: '100%', maxWidth: 900, maxHeight: '90vh', background: '#fff', borderRadius: 20,
            boxShadow: '0 25px 60px rgba(0,0,0,0.25)', overflow: 'hidden', display: 'flex', flexDirection: 'column',
            animation: 'slideUp 0.3s ease-out'
          }}>
            <div style={{ 
              padding: '24px 28px', 
              background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backdropFilter: 'blur(10px)'
                }}>
                  <span className="material-icons" style={{ color: '#fff', fontSize: 28 }}>edit</span>
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: '#fff', fontSize: 22, marginBottom: 2 }}>Edit Route</div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>Update route details and customers</div>
                </div>
              </div>
              <button onClick={() => {
                setShowEditRouteModal(false);
                setEditingRoute(null);
                setEditRouteName('');
                setEditRouteDescription('');
                setEditSelectedPincode('');
                setEditPincodeInput('');
                setEditCustomerSearchInput('');
                setEditFilterMode('keyword');
                setEditSelectedCustomers([]);
                setEditCustomerCoordinates({});
                setEditSelectedCompanies([]);
              }} style={{ 
                border: 'none', 
                background: 'rgba(255,255,255,0.2)', 
                cursor: 'pointer', 
                fontSize: 24, 
                color: '#fff',
                width: 36,
                height: 36,
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'rgba(255,255,255,0.3)';
                e.target.style.transform = 'rotate(90deg)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'rgba(255,255,255,0.2)';
                e.target.style.transform = 'rotate(0deg)';
              }}
              >
                ×
              </button>
            </div>
            
            <div style={{ padding: 28, overflowY: 'auto', flex: 1, background: '#f8fafc' }}>
              {/* Route Name */}
              <div style={{ marginBottom: 24 }}>
                <label style={{ 
                  fontWeight: 600, 
                  color: '#1e293b', 
                  marginBottom: 10, 
                  display: 'flex', 
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 15 
                }}>
                  <span className="material-icons" style={{ fontSize: 18, color: '#8b5cf6' }}>label</span>
                  Route Name <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type="text"
                    value={editRouteName} 
                    onChange={(e) => setEditRouteName(e.target.value)} 
                    placeholder="Enter route name"
                    style={{ 
                      padding: '14px 16px 14px 48px', 
                      borderRadius: 12, 
                      border: '2px solid #e2e8f0', 
                      width: '100%', 
                      fontSize: 15, 
                      background: '#fff',
                      boxSizing: 'border-box',
                      transition: 'all 0.2s',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#8b5cf6';
                      e.target.style.boxShadow = '0 0 0 3px rgba(139, 92, 246, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#e2e8f0';
                      e.target.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
                    }}
                  />
                  <span className="material-icons" style={{ 
                    position: 'absolute', 
                    left: 16, 
                    top: '50%', 
                    transform: 'translateY(-50%)',
                    fontSize: 20,
                    color: '#94a3b8'
                  }}>route</span>
                </div>
              </div>

              {/* Description */}
              <div style={{ marginBottom: 24 }}>
                <label style={{ 
                  fontWeight: 600, 
                  color: '#1e293b', 
                  marginBottom: 10, 
                  display: 'flex', 
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 15 
                }}>
                  <span className="material-icons" style={{ fontSize: 18, color: '#8b5cf6' }}>description</span>
                  Description <span style={{ color: '#64748b', fontSize: 13, fontWeight: 400 }}>(Optional)</span>
                </label>
                <textarea 
                  value={editRouteDescription} 
                  onChange={(e) => setEditRouteDescription(e.target.value)} 
                  placeholder="Enter route description"
                  rows={3}
                  style={{ 
                    padding: '14px 16px', 
                    borderRadius: 12, 
                    border: '2px solid #e2e8f0', 
                    width: '100%', 
                    fontSize: 15, 
                    background: '#fff',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box',
                    transition: 'all 0.2s',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#8b5cf6';
                    e.target.style.boxShadow = '0 0 0 3px rgba(139, 92, 246, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e2e8f0';
                    e.target.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
                  }}
                />
              </div>

              {/* Company Filter Buttons */}
              {uniqueCompanies.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontWeight: 600, color: '#374151', marginBottom: 8, display: 'block', fontSize: 14 }}>
                    Filter by Company
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {uniqueCompanies.map(company => {
                      const isSelected = editSelectedCompanies.includes(company);
                      return (
                        <button
                          key={company}
                          onClick={() => {
                            if (isSelected) {
                              setEditSelectedCompanies(prev => prev.filter(c => c !== company));
                            } else {
                              setEditSelectedCompanies(prev => [...prev, company]);
                            }
                          }}
                          style={{
                            padding: '8px 16px',
                            borderRadius: 6,
                            border: `2px solid ${isSelected ? '#3b82f6' : '#e5e7eb'}`,
                            background: isSelected ? '#3b82f6' : '#fff',
                            color: isSelected ? '#fff' : '#374151',
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected) {
                              e.target.style.borderColor = '#3b82f6';
                              e.target.style.background = '#eff6ff';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) {
                              e.target.style.borderColor = '#e5e7eb';
                              e.target.style.background = '#fff';
                            }
                          }}
                        >
                          {isSelected && <span style={{ fontSize: 14 }}>✓</span>}
                          {company}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Pincode Filter */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <label style={{ fontWeight: 600, color: '#374151', fontSize: 14 }}>
                    {editFilterMode === 'keyword' ? 'Filter by Keyword' : 'Filter by Pincode'}
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: editFilterMode === 'keyword' ? '#3b82f6' : '#64748b', fontWeight: editFilterMode === 'keyword' ? 600 : 400, padding: '4px 8px' }}>Keyword</span>
                    <label style={{
                      position: 'relative',
                      display: 'inline-block',
                      width: 44,
                      height: 24
                    }}>
                      <input
                        type="checkbox"
                        checked={editFilterMode === 'pincode'}
                        onChange={(e) => {
                          const newMode = e.target.checked ? 'pincode' : 'keyword';
                          setEditFilterMode(newMode);
                          // Clear inputs when switching modes
                          if (newMode === 'pincode') {
                            setEditCustomerSearchInput('');
                          } else {
                            setEditPincodeInput('');
                            setEditSelectedPincode('');
                          }
                        }}
                        style={{ display: 'none' }}
                      />
                      <span style={{
                        position: 'absolute',
                        cursor: 'pointer',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: editFilterMode === 'pincode' ? '#3b82f6' : '#cbd5e1',
                        borderRadius: 24,
                        transition: 'background-color 0.3s',
                        display: 'flex',
                        alignItems: 'center',
                        padding: '2px'
                      }}>
                        <span style={{
                          content: '""',
                          position: 'absolute',
                          height: 20,
                          width: 20,
                          left: editFilterMode === 'pincode' ? '22px' : '2px',
                          bottom: '2px',
                          backgroundColor: '#fff',
                          borderRadius: '50%',
                          transition: 'left 0.3s',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                        }} />
                      </span>
                    </label>
                    <span style={{ fontSize: 12, color: editFilterMode === 'pincode' ? '#3b82f6' : '#64748b', fontWeight: editFilterMode === 'pincode' ? 600 : 400, padding: '4px 8px' }}>Pincode</span>
                  </div>
                </div>
                
                {editFilterMode === 'pincode' ? (
                <div style={{ position: 'relative' }}>
                  <input 
                    type="text"
                    value={editPincodeInput} 
                    onChange={(e) => {
                      setEditPincodeInput(e.target.value);
                      if (!e.target.value.trim()) {
                        setEditSelectedPincode('');
                      }
                    }} 
                    placeholder="Type pincode to search..."
                    style={{ 
                      padding: '12px 16px', 
                      borderRadius: 8, 
                      border: '2px solid #e5e7eb', 
                      width: '100%', 
                      fontSize: 15, 
                      background: '#fff',
                      boxSizing: 'border-box'
                    }} 
                  />
                  {editFilteredPincodes.length > 0 && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      background: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: 8,
                      marginTop: 4,
                      maxHeight: 200,
                      overflowY: 'auto',
                      zIndex: 1000,
                      boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                    }}>
                      {editFilteredPincodes.map(pincode => (
                        <div
                          key={pincode}
                          onClick={() => {
                            setEditPincodeInput(pincode);
                            setEditSelectedPincode(pincode);
                          }}
                          style={{
                            padding: '12px 16px',
                            cursor: 'pointer',
                            borderBottom: '1px solid #f1f5f9'
                          }}
                          onMouseEnter={(e) => e.target.style.background = '#f8fafc'}
                          onMouseLeave={(e) => e.target.style.background = '#fff'}
                        >
                          {pincode}
                        </div>
                      ))}
                    </div>
                  )}
                {editSelectedPincode && (
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginTop: 8,
                    padding: '8px 12px',
                    background: '#f0f9ff',
                    borderRadius: 6
                  }}>
                    <span style={{ fontSize: 14, color: '#0369a1', fontWeight: 600 }}>Selected: {editSelectedPincode}</span>
                    <button
                      onClick={() => {
                        setEditPincodeInput('');
                        setEditSelectedPincode('');
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#0369a1',
                        cursor: 'pointer',
                        fontSize: 14,
                        fontWeight: 600,
                        textDecoration: 'underline'
                      }}
                    >
                      Clear
                    </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <input 
                      type="text"
                      value={editCustomerSearchInput} 
                      onChange={(e) => {
                        setEditCustomerSearchInput(e.target.value);
                      }} 
                      placeholder="Search by name, pincode, address, company, or any keyword..."
                      style={{ 
                        padding: '12px 16px', 
                        borderRadius: 8, 
                        border: '2px solid #e5e7eb', 
                        width: '100%', 
                        fontSize: 15, 
                        background: '#fff',
                        boxSizing: 'border-box'
                      }} 
                    />
                    {editCustomerSearchInput.trim() && (
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        marginTop: 8,
                        padding: '8px 12px',
                        background: '#f0f9ff',
                        borderRadius: 6
                      }}>
                        <span style={{ fontSize: 14, color: '#0369a1', fontWeight: 600 }}>
                          {editFilteredCustomersForRoute.length} customer(s) found
                        </span>
                        <button
                          onClick={() => {
                            setEditCustomerSearchInput('');
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#0369a1',
                            cursor: 'pointer',
                            fontSize: 14,
                            fontWeight: 600,
                            textDecoration: 'underline'
                          }}
                        >
                          Clear
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Selected Customers Summary */}
              {editSelectedCustomers.length > 0 && (
                <div style={{ marginBottom: 20, padding: 16, background: '#f0f9ff', borderRadius: 8, border: '1px solid #bae6fd' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <label style={{ fontWeight: 600, color: '#0369a1', fontSize: 14 }}>
                      Selected Customers ({editSelectedCustomers.length} total)
                    </label>
                    <button
                      onClick={() => setEditSelectedCustomers([])}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#0369a1',
                        cursor: 'pointer',
                        fontSize: 14,
                        fontWeight: 600,
                        textDecoration: 'underline'
                      }}
                    >
                      Clear All
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {editSelectedCustomers.map(customerId => {
                      const customer = customers.find(c => c.customer_id === customerId);
                      if (!customer) return null;
                      return (
                        <div
                          key={customerId}
                          style={{
                            padding: '8px 12px',
                            background: '#fff',
                            border: '1px solid #7dd3fc',
                            borderRadius: 6,
                            fontSize: 13,
                            color: '#0369a1',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6
                          }}
                        >
                          <span style={{ fontWeight: 600 }}>{customer.name}</span>
                          <span style={{ color: '#64748b', fontSize: 12 }}>({customer.pincode})</span>
                          <button
                            onClick={() => setEditSelectedCustomers(prev => prev.filter(id => id !== customerId))}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#ef4444',
                              cursor: 'pointer',
                              fontSize: 16,
                              padding: 0,
                              marginLeft: 4,
                              display: 'flex',
                              alignItems: 'center'
                            }}
                            title="Remove"
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Customer Selection */}
              {((editFilterMode === 'pincode' && editSelectedPincode) || (editFilterMode === 'keyword' && editCustomerSearchInput.trim())) && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <label style={{ fontWeight: 600, color: '#374151', fontSize: 14 }}>
                      {editFilterMode === 'pincode' 
                        ? `Customers in Pincode ${editSelectedPincode} (${editFilteredCustomersForRoute.filter(c => editSelectedCustomers.includes(c.id)).length} selected)`
                        : `Search Results (${editFilteredCustomersForRoute.filter(c => editSelectedCustomers.includes(c.id)).length} selected)`
                      }
                    </label>
                  </div>

                  {customersLoading ? (
                    <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
                      <span className="material-icons" style={{ fontSize: 48, color: '#3b82f6', marginBottom: 16, display: 'block' }}>sync</span>
                      <div style={{ fontSize: 16, fontWeight: 500 }}>Loading customers...</div>
                    </div>
                  ) : editFilteredCustomersForRoute.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 40, color: '#64748b', background: '#f8fafc', borderRadius: 8 }}>
                      <div style={{ fontSize: 14 }}>
                        {editFilterMode === 'pincode' 
                          ? `No customers found for pincode ${editSelectedPincode}`
                          : `No customers found matching "${editCustomerSearchInput}"`
                        }
                      </div>
                    </div>
                  ) : (
                    <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 8 }}>
                      {editFilteredCustomersForRoute.map(customer => {
                        const isSelected = editSelectedCustomers.includes(customer.id);
                        const hasCoordinates = customer.latitude && customer.longitude;
                        return (
                          <div
                            key={customer.id}
                            onClick={() => {
                              if (isSelected) {
                                setEditSelectedCustomers(prev => prev.filter(id => id !== customer.id));
                              } else {
                                setEditSelectedCustomers(prev => [...prev, customer.id]);
                              }
                            }}
                            style={{
                              padding: 16,
                              borderBottom: '1px solid #f1f5f9',
                              cursor: 'pointer',
                              background: isSelected ? '#eff6ff' : '#fff',
                              transition: 'background 0.2s'
                            }}
                            onMouseEnter={(e) => {
                              if (!isSelected) e.target.style.background = '#f8fafc';
                            }}
                            onMouseLeave={(e) => {
                              if (!isSelected) e.target.style.background = '#fff';
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                              <div
                                style={{
                                  width: 24,
                                  height: 24,
                                  borderRadius: 4,
                                  border: `2px solid ${isSelected ? '#3b82f6' : '#d1d5db'}`,
                                  background: isSelected ? '#3b82f6' : '#fff',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer',
                                  marginTop: 2,
                                  flexShrink: 0
                                }}
                              >
                                {isSelected && <span style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>✓</span>}
                              </div>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600, color: isSelected ? '#1e40af' : '#1e293b', marginBottom: 4 }}>
                                  {customer.name}
                                </div>
                                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>
                                  <span className="material-icons" style={{ fontSize: 14, verticalAlign: 'middle', marginRight: 4 }}>business</span>
                                  {customer.companyName}
                                </div>
                                {customer.address && (
                                  <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>
                                    {customer.address}
                                  </div>
                                )}
                                <div style={{ fontSize: 12, color: '#94a3b8' }}>Pincode: {customer.pincode}</div>
                                {hasCoordinates ? (
                                  <div style={{ fontSize: 12, color: '#10b981', marginTop: 4, fontWeight: 500 }}>
                                    📍 {customer.latitude?.toFixed(6)}, {customer.longitude?.toFixed(6)}
                                  </div>
                                ) : (
                                  <div style={{ fontSize: 12, color: '#f59e0b', marginTop: 4, fontStyle: 'italic' }}>
                                    No coordinates set
                                  </div>
                                )}
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditCustomerInEditRoute(customer);
                                }}
                                style={{
                                  padding: '6px 12px',
                                  background: '#3b82f6',
                                  color: '#fff',
                                  border: 'none',
                                  borderRadius: 6,
                                  fontSize: 12,
                                  fontWeight: 500,
                                  cursor: 'pointer',
                                  flexShrink: 0
                                }}
                              >
                                Edit
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{ 
              padding: '20px 28px', 
              borderTop: '1px solid #e2e8f0', 
              background: '#fff',
              display: 'flex', 
              justifyContent: 'flex-end', 
              gap: 12,
              boxShadow: '0 -4px 12px rgba(0,0,0,0.04)'
            }}>
              <button 
                onClick={() => {
                  setShowEditRouteModal(false);
                  setEditingRoute(null);
                  setEditRouteName('');
                  setEditRouteDescription('');
                  setEditSelectedPincode('');
                  setEditPincodeInput('');
                  setEditSelectedCustomers([]);
                  setEditCustomerCoordinates({});
                }}
                style={{ 
                  padding: '12px 24px', 
                  background: '#f1f5f9', 
                  color: '#475569', 
                  border: 'none', 
                  borderRadius: 12, 
                  fontWeight: 600, 
                  cursor: 'pointer',
                  fontSize: 15,
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = '#e2e8f0';
                  e.target.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = '#f1f5f9';
                  e.target.style.transform = 'translateY(0)';
                }}
              >
                Cancel
              </button>
              <button 
                onClick={handleUpdateRoute} 
                disabled={isUpdatingRoute || !editRouteName.trim() || editSelectedCustomers.length === 0}
                style={{ 
                  padding: '12px 28px', 
                  background: isUpdatingRoute || !editRouteName.trim() || editSelectedCustomers.length === 0 
                    ? '#cbd5e1' 
                    : 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', 
                  color: '#fff', 
                  border: 'none', 
                  borderRadius: 12, 
                  fontWeight: 700, 
                  cursor: isUpdatingRoute || !editRouteName.trim() || editSelectedCustomers.length === 0 ? 'not-allowed' : 'pointer',
                  opacity: isUpdatingRoute ? 0.8 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 15,
                  boxShadow: isUpdatingRoute || !editRouteName.trim() || editSelectedCustomers.length === 0
                    ? 'none'
                    : '0 4px 12px rgba(139, 92, 246, 0.3)',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (!isUpdatingRoute && editRouteName.trim() && editSelectedCustomers.length > 0) {
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.boxShadow = '0 6px 16px rgba(139, 92, 246, 0.4)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isUpdatingRoute && editRouteName.trim() && editSelectedCustomers.length > 0) {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.3)';
                  }
                }}
              >
                {isUpdatingRoute && <span className="material-icons" style={{ fontSize: 18, animation: 'spin 1s linear infinite' }}>sync</span>}
                {!isUpdatingRoute && <span className="material-icons" style={{ fontSize: 18 }}>save</span>}
                {isUpdatingRoute ? 'Updating...' : 'Update Route'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Customer Coordinates Modal */}
      {showEditCustomerModal && editingCustomer && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001,
          padding: 20
        }}>
          <div style={{
            width: '100%', maxWidth: 500, background: '#fff', borderRadius: 16,
            boxShadow: '0 20px 50px rgba(0,0,0,0.3)', overflow: 'hidden'
          }}>
            <div style={{ padding: 20, borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 18 }}>Edit Coordinates</div>
              <button onClick={() => setShowEditCustomerModal(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 24, color: '#64748b' }}>
                ×
              </button>
            </div>
            
            <div style={{ padding: 20 }}>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 600, color: '#1e40af', marginBottom: 4 }}>{editingCustomer.name}</div>
                <div style={{ fontSize: 14, color: '#64748b' }}>{editingCustomer.address}</div>
              </div>

              {/* Action Buttons */}
              <div style={{ marginBottom: 20, display: 'flex', gap: 8 }}>
                <button
                  onClick={handleFetchFromAddress}
                  disabled={isGeocoding || !editingCustomer.address}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    background: isGeocoding || !editingCustomer.address ? '#9ca3af' : '#3b82f6',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: isGeocoding || !editingCustomer.address ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8
                  }}
                >
                  {isGeocoding ? (
                    <span className="material-icons" style={{ fontSize: 16, animation: 'spin 1s linear infinite' }}>sync</span>
                  ) : (
                    <span className="material-icons" style={{ fontSize: 16 }}>location_on</span>
                  )}
                  {isGeocoding ? 'Fetching...' : 'Fetch from Address'}
                </button>
                <button
                  onClick={() => {
                    // Open Google Maps in new tab for coordinate selection
                    const url = `https://www.google.com/maps?q=${editLatitude || '0'},${editLongitude || '0'}`;
                    window.open(url, '_blank');
                    alert('Please select location on Google Maps, then copy coordinates and paste them below.');
                  }}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    background: '#10b981',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8
                  }}
                >
                  <span className="material-icons" style={{ fontSize: 16 }}>map</span>
                  Select on Map
                </button>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontWeight: 600, color: '#374151', marginBottom: 8, display: 'block', fontSize: 14 }}>Latitude (-90 to 90)</label>
                <input 
                  type="number"
                  step="any"
                  value={editLatitude} 
                  onChange={(e) => setEditLatitude(e.target.value)} 
                  placeholder="e.g., 12.9716"
                  style={{ 
                    padding: '12px 16px', 
                    borderRadius: 8, 
                    border: '2px solid #e5e7eb', 
                    width: '100%', 
                    fontSize: 15, 
                    background: '#fff',
                    boxSizing: 'border-box'
                  }} 
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ fontWeight: 600, color: '#374151', marginBottom: 8, display: 'block', fontSize: 14 }}>Longitude (-180 to 180)</label>
                <input 
                  type="number"
                  step="any"
                  value={editLongitude} 
                  onChange={(e) => setEditLongitude(e.target.value)} 
                  placeholder="e.g., 77.5946"
                  style={{ 
                    padding: '12px 16px', 
                    borderRadius: 8, 
                    border: '2px solid #e5e7eb', 
                    width: '100%', 
                    fontSize: 15, 
                    background: '#fff',
                    boxSizing: 'border-box'
                  }} 
                />
              </div>
            </div>

            <div style={{ padding: 16, borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button 
                onClick={() => {
                  setShowEditCustomerModal(false);
                  setEditingCustomer(null);
                  setEditLatitude('');
                  setEditLongitude('');
                }} 
                style={{ 
                  padding: '10px 20px', 
                  background: '#e5e7eb', 
                  border: 'none', 
                  borderRadius: 8, 
                  fontWeight: 600, 
                  cursor: 'pointer',
                  color: '#374151'
                }}
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveCoordinates} 
                style={{ 
                  padding: '10px 20px', 
                  background: '#16a34a', 
                  color: '#fff', 
                  border: 'none', 
                  borderRadius: 8, 
                  fontWeight: 700, 
                  cursor: 'pointer'
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Route Modal */}
      {showAssignRouteModal && assigningUser && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1002,
          padding: 20, animation: 'fadeIn 0.2s ease-in'
        }}>
          <div style={{
            width: '100%', maxWidth: 650, maxHeight: '90vh', background: '#fff', borderRadius: 20,
            boxShadow: '0 25px 60px rgba(0,0,0,0.25)', overflow: 'hidden', display: 'flex', flexDirection: 'column',
            animation: 'slideUp 0.3s ease-out'
          }}>
            <div style={{ 
              padding: '24px 28px', 
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backdropFilter: 'blur(10px)'
                }}>
                  <span className="material-icons" style={{ color: '#fff', fontSize: 28 }}>assignment</span>
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: '#fff', fontSize: 22, marginBottom: 2 }}>Assign Route</div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>Assign a route to {assigningUser.name}</div>
                </div>
              </div>
              <button 
                onClick={() => setShowAssignRouteModal(false)} 
                style={{ 
                  border: 'none', 
                  background: 'rgba(255,255,255,0.2)', 
                  cursor: 'pointer', 
                  fontSize: 24, 
                  color: '#fff',
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(255,255,255,0.3)';
                  e.target.style.transform = 'rotate(90deg)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'rgba(255,255,255,0.2)';
                  e.target.style.transform = 'rotate(0deg)';
                }}
              >
                ×
              </button>
            </div>
            
            <div style={{ padding: 28, overflowY: 'auto', flex: 1, background: '#f8fafc' }}>
              <div style={{ 
                marginBottom: 24, 
                padding: 20, 
                background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                borderRadius: 16,
                border: '1px solid #bfdbfe',
                boxShadow: '0 2px 8px rgba(59, 130, 246, 0.1)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <span className="material-icons" style={{ fontSize: 20, color: '#fff' }}>person</span>
                  </div>
                  <div>
                    <div style={{ fontSize: 16, color: '#1e40af', fontWeight: 700 }}>{assigningUser.name}</div>
                    <div style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>{assigningUser.email}</div>
                  </div>
                </div>
              </div>

              {/* Route Selection */}
              <div style={{ marginBottom: 24 }}>
                <label style={{ 
                  fontWeight: 600, 
                  color: '#1e293b', 
                  marginBottom: 10, 
                  display: 'flex', 
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 15 
                }}>
                  <span className="material-icons" style={{ fontSize: 18, color: '#3b82f6' }}>route</span>
                  Select Route <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <select
                    value={selectedRouteForAssign?.id || ''}
                    onChange={(e) => {
                      const route = routes.find(r => r.id === e.target.value);
                      setSelectedRouteForAssign(route || null);
                    }}
                    style={{
                      padding: '14px 16px 14px 48px',
                      borderRadius: 12,
                      border: '2px solid #e2e8f0',
                      width: '100%',
                      fontSize: 15,
                      background: '#fff',
                      cursor: 'pointer',
                      boxSizing: 'border-box',
                      transition: 'all 0.2s',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                      appearance: 'none'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#3b82f6';
                      e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#e2e8f0';
                      e.target.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
                    }}
                  >
                    <option value="">Select a route</option>
                    {routes.map(route => (
                      <option key={route.id} value={route.id}>
                        {route.name} ({route.customerCount || 0} customers)
                      </option>
                    ))}
                  </select>
                  <span className="material-icons" style={{ 
                    position: 'absolute', 
                    left: 16, 
                    top: '50%', 
                    transform: 'translateY(-50%)',
                    fontSize: 20,
                    color: '#94a3b8',
                    pointerEvents: 'none'
                  }}>route</span>
                  <span className="material-icons" style={{ 
                    position: 'absolute', 
                    right: 16, 
                    top: '50%', 
                    transform: 'translateY(-50%)',
                    fontSize: 20,
                    color: '#94a3b8',
                    pointerEvents: 'none'
                  }}>arrow_drop_down</span>
                </div>
              </div>

              {/* Salesperson Email */}
              <div style={{ marginBottom: 24 }}>
                <label style={{ 
                  fontWeight: 600, 
                  color: '#1e293b', 
                  marginBottom: 10, 
                  display: 'flex', 
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 15 
                }}>
                  <span className="material-icons" style={{ fontSize: 18, color: '#3b82f6' }}>email</span>
                  Salesperson Email <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type="email"
                    value={salespersonEmail} 
                    onChange={(e) => setSalespersonEmail(e.target.value)} 
                    placeholder="Enter salesperson email"
                    style={{ 
                      padding: '14px 16px 14px 48px', 
                      borderRadius: 12, 
                      border: '2px solid #e2e8f0', 
                      width: '100%', 
                      fontSize: 15, 
                      background: '#fff',
                      boxSizing: 'border-box',
                      transition: 'all 0.2s',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#3b82f6';
                      e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#e2e8f0';
                      e.target.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
                    }}
                  />
                  <span className="material-icons" style={{ 
                    position: 'absolute', 
                    left: 16, 
                    top: '50%', 
                    transform: 'translateY(-50%)',
                    fontSize: 20,
                    color: '#94a3b8'
                  }}>email</span>
                </div>
              </div>

              {/* Days of Week */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontWeight: 600, color: '#374151', marginBottom: 8, display: 'block', fontSize: 14 }}>
                  Days of Week {selectedDaysOfWeek.length > 0 && `(${selectedDaysOfWeek.length} selected)`}
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <button
                    onClick={() => {
                      // "Daily" clears all day selections
                      setSelectedDaysOfWeek([]);
                    }}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 20,
                      border: `2px solid ${selectedDaysOfWeek.length === 0 ? '#3b82f6' : '#d1d5db'}`,
                      background: selectedDaysOfWeek.length === 0 ? '#3b82f6' : '#fff',
                      color: selectedDaysOfWeek.length === 0 ? '#fff' : '#374151',
                      fontSize: 14,
                      fontWeight: 500,
                      cursor: 'pointer'
                    }}
                  >
                    Daily
                  </button>
                  {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, index) => {
                    const isSelected = selectedDaysOfWeek.includes(index);
                    return (
                      <button
                        key={index}
                        onClick={() => {
                          // Toggle day selection
                          if (isSelected) {
                            setSelectedDaysOfWeek(prev => prev.filter(d => d !== index));
                          } else {
                            setSelectedDaysOfWeek(prev => [...prev, index]);
                          }
                        }}
                        style={{
                          padding: '8px 16px',
                          borderRadius: 20,
                          border: `2px solid ${isSelected ? '#3b82f6' : '#d1d5db'}`,
                          background: isSelected ? '#3b82f6' : '#fff',
                          color: isSelected ? '#fff' : '#374151',
                          fontSize: 14,
                          fontWeight: 500,
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        {day.substring(0, 3)}
                      </button>
                    );
                  })}
                </div>
                {selectedDaysOfWeek.length > 0 && (
                  <div style={{ marginTop: 8, fontSize: 12, color: '#64748b' }}>
                    Selected: {selectedDaysOfWeek.map(dayIndex => {
                      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                      return dayNames[dayIndex];
                    }).join(', ')}
                  </div>
                )}
              </div>

              {/* Recurring Toggle */}
              <div style={{ marginBottom: 20 }}>
                <div
                  onClick={() => setIsRecurring(!isRecurring)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 16px',
                    border: '2px solid #e5e7eb',
                    borderRadius: 8,
                    cursor: 'pointer',
                    background: '#fff'
                  }}
                >
                  <label style={{ fontWeight: 600, color: '#374151', fontSize: 14, cursor: 'pointer' }}>Recurring</label>
                  <div style={{
                    width: 50,
                    height: 30,
                    borderRadius: 15,
                    background: isRecurring ? '#3b82f6' : '#d1d5db',
                    position: 'relative',
                    transition: 'background-color 0.2s'
                  }}>
                    <div style={{
                      width: 26,
                      height: 26,
                      borderRadius: '50%',
                      background: '#fff',
                      position: 'absolute',
                      top: 2,
                      right: isRecurring ? 2 : 22,
                      transition: 'right 0.2s',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }} />
                  </div>
                </div>
              </div>
            </div>

            <div style={{ 
              padding: '20px 28px', 
              borderTop: '1px solid #e2e8f0', 
              background: '#fff',
              display: 'flex', 
              justifyContent: 'flex-end', 
              gap: 12,
              boxShadow: '0 -4px 12px rgba(0,0,0,0.04)'
            }}>
              <button 
                onClick={() => setShowAssignRouteModal(false)} 
                style={{ 
                  padding: '12px 24px', 
                  background: '#f1f5f9', 
                  border: 'none', 
                  borderRadius: 12, 
                  fontWeight: 600, 
                  cursor: 'pointer',
                  color: '#475569',
                  fontSize: 15,
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = '#e2e8f0';
                  e.target.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = '#f1f5f9';
                  e.target.style.transform = 'translateY(0)';
                }}
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveAssignment} 
                disabled={isSavingAssignment || !selectedRouteForAssign || !salespersonEmail.trim()}
                style={{ 
                  padding: '12px 28px', 
                  background: isSavingAssignment || !selectedRouteForAssign || !salespersonEmail.trim() 
                    ? '#cbd5e1' 
                    : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', 
                  color: '#fff', 
                  border: 'none', 
                  borderRadius: 12, 
                  fontWeight: 700, 
                  cursor: isSavingAssignment || !selectedRouteForAssign || !salespersonEmail.trim() ? 'not-allowed' : 'pointer',
                  opacity: isSavingAssignment ? 0.8 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 15,
                  boxShadow: isSavingAssignment || !selectedRouteForAssign || !salespersonEmail.trim()
                    ? 'none'
                    : '0 4px 12px rgba(59, 130, 246, 0.3)',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (!isSavingAssignment && selectedRouteForAssign && salespersonEmail.trim()) {
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.4)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSavingAssignment && selectedRouteForAssign && salespersonEmail.trim()) {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
                  }
                }}
              >
                {isSavingAssignment && <span className="material-icons" style={{ fontSize: 18, animation: 'spin 1s linear infinite' }}>sync</span>}
                {!isSavingAssignment && <span className="material-icons" style={{ fontSize: 18 }}>assignment</span>}
                {isSavingAssignment ? 'Assigning...' : 'Assign Route'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Route Actions Modal */}
      {showRouteActionsModal && routeActionsUser && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1002,
          padding: 20, animation: 'fadeIn 0.2s ease-in'
        }}>
          <div style={{
            width: '100%', maxWidth: 650, maxHeight: '90vh', background: '#fff', borderRadius: 20,
            boxShadow: '0 25px 60px rgba(0,0,0,0.25)', overflow: 'hidden', display: 'flex', flexDirection: 'column',
            animation: 'slideUp 0.3s ease-out'
          }}>
            <div style={{ 
              padding: '24px 28px', 
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backdropFilter: 'blur(10px)'
                }}>
                  <span className="material-icons" style={{ color: '#fff', fontSize: 28 }}>settings</span>
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: '#fff', fontSize: 22, marginBottom: 2 }}>Route Actions</div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>Manage routes for {routeActionsUser.name}</div>
                </div>
              </div>
              <button 
                onClick={() => setShowRouteActionsModal(false)} 
                style={{ 
                  border: 'none', 
                  background: 'rgba(255,255,255,0.2)', 
                  cursor: 'pointer', 
                  fontSize: 24, 
                  color: '#fff',
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(255,255,255,0.3)';
                  e.target.style.transform = 'rotate(90deg)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'rgba(255,255,255,0.2)';
                  e.target.style.transform = 'rotate(0deg)';
                }}
              >
                ×
              </button>
            </div>
            
            <div style={{ padding: 28, overflowY: 'auto', flex: 1, background: '#f8fafc' }}>
              <div style={{ 
                marginBottom: 24, 
                padding: 20, 
                background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                borderRadius: 16,
                border: '1px solid #bfdbfe',
                boxShadow: '0 2px 8px rgba(59, 130, 246, 0.1)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <span className="material-icons" style={{ fontSize: 20, color: '#fff' }}>person</span>
                  </div>
                  <div>
                    <div style={{ fontSize: 16, color: '#1e40af', fontWeight: 700 }}>{routeActionsUser.name}</div>
                    <div style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>{routeActionsUser.email}</div>
                  </div>
                </div>
              </div>

              {/* Assign Route Button */}
              <div style={{ marginBottom: 16 }}>
                <button
                  onClick={() => {
                    setShowRouteActionsModal(false);
                    handleAssignRoute(routeActionsUser);
                  }}
                  style={{
                    width: '100%',
                    padding: '16px 24px',
                    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 12,
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    boxSizing: 'border-box',
                    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)';
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)';
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
                  }}
                >
                  <span className="material-icons" style={{ fontSize: 22 }}>assignment</span>
                  Assign Route
                </button>
              </div>

              {/* View Assigned Routes Button */}
              <div style={{ marginBottom: 24 }}>
                <button
                  onClick={() => setShowAssignedRoutes(!showAssignedRoutes)}
                  style={{
                    width: '100%',
                    padding: '16px 24px',
                    background: showAssignedRoutes 
                      ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)'
                      : 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 12,
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    boxSizing: 'border-box',
                    boxShadow: showAssignedRoutes 
                      ? '0 4px 12px rgba(99, 102, 241, 0.3)'
                      : '0 4px 12px rgba(139, 92, 246, 0.3)'
                  }}
                  onMouseEnter={(e) => {
                    if (showAssignedRoutes) {
                      e.target.style.background = 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)';
                    } else {
                      e.target.style.background = 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)';
                    }
                    e.target.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    if (showAssignedRoutes) {
                      e.target.style.background = 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)';
                    } else {
                      e.target.style.background = 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)';
                    }
                    e.target.style.transform = 'translateY(0)';
                  }}
                >
                  <span className="material-icons" style={{ fontSize: 22 }}>{showAssignedRoutes ? 'visibility_off' : 'visibility'}</span>
                  {showAssignedRoutes ? 'Hide Assigned Routes' : 'View Assigned Routes'}
                </button>
              </div>

              {/* Assigned Routes Display */}
              {showAssignedRoutes && (
                <div style={{ 
                  marginBottom: 20, 
                  padding: 16, 
                  background: '#f8fafc', 
                  borderRadius: 8,
                  border: '1px solid #e2e8f0'
                }}>
                  <div style={{ 
                    fontSize: 14, 
                    fontWeight: 600, 
                    color: '#1e293b', 
                    marginBottom: 12 
                  }}>
                    Assigned Routes
                  </div>
                  {(() => {
                    // Get routes assigned to this user
                    const assignments = JSON.parse(localStorage.getItem('route_assignments') || '[]');
                    const userAssignments = assignments.filter(a => a.user_id === routeActionsUser.email);
                    const assignedRouteNames = userAssignments.map(a => a.route_name).filter(Boolean);
                    
                    if (assignedRouteNames.length === 0) {
                      return (
                        <div style={{ 
                          color: '#94a3b8', 
                          fontSize: 13, 
                          fontStyle: 'italic',
                          padding: '20px',
                          textAlign: 'center'
                        }}>
                          No routes assigned
                        </div>
                      );
                    }
                    
                    return (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {assignedRouteNames.map((routeName, idx) => {
                          // Find the route object by name
                          const route = routes.find(r => r.name === routeName);
                          
                          return (
                            <div
                              key={idx}
                              style={{
                                padding: '8px 14px',
                                background: '#dbeafe',
                                color: '#1e40af',
                                borderRadius: 8,
                                fontSize: 13,
                                fontWeight: 500,
                                border: '1px solid #bfdbfe',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                              }}
                              onClick={() => {
                                if (route) {
                                  setShowRouteActionsModal(false);
                                  handleEditRoute(route);
                                }
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#bfdbfe';
                                e.currentTarget.style.transform = 'translateY(-1px)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = '#dbeafe';
                                e.currentTarget.style.transform = 'translateY(0)';
                              }}
                            >
                              <span className="material-icons" style={{ fontSize: 16 }}>route</span>
                              {routeName}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation(); // Prevent triggering the route edit
                                  handleDeleteAssignment(routeName, routeActionsUser.email);
                                }}
                                style={{
                                  marginLeft: 4,
                                  padding: '2px 4px',
                                  background: 'transparent',
                                  border: 'none',
                                  color: '#ef4444',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  borderRadius: 4,
                                  transition: 'background-color 0.2s ease'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = '#fee2e2';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'transparent';
                                }}
                                title="Remove assignment"
                              >
                                <span className="material-icons" style={{ fontSize: 18 }}>close</span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Empty content area - ready for future implementation */}
              {!showAssignedRoutes && (
                <div style={{ 
                  padding: 40, 
                  textAlign: 'center', 
                  color: '#94a3b8', 
                  fontSize: 14,
                  fontStyle: 'italic'
                }}>
                  Additional route actions content will be added here
                </div>
              )}
            </div>

            <div style={{ 
              padding: '20px 28px', 
              borderTop: '1px solid #e2e8f0', 
              background: '#fff',
              display: 'flex', 
              justifyContent: 'flex-end', 
              gap: 12,
              boxShadow: '0 -4px 12px rgba(0,0,0,0.04)'
            }}>
              <button 
                onClick={() => setShowRouteActionsModal(false)} 
                style={{ 
                  padding: '12px 24px', 
                  background: '#f1f5f9', 
                  border: 'none', 
                  borderRadius: 12, 
                  fontWeight: 600, 
                  cursor: 'pointer',
                  color: '#475569',
                  fontSize: 15,
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = '#e2e8f0';
                  e.target.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = '#f1f5f9';
                  e.target.style.transform = 'translateY(0)';
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Purchase Users Modal */}
      <PurchaseUsersModal
        isOpen={showPurchaseModal}
        onClose={() => setShowPurchaseModal(false)}
        onSuccess={async () => {
          // Refresh subscription info
          try {
            const subData = await checkSubscriptionStatus();
            setSubscriptionInfo(subData);
            // API endpoint /api/subscription/user-count does not exist in backend
            setUserCountInfo(null);
          } catch (error) {
            console.error('Error refreshing subscription info:', error);
          }
          
          setShowPurchaseModal(false);
          setFormSuccess('User limit increased successfully! You can now create more users.');
          setFormError('');
          // Clear form to allow fresh user creation
          setTimeout(() => {
            setFormSuccess('');
          }, 5000);
        }}
      />
    </div>
  );
}

export default CreateAccess;
