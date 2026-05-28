import { cn } from '@/components/ui/utils'

type Size = 'sm' | 'md' | 'lg'

interface LoadingSpinnerProps {
  size?: Size
  className?: string
  label?: string
}

const SIZE_CLASS: Record<Size, string> = {
  sm: 'h-4 w-4 border-2',
  md: 'h-8 w-8 border-2',
  lg: 'h-12 w-12 border-[3px]',
}

export default function LoadingSpinner({
  size = 'md',
  className,
  label = 'Đang tải…',
}: LoadingSpinnerProps) {
  return (
    <div
      role="status"
      aria-label={label}
      className={cn('flex flex-col items-center justify-center gap-3', className)}
    >
      <span
        className={cn(
          'animate-spin rounded-full border-slate-200 border-t-slate-700',
          SIZE_CLASS[size],
        )}
      />
      {label ? (
        <p className="text-xs text-slate-400 font-medium tracking-wide">{label}</p>
      ) : null}
    </div>
  )
}
