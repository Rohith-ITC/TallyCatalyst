import React, { useState } from 'react';
import TallyLogo from '../DLrlogo.png';
import { Link, useNavigate } from 'react-router-dom';
import { getApiUrl } from '../config';
import { apiPost } from '../utils/apiUtils';
import { COPYRIGHT_CONFIG } from '../config/copyright';

function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setError('');
    setLoading(true);
    
    // Trim leading and trailing spaces from input values
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    
    try {
      console.log('Sending login request...');
      const data = await apiPost('/api/login', { 
        email: trimmedEmail, 
        password: trimmedPassword 
      });
      
      console.log('Login response:', data);
      
      // Check if the response contains an error
      if (data && data.error) {
        console.log('Setting error:', data.error);
        setError(data.error);
        // Clear error message after 3 seconds
        setTimeout(() => {
          setError('');
        }, 3000);
      } else if (data && data.token) {
        console.log('Login successful, navigating...');
      // Store in sessionStorage
      sessionStorage.setItem('name', data.name);
      sessionStorage.setItem('email', data.email);
      sessionStorage.setItem('token', data.token);
      // Call onLogin with user info
      onLogin({ name: data.name, email: data.email, token: data.token, is_first_login: data.is_first_login });
      if (data.is_first_login === 1) {
        navigate('/change-password');
      } else {
        navigate('/admin-dashboard');
        }
      } else {
        console.log('Invalid response from server');
        setError('Invalid response from server');
        // Clear error message after 3 seconds
        setTimeout(() => {
          setError('');
        }, 3000);
      }
    } catch (err) {
      console.log('Login error:', err.message);
      setError(err.message);
      // Clear error message after 3 seconds
      setTimeout(() => {
        setError('');
      }, 3000);
    } finally {
      setLoading(false);
    }
  };

  // Tally-inspired background: soft green/blue gradient, faint grid, and a watermark icon
  return (
    <>
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
          }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#1e40af', marginBottom: 12, textAlign: 'center' }}>DataLynkr</div>
            <img src={TallyLogo} alt="Tally Logo" style={{ width: 72, height: 72, objectFit: 'contain', marginBottom: 24, marginTop: 0 }} />
            <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 300 }}>
              <div style={{ marginBottom: 12, position: 'relative' }}>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
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
                  htmlFor="email" 
                  style={{
                    position: 'absolute',
                    left: 12,
                    top: emailFocused || email ? '-10px' : '10px',
                    fontSize: emailFocused || email ? 14 : 15,
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
                  Email ID
                </label>
              </div>
              <div style={{ marginBottom: 16, position: 'relative' }}>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
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
                  htmlFor="password" 
                  style={{
                    position: 'absolute',
                    left: 12,
                    top: passwordFocused || password ? '-10px' : '10px',
                    fontSize: passwordFocused || password ? 14 : 15,
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
                  Password
                </label>
              </div>
              {error && (
                <div style={{ color: 'red', fontSize: 14, marginBottom: 12 }}>{error}</div>
              )}
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
                   cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 8px 0 rgba(59, 130, 246, 0.10)',
                  marginBottom: 12,
                  transition: 'background 0.2s',
                   opacity: loading ? 0.7 : 1,
                }}
              >
                 {loading ? 'Logging in...' : 'Login'}
              </button>
              <div style={{ textAlign: 'right', marginBottom: 8 }}>
                <Link to="/forgot-password" style={{ color: '#3b82f6', fontSize: 14, textDecoration: 'none', fontWeight: 500 }}>Forgot Password?</Link>
              </div>
              <div style={{ textAlign: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 14, color: '#64748b' }}>Don't have an account? <Link to="/signup" style={{ color: '#1e40af', fontWeight: 600, textDecoration: 'none' }}>Sign up</Link></span>
              </div>
            </form>
          </div>
        ) : (
          // Desktop Layout
          <div style={{
            display: 'flex',
            width: '90%',
            maxWidth: 800,
            minHeight: 480,
            background: '#fff',
            borderRadius: 18,
            boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
            overflow: 'hidden',
            zIndex: 2,
          }}>
            {/* Left Section: Features */}
            <div style={{
              flex: 1.1,
              background: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)',
              color: '#fff',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-start',
              alignItems: 'flex-start',
              padding: '0 36px 48px 0',
            }}>
              <div style={{ fontSize: 32, fontWeight: 800, margin: 0, marginTop: 24, marginLeft: 24, letterSpacing: 1 }}>DataLynkr</div>
              <ul style={{ fontSize: 16, lineHeight: 2, margin: '24px 0 0 0', marginLeft: 28, color: '#e0e7ef', fontWeight: 500, listStyle: 'none', paddingLeft: 0 }}>
                <li><span className="material-icons" style={{ verticalAlign: 'middle', marginRight: 8 }}>dashboard</span> Dashboard</li>
                <li><span className="material-icons" style={{ verticalAlign: 'middle', marginRight: 8 }}>menu_book</span> Ledger vouchers</li>
                <li><span className="material-icons" style={{ verticalAlign: 'middle', marginRight: 8 }}>receipt_long</span> Bills wise Outstanding</li>
                <li><span className="material-icons" style={{ verticalAlign: 'middle', marginRight: 8 }}>inventory_2</span> Stock availability check</li>
                <li><span className="material-icons" style={{ verticalAlign: 'middle', marginRight: 8 }}>assignment_turned_in</span> Sales order entry</li>
                <li><span className="material-icons" style={{ verticalAlign: 'middle', marginRight: 8 }}>more_horiz</span> Many more</li>
              </ul>
            </div>
            {/* Right Section: Login Form */}
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              padding: '8px 32px',
            }}>
              <img src={TallyLogo} alt="Tally Logo" style={{ width: 160, height: 160, objectFit: 'contain', marginBottom: 20, marginTop: 0 }} />
              <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 300 }}>
                <div style={{ marginBottom: 18, position: 'relative' }}>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => setEmailFocused(false)}
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
                    htmlFor="email" 
                    style={{
                      position: 'absolute',
                      left: 12,
                      top: emailFocused || email ? '-10px' : '10px',
                      fontSize: emailFocused || email ? 14 : 15,
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
                    Email ID
                  </label>
                </div>
                <div style={{ marginBottom: 40, position: 'relative' }}>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    onFocus={() => setPasswordFocused(true)}
                    onBlur={() => setPasswordFocused(false)}
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
                    htmlFor="password" 
                    style={{
                      position: 'absolute',
                      left: 12,
                      top: passwordFocused || password ? '-10px' : '10px',
                      fontSize: passwordFocused || password ? 14 : 15,
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
                    Password
                  </label>
                </div>
                {error && (
                  <div style={{ color: 'red', fontSize: 14, marginBottom: 20 }}>{error}</div>
                )}
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
                     cursor: loading ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 8px 0 rgba(59, 130, 246, 0.10)',
                    marginBottom: 25,
                    transition: 'background 0.2s',
                     opacity: loading ? 0.7 : 1,
                  }}
                >
                   {loading ? 'Logging in...' : 'Login'}
                </button>
                <div style={{ textAlign: 'right', marginBottom: 10 }}>
                  <Link to="/forgot-password" style={{ color: '#3b82f6', fontSize: 14, textDecoration: 'none', fontWeight: 500 }}>Forgot Password?</Link>
                </div>
                <div style={{ textAlign: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 14, color: '#64748b' }}>Don't have an account? <Link to="/signup" style={{ color: '#1e40af', fontWeight: 600, textDecoration: 'none' }}>Sign up</Link></span>
                </div>
              </form>
            </div>
          </div>
        )}
        
        {/* Copyright Footer */}
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          width: '100%',
          textAlign: 'center',
          padding: '12px 0',
          background: 'transparent',
          zIndex: 10,
        }}>
          <div style={{
            fontSize: '16px',
            color: '#64748b',
            fontFamily: 'Segoe UI, Roboto, Arial, sans-serif',
            fontWeight: '500',
            marginBottom: '8px'
          }}>
            © <span style={{ color: COPYRIGHT_CONFIG.ORANGE_COLOR, fontWeight: '700' }}>{COPYRIGHT_CONFIG.ORANGE_PART}</span> {COPYRIGHT_CONFIG.COMPANY_NAME.replace(COPYRIGHT_CONFIG.ORANGE_PART, '').trim()}
          </div>
          <div style={{
            fontSize: '13px',
            color: '#64748b',
            fontFamily: 'Segoe UI, Roboto, Arial, sans-serif',
          }}>
            <Link to="/privacy-policy" style={{ color: '#3b82f6', textDecoration: 'none', margin: '0 12px' }}>Privacy Policy</Link>
            <span style={{ color: '#cbd5e1' }}>|</span>
            <Link to="/terms-of-service" style={{ color: '#3b82f6', textDecoration: 'none', margin: '0 12px' }}>Terms of Service</Link>
          </div>
        </div>
      </div>
    </>
  );
}

export default Login; 