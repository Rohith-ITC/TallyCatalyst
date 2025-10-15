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
  }
};

// App Configuration
export const APP_CONFIG = {
  APP_NAME: 'TallyCatalyst',
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