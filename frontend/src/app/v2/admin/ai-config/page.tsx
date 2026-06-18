'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import api, { apiMessage } from '@/lib/api'
import useAdminData from '@/hooks/useAdminData'
import { GaPageHdr, GaBtn, GaCap } from '@/components/ui-v2'

interface AiConfig {
  prompt: string
  temperature: number
  maxTokens: number
  topP: number
}

const DEFAULT_CONFIG: AiConfig = { prompt: '', temperature: 0.7, maxTokens: 1024, topP: 0.9 }

// Static reference (proto GaAdminAIConfig "Mô hình đang dùng" — informational).
const MODELS: [string, string][] = [
  ['Speaking', 'Claude · Sonnet'],
  ['Grammar AI', 'Claude · Haiku'],
  ['Sinh ảnh', 'AWS Bedrock'],
  ['Lồng tiếng', 'Edge TTS (DE)'],
]

export default function V2AdminAiConfigPage() {
  const { data, loading, reload } = useAdminData<AiConfig>({
    initialData: DEFAULT_CONFIG,
    errorMessage: 'Không thể tải cấu hình AI.',
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

  // Sync editable state once the config loads.
  useEffect(() => {
    if (loading) return
    setPrompt(data.prompt ?? '')
    setTemperature(data.temperature ?? 0.7)
    setMaxTokens(data.maxTokens ?? 1024)
    setTopP(data.topP ?? 0.9)
  }, [loading, data])

  const save = async () => {
    setSaving(true)
    try {
      await api.put('/admin/ai-config', { prompt, temperature, maxTokens, topP })
      toast.success('Đã lưu cấu hình AI')
      await reload({ silent: true })
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const sliders: { label: string; val: number; set: (v: number) => void; min: number; max: number; step: number }[] = [
    { label: 'Temperature', val: temperature, set: setTemperature, min: 0, max: 1, step: 0.05 },
    { label: 'Top-P', val: topP, set: setTopP, min: 0, max: 1, step: 0.05 },
    { label: 'Max tokens', val: maxTokens, set: setMaxTokens, min: 256, max: 4096, step: 256 },
  ]

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        title="Cấu hình AI"
        subtitle="System prompt, nhiệt độ và giới hạn token cho mô hình"
        right={
          <GaBtn variant="yellow" disabled={saving || loading} onClick={save}>
            <span aria-hidden className="inline-block h-[7px] w-[7px] bg-ga-ink" />
            {saving ? 'Đang lưu…' : 'Lưu cấu hình'}
          </GaBtn>
        }
      />

      <div className="grid flex-1 overflow-hidden lg:grid-cols-[1fr_320px]">
        {/* Left — system prompt */}
        <div className="overflow-auto border-r border-ga-line px-9 py-[26px]">
          <GaCap className="mb-2.5 block">System prompt · AI HR Speaking</GaCap>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={9}
            disabled={loading}
            className="block w-full resize-y rounded-ga border border-ga-line bg-ga-bg px-[18px] py-4 font-mono text-[14.5px] leading-[1.7] text-ga-ink outline-none"
          />
          <div
            className="mt-3.5 px-[18px] py-3.5"
            style={{ background: 'var(--ga-navy-soft)', border: '1px solid rgba(39,64,107,0.20)' }}
          >
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.06em]" style={{ color: 'var(--ga-navy)' }}>
              Lưu ý
            </div>
            <p className="text-[13.5px] leading-[1.6] text-ga-ink">
              Thay đổi prompt ảnh hưởng tới toàn bộ buổi phỏng vấn AI. Phiên bản cũ được lưu lại để có thể khôi phục.
            </p>
          </div>
        </div>

        {/* Right — model params */}
        <div className="overflow-auto bg-ga-card px-6 py-[26px]">
          <GaCap className="mb-[18px] block">Tham số mô hình</GaCap>
          {sliders.map((s) => (
            <div key={s.label} className="mb-[22px]">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[13px] font-semibold text-ga-ink">{s.label}</span>
                <span className="font-ga-display text-[18px] font-medium text-ga-ink">{s.val}</span>
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
            <GaCap className="mb-3 block">Mô hình đang dùng</GaCap>
            {MODELS.map(([k, v], i) => (
              <div
                key={k}
                className={`flex items-center justify-between py-2 text-[13px] ${i ? 'border-t border-ga-line' : ''}`}
              >
                <span className="text-ga-muted">{k}</span>
                <span className="font-medium text-ga-ink">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
