import type { InputHTMLAttributes } from 'react'

export function Checkbox(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      type="checkbox"
      className={`size-6 accent-primary-700 ${props.className ?? ''}`}
    />
  )
}
