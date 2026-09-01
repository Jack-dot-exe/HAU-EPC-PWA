import { useProfiles } from "../app/profileStore";
import { useRegistrations } from "../app/registrationStore";
import { useChecks } from "../app/checksStore";
import DevToolsSection from "../components/admin/DevToolsSection";
import ProfilesSection from "../components/admin/ProfilesSection";
import RegistrationsSection from "../components/admin/RegistrationsSection";

/**
 * Admin page for managing registrations, input-only profiles, and dev tools.
 */
export default function AdminPage() {
  const {
    profiles,
    addProfile,
    updateProfile,
    removeProfile,
    resetProfiles,
  } = useProfiles();

  const {
    registrations,
    addRegistration,
    updateRegistration,
    removeRegistration,
    resetRegistrations,
  } = useRegistrations();

  const { resetChecks } = useChecks();

  return (
    <div className="grid gap-4">
      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <h2 className="card-title">Admin Panel</h2>
          <p className="opacity-70">
            Input-only profiles can be created and edited here. Calculated profiles stay tied to
            their hardcoded calculation code.
          </p>
        </div>
      </div>

      <RegistrationsSection
        profiles={profiles}
        registrations={registrations}
        addRegistration={addRegistration}
        updateRegistration={updateRegistration}
        removeRegistration={removeRegistration}
      />

      <ProfilesSection
        profiles={profiles}
        addProfile={addProfile}
        updateProfile={updateProfile}
        removeProfile={removeProfile}
      />

      <DevToolsSection
        resetProfiles={resetProfiles}
        resetRegistrations={resetRegistrations}
        resetChecks={resetChecks}
      />
    </div>
  );
}
