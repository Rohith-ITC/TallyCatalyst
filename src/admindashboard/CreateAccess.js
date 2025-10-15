import React, { useState, useEffect, useMemo } from 'react';
import { getApiUrl } from '../config';
import { apiGet, apiPost } from '../utils/apiUtils';

function CreateAccess() {
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
  const [activeTab, setActiveTab] = useState('ledger'); // 'ledger', 'stock', or 'stockcategory'
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
  const token = sessionStorage.getItem('token');

  // Fetch available connections (API call for fresh data - always overwrites cache)
  const fetchConnections = async () => {
    console.log('fetchConnections called - making API call to overwrite cache');
    setLoading(true);
    setTableError('');
    try {
      // Always make API call to get fresh data and overwrite cache
      const cacheBuster = Date.now();
      console.log('Making API call with cache buster:', cacheBuster);
      const data = await apiGet(`/api/tally/user-connections?ts=${cacheBuster}`);
      
      if (data && data.success) {
        const created = Array.isArray(data.createdByMe) ? data.createdByMe : [];
        const shared = Array.isArray(data.sharedWithMe) ? data.sharedWithMe : [];
        const allApiConnections = [...created, ...shared];
        
        console.log('API Response - All connections:', allApiConnections);
        console.log('API Response - Created by me:', created);
        console.log('API Response - Shared with me:', shared);
        
        // Filter for companies with Full Access (same as Share Access)
        const filteredConnections = allApiConnections.filter(conn => 
          conn.status === 'Connected' && conn.access_type === 'Full Access'
        );
        
        console.log('Filtered connections:', filteredConnections);
        console.log('Filtered count:', filteredConnections.length);
        
        // Always update connections state with fresh data
        setConnections(filteredConnections);
        console.log('Connections state updated with:', filteredConnections.length, 'companies');
        
        // Always overwrite session storage with fresh API data
        sessionStorage.setItem('allConnections', JSON.stringify(allApiConnections));
        console.log('Session storage overwritten with fresh data');
        
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
        console.log('Internal users fetched:', data.users);
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
        console.log('Roles fetched:', data.roles);
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

      setLedgerGroups(ledgerGroupsData);
      setStockGroups(stockGroupsData);
      setStockCategories(stockCategoriesData);
      
      console.log('🎯 Final state - Ledger groups:', ledgerGroupsData.length);
      console.log('🎯 Final state - Stock groups:', stockGroupsData.length);
      console.log('🎯 Final state - Stock categories:', stockCategoriesData.length);

    } catch (error) {
      console.error('❌ Error fetching groups:', error);
      setLedgerGroups([]);
      setStockGroups([]);
      setStockCategories([]);
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
        
        console.log('📥 Setting selected ledger groups:', selectedLedgerGroupIds);
        console.log('📥 Setting selected stock groups:', selectedStockGroupIds);
        console.log('📥 Setting selected stock categories:', selectedStockCategoryIds);
        
        setSelectedLedgerGroups(selectedLedgerGroupIds);
        setSelectedStockGroups(selectedStockGroupIds);
        setSelectedStockCategories(selectedStockCategoryIds);
      } else {
        console.log('📥 No existing groups found or invalid response');
        setSelectedLedgerGroups([]);
        setSelectedStockGroups([]);
        setSelectedStockCategories([]);
      }
    } catch (error) {
      console.error('❌ Error fetching user company groups:', error);
      setSelectedLedgerGroups([]);
      setSelectedStockGroups([]);
      setSelectedStockCategories([]);
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

      // Try different possible user ID fields
      const userId = editingUser.id || editingUser.user_id || editingUser.email || editingUser.userId;
      
      const payload = {
        userid: userId,
        tallyloc_id: selectedCompanyForGroups.tallyloc_id,
        company_name: selectedCompanyForGroups.company,
        guid: selectedCompanyForGroups.guid,
        ledger_groups: ledgerGroupsPayload,
        stock_groups: stockGroupsPayload,
        stock_categories: stockCategoriesPayload
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
    setSelectedLedgerGroups([]);
    setSelectedStockGroups([]);
    setSelectedStockCategories([]);
    setLedgerSearchTerm('');
    setStockSearchTerm('');
    setStockCategorySearchTerm('');
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

  // Filter users based on search term
  const filteredUsers = internalUsers.filter(user => 
    user.name.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(userSearchTerm.toLowerCase())
  );

  return (
    <div style={{ margin: '0', padding: 0, width: '100%', maxWidth: 1400, boxSizing: 'border-box' }}>
      {/* Header Section */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32, marginTop: 50 }}>
        <div>
          <h2 style={{ color: '#1e40af', fontWeight: 700, fontSize: 28, margin: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="material-icons" style={{ fontSize: 32, color: '#1e40af' }}>people</span>
            User Management
          </h2>
          <div style={{ color: '#64748b', fontSize: 16, marginTop: 4 }}>Grant access to users</div>
        </div>
        <div style={{ 
          background: '#f0f9ff', 
          color: '#0369a1', 
          padding: '8px 16px', 
          borderRadius: 20, 
          fontSize: 14, 
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
          <span className="material-icons" style={{ fontSize: 18 }}>business</span>
          {connections.length} companies available
        </div>
      </div>

      {/* User Management Form */}
      <div style={{ 
        background: '#fff', 
        borderRadius: 16, 
        boxShadow: '0 4px 24px 0 rgba(31,38,135,0.08)', 
        padding: window.innerWidth <= 700 ? 20 : 32, 
        marginBottom: 24, 
        width: '100%', 
        margin: '0 auto', 
        boxSizing: 'border-box' 
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 12,
          marginBottom: 28,
          paddingBottom: 16,
          borderBottom: '2px solid #f1f5f9'
        }}>
          <span className="material-icons" style={{ fontSize: 24, color: '#3b82f6' }}>person_add</span>
          <h3 style={{ color: '#1e293b', fontWeight: 700, margin: 0, fontSize: 20 }}>User Access Form</h3>
        </div>
        
        <form onSubmit={handleCreateAccess}>
          {/* User Details Section */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
              <div>
                <label style={{ fontWeight: 600, color: '#374151', marginBottom: 8, display: 'block', fontSize: 14 }}>
                  Role <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <select
                  name="roleId"
                  value={form.roleId}
                  onChange={handleInput}
                  required
                  disabled={rolesLoading}
                  style={{
                    padding: '12px 16px',
                    borderRadius: 8,
                    border: `2px solid ${validationAttempted && !form.roleId ? '#dc2626' : '#e5e7eb'}`,
                    width: '100%',
                    fontSize: 15,
                    background: '#fff',
                    marginBottom: 0,
                    cursor: rolesLoading ? 'not-allowed' : 'pointer',
                    transition: 'border-color 0.2s',
                    boxSizing: 'border-box',
                    opacity: rolesLoading ? 0.6 : 1
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.target.style.borderColor = validationAttempted && !form.roleId ? '#dc2626' : '#e5e7eb'}
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
              <div>
                <label style={{ fontWeight: 600, color: '#374151', marginBottom: 8, display: 'block', fontSize: 14 }}>User Name</label>
                <input 
                  name="userName" 
                  type="text"
                  value={form.userName} 
                  onChange={handleInput} 
                  required 
                  style={{ 
                    padding: '12px 16px', 
                    borderRadius: 8, 
                    border: '2px solid #e5e7eb', 
                    width: '100%', 
                    fontSize: 15, 
                    background: '#fff', 
                    marginBottom: 0,
                    cursor: 'text',
                    transition: 'border-color 0.2s',
                    boxSizing: 'border-box'
                  }} 
                  placeholder="Enter user name"
                  onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                />
              </div>
              
              <div>
                <label style={{ fontWeight: 600, color: '#374151', marginBottom: 8, display: 'block', fontSize: 14 }}>Email ID</label>
                <input 
                  name="email" 
                  type="email"
                  value={form.email} 
                  onChange={handleInput} 
                  required 
                  style={{ 
                    padding: '12px 16px', 
                    borderRadius: 8, 
                    border: '2px solid #e5e7eb', 
                    width: '100%', 
                    fontSize: 15, 
                    background: '#fff', 
                    marginBottom: 0,
                    cursor: 'text',
                    transition: 'border-color 0.2s',
                    boxSizing: 'border-box'
                  }} 
                  placeholder="user@example.com"
                  onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                />
              </div>
              
              <div>
                <label style={{ fontWeight: 600, color: '#374151', marginBottom: 8, display: 'block', fontSize: 14 }}>Mobile</label>
                <input 
                  name="mobile" 
                  type="tel"
                  value={form.mobile} 
                  onChange={handleInput} 
                  required 
                  style={{ 
                    padding: '12px 16px', 
                    borderRadius: 8, 
                    border: '2px solid #e5e7eb', 
                    width: '100%', 
                    fontSize: 15, 
                    background: '#fff', 
                    marginBottom: 0,
                    cursor: 'text',
                    transition: 'border-color 0.2s',
                    boxSizing: 'border-box'
                  }} 
                  placeholder="9876543210"
                  onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                />
              </div>
            </div>
            
            {/* External User Checkbox */}
            <div style={{ marginTop: 20, marginBottom: 20 }}>
              <label style={{ 
                display: 'flex', 
                alignItems: 'flex-start', 
                gap: 12, 
                cursor: 'pointer',
                fontSize: 14,
                lineHeight: 1.5
              }}>
                <input
                  type="checkbox"
                  name="isExternalUser"
                  checked={form.isExternalUser}
                  onChange={(e) => setForm({ ...form, isExternalUser: e.target.checked })}
                  style={{
                    marginTop: 2,
                    transform: 'scale(1.2)',
                    cursor: 'pointer'
                  }}
                />
                <span style={{ 
                  color: '#374151', 
                  fontWeight: 500,
                  flex: 1
                }}>
                  <strong>External Users</strong> (Access only to Ledgers where Email matches in Ledger Master)
                </span>
              </label>
            </div>
          </div>

          {/* Company Selection Section */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              marginBottom: 16
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <h4 style={{ 
                  color: '#374151', 
                  fontWeight: 600, 
                  margin: 0, 
                  fontSize: 16,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}>
                  <span className="material-icons" style={{ fontSize: 18, color: '#6b7280' }}>business</span>
                  Company Access
                </h4>
                
                {form.companyGuids.length > 0 && (
                  <div style={{ 
                    fontSize: 13, 
                    color: '#6b7280',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontWeight: 500,
                    background: '#f3f4f6',
                    padding: '4px 12px',
                    borderRadius: 12
                  }}>
                    <span className="material-icons" style={{ fontSize: 16 }}>info</span>
                    {form.companyGuids.length} company{form.companyGuids.length > 1 ? 'ies' : ''} selected
                  </div>
                )}
              </div>
              
              {connections.length > 0 && (
                <button
                  type="button"
                  onClick={handleSelectAll}
                  style={{
                    padding: '8px 16px',
                    background: form.companyGuids.length === connections.length 
                      ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' 
                      : 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'all 0.2s ease',
                    boxShadow: '0 2px 8px 0 rgba(59,130,246,0.20)'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.transform = 'translateY(-1px)';
                    e.target.style.boxShadow = '0 4px 12px 0 rgba(59,130,246,0.30)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 2px 8px 0 rgba(59,130,246,0.20)';
                  }}
                >
                  <span className="material-icons" style={{ fontSize: 16 }}>
                    {form.companyGuids.length === connections.length ? 'check_box' : 'check_box_outline_blank'}
                  </span>
                  {form.companyGuids.length === connections.length ? 'Deselect All' : 'Select All'}
                </button>
              )}
            </div>
            
            <div style={{ 
              padding: '20px',
              background: '#fff',
              borderRadius: 12,
              border: '2px solid #e5e7eb'
            }}>
              {connections.length > 0 ? (
                <>
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 16, 
                    marginBottom: 12,
                    maxHeight: '200px',
                    overflowY: 'auto',
                    paddingRight: '8px',
                    alignItems: 'start'
                  }}>
                    {console.log('Rendering connections:', connections.length, connections)}
                    {connections.map(conn => {
                      console.log('Rendering company:', conn.company, 'guid:', conn.guid, 'selected:', form.companyGuids.includes(conn.guid));
                      return (
                        <div
                          key={conn.guid}
                          onClick={() => handleCompanyToggle(conn.guid)}
                          style={{
                            padding: '10px 16px',
                            borderRadius: 25,
                            background: form.companyGuids.includes(conn.guid) 
                              ? 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)' 
                              : '#fff',
                            color: form.companyGuids.includes(conn.guid) ? '#ffffff' : '#374151',
                            border: form.companyGuids.includes(conn.guid) 
                              ? 'none' 
                              : '2px solid #d1d5db',
                            cursor: 'pointer',
                            fontSize: 14,
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            transition: 'all 0.2s ease',
                            boxShadow: form.companyGuids.includes(conn.guid) 
                              ? '0 4px 12px 0 rgba(59,130,246,0.25)' 
                              : '0 1px 3px 0 rgba(0,0,0,0.1)',
                            width: '100%',
                            minWidth: '100%',
                            maxWidth: '100%',
                            whiteSpace: 'normal',
                            overflow: 'visible',
                            wordWrap: 'break-word',
                            boxSizing: 'border-box'
                          }}
                          onMouseEnter={(e) => {
                            if (!form.companyGuids.includes(conn.guid)) {
                              e.target.style.background = '#f3f4f6';
                              e.target.style.borderColor = '#3b82f6';
                              e.target.style.transform = 'translateY(-1px)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!form.companyGuids.includes(conn.guid)) {
                              e.target.style.background = '#fff';
                              e.target.style.borderColor = '#d1d5db';
                              e.target.style.transform = 'translateY(0)';
                            }
                          }}
                        >
                          <span className="material-icons" style={{ 
                            fontSize: 18,
                            color: form.companyGuids.includes(conn.guid) ? '#3b82f6' : '#6b7280'
                          }}>
                            {form.companyGuids.includes(conn.guid) ? 'check_circle' : 'radio_button_unchecked'}
                          </span>
                          <div style={{ 
                            fontWeight: 600, 
                            fontSize: 14,
                            color: form.companyGuids.includes(conn.guid) ? '#ffffff' : '#374151',
                            background: form.companyGuids.includes(conn.guid) 
                              ? 'transparent' 
                              : '#fff',
                            textShadow: form.companyGuids.includes(conn.guid) ? '0 1px 2px rgba(0,0,0,0.3)' : 'none',
                            zIndex: 1,
                            position: 'relative',
                            overflow: 'visible',
                            whiteSpace: 'normal',
                            wordWrap: 'break-word',
                            flex: 1
                          }}>
                            {conn.company || 'Unknown Company'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div style={{ 
                  textAlign: 'center', 
                  color: '#6b7280', 
                  fontSize: 14,
                  padding: '20px 0'
                }}>
                  <span className="material-icons" style={{ fontSize: 32, marginBottom: 8, display: 'block' }}>business_center</span>
                  No companies available. Please create connections first.
                </div>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 8 }}>
            <button 
              type="submit" 
              disabled={formLoading || form.companyGuids.length === 0} 
              style={{ 
                padding: '16px 40px', 
                background: form.companyGuids.length === 0 
                  ? '#9ca3af' 
                  : 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)', 
                color: '#fff', 
                border: 'none', 
                borderRadius: 12, 
                fontWeight: 700, 
                fontSize: 16, 
                cursor: form.companyGuids.length === 0 ? 'not-allowed' : 'pointer', 
                opacity: formLoading ? 0.7 : 1, 
                boxShadow: form.companyGuids.length === 0 
                  ? 'none' 
                  : '0 4px 16px 0 rgba(34,197,94,0.25)', 
                whiteSpace: 'nowrap',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                minWidth: 180
              }}
              onMouseEnter={(e) => {
                if (!formLoading && form.companyGuids.length > 0) {
                  e.target.style.transform = 'translateY(-2px)';
                  e.target.style.boxShadow = '0 6px 20px 0 rgba(34,197,94,0.35)';
                }
              }}
              onMouseLeave={(e) => {
                if (!formLoading && form.companyGuids.length > 0) {
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = '0 4px 16px 0 rgba(34,197,94,0.25)';
                }
              }}
            >
              <span className="material-icons" style={{ fontSize: 20 }}>
                {formLoading ? 'sync' : 'person_add'}
              </span>
              {formLoading ? 'Granting...' : 'Grant Access'}
            </button>
          </div>
        </form>
        
        {/* Form Messages */}
        {formError && (
          <div style={{ 
            background: '#fef2f2', 
            border: '1px solid #fecaca',
            borderRadius: 8, 
            padding: 16, 
            marginTop: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 12
          }}>
            <span className="material-icons" style={{ color: '#dc2626', fontSize: 20 }}>error</span>
            <div style={{ color: '#dc2626', fontSize: 14, fontWeight: 500 }}>{formError}</div>
          </div>
        )}
        {formSuccess && (
          <div style={{ 
            background: '#f0fdf4', 
            border: '1px solid #bbf7d0',
            borderRadius: 8, 
            padding: 16, 
            marginTop: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 12
          }}>
            <span className="material-icons" style={{ color: '#16a34a', fontSize: 20 }}>check_circle</span>
            <div style={{ color: '#16a34a', fontSize: 14, fontWeight: 500 }}>{formSuccess}</div>
          </div>
        )}
      </div>

      <div style={{ height: 32 }} />

      {/* Internal Users Table */}
      <div style={{ 
        background: '#fff', 
        borderRadius: 16, 
        boxShadow: '0 4px 24px 0 rgba(31,38,135,0.08)', 
        padding: window.innerWidth <= 700 ? 16 : 32, 
        marginTop: 0, 
        width: window.innerWidth <= 700 ? '76vw' : '100%', 
        margin: '0 auto', 
        minHeight: 200, 
        boxSizing: 'border-box' 
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          marginBottom: 24,
          paddingBottom: 16,
          borderBottom: '1px solid #f1f5f9'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="material-icons" style={{ fontSize: 24, color: '#3b82f6' }}>group</span>
            <h3 style={{ color: '#1e293b', fontWeight: 700, margin: 0, fontSize: 20 }}>Users ({filteredUsers.length})</h3>
          </div>
          
          {/* Search Input */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="material-icons" style={{ color: '#64748b', fontSize: 20 }}>search</span>
            <input
              type="text"
              value={userSearchTerm}
              onChange={(e) => setUserSearchTerm(e.target.value)}
              placeholder="Search users..."
              style={{
                padding: '8px 12px',
                border: '2px solid #e5e7eb',
                borderRadius: 8,
                fontSize: 14,
                outline: 'none',
                width: 200,
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
            />
          </div>
        </div>
        
        {/* Loading State */}
        {usersLoading && (
          <div style={{ 
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
          <div style={{ 
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
          <div style={{ 
            overflowX: 'auto',
            maxHeight: '500px',
            overflowY: 'auto',
            border: '1px solid #e2e8f0',
            borderRadius: 8
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                <tr style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)' }}>
                  <th style={{ 
                    padding: '12px 16px', 
                    textAlign: 'left', 
                    fontWeight: 700, 
                    color: '#1e293b',
                    fontSize: 14,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    borderBottom: '2px solid #e2e8f0'
                  }}>User Details</th>
                  <th style={{ 
                    padding: '12px 16px', 
                    textAlign: 'left', 
                    fontWeight: 700, 
                    color: '#1e293b',
                    fontSize: 14,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    borderBottom: '2px solid #e2e8f0'
                  }}>Company Access</th>
                  <th style={{ 
                    padding: '12px 16px', 
                    textAlign: 'left', 
                    fontWeight: 700, 
                    color: '#1e293b',
                    fontSize: 14,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    borderBottom: '2px solid #e2e8f0'
                  }}>Role</th>
                  <th style={{ 
                    padding: '12px 16px', 
                    textAlign: 'left', 
                    fontWeight: 700, 
                    color: '#1e293b',
                    fontSize: 14,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    borderBottom: '2px solid #e2e8f0'
                  }}>User Type</th>
                  <th style={{ 
                    padding: '12px 16px', 
                    textAlign: 'left', 
                    fontWeight: 700, 
                    color: '#1e293b',
                    fontSize: 14,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    borderBottom: '2px solid #e2e8f0'
                  }}>Status</th>
                  <th style={{ 
                    padding: '12px 16px', 
                    textAlign: 'left', 
                    fontWeight: 700, 
                    color: '#1e293b',
                    fontSize: 14,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    borderBottom: '2px solid #e2e8f0'
                  }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user, index) => (
                  <tr key={`${user.userId}-${user.email}`} style={{ 
                    background: index % 2 === 0 ? '#fff' : '#f8fafc',
                    borderBottom: '1px solid #e2e8f0'
                  }}>
                    <td style={{ padding: '16px', verticalAlign: 'top' }}>
                      <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: 4 }}>{user.name}</div>
                      <div style={{ fontSize: 13, color: '#64748b', marginBottom: 2 }}>{user.email}</div>
                      <div style={{ fontSize: 13, color: '#64748b' }}>{user.mobileno}</div>
                    </td>
                    <td style={{ padding: '16px', verticalAlign: 'top' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          padding: '6px 12px',
                          background: '#e0f2fe',
                          color: '#0369a1',
                          borderRadius: 12,
                          fontSize: 14,
                          fontWeight: 600,
                          border: '1px solid #bae6fd',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6
                        }}>
                          <span className="material-icons" style={{ fontSize: 16 }}>business</span>
                          {user.companies.length} companies
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '16px', verticalAlign: 'top' }}>
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
                    <td style={{ padding: '16px', verticalAlign: 'top' }}>
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
                    <td style={{ padding: '16px', verticalAlign: 'top' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{
                          padding: '4px 8px',
                          background: user.userActive ? '#dcfce7' : '#fef2f2',
                          color: user.userActive ? '#166534' : '#dc2626',
                          borderRadius: 12,
                          fontSize: 12,
                          fontWeight: 500,
                          border: `1px solid ${user.userActive ? '#bbf7d0' : '#fecaca'}`,
                          width: 'fit-content'
                        }}>
                          {user.userActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '16px', verticalAlign: 'top' }}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          style={{
                            padding: '6px 12px',
                            background: '#3b82f6',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 500,
                            cursor: 'pointer'
                          }}
                          onClick={() => openEditModal(user)}
                        >
                          Edit
                        </button>
                        <button
                          style={{
                            padding: '6px 12px',
                            background: deletingEmail === user.email ? '#9ca3af' : '#ef4444',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 500,
                            cursor: deletingEmail === user.email ? 'not-allowed' : 'pointer',
                            opacity: deletingEmail === user.email ? 0.8 : 1
                          }}
                          disabled={deletingEmail === user.email}
                          onClick={() => handleRemoveAllAccess(user)}
                        >
                          {deletingEmail === user.email ? 'Removing...' : 'Delete'}
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
            maxWidth: '600px',
            maxHeight: '90vh',
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
              minHeight: 0
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
                        Ledger ({filteredLedgerGroups.length}{ledgerGroups.length !== filteredLedgerGroups.length ? `/${ledgerGroups.length}` : ''})
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
                        Stock ({filteredStockGroups.length}{stockGroups.length !== filteredStockGroups.length ? `/${stockGroups.length}` : ''})
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
                        borderRadius: '0 8px 0 0',
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
                          maxHeight: '400px',
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
                          maxHeight: '400px',
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
                          maxHeight: '400px',
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
    </div>
  );
}

export default CreateAccess;
