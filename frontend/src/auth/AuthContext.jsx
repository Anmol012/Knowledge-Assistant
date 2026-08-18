import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { authApi } from '../api/endpoints';
import { TOKEN_KEYS } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEYS.access);
    if (!token) {
      setLoading(false);
      return;
    }
    authApi
      .me()
      .then(setUser)
      .catch(() => {
        localStorage.removeItem(TOKEN_KEYS.access);
        localStorage.removeItem(TOKEN_KEYS.refresh);
      })
      .finally(() => setLoading(false));
  }, []);

  const storeTokens = useCallback((tokens) => {
    localStorage.setItem(TOKEN_KEYS.access, tokens.access_token);
    localStorage.setItem(TOKEN_KEYS.refresh, tokens.refresh_token);
  }, []);

  const login = useCallback(
    async (email, password) => {
      const tokens = await authApi.login({ email, password });
      storeTokens(tokens);
      const me = await authApi.me();
      setUser(me);
      return me;
    },
    [storeTokens]
  );

  const register = useCallback(
    async (email, password, fullName) => {
      const tokens = await authApi.register({ email, password, full_name: fullName });
      storeTokens(tokens);
      const me = await authApi.me();
      setUser(me);
      return me;
    },
    [storeTokens]
  );

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEYS.access);
    localStorage.removeItem(TOKEN_KEYS.refresh);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, logout, isAdmin: user?.role === 'admin' }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}