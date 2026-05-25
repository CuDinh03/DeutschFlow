'use client'

import LanguageSwitcher from '@/components/ui/LanguageSwitcher'
import { PlanProvider } from '@/contexts/PlanContext'

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <PlanProvider>
      <div className="relative min-h-screen">
        {/* LanguageSwitcher is now rendered globally in root layout */}
        {children}
      </div>
    </PlanProvider>
  )
}
