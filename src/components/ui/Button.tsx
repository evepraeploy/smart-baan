import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { LoaderCircle } from 'lucide-react'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'danger-outline' | 'quiet'
  busy?: boolean
  children: ReactNode
}

const variants = {
  primary: 'bg-primary-container text-white shadow-card hover:bg-primary active:bg-primary-pressed',
  secondary: 'bg-surface-high text-primary hover:bg-surface-highest active:bg-surface-highest',
  outline: 'border-2 border-primary-container bg-white text-primary hover:bg-surface-low',
  danger: 'bg-danger text-white hover:bg-danger-pressed active:bg-danger-pressed',
  'danger-outline': 'border-2 border-danger bg-white text-danger hover:bg-tint-danger',
  quiet: 'bg-transparent text-primary hover:bg-surface-low',
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
      className={`inline-flex min-h-control items-center justify-center gap-2 rounded-md px-6 text-[18px] leading-7 font-semibold transition duration-150 ease-out active:scale-[0.98] disabled:cursor-not-allowed disabled:border-transparent disabled:bg-surface-mid disabled:text-text-disabled disabled:shadow-none ${variants[variant]} ${className}`}
      disabled={disabled || busy}
      {...props}
    >
      {busy && <LoaderCircle aria-hidden="true" className="size-5 animate-spin" />}
      {children}
    </button>
  )
}
