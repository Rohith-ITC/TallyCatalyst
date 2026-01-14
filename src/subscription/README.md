# Subscription Module

Complete subscription management module for admin users, super admin, employees, and partners.

## Folder Structure

```
subscription/
├── api/
│   └── subscriptionApi.js          # Centralized API service layer
├── components/
│   ├── StatusBadge.js              # Status badge component
│   ├── StatusBadge.css
│   ├── UsageCard.js                # Usage statistics card
│   ├── UsageCard.css
│   ├── PlanCard.js                 # Subscription plan card
│   └── PlanCard.css
├── user/
│   ├── SubscriptionPlansPage.js    # Display available plans
│   ├── SubscriptionPlansPage.css
│   ├── CurrentSubscriptionPage.js  # Current subscription dashboard
│   ├── CurrentSubscriptionPage.css
│   ├── PurchaseSubscriptionPage.js  # Purchase subscription form
│   ├── PurchaseSubscriptionPage.css
│   ├── UpgradeDowngradePage.js     # Upgrade/downgrade subscription
│   ├── UpgradeDowngradePage.css
│   ├── BillingHistoryPage.js       # Billing history and invoices
│   ├── BillingHistoryPage.css
│   ├── UsageDashboardPage.js       # Usage statistics dashboard
│   └── UsageDashboardPage.css
├── admin/
│   ├── PaymentValidationPage.js     # Validate pending payments
│   ├── PaymentValidationPage.css
│   ├── DiscountManagementPage.js   # Apply discounts
│   ├── DiscountManagementPage.css
│   └── SlabManagementPage.js      # Manage subscription slabs
│   └── SlabManagementPage.css
├── employee/
│   ├── EmployeeDashboardPage.js    # Employee portal dashboard
│   └── EmployeeDashboardPage.css
├── partner/
│   ├── PartnerDashboardPage.js     # Partner portal dashboard
│   └── PartnerDashboardPage.css
├── index.js                        # Main export file
└── README.md                       # This file
```

## Usage

### Import Components

```javascript
import {
  SubscriptionPlansPage,
  CurrentSubscriptionPage,
  PaymentValidationPage,
  // ... other components
} from './subscription';
```

### User Pages

1. **SubscriptionPlansPage** - Display and select subscription plans
2. **CurrentSubscriptionPage** - View current subscription status and usage
3. **PurchaseSubscriptionPage** - Complete subscription purchase
4. **UpgradeDowngradePage** - Upgrade or downgrade subscription
5. **BillingHistoryPage** - View billing records and invoices
6. **UsageDashboardPage** - Monitor usage and limits

### Admin Pages

1. **PaymentValidationPage** - Review and validate pending payments (Superadmin)
2. **DiscountManagementPage** - Apply discounts to billing records (Superadmin)
3. **SlabManagementPage** - Manage internal slabs (Superadmin)

### Portal Pages

1. **EmployeeDashboardPage** - Employee view of subscriptions and performance
2. **PartnerDashboardPage** - Partner view of referrals and commissions

## API Integration

All API calls are centralized in `api/subscriptionApi.js` and use the existing `apiUtils` from the project.

## Features

- ✅ Slab-based pricing system
- ✅ Monthly and yearly billing
- ✅ Trial management
- ✅ Pro-rated upgrades/downgrades
- ✅ Payment validation workflow
- ✅ Usage tracking and limits
- ✅ Billing history
- ✅ Discount management
- ✅ Partner and employee tracking
- ✅ Responsive design

## Notes

- All pages follow the existing project patterns
- Uses Bearer token authentication from sessionStorage
- Error handling and loading states included
- CSS modules for styling
- Follows the API endpoints from the documentation

