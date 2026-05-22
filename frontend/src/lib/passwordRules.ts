export const passwordRules = [
  { test: (v: string) => v.length >= 8, label: 'Au moins 8 caractères' },
  { test: (v: string) => /[a-z]/.test(v), label: 'Une minuscule' },
  { test: (v: string) => /[A-Z]/.test(v), label: 'Une majuscule' },
  { test: (v: string) => /[0-9]/.test(v), label: 'Un chiffre' },
];

export function getPasswordChecks(password: string) {
  return passwordRules.map((rule) => ({
    ...rule,
    valid: rule.test(password),
  }));
}

export function isPasswordStrong(password: string): boolean {
  return passwordRules.every((rule) => rule.test(password));
}
