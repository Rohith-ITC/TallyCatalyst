# Access Control System API Documentation

## Overview
This document provides complete API documentation for the multi-tenant SaaS access control system. The system supports module-wise/page-wise access control with granular permissions for internal and external users.

## Base URL
```
/api/access-control
```

## Authentication
All APIs require JWT token in the Authorization header:
```
Authorization: Bearer <jwt_token>
```

---

## 1. Modules Management APIs

### 1.1 Get All Modules
**GET** `/modules/all`

**Description:** Get all available modules

**Response:**
```json
{
  "modules": [
    {
      "id": 1,
      "name": "place_order",
      "display_name": "Place Order",
      "description": "Standard place order functionality",
      "route_path": "/api/tally/place-order",
      "parent_module_id": null,
      "sort_order": 1,
      "is_active": true,
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### 1.2 Get Owner's Selected Modules
**GET** `/modules/owner-selected`

**Description:** Get modules selected by the current owner

**Response:**
```json
{
  "modules": [
    {
      "id": 1,
      "name": "place_order",
      "display_name": "Place Order",
      "is_enabled": true
    }
  ]
}
```

### 1.3 Update Owner's Module Selection
**PUT** `/modules/owner-selection`

**Description:** Update which modules the owner has selected

**Request Body:**
```json
{
  "moduleIds": [1, 2, 3, 4, 5]
}
```

**Response:**
```json
{
  "message": "Owner module selection updated successfully"
}
```

---

## 2. Roles Management APIs

### 2.1 Get All Roles (Owner's Roles)
**GET** `/roles/all`

**Description:** Get all roles created by the current owner

**Response:**
```json
{
  "roles": [
    {
      "id": 1,
      "name": "sales_manager",
      "display_name": "Sales Manager",
      "description": "Sales management with approval rights",
      "is_active": true,
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### 2.2 Get Role Details with Permissions
**GET** `/roles/:roleId`

**Description:** Get detailed role information with assigned permissions

**Response:**
```json
{
  "role": {
    "id": 1,
    "name": "sales_manager",
    "display_name": "Sales Manager",
    "description": "Sales management with approval rights",
    "is_active": true,
    "created_at": "2024-01-01T00:00:00.000Z"
  },
  "permissions": [
    {
      "id": 1,
      "permission_key": "view",
      "display_name": "View Place Order",
      "description": "Can view place order page and data",
      "granted": true
    }
  ]
}
```

### 2.3 Create Role
**POST** `/roles`

**Description:** Create a new role with permissions

**Request Body:**
```json
{
  "name": "sales_executive",
  "display_name": "Sales Executive",
  "description": "Sales team member with order management",
  "permissions": [1, 2, 3, 4]
}
```

**Response:**
```json
{
  "message": "Role created successfully",
  "roleId": 5
}
```

### 2.4 Update Role
**PUT** `/roles/:roleId`

**Description:** Update role details and permissions

**Request Body:**
```json
{
  "display_name": "Senior Sales Executive",
  "description": "Senior sales team member with enhanced permissions",
  "permissions": [1, 2, 3, 4, 5, 6]
}
```

**Response:**
```json
{
  "message": "Role updated successfully"
}
```

### 2.5 Delete Role
**DELETE** `/roles/:roleId`

**Description:** Delete a role (soft delete)

**Response:**
```json
{
  "message": "Role deleted successfully"
}
```

---

## 3. User Access Management APIs

### 3.1 Get Users for Tally Location
**GET** `/users/tally-location/:tallylocId`

**Description:** Get all users with access to a specific tally location

**Response:**
```json
{
  "users": [
    {
      "id": 2,
      "name": "John Doe",
      "email": "john@example.com",
      "mobileno": "1234567890",
      "user_type": "internal",
      "co_name": "ABC Corp",
      "co_guid": "ABC123-GUID",
      "access_active": true,
      "access_created_at": "2024-01-01T00:00:00.000Z",
      "roles": "Sales Manager, Accountant"
    }
  ]
}
```

### 3.2 Add User to Tally Location
**POST** `/users/add-to-tally-location`

**Description:** Add a user to a tally location with a specific role

**Request Body:**
```json
{
  "userId": 52,
  "tallylocId": 74,
  "userType": "internal",
  "coName": "Cyber Automobiles",
  "coGuid": "b3aa05e9-bfbb-4f60-ba09-5bdc5f2b18b1",
  "roleId": 3
}
```

**Response:**
```json
{
  "message": "User added successfully"
}
```

### 3.3 Update User Role
**PUT** `/users/update-role`

**Description:** Update a user's role for a specific tally location

**Request Body:**
```json
{
  "userId": 52,
  "tallylocId": 74,
  "roleId": 5
}
```

**Response:**
```json
{
  "message": "User role updated successfully"
}
```

### 3.4 Remove User from Tally Location
**DELETE** `/users/remove-from-tally-location`

**Description:** Remove a user's access to a tally location

**Request Body:**
```json
{
  "userId": 52,
  "tallylocId": 74
}
```

**Response:**
```json
{
  "message": "User removed successfully"
}
```

### 3.5 Get User's Tally Locations
**GET** `/users/my-tally-locations`

**Description:** Get all tally locations accessible by the current user

**Response:**
```json
{
  "tallyLocations": [
    {
      "tallyloc_id": 74,
      "tallyloc_name": "Main Office",
      "conn_id": "192.168.1.100",
      "conn_port": 9000,
      "co_name": "Cyber Automobiles",
      "co_guid": "b3aa05e9-bfbb-4f60-ba09-5bdc5f2b18b1",
      "user_type": "internal",
      "access_active": true,
      "roles": "Sales Manager",
      "owner_name": "Company Owner",
      "owner_email": "owner@company.com"
    }
  ]
}
```

### 3.6 Search Users
**GET** `/users/search?query=john`

**Description:** Search users by name or email for adding to tally locations

**Response:**
```json
{
  "users": [
    {
      "id": 52,
      "name": "John Doe",
      "email": "john@example.com",
      "mobileno": "1234567890"
    }
  ]
}
```

---

## 4. Permissions Management APIs

### 4.1 Get User's Permissions
**GET** `/permissions/user-permissions/:tallylocId`

**Description:** Get detailed permissions for a user at a specific tally location

**Response:**
```json
{
  "permissions": [
    {
      "module_name": "place_order",
      "module_display_name": "Place Order",
      "permission_key": "view",
      "permission_display_name": "View Place Order",
      "description": "Can view place order page and data",
      "granted": true,
      "source": "role",
      "reason": null,
      "expires_at": null,
      "role_name": "Sales Manager"
    }
  ]
}
```

### 4.2 Grant Direct Permission
**POST** `/permissions/grant-permission`

**Description:** Grant or deny a specific permission to a user (owner only)

**Request Body:**
```json
{
  "userId": 52,
  "tallylocId": 74,
  "moduleName": "place_order",
  "permissionKey": "modify_rates",
  "granted": false,
  "reason": "Sales Executive - no rate modification rights",
  "expiresAt": null
}
```

**Response:**
```json
{
  "message": "Permission updated successfully"
}
```

### 4.3 Check Specific Permission
**POST** `/permissions/check`

**Description:** Check if user has a specific permission

**Request Body:**
```json
{
  "tallylocId": 74,
  "moduleName": "place_order",
  "permissionKey": "create"
}
```

**Response:**
```json
{
  "hasPermission": true,
  "source": "role",
  "roleName": "Sales Manager"
}
```

---

## 5. Permission Middleware Usage

### 5.1 Using Permission Middleware in Routes
```javascript
const { requirePermission } = require('./access-control/permissions');

// Protect a route with specific permission
router.post('/place-order', requirePermission('place_order', 'create'), async (req, res) => {
  // Your route logic here
  // req.user contains the authenticated user
  res.json({ message: 'Order created successfully' });
});

// Protect with multiple permissions
router.put('/place-order/:id', 
  requirePermission('place_order', 'edit'),
  requirePermission('place_order', 'modify_rates'),
  async (req, res) => {
    // Your route logic here
  }
);
```

---

## 6. Error Responses

### 6.1 Common Error Codes
- **400 Bad Request**: Missing required fields
- **401 Unauthorized**: Invalid or missing token
- **403 Forbidden**: Insufficient permissions
- **404 Not Found**: Resource not found
- **500 Internal Server Error**: Server error

### 6.2 Error Response Format
```json
{
  "error": "Access denied",
  "message": "You don't have create permission for place_order",
  "details": "Additional error details if available"
}
```

---

## 7. Sample Frontend Implementation

### 7.1 Get User's Tally Locations
```javascript
const getMyTallyLocations = async () => {
  const response = await fetch('/api/access-control/users/my-tally-locations', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return await response.json();
};
```

### 7.2 Check Permission Before Action
```javascript
const checkPermission = async (tallylocId, moduleName, permissionKey) => {
  const response = await fetch('/api/access-control/permissions/check', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      tallylocId,
      moduleName,
      permissionKey
    })
  });
  const result = await response.json();
  return result.hasPermission;
};

// Usage
const canCreateOrder = await checkPermission(74, 'place_order', 'create');
if (canCreateOrder) {
  // Show create order button
} else {
  // Hide create order button
}
```

### 7.3 Add User to Tally Location
```javascript
const addUserToTallyLocation = async (userData) => {
  const response = await fetch('/api/access-control/users/add-to-tally-location', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      userId: userData.userId,
      tallylocId: userData.tallylocId,
      userType: userData.userType,
      coName: userData.coName,
      coGuid: userData.coGuid,
      roleId: userData.roleId
    })
  });
  return await response.json();
};
```

---

## 8. Database Schema Reference

### 8.1 Key Tables
- **modules**: Available modules/pages
- **permissions**: Granular permissions for each module
- **roles**: User roles (owner-specific)
- **user_tally_access**: User access to tally locations with company context
- **user_tally_roles**: Role assignments for users
- **user_tally_permissions**: Direct permission overrides

### 8.2 Important Notes
- All role operations are scoped to the current owner
- Same role names can exist for different owners
- Permissions are checked with company context (co_guid)
- Direct permissions override role permissions

---

## 9. Testing the APIs

### 9.1 Test User Setup
1. Create users in the `users` table
2. Create tally locations in the `tally_location` table
3. Set up `user_tally_access` records
4. Create roles and assign permissions
5. Test API endpoints with proper authentication

### 9.2 Sample Test Data
See `docs/FINAL_ACCESS_CONTROL_SAMPLE_DATA_DYNAMIC.sql` for comprehensive test data.

---

This documentation covers all the APIs needed to implement the access control system in your frontend. Each API includes request/response examples and proper error handling.
