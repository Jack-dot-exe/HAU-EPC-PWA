import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { PowerCheckRecord } from "../domain/models";
import {
  checkExistsInCloud,
  deleteCheckCloud,
  fetchChecksCloud,
  isCloudDbReachable,
  replaceChecksCloud,
  upsertCheckCloud,
} from "../lib/cloudDb";

type SyncNotification = {
  id: string;
  message: string;
  kind: "success" | "warning";
  createdAt: number;
};

type ChecksContextValue = {
  checks: PowerCheckRecord[];
  pendingSyncCount: number;
  notifications: SyncNotification[];
  addCheck: (record: PowerCheckRecord) => Promise<void>;
  removeCheck: (id: string) => void;
  resetChecks: () => void;
  dismissNotification: (id: string) => void;
  syncPendingChecks: () => Promise<void>;
};

const ChecksContext = createContext<ChecksContextValue | null>(null);

const STORAGE_KEY_V2 = "engine-power-checks:v2";
const PENDING_SYNC_STORAGE_KEY = "engine-power-checks:pending-sync:v1";

function safeParse(json: string | null): unknown {
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function isRecordLike(x: any): x is PowerCheckRecord {
  return (
    x &&
    typeof x === "object" &&
    typeof x.id === "string" &&
    typeof x.createdAtIso === "string" &&
    typeof x.registrationId === "string" &&
    typeof x.checkType === "string"
  );
}

function normalizeTotalTimeHrs(input: unknown): number | undefined {
  if (typeof input !== "number") return undefined;
  if (!isFinite(input)) return undefined;
  if (input < 0) return undefined;
  return input;
}

function normalizeRecord(record: PowerCheckRecord): PowerCheckRecord {
  return {
    ...record,
    profileExecutionMode: record.profileExecutionMode ?? record.profileSnapshot?.executionMode ?? "calculated",
    schemaVersion: 2,
    totalTimeHrs: normalizeTotalTimeHrs(record.totalTimeHrs),
    engines: Array.isArray(record.engines) ? record.engines : [],
  };
}

function normalizeRecords(input: unknown): PowerCheckRecord[] | null {
  if (!Array.isArray(input)) return null;
  const records: PowerCheckRecord[] = [];
  for (const item of input) {
    if (!isRecordLike(item)) continue;
    records.push(normalizeRecord(item as PowerCheckRecord));
  }
  return records;
}

function persistChecks(records: PowerCheckRecord[]) {
  localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(records));
}

function readPendingSyncRecords(): PowerCheckRecord[] {
  return normalizeRecords(safeParse(localStorage.getItem(PENDING_SYNC_STORAGE_KEY))) ?? [];
}

function writePendingSyncRecords(records: PowerCheckRecord[]) {
  if (records.length === 0) {
    localStorage.removeItem(PENDING_SYNC_STORAGE_KEY);
    return;
  }
  localStorage.setItem(PENDING_SYNC_STORAGE_KEY, JSON.stringify(records));
}

function mergeUniqueById(records: PowerCheckRecord[]): PowerCheckRecord[] {
  const map = new Map<string, PowerCheckRecord>();
  for (const record of records) {
    map.set(record.id, normalizeRecord(record));
  }
  return Array.from(map.values()).sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso));
}

