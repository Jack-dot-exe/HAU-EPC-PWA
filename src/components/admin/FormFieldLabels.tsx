import type { ReactNode } from "react";

export function FormField({
  label,
  children,
  hint,
  className = "",
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={`form-control ${className}`}>
      <label className="label pb-1">
        <span className="label-text font-medium">{label}</span>
      </label>
      {children}
      {hint ? (
        <label className="label pt-1">
          <span className="label-text-alt opacity-70">{hint}</span>
        </label>
      ) : null}
    </div>
  );
}
