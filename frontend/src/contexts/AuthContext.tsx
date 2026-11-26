import { authStorage } from '../authStorage';
// KaamSetu — Auth Context
import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { User, AuthToken } from '../types';
import { authApi } from '../api/services';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (tokenData: AuthToken) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_KEY = 'kaamsetu_token';
const USER_KEY = 'kaamsetu_user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize from localStorage on app start
  useEffect(() => {
    const storedToken = authStorage.getItem(TOKEN_KEY);
    const storedUser = authStorage.getItem(USER_KEY);

    if (storedToken && storedUser) {
      try {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        // Verify token is still valid
        authApi.me().then(freshUser => {
          setUser(freshUser);
          authStorage.setItem(USER_KEY, JSON.stringify(freshUser));
        }).catch(() => {
          // Token expired or invalid — clear everything
          authStorage.removeItem(TOKEN_KEY);
          authStorage.removeItem(USER_KEY);
          setToken(null);
          setUser(null);
          queryClient.clear();
        }).finally(() => setIsLoading(false));
      } catch {
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
    }
  }, []);

  const queryClient = useQueryClient();

  const login = (tokenData: AuthToken) => {
    setToken(tokenData.access_token);
    setUser(tokenData.user);
    authStorage.setItem(TOKEN_KEY, tokenData.access_token);
    authStorage.setItem(USER_KEY, JSON.stringify(tokenData.user));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    authStorage.removeItem(TOKEN_KEY);
    authStorage.removeItem(USER_KEY);
    queryClient.clear();
  };

  const refreshUser = async () => {
    try {
      const freshUser = await authApi.me();
      setUser(freshUser);
      authStorage.setItem(USER_KEY, JSON.stringify(freshUser));
    } catch {
      logout();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!user && !!token,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
