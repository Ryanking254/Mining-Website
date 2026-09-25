import { useCallback, useEffect, useMemo, useState } from 'react';
import { getMe, loginUser, registerUser, googleLoginUser, verify2faLogin } from './api';
import { AuthContext } from './auth-context.jsx';

function readStoredUser() {
  try {
    const raw = localStorage.getItem('ledger-user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function readStoredToken() {
  try {
    return localStorage.getItem('token');
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readStoredUser);
  const [token, setToken] = useState(readStoredToken);
  // Only enter loading state when there is a stored token to validate.
  const [loading, setLoading] = useState(() => !!readStoredToken());

  const saveSession = (session) => {
    setUser(session.user);
    setToken(session.token);
    localStorage.setItem('token', session.token);
    localStorage.setItem('ledger-user', JSON.stringify(session.user));
  };

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('ledger-user');
    } catch { /* ignore */ }
  }, []);

  const login = useCallback(async (payload) => {
    const { data } = await loginUser(payload);
    // Accounts with 2FA enabled get { requires2fa, pendingToken } — no session yet.
    if (data?.requires2fa) return data;
    saveSession(data);
    return data;
  }, []);

  const register = useCallback(async (payload) => {
    const { data } = await registerUser(payload);
    if (data?.requires2fa) return data;
    saveSession(data);
    return data;
  }, []);

  const loginWithGoogle = useCallback(async (idToken) => {
    const { data } = await googleLoginUser(idToken);
    if (data?.requires2fa) return data;
    saveSession(data);
    return data;
  }, []);

  const verify2fa = useCallback(async (pendingToken, code, { isBackup = false } = {}) => {
    const { data } = await verify2faLogin(
      isBackup ? { pendingToken, backupCode: code } : { pendingToken, code }
    );
    saveSession(data);
    return data.user;
  }, []);

  useEffect(() => {
    // Re-validate stored token on boot (backend is source of truth).
    let cancelled = false;
    if (!token) return undefined;
    getMe()
      .then(({ data }) => {
        if (cancelled) return;
        setUser(data);
        try { localStorage.setItem('ledger-user', JSON.stringify(data)); } catch { /* ignore */ }
      })
      .catch(() => {
        if (!cancelled) logout();
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(
    () => ({ user, token, loading, login, register, loginWithGoogle, verify2fa, logout, isAuthed: !!token && !!user }),
    [user, token, loading, login, register, loginWithGoogle, verify2fa, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
