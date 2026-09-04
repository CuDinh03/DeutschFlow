'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import api, { apiMessage } from '@/lib/api'
import useAdminData from '@/hooks/useAdminData'
import { GaPageHdr, GaBtn, GaCap } from '@/components/ui-v2'

interface AiConfig {
  prompt: string
  temperature: number
  maxTokens: number
  topP: number
  // Read-only runtime wiring surfaced by GET /admin/ai-config (env-driven; may be absent on older BE).
  chatProvider?: string
  chatModel?: string
  gradingModel?: string
  sttModel?: string
}

const DEFAULT_CONFIG: AiConfig = { prompt: '', temperature: 0.7, maxTokens: 1024, topP: 0.9 }

/**
 * Kẹp vào [min,max]. CHỈ gọi lúc blur — kẹp trong lúc gõ sẽ chặn các chữ số trung gian
 * (gõ "6" trên đường tới "600" bị nhảy thành 64 vì 6 < min).
 */
const clampTo = (v: number, min: number, max: number): number =>
  Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : min

export default function V2AdminAiConfigPage() {
  const t = useTranslations('v2.adminContent.aiConfig')
  const tc = useTranslations('v2.common')
  const { data, loading, error, lastSyncedAt, reload } = useAdminData<AiConfig>({
    initialData: DEFAULT_CONFIG,
    errorMessage: t('loadDataError'),
    fetchData: async () => {
      const res = await api.get('/admin/ai-config')
      return (res.data ?? DEFAULT_CONFIG) as AiConfig
    },
  })

  const [prompt, setPrompt] = useState('')
  const [temperature, setTemperature] = useState(0.7)
  const [maxTokens, setMaxTokens] = useState(1024)
  const [topP, setTopP] = useState(0.9)
  const [saving, setSaving] = useState(false)

  /**
   * Audit F-M7 (03/09/2026): TRƯỚC ĐÂY điều kiện ở đây chỉ là `if (loading) return`, và trang không
   * hề đọc `error` của useAdminData. Khi GET /admin/ai-config lỗi, hook giữ nguyên `initialData` =
   * DEFAULT_CONFIG (prompt rỗng), loading về false, nên editable state bị nạp prompt RỖNG mà màn
   * hình không báo gì. Bấm Lưu một cái là system prompt production bị ghi đè bằng chuỗi rỗng.
   *
   * `lastSyncedAt` chỉ khác null sau một lượt tải THÀNH CÔNG, nên đây là tín hiệu đúng để đồng bộ
   * — không phải `!loading` (lần tải hỏng cũng thoả).
   */
  /** Đã có ít nhất một lượt tải thành công. Chưa `loaded` thì KHÔNG cho lưu và không cho sửa
   *  textarea: nội dung trên form lúc đó là default rỗng, lưu là xoá trắng prompt production. */
  const loaded = lastSyncedAt !== null
  useEffect(() => {
    if (!loaded) return
    setPrompt(data.prompt ?? '')
    setTemperature(data.temperature ?? 0.7)
    setMaxTokens(data.maxTokens ?? 1024)
    setTopP(data.topP ?? 0.9)
  }, [loaded, data])

  const save = async () => {
    setSaving(true)
    try {
      await api.put('/admin/ai-config', { prompt, temperature, maxTokens, topP })
      toast.success(t('saved'))
      await reload({ silent: true })
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const sliders: { label: string; val: number; set: (v: number) => void; min: number; max: number; step: number }[] = [
    { label: t('sliderTemperature'), val: temperature, set: setTemperature, min: 0, max: 1, step: 0.05 },
    { label: t('sliderTopP'), val: topP, set: setTopP, min: 0, max: 1, step: 0.05 },
    // Biên khớp hợp đồng backend (AdminAiConfigController: MIN/MAX_MAX_TOKENS = 64/8192) và
    // step=1 để MỌI giá trị đang lưu đều nằm trên lưới. Bản cũ `256–4096 step 256` vừa hẹp hơn
    // backend, vừa không biểu diễn được giá trị prod 2000: thumb snap về 2048 trong khi nhãn vẫn
    // ghi 2000, và chỉ cần kéo một cái là 2000 mất vĩnh viễn — không có đường quay lại qua UI.
    { label: t('sliderMaxTokens'), val: maxTokens, set: setMaxTokens, min: 64, max: 8192, step: 1 },
  ]

  // "Model đang dùng" — đọc từ cấu hình runtime thật (env: app.ai.*) thay vì hardcode Claude/Bedrock.
  // Ảnh giữ nhãn tĩnh vì thực sự dùng AWS Bedrock. [labelKey, giá trị kỹ thuật].
  const models: [string, string][] = [
    ['modelProvider', data.chatProvider ?? '—'],
    ['modelSpeaking', data.chatModel ?? '—'],
    ['modelGrading', data.gradingModel ?? '—'],
    ['modelStt', data.sttModel ?? '—'],
    ['modelImage', 'AWS Bedrock'],
  ]

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        title={t('title')}
        subtitle={t('subtitle')}
        right={
          <GaBtn variant="yellow" disabled={saving || loading || !loaded} onClick={save}>
            <span aria-hidden className="inline-block h-[7px] w-[7px] bg-ga-ink" />
            {saving ? t('saving') : t('saveConfig')}
          </GaBtn>
        }
      />

      {error && (
        <div
          role="alert"
          className="mx-4 mt-4 border border-ga-line bg-ga-card px-4 py-4 sm:mx-6 lg:mx-9"
        >
          <h2 className="font-ga-display text-[16px] font-medium leading-[1.2] text-ga-red lg:text-[18px]">
            {t('loadDataError')}
          </h2>
          <p className="ga-ui mb-3 mt-2 break-words text-[14px] text-ga-muted">
            {error} <code className="break-words font-mono text-[12px] text-ga-accent">GET /api/admin/ai-config</code>
          </p>
          <GaBtn variant="primary" onClick={() => reload({ silent: false })}>
            {tc('retry')}
          </GaBtn>
        </div>
      )}

      <div className="grid flex-1 lg:overflow-hidden lg:grid-cols-[1fr_320px]">
        {/* Left — system prompt */}
        <div className="border-b border-ga-line px-4 py-5 sm:px-6 lg:overflow-auto lg:border-b-0 lg:border-r lg:px-9 lg:py-[26px]">
          <GaCap className="mb-2.5 block">{t('promptCap')}</GaCap>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={9}
            disabled={loading || !loaded}
            className="block w-full resize-y rounded-ga border border-ga-line bg-ga-bg px-[18px] py-4 font-mono text-[14.5px] leading-[1.7] text-ga-ink outline-none"
          />
          <div
            className="mt-3.5 px-4 py-3.5 lg:px-[18px]"
            style={{ background: 'var(--ga-navy-soft)', border: '1px solid rgba(39,64,107,0.20)' }}
          >
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.06em]" style={{ color: 'var(--ga-navy)' }}>
              {t('noteLabel')}
            </div>
            <p className="text-[13.5px] leading-[1.6] text-ga-ink">
              {t('noteBody')}
            </p>
          </div>
        </div>

        {/* Right — model params */}
        <div className="bg-ga-card px-4 py-5 lg:overflow-auto lg:px-6 lg:py-[26px]">
          <GaCap className="mb-[18px] block">{t('paramsCap')}</GaCap>
          {sliders.map((s) => (
            <div key={s.label} className="mb-[22px]">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="min-w-0 text-[13px] font-semibold text-ga-ink">{s.label}</span>
                {/* Nhập được, không chỉ hiển thị: slider một mình không thể trả về đúng một giá trị
                    cụ thể (vd 2000) khi đã lỡ kéo. Kẹp ở blur chứ không ở change — xem clampTo. */}
                <input
                  type="number"
                  min={s.min}
                  max={s.max}
                  step={s.step}
                  value={s.val}
                  disabled={loading}
                  aria-label={s.label}
                  title={`${s.min} – ${s.max}`}
                  onChange={(e) => {
                    if (e.target.value === '') return
                    const n = Number(e.target.value)
                    if (Number.isFinite(n)) s.set(n)
                  }}
                  onBlur={(e) => s.set(clampTo(Number(e.target.value), s.min, s.max))}
                  className="w-[88px] shrink-0 rounded-ga border border-ga-line bg-ga-bg px-2 py-1 text-right font-ga-display text-[18px] font-medium text-ga-ink outline-none"
                />
              </div>
              <input
                type="range"
                min={s.min}
                max={s.max}
                step={s.step}
                value={s.val}
                disabled={loading}
                onChange={(e) => s.set(Number(e.target.value))}
                className="w-full"
                style={{ accentColor: 'var(--ga-navy)' }}
              />
            </div>
          ))}

          <div className="mt-2 border-t border-ga-line pt-[18px]">
            <GaCap className="mb-3 block">{t('modelsInUse')}</GaCap>
            {models.map(([k, v], i) => (
              <div
                key={k}
                className={`flex items-center justify-between gap-3 py-2 text-[13px] ${i ? 'border-t border-ga-line' : ''}`}
              >
                <span className="min-w-0 text-ga-muted">{t(k)}</span>
                <span className="shrink-0 font-medium text-ga-ink">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
