import { CircleHelp } from 'lucide-react'
import { Link } from 'react-router'
import { Card } from '../components/ui/Card'

export function NotFoundPage() {
  return <main className="grid min-h-dvh place-items-center bg-canvas p-5"><Card className="grid max-w-md justify-items-center gap-4 text-center"><CircleHelp className="text-text-muted" size={42} /><h1 className="text-h1 font-bold text-text-heading">ไม่พบหน้านี้</h1><Link className="inline-flex min-h-control items-center justify-center rounded-md bg-primary-700 px-5 font-semibold text-white hover:bg-primary-800" to="/">กลับหน้าหลัก</Link></Card></main>
}
