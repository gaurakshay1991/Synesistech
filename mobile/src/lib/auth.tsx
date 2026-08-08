import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AuthAPI, SynesisUser } from './api';

type AuthContextValue = {
  loading: boolean;
  user: SynesisUser | null;
  signIn: (email: string, password: string) => Promise<SynesisUser>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<SynesisUser>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<SynesisUser | null>(null);

  async function refresh() {
    try { setUser((await AuthAPI.session()).user); }
    catch { setUser(null); }
  }

  useEffect(() => { refresh().finally(() => setLoading(false)); }, []);

  const value = useMemo<AuthContextValue>(() => ({
    loading,
    user,
    async signIn(email, password) {
      const next = (await AuthAPI.login(email, password)).user;
      setUser(next);
      return next;
    },
    async changePassword(currentPassword, newPassword) {
      const next = (await AuthAPI.changePassword(currentPassword, newPassword)).user;
      setUser(next);
      return next;
    },
    async signOut() {
      await AuthAPI.logout();
      setUser(null);
    },
    refresh
  }), [loading, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider');
  return value;
}
