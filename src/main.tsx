import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

// Hash-based routing — no extra dependency needed
// /#/admin  → AdminApp
// /#/       → Main concierge App (default)

async function mount() {

  const path = window.location.pathname;

  console.log('pathname:', path);

  const isAdmin = path == '/admin' || path.startsWith('/admin/');

  if (isAdmin) {
    const { AdminApp } = await import('./admin/AdminApp');
    ReactDOM.createRoot(document.getElementById('root')!).render(
      <React.StrictMode>
        <AdminApp />
      </React.StrictMode>
    );
  } else {
    const { default: App } = await import('./App');
    ReactDOM.createRoot(document.getElementById('root')!).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  }
}

mount();
