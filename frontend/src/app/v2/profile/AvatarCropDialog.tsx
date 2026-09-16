'use client'

/* eslint-disable @next/next/no-img-element -- ảnh xem trước đến từ blob: URL cục bộ, next/image không xử lý được */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { TkModal, GaBtn } from '@/components/ui-v2'
import {
  MAX_ZOOM,
  MIN_ZOOM,
  centeredOffset,
  clampOffset,
  outputEdgeOf,
  scaleOf,
  sourceRectOf,
  zoomAroundCenter,
  type CropState,
} from '@/lib/avatarCrop'

/** Cạnh khung xem, px. Cố định để phép toán không phụ thuộc kích thước màn hình. */
const VIEWPORT = 288
const ZOOM_STEP = 0.25

interface AvatarCropDialogProps {
  /** Ảnh người dùng vừa chọn. null = hộp thoại đóng. */
  file: File | null
  onCancel: () => void
  /** Ảnh vuông đã cắt, sẵn sàng tải lên. */
  onConfirm: (cropped: File) => void
  busy?: boolean
}

/**
 * Người dùng tự chọn khung ảnh đại diện: kéo để dời, thanh trượt để phóng.
 *
 * <p>Trước đợt này ảnh bị cắt vuông tự động ở CHÍNH GIỮA — ảnh chụp dọc thì phần bị giữ lại thường
 * là cổ và vai, còn mặt nằm ở nửa trên bị cắt mất. Khung tự chọn giải quyết đúng chỗ đó.
 *
 * <p>🪤 Ảnh không đọc được (định dạng lạ, tệp hỏng) thì hộp thoại KHÔNG chặn đường đi: caller vẫn
 * tải tệp gốc lên và backend tự kiểm loại/kích thước — xem {@code AvatarSection}.
 */
