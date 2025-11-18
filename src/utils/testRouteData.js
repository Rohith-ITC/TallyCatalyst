/**
 * Test Data for Routes and Customers
 * This file contains dummy data for testing Create Routes and Assign Routes functionality.
 * To use: Import and call initializeTestData() in your component or console.
 * To remove: Simply delete this file and remove the import/call.
 */

// Dummy customers with pincodes and addresses
export const testCustomers = [
  {
    customer_id: 'CUST001',
    name: 'ABC Electronics',
    pincode: '560001',
    address: '123 MG Road, Bangalore, Karnataka',
    latitude: 12.9716,
    longitude: 77.5946
  },
  {
    customer_id: 'CUST002',
    name: 'XYZ Trading Company',
    pincode: '560001',
    address: '456 Brigade Road, Bangalore, Karnataka',
    latitude: 12.9750,
    longitude: 77.6093
  },
  {
    customer_id: 'CUST003',
    name: 'Global Supplies Ltd',
    pincode: '560001',
    address: '789 Commercial Street, Bangalore, Karnataka',
    latitude: 12.9780,
    longitude: 77.6120
  },
  {
    customer_id: 'CUST004',
    name: 'Metro Distributors',
    pincode: '560070',
    address: '321 Indira Nagar, Bangalore, Karnataka',
    latitude: 12.9784,
    longitude: 77.6408
  },
  {
    customer_id: 'CUST005',
    name: 'Prime Retailers',
    pincode: '560070',
    address: '654 100 Feet Road, Bangalore, Karnataka',
    latitude: 12.9800,
    longitude: 77.6450
  },
  {
    customer_id: 'CUST006',
    name: 'City Mart',
    pincode: '560070',
    address: '987 Koramangala, Bangalore, Karnataka',
    latitude: 12.9352,
    longitude: 77.6245
  },
  {
    customer_id: 'CUST007',
    name: 'Super Stores',
    pincode: '110001',
    address: '123 Connaught Place, New Delhi, Delhi',
    latitude: 28.6304,
    longitude: 77.2177
  },
  {
    customer_id: 'CUST008',
    name: 'Delhi Wholesale',
    pincode: '110001',
    address: '456 Janpath, New Delhi, Delhi',
    latitude: 28.6320,
    longitude: 77.2200
  },
  {
    customer_id: 'CUST009',
    name: 'North India Traders',
    pincode: '110001',
    address: '789 Karol Bagh, New Delhi, Delhi',
    latitude: 28.6517,
    longitude: 77.1912
  },
  {
    customer_id: 'CUST010',
    name: 'Mumbai Enterprises',
    pincode: '400001',
    address: '123 Fort Area, Mumbai, Maharashtra',
    latitude: 18.9388,
    longitude: 72.8353
  },
  {
    customer_id: 'CUST011',
    name: 'Coastal Distributors',
    pincode: '400001',
    address: '456 Colaba, Mumbai, Maharashtra',
    latitude: 18.9150,
    longitude: 72.8320
  },
  {
    customer_id: 'CUST012',
    name: 'Western Suppliers',
    pincode: '400001',
    address: '789 Andheri, Mumbai, Maharashtra',
    latitude: 19.1136,
    longitude: 72.8697
  },
  {
    customer_id: 'CUST013',
    name: 'Chennai Traders',
    pincode: '600001',
    address: '123 T Nagar, Chennai, Tamil Nadu',
    latitude: 13.0418,
    longitude: 80.2341
  },
  {
    customer_id: 'CUST014',
    name: 'South India Mart',
    pincode: '600001',
    address: '456 Anna Salai, Chennai, Tamil Nadu',
    latitude: 13.0604,
    longitude: 80.2496
  },
  {
    customer_id: 'CUST015',
    name: 'Hyderabad Stores',
    pincode: '500001',
    address: '123 Abids, Hyderabad, Telangana',
    latitude: 17.3850,
    longitude: 78.4867
  }
];

