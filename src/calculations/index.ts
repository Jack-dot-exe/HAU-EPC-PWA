import type {
  AircraftProfile,
  CheckType,
  EngineDef,
  PowerCheckOverallResult,
  PowerCheckResult,
  PowerCheckValues,
} from "../domain/models";
import { computeEc135Arrius2B1N1, CALC_VERSION as EC135_VERSION } from "./ec135/ec135_n1_calc";
import { computeBell412PwPt6t3bItt, CALC_VERSION as BELL412_VERSION } from "./bell412/bell412_pt6t3b_itt_calc";
import { clamp, round1 } from "./utils/interp";

export const CALC_VERSIONS = {
  bell412_pw_pt6t3b_itt: BELL412_VERSION,
  ec135_arrius_2b1_n1: EC135_VERSION,
  generic_placeholder: "GENERIC",
} as const;

export type PreparedCheck = {
  calculationVersion?: string;
  engines: Array<{
    engineId: string;
    engineLabel?: string;
    values: PowerCheckValues;
    result?: PowerCheckResult;
  }>;
  overallResult?: PowerCheckOverallResult;
};

function getNumeric(values: PowerCheckValues, key: string, fallback?: number): number | undefined {
  const value = values[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return fallback;
}

export function computeForProfile(profile: AircraftProfile, checkType: CheckType, values: PowerCheckValues) {
  const passLimit = profile.limits.deltaPercentPass;

  switch (profile.calculationId) {
    case "ec135_arrius_2b1_n1":
      return computeEc135Arrius2B1N1(checkType, values, passLimit);

    case "bell412_pw_pt6t3b_itt":
      return computeBell412PwPt6t3bItt(checkType, values, {
        itt: profile.limits.bell412IttDeltaPass ?? passLimit,
        n1: profile.limits.bell412N1DeltaPass ?? passLimit,
      });

    case "generic_placeholder":
    default: {
      const oat = getNumeric(values, "OAT", 15) ?? 15;
      const pa = getNumeric(values, "PA", 0) ?? 0;
      const trqOrN1 = getNumeric(values, "TRQ") ?? getNumeric(values, "N1") ?? 70;
      const ittOrTot = getNumeric(values, "ITT") ?? getNumeric(values, "TOT") ?? 600;

      const expected = clamp(100 - pa / 300 - Math.max(0, oat - 15) * 0.5, 40, 100);
      const actual = clamp(60 + trqOrN1 * 0.4 + ittOrTot * 0.01, 40, 110);
      const delta = actual - expected;

      return {
        expectedPct: round1(expected),
        actualPct: round1(actual),
        deltaPct: round1(delta),
        pass: Math.abs(delta) <= passLimit,
      };
    }
  }
}

export function prepareInputOnlyCheck(params: {
  engines: EngineDef[];
  engineValues: PowerCheckValues[];
}): PreparedCheck {
  return {
    calculationVersion: undefined,
    engines: params.engines.map((engine, index) => ({
      engineId: engine.id,
      engineLabel: engine.label,
      values: params.engineValues[index] ?? {},
    })),
    overallResult: undefined,
  };
}

export function prepareCalculatedCheck(params: {
  profile: AircraftProfile;
  checkType: CheckType;
  engines: EngineDef[];
  engineValues: PowerCheckValues[];
}): PreparedCheck {
  const passLimit = params.profile.limits.deltaPercentPass;

  const preparedEngines = params.engines.map((engine, index) => {
    const values = params.engineValues[index] ?? {};
    const raw = computeForProfile(params.profile, params.checkType, values);

    const result: PowerCheckResult = {
      expectedPct: raw.expectedPct,
      actualPct: raw.actualPct,
      deltaPct: raw.deltaPct,
      pass: raw.pass,
      metrics: raw.metrics,
    };

    return {
      engineId: engine.id,
      engineLabel: engine.label,
      values,
      result,
    };
  });

  const overallPass =
    preparedEngines.length === 0 ? undefined : preparedEngines.every((engine) => engine.result?.pass !== false);

  const flags =
    preparedEngines
      .filter((engine) => engine.result?.pass === false)
      .map((engine) => ({
        code: "DELTA_LIMIT_EXCEEDED",
        severity: "FAIL" as const,
        message: `${engine.engineLabel ?? engine.engineId} exceeds delta limit of ${passLimit}%`,
      })) || [];

  return {
    calculationVersion:
      params.profile.calculationId ? CALC_VERSIONS[params.profile.calculationId] : undefined,
    engines: preparedEngines,
    overallResult: overallPass === undefined
      ? undefined
      : {
          pass: overallPass,
          flags,
        },
  };
}

export function prepareCheckFromProfile(params: {
  profile: AircraftProfile;
  checkType: CheckType;
  engines: EngineDef[];
  engineValues: PowerCheckValues[];
}): PreparedCheck {
  if (params.profile.executionMode === "input_only") {
    return prepareInputOnlyCheck({
      engines: params.engines,
      engineValues: params.engineValues,
    });
  }

  return prepareCalculatedCheck(params);
}
