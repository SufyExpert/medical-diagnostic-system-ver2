import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const handleLogout = () => { logout(); navigate('/'); };

  const initials = (user?.full_name || user?.username || '?')
    .split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <nav className="navbar">
      <div className="navbar-brand" onClick={() => navigate('/dashboard')}>
        <div className="navbar-brand-icon">
          <svg viewBox="0 0 24 24">
            <path d="M9 12h6M12 9v6" strokeLinecap="round" />
            <path d="M3 9a4 4 0 014-4h10a4 4 0 014 4v6a4 4 0 01-4 4H7a4 4 0 01-4-4V9z" />
          </svg>
        </div>
        MediDiagnose
      </div>
      <div className="navbar-actions">
        <div className="navbar-user">
          <div className="navbar-user-dot">{initials}</div>
          {user?.full_name || user?.username}
        </div>
        <button className="navbar-logout" onClick={handleLogout}>Sign Out</button>
      </div>
    </nav>
  );
}
