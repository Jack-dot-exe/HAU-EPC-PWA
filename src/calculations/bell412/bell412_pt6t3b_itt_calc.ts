import type { CheckType, PowerCheckResult, PowerCheckValues } from "../../domain/models";
import { clamp, interp1D, round1 } from "../utils/interp";
import { ITT_CURVES_BY_OAT, N1_CURVES_BY_OAT, TRQ_TO_Y_BY_PA } from "./bell412_pt6t3b_itt_n1_chart";

export const CALC_VERSION = "0.1 ALPHA";

function getNumeric(values: PowerCheckValues, key: string, fallback?: number): number | undefined {
  const value = values[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return fallback;
}

function sortedNumericKeys<T extends Record<number, unknown>>(obj: T): number[] {
  return Object.keys(obj).map(Number).sort((a, b) => a - b);
}

function interpolateOnCurve<T>(
  points: T[],
  input: number,
  getInput: (point: T) => number,
  getOutput: (point: T) => number
): number {
  if (!points.length) {
    throw new Error("Cannot interpolate on an empty curve");
  }

  const inputValues = points.map(getInput);
  const inputClamped = clamp(input, Math.min(...inputValues), Math.max(...inputValues));

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const aInput = getInput(a);
    const bInput = getInput(b);
    const minInput = Math.min(aInput, bInput);
    const maxInput = Math.max(aInput, bInput);

    if (inputClamped >= minInput && inputClamped <= maxInput) {
      return interp1D(inputClamped, aInput, getOutput(a), bInput, getOutput(b));
    }
  }

  return getOutput(points[points.length - 1]);
}

function yFromTrqAtPa(trq: number, pa: number): number {
  const paLevels = sortedNumericKeys(TRQ_TO_Y_BY_PA);
  const paClamped = clamp(pa, paLevels[0], paLevels[paLevels.length - 1]);

  const lower = paLevels.filter((p) => p <= paClamped).pop() ?? paLevels[0];
  const upper = paLevels.find((p) => p >= paClamped) ?? paLevels[paLevels.length - 1];

  const yOnPa = (paLine: number) => {
    const curve = TRQ_TO_Y_BY_PA[paLine];
    if (!curve?.length) throw new Error(`Missing Bell 412 torque curve for PA=${paLine}`);
    return interpolateOnCurve(curve, trq, (point) => point.trq, (point) => point.y);
  };

  const yLow = yOnPa(lower);
  const yHigh = yOnPa(upper);
  if (lower === upper) return yLow;
  return interp1D(paClamped, lower, yLow, upper, yHigh);
}

function ittOnOatCurveForY(oatLine: number, y: number): number {
  const curve = ITT_CURVES_BY_OAT[oatLine];
  if (!curve?.length) throw new Error(`Missing Bell 412 ITT curve for OAT=${oatLine}`);

  const pointsByY = [...curve].sort((a, b) => a.y - b.y);
  return interpolateOnCurve(pointsByY, y, (point) => point.y, (point) => point.itt);
}

function expectedBell412MaxItt(oat: number, y: number): number {
  const oatLevels = sortedNumericKeys(ITT_CURVES_BY_OAT);
  const oatClamped = clamp(oat, oatLevels[0], oatLevels[oatLevels.length - 1]);

  const lower = oatLevels.filter((t) => t <= oatClamped).pop() ?? oatLevels[0];
  const upper = oatLevels.find((t) => t >= oatClamped) ?? oatLevels[oatLevels.length - 1];

  const ittLow = ittOnOatCurveForY(lower, y);
  const ittHigh = ittOnOatCurveForY(upper, y);
  if (lower === upper) return ittLow;
  return interp1D(oatClamped, lower, ittLow, upper, ittHigh);
}

function n1OnOatCurveForY(oatLine: number, y: number): number {
  const curve = N1_CURVES_BY_OAT[oatLine];
  if (!curve?.length) throw new Error(`Missing Bell 412 N1 curve for OAT=${oatLine}`);

  const pointsByY = [...curve].sort((a, b) => a.y - b.y);
  return interpolateOnCurve(pointsByY, y, (point) => point.y, (point) => point.n1);
}

function expectedBell412MaxN1(oat: number, y: number): number {
  const oatLevels = sortedNumericKeys(N1_CURVES_BY_OAT);
  const oatClamped = clamp(oat, oatLevels[0], oatLevels[oatLevels.length - 1]);

  const lower = oatLevels.filter((t) => t <= oatClamped).pop() ?? oatLevels[0];
  const upper = oatLevels.find((t) => t >= oatClamped) ?? oatLevels[oatLevels.length - 1];

  const n1Low = n1OnOatCurveForY(lower, y);
  const n1High = n1OnOatCurveForY(upper, y);
  if (lower === upper) return n1Low;
  return interp1D(oatClamped, lower, n1Low, upper, n1High);
}

export function computeBell412PwPt6t3bItt(
  checkType: CheckType,
  values: PowerCheckValues,
  passLimits: { itt: number; n1: number }
): PowerCheckResult {
  if (checkType !== "In-Flight") {
    throw new Error(`Bell 412 EPC calculation only supports In-Flight (got ${checkType})`);
  }

  const oat = getNumeric(values, "OAT", 15) ?? 15;
  const pa = getNumeric(values, "PA", 5000) ?? 5000;
  const trq = getNumeric(values, "TRQ");
  const actualItt = getNumeric(values, "ITT");
  const actualN1 = getNumeric(values, "N1");

  if (typeof trq !== "number" || Number.isNaN(trq)) throw new Error("Torque (TRQ) is required");
  if (typeof actualItt !== "number" || Number.isNaN(actualItt)) throw new Error("Actual ITT is required");
  if (typeof actualN1 !== "number" || Number.isNaN(actualN1)) throw new Error("Actual N1 is required");

  const y = yFromTrqAtPa(trq, pa);
  const expectedItt = expectedBell412MaxItt(oat, y);
  const expectedN1 = expectedBell412MaxN1(oat, y);
  const ittDelta = expectedItt - actualItt;
  const n1Delta = expectedN1 - actualN1;
  const ittPass = actualItt <= expectedItt + passLimits.itt;
  const n1Pass = actualN1 <= expectedN1 + passLimits.n1;

  return {
    expectedPct: round1(expectedN1),
    actualPct: round1(actualN1),
    deltaPct: round1(n1Delta),
    pass: ittPass && n1Pass,
    metrics: [
      {
        id: "itt",
        title: "ITT",
        expectedLabel: "Max. Chart ITT",
        actualLabel: "Actual ITT",
        deltaLabel: "Delta ITT",
        unitId: "celsius",
        expected: round1(expectedItt),
        actual: round1(actualItt),
        delta: round1(ittDelta),
        pass: ittPass,
        preferredForTrend: true,
      },
      {
        id: "n1",
        title: "N1",
        expectedLabel: "Max. Chart N1",
        actualLabel: "Actual N1",
        deltaLabel: "Delta N1",
        unitId: "percent",
        expected: round1(expectedN1),
        actual: round1(actualN1),
        delta: round1(n1Delta),
        pass: n1Pass,
        preferredForTrend: true,
      },
    ],
  };
}
