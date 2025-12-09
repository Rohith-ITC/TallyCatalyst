import React, { useState } from 'react';
import TallyLogo from './DLrlogo.png';
import LedgerVouchers from './LedgerVouchers';
import './AdminHomeResponsive.css';

const SIDEBAR_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { key: 'ledger', label: 'Ledger Vouchers', icon: 'menu_book' },
  { key: 'bills', label: 'Bill Outstanding', icon: 'receipt_long' },
  { key: 'stock', label: 'Stock Availability Check', icon: 'inventory_2' },
  { key: 'sales', label: 'Sales Order Entry', icon: 'assignment_turned_in' },
];

const PAGE_PLACEHOLDERS = {
  dashboard: 'Dashboard Page Coming Soon!',
  bills: 'Bill Outstanding Page Coming Soon!',
  stock: 'Stock Availability Check Page Coming Soon!',
  sales: 'Sales Order Entry Page Coming Soon!',
};

function UserDashboard({ onLogout }) {
  const [selected, setSelected] = useState('dashboard');

  return (
    <div className="adminhome-container">
      <aside className="adminhome-sidebar">
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <img src={TallyLogo} alt="Tally Logo" className="tally-logo" />
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 18, fontSize: 17 }}>
          {SIDEBAR_ITEMS.map(item => (
            <a
              key={item.key}
              href="#"
              onClick={e => { e.preventDefault(); setSelected(item.key); }}
              style={{
                color: selected === item.key ? '#ff9800' : '#fff',
                background: selected === item.key ? 'rgba(255,152,0,0.08)' : 'transparent',
                textDecoration: 'none',
                padding: '10px 32px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                borderRadius: 8,
                fontWeight: selected === item.key ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <span className="material-icons" style={{ fontSize: 20 }}>{item.icon}</span>
              {item.label}
            </a>
          ))}
          {/* Logout in sidebar, styled like admin */}
          <a
            href="#"
            onClick={e => { e.preventDefault(); if (onLogout) onLogout(); }}
            style={{
              color: '#fff',
              textDecoration: 'none',
              padding: '10px 32px',
              marginTop: 32,
              borderTop: '1px solid #3b82f6',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 17,
              cursor: 'pointer',
              background: 'rgba(220,38,38,0.08)'
            }}
          >
            <span className="material-icons" style={{ fontSize: 20 }}>logout</span>
            Logout
          </a>
        </nav>
      </aside>
      <main className="adminhome-main">
        {selected === 'ledger' ? (
          <LedgerVouchers />
        ) : (
          <div className="tally-config-card" style={{ minWidth: 0, maxWidth: 500 }}>
            <h2 style={{ color: '#1e40af', fontWeight: 700, marginBottom: 24 }}>{SIDEBAR_ITEMS.find(i => i.key === selected).label}</h2>
            <p style={{ color: '#64748b', fontSize: 16, margin: 0 }}>{PAGE_PLACEHOLDERS[selected]}</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default UserDashboard; 