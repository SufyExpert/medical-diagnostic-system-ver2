import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import axios from 'axios';

// Configure Axios base URL: add localhost prefix only in local dev
// On production Vercel, /api/* is routed by vercel.json directly to the Python function
axios.interceptors.request.use((config) => {
  if (config.url && config.url.startsWith('/api/')) {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocal) {
      config.url = `http://localhost:5000${config.url}`;
    }
    // On Vercel: /api/* routes directly to the Python serverless function — no prefix change needed
  }
  return config;
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<React.StrictMode><App /></React.StrictMode>);
