# Frontend API & Workflow Documentation

## Overview
This document outlines all subscription-related APIs and workflows that the frontend needs to implement.

---

## Table of Contents
1. [Subscription APIs](#subscription-apis)
2. [Wallet APIs](#wallet-apis)
3. [Workflows](#workflows)
4. [Status Definitions](#status-definitions)
5. [Error Handling](#error-handling)

---

## Subscription APIs

### 1. Get Current Subscription
**Endpoint:** `GET /api/subscriptions/current`  
**Auth:** Required (Bearer Token)

**Response:**
```json
{
  "success": true,
  "data": {
    "subscription": {
      "id": 1,
      "status": "active",
      "internal_slab_id": 4,
      "internal_slab_name": "Premium",
      "internal_min_users": 1,
      "internal_max_users": 10,
      "billing_cycle": "monthly",
      "current_period_start": "2026-01-01",
      "current_period_end": "2026-01-31",
      "purchased_user_count": 3,
      "usage": {
        "internal_users": {
          "current": 2,
          "limit": 3
        },
        "external_users": {
          "current": 5,
          "limit": 15,
          "free_available": 6
        }
      }
    }
  }
}
```

**Notes:**
- Returns `null` if no active subscription exists
- Excludes subscriptions with status: `cancelled`, `expired`, `pending_payment`, `pending_upgrade`, `pending_downgrade`

---

### 2. Get Pending Subscription
**Endpoint:** `GET /api/subscriptions/pending`  
**Auth:** Required (Bearer Token)

**Response:**
```json
{
  "success": true,
  "data": {
    "subscription": {
      "id": 2,
      "status": "pending_upgrade",
      "new_slab": {
        "id": 5,
        "name": "Enterprise",
        "min_users": 5,
        "max_users": 20,
        "free_external_users_per_internal_user": 3
      },
      "previous_slab": {
        "id": 4,
        "name": "Premium",
        "min_users": 1,
        "max_users": 10
      },
      "purchased_user_count": 5,
      "credit_amount": null,
      "created_at": "2026-01-15T10:00:00Z"
    },
    "billing": {
      "id": 10,
      "amount": 5000.00,
      "total_amount": 5900.00,
      "status": "pending_validation",
      "invoice_number": "INV2026000010",
      "payment_method": "bank_transfer",
      "payment_reference": "TXN12345",
      "created_at": "2026-01-15T10:00:00Z"
    }
  }
}
```

**Response when no pending subscription:**
```json
{
  "success": true,
  "data": null,
  "message": "No pending subscription found"
}
```

**Notes:**
- Returns pending subscription for: `pending_payment`, `pending_upgrade`, `pending_downgrade`
- `billing` is only present for `pending_payment` and `pending_upgrade`
- `credit_amount` is only present for `pending_downgrade`

---

### 3. Purchase Subscription
**Endpoint:** `POST /api/subscriptions/purchase`  
**Auth:** Required (Bearer Token)

**Request Body:**
```json
{
  "internal_slab_id": 4,
  "billing_cycle": "monthly",
  "user_count": 3,
  "employee_partner_code": "PARTNER001",
  "payment_method": "bank_transfer",
  "payment_reference": "TXN12345",
  "payment_proof_url": "https://example.com/proof.pdf",
  "payment_date": "2026-01-20"
}
```

**Required Fields:**
- `internal_slab_id` (integer)
- `billing_cycle` (string: "monthly" | "yearly")
- `user_count` (integer) - Number of users to purchase

**Optional Fields:**
- `employee_partner_code` (string)
- `payment_method` (string)
- `payment_reference` (string)
- `payment_proof_url` (string)
- `payment_date` (string: YYYY-MM-DD)

**Response:**
```json
{
  "success": true,
  "data": {
    "subscription": {
      "id": 2,
      "status": "pending_payment",
      "internal_slab_id": 4,
      "user_count": 3
    },
    "billing": {
      "id": 10,
      "total_amount": 5900.00,
      "status": "pending_validation"
    }
  }
}
```

**Workflow:**
1. User selects slab and user count
2. System calculates price: `price_per_user × user_count`
3. User submits payment details
4. Subscription created with `pending_payment` status
5. User sees old subscription until approval
6. After superadmin approval → status becomes `active`

---

### 4. Upgrade Subscription
**Endpoint:** `POST /api/subscriptions/upgrade`  
**Auth:** Required (Bearer Token)

**Request Body:**
```json
{
  "new_slab_id": 5,
  "user_count": 5,
  "payment_method": "bank_transfer",
  "payment_reference": "TXN12346",
  "payment_proof_url": "https://example.com/proof.pdf",
  "payment_date": "2026-01-20"
}
```

**Required Fields:**
- `new_slab_id` (integer)

**Optional Fields:**
- `user_count` (integer) - Total users (current + additional). If not provided, uses current user count
- `payment_method` (string)
- `payment_reference` (string)
- `payment_proof_url` (string)
- `payment_date` (string: YYYY-MM-DD)

**Response:**
```json
{
  "success": true,
  "data": {
    "subscription": {
      "id": 1,
      "status": "pending_upgrade",
      "internal_slab_id": 5
    },
    "billing": {
      "id": 11,
      "total_amount": 2500.00,
      "status": "pending_validation"
    },
    "proRatedAmount": 2000.00,
    "totalAmount": 2360.00,
    "user_count": 5,
    "current_user_count": 2,
    "additional_users": 3
  }
}
```

**Workflow:**
1. User selects new slab and optionally additional users
2. System calculates pro-rated upgrade price
3. User submits payment details
4. Subscription updated with `pending_upgrade` status
5. Previous state stored for rollback
6. User sees old subscription until approval
7. After superadmin approval → status becomes `active`, new slab activated

---

### 5. Downgrade Subscription
**Endpoint:** `POST /api/subscriptions/downgrade`  
**Auth:** Required (Bearer Token)

**Request Body:**
```json
{
  "new_slab_id": 3
}
```

**Required Fields:**
- `new_slab_id` (integer)

**Response:**
```json
{
  "success": true,
  "data": {
    "subscription": {
      "id": 1,
      "status": "pending_downgrade",
      "internal_slab_id": 3
    },
    "creditAmount": 1500.00,
    "status": "pending_downgrade",
    "message": "Downgrade request submitted. Credit will be added to wallet upon approval."
  }
}
```

**Workflow:**
1. User selects lower slab
2. System validates: current users ≤ new slab max users
3. System calculates credit amount (pro-rated)
4. Subscription updated with `pending_downgrade` status
5. Previous state stored for rollback
6. User sees old subscription until approval
7. After superadmin approval → status becomes `active`, credit added to wallet

**Validation:**
- Cannot downgrade if current user count > new slab max users
- Returns error: `Cannot downgrade: Current user count (X) exceeds new slab limit (Y)`

---

### 6. Get Subscription History
**Endpoint:** `GET /api/subscriptions/history`  
**Auth:** Required (Bearer Token)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "subscription_id": 1,
      "from_slab_id": 4,
      "to_slab_id": 5,
      "change_type": "upgrade",
      "amount_charged": 2360.00,
      "pro_rated_amount": 2000.00,
      "credit_amount": null,
      "notes": "Subscription upgrade - 5 users",
      "created_at": "2026-01-15T10:00:00Z"
    }
  ]
}
```

---

## Wallet APIs

### 7. Get Wallet Balance
**Endpoint:** `GET /api/subscriptions/wallet/balance`  
**Auth:** Required (Bearer Token)

**Response:**
```json
{
  "success": true,
  "data": {
    "balance": 1500.00,
    "updated_at": "2026-01-20T10:00:00Z"
  }
}
```

---

### 8. Get Wallet Transactions
**Endpoint:** `GET /api/subscriptions/wallet/transactions`  
**Auth:** Required (Bearer Token)

**Query Parameters:**
- `transaction_type` (optional): "credit" | "debit" | "refund"
- `reference_type` (optional): "downgrade" | "refund" | "manual" | "billing"
- `limit` (optional, default: 50): Number of records
- `offset` (optional, default: 0): Pagination offset

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "wallet_id": 1,
      "transaction_type": "credit",
      "amount": 1500.00,
      "description": "Credit from downgrade to slab 3",
      "reference_type": "downgrade",
      "reference_id": 1,
      "created_at": "2026-01-20T10:00:00Z"
    }
  ]
}
```

---

## Workflows

### Purchase Workflow

```
┌─────────────────┐
│ User Selects    │
│ Slab & Users    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Calculate Price │
│ (price × users) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Submit Payment  │
│ Details         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────────┐
│ Status:         │      │ User sees OLD    │
│ pending_payment │◄─────┤ subscription     │
└────────┬────────┘      └──────────────────┘
         │
         ▼
┌─────────────────┐
│ Superadmin      │
│ Reviews &       │
│ Approves        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────────┐
│ Status: active  │──────►│ User sees NEW    │
│                 │      │ subscription     │
└─────────────────┘      └──────────────────┘
```

### Upgrade Workflow

```
┌─────────────────┐
│ User Selects    │
│ New Slab &      │
│ Additional Users│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Calculate Pro-  │
│ rated Price     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Submit Payment  │
│ Details         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────────┐
│ Status:         │      │ User sees OLD    │
│ pending_upgrade │◄─────┤ subscription     │
│ (prev state     │      │ (old slab)       │
│  stored)        │      └──────────────────┘
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Superadmin      │
│ Reviews &       │
│ Approves        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────────┐
│ Status: active  │──────►│ User sees NEW    │
│ New slab active │      │ subscription     │
│                 │      │ (new slab)      │
└─────────────────┘      └──────────────────┘
```

### Downgrade Workflow

```
┌─────────────────┐
│ User Selects    │
│ Lower Slab      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Validate:       │
│ users ≤ max?    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Calculate       │
│ Credit Amount   │
│ (pro-rated)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────────┐
│ Status:         │      │ User sees OLD    │
│ pending_downgrade│◄─────┤ subscription     │
│ (prev state     │      │ (old slab)       │
│  stored)        │      └──────────────────┘
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Superadmin      │
│ Reviews &       │
│ Approves        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────────┐
│ Status: active  │──────►│ User sees NEW    │
│ New slab active │      │ subscription     │
│ Credit added    │      │ (new slab)       │
│ to wallet       │      │ Wallet updated   │
└─────────────────┘      └──────────────────┘
```

---

## Status Definitions

### Subscription Statuses

| Status | Description | User Sees |
|--------|-------------|-----------|
| `active` | Active subscription | Current subscription |
| `trial` | Trial period | Current subscription |
| `pending_payment` | New purchase awaiting approval | **OLD subscription** (if exists) |
| `pending_upgrade` | Upgrade awaiting approval | **OLD subscription** |
| `pending_downgrade` | Downgrade awaiting approval | **OLD subscription** |
| `cancelled` | Cancelled subscription | Not shown |
| `expired` | Expired subscription | Not shown |
| `trial_expired` | Trial period expired | Not shown |

### Billing Statuses

| Status | Description |
|--------|-------------|
| `pending_validation` | Awaiting superadmin approval |
| `paid` | Payment validated and approved |
| `failed` | Payment rejected |

### Wallet Transaction Types

| Type | Description |
|------|-------------|
| `credit` | Money added to wallet (e.g., from downgrade) |
| `debit` | Money deducted from wallet |
| `refund` | Refund transaction |

---

## Error Handling

### Common Error Responses

**401 Unauthorized:**
```json
{
  "success": false,
  "error": {
    "message": "Bearer token is required",
    "code": "MISSING_BEARER_TOKEN"
  }
}
```

**400 Bad Request:**
```json
{
  "success": false,
  "error": {
    "message": "Missing required field: new_slab_id",
    "code": "VALIDATION_ERROR"
  }
}
```

**404 Not Found:**
```json
{
  "success": false,
  "error": {
    "message": "No subscription found",
    "code": "NO_SUBSCRIPTION"
  }
}
```

**400 Validation Error (Downgrade):**
```json
{
  "success": false,
  "error": {
    "message": "Cannot downgrade: Current user count (5) exceeds new slab limit (3)",
    "code": "VALIDATION_ERROR"
  }
}
```

---

## Frontend Implementation Checklist

### Purchase Flow
- [ ] Display available slabs with pricing
- [ ] Allow user to select user count (min to max)
- [ ] Calculate and display total price
- [ ] Collect payment details
- [ ] Submit purchase request
- [ ] Show pending status message
- [ ] Continue showing old subscription until approval
- [ ] Poll or refresh to check approval status

### Upgrade Flow
- [ ] Display current subscription details
- [ ] Show available higher slabs
- [ ] Allow user to select additional users (optional)
- [ ] Calculate and display pro-rated upgrade price
- [ ] Collect payment details
- [ ] Submit upgrade request
- [ ] Show pending status message
- [ ] Continue showing old subscription until approval
- [ ] Poll or refresh to check approval status

### Downgrade Flow
- [ ] Display current subscription details
- [ ] Show available lower slabs
- [ ] Validate user count before allowing downgrade
- [ ] Calculate and display credit amount
- [ ] Submit downgrade request (no payment needed)
- [ ] Show pending status message
- [ ] Continue showing old subscription until approval
- [ ] Poll or refresh to check approval status
- [ ] Update wallet balance after approval

### Wallet Integration
- [ ] Display wallet balance in user dashboard
- [ ] Show wallet transaction history
- [ ] Update balance after downgrade approval
- [ ] Filter transactions by type/reference

### Status Management
- [ ] Check for pending subscription on page load
- [ ] Show appropriate UI for pending states
- [ ] Display approval status messages
- [ ] Handle status transitions gracefully

---

## API Base URL
All APIs are prefixed with: `/api/subscriptions`

**Example:**
- Full URL: `GET /api/subscriptions/current`
- Full URL: `POST /api/subscriptions/purchase`

---

## Notes for Frontend Team

1. **Pending Subscriptions:** Always check for pending subscriptions separately. Users should see their active subscription until approval.

2. **User Count:** 
   - For purchase: `user_count` is the total number of users to purchase
   - For upgrade: `user_count` is the total (current + additional). If not provided, uses current count.

3. **Price Calculation:**
   - Purchase: `price_per_user × user_count`
   - Upgrade: Pro-rated based on remaining period
   - Downgrade: Pro-rated credit calculated automatically

4. **Wallet Credits:**
   - Credits are added automatically on downgrade approval
   - No manual action needed from user
   - Credits can be used for future purchases (if implemented)

5. **Error Handling:**
   - Always check `success` field in response
   - Display user-friendly error messages
   - Handle network errors gracefully

6. **Polling/Refresh:**
   - Consider polling `/api/subscriptions/pending` to check approval status
   - Or refresh subscription data after user actions
   - Update UI when status changes from pending to active

