# Access Control API Quick Reference

## Base URL: `/api/access-control`

---

## 🔧 Modules APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/modules/all` | Get all modules |
| GET | `/modules/owner-selected` | Get owner's selected modules |
| PUT | `/modules/owner-selection` | Update owner's module selection |

**Payload for owner-selection:**
```json
{
  "moduleIds": [1, 2, 3, 4, 5]
}
```

---

## 👥 Roles APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/roles/all` | Get owner's roles |
| GET | `/roles/:roleId` | Get role details with permissions |
| POST | `/roles` | Create new role |
| PUT | `/roles/:roleId` | Update role |
| DELETE | `/roles/:roleId` | Delete role |

**Payload for create role:**
```json
{
  "name": "sales_executive",
  "display_name": "Sales Executive",
  "description": "Sales team member",
  "permissions": [1, 2, 3, 4]
}
```

---

## 👤 User Management APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/users/tally-location/:tallylocId` | Get users for tally location |
| POST | `/users/add-to-tally-location` | Add user to tally location |
| PUT | `/users/update-role` | Update user role |
| DELETE | `/users/remove-from-tally-location` | Remove user access |
| GET | `/users/my-tally-locations` | Get user's tally locations |
| GET | `/users/search?query=john` | Search users |

**Payload for add user:**
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

**Payload for update role:**
```json
{
  "userId": 52,
  "tallylocId": 74,
  "roleId": 5
}
```

---

## 🔐 Permissions APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/permissions/user-permissions/:tallylocId` | Get user's permissions |
| POST | `/permissions/grant-permission` | Grant/deny permission |
| POST | `/permissions/check` | Check specific permission |

**Payload for grant permission:**
```json
{
  "userId": 52,
  "tallylocId": 74,
  "moduleName": "place_order",
  "permissionKey": "modify_rates",
  "granted": false,
  "reason": "No rate modification rights",
  "expiresAt": null
}
```

**Payload for check permission:**
```json
{
  "tallylocId": 74,
  "moduleName": "place_order",
  "permissionKey": "create"
}
```

---

## 🛡️ Permission Middleware

```javascript
const { requirePermission } = require('./access-control/permissions');

// Single permission
router.post('/place-order', requirePermission('place_order', 'create'), handler);

// Multiple permissions
router.put('/place-order/:id', 
  requirePermission('place_order', 'edit'),
  requirePermission('place_order', 'modify_rates'),
  handler
);
```

---

## 📋 Common Response Formats

**Success:**
```json
{
  "message": "Operation successful",
  "data": { ... }
}
```

**Error:**
```json
{
  "error": "Error message",
  "message": "Detailed error description",
  "details": "Additional details"
}
```

---

## 🔑 Authentication

All requests require JWT token:
```
Authorization: Bearer <jwt_token>
```

---

## 📊 Key Data Structures

**Module:**
```json
{
  "id": 1,
  "name": "place_order",
  "display_name": "Place Order",
  "route_path": "/api/tally/place-order"
}
```

**Role:**
```json
{
  "id": 1,
  "name": "sales_manager",
  "display_name": "Sales Manager",
  "permissions": [1, 2, 3]
}
```

**User Access:**
```json
{
  "user_id": 52,
  "tallyloc_id": 74,
  "co_name": "Cyber Automobiles",
  "co_guid": "b3aa05e9-bfbb-4f60-ba09-5bdc5f2b18b1",
  "user_type": "internal"
}
```

---

## 🚀 Frontend Implementation Tips

1. **Check permissions before showing UI elements**
2. **Use `my-tally-locations` to get user's accessible locations**
3. **Implement role-based UI rendering**
4. **Handle permission errors gracefully**
5. **Use search API for user selection**

---

## 📁 Files to Reference

- **Full Documentation**: `docs/ACCESS_CONTROL_API_DOCUMENTATION.md`
- **Database Schema**: `docs/FINAL_ACCESS_CONTROL_SCHEMA.sql`
- **Sample Data**: `docs/FINAL_ACCESS_CONTROL_SAMPLE_DATA_DYNAMIC.sql`
- **Usage Examples**: `docs/CO_GUID_USAGE_EXAMPLES.sql`
