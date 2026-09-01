import type { UnitId } from "./units";
import type { AircraftProfile } from "../domain/models";

export type ResultMetricConfig = {
  id: string;
  title: string;
  expected: string;
  actual: string;
  delta: string;
  unitId?: UnitId;
  preferredForTrend?: boolean;
};

export const DEFAULT_RESULT_LABELS: ResultMetricConfig = {
  id: "default",
  title: "Result",
  expected: "Expected",
  actual: "Actual",
  delta: "Delta",
  unitId: "percent",
};

export const RESULT_METRICS_BY_CALC_ID: Partial<Record<AircraftProfile["calculationId"], ResultMetricConfig[]>> = {
  ec135_arrius_2b1_n1: [
    {
      id: "n1",
      title: "N1",
      expected: "Max. Chart N1",
      actual: "Actual N1",
      delta: "Delta N1",
      unitId: "percent",
      preferredForTrend: true,
    },
  ],
  bell412_pw_pt6t3b_itt: [
    {
      id: "itt",
      title: "ITT",
      expected: "Max. Chart ITT",
      actual: "Actual ITT",
      delta: "Delta ITT",
      unitId: "celsius",
    },
    {
      id: "n1",
      title: "N1",
      expected: "Max. Chart N1",
      actual: "Actual N1",
      delta: "Delta N1",
      unitId: "percent",
      preferredForTrend: true,
    },
  ],
  generic_placeholder: [DEFAULT_RESULT_LABELS],
};

export function getResultMetricLabels(calculationId?: AircraftProfile["calculationId"]): ResultMetricConfig[] {
  return (calculationId && RESULT_METRICS_BY_CALC_ID[calculationId]) ?? [DEFAULT_RESULT_LABELS];
}

export function getResultLabels(calculationId?: AircraftProfile["calculationId"]): ResultMetricConfig {
  return getResultMetricLabels(calculationId)[0];
}
