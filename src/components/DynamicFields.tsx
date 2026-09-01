import { useEffect, useState } from "react";
import type { FieldDef, PowerCheckValue, PowerCheckValues } from "../domain/models";
import { decimalToHHMM } from "../calculations/utils/time";
import { getUnitLabel, getFieldUnitId } from "../domain/units";

function tryParseTTH(raw: string): number | undefined {
  const s = raw.trim();
  if (!s) return undefined;

  const m = s.match(/^(\d+):([0-5]\d)$/);
  if (m) {
    const hours = Number(m[1]);
    const minutes = Number(m[2]);
    const dec = hours + minutes / 60;
    return Number.isFinite(dec) ? dec : undefined;
  }

  if (/^\d+$/.test(s)) {
    const hours = Number(s);
    return Number.isFinite(hours) ? hours : undefined;
  }

  if (/^\d+[.,]\d+$/.test(s)) {
    const num = parseFloat(s.replace(",", "."));
    return Number.isFinite(num) ? num : undefined;
  }

  return undefined;
}

function sanitizeTTHInput(raw: string): string {
  return raw.replace(/[^\d:.,]/g, "");
}

export default function DynamicFields(props: {
  fields: FieldDef[];
  values: PowerCheckValues;
  setValue: (key: FieldDef["key"], value: PowerCheckValue | undefined) => void;
  fieldErrors?: Partial<Record<string, string>>;
}) {
  const externalTTH = props.values["TTH"];
  const [tthText, setTthText] = useState<string>("");

  useEffect(() => {
    setTthText(typeof externalTTH === "number" ? decimalToHHMM(externalTTH) : "");
  }, [externalTTH]);

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {props.fields.map((f) => {
        const v = props.values[String(f.key)];
        const isTTH = f.key === "TTH" && (f.type ?? "number") === "number";
        const fieldError = props.fieldErrors?.[String(f.key)];
        const inputClassName = `input input-bordered w-full ${fieldError ? "input-error" : ""}`;
        const fieldType = f.type ?? "number";

        return (
          <div key={String(f.key)} className="flex flex-col gap-1">
            <label htmlFor={String(f.key)} className="label-text label">
              {f.label}
              {(() => { const unit = getUnitLabel(getFieldUnitId(f)); return unit ? ` (${unit})` : ""; })()}
              {f.required && <span className="ml-1 text-red-500">*</span>}
            </label>

            {isTTH ? (
              <input
                id={String(f.key)}
                type="text"
                className={inputClassName}
                inputMode="text"
                placeholder="HH:MM"
                value={tthText}
                onChange={(e) => setTthText(sanitizeTTHInput(e.target.value))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const parsed = tryParseTTH(tthText);
                    props.setValue("TTH", parsed);
                    if (parsed !== undefined) setTthText(decimalToHHMM(parsed));
                  }
                }}
                onBlur={() => {
                  const parsed = tryParseTTH(tthText);
                  props.setValue("TTH", parsed);
                  if (parsed !== undefined) setTthText(decimalToHHMM(parsed));
                }}
              />
            ) : fieldType === "boolean" ? (
              <input
                id={String(f.key)}
                type="checkbox"
                className="checkbox checkbox-primary"
                checked={Boolean(v)}
                onChange={(e) => props.setValue(f.key, e.target.checked)}
              />
            ) : fieldType === "select" ? (
              <select
                id={String(f.key)}
                className={`select select-bordered w-full ${fieldError ? "select-error" : ""}`}
                value={typeof v === "string" ? v : ""}
                onChange={(e) => props.setValue(f.key, e.target.value || undefined)}
              >
                <option value="">Select...</option>
                {(f.options ?? []).map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            ) : fieldType === "text" ? (
              <input
                id={String(f.key)}
                type="text"
                className={inputClassName}
                value={typeof v === "string" ? v : ""}
                onChange={(e) => props.setValue(f.key, e.target.value || undefined)}
              />
            ) : (
              <input
                id={String(f.key)}
                type="number"
                className={inputClassName}
                inputMode="decimal"
                step={f.step ?? "any"}
                {...(f.min !== undefined ? { min: f.min } : {})}
                {...(f.max !== undefined ? { max: f.max } : {})}
                value={typeof v === "number" ? v : ""}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (!raw) {
                    props.setValue(f.key, undefined);
                    return;
                  }
                  const normalized = raw.replace(",", ".");
                  const num = parseFloat(normalized);
                  props.setValue(f.key, Number.isFinite(num) ? num : undefined);
                }}
              />
            )}

            {fieldError && <div className="mt-1 text-xs text-error">{fieldError}</div>}
          </div>
        );
      })}
    </div>
  );
}
