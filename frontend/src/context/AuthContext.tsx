import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, loginApi, logoutApi, getMeApi } from '../api/client';
import { updateSocketAuth } from '../realtime/socket';

interface AuthContextType {
  user: User | null;
  workspace: any | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, pass: string, slug?: string) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [workspace, setWorkspace] = useState<any | null>(null);
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem('supportflow_token')
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (token) {
          updateSocketAuth(token);
          const { user: fetchedUser, workspace: fetchedWorkspace } = await getMeApi();
          setUser(fetchedUser);
          setWorkspace(fetchedWorkspace);
        } else {
          updateSocketAuth(null);
        }
      } catch (err) {
        console.warn('Session expired or invalid token');
        localStorage.removeItem('supportflow_token');
        setToken(null);
        setUser(null);
        updateSocketAuth(null);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, [token]);

  const login = async (email: string, pass: string, slug?: string) => {
    const res = await loginApi(email, pass, slug);
    localStorage.setItem('supportflow_token', res.token);
    setToken(res.token);
    setUser(res.user);
    updateSocketAuth(res.token);
    return res.user;
  };

  const logout = async () => {
    try {
      await logoutApi();
    } catch {
      // Ignore logout network errors
    }
    localStorage.removeItem('supportflow_token');
    setToken(null);
    setUser(null);
    setWorkspace(null);
    updateSocketAuth(null);
  };

  return (
    <AuthContext.Provider value={{ user, workspace, token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
