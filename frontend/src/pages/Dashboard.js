import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';

const menuItems = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <circle cx="11" cy="11" r="8" />
        <path d="M21 21l-4.35-4.35" />
        <path d="M11 8v6M8 11h6" />
      </svg>
    ),
    title: 'Start Diagnosis',
    desc: 'Enter your symptoms and receive an AI-powered diagnosis with medication guidance.',
    path: '/diagnosis',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0z" />
        <path d="M12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
    title: 'My Profile',
    desc: 'View your personal details, health records, and track your condition history.',
    path: '/profile',
  },
];

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.full_name?.split(' ')[0] || user?.username;

  return (
    <div className="page">

      {/* Hero banner */}
      <div className="dashboard-hero">
        <div className="dashboard-hero-actions">
          <h1>{greeting}, {firstName}</h1>
          <p>Welcome to your medical diagnostic dashboard. How can we help you today?</p>
          <button
            className="dashboard-hero-btn"
            onClick={() => navigate('/diagnosis')}
          >
            Start New Diagnosis
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        </div>
        {/* Hidden image placeholder — remove if no image available */}
        <img
          src="/images/hero.png"
          alt="Medical"
          style={{ width: 130, opacity: 0.85, borderRadius: 10, position: 'relative', zIndex: 1 }}
          onError={e => { e.target.style.display = 'none'; }}
        />
      </div>

      {/* Stats strip */}
      <div className="dashboard-stats">
        <div className="dashboard-stat-card">
          <div className="dashboard-stat-icon" style={{ background: 'var(--teal-light)' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="1.8" strokeLinecap="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </div>
          <div>
            <div className="dashboard-stat-label">AI-Powered</div>
            <div className="dashboard-stat-value">Symptom Analysis</div>
          </div>
        </div>
        <div className="dashboard-stat-card">
          <div className="dashboard-stat-icon" style={{ background: 'var(--bg-rose)' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--rose)" strokeWidth="1.8" strokeLinecap="round">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
              <rect x="9" y="3" width="6" height="4" rx="1" />
              <path d="M9 12h6M9 16h4" />
            </svg>
          </div>
          <div>
            <div className="dashboard-stat-label">Health Records</div>
            <div className="dashboard-stat-value">Tracked in Profile</div>
          </div>
        </div>
        <div className="dashboard-stat-card">
          <div className="dashboard-stat-icon" style={{ background: '#e8f8f3' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#1a9e7a" strokeWidth="1.8" strokeLinecap="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div>
            <div className="dashboard-stat-label">Secure &amp; Private</div>
            <div className="dashboard-stat-value">Your Data is Safe</div>
          </div>
        </div>
      </div>

      {/* Menu cards */}
      <div className="dashboard-grid">
        {menuItems.map(item => (
          <div className="menu-card" key={item.title} onClick={() => navigate(item.path)}>
            <div className="menu-icon">{item.icon}</div>
            <div>
              <h3>{item.title}</h3>
              <p>{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
