'use client'

import LanguageSwitcher from '@/components/ui/LanguageSwitcher'

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen">
      {/* LanguageSwitcher is now rendered globally in root layout */}
      {children}
    </div>
  )
}
