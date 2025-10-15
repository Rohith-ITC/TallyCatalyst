import React, { useState, useEffect } from 'react';
import { rolesApi, modulesApi, permissionsApi, showMessage, formatApiError } from './api/accessControlApi';

function RolesManagement() {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [formData, setFormData] = useState({
    display_name: '',
    description: '',
    selectedModules: [],
    selectedPermissions: []
  });
  const [modules, setModules] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [openPermissionModule, setOpenPermissionModule] = useState(null);

  useEffect(() => {
    loadRoles();
    loadModules();
    loadPermissions();
  }, []);

  const loadRoles = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await rolesApi.getAllRoles();
      setRoles(response.roles || []);
    } catch (error) {
      setError(formatApiError(error));
    } finally {
      setLoading(false);
    }
  };

  const loadModules = async () => {
    try {
      const response = await modulesApi.getOwnerSelectedModules();
      setModules(response.modules || []);
    } catch (error) {
      console.warn('Failed to load modules:', error);
    }
  };

  const loadPermissions = async () => {
    try {
      const response = await permissionsApi.getAllPermissions();
      setPermissions(response.permissions || []);
    } catch (error) {
      console.warn('Failed to load permissions:', error);
      // Fallback to mock data if API fails
      const mockPermissions = [
        {
          module_id: 1,
          module_name: "place_order",
          module_display_name: "Place Order",
          module_description: "Standard place order functionality",
          permissions: [
            {
              id: 1,
              permission_key: "view",
              display_name: "View Place Order",
              description: "Can view place order page and data",
              is_parent: false,
              is_child: false,
              children: []
            },
            {
              id: 2,
              permission_key: "create",
              display_name: "Create Orders",
              description: "Can create new orders",
              is_parent: false,
              is_child: false,
              children: []
            }
          ]
        }
      ];
      setPermissions(mockPermissions);
    }
  };

  const handleCreateRole = async () => {
    try {
      // Group permissions by module
      const modulePermissionsMap = {};
      
      // Initialize all selected modules
      formData.selectedModules.forEach(module => {
        modulePermissionsMap[module.id] = {
          module_id: module.id,
          permissions: []
        };
      });
      
      // Add permissions to their respective modules
      formData.selectedPermissions.forEach(permission => {
        // Find which module this permission belongs to
        let modulePermission = null;
        for (const module of permissions) {
          if (module.permissions && findPermissionInArray(module.permissions, permission.id)) {
            modulePermission = module;
            break;
          }
        }
        
        if (modulePermission && modulePermissionsMap[modulePermission.module_id]) {
          modulePermissionsMap[modulePermission.module_id].permissions.push({
            id: permission.id,
            permission_value: permission.permission_value || null
          });
        }
      });

      const payload = {
        name: formData.display_name.toLowerCase().replace(/\s+/g, '_'),
        display_name: formData.display_name,
        description: formData.description,
        modules: Object.values(modulePermissionsMap)
      };

      console.log('Create Role Payload:', payload);
      console.log('Selected Permissions:', formData.selectedPermissions);
      await rolesApi.createRole(payload);
      showMessage('Role created successfully');
      setShowCreateForm(false);
      setEditingRole(null);
      setFormData({ display_name: '', description: '', selectedModules: [], selectedPermissions: [] });
      loadRoles();
    } catch (error) {
      setError(formatApiError(error));
    }
  };

  const handleEditRole = async () => {
    try {
      // Group permissions by module
      const modulePermissionsMap = {};
      
      // Initialize all selected modules
      formData.selectedModules.forEach(module => {
        modulePermissionsMap[module.id] = {
          module_id: module.id,
          permissions: []
        };
      });
      
      // Add permissions to their respective modules
      formData.selectedPermissions.forEach(permission => {
        // Find which module this permission belongs to
        let modulePermission = null;
        for (const module of permissions) {
          if (module.permissions && findPermissionInArray(module.permissions, permission.id)) {
            modulePermission = module;
            break;
          }
        }
        
        if (modulePermission && modulePermissionsMap[modulePermission.module_id]) {
          modulePermissionsMap[modulePermission.module_id].permissions.push({
            id: permission.id,
            permission_value: permission.permission_value || null
          });
        }
      });

      const payload = {
        roleId: editingRole.id,
        name: formData.display_name.toLowerCase().replace(/\s+/g, '_'),
        display_name: formData.display_name,
        description: formData.description,
        modules: Object.values(modulePermissionsMap)
      };

      console.log('Update Role Payload:', payload);
      console.log('Selected Permissions:', formData.selectedPermissions);
      await rolesApi.updateRole(editingRole.id, payload);
      showMessage('Role updated successfully');
      setEditingRole(null);
      setShowCreateForm(false);
      setFormData({ display_name: '', description: '', selectedModules: [], selectedPermissions: [] });
      loadRoles();
    } catch (error) {
      setError(formatApiError(error));
    }
  };

  const handleDeleteRole = async (roleId) => {
    if (window.confirm('Are you sure you want to delete this role?')) {
      try {
        const response = await rolesApi.deleteRole(roleId);
        
        // Check if the response contains an error (API might return 200 with error in body)
        if (response && response.error) {
          let errorMessage = response.error;
          if (response.details) {
            errorMessage += `. ${response.details}`;
          }
          setError(errorMessage);
          return;
        }
        
        showMessage('Role deleted successfully');
        loadRoles();
      } catch (error) {
        // Handle specific API error response format
        let errorMessage = 'An error occurred while deleting the role';
        
        if (error.response && error.response.data) {
          const errorData = error.response.data;
          if (errorData.error) {
            errorMessage = errorData.error;
            // If there are additional details, append them
            if (errorData.details) {
              errorMessage += `. ${errorData.details}`;
            }
          } else if (errorData.message) {
            errorMessage = errorData.message;
          }
        } else if (error.message) {
          errorMessage = error.message;
        }
        
        setError(errorMessage);
      }
    }
  };

  const startEdit = async (role) => {
    try {
      setEditingRole(role);
      setShowCreateForm(false);
      
      // Load role details with modules and permissions
      const response = await rolesApi.getRoleDetails(role.id);
      
      // Convert API response to form data format
      const selectedModules = response.modules.map(module => ({
        id: module.module_id,
        name: module.module_name,
        display_name: module.module_display_name,
        description: module.module_description
      }));
      
      const selectedPermissions = [];
      response.modules.forEach(module => {
        if (module.permissions) {
          module.permissions.forEach(permission => {
            selectedPermissions.push({
              id: permission.permission_id,
              permission_key: permission.permission_key,
              display_name: permission.display_name,
              description: permission.description,
              permission_type: permission.permission_type,
              permission_value: permission.permission_value
            });
          });
        }
      });
      
      setFormData({
        display_name: response.role.display_name,
        description: response.role.description || '',
        selectedModules: selectedModules,
        selectedPermissions: selectedPermissions
      });
      
    } catch (error) {
      console.error('Error loading role details:', error);
      setError('Failed to load role details');
      
      // Fallback to basic form data
      setFormData({
        display_name: role.display_name,
        description: role.description || '',
        selectedModules: [],
        selectedPermissions: []
      });
    }
  };

  const cancelEdit = () => {
    setEditingRole(null);
    setFormData({ display_name: '', description: '', selectedModules: [], selectedPermissions: [] });
    setOpenPermissionModule(null);
  };

  const cancelCreate = () => {
    setShowCreateForm(false);
    setEditingRole(null);
    setFormData({ display_name: '', description: '', selectedModules: [], selectedPermissions: [] });
    setOpenPermissionModule(null);
  };

  const handleModuleToggle = (moduleId) => {
    const isSelected = formData.selectedModules.some(module => module.id === moduleId);
    const module = modules.find(m => m.id === moduleId);
    const modulePermissions = permissions.find(p => p.module_id === moduleId);
    const permissionObjects = modulePermissions ? modulePermissions.permissions : [];
    
    if (isSelected) {
      // Remove module and all its permissions
      const permissionIds = permissionObjects.map(p => p.id);
      setFormData(prev => ({
        ...prev,
        selectedModules: prev.selectedModules.filter(module => module.id !== moduleId),
        selectedPermissions: prev.selectedPermissions.filter(permission => !permissionIds.includes(permission.id))
      }));
    } else {
      // Add module and automatically select all its permissions
      if (module) {
        setFormData(prev => {
          // Filter out any permissions that are already selected to avoid duplicates
          const newPermissions = permissionObjects.filter(perm => 
            !prev.selectedPermissions.some(selected => selected.id === perm.id)
          );
          return {
            ...prev,
            selectedModules: [...prev.selectedModules, module],
            selectedPermissions: [...prev.selectedPermissions, ...newPermissions]
          };
        });
      }
    }
  };

  const isModuleSelected = (moduleId) => {
    return formData.selectedModules.some(module => module.id === moduleId);
  };

  const handlePermissionToggle = (permissionId) => {
    // Find which module this permission belongs to
    let modulePermission = null;
    for (const module of permissions) {
      if (module.permissions && findPermissionInArray(module.permissions, permissionId)) {
        modulePermission = module;
        break;
      }
    }
    
    // Check if the module is selected
    const isModuleSelected = modulePermission && formData.selectedModules.some(module => module.id === modulePermission.module_id);
    
    if (!isModuleSelected) {
      // Don't allow permission selection if module is not selected
      return;
    }
    
    const isSelected = formData.selectedPermissions.some(permission => permission.id === permissionId);
    
    // Find the permission in the hierarchical structure
    const perm = findPermissionById(permissions, permissionId);
    if (!perm) return;
    
    if (isSelected) {
      // Remove this permission and all its children
      const childIds = getAllChildPermissionIds(perm);
      const allIdsToRemove = [permissionId, ...childIds];
      
      setFormData(prev => ({
        ...prev,
        selectedPermissions: prev.selectedPermissions.filter(permission => !allIdsToRemove.includes(permission.id))
      }));
    } else {
      // Add this permission (children will be handled separately)
      setFormData(prev => ({
        ...prev,
        selectedPermissions: [...prev.selectedPermissions, perm]
      }));
    }
  };

  const isPermissionSelected = (permissionId) => {
    return formData.selectedPermissions.some(permission => permission.id === permissionId);
  };

  const getModulePermissions = (moduleId) => {
    const modulePermission = permissions.find(p => p.module_id === moduleId);
    return modulePermission ? modulePermission.permissions : [];
  };

  const handleOpenPermissions = (moduleId, e) => {
    e.stopPropagation();
    setOpenPermissionModule(moduleId);
  };

  const handleClosePermissions = () => {
    setOpenPermissionModule(null);
  };

  // Helper function to check if a parent permission is selected
  const isParentPermissionSelected = (permission) => {
    if (!permission.is_child || !permission.parent_permission_id) return true;
    
    // Check if the immediate parent is selected
    const parentSelected = formData.selectedPermissions.some(p => p.id === permission.parent_permission_id);
    
    // If parent is not selected, return false
    if (!parentSelected) return false;
    
    // If parent is selected, check if the parent itself has a parent that needs to be selected
    const parentPermission = findPermissionById(permissions, permission.parent_permission_id);
    if (parentPermission && parentPermission.is_child && parentPermission.parent_permission_id) {
      return isParentPermissionSelected(parentPermission);
    }
    
    return true;
  };

  // Helper function to find a permission by ID in the hierarchical structure
  const findPermissionById = (permissions, permissionId) => {
    for (const module of permissions) {
      if (module.permissions) {
        const found = findPermissionInArray(module.permissions, permissionId);
        if (found) return found;
      }
    }
    return null;
  };

  // Helper function to recursively find permission in array
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

  // Helper function to get all child permission IDs
  const getAllChildPermissionIds = (permission) => {
    const childIds = [];
    if (permission.children && permission.children.length > 0) {
      permission.children.forEach(child => {
        childIds.push(child.id);
        childIds.push(...getAllChildPermissionIds(child));
      });
    }
    return childIds;
  };

  // Helper function to render permissions with hierarchy
  const renderPermissionHierarchy = (permissions, level = 0) => {
    return permissions.map((permission) => {
      const isSelected = isPermissionSelected(permission.id);
      const isModuleSelected = formData.selectedModules.some(module => module.id === openPermissionModule);
      const isParentSelected = isParentPermissionSelected(permission);
      const isDisabled = !isModuleSelected || !isParentSelected;
      
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
                  color: isDisabled ? '#9ca3af' : (isSelected ? '#1e40af' : '#374151'),
                  fontWeight: isSelected ? 600 : 400,
                  fontSize: 15,
                  lineHeight: 1.5,
                  marginBottom: permission.description ? 4 : 0,
                  fontStyle: permission.is_child ? 'italic' : 'normal'
                }}>
                  {permission.display_name}
                  {permission.is_child && !isParentSelected && (
                    <span style={{
                      fontSize: 11,
                      color: '#f59e0b',
                      marginLeft: 8,
                      fontStyle: 'italic',
                      fontWeight: 400
                    }}>
                      (Parent required)
                    </span>
                  )}
                </div>
                {permission.description && (
                  <div style={{
                    color: isDisabled ? '#d1d5db' : '#6b7280',
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
                    const selectedPerm = formData.selectedPermissions.find(p => p.id === permission.id);
                    return selectedPerm?.permission_value || '';
                  })()}
                  onChange={(e) => {
                    // Update the permission value in the selected permissions
                    setFormData(prev => ({
                      ...prev,
                      selectedPermissions: prev.selectedPermissions.map(p => 
                        p.id === permission.id 
                          ? { ...p, permission_value: e.target.value }
                          : p
                      )
                    }));
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
                    const selectedPerm = formData.selectedPermissions.find(p => p.id === permission.id);
                    return selectedPerm?.permission_value || '';
                  })()}
                  onChange={(e) => {
                    // Update the permission value in the selected permissions
                    setFormData(prev => ({
                      ...prev,
                      selectedPermissions: prev.selectedPermissions.map(p => 
                        p.id === permission.id 
                          ? { ...p, permission_value: e.target.value }
                          : p
                      )
                    }));
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
                  {/* TODO: Add options from API when available */}
                  <option value="option1">Option 1</option>
                  <option value="option2">Option 2</option>
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

  const filteredRoles = roles.filter(role =>
    role.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    role.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (role.description && role.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div style={{ width: '100%', maxWidth: '1400px', margin: '0' }}>
      {/* Header Section */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32, marginTop: 50 }}>
        <div>
          <h2 style={{ color: '#1e40af', fontWeight: 700, fontSize: 28, margin: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="material-icons" style={{ fontSize: 32, color: '#1e40af' }}>group</span>
            Roles Management
          </h2>
          <div style={{ color: '#64748b', fontSize: 16, marginTop: 4 }}>Create and manage user roles with specific permissions</div>
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
          {roles.length} roles
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
            placeholder="Search roles..."
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
            onClick={loadRoles}
            disabled={loading}
            style={{
              background: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)',
              border: 'none',
              borderRadius: 8,
              width: 44,
              height: 48,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'transform 0.2s, box-shadow 0.2s',
              boxShadow: '0 2px 8px 0 rgba(59,130,246,0.20)',
            }}
            title="Refresh roles"
            onMouseEnter={(e) => {
              if (!loading) {
                e.target.style.transform = 'scale(1.05)';
                e.target.style.boxShadow = '0 4px 12px 0 rgba(59,130,246,0.30)';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.target.style.transform = 'scale(1)';
                e.target.style.boxShadow = '0 2px 8px 0 rgba(59,130,246,0.20)';
              }
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
            onClick={() => {
              setShowCreateForm(true);
              setEditingRole(null);
            }}
            style={{
              background: 'linear-gradient(135deg, #F27020 0%, #e55a00 100%)',
              border: 'none',
              borderRadius: 8,
              padding: '12px 20px',
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 2px 8px 0 rgba(242, 112, 32, 0.2)',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'scale(1.05)';
              e.target.style.boxShadow = '0 4px 12px 0 rgba(242, 112, 32, 0.30)';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'scale(1)';
              e.target.style.boxShadow = '0 2px 8px 0 rgba(242, 112, 32, 0.20)';
            }}
          >
            <span className="material-icons" style={{ fontSize: 18 }}>
              add
            </span>
            Create Role
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
          gap: 8,
          marginLeft: 20,
          marginRight: 20
        }}>
          <span className="material-icons" style={{ fontSize: 18 }}>
            error
          </span>
          {error}
        </div>
      )}

      {/* Roles Table */}
      <div style={{
        background: '#fff',
        borderRadius: 16,
        boxShadow: '0 4px 24px 0 rgba(31,38,135,0.08)',
        overflow: 'hidden',
        marginBottom: 24
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
              Loading roles...
            </p>
          </div>
        ) : filteredRoles.length === 0 ? (
          <div style={{
            padding: '48px',
            textAlign: 'center',
            color: '#64748b'
          }}>
            <span className="material-icons" style={{ fontSize: 48, color: '#cbd5e1' }}>
              group
            </span>
            <p style={{ margin: '16px 0 0 0', fontSize: 16 }}>
              {searchTerm ? 'No roles found matching your search' : 'No roles available'}
            </p>
          </div>
        ) : (
          <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15 }}>
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
                    borderBottom: '2px solid #e2e8f0',
                    width: '70%'
                  }}>Role Details</th>
                  <th style={{ 
                    padding: '12px 16px', 
                    textAlign: 'left', 
                    fontWeight: 700, 
                    color: '#1e293b',
                    fontSize: 14,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    borderBottom: '2px solid #e2e8f0',
                    width: '30%'
                  }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRoles.map((role, index) => (
                  <tr key={`role-${role.id}`} style={{ 
                    background: index % 2 === 0 ? '#fff' : '#f8fafc',
                    borderBottom: '1px solid #e2e8f0'
                  }}>
                    <td style={{ padding: '12px 16px', verticalAlign: 'top' }}>
                      <div style={{ fontWeight: 600, color: '#1e293b', fontSize: 14 }}>
                        {role.display_name}
                      </div>
                      <div style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>
                        {role.description || 'No description provided'}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', verticalAlign: 'top' }}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          onClick={() => startEdit(role)}
                          style={{
                            background: '#3b82f6',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 4,
                            padding: '6px 12px',
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'background-color 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.backgroundColor = '#1e40af';
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.backgroundColor = '#3b82f6';
                          }}
                          onMouseDown={(e) => {
                            e.target.style.backgroundColor = '#1e40af';
                          }}
                          onMouseUp={(e) => {
                            e.target.style.backgroundColor = '#3b82f6';
                          }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteRole(role.id)}
                          style={{
                            background: '#dc2626',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 4,
                            padding: '6px 12px',
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'background-color 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.backgroundColor = '#b91c1c';
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.backgroundColor = '#dc2626';
                          }}
                          onMouseDown={(e) => {
                            e.target.style.backgroundColor = '#b91c1c';
                          }}
                          onMouseUp={(e) => {
                            e.target.style.backgroundColor = '#dc2626';
                          }}
                        >
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

      {/* Summary */}
      {!loading && filteredRoles.length > 0 && (
        <div style={{
          marginTop: 24,
          padding: '16px 24px',
          background: '#f8fafc',
          borderRadius: 8,
          border: '1px solid #e2e8f0',
          marginLeft: 20,
          marginRight: 20
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
              <strong>{roles.length}</strong> roles available. Click "Create Role" to add new roles or use the action buttons to edit/delete existing roles.
            </span>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {(showCreateForm || editingRole) && (
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
          zIndex: 1000,
          padding: 20
        }}>
          <div style={{
            background: '#fff',
            borderRadius: 16,
            boxShadow: '0 20px 40px 0 rgba(0, 0, 0, 0.15)',
            width: '100%',
            maxWidth: '800px',
            maxHeight: '90vh',
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
              <h3 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: '#1e40af' }}>
                {editingRole ? 'Edit Role' : 'Create New Role'}
              </h3>
              <button
                onClick={editingRole ? cancelEdit : cancelCreate}
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
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: '#374151' }}>
                  Display Name *
                </label>
                <input
                  type="text"
                  value={formData.display_name}
                  onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                  placeholder="e.g., Administrator, Manager, User"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '1.5px solid #e2e8f0',
                    borderRadius: 8,
                    fontSize: 16,
                    outline: 'none',
                    background: '#f8fafc',
                    transition: 'border-color 0.2s',
                    boxSizing: 'border-box',
                    maxWidth: '100%',
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                />
              </div>
              
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: '#374151' }}>
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe the role's purpose and permissions..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '1.5px solid #e2e8f0',
                    borderRadius: 8,
                    fontSize: 16,
                    outline: 'none',
                    background: '#f8fafc',
                    transition: 'border-color 0.2s',
                    boxSizing: 'border-box',
                    maxWidth: '100%',
                    resize: 'vertical',
                    fontFamily: 'inherit'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                />
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', marginBottom: 12, fontWeight: 600, color: '#374151' }}>
                  Select Modules & Permissions
                </label>
                <div style={{ 
                  maxHeight: '300px', 
                  overflowY: 'auto', 
                  border: '1.5px solid #e2e8f0', 
                  borderRadius: 8, 
                  background: '#f8fafc',
                  padding: '8px'
                }}>
                  {modules.length === 0 ? (
                    <div style={{ 
                      padding: '20px', 
                      textAlign: 'center', 
                      color: '#64748b',
                      fontSize: 14
                    }}>
                      No modules available. Please select modules in Modules Management first.
                    </div>
                  ) : (
                    modules.map((module) => {
                      const isSelected = isModuleSelected(module.id);
                      const modulePermissions = permissions.find(p => p.module_id === module.id);
                      const hasPermissions = modulePermissions && modulePermissions.permissions && modulePermissions.permissions.length > 0;
                      
                      return (
                        <div key={module.id} style={{ marginBottom: 12 }}>
                          {/* Module Row */}
                          <div
                            onClick={() => handleModuleToggle(module.id)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              padding: '12px 16px',
                              cursor: 'pointer',
                              borderRadius: 8,
                              transition: 'all 0.2s',
                              background: isSelected ? '#f0f9ff' : '#ffffff',
                              border: isSelected ? '2px solid #e0f2fe' : '2px solid #e2e8f0',
                              boxShadow: isSelected ? '0 2px 8px rgba(59, 130, 246, 0.1)' : '0 1px 3px rgba(0, 0, 0, 0.1)'
                            }}
                            onMouseEnter={(e) => {
                              e.target.style.background = isSelected ? '#e0f2fe' : '#f8fafc';
                              e.target.style.borderColor = isSelected ? '#bae6fd' : '#cbd5e1';
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.background = isSelected ? '#f0f9ff' : '#ffffff';
                              e.target.style.borderColor = isSelected ? '#e0f2fe' : '#e2e8f0';
                            }}
                          >
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
                              marginRight: 16
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
                            <div style={{ flex: 1 }}>
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
                            {hasPermissions && (
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
                                  color: '#64748b'
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
                        </div>
                      );
                    })
                  )}
                </div>
                {(formData.selectedModules.length > 0 || formData.selectedPermissions.length > 0) && (
                  <div style={{
                    marginTop: 8,
                    fontSize: 12,
                    color: '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}>
                    <span className="material-icons" style={{ fontSize: 16 }}>
                      info
                    </span>
                    {formData.selectedModules.length} module{formData.selectedModules.length !== 1 ? 's' : ''} selected
                    {formData.selectedPermissions.length > 0 && (
                      <span style={{ marginLeft: 8 }}>
                        • {formData.selectedPermissions.length} permission{formData.selectedPermissions.length !== 1 ? 's' : ''} selected
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div style={{
              padding: '20px 24px',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              gap: 12,
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={editingRole ? cancelEdit : cancelCreate}
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
                onClick={editingRole ? handleEditRole : handleCreateRole}
                disabled={!formData.display_name}
                style={{
                  padding: '12px 24px',
                  border: 'none',
                  borderRadius: 8,
                  background: 'linear-gradient(135deg, #F27020 0%, #e55a00 100%)',
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: !formData.display_name ? 'not-allowed' : 'pointer',
                  opacity: !formData.display_name ? 0.7 : 1,
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (formData.display_name) {
                    e.target.style.transform = 'scale(1.05)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (formData.display_name) {
                    e.target.style.transform = 'scale(1)';
                  }
                }}
              >
                {editingRole ? 'Update Role' : 'Create Role'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permission Sub-form Modal */}
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
                const module = modules.find(m => m.id === openPermissionModule);
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

export default RolesManagement;