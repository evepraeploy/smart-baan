import { ShieldX } from 'lucide-react'
import { Link } from 'react-router'
import { Card } from '../components/ui/Card'
import { messages } from '../lib/messages.th'

export function ForbiddenPage() {
  return <main className="grid min-h-dvh place-items-center bg-canvas p-5"><Card className="grid max-w-md justify-items-center gap-4 text-center"><ShieldX className="text-red-700" size={42} /><h1 className="text-h1 font-bold text-text-heading">{messages.forbidden}</h1><Link className="inline-flex min-h-control items-center justify-center rounded-md bg-primary-700 px-5 font-semibold text-white hover:bg-primary-800" to="/">กลับหน้าหลัก</Link></Card></main>
}
