/**
 * Development-only reset tools.
 */
export default function DevToolsSection({
  resetProfiles,
  resetRegistrations,
  resetChecks,
}: {
  resetProfiles: () => void;
  resetRegistrations: () => void;
  resetChecks: () => void;
}) {
  return (
    <div className="card bg-base-100 shadow">
      <div className="card-body">
        <h3 className="font-semibold">Development Data Tools</h3>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            className="btn btn-outline btn-sm"
            onClick={() => {
              if (confirm("Clear all PROFILES from the database?")) {
                resetProfiles();
              }
            }}
          >
            Clear Profiles
          </button>

          <button
            className="btn btn-outline btn-sm"
            onClick={() => {
              if (confirm("Clear all REGISTRATIONS from the database?")) {
                resetRegistrations();
              }
            }}
          >
            Clear Registrations
          </button>

          <button
            className="btn btn-outline btn-sm"
            onClick={() => {
              if (confirm("Clear all CHECKS from the database?")) {
                resetChecks();
              }
            }}
          >
            Clear Checks
          </button>
        </div>
      </div>
    </div>
  );
}
