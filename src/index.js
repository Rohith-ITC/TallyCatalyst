import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// Debug: Check sessionStorage at the VERY START (before anything runs)
console.log('🚀🚀🚀 APP STARTING - INITIAL SESSION CHECK 🚀🚀🚀');
console.log('🚀 sessionStorage at startup:', {
  token: !!sessionStorage.getItem('token'),
  email: !!sessionStorage.getItem('email'),
  name: !!sessionStorage.getItem('name'),
  allKeys: Object.keys(sessionStorage),
  allValues: Object.keys(sessionStorage).reduce((acc, key) => {
    acc[key] = sessionStorage.getItem(key)?.substring(0, 30) || null;
    return acc;
  }, {})
});

// Lazy load version check only when needed (after app loads)
// This avoids blocking the initial render
setTimeout(() => {
  import('./utils/cacheSyncManager').then(({ checkVersionUpdate }) => {
    checkVersionUpdate();
  }).catch(error => {
    console.warn('Failed to load version check:', error);
  });
}, 0);

// Register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registered: ', registration);
      })
      .catch((registrationError) => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <App />
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
