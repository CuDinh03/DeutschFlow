'use client'

import * as React from 'react'
import { TkModal } from './TkModal'
import { GaBtn } from './GaBtn'

/**
 * ConfirmDialog — chuẩn bắt buộc cho MỌI thao tác xóa/hủy hoại (plan §2.11):
 * nêu rõ đối tượng + hệ quả, người dùng chọn rồi mới thực thi. Không dùng window.confirm.
 *
 * - Nút xác nhận style destructive (đỏ) khi `destructive` (mặc định true).
 * - Focus mặc định vào nút HỦY (autoFocus) — Enter vô tình không xóa nhầm; Esc đóng (Radix).
 * - `details`: các dòng hệ quả (ví dụ "sẽ gỡ N buổi tương lai") — bắt buộc nêu với xóa dây chuyền.
 */
export interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: React.ReactNode
  /** Mô tả đối tượng sắp thao tác + hệ quả chính. */
  description?: React.ReactNode
  /** Danh sách hệ quả chi tiết (mỗi phần tử một dòng, ví dụ tác động dây chuyền). */
  details?: React.ReactNode[]
  confirmLabel: string
  cancelLabel: string
  /** true (mặc định): hành động hủy hoại — nút xác nhận màu đỏ. */
  destructive?: boolean
  /** Vô hiệu nút xác nhận (ví dụ backend báo không thể áp dụng). */
  confirmDisabled?: boolean
  loading?: boolean
  onConfirm: () => void
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
  confirmDisabled = false,
  loading = false,
  onConfirm,
}: ConfirmDialogProps) {
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
            disabled={confirmDisabled || loading}
            className={
              destructive
                ? 'border-red-700 bg-red-700 text-white hover:bg-red-800 disabled:opacity-50'
                : undefined
            }
            onClick={onConfirm}
          >
            {confirmLabel}
          </GaBtn>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        {details && details.length > 0 && (
          <ul className="list-disc space-y-1 pl-5 text-[13px] leading-relaxed text-ga-muted">
            {details.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        )}
      </div>
    </TkModal>
  )
}
