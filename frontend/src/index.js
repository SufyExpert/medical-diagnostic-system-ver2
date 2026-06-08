import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import axios from 'axios';

// Configure Axios base URL dynamically for local dev vs. Vercel services deployment
axios.interceptors.request.use((config) => {
  if (config.url && config.url.startsWith('/api/')) {
    let apiBase = process.env.REACT_APP_API_URL;
    if (apiBase === undefined) {
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        apiBase = 'http://localhost:5000';
      } else {
        apiBase = '/_/backend';
      }
    }
    config.url = `${apiBase}${config.url}`;
  }
  return config;
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<React.StrictMode><App /></React.StrictMode>);
