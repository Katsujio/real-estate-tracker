import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { login as apiLogin, register as apiRegister, getMe } from './api';

// Simple auth context so the app knows who is logged in
const AuthContext = createContext(null);
const TOKEN_KEY = 'auth_token';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false); // true while logging in
  const [booting, setBooting] = useState(true); // true while we check stored token

  // On load, pull token from localStorage and fetch the user
  useEffect(() => {
    const saved = localStorage.getItem(TOKEN_KEY);
    if (!saved) {
      setBooting(false);
      return;
    }
    // Verify the saved token still works
    setToken(saved);
    getMe(saved)
      .then((me) => setUser(me))
      .catch(() => {
        setUser(null);
        setToken('');
        localStorage.removeItem(TOKEN_KEY);
      })
      .finally(() => setBooting(false));
  }, []);

  // Login with email/password
  const login = async ({ email, password }) => {
    setLoading(true);
    try {
      const res = await apiLogin(email, password);
      setUser(res.user);
      setToken(res.token);
      localStorage.setItem(TOKEN_KEY, res.token);
      return res.user;
    } catch (err) {
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Register then log in (not used yet, but handy)
  const register = async ({ email, password, preferences }) => {
    setLoading(true);
    try {
      const res = await apiRegister(email, password, preferences);
      setUser(res.user);
      setToken(res.token);
      localStorage.setItem(TOKEN_KEY, res.token);
      return res.user;
    } catch (err) {
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Clear token and user
  const logout = () => {
    setUser(null);
    setToken('');
    localStorage.removeItem(TOKEN_KEY);
  };

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      booting,
      login,
      register,
      logout,
    }),
    [user, token, loading, booting],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
