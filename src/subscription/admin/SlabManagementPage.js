// Slab Management Page - Manage internal slabs (Superadmin only)
import React, { useState, useEffect } from 'react';
import {
  getInternalSlabs,
  createInternalSlab,
  updateInternalSlab,
  deleteInternalSlab
} from '../api/subscriptionApi';
import './SlabManagementPage.css';

const SlabManagementPage = () => {
  const [internalSlabs, setInternalSlabs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingSlab, setEditingSlab] = useState(null);
  const [formData, setFormData] = useState(getInitialFormData());

  function getInitialFormData() {
    return {
      name: '',
      description: '',
      min_users: 1,
      max_users: 1,
      monthly_price: 0,
      yearly_price: 0,
      free_external_users_per_internal_user: 0,
      features_included: []
    };
  }

  useEffect(() => {
    fetchSlabs();
  }, []);

  const fetchSlabs = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getInternalSlabs();
      setInternalSlabs(response.slabs);
    } catch (err) {
      console.error('Error fetching slabs:', err);
      setError('Failed to load slabs. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (slab = null) => {
    if (slab) {
      setEditingSlab(slab);
      setFormData(slab);
    } else {
      setEditingSlab(null);
      setFormData(getInitialFormData());
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingSlab(null);
    setFormData(getInitialFormData());
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : (type === 'number' ? parseFloat(value) || 0 : value)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    try {
      if (editingSlab) {
        await updateInternalSlab(editingSlab.id, formData);
      } else {
        await createInternalSlab(formData);
      }
      handleCloseModal();
      fetchSlabs();
      alert(`Slab ${editingSlab ? 'updated' : 'created'} successfully.`);
    } catch (err) {
      console.error('Error saving slab:', err);
      setError(err.message || 'Failed to save slab. Please try again.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to deactivate this slab?')) {
      return;
    }

    try {
      await deleteInternalSlab(id);
      fetchSlabs();
      alert('Slab deactivated successfully.');
    } catch (err) {
      console.error('Error deleting slab:', err);
      alert('Failed to deactivate slab. Please try again.');
    }
  };

  return (
    <div className="slab-management-page">
      <div className="slab-page-header">
        <h1>Slab Management</h1>
        <p>Manage subscription slabs for internal users</p>
      </div>

      <div className="slab-actions">
        <button className="add-slab-button" onClick={() => handleOpenModal()}>
          + Add New Slab
        </button>
      </div>

      {error && (
        <div className="error-container">
          <p className="error-message">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading slabs...</p>
        </div>
      ) : (
        <div className="slabs-table-container">
          <table className="slabs-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>User Range</th>
                <th>Monthly Price (Per User)</th>
                <th>Yearly Price (Per User)</th>
                <th>Free External Users Per Internal User</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {internalSlabs.map((slab) => (
                <tr key={slab.id}>
                  <td className="slab-name">{slab.name}</td>
                  <td>
                    {slab.min_users === slab.max_users
                      ? `${slab.min_users} user${slab.min_users > 1 ? 's' : ''}`
                      : `${slab.min_users}-${slab.max_users} users`}
                  </td>
                  <td>₹{slab.monthly_price?.toLocaleString('en-IN')}</td>
                  <td>₹{slab.yearly_price?.toLocaleString('en-IN')}</td>
                  <td>{slab.free_external_users_per_internal_user || 0}</td>
                  <td>
                    <span className={`status-badge ${slab.is_active ? 'active' : 'inactive'}`}>
                      {slab.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="edit-button"
                        onClick={() => handleOpenModal(slab)}
                      >
                        Edit
                      </button>
                      {slab.is_active && (
                        <button
                          className="delete-button"
                          onClick={() => handleDelete(slab.id)}
                        >
                          Deactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="slab-modal">
          <div className="slab-modal-content">
            <div className="slab-modal-header">
              <h2>{editingSlab ? 'Edit' : 'Create'} Internal Slab</h2>
              <button className="close-button" onClick={handleCloseModal}>×</button>
            </div>
            <form onSubmit={handleSubmit} className="slab-form">
              <div className="form-group">
                <label htmlFor="name">Name *</label>
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
                <label htmlFor="description">Description</label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows="3"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="min_users">Min Users *</label>
                  <input
                    type="number"
                    id="min_users"
                    name="min_users"
                    value={formData.min_users}
                    onChange={handleInputChange}
                    min="1"
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="max_users">Max Users *</label>
                  <input
                    type="number"
                    id="max_users"
                    name="max_users"
                    value={formData.max_users}
                    onChange={handleInputChange}
                    min="1"
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="monthly_price">Monthly Price (Per User) *</label>
                  <input
                    type="number"
                    id="monthly_price"
                    name="monthly_price"
                    value={formData.monthly_price}
                    onChange={handleInputChange}
                    min="0"
                    step="0.01"
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="yearly_price">Yearly Price (Per User) *</label>
                  <input
                    type="number"
                    id="yearly_price"
                    name="yearly_price"
                    value={formData.yearly_price}
                    onChange={handleInputChange}
                    min="0"
                    step="0.01"
                    required
                  />
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="free_external_users_per_internal_user">Free External Users Per Internal User</label>
                <input
                  type="number"
                  id="free_external_users_per_internal_user"
                  name="free_external_users_per_internal_user"
                  value={formData.free_external_users_per_internal_user}
                  onChange={handleInputChange}
                  min="0"
                />
                <small>Number of free external users provided for each internal user in this slab</small>
              </div>

              <div className="form-actions">
                <button type="button" className="cancel-button" onClick={handleCloseModal}>
                  Cancel
                </button>
                <button type="submit" className="submit-button">
                  {editingSlab ? 'Update' : 'Create'} Slab
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SlabManagementPage;

