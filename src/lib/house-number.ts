const houseNoCollator = new Intl.Collator('th-TH', { numeric: true, sensitivity: 'base' })

export function compareHouseNo(a: string, b: string): number {
  return houseNoCollator.compare(a, b)
}
