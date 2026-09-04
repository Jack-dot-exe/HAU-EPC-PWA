import { useEffect, useMemo, useState } from "react";
import RegistrationPicker from "../components/RegistrationPicker";
import TrendChart from "../components/TrendChart";
import PdfPreviewModal from "../components/PdfPreviewModal";
import { useRegistrations } from "../app/registrationStore";
import { useChecks } from "../app/checksStore";
import { useUsers } from "../app/usersStore";
import { useProfiles } from "../app/profileStore";
import type { AircraftProfile, CheckType, FieldDef, PowerCheckRecord, PowerCheckResult, PowerCheckValues } from "../domain/models";
import { getEffectiveTotalTimeHrs } from "../domain/checkTotals";
import { decimalToHHMM } from "../calculations/utils/time";
import { getDisplayMetrics, getPrimaryDisplayMetric } from "../domain/resultMetrics";
import { formatCheckValue, formatMetricValue, getFieldUnitId, getUnitLabel } from "../domain/units";
import { getResultMetricLabels } from "../domain/resultLabels";
import { createSavedCheckPdfBlob, downloadSavedCheckPdf } from "../lib/epcPdf";
import { getFieldDefByKey, getInputOnlyMetricValue, getProfileFields, getRecordFieldSchema, isInputOnlyRecord } from "../domain/profileUtils";
import { formatDateOnly } from "../domain/dates";

type CheckTypeFilter = "All" | CheckType;

type EngineRow = {
  engineId: string;
  engineLabel: string;
  values?: PowerCheckValues;
  result?: PowerCheckResult;
};

type PreparedHistoryRow = {
  record: PowerCheckRecord;
  engines: EngineRow[];
  overallPass: boolean | null;
};

const DROP_ALARM_THRESHOLD_PCT = 3;
const AVG_WINDOW = 5;

function toISODateOnly(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function withinDateRange(dateIso: string, from?: string, to?: string) {
  const t = dateIso;
  if (from) {
    const f = from;
    if (t < f) return false;
  }
  if (to) {
    const tt = to;
    if (t > tt) return false;
  }
  return true;
}

function avg(nums: number[]) {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function getEngines(record: PowerCheckRecord): EngineRow[] {
  if (Array.isArray(record.engines) && record.engines.length > 0) {
    return record.engines.map((e, idx) => ({
      engineId: String(e.engineId ?? idx + 1),
      engineLabel: String(e.engineLabel ?? `ENG ${idx + 1}`),
      values: e.values,
      result: e.result,
    }));
  }

  return [
    {
      engineId: "1",
      engineLabel: "ENG 1",
      values: record.values,
      result: record.result,
    },
  ];
}

function formatTotalTime(record: PowerCheckRecord) {
  const t = getEffectiveTotalTimeHrs(record);
  if (t === undefined) return "-";
  return decimalToHHMM(t);
}

function getOverallPass(record: PowerCheckRecord): boolean | null {
  if (typeof record.overallResult?.pass === "boolean") {
    return record.overallResult.pass;
  }

  const engines = getEngines(record);
  if (engines.length > 0 && engines.some((e) => e?.result && typeof e.result.pass === "boolean")) {
    const passes = engines.map((e) => e?.result?.pass).filter((x) => typeof x === "boolean") as boolean[];
    if (passes.length > 0) return passes.every(Boolean);
  }

  if (typeof record.result?.pass === "boolean") return record.result.pass;
  return null;
}

function getProfileForRecord(record: PowerCheckRecord, profile?: AircraftProfile | null): AircraftProfile | null {
  if (profile) return profile;
  if (!record.profileSnapshot) return null;

  return {
    id: "snapshot",
    modelName: record.profileSnapshot.modelName,
    engine: record.profileSnapshot.engine,
    checkTypes: [record.checkType],
    limits: { deltaPercentPass: 0 },
    inputSchema: record.profileSnapshot.inputSchema,
    calculationId: record.profileSnapshot.calculationId,
    executionMode: record.profileSnapshot.executionMode,
    inputOnlyConfig: record.profileSnapshot.inputOnlyConfig,
    powerCheckDescription: record.profileSnapshot.powerCheckDescription,
  };
}

function getInputOnlyPrimaryField(record: PowerCheckRecord, profile?: AircraftProfile | null): FieldDef | undefined {
  const config = record.profileSnapshot?.inputOnlyConfig ?? profile?.inputOnlyConfig;
  const key = config?.primaryTrendFieldKey;
  if (!key) return undefined;
  return getFieldDefByKey(getRecordFieldSchema(record, profile), key);
}

function getPrimaryDelta(result: PowerCheckResult | undefined, calculationId?: AircraftProfile["calculationId"]) {
  return getPrimaryDisplayMetric(result, calculationId)?.delta ?? null;
}

function getTrendValue(record: PowerCheckRecord, engineId: string, profile?: AircraftProfile | null) {
  if (isInputOnlyRecord(record)) {
    const field = getInputOnlyPrimaryField(record, profile);
    if (!field) return null;
    return getInputOnlyMetricValue(record, engineId, String(field.key)) ?? null;
  }

  const engine = getEngines(record).find((e) => e.engineId === engineId);
  return getPrimaryDelta(engine?.result, profile?.calculationId);
}

function getAlarmValue(record: PowerCheckRecord, engineId: string, profile?: AircraftProfile | null) {
  if (isInputOnlyRecord(record)) {
    const key = record.profileSnapshot?.inputOnlyConfig?.alarmFieldKey ?? profile?.inputOnlyConfig?.alarmFieldKey;
    if (!key) return null;
    return getInputOnlyMetricValue(record, engineId, key) ?? null;
  }

  const engine = getEngines(record).find((e) => e.engineId === engineId);
  return getPrimaryDelta(engine?.result, profile?.calculationId);
}

function getAlarmThreshold(record: PowerCheckRecord, profile?: AircraftProfile | null) {
  if (isInputOnlyRecord(record)) {
    return record.profileSnapshot?.inputOnlyConfig?.alarmDropThreshold ?? profile?.inputOnlyConfig?.alarmDropThreshold ?? DROP_ALARM_THRESHOLD_PCT;
  }
  return DROP_ALARM_THRESHOLD_PCT;
}

function computeAlarmForRecordEngine(
  rows: PreparedHistoryRow[],
  idx: number,
  engineId: string,
  profile?: AircraftProfile | null,
) {
  const current = rows[idx];
  const prev = rows.slice(idx + 1);

  const cur = getAlarmValue(current.record, engineId, profile);
  const lastPrev = prev[0] ? getAlarmValue(prev[0].record, engineId, profile) : null;

  const prevWindow = prev
    .slice(0, AVG_WINDOW)
    .map((r) => getAlarmValue(r.record, engineId, profile))
    .filter((x) => typeof x === "number") as number[];

  const avgPrev = avg(prevWindow);
  const threshold = getAlarmThreshold(current.record, profile);
  const belowAvg = avgPrev !== null && typeof cur === "number" && cur <= avgPrev - threshold;
  const belowLast = lastPrev !== null && typeof cur === "number" && cur <= lastPrev - threshold;

  return { alarm: belowAvg || belowLast, avgPrev, lastPrev };
}

function computeAlarmForRecordAnyEngine(rows: PreparedHistoryRow[], idx: number, profile?: AircraftProfile | null) {
  const engines = rows[idx].engines;
  const perEngine = engines.map((e) => ({
    engineLabel: e.engineLabel,
    ...computeAlarmForRecordEngine(rows, idx, e.engineId, profile),
  }));

  return { anyAlarm: perEngine.some((x) => x.alarm), perEngine };
}

function MetricList({ result, calculationId }: { result?: PowerCheckResult; calculationId?: AircraftProfile["calculationId"] }) {
  const metrics = getDisplayMetrics(result, calculationId);

  return (
    <div className="grid gap-y-2">
      {metrics.map((metric) => (
        <div key={metric.id} className="rounded-box border border-base-300 p-1">
          <div className="grid grid-cols-4 gap-1 text-right">
            <div className="text-left">
              <h1>{metric.title}</h1>
            </div>

            <div>
              <div className="text-xs opacity-70">{metric.expectedLabel}</div>
              <div className="font-mono">
                {formatMetricValue(metric, metric.expected)}
              </div>
            </div>
            <div>
              <div className="text-xs opacity-70">{metric.actualLabel}</div>
              <div className="font-mono">
                {formatMetricValue(metric, metric.actual)}
              </div>
            </div>
            <div>
              <div className="text-xs opacity-70">{metric.deltaLabel}</div>
              <div className="font-mono">
                {formatMetricValue(metric, metric.delta)}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function InputOnlyFieldList({ record, profile }: { record: PowerCheckRecord; profile?: AircraftProfile | null }) {
  const fields = getRecordFieldSchema(record, profile).filter((field) => field.showInHistory || field.showInPdf || field.required);
  const engines = getEngines(record);

  return (
    <div className="space-y-3">
      {engines.map((engine) => (
        <div key={engine.engineId} className="rounded-box border border-base-300 p-3">
          <div className="mb-2 font-mono">{engine.engineLabel}</div>
          <div className="grid gap-1 text-sm">
            {fields.map((field) => (
              <div key={`${engine.engineId}_${String(field.key)}`} className="flex items-center justify-between gap-3">
                <span className="opacity-70">{field.label}</span>
                <span className="font-mono">{formatCheckValue(engine.values?.[String(field.key)], field)}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function EnginePassSummary({ engines, inputOnly }: { engines: EngineRow[]; inputOnly: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      {engines.map((engine) => {
        const pass = typeof engine.result?.pass === "boolean" ? engine.result.pass : null;
        return (
          <div key={engine.engineId} className="flex items-center gap-2">
            {inputOnly ? (
              <span className="badge badge-info badge-sm">INPUT</span>
            ) : pass === null ? (
              <span className="badge badge-ghost badge-sm">-</span>
            ) : (
              <span className={`badge badge-sm ${pass ? "badge-success" : "badge-error"}`}>
                {pass ? "PASS" : "FAIL"}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function DeltaSummary({
  record,
  engines,
  profile,
}: {
  record: PowerCheckRecord;
  engines: EngineRow[];
  profile?: AircraftProfile | null;
}) {
  if (isInputOnlyRecord(record)) {
    const field = getInputOnlyPrimaryField(record, profile);
    return (
      <div className="inline-grid gap-1 text-xs">
        {engines.map((engine) => (
          <div
            key={engine.engineId}
            className="inline-grid w-fit gap-2 rounded-box border border-base-300 px-2 py-1 justify-start"
            style={{ gridTemplateColumns: "auto auto" }}
          >
            <div className="font-mono whitespace-nowrap">{engine.engineLabel}</div>
            <div className="font-mono whitespace-nowrap">
              <span className="opacity-70">{field?.label ?? "Value"}:</span>{" "}
              {field ? formatCheckValue(engine.values?.[String(field.key)], field) : "-"}
            </div>
          </div>
        ))}
      </div>
    );
  }

  const metricsByEngine = engines.map((engine) => ({
    engineId: engine.engineId,
    engineLabel: engine.engineLabel,
    metrics: getDisplayMetrics(engine.result, profile?.calculationId),
  }));

  return (
    <div className="inline-grid gap-1 text-xs">
      {metricsByEngine.map((engine, index) => {
        const fallbackLabel = `ENG ${index + 1}`;

        return (
          <div
            key={engine.engineId}
            className="inline-grid w-fit gap-2 rounded-box border border-base-300 px-2 py-1 justify-start"
            style={{ gridTemplateColumns: "auto auto" }}
          >
            <div className="font-mono whitespace-nowrap">
              {engine.engineLabel || fallbackLabel}
            </div>

            <div className="flex flex-wrap gap-x-3 gap-y-1 w-fit">
              {engine.metrics.length > 0 ? (
                engine.metrics.map((metric) => (
                  <div key={metric.id} className="font-mono whitespace-nowrap">
                    <span className="opacity-70">Delta-{metric.title}:</span>
                    {formatMetricValue(metric, metric.delta)}
                  </div>
                ))
              ) : (
                <div className="font-mono">-</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function HistoryPage() {
  const { checks, removeCheck } = useChecks();
  const { currentUser } = useUsers();
  const isAdmin = currentUser?.role === "admin";
  const { registrations } = useRegistrations();
  const { profiles } = useProfiles();

  const [registrationId, setRegistrationId] = useState(registrations[0]?.id ?? "");
  const [checkTypeFilter, setCheckTypeFilter] = useState<CheckTypeFilter>("All");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [selected, setSelected] = useState<PowerCheckRecord | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const selectedRegistration = useMemo(
    () => registrations.find((r) => r.id === registrationId),
    [registrations, registrationId],
  );

  const selectedProfile = useMemo(
    () => profiles.find((p) => p.id === selectedRegistration?.profileId),
    [profiles, selectedRegistration?.profileId],
  );

  const selectedRecordRegistration = useMemo(
    () => registrations.find((r) => r.id === selected?.registrationId) ?? null,
    [registrations, selected?.registrationId],
  );

  const selectedRecordProfile = useMemo(
    () => profiles.find((p) => p.id === selectedRecordRegistration?.profileId) ?? null,
    [profiles, selectedRecordRegistration?.profileId],
  );

  const resultLabels = useMemo(
    () => getResultMetricLabels(selectedProfile?.calculationId),
    [selectedProfile?.calculationId],
  );

  const trendMetric = resultLabels.find((metric) => metric.preferredForTrend) ?? resultLabels[0];

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const allForRegSortedDesc = useMemo(() => {
    return checks
      .filter((c) => c.registrationId === registrationId)
      .slice()
      .sort((a, b) => b.checkDate.localeCompare(a.checkDate) || b.createdAtIso.localeCompare(a.createdAtIso));
  }, [checks, registrationId]);

  const filtered = useMemo(() => {
    return allForRegSortedDesc.filter((c) => {
      if (checkTypeFilter !== "All" && c.checkType !== checkTypeFilter) return false;
      if (!withinDateRange(c.checkDate, fromDate || undefined, toDate || undefined)) return false;
      return true;
    });
  }, [allForRegSortedDesc, checkTypeFilter, fromDate, toDate]);

  const preparedRows = useMemo<PreparedHistoryRow[]>(() => {
    return filtered.map((record) => ({
      record,
      engines: getEngines(record),
      overallPass: getOverallPass(record),
    }));
  }, [filtered]);

  const alarmCount = useMemo(() => {
    let n = 0;
    for (let i = 0; i < preparedRows.length; i++) {
      const { anyAlarm } = computeAlarmForRecordAnyEngine(preparedRows, i, selectedProfile);
      if (anyAlarm) n++;
    }
    return n;
  }, [preparedRows, selectedProfile]);

  const availableCheckTypes = useMemo(() => {
    const set = new Set<CheckType>();
    for (const c of allForRegSortedDesc) set.add(c.checkType);
    return Array.from(set).sort();
  }, [allForRegSortedDesc]);

  function closePreview() {
    setPreviewOpen(false);
    setPreviewError(null);
    setPreviewLoading(false);
    setDownloadingPdf(false);
    setPreviewUrl((currentUrl) => {
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      return null;
    });
  }

  async function onPreviewPdf() {
    if (!selected || !selectedRecordRegistration) return;

    setPreviewOpen(true);
    setPreviewError(null);
    setPreviewLoading(true);
    setPreviewUrl((currentUrl) => {
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      return null;
    });

    try {
      const blob = await createSavedCheckPdfBlob(
        selected,
        selectedRecordRegistration,
        getProfileForRecord(selected, selectedRecordProfile) as AircraftProfile,
      );
      setPreviewUrl(URL.createObjectURL(blob));
    } catch (e) {
      console.error(e);
      const message = e instanceof Error ? e.message : "PDF preview failed";
      setPreviewError(message);
      alert(message);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function onDownloadPdf() {
    if (!selected || !selectedRecordRegistration) return;

    setDownloadingPdf(true);
    try {
      await downloadSavedCheckPdf(
        selected,
        selectedRecordRegistration,
        getProfileForRecord(selected, selectedRecordProfile) as AircraftProfile,
      );
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "PDF export failed");
    } finally {
      setDownloadingPdf(false);
    }
  }

  const trendField =
    selectedProfile?.executionMode === "input_only" && selectedProfile.inputOnlyConfig?.primaryTrendFieldKey
      ? getFieldDefByKey(getProfileFields(selectedProfile, selectedProfile.checkTypes[0]), selectedProfile.inputOnlyConfig.primaryTrendFieldKey)
      : undefined;

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 lg:items-start gap-4">
        <div className="card bg-base-100 shadow lg:col-start-3 lg:row-start-1">
          <div className="card-body">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <h2 className="card-title">Select Previous Checks</h2>
            </div>

            <div className="mt-4 grid gap-3">
              <RegistrationPicker registrations={registrations} value={registrationId} onChange={(id) => setRegistrationId(id)} />

              <div className="text-xs opacity-70 mb-2">
                {selectedProfile?.executionMode === "input_only" ? (
                  <span className="font-semibold">{selectedProfile.inputOnlyConfig?.primaryTrendFieldKey ?? "Configured value"}</span>
                ) : (
                  <span className="font-semibold">{resultLabels.map((metric) => metric.title).join(" + ")}</span>
                )}
                {selectedProfile ? (
                  <span className="opacity-70"> (Profile: {selectedProfile.modelName} - {selectedProfile.engine})</span>
                ) : (
                  <span className="opacity-70"> (No profile linked! Reverting to saved snapshot where available.)</span>
                )}
              </div>

              <label className="form-control">
                <div className="label">
                  <span className="label-text">Check Type</span>
                </div>
                <select
                  className="select select-bordered w-full"
                  value={checkTypeFilter}
                  onChange={(e) => setCheckTypeFilter(e.target.value as CheckTypeFilter)}
                >
                  <option value="All">All</option>
                  {availableCheckTypes.map((ct) => (
                    <option key={ct} value={ct}>
                      {ct}
                    </option>
                  ))}
                </select>
              </label>

              <label className="form-control">
                <div className="label">
                  <span className="label-text">From</span>
                </div>
                <input
                  type="date"
                  className="input input-bordered w-full"
                  value={fromDate}
                  max={toDate || undefined}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </label>

              <label className="form-control">
                <div className="label">
                  <span className="label-text">To</span>
                </div>
                <input
                  type="date"
                  className="input input-bordered w-full"
                  value={toDate}
                  min={fromDate || undefined}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </label>
            </div>
            <button
              className="btn btn-outline btn-sm mt-5"
              onClick={() => {
                const today = new Date();
                setFromDate(toISODateOnly(new Date(today.getTime() - 1000 * 60 * 60 * 24 * 30)));
                setToDate(toISODateOnly(today));
              }}
              disabled={allForRegSortedDesc.length === 0}
            >
              Last 30 days
            </button>
          </div>
        </div>

        <div className="card bg-base-100 shadow lg:col-start-3 lg:row-start-2">
          <div className="card-body">
            <div className="grid grid-rows-4">
              <div>
                <h1 className="card-title">Summary</h1>
              </div>
              <div className="flex items-center justify-between">
                <span>Shown checks</span>
                <span className="font-mono">{preparedRows.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Alarms</span>
                <span className="font-mono">{alarmCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Last check date</span>
                <span className="font-mono">
                  {preparedRows[0] ? formatDateOnly(preparedRows[0].record.checkDate) : "-"}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="card bg-base-100 shadow lg:col-start-1 lg:col-span-2 lg: row-span-2">
          <div className="card-body">
            {preparedRows.length === 0 ? (
              <div className="alert">
                <span>No checks match the selected filters.</span>
              </div>
            ) : (
              <div className="overflow-x">
                <table className="table table-auto table-zebra">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th className="text-center">
                        <div className="tooltip" data-tip="Total Time">
                          TT
                        </div>
                      </th>
                      <th>Results</th>
                      <th>Pass</th>
                      <th className="text-right">Details</th>
                    </tr>
                  </thead>

                  <tbody>
                    {preparedRows.map(({ record, engines }) => (
                      <tr key={record.id}>
                        <td className="w-8">{formatDateOnly(record.checkDate)}</td>
                        <td>{record.checkType}</td>
                        <td className="text-center font-mono">{formatTotalTime(record)}</td>
                        <td>
                          <DeltaSummary record={record} engines={engines} profile={selectedProfile} />
                        </td>
                        <td>
                          <EnginePassSummary engines={engines} inputOnly={isInputOnlyRecord(record)} />
                        </td>
                        <td className="text-right">
                          <button className="btn btn-xs btn-outline" onClick={() => setSelected(record)}>
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-5">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">
                  Trend (
                  {selectedProfile?.executionMode === "input_only"
                    ? trendField?.label ?? selectedProfile.inputOnlyConfig?.primaryTrendFieldKey ?? "Configured value"
                    : trendMetric.delta}
                  {selectedProfile?.executionMode === "input_only"
                    ? (() => {
                        const unit = trendField ? getUnitLabel(getFieldUnitId(trendField)) : "";
                        return unit ? ` (${unit})` : "";
                      })()
                    : (() => {
                        const unit = getUnitLabel(trendMetric.unitId);
                        return unit ? ` (${unit})` : "";
                      })()}
                  )
                </h3>
                <div className="text-sm opacity-70">Trend lines per engine (if multi-engine)</div>
              </div>
              <div className="mt-2">
                <TrendChart
                  records={filtered.filter((record) => {
                    if (!selectedProfile?.executionMode || selectedProfile.executionMode !== "input_only") {
                      return getEngines(record).some((engine) => typeof getTrendValue(record, engine.engineId, selectedProfile) === "number");
                    }
                    return getEngines(record).some((engine) => typeof getTrendValue(record, engine.engineId, selectedProfile) === "number");
                  })}
                  calculationId={selectedProfile?.calculationId}
                  trendFieldKey={selectedProfile?.executionMode === "input_only" ? selectedProfile.inputOnlyConfig?.primaryTrendFieldKey : undefined}
                  trendLabel={trendField?.label}
                  trendUnitId={trendField ? getFieldUnitId(trendField) : undefined}
                />
              </div>
            </div>

            <div className="mt-2 text-xs opacity-70">
              <p>Alarm triggers when the tracked value drops by the configured threshold vs the last reading or recent average (any engine).</p>
              <p>Trendline is calculated from the currently selected time-span.</p>
            </div>
          </div>
        </div>
      </div>

      <dialog className={`modal ${selected ? "modal-open" : ""}`}>
        <div className="modal-box max-w-4xl">
          <h3 className="font-bold text-lg">Check Details</h3>

          {selected &&
            (() => {
              const engines = getEngines(selected);
              const profileForSelected = getProfileForRecord(selected, selectedRecordProfile);

              return (
                <div className="mt-3 space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="opacity-70">Date</div>
                    <div className="font-mono">{formatDateOnly(selected.checkDate)}</div>

                    <div className="opacity-70">Type</div>
                    <div className="font-mono">{selected.checkType}</div>

                    <div className="opacity-70">Total Time</div>
                    <div className="font-mono">{formatTotalTime(selected)}</div>

                    <div className="opacity-70">Created By</div>
                    <div className="font-mono">{selected.createdByUserEmail ?? "-"}</div>
                  </div>

                  <div className="divider" />

                  {isInputOnlyRecord(selected) ? (
                    <InputOnlyFieldList record={selected} profile={profileForSelected} />
                  ) : (
                    <div className="space-y-3">
                      {engines.map((e) => {
                        const pass = typeof e.result?.pass === "boolean" ? e.result.pass : null;
                        return (
                          <div key={e.engineId} className="rounded-box border border-base-300 p-3">
                            <div className="mb-2 flex items-center justify-between">
                              <div className="font-mono">{e.engineLabel}</div>
                              {pass === null ? (
                                <span className="badge badge-ghost">-</span>
                              ) : (
                                <span className={`badge ${pass ? "badge-success" : "badge-error"}`}>
                                  {pass ? "PASS" : "FAIL"}
                                </span>
                              )}
                            </div>
                            <MetricList result={e.result} calculationId={profileForSelected?.calculationId} />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}

          <div className="divider" />

          <div className="modal-action">
            {isAdmin && selected && (
              <button
                className="btn btn-error"
                onClick={() => {
                  if (!confirm("Delete this history entry? This cannot be undone.")) return;
                  removeCheck(selected.id);
                  closePreview();
                  setSelected(null);
                }}
              >
                Delete entry
              </button>
            )}

            {selected && selectedRecordRegistration && (
              <button
                className="btn btn-neutral"
                disabled={previewLoading || downloadingPdf}
                onClick={() => void onPreviewPdf()}
              >
                {previewLoading ? "Creating PDF..." : "Preview PDF"}
              </button>
            )}

            <button
              className="btn"
              onClick={() => {
                closePreview();
                setSelected(null);
              }}
            >
              Close
            </button>
          </div>
        </div>

        <form method="dialog" className="modal-backdrop">
          <button
            onClick={() => {
              closePreview();
              setSelected(null);
            }}
          >
            close
          </button>
        </form>
      </dialog>

      <PdfPreviewModal
        open={previewOpen}
        title="PDF Preview"
        previewUrl={previewUrl}
        loading={previewLoading}
        downloading={downloadingPdf}
        error={previewError}
        onClose={closePreview}
        onDownload={onDownloadPdf}
      />
    </>
  );
}
