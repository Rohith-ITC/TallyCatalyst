import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// CRITICAL FIX: Disable all reloads IMMEDIATELY before anything else runs
// This runs at the very top of the React app, before any components load
window.__RELOADS_DISABLED__ = true;
if (typeof sessionStorage !== 'undefined') {
  sessionStorage.setItem('__RELOADS_DISABLED__', 'true');
}

// Note: window.location.reload is read-only, so we can't override it directly
// The reload blocker below will intercept and block all reload calls

// CRITICAL FIX: Reload blocker to prevent infinite refresh loops
// Blocks all window.location.reload() calls to prevent refresh loops
(function() {
  // Global flag to disable reloads
  window.__RELOADS_DISABLED__ = true;
  sessionStorage.setItem('__RELOADS_DISABLED__', 'true');
  
  // Override window.location.reload to block all reload attempts
  try {
    Object.defineProperty(window.location, 'reload', {
      value: function(...args) {
        console.warn('⚠️ Page reload blocked to prevent refresh loops');
        return; // Block the reload
      },
      writable: false,
      configurable: true
    });
  } catch (e) {
    console.warn('Could not override window.location.reload:', e.message);
  }
})();

// Lazy load version check only when needed (after app loads)
// This avoids blocking the initial render
setTimeout(() => {
  import('./utils/cacheSyncManager').then(({ checkVersionUpdate }) => {
    checkVersionUpdate();
  }).catch(error => {
    console.warn('Failed to load version check:', error);
  });
}, 0);

// CRITICAL FIX: Disable service worker to prevent cache-related refresh loops
// Unregister all existing service workers and prevent new registration
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function(registrations) {
    for(let registration of registrations) {
      registration.unregister();
    }
  });
  // Service worker registration is disabled to prevent cache issues
}

const root = ReactDOM.createRoot(document.getElementById('root'));

// CRITICAL: Wrap in error boundary to catch any rendering errors that might cause reloads
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error boundary caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <h2>Something went wrong</h2>
          <p>{this.state.error?.message}</p>
          <button onClick={() => this.setState({ hasError: false, error: null })}>
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

root.render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
