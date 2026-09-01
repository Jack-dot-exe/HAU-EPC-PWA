import type { FieldDef, InputFieldType } from "../../domain/models";
import { getAvailableUnits } from "../../domain/units";
import { FormField } from "./FormFieldLabels";

const FIELD_TYPES: InputFieldType[] = ["number", "text", "select", "boolean"];
const UNIT_OPTIONS = getAvailableUnits();

/**
 * One editable field row inside a profile check type section.
 */
export default function FieldRow({
  field,
  onChange,
  onRemove,
}: {
  field: FieldDef;
  onChange: (patch: Partial<FieldDef>) => void;
  onRemove: () => void;
}) {
  const isNumberField = (field.type ?? "number") === "number";
  const isSelectField = (field.type ?? "number") === "select";

  return (
    <div className="rounded-box border border-base-300 p-3 grid gap-4">
      <div className="grid gap-3 md:grid-cols-4">
        <FormField label="Short Form [Field ID]">
          <input
            className="input input-bordered input-sm"
            value={String(field.key)}
            onChange={(e) =>
              onChange({
                key: e.target.value.toUpperCase().replace(/\s+/g, "_"),
              })
            }
            placeholder="Key"
          />
        </FormField>

        <FormField label="Label Name">
          <input
            className="input input-bordered input-sm"
            value={field.label}
            onChange={(e) => onChange({ label: e.target.value })}
            placeholder="Label"
          />
        </FormField>

        <FormField label="Field Type">
          <select
            className="select select-bordered select-sm"
            value={field.type ?? "number"}
            onChange={(e) => onChange({ type: e.target.value as InputFieldType })}
          >
            {FIELD_TYPES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Unit">
          <select
            className="select select-bordered select-sm"
            value={field.unitId ?? ""}
            onChange={(e) =>
              onChange({
                unitId: (e.target.value || undefined) as FieldDef["unitId"],
              })
            }
          >
            {UNIT_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.id}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <FormField label="Min">
          <input
            className="input input-bordered input-sm"
            type="number"
            value={field.min ?? ""}
            onChange={(e) =>
              onChange({ min: e.target.value ? Number(e.target.value) : undefined })
            }
            placeholder="Min"
            disabled={!isNumberField}
          />
        </FormField>

        <FormField label="Max">
          <input
            className="input input-bordered input-sm"
            type="number"
            value={field.max ?? ""}
            onChange={(e) =>
              onChange({ max: e.target.value ? Number(e.target.value) : undefined })
            }
            placeholder="Max"
            disabled={!isNumberField}
          />
        </FormField>

        <FormField label="Step">
          <input
            className="input input-bordered input-sm"
            type="number"
            value={field.step ?? ""}
            onChange={(e) =>
              onChange({ step: e.target.value ? Number(e.target.value) : undefined })
            }
            placeholder="Step"
            disabled={!isNumberField}
          />
        </FormField>

        <FormField
          label="Options"
          hint={!isSelectField ? "Only used for select fields" : undefined}
        >
          <input
            className="input input-bordered input-sm"
            value={(field.options ?? []).join(", ")}
            onChange={(e) =>
              onChange({
                options: e.target.value
                  .split(",")
                  .map((item) => item.trim())
                  .filter(Boolean),
              })
            }
            placeholder="a, b, c"
            disabled={!isSelectField}
          />
        </FormField>
      </div>

        <div className="flex flex-wrap items-center gap-4">
          <label className="label cursor-pointer gap-2">
            <input
              type="checkbox"
              className="checkbox checkbox-sm"
              checked={!!field.required}
              onChange={(e) => onChange({ required: e.target.checked })}
            />
            <span className="label-text">Required</span>
          </label>

          <label className="label cursor-pointer gap-2">
            <input
              type="checkbox"
              className="checkbox checkbox-sm"
              checked={!!field.showInHistory}
              onChange={(e) => onChange({ showInHistory: e.target.checked })}
            />
            <span className="label-text">History</span>
          </label>

          <label className="label cursor-pointer gap-2">
            <input
              type="checkbox"
              className="checkbox checkbox-sm"
              checked={!!field.showInPdf}
              onChange={(e) => onChange({ showInPdf: e.target.checked })}
            />
            <span className="label-text">PDF</span>
          </label>

          <label className="label cursor-pointer gap-2">
            <input
              type="checkbox"
              className="checkbox checkbox-sm"
              checked={!!field.chartable}
              onChange={(e) => onChange({ chartable: e.target.checked })}
              disabled={!isNumberField}
            />
            <span className="label-text">Chartable</span>
          </label>

          <button className="btn btn-error btn-xs ml-auto" onClick={onRemove}>
            Remove
          </button>
        </div>

    </div>
  );
}