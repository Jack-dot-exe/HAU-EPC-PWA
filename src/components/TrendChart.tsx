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
import { useEffect, useMemo, useState } from "react";
import type { AircraftProfile, PowerCheckRecord, PowerCheckResult } from "../domain/models";
import { getEffectiveTotalTimeHrs } from "../domain/checkTotals";
import { getDisplayMetrics, getPrimaryDisplayMetric } from "../domain/resultMetrics";
import type { UnitId } from "../domain/units";
import { formatMetricValue, formatValueByUnit } from "../domain/units";
import { getInputOnlyMetricValue, isInputOnlyRecord } from "../domain/profileUtils";
import { formatDateOnly } from "../domain/dates";

type ChartPoint = {
  x: number;
  xLabel: string;
  tt: number;
  ttLabel: string;
  dateLabel: string;
  delta?: number;
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

function getMetricForEngine(
  record: PowerCheckRecord,
  engineId: string,
  metricId: string,
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
    return getDisplayMetrics(e?.result as PowerCheckResult | undefined, calculationId).find((metric) => metric.id === metricId)?.delta ?? null;
  }

  return getDisplayMetrics(anyRec.result as PowerCheckResult | undefined, calculationId).find((metric) => metric.id === metricId)?.delta ?? null;
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
  xAxis: "tt" | "date",
  metricIds: string[],
  calculationId?: AircraftProfile["calculationId"],
  engineId2?: string,
  trendFieldKey?: string,
): ChartPoint[] {
  const sorted = records
    .slice()
    .sort((a, b) => {
      if (xAxis === "date") return a.checkDate.localeCompare(b.checkDate) || a.createdAtIso.localeCompare(b.createdAtIso);
      const ta = getEffectiveTotalTimeHrs(a);
      const tb = getEffectiveTotalTimeHrs(b);
      if (typeof ta === "number" && typeof tb === "number") return ta - tb;
      if (typeof ta === "number") return -1;
      if (typeof tb === "number") return 1;
      return a.checkDate.localeCompare(b.checkDate) || a.createdAtIso.localeCompare(b.createdAtIso);
    });

  const base: ChartPoint[] = sorted
    .map((r) => {
      const tt = getEffectiveTotalTimeHrs(r);
      if (xAxis === "tt" && typeof tt !== "number") return null;
      const x = xAxis === "tt" ? tt! : new Date(`${r.checkDate}T12:00:00`).getTime();
      const values = metricIds.map((metricId) => ({
        metricId,
        value1: getMetricForEngine(r, engineId1, metricId, calculationId, trendFieldKey),
        value2: engineId2 ? getMetricForEngine(r, engineId2, metricId, calculationId, trendFieldKey) : null,
      }));
      if (!values.some((value) => value.value1 !== null || value.value2 !== null)) return null;
      const point: ChartPoint = { x, xLabel: xAxis === "tt" ? `TT: ${formatTTLabel(x)} hrs` : formatDateOnly(r.checkDate), tt: tt ?? 0, ttLabel: tt ? formatTTLabel(tt) : "-", dateLabel: r.checkDate, delta: 0 };
      delete point.delta;
      values.forEach(({ metricId, value1, value2 }) => {
        if (value1 !== null) (point as any)[`delta_${metricId}`] = value1;
        if (value2 !== null) (point as any)[`delta2_${metricId}`] = value2;
      });
      return point;
    })
    .filter(Boolean) as ChartPoint[];

  if (base.length < 2) return base;

  {
    metricIds.forEach((metricId) => {
      const points = base.filter((p) => typeof (p as any)[`delta_${metricId}`] === "number");
      if (points.length < 2) return;
      const { slope, intercept } = linearRegression(points.map((p) => p.x), points.map((p) => (p as any)[`delta_${metricId}`]));
      points.forEach((point) => { (point as any)[`trend_${metricId}`] = round1(slope * point.x + intercept); });
    });
  }

  if (engineId2) {
    metricIds.forEach((metricId) => {
      const points = base.filter((p) => typeof (p as any)[`delta2_${metricId}`] === "number");
      if (points.length < 2) return;
      const { slope, intercept } = linearRegression(points.map((p) => p.x), points.map((p) => (p as any)[`delta2_${metricId}`]));
      points.forEach((point) => { (point as any)[`trend2_${metricId}`] = round1(slope * point.x + intercept); });
    });
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
  const [xAxis, setXAxis] = useState<"tt" | "date">("tt");
  const engineOptions = getEngineOptions(records);
  const primary = engineOptions.find((e) => e.engineId === engineId) ?? engineOptions[0];
  const secondary = engineOptions.find((e) => e.engineId !== primary.engineId);
  const firstRecord = records[0];
  const isInputOnly = firstRecord ? isInputOnlyRecord(firstRecord) : false;
  const availableMetrics = useMemo(() => {
    if (isInputOnly) return [{ id: "input", label: trendLabel ?? trendFieldKey ?? "Value", metric: null }];
    const map = new Map<string, ReturnType<typeof getDisplayMetrics>[number]>();
    records.forEach((record) => {
      getDisplayMetrics(record.engines?.[0]?.result ?? record.result, calculationId).forEach((metric) => map.set(metric.id, metric));
    });
    return Array.from(map.values()).map((metric) => ({ id: metric.id, label: metric.deltaLabel, metric }));
  }, [calculationId, isInputOnly, records, trendFieldKey, trendLabel]);
  const preferredMetricId = availableMetrics.find((entry) => entry.metric?.preferredForTrend)?.id ?? availableMetrics[0]?.id;
  const [selectedMetricIds, setSelectedMetricIds] = useState<string[]>([]);
  useEffect(() => {
    setSelectedMetricIds(preferredMetricId ? [preferredMetricId] : []);
  }, [preferredMetricId]);
  const selectedMetrics = availableMetrics.filter((entry) => selectedMetricIds.includes(entry.id));
  const primaryMetric = !isInputOnly && firstRecord
    ? getPrimaryDisplayMetric(
        (firstRecord.engines ?? []).find((engine) => engine.engineId === primary.engineId)?.result,
        calculationId,
      )
    : null;
  const data = toChartData(records, primary.engineId, xAxis, selectedMetricIds, calculationId, secondary?.engineId, trendFieldKey);
  const toggleMetric = (id: string) => setSelectedMetricIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);

  const isMulti = Boolean(secondary);

  return (
    <div className="w-full">
      <div className="mb-3 flex flex-wrap text-nowrap items-center gap-4 text-sm">
        <label className="flex items-center gap-2">
          <span className="font-semibold">Sort by</span>
          <select className="select select-bordered select-sm" value={xAxis} onChange={(event) => setXAxis(event.target.value as "tt" | "date")}>
            <option value="tt">Total Time (TT)</option>
            <option value="date">Date</option>
          </select>
        </label>
        <span className="font-semibold">Show values</span>
        {availableMetrics.map((metric) => (
          <label key={metric.id} className="flex items-center gap-1">
            <input type="checkbox" className="checkbox checkbox-sm" checked={selectedMetricIds.includes(metric.id)} onChange={() => toggleMetric(metric.id)} />
            {metric.label}
          </label>
        ))}
      </div>
      <div className="h-100 w-full mt-5">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="x"
            type="number"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(v) => xAxis === "tt" ? formatTTLabel(Number(v)) : formatDateOnly(new Date(Number(v)).toISOString().slice(0, 10))}
            label={{ value: xAxis === "tt" ? "TT (hrs)" : "Date", position: "insideBottom", offset: -5 }}
          />

          <YAxis />
          <Tooltip
            labelFormatter={(label) => xAxis === "tt" ? `TT: ${formatTTLabel(Number(label))} hrs` : formatDateOnly(new Date(Number(label)).toISOString().slice(0, 10))}
            formatter={(value: any, name: any) => {
              if (typeof value !== "number") return [value, name];
              if (isInputOnly) return [formatValueByUnit(value, trendUnitId), name];
              return [primaryMetric ? formatMetricValue(primaryMetric, value) : value, name];
            }}
            wrapperStyle={{ zIndex: 1000 }}
            contentStyle={{ zIndex: 1000 }}
          />
          <Legend
            wrapperStyle={{ marginTop: "12px", paddingTop: "20px" }}
          />

          {selectedMetrics.map((entry, index) => <Line key={`delta-${entry.id}`} type="monotone" dataKey={`delta_${entry.id}`} name={`${primary.engineLabel} ${entry.label}`} dot={false} stroke={["#008cff", "#7a0000", "#e67e22"][index % 3]} />)}
          {selectedMetrics.map((entry, index) => <Line key={`trend-${entry.id}`} type="monotone" dataKey={`trend_${entry.id}`} name={`${primary.engineLabel} ${entry.label} Trend`} dot={false} stroke={["#007d9c", "#ff0000", "#a65300"][index % 3]} strokeDasharray="6 4" />)}
          {isMulti && selectedMetrics.map((entry, index) => <Line key={`delta2-${entry.id}`} type="monotone" dataKey={`delta2_${entry.id}`} name={`${secondary!.engineLabel} ${entry.label}`} dot={false} stroke={["#5b2c6f", "#c0392b", "#16a085"][index % 3]} />)}
          {isMulti && selectedMetrics.map((entry, index) => <Line key={`trend2-${entry.id}`} type="monotone" dataKey={`trend2_${entry.id}`} name={`${secondary!.engineLabel} ${entry.label} Trend`} dot={false} stroke={["#8e44ad", "#922b21", "#117864"][index % 3]} strokeDasharray="6 4" />)}
        </LineChart>
      </ResponsiveContainer>
      </div>
    </div>
  );
}
