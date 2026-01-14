# Pricing Model - Per-User Pricing

## Overview

**Important:** All prices in the subscription system are **per-user prices**, not total prices.

---

## Internal User Slabs

### Pricing Structure

- `monthly_price` = Price per user per month
- `yearly_price` = Price per user per year

### Calculation Formula

```
Total Subscription Price = Price Per User × Number of Users
```

### Examples

**Example 1: Slab with ₹1000/month per user**
- 1 user = ₹1000/month
- 3 users = ₹3000/month
- 5 users = ₹5000/month

**Example 2: Slab with ₹10000/year per user**
- 1 user = ₹10000/year
- 3 users = ₹30000/year
- 5 users = ₹50000/year

### Sample Slab Configuration

```sql
-- Slab 1: 1 User (₹1000/month per user)
INSERT INTO subscription_slabs (name, min_users, max_users, monthly_price, yearly_price)
VALUES ('1 User Plan', 1, 1, 1000.00, 10000.00);
-- Total for 1 user: ₹1000/month or ₹10000/year

-- Slab 2: 2-5 Users (₹800/month per user - discounted rate)
INSERT INTO subscription_slabs (name, min_users, max_users, monthly_price, yearly_price)
VALUES ('2-5 Users Plan', 2, 5, 800.00, 8000.00);
-- Total for 2 users: ₹1600/month
-- Total for 5 users: ₹4000/month

-- Slab 3: 6-10 Users (₹600/month per user - more discounted)
INSERT INTO subscription_slabs (name, min_users, max_users, monthly_price, yearly_price)
VALUES ('6-10 Users Plan', 6, 10, 600.00, 6000.00);
-- Total for 6 users: ₹3600/month
-- Total for 10 users: ₹6000/month
```

---

## External User Slabs

External user slabs already use per-user pricing:
- `monthly_price_per_user` = Price per external user per month
- `yearly_price_per_user` = Price per external user per year

### Calculation

```
Total External User Price = Price Per User × Number of External Users
```

---

## Price Calculation in Code

### Purchase Subscription

```javascript
// Get price per user from slab
const pricePerUser = billing_cycle === 'yearly' 
  ? slab.yearly_price 
  : slab.monthly_price;

// Get user count (from request or current usage)
const userCount = data.user_count || usage.internal_users_count || slab.min_users;

// Calculate total price
const baseAmount = pricePerUser * userCount;
```

### Upgrade/Downgrade

```javascript
// Get current user count
const usage = await SubscriptionUsage.getBySubscriptionId(subscriptionId);
const userCount = usage.internal_users_count || 1;

// Calculate prices (per-user)
const oldPricePerUser = billingCycle === 'yearly' ? oldSlab.yearly_price : oldSlab.monthly_price;
const newPricePerUser = billingCycle === 'yearly' ? newSlab.yearly_price : newSlab.monthly_price;

// Total prices
const oldPrice = oldPricePerUser * userCount;
const newPrice = newPricePerUser * userCount;

// Then calculate pro-rating based on total prices
```

### Renewal

```javascript
// Get current user count
const usage = await SubscriptionUsage.getBySubscriptionId(subscriptionId);
const userCount = usage.internal_users_count || 1;

// Calculate renewal amount
const pricePerUser = subscription.billing_cycle === 'yearly' 
  ? slab.yearly_price 
  : slab.monthly_price;

const baseAmount = pricePerUser * userCount;
```

---

## API Usage

### Purchase Subscription

When purchasing, you can optionally specify `user_count`:

```json
{
  "internal_slab_id": 1,
  "billing_cycle": "monthly",
  "user_count": 3  // Optional: defaults to slab min_users
}
```

**Calculation:**
- If slab has `monthly_price = 1000` (per user)
- And `user_count = 3`
- Total = ₹1000 × 3 = ₹3000/month

### Upgrade Calculation

The system automatically uses current user count:

```json
{
  "new_slab_id": 2
}
```

**Calculation:**
- Current users: 5
- Old slab: ₹1000/month per user = ₹5000/month total
- New slab: ₹800/month per user = ₹4000/month total
- Pro-rated calculation uses these totals

---

## Database Schema

### subscription_slabs Table

```sql
CREATE TABLE subscription_slabs (
  ...
  monthly_price DECIMAL(10, 2) NOT NULL,  -- PER-USER monthly price
  yearly_price DECIMAL(10, 2) NOT NULL,   -- PER-USER yearly price
  ...
);
```

### subscription_billing Table

The `amount` field stores the **total amount** (after multiplying by user count):

```sql
CREATE TABLE subscription_billing (
  ...
  amount DECIMAL(10, 2) NOT NULL,  -- Total amount (price_per_user × user_count)
  ...
);
```

---

## Important Notes

1. **Slab Prices = Per-User**: Always remember that slab prices are per-user
2. **User Count Required**: All calculations need the number of users
3. **Dynamic Pricing**: Price changes when user count changes
4. **Pro-rating**: Uses total prices (per-user × count) for calculations
5. **Billing Records**: Store total amounts, not per-user amounts

---

## Migration Notes

If you have existing data with total prices instead of per-user prices:

1. **Calculate per-user price**: `per_user_price = total_price / user_count`
2. **Update slab records**: Set `monthly_price` and `yearly_price` to per-user values
3. **Recalculate billing**: Update existing billing records if needed

---

**Last Updated:** [Current Date]  
**Pricing Model:** Per-User Pricing

