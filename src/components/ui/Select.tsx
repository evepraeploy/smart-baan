import type { SelectHTMLAttributes } from 'react'

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`h-control w-full rounded-md border-[1.5px] border-outline bg-white px-4 text-[18px] leading-7 text-text-heading focus:border-2 focus:border-primary-container focus:outline-none focus:ring-4 focus:ring-primary-fixed/50 aria-[invalid=true]:border-danger ${props.className ?? ''}`}
    />
  )
}
