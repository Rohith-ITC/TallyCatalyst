import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getApiUrl } from '../config';
import { apiPost } from '../utils/apiUtils';
import TallyLogo from '../DLlogo.png';

function ChangePassword() {
  const email = sessionStorage.getItem('email');
  const token = sessionStorage.getItem('token');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [oldFocused, setOldFocused] = useState(false);
  const [newFocused, setNewFocused] = useState(false);
  const [confirmFocused, setConfirmFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (success) {
      setTimeout(() => {
        sessionStorage.clear();
        window.location.href = process.env.REACT_APP_HOMEPAGE || '/';
      }, 1500);
    }
  }, [success]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    // Trim leading and trailing spaces from password values
    const trimmedOldPassword = oldPassword.trim();
    const trimmedNewPassword = newPassword.trim();
    const trimmedConfirmPassword = confirmPassword.trim();
    
    // Validate that new password and confirm password match
    if (trimmedNewPassword !== trimmedConfirmPassword) {
      setError('New password and confirm password do not match');
      return;
    }
    
    // Validate that new password is not empty
    if (!trimmedNewPassword) {
      setError('New password cannot be empty');
      return;
    }
    
    setLoading(true);
    try {
      const data = await apiPost('/api/change-password', { 
        email, 
        oldPassword: trimmedOldPassword, 
        newPassword: trimmedNewPassword 
      });
      
      if (data) {
      setSuccess(data.message || 'Password changed successfully');
      // Clear the form
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      width: '100vw',
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      background: 'linear-gradient(135deg, #e6f4ea 0%, #dbeafe 100%)',
    }}>
      {/* Faint grid pattern overlay */}
      <svg
        width="100%"
        height="100%"
        style={{ position: 'absolute', top: 0, left: 0, zIndex: 0 }}
      >
        <defs>
          <pattern id="smallGrid" width="32" height="32" patternUnits="userSpaceOnUse">
            <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#b6e0c6" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#smallGrid)" />
      </svg>
      {/* Watermark icon (ledger/book) */}
      <svg
        width="180"
        height="180"
        viewBox="0 0 64 64"
        fill="none"
        style={{
          position: 'absolute',
          left: 60,
          bottom: 60,
          opacity: 0.08,
          zIndex: 1,
        }}
      >
        <rect x="8" y="12" width="48" height="40" rx="6" fill="#22c55e" />
        <rect x="16" y="20" width="32" height="4" rx="2" fill="#fff" />
        <rect x="16" y="28" width="32" height="4" rx="2" fill="#fff" />
        <rect x="16" y="36" width="20" height="4" rx="2" fill="#fff" />
      </svg>
      {window.innerWidth <= 768 ? (
        // Mobile Layout
        <div style={{
          width: '95vw',
          maxWidth: 360,
          background: '#fff',
          borderRadius: 18,
          boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
          padding: 16,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          zIndex: 2,
          position: 'relative',
        }}>
          <button
            onClick={() => navigate('/admin-dashboard')}
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              background: 'rgba(100, 116, 139, 0.1)',
              border: 'none',
              borderRadius: '50%',
              width: 32,
              height: 32,
              fontSize: 18,
              color: '#64748b',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={e => {
              e.target.style.background = 'rgba(100, 116, 139, 0.2)';
              e.target.style.color = '#475569';
            }}
            onMouseLeave={e => {
              e.target.style.background = 'rgba(100, 116, 139, 0.1)';
              e.target.style.color = '#64748b';
            }}
          >
            ×
          </button>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#1e40af', marginBottom: 12, textAlign: 'center', marginTop: 8 }}>Change Password</div>
          <img src={TallyLogo} alt="Tally Logo" style={{ width: 64, height: 64, objectFit: 'contain', marginBottom: 8, marginTop: 0 }} />
          <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 300 }}>
            <div style={{ marginBottom: 12, position: 'relative' }}>
              <input
                id="oldPassword"
                type="password"
                value={oldPassword}
                onChange={e => setOldPassword(e.target.value)}
                required
                onFocus={() => setOldFocused(true)}
                onBlur={() => setOldFocused(false)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  fontSize: 15,
                  outline: 'none',
                  transition: 'border 0.2s',
                  marginBottom: 2,
                }}
              />
              <label
                htmlFor="oldPassword"
                style={{
                  position: 'absolute',
                  left: 12,
                  top: oldFocused || oldPassword ? '-10px' : '10px',
                  fontSize: oldFocused || oldPassword ? 14 : 15,
                  fontWeight: 600,
                  color: '#60a5fa',
                  backgroundColor: '#fff',
                  padding: '0 6px',
                  transition: 'all 0.25s cubic-bezier(.4,0,.2,1)',
                  pointerEvents: 'none',
                  letterSpacing: 0.5,
                  fontFamily: 'Segoe UI, Roboto, Arial, sans-serif',
                }}
              >
                Old Password
              </label>
            </div>
            <div style={{ marginBottom: 12, position: 'relative' }}>
              <input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required
                onFocus={() => setNewFocused(true)}
                onBlur={() => setNewFocused(false)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  fontSize: 15,
                  outline: 'none',
                  transition: 'border 0.2s',
                  marginBottom: 2,
                }}
              />
              <label
                htmlFor="newPassword"
                style={{
                  position: 'absolute',
                  left: 12,
                  top: newFocused || newPassword ? '-10px' : '10px',
                  fontSize: newFocused || newPassword ? 14 : 15,
                  fontWeight: 600,
                  color: '#60a5fa',
                  backgroundColor: '#fff',
                  padding: '0 6px',
                  transition: 'all 0.25s cubic-bezier(.4,0,.2,1)',
                  pointerEvents: 'none',
                  letterSpacing: 0.5,
                  fontFamily: 'Segoe UI, Roboto, Arial, sans-serif',
                }}
              >
                New Password
              </label>
            </div>
            <div style={{ marginBottom: 12, position: 'relative' }}>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                onFocus={() => setConfirmFocused(true)}
                onBlur={() => setConfirmFocused(false)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  fontSize: 15,
                  outline: 'none',
                  transition: 'border 0.2s',
                  marginBottom: 2,
                }}
              />
              <label
                htmlFor="confirmPassword"
                style={{
                  position: 'absolute',
                  left: 12,
                  top: confirmFocused || confirmPassword ? '-10px' : '10px',
                  fontSize: confirmFocused || confirmPassword ? 14 : 15,
                  fontWeight: 600,
                  color: '#60a5fa',
                  backgroundColor: '#fff',
                  padding: '0 6px',
                  transition: 'all 0.25s cubic-bezier(.4,0,.2,1)',
                  pointerEvents: 'none',
                  letterSpacing: 0.5,
                  fontFamily: 'Segoe UI, Roboto, Arial, sans-serif',
                }}
              >
                Confirm New Password
              </label>
            </div>
            {error && <div style={{ color: 'red', fontSize: 14, marginBottom: 12 }}>{error}</div>}
            {success && <div style={{ color: 'green', fontSize: 14, marginBottom: 12 }}>{success}</div>}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px 0',
                background: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontWeight: 600,
                fontSize: 16,
                cursor: 'pointer',
                boxShadow: '0 2px 8px 0 rgba(59, 130, 246, 0.10)',
                marginBottom: 12,
                transition: 'background 0.2s',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Changing...' : 'Change Password'}
            </button>
          </form>
        </div>
      ) : (
        // Desktop Layout
        <div style={{
          display: 'flex',
          width: 420,
          minHeight: 420,
          background: '#fff',
          borderRadius: 18,
          boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
          overflow: 'hidden',
          zIndex: 2,
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px 24px',
          position: 'relative',
        }}>
          <button
            onClick={() => navigate('/admin-dashboard')}
            style={{
              position: 'absolute',
              top: 16,
              right: 16,
              background: 'rgba(100, 116, 139, 0.1)',
              border: 'none',
              borderRadius: '50%',
              width: 36,
              height: 36,
              fontSize: 20,
              color: '#64748b',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={e => {
              e.target.style.background = 'rgba(100, 116, 139, 0.2)';
              e.target.style.color = '#475569';
            }}
            onMouseLeave={e => {
              e.target.style.background = 'rgba(100, 116, 139, 0.1)';
              e.target.style.color = '#64748b';
            }}
          >
            ×
          </button>
          <img src={TallyLogo} alt="Tally Logo" style={{ width: 120, height: 120, objectFit: 'contain', marginBottom: 4, marginTop: 0 }} />
          <h2 style={{ textAlign: 'center', marginBottom: 18, color: '#1e40af', fontWeight: 700 }}>Change Password</h2>
          <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 300 }}>
            <div style={{ marginBottom: 18, position: 'relative' }}>
              <input
                id="oldPassword"
                type="password"
                value={oldPassword}
                onChange={e => setOldPassword(e.target.value)}
                required
                onFocus={() => setOldFocused(true)}
                onBlur={() => setOldFocused(false)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  fontSize: 15,
                  outline: 'none',
                  transition: 'border 0.2s',
                  marginBottom: 2,
                }}
              />
              <label
                htmlFor="oldPassword"
                style={{
                  position: 'absolute',
                  left: 12,
                  top: oldFocused || oldPassword ? '-10px' : '10px',
                  fontSize: oldFocused || oldPassword ? 14 : 15,
                  fontWeight: 600,
                  color: '#60a5fa',
                  backgroundColor: '#fff',
                  padding: '0 6px',
                  transition: 'all 0.25s cubic-bezier(.4,0,.2,1)',
                  pointerEvents: 'none',
                  letterSpacing: 0.5,
                  fontFamily: 'Segoe UI, Roboto, Arial, sans-serif',
                }}
              >
                Old Password
              </label>
            </div>
            <div style={{ marginBottom: 18, position: 'relative' }}>
              <input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required
                onFocus={() => setNewFocused(true)}
                onBlur={() => setNewFocused(false)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  fontSize: 15,
                  outline: 'none',
                  transition: 'border 0.2s',
                  marginBottom: 2,
                }}
              />
              <label
                htmlFor="newPassword"
                style={{
                  position: 'absolute',
                  left: 12,
                  top: newFocused || newPassword ? '-10px' : '10px',
                  fontSize: newFocused || newPassword ? 14 : 15,
                  fontWeight: 600,
                  color: '#60a5fa',
                  backgroundColor: '#fff',
                  padding: '0 6px',
                  transition: 'all 0.25s cubic-bezier(.4,0,.2,1)',
                  pointerEvents: 'none',
                  letterSpacing: 0.5,
                  fontFamily: 'Segoe UI, Roboto, Arial, sans-serif',
                }}
              >
                New Password
              </label>
            </div>
            <div style={{ marginBottom: 18, position: 'relative' }}>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                onFocus={() => setConfirmFocused(true)}
                onBlur={() => setConfirmFocused(false)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  fontSize: 15,
                  outline: 'none',
                  transition: 'border 0.2s',
                  marginBottom: 2,
                }}
              />
              <label
                htmlFor="confirmPassword"
                style={{
                  position: 'absolute',
                  left: 12,
                  top: confirmFocused || confirmPassword ? '-10px' : '10px',
                  fontSize: confirmFocused || confirmPassword ? 14 : 15,
                  fontWeight: 600,
                  color: '#60a5fa',
                  backgroundColor: '#fff',
                  padding: '0 6px',
                  transition: 'all 0.25s cubic-bezier(.4,0,.2,1)',
                  pointerEvents: 'none',
                  letterSpacing: 0.5,
                  fontFamily: 'Segoe UI, Roboto, Arial, sans-serif',
                }}
              >
                Confirm New Password
              </label>
            </div>
            {error && <div style={{ color: 'red', fontSize: 14, marginBottom: 10 }}>{error}</div>}
            {success && <div style={{ color: 'green', fontSize: 14, marginBottom: 10 }}>{success}</div>}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px 0',
                background: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontWeight: 600,
                fontSize: 16,
                cursor: 'pointer',
                boxShadow: '0 2px 8px 0 rgba(59, 130, 246, 0.10)',
                marginBottom: 18,
                transition: 'background 0.2s',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Changing...' : 'Change Password'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export default ChangePassword; 