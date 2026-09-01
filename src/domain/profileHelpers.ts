import type { AircraftProfile, CheckType, EngineDef, FieldDef, Registration } from "./models";

/**
 * Create a unique ID with a consistent prefix.
 */
export function makeId(prefix: string): string {
  const raw =
    globalThis.crypto?.randomUUID?.() ??
    `${Math.random().toString(16).slice(2)}_${Date.now()}`;

  return `${prefix}_${raw}`;
}

/**
 * Create a new empty input-only aircraft profile with safe defaults.
 */
export function createBlankInputOnlyProfile(): AircraftProfile {
  return {
    id: makeId("p"),
    modelName: "New Input-Only Profile",
    engine: "Engine",
    engineCount: 1,
    checkTypes: ["In-Flight"],
    limits: { deltaPercentPass: 0 },
    inputSchema: { "In-Flight": [] },
    calculationId: "generic_placeholder",
    executionMode: "input_only",
    inputOnlyConfig: {
      fieldsByCheckType: { "In-Flight": [] },
      alarmDropThreshold: 3,
      pdfLayout: "grouped",
    },
    powerCheckDescription: "",
  };
}

/**
 * Create a new empty input field definition.
 */
export function createField(): FieldDef {
  return {
    key: `FIELD_${Math.random().toString(16).slice(2, 6).toUpperCase()}`,
    label: "New Field",
    type: "number",
    required: false,
    showInHistory: true,
    showInPdf: true,
  };
}

/**
 * Return the engines defined by a profile.
 * Falls back to engineCount when no explicit engine list exists.
 */
export function getProfileEngineDefs(
  profile: AircraftProfile | undefined,
): EngineDef[] {
  if (!profile) return [{ id: "1", label: "ENG 1" }];
  if (profile.engines?.length) return profile.engines;

  const count = Math.max(1, profile.engineCount ?? 1);
  return Array.from({ length: count }, (_, i) => ({
    id: String(i + 1),
    label: `ENG ${i + 1}`,
  }));
}

/**
 * Merge registration-specific engine overrides on top of the profile defaults.
 */
export function getEffectiveEngines(
  registration: Registration,
  profile: AircraftProfile | undefined,
): EngineDef[] {
  const base = getProfileEngineDefs(profile);

  if (!registration.engines?.length) return base;

  const byId = new Map(base.map((engine) => [engine.id, engine]));
  for (const engine of registration.engines) {
    byId.set(engine.id, engine);
  }

  return Array.from(byId.values());
}

/**
 * Safely update inputOnlyConfig while preserving required nested defaults.
 */
export function buildUpdatedInputOnlyConfig(
  profile: AircraftProfile,
  patch: Partial<NonNullable<AircraftProfile["inputOnlyConfig"]>>,
): NonNullable<AircraftProfile["inputOnlyConfig"]> {
  return {
    ...(profile.inputOnlyConfig ?? {}),
    fieldsByCheckType:
      profile.inputOnlyConfig?.fieldsByCheckType ?? profile.inputSchema ?? {},
    ...patch,
  };
}

/**
 * Update the fields for a single check type in inputOnlyConfig.
 */
export function buildUpdatedFieldsByCheckType(
  profile: AircraftProfile,
  checkType: CheckType,
  nextFields: FieldDef[],
): NonNullable<AircraftProfile["inputOnlyConfig"]> {
  return buildUpdatedInputOnlyConfig(profile, {
    fieldsByCheckType: {
      ...(profile.inputOnlyConfig?.fieldsByCheckType ?? {}),
      [checkType]: nextFields,
    },
  });
}
