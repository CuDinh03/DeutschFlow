'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Brain, Check, CircuitBoard, Copy, FileText, Save, Sliders, Sparkles, ToggleLeft, ToggleRight } from 'lucide-react'
import AdminShell from '@/components/admin/AdminShell'
import useAdminData from '@/hooks/useAdminData'
import { ADMIN_AI_SYSTEM_PROMPT_DEFAULT } from '@/lib/adminAiDefaults'

type VoidOk = { _: true }

export default function AdminAiConfigPage() {
  const t = useTranslations('adminAi')
  const [activeModel, setActiveModel] = useState<'llama4' | 'llama33'>('llama4')
  const [hybridMode, setHybridMode] = useState(true)
  const [prompt, setPrompt] = useState(ADMIN_AI_SYSTEM_PROMPT_DEFAULT)
  const [temperature, setTemperature] = useState(0.7)
  const [maxTokens, setMaxTokens] = useState(1024)
  const [topP, setTopP] = useState(0.9)
  const [savedFlash, setSavedFlash] = useState(false)

  const { loading, error, refreshing, lastSyncedAt, reload } = useAdminData<VoidOk>({
    initialData: { _: true },
    errorMessage: t('error'),
    fetchData: async () => ({ _: true }),
    intervalMs: 600_000,
  })

  const handleSave = () => {
    setSavedFlash(true)
    window.setTimeout(() => setSavedFlash(false), 2200)
  }

  const models = [
    { id: 'llama4' as const, name: 'Llama-4 Maverick', params: '17B aktive Parameter', speed: t('m4Speed'), quality: t('m4Quality'), cost: '$0.12/1M', badge: t('badgeRec'), badgeColor: '#10b981' },
    { id: 'llama33' as const, name: 'Llama-3.3-70B', params: '70B Parameter', speed: t('m33Speed'), quality: t('m33Quality'), cost: '$0.80/1M', badge: t('badgePrec'), badgeColor: '#0ea5e9' },
  ]

  const estimatedCostPerConvo =
    activeModel === 'llama4' ? ((maxTokens * 0.12) / 1_000_000).toFixed(5) : ((maxTokens * 0.8) / 1_000_000).toFixed(5)

  if (loading) {
    return (
      <AdminShell title={t('title')} subtitle={t('subtitle')} activeNav="aiConfig" onRefresh={() => reload({ silent: true })}>
        <p className="text-[#94A3B8] text-sm">{t('loading')}</p>
      </AdminShell>
    )
  }

  return (
    <AdminShell
      title={t('title')}
      subtitle={t('subtitle')}
      activeNav="aiConfig"
      error={error}
      refreshing={refreshing}
      onRefresh={() => reload({ silent: true })}
      lastSyncedAt={lastSyncedAt}
    >
      <p className="text-xs text-blue-900 bg-blue-50 border border-blue-200 rounded-[10px] px-3 py-2">{t('disclaimer')}</p>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5 mt-3">
        <div className="xl:col-span-3 space-y-5">
          <div className="rounded-[14px] border border-[#E2E8F0] bg-white p-5">
            <div className="flex items-center gap-2 mb-4">
              <CircuitBoard size={18} className="text-violet-600" />
              <h3 className="font-bold text-[#0F172A]">{t('modelPick')}</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {models.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setActiveModel(m.id)}
                  className={`rounded-[12px] p-4 text-left border-2 transition-all ${
                    activeModel === m.id ? '' : 'border-[#E2E8F0] bg-white hover:bg-[#FAFBFC]'
                  }`}
                  style={
                    activeModel === m.id
                      ? { borderColor: m.badgeColor, backgroundColor: `${m.badgeColor}10` }
                      : {}
                  }
                >
                  <div className="flex justify-between mb-2">
                    <Brain size={20} style={{ color: m.badgeColor }} />
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${m.badgeColor}22`, color: m.badgeColor }}>
                      {m.badge}
                    </span>
                  </div>
                  <p className="font-bold text-sm text-[#0F172A]">{m.name}</p>
                  <p className="text-[10px] text-[#64748B] mb-2">{m.params}</p>
                  <div className="grid grid-cols-2 gap-1 text-[10px] text-[#64748B]">
                    <span>
                      {t('speed')}: <strong className="text-[#0F172A]">{m.speed}</strong>
                    </span>
                    <span>
                      {t('quality')}: <strong className="text-[#0F172A]">{m.quality}</strong>
                    </span>
                    <span className="col-span-2">
                      {t('cost')}: <strong style={{ color: m.badgeColor }}>{m.cost}</strong>
                    </span>
                  </div>
                </button>
              ))}
            </div>

            <div
              className={`mt-4 flex items-center justify-between p-4 rounded-[12px] border ${
                hybridMode ? 'border-violet-300 bg-violet-50/50' : 'border-[#E2E8F0] bg-[#F8FAFC]'
              }`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles size={14} className="text-violet-600" />
                  <p className="text-sm font-bold text-[#0F172A]">{t('hybrid')}</p>
                </div>
                <p className="text-xs text-[#64748B] mt-0.5">{t('hybridHint')}</p>
              </div>
              <button type="button" onClick={() => setHybridMode((v) => !v)} className="flex-shrink-0 text-[#64748B]">
                {hybridMode ? <ToggleRight size={32} className="text-violet-600" /> : <ToggleLeft size={32} />}
              </button>
            </div>
          </div>

          <div className="rounded-[14px] border border-[#E2E8F0] bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-[#0ea5e9]" />
                <h3 className="font-bold text-[#0F172A]">{t('promptTitle')}</h3>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => navigator.clipboard?.writeText(prompt)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-xs font-semibold border border-[#E2E8F0] bg-[#FAFBFC] text-[#64748B]"
                >
                  <Copy size={12} /> {t('copy')}
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-xs font-bold text-white ${
                    savedFlash ? 'bg-emerald-600' : 'bg-[#00305E]'
                  }`}
                >
                  {savedFlash ? <Check size={12} /> : <Save size={12} />}
                  {savedFlash ? t('saved') : t('save')}
                </button>
              </div>
            </div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={14}
              className="w-full rounded-[12px] p-4 text-sm font-mono resize-y outline-none border border-slate-700 bg-[#0F172A] text-slate-100"
            />
            <p className="text-[10px] text-[#94A3B8] mt-2 flex justify-between">
              <span>
                {prompt.split('\n').length} {t('lines')} · {prompt.length} {t('chars')}
              </span>
              <span className="text-amber-600">{t('warn')}</span>
            </p>
          </div>
        </div>

        <div className="xl:col-span-2 space-y-5">
          <div className="rounded-[14px] border border-[#E2E8F0] bg-white p-5">
            <div className="flex items-center gap-2 mb-4">
              <Sliders size={18} className="text-orange-500" />
              <h3 className="font-bold text-[#0F172A]">{t('params')}</h3>
            </div>
            <div className="space-y-5">
              {[
                { label: t('temp'), val: temperature, min: 0, max: 2, step: 0.05, set: setTemperature, hint: t('tempHint') },
                { label: t('maxTok'), val: maxTokens, min: 256, max: 4096, step: 128, set: setMaxTokens, hint: t('maxTokHint') },
                { label: 'Top-P', val: topP, min: 0, max: 1, step: 0.05, set: setTopP, hint: t('topPHint') },
              ].map(({ label, val, min, max, step, set, hint }) => (
                <div key={label}>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-semibold text-[#0F172A]">{label}</span>
                    <span className="text-sm font-bold text-[#0ea5e9] tabular-nums">{val}</span>
                  </div>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={val}
                    onChange={(e) => set(Number(e.target.value))}
                    className="w-full accent-[#00305E]"
                  />
                  <p className="text-[10px] text-[#64748B] mt-0.5">{hint}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[14px] border border-[#E2E8F0] bg-white p-5">
            <h3 className="font-bold text-[#0F172A] text-sm mb-3">{t('costEst')}</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-xs text-[#64748B]">
                <span>{t('estModel')}</span>
                <span className="font-semibold text-[#0F172A]">{activeModel === 'llama4' ? 'Llama-4' : 'Llama-3.3-70B'}</span>
              </div>
              <div className="flex justify-between text-xs text-[#64748B]">
                <span>{t('estPerConvo')}</span>
                <span className="font-semibold text-[#0F172A]">${estimatedCostPerConvo}</span>
              </div>
              <div className="flex justify-between text-xs text-[#64748B]">
                <span>{t('estMax')}</span>
                <span className="font-semibold text-[#0F172A]">{maxTokens.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  )
}
