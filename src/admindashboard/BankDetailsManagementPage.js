// Bank Details Management Page - Manage company bank details (Superadmin only)
import React, { useState, useEffect } from 'react';
import { getAllBankDetails, getBankDetailsById, createBankDetails, updateBankDetails } from './api/bankDetailsApi';
import './BankDetailsManagementPage.css';

const BankDetailsManagementPage = () => {
  const [bankDetailsList, setBankDetailsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    company_name: '',
    account_holder_name: '',
    bank_name: '',
    account_number: '',
    ifsc_code: '',
    branch_name: '',
    upi_id: '',
    is_active: true
  });
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    fetchBankDetails();
  }, []);

  const fetchBankDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAllBankDetails();
      setBankDetailsList(data);
    } catch (err) {
      console.error('Error fetching bank details:', err);
      setError('Failed to load bank details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    // Clear error for this field
    if (formErrors[name]) {
      setFormErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const validateForm = () => {
    const errors = {};
    
    if (!formData.company_name.trim()) {
      errors.company_name = 'Company name is required';
    }
    if (!formData.account_holder_name.trim()) {
      errors.account_holder_name = 'Account holder name is required';
    }
    if (!formData.bank_name.trim()) {
      errors.bank_name = 'Bank name is required';
    }
    if (!formData.account_number.trim()) {
      errors.account_number = 'Account number is required';
    }
    if (!formData.ifsc_code.trim()) {
      errors.ifsc_code = 'IFSC code is required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      if (editingId) {
        await updateBankDetails(editingId, formData);
        alert('Bank details updated successfully!');
      } else {
        await createBankDetails(formData);
        alert('Bank details created successfully!');
      }
      
      resetForm();
      fetchBankDetails();
    } catch (err) {
      console.error('Error saving bank details:', err);
      alert(`Failed to ${editingId ? 'update' : 'create'} bank details. Please try again.`);
    }
  };

  const handleEdit = async (id) => {
    try {
      const bankDetails = await getBankDetailsById(id);
      if (bankDetails) {
        setFormData({
          company_name: bankDetails.company_name || '',
          account_holder_name: bankDetails.account_holder_name || '',
          bank_name: bankDetails.bank_name || '',
          account_number: bankDetails.account_number || '',
          ifsc_code: bankDetails.ifsc_code || '',
          branch_name: bankDetails.branch_name || '',
          upi_id: bankDetails.upi_id || '',
          is_active: bankDetails.is_active !== undefined ? bankDetails.is_active : true
        });
        setEditingId(id);
        setShowForm(true);
      }
    } catch (err) {
      console.error('Error fetching bank details:', err);
      alert('Failed to load bank details for editing.');
    }
  };

  const handleCreateNew = () => {
    resetForm();
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({
      company_name: '',
      account_holder_name: '',
      bank_name: '',
      account_number: '',
      ifsc_code: '',
      branch_name: '',
      upi_id: '',
      is_active: true
    });
    setEditingId(null);
    setFormErrors({});
    setShowForm(false);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading && bankDetailsList.length === 0) {
    return (
      <div className="bank-details-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading bank details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bank-details-page">
      <div className="bank-details-header">
        <div>
          <h1>Bank Details Management</h1>
          <p>Manage company bank account information</p>
        </div>
        <button
          className="create-button"
          onClick={handleCreateNew}
        >
          <span className="material-icons">add</span>
          Add New Bank Details
        </button>
      </div>

      {error && (
        <div className="error-container">
          <p className="error-message">{error}</p>
          <button onClick={fetchBankDetails} className="retry-button">
            Retry
          </button>
        </div>
      )}

      {showForm && (
        <div className="form-modal">
          <div className="form-modal-content">
            <div className="form-modal-header">
              <h2>{editingId ? 'Edit Bank Details' : 'Create Bank Details'}</h2>
              <button
                className="close-button"
                onClick={resetForm}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit} className="bank-details-form">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="company_name">
                    Company Name <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    id="company_name"
                    name="company_name"
                    value={formData.company_name}
                    onChange={handleInputChange}
                    className={formErrors.company_name ? 'error' : ''}
                  />
                  {formErrors.company_name && (
                    <span className="error-message">{formErrors.company_name}</span>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="account_holder_name">
                    Account Holder Name <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    id="account_holder_name"
                    name="account_holder_name"
                    value={formData.account_holder_name}
                    onChange={handleInputChange}
                    className={formErrors.account_holder_name ? 'error' : ''}
                  />
                  {formErrors.account_holder_name && (
                    <span className="error-message">{formErrors.account_holder_name}</span>
                  )}
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="bank_name">
                    Bank Name <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    id="bank_name"
                    name="bank_name"
                    value={formData.bank_name}
                    onChange={handleInputChange}
                    className={formErrors.bank_name ? 'error' : ''}
                  />
                  {formErrors.bank_name && (
                    <span className="error-message">{formErrors.bank_name}</span>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="account_number">
                    Account Number <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    id="account_number"
                    name="account_number"
                    value={formData.account_number}
                    onChange={handleInputChange}
                    className={formErrors.account_number ? 'error' : ''}
                  />
                  {formErrors.account_number && (
                    <span className="error-message">{formErrors.account_number}</span>
                  )}
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="ifsc_code">
                    IFSC Code <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    id="ifsc_code"
                    name="ifsc_code"
                    value={formData.ifsc_code}
                    onChange={handleInputChange}
                    className={formErrors.ifsc_code ? 'error' : ''}
                    style={{ textTransform: 'uppercase' }}
                  />
                  {formErrors.ifsc_code && (
                    <span className="error-message">{formErrors.ifsc_code}</span>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="branch_name">Branch Name</label>
                  <input
                    type="text"
                    id="branch_name"
                    name="branch_name"
                    value={formData.branch_name}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="upi_id">UPI ID</label>
                  <input
                    type="text"
                    id="upi_id"
                    name="upi_id"
                    value={formData.upi_id}
                    onChange={handleInputChange}
                    placeholder="company@upi"
                  />
                  {formData.upi_id && (
                    <small className="form-hint">QR code can be generated using this UPI ID</small>
                  )}
                </div>

                {editingId && (
                  <div className="form-group">
                    <label htmlFor="is_active" className="checkbox-label">
                      <input
                        type="checkbox"
                        id="is_active"
                        name="is_active"
                        checked={formData.is_active}
                        onChange={handleInputChange}
                      />
                      <span>Active</span>
                    </label>
                  </div>
                )}
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="cancel-button"
                  onClick={resetForm}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="submit-button"
                >
                  {editingId ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {bankDetailsList.length === 0 && !loading ? (
        <div className="no-data-container">
          <span className="material-icons">account_balance</span>
          <p>No bank details found.</p>
          <button onClick={handleCreateNew} className="create-button">
            Create First Bank Details
          </button>
        </div>
      ) : (
        <div className="bank-details-table-container">
          <table className="bank-details-table">
            <thead>
              <tr>
                <th>Company Name</th>
                <th>Account Holder</th>
                <th>Bank Name</th>
                <th>Account Number</th>
                <th>IFSC Code</th>
                <th>Branch</th>
                <th>UPI ID</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {bankDetailsList.map((bank) => (
                <tr key={bank.id} className={!bank.is_active ? 'inactive' : ''}>
                  <td>{bank.company_name}</td>
                  <td>{bank.account_holder_name}</td>
                  <td>{bank.bank_name}</td>
                  <td>{bank.account_number}</td>
                  <td>{bank.ifsc_code}</td>
                  <td>{bank.branch_name || 'N/A'}</td>
                  <td>{bank.upi_id || 'N/A'}</td>
                  <td>
                    <span className={`status-badge ${bank.is_active ? 'active' : 'inactive'}`}>
                      {bank.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>{formatDate(bank.created_at)}</td>
                  <td>
                    <button
                      className="edit-button"
                      onClick={() => handleEdit(bank.id)}
                      title="Edit"
                    >
                      <span className="material-icons">edit</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default BankDetailsManagementPage;

