// Plan Card Component
import React from 'react';
import './PlanCard.css';

const PlanCard = ({ 
  plan, 
  billingCycle, 
  isSelected = false, 
  isCurrent = false,
  onSelect 
}) => {
  // Safely get price with fallback to 0 if undefined, converting strings to numbers
  const parsePrice = (priceValue) => {
    if (priceValue === null || priceValue === undefined) return 0;
    const parsed = parseFloat(priceValue);
    return isNaN(parsed) ? 0 : parsed;
  };

  // Handle both internal plans (monthly_price/yearly_price) and external plans (monthly_price_per_user/yearly_price_per_user)
  const yearlyPrice = parsePrice(plan.yearly_price || plan.yearly_price_per_user);
  const monthlyPrice = parsePrice(plan.monthly_price || plan.monthly_price_per_user);

  const price = billingCycle === 'yearly' ? yearlyPrice : monthlyPrice;

  // Safely calculate monthly equivalent with fallback
  const monthlyEquivalent = billingCycle === 'yearly'
    ? yearlyPrice > 0 ? (yearlyPrice / 12).toFixed(2) : '0.00'
    : monthlyPrice.toString();

  // Safely calculate savings
  const savings = billingCycle === 'yearly' && monthlyPrice > 0 && yearlyPrice > 0
    ? ((monthlyPrice * 12) - yearlyPrice).toFixed(2)
    : 0;

  const userRange = plan.min_users === plan.max_users
    ? `${plan.min_users} user${plan.min_users > 1 ? 's' : ''}`
    : `${plan.min_users}-${plan.max_users} users`;

  return (
    <div 
      className={`plan-card ${isSelected ? 'plan-card-selected' : ''} ${isCurrent ? 'plan-card-current' : ''}`}
      onClick={onSelect}
    >
      {isCurrent && (
        <div className="plan-card-badge">Current Plan</div>
      )}
      
      {plan.popular && (
        <div className="plan-card-popular">Most Popular</div>
      )}

      <div className="plan-card-header">
        <h3 className="plan-card-name">{plan.name}</h3>
        {plan.description && (
          <p className="plan-card-description">{plan.description}</p>
        )}
      </div>

      <div className="plan-card-pricing">
        <div className="plan-card-price">
          <span className="plan-card-currency">₹</span>
          <span className="plan-card-amount">{price.toLocaleString('en-IN')}</span>
          <span className="plan-card-period">/{billingCycle === 'yearly' ? 'year' : 'month'}</span>
        </div>
        
        {billingCycle === 'yearly' && savings > 0 && !isNaN(parseFloat(savings)) && (
          <div className="plan-card-savings">
            Save ₹{parseFloat(savings).toLocaleString('en-IN')}/year
          </div>
        )}

        {billingCycle === 'yearly' && monthlyEquivalent && !isNaN(parseFloat(monthlyEquivalent)) && (
          <div className="plan-card-monthly-equivalent">
            ₹{parseFloat(monthlyEquivalent).toLocaleString('en-IN')}/month
          </div>
        )}
      </div>

      <div className="plan-card-details">
        <div className="plan-card-detail-item">
          <span className="plan-card-detail-label">User Range:</span>
          <span className="plan-card-detail-value">{userRange}</span>
        </div>
        
        {plan.free_external_users_per_internal_user !== undefined && plan.free_external_users_per_internal_user > 0 && (
          <div className="plan-card-detail-item">
            <span className="plan-card-detail-label">Free External Users Per Internal User:</span>
            <span className="plan-card-detail-value">{plan.free_external_users_per_internal_user}</span>
          </div>
        )}
      </div>

      <div className="plan-card-actions">
        {isCurrent ? (
          <button className="plan-card-button plan-card-button-current" disabled>
            Current Plan
          </button>
        ) : (
          <button className="plan-card-button plan-card-button-select">
            {isSelected ? 'Selected' : 'Select Plan'}
          </button>
        )}
      </div>
    </div>
  );
};

export default PlanCard;

