import type { SelectHTMLAttributes } from 'react'

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`min-h-control w-full rounded-md border border-border-strong bg-white px-4 text-body text-text-heading focus:border-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-200 ${props.className ?? ''}`}
    />
  )
}