export function AvatarCropDialog({ file, onCancel, onConfirm, busy = false }: AvatarCropDialogProps) {
  const t = useTranslations('v2.account.profile')
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [state, setState] = useState<CropState | null>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(null)

  // URL tạm sống đúng bằng vòng đời của file đang chọn — revoke ở cleanup, nếu không mỗi lần chọn
  // ảnh lại rò một blob cho tới khi tải lại trang.
  useEffect(() => {
    if (!file) {
      setObjectUrl(null)
      setState(null)
      return
    }
    // Môi trường không có Blob URL (jsdom, một số WebView bị khoá) vẫn phải đi tiếp được: không
    // dựng nổi khung xem thì hộp thoại chuyển sang "gửi thẳng tệp gốc" chứ không kẹt cứng.
    if (typeof URL.createObjectURL !== 'function') {
      setObjectUrl(null)
      setState(null)
      return
    }
    const url = URL.createObjectURL(file)
    setObjectUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const onImageLoad = useCallback(() => {
    const img = imgRef.current
    if (!img) return
    const base = {
      viewport: VIEWPORT,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      zoom: MIN_ZOOM,
    }
    setState({ ...base, ...centeredOffset(base) })
  }, [])

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!state) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: state.offsetX,
      originY: state.offsetY,
    }
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    setState((prev) => {
      if (!prev) return prev
      const moved = {
        ...prev,
        offsetX: drag.originX + (e.clientX - drag.startX),
        offsetY: drag.originY + (e.clientY - drag.startY),
      }
      return { ...moved, ...clampOffset(moved) }
    })
  }

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === e.pointerId) dragRef.current = null
  }

  const nudge = (dx: number, dy: number) =>
    setState((prev) => {
      if (!prev) return prev
      const moved = { ...prev, offsetX: prev.offsetX + dx, offsetY: prev.offsetY + dy }
      return { ...moved, ...clampOffset(moved) }
    })

  // Bàn phím: mũi tên dời khung, +/- phóng. Kéo bằng chuột là đường duy nhất thì người dùng bàn
  // phím và người dùng trình đọc màn hình không cắt được ảnh (WCAG 2.1.1).
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 20 : 5
    const zoomKey: Record<string, number> = { '+': ZOOM_STEP, '=': ZOOM_STEP, '-': -ZOOM_STEP, _: -ZOOM_STEP }
    if (e.key in zoomKey) {
      e.preventDefault()
      setState((prev) => (prev ? zoomAroundCenter(prev, prev.zoom + zoomKey[e.key]) : prev))
      return
    }
    const pan: Record<string, [number, number]> = {
      ArrowLeft: [step, 0],
      ArrowRight: [-step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    }
    if (e.key in pan) {
      e.preventDefault()
      nudge(pan[e.key][0], pan[e.key][1])
    }
  }

  const confirm = async () => {
    if (!file) return
    const img = imgRef.current
    // Không dựng được khung xem ⇒ không có gì để cắt: gửi tệp gốc, backend vẫn kiểm loại/kích thước.
    if (!img || !state) {
      onConfirm(file)
      return
    }
    const cropped = await renderCrop(img, state, file.name)
    onConfirm(cropped ?? file)
  }

  const scale = state ? scaleOf(state) : 1

  return (
    <TkModal
      open={file !== null}
      onOpenChange={(open) => {
        if (!open && !busy) onCancel()
      }}
      title={t('cropTitle')}
      description={t('cropHint')}
      size="sm"
      footer={
        <>
          <GaBtn variant="ghost" disabled={busy} onClick={onCancel}>
            {t('cropCancel')}
          </GaBtn>
          <GaBtn variant="primary" loading={busy} disabled={busy} onClick={confirm}>
            {busy ? t('uploadingAvatar') : t('cropConfirm')}
          </GaBtn>
        </>
      }
    >
      <div className="flex flex-col items-center gap-4">
        <div
          role="application"
          tabIndex={0}
          aria-label={t('cropAriaLabel')}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onKeyDown={onKeyDown}
          className="relative shrink-0 cursor-grab touch-none overflow-hidden rounded-full border border-ga-line bg-ga-sunken outline-none focus-visible:ring-2 focus-visible:ring-ga-accent active:cursor-grabbing"
          style={{ width: VIEWPORT, height: VIEWPORT }}
        >
          {objectUrl && (
            <img
              ref={imgRef}
              src={objectUrl}
              alt=""
              onLoad={onImageLoad}
              // Trình duyệt không decode được ảnh (định dạng lạ, tệp hỏng): đi thẳng tệp gốc lên
              // thay vì nhốt người dùng trong một hộp thoại có nút xác nhận mãi mãi bị vô hiệu —
              // backend vẫn tự kiểm loại và kích thước.
              onError={() => file && onConfirm(file)}
              draggable={false}
              className="max-w-none select-none"
              style={
                state
                  ? {
                      width: state.naturalWidth * scale,
                      height: state.naturalHeight * scale,
                      transform: `translate(${state.offsetX}px, ${state.offsetY}px)`,
                    }
                  : { visibility: 'hidden' }
              }
            />
          )}
        </div>

        <label className="flex w-full max-w-[288px] items-center gap-3">
          <span className="ga-ui text-[12px] font-semibold uppercase tracking-[0.06em] text-ga-muted">
            {t('cropZoom')}
          </span>
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.01}
            value={state?.zoom ?? MIN_ZOOM}
            disabled={!state}
            onChange={(e) =>
              setState((prev) => (prev ? zoomAroundCenter(prev, Number(e.target.value)) : prev))
            }
            className="h-1 flex-1 accent-ga-accent"
          />
        </label>
      </div>
    </TkModal>
  )
}

/**
 * Vẽ vùng đã chọn ra canvas vuông và đóng gói thành File.
 *
 * <p>Trả null khi trình duyệt không vẽ được (canvas bị chặn, ảnh không decode) — caller tải tệp
 * gốc lên thay vì hỏng cả thao tác.
 */
async function renderCrop(
  img: HTMLImageElement,
  state: CropState,
  originalName: string
): Promise<File | null> {
  try {
    const { sx, sy, size } = sourceRectOf(state)
    const edge = outputEdgeOf(size)
    const canvas = document.createElement('canvas')
    canvas.width = edge
    canvas.height = edge
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(img, sx, sy, size, size, 0, 0, edge, edge)
    // toBlob('image/webp') không hỗ trợ → trình duyệt trả PNG; cả hai đều nằm trong allowlist backend.
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.85))
    if (!blob) return null
    const ext = blob.type.split('/')[1] || 'webp'
    return new File([blob], `avatar-${originalName.replace(/\.[^.]+$/, '')}.${ext}`, { type: blob.type })
  } catch {
    return null
  }
}
