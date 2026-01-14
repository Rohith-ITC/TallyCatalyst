# Frontend UI Guide - Subscription Slabs System

Complete guide for frontend developers to build UI for the subscription slabs system.

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [UI Screens & Components](#ui-screens--components)
4. [API Integration Examples](#api-integration-examples)
5. [State Management](#state-management)
6. [Error Handling](#error-handling)
7. [UI/UX Guidelines](#uiux-guidelines)

---

## Overview

The subscription system supports:
- **Slab-based pricing** (1 user, 2-5 users, 6-10 users, etc.)
- **Monthly and yearly billing**
- **15-day trial** for new owners
- **Pro-rated upgrades/downgrades**
- **Manual payment validation**
- **Partner/employee tracking**

---

## Authentication

All API calls require Bearer token:

```javascript
const token = localStorage.getItem('authToken');
const headers = {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
};
```

---

## UI Screens & Components

### 1. Subscription Plans Page

**Route:** `/subscriptions/plans`

**Purpose:** Display available subscription slabs for users to choose from

**API:** `GET /api/subscriptions/slabs/internal`

**UI Components:**
- Plan cards showing:
  - Plan name (e.g., "1 User Plan")
  - User range (e.g., "1 user")
  - Monthly price
  - Yearly price (with savings)
  - Free external users included
  - "Select Plan" button
- Toggle for Monthly/Yearly billing
- Current plan highlight (if user has subscription)

**Example:**
```jsx
// Fetch plans
const [plans, setPlans] = useState([]);
const [billingCycle, setBillingCycle] = useState('monthly');

useEffect(() => {
  fetch('/api/subscriptions/slabs/internal', {
    headers: { 'Authorization': `Bearer ${token}` }
  })
    .then(res => res.json())
    .then(data => setPlans(data.data));
}, []);

// Display plans
{plans.map(plan => (
  <PlanCard
    key={plan.id}
    plan={plan}
    billingCycle={billingCycle}
    onSelect={() => handlePurchase(plan.id)}
  />
))}
```

---

### 2. Current Subscription Dashboard

**Route:** `/subscriptions/current`

**Purpose:** Show user's current subscription status, usage, and limits

**API:** `GET /api/subscriptions/current`

**UI Components:**
- **Subscription Status Card:**
  - Status badge (Active, Trial, Expired, etc.)
  - Plan name
  - Billing cycle
  - Start/End dates
  - Days remaining (if trial)
  - Renewal date
- **Usage Statistics:**
  - Internal users: Current/Limit/Remaining
  - External users: Current/Free used/Free available/Paid
  - Progress bars for visual representation
- **Actions:**
  - "Upgrade Plan" button
  - "Downgrade Plan" button (if applicable)
  - "View Billing History" link

**Example:**
```jsx
const [subscription, setSubscription] = useState(null);

useEffect(() => {
  fetch('/api/subscriptions/current', {
    headers: { 'Authorization': `Bearer ${token}` }
  })
    .then(res => res.json())
    .then(data => setSubscription(data.data));
}, []);

// Display subscription info
{subscription && (
  <div>
    <StatusBadge status={subscription.status} />
    <UsageStats usage={subscription.usage} />
    <ActionButtons subscription={subscription} />
  </div>
)}
```

---

### 3. Purchase Subscription Page

**Route:** `/subscriptions/purchase`

**Purpose:** Complete subscription purchase with payment details

**API:** `POST /api/subscriptions/purchase`

**UI Components:**
- Selected plan summary
- Billing cycle selector (Monthly/Yearly)
- Payment method selector:
  - Bank Transfer
  - Cheque
  - Cash
  - Online
- Payment details form:
  - Payment reference (transaction ID, cheque number)
  - Payment date (date picker)
  - Payment proof upload (file upload)
- Optional fields:
  - Partner referral code
  - Employee ID
- "Submit Payment" button

**Form Validation:**
- All required fields must be filled
- Payment proof upload (optional but recommended)
- Date validation

**Example:**
```jsx
const handlePurchase = async (formData) => {
  const response = await fetch('/api/subscriptions/purchase', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      internal_slab_id: selectedPlanId,
      billing_cycle: billingCycle,
      payment_method: formData.payment_method,
      payment_reference: formData.payment_reference,
      payment_proof_url: uploadedProofUrl,
      payment_date: formData.payment_date
    })
  });
  
  const result = await response.json();
  if (result.success) {
    // Show success message
    // Redirect to subscription dashboard
  }
};
```

---

### 4. Upgrade/Downgrade Page

**Route:** `/subscriptions/upgrade` or `/subscriptions/downgrade`

**Purpose:** Change subscription plan mid-cycle

**APIs:**
- `POST /api/subscriptions/billing/calculate-upgrade` (preview)
- `POST /api/subscriptions/upgrade`
- `POST /api/subscriptions/downgrade`

**UI Components:**
- Current plan display
- Available plans list (filtered for upgrade/downgrade)
- Pro-rated amount calculator (preview)
- Payment details form (for upgrade)
- "Confirm Change" button

**Upgrade Flow:**
1. User selects new plan
2. Call `/billing/calculate-upgrade` to show preview
3. User enters payment details
4. Submit upgrade request
5. Show pending validation message

**Downgrade Flow:**
1. User selects lower plan
2. Validate user count (check if exceeds new limit)
3. If exceeds: Show error with user list, require removal
4. If valid: Show credit amount preview
5. Confirm downgrade

**Example (Upgrade):**
```jsx
const handleUpgrade = async (newSlabId) => {
  // Preview calculation
  const preview = await fetch('/api/subscriptions/billing/calculate-upgrade', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ new_slab_id: newSlabId })
  });
  
  const previewData = await preview.json();
  setProRatedAmount(previewData.data.total_amount);
  
  // Show payment form
  // On submit, call /api/subscriptions/upgrade
};
```

**Example (Downgrade Error):**
```jsx
const handleDowngrade = async (newSlabId) => {
  try {
    const response = await fetch('/api/subscriptions/downgrade', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ new_slab_id: newSlabId })
    });
    
    const result = await response.json();
    
    if (!result.success && result.error.code === 'USER_COUNT_EXCEEDS_LIMIT') {
      // Show error modal with user list
      setError({
        message: result.error.message,
        excessUsers: result.error.excess_users,
        userList: getCurrentUsers() // Fetch from user management API
      });
    }
  } catch (error) {
    // Handle error
  }
};
```

---

### 5. Billing History Page

**Route:** `/subscriptions/billing`

**Purpose:** Display all billing records and invoices

**API:** `GET /api/subscriptions/billing/history`

**UI Components:**
- Billing records table:
  - Invoice number
  - Date
  - Amount
  - Discount (if any)
  - Tax
  - Total
  - Status badge
  - Actions (View invoice, Download)
- Filters:
  - Status filter (All, Paid, Pending, Failed)
  - Date range picker
- Pagination

**Example:**
```jsx
const [billingHistory, setBillingHistory] = useState([]);
const [filters, setFilters] = useState({ status: '', limit: 50, offset: 0 });

useEffect(() => {
  const queryParams = new URLSearchParams(filters);
  fetch(`/api/subscriptions/billing/history?${queryParams}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
    .then(res => res.json())
    .then(data => setBillingHistory(data.data));
}, [filters]);
```

---

### 6. Usage Dashboard

**Route:** `/subscriptions/usage`

**Purpose:** Show current usage and limits

**API:** `GET /api/subscriptions/usage/current`

**UI Components:**
- **Internal Users Section:**
  - Current count / Limit
  - Progress bar
  - "Add User" button (disabled if limit reached)
- **External Users Section:**
  - Current count
  - Free users used / Free users available
  - Paid users count
  - Progress bars
- **Warning Messages:**
  - If approaching limit (80%+)
  - If limit reached

**Example:**
```jsx
const [usage, setUsage] = useState(null);

useEffect(() => {
  fetch('/api/subscriptions/usage/current', {
    headers: { 'Authorization': `Bearer ${token}` }
  })
    .then(res => res.json())
    .then(data => setUsage(data.data));
}, []);

// Display usage
{usage && (
  <div>
    <UsageCard
      title="Internal Users"
      current={usage.internal_users.current}
      limit={usage.internal_users.limit}
      remaining={usage.internal_users.remaining}
    />
    <UsageCard
      title="External Users"
      current={usage.external_users.current}
      freeUsed={usage.external_users.free_used}
      freeAvailable={usage.external_users.free_available}
      paidCount={usage.external_users.paid_count}
    />
  </div>
)}
```

---

### 7. Admin: Payment Validation Page

**Route:** `/admin/payments/pending` (Superadmin only)

**Purpose:** Review and validate pending payments

**API:** `GET /api/subscriptions/admin/payments/pending`

**UI Components:**
- Pending payments list:
  - Owner name/email
  - Invoice number
  - Amount
  - Payment method
  - Payment reference
  - Payment proof (view/download)
  - Payment date
  - Actions: Approve / Reject
- Filters:
  - Date range
  - Validated by
- Validation form (modal):
  - Validation notes (textarea)
  - Approve / Reject buttons

**Example:**
```jsx
const handleValidatePayment = async (billingId, action, notes) => {
  const response = await fetch(`/api/subscriptions/admin/payments/validate/${billingId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      action: action, // 'approve' or 'reject'
      validation_notes: notes
    })
  });
  
  const result = await response.json();
  if (result.success) {
    // Refresh pending payments list
    // Show success message
  }
};
```

---

### 8. Admin: Discount Management

**Route:** `/admin/discounts` (Superadmin only)

**Purpose:** Apply discounts to specific billing records

**API:** `POST /api/subscriptions/admin/discounts/billing/:billingId/apply`

**UI Components:**
- Billing record selector
- Discount type selector (Percentage / Fixed)
- Discount value input
- Discount reason (textarea)
- "Apply Discount" button
- Discount history table

---

### 9. Partner Portal Dashboard

**Route:** `/partner/dashboard` (Partner login)

**Purpose:** Partner view of their referrals and commissions

**API:** `GET /api/subscriptions/partner/dashboard`

**UI Components:**
- Statistics cards:
  - Total customers
  - Active customers
  - Expiring soon
  - Expired
- Commission summary:
  - Total commissions
  - Pending commissions
  - Paid commissions
- Customer subscriptions list
- Commission history table

---

### 10. Employee Portal Dashboard

**Route:** `/employee/dashboard` (Employee login)

**Purpose:** Employee view of their subscriptions and performance

**API:** `GET /api/subscriptions/employee/dashboard`

**UI Components:**
- Statistics cards:
  - Total subscriptions
  - Active subscriptions
  - Expiring soon
  - Current month subscriptions
- Performance metrics
- Subscription list
- Incentive summary

---

## API Integration Examples

### Fetch Current Subscription

```javascript
async function getCurrentSubscription() {
  const token = localStorage.getItem('authToken');
  const response = await fetch('/api/subscriptions/current', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch subscription');
  }
  
  const result = await response.json();
  return result.data;
}
```

### Validate User Addition

```javascript
async function validateUserAddition(userType) {
  const token = localStorage.getItem('authToken');
  const response = await fetch('/api/subscriptions/usage/validate', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      user_type: userType, // 'internal' or 'external'
      count: 1
    })
  });
  
  const result = await response.json();
  
  if (!result.data.allowed) {
    // Show error message
    // If requires_upgrade, show upgrade prompt
    return false;
  }
  
  return true;
}
```

---

## State Management

### Recommended State Structure

```javascript
// Redux/Context state
{
  subscription: {
    current: null,
    loading: false,
    error: null
  },
  usage: {
    current: null,
    loading: false
  },
  billing: {
    history: [],
    loading: false
  },
  plans: {
    internal: [],
    external: [],
    loading: false
  }
}
```

---

## Error Handling

### Common Error Scenarios

1. **No Subscription:**
   - Show "No active subscription" message
   - Display "Purchase Plan" button

2. **Trial Expired:**
   - Show "Trial expired" message
   - Display "Purchase Plan" button
   - Disable user creation

3. **User Limit Exceeded:**
   - Show error message with current/limit
   - Display "Upgrade Plan" button
   - Disable "Add User" button

4. **Downgrade Blocked:**
   - Show error with user list
   - Display "Remove Users" button
   - Link to user management page

5. **Payment Pending Validation:**
   - Show "Payment pending validation" message
   - Display payment details
   - Show "Contact Support" link

---

## UI/UX Guidelines

### Status Badges

- **Active:** Green badge
- **Trial:** Blue badge (with days remaining)
- **Pending Payment:** Yellow badge
- **Expired:** Red badge
- **Trial Expired:** Red badge

### Progress Bars

- Use for usage visualization
- Color coding:
  - Green: < 80% used
  - Yellow: 80-95% used
  - Red: > 95% used

### Notifications

- Show success messages for:
  - Subscription purchased
  - Payment validated
  - Plan upgraded/downgraded
- Show warning messages for:
  - Trial expiring soon (7 days, 3 days, 1 day)
  - Usage approaching limit
- Show error messages for:
  - Payment validation failed
  - User limit exceeded
  - Downgrade blocked

### Loading States

- Show loading spinners during API calls
- Disable buttons while processing
- Show skeleton loaders for data tables

### Responsive Design

- Mobile-friendly layouts
- Touch-friendly buttons
- Collapsible sections on mobile

---

## Testing Checklist

- [ ] Display subscription plans correctly
- [ ] Purchase subscription flow works
- [ ] Upgrade/downgrade calculations correct
- [ ] Usage limits enforced
- [ ] Error messages display correctly
- [ ] Payment validation flow works
- [ ] Trial expiration handled
- [ ] Responsive design works
- [ ] Loading states work
- [ ] Error handling works

---

**Last Updated:** [Current Date]  
**Frontend Framework:** React (recommended)

