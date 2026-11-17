import { describe, expect, it } from 'vitest'
import { toThaiError } from '../../src/lib/errors'
import { messages } from '../../src/lib/messages.th'

describe('ข้อความผิดพลาดภาษาไทย', () => {
  it('ใช้ข้อความเดียวกันเมื่อเข้าสู่ระบบไม่สำเร็จ', () => {
    expect(toThaiError({ code: 'invalid_credentials', message: 'Invalid login credentials' })).toBe(messages.wrongCredentials)
    expect(toThaiError(new Error(messages.wrongCredentials))).toBe(messages.wrongCredentials)
  })

  it('แปลงรหัสผลตรวจสลิปและข้อผิดพลาด Storage', () => {
    expect(toThaiError({ message: 'SLIP_NOT_PENDING' })).toBe(messages.slipAlreadyReviewed)
    expect(toThaiError({ name: 'StorageApiError', message: 'Payload too large' })).toBe(messages.uploadFailed)
  })

  it('แปลงข้อผิดพลาดเกี่ยวกับรหัสผ่านและคำขอรีเซ็ต', () => {
    expect(toThaiError({ code: 'same_password' })).toBe(messages.passwordSameAsCurrent)
    expect(toThaiError({ message: 'Password should be different from the old password' })).toBe(messages.passwordSameAsCurrent)
    expect(toThaiError({ code: 'REQUEST_NOT_OPEN' })).toBe(messages.resetRequestClosed)
    expect(toThaiError({ code: 'IDENTIFIER_REQUIRED' })).toBe(messages.identifierRequired)
    expect(toThaiError({ message: 'REQUEST_NOT_OPEN' })).toBe(messages.resetRequestClosed)
    expect(toThaiError({ message: 'IDENTIFIER_REQUIRED' })).toBe(messages.identifierRequired)
  })

  it('ไม่แสดงข้อความดิบจากระบบ', () => {
    expect(toThaiError({ message: 'Internal server error', code: '500' })).toBe(messages.generic)
  })
})
