'use client'

import LanguageSwitcher from '@/components/ui/LanguageSwitcher'

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen">
      <div className="fixed bottom-20 right-4 z-[60] lg:bottom-6 lg:right-6">
        <LanguageSwitcher />
      </div>
      {children}
    </div>
  )
}
