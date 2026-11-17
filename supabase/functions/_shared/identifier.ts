export function normalizePhone(identifier: string): string | null {
  const digits = identifier.replace(/[\s-]/g, '')
  return /^0\d{8,9}$/.test(digits) ? digits : null
}

export function identifierToEmail(identifier: string): string {
  const slug = identifier
    .trim()
    .toLowerCase()
    .replaceAll('/', '-')
    .replace(/[^a-z0-9-]/g, '')
  return `u-${slug}@village.internal`
}
