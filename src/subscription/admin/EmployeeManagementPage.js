// Employee Management Page - Create and manage employees (Superadmin only)
import React, { useState, useEffect } from 'react';
import { createEmployee, getAllEmployees, updateEmployeeStatus } from '../api/subscriptionApi';
import './EmployeeManagementPage.css';

const EmployeeManagementPage = () => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    mobileno: '',
    contact_info: '',
    employee_id: '',
    department: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState({});
  const [filters, setFilters] = useState({
    limit: 50,
    offset: 0
  });

  useEffect(() => {
    fetchEmployees();
  }, [filters]);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAllEmployees(filters);
      setEmployees(data);
    } catch (err) {
      console.error('Error fetching employees:', err);
      setError('Failed to load employees. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const result = await createEmployee(formData);
      if (result) {
        alert('Employee created successfully.');
        setShowCreateForm(false);
        setFormData({
          name: '',
          email: '',
          mobileno: '',
          contact_info: '',
          employee_id: '',
          department: ''
        });
        fetchEmployees();
      }
    } catch (err) {
      console.error('Error creating employee:', err);
      setError(err.message || 'Failed to create employee. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusToggle = async (employeeId, currentStatus) => {
    const newStatus = !currentStatus;
    setUpdatingStatus(prev => ({ ...prev, [employeeId]: true }));
    
    try {
      const result = await updateEmployeeStatus(employeeId, newStatus);
      if (result) {
        // Update the employee in the list
        setEmployees(prev => prev.map(employee => 
          employee.id === employeeId 
            ? { ...employee, is_active: newStatus }
            : employee
        ));
        alert(`Employee status updated to ${newStatus ? 'Active' : 'Inactive'}.`);
      }
    } catch (err) {
      console.error('Error updating employee status:', err);
      alert('Failed to update employee status. Please try again.');
    } finally {
      setUpdatingStatus(prev => ({ ...prev, [employeeId]: false }));
    }
  };

  return (
    <div className="employee-management-page">
      <div className="page-header">
        <h1>Employee Management</h1>
        <p>Create and manage employees for tracking and incentives</p>
      </div>

      <div className="page-actions">
        <button
          className="create-button"
          onClick={() => setShowCreateForm(true)}
        >
          + Create New Employee
        </button>
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
              <h2>Create New Employee</h2>
              <button className="close-button" onClick={() => setShowCreateForm(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit} className="employee-form">
              <div className="form-group">
                <label htmlFor="name">Employee Name *</label>
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

              <div className="form-row">
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
                  <label htmlFor="employee_id">Employee ID *</label>
                  <input
                    type="text"
                    id="employee_id"
                    name="employee_id"
                    value={formData.employee_id}
                    onChange={handleInputChange}
                    required
                    placeholder="e.g., EMP123"
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="department">Department</label>
                <input
                  type="text"
                  id="department"
                  name="department"
                  value={formData.department}
                  onChange={handleInputChange}
                  placeholder="e.g., Sales, Marketing"
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
                  {submitting ? 'Creating...' : 'Create Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading employees...</p>
        </div>
      ) : (
        <div className="employees-table-container">
          <table className="employees-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Mobile</th>
                <th>Employee ID</th>
                <th>Department</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.length === 0 ? (
                <tr>
                  <td colSpan="7" className="no-data">
                    No employees found. Create your first employee to get started.
                  </td>
                </tr>
              ) : (
                employees.map((employee) => (
                  <tr key={employee.id}>
                    <td className="employee-name">{employee.name}</td>
                    <td>{employee.email}</td>
                    <td>{employee.mobileno}</td>
                    <td className="employee-id">{employee.employee_id}</td>
                    <td>{employee.department || 'N/A'}</td>
                    <td>
                      <span className={`status-badge ${employee.is_active !== false ? 'active' : 'inactive'}`}>
                        {employee.is_active !== false ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <button
                        className={`status-toggle-btn ${employee.is_active !== false ? 'deactivate' : 'activate'}`}
                        onClick={() => handleStatusToggle(employee.id, employee.is_active !== false)}
                        disabled={updatingStatus[employee.id]}
                        title={employee.is_active !== false ? 'Deactivate Employee' : 'Activate Employee'}
                      >
                        {updatingStatus[employee.id] ? (
                          'Updating...'
                        ) : (
                          employee.is_active !== false ? 'Deactivate' : 'Activate'
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

export default EmployeeManagementPage;

