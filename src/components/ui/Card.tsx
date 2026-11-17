import type { HTMLAttributes, ReactNode } from 'react'

type Props = HTMLAttributes<HTMLDivElement> & { children: ReactNode }

export function Card({ children, className = '', ...props }: Props) {
  return (
    <section
      {...props}
      className={`rounded-lg border border-border bg-surface p-4 shadow-card sm:p-6 ${className}`}
    >
      {children}
    </section>
  )
}
