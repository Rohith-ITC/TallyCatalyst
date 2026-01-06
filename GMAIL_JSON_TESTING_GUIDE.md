# Gmail JSON Tab - Testing Guide

## Implementation Complete ✅

The Gmail JSON tab has been successfully implemented in the Tally Dashboard with the following features:

### Files Created/Modified:
1. ✅ **Created**: `src/TallyDashboard/GmailJsonViewer.js` - Main component
2. ✅ **Modified**: `src/config/SideBarConfigurations.js` - Added Gmail JSON module entry
3. ✅ **Modified**: `src/TallyDashboard/tallydashboard.js` - Integrated component

## How to Test

### Prerequisites:
1. **Gmail Configuration**: Ensure Gmail is configured in Tally Configurations:
   - Go to Admin Dashboard → Tally Configurations
   - Select a company
   - Open Company Configurations
   - Link Google Account (this stores the Gmail token in company configs)

2. **Email Setup**: Ensure you have emails in your Gmail inbox with:
   - Subject matching the pattern (default: "Tally Export *")
   - JSON file attached

### Testing Steps:

#### 1. Navigate to Gmail JSON Tab
1. Log into the application
2. Select a company from the top navigation
3. Click on "Gmail JSON" in the sidebar (📧 icon)
4. The tab should appear in the main content area

#### 2. Initial Load Test
- The component should automatically fetch JSON on mount
- **Expected behavior**:
  - Shows loading spinner while fetching
  - Displays success message with JSON content if email found
  - Shows error message if no emails found or Gmail not configured

#### 3. Test Refresh Functionality
1. Click the "Refresh" button in the top-right
2. **Expected behavior**:
   - Button shows "Fetching..." state
   - Loading spinner appears
   - Fetches latest unprocessed email with JSON attachment
   - Updates JSON display with new data

#### 4. Test Error Scenarios

**No Company Selected:**
- Navigate to tab without selecting company
- Should show: "Please select a company first."

**Gmail Not Configured:**
- Select a company without Gmail configured
- Should show: "Gmail is not configured for this company..."

**No Emails Found:**
- If no emails match the subject pattern
- Should show: "No new emails with JSON attachments found."

#### 5. Test JSON Display
- Verify JSON is displayed in:
  - Dark background (#1e293b)
  - Monospace font
  - Properly formatted with 2-space indentation
  - Scrollable container
  - Copy button works (copies JSON to clipboard)

#### 6. Test Custom Subject Pattern (Optional)
1. In Tally Configurations, add a config key: `gmail_json_subject_pattern`
2. Set value to a custom pattern (e.g., "My Custom Pattern *")
3. Reload the Gmail JSON tab
4. Should fetch emails matching the custom pattern

### Expected UI Elements:

✅ **Header Section:**
- Title: "Gmail JSON Viewer" with email icon
- Subject pattern display: "Fetching emails matching: [pattern]"
- Last fetched timestamp
- Refresh button (blue gradient)

✅ **Content Section:**
- Loading state: Spinner with "Fetching JSON from Gmail..."
- Error state: Red alert box with error icon and message
- Success state: Dark code block with formatted JSON
- Empty state: Inbox icon with "No JSON data available"

✅ **JSON Display Features:**
- Copy to clipboard button
- Scrollable container
- Syntax-highlighted (dark theme)
- Proper formatting

### API Calls to Verify (Developer Console):

1. **Get Company Configs**: 
   ```
   GET /api/cmpconfig/list?tallyloc_id={id}&co_guid={guid}
   ```
   - Should retrieve Gmail token from configs

2. **Gmail API Calls**:
   - Gmail search: `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=...`
   - Message details: `https://gmail.googleapis.com/gmail/v1/users/me/messages/{id}`
   - Attachments: `https://gmail.googleapis.com/gmail/v1/users/me/messages/{id}/attachments/{attachmentId}`

### Console Logs to Check:

The component logs useful debugging information:
- `🔑 getValidGoogleTokenFromConfigs called:` - Token retrieval
- `📧 Starting Gmail auto-sync...` - Fetch operation
- `✅ Found Google token in backend configs` - Token found
- `⚠️ No Google token found` - Token missing

### Troubleshooting:

**Issue**: "Gmail is not configured"
- **Solution**: Configure Google Account in Tally Configurations → Company Configurations

**Issue**: "No new emails found"
- **Solution**: 
  - Verify emails exist with matching subject
  - Check email has JSON attachment
  - Verify email hasn't been processed before (check localStorage: `gmail_processed_email_ids`)

**Issue**: Token expired error
- **Solution**: Re-authenticate Google Account in Tally Configurations

**Issue**: CORS errors
- **Solution**: Ensure Google API credentials are properly configured in `.env`

## Configuration Reference

### Environment Variables (Already Configured):
```
REACT_APP_GOOGLE_CLIENT_ID=643956131359-2bplishr02kk944gi1ooj1q0huapvf9n.apps.googleusercontent.com
REACT_APP_GOOGLE_API_KEY=AIzaSyBVhzF9XXvpQ9gRvY5-6gtZRkQgB-q9bRY
REACT_APP_GOOGLE_CLIENT_SECRET=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
```

### Company Configuration Keys:
- `google_token` - Stores Gmail access token
- `google_display_name` - Stores Google account name
- `gmail_json_subject_pattern` (optional) - Custom subject pattern

### Gmail API Scopes (Already Configured):
- `https://mail.google.com/` - Full Gmail access

## Features Implemented:

✅ Automatic token retrieval from company configurations
✅ Integration with existing Gmail utility functions
✅ Subject pattern configuration support
✅ Automatic fetch on component mount
✅ Manual refresh functionality
✅ Error handling for all scenarios
✅ Loading states
✅ Empty states
✅ Copy to clipboard functionality
✅ Responsive design matching dashboard style
✅ Processed email tracking (avoids duplicates)
✅ Last fetch timestamp display

## Next Steps (Optional Enhancements):

1. **Add subject pattern configuration UI** in Tally Configurations
2. **Add download JSON button** to save JSON file locally
3. **Add search/filter** for large JSON files
4. **Add JSON tree view** for better navigation
5. **Add auto-refresh** with configurable interval
6. **Add notification** when new JSON is available

## Support

If you encounter any issues:
1. Check browser console for error messages
2. Verify Gmail token is configured
3. Check network tab for API call failures
4. Review processed email IDs in localStorage
5. Verify email subject matches pattern exactly

---

**Implementation Status**: ✅ Complete and Ready for Testing
**Date**: December 31, 2025


