import { Construction } from 'lucide-react'
import { Card } from '../components/ui/Card'

export function ComingSoonPage({ title }: { title: string }) {
  return (
    <Card className="grid min-h-72 place-items-center text-center">
      <div className="grid justify-items-center gap-3">
        <Construction className="text-amber-700" size={40} />
        <h1 className="text-h1 font-bold text-text-heading">{title}</h1>
        <p className="text-body text-text-muted">เร็ว ๆ นี้</p>
      </div>
    </Card>
  )
}
