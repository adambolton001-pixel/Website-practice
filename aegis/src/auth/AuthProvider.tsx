import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, apiReady } from '../api';
import type { Profile } from '../lib/types';

interface AuthValue {
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signInDemo: (profileId: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthCtx = createContext<AuthValue | null>(null);

export function useAuth(): AuthValue {
  const v = useContext(AuthCtx);
  if (!v) throw new Error('useAuth must be used inside <AuthProvider>');
  return v;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let unsub = () => {};

    async function boot() {
      await apiReady;
      async function loadProfile(userId: string | null) {
        if (!userId) {
          if (active) {
            setProfile(null);
            setLoading(false);
          }
          return;
        }
        const p = await api().getProfile(userId);
        if (active) {
          setProfile(p);
          setLoading(false);
        }
      }
      unsub = api().onAuthChange((userId) => {
        setLoading(true);
        void loadProfile(userId);
      });
      void loadProfile(await api().getSessionUserId());
    }
    void boot();

    return () => {
      active = false;
      unsub();
    };
  }, []);

  const value: AuthValue = {
    profile,
    loading,
    signIn: (email, password) => api().signIn(email, password),
    signInDemo: (id) => api().signInDemo(id),
    signOut: () => api().signOut(),
  };

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
