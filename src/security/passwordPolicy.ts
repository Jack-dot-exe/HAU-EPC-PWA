export type PasswordPolicyResult = {
  minLen: boolean;
  hasUpper: boolean;
  hasSpecial: boolean;
};

export const PASSWORD_POLICY_ERROR_TEXT =
  "Password must be at least 8 characters and include one uppercase letter and one special character.";

export function evaluatePasswordPolicy(value: string): PasswordPolicyResult {
  return {
    minLen: value.length >= 8,
    hasUpper: /[A-Z]/.test(value),
    hasSpecial: /[^A-Za-z0-9]/.test(value),
  };
}

export function isPasswordPolicyValid(result: PasswordPolicyResult): boolean {
  return result.minLen && result.hasUpper && result.hasSpecial;
}