// Dummy routes
export const testRoutes = [
  {
    id: 'ROUTE001',
    name: 'Bangalore Central Route',
    description: 'Route covering central Bangalore areas with pincode 560001',
    created_by: 'coowner@itc.com',
    created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
    customer_ids: ['CUST001', 'CUST002', 'CUST003'],
    customer_names: ['ABC Electronics', 'XYZ Trading Company', 'Global Supplies Ltd'],
    customer_coordinates: [
      { latitude: 12.9716, longitude: 77.5946 },
      { latitude: 12.9750, longitude: 77.6093 },
      { latitude: 12.9780, longitude: 77.6120 }
    ],
    assignedTo: null,
    customerCount: 3
  },
  {
    id: 'ROUTE002',
    name: 'Bangalore East Route',
    description: 'Route covering Indira Nagar and Koramangala areas',
    created_by: 'coowner@itc.com',
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
    customer_ids: ['CUST004', 'CUST005', 'CUST006'],
    customer_names: ['Metro Distributors', 'Prime Retailers', 'City Mart'],
    customer_coordinates: [
      { latitude: 12.9784, longitude: 77.6408 },
      { latitude: 12.9800, longitude: 77.6450 },
      { latitude: 12.9352, longitude: 77.6245 }
    ],
    assignedTo: 'salesperson1@itc.com',
    customerCount: 3
  },
  {
    id: 'ROUTE003',
    name: 'Delhi North Route',
    description: 'Route covering Connaught Place and surrounding areas',
    created_by: 'coowner@itc.com',
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
    customer_ids: ['CUST007', 'CUST008', 'CUST009'],
    customer_names: ['Super Stores', 'Delhi Wholesale', 'North India Traders'],
    customer_coordinates: [
      { latitude: 28.6304, longitude: 77.2177 },
      { latitude: 28.6320, longitude: 77.2200 },
      { latitude: 28.6517, longitude: 77.1912 }
    ],
    assignedTo: null,
    customerCount: 3
  },
  {
    id: 'ROUTE004',
    name: 'Mumbai West Route',
    description: 'Route covering Fort and Colaba areas',
    created_by: 'coowner@itc.com',
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
    customer_ids: ['CUST010', 'CUST011'],
    customer_names: ['Mumbai Enterprises', 'Coastal Distributors'],
    customer_coordinates: [
      { latitude: 18.9388, longitude: 72.8353 },
      { latitude: 18.9150, longitude: 72.8320 }
    ],
    assignedTo: 'salesperson2@itc.com',
    customerCount: 2
  }
];

// Dummy route assignments
export const testRouteAssignments = [
  {
    id: 'ASSIGN001',
    route_id: 'ROUTE002',
    route_name: 'Bangalore East Route',
    user_id: 'salesperson1@itc.com',
    days_of_week: [1, 3, 5], // Monday, Wednesday, Friday
    is_recurring: true,
    assigned_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'ASSIGN002',
    route_id: 'ROUTE004',
    route_name: 'Mumbai West Route',
    user_id: 'salesperson2@itc.com',
    days_of_week: [0, 1, 2, 3, 4, 5, 6], // All days of the week
    is_recurring: true,
    assigned_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
  }
];

/**
 * Initialize test data in localStorage
 * This will populate customers, routes, and route assignments for testing
 */
export const initializeTestData = () => {
  console.log('🧪 Initializing test data for Routes and Customers...');
  
  // Store test customers
  localStorage.setItem('route_customers', JSON.stringify(testCustomers));
  console.log(`✅ Added ${testCustomers.length} test customers`);
  
  // Store test routes
  localStorage.setItem('routes', JSON.stringify(testRoutes));
  console.log(`✅ Added ${testRoutes.length} test routes`);
  
  // Store test route assignments
  localStorage.setItem('route_assignments', JSON.stringify(testRouteAssignments));
  console.log(`✅ Added ${testRouteAssignments.length} test route assignments`);
  
  console.log('🎉 Test data initialized successfully!');
  console.log('📋 Available pincodes:', [...new Set(testCustomers.map(c => c.pincode))].sort());
  console.log('📍 Routes created:', testRoutes.map(r => r.name).join(', '));
  
  return {
    customers: testCustomers.length,
    routes: testRoutes.length,
    assignments: testRouteAssignments.length,
    pincodes: [...new Set(testCustomers.map(c => c.pincode))].sort()
  };
};

/**
 * Clear all test data from localStorage
 * Use this to remove test data after testing
 */
export const clearTestData = () => {
  console.log('🗑️ Clearing test data...');
  
  localStorage.removeItem('route_customers');
  localStorage.removeItem('routes');
  localStorage.removeItem('route_assignments');
  
  console.log('✅ Test data cleared successfully!');
};

/**
 * Get summary of test data
 */
export const getTestDataSummary = () => {
  const customers = JSON.parse(localStorage.getItem('route_customers') || '[]');
  const routes = JSON.parse(localStorage.getItem('routes') || '[]');
  const assignments = JSON.parse(localStorage.getItem('route_assignments') || '[]');
  
  return {
    customers: customers.length,
    routes: routes.length,
    assignments: assignments.length,
    pincodes: [...new Set(customers.map(c => c.pincode))].sort(),
    routesList: routes.map(r => ({
      name: r.name,
      customers: r.customerCount,
      assignedTo: r.assignedTo || 'Not assigned'
    }))
  };
};

// Auto-initialize if this file is imported (optional - comment out if you want manual initialization)
// initializeTestData();

