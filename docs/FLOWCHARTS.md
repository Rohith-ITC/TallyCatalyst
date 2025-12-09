# System Flowcharts - Visual Process Flows
## Quick Reference for Management Presentation

---

## 1. Overall System Flow

```
                    ┌─────────────────────┐
                    │   USER LOGIN         │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │  AUTHENTICATION      │
                    └──────────┬──────────┘
                               │
                ┌──────────────┼──────────────┐
                │              │              │
        ┌───────▼──────┐  ┌───▼──────┐  ┌───▼──────────┐
        │   SUPER      │  │ PARTNER  │  │  CUSTOMER   │
        │   ADMIN      │  │ PORTAL   │  │  PORTAL     │
        └──────────────┘  └──────────┘  └─────────────┘
```

---

## 2. Customer Onboarding Flow

```
START
  │
  ├─► Customer Visits Website
  │
  ├─► [Sign Up / Login]
  │
  ├─► Select Subscription Plan
  │   ├─► Starter
  │   ├─► Professional
  │   └─► Enterprise
  │
  ├─► Configure Users
  │   ├─► Full Access User (1 included)
  │   ├─► Internal Users (count × cost)
  │   └─► External Users (10 free + paid)
  │
  ├─► Select Features
  │   ├─► Base Modules
  │   ├─► Premium Modules
  │   └─► Custom Solutions
  │
  ├─► Calculate Total Cost
  │   └─► Base + Users + Features
  │
  ├─► Payment Processing
  │   └─► Payment Gateway
  │
  ├─► Account Activation
  │   ├─► Create Subscription
  │   ├─► Assign Modules
  │   ├─► Create Users
  │   └─► Enable Features
  │
  ├─► [If via Partner]
  │   └─► Calculate Partner Commission
  │
  └─► END (Active Account)
```

---

## 3. Subscription Renewal Flow

```
[30 Days Before Renewal]
  │
  ├─► Send Renewal Reminder Email
  │
  ├─► Customer Reviews:
  │   ├─► Current Usage
  │   ├─► User Count
  │   └─► Feature Needs
  │
  ├─► [Customer Updates Subscription?]
  │   │
  │   ├─► YES ──► Update Plan
  │   │   ├─► Recalculate Cost
  │   │   ├─► Prorate Charges
  │   │   └─► Update Access
  │   │
  │   └─► NO ──► Continue with Current Plan
  │
  ├─► [Renewal Date]
  │
  ├─► Process Payment
  │   ├─► Success ──► Extend Subscription
  │   └─► Failure ──► Retry + Notify
  │
  ├─► [If via Partner]
  │   └─► Calculate Recurring Commission
  │
  └─► END (Renewed Subscription)
```

---

## 4. Partner Commission Flow

```
[Customer Enrolls via Partner]
  │
  ├─► Link Customer to Partner
  │   └─► Store partner_id in customer record
  │
  ├─► [Customer Makes First Payment]
  │
  ├─► Calculate Initial Commission
  │   └─► First Payment × Commission Rate
  │
  ├─► Record Commission
  │   ├─► Type: Initial Sale
  │   ├─► Status: Pending
  │   └─► Amount: Calculated
  │
  ├─► [Payment Clears]
  │
  ├─► Update Commission Status
  │   └─► Status: Paid
  │
  ├─► Add to Partner Earnings
  │
  └─► [Annual Renewal]
      │
      ├─► Calculate Recurring Commission
      │   └─► Annual Subscription × Commission Rate
      │
      ├─► Record Commission
      │   ├─► Type: Recurring
      │   └─► Status: Paid
      │
      └─► Update Partner Earnings
```

---

## 5. Module Access Control Flow

```
[User Logs In]
  │
  ├─► Get User Information
  │   ├─► User Type
  │   ├─► Subscription Plan
  │   └─► Customer ID
  │
  ├─► Fetch All Modules from Database
  │
  ├─► Filter Modules by Type:
  │   │
  │   ├─► UNIVERSAL MODULES
  │   │   └─► Always Show (No Check)
  │   │
  │   ├─► SUBSCRIPTION MODULES
  │   │   └─► Check: Is module in user's plan?
  │   │       ├─► YES ──► Show Module
  │   │       └─► NO ──► Show "Upgrade" Prompt
  │   │
  │   └─► CUSTOM MODULES
  │       └─► Check: Is module assigned to customer?
  │           ├─► YES ──► Show Module
  │           └─► NO ──► Hide Module
  │
  ├─► Apply User Type Restrictions
  │   ├─► External Users: Limited Features
  │   └─► Internal/Full Access: Full Features
  │
  ├─► Apply Role-Based Permissions
  │   └─► Check user's role permissions
  │
  └─► Display Filtered Module List
```

---

## 6. User Type Access Matrix

```
┌─────────────────────────────────────────────────────────┐
│                    USER ACCESS MATRIX                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ FULL ACCESS USER:                                       │
│ ├─ All Modules (subscription-based)                    │
│ ├─ User Management                                      │
│ ├─ Subscription Management                              │
│ ├─ Billing Management                                   │
│ └─ System Configuration                                 │
│                                                         │
│ INTERNAL USER:                                          │
│ ├─ All Modules (subscription-based)                     │
│ ├─ Role-Based Permissions                               │
│ ├─ Reports & Analytics                                  │
│ └─ Limited Admin Functions                              │
│                                                         │
│ EXTERNAL USER (Free Tier):                              │
│ ├─ Ledger Statement (View Only)                        │
│ ├─ Bill Wise Report (View Only)                        │
│ └─ Basic Reports                                        │
│                                                         │
│ EXTERNAL USER (Premium):                                │
│ ├─ All Free Tier Features                               │
│ ├─ Advanced Reports                                     │
│ ├─ Export Capabilities                                  │
│ └─ Custom Dashboards (if available)                     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 7. Billing Calculation Flow

```
[Monthly Billing Cycle]
  │
  ├─► Get Subscription Details
  │   ├─► Base Plan Cost
  │   ├─► Current User Counts
  │   └─► Active Features
  │
  ├─► Calculate Base Cost
  │   └─► Plan Base Price
  │
  ├─► Calculate User Costs
  │   ├─► Internal Users: Count × Internal User Cost
  │   └─► External Users: (Count - 10) × External User Cost
  │       └─► (First 10 are free)
  │
  ├─► Calculate Feature Costs
  │   └─► Premium Features × Feature Price
  │
  ├─► Calculate Custom Module Costs
  │   └─► Custom Modules × Module Price
  │
  ├─► Calculate Usage-Based Charges
  │   └─► API Calls, Storage, etc.
  │
  ├─► Apply Discounts (if any)
  │
  ├─► Calculate Total
  │   └─► Base + Users + Features + Custom + Usage - Discounts
  │
  ├─► Generate Invoice
  │
  ├─► Process Payment
  │   ├─► Success ──► Update Subscription
  │   └─► Failure ──► Retry + Notify
  │
  └─► END
```

---

## 8. Partner Portal Dashboard Flow

```
[Partner Logs In]
  │
  ├─► Load Partner Dashboard
  │
  ├─► Fetch Partner Metrics
  │   ├─► Total Customers Enrolled
  │   ├─► Active Customers
  │   ├─► Total Earnings (Lifetime)
  │   ├─► Current Year Earnings
  │   └─► Pending Payouts
  │
  ├─► Fetch Customer List
  │   ├─► Customer Name
  │   ├─► Enrollment Date
  │   ├─► Subscription Status
  │   ├─► Commission Earned
  │   └─► Next Renewal Date
  │
  ├─► Fetch Commission Breakdown
  │   ├─► Initial Sales Commission
  │   ├─► Recurring Commission
  │   └─► Performance Bonus
  │
  ├─► Fetch Upcoming Renewals
  │   └─► Next 30 Days
  │
  ├─► Calculate Forecast
  │   └─► Expected Earnings (Next Quarter)
  │
  └─► Display Dashboard
