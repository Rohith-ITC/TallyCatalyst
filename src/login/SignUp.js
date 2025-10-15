import React, { useState, useEffect } from 'react';
import TallyLogo from '../Tally1.png';
import { Link, useNavigate } from 'react-router-dom';
import { getApiUrl } from '../config';
import { apiPost } from '../utils/apiUtils';
import { COPYRIGHT_CONFIG } from '../config/copyright';

function SignUp() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mobilno, setMobilno] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();
  const [nameFocused, setNameFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [mobilenoFocused, setMobilenoFocused] = useState(false);

  useEffect(() => {
    if (success && !error) {
      const timer = setTimeout(() => {
        navigate('/');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [success, error, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    // Trim leading and trailing spaces from input values
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedMobilno = mobilno.trim();
    
    if (!trimmedName || !trimmedEmail || !trimmedMobilno) {
      setError('All fields are required');
      return;
    }
    setLoading(true);
    try {
      console.log('Sending signup request...');
      const data = await apiPost('/api/signup', { 
        name: trimmedName, 
        email: trimmedEmail, 
        mobileno: trimmedMobilno 
      });
      
      console.log('Signup response:', data);
      
      // Check if the response contains an error
      if (data && data.error) {
        console.log('Setting error:', data.error);
        setError(data.error);
        // Clear error message after 3 seconds
        setTimeout(() => {
          setError('');
        }, 3000);
      } else if (data && data.message) {
        console.log('Signup successful');
      setSuccess(data.message || 'Sign up successful! Please login.');
      setName('');
      setEmail('');
      setMobilno('');
      } else {
        console.log('Invalid response from server');
        setError('Invalid response from server');
        // Clear error message after 3 seconds
        setTimeout(() => {
          setError('');
        }, 3000);
      }
    } catch (err) {
      console.log('Signup error:', err.message);
      setError(err.message);
      // Clear error message after 3 seconds
      setTimeout(() => {
        setError('');
      }, 3000);
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
        }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#1e40af', marginBottom: 12, textAlign: 'center' }}>Sign Up</div>
          <img src={TallyLogo} alt="Tally Logo" style={{ width: 64, height: 64, objectFit: 'contain', marginBottom: 8, marginTop: 0 }} />
          <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 300 }}>
            <div style={{ marginBottom: 12, position: 'relative' }}>
              <input
                id="name"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                onFocus={() => setNameFocused(true)}
                onBlur={() => setNameFocused(false)}
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
                htmlFor="name"
                style={{
                  position: 'absolute',
                  left: 12,
                  top: nameFocused || name ? '-10px' : '10px',
                  fontSize: nameFocused || name ? 14 : 15,
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
                Name
              </label>
            </div>
            <div style={{ marginBottom: 12, position: 'relative' }}>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
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
            <div style={{ marginBottom: 12, position: 'relative' }}>
              <input
                id="mobileno"
                type="tel"
                value={mobilno}
                onChange={e => setMobilno(e.target.value)}
                required
                onFocus={() => setMobilenoFocused(true)}
                onBlur={() => setMobilenoFocused(false)}
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
                htmlFor="mobileno"
                style={{
                  position: 'absolute',
                  left: 12,
                  top: mobilenoFocused || mobilno ? '-10px' : '10px',
                  fontSize: mobilenoFocused || mobilno ? 14 : 15,
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
                Mobile No
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
                opacity: loading ? 0.7 : 1 
              }}
            >
              Sign Up
            </button>
          </form>
          <div style={{ marginTop: 8 }}>
            <span style={{ fontSize: 14, color: '#64748b' }}>Already have an account? <Link to="/" style={{ color: '#3b82f6', fontWeight: 600, textDecoration: 'none' }}>Login</Link></span>
          </div>
        </div>
      ) : (
        // Desktop Layout
        <div style={{
          display: 'flex',
          width: 800,
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
            <div style={{ fontSize: 32, fontWeight: 800, margin: 0, marginTop: 24, marginLeft: 24, letterSpacing: 1 }}>TallyCatalyst</div>
            <ul style={{ fontSize: 16, lineHeight: 2, margin: '24px 0 0 0', marginLeft: 28, color: '#e0e7ef', fontWeight: 500, listStyle: 'none', paddingLeft: 0 }}>
              <li><span className="material-icons" style={{ verticalAlign: 'middle', marginRight: 8 }}>dashboard</span> Dashboard</li>
              <li><span className="material-icons" style={{ verticalAlign: 'middle', marginRight: 8 }}>menu_book</span> Ledger vouchers</li>
              <li><span className="material-icons" style={{ verticalAlign: 'middle', marginRight: 8 }}>receipt_long</span> Bills wise Outstanding</li>
              <li><span className="material-icons" style={{ verticalAlign: 'middle', marginRight: 8 }}>inventory_2</span> Stock availability check</li>
              <li><span className="material-icons" style={{ verticalAlign: 'middle', marginRight: 8 }}>assignment_turned_in</span> Sales order entry</li>
              <li><span className="material-icons" style={{ verticalAlign: 'middle', marginRight: 8 }}>more_horiz</span> Many more</li>
            </ul>
          </div>
          {/* Right Section: Sign Up Form */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '8px 32px',
          }}>
            <img src={TallyLogo} alt="Tally Logo" style={{ width: 200, height: 200, objectFit: 'contain', marginBottom: 4, marginTop: 0 }} />
            <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 300 }}>
              <div style={{ marginBottom: 18, position: 'relative' }}>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  onFocus={() => setNameFocused(true)}
                  onBlur={() => setNameFocused(false)}
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
                  htmlFor="name"
                  style={{
                    position: 'absolute',
                    left: 12,
                    top: nameFocused || name ? '-10px' : '10px',
                    fontSize: nameFocused || name ? 14 : 15,
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
                  Name
                </label>
              </div>
              <div style={{ marginBottom: 18, position: 'relative' }}>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
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
              <div style={{ marginBottom: 18, position: 'relative' }}>
                <input
                  id="mobileno"
                  type="tel"
                  value={mobilno}
                  onChange={e => setMobilno(e.target.value)}
                  required
                  onFocus={() => setMobilenoFocused(true)}
                  onBlur={() => setMobilenoFocused(false)}
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
                  htmlFor="mobileno"
                  style={{
                    position: 'absolute',
                    left: 12,
                    top: mobilenoFocused || mobilno ? '-10px' : '10px',
                    fontSize: mobilenoFocused || mobilno ? 14 : 15,
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
                  Mobile No
                </label>
              </div>
              {error && <div style={{ color: 'red', marginBottom: 10 }}>{error}</div>}
              {success && <div style={{ color: 'green', marginBottom: 10 }}>{success}</div>}
              <button type="submit" disabled={loading} style={{ width: '100%', padding: '12px 0', background: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 16, cursor: 'pointer', boxShadow: '0 2px 8px 0 rgba(59, 130, 246, 0.10)', marginBottom: 18, transition: 'background 0.2s', opacity: loading ? 0.7 : 1 }}>Sign Up</button>
            </form>
            <div style={{ marginTop: 8 }}>
              <span style={{ fontSize: 14, color: '#64748b' }}>Already have an account? <Link to="/" style={{ color: '#3b82f6', fontWeight: 600, textDecoration: 'none' }}>Login</Link></span>
            </div>
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
        <span style={{
          fontSize: '16px',
          color: '#64748b',
          fontFamily: 'Segoe UI, Roboto, Arial, sans-serif',
          fontWeight: '500'
        }}>
                       © <span style={{ color: COPYRIGHT_CONFIG.ORANGE_COLOR, fontWeight: '700' }}>{COPYRIGHT_CONFIG.ORANGE_PART}</span> {COPYRIGHT_CONFIG.COMPANY_NAME.replace(COPYRIGHT_CONFIG.ORANGE_PART, '').trim()}
        </span>
      </div>
    </div>
  );
}

export default SignUp; 