import { describe, expect, it } from 'vitest'
import { formatBaht, formatDateTH, formatDateTimeInputTH, formatDateTimeTH, formatMonthTH, parseDateTimeInputTH } from '../../src/lib/format'
import { identifierToEmail, normalizePhone } from '../../src/lib/auth-identifier'
import { getBillDisplayStatus } from '../../src/lib/bill-status'

describe('รูปแบบวันที่และจำนวนเงิน', () => {
  it('แสดงวันที่และเดือนเป็นพุทธศักราชตามเวลาไทย', () => {
    expect(formatDateTH('2026-11-25T00:00:00Z')).toContain('2569')
    expect(formatMonthTH('2026-11-01')).toContain('2569')
    expect(formatDateTimeTH('2026-11-25T07:30:00Z')).toContain('14:30 น.')
  })

  it('จัดรูปแบบเงินบาทสองตำแหน่ง', () => {
    expect(formatBaht(1500)).toBe('1,500.00 บาท')
  })

  it('แปลงค่าเวลาในฟอร์มเป็นเวลาประเทศไทยและเก็บเป็น UTC', () => {
    expect(formatDateTimeInputTH(new Date('2026-11-25T07:30:00Z'))).toBe('2026-11-25T14:30')
    expect(parseDateTimeInputTH('2026-11-25T14:30').toISOString()).toBe('2026-11-25T07:30:00.000Z')
  })
})

describe('ตัวระบุสำหรับเข้าสู่ระบบ', () => {
  it('สร้างอีเมลจากบ้านเลขที่และรหัสผู้ใช้', () => {
    expect(identifierToEmail('99/12')).toBe('u-99-12@village.internal')
    expect(identifierToEmail('Committee02')).toBe('u-committee02@village.internal')
  })

  it('ใช้ตัวช่วยเดียวกับ Edge Function สำหรับ slug', async () => {
    const edgeIdentifier = await import('../../supabase/functions/_shared/identifier')
    for (const identifier of ['99/12', 'committee02', 'Admin 01']) {
      expect(identifierToEmail(identifier)).toBe(edgeIdentifier.identifierToEmail(identifier))
    }
  })

  it('ตรวจจับเบอร์โทรไทยหลังตัดช่องว่างและขีด', () => {
    expect(normalizePhone('081-234-5678')).toBe('0812345678')
    expect(normalizePhone('99/12')).toBeNull()
  })
})

describe('สถานะบิล', () => {
  it('เลือกสถานะรอชำระและค้างชำระจากวันที่กรุงเทพฯ', () => {
    expect(getBillDisplayStatus('unpaid', '2026-11-25', new Date('2026-11-25T02:00:00Z')).label).toBe('รอชำระ')
    expect(getBillDisplayStatus('unpaid', '2026-11-25', new Date('2026-11-25T17:00:00Z')).label).toBe('ค้างชำระ')
    expect(getBillDisplayStatus('pending_review', '2026-11-25').label).toBe('รอตรวจสอบ')
  })
})
