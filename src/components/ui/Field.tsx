import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react'

type FieldProps = {
  label: string
  error?: string
  hint?: string
  children?: ReactNode
}

export function Field({ label, error, hint, children }: FieldProps) {
  return (
    <label className="grid gap-2 text-body font-semibold text-text-heading">
      {label}
      {children}
      {error && <span className="text-body font-normal text-red-700">{error}</span>}
      {!error && hint && <span className="text-caption font-normal text-text-muted">{hint}</span>}
    </label>
  )
}

const controlClass =
  'min-h-control w-full rounded-md border border-border-strong bg-white px-4 text-body font-normal text-text-heading placeholder:text-text-muted focus:border-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-200'

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${controlClass} ${props.className ?? ''}`} />
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`min-h-32 w-full rounded-md border border-border-strong bg-white px-4 py-3 text-body font-normal text-text-heading placeholder:text-text-muted focus:border-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-200 ${props.className ?? ''}`}
    />
  )
}
