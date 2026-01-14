# API Endpoints Documentation - Subscription Slabs System

Complete API reference with request/response payloads for all subscription endpoints.

**Base URL:** `/api/subscriptions`

**Authentication:** All endpoints require Bearer token in Authorization header:
```
Authorization: Bearer <token>
```

---

## 1. Slab Management APIs

### 1.1 Internal User Slabs

#### GET `/slabs/internal`
List all active internal user slabs with company bank details

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "1 User Plan",
      "description": "Single user subscription",
      "min_users": 1,
      "max_users": 1,
      "monthly_price": 1000.00,
      "yearly_price": 10000.00,
      "free_external_users_per_internal_user": 10,
      "is_active": true
    }
  ],
  "bank_details": {
    "id": 1,
    "company_name": "Company Name",
    "account_holder_name": "Account Holder Name",
    "bank_name": "Bank Name",
    "account_number": "1234567890",
    "ifsc_code": "BANK0001234",
    "branch_name": "Branch Name",
    "upi_id": "company@upi",
    "is_active": true,
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-01T00:00:00.000Z"
  }
}
```

**Note:** `bank_details` will be `null` if no active bank details are configured.

#### GET `/slabs/internal/:id`
Get specific internal slab details

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "1 User Plan",
    "description": "Single user subscription",
    "min_users": 1,
    "max_users": 1,
    "monthly_price": 1000.00,
    "yearly_price": 10000.00,
    "free_external_users_count": 10,
    "is_active": true
  }
}
```

#### POST `/slabs/internal` (Superadmin only)
Create new internal slab

**Request Body:**
```json
{
  "name": "1 User Plan",
  "description": "Single user subscription",
  "min_users": 1,
  "max_users": 1,
  "monthly_price": 1000.00,  // PER-USER monthly price
  "yearly_price": 10000.00,  // PER-USER yearly price
  "free_external_users_per_internal_user": 10  // Free external users per internal user
}
```

**Note:** 
- `monthly_price` and `yearly_price` are **per-user prices**
- `free_external_users_per_internal_user`: Number of free external users provided for each internal user
  - Example: If slab has `free_external_users_per_internal_user = 10` and subscription has 2 internal users,
    they get 10 * 2 = 20 free external users
  - Example: If slab has `free_external_users_per_internal_user = 12` and subscription has 3 internal users,
    they get 12 * 3 = 36 free external users
- Total subscription price = `price_per_user × number_of_users`
- Example: If monthly_price = ₹1000 and user has 5 users, total = ₹5000/month
- **External users are free** - there are no separate slabs or charges for external users

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "1 User Plan",
    ...
  }
}
```

#### PUT `/slabs/internal/:id` (Superadmin only)
Update existing internal slab

**Request Body:** Same as POST

#### DELETE `/slabs/internal/:id` (Superadmin only)
Deactivate slab (soft delete)

---

---

## 2. Subscription Management APIs

### 2.1 Trial & Purchase

#### POST `/trial/create`
Create trial subscription (called automatically when owner creates connection)

**Request Body:**
```json
{
  "tally_location_id": 123  // optional
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "user_id": 10,
    "internal_slab_id": 1,
    "status": "trial",
    "is_trial": true,
    "trial_start_date": "2024-01-01",
    "trial_end_date": "2024-01-16",
    "start_date": "2024-01-01",
    "end_date": "2024-01-16"
  }
}
```

#### POST `/purchase`
Purchase new subscription

**Request Body:**
```json
{
      "internal_slab_id": 1,
      "billing_cycle": "monthly",
      "user_count": 3,  // Optional: Number of internal users (defaults to slab min_users)
      "partner_id": null,
      "employee_id": null,
      "payment_method": "bank_transfer",
      "payment_reference": "TXN123456",
      "payment_proof_url": "https://example.com/proof.pdf",
      "payment_date": "2024-01-15"
}
```

**Note:** 
- Prices in slabs are **per-user prices** (for internal users)
- Total price = `price_per_user × user_count` (where user_count is number of internal users)
- If `user_count` not provided, defaults to slab's `min_users`
- Example: If slab has ₹1000/month per user and you have 3 internal users, total = ₹3000/month
- External users are provided free based on `free_external_users_per_internal_user` in the slab
- No separate external user slabs or charges exist

**Response:**
```json
{
  "success": true,
  "data": {
    "subscription": {
      "id": 1,
      "user_id": 10,
      "status": "pending_payment",
      ...
    },
    "billing": {
      "id": 1,
      "subscription_id": 1,
      "status": "pending_validation",
      "total_amount": 1000.00,
      "invoice_number": "INV2024000001"
    }
  }
}
```

#### GET `/current`
Get current user's subscription

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "user_id": 10,
    "internal_slab_id": 1,
    "status": "active",
    "is_trial": false,
    "billing_cycle": "monthly",
    "start_date": "2024-01-01",
    "end_date": "2024-02-01",
    "usage": {
      "internal_users": {
        "current": 3,
        "limit": 5,
        "remaining": 2
      },
      "external_users": {
        "current": 8,
        "free_used": 8,
        "free_available": 12,
        "paid_count": 0
      }
    },
    "days_remaining": null
  }
}
```

#### GET `/history`
Get subscription change history

**Query Params:** `?limit=50&offset=0`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "subscription_id": 1,
      "from_slab_id": null,
      "to_slab_id": 1,
      "change_type": "initial",
      "change_date": "2024-01-01T00:00:00Z",
      "amount_charged": 1000.00,
      "notes": "Initial subscription purchase"
    }
  ]
}
```

### 2.2 Upgrade/Downgrade

#### POST `/upgrade`
Upgrade to higher slab

**Request Body:**
```json
{
  "new_slab_id": 2,
  "payment_method": "bank_transfer",
  "payment_reference": "TXN123456",
  "payment_proof_url": "https://example.com/proof.pdf",
  "payment_date": "2024-01-15"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "subscription": { ... },
    "billing": { ... },
    "proRatedAmount": 500.00,
    "totalAmount": 550.00
  }
}
```

#### POST `/downgrade`
Downgrade to lower slab

**Request Body:**
```json
{
  "new_slab_id": 1
}
```

**Error Response (if user count exceeds limit):**
```json
{
  "success": false,
  "error": {
    "message": "You have 10 users but new plan allows only 5 users. Please remove 5 user(s) before downgrading.",
    "code": "USER_COUNT_EXCEEDS_LIMIT",
    "current_count": 10,
    "new_limit": 5,
    "excess_users": 5,
    "action_required": "REMOVE_USERS"
  }
}
```

**Success Response:**
```json
{
  "success": true,
  "data": {
    "subscription": { ... },
    "creditAmount": 250.00
  }
}
```

---

## 3. Billing APIs

### 3.1 Billing History

#### GET `/billing/history`
Get all billing records

**Query Params:** `?limit=50&offset=0&status=paid`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "subscription_id": 1,
      "invoice_number": "INV2024000001",
      "amount": 1000.00,
      "discount_amount": 0.00,
      "tax_amount": 0.00,
      "total_amount": 1000.00,
      "status": "paid",
      "payment_date": "2024-01-15",
      "payment_method": "bank_transfer"
    }
  ]
}
```

#### GET `/billing/invoice/:id`
Get specific invoice

**Response:**
```json
{
  "success": true,
  "data": {
    "invoice_number": "INV2024000001",
    "billing_date": "2024-01-15T00:00:00Z",
    "amount": 1000.00,
    "discount_amount": 0.00,
    "tax_amount": 0.00,
    "total_amount": 1000.00,
    "status": "paid"
  }
}
```

#### POST `/billing/calculate-upgrade`
Calculate pro-rated amount for upgrade (preview)

**Request Body:**
```json
{
  "new_slab_id": 2
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "oldPricePerUser": 1000.00,
    "newPricePerUser": 2000.00,
    "userCount": 3,
    "oldPrice": 3000.00,  // oldPricePerUser × userCount
    "newPrice": 6000.00,  // newPricePerUser × userCount
    "totalDays": 30,
    "daysUsed": 10,
    "daysRemaining": 20,
    "usedAmount": 1000.00,
    "remainingAmountAtOldRate": 2000.00,
    "remainingAmountAtNewRate": 4000.00,
    "amountToCharge": 3000.00,
    "tax_rate": 0,
    "tax_amount": 0.00,
    "total_amount": 3000.00
  }
}
```

**Note:** Prices are per-user. Calculations multiply by current user count.

---

## 4. Usage APIs

### 4.1 Usage Tracking

#### GET `/usage/current`
Get current usage statistics

**Response:**
```json
{
  "success": true,
  "data": {
    "internal_users": {
      "current": 3,
      "limit": 5,
      "remaining": 2
    },
    "external_users": {
      "current": 8,
      "free_used": 8,
      "free_available": 12,
      "paid_count": 0
    }
  }
}
```

#### POST `/usage/validate`
Validate if user can be added

**Request Body:**
```json
{
  "user_type": "internal",  // Only "internal" is supported
  "count": 1
}
```

**Note:** Only internal users can be validated. External users are free and automatically available based on the subscription's internal user count and the slab's `free_external_users_per_internal_user` value.

**Response (Allowed):**
```json
{
  "success": true,
  "data": {
    "allowed": true,
    "reason": null,
    "requires_upgrade": false
  }
}
```

**Response (Not Allowed):**
```json
{
  "success": true,
  "data": {
    "allowed": false,
    "reason": "User limit exceeded. Current: 5, Limit: 5",
    "requires_upgrade": true,
    "current_count": 5,
    "limit": 5,
    "suggested_slab_id": 2
  }
}
```

#### GET `/usage/limits`
Get current subscription limits

**Response:** Same as `/usage/current`

---

## 5. Admin APIs

### 5.1 Payment Validation

#### GET `/admin/payments/pending`
Get all pending payment validations (Superadmin only)

**Query Params:** `?limit=10&offset=0&date_from=2024-01-01`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "subscription_id": 1,
      "invoice_number": "INV2024000001",
      "total_amount": 1000.00,
      "status": "pending_validation",
      "payment_proof_url": "https://example.com/proof.pdf",
      "owner_name": "John Doe",
      "owner_email": "john@example.com"
    }
  ]
}
```

#### GET `/admin/payments/pending/:id`
Get specific pending payment details

#### POST `/admin/payments/validate/:id`
Validate and approve/reject payment (Superadmin only)

**Request Body:**
```json
{
  "action": "approve",
  "validation_notes": "Payment verified via bank statement"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "status": "paid",
    "validated_by": 1,
    "validated_at": "2024-01-15T10:00:00Z",
    "validation_notes": "Payment verified via bank statement"
  },
  "message": "Payment validated successfully"
}
```

### 5.2 Discount Management

#### POST `/admin/discounts/billing/:billingId/apply`
Apply discount to billing record (Superadmin only)

**Request Body:**
```json
{
  "discount_type": "percentage",
  "discount_value": 10,
  "discount_reason": "Special discount for enterprise client"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "amount": 1000.00,
    "discount_type": "percentage",
    "discount_value": 10,
    "discount_amount": 100.00,
    "total_amount": 900.00
  }
}
```

### 5.3 Partner Management

#### POST `/admin/partners/create`
Create new partner (Superadmin only)

**Request Body:**
```json
{
  "name": "Partner Name",
  "email": "partner@example.com",
  "mobileno": "1234567890",
  "contact_info": "Address",
  "commission_rate": 10.00,
  "commission_type": "percentage",
  "referral_code": "PART123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "user_id": 10,
    "name": "Partner Name",
    "email": "partner@example.com",
    "is_new_user": true,
    "email_sent": true
  },
  "message": "Partner created successfully. Welcome email sent with login credentials."
}
```

**Note:** 
- If user account doesn't exist, it will be auto-created and a welcome email with temporary password will be sent
- If user account already exists, a notification email will be sent informing them they can use their existing login credentials to access the Partner Portal

#### GET `/admin/partners/all`
Get all partners (Superadmin only)

**Query Params:** `?limit=10&offset=0&is_active=true`

#### PUT `/admin/partners/:id/status`
Activate or deactivate partner (Superadmin only)

**Request Body:**
```json
{
  "is_active": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "user_id": 10,
    "name": "Partner Name",
    "email": "partner@example.com",
    "is_active": true
  },
  "message": "Partner activated successfully"
}
```

### 5.4 Employee Management

#### POST `/admin/employees/create`
Create new employee (Superadmin only)

**Request Body:**
```json
{
  "name": "Employee Name",
  "email": "employee@example.com",
  "mobileno": "1234567890",
  "contact_info": "Address",
  "employee_id": "EMP123",
  "department": "Sales"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "user_id": 15,
    "name": "Employee Name",
    "email": "employee@example.com",
    "is_new_user": true,
    "email_sent": true
  },
  "message": "Employee created successfully. Welcome email sent with login credentials."
}
```

**Note:** 
- If user account doesn't exist, it will be auto-created and a welcome email with temporary password will be sent
- If user account already exists, a notification email will be sent informing them they can use their existing login credentials to access the Employee Portal

#### GET `/admin/employees/all`
Get all employees (Superadmin only)

**Query Params:** `?limit=10&offset=0&is_active=true&department=Sales`

#### PUT `/admin/employees/:id/status`
Activate or deactivate employee (Superadmin only)

**Request Body:**
```json
{
  "is_active": false
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "user_id": 15,
    "name": "Employee Name",
    "email": "employee@example.com",
    "is_active": false
  },
  "message": "Employee deactivated successfully"
}
```

### 5.5 Incentive Configuration

#### POST `/admin/incentive-configs/create`
Create incentive configuration (Superadmin only)

**Request Body:**
```json
{
  "employee_id": null,
  "slab_id": null,
  "incentive_type": "subscription",
  "calculation_basis": "percentage",
  "incentive_rate": 5.00,
  "effective_from": "2024-01-01",
  "effective_to": null
}
```

---

## 6. User Type Identification

### 6.1 Get User Type

#### GET `/user-type`
Get logged-in user's type (superadmin, partner, employee, customer)

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user_id": 10,
    "user_type": "customer",
    "user_type_details": {
      "user_id": 10,
      "email": "john@example.com"
    }
  }
}
```

**User Type Values:**
- `"superadmin"` - Admin user
- `"partner"` - Partner user
- `"employee"` - Employee user
- `"customer"` - Regular customer/owner

**Note:** User type is also included in login response. See [USER_TYPE_IDENTIFICATION_API.md](./USER_TYPE_IDENTIFICATION_API.md) for details.

---

## 7. Portal APIs

### 7.1 Partner Portal

#### GET `/partner/dashboard`
Get partner dashboard data (Partner login required)

**Response:**
```json
{
  "success": true,
  "data": {
    "partner_id": 1,
    "partner_name": "Partner Name",
    "total_customers": 10,
    "active_customers": 8,
    "expiring_soon": 2,
    "expired": 0,
    "total_commissions": 5000.00,
    "pending_commissions": 2000.00,
    "paid_commissions": 3000.00
  }
}
```

### 7.2 Employee Portal

#### GET `/employee/dashboard`
Get employee dashboard data (Employee login required)

**Response:**
```json
{
  "success": true,
  "data": {
    "employee_id": 1,
    "employee_name": "Employee Name",
    "total_subscriptions": 15,
    "active_subscriptions": 12,
    "expiring_soon": 2,
    "expired": 1,
    "current_month_subscriptions": 3
  }
}
```

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "success": false,
  "error": {
    "message": "Error message",
    "code": "ERROR_CODE"
  }
}
```

## 10. Company Bank Details Management APIs (Superadmin Only)

### 10.1 Get All Bank Details

#### GET `/admin/bank-details`
Get all company bank details (including inactive)

**Authentication:** Superadmin only

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "company_name": "Company Name",
      "account_holder_name": "Account Holder Name",
      "bank_name": "Bank Name",
      "account_number": "1234567890",
      "ifsc_code": "BANK0001234",
      "branch_name": "Branch Name",
      "upi_id": "company@upi",
      "is_active": true,
      "created_by": 1,
      "updated_by": 1,
      "created_at": "2024-01-01T00:00:00.000Z",
      "updated_at": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### 10.2 Get Bank Details by ID

#### GET `/admin/bank-details/:id`
Get specific bank details by ID

**Authentication:** Superadmin only

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "company_name": "Company Name",
    "account_holder_name": "Account Holder Name",
    "bank_name": "Bank Name",
    "account_number": "1234567890",
    "ifsc_code": "BANK0001234",
    "branch_name": "Branch Name",
    "upi_id": "company@upi",
    "is_active": true,
    "created_by": 1,
    "updated_by": 1,
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-01T00:00:00.000Z"
  }
}
```

### 10.3 Create Bank Details

#### POST `/admin/bank-details`
Create new company bank details (automatically deactivates existing active records)

**Authentication:** Superadmin only

**Request Body:**
```json
{
  "company_name": "Company Name",
  "account_holder_name": "Account Holder Name",
  "bank_name": "Bank Name",
  "account_number": "1234567890",
  "ifsc_code": "BANK0001234",
  "branch_name": "Branch Name",
  "upi_id": "company@upi"
}
```

**Required Fields:**
- `company_name`
- `account_holder_name`
- `bank_name`
- `account_number`
- `ifsc_code`

**Optional Fields:**
- `branch_name`
- `upi_id`

**Note:** QR code can be generated on the frontend using the `upi_id` field.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "company_name": "Company Name",
    "account_holder_name": "Account Holder Name",
    "bank_name": "Bank Name",
    "account_number": "1234567890",
    "ifsc_code": "BANK0001234",
    "branch_name": "Branch Name",
    "upi_id": "company@upi",
    "is_active": true,
    "created_by": 1,
    "updated_by": null,
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-01T00:00:00.000Z"
  }
}
```

### 10.4 Update Bank Details

#### PUT `/admin/bank-details/:id`
Update existing company bank details

**Authentication:** Superadmin only

**Request Body:**
```json
{
  "company_name": "Updated Company Name",
  "account_holder_name": "Updated Account Holder Name",
  "bank_name": "Updated Bank Name",
  "account_number": "9876543210",
  "ifsc_code": "BANK0005678",
  "branch_name": "Updated Branch Name",
  "upi_id": "updated@upi",
  "is_active": true
}
```

**Note:** All fields are optional. Only provided fields will be updated.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "company_name": "Updated Company Name",
    "account_holder_name": "Updated Account Holder Name",
    "bank_name": "Updated Bank Name",
    "account_number": "9876543210",
    "ifsc_code": "BANK0005678",
    "branch_name": "Updated Branch Name",
    "upi_id": "updated@upi",
    "is_active": true,
    "created_by": 1,
    "updated_by": 1,
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-02T00:00:00.000Z"
  }
}
```

---

## 11. Common Error Codes

- `MISSING_BEARER_TOKEN` - Authorization header missing
- `INVALID_TOKEN` - Token is invalid or expired
- `AUTH_FAILED` - Authentication failed
- `FORBIDDEN` - Access denied (superadmin required)
- `NO_SUBSCRIPTION` - User has no subscription
- `SUBSCRIPTION_INVALID` - Subscription status is invalid
- `TRIAL_EXPIRED` - Trial period has expired
- `USER_LIMIT_EXCEEDED` - User limit exceeded
- `USER_COUNT_EXCEEDS_LIMIT` - Cannot downgrade due to user count
- `SLAB_NOT_FOUND` - Slab not found
- `VALIDATION_ERROR` - Request validation failed
- `NOT_FOUND` - Resource not found
- `NOT_PARTNER` - User is not a partner
- `NOT_EMPLOYEE` - User is not an employee

---

## Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (subscription invalid, not partner/employee)
- `404` - Not Found
- `500` - Internal Server Error

---

**Last Updated:** [Current Date]  
**API Version:** 1.0

