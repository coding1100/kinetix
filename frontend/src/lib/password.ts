export interface PasswordRuleCheck {
  key: string;
  label: string;
  test: (password: string) => boolean;
}

export const PASSWORD_RULES: PasswordRuleCheck[] = [
  { key: "length", label: "At least 8 characters", test: (p) => p.length >= 8 },
  { key: "lower", label: "A lowercase letter", test: (p) => /[a-z]/.test(p) },
  { key: "upper", label: "An uppercase letter", test: (p) => /[A-Z]/.test(p) },
  { key: "number", label: "A number", test: (p) => /\d/.test(p) },
  { key: "symbol", label: "A symbol", test: (p) => /[^\w\s]/.test(p) },
];

export function isPasswordValid(password: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(password));
}

export type PasswordStrength = "empty" | "weak" | "fair" | "good" | "strong";

export function passwordStrength(password: string): PasswordStrength {
  if (!password) return "empty";
  const passed = PASSWORD_RULES.filter((rule) => rule.test(password)).length;
  if (passed <= 2) return "weak";
  if (passed === 3) return "fair";
  if (passed === 4) return "good";
  return "strong";
}
