import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { LoaderCircle } from 'lucide-react'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'danger-outline' | 'quiet'
  busy?: boolean
  children: ReactNode
}

const variants = {
  primary: 'bg-primary-700 text-white hover:bg-primary-800',
  secondary: 'border border-primary-700 bg-white text-primary-700 hover:bg-primary-50',
  danger: 'bg-red-700 text-white hover:bg-red-800',
  'danger-outline': 'border border-red-700 bg-white text-red-700 hover:bg-red-50',
  quiet: 'bg-transparent text-text-body hover:bg-subtle',
}

export function Button({
  variant = 'primary',
  busy = false,
  className = '',
  disabled,
  children,
  ...props
}: Props) {
  return (
    <button
      className={`inline-flex min-h-control items-center justify-center gap-2 rounded-md px-5 text-body font-semibold transition-colors disabled:cursor-not-allowed disabled:bg-subtle disabled:text-text-disabled ${variants[variant]} ${className}`}
      disabled={disabled || busy}
      {...props}
    >
      {busy && <LoaderCircle aria-hidden="true" className="size-5 animate-spin" />}
      {children}
    </button>
  )
}
