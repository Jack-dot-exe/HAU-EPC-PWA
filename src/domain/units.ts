import { decimalToHHMM } from "../calculations/utils/time";
import type { FieldDef, InputFieldKey, PowerCheckMetricResult, PowerCheckValue } from "./models";

export type UnitId = "percent" | "celsius" | "feet" | "hhmm" | "rpm";

export const UNIT_LABELS: Record<UnitId, string> = {
  percent: "%",
  celsius: "°C",
  feet: "ft",
  hhmm: "HH:MM",
  rpm: "RPM",
};

const LEGACY_UNIT_MAP: Record<string, UnitId> = {
  "%": "percent",
  ft: "feet",
  "HH:MM": "hhmm",
  "C": "celsius",
  "°C": "celsius",
  "Â°C": "celsius",
  "Ã‚Â°C": "celsius",
  "rpm": "rpm",
};

const INPUT_FIELD_UNITS: Partial<Record<InputFieldKey, UnitId>> = {
  TTH: "hhmm",
  OAT: "celsius",
  PA: "feet",
  TRQ: "percent",
  TOT: "celsius",
  ITT: "celsius",
  N1: "percent",
  N2: "rpm",
};

export function getUnitLabel(unitId?: UnitId): string {
  return unitId ? UNIT_LABELS[unitId] : "";
}

export function normalizeLegacyUnit(unit?: string): UnitId | undefined {
  if (!unit) return undefined;
  return LEGACY_UNIT_MAP[unit.trim()];
}

export function getInputFieldUnitId(key: string): UnitId | undefined {
  return INPUT_FIELD_UNITS[key as InputFieldKey];
}

export function getFieldUnitId(field: Pick<FieldDef, "key" | "unitId"> & { unit?: string }): UnitId | undefined {
  return field.unitId ?? normalizeLegacyUnit(field.unit) ?? getInputFieldUnitId(String(field.key));
}

export function getMetricUnitId(
  metric: Pick<PowerCheckMetricResult, "unitId"> & { unitSuffix?: string },
): UnitId | undefined {
  return metric.unitId ?? normalizeLegacyUnit(metric.unitSuffix);
}

export function formatValueByUnit(value: number, unitId?: UnitId): string {
  if (unitId === "hhmm") return decimalToHHMM(value);
  const unit = getUnitLabel(unitId);
  return unit ? `${value} ${unit}` : String(value);
}

export function formatCheckValue(value: PowerCheckValue | undefined, field?: Pick<FieldDef, "key" | "unitId"> & { unit?: string }): string {
  if (value === undefined || value === null) return "-";
  if (typeof value === "number") {
    return formatValueByUnit(value, field ? getFieldUnitId(field) : undefined);
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return value || "-";
}

export function formatFieldValue(
  field: Pick<FieldDef, "key" | "unitId"> & { unit?: string },
  value: PowerCheckValue | undefined,
): string {
  return formatCheckValue(value, field);
}

export function formatMetricValue(
  metric: Pick<PowerCheckMetricResult, "unitId"> & { unitSuffix?: string },
  value: number,
): string {
  const unit = getUnitLabel(getMetricUnitId(metric));
  return unit ? `${value}${unit}` : String(value);
}

// Shared Units
export const AVAILABLE_UNITS: UnitId[] = ["percent", "celsius", "feet", "hhmm", "rpm"];

export function getAvailableUnits() {
  return AVAILABLE_UNITS.map((unitId) => ({
    id: unitId,
    label: getUnitLabel(unitId),
  }));
}
