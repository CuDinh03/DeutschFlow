'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, Briefcase, MessageSquareText, Mic, Users } from 'lucide-react'
import { toast } from 'sonner'
import { apiMessage } from '@/lib/api'
import useAdminData from '@/hooks/useAdminData'
import {
  interviewAdminApi,
  interviewDomainApi,
  type InterviewPersonaInfo,
  type InterviewAnalytics,
} from '@/lib/interviewDomainApi'
import { GaPageHdr, GaBtn, GaCap, AdStatStrip, TkModal, TkSeg, type TkSegOption } from '@/components/ui-v2'
import { cn } from '@/lib/utils'

// Tier-colored badge (BEGINNER green / INTERMEDIATE blue / ADVANCED violet; CEFR-aware).
function tierTone(d: string | null | undefined): { c: string; s: string } {
  const u = (d ?? '').toUpperCase()
  if (u.includes('BEGIN') || /\bA[12]\b/.test(u)) return { c: 'var(--ga-green)', s: 'var(--ga-green-soft)' }
  if (u.includes('INTER') || /\bB[12]\b/.test(u)) return { c: 'var(--ga-blue)', s: 'var(--ga-blue-soft)' }
  return { c: 'var(--ga-violet)', s: 'var(--ga-violet-soft)' } // ADVANCED / C1–C2 / default
}

// ── Violet header accent (personas screen overrides admin-navy chrome) ────────
const VIOLET = '#7C56C8'
const personaAccentVars = {
  '--ga-accent': VIOLET,
  '--ga-hdr-bg': 'rgba(124,86,200,0.07)',
  '--ga-hdr-line': 'rgba(124,86,200,0.20)',
} as React.CSSProperties

interface PersonaData {
  personas: InterviewPersonaInfo[]
  sessionsByPersona: Record<string, number>
  totalSessions: number
}

type AbMode = 'fixed' | 'balanced' | 'adaptive'
const AB_SPLIT: Record<AbMode, number[]> = { fixed: [100, 0, 0], balanced: [34, 33, 33], adaptive: [50, 30, 20] }
// AbMode → catalog note key (resolved via t()).
const AB_NOTE_KEY: Record<AbMode, string> = {
  fixed: 'abNoteFixed',
  balanced: 'abNoteBalanced',
  adaptive: 'abNoteAdaptive',
}

function avatarChar(label: string): string {
  const parts = (label || '').trim().split(/\s+/)
  return (parts[parts.length - 1]?.[0] ?? 'P').toUpperCase()
}

/** Per-template rubric (GET/PUT /admin/interviews/rubrics). weightJson = criterion→fraction (0–1, Σ=1). */
type RubricTemplate = {
  id: number
  industry: string
  roleGroup?: string
  levelRange?: string
  phase: string
  criteriaJson: string
  weightJson: string
  version: number
  active: boolean
}
/** Backend criterion key (snake_case) → catalog label key; unknown keys fall back to humanized snake_case. */
const CRITERION_KEY: Record<string, string> = {
  relevance: 'criterionRelevance',
  clarity: 'criterionClarity',
  completeness: 'criterionCompleteness',
  german_quality: 'criterionGermanQuality',
  structure: 'criterionStructure',
  confidence: 'criterionConfidence',
  profession_fit: 'criterionProfessionFit',
  concrete_experience: 'criterionConcreteExperience',
  empathy: 'criterionEmpathy',
  hygiene_awareness: 'criterionHygieneAwareness',
  hygiene_protocol: 'criterionHygieneProtocol',
  patient_communication: 'criterionPatientCommunication',
  documentation: 'criterionDocumentation',
  emergency_response: 'criterionEmergencyResponse',
  haccp_awareness: 'criterionHaccpAwareness',
  teamwork: 'criterionTeamwork',
  rush_handling: 'criterionRushHandling',
}
const rubricLabel = (r: RubricTemplate): string =>
  [r.industry, r.levelRange, r.phase].filter(Boolean).join(' · ')