function makeNotification(message: string, kind: SyncNotification["kind"]): SyncNotification {
  return {
    id: `${kind}_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    message,
    kind,
    createdAt: Date.now(),
  };
}

export function ChecksProvider({ children }: { children: React.ReactNode }) {
  const [checks, setChecks] = useState<PowerCheckRecord[]>([]);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [notifications, setNotifications] = useState<SyncNotification[]>([]);

  const pushNotification = (message: string, kind: SyncNotification["kind"]) => {
    setNotifications((prev) => [makeNotification(message, kind), ...prev].slice(0, 10));
  };

  const dismissNotification = (id: string) => {
    setNotifications((prev) => prev.filter((item) => item.id !== id));
  };

  const syncPendingChecks = async () => {
    const pending = readPendingSyncRecords();
    setPendingSyncCount(pending.length);

    if (pending.length === 0) return;

    const isReachable = await isCloudDbReachable();
    if (!isReachable) {
      pushNotification("Power Check not synced to Database", "warning");
      return;
    }

    const remaining: PowerCheckRecord[] = [];

    for (const record of pending) {
      try {
        const exists = await checkExistsInCloud(record.id);
        if (!exists) {
          await upsertCheckCloud(record);
        }
      } catch (error) {
        console.error("Failed to sync pending power check:", error);
        remaining.push(record);
      }
    }

    writePendingSyncRecords(remaining);
    setPendingSyncCount(remaining.length);

    if (remaining.length === 0) {
      pushNotification("Database sync complete", "success");
    } else {
      pushNotification("Power Check not synced to Database", "warning");
    }
  };

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      const localChecks = normalizeRecords(safeParse(localStorage.getItem(STORAGE_KEY_V2))) ?? [];
      const pending = readPendingSyncRecords();

      setPendingSyncCount(pending.length);

      try {
        const remote = await fetchChecksCloud();
        if (!active) return;

        const merged = mergeUniqueById([...(remote ?? []), ...localChecks, ...pending]);
        setChecks(merged);
        persistChecks(merged);
      } catch (e) {
        console.error("Failed to load checks from Supabase:", e);
        if (!active) return;
        const merged = mergeUniqueById([...localChecks, ...pending]);
        setChecks(merged);
        persistChecks(merged);
      }

      try {
        await syncPendingChecks();
      } catch (e) {
        console.error("Initial pending-check sync failed:", e);
      }
    };

    void bootstrap();

    const handleOnline = () => {
      void syncPendingChecks();
    };

    window.addEventListener("online", handleOnline);
    return () => {
      active = false;
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  const value = useMemo<ChecksContextValue>(() => {
    return {
      checks,
      pendingSyncCount,
      notifications,
      addCheck: async (record) => {
        const normalized = normalizeRecord(record);
        const nextChecks = mergeUniqueById([normalized, ...checks]);

        setChecks(nextChecks);
        persistChecks(nextChecks);

        try {
          const isReachable = await isCloudDbReachable();
          if (!isReachable) throw new Error("Database not reachable");

          const exists = await checkExistsInCloud(normalized.id);
          if (!exists) {
            await upsertCheckCloud(normalized);
          }

          const pending = readPendingSyncRecords().filter((item) => item.id !== normalized.id);
          writePendingSyncRecords(pending);
          setPendingSyncCount(pending.length);
          pushNotification("Database sync complete", "success");
        } catch (e) {
          console.error("Failed to upsert check in Supabase:", e);
          const pending = mergeUniqueById([normalized, ...readPendingSyncRecords()]);
          writePendingSyncRecords(pending);
          setPendingSyncCount(pending.length);
          pushNotification("Power Check not synced to Database", "warning");
        }
      },
      removeCheck: (id) => {
        const nextChecks = checks.filter((c) => c.id !== id);
        setChecks(nextChecks);
        persistChecks(nextChecks);

        const nextPending = readPendingSyncRecords().filter((item) => item.id !== id);
        writePendingSyncRecords(nextPending);
        setPendingSyncCount(nextPending.length);

        deleteCheckCloud(id).catch((e) => console.error("Failed to delete check in Supabase:", e));
      },
      resetChecks: () => {
        setChecks([]);
        replaceChecksCloud([]).catch((e) =>
          console.error("Failed to reset checks in Supabase:", e)
        );
        localStorage.removeItem(STORAGE_KEY_V2);
        localStorage.removeItem(PENDING_SYNC_STORAGE_KEY);
        setPendingSyncCount(0);
      },
      dismissNotification,
      syncPendingChecks,
    };
  }, [checks, notifications, pendingSyncCount]);

  return <ChecksContext.Provider value={value}>{children}</ChecksContext.Provider>;
}

export function useChecks() {
  const ctx = useContext(ChecksContext);
  if (!ctx) throw new Error("useChecks must be used inside ChecksProvider");
  return ctx;
}
