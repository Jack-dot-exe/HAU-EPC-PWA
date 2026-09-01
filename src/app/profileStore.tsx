import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type {
  AircraftProfile,
  CheckType,
  EngineDef,
  FieldDef,
  InputFieldKey,
  InputOnlyConfig,
  PowerCheckLimits,
  ProfileExecutionMode,
} from "../domain/models";
import { getFieldUnitId } from "../domain/units";
import {
  deleteProfileCloud,
  fetchProfilesCloud,
  replaceProfilesCloud,
  upsertProfileCloud,
} from "../lib/cloudDb";

type ProfilesContextValue = {
  profiles: AircraftProfile[];
  addProfile: (p: AircraftProfile) => void;
  updateProfile: (id: string, patch: Partial<AircraftProfile>) => void;
  removeProfile: (id: string) => void;
  resetProfiles: () => void;
};

const ProfilesContext = createContext<ProfilesContextValue | null>(null);
const STORAGE_KEY_V2 = "engine-power:profiles:v2";

const BELL412_IN_FLIGHT_FIELDS: FieldDef[] = [
  { key: "TTH", label: "Total Time", unitId: "hhmm", required: false, type: "number" },
  { key: "OAT", label: "OAT", unitId: "celsius", required: true, type: "number" },
  { key: "PA", label: "PA", unitId: "feet", required: true, type: "number" },
  { key: "TRQ", label: "TRQ", unitId: "percent", required: true, type: "number" },
  { key: "ITT", label: "Actual ITT", unitId: "celsius", required: true, type: "number" },
  { key: "N1", label: "Actual N1", unitId: "percent", required: true, type: "number" },
];

export const DEFAULT_INPUT_ONLY_PROFILE_TEMPLATE: AircraftProfile = {
  id: "input_only_as350b3e_template",
  modelName: "AS350 B3e",
  engine: "Arriel 2D",
  engineCount: 1,
  checkTypes: ["In-Flight"],
  limits: { deltaPercentPass: 0 },
  inputSchema: {
    "In-Flight": [
      { key: "TTH", label: "Total Time", type: "number", unitId: "hhmm", showInPdf: true },
      { key: "OAT", label: "OAT", type: "number", unitId: "celsius", required: true, showInHistory: true, showInPdf: true},
      { key: "PA", label: "Pressure Altitude", type: "number", unitId: "feet", required: true, showInPdf: true },
      { key: "TOT", label: "TOT", type: "number", unitId: "celsius", required: true, showInHistory: true, showInPdf: true },
      { key: "N1", label: "N1", type: "number", unitId: "percent", required: true, showInHistory: true, showInPdf: true },
      { key: "N2", label: "N2", type: "number", unitId: "rpm", required: true, showInHistory: true, showInPdf: true },
      { key: "TRQ_MARGIN", label: "TRQ Margin", type: "number", unitId: "percent", required: true, showInHistory: true, showInPdf: true, chartable: true },
      { key: "N1_MARGIN", label: "N1 Margin", type: "number", unitId: "percent", required: true, showInHistory: true, showInPdf: true, chartable: true },
      { key: "OVERALL_RESULT", label: "Overall Result", type: "select", required: false, options: ["PASS", "FAIL"], showInPdf: true },
    ],
  },

  calculationId: "generic_placeholder",
  executionMode: "input_only",
  inputOnlyConfig: {
    fieldsByCheckType: {
      "In-Flight": [
        { key: "TTH", label: "Total Time", type: "number", unitId: "hhmm", showInPdf: true },
        { key: "PA", label: "Pressure Altitude", type: "number", unitId: "feet", required: true, showInPdf: true },
        { key: "TOT", label: "TOT", type: "number", unitId: "celsius", required: true, showInHistory: true, showInPdf: true },
        { key: "N1", label: "N1", type: "number", unitId: "percent", required: true, showInHistory: true, showInPdf: true },
        { key: "N2", label: "N2", type: "number", unitId: "percent", required: true, showInHistory: true, showInPdf: true },
        { key: "TRQ_MARGIN", label: "TRQ Margin", type: "number", unitId: "percent", required: true, showInHistory: true, showInPdf: true, chartable: true },
        { key: "N1_MARGIN", label: "N1 Margin", type: "number", unitId: "percent", required: true, showInHistory: true, showInPdf: true, chartable: true },
        { key: "OVERALL_RESULT", label: "Overall Result", type: "select", required: false, options: ["PASS", "FAIL"], showInPdf: true },
      ],
    },
    primaryTrendFieldKey: "TRQ_MARGIN",
    alarmFieldKey: "TRQ_MARGIN",
    alarmDropThreshold: 3,
    pdfLayout: "grouped",
  },
  powerCheckDescription: "Example input-only profile template for an AS350 B3e.",
};

