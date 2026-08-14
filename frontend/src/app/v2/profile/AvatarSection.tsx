'use client'

/* eslint-disable @next/next/no-img-element -- avatar là URL S3 ngoài, không qua next/image (giống GaMedia) */

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { uploadAvatar, removeAvatar } from '@/lib/profileApi'
import { GaBtn } from '@/components/ui-v2'

// Cùng allowlist với backend (không SVG — nguy cơ XSS trên bucket public-read).
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']
const ACCEPT_ATTR = ACCEPTED_TYPES.join(',')
// Ảnh gốc được thu nhỏ trước khi upload nên nhận nguồn lớn hơn trần 5MB của backend một chút.
const MAX_SOURCE_BYTES = 15 * 1024 * 1024
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024
const AVATAR_EDGE_PX = 512

export function validateAvatarFile(file: File): 'invalidType' | 'tooLarge' | null {
  if (!ACCEPTED_TYPES.includes(file.type)) return 'invalidType'
  if (file.size > MAX_SOURCE_BYTES) return 'tooLarge'
  return null
}

/**
 * Cắt vuông ở giữa + thu về ≤512px trước khi upload — ảnh máy ảnh vài MB chỉ để render 36–72px
 * là lãng phí băng thông và S3. Mọi lỗi (trình duyệt cũ, ảnh hỏng…) đều rơi về file gốc:
 * backend vẫn tự validate loại/kích thước nên đường fallback an toàn.
 */
async function downscaleToSquare(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const side = Math.min(bitmap.width, bitmap.height)
    const target = Math.min(AVATAR_EDGE_PX, side)
    const sx = (bitmap.width - side) / 2
    const sy = (bitmap.height - side) / 2
    const canvas = document.createElement('canvas')
    canvas.width = target
    canvas.height = target
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, target, target)
    bitmap.close()
    // toBlob('image/webp') không hỗ trợ → trình duyệt trả PNG; cả hai đều nằm trong allowlist backend.
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.85))
    if (!blob) return file
    const ext = blob.type.split('/')[1] || 'webp'
    return new File([blob], `avatar.${ext}`, { type: blob.type })
  } catch {
    return file
  }
}

function initialsOf(name: string | null | undefined): string {
  if (!name) return 'U'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

interface AvatarSectionProps {
  displayName: string
  avatarUrl: string | null
  /** null = đã gỡ ảnh. Caller đồng bộ store để sidebar đổi ngay. */
  onChange: (url: string | null) => void
}

export function AvatarSection({ displayName, avatarUrl, onChange }: AvatarSectionProps) {
  const t = useTranslations('v2.account.profile')
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // cho phép chọn lại đúng file vừa chọn
    if (!file) return
    const invalid = validateAvatarFile(file)
    if (invalid) {
      toast.error(t(invalid === 'invalidType' ? 'avatarInvalidType' : 'avatarTooLarge'))
      return
    }
    setBusy(true)
    try {
      const prepared = await downscaleToSquare(file)
      if (prepared.size > MAX_UPLOAD_BYTES) {
        toast.error(t('avatarTooLarge'))
        return
      }
      const { avatarUrl: newUrl } = await uploadAvatar(prepared)
      onChange(newUrl)
      toast.success(t('avatarSaved'))
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('avatarError'))
    } finally {
      setBusy(false)
    }
  }

  const onRemove = async () => {
    setBusy(true)
    try {
      await removeAvatar()
      onChange(null)
      toast.success(t('avatarRemoved'))
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('avatarError'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <span className="ga-ui mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.06em] text-ga-muted">
        {t('fieldAvatar')}
      </span>
      <div className="flex items-center gap-4">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={t('fieldAvatar')}
            className="h-[72px] w-[72px] shrink-0 rounded-full border border-ga-line object-cover"
          />
        ) : (
          <span
            aria-hidden
            className="grid h-[72px] w-[72px] shrink-0 place-items-center rounded-full bg-ga-accent text-[22px] font-semibold text-ga-accent-ink"
          >
            {initialsOf(displayName)}
          </span>
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <GaBtn variant="ghost" onClick={() => inputRef.current?.click()} disabled={busy}>
              {busy ? t('uploadingAvatar') : t('uploadAvatar')}
            </GaBtn>
            {avatarUrl && (
              <button
                type="button"
                onClick={onRemove}
                disabled={busy}
                className="ga-ui rounded-ga px-2 py-1.5 text-[13px] font-medium text-ga-muted transition-colors hover:text-ga-red disabled:opacity-50"
              >
                {t('removeAvatar')}
              </button>
            )}
          </div>
          <p className="ga-ui mt-1.5 text-[12px] text-ga-subtle">{t('avatarHint')}</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_ATTR}
          onChange={onPick}
          className="hidden"
          aria-label={t('uploadAvatar')}
        />
      </div>
    </div>
  )
}
