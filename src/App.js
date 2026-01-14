import React, { useState, useEffect, Suspense, lazy } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';

// Keep Login as regular import since it's the landing page and should load immediately
import Login from './login/Login';

// Lazy load all other components for better initial load performance
const SignUp = lazy(() => import('./login/SignUp'));
const ForgotPassword = lazy(() => import('./login/ForgotPassword'));
const LandingPage = lazy(() => import('./LandingPage'));
const AdminHome = lazy(() => import('./AdminHome'));
const UserDashboard = lazy(() => import('./UserDashboard'));
const AdminDashboard = lazy(() => import('./admindashboard/Dashboard'));
const ChangePassword = lazy(() => import('./admindashboard/ChangePassword'));
const TallyDashboard = lazy(() => import('./TallyDashboard/tallydashboard'));
const SubscriptionManagement = lazy(() => import('./admindashboard/SubscriptionManagement'));
const MasterInvitationForm = lazy(() => import('./TallyDashboard/MasterInvitationForm'));
const PrivacyPolicy = lazy(() => import('./PrivacyPolicy'));
const TermsOfService = lazy(() => import('./TermsOfService'));

// Protected Route Component
function ProtectedRoute({ children }) {
  const token = sessionStorage.getItem('token');
  const email = sessionStorage.getItem('email');
  const name = sessionStorage.getItem('name');

  // Debug: Detect page refresh
  const isRefresh = performance.navigation?.type === 1 || 
                   performance.getEntriesByType('navigation')[0]?.type === 'reload';

  console.log('🔐 ProtectedRoute check:', {
    isRefresh,
    token: !!token,
    email: !!email,
    name: !!name,
    tokenLength: token ? token.length : 0,
    path: window.location.pathname,
    sessionKeys: Object.keys(sessionStorage),
    sessionSize: Object.keys(sessionStorage).length
  });

  if (!token || !email) {
    console.error('❌ ProtectedRoute: Auth failed - redirecting to login', {
      missingToken: !token,
      missingEmail: !email,
      isRefresh
    });
    return <Navigate to="/" replace />;
  }

  console.log('✅ ProtectedRoute: Auth passed');
  return children;
}

function App() {
  const [user, setUser] = useState(null);
  const [showTallyConfig, setShowTallyConfig] = useState(false);

  // Idle timeout (1 hour)
  useEffect(() => {
    if (!user) return;
    let timeout;
    const resetTimer = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        handleLogout();
      }, 60 * 60 * 1000); // 1 hour
    };

    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keydown', resetTimer);
    window.addEventListener('click', resetTimer);
    resetTimer();

    return () => {
      clearTimeout(timeout);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
      window.removeEventListener('click', resetTimer);
    };
  }, [user]);

  // Auto-logout on browser/tab close
  useEffect(() => {
    const handleBeforeUnload = () => {
      localStorage.removeItem('user');

      const userObj = JSON.parse(localStorage.getItem('user'));
      if (userObj && userObj.username) {
        localStorage.removeItem(`tallyCompaniesCache_${userObj.username}`);
        Object.keys(localStorage).forEach((key) => {
          if (key.startsWith(`tallyLedgersCache_${userObj.username}_`)) {
            localStorage.removeItem(key);
          }
        });
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Load user on app start
  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const handleLogin = (userObj) => {
    setUser(userObj);
    localStorage.setItem('user', JSON.stringify(userObj));
  };

  const handleLogout = async () => {
    // Clear cache for external users
    try {
      const accessType = sessionStorage.getItem('access_type') || '';
      // Import dynamically to avoid circular dependencies
      const { isExternalUser, clearAllCacheForExternalUser } = await import('./utils/cacheUtils');
      if (accessType.toLowerCase() === 'external' || isExternalUser()) {
        console.log('🧹 Clearing cache for external user on logout...');
        await clearAllCacheForExternalUser();
      }
    } catch (error) {
      console.error('Error clearing cache on logout:', error);
      // Continue with logout even if cache clearing fails
    }
    
    const userObj = JSON.parse(localStorage.getItem('user'));
    if (userObj && userObj.username) {
      localStorage.removeItem(`tallyCompaniesCache_${userObj.username}`);
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith(`tallyLedgersCache_${userObj.username}_`)) {
          localStorage.removeItem(key);
        }
      });
    }
    setUser(null);
    localStorage.removeItem('user');
  };

  const handleShowTallyConfig = (show) => {
    setShowTallyConfig(show);
  };
  
  return (
    <Router basename={process.env.REACT_APP_HOMEPAGE || ''}>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<Login onLogin={handleLogin} />} />
          <Route path="/home" element={<LandingPage />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/master-form/:token" element={<MasterInvitationForm />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/terms-of-service" element={<TermsOfService />} />

          <Route
            path="/admin-dashboard"
            element={
              <ProtectedRoute>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/change-password"
            element={
              <ProtectedRoute>
                <ChangePassword />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tally-dashboard"
            element={
              <ProtectedRoute>
                <TallyDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/subscription"
            element={
              <ProtectedRoute>
                <SubscriptionManagement />
              </ProtectedRoute>
            }
          />

          {user && user.role === 'admin' && (
            <Route
              path="/admin"
              element={
                <AdminHome
                  onLogout={handleLogout}
                  onShowTallyConfig={handleShowTallyConfig}
                />
              }
            />
          )}
          {user && user.role === 'user' && (
            <Route
              path="/user"
              element={<UserDashboard onLogout={handleLogout} />}
            />
          )}
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
