import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function Welcome() {
  const navigate = useNavigate();

  return (
    <div className="page-center">
      <div className="welcome-card animate-fade-in-up">

        {/* Emblem */}
        <div className="welcome-emblem">
          <svg viewBox="0 0 24 24">
            <path d="M9 12h6M12 9v6" strokeLinecap="round" />
            <path d="M3 9a4 4 0 014-4h10a4 4 0 014 4v6a4 4 0 01-4 4H7a4 4 0 01-4-4V9z" />
          </svg>
        </div>

        {/* Heading */}
        <h1>Welcome to Health Risk<br />Prediction System</h1>
        <p className="welcome-subtitle">
          Enter your symptoms and receive AI-powered diagnostic insights,
          personalized conditions & medication guidance — all in seconds.
        </p>

        {/* Feature highlights */}
        <div className="welcome-features">
          <div className="welcome-feature">
            <div className="welcome-feature-icon">
              <svg viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
              </svg>
            </div>
            <span>Symptom Search</span>
          </div>
          <div className="welcome-feature">
            <div className="welcome-feature-icon">
              <svg viewBox="0 0 24 24">
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" strokeLinecap="round" />
                <rect x="9" y="3" width="6" height="4" rx="1" />
                <path d="M9 12h6M9 16h4" strokeLinecap="round" />
              </svg>
            </div>
            <span>Diagnosis Report</span>
          </div>
          <div className="welcome-feature">
            <div className="welcome-feature-icon">
              <svg viewBox="0 0 24 24">
                <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" strokeLinecap="round" />
              </svg>
            </div>
            <span>Health Records</span>
          </div>
        </div>

        {/* Continue CTA */}
        <button
          className="welcome-continue-btn"
          onClick={() => navigate('/signin')}
        >
          Continue
          <svg viewBox="0 0 24 24">
            <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Already have account */}
        <div className="welcome-divider">
          <span>already a member?</span>
        </div>
        <div className="welcome-signin-link">
          <button onClick={() => navigate('/signin')}>Sign in to your account</button>
        </div>

      </div>
    </div>
  );
}
