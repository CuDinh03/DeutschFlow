'use client'

import { useState } from 'react'
import { Printer, Link2, Check } from 'lucide-react'

interface CertificateActionsProps {
  verifyUrl: string
}

/**
 * Print + copy-link actions for the public certificate page. Hidden when printing
 * (the certificate card itself is the print artifact).
 */
export function CertificateActions({ verifyUrl }: CertificateActionsProps) {
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
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center gap-2 rounded-xl bg-emerald-900 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-900/20 transition hover:bg-emerald-800"
      >
        <Printer size={16} /> In / Lưu PDF
      </button>
      <button
        type="button"
        onClick={copyLink}
        className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
      >
        {copied ? <Check size={16} className="text-emerald-600" /> : <Link2 size={16} />}
        {copied ? 'Đã sao chép' : 'Sao chép liên kết xác thực'}
      </button>
    </div>
  )
}
