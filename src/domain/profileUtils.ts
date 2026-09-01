import type {
  AircraftProfile,
  CheckType,
  FieldDef,
  PowerCheckProfileSnapshot,
  PowerCheckRecord,
  PowerCheckValue,
  PowerCheckValues,
  ProfileExecutionMode,
} from "./models";

export const ENV_FIELD_KEYS = new Set(["TTH", "OAT", "PA"]);

export function getExecutionMode(profile?: Pick<AircraftProfile, "executionMode"> | null): ProfileExecutionMode {
  return profile?.executionMode === "input_only" ? "input_only" : "calculated";
}

export function isInputOnlyProfile(profile?: Pick<AircraftProfile, "executionMode"> | null): boolean {
  return getExecutionMode(profile) === "input_only";
}

export function isInputOnlyRecord(record: Pick<PowerCheckRecord, "profileExecutionMode" | "profileSnapshot">): boolean {
  return (record.profileExecutionMode ?? record.profileSnapshot?.executionMode ?? "calculated") === "input_only";
}

export function getProfileFields(profile: AircraftProfile | null | undefined, checkType: CheckType): FieldDef[] {
  if (!profile) return [];
  if (isInputOnlyProfile(profile)) {
    return profile.inputOnlyConfig?.fieldsByCheckType?.[checkType] ?? profile.inputSchema[checkType] ?? [];
  }
  return profile.inputSchema[checkType] ?? [];
}

export function buildProfileSnapshot(profile: AircraftProfile): PowerCheckProfileSnapshot {
  return {
    modelName: profile.modelName,
    engine: profile.engine,
    calculationId: profile.calculationId,
    executionMode: getExecutionMode(profile),
    inputSchema: profile.inputSchema,
    inputOnlyConfig: profile.inputOnlyConfig,
    powerCheckDescription: profile.powerCheckDescription,
  };
}

export function getRecordFieldSchema(record: PowerCheckRecord, fallbackProfile?: AircraftProfile | null): FieldDef[] {
  const fromSnapshot = record.profileSnapshot?.inputSchema?.[record.checkType] ?? [];
  if (fromSnapshot.length > 0) return fromSnapshot;
  return getProfileFields(fallbackProfile, record.checkType);
}

export function getFieldDefByKey(fields: FieldDef[], key: string): FieldDef | undefined {
  return fields.find((field) => String(field.key) === key);
}

export function getNumericValue(values: PowerCheckValues | undefined, key: string): number | undefined {
  const value = values?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function getBooleanValue(values: PowerCheckValues | undefined, key: string): boolean | undefined {
  const value = values?.[key];
  return typeof value === "boolean" ? value : undefined;
}

export function getStringValue(values: PowerCheckValues | undefined, key: string): string | undefined {
  const value = values?.[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

export function getCheckValue(values: PowerCheckValues | undefined, key: string): PowerCheckValue | undefined {
  return values?.[key];
}

export function getInputOnlyMetricValue(record: PowerCheckRecord, engineId: string | undefined, key: string): number | undefined {
  const engines = record.engines ?? [];
  const engine = engineId ? engines.find((item) => item.engineId === engineId) ?? engines[0] : engines[0];
  return getNumericValue(engine?.values, key);
}

export function parseOverallResultValue(value: PowerCheckValue | undefined): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toUpperCase();
    if (normalized === "PASS") return true;
    if (normalized === "FAIL") return false;
  }
  return undefined;
}
