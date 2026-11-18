import { describe, expect, it } from 'vitest'
import { formatRecoveryCode, generateRecoveryCode, normalizeRecoveryCode, recoveryCodeAlphabet, recoveryVerificationError } from '../../supabase/functions/_shared/recovery-code'

describe('รหัสกู้คืน', () => {
  it('สร้างรหัส 10 ตัวจากชุดอักขระที่ไม่สับสนกัน', () => {
    const code = generateRecoveryCode()
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{10}$/)
    expect([...code].every((character) => recoveryCodeAlphabet.includes(character))).toBe(true)
    expect(formatRecoveryCode(code)).toBe(`${code.slice(0, 5)}-${code.slice(5)}`)
  })

  it('ปรับรูปแบบรหัสก่อนตรวจสอบ', () => {
    expect(normalizeRecoveryCode(' abcdE-fghjk ')).toBe('ABCDEFGHJK')
    expect(normalizeRecoveryCode('ABCDI-EFGHJ')).toBeNull()
  })

  it('แปลงผล verify ที่ไม่พบผู้ใช้เป็นรหัสกู้คืนไม่ถูกต้อง', () => {
    expect(recoveryVerificationError(null)).toBe('RECOVERY_INVALID')
    expect(recoveryVerificationError('10000000-0000-4000-8000-000000000001')).toBeNull()
  })
})
