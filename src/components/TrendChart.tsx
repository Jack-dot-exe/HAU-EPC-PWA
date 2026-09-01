import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import type { AircraftProfile, PowerCheckRecord, PowerCheckResult } from "../domain/models";
import { getEffectiveTotalTimeHrs } from "../domain/checkTotals";
import { getPrimaryDisplayMetric } from "../domain/resultMetrics";
import type { UnitId } from "../domain/units";
import { formatMetricValue, formatValueByUnit, getMetricUnitId, getUnitLabel } from "../domain/units";
import { getInputOnlyMetricValue, isInputOnlyRecord } from "../domain/profileUtils";

type ChartPoint = {
  tt: number;
  ttLabel: string;
  dateLabel: string;
  delta: number;
  trend?: number;
  delta2?: number;
  trend2?: number;
};

function linearRegression(xs: number[], ys: number[]) {
  const n = xs.length;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;

  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    num += dx * (ys[i] - meanY);
    den += dx * dx;
  }

  const slope = den === 0 ? 0 : num / den;
  const intercept = meanY - slope * meanX;
  return { slope, intercept };
}

function round1(v: number) {
  return Math.round(v * 10) / 10;
}

function getPrimaryMetricForEngine(
  record: PowerCheckRecord,
  engineId: string,
  calculationId?: AircraftProfile["calculationId"],
  trendFieldKey?: string,
) {
  if (isInputOnlyRecord(record)) {
    const value = trendFieldKey ? getInputOnlyMetricValue(record, engineId, trendFieldKey) : undefined;
    return typeof value === "number" ? value : null;
  }

  const anyRec: any = record as any;

  if (Array.isArray(anyRec.engines) && anyRec.engines.length > 0) {
    const e = anyRec.engines.find((x: any) => String(x.engineId) === String(engineId)) ?? anyRec.engines[0];
    return getPrimaryDisplayMetric(e?.result as PowerCheckResult | undefined, calculationId)?.delta ?? null;
  }

  return getPrimaryDisplayMetric(anyRec.result as PowerCheckResult | undefined, calculationId)?.delta ?? null;
}

function getEngineOptions(records: PowerCheckRecord[]) {
  const map = new Map<string, string>();
  for (const r of records) {
    const anyRec: any = r as any;
    if (Array.isArray(anyRec.engines) && anyRec.engines.length > 0) {
      for (const e of anyRec.engines) {
        const id = String(e.engineId ?? "1");
        const label = String(e.engineLabel ?? `ENG ${id}`);
        if (!map.has(id)) map.set(id, label);
      }
    }
  }

  const list = Array.from(map.entries()).map(([engineId, engineLabel]) => ({ engineId, engineLabel }));
  if (list.length === 0) return [{ engineId: "1", engineLabel: "ENG 1" }];

  list.sort((a, b) => {
    const an = Number(a.engineId);
    const bn = Number(b.engineId);
    if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
    return a.engineId.localeCompare(b.engineId);
  });

  return list;
}

function formatTTLabel(tt: number) {
  const s = (Math.round(tt * 10) / 10).toString();
  return s.endsWith(".0") ? s.slice(0, -2) : s;
}