/** Parse weightJson (fractions 0–1) → percent ints for the sliders. */
function parseWeightsPct(weightJson: string): Record<string, number> {
  try {
    const raw = JSON.parse(weightJson) as Record<string, number>
    return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Math.round(Number(v) * 100)]))
  } catch {
    return {}
  }
}

export default function V2AdminPersonasPage() {
  const t = useTranslations('v2.adminContent.personas')
  const tc = useTranslations('v2.common')
  const criterionLabel = (k: string): string =>
    CRITERION_KEY[k] ? t(CRITERION_KEY[k]) : k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  const AB_MODES: TkSegOption<AbMode>[] = [
    { value: 'fixed', label: t('abFixed') },
    { value: 'balanced', label: t('abBalanced') },
    { value: 'adaptive', label: t('abAdaptive') },
  ]
  // No `active` field on the persona DTO → track on/off client-side (toggle still
  // hits the real endpoint, persisted server-side). Default all on.
  const [off, setOff] = useState<Record<string, boolean>>({})
  const [createOpen, setCreateOpen] = useState(false)
  // Rubric = per-template (real backend). Pick a template → edit its real criteria
  // weights → PUT. weights are percent ints in UI; persisted as fractions (Σ=1).
  const [rubrics, setRubrics] = useState<RubricTemplate[]>([])
  const [rubricId, setRubricId] = useState<number | null>(null)
  const [weights, setWeights] = useState<Record<string, number>>({})
  const [savingRubric, setSavingRubric] = useState(false)
  // A/B câu hỏi — client-side (proto behaviour; no backend yet). Mode drives the split.
  const [abMode, setAbMode] = useState<AbMode>('balanced')

  const { data, loading, error, reload } = useAdminData<PersonaData>({
    initialData: { personas: [], sessionsByPersona: {}, totalSessions: 0 },
    errorMessage: t('loadDataError'),
    fetchData: async () => {
      const [personas, analytics] = await Promise.all([
        interviewAdminApi.listAllPersonas(),
        interviewDomainApi.getAnalytics().catch(() => null as InterviewAnalytics | null),
      ])
      return {
        personas: personas ?? [],
        sessionsByPersona: analytics?.sessionsByPersona ?? {},
        totalSessions: analytics?.totalSessions ?? 0,
      }
    },
  })

  const stats = useMemo(() => {
    const total = data.personas.length
    const activeN = data.personas.filter((p) => !off[p.code]).length
    const industries = new Set(data.personas.map((p) => p.industry).filter(Boolean)).size
    return { total, activeN, industries, sessions: data.totalSessions }
  }, [data, off])

  const sum = Object.values(weights).reduce((a, b) => a + b, 0)

  // Load rubric templates; default-select the first active (else first) one.
  useEffect(() => {
    let cancelled = false
    interviewAdminApi
      .listRubrics()
      .then((list) => {
        if (cancelled) return
        const arr = (list ?? []) as RubricTemplate[]
        setRubrics(arr)
        const initial = arr.find((r) => r.active) ?? arr[0]
        if (initial) {
          setRubricId(initial.id)
          setWeights(parseWeightsPct(initial.weightJson))
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const selectRubric = (id: number) => {
    const r = rubrics.find((x) => x.id === id)
    if (!r) return
    setRubricId(id)
    setWeights(parseWeightsPct(r.weightJson))
  }

  const saveRubric = async () => {
    if (rubricId == null || sum !== 100) {
      toast.error(rubricId == null ? t('noRubricSelected') : t('weightMustBe100'))
      return
    }
    setSavingRubric(true)
    try {
      const weightJson = JSON.stringify(
        Object.fromEntries(Object.entries(weights).map(([k, v]) => [k, Number((v / 100).toFixed(4))])),
      )
      await interviewAdminApi.updateRubric(rubricId, { weightJson })
      setRubrics((rs) => rs.map((r) => (r.id === rubricId ? { ...r, weightJson } : r)))
      toast.success(t('rubricSaved'))
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setSavingRubric(false)
    }
  }

  const toggle = async (p: InterviewPersonaInfo) => {
    const nowOff = !off[p.code]
    setOff((m) => ({ ...m, [p.code]: nowOff }))
    try {
      await interviewAdminApi.togglePersona(p.code)
      toast.success(nowOff ? t('personaDisabled', { label: p.label }) : t('personaEnabled', { label: p.label }))
    } catch (e: unknown) {
      setOff((m) => ({ ...m, [p.code]: !nowOff })) // rollback
      toast.error(apiMessage(e))
    }
  }

  return (
    <div className="flex min-h-full flex-col" style={personaAccentVars}>
      <GaPageHdr
        accent
        title={t('title')}
        subtitle={t('subtitle')}
        right={
          <GaBtn variant="yellow" onClick={() => setCreateOpen(true)}>
            <Plus size={16} aria-hidden />
            {t('addPersona')}
          </GaBtn>
        }
      />

      <div className="flex-1 overflow-auto px-10 py-[26px]">
        <AdStatStrip
          className="mb-6"
          cells={[
            { label: t('statTotal'), value: stats.total, color: VIOLET },
            { label: t('statActive'), value: `${stats.activeN}/${stats.total}`, color: '#1E9E61', sub: t('statActiveSub') },
            { label: t('statIndustries'), value: stats.industries, color: '#2F6FC9' },
            { label: t('statSessions'), value: stats.sessions.toLocaleString('vi-VN'), color: '#E07B39' },
          ]}
        />

        {loading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="ga-shimmer h-[92px] border border-ga-line" aria-hidden />
            ))}
          </div>
        ) : error ? (
          <div className="border border-ga-line bg-ga-card px-10 py-[52px] text-center">
            <h2 className="font-ga-display text-[26px] font-medium leading-[1.2] text-ga-red">
              {t('loadError')}
            </h2>
            <p className="ga-ui mx-auto mb-5 mt-3 max-w-sm text-[14.5px] text-ga-muted">
              {error}{' '}
              <code className="font-mono text-[12px] text-ga-accent">GET /api/admin/interviews/personas</code>
            </p>
            <GaBtn variant="primary" onClick={() => reload({ silent: false })}>
              {tc('retry')}
            </GaBtn>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-[22px] xl:grid-cols-[1.5fr_1fr] xl:items-start">
            {/* Persona list */}
            <div>
              <GaCap className="mb-3.5 block">{t('personaListCap', { count: data.personas.length })}</GaCap>
              <div className="flex flex-col gap-3">
                {data.personas.map((p) => {
                  const isOff = !!off[p.code]
                  return (
                    <div
                      key={p.code}
                      className={cn(
                        'flex items-center gap-4 border border-ga-line bg-ga-card px-5 py-4 transition-opacity',
                        isOff && 'opacity-60',
                      )}
                    >
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-ga-ink font-ga-display text-[18px] font-medium text-ga-yellow">
                        {avatarChar(p.label)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <span className="text-[15px] font-bold text-ga-ink">{p.label}</span>
                          {p.difficulty && (
                            <span
                              className="px-[7px] py-[3px] text-[9px] font-bold tracking-[0.04em]"
                              style={{ color: tierTone(p.difficulty).c, background: tierTone(p.difficulty).s }}
                            >
                              {p.difficulty}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-[12.5px] text-ga-muted">
                          <Briefcase size={13} className="shrink-0 text-ga-subtle" />
                          <span className="truncate">
                            {p.roleTitle}
                            {p.industry ? ` · ${p.industry}` : ''}
                          </span>
                        </div>
                        <div className="mt-[7px] flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-ga-muted">
                          {p.questionStyle && (
                            <span className="inline-flex items-center gap-1"><MessageSquareText size={12} className="text-ga-subtle" /> {p.questionStyle}</span>
                          )}
                          {p.tone && <span className="inline-flex items-center gap-1"><Mic size={12} className="text-ga-subtle" /> {p.tone}</span>}
                          <span className="inline-flex items-center gap-1"><Users size={12} className="text-ga-subtle" /> {t('sessionsSuffix', { count: (data.sessionsByPersona[p.code] ?? 0).toLocaleString('vi-VN') })}</span>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={!isOff}
                          onClick={() => toggle(p)}
                          className="relative h-[22px] w-[40px] rounded-full transition-colors"
                          style={{ background: isOff ? 'var(--ga-border)' : 'var(--ga-green)' }}
                        >
                          <span
                            className="absolute top-[2px] h-[18px] w-[18px] rounded-full bg-white transition-[left]"
                            style={{ left: isOff ? '2px' : '20px' }}
                          />
                        </button>
                        <button
                          type="button"
                          onClick={() => toast(t('editSoon'))}
                          className="rounded-ga border border-ga-line px-[10px] py-[6px] text-[11px] font-semibold text-ga-muted transition-colors hover:border-ga-accent hover:text-ga-accent"
                        >
                          {t('edit')}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Rubric = per-template (real BE); A/B below stays client-side (proto) */}
            <div className="flex flex-col gap-5">
              <section className="border border-ga-line bg-ga-card p-5">
                <GaCap className="mb-3 block">{t('rubricCap')}</GaCap>
                {rubrics.length === 0 ? (
                  <p className="ga-ui text-[13px] italic text-ga-muted">{t('noRubric')}</p>
                ) : (
                  <>
                    <label className="mb-4 block">
                      <span className="ga-ui mb-1 block text-[11.5px] font-semibold uppercase tracking-[0.06em] text-ga-muted">
                        {t('rubricSelectLabel')}
                      </span>
                      <select
                        value={rubricId ?? ''}
                        onChange={(e) => selectRubric(Number(e.target.value))}
                        className="ga-ui w-full rounded-ga border border-ga-line bg-ga-card px-3 py-2 text-[13px] font-semibold text-ga-ink outline-none"
                      >
                        {rubrics.map((r) => (
                          <option key={r.id} value={r.id}>
                            {rubricLabel(r)}
                            {r.active ? '' : t('rubricHidden')}
                          </option>
                        ))}
                      </select>
                    </label>
                    {Object.entries(weights).map(([k, v]) => (
                      <div key={k} className="mb-4">
                        <div className="mb-[7px] flex items-center justify-between">
                          <span className="text-[13px] font-semibold text-ga-ink">{criterionLabel(k)}</span>
                          <span className="font-ga-display text-[16px] font-medium text-ga-ink">{v}%</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={50}
                          step={1}
                          value={v}
                          onChange={(e) => setWeights((w) => ({ ...w, [k]: Number(e.target.value) }))}
                          className="w-full"
                          aria-label={criterionLabel(k)}
                          style={{ accentColor: VIOLET }}
                        />
                      </div>
                    ))}
                    <div
                      className="mt-1 flex items-center justify-between px-3.5 py-3"
                      style={{
                        background: sum === 100 ? 'var(--ga-green-soft)' : 'var(--ga-red-soft)',
                        border: `1px solid ${sum === 100 ? 'rgba(30,158,97,0.27)' : 'rgba(218,41,28,0.27)'}`,
                      }}
                    >
                      <span className="text-[13px] text-ga-ink">{t('totalWeight')}</span>
                      <span
                        className="font-ga-display text-[18px] font-medium"
                        style={{ color: sum === 100 ? 'var(--ga-green)' : 'var(--ga-red)' }}
                      >
                        {sum}%{sum !== 100 ? ' ⚠' : ' ✓'}
                      </span>
                    </div>
                    <GaBtn
                      variant="yellow"
                      loading={savingRubric}
                      disabled={sum !== 100 || rubricId == null}
                      className="mt-3.5 w-full justify-center"
                      onClick={saveRubric}
                    >
                      {t('saveRubric')}
                    </GaBtn>
                  </>
                )}
              </section>

              {/* A/B câu hỏi (client-side) */}
              <section className="border border-ga-line bg-ga-card p-5">
                <div className="mb-3.5 flex items-center justify-between gap-3">
                  <GaCap>{t('abCap')}</GaCap>
                  <TkSeg options={AB_MODES} value={abMode} onValueChange={setAbMode} aria-label={t('abModeAria')} />
                </div>
                <div className="flex flex-col gap-3">
                  {(['A', 'B', 'C'] as const).map((variant, i) => {
                    const pct = AB_SPLIT[abMode][i]
                    return (
                      <div key={variant}>
                        <div className="mb-1 flex items-center justify-between text-[12.5px]">
                          <span className="font-semibold text-ga-ink">{t('variant', { variant })}</span>
                          <span className="text-ga-muted">{pct}%</span>
                        </div>
                        <span className="block h-2 bg-ga-bg">
                          <span className="block h-full transition-[width] duration-300" style={{ width: `${pct}%`, background: pct === 0 ? 'transparent' : VIOLET }} />
                        </span>
                      </div>
                    )
                  })}
                </div>
                <p className="ga-ui mt-3.5 text-[12px] leading-[1.55] text-ga-muted">{t(AB_NOTE_KEY[abMode])}</p>
              </section>
            </div>
          </div>
        )}
      </div>

      {/* Create persona modal — full form, save pending backend (no POST endpoint) */}
      {createOpen && <CreatePersonaModal onClose={() => setCreateOpen(false)} />}
    </div>
  )
}

// key = API field + form state key (kept), labelKey/placeholderKey resolve via t().
const FIELDS: { key: string; labelKey: string; placeholderKey: string }[] = [
  { key: 'code', labelKey: 'fieldCode', placeholderKey: 'fieldCodePlaceholder' },
  { key: 'label', labelKey: 'fieldLabel', placeholderKey: 'fieldLabelPlaceholder' },
  { key: 'roleTitle', labelKey: 'fieldRoleTitle', placeholderKey: 'fieldRoleTitlePlaceholder' },
  { key: 'industry', labelKey: 'fieldIndustry', placeholderKey: 'fieldIndustryPlaceholder' },
  { key: 'difficulty', labelKey: 'fieldDifficulty', placeholderKey: 'fieldDifficultyPlaceholder' },
  { key: 'tone', labelKey: 'fieldTone', placeholderKey: 'fieldTonePlaceholder' },
  { key: 'questionStyle', labelKey: 'fieldQuestionStyle', placeholderKey: 'fieldQuestionStylePlaceholder' },
  { key: 'evaluationBias', labelKey: 'fieldEvaluationBias', placeholderKey: 'fieldEvaluationBiasPlaceholder' },
]

function CreatePersonaModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations('v2.adminContent.personas')
  const tc = useTranslations('v2.common')
  const [form, setForm] = useState<Record<string, string>>({})
  return (
    <TkModal
      open
      onOpenChange={(o) => !o && onClose()}
      size="md"
      title={t('createTitle')}
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11.5px] text-ga-subtle">{t('createLockedNote')}</span>
          <div className="flex gap-2.5">
            <GaBtn variant="ghost" onClick={onClose}>
              {tc('cancel')}
            </GaBtn>
            <GaBtn variant="primary" disabled title={t('savePersonaHint')}>
              {t('savePersona')}
            </GaBtn>
          </div>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        {FIELDS.map((f) => (
          <label key={f.key} className="block">
            <GaCap className="mb-1.5 block">{t(f.labelKey)}</GaCap>
            <input
              value={form[f.key] ?? ''}
              onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
              placeholder={t(f.placeholderKey)}
              className="block w-full rounded-ga border border-ga-line bg-ga-bg px-3 py-2.5 text-[14px] text-ga-ink outline-none"
            />
          </label>
        ))}
      </div>
    </TkModal>
  )
}
