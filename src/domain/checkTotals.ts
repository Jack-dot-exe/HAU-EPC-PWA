import type { PowerCheckRecord } from "./models";

export function getEffectiveTotalTimeHrs(record: PowerCheckRecord): number | undefined {
  const anyRec: any = record as any;

  if (typeof anyRec.totalTimeHrs === "number" && Number.isFinite(anyRec.totalTimeHrs) && anyRec.totalTimeHrs >= 0) {
    return anyRec.totalTimeHrs;
  }

  const v: any = anyRec.values;
  if (v && typeof v.TTH === "number" && Number.isFinite(v.TTH) && v.TTH >= 0) return v.TTH;

  if (Array.isArray(anyRec.engines)) {
    for (const e of anyRec.engines) {
      const ev = e?.values;
      if (ev && typeof ev.TTH === "number" && Number.isFinite(ev.TTH) && ev.TTH >= 0) return ev.TTH;
    }
  }

  const sv: any = anyRec.sharedValues ?? anyRec.environment ?? anyRec.env;
  if (sv && typeof sv.TTH === "number" && Number.isFinite(sv.TTH) && sv.TTH >= 0) return sv.TTH;

  return undefined;
}

export function getLatestTotalTimeForRegistration(
  checks: PowerCheckRecord[],
  registrationId: string,
  excludeCheckId?: string,
): number | undefined {
  let latest: number | undefined;

  for (const record of checks) {
    if (record.registrationId !== registrationId) continue;
    if (excludeCheckId && record.id === excludeCheckId) continue;

    const totalTime = getEffectiveTotalTimeHrs(record);
    if (totalTime === undefined) continue;
    if (latest === undefined || totalTime > latest) latest = totalTime;
  }

  return latest;
}
