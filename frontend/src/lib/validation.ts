export interface PasswordRule {
  id: string
  label: string
  test: (value: string) => boolean
}

/**
 * Policy from the brief: more than 8 characters (9+), with an uppercase
 * letter, a lowercase letter and a special character.
 */
export const PASSWORD_RULES: PasswordRule[] = [
  { id: 'length', label: 'At least 9 characters', test: (value) => value.length >= 9 },
  { id: 'upper', label: 'One uppercase letter', test: (value) => /[A-Z]/.test(value) },
  { id: 'lower', label: 'One lowercase letter', test: (value) => /[a-z]/.test(value) },
  {
    id: 'special',
    label: 'One special character',
    test: (value) => /[^A-Za-z0-9]/.test(value),
  },
]

export function validatePassword(value: string): { valid: boolean; failed: string[] } {
  const failed = PASSWORD_RULES.filter((rule) => !rule.test(value)).map((rule) => rule.label)
  return { valid: failed.length === 0, failed }
}

export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim())
}
