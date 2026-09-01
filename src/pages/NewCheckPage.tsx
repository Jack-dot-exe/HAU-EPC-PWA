import { useEffect, useMemo, useState } from "react";
import RegistrationPicker from "../components/RegistrationPicker";
import DynamicFields from "../components/DynamicFields";
import PdfPreviewModal from "../components/PdfPreviewModal";
import { useChecks } from "../app/checksStore";
import { useProfiles } from "../app/profileStore";
import { useRegistrations } from "../app/registrationStore";
import { useUsers } from "../app/usersStore";
import type {
  AircraftProfile,
  CheckType,
  EngineDef,
  PowerCheckRecord,
  PowerCheckResult,
  PowerCheckValue,
  PowerCheckValues,
} from "../domain/models";
import { getLatestTotalTimeForRegistration } from "../domain/checkTotals";
import { getDisplayMetrics } from "../domain/resultMetrics";
import { formatMetricValue } from "../domain/units";
import { decimalToHHMM } from "../calculations/utils/time";
import { CALC_VERSIONS, computeForProfile, prepareCheckFromProfile } from "../calculations";
import { createEpcResultPdfBlob, downloadEpcResultPdf } from "../lib/epcPdf";
import { buildProfileSnapshot, ENV_FIELD_KEYS, getExecutionMode, getProfileFields, parseOverallResultValue } from "../domain/profileUtils";

function makeId(prefix: string) {
  // @ts-ignore
  return (globalThis.crypto?.randomUUID?.() ?? `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`);
}

function isValuePresent(value: PowerCheckValue | undefined) {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  return true;
}

function isComplete(values: PowerCheckValues, fields: { key: string; required?: boolean }[]) {
  return fields.every((f) => {
    if (!f.required) return true;
    return isValuePresent(values[f.key]);
  });
}

function getEngines(profile?: AircraftProfile | null): EngineDef[] {
  if (!profile) return [{ id: "1", label: "ENG 1" }];
  if (profile.engines?.length) return profile.engines;
  const n = Math.max(1, profile.engineCount ?? 1);
  return Array.from({ length: n }, (_, i) => ({ id: String(i + 1), label: `ENG ${i + 1}` }));
}

function normalizeValuesForFields(
  prev: PowerCheckValues,
  allowedKeys: Set<string>,
  defaults: Record<string, PowerCheckValue | undefined>,
): PowerCheckValues {
  const next: PowerCheckValues = {};
  for (const k of Object.keys(prev)) {
    if (allowedKeys.has(k)) next[k] = prev[k];
  }
  for (const [k, v] of Object.entries(defaults)) {
    if (allowedKeys.has(k) && next[k] === undefined && v !== undefined) next[k] = v;
  }
  return next;
}

