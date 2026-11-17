export function toCsv(rows: string[][]): string {
  const csvRows = rows.map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(','))
  return `\uFEFF${csvRows.join('\r\n')}`
}
