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

  it('ไม่แสดงข้อความดิบจากระบบ', () => {
    expect(toThaiError({ message: 'Internal server error', code: '500' })).toBe(messages.generic)
  })
})
