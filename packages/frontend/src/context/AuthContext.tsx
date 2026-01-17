import { createContext, useState, useEffect, ReactNode } from 'react';
import { api } from '../api/client';
import type { AuthUser } from '@media-scanner/shared';

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: () => void;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const response = await api.get<{ data: AuthUser }>('/api/auth/me');
      setUser(response.data.data);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  function login() {
    window.location.href = '/api/auth/google';
  }

  async function logout() {
    try {
      await api.post('/api/auth/logout');
    } finally {
      setUser(null);
      window.location.href = '/login';
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
