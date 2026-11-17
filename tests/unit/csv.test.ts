import { describe, expect, it } from 'vitest'
import { toCsv } from '../../src/lib/csv'

describe('CSV สำหรับเปิดด้วย Excel', () => {
  it('ใส่ UTF-8 BOM และคงข้อความภาษาไทย', () => {
    const csv = toCsv([['วันที่', 'หมวดหมู่'], ['25 พ.ย. 2569', 'ค่าน้ำ']])
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv).toContain('25 พ.ย. 2569')
    expect(csv).toContain('ค่าน้ำ')
  })

  it('ใส่เครื่องหมายอัญประกาศให้เครื่องหมายจุลภาค อัญประกาศ และบรรทัดใหม่', () => {
    expect(toCsv([['รายละเอียด'], ['ค่าไฟ, น้ำ "ส่วนกลาง"\nรอบเดือน']])).toBe(
      '\uFEFF"รายละเอียด"\r\n"ค่าไฟ, น้ำ ""ส่วนกลาง""\nรอบเดือน"',
    )
  })
})
