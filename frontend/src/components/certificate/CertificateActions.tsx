'use client'

import { useState } from 'react'
import { Printer, Link2, Check } from 'lucide-react'
import { GaBtn } from '@/components/ui-v2/GaBtn'

interface CertificateActionsProps {
  verifyUrl: string
  printLabel: string
  copyLabel: string
  copiedLabel: string
}

/**
 * Print + copy-link actions for the public certificate page. Hidden when printing
 * (the certificate card itself is the print artifact). Nhãn đến từ trang vì ngôn ngữ nằm ở `?lang`.
 * Galerie (icon đợt B, 09/11/2026): `GaBtn`, chỉ đặt trong trang có `.ga-scope`.
 */
export function CertificateActions({ verifyUrl, printLabel, copyLabel, copiedLabel }: CertificateActionsProps) {
  const [copied, setCopied] = useState(false)

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(verifyUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard unavailable (e.g. insecure context) — no-op; the URL is visible on the page.
    }
  }

  return (
    <div className="mt-6 flex flex-wrap justify-center gap-3 print:hidden">
      <GaBtn type="button" variant="ink" size="lg" onClick={() => window.print()}>
        <Printer size={16} aria-hidden /> {printLabel}
      </GaBtn>
      <GaBtn type="button" variant="ghost" size="lg" onClick={copyLink} aria-live="polite">
        {copied ? <Check size={16} aria-hidden /> : <Link2 size={16} aria-hidden />}
        {copied ? copiedLabel : copyLabel}
      </GaBtn>
    </div>
  )
}