function ResultMetricCards({ result, calculationId }: { result: PowerCheckResult; calculationId?: AircraftProfile["calculationId"] }) {
  const metrics = getDisplayMetrics(result, calculationId);

  return (
    <div className="grid gap-3">
      {metrics.map((metric) => (
        <div key={metric.id} className="rounded-box border border-base-300 p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="font-semibold">{metric.title}</div>
            <span className={`badge badge-sm ${metric.pass ? "badge-success" : "badge-error"}`}>
              {metric.pass ? "PASS" : "FAIL"}
            </span>
          </div>

          <div className="stats stats-vertical bg-base-100 w-full justify-center">
            <div className="stat">
              <div className="stat-title">{metric.expectedLabel}</div>
              <div className="stat-value text-2xl">
                {formatMetricValue(metric, metric.expected)}
              </div>
            </div>
            <div className="stat">
              <div className="stat-title">{metric.actualLabel}</div>
              <div className="stat-value text-xl">
                {formatMetricValue(metric, metric.actual)}
              </div>
            </div>
            <div className="stat">
              <div className="stat-title">{metric.deltaLabel}</div>
              <div className="stat-value text-2xl">
                {formatMetricValue(metric, metric.delta)}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function NewCheckPage() {
  const { addCheck, checks } = useChecks();
  const { profiles } = useProfiles();
  const { registrations } = useRegistrations();
  const { currentUser } = useUsers();

  const [registrationId, setRegistrationId] = useState(registrations[0]?.id ?? "");

  useEffect(() => {
    if (registrations.length === 0) {
      setRegistrationId("");
      return;
    }
    if (!registrations.some((r) => r.id === registrationId)) {
      setRegistrationId(registrations[0].id);
    }
  }, [registrations, registrationId]);

  const reg = useMemo(() => registrations.find((r) => r.id === registrationId), [registrations, registrationId]);
  const profile = useMemo(() => profiles.find((p) => p.id === reg?.profileId), [profiles, reg?.profileId]);
  const executionMode = getExecutionMode(profile);
  const isInputOnly = executionMode === "input_only";

  const engines = useMemo(() => getEngines(profile), [profile]);
  const engineCount = engines.length;

  const checkTypes = profile?.checkTypes ?? (["Ground"] as CheckType[]);
  const [checkType, setCheckType] = useState<CheckType>(checkTypes[0]);

  useEffect(() => {
    if (!checkTypes.includes(checkType)) setCheckType(checkTypes[0]);
  }, [checkTypes, checkType]);

  const fields = getProfileFields(profile, checkType);
  const envFields = useMemo(() => fields.filter((f) => ENV_FIELD_KEYS.has(String(f.key))), [fields]);
  const engineFields = useMemo(() => fields.filter((f) => !ENV_FIELD_KEYS.has(String(f.key))), [fields]);

  const [activeEngineIdx, setActiveEngineIdx] = useState(0);
  const [envValues, setEnvValues] = useState<PowerCheckValues>({ OAT: 15, PA: 5000 });
  const [engineValues, setEngineValues] = useState<PowerCheckValues[]>(
    Array.from({ length: engineCount }, () => ({} as PowerCheckValues)),
  );
  const [computedResults, setComputedResults] = useState<PowerCheckResult[] | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    setEngineValues((prev) => {
      if (prev.length === engineCount) return prev;
      if (prev.length < engineCount) {
        return [...prev, ...Array.from({ length: engineCount - prev.length }, () => ({} as PowerCheckValues))];
      }
      return prev.slice(0, engineCount);
    });
    setActiveEngineIdx((i) => Math.min(i, Math.max(0, engineCount - 1)));
    setComputedResults(null);
  }, [engineCount]);

  useEffect(() => {
    const envAllowed = new Set(envFields.map((f) => String(f.key)));
    const engineAllowed = new Set(engineFields.map((f) => String(f.key)));

    setEnvValues((prev) =>
      normalizeValuesForFields(prev, envAllowed, {
        TTH: undefined,
        OAT: 15,
        PA: 5000,
      }),
    );

    setEngineValues((prev) => prev.map((ev) => normalizeValuesForFields(ev, engineAllowed, {})));
    setComputedResults(null);
  }, [checkType, profile?.id, envFields, engineFields]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const setEnvValue = (key: string, value: PowerCheckValue | undefined) =>
    setEnvValues((s) => ({ ...s, [key]: value }));

  const setEngineValue = (engineIdx: number, key: string, value: PowerCheckValue | undefined) =>
    setEngineValues((prev) => prev.map((v, i) => (i === engineIdx ? { ...v, [key]: value } : v)));

  const mergedValuesPerEngine = useMemo(
    () => engineValues.map((ev) => ({ ...envValues, ...ev })),
    [engineValues, envValues],
  );

  const canCompute =
    !isInputOnly &&
    !!profile &&
    fields.length > 0 &&
    engineValues.length === engineCount &&
    mergedValuesPerEngine.every((ev) => isComplete(ev, fields.map((f) => ({ key: String(f.key), required: f.required }))));

  const hasTthField = fields.some((field) => field.key === "TTH");
  const latestKnownTt = useMemo(
    () => (registrationId ? getLatestTotalTimeForRegistration(checks, registrationId) : undefined),
    [checks, registrationId],
  );
  const enteredTth = typeof envValues.TTH === "number" ? envValues.TTH : undefined;
  const ttValidationError =
    hasTthField &&
    typeof enteredTth === "number" &&
    typeof latestKnownTt === "number" &&
    enteredTth <= latestKnownTt
      ? `Total Time must be higher than the latest saved value (${decimalToHHMM(latestKnownTt)}).`
      : undefined;
  const envFieldErrors = ttValidationError ? { TTH: ttValidationError } : undefined;

  const inputOnlyCanSave =
    isInputOnly &&
    !!profile &&
    fields.length > 0 &&
    mergedValuesPerEngine.every((ev) => isComplete(ev, fields.map((f) => ({ key: String(f.key), required: f.required })))) &&
    !ttValidationError;

  const canSave = isInputOnly ? inputOnlyCanSave : !!computedResults && !ttValidationError;

  const currentPayload =
    !isInputOnly && profile && reg && computedResults
      ? {
          registration: reg,
          profile,
          checkType,
          engines,
          envFields,
          engineFields,
          envValues,
          engineValues,
          computedResults,
          exportedAt: new Date(),
          checkPerformedAt: new Date(),
          calculationVersion: CALC_VERSIONS[profile.calculationId],
          executionMode,
        }
      : null;

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

  function onCompute() {
    if (!profile || !canCompute) return;
    try {
      const results = engines.map((_, idx) => computeForProfile(profile, checkType, mergedValuesPerEngine[idx]));
      setComputedResults(results);
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "Compute failed");
      setComputedResults(null);
    }
  }

  async function onSave() {
    if (!profile || !registrationId || !canSave) return;

    const prepared = prepareCheckFromProfile({
      profile,
      checkType,
      engines,
      engineValues: mergedValuesPerEngine,
    });

    const explicitOverallField = fields.find((field) => String(field.key) === "OVERALL_RESULT");
    const explicitOverallPass = explicitOverallField
      ? parseOverallResultValue(mergedValuesPerEngine[0]?.[String(explicitOverallField.key)])
      : undefined;

    const record: PowerCheckRecord = {
      id: makeId("c"),
      createdAtIso: new Date().toISOString(),
      registrationId,
      checkType,
      schemaVersion: 2,
      totalTimeHrs: typeof envValues.TTH === "number" ? envValues.TTH : undefined,
      calculationVersion: isInputOnly ? undefined : CALC_VERSIONS[profile.calculationId],
      profileExecutionMode: executionMode,
      createdByUserId: currentUser?.id,
      createdByUserEmail: currentUser?.email,
      profileSnapshot: buildProfileSnapshot(profile),
      engines: prepared.engines,
      overallResult: prepared.overallResult ?? (typeof explicitOverallPass === "boolean" ? { pass: explicitOverallPass } : undefined),
    };

    await addCheck(record);
    setEnvValues({ OAT: 15, PA: 5000, TTH: undefined });
    setEngineValues(Array.from({ length: engineCount }, () => ({} as PowerCheckValues)));
    setActiveEngineIdx(0);
    setComputedResults(null);
  }

  async function onPreviewPdf() {
    if (!currentPayload) return;

    setPreviewOpen(true);
    setPreviewError(null);
    setPreviewLoading(true);
    setPreviewUrl((currentUrl) => {
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      return null;
    });

    try {
      const blob = await createEpcResultPdfBlob(currentPayload);
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
    if (!currentPayload) return;

    setDownloadingPdf(true);
    try {
      await downloadEpcResultPdf(currentPayload);
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "PDF export failed");
    } finally {
      setDownloadingPdf(false);
    }
  }

  const overallPass = computedResults?.every((r) => r.pass) ?? false;
  const activeResult = computedResults?.[activeEngineIdx] ?? null;

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card bg-base-100 shadow ">
          <div className="card-body">
            <h2 className="card-title">New Power Check</h2>

            {registrations.length === 0 ? (
              <div className="alert alert-warning">
                <span>No registrations configured. Add one in Admin.</span>
              </div>
            ) : (
              <>
                <div className="grid gap-3 md:grid-cols-2">
                  <RegistrationPicker
                    registrations={registrations}
                    value={registrationId}
                    onChange={(id) => {
                      setRegistrationId(id);
                      setComputedResults(null);
                    }}
                  />

                  <div className="flex flex-col">
                    <label className="label-text label">Check Type</label>
                    <select
                      className="select select-bordered w-full"
                      value={checkType}
                      onChange={(e) => {
                        setCheckType(e.target.value as CheckType);
                        setComputedResults(null);
                      }}
                      disabled={!profile}
                    >
                      {checkTypes.map((ct) => (
                        <option key={ct} value={ct}>
                          {ct}
                        </option>
                      ))}
                    </select>
                  </div>
                  <span className="text-xs opacity-75">
                    Profile: {profile ? `${profile.modelName} (${profile.engine})` : "-"}
                    {profile && (
                      <span className="ml-2 badge badge-outline badge-sm">
                        {isInputOnly ? "Input Only" : "Calculated"}
                      </span>
                    )}
                  </span>
                </div>

                <div className="divider" />

                {!profile ? (
                  <div className="alert">
                    <span>This registration has no valid profile assigned.</span>
                  </div>
                ) : fields.length === 0 ? (
                  <div className="alert alert-warning">
                    <span>No input schema defined for {checkType} on this profile.</span>
                  </div>
                ) : (
                  <>
                    {envFields.length > 0 && (
                      <>
                        <div className="mb-2 text-sm font-semibold">Environment</div>
                        <DynamicFields
                          fields={envFields}
                          values={envValues}
                          setValue={setEnvValue}
                          fieldErrors={envFieldErrors}
                        />
                        <div className="divider" />
                        <div className="mb-2 text-sm font-semibold">Engine Data</div>
                      </>
                    )}

                    {engineCount > 1 && (
                      <div className="tabs tabs-box inset-shadow-sm/12 gap-3 flex justify-center">
                        {engines.map((eng, idx) => (
                          <button
                            key={eng.id}
                            type="button"
                            className={`tab m-1 px-10 ${idx === activeEngineIdx ? "tab-active shadow-md" : "hover:bg-base-300"}`}
                            onClick={() => setActiveEngineIdx(idx)}
                          >
                            {eng.label}
                          </button>
                        ))}
                      </div>
                    )}

                    {engineFields.length === 0 ? (
                      <div className="alert alert-info">
                        <span>This check type has no engine-specific inputs.</span>
                      </div>
                    ) : (
                      <DynamicFields
                        fields={engineFields}
                        values={engineValues[activeEngineIdx] ?? {}}
                        setValue={(key, value) => setEngineValue(activeEngineIdx, String(key), value)}
                      />
                    )}
                  </>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  {!isInputOnly && (
                    <button className="btn btn-primary" type="button" disabled={!canCompute} onClick={onCompute}>
                      Compute
                    </button>
                  )}
                  <button className="btn btn-outline" type="button" disabled={!canSave} onClick={() => void onSave()}>
                    Save Check
                  </button>
                  {!isInputOnly && (
                    <button
                      className="btn btn-neutral"
                      type="button"
                      disabled={!computedResults || previewLoading || downloadingPdf}
                      onClick={() => void onPreviewPdf()}
                    >
                      {previewLoading ? "Creating PDF..." : "Preview PDF"}
                    </button>
                  )}
                </div>

                {!canCompute && !isInputOnly && profile && fields.length > 0 && (
                  <div className="mt-2 text-xs opacity-70">
                    Fill all required fields (*) for <span className="font-semibold">all engines</span> to compute.
                  </div>
                )}

                {isInputOnly && fields.length > 0 && (
                  <div className="mt-2 text-xs opacity-70">
                    Input-only profile: values are saved directly and become available in History, alarms, trend charts, and PDF export.
                  </div>
                )}

                {!isOnline && hasTthField && (
                  <div className="mt-2 text-xs opacity-70">
                    Offline: TT is validated against the latest locally available record.
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="card bg-base-100 shadow">
          <div className="card-body">
            {isInputOnly ? (
              <>
                <h2 className="card-title">Input Summary</h2>
                <div className="alert alert-info">
                  <span>This profile does not run a calculation. Saved records will use the configured history and trend fields.</span>
                </div>
                {profile?.inputOnlyConfig?.primaryTrendFieldKey && (
                  <div className="text-sm opacity-80">
                    Trend field: <span className="font-semibold">{profile.inputOnlyConfig.primaryTrendFieldKey}</span>
                  </div>
                )}
                {profile?.inputOnlyConfig?.alarmFieldKey && (
                  <div className="text-sm opacity-80">
                    Alarm field: <span className="font-semibold">{profile.inputOnlyConfig.alarmFieldKey}</span>
                    {typeof profile.inputOnlyConfig.alarmDropThreshold === "number" && (
                      <span> (threshold {profile.inputOnlyConfig.alarmDropThreshold})</span>
                    )}
                  </div>
                )}
                {profile?.powerCheckDescription?.trim() && (
                  <div className="mt-3 rounded-box border border-base-300 bg-base-200/40 px-4 py-3">
                    <div className="text-sm font-semibold">Procedure</div>
                    <p className="mt-1 text-sm opacity-80 whitespace-pre-line">
                      {profile.powerCheckDescription.trim()}
                    </p>
                  </div>
                )}
              </>
            ) : !computedResults ? (
              <>
                <div className="alert">
                  <span>Enter values for all engines and click Compute.</span>
                </div>
                {profile?.powerCheckDescription?.trim() && (
                  <div className="mt-3 rounded-box border border-base-300 bg-base-200/40 px-4 py-3">
                    <div className="text-sm font-semibold">Procedure</div>
                    <p className="mt-1 text-sm opacity-80 whitespace-pre-line">
                      {profile.powerCheckDescription.trim()}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <>
                <h2 className="card-title">Result</h2>
                {engineCount > 1 ? (
                  <>
                    <div className={`alert ${overallPass ? "alert-success" : "alert-error"}`}>
                      <span>{overallPass ? "OVERALL PASS" : "OVERALL FAIL"}</span>
                    </div>

                    <div className="divider"></div>

                    <div className="mt-3 flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-base-300">
                      {engines.map((eng, idx) => {
                        const result = computedResults[idx];
                        return (
                          <div key={eng.id} className="flex-1 p-4">
                            <div className="mb-2 flex items-center justify-between">
                              <div className="font-semibold">{eng.label}</div>
                              <span className={`badge ${result.pass ? "badge-success" : "badge-error"}`}>{result.pass ? "PASS" : "FAIL"}</span>
                            </div>

                            <ResultMetricCards result={result} calculationId={profile?.calculationId} />
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  activeResult && (
                    <>
                      <div className="mt-3">
                        <ResultMetricCards result={activeResult} calculationId={profile?.calculationId} />
                      </div>

                      <div className={`mt-3 alert ${activeResult.pass ? "alert-success" : "alert-error"}`}>
                        <span>{activeResult.pass ? "PASS (within limits)" : "FAIL (outside limits)"}</span>
                      </div>
                    </>
                  )
                )}
              </>
            )}
          </div>
        </div>
      </div>

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


