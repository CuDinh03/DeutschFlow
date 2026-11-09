'use client'

import * as React from 'react'
import { useEffect, useId, useState } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { TkModal } from './TkModal'
import { GaBtn } from './GaBtn'

/**
 * ConfirmDialog — chuẩn bắt buộc cho MỌI thao tác xóa/hủy hoại (plan §2.11):
 * nêu rõ đối tượng + hệ quả, người dùng chọn rồi mới thực thi. Không dùng window.confirm.
 *
 * - Nút xác nhận style destructive (đỏ) khi `destructive` (mặc định true).
 * - Focus mặc định vào nút HỦY (autoFocus) — Enter vô tình không xóa nhầm; Esc đóng (Radix).
 * - `details`: các dòng hệ quả (ví dụ "sẽ gỡ N buổi tương lai") — bắt buộc nêu với xóa dây chuyền.
 *
 * Ba mức (09/11/2026, đợt 1 admin) — chọn theo độ nặng của thao tác:
 * 1. Thường: chỉ xác nhận một nút (`tone="neutral"`, hoặc `destructive={false}`).
 * 2. Bắt buộc lý do: `requireReason` — ô lý do 10–500 ký tự; lý do đi kèm `onConfirm({ reason })`
 *    để caller gửi lên backend ghi vào nhật ký.
 * 3. Phá huỷ / đặc quyền: thêm `confirmPhrase` — phải gõ đúng cụm từ (vd email người bị đổi quyền)
 *    thì nút xác nhận mới mở.
 * `tone`: neutral (nút thường) · caution (hệ quả nằm trong khung cam — đổi được nhưng tốn) ·
 * danger (nút đỏ). Không truyền `tone` thì giữ hành vi cũ: `destructive` (mặc định true) = danger.
 */
export type ConfirmTone = 'neutral' | 'caution' | 'danger'

export interface ConfirmPayload {
  /** Lý do đã cắt khoảng trắng hai đầu — chỉ có khi `requireReason`. */
  reason?: string
}
export interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: React.ReactNode
  /** Mô tả đối tượng sắp thao tác + hệ quả chính. */
  description?: React.ReactNode
  /** Danh sách hệ quả chi tiết (mỗi phần tử một dòng, ví dụ tác động dây chuyền). */
  details?: React.ReactNode[]
  /**
   * Ô nhập đi kèm quyết định (lý do bắt buộc khi thu hồi chứng nhận DEC-23, chuyển quyền giám đốc
   * A6, chọn người nhận…) — render MỘT LẦN, DƯỚI danh sách hệ quả, để người dùng đọc hệ quả trước
   * rồi mới điền. Caller tự gác `confirmDisabled` theo dữ liệu nhập; hộp thoại không biết gì về nội
   * dung bên trong. Không có thì dialog y như cũ.
   */
  children?: React.ReactNode
  confirmLabel: string
  cancelLabel: string
  /** true (mặc định): hành động hủy hoại — nút xác nhận màu đỏ. Bị `tone` ghi đè nếu có. */
  destructive?: boolean
  /** Mức cảnh báo của hộp thoại (xem đầu file). */
  tone?: ConfirmTone
  /** Bắt buộc nhập lý do trước khi xác nhận. */
  requireReason?: boolean
  /** Nhãn ô lý do; mặc định `v2.ui.confirmReasonLabel`. */
  reasonLabel?: React.ReactNode
  /** Số ký tự tối thiểu của lý do (sau khi cắt khoảng trắng). Mặc định 10. */
  minReasonLength?: number
  /** Số ký tự tối đa của lý do. Mặc định 500 (khớp backend). */
  maxReasonLength?: number
  /** Cụm từ người dùng phải gõ đúng (phân biệt hoa thường, bỏ khoảng trắng hai đầu). */
  confirmPhrase?: string
  /** Nhãn ô gõ cụm từ; mặc định `v2.ui.confirmPhraseLabel`. */
  confirmPhraseLabel?: React.ReactNode
  /** Vô hiệu nút xác nhận (ví dụ backend báo không thể áp dụng). */
  confirmDisabled?: boolean
  loading?: boolean
  onConfirm: (payload: ConfirmPayload) => void
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  details,
  confirmLabel,
  cancelLabel,
  destructive = true,
  tone,
  requireReason = false,
  reasonLabel,
  minReasonLength = 10,
  maxReasonLength = 500,
  confirmPhrase,
  confirmPhraseLabel,
  confirmDisabled = false,
  loading = false,
  onConfirm,
  children,
}: ConfirmDialogProps) {
  const t = useTranslations('v2.ui')
  const reasonId = useId()
  const phraseId = useId()
  const [reason, setReason] = useState('')
  const [phrase, setPhrase] = useState('')

  // Mỗi lần mở lại là một quyết định mới: không mang lý do / cụm từ của lần trước sang.
  useEffect(() => {
    if (open) {
      setReason('')
      setPhrase('')
    }
  }, [open])

  const effectiveTone: ConfirmTone = tone ?? (destructive ? 'danger' : 'neutral')
  const trimmedReason = reason.trim()
  const reasonOk = !requireReason || trimmedReason.length >= minReasonLength
  const phraseOk = !confirmPhrase || phrase.trim() === confirmPhrase.trim()
  const blocked = confirmDisabled || loading || !reasonOk || !phraseOk

  const inputCls =
    'ga-ui w-full rounded-ga border border-ga-line bg-ga-card px-3 py-2 text-ga-small text-ga-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus'

  return (
    <TkModal
      open={open}
      onOpenChange={(o) => {
        if (!loading) onOpenChange(o)
      }}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          {/* autoFocus vào HỦY: Enter theo phản xạ không kích hoạt hành động hủy hoại. */}
          <GaBtn variant="ghost" autoFocus disabled={loading} onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </GaBtn>
          <GaBtn
            loading={loading}
            disabled={blocked}
            data-tone={effectiveTone}
            className={
              effectiveTone === 'danger'
                ? 'border-red-700 bg-red-700 text-white hover:bg-red-800 disabled:opacity-50'
                : undefined
            }
            onClick={() => {
              if (blocked) return
              onConfirm(requireReason ? { reason: trimmedReason } : {})
            }}
          >
            {confirmLabel}
          </GaBtn>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        {details && details.length > 0 && (
          <div
            data-testid={effectiveTone === 'caution' ? 'confirm-caution' : undefined}
            className={cn(
              effectiveTone === 'caution' && 'rounded-ga border border-ga-orange bg-ga-orange-soft px-3 py-2.5',
            )}
          >
            <ul className="list-disc space-y-1 pl-5 text-[13px] leading-relaxed text-ga-muted">
              {details.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          </div>
        )}
        {children && <div className="mt-2 flex flex-col gap-3">{children}</div>}
        {requireReason && (
          <div className="mt-2 flex flex-col gap-1.5">
            <label htmlFor={reasonId} className="ga-ui text-ga-caption font-semibold text-ga-ink">
              {reasonLabel ?? t('confirmReasonLabel', { min: minReasonLength })}
            </label>
            <textarea
              id={reasonId}
              data-testid="confirm-reason"
              rows={3}
              maxLength={maxReasonLength}
              value={reason}
              disabled={loading}
              onChange={(e) => setReason(e.target.value)}
              className={inputCls}
            />
            <span className="ga-ui text-ga-caption text-ga-muted" aria-live="polite">
              {t('confirmReasonCount', { count: trimmedReason.length, min: minReasonLength, max: maxReasonLength })}
            </span>
          </div>
        )}
        {confirmPhrase && (
          <div className="mt-2 flex flex-col gap-1.5">
            <label htmlFor={phraseId} className="ga-ui text-ga-caption font-semibold text-ga-ink">
              {confirmPhraseLabel ?? t('confirmPhraseLabel', { phrase: confirmPhrase })}
            </label>
            <input
              id={phraseId}
              data-testid="confirm-phrase"
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={phrase}
              disabled={loading}
              onChange={(e) => setPhrase(e.target.value)}
              className={inputCls}
            />
          </div>
        )}
      </div>
    </TkModal>
  )
}
