import { describe, expect, it } from 'vitest'
import { compareHouseNo } from '../../src/lib/house-number'

describe('เรียงเลขที่บ้านตามตัวเลข', () => {
  it('เรียง 99/2 ก่อน 99/10', () => {
    expect(['99/10', '99/2', '99/1'].sort(compareHouseNo)).toEqual(['99/1', '99/2', '99/10'])
  })
})
