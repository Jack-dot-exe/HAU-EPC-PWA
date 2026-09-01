import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { isSupabaseEnabled, supabase } from "../lib/supabase";

type AuthContextValue = {
  token: string;
  isAuthenticated: boolean;
  authUserId: string;
  authEmail: string;
  loginWithPassword: (email: string, password: string) => Promise<{ id: string; email: string }>;
  registerWithPassword: (email: string, password: string) => Promise<{ id: string; email: string }>;
  loginWithToken: (token: string) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const AUTH_TOKEN_KEY = "engine-power:auth-token:v1";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string>(() => localStorage.getItem(AUTH_TOKEN_KEY) ?? "");
  const [authUserId, setAuthUserId] = useState<string>("");
  const [authEmail, setAuthEmail] = useState<string>("");

  useEffect(() => {
    if (token) localStorage.setItem(AUTH_TOKEN_KEY, token);
    else localStorage.removeItem(AUTH_TOKEN_KEY);
  }, [token]);

  useEffect(() => {
    if (!isSupabaseEnabled || !supabase) return;

    let active = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        const session = data.session;
        setToken(session?.access_token ?? "");
        setAuthUserId(session?.user?.id ?? "");
        setAuthEmail(session?.user?.email ?? "");
      })
      .catch((e) => console.error("Failed to read Supabase auth session:", e));

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setToken(session?.access_token ?? "");
      setAuthUserId(session?.user?.id ?? "");
      setAuthEmail(session?.user?.email ?? "");
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    return {
      token,
      authUserId,
      authEmail,
      isAuthenticated: !!token,
      loginWithPassword: async (email, password) => {
        if (!isSupabaseEnabled || !supabase) {
          const fakeId = globalThis.crypto?.randomUUID?.() ?? `local_${Date.now()}`;
          setToken(`local_${Date.now()}`);
          setAuthUserId(fakeId);
          setAuthEmail(email.trim().toLowerCase());
          return { id: fakeId, email: email.trim().toLowerCase() };
        }

        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        const user = data.user;
        if (!user?.id || !user.email) throw new Error("Supabase authentication returned no user.");
        return { id: user.id, email: user.email.toLowerCase() };
      },
      registerWithPassword: async (email, password) => {
        if (!isSupabaseEnabled || !supabase) {
          const fakeId = globalThis.crypto?.randomUUID?.() ?? `local_${Date.now()}`;
          setToken(`local_${Date.now()}`);
          setAuthUserId(fakeId);
          setAuthEmail(email.trim().toLowerCase());
          return { id: fakeId, email: email.trim().toLowerCase() };
        }

        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        const user = data.user;
        if (!user?.id || !user.email) throw new Error("Supabase sign-up did not return a user.");
        return { id: user.id, email: user.email.toLowerCase() };
      },
      loginWithToken: (t) => setToken(t),
      logout: () => {
        if (isSupabaseEnabled && supabase) {
          supabase.auth.signOut().catch((e) => console.error("Supabase sign-out failed:", e));
        }
        setToken("");
        setAuthUserId("");
        setAuthEmail("");
      },
    };
  }, [token, authEmail, authUserId]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
