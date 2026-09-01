import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { User } from "../domain/models";
import { hashPassword, verifyPassword } from "../security/password";
import { useAuth } from "./authStore";
import {
  deleteUserCloud,
  fetchUsersCloud,
  replaceUsersCloud,
  upsertUserCloud,
} from "../lib/cloudDb";
import { isSupabaseEnabled } from "../lib/supabase";

const USERS_KEY = "engine-power:users:v1";

type UsersContextValue = {
  users: User[];
  addUser: (u: User) => void;
  updateUser: (id: string, patch: Partial<User>) => void;
  removeUser: (id: string) => void;
  resetUsers: () => void;

  currentUser: User | null;
  usersReady: boolean;

  setUserPassword: (userId: string, newPassword: string) => Promise<void>;
  loginWithEmailPassword: (email: string, password: string) => Promise<User>;
  ensureUserFromAuth: (
    authUserId: string,
    email: string,
    roleIfNew?: User["role"]
  ) => Promise<User>;
};

const UsersContext = createContext<UsersContextValue | null>(null);

function safeParse(json: string | null): User[] | null {
  if (!json) return null;
  try {
    const data = JSON.parse(json);
    return Array.isArray(data) ? (data as User[]) : null;
  } catch {
    return null;
  }
}

export function UsersProvider({ children }: { children: React.ReactNode }) {
  const { authEmail, authUserId } = useAuth();
  const [users, setUsers] = useState<User[]>(() => safeParse(localStorage.getItem(USERS_KEY)) ?? []);
  const [usersReady, setUsersReady] = useState<boolean>(() => !isSupabaseEnabled);

  useEffect(() => {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    let active = true;
    const loadPromise = fetchUsersCloud()
      .then((remote) => {
        if (!active || !remote || remote.length === 0) return;
        setUsers(remote);
      })
      .catch((e) => console.error("Failed to load users from Supabase:", e));
    loadPromise
      .finally(() => {
        if (active) setUsersReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<UsersContextValue>(() => {
    const currentUser =
      users.find((u) => u.id === authUserId) ??
      users.find((u) => u.email.toLowerCase() === authEmail.toLowerCase()) ??
      null;

    return {
      users,

      addUser: (u) => {
        setUsers((prev) => [u, ...prev]);
        upsertUserCloud(u).catch((e) => console.error("Failed to upsert user in Supabase:", e));
      },
      updateUser: (id, patch) =>
        setUsers((prev) =>
          prev.map((u) => {
            if (u.id !== id) return u;
            const next = { ...u, ...patch };
            upsertUserCloud(next).catch((e) =>
              console.error("Failed to update user in Supabase:", e)
            );
            return next;
          })
        ),
      removeUser: (id) => {
        setUsers((prev) => prev.filter((u) => u.id !== id));
        deleteUserCloud(id).catch((e) => console.error("Failed to delete user in Supabase:", e));
      },
      resetUsers: () => {
        setUsers([]);
        replaceUsersCloud([]).catch((e) =>
          console.error("Failed to reset users in Supabase:", e)
        );
      },

      currentUser,
      usersReady,

      setUserPassword: async (userId: string, newPassword: string) => {
        const { saltB64, hashB64, iterations } = await hashPassword(newPassword);
        setUsers((prev) => {
          const nextUsers = prev.map((u) =>
            u.id === userId
              ? {
                  ...u,
                  passwordSalt: saltB64,
                  passwordHash: hashB64,
                  passwordIterations: iterations,
                }
              : u
          );
          const nextUser = nextUsers.find((u) => u.id === userId);
          if (nextUser) {
            upsertUserCloud(nextUser).catch((e) =>
              console.error("Failed to persist password update in Supabase:", e)
            );
          }
          return nextUsers;
        });
      },

      loginWithEmailPassword: async (email: string, password: string) => {
        const user =
          users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase()) ?? null;

        if (!user) throw new Error("User not found");
        if (!user.isActive) throw new Error("User is disabled");

        const { passwordSalt, passwordHash, passwordIterations } = user;
        if (!passwordSalt || !passwordHash || !passwordIterations) {
          throw new Error("User has no password set (ask admin to set it).");
        }

        const ok = await verifyPassword(password, passwordSalt, passwordHash, passwordIterations);
        if (!ok) throw new Error("Invalid password");

        return user;
      },
      ensureUserFromAuth: async (authUserId: string, email: string) => {
        void authUserId;
        const normalizedEmail = email.trim().toLowerCase();
        const existing = users.find((u) => u.email.toLowerCase() === normalizedEmail) ?? null;

        if (!existing) {
          throw new Error("No application access configured for this user.");
        }
        if (!existing.isActive) {
          throw new Error("User is disabled");
        }

        return existing;
      },
    };
  }, [users, authUserId, authEmail, usersReady]);

  return <UsersContext.Provider value={value}>{children}</UsersContext.Provider>;
}

export function useUsers() {
  const ctx = useContext(UsersContext);
  if (!ctx) throw new Error("useUsers must be used inside UsersProvider");
  return ctx;
}
