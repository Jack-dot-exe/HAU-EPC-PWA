import { useState } from "react";
import type { AircraftProfile, CheckType } from "../../domain/models";
import ConfirmDeleteModal from "../ConfirmDeleteModal";
import CheckTypeFieldsEditor from "./CheckTypeFieldsEditor";
import ProfileTrendSettings from "./ProfileTrendSettings";
import { FormField } from "./FormFieldLabels";

const CHECK_TYPES: CheckType[] = ["Ground", "Hover", "In-Flight"];


export default function ProfileCard({
  profile,
  onUpdate,
  onRemove,
}: {
  profile: AircraftProfile;
  onUpdate: (patch: Partial<AircraftProfile>) => void;
  onRemove: () => void;
}) {
  const isInputOnly = profile.executionMode === "input_only";
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="rounded-box border border-base-300 bg-base-100 p-4">
      {/* always visible row */}
      <div className="flex items-end">
        <div className="grid gap-3 md:grid-cols-3 flex-1 items-end">
          <FormField label="Model Name">
            <input
              className="input input-bordered input-sm"
              value={profile.modelName}
              onChange={(e) => onUpdate({ modelName: e.target.value })}
              placeholder="Model"
            />
          </FormField>

          <FormField label="Engine Type">
            <input
              className="input input-bordered input-sm"
              value={profile.engine}
              onChange={(e) => onUpdate({ engine: e.target.value })}
              placeholder="Engine"
            />
          </FormField>

          <div className="justify-self-center self-center">
              <ConfirmDeleteModal
                title="Delete Profile"
                message={`Delete profile "${profile.modelName}"?`}
                onConfirm={onRemove}
              />
          </div>
        </div>

        <div className="form-control self-center ">
          <button
            type="button"
            className="btn btn-sm btn-square self-end"
            onClick={() => setIsOpen((prev) => !prev)}
            aria-expanded={isOpen}
            aria-label={isOpen ? "Collapse profile details" : "Expand profile details"}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* collapsible content */}
      {isOpen && (
        <div className="mt-4 grid gap-4">
          <div className="grid gap-3 md:grid-cols-6">
            <FormField label="Engine Count">
              <input
                className="input input-bordered input-sm"
                type="number"
                min={1}
                value={profile.engineCount ?? 1}
                onChange={(e) =>
                  onUpdate({
                    engineCount: Math.max(1, Number(e.target.value || 1)),
                  })
                }
                placeholder="Engines"
              />
            </FormField>

            <FormField label="Execution Mode">
              <select
                className="select select-bordered select-sm"
                value={profile.executionMode ?? "calculated"}
                onChange={(e) =>
                  onUpdate({
                    executionMode: e.target.value as AircraftProfile["executionMode"],
                  })
                }
              >
                <option value="calculated">calculated</option>
                <option value="input_only">input_only</option>
              </select>
            </FormField>

            <FormField label="Check Types" className="md:col-span-2">
              <div className="flex flex-wrap gap-3 ">
                {CHECK_TYPES.map((checkType) => (
                  <label key={checkType} className="label cursor-pointer gap-2">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-sm"
                      checked={profile.checkTypes.includes(checkType)}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? Array.from(new Set([...profile.checkTypes, checkType]))
                          : profile.checkTypes.filter((item) => item !== checkType);

                        onUpdate({ checkTypes: next.length ? next : ["In-Flight"] });
                      }}
                    />
                    <span className="label-text">{checkType}</span>
                  </label>
                ))}
              </div>
            </FormField>
          </div>

          <FormField label="Description Field">
            <textarea
              className="textarea textarea-bordered min-h-20 w-full"
              value={profile.powerCheckDescription ?? ""}
              onChange={(e) =>
                onUpdate({ powerCheckDescription: e.target.value || undefined })
              }
              placeholder="Describe the RFM EPC procedure here..."
            />
          </FormField>

          {isInputOnly ? (
            // Trend Input Fields for history page // tbd if logic is ok or even necessary
            <>
              <ProfileTrendSettings profile={profile} onUpdate={onUpdate} />
              <div className="grid gap-3">
                {profile.checkTypes.map((checkType) => (
                  <CheckTypeFieldsEditor
                    key={checkType}
                    profile={profile}
                    checkType={checkType}
                    onUpdate={onUpdate}
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="rounded-box border border-base-300 bg-base-200/40 p-3 text-sm opacity-80">
              Calculated profile fields are still defined in code and are not edited here.
            </div>
          )}
        </div>
      )}
    </div>
  );
}