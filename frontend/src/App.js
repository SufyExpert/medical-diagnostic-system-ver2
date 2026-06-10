import React, { createContext, useContext, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Welcome from './pages/Welcome';
import SignIn from './pages/SignIn';
import SignUp from './pages/SignUp';
import Dashboard from './pages/Dashboard';
import Diagnosis from './pages/Diagnosis';
import Profile from './pages/Profile';

export const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

function PrivateRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/" replace />;
}

export default function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('mds_user');
    return saved ? JSON.parse(saved) : null;
  });

  const login = (userData) => {
    setUser(userData);
    localStorage.setItem('mds_user', JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('mds_user');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      <BrowserRouter>
        {user && <Navbar />}
        <Routes>
          {/* Welcome is the real entry point */}
          <Route path="/" element={user ? <Navigate to="/dashboard" /> : <Welcome />} />
          <Route path="/signin" element={user ? <Navigate to="/dashboard" /> : <SignIn />} />
          <Route path="/signup" element={user ? <Navigate to="/dashboard" /> : <SignUp />} />
          <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/diagnosis" element={<PrivateRoute><Diagnosis /></PrivateRoute>} />
          <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthContext.Provider>
  );
}