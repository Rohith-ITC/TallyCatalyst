// Partner Management Page - Create and manage partners (Superadmin only)
import React, { useState, useEffect } from 'react';
import { createPartner, getAllPartners, updatePartnerStatus } from '../api/subscriptionApi';
import './PartnerManagementPage.css';

const PartnerManagementPage = () => {
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    mobileno: '',
    contact_info: '',
    commission_rate: 0,
    commission_type: 'percentage',
    referral_code: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState({});
  const [filters, setFilters] = useState({
    limit: 50,
    offset: 0,
    is_active: ''
  });

  useEffect(() => {
    fetchPartners();
  }, [filters]);

  const fetchPartners = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAllPartners(filters);
      setPartners(data);
    } catch (err) {
      console.error('Error fetching partners:', err);
      setError('Failed to load partners. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'commission_rate' ? parseFloat(value) || 0 : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const result = await createPartner(formData);
      if (result) {
        alert('Partner created successfully.');
        setShowCreateForm(false);
        setFormData({
          name: '',
          email: '',
          mobileno: '',
          contact_info: '',
          commission_rate: 0,
          commission_type: 'percentage',
          referral_code: ''
        });
        fetchPartners();
      }
    } catch (err) {
      console.error('Error creating partner:', err);
      setError(err.message || 'Failed to create partner. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const handleStatusToggle = async (partnerId, currentStatus) => {
    const newStatus = !currentStatus;
    setUpdatingStatus(prev => ({ ...prev, [partnerId]: true }));
    
    try {
      const result = await updatePartnerStatus(partnerId, newStatus);
      if (result) {
        // Update the partner in the list
        setPartners(prev => prev.map(partner => 
          partner.id === partnerId 
            ? { ...partner, is_active: newStatus }
            : partner
        ));
        alert(`Partner status updated to ${newStatus ? 'Active' : 'Inactive'}.`);
      }
    } catch (err) {
      console.error('Error updating partner status:', err);
      alert('Failed to update partner status. Please try again.');
    } finally {
      setUpdatingStatus(prev => ({ ...prev, [partnerId]: false }));
    }
  };

  return (
    <div className="partner-management-page">
      <div className="page-header">
        <h1>Partner Management</h1>
        <p>Create and manage partners for referral tracking</p>
      </div>

      <div className="page-actions">
        <button
          className="create-button"
          onClick={() => setShowCreateForm(true)}
        >
          + Create New Partner
        </button>
        <div className="filters">
          <select
            value={filters.is_active}
            onChange={(e) => setFilters(prev => ({ ...prev, is_active: e.target.value }))}
          >
            <option value="">All Partners</option>
            <option value="true">Active Only</option>
            <option value="false">Inactive Only</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="error-container">
          <p className="error-message">{error}</p>
        </div>
      )}

      {showCreateForm && (
        <div className="modal-overlay" onClick={() => setShowCreateForm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create New Partner</h2>
              <button className="close-button" onClick={() => setShowCreateForm(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit} className="partner-form">
              <div className="form-group">
                <label htmlFor="name">Partner Name *</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="email">Email *</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="mobileno">Mobile Number *</label>
                <input
                  type="tel"
                  id="mobileno"
                  name="mobileno"
                  value={formData.mobileno}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="contact_info">Contact Information</label>
                <textarea
                  id="contact_info"
                  name="contact_info"
                  value={formData.contact_info}
                  onChange={handleInputChange}
                  rows="3"
                  placeholder="Address, etc."
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="commission_rate">Commission Rate *</label>
                  <input
                    type="number"
                    id="commission_rate"
                    name="commission_rate"
                    value={formData.commission_rate}
                    onChange={handleInputChange}
                    min="0"
                    step="0.01"
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="commission_type">Commission Type *</label>
                  <select
                    id="commission_type"
                    name="commission_type"
                    value={formData.commission_type}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="percentage">Percentage</option>
                    <option value="fixed">Fixed Amount</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="referral_code">Referral Code *</label>
                <input
                  type="text"
                  id="referral_code"
                  name="referral_code"
                  value={formData.referral_code}
                  onChange={handleInputChange}
                  required
                  placeholder="e.g., PART123"
                />
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="cancel-button"
                  onClick={() => setShowCreateForm(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="submit-button"
                  disabled={submitting}
                >
                  {submitting ? 'Creating...' : 'Create Partner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading partners...</p>
        </div>
      ) : (
        <div className="partners-table-container">
          <table className="partners-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Mobile</th>
                <th>Referral Code</th>
                <th>Commission Rate</th>
                <th>Commission Type</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {partners.length === 0 ? (
                <tr>
                  <td colSpan="8" className="no-data">
                    No partners found. Create your first partner to get started.
                  </td>
                </tr>
              ) : (
                partners.map((partner) => (
                  <tr key={partner.id}>
                    <td className="partner-name">{partner.name}</td>
                    <td>{partner.email}</td>
                    <td>{partner.mobileno}</td>
                    <td className="referral-code">{partner.referral_code}</td>
                    <td>{partner.commission_rate}%</td>
                    <td>{partner.commission_type === 'percentage' ? 'Percentage' : 'Fixed'}</td>
                    <td>
                      <span className={`status-badge ${partner.is_active ? 'active' : 'inactive'}`}>
                        {partner.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <button
                        className={`status-toggle-btn ${partner.is_active ? 'deactivate' : 'activate'}`}
                        onClick={() => handleStatusToggle(partner.id, partner.is_active)}
                        disabled={updatingStatus[partner.id]}
                        title={partner.is_active ? 'Deactivate Partner' : 'Activate Partner'}
                      >
                        {updatingStatus[partner.id] ? (
                          'Updating...'
                        ) : (
                          partner.is_active ? 'Deactivate' : 'Activate'
                        )}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PartnerManagementPage;

