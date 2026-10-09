import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api, { TOKEN_KEY, setUnauthorizedHandler } from '../services/api';
import { disconnectSocket } from '../services/socket';
import { clearFileCache } from '../services/files';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(localStorage.getItem(TOKEN_KEY)));

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    disconnectSocket();
    clearFileCache();
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
  }, [logout]);

  // restore session on first load
  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) return;
    api
      .get('/auth/me')
      .then((res) => setUser(res.data.user))
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setLoading(false));
  }, []);

  const authenticate = async (path, body) => {
    const { data } = await api.post(path, body);
    localStorage.setItem(TOKEN_KEY, data.token);
    setUser(data.user);
  };

  const value = useMemo(
    () => ({
      user,
      loading,
      login: (email, password) => authenticate('/auth/login', { email, password }),
      register: (form) => authenticate('/auth/register', form),
      // after a successful reset the server returns a fresh token, so the user is logged in
      resetPassword: (token, form) => authenticate(`/auth/reset-password/${encodeURIComponent(token)}`, form),
      logout,
    }),
    [user, loading, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}