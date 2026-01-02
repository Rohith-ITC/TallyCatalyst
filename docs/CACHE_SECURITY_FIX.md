# Cache Security Fix - User Isolation

## Issue
Previously, cache entries for different users could be displayed even when the company name, GUID, and tallyloc_id were the same. This was a security vulnerability where User A could potentially see cache entries belonging to User B for the same company.

## Root Cause
The cache metadata was missing the `email` field in several places:
1. Complete sales data metadata (`setCompleteSalesData`)
2. Restored complete sales metadata (when metadata is missing but file exists)
3. Session cache metadata (`setSessionCacheData`)

Without the email field in metadata, the filtering logic in `listAllCacheEntries()` couldn't properly distinguish between users' cache entries.

## Solution Implemented

### 1. Added Email to All Metadata Entries
- **Complete Sales Data**: Added `email: email || 'unknown'` to metadata entry
- **Restored Metadata**: Added `email: userEmail || 'unknown'` when restoring missing metadata
- **Session Cache Data**: Added `email: email || 'unknown'` to session cache metadata

### 2. Strengthened Filtering Logic (Defense in Depth)
The `listAllCacheEntries()` function now uses **two-layer filtering**:

#### Layer 1: Metadata Email Check
- Metadata email must match current user's email

#### Layer 2: Cache Key Verification
- Cache key must start with sanitized current user email
- Format: `{sanitized_email}_{guid}_{tallyloc_id}_...`
- This prevents any accidental cross-user data leakage

#### For Legacy Entries (without email field)
- Only show if cache key contains current user's sanitized email
- This ensures backward compatibility while maintaining security

### 3. Security Guarantees

**Sales Entries Filtering:**
```javascript
// Both conditions must be true:
1. metadata.email === currentUserEmail
2. cacheKey.startsWith(sanitizedCurrentEmail + '_')
```

**Dashboard Entries Filtering:**
```javascript
// Both conditions must be true:
1. metadata.email === currentUserEmail
2. cacheKey contains current user email (checks both raw and sanitized formats)
   - Checks: _email_, email_, _email, or exact match
   - Works with both raw email (sync_progress_user@example.com_...) 
     and sanitized email (user_example_com_...)
```

## Cache Key Format

### Sales Cache Keys
Cache keys are generated with user email as the first component:
```
{sanitized_email}_{guid}_{tallyloc_id}_complete_sales
{sanitized_email}_{guid}_{tallyloc_id}_session_cache
```

Where `sanitized_email` = email with special characters replaced by underscores

### Dashboard Cache Keys
Dashboard cache keys (for sync progress tracking) use raw email:
```
sync_progress_{email}_{guid}_{tallyloc_id}
```

Where `{email}` is the raw email address (not sanitized)

## Testing Scenarios

### Scenario 1: Same Company, Different Users
- **User A** (john@example.com): Can only see cache entries starting with `john_example_com_`
- **User B** (jane@example.com): Can only see cache entries starting with `jane_example_com_`
- Even if both users access the same company (same GUID and tallyloc_id), they will only see their own cache

### Scenario 2: Legacy Entries
- Old cache entries without email field are filtered by cache key
- Only shown if cache key contains current user's email
- Maintains backward compatibility

### Scenario 3: Encryption Layer
- Each user's cache is encrypted with their own encryption key (derived from their email)
- Even if filtering fails, users cannot decrypt other users' cache data
- This provides an additional security layer

## Files Modified
- `src/utils/hybridCache.js`:
  - Line ~1525-1535: Added email to complete sales metadata
  - Line ~1588-1596: Added email to restored metadata
  - Line ~1838-1848: Added email to session cache metadata
  - Line ~1231-1283: Strengthened filtering logic with two-layer checks
  - Line ~1262-1283: Enhanced dashboard filtering to support both raw and sanitized email formats

## Impact
- **Security**: ✅ Users can now only see their own cache entries
- **Performance**: ✅ No performance impact
- **Backward Compatibility**: ✅ Legacy entries handled gracefully
- **User Experience**: ✅ No visible changes to users

## Verification
To verify the fix:
1. Log in as User A and create cache for a company
2. Log out and log in as User B
3. Access the same company
4. Open Cache Management page
5. Verify that User B cannot see User A's cache entries

## Additional Security Measures
1. **Encryption**: Each user's cache is encrypted with a key derived from their email
2. **OPFS Isolation**: Browser's OPFS provides origin-level isolation
3. **Metadata Filtering**: Two-layer filtering (email + cache key)
4. **Cache Key Format**: Email embedded in cache key structure

## Dashboard Cache Display Fix

### Additional Issue Found
Dashboard cache entries were not being displayed in the "View Cache Contents" section due to overly strict filtering logic that didn't account for the different cache key format used by dashboard entries.

### Root Cause
- Sales cache keys use **sanitized email**: `user_example_com_ABC123_456_complete_sales`
- Dashboard cache keys use **raw email**: `sync_progress_user@example.com_ABC123_456`

The original filtering logic only checked for sanitized email format, causing dashboard entries to be filtered out even when they belonged to the current user.

### Solution
Enhanced the dashboard filtering logic to check for both raw and sanitized email formats:
- Checks if cache key contains `_email_` (middle)
- Checks if cache key starts with `email_` (start)
- Checks if cache key ends with `_email` (end)
- Checks if cache key equals `email` (exact match)
- Performs all checks for both raw and sanitized email formats

This ensures dashboard entries are properly displayed while maintaining security.

## Conclusion
This fix ensures complete user isolation in the cache system. Even if multiple users access the same company, they will only see and access their own cached data. The two-layer filtering approach (metadata + cache key) provides defense in depth against any potential security issues.

Both sales and dashboard cache entries are now properly filtered and displayed, with support for different cache key formats while maintaining strict security controls.

