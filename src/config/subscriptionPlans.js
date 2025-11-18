// Subscription Plans Configuration (Frontend Reference)
// Note: Actual plans will be fetched from backend API, this is for reference/fallback

export const SUBSCRIPTION_PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    description: 'Perfect for small businesses getting started with Tally integration',
    baseUsers: 3,
    monthlyPrice: 999,
    annualPrice: 9990,
    perUserAddOn: 200,
    features: [
      '3 Base Users Included',
      'Unlimited Tally Connections',
      'Basic Access Control',
      'Standard Dashboard & Reports',
      'Email Support (Business Hours)',
      'Data Export & Import',
      'Mobile App Access',
      'Basic Analytics'
    ],
    popular: false,
    savings: 'Save ₹1,998/year with annual billing'
  },
  {
    id: 'professional',
    name: 'Professional',
    description: 'Ideal for growing businesses with multiple teams and departments',
    baseUsers: 10,
    monthlyPrice: 2999,
    annualPrice: 29990,
    perUserAddOn: 150,
    features: [
      '10 Base Users Included',
      'Unlimited Tally Connections',
      'Advanced Access Control & Permissions',
      'Advanced Dashboard & Custom Reports',
      'Priority Email & Chat Support',
      'Advanced Data Export & Import',
      'Mobile App Access',
      'Advanced Analytics & Insights',
      'Role-Based Access Management',
      'Custom Workflows',
      'API Access',
      'Bulk Operations'
    ],
    popular: true,
    savings: 'Save ₹5,998/year with annual billing'
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'For large organizations requiring custom solutions and dedicated support',
    baseUsers: 50,
    monthlyPrice: 9999,
    annualPrice: 99990,
    perUserAddOn: 100,
    features: [
      '50 Base Users Included',
      'Unlimited Tally Connections',
      'Enterprise-Grade Access Control',
      'Custom Dashboard & Advanced Reports',
      '24/7 Priority Support',
      'Advanced Data Export & Import',
      'Mobile App Access',
      'Enterprise Analytics & BI',
      'Advanced Role Management',
      'Custom Workflows & Automation',
      'Full API Access & Webhooks',
      'Bulk Operations & Batch Processing',
      'Dedicated Account Manager',
      'Custom Integrations',
      'On-Premise Deployment Option',
      'SLA Guarantee',
      'Training & Onboarding Support'
    ],
    popular: false,
    savings: 'Save ₹19,998/year with annual billing'
  }
];

// Helper function to get plan by ID
export const getPlanById = (planId) => {
  return SUBSCRIPTION_PLANS.find(plan => plan.id === planId);
};

// Helper function to calculate total amount (for display only)
export const calculateTotalAmount = (plan, billingCycle, addOnUsers = 0) => {
  if (!plan) return 0;
  
  const basePrice = billingCycle === 'annual' ? plan.annualPrice : plan.monthlyPrice;
  const addOnPrice = billingCycle === 'annual' 
    ? plan.perUserAddOn * addOnUsers * 12 
    : plan.perUserAddOn * addOnUsers;
  
  return basePrice + addOnPrice;
};

