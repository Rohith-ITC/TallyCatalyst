// Discount Management Page - Apply discounts to billing records (Superadmin only)
import React, { useState } from 'react';
import { applyDiscount, getBillingHistory } from '../api/subscriptionApi';
import './DiscountManagementPage.css';

const DiscountManagementPage = () => {
  const [billingRecords, setBillingRecords] = useState([]);
  const [selectedBilling, setSelectedBilling] = useState(null);
  const [discountData, setDiscountData] = useState({
    discount_type: 'percentage',
    discount_value: 0,
    discount_reason: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleApplyDiscount = async (e) => {
    e.preventDefault();
    if (!selectedBilling) return;

    setLoading(true);
    setError(null);

    try {
      const result = await applyDiscount(selectedBilling.id, discountData);
      if (result) {
        alert('Discount applied successfully.');
        setSelectedBilling(null);
        setDiscountData({ discount_type: 'percentage', discount_value: 0, discount_reason: '' });
        // Refresh billing records
      }
    } catch (err) {
      console.error('Error applying discount:', err);
      setError(err.message || 'Failed to apply discount. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="discount-management-page">
      <div className="discount-page-header">
        <h1>Discount Management</h1>
        <p>Apply discounts to billing records</p>
      </div>

      <div className="discount-form-container">
        <form onSubmit={handleApplyDiscount} className="discount-form">
          <div className="form-group">
            <label htmlFor="billing_id">Select Billing Record *</label>
            <input
              type="number"
              id="billing_id"
              placeholder="Enter Billing ID"
              onChange={(e) => setSelectedBilling({ id: parseInt(e.target.value) })}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="discount_type">Discount Type *</label>
            <select
              id="discount_type"
              value={discountData.discount_type}
              onChange={(e) => setDiscountData(prev => ({ ...prev, discount_type: e.target.value }))}
              required
            >
              <option value="percentage">Percentage</option>
              <option value="fixed">Fixed Amount</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="discount_value">
              Discount Value * ({discountData.discount_type === 'percentage' ? '%' : '₹'})
            </label>
            <input
              type="number"
              id="discount_value"
              value={discountData.discount_value}
              onChange={(e) => setDiscountData(prev => ({ ...prev, discount_value: parseFloat(e.target.value) || 0 }))}
              min="0"
              step={discountData.discount_type === 'percentage' ? '1' : '0.01'}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="discount_reason">Discount Reason</label>
            <textarea
              id="discount_reason"
              value={discountData.discount_reason}
              onChange={(e) => setDiscountData(prev => ({ ...prev, discount_reason: e.target.value }))}
              rows="3"
              placeholder="Enter reason for discount"
            />
          </div>

          {error && (
            <div className="error-message">{error}</div>
          )}

          <div className="form-actions">
            <button type="submit" className="submit-button" disabled={loading}>
              {loading ? 'Applying...' : 'Apply Discount'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DiscountManagementPage;

