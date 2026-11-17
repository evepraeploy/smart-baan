import { describe, expect, it } from 'vitest'
import { ticketCategoryLabels, ticketStatusLabels } from '../../src/features/tickets/labels'

describe('ป้ายกำกับเรื่องแจ้งซ่อม', () => {
  it('แสดงชื่อสถานะและหมวดหมู่เป็นภาษาไทยครบถ้วน', () => {
    expect(Object.values(ticketStatusLabels)).toEqual([
      'รอรับเรื่อง',
      'กำลังดำเนินการ',
      'เสร็จแล้ว',
      'ไม่รับเรื่อง',
    ])
    expect(Object.values(ticketCategoryLabels)).toEqual([
      'ไฟฟ้า',
      'ประปา',
      'ถนน/ทางเท้า',
      'ความสะอาด',
      'ความปลอดภัย',
      'อื่น ๆ',
    ])
  })
})