```

---

## 9. Module Management Flow (Super Admin)

```
[Super Admin → Module Management]
  │
  ├─► View All Modules
  │
  ├─► [Create New Module]
  │   ├─► Enter Module Details
  │   │   ├─► Name, Display Name
  │   │   ├─► Description
  │   │   ├─► Route Path
  │   │   └─► Module Type
  │   │
  │   ├─► Assign Module Type
  │   │   ├─► Universal
  │   │   ├─► Subscription-Based
  │   │   └─► Custom Solution
  │   │
  │   ├─► [If Subscription-Based]
  │   │   └─► Assign to Subscription Plans
  │   │
  │   └─► Save Module
  │
  ├─► [Edit Module]
  │   └─► Update Details
  │
  ├─► [Assign Custom Module to Customer]
  │   ├─► Select Customer
  │   ├─► Select Module
  │   └─► Save Assignment
  │
  └─► END
```

---

## 10. Subscription Plan Creation Flow

```
[Super Admin → Create Plan]
  │
  ├─► Enter Plan Details
  │   ├─► Plan Name
  │   ├─► Description
  │   └─► Plan Tier
  │
  ├─► Configure Pricing
  │   ├─► Base Cost
  │   ├─► Internal User Cost
  │   ├─► External User Cost
  │   └─► Free External Users Count
  │
  ├─► Select Modules
  │   ├─► Universal Modules (Auto-included)
  │   ├─► Subscription Modules (Select)
  │   └─► Custom Modules (N/A for plans)
  │
  ├─► Configure Features
  │   ├─► Free Features for External Users
  │   ├─► Premium Features
  │   └─► Add-on Options
  │
  ├─► Set Limits
  │   ├─► API Call Limits
  │   ├─► Storage Limits
  │   └─► User Limits (if applicable)
  │
  ├─► Set Trial Period (Optional)
  │
  ├─► Save Plan
  │
  └─► END (Plan Available for Selection)
```

---

## 11. Commission Payout Flow

```
[Payout Schedule Trigger]
  │
  ├─► Get All Partners
  │
  ├─► For Each Partner:
  │   │
  │   ├─► Calculate Total Pending Commissions
  │   │
  │   ├─► Check Minimum Threshold
  │   │   ├─► Below Threshold ──► Skip
  │   │   └─► Above Threshold ──► Continue
  │   │
  │   ├─► Generate Payout Batch
  │   │   ├─► Partner ID
  │   │   ├─► Total Amount
  │   │   ├─► Commission Details
  │   │   └─► Tax Information
  │   │
  │   ├─► Process Payment
  │   │   └─► Bank Transfer / PayPal / etc.
  │   │
  │   ├─► Update Commission Status
  │   │   └─► Status: Paid
  │   │
  │   ├─► Record Payout Transaction
  │   │
  │   └─► Send Notification to Partner
  │
  └─► END (Payout Complete)
```

---

## 12. Customer Subscription Upgrade/Downgrade Flow

```
[Customer Requests Plan Change]
  │
  ├─► [Upgrade or Downgrade?]
  │
  ├─► [UPGRADE]
  │   ├─► Calculate Prorated Cost
  │   │   └─► (New Plan - Current Plan) × Remaining Days
  │   │
  │   ├─► Process Immediate Payment
  │   │
  │   ├─► Update Subscription
  │   │   ├─► New Plan
  │   │   └─► New Module Access
  │   │
  │   └─► Enable New Features Immediately
  │
  └─► [DOWNGRADE]
      ├─► Schedule for Next Billing Cycle
      │
      ├─► Notify Customer
      │   └─► Effective Date
      │
      ├─► [Next Billing Cycle]
      │   ├─► Update Subscription
      │   │   ├─► New Plan
      │   │   └─► Reduced Module Access
      │   │
      │   └─► Disable Features Not in New Plan
      │
      └─► END
