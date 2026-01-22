# Frontend API Quick Reference

## Subscription APIs

| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| GET | `/api/subscriptions/current` | Get active subscription | ✅ |
| GET | `/api/subscriptions/pending` | Get pending subscription | ✅ |
| POST | `/api/subscriptions/purchase` | Purchase new subscription | ✅ |
| POST | `/api/subscriptions/upgrade` | Upgrade subscription | ✅ |
| POST | `/api/subscriptions/downgrade` | Downgrade subscription | ✅ |
| GET | `/api/subscriptions/history` | Get subscription history | ✅ |

## Wallet APIs

| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| GET | `/api/subscriptions/wallet/balance` | Get wallet balance | ✅ |
| GET | `/api/subscriptions/wallet/transactions` | Get transactions | ✅ |

## Request Examples

### Purchase
```json
POST /api/subscriptions/purchase
{
  "internal_slab_id": 4,
  "billing_cycle": "monthly",
  "user_count": 3,
  "payment_method": "bank_transfer",
  "payment_reference": "TXN12345"
}
```

### Upgrade
```json
POST /api/subscriptions/upgrade
{
  "new_slab_id": 5,
  "user_count": 5,
  "payment_method": "bank_transfer",
  "payment_reference": "TXN12346"
}
```

### Downgrade
```json
POST /api/subscriptions/downgrade
{
  "new_slab_id": 3
}
```

## Status Flow

```
Purchase:    pending_payment → active
Upgrade:     pending_upgrade → active
Downgrade:   pending_downgrade → active (+ wallet credit)
```

## Key Points

1. **Pending subscriptions are NOT shown in `/current`** - Use `/pending` endpoint
2. **User sees OLD subscription until approval** - Don't show pending as active
3. **User count for upgrade** - Total users (current + additional)
4. **Downgrade credit** - Automatically added to wallet on approval
5. **All pending states require superadmin approval**

## Response Structure

All APIs return:
```json
{
  "success": true|false,
  "data": {...},
  "error": {...}  // if success: false
}
```

## Error Codes

- `MISSING_BEARER_TOKEN` - No auth token
- `VALIDATION_ERROR` - Invalid input
- `NO_SUBSCRIPTION` - Subscription not found

---

See `FRONTEND_API_WORKFLOWS.md` for detailed documentation.

