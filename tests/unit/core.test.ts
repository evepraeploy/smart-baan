import { describe, expect, it } from 'vitest'
import { formatBaht, formatDateTH, formatDateTimeInputTH, formatDateTimeTH, formatMonthTH, formatTimeTH, formatWeekdayDateTH, parseDateTimeInputTH } from '../../src/lib/format'
import { identifierToEmail, normalizePhone } from '../../src/lib/auth-identifier'
import { getBillDisplayStatus, getDueCountdown } from '../../src/lib/bill-status'
import { getMobileBackFallback } from '../../src/lib/mobile-nav'
import { getBangkokMonthUtcBounds } from '../../src/lib/date'

describe('รูปแบบวันที่และจำนวนเงิน', () => {
  it('แสดงวันที่และเดือนเป็นพุทธศักราชตามเวลาไทย', () => {
    expect(formatDateTH('2026-11-25T00:00:00Z')).toContain('2569')
    expect(formatMonthTH('2026-11-01')).toContain('2569')
    expect(formatDateTimeTH('2026-11-25T07:30:00Z')).toContain('14:30 น.')
    expect(formatTimeTH('2026-11-25T07:30:00Z')).toBe('14:30')
    expect(formatWeekdayDateTH('2026-11-25T00:00:00Z')).toBe('วันพุธที่ 25 พฤศจิกายน 2569')
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
    expect(getBillDisplayStatus('unpaid', '2026-11-25', new Date('2026-11-25T02:00:00Z')).tone).toBe('warning')
  })

  it('แสดงจำนวนวันที่เหลือหรือเลยกำหนดตามเวลาไทย', () => {
    const now = new Date('2026-11-25T02:00:00Z')
    expect(getDueCountdown('2026-11-30', now)).toMatchObject({ days: 5, label: 'อีก 5 วัน', overdue: false })
    expect(getDueCountdown('2026-11-25', now).label).toBe('ครบกำหนดวันนี้')
    expect(getDueCountdown('2026-11-22', now)).toMatchObject({ days: 3, label: 'เลยกำหนด 3 วัน', overdue: true })
  })
})

describe('ทางกลับบนมือถือ', () => {
  it('เลือกเมนูเพิ่มเติมสำหรับเส้นทางที่มีในเมนูตามบทบาท', () => {
    expect(getMobileBackFallback('/payments/history', { committee: false, hasHouse: false, admin: false })).toBe('/more')
    expect(getMobileBackFallback('/admin/payment-status', { committee: true, hasHouse: false, admin: false })).toBe('/more')
    expect(getMobileBackFallback('/admin/settings', { committee: true, hasHouse: false, admin: true })).toBe('/more')
    expect(getMobileBackFallback('/repairs/new', { committee: true, hasHouse: false, admin: false })).toBe('/')
  })
})

describe('ช่วงเดือนตามเวลาไทย', () => {
  it('แปลงขอบเขตเดือนกรุงเทพฯ เป็น UTC รวมจุดเปลี่ยนปี', () => {
    expect(getBangkokMonthUtcBounds('2026-01')).toEqual({
      start: '2025-12-31T17:00:00.000Z',
      end: '2026-01-31T17:00:00.000Z',
    })
  })
})
