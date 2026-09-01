import { DEFAULT_INPUT_ONLY_PROFILE_TEMPLATE } from "../../app/profileStore";
import type { AircraftProfile } from "../../domain/models";
import { createBlankInputOnlyProfile, makeId } from "../../domain/profileHelpers";
import ProfileCard from "./ProfileCard";

/**
 * Section that lists and edits aircraft profiles.
 */

export default function ProfilesSection({
  profiles,
  addProfile,
  updateProfile,
  removeProfile,
}: {
  profiles: AircraftProfile[];
  addProfile: (profile: AircraftProfile) => void;
  updateProfile: (id: string, patch: Partial<AircraftProfile>) => void;
  removeProfile: (id: string) => void;
}) {
  const addTemplateProfile = () =>
    addProfile({
      ...DEFAULT_INPUT_ONLY_PROFILE_TEMPLATE,
      id: makeId("p"),
    });

  return (
    <div className="card bg-base-100 shadow">
      <div className="card-body">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold">Aircraft Profiles</h3>
            <p className="text-sm opacity-70">
              Create input-only profiles, define fields, and configure history/trend behavior.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              className="btn btn-primary btn-sm"
              onClick={() => addProfile(createBlankInputOnlyProfile())}
            >
              New Input-Only Profile
            </button>

            <button className="btn btn-outline btn-sm" onClick={addTemplateProfile}>
              Add from Template
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-4">
          {profiles.map((profile) => (
            <ProfileCard
              key={profile.id}
              profile={profile}
              onUpdate={(patch) => updateProfile(profile.id, patch)}
              onRemove={() => removeProfile(profile.id)}
            />
          ))}

          {profiles.length === 0 && <div className="opacity-70">No profiles yet.</div>}
        </div>
      </div>
    </div>
  );
}
