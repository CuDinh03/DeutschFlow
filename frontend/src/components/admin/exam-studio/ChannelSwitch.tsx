'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  getChannels, getStudioChannel, setStudioChannel,
  type StudioChannel, type StudioChannelId,
} from '@/lib/adminExamStudioApi'
import { GaCap } from '@/components/ui-v2'
import { cn } from '@/lib/utils'

const ORDER: StudioChannelId[] = ['FIREWORKS', 'ROUTER']

/** Tên model rút gọn để hiện dưới nút: bỏ tiền tố nhà cung cấp ("accounts/fireworks/models/kimi-k3" → "kimi-k3"). */
export const shortModel = (m: string | null) => (m ? m.split('/').pop() ?? m : '')

/**
 * Nút chọn kênh tạo đề: Fireworks AI hay 9Router. Hai kênh tách riêng — mọi thao tác AI bấm sau đó (đọc nguồn,
 * viết bài, sinh câu hỏi, tự kiểm) chạy trên kênh đang chọn; kênh lỗi thì không tự chuyển sang kênh kia.
 * Lựa chọn nhớ theo trình duyệt. Kênh chưa cấu hình trên máy chủ thì không bấm được.
 */
export function ChannelSwitch({ disabled }: { disabled?: boolean }) {
  const t = useTranslations('v2.adminContent.examStudio')
  const [channels, setChannels] = useState<StudioChannel[] | null>(null)
  const [value, setValue] = useState<StudioChannelId>(getStudioChannel())

  useEffect(() => {
    let alive = true
    getChannels()
      .then((list) => {
        if (!alive) return
        setChannels(list)
        // Kênh đã nhớ không còn dùng được (máy chủ gỡ cấu hình) ⇒ về Fireworks.
        const saved = getStudioChannel()
        if (!list.some((c) => c.id === saved && c.configured)) {
          setStudioChannel('FIREWORKS')
          setValue('FIREWORKS')
        }
      })
      .catch(() => { if (alive) setChannels([]) })
    return () => { alive = false }
  }, [])

  if (!channels || channels.length === 0) return null
  const byId = new Map(channels.map((c) => [c.id, c]))
  const active = byId.get(value)

  const pick = (id: StudioChannelId) => {
    setStudioChannel(id)
    setValue(id)
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <GaCap id="studio-channel-label">{t('channel.label')}</GaCap>
      <div role="radiogroup" aria-labelledby="studio-channel-label"
        className="inline-flex overflow-hidden rounded-ga border border-ga-line bg-ga-card [&>button+button]:border-l [&>button+button]:border-ga-line">
        {ORDER.map((id) => {
          const c = byId.get(id)
          const off = disabled || !c?.configured
          const on = id === value
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={off}
              title={c?.configured ? undefined : t('channel.notConfigured')}
              onClick={() => pick(id)}
              className={cn(
                'ga-ui min-h-11 px-3.5 py-2 text-[12.5px] font-semibold transition-colors lg:min-h-0',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ga-focus',
                'disabled:cursor-not-allowed disabled:opacity-50',
                on ? 'bg-ga-accent text-ga-accent-ink' : 'text-ga-muted hover:text-ga-ink',
              )}
            >
              {t(`channel.${id}`)}
            </button>
          )
        })}
      </div>
      <span className="ga-ui text-ga-caption text-ga-muted">
        {active?.configured
          ? t('channel.models', { writer: shortModel(active.writerModel), judge: shortModel(active.judgeModel) })
          : t('channel.notConfigured')}
      </span>
      {!byId.get('ROUTER')?.configured && (
        <span className="ga-ui basis-full text-ga-caption text-ga-muted">{t('channel.routerHint')}</span>
      )}
    </div>
  )
}
