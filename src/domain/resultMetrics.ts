import type { AircraftProfile, PowerCheckMetricResult, PowerCheckResult } from "./models";
import { getResultMetricLabels } from "./resultLabels";
import { getMetricUnitId } from "./units";

export type DisplayMetric = PowerCheckMetricResult;

function normalizeMetric(metric: PowerCheckMetricResult): DisplayMetric {
  return {
    ...metric,
    unitId: getMetricUnitId(metric),
  };
}

export function getDisplayMetrics(
  result: PowerCheckResult | undefined | null,
  calculationId?: AircraftProfile["calculationId"],
): DisplayMetric[] {
  if (!result) return [];

  if (Array.isArray(result.metrics) && result.metrics.length > 0) {
    return result.metrics.map(normalizeMetric);
  }

  const config = getResultMetricLabels(calculationId)[0];
  return [
    {
      id: config.id,
      title: config.title,
      expectedLabel: config.expected,
      actualLabel: config.actual,
      deltaLabel: config.delta,
      unitId: config.unitId,
      expected: result.expectedPct,
      actual: result.actualPct,
      delta: result.deltaPct,
      pass: result.pass,
      preferredForTrend: config.preferredForTrend,
    },
  ];
}

export function getPrimaryDisplayMetric(
  result: PowerCheckResult | undefined | null,
  calculationId?: AircraftProfile["calculationId"],
): DisplayMetric | null {
  const metrics = getDisplayMetrics(result, calculationId);
  if (metrics.length === 0) return null;
  return metrics.find((metric) => metric.preferredForTrend) ?? metrics.find((metric) => metric.id === "n1") ?? metrics[0];
}
