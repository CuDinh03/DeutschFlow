'use client'

import * as React from 'react'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'

/** TkSearch — search input with icon (manifest TkSearch, states empty|typing). */
export interface TkSearchProps extends React.InputHTMLAttributes<HTMLInputElement> {
  containerClassName?: string
}

export function TkSearch({ containerClassName, className, ...props }: TkSearchProps) {
  return (
    <div
      className={cn(
        'flex flex-1 items-center gap-2.5 rounded-ga border border-ga-line bg-ga-card px-4 py-2.5 transition-shadow focus-within:shadow-ga-card-hover',
        containerClassName,
      )}
    >
      <Search size={15} strokeWidth={2} className="shrink-0 text-ga-subtle" />
      <input
        type="search"
        className={cn(
          'ga-ui w-full bg-transparent text-[13px] font-medium text-ga-ink outline-none placeholder:text-ga-subtle',
          className,
        )}
        {...props}
      />
    </div>
  )
}
