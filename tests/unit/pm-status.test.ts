import { describe, expect, it } from 'vitest'
import { getPmStatus } from '../../src/lib/pm-status'

describe('สถานะรอบบำรุงรักษา', () => {
  it('จำแนกวันครบกำหนดที่เลยกำหนด ใกล้ถึงกำหนด และยังไม่ถึง', () => {
    expect(getPmStatus(null, '2026-11-17')).toBe('none')
    expect(getPmStatus('2026-11-16', '2026-11-17')).toBe('overdue')
    expect(getPmStatus('2026-11-17', '2026-11-17')).toBe('soon')
    expect(getPmStatus('2026-12-01', '2026-11-17')).toBe('soon')
    expect(getPmStatus('2026-12-02', '2026-11-17')).toBe('ok')
  })
})
