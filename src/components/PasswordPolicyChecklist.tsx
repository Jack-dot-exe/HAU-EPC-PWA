import type { PasswordPolicyResult } from "../security/passwordPolicy";

export default function PasswordPolicyChecklist({ result }: { result: PasswordPolicyResult }) {
  return (
    <div className="mt-2 text-xs space-y-1">
      <div className={result.minLen ? "text-success" : "text-base-content/70"}>
        At least 8 characters
      </div>
      <div className={result.hasUpper ? "text-success" : "text-base-content/70"}>
        At least one uppercase letter
      </div>
      <div className={result.hasSpecial ? "text-success" : "text-base-content/70"}>
        At least one special character
      </div>
    </div>
  );
}

