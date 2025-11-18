// Environment-based API Configuration
const getBaseUrl = () => {
  switch (process.env.NODE_ENV) {
    case 'development':
      return process.env.REACT_APP_DEV_API_URL;
    case 'staging':
      return process.env.REACT_APP_STAGING_API_URL;
    case 'production':
      return process.env.REACT_APP_PRODUCTION_API_URL;
    default:
      return '';
  }
};

// API Configuration
export const API_CONFIG = {
  BASE_URL: getBaseUrl(),
  ENDPOINTS: {
    // Authentication endpoints
    LOGIN: '/api/login',
    SIGNUP: '/api/signup',
    FORGET_PASSWORD: '/api/forget-password',
    CHANGE_PASSWORD: '/api/change-password',
    
    // Tally connection endpoints
    TALLY_CHECK_CONNECTION: '/api/tally/check-connection',
    TALLY_CONNECTIONS_ALL: '/api/tally/connections/all',
    TALLY_CONNECTION_CHECK: '/api/tally/check-connection',
    TALLY_CONNECTION_BY_ID: (id) => `/api/tally/connections/${id}`,
    
    // Tally data endpoints
    TALLY_COMPANIES: '/api/tally/companies',
    TALLY_LEDGERS: '/api/tally/ledgers',
    TALLY_LEDGER_VOUCHERS: '/api/tally/ledgervouchers',
    TALLY_LEDGERLIST_W_ADDRS: '/api/tally/ledgerlist-w-addrs',
    TALLY_STOCK_ITEMS: '/api/tally/stockitem',
    TALLY_PLACE_ORDER: '/api/tally/place_order',
    TALLY_LED_STATBILLREP: '/api/tally/led_statbillrep',
    TALLY_USER_CONNECTIONS: '/api/tally/user-connections',
    
    // Share Access endpoints
    TALLY_LEDGER_SHAREACCESS: '/api/tally/ledger-shareaccess',
    TALLY_LEDGER_SHAREACCESS_ACC: '/api/tally/ledger-shareaccess-acc',
    
    // Vendor Authorization endpoints
    TALLY_LEDGER_LIST: '/api/tally/ledger-list',
    TALLY_LEDGER_AUTH: '/api/tally/ledger-auth',
    TALLY_LEDGER_CHECK: '/api/tally/ledger-check',
    
    // Subscription endpoints
    SUBSCRIPTION_STATUS: '/api/subscription/status',
    SUBSCRIPTION_PLANS: '/api/subscription/plans',
    SUBSCRIPTION_USER_COUNT: '/api/subscription/user-count',
    SUBSCRIPTION_CREATE_ORDER: '/api/subscription/create-order',
    SUBSCRIPTION_VERIFY_PAYMENT: '/api/subscription/verify-payment',
    SUBSCRIPTION_UPDATE: '/api/subscription/update',
    SUBSCRIPTION_PAYMENTS: '/api/subscription/payments',
    SUBSCRIPTION_TRIAL_STATUS: '/api/subscription/trial-status',
    SUBSCRIPTION_DISMISS_REMINDER: '/api/subscription/dismiss-reminder',
  }
};

// Razorpay Configuration
export const RAZORPAY_CONFIG = {
  KEY_ID: process.env.REACT_APP_RAZORPAY_KEY_ID || '',
  TRIAL_DAYS: parseInt(process.env.REACT_APP_TRIAL_DAYS || '14', 10),
  REMINDER_DAYS: parseInt(process.env.REACT_APP_REMINDER_DAYS || '7', 10)
};

// App Configuration
export const APP_CONFIG = {
  APP_NAME: 'DataLynk',
  COMPANY_NAME: 'IT Catalyst Software India Pvt Ltd'
};

// Development/Production environment detection
export const isDevelopment = process.env.NODE_ENV === 'development';
export const isProduction = process.env.NODE_ENV === 'production';

// API URL builder
export const getApiUrl = (endpoint) => {
  return `${API_CONFIG.BASE_URL}${endpoint}`;
};

// Log configuration in development
if (isDevelopment) {
  console.log('API Configuration:', API_CONFIG);
}

// Fallback port for development
export const DEV_API_PORT = 1235;

// Google Drive Configuration
// All credentials must be set via environment variables
export const GOOGLE_DRIVE_CONFIG = {
  CLIENT_ID: process.env.REACT_APP_GOOGLE_CLIENT_ID || '',
  API_KEY: process.env.REACT_APP_GOOGLE_API_KEY || '',
  CLIENT_SECRET: process.env.REACT_APP_GOOGLE_CLIENT_SECRET || '',
  SCOPES: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly'
};

// Check if all Google Drive credentials are available
export const isGoogleDriveFullyConfigured = () => {
  const hasClientId = !!GOOGLE_DRIVE_CONFIG.CLIENT_ID && GOOGLE_DRIVE_CONFIG.CLIENT_ID.length > 0;
  const hasApiKey = !!GOOGLE_DRIVE_CONFIG.API_KEY && GOOGLE_DRIVE_CONFIG.API_KEY.length > 0;
  
  return {
    configured: hasClientId && hasApiKey,
    hasClientId,
    hasApiKey,
    missing: []
  };
};

// Log Google Drive configuration status in development
if (isDevelopment) {
  const configStatus = isGoogleDriveFullyConfigured();
  const rawClientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;
  const rawApiKey = process.env.REACT_APP_GOOGLE_API_KEY;
  
  console.log('🔍 Google Drive Configuration Status:', {
    configured: configStatus.configured,
    hasClientId: configStatus.hasClientId,
    hasApiKey: configStatus.hasApiKey,
    clientId: configStatus.hasClientId ? `${GOOGLE_DRIVE_CONFIG.CLIENT_ID.substring(0, 20)}...` : 'MISSING',
    apiKey: configStatus.hasApiKey ? 'SET' : 'MISSING',
    rawEnvClientId: rawClientId ? `${rawClientId.substring(0, 20)}...` : 'NOT IN ENV',
    rawEnvApiKey: rawApiKey ? 'PRESENT IN ENV' : 'NOT IN ENV',
    usingDefaultClientId: !rawClientId && configStatus.hasClientId
  });
  
  if (!configStatus.configured) {
    console.warn('⚠️ Google Drive is not fully configured. Document upload features will be disabled.');
    if (!rawApiKey) {
      console.warn('   ⚠️ REACT_APP_GOOGLE_API_KEY not found in environment variables.');
      console.warn('   💡 Make sure:');
      console.warn('      1. The variable is in your .env file in the project root');
      console.warn('      2. The variable name is exactly: REACT_APP_GOOGLE_API_KEY');
      console.warn('      3. You have RESTARTED the dev server after adding it');
      console.warn('      4. There are no spaces around the = sign in .env file');
    }
    if (!configStatus.hasClientId && !rawClientId) {
      console.warn('   Missing: REACT_APP_GOOGLE_CLIENT_ID');
    }
  } else {
    console.log('✅ Google Drive is fully configured! Upload buttons should be enabled.');
  }
} 