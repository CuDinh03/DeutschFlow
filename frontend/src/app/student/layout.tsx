'use client'

import LanguageSwitcher from '@/components/ui/LanguageSwitcher'

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen">
      <div className="fixed top-3 right-[80px] z-[60]">
        <LanguageSwitcher />
      </div>
      {children}
    </div>
  )
}