function toChartData(
  records: PowerCheckRecord[],
  engineId1: string,
  calculationId?: AircraftProfile["calculationId"],
  engineId2?: string,
  trendFieldKey?: string,
): ChartPoint[] {
  const sorted = records
    .slice()
    .sort((a, b) => {
      const ta = getEffectiveTotalTimeHrs(a);
      const tb = getEffectiveTotalTimeHrs(b);
      if (typeof ta === "number" && typeof tb === "number") return ta - tb;
      if (typeof ta === "number") return -1;
      if (typeof tb === "number") return 1;
      return a.createdAtIso.localeCompare(b.createdAtIso);
    });

  const base: ChartPoint[] = sorted
    .map((r) => {
      const d1 = getPrimaryMetricForEngine(r, engineId1, calculationId, trendFieldKey);
      const d2 = engineId2 ? getPrimaryMetricForEngine(r, engineId2, calculationId, trendFieldKey) : null;
      const tt = getEffectiveTotalTimeHrs(r);
      if (typeof tt !== "number") return null;
      if (d1 === null) return null;

      return {
        tt,
        ttLabel: formatTTLabel(tt),
        dateLabel: new Date(r.createdAtIso).toLocaleDateString(),
        delta: d1,
        ...(d2 !== null ? { delta2: d2 } : {}),
      } as ChartPoint;
    })
    .filter(Boolean) as ChartPoint[];

  if (base.length < 2) return base;

  {
    const xs = base.map((p) => p.tt);
    const ys = base.map((p) => p.delta);
    const { slope, intercept } = linearRegression(xs, ys);
    for (let i = 0; i < base.length; i++) {
      base[i].trend = round1(slope * base[i].tt + intercept);
    }
  }

  if (engineId2) {
    const xs2: number[] = [];
    const ys2: number[] = [];
    base.forEach((p) => {
      if (typeof p.delta2 === "number") {
        xs2.push(p.tt);
        ys2.push(p.delta2);
      }
    });

    if (xs2.length >= 2) {
      const { slope, intercept } = linearRegression(xs2, ys2);
      for (let i = 0; i < base.length; i++) {
        if (typeof base[i].delta2 === "number") {
          base[i].trend2 = round1(slope * base[i].tt + intercept);
        }
      }
    }
  }

  return base;
}

export default function TrendChart({
  records,
  engineId,
  calculationId,
  trendFieldKey,
  trendLabel,
  trendUnitId,
}: {
  records: PowerCheckRecord[];
  engineId?: string;
  calculationId?: AircraftProfile["calculationId"];
  trendFieldKey?: string;
  trendLabel?: string;
  trendUnitId?: UnitId;
}) {
  const engineOptions = getEngineOptions(records);
  const primary = engineOptions.find((e) => e.engineId === engineId) ?? engineOptions[0];
  const secondary = engineOptions.find((e) => e.engineId !== primary.engineId);
  const firstRecord = records[0];
  const isInputOnly = firstRecord ? isInputOnlyRecord(firstRecord) : false;
  const primaryMetric = !isInputOnly && firstRecord
    ? getPrimaryDisplayMetric(
        (firstRecord.engines ?? []).find((engine) => engine.engineId === primary.engineId)?.result,
        calculationId,
      )
    : null;
  const deltaUnit = isInputOnly ? getUnitLabel(trendUnitId) : primaryMetric ? getUnitLabel(getMetricUnitId(primaryMetric)) : "";
  const deltaSeriesName = isInputOnly
    ? `${trendLabel ?? trendFieldKey ?? "Value"}${deltaUnit ? ` (${deltaUnit})` : ""}`
    : primaryMetric
      ? `${primaryMetric.deltaLabel}${deltaUnit ? ` (${deltaUnit})` : ""}`
      : "Delta";

  const data = toChartData(records, primary.engineId, calculationId, secondary?.engineId, trendFieldKey);
  const isMulti = Boolean(secondary);

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="tt"
            type="number"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(v) => formatTTLabel(Number(v))}
            label={{ value: "TT (hrs)", position: "insideBottom", offset: -5 }}
          />

          <YAxis />
          <Tooltip
            labelFormatter={(label) => `TT: ${formatTTLabel(Number(label))} hrs`}
            formatter={(value: any, name: any) => {
              if (typeof value !== "number") return [value, name];
              if (isInputOnly) return [formatValueByUnit(value, trendUnitId), name];
              return [primaryMetric ? formatMetricValue(primaryMetric, value) : value, name];
            }}
            contentStyle={{}}
          />
          <Legend />

          <Line type="monotone" dataKey="delta" name={`${primary.engineLabel} ${deltaSeriesName}`} dot={false} stroke="#008cff" />
          <Line
            type="monotone"
            dataKey="trend"
            name={`${primary.engineLabel} Trend`}
            dot={false}
            stroke="#007d9c"
            strokeDasharray="6 4"
          />

          {isMulti && (
            <>
              <Line
                type="monotone"
                dataKey="delta2"
                name={`${secondary!.engineLabel} ${deltaSeriesName}`}
                dot={false}
                stroke="#7a0000"
              />
              <Line
                type="monotone"
                dataKey="trend2"
                name={`${secondary!.engineLabel} Trend`}
                dot={false}
                stroke="#ff0000"
                strokeDasharray="6 4"
              />
            </>
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
