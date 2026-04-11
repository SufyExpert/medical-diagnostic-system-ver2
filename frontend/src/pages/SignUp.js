import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

function UserPlusIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round">
      <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h11" />
      <path d="M19 16v6M16 19h6" />
    </svg>
  );
}

export default function SignUp() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '', full_name: '', dob: '', contact: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handle = e => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    setLoading(true);
    try {
      await axios.post('/api/signup', form);
      setSuccess('Account created successfully! Redirecting to sign in...');
      setTimeout(() => navigate('/signin'), 1800);
    } catch (err) {
      setError(err.response?.data?.error || 'Sign up failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-center">
      <div className="auth-card animate-fade-in-up" style={{ maxWidth: 500 }}>

        <div className="auth-logo">
          <div className="auth-logo-icon">
            <UserPlusIcon />
          </div>
          <h1>Create Account</h1>
          <p>Join MediDiagnose today</p>
        </div>

        {error   && <div className="error-msg"   style={{ marginBottom: 16 }}>{error}</div>}
        {success && <div className="success-msg" style={{ marginBottom: 16 }}>{success}</div>}

        <form className="auth-form" onSubmit={submit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="form-group">
              <label>Username</label>
              <input name="username" placeholder="e.g., john_doe" value={form.username} onChange={handle} required />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input name="password" type="password" placeholder="Choose a password" value={form.password} onChange={handle} required />
            </div>
          </div>
          <div className="form-group">
            <label>Full Name</label>
            <input name="full_name" placeholder="e.g., John Doe" value={form.full_name} onChange={handle} required />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="form-group">
              <label>Date of Birth</label>
              <input name="dob" type="date" value={form.dob} onChange={handle} required />
            </div>
            <div className="form-group">
              <label>Contact</label>
              <input name="contact" placeholder="11-digit number" value={form.contact} onChange={handle} required />
            </div>
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <div className="auth-switch">
          Already have an account?{' '}
          <button onClick={() => navigate('/signin')}>Sign in</button>
        </div>
      </div>
    </div>
  );
}
