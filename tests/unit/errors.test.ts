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

  it('แปลงข้อผิดพลาดของเรื่องแจ้งซ่อมเป็นภาษาไทย', () => {
    expect(toThaiError({ code: 'TICKET_NOT_FOUND' })).toBe(messages.ticketNotFound)
    expect(toThaiError({ message: 'TOO_MANY_PHOTOS' })).toBe(messages.ticketTooManyPhotos)
    expect(toThaiError({ code: 'FEE_REQUIRED' })).toBe(messages.ticketFeeRequired)
    expect(toThaiError({ message: 'INVALID_TRANSITION' })).toBe(messages.ticketTransitionInvalid)
    expect(toThaiError({ code: 'INVALID_ASSIGNEE' })).toBe(messages.invalidAssignee)
    expect(toThaiError({ message: 'CONTRACTOR_NOT_FOUND' })).toBe(messages.contractorNotFound)
  })

  it('แปลงข้อผิดพลาดของทะเบียนอุปกรณ์และ PM', () => {
    expect(toThaiError({ code: 'ASSET_NOT_FOUND' })).toBe(messages.assetNotFound)
    expect(toThaiError({ message: 'ASSET_RETIRED' })).toBe(messages.assetRetired)
    expect(toThaiError({ code: 'INVALID_DATE' })).toBe(messages.maintenanceDateInvalid)
    expect(toThaiError({ message: 'INVALID_MAINTENANCE_KIND' })).toBe(messages.maintenanceKindInvalid)
  })

  it('ไม่แสดงข้อความดิบจากระบบ', () => {
    expect(toThaiError({ message: 'Internal server error', code: '500' })).toBe(messages.generic)
  })
})
