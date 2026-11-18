import type { InputHTMLAttributes } from 'react'

export function Checkbox(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      type="checkbox"
      className={`size-6 border-2 border-outline accent-primary-container aria-[invalid=true]:border-danger focus-visible:outline-primary ${props.className ?? ''}`}
    />
  )
}
