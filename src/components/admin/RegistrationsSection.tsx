import { useMemo, useState } from "react";
import type { AircraftProfile, Registration } from "../../domain/models";
import { getEffectiveEngines, makeId } from "../../domain/profileHelpers";
import ConfirmDeleteModal from "../ConfirmDeleteModal";

/**
 * Section for adding, editing, and deleting aircraft registrations.
 */

export default function RegistrationsSection({
  profiles,
  registrations,
  addRegistration,
  updateRegistration,
  removeRegistration,
}: {
  profiles: AircraftProfile[];
  registrations: Registration[];
  addRegistration: (registration: Registration) => void;
  updateRegistration: (id: string, patch: Partial<Registration>) => void;
  removeRegistration: (id: string) => void;
}) {
  const [tailNumber, setTailNumber] = useState("");
  const [profileId, setProfileId] = useState(profiles[0]?.id ?? "");

  const profileById = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile])),
    [profiles],
  );

  return (
    <div className="card bg-base-100 shadow">
      <div className="card-body">
        <h3 className="font-semibold">Registrations</h3>

        <div className="mt-3 grid gap-3 md:grid-cols-5 items-start">
          <input
            className="input input-bordered md:col-span-2"
            placeholder="Tail number"
            value={tailNumber}
            onChange={(e) => setTailNumber(e.target.value)}
          />

          <select
            className="select select-bordered md:col-span-2"
            value={profileId}
            onChange={(e) => setProfileId(e.target.value)}
          >
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.modelName} ({profile.engine})
              </option>
            ))}
          </select>

          <button
            className="btn btn-primary"
            disabled={!tailNumber.trim() || !profileId}
            onClick={() => {
              addRegistration({
                id: makeId("r"),
                tailNumber: tailNumber.trim().toUpperCase(),
                profileId,
              });
              setTailNumber("");
            }}
          >
            Add registration
          </button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="table table-zebra">
            <thead>
              <tr>
                <th>Tail</th>
                <th>Profile</th>
                <th>Engines</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {registrations.map((registration) => {
                const profile = profileById.get(registration.profileId);
                const engines = getEffectiveEngines(registration, profile);

                return (
                  <tr key={registration.id}>
                    <td>
                      <input
                        className="input input-bordered input-sm font-mono"
                        value={registration.tailNumber}
                        onChange={(e) =>
                          updateRegistration(registration.id, {
                            tailNumber: e.target.value.toUpperCase(),
                          })
                        }
                      />
                    </td>

                    <td>
                      <select
                        className="select select-bordered select-sm"
                        value={registration.profileId}
                        onChange={(e) =>
                          updateRegistration(registration.id, {
                            profileId: e.target.value,
                          })
                        }
                      >
                        {profiles.map((entry) => (
                          <option key={entry.id} value={entry.id}>
                            {entry.modelName}
                          </option>
                        ))}
                      </select>

                      <div className="text-xs opacity-70">
                        {profile
                          ? `${profile.modelName} (${profile.executionMode === "input_only" ? "Input Only" : "Calculated"})`
                          : "-"}
                      </div>
                    </td>

                    <td>
                      <div className="flex flex-wrap gap-2">
                        {engines.map((engine) => (
                          <span key={engine.id} className="badge badge-ghost">
                            {engine.label}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="text-right">
                      <ConfirmDeleteModal
                        title="Delete Registration"
                        message={`Delete "${registration.tailNumber}"?`}
                        onConfirm={() => removeRegistration(registration.id)}
                      />
                    </td>
                  </tr>
                );
              })}

              {registrations.length === 0 && (
                <tr>
                  <td colSpan={4} className="opacity-70">
                    No registrations yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
