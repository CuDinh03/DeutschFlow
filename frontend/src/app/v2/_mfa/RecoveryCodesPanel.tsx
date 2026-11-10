'use client'

import { useId, useState } from 'react'
import { Copy, Download } from 'lucide-react'
import { GaBtn } from '@/components/ui-v2'
import { recoveryCodesFile } from '@/lib/mfaApi'

export interface RecoveryCodesLabels {
  title: string
  description: string
  copyAll: string
  copied: string
  download: string
  saved: string
  continueLabel: string
  /** Dòng đầu của tệp .txt. */
  fileHeader: string
}

/**
 * Mười mã khôi phục 2FA — hiện ĐÚNG MỘT lần (sau khi bật 2FA, hoặc sau khi tạo bộ mã mới). Người dùng phải
 * tick "đã lưu" mới đi tiếp được: mất mã ở bước này là mất đường vào khi mất điện thoại.
 *
 * Không tự gọi i18n: dùng chung ở trang đăng nhập (vùng `auth`) và trang Hồ sơ (vùng `account`) — mỗi nơi
 * có provider riêng, nên nhãn đi qua props.
 */
export function RecoveryCodesPanel({
  codes,
  labels,
  onContinue,
  loading = false,
}: {
  codes: string[]
  labels: RecoveryCodesLabels
  onContinue: () => void
  loading?: boolean
}) {
  const checkboxId = useId()
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  const text = recoveryCodesFile(labels.fileHeader, codes)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  const download = () => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'mydeutschflow-recovery-codes.txt'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div data-testid="recovery-codes-panel">
      <h2 className="ga-ui m-0 mb-2 text-ga-body font-semibold text-ga-ink">{labels.title}</h2>
      <p className="ga-ui m-0 mb-4 text-ga-small text-ga-muted">{labels.description}</p>
      <ol
        className="m-0 mb-4 grid list-none grid-cols-2 gap-2 rounded-ga border border-ga-line bg-ga-surface p-4"
        aria-label={labels.title}
      >
        {codes.map((c) => (
          <li key={c} data-testid="recovery-code" className="font-mono text-ga-body tracking-wider text-ga-ink">
            {c}
          </li>
        ))}
      </ol>
      <div className="mb-5 flex flex-wrap gap-2">
        <GaBtn type="button" variant="ghost" size="sm" onClick={() => void copy()}>
          <Copy size={14} aria-hidden /> {copied ? labels.copied : labels.copyAll}
        </GaBtn>
        <GaBtn type="button" variant="ghost" size="sm" onClick={download}>
          <Download size={14} aria-hidden /> {labels.download}
        </GaBtn>
      </div>
      <label htmlFor={checkboxId} className="ga-ui mb-5 flex cursor-pointer items-start gap-2.5 text-ga-small text-ga-ink">
        <input
          id={checkboxId}
          type="checkbox"
          checked={saved}
          onChange={(e) => setSaved(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-ga-ink"
        />
        <span>{labels.saved}</span>
      </label>
      <GaBtn
        type="button"
        variant="yellow"
        size="lg"
        className="w-full"
        disabled={!saved || loading}
        loading={loading}
        onClick={onContinue}
      >
        {labels.continueLabel}
      </GaBtn>
    </div>
  )
}
