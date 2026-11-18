export const recoveryCodeAlphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export function normalizeRecoveryCode(value: string): string | null {
  const normalized = value.toUpperCase().replace(/[\s-]/g, '')
  if (normalized.length !== 10 || [...normalized].some((character) => !recoveryCodeAlphabet.includes(character))) return null
  return normalized
}

export function formatRecoveryCode(value: string): string {
  const normalized = normalizeRecoveryCode(value)
  if (!normalized) throw new RangeError('Invalid recovery code')
  return `${normalized.slice(0, 5)}-${normalized.slice(5)}`
}

export function recoveryVerificationError(userId: string | null): 'RECOVERY_INVALID' | null {
  return userId ? null : 'RECOVERY_INVALID'
}

export function generateRecoveryCode(): string {
  const max = 256 - (256 % recoveryCodeAlphabet.length)
  let result = ''
  while (result.length < 10) {
    const bytes = crypto.getRandomValues(new Uint8Array(16))
    for (const byte of bytes) {
      if (byte >= max) continue
      result += recoveryCodeAlphabet[byte % recoveryCodeAlphabet.length]
      if (result.length === 10) break
    }
  }
  return result
}
