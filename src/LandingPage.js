import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import TallyLogo from './DLrlogo.png';
import { SUBSCRIPTION_PLANS } from './config/subscriptionPlans';
import { COPYRIGHT_CONFIG } from './config/copyright';

function LandingPage() {
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };
    window.addEventListener('scroll', handleScroll);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const scrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#ffffff' }}>
      {/* Navigation Bar */}
      <nav style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        background: isScrolled ? 'rgba(255, 255, 255, 0.95)' : 'transparent',
        backdropFilter: isScrolled ? 'blur(10px)' : 'none',
        boxShadow: isScrolled ? '0 2px 10px rgba(0, 0, 0, 0.1)' : 'none',
        transition: 'all 0.3s ease',
        padding: '16px 0',
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '0 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img src={TallyLogo} alt="DataLynkr Logo" style={{ width: 48, height: 48, objectFit: 'contain' }} />
            <span style={{ fontSize: '24px', fontWeight: 800, color: '#1e40af', letterSpacing: '0.5px' }}>DataLynkr</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <button
              onClick={() => scrollToSection('features')}
              style={{
                background: 'none',
                border: 'none',
                color: '#64748b',
                fontSize: '16px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'color 0.2s',
              }}
              onMouseEnter={(e) => e.target.style.color = '#1e40af'}
              onMouseLeave={(e) => e.target.style.color = '#64748b'}
            >
              Features
            </button>
            <button
              onClick={() => scrollToSection('pricing')}
              style={{
                background: 'none',
                border: 'none',
                color: '#64748b',
                fontSize: '16px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'color 0.2s',
              }}
              onMouseEnter={(e) => e.target.style.color = '#1e40af'}
              onMouseLeave={(e) => e.target.style.color = '#64748b'}
            >
              Pricing
            </button>
            <Link
              to="/"
              style={{
                padding: '10px 24px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)',
                color: '#fff',
                textDecoration: 'none',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '16px',
                transition: 'transform 0.2s, box-shadow 0.2s',
                boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)',
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 2px 8px rgba(59, 130, 246, 0.3)';
              }}
            >
              Login
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #e6f4ea 0%, #dbeafe 100%)',
        position: 'relative',
        overflow: 'hidden',
        paddingTop: '80px',
      }}>
        {/* Background Pattern */}
        <svg
          width="100%"
          height="100%"
          style={{ position: 'absolute', top: 0, left: 0, zIndex: 0, opacity: 0.3 }}
        >
          <defs>
            <pattern id="heroGrid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#b6e0c6" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#heroGrid)" />
        </svg>

        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '0 24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          zIndex: 1,
          position: 'relative',
        }}>
          <h1 style={{
            fontSize: windowWidth <= 768 ? '36px' : '56px',
            fontWeight: 800,
            color: '#1e293b',
            margin: '0 0 24px 0',
            lineHeight: '1.2',
            letterSpacing: '-0.02em',
          }}>
            Unlock the Power of Tally on the Web
          </h1>
          <p style={{
            fontSize: windowWidth <= 768 ? '18px' : '24px',
            color: '#64748b',
            margin: '0 0 40px 0',
            maxWidth: '700px',
            lineHeight: '1.6',
          }}>
            Comprehensive Subscription & Partner Management for Tally Users. Access your data anywhere, anytime with our secure web platform.
          </p>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <Link
              to="/signup"
              style={{
                padding: '16px 32px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)',
                color: '#fff',
                textDecoration: 'none',
                borderRadius: '12px',
                fontWeight: 600,
                fontSize: '18px',
                transition: 'transform 0.2s, box-shadow 0.2s',
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)',
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.5)';
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.4)';
              }}
            >
              Get Started
            </Link>
            <Link
              to="/"
              style={{
                padding: '16px 32px',
                background: '#fff',
                color: '#3b82f6',
                textDecoration: 'none',
                borderRadius: '12px',
                fontWeight: 600,
                fontSize: '18px',
                border: '2px solid #3b82f6',
                transition: 'background 0.2s, color 0.2s',
              }}
              onMouseEnter={(e) => {
                e.target.style.background = '#3b82f6';
                e.target.style.color = '#fff';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = '#fff';
                e.target.style.color = '#3b82f6';
              }}
            >
              Login
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" style={{
        padding: '80px 24px',
        background: '#ffffff',
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <h2 style={{
            fontSize: '40px',
            fontWeight: 800,
            color: '#1e293b',
            textAlign: 'center',
            margin: '0 0 16px 0',
          }}>
            Powerful Features for Every Need
          </h2>
          <p style={{
            fontSize: '20px',
            color: '#64748b',
            textAlign: 'center',
            margin: '0 0 64px 0',
          }}>
            Everything you need to manage your Tally data and subscriptions
          </p>

          <div style={{
            display: 'grid',
            gridTemplateColumns: windowWidth <= 768 ? '1fr' : 'repeat(3, 1fr)',
            gap: '32px',
            marginTop: '48px',
          }}>
            {/* Feature Card 1 */}
            <div style={{
              background: '#fff',
              borderRadius: '16px',
              padding: '32px',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
              border: '1px solid #e2e8f0',
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 8px 16px rgba(0, 0, 0, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
            }}
            >
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '24px',
              }}>
                <span className="material-icons" style={{ fontSize: '32px', color: '#fff' }}>dashboard</span>
              </div>
              <h3 style={{ fontSize: '24px', fontWeight: 700, color: '#1e293b', margin: '0 0 12px 0' }}>
                For Businesses
              </h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, color: '#64748b', lineHeight: '1.8' }}>
                <li><span className="material-icons" style={{ fontSize: '18px', verticalAlign: 'middle', marginRight: '8px', color: '#3b82f6' }}>check_circle</span> Tally Reports & Analytics</li>
                <li><span className="material-icons" style={{ fontSize: '18px', verticalAlign: 'middle', marginRight: '8px', color: '#3b82f6' }}>check_circle</span> Ledger Access & Management</li>
                <li><span className="material-icons" style={{ fontSize: '18px', verticalAlign: 'middle', marginRight: '8px', color: '#3b82f6' }}>check_circle</span> Sales Order Entry</li>
                <li><span className="material-icons" style={{ fontSize: '18px', verticalAlign: 'middle', marginRight: '8px', color: '#3b82f6' }}>check_circle</span> Stock Availability Check</li>
              </ul>
            </div>

            {/* Feature Card 2 */}
            <div style={{
              background: '#fff',
              borderRadius: '16px',
              padding: '32px',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
              border: '1px solid #e2e8f0',
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 8px 16px rgba(0, 0, 0, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
            }}
            >
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '24px',
              }}>
                <span className="material-icons" style={{ fontSize: '32px', color: '#fff' }}>people</span>
              </div>
              <h3 style={{ fontSize: '24px', fontWeight: 700, color: '#1e293b', margin: '0 0 12px 0' }}>
                For Partners
              </h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, color: '#64748b', lineHeight: '1.8' }}>
                <li><span className="material-icons" style={{ fontSize: '18px', verticalAlign: 'middle', marginRight: '8px', color: '#10b981' }}>check_circle</span> Commission Tracking</li>
                <li><span className="material-icons" style={{ fontSize: '18px', verticalAlign: 'middle', marginRight: '8px', color: '#10b981' }}>check_circle</span> Sales Dashboard</li>
                <li><span className="material-icons" style={{ fontSize: '18px', verticalAlign: 'middle', marginRight: '8px', color: '#10b981' }}>check_circle</span> Real-time Earnings</li>
                <li><span className="material-icons" style={{ fontSize: '18px', verticalAlign: 'middle', marginRight: '8px', color: '#10b981' }}>check_circle</span> Performance Analytics</li>
              </ul>
            </div>

            {/* Feature Card 3 */}
            <div style={{
              background: '#fff',
              borderRadius: '16px',
              padding: '32px',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
              border: '1px solid #e2e8f0',
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 8px 16px rgba(0, 0, 0, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
            }}
            >
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '24px',
              }}>
                <span className="material-icons" style={{ fontSize: '32px', color: '#fff' }}>admin_panel_settings</span>
              </div>
              <h3 style={{ fontSize: '24px', fontWeight: 700, color: '#1e293b', margin: '0 0 12px 0' }}>
                For Admins
              </h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, color: '#64748b', lineHeight: '1.8' }}>
                <li><span className="material-icons" style={{ fontSize: '18px', verticalAlign: 'middle', marginRight: '8px', color: '#8b5cf6' }}>check_circle</span> Centralized Management</li>
                <li><span className="material-icons" style={{ fontSize: '18px', verticalAlign: 'middle', marginRight: '8px', color: '#8b5cf6' }}>check_circle</span> Flexible Subscriptions</li>
                <li><span className="material-icons" style={{ fontSize: '18px', verticalAlign: 'middle', marginRight: '8px', color: '#8b5cf6' }}>check_circle</span> User Access Control</li>
                <li><span className="material-icons" style={{ fontSize: '18px', verticalAlign: 'middle', marginRight: '8px', color: '#8b5cf6' }}>check_circle</span> Module Management</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" style={{
        padding: '80px 24px',
        background: 'linear-gradient(135deg, #f8fafc 0%, #e0e7ff 100%)',
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <h2 style={{
            fontSize: '40px',
            fontWeight: 800,
            color: '#1e293b',
            textAlign: 'center',
            margin: '0 0 16px 0',
          }}>
            Choose Your Plan
          </h2>
          <p style={{
            fontSize: '20px',
            color: '#64748b',
            textAlign: 'center',
            margin: '0 0 64px 0',
          }}>
            Flexible pricing plans to suit businesses of all sizes
          </p>

          <div style={{
            display: 'grid',
            gridTemplateColumns: windowWidth <= 768 ? '1fr' : 'repeat(3, 1fr)',
            gap: '32px',
            marginTop: '48px',
          }}>
            {SUBSCRIPTION_PLANS.map((plan) => (
              <div
                key={plan.id}
                style={{
                  background: plan.popular ? 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)' : '#fff',
                  borderRadius: '16px',
                  padding: '40px 32px',
                  boxShadow: plan.popular ? '0 8px 24px rgba(59, 130, 246, 0.3)' : '0 4px 6px rgba(0, 0, 0, 0.1)',
                  border: plan.popular ? 'none' : '1px solid #e2e8f0',
                  position: 'relative',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = plan.popular
                    ? '0 12px 32px rgba(59, 130, 246, 0.4)'
                    : '0 8px 16px rgba(0, 0, 0, 0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = plan.popular
                    ? '0 8px 24px rgba(59, 130, 246, 0.3)'
                    : '0 4px 6px rgba(0, 0, 0, 0.1)';
                }}
              >
                {plan.popular && (
                  <div style={{
                    position: 'absolute',
                    top: '-12px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: '#10b981',
                    color: '#fff',
                    padding: '6px 16px',
                    borderRadius: '20px',
                    fontSize: '14px',
                    fontWeight: 600,
                  }}>
                    Most Popular
                  </div>
                )}
                <h3 style={{
                  fontSize: '28px',
                  fontWeight: 800,
                  color: plan.popular ? '#fff' : '#1e293b',
                  margin: '0 0 8px 0',
                }}>
                  {plan.name}
                </h3>
                <p style={{
                  fontSize: '16px',
                  color: plan.popular ? 'rgba(255, 255, 255, 0.9)' : '#64748b',
                  margin: '0 0 24px 0',
                }}>
                  {plan.description}
                </p>
                <div style={{ marginBottom: '24px' }}>
                  <span style={{
                    fontSize: '48px',
                    fontWeight: 800,
                    color: plan.popular ? '#fff' : '#1e293b',
                  }}>
                    ₹{plan.monthlyPrice.toLocaleString()}
                  </span>
                  <span style={{
                    fontSize: '18px',
                    color: plan.popular ? 'rgba(255, 255, 255, 0.8)' : '#64748b',
                    marginLeft: '8px',
                  }}>
                    /month
                  </span>
                </div>
                <ul style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: '0 0 32px 0',
                  color: plan.popular ? 'rgba(255, 255, 255, 0.95)' : '#64748b',
                  lineHeight: '2',
                }}>
                  {plan.features.slice(0, 6).map((feature, idx) => (
                    <li key={idx} style={{ marginBottom: '8px' }}>
                      <span className="material-icons" style={{
                        fontSize: '18px',
                        verticalAlign: 'middle',
                        marginRight: '8px',
                        color: plan.popular ? '#fff' : '#3b82f6',
                      }}>check_circle</span>
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/signup"
                  style={{
                    display: 'block',
                    textAlign: 'center',
                    padding: '14px 24px',
                    background: plan.popular ? '#fff' : 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)',
                    color: plan.popular ? '#3b82f6' : '#fff',
                    textDecoration: 'none',
                    borderRadius: '8px',
                    fontWeight: 600,
                    fontSize: '16px',
                    transition: 'transform 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.transform = 'scale(1.02)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = 'scale(1)';
                  }}
                >
                  Get Started
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        background: '#1e293b',
        color: '#fff',
        padding: '48px 24px 24px 24px',
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: windowWidth <= 768 ? '1fr' : 'repeat(3, 1fr)',
            gap: '48px',
            marginBottom: '48px',
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <img src={TallyLogo} alt="DataLynkr Logo" style={{ width: 40, height: 40, objectFit: 'contain' }} />
                <span style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '0.5px' }}>DataLynkr</span>
              </div>
              <p style={{ color: '#94a3b8', lineHeight: '1.6', margin: 0 }}>
                Unlock the power of Tally on the cloud. Comprehensive subscription and partner management for Tally users.
              </p>
            </div>
            <div>
              <h4 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 16px 0' }}>Quick Links</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <Link to="/home" style={{ color: '#94a3b8', textDecoration: 'none', transition: 'color 0.2s' }}
                  onMouseEnter={(e) => e.target.style.color = '#fff'}
                  onMouseLeave={(e) => e.target.style.color = '#94a3b8'}
                >
                  Home
                </Link>
                <button
                  onClick={() => scrollToSection('features')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    textAlign: 'left',
                    cursor: 'pointer',
                    padding: 0,
                    transition: 'color 0.2s',
                  }}
                  onMouseEnter={(e) => e.target.style.color = '#fff'}
                  onMouseLeave={(e) => e.target.style.color = '#94a3b8'}
                >
                  Features
                </button>
                <button
                  onClick={() => scrollToSection('pricing')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    textAlign: 'left',
                    cursor: 'pointer',
                    padding: 0,
                    transition: 'color 0.2s',
                  }}
                  onMouseEnter={(e) => e.target.style.color = '#fff'}
                  onMouseLeave={(e) => e.target.style.color = '#94a3b8'}
                >
                  Pricing
                </button>
              </div>
            </div>
            <div>
              <h4 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 16px 0' }}>Legal</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <Link to="/privacy-policy" style={{ color: '#94a3b8', textDecoration: 'none', transition: 'color 0.2s' }}
                  onMouseEnter={(e) => e.target.style.color = '#fff'}
                  onMouseLeave={(e) => e.target.style.color = '#94a3b8'}
                >
                  Privacy Policy
                </Link>
                <Link to="/terms-of-service" style={{ color: '#94a3b8', textDecoration: 'none', transition: 'color 0.2s' }}
                  onMouseEnter={(e) => e.target.style.color = '#fff'}
                  onMouseLeave={(e) => e.target.style.color = '#94a3b8'}
                >
                  Terms of Service
                </Link>
              </div>
            </div>
          </div>
          <div style={{
            borderTop: '1px solid #334155',
            paddingTop: '24px',
            textAlign: 'center',
          }}>
            <div style={{
              fontSize: '16px',
              color: '#94a3b8',
              fontFamily: 'Segoe UI, Roboto, Arial, sans-serif',
              fontWeight: '500',
              marginBottom: '8px'
            }}>
              © <span style={{ color: COPYRIGHT_CONFIG.ORANGE_COLOR, fontWeight: '700' }}>{COPYRIGHT_CONFIG.ORANGE_PART}</span> {COPYRIGHT_CONFIG.COMPANY_NAME.replace(COPYRIGHT_CONFIG.ORANGE_PART, '').trim()}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
