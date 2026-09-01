import type { AircraftProfile, FieldDef } from "../../domain/models";
import { buildUpdatedInputOnlyConfig } from "../../domain/profileHelpers";
import { FormField } from "./FormFieldLabels";

function getNumericFields(profile: AircraftProfile): FieldDef[] {
  return profile.checkTypes
    .flatMap(
      (checkType) => profile.inputOnlyConfig?.fieldsByCheckType?.[checkType] ?? [],
    )
    .filter((field) => (field.type ?? "number") === "number");
}

/**
 * Trend and alarm settings for input-only profiles.
 */
export default function ProfileTrendSettings({
  profile,
  onUpdate,
}: {
  profile: AircraftProfile;
  onUpdate: (patch: Partial<AircraftProfile>) => void;
}) {
  const numericFields = getNumericFields(profile);

  return (
    <div className="grid gap-3 md:grid-cols-3">
      <FormField label="Trend Field">
        <select
          className="select select-bordered select-sm"
          value={profile.inputOnlyConfig?.primaryTrendFieldKey ?? ""}
          onChange={(e) =>
            onUpdate({
              inputOnlyConfig: buildUpdatedInputOnlyConfig(profile, {
                primaryTrendFieldKey: e.target.value || undefined,
              }),
            })
          }
        >
          <option value="">Select trend field</option>
          {numericFields.map((field) => (
            <option key={`trend_${String(field.key)}`} value={String(field.key)}>
              {field.label}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="Alarm Field">
        <select
          className="select select-bordered select-sm"
          value={profile.inputOnlyConfig?.alarmFieldKey ?? ""}
          onChange={(e) =>
            onUpdate({
              inputOnlyConfig: buildUpdatedInputOnlyConfig(profile, {
                alarmFieldKey: e.target.value || undefined,
              }),
            })
          }
        >
          <option value="">Select alarm field</option>
          {numericFields.map((field) => (
            <option key={`alarm_${String(field.key)}`} value={String(field.key)}>
              {field.label}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="Alarm Threshold [%]">
        <input
          className="input input-bordered input-sm"
          type="number"
          value={profile.inputOnlyConfig?.alarmDropThreshold ?? 3}
          onChange={(e) =>
            onUpdate({
              inputOnlyConfig: buildUpdatedInputOnlyConfig(profile, {
                alarmDropThreshold: Number(e.target.value || 0),
              }),
            })
          }
          placeholder="Alarm threshold"
        />
      </FormField>
    </div>
  );
}