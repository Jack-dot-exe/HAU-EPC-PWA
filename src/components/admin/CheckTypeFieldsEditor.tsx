
import type { AircraftProfile, CheckType, FieldDef } from "../../domain/models";
import { buildUpdatedFieldsByCheckType, createField } from "../../domain/profileHelpers";
import FieldRow from "./FieldRow";

/**
 * Editor for all fields within a single check type.
 */

export default function CheckTypeFieldsEditor({
  profile,
  checkType,
  onUpdate,
}: {
  profile: AircraftProfile;
  checkType: CheckType;
  onUpdate: (patch: Partial<AircraftProfile>) => void;
}) {
  const fields = profile.inputOnlyConfig?.fieldsByCheckType?.[checkType] ?? [];

  const updateFields = (nextFields: FieldDef[]) => {
    onUpdate({
      inputOnlyConfig: buildUpdatedFieldsByCheckType(profile, checkType, nextFields),
    });
  };

  return (
    <div className="rounded-box border border-base-300 p-3">
        <div className="grid gap-3">
          <div className="flex items-center justify-end">
            <button
              className="btn btn-outline btn-xs"
              onClick={() => updateFields([...fields, createField()])}
            >
              Add field
            </button>
          </div>

          {fields.length === 0 ? null : (
            fields.map((field, index) => (
              <FieldRow
                key={`${checkType}_${String(field.key)}_${index}`}
                field={field}
                onChange={(patch) => {
                  const nextFields = fields.map((current, currentIndex) =>
                    currentIndex === index ? { ...current, ...patch } : current,
                  );
                  updateFields(nextFields);
                }}
                onRemove={() => {
                  const nextFields = fields.filter((_, currentIndex) => currentIndex !== index);
                  updateFields(nextFields);
                }}
              />
            ))
          )}
        </div>
    </div>
  );
}