'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Brain, Check, CircuitBoard, Copy, Cpu, FileText, RefreshCw, Save, Server, Sliders } from 'lucide-react'
import AdminShell from '@/components/admin/AdminShell'
import useAdminData from '@/hooks/useAdminData'
import { ADMIN_AI_SYSTEM_PROMPT_DEFAULT } from '@/lib/adminAiDefaults'
import { apiMessage, isAxiosErr } from '@/lib/api'
import { localAiApi, type AIHealthStatus } from '@/lib/localAiApi'

type VoidOk = { _: true }

export default function AdminAiConfigPage() {
  const t = useTranslations('adminAi')
  const [prompt, setPrompt] = useState(ADMIN_AI_SYSTEM_PROMPT_DEFAULT)
  const [temperature, setTemperature] = useState(0.7)
  const [maxTokens, setMaxTokens] = useState(1024)
  const [topP, setTopP] = useState(0.9)
  const [savedFlash, setSavedFlash] = useState(false)
  const [health, setHealth] = useState<AIHealthStatus | null>(null)
  const [healthLoading, setHealthLoading] = useState(false)
  const [healthError, setHealthError] = useState<string | null>(null)

  const { loading, error, refreshing, lastSyncedAt, reload } = useAdminData<VoidOk>({
    initialData: { _: true },
    errorMessage: t('error'),
    fetchData: async () => ({ _: true }),
    intervalMs: 600_000,
  })

  const loadHealth = useCallback(async () => {
    setHealthLoading(true)
    setHealthError(null)
    try {
      const { data } = await localAiApi.health()
      setHealth(data)
    } catch (e) {
      const code = isAxiosErr(e) ? e.response?.status : undefined
      setHealthError(code === undefined ? apiMessage(e) : `${apiMessage(e)} (${code})`)
      setHealth(null)
    } finally {
      setHealthLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadHealth()
  }, [loadHealth])

  const handleSave = () => {
    setSavedFlash(true)
    window.setTimeout(() => setSavedFlash(false), 2200)
  }

  const modelLoaded = health?.model_loaded === true
  const apiOk = health?.status === 'healthy' && modelLoaded

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
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2">
                <CircuitBoard size={18} className="text-violet-600" />
                <h3 className="font-bold text-[#0F172A]">{t('modelPick')}</h3>
              </div>
              <button
                type="button"
                onClick={() => void loadHealth()}
                disabled={healthLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-xs font-semibold border border-[#E2E8F0] bg-[#FAFBFC] text-[#64748B] hover:bg-[#F1F5F9]"
              >
                <RefreshCw size={12} className={healthLoading ? 'animate-spin' : ''} />
                {t('refreshHealth')}
              </button>
            </div>

            <div className="rounded-[12px] p-4 border-2 border-emerald-500/40 bg-emerald-50/40">
              <div className="flex justify-between mb-2">
                <Brain size={20} className="text-emerald-600" />
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">{t('localBadge')}</span>
              </div>
              <p className="font-bold text-sm text-[#0F172A]">{t('localName')}</p>
              <p className="text-[10px] text-[#64748B] mb-3">{t('localHint')}</p>
              <div className="grid gap-2 text-[11px] text-[#475569]">
                <div className="flex items-start gap-2">
                  <Server size={14} className="text-slate-500 mt-0.5 flex-shrink-0" />
                  <span>{t('localBackend')}</span>
                </div>
                <div className="flex items-start gap-2">
                  <Cpu size={14} className="text-slate-500 mt-0.5 flex-shrink-0" />
                  <span className="font-mono">{health?.model_path ?? '—'}</span>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-emerald-200/60 flex items-center gap-2 text-xs font-semibold">
                <span
                  className={`inline-flex h-2 w-2 rounded-full ${apiOk ? 'bg-emerald-500' : health?.status === 'healthy' ? 'bg-amber-500' : 'bg-red-500'}`}
                />
                <span className={apiOk ? 'text-emerald-800' : 'text-slate-700'}>
                  {healthLoading ? t('healthChecking') : healthError ?? (apiOk ? t('healthOk') : health ? t('healthModelDown') : t('healthUnknown'))}
                </span>
              </div>
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
            <h3 className="font-bold text-[#0F172A] text-sm mb-3">{t('routingTitle')}</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-xs text-[#64748B]">
                <span>{t('routingChat')}</span>
                <span className="font-semibold text-[#0F172A] text-right">{t('routingChatValue')}</span>
              </div>
              <div className="flex justify-between text-xs text-[#64748B]">
                <span>{t('routingVocabGrammar')}</span>
                <span className="font-semibold text-[#0F172A] text-right">{t('routingVocabGrammarValue')}</span>
              </div>
              <p className="text-[11px] text-[#64748B] mt-2 leading-relaxed">{t('routingSttHint')}</p>
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  )
}