function safeParse(json: string | null): AircraftProfile[] | null {
  if (!json) return null;
  try {
    const data = JSON.parse(json);
    return Array.isArray(data) ? (data as AircraftProfile[]) : null;
  } catch {
    return null;
  }
}

function normalizeField(field: FieldDef): FieldDef {
  const unitId = getFieldUnitId(field);
  return {
    ...field,
    type: field.type ?? "number",
    showInHistory: field.showInHistory ?? false,
    showInPdf: field.showInPdf ?? true,
    chartable: field.chartable ?? false,
    ...(unitId ? { unitId } : {}),
  };
}

function normalizeInputSchema(inputSchema: AircraftProfile["inputSchema"]): AircraftProfile["inputSchema"] {
  return Object.fromEntries(
    Object.entries(inputSchema ?? {}).map(([checkType, fields]) => [checkType, (fields ?? []).map(normalizeField)]),
  ) as AircraftProfile["inputSchema"];
}

function defaultEngines(engineCount: number): EngineDef[] {
  return Array.from({ length: engineCount }, (_, i) => ({
    id: String(i + 1),
    label: `ENG ${i + 1}`,
  }));
}

function normalizeBell412InputSchema(profile: AircraftProfile): AircraftProfile["inputSchema"] {
  const normalizedInputSchema = normalizeInputSchema(profile.inputSchema);
  if (profile.calculationId !== "bell412_pw_pt6t3b_itt" || profile.executionMode === "input_only") return normalizedInputSchema;

  const inFlight = normalizedInputSchema["In-Flight"] ?? [];
  const byKey = new Map<InputFieldKey, FieldDef>(inFlight.map((field) => [field.key as InputFieldKey, field]));

  for (const field of BELL412_IN_FLIGHT_FIELDS) {
    byKey.set(field.key as InputFieldKey, {
      ...field,
      ...(byKey.get(field.key as InputFieldKey) ?? {}),
    });
  }

  return {
    ...normalizedInputSchema,
    "In-Flight": BELL412_IN_FLIGHT_FIELDS.map((field) => byKey.get(field.key as InputFieldKey) ?? field),
  };
}

function normalizeLimits(profile: AircraftProfile): PowerCheckLimits {
  const limits = profile.limits ?? { deltaPercentPass: 0 };
  if (profile.calculationId !== "bell412_pw_pt6t3b_itt") return limits;

  return {
    ...limits,
    bell412IttDeltaPass: limits.bell412IttDeltaPass ?? limits.deltaPercentPass,
    bell412N1DeltaPass: limits.bell412N1DeltaPass ?? limits.deltaPercentPass,
  };
}

function normalizeEngines(engines: EngineDef[] | undefined, engineCount: number): EngineDef[] | undefined {
  const count = Math.max(1, Math.floor(engineCount || 1));

  if (count === 1) {
    return engines && engines.length > 0 ? engines.slice(0, 1) : undefined;
  }

  if (!engines || engines.length === 0) {
    return defaultEngines(count);
  }

  const trimmed = engines.slice(0, count);
  if (trimmed.length < count) {
    const existingIds = new Set(trimmed.map((e) => e.id));
    for (let i = trimmed.length; i < count; i++) {
      const id = String(i + 1);
      trimmed.push({
        id: existingIds.has(id) ? `E${id}` : id,
        label: `ENG ${i + 1}`,
      });
    }
  }

  const seen = new Set<string>();
  const uniqued = trimmed.map((e, idx) => {
    let id = (e.id ?? "").trim() || String(idx + 1);
    if (seen.has(id)) id = `${id}_${idx + 1}`;
    seen.add(id);
    return { ...e, id, label: (e.label ?? "").trim() || `ENG ${idx + 1}` };
  });

  return uniqued;
}

function normalizeInputOnlyConfig(
  config: InputOnlyConfig | undefined,
  fallbackSchema: AircraftProfile["inputSchema"],
): InputOnlyConfig | undefined {
  if (!config && Object.keys(fallbackSchema ?? {}).length === 0) return undefined;
  const fieldsByCheckType = normalizeInputSchema(config?.fieldsByCheckType ?? fallbackSchema);
  return {
    fieldsByCheckType,
    primaryTrendFieldKey: config?.primaryTrendFieldKey,
    alarmFieldKey: config?.alarmFieldKey,
    alarmDropThreshold: typeof config?.alarmDropThreshold === "number" ? config.alarmDropThreshold : 3,
    pdfLayout: config?.pdfLayout ?? "grouped",
  };
}

