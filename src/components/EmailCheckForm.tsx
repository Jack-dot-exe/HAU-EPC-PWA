import { isValidEmail } from "../security/emailPolicy";

type EmailCheckFormProps = {
  email: string;
  busy: boolean;
  onEmailChange: (value: string) => void;
  onSubmit: () => void;
};

export default function EmailCheckForm(props: EmailCheckFormProps) {
  const hasValue = props.email.trim().length > 0;
  const validEmail = isValidEmail(props.email);

  return (
    <fieldset className="fieldset">
      <label className="label">Email</label>
      <input
        type="email"
        className={`input w-full ${hasValue && !validEmail ? "input-error" : ""}`}
        autoComplete="email"
        value={props.email}
        onChange={(e) => props.onEmailChange(e.target.value)}
        placeholder="you@example.com"
        onKeyDown={(e) => {
          if (e.key === "Enter" && validEmail) props.onSubmit();
        }}
      />

      {hasValue && !validEmail && (
        <div className="mt-2 text-xs text-error">
          Enter a valid email address.
        </div>
      )}

      <button
        className="btn btn-neutral mt-4"
        onClick={props.onSubmit}
        disabled={!validEmail || props.busy}
      >
        {props.busy ? "Checking..." : "Continue"}
      </button>
    </fieldset>
  );
}
