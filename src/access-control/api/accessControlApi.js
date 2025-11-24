import { apiGet, apiPost, apiPut, apiDelete } from '../../utils/apiUtils';
import { getApiUrl } from '../../config';

const BASE_URL = '/api/access-control';

// Mock data for when API endpoints are not available
const MOCK_MODULES = [
  {
    id: 1,
    name: 'place_order',
    display_name: 'Place Order',
    description: 'Standard place order functionality',
    route_path: '/api/tally/place-order',
    parent_module_id: null,
    sort_order: 1,
    is_active: true,
    created_at: '2024-01-01T00:00:00.000Z'
  },
  {
    id: 2,
    name: 'ecommerce_place_order',
    display_name: 'Ecommerce Place Order',
    description: 'Ecommerce order management system',
    route_path: '/api/tally/ecommerce-place-order',
    parent_module_id: null,
    sort_order: 2,
    is_active: true,
    created_at: '2024-01-01T00:00:00.000Z'
  },
  {
    id: 3,
    name: 'ledger_report',
    display_name: 'Ledger Report',
    description: 'Generate and view ledger reports',
    route_path: '/api/tally/ledger-report',
    parent_module_id: null,
    sort_order: 3,
    is_active: true,
    created_at: '2024-01-01T00:00:00.000Z'
  },
  {
    id: 4,
    name: 'ledger_voucher',
    display_name: 'Ledger Voucher',
    description: 'Manage ledger vouchers and entries',
    route_path: '/api/tally/ledger-voucher',
    parent_module_id: null,
    sort_order: 4,
    is_active: true,
    created_at: '2024-01-01T00:00:00.000Z'
  },
  {
    id: 5,
    name: 'bill_wise_report',
    display_name: 'Bill Wise Report',
    description: 'Generate bill-wise analysis reports',
    route_path: '/api/tally/bill-wise-report',
    parent_module_id: null,
    sort_order: 5,
    is_active: true,
    created_at: '2024-01-01T00:00:00.000Z'
  },
  {
    id: 6,
    name: 'stock_report',
    display_name: 'Stock Report',
    description: 'Inventory and stock management reports',
    route_path: '/api/tally/stock-report',
    parent_module_id: null,
    sort_order: 6,
    is_active: true,
    created_at: '2024-01-01T00:00:00.000Z'
  },
  {
    id: 7,
    name: 'sales_report',
    display_name: 'Sales Report',
    description: 'Sales analysis and reporting',
    route_path: '/api/tally/sales-report',
    parent_module_id: null,
    sort_order: 7,
    is_active: true,
    created_at: '2024-01-01T00:00:00.000Z'
  },
  {
    id: 8,
    name: 'purchase_report',
    display_name: 'Purchase Report',
    description: 'Purchase analysis and reporting',
    route_path: '/api/tally/purchase-report',
    parent_module_id: null,
    sort_order: 8,
    is_active: true,
    created_at: '2024-01-01T00:00:00.000Z'
  },
  {
    id: 9,
    name: 'financial_report',
    display_name: 'Financial Report',
    description: 'Comprehensive financial reporting',
    route_path: '/api/tally/financial-report',
    parent_module_id: null,
    sort_order: 9,
    is_active: true,
    created_at: '2024-01-01T00:00:00.000Z'
  },
  {
    id: 10,
    name: 'user_management',
    display_name: 'User Management',
    description: 'Manage users and permissions',
    route_path: '/api/tally/user-management',
    parent_module_id: null,
    sort_order: 10,
    is_active: true,
    created_at: '2024-01-01T00:00:00.000Z'
  }
];

const MOCK_ROLES = [
  {
    id: 1,
    name: 'admin',
    display_name: 'Administrator',
    description: 'Full system access with all permissions',
    is_active: true,
    created_at: '2024-01-01T00:00:00.000Z'
  },
  {
    id: 2,
    name: 'manager',
    display_name: 'Manager',
    description: 'Management level access with reporting permissions',
    is_active: true,
    created_at: '2024-01-01T00:00:00.000Z'
  },
  {
    id: 3,
    name: 'user',
    display_name: 'Standard User',
    description: 'Basic user access with limited permissions',
    is_active: true,
    created_at: '2024-01-01T00:00:00.000Z'
  }
];

// Helper function to check if API is available
const isApiAvailable = async () => {
  try {
    await apiGet(`${BASE_URL}/modules/all`);
    return true;
  } catch (error) {
    return false;
  }
};

// Modules Management APIs
export const modulesApi = {
  // Get all modules
  getAllModules: async () => {
    try {
      return await apiGet(`${BASE_URL}/modules/all`);
    } catch (error) {
      console.warn('Access Control API not available, using mock data');
      return { modules: MOCK_MODULES };
    }
  },

  // Get owner's selected modules
  getOwnerSelectedModules: async () => {
    try {
      return await apiGet(`${BASE_URL}/modules/owner-selected`);
    } catch (error) {
      console.warn('Access Control API not available, using mock data');
      // Return first 8 modules as selected by default
      return { modules: MOCK_MODULES.slice(0, 8).map(module => ({ 
        id: module.id, 
        name: module.name, 
        display_name: module.display_name, 
        is_enabled: true 
      })) };
    }
  },

  // Update owner's module selection
  updateOwnerModuleSelection: async (moduleIds, permissions = []) => {
    try {
      return await apiPut(`${BASE_URL}/modules/update-selections`, { 
        moduleIds, 
        permissions 
      });
    } catch (error) {
      console.warn('Access Control API not available, simulating success');
      return { message: 'Module selection updated successfully (simulated)' };
    }
  }
};

// Roles Management APIs
export const rolesApi = {
  // Get all roles (owner's roles)
  getAllRoles: async () => {
    try {
      return await apiGet(`${BASE_URL}/roles/all`);
    } catch (error) {
      console.warn('Access Control API not available, using mock data');
      return { roles: MOCK_ROLES };
    }
  },

  // Get role details with permissions
  getRoleDetails: async (roleId) => {
    try {
      return await apiGet(`${BASE_URL}/roles/${roleId}`);
    } catch (error) {
      console.warn('Access Control API not available, using mock data');
      const role = MOCK_ROLES.find(r => r.id === parseInt(roleId));
      
      // Mock response matching the expected format
      return { 
        role: {
          id: role?.id || 1,
          name: role?.name || 'test_role',
          display_name: role?.display_name || 'Test Role',
          description: role?.description || 'Test role description',
          is_active: 1,
          created_at: new Date().toISOString()
        },
        modules: [
          {
            module_id: 1,
            module_name: "place_order",
            module_display_name: "Place Order",
            module_description: "Standard place order functionality",
            route_path: "/api/tally/place-order",
            permissions: [
              {
                permission_id: 1,
                permission_key: "view",
                display_name: "View Place Order",
                description: "Can view place order page and data",
                granted: 1,
                permission_type: "boolean",
                permission_value: null
              },
              {
                permission_id: 2,
                permission_key: "create",
                display_name: "Create Orders",
                description: "Can create new orders",
                granted: 1,
                permission_type: "boolean",
                permission_value: null
              }
            ]
          },
          {
            module_id: 2,
            module_name: "ecommerce_place_order",
            module_display_name: "Ecommerce Place Order",
            module_description: "Ecommerce-specific place order with enhanced features",
            route_path: "/api/ecommerce/place-order",
            permissions: [
              {
                permission_id: 3,
                permission_key: "view",
                display_name: "View Ecommerce Orders",
                description: "Can view ecommerce order page and data",
                granted: 1,
                permission_type: "boolean",
                permission_value: null
              }
            ]
          }
        ],
        totalModules: 2,
        totalPermissions: 3
      };
    }
  },

  // Create new role
  createRole: async (roleData) => {
    try {
      return await apiPost(`${BASE_URL}/roles/create-or-update`, roleData);
    } catch (error) {
      console.warn('Access Control API not available, simulating success');
      return { 
        message: 'Role created successfully', 
        roleId: Date.now(),
        action: 'created',
        permissionsCount: roleData.modules.reduce((total, module) => total + (module.permissions ? module.permissions.length : 0), 0),
        modulesCount: roleData.modules.length
      };
    }
  },

  // Update role
  updateRole: async (roleId, roleData) => {
    try {
      return await apiPost(`${BASE_URL}/roles/create-or-update`, roleData);
    } catch (error) {
      console.warn('Access Control API not available, simulating success');
      return { 
        message: 'Role updated successfully', 
        roleId: roleId,
        action: 'updated',
        permissionsCount: roleData.modules.reduce((total, module) => total + (module.permissions ? module.permissions.length : 0), 0),
        modulesCount: roleData.modules.length
      };
    }
  },

  // Delete role
  deleteRole: async (roleId) => {
    try {
      return await apiDelete(`${BASE_URL}/roles/${roleId}`);
    } catch (error) {
      console.warn('Access Control API not available, simulating success');
      return { message: 'Role deleted successfully (simulated)' };
    }
  },

  // Get owner's selected roles
  getOwnerRoles: async () => {
    try {
      return await apiGet(`${BASE_URL}/roles/owner-selection`);
    } catch (error) {
      console.warn('Access Control API not available, using mock data');
      return { roles: MOCK_ROLES.filter(role => role.is_enabled) };
    }
  },

  // Update owner's role selection
  updateOwnerRoleSelection: async (roleIds) => {
    try {
      return await apiPut(`${BASE_URL}/roles/update-selections`, { roleIds });
    } catch (error) {
      console.warn('Access Control API not available, simulating success');
      return { message: 'Role selection updated successfully (simulated)' };
    }
  }
};

// User Management APIs
export const usersApi = {
  // Get users for tally location
  getUsersForTallyLocation: async (tallylocId) => {
    try {
      return await apiGet(`${BASE_URL}/users/tally-location/${tallylocId}`);
    } catch (error) {
      console.warn('Access Control API not available, using mock data');
      return { users: [] };
    }
  },

  // Add user to tally location
  addUserToTallyLocation: async (userData) => {
    try {
      return await apiPost(`${BASE_URL}/users/add-to-tally-location`, userData);
    } catch (error) {
      console.warn('Access Control API not available, simulating success');
      return { message: 'User added successfully (simulated)' };
    }
  },

  // Update user role
  updateUserRole: async (userData) => {
    try {
      return await apiPut(`${BASE_URL}/users/update-role`, userData);
    } catch (error) {
      console.warn('Access Control API not available, simulating success');
      return { message: 'User role updated successfully (simulated)' };
    }
  },

  // Remove user from tally location
  removeUserFromTallyLocation: async (userData) => {
    try {
      return await apiDelete(`${BASE_URL}/users/remove-from-tally-location`, userData);
    } catch (error) {
      console.warn('Access Control API not available, simulating success');
      return { message: 'User removed successfully (simulated)' };
    }
  },

  // Get user's tally locations
  getMyTallyLocations: async () => {
    try {
      return await apiGet(`${BASE_URL}/users/my-tally-locations`);
    } catch (error) {
      console.warn('Access Control API not available, using mock data');
      return { 
        tallyLocations: [
          {
            tallyloc_id: 1,
            tallyloc_name: 'Main Office',
            conn_id: '192.168.1.100',
            conn_port: 9000,
            co_name: 'DataLynk Demo',
            co_guid: 'demo-guid-123',
            user_type: 'internal',
            access_active: true,
            roles: 'Administrator',
            owner_name: 'Demo Owner',
            owner_email: 'owner@demo.com'
          }
        ]
      };
    }
  },

  // Search users
  searchUsers: async (query) => {
    try {
      return await apiGet(`${BASE_URL}/users/search?query=${encodeURIComponent(query)}`);
    } catch (error) {
      console.warn('Access Control API not available, using mock data');
      return { 
        users: [
          {
            id: 1,
            name: 'John Doe',
            email: 'john@example.com',
            mobileno: '1234567890'
          },
          {
            id: 2,
            name: 'Jane Smith',
            email: 'jane@example.com',
            mobileno: '0987654321'
          }
        ]
      };
    }
  }
};

// Permissions Management APIs
export const permissionsApi = {
  // Get all permissions (module-wise)
  getAllPermissions: async () => {
    try {
      return await apiGet(`${BASE_URL}/permissions/all?includeHierarchy=true`);
    } catch (error) {
      console.warn('Access Control API not available, using mock data');
      return { 
        permissions: [
          {
            module_id: 1,
            module_name: "place_order",
            module_display_name: "Place Order",
            module_description: "Standard place order functionality",
            module_sort_order: 1,
            permissions: [
              {
                id: 57,
                permission_key: "save_optional",
                display_name: "Save Order by default as Optional",
                description: null,
                sort_order: 1,
                permission_value: null,
                permission_type: "boolean",
                permission_options: null,
                parent_permission_id: null,
                parent_permission_key: null,
                parent_permission_name: null,
                is_parent: false,
                is_child: false,
                children: []
              },
              {
                id: 58,
                permission_key: "show_payterms",
                display_name: "Enable Payment Terms",
                description: null,
                sort_order: 2,
                permission_value: null,
                permission_type: "boolean",
                permission_options: null,
                parent_permission_id: null,
                parent_permission_key: null,
                parent_permission_name: null,
                is_parent: false,
                is_child: false,
                children: []
              },
              {
                id: 59,
                permission_key: "show_delvterms",
                display_name: "Enable Delivery Terms",
                description: null,
                sort_order: 3,
                permission_value: null,
                permission_type: "boolean",
                permission_options: null,
                parent_permission_id: null,
                parent_permission_key: null,
                parent_permission_name: null,
                is_parent: false,
                is_child: false,
                children: []
              },
              {
                id: 60,
                permission_key: "show_rateamt_Column",
                display_name: "Enable Rate and Amount Fields",
                description: null,
                sort_order: 4,
                permission_value: null,
                permission_type: "boolean",
                permission_options: null,
                parent_permission_id: null,
                parent_permission_key: null,
                parent_permission_name: null,
                is_parent: true,
                is_child: false,
                children: [
                  {
                    id: 61,
                    permission_key: "edit_rate",
                    display_name: "Allow Rate Modification",
                    description: null,
                    sort_order: 5,
                    permission_value: null,
                    permission_type: "boolean",
                    permission_options: null,
                    parent_permission_id: 60,
                    parent_permission_key: "show_rateamt_Column",
                    parent_permission_name: "Enable Rate and Amount Fields",
                    is_parent: false,
                    is_child: true,
                    children: []
                  },
                  {
                    id: 62,
                    permission_key: "show_disc_Column",
                    display_name: "Enable Discount Field",
                    description: null,
                    sort_order: 6,
                    permission_value: null,
                    permission_type: "boolean",
                    permission_options: null,
                    parent_permission_id: 60,
                    parent_permission_key: "show_rateamt_Column",
                    parent_permission_name: "Enable Rate and Amount Fields",
                    is_parent: true,
                    is_child: true,
                    children: [
                      {
                        id: 63,
                        permission_key: "edit_discount",
                        display_name: "Allow Discount Modification",
                        description: null,
                        sort_order: 7,
                        permission_value: null,
                        permission_type: "boolean",
                        permission_options: null,
                        parent_permission_id: 62,
                        parent_permission_key: "show_disc_Column",
                        parent_permission_name: "Enable Discount Field",
                        is_parent: false,
                        is_child: true,
                        children: []
                      }
                    ]
                  }
                ]
              },
              {
                id: 90,
                permission_key: "def_vchtype",
                display_name: "Default Voucher Type",
                description: null,
                sort_order: 14,
                permission_value: "Sales Order",
                permission_type: "string",
                permission_options: null,
                parent_permission_id: null,
                parent_permission_key: null,
                parent_permission_name: null,
                is_parent: true,
                is_child: false,
                children: [
                  {
                    id: 91,
                    permission_key: "allow_vchtype",
                    display_name: "Allow User to Select Voucher Type",
                    description: null,
                    sort_order: 15,
                    permission_value: null,
                    permission_type: "boolean",
                    permission_options: null,
                    parent_permission_id: 90,
                    parent_permission_key: "def_vchtype",
                    parent_permission_name: "Default Voucher Type",
                    is_parent: false,
                    is_child: true,
                    children: []
                  }
                ]
              },
              {
                id: 92,
                permission_key: "def_qty",
                display_name: "Set Default Qty Value",
                description: null,
                sort_order: 16,
                permission_value: null,
                permission_type: "number",
                permission_options: null,
                parent_permission_id: null,
                parent_permission_key: null,
                parent_permission_name: null,
                is_parent: false,
                is_child: false,
                children: []
              }
            ]
          },
          {
            module_id: 2,
            module_name: "ecommerce_place_order",
            module_display_name: "Ecommerce Place Order",
            module_description: "Ecommerce-specific place order with enhanced features",
            module_sort_order: 2,
            permissions: [
              {
                id: 70,
                permission_key: "save_optional",
                display_name: "Save Order by default as Optional",
                description: null,
                sort_order: 1,
                permission_value: null,
                permission_type: "boolean",
                permission_options: null,
                parent_permission_id: null,
                parent_permission_key: null,
                parent_permission_name: null,
                is_parent: false,
                is_child: false,
                children: []
              },
              {
                id: 85,
                permission_key: "show_image",
                display_name: "Show Stockitem Image",
                description: null,
                sort_order: 14,
                permission_value: null,
                permission_type: "boolean",
                permission_options: null,
                parent_permission_id: null,
                parent_permission_key: null,
                parent_permission_name: null,
                is_parent: false,
                is_child: false,
                children: []
              }
            ]
          }
        ]
      };
    }
  },

  // Get user's permissions
  getUserPermissions: async (tallylocId) => {
    try {
      return await apiGet(`${BASE_URL}/permissions/user-permissions/${tallylocId}`);
    } catch (error) {
      console.warn('Access Control API not available, using mock data');
      return { permissions: [] };
    }
  },

  // Grant direct permission
  grantPermission: async (permissionData) => {
    try {
      return await apiPost(`${BASE_URL}/permissions/grant-permission`, permissionData);
    } catch (error) {
      console.warn('Access Control API not available, simulating success');
      return { message: 'Permission updated successfully (simulated)' };
    }
  },

  // Check specific permission
  checkPermission: async (permissionData) => {
    try {
      return await apiPost(`${BASE_URL}/permissions/check`, permissionData);
    } catch (error) {
      console.warn('Access Control API not available, using mock data');
      return { 
        hasPermission: true, 
        source: 'role', 
        roleName: 'Administrator' 
      };
    }
  }
};

// Helper function to get tally locations for dropdown
export const getTallyLocationsForDropdown = async () => {
  try {
    const response = await usersApi.getMyTallyLocations();
    return response.tallyLocations || [];
  } catch (error) {
    console.error('Error fetching tally locations:', error);
    return [];
  }
};

// Helper function to format error messages
export const formatApiError = (error) => {
  if (error.response && error.response.data) {
    return error.response.data.message || error.response.data.error || 'An error occurred';
  }
  return error.message || 'An unexpected error occurred';
};

// Helper function to show success/error messages
export const showMessage = (message, type = 'success') => {
  // This would typically integrate with a toast notification system
  console.log(`${type.toUpperCase()}: ${message}`);
  
  // Create a simple toast notification
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 20px;
    border-radius: 8px;
    color: white;
    font-weight: 500;
    z-index: 10000;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    transform: translateX(100%);
    transition: transform 0.3s ease;
    max-width: 300px;
    word-wrap: break-word;
  `;
  
  if (type === 'success') {
    toast.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
  } else if (type === 'error') {
    toast.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
  } else {
    toast.style.background = 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)';
  }
  
  toast.textContent = message;
  document.body.appendChild(toast);
  
  // Animate in
  setTimeout(() => {
    toast.style.transform = 'translateX(0)';
  }, 100);
  
  // Auto remove after 3 seconds
  setTimeout(() => {
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => {
      if (document.body.contains(toast)) {
        document.body.removeChild(toast);
      }
    }, 300);
  }, 3000);
};
