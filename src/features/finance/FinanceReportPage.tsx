import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, FileText } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Select } from '../../components/ui/Select'
import { Spinner } from '../../components/ui/Spinner'
import { toThaiError } from '../../lib/errors'
import { currentBangkokYear } from '../../lib/date'
import { formatBaht, formatDateTH, formatMonthTH } from '../../lib/format'
import { toCsv } from '../../lib/csv'
import { getFinanceReport, type FinanceReport } from './api'

export function FinanceReportPage() {
  const currentYear = currentBangkokYear()
  const [year, setYear] = useState(currentYear)
  const [report, setReport] = useState<FinanceReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const years = useMemo(() => Array.from({ length: 6 }, (_, index) => currentYear - 4 + index), [currentYear])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setReport(await getFinanceReport(year))
      setError('')
    } catch (caught) {
      setReport(null)
      setError(toThaiError(caught))
    } finally {
      setLoading(false)
    }
  }, [year])
  useEffect(() => { void refresh() }, [refresh])

  function exportCsv() {
    if (!report) return
    const rows = [
      ['เดือน', 'รายรับ', 'รายจ่าย', 'สุทธิ'],
      ...report.months.map((month) => [
        formatMonthTH(month.month),
        formatBaht(month.income),
        formatBaht(month.expense),
        formatBaht(month.income - month.expense),
      ]),
    ]
    const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `finance-report-${year + 543}.csv`
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-h1 font-bold text-text-heading">รายงานการเงิน</h1>
          <p className="text-body text-text-muted">สรุปการเงินภาพรวมของหมู่บ้าน</p>
        </div>
        <Button disabled={!report || loading} onClick={exportCsv} variant="secondary"><Download aria-hidden="true" size={20} />ส่งออก CSV</Button>
      </div>
      <Card className="grid gap-2 sm:max-w-xs">
        <label className="grid gap-2 text-body font-semibold text-text-heading">
          ปี พ.ศ.
          <Select onChange={(event) => setYear(Number(event.target.value))} value={year}>
            {years.map((option) => <option key={option} value={option}>{option + 543}</option>)}
          </Select>
        </label>
      </Card>
      {error && <p aria-live="polite" className="rounded-md bg-tint-danger p-3 text-body text-danger">{error}</p>}
      {loading ? <Spinner /> : report ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard label="ยอดคงเหลือ" value={report.balance} />
            <SummaryCard label="รายรับปีนี้" value={report.year_income} tone="success" />
            <SummaryCard label="รายจ่ายปีนี้" value={report.year_expense} tone="danger" />
            <Card>
              <p className="text-body text-text-muted">ยอดยกมา</p>
              <p className="mt-2 font-display text-h2 font-bold tabular-nums text-text-heading">{formatBaht(report.opening_balance)}</p>
              <p className="mt-1 text-caption text-text-muted">{report.opening_balance_date ? `ณ ${formatDateTH(report.opening_balance_date)}` : 'ไม่ระบุวันที่'}</p>
            </Card>
          </div>
          <Card>
            <h2 className="mb-4 font-display text-h2 font-bold text-text-heading">สรุปรายเดือน ปี พ.ศ. {year + 543}</h2>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[36rem] border-collapse text-left text-body">
                <thead className="bg-surface-low text-text-heading">
                  <tr><th className="p-3 font-semibold">เดือน</th><th className="p-3 text-right font-semibold">รายรับ</th><th className="p-3 text-right font-semibold">รายจ่าย</th><th className="p-3 text-right font-semibold">สุทธิ</th></tr>
                </thead>
                <tbody>
                  {report.months.map((month) => (
                    <tr className="border-b border-outline-soft even:bg-surface-low/60" key={month.month}>
                      <th className="p-3 font-medium text-text-heading">{formatMonthTH(month.month)}</th>
                      <td className="p-3 text-right tabular-nums text-primary">{formatBaht(month.income)}</td>
                      <td className="p-3 text-right tabular-nums text-danger">{formatBaht(month.expense)}</td>
                      <td className="p-3 text-right tabular-nums text-text-heading">{formatBaht(month.income - month.expense)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="grid gap-3 md:hidden">
              {report.months.map((month) => (
                <section className="grid gap-3 rounded-lg border border-outline-soft bg-surface-low p-4" key={month.month}>
                  <h3 className="font-display text-h3 font-bold text-text-heading">{formatMonthTH(month.month)}</h3>
                  <dl className="grid grid-cols-2 gap-3">
                    <div><dt className="text-caption text-text-muted">รายรับ</dt><dd className="text-body font-semibold tabular-nums text-primary">{formatBaht(month.income)}</dd></div>
                    <div><dt className="text-caption text-text-muted">รายจ่าย</dt><dd className="text-body font-semibold tabular-nums text-danger">{formatBaht(month.expense)}</dd></div>
                    <div className="col-span-2 border-t border-outline-soft pt-2"><dt className="text-caption text-text-muted">สุทธิ</dt><dd className="font-display text-h3 font-bold tabular-nums text-text-heading">{formatBaht(month.income - month.expense)}</dd></div>
                  </dl>
                </section>
              ))}
            </div>
          </Card>
          <Card>
            <h2 className="mb-4 font-display text-h2 font-bold text-text-heading">แยกตามหมวดหมู่</h2>
            {report.categories.length ? (
              <div className="grid gap-5 md:grid-cols-2">
                {(['income', 'expense'] as const).map((type) => {
                  const rows = report.categories.filter((item) => item.entry_type === type)
                  return (
                    <section className="grid gap-2" key={type}>
                      <h3 className="text-h3 font-semibold text-text-heading">{type === 'income' ? 'รายรับ' : 'รายจ่าย'}</h3>
                      {rows.length ? rows.map((item) => (
                        <div className="flex min-h-touch items-center justify-between gap-3 border-b border-outline-soft py-2" key={item.category}>
                          <span className="text-body text-text-body">{item.category}</span>
                          <span className="text-body font-semibold tabular-nums text-text-heading">{formatBaht(item.amount)}</span>
                        </div>
                      )) : <p className="text-body text-text-muted">ไม่มีรายการ</p>}
                    </section>
                  )
                })}
              </div>
            ) : <EmptyState icon={FileText} title="ไม่มีรายการในปีนี้" />}
          </Card>
        </>
      ) : !error && <Card><EmptyState icon={FileText} title="ยังไม่มีรายงานการเงิน" /></Card>}
    </div>
  )
}

function SummaryCard({ label, value, tone = 'neutral' }: { label: string; value: number; tone?: 'neutral' | 'success' | 'danger' }) {
  const color = tone === 'success'
    ? 'text-primary'
    : tone === 'danger' ? 'text-danger' : 'text-text-heading'
  return (
    <Card>
      <p className="text-body text-text-muted">{label}</p>
      <p className={`mt-2 font-display text-h2 font-bold tabular-nums ${color}`}>{formatBaht(value)}</p>
    </Card>
  )
}
