import { cloneElement, isValidElement, useId, type InputHTMLAttributes, type ReactElement, type ReactNode, type TextareaHTMLAttributes } from 'react'

type FieldProps = {
  label: string
  error?: string
  hint?: string
  children?: ReactNode
}

export function Field({ label, error, hint, children }: FieldProps) {
  const errorId = useId()
  const control = error && isValidElement(children)
    ? cloneElement(children as ReactElement<{ 'aria-invalid'?: boolean; 'aria-describedby'?: string }>, {
        'aria-invalid': true,
        'aria-describedby': errorId,
      })
    : children
  return (
    <label className="grid gap-3 text-base leading-6 font-semibold text-text-body">
      {label}
      {control}
      {error && <span className="text-body font-normal text-danger" id={errorId}>{error}</span>}
      {!error && hint && <span className="text-caption font-normal text-text-muted">{hint}</span>}
    </label>
  )
}

const controlClass =
  'h-control w-full rounded-md border-[1.5px] border-outline bg-white px-4 text-[18px] leading-7 font-normal text-text-heading placeholder:text-text-muted focus:border-2 focus:border-primary-container focus:outline-none focus:ring-4 focus:ring-primary-fixed/50 aria-[invalid=true]:border-danger'

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${controlClass} ${props.className ?? ''}`} />
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`min-h-32 w-full rounded-md border-[1.5px] border-outline bg-white px-4 py-3 text-[18px] leading-7 font-normal text-text-heading placeholder:text-text-muted focus:border-2 focus:border-primary-container focus:outline-none focus:ring-4 focus:ring-primary-fixed/50 aria-[invalid=true]:border-danger ${props.className ?? ''}`}
    />
  )
}