```

---

## 13. System Integration Flow

```
┌─────────────────────────────────────────────────────────┐
│              SYSTEM COMPONENT INTEGRATION                │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  FRONTEND APPLICATIONS                                  │
│  ├─► Customer Portal (React)                           │
│  ├─► Super Admin Portal (React)                        │
│  └─► Partner Portal (React)                            │
│         │                                               │
│         ▼                                               │
│  API GATEWAY                                            │
│  ├─► Authentication                                     │
│  ├─► Rate Limiting                                     │
│  └─► Request Routing                                   │
│         │                                               │
│         ▼                                               │
│  BACKEND SERVICES                                       │
│  ├─► User Service                                      │
│  ├─► Subscription Service                              │
│  ├─► Module Service                                    │
│  ├─► Partner Service                                   │
│  ├─► Billing Service                                   │
│  └─► Notification Service                               │
│         │                                               │
│         ▼                                               │
│  DATABASE                                               │
│  ├─► Users & Roles                                     │
│  ├─► Subscriptions & Plans                            │
│  ├─► Modules & Permissions                             │
│  ├─► Partners & Commissions                            │
│  └─► Billing & Transactions                            │
│         │                                               │
│         ▼                                               │
│  EXTERNAL SERVICES                                      │
│  ├─► Payment Gateway                                   │
│  ├─► Email Service                                      │
│  └─► Analytics (Optional)                              │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 14. Error Handling & Retry Flow

```
[API Request]
  │
  ├─► [Success?]
  │   └─► YES ──► Process Response ──► END
  │
  └─► NO ──► [Error Type?]
      │
      ├─► [Authentication Error]
      │   └─► Redirect to Login
      │
      ├─► [Payment Error]
      │   ├─► Retry Payment (3 attempts)
      │   ├─► Notify Customer
      │   └─► Suspend Subscription if Failed
      │
      ├─► [Rate Limit Error]
      │   └─► Queue Request + Retry After Delay
      │
      ├─► [Server Error]
      │   ├─► Log Error
      │   ├─► Retry with Exponential Backoff
      │   └─► Notify Admin if Persistent
      │
      └─► [Validation Error]
          └─► Return Error to User
```

---

## 15. Data Synchronization Flow

```
[Data Change Event]
  │
  ├─► [Change Type?]
  │
  ├─► [Subscription Updated]
  │   ├─► Update User Access
  │   ├─► Update Module Visibility
  │   └─► Invalidate Cache
  │
  ├─► [User Added/Removed]
  │   ├─► Update User Count
  │   ├─► Recalculate Billing
  │   └─► Send Notification
  │
  ├─► [Module Assigned]
  │   ├─► Update User Permissions
  │   └─► Refresh UI
  │
  ├─► [Commission Earned]
  │   ├─► Update Partner Earnings
  │   └─► Update Dashboard
  │
  └─► END
```

---

## Quick Reference: Decision Points

```
KEY DECISION POINTS IN SYSTEM:

1. USER TYPE DETERMINATION
   └─► Full Access / Internal / External

2. MODULE ACCESS CHECK
   └─► Universal / Subscription / Custom

3. BILLING CALCULATION
   └─► Base + Users + Features + Usage

4. COMMISSION CALCULATION
   └─► Initial / Recurring / Bonus

5. PAYMENT PROCESSING
   └─► Success / Failure / Retry

6. SUBSCRIPTION STATUS
   └─► Active / Trial / Suspended / Cancelled
```

---

*These flowcharts can be converted to visual diagrams using tools like:*
- *Draw.io / diagrams.net*
- *Lucidchart*
- *Microsoft Visio*
- *Miro*
- *Figma*

