import React, { useState, useEffect } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';

import Login from './login/Login';
import SignUp from './login/SignUp';
import ForgotPassword from './login/ForgotPassword';
import AdminHome from './AdminHome';
import UserDashboard from './UserDashboard';
import AdminDashboard from './admindashboard/Dashboard';
import ChangePassword from './admindashboard/ChangePassword';
import TallyDashboard from './TallyDashboard/tallydashboard';
import MasterInvitationForm from './TallyDashboard/MasterInvitationForm';
import SubscriptionPlans from './subscription/SubscriptionPlans';
import { APP_CONFIG } from './config';

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

  const handleLogout = () => {
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
      <Routes>
        <Route path="/" element={<Login onLogin={handleLogin} />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/master-form/:token" element={<MasterInvitationForm />} />

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
              <SubscriptionPlans />
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
    </Router>
  );
}

export default App;
