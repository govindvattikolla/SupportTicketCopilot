import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, loginApi, logoutApi, getMeApi, refreshTokenApi } from '../api/client';
import { updateSocketAuth } from '../realtime/socket';

interface AuthContextType {
  user: User | null;
  workspace: any | null;
  token?: string | null;
  isLoading: boolean;
  login: (email: string, pass: string, slug?: string) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [workspace, setWorkspace] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Checks active HTTP-only cookie session on initial application load
  const verifySession = async () => {
    try {
      // 1. First attempt /me using existing HTTP-only accessToken cookie
      const { user: fetchedUser, workspace: fetchedWorkspace } = await getMeApi();
      setUser(fetchedUser);
      setWorkspace(fetchedWorkspace);
      updateSocketAuth(true);
    } catch {
      // 2. If access token is missing or expired, attempt refresh token rotation via HTTP-only cookie
      try {
        await refreshTokenApi();
        const { user: refreshedUser, workspace: refreshedWorkspace } = await getMeApi();
        setUser(refreshedUser);
        setWorkspace(refreshedWorkspace);
        updateSocketAuth(true);
      } catch {
        // Unauthenticated session
        setUser(null);
        setWorkspace(null);
        updateSocketAuth(false);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // SECURITY ENFORCEMENT: Purge any legacy token from localStorage.
    // All tokens are stored strictly in secure HTTP-only cookies.
    localStorage.removeItem('supportflow_token');
    localStorage.removeItem('token');
    verifySession();
  }, []);

  const login = async (email: string, pass: string, slug?: string): Promise<User> => {
    // loginApi sets HTTP-only cookies (accessToken and refreshToken) on response
    const res = await loginApi(email, pass, slug);

    // Guaranteed: do NOT store token in localStorage
    localStorage.removeItem('supportflow_token');
    localStorage.removeItem('token');

    setUser(res.user);

    try {
      const me = await getMeApi();
      setWorkspace(me.workspace);
    } catch {
      // Non-fatal if workspace metadata loads on next navigation
    }

    updateSocketAuth(true);
    return res.user;
  };

  const logout = async (): Promise<void> => {
    try {
      await logoutApi(); // Server revokes refresh token and clears HTTP-only cookies
    } catch {
      // Ignore network errors on logout
    }

    localStorage.removeItem('supportflow_token');
    localStorage.removeItem('token');

    setUser(null);
    setWorkspace(null);
    updateSocketAuth(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        workspace,
        token: null, // Tokens are in HTTP-only cookies, not JavaScript memory
        isLoading,
        login,
        logout,
      }}
    >
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
