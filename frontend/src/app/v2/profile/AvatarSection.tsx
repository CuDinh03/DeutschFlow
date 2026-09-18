'use client'

/* eslint-disable @next/next/no-img-element -- avatar là URL S3 ngoài, không qua next/image (giống GaMedia) */

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { uploadAvatar, removeAvatar } from '@/lib/profileApi'
import { GaBtn } from '@/components/ui-v2'
import { AvatarCropDialog } from './AvatarCropDialog'

// Cùng allowlist với backend (không SVG — nguy cơ XSS trên bucket public-read).
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']
const ACCEPT_ATTR = ACCEPTED_TYPES.join(',')
// Ảnh gốc được cắt lại trong hộp thoại trước khi upload nên nhận nguồn lớn hơn trần 5MB của
// backend một chút.
const MAX_SOURCE_BYTES = 15 * 1024 * 1024
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

export function validateAvatarFile(file: File): 'invalidType' | 'tooLarge' | null {
  if (!ACCEPTED_TYPES.includes(file.type)) return 'invalidType'
  if (file.size > MAX_SOURCE_BYTES) return 'tooLarge'
  return null
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
  /** Ảnh đang chờ người dùng chọn khung. null = hộp thoại cắt đóng. */
  const [pending, setPending] = useState<File | null>(null)

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // cho phép chọn lại đúng file vừa chọn
    if (!file) return
    const invalid = validateAvatarFile(file)
    if (invalid) {
      toast.error(t(invalid === 'invalidType' ? 'avatarInvalidType' : 'avatarTooLarge'))
      return
    }
    setPending(file)
  }

  const onCropped = async (cropped: File) => {
    if (cropped.size > MAX_UPLOAD_BYTES) {
      toast.error(t('avatarTooLarge'))
      return
    }
    setBusy(true)
    try {
      const { avatarUrl: newUrl } = await uploadAvatar(cropped)
      onChange(newUrl)
      setPending(null)
      toast.success(t('avatarSaved'))
    } catch (err: unknown) {
      // Giữ hộp thoại mở khi lỗi: người dùng thử lại được ngay mà không phải chọn lại ảnh.
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
      <AvatarCropDialog
        file={pending}
        busy={busy}
        onCancel={() => setPending(null)}
        onConfirm={onCropped}
      />
    </div>
  )
}
