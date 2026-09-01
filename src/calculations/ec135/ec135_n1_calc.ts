import type { CheckType, PowerCheckResult, PowerCheckValues } from "../../domain/models";
import { EC135_N1_CHART } from "./ec135_n1_chart";
import { clamp, interp1D, round1 } from "../utils/interp";

export const CALC_VERSION = "0.1 ALPHA";

function getNumeric(values: PowerCheckValues, key: string, fallback?: number): number | undefined {
  const value = values[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return fallback;
}

function n1OnPaLine(paLine: number, oat: number): number {
  const curve = EC135_N1_CHART[paLine];
  if (!curve?.length) throw new Error(`Missing EC135 curve for PA=${paLine}`);

  const minO = curve[0].oat;
  const maxO = curve[curve.length - 1].oat;
  const oatClamped = clamp(oat, minO, maxO);

  for (let i = 0; i < curve.length - 1; i++) {
    const a = curve[i];
    const b = curve[i + 1];
    if (oatClamped >= a.oat && oatClamped <= b.oat) {
      return interp1D(oatClamped, a.oat, a.n1, b.oat, b.n1);
    }
  }
  return curve[curve.length - 1].n1;
}

function expectedEc135N1(oat: number, pa: number): number {
  const paLevels = Object.keys(EC135_N1_CHART).map(Number).sort((a, b) => a - b);
  const paClamped = clamp(pa, paLevels[0], paLevels[paLevels.length - 1]);

  const lower = paLevels.filter((p) => p <= paClamped).pop() ?? paLevels[0];
  const upper = paLevels.find((p) => p >= paClamped) ?? paLevels[paLevels.length - 1];

  const n1Low = n1OnPaLine(lower, oat);
  const n1High = n1OnPaLine(upper, oat);

  if (lower === upper) return n1Low;
  return interp1D(paClamped, lower, n1Low, upper, n1High);
}

export function computeEc135Arrius2B1N1(
  checkType: CheckType,
  values: PowerCheckValues,
  passLimit: number
): PowerCheckResult {
  if (checkType !== "In-Flight") {
    throw new Error(`EC135 N1 calculation only supports In-Flight (got ${checkType})`);
  }

  //Show default values on entry sheet
  const oat = getNumeric(values, "OAT", 15) ?? 15;
  const pa = getNumeric(values, "PA", 5000) ?? 5000;

  const actualN1 = getNumeric(values, "N1");
  if (typeof actualN1 !== "number" || Number.isNaN(actualN1)) {
    throw new Error("Actual N1 is required");
  }

  const expectedN1 = expectedEc135N1(oat, pa);
  const delta = expectedN1 - actualN1;
  // PASS if actual <= expected (+ optional tolerance)
  const pass = actualN1 <= expectedN1 + passLimit;
  
  return {
    expectedPct: round1(expectedN1),
    actualPct: round1(actualN1),
    deltaPct: round1(delta),
    pass,
  };
}