function normalizeExecutionMode(mode: ProfileExecutionMode | undefined): ProfileExecutionMode {
  return mode === "input_only" ? "input_only" : "calculated";
}

function ensureCheckTypes(list: CheckType[] | undefined, schema: AircraftProfile["inputSchema"]): CheckType[] {
  if (list && list.length > 0) return list;
  const fromSchema = Object.keys(schema ?? {}) as CheckType[];
  return fromSchema.length > 0 ? fromSchema : ["Ground"];
}

function normalizeProfile(p: AircraftProfile): AircraftProfile {
  const derivedCount =
    (typeof p.engineCount === "number" && isFinite(p.engineCount) ? p.engineCount : undefined) ??
    (p.engines?.length ? p.engines.length : undefined) ??
    1;

  const engineCount = Math.max(1, Math.floor(derivedCount));
  const engines = normalizeEngines(p.engines, engineCount);
  const executionMode = normalizeExecutionMode(p.executionMode);
  const inputOnlyConfig = normalizeInputOnlyConfig(p.inputOnlyConfig, p.inputSchema);
  const baseSchema = executionMode === "input_only"
    ? inputOnlyConfig?.fieldsByCheckType ?? {}
    : p.inputSchema;

  const normalizedSchema = normalizeBell412InputSchema({
    ...p,
    executionMode,
    inputSchema: baseSchema,
  });

  return {
    ...p,
    engineCount,
    engines,
    executionMode,
    checkTypes: ensureCheckTypes(p.checkTypes, normalizedSchema),
    limits: normalizeLimits(p),
    inputSchema: normalizedSchema,
    inputOnlyConfig: executionMode === "input_only"
      ? {
          ...(inputOnlyConfig ?? { fieldsByCheckType: normalizedSchema, alarmDropThreshold: 3, pdfLayout: "grouped" }),
          fieldsByCheckType: normalizedSchema,
        }
      : undefined,
  };
}

function normalizeProfiles(list: AircraftProfile[]): AircraftProfile[] {
  return list.map(normalizeProfile);
}

export function ProfilesProvider({ children }: { children: React.ReactNode }) {
  const [profiles, setProfiles] = useState<AircraftProfile[]>([]);

  useEffect(() => {
    let active = true;
    const localV2 = safeParse(localStorage.getItem(STORAGE_KEY_V2));
    const localProfiles = normalizeProfiles(localV2 ?? []);

    fetchProfilesCloud()
      .then(async (remote) => {
        if (!active) return;

        if (remote && remote.length > 0) {
          setProfiles(normalizeProfiles(remote));
        } else if (localProfiles.length > 0) {
          setProfiles(localProfiles);
          await replaceProfilesCloud(localProfiles);
        } else {
          setProfiles([]);
        }

        localStorage.removeItem(STORAGE_KEY_V2);
      })
      .catch((e) => console.error("Failed to load profiles from Supabase:", e));

    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<ProfilesContextValue>(() => {
    return {
      profiles,

      addProfile: (p) => {
        const normalized = normalizeProfile(p);
        setProfiles((prev) => [normalized, ...prev]);
        upsertProfileCloud(normalized).catch((e) =>
          console.error("Failed to upsert profile in Supabase:", e)
        );
      },

      updateProfile: (id, patch) =>
        setProfiles((prev) =>
          prev.map((p) => {
            if (p.id !== id) return p;
            const normalized = normalizeProfile({ ...p, ...patch });
            upsertProfileCloud(normalized).catch((e) =>
              console.error("Failed to update profile in Supabase:", e)
            );
            return normalized;
          })
        ),

      removeProfile: (id) => {
        setProfiles((prev) => prev.filter((p) => p.id !== id));
        deleteProfileCloud(id).catch((e) =>
          console.error("Failed to delete profile in Supabase:", e)
        );
      },

      resetProfiles: () => {
        setProfiles([]);
        replaceProfilesCloud([]).catch((e) =>
          console.error("Failed to reset profiles in Supabase:", e)
        );
        localStorage.removeItem(STORAGE_KEY_V2);
      },
    };
  }, [profiles]);

  return <ProfilesContext.Provider value={value}>{children}</ProfilesContext.Provider>;
}

export function useProfiles() {
  const ctx = useContext(ProfilesContext);
  if (!ctx) throw new Error("useProfiles must be used inside ProfilesProvider");
  return ctx;
}
