import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Registration } from "../domain/models";
import {
  deleteRegistrationCloud,
  fetchRegistrationsCloud,
  replaceRegistrationsCloud,
  upsertRegistrationCloud,
} from "../lib/cloudDb";

type RegistrationsContextValue = {
  registrations: Registration[];
  addRegistration: (r: Registration) => void;
  updateRegistration: (id: string, patch: Partial<Registration>) => void;
  removeRegistration: (id: string) => void;
  resetRegistrations: () => void; // Clear data
};

const RegistrationsContext = createContext<RegistrationsContextValue | null>(null);

// v1: { id, tailNumber, profileId }
// v2: adds optional Registration.engines (per-registration engine labels/ids)
const STORAGE_KEY_V1 = "engine-power:registrations:v1";
const STORAGE_KEY_V2 = "engine-power:registrations:v2";

function safeParse(json: string | null): unknown {
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function isString(x: unknown): x is string {
  return typeof x === "string";
}

function normalizeRegistration(raw: any): Registration | null {
  if (!raw || typeof raw !== "object") return null;

  const id = raw.id;
  const tailNumber = raw.tailNumber;
  const profileId = raw.profileId;

  if (!isString(id) || !isString(tailNumber) || !isString(profileId)) return null;

  const engines = Array.isArray(raw.engines)
    ? raw.engines
        .map((e: any) => {
          if (!e || typeof e !== "object") return null;
          if (!isString(e.id) || !isString(e.label)) return null;
          return { id: e.id, label: e.label };
        })
        .filter(Boolean)
    : undefined;

  return {
    id,
    tailNumber,
    profileId,
    ...(engines && engines.length > 0 ? { engines } : {}),
  };
}

function normalizeRegistrations(raw: unknown): Registration[] | null {
  if (!Array.isArray(raw)) return null;
  const normalized = raw.map(normalizeRegistration).filter(Boolean) as Registration[];
  return normalized.length > 0 ? normalized : [];
}

export function RegistrationsProvider({ children }: { children: React.ReactNode }) {
  const [registrations, setRegistrations] = useState<Registration[]>([]);

  useEffect(() => {
    let active = true;
    const localV2 = normalizeRegistrations(safeParse(localStorage.getItem(STORAGE_KEY_V2))) ?? [];
    const localV1 = normalizeRegistrations(safeParse(localStorage.getItem(STORAGE_KEY_V1))) ?? [];
    const localRegistrations = localV2.length > 0 ? localV2 : localV1;

    fetchRegistrationsCloud()
      .then(async (remote) => {
        if (!active || !remote) return;

        if (remote.length > 0) {
          setRegistrations(remote);
        } else if (localRegistrations.length > 0) {
          setRegistrations(localRegistrations);
          await replaceRegistrationsCloud(localRegistrations);
        } else {
          setRegistrations([]);
        }

        localStorage.removeItem(STORAGE_KEY_V2);
        localStorage.removeItem(STORAGE_KEY_V1);
      })
      .catch((e) => console.error("Failed to load registrations from Supabase:", e));
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<RegistrationsContextValue>(() => {
    return {
      registrations,
      addRegistration: (r) => {
        setRegistrations((prev) => [r, ...prev]);
        upsertRegistrationCloud(r).catch((e) =>
          console.error("Failed to upsert registration in Supabase:", e)
        );
      },
      updateRegistration: (id, patch) =>
        setRegistrations((prev) =>
          prev.map((r) => {
            if (r.id !== id) return r;
            const next = { ...r, ...patch };
            upsertRegistrationCloud(next).catch((e) =>
              console.error("Failed to update registration in Supabase:", e)
            );
            return next;
          })
        ),
      removeRegistration: (id) => {
        setRegistrations((prev) => prev.filter((r) => r.id !== id));
        deleteRegistrationCloud(id).catch((e) =>
          console.error("Failed to delete registration in Supabase:", e)
        );
      },
      resetRegistrations: () => {
        setRegistrations([]);
        replaceRegistrationsCloud([]).catch((e) =>
          console.error("Failed to reset registrations in Supabase:", e)
        );
        localStorage.removeItem(STORAGE_KEY_V2);
        localStorage.removeItem(STORAGE_KEY_V1);
      },
    };
  }, [registrations]);

  return (
    <RegistrationsContext.Provider value={value}>
      {children}
    </RegistrationsContext.Provider>
  );
}

export function useRegistrations() {
  const ctx = useContext(RegistrationsContext);
  if (!ctx) throw new Error("useRegistrations must be used inside RegistrationsProvider");
  return ctx;
}
