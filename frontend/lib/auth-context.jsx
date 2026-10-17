'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  UNAUTHORIZED_EVENT,
  authApi,
  errorMessage,
  readStoredUser,
  readToken,
  userApi,
  writeStoredUser,
  writeToken,
} from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | authenticated | anonymous

  const applySession = useCallback(({ token, user: nextUser }) => {
    writeToken(token);
    writeStoredUser(nextUser);
    setUser(nextUser);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(() => {
    writeToken(null);
    writeStoredUser(null);
    setUser(null);
    setStatus('anonymous');
  }, []);

  const login = useCallback(
    async (credentials) => {
      const data = await authApi.login(credentials);
      applySession(data);
      return data.user;
    },
    [applySession]
  );

  const register = useCallback(
    async (payload) => {
      const data = await authApi.register(payload);
      applySession(data);
      return data.user;
    },
    [applySession]
  );

  const refresh = useCallback(async () => {
    if (!readToken()) return null;
    const data = await authApi.me();
    writeStoredUser(data.user);
    setUser(data.user);
    return data.user;
  }, []);

  const updateUser = useCallback((patch) => {
    setUser((current) => {
      const next = current ? { ...current, ...patch } : patch;
      writeStoredUser(next);
      return next;
    });
  }, []);

  // Restore the session on first paint and validate it against the API.
  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const stored = readStoredUser();
      const token = readToken();

      if (!token) {
        setStatus('anonymous');
        return;
      }

      if (stored) {
        setUser(stored);
        setStatus('authenticated');
      }

      try {
        const data = await authApi.me();
        if (!cancelled) {
          writeStoredUser(data.user);
          setUser(data.user);
          setStatus('authenticated');
        }
      } catch (error) {
        if (cancelled) return;
        if (!stored) {
          writeToken(null);
          setStatus('anonymous');
        } else if (error.status === 401) {
          writeToken(null);
          writeStoredUser(null);
          setUser(null);
          setStatus('anonymous');
        }
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  // Any 401 from the API client means the session is no longer valid.
  useEffect(() => {
    function onUnauthorized() {
      setUser(null);
      setStatus('anonymous');
    }
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  // Profile edits made elsewhere (settings page) are pushed into the context.
  useEffect(() => {
    function onProfileUpdated(event) {
      if (event.detail) updateUser(event.detail);
    }
    window.addEventListener('fittrack:profile-updated', onProfileUpdated);
    return () => window.removeEventListener('fittrack:profile-updated', onProfileUpdated);
  }, [updateUser]);

  const value = useMemo(
    () => ({
      user,
      status,
      isAuthenticated: status === 'authenticated',
      isLoading: status === 'loading',
      login,
      register,
      logout,
      refresh,
      updateUser,
      fetchProfile: userApi.me,
      errorMessage,
    }),
    [user, status, login, register, logout, refresh, updateUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}