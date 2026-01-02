import React, { useState, useEffect } from 'react';
import { modulesApi, permissionsApi, showMessage, formatApiError } from './api/accessControlApi';
import { getApiUrl } from '../config';

function ModulesManagement() {
  const [allModules, setAllModules] = useState([]);
  const [ownerSelectedModules, setOwnerSelectedModules] = useState([]);
  const [originalSelectedModules, setOriginalSelectedModules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Permission modal state
  const [openPermissionModule, setOpenPermissionModule] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [selectedPermissions, setSelectedPermissions] = useState([]);
  
  // Track pending changes (not saved yet)
  const [pendingModuleChanges, setPendingModuleChanges] = useState([]);
  const [pendingPermissionChanges, setPendingPermissionChanges] = useState({});

  // Load data on component mount
  useEffect(() => {
    loadModules();
    loadPermissions();
  }, []);

  // Initialize pending changes when data is loaded
  useEffect(() => {
    if (ownerSelectedModules.length > 0) {
      setPendingModuleChanges(ownerSelectedModules);
    }
  }, [ownerSelectedModules]);

  const loadModules = async () => {
    setLoading(true);
    setError('');
    try {
      const [allModulesResponse, ownerSelectedResponse] = await Promise.all([
        modulesApi.getAllModules(),
        modulesApi.getOwnerSelectedModules()
      ]);
      
      setAllModules(allModulesResponse.modules || []);
      setOwnerSelectedModules(ownerSelectedResponse.modules || []);
      setOriginalSelectedModules(ownerSelectedResponse.modules || []);
    } catch (error) {
      setError(formatApiError(error));
    } finally {
      setLoading(false);
    }
  };

  const loadPermissions = async () => {
    setPermissionsLoading(true);
    try {
      const response = await permissionsApi.getAllPermissions();
      setPermissions(response.permissions || []);
    } catch (error) {
      console.error('Error loading permissions:', error);
    } finally {
      setPermissionsLoading(false);
    }
  };

  const handleModuleToggle = (moduleId) => {
    setPendingModuleChanges(prev => {
      const isSelected = prev.some(module => module.id === moduleId);
      if (isSelected) {
        return prev.filter(module => module.id !== moduleId);
      } else {
        const module = allModules.find(m => m.id === moduleId);
        if (module) {
          return [...prev, { id: module.id, name: module.name, display_name: module.display_name, is_enabled: true }];
        }
        return prev;
      }
    });
  };

  // Check if there are changes (modules or permissions)
  const hasModuleChanges = pendingModuleChanges.length > 0 && 
                           JSON.stringify(pendingModuleChanges.sort((a, b) => a.id - b.id)) !== 
                           JSON.stringify(ownerSelectedModules.sort((a, b) => a.id - b.id));
  
  // Check if there are permission changes
  const hasPermissionChanges = Object.keys(pendingPermissionChanges).length > 0;
  
  const hasChanges = hasModuleChanges || hasPermissionChanges;

  const handleSaveSelection = async () => {
    setSaving(true);
    setError('');
    try {
      const moduleIds = pendingModuleChanges.map(module => module.id);
      
      // Collect all permissions with their values (both current and pending)
      const allPermissions = [];
      
      // For each selected module, collect permissions
      pendingModuleChanges.forEach(module => {
        // Check if this module has pending permission changes
        const pendingPermissions = pendingPermissionChanges[module.id];
        
        if (pendingPermissions !== undefined) {
          // Use pending permissions for this module (even if empty array)
          pendingPermissions.forEach(permission => {
            allPermissions.push({
              id: permission.id,
              permission_value: permission.permission_value || null
            });
          });
        } else {
          // Use current granted permissions from API for this module
          const ownerModule = ownerSelectedModules.find(m => m.id === module.id);
          if (ownerModule && ownerModule.permissions) {
            ownerModule.permissions.forEach(perm => {
              if (perm.granted === 1) {
                allPermissions.push({
                  id: perm.id,
                  permission_value: perm.permission_value || null
                });
              }
            });
          }
        }
      });
      
      await modulesApi.updateOwnerModuleSelection(moduleIds, allPermissions);
      
      // Reload data from API to get updated state
      const [allModulesResponse, ownerSelectedResponse] = await Promise.all([
        modulesApi.getAllModules(),
        modulesApi.getOwnerSelectedModules()
      ]);
      
      // Update state with fresh data
      setAllModules(allModulesResponse.modules || []);
      setOwnerSelectedModules(ownerSelectedResponse.modules || []);
      setOriginalSelectedModules(ownerSelectedResponse.modules || []);
      
      // Update pending changes to match the new API data
      setPendingModuleChanges(ownerSelectedResponse.modules || []);
      setPendingPermissionChanges({});
      
      showMessage('Module selection updated successfully');
      
      // Refresh user access permissions so components see the changes immediately
      try {
        // Get current company from sessionStorage
        const allConnections = JSON.parse(sessionStorage.getItem('allConnections') || '[]');
        const selectedCompanyGuid = sessionStorage.getItem('selectedCompanyGuid');
        const selectedCompanyTallylocId = sessionStorage.getItem('selectedCompanyTallylocId');
        // Match by both guid and tallyloc_id to handle companies with same guid but different tallyloc_id
        const currentCompany = allConnections.find(c => 
          c.guid === selectedCompanyGuid && 
          (selectedCompanyTallylocId ? String(c.tallyloc_id) === String(selectedCompanyTallylocId) : true)
        );
        
        if (currentCompany && currentCompany.tallyloc_id && currentCompany.guid) {
          // Dispatch global refresh event to trigger permission refresh
          window.dispatchEvent(new CustomEvent('globalRefresh'));
          
          // Also refresh user access permissions directly
          // This will update sessionStorage and dispatch userAccessUpdated event
          const timestamp = Date.now();
          const apiUrl = getApiUrl(`/api/access-control/user-access?tallylocId=${currentCompany.tallyloc_id}&co_guid=${currentCompany.guid}&_t=${timestamp}`);
          
          fetch(apiUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${sessionStorage.getItem('token')}`,
              'Content-Type': 'application/json'
            }
          })
          .then(response => {
            if (response.ok) {
              return response.json();
            }
            throw new Error('Failed to refresh user permissions');
          })
          .then(accessData => {
            sessionStorage.setItem('userAccessPermissions', JSON.stringify(accessData));
            window.dispatchEvent(new CustomEvent('userAccessUpdated', { detail: accessData }));
            console.log('✅ User permissions refreshed after module save');
          })
          .catch(err => {
            console.warn('⚠️ Could not refresh user permissions:', err);
            // Still dispatch the event even if API call fails, so components can try to refresh
            window.dispatchEvent(new CustomEvent('userAccessUpdated'));
          });
        } else {
          console.warn('⚠️ No company selected, skipping permission refresh');
        }
      } catch (error) {
        console.warn('⚠️ Error refreshing permissions:', error);
        // Still dispatch the event as a fallback
        window.dispatchEvent(new CustomEvent('userAccessUpdated'));
      }
    } catch (error) {
      setError(formatApiError(error));
    } finally {
      setSaving(false);
    }
  };

  const filteredModules = allModules.filter(module =>
    module.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    module.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (module.description && module.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const isModuleSelected = (moduleId) => {
    // If there are pending changes, use them
    if (pendingModuleChanges.length > 0) {
      return pendingModuleChanges.some(module => module.id === moduleId);
    }
    // Otherwise, use the current API data
    return ownerSelectedModules.some(module => module.id === moduleId);
  };

  // Permission modal handlers
  const handleOpenPermissions = (moduleId, e) => {
    e.stopPropagation();
    setOpenPermissionModule(moduleId);
    
    // Check if there are pending changes for this module
    const pendingPermissions = pendingPermissionChanges[moduleId];
    
    if (pendingPermissions && pendingPermissions.length > 0) {
      // If there are pending changes, use them as the source of truth
      setSelectedPermissions([...pendingPermissions]);
    } else {
      // If no pending changes, load current permissions from API
      const ownerModule = ownerSelectedModules.find(m => m.id === moduleId);
      const grantedPermissions = ownerModule && ownerModule.permissions 
        ? ownerModule.permissions.filter(perm => perm.granted === 1)
        : [];
      
      setSelectedPermissions([...grantedPermissions]);
    }
  };

  const handleClosePermissions = () => {
    // Save the pending permission changes for this module
    if (openPermissionModule) {
      setPendingPermissionChanges(prev => ({
        ...prev,
        [openPermissionModule]: [...selectedPermissions]
      }));
    }
    setOpenPermissionModule(null);
    setSelectedPermissions([]);
  };

  // Permission selection functions
  const isPermissionSelected = (permissionId) => {
    return selectedPermissions.some(permission => permission.id === permissionId);
  };

  const handlePermissionToggle = (permissionId) => {
    const isSelected = selectedPermissions.some(permission => permission.id === permissionId);
    
    // Find the permission in the hierarchical structure
    const perm = findPermissionById(permissions, permissionId);
    if (!perm) return;
    
    if (isSelected) {
      // Remove this permission and all its children
      const childIds = getAllChildPermissionIds(perm);
      const allIdsToRemove = [permissionId, ...childIds];
      
      setSelectedPermissions(prev => 
        prev.filter(permission => !allIdsToRemove.includes(permission.id))
      );
    } else {
      // Add this permission (children will be handled separately)
      setSelectedPermissions(prev => [...prev, perm]);
    }
  };

  // Helper functions for permission hierarchy (copied from RolesManagement)
  const isParentPermissionSelected = (permission) => {
    if (!permission.is_child || !permission.parent_permission_id) return true;
    
    // Check if the immediate parent is selected (either by user or granted from API)
    const parentSelected = isPermissionSelected(permission.parent_permission_id);
    
    // If parent is not selected, return false
    if (!parentSelected) return false;
    
    // If parent is selected, check if the parent itself has a parent that needs to be selected
    const parentPermission = findPermissionById(permissions, permission.parent_permission_id);
    if (parentPermission && parentPermission.is_child && parentPermission.parent_permission_id) {
      return isParentPermissionSelected(parentPermission);
    }
    
    return true;
  };

  const findPermissionById = (permissions, permissionId) => {
    for (const module of permissions) {
      if (module.permissions) {
        const found = findPermissionInArray(module.permissions, permissionId);
        if (found) return found;
      }
    }
    return null;
  };

  const findPermissionInArray = (permissions, permissionId) => {
    for (const permission of permissions) {
      if (permission.id === permissionId) return permission;
      if (permission.children && permission.children.length > 0) {
        const found = findPermissionInArray(permission.children, permissionId);
        if (found) return found;
      }
    }
    return null;
  };

  const getAllChildPermissionIds = (permission) => {
    let childIds = [];
    if (permission.children && permission.children.length > 0) {
      for (const child of permission.children) {
        childIds.push(child.id);
        childIds = childIds.concat(getAllChildPermissionIds(child));
      }
    }
    return childIds;
  };

  const renderPermissionHierarchy = (permissions, level = 0) => {
    return permissions.map((permission) => {
      const isSelected = isPermissionSelected(permission.id);
      const isParentSelected = isParentPermissionSelected(permission);
      const isDisabled = !isParentSelected;
      
      return (
        <div key={permission.id}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 0',
              transition: 'all 0.2s',
              background: 'transparent',
              border: 'none',
              fontSize: 14,
              minHeight: '40px',
              boxSizing: 'border-box',
              opacity: isDisabled ? 0.5 : 1,
              width: '100%',
              userSelect: 'none'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <div 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!isDisabled) {
                    handlePermissionToggle(permission.id);
                  }
                }}
                style={{
                  width: 20,
                  height: 20,
                  border: '2px solid #d1d5db',
                  borderRadius: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: isDisabled ? '#f3f4f6' : (isSelected ? '#F27020' : 'transparent'),
                  borderColor: isDisabled ? '#e5e7eb' : (isSelected ? '#F27020' : '#d1d5db'),
                  transition: 'all 0.2s',
                  flexShrink: 0,
                  cursor: isDisabled ? 'not-allowed' : 'pointer'
                }}>
                {isSelected && (
                  <span className="material-icons" style={{ 
                    fontSize: 12, 
                    color: '#fff',
                    fontWeight: 'bold'
                  }}>
                    check
                  </span>
                )}
              </div>
              <div style={{ 
                flex: 1, 
                marginLeft: level * 24 + (level === 0 ? 12 : 0),
                marginRight: '24px'
              }}>
                <div style={{
                  color: isSelected ? '#1e40af' : '#374151',
                  fontWeight: isSelected ? 600 : 400,
                  fontSize: 15,
                  lineHeight: 1.5,
                  marginBottom: permission.description ? 4 : 0,
                  fontStyle: permission.is_child ? 'italic' : 'normal'
                }}>
                  {permission.display_name}
                </div>
                {permission.description && (
                  <div style={{
                    color: '#6b7280',
                    fontSize: 13,
                    lineHeight: 1.4,
                    fontWeight: 400
                  }}>
                    {permission.description}
                  </div>
                )}
              </div>
            </div>
            
            {/* Permission Value Input - Only show for string and number types when selected */}
            {isSelected && (permission.permission_type === 'string' || permission.permission_type === 'number') && (
              <div style={{ marginLeft: '12px', minWidth: '120px' }}>
                <input
                  type={permission.permission_type === 'number' ? 'number' : 'text'}
                  value={(() => {
                    const selectedPerm = selectedPermissions.find(p => p.id === permission.id);
                    return selectedPerm?.permission_value || '';
                  })()}
                  onChange={(e) => {
                    // Update the permission value in the selected permissions
                    setSelectedPermissions(prev => 
                      prev.map(p => 
                        p.id === permission.id 
                          ? { ...p, permission_value: e.target.value }
                          : p
                      )
                    );
                  }}
                  placeholder={permission.permission_type === 'number' ? 'Enter number' : 'Enter value'}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    border: '1px solid #d1d5db',
                    borderRadius: 4,
                    fontSize: 13,
                    outline: 'none',
                    background: '#fff',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                />
              </div>
            )}
            
            {/* Select Dropdown - Only show for select type when selected */}
            {isSelected && permission.permission_type === 'select' && (
              <div style={{ marginLeft: '12px', minWidth: '120px' }}>
                <select
                  value={(() => {
                    const selectedPerm = selectedPermissions.find(p => p.id === permission.id);
                    return selectedPerm?.permission_value || '';
                  })()}
                  onChange={(e) => {
                    // Update the permission value in the selected permissions
                    setSelectedPermissions(prev => 
                      prev.map(p => 
                        p.id === permission.id 
                          ? { ...p, permission_value: e.target.value }
                          : p
                      )
                    );
                  }}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    border: '1px solid #d1d5db',
                    borderRadius: 4,
                    fontSize: 13,
                    outline: 'none',
                    background: '#fff',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                >
                  <option value="">Select option</option>
                  {permission.permission_options && permission.permission_options.map((option, index) => (
                    <option key={index} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          {/* Render children if they exist */}
          {permission.children && permission.children.length > 0 && (
            <div style={{ marginTop: '2px' }}>
              {renderPermissionHierarchy(permission.children, level + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div style={{ width: '100%', maxWidth: '1400px', margin: '0' }}>
      {/* Header Section */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32, marginTop: 50 }}>
        <div>
          <h2 style={{ color: '#1e40af', fontWeight: 700, fontSize: 28, margin: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="material-icons" style={{ fontSize: 32, color: '#1e40af' }}>apps</span>
            Modules Management
          </h2>
          <div style={{ color: '#64748b', fontSize: 16, marginTop: 4 }}>Select which modules are available for your organization</div>
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
          <span className="material-icons" style={{ fontSize: 18 }}>bar_chart</span>
          {ownerSelectedModules.length} of {allModules.length} selected
        </div>
      </div>

      {/* Search and Controls */}
      <div style={{ 
        background: '#fff', 
        borderRadius: 16, 
        boxShadow: '0 4px 24px 0 rgba(31,38,135,0.08)', 
        padding: 24, 
        marginBottom: 24,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 16
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
          <span className="material-icons" style={{ color: '#64748b', fontSize: 20 }}>search</span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search modules..."
            style={{
              padding: '12px 16px',
              borderRadius: 8,
              border: '1.5px solid #e2e8f0',
              fontSize: 16,
              width: '100%',
              maxWidth: 400,
              outline: 'none',
              background: '#f8fafc',
              transition: 'border-color 0.2s',
            }}
            onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
            onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
          />
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={loadModules}
            disabled={loading}
            style={{
              background: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)',
              border: 'none',
              borderRadius: 8,
              width: 48,
              height: 48,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'transform 0.2s, box-shadow 0.2s',
              boxShadow: '0 2px 8px 0 rgba(59,130,246,0.20)',
            }}
            title="Refresh modules"
            onMouseEnter={(e) => {
              e.target.style.transform = 'scale(1.05)';
              e.target.style.boxShadow = '0 4px 12px 0 rgba(59,130,246,0.30)';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'scale(1)';
              e.target.style.boxShadow = '0 2px 8px 0 rgba(59,130,246,0.20)';
            }}
          >
            <span
              className="material-icons"
              style={{
                fontSize: 24,
                color: '#fff',
                animation: loading ? 'spin 1s linear infinite' : 'none',
              }}
            >refresh</span>
          </button>
          
          <button
            onClick={handleSaveSelection}
            disabled={saving || loading || !hasChanges}
            style={{
              background: 'linear-gradient(135deg, #F27020 0%, #e55a00 100%)',
              border: 'none',
              borderRadius: 8,
              padding: '12px 20px',
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.7 : 1,
              boxShadow: '0 2px 8px 0 rgba(242, 112, 32, 0.2)',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
            onMouseEnter={(e) => {
              if (!saving) {
                e.target.style.transform = 'scale(1.05)';
                e.target.style.boxShadow = '0 4px 12px 0 rgba(242, 112, 32, 0.30)';
              }
            }}
            onMouseLeave={(e) => {
              if (!saving) {
                e.target.style.transform = 'scale(1)';
                e.target.style.boxShadow = '0 2px 8px 0 rgba(242, 112, 32, 0.20)';
              }
            }}
          >
            <span className="material-icons" style={{ fontSize: 18 }}>
              save
            </span>
            {saving ? 'Saving...' : 'Save Selection'}
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div style={{
          marginBottom: 24,
          padding: '12px 16px',
          background: '#fef2f2',
          color: '#dc2626',
          border: '1px solid #fecaca',
          borderRadius: 8,
          fontSize: 14,
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
          <span className="material-icons" style={{ fontSize: 18 }}>
            error
          </span>
          {error}
        </div>
      )}

      {/* Modules List */}
      <div style={{
        background: '#fff',
        borderRadius: 16,
        boxShadow: '0 4px 24px 0 rgba(31,38,135,0.08)',
        overflow: 'hidden'
      }}>
        
        {loading ? (
          <div style={{
            padding: '48px',
            textAlign: 'center',
            color: '#64748b'
          }}>
            <span className="material-icons" style={{ 
              fontSize: 48, 
              color: '#F27020',
              animation: 'spin 1s linear infinite'
            }}>
              refresh
            </span>
            <p style={{ margin: '16px 0 0 0', fontSize: 16 }}>
              Loading modules...
            </p>
          </div>
        ) : filteredModules.length === 0 ? (
          <div style={{
            padding: '48px',
            textAlign: 'center',
            color: '#64748b'
          }}>
            <span className="material-icons" style={{ fontSize: 48, color: '#cbd5e1' }}>
              apps
            </span>
            <p style={{ margin: '16px 0 0 0', fontSize: 16 }}>
              {searchTerm ? 'No modules found matching your search' : 'No modules available'}
            </p>
          </div>
        ) : (
          <div style={{ maxHeight: '500px', overflowY: 'auto', padding: '16px' }}>
                {filteredModules.map((module, index) => {
                  const isSelected = isModuleSelected(module.id);
              const modulePermissions = permissions.find(p => p.module_id === module.id);
              const hasPermissions = modulePermissions && modulePermissions.permissions && modulePermissions.permissions.length > 0;
              const showSettingsIcon = isSelected && hasPermissions;
              
                  return (
                <div
                      key={module.id}
                      style={{
                    background: isSelected ? '#f0f9ff' : '#fff',
                    border: isSelected ? '1px solid #0ea5e9' : '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '16px 20px',
                    marginBottom: '12px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px'
                      }}
                      onClick={() => handleModuleToggle(module.id)}
                      onMouseEnter={(e) => {
                        e.target.style.transform = 'translateY(-1px)';
                        e.target.style.boxShadow = '0 4px 12px 0 rgba(59,130,246,0.10)';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.transform = 'translateY(0)';
                        e.target.style.boxShadow = 'none';
                      }}
                    >
                  {/* Checkbox */}
                        <div style={{
                          width: 20,
                          height: 20,
                          border: '2px solid #d1d5db',
                          borderRadius: 4,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: isSelected ? '#F27020' : 'transparent',
                          borderColor: isSelected ? '#F27020' : '#d1d5db',
                          transition: 'all 0.2s',
                    cursor: 'pointer',
                    flexShrink: 0
                        }}>
                          {isSelected && (
                            <span className="material-icons" style={{ 
                              fontSize: 14, 
                              color: '#fff',
                              fontWeight: 'bold'
                            }}>
                              check
                            </span>
                          )}
                        </div>
                  
                  {/* Module Info */}
                  <div style={{ flex: 1 }}>
                        <div style={{
                          fontSize: 15,
                          fontWeight: 600,
                          color: '#1e40af',
                          marginBottom: 4
                        }}>
                          {module.display_name}
                        </div>
                        {module.description && (
                          <div style={{
                            fontSize: 13,
                            color: '#64748b',
                            lineHeight: 1.4
                          }}>
                            {module.description}
                          </div>
                        )}
                        {pendingPermissionChanges[module.id] && pendingPermissionChanges[module.id].length > 0 && (
                          <div style={{
                            fontSize: 12,
                            color: '#F27020',
                            fontWeight: 500,
                            marginTop: 4
                          }}>
                            Pending permission changes
                          </div>
                        )}
                  </div>
                  
                  {/* Settings Icon - Only show if module is selected and has permissions */}
                  {showSettingsIcon && (
                    <button
                      onClick={(e) => handleOpenPermissions(module.id, e)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '8px',
                        borderRadius: '6px',
                          display: 'flex',
                          alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s',
                        color: '#64748b',
                        flexShrink: 0
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.background = '#f1f5f9';
                        e.target.style.color = '#F27020';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.background = 'transparent';
                        e.target.style.color = '#64748b';
                      }}
                      title="Configure permissions"
                    >
                      <span className="material-icons" style={{ fontSize: 20 }}>
                        settings
                          </span>
                    </button>
                  )}
                        </div>
                  );
                })}
          </div>
        )}
      </div>

      {/* Summary */}
      {!loading && filteredModules.length > 0 && (
        <div style={{
          marginTop: 24,
          padding: '16px 24px',
          background: '#f8fafc',
          borderRadius: 8,
          border: '1px solid #e2e8f0'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 14,
            color: '#64748b'
          }}>
            <span className="material-icons" style={{ fontSize: 18 }}>
              info
            </span>
            <span>
              <strong>{ownerSelectedModules.length}</strong> modules selected out of <strong>{allModules.length}</strong> available modules.
              {ownerSelectedModules.length > 0 && ' These modules will be available for role assignment and user access.'}
            </span>
          </div>
        </div>
      )}

      {/* Permission Configuration Modal */}
      {openPermissionModule && (
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
            maxHeight: '80vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            margin: '0 20px'
          }}>
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#1e40af' }}>
                Configure Permissions
              </h3>
              <button
                onClick={handleClosePermissions}
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
            <div style={{ 
              padding: '24px', 
              overflowY: 'auto', 
              flex: 1,
              minHeight: 0,
              boxSizing: 'border-box'
            }}>
              {(() => {
                const module = allModules.find(m => m.id === openPermissionModule);
                const modulePermissions = permissions.find(p => p.module_id === openPermissionModule);
                
                if (!module || !modulePermissions || !modulePermissions.permissions) {
                  return (
                    <div style={{ 
                      padding: '20px', 
                      textAlign: 'center', 
                      color: '#64748b',
                      fontSize: 14
                    }}>
                      No permissions available for this module.
                    </div>
                  );
                }

                return (
                  <div>
                    <div style={{ marginBottom: 16 }}>
                      <div style={{
                        fontSize: 16,
                        fontWeight: 600,
                        color: '#1e40af',
                        marginBottom: 4
                      }}>
                        {module.display_name}
                      </div>
                      {module.description && (
                        <div style={{
                          fontSize: 13,
                          color: '#64748b',
                          lineHeight: 1.4
                        }}>
                          {module.description}
                        </div>
                      )}
                    </div>
                    
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      padding: '8px 0'
                    }}>
                      {renderPermissionHierarchy(modulePermissions.permissions)}
                    </div>
                    
                    {/* Selection Summary */}
                    {selectedPermissions.length > 0 && (
                      <div style={{
                        marginTop: '16px',
                        padding: '12px 16px',
                        background: '#f0f9ff',
                        border: '1px solid #0ea5e9',
                        borderRadius: '8px',
                        fontSize: '14px',
                        color: '#0369a1',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <span className="material-icons" style={{ fontSize: '18px' }}>
                          info
                        </span>
                        <span>
                          <strong>{selectedPermissions.length}</strong> permissions selected
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
            <div style={{
              padding: '20px 24px',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              gap: 12,
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={handleClosePermissions}
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
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default ModulesManagement;
