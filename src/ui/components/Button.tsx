import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-spot text-stage hover:brightness-110 shadow-[0_0_30px_-6px_var(--color-spot)]',
  secondary: 'bg-surface-2 text-ink border border-line hover:border-muted',
  ghost: 'bg-transparent text-muted hover:text-ink',
}

export function Button({
  variant = 'secondary',
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      className={`min-h-12 rounded-2xl px-5 text-base font-semibold transition disabled:opacity-40 ${VARIANTS[variant]} ${className}`}
      {...rest}
    />
  )
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1 rounded-2xl border border-line bg-surface p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-11 flex-1 rounded-xl px-3 text-sm font-medium transition ${
            value === o.value ? 'bg-surface-2 text-ink shadow-inner' : 'text-muted hover:text-ink'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
