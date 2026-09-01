import type { UnitId } from "./units";

export type CheckType = "Ground" | "Hover" | "In-Flight";

export type InputFieldKey =
  | "TTH"
  | "OAT"
  | "PA"
  | "TRQ"
  | "TOT"
  | "ITT"
  | "N1"
  | "N2";

export type FieldKey = InputFieldKey | string;
export type ProfileExecutionMode = "calculated" | "input_only";
export type InputFieldType = "number" | "text" | "select" | "boolean";
export type PowerCheckValue = number | string | boolean;
export type PowerCheckValues = Partial<Record<string, PowerCheckValue>>;

export interface FieldDef {
  key: FieldKey;
  label: string;
  type?: InputFieldType;
  unitId?: UnitId;
  unit?: string;
  required?: boolean;
  step?: number;
  min?: number;
  max?: number;
  options?: string[];
  showInHistory?: boolean;
  showInPdf?: boolean;
  chartable?: boolean;
}

export type EngineId = string;

export interface EngineDef {
  id: EngineId;
  label: string;
}

export interface PowerCheckMetricResult {
  id: string;
  title: string;
  expectedLabel: string;
  actualLabel: string;
  deltaLabel: string;
  unitId?: UnitId;
  unitSuffix?: string;
  expected: number;
  actual: number;
  delta: number;
  pass: boolean;
  preferredForTrend?: boolean;
}

export interface PowerCheckResult {
  expectedPct: number;
  actualPct: number;
  deltaPct: number;
  pass: boolean;
  metrics?: PowerCheckMetricResult[];
}

export interface EnginePowerCheck {
  engineId: EngineId;
  engineLabel?: string;
  values: PowerCheckValues;
  result?: PowerCheckResult;
}

export interface PowerCheckOverallResult {
  pass: boolean;
  flags?: Array<{
    code: string;
    severity: "WARN" | "FAIL";
    message: string;
  }>;
}

export type CalculationId =
  | "ec135_arrius_2b1_n1"
  | "bell412_pw_pt6t3b_itt"
  | "generic_placeholder";

export interface PowerCheckLimits {
  deltaPercentPass: number;
  bell412IttDeltaPass?: number;
  bell412N1DeltaPass?: number;
}

export interface InputOnlyConfig {
  fieldsByCheckType: Partial<Record<CheckType, FieldDef[]>>;
  primaryTrendFieldKey?: string;
  alarmFieldKey?: string;
  alarmDropThreshold?: number;
  pdfLayout?: "grouped" | "flat";
}

export interface AircraftProfile {
  id: string;
  modelName: string;
  engine: string;
  engineCount?: number;
  engines?: EngineDef[];
  checkTypes: CheckType[];
  limits: PowerCheckLimits;
  inputSchema: Partial<Record<CheckType, FieldDef[]>>;
  calculationId: CalculationId;
  executionMode?: ProfileExecutionMode;
  inputOnlyConfig?: InputOnlyConfig;
  powerCheckDescription?: string;
}

export interface Registration {
  id: string;
  tailNumber: string;
  profileId: string;
  engines?: EngineDef[];
}

export type Role = "admin" | "editor" | "viewer";

export interface User {
  id: string;
  email: string;
  role: Role;
  isActive: boolean;
  passwordSalt?: string;
  passwordHash?: string;
  passwordIterations?: number;
}

export interface PowerCheckProfileSnapshot {
  modelName: string;
  engine: string;
  calculationId: CalculationId;
  executionMode: ProfileExecutionMode;
  inputSchema: Partial<Record<CheckType, FieldDef[]>>;
  inputOnlyConfig?: InputOnlyConfig;
  powerCheckDescription?: string;
}

export interface PowerCheckRecord {
  id: string;
  createdAtIso: string;
  registrationId: string;
  checkType: CheckType;
  totalTimeHrs?: number;
  calculationVersion?: string;
  profileExecutionMode?: ProfileExecutionMode;
  createdByUserId?: string;
  createdByUserEmail?: string;
  schemaVersion?: 1 | 2;
  profileSnapshot?: PowerCheckProfileSnapshot;
  values?: PowerCheckValues;
  result?: PowerCheckResult;
  engines?: EnginePowerCheck[];
  overallResult?: PowerCheckOverallResult;
}
