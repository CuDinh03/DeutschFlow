'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ArrowLeft, Pencil, Plus } from 'lucide-react'
import {
  adminExamBankApi,
  type BankBlueprint,
  type BankPoolCell,
  type BankTaskRow,
} from '@/lib/adminExamBankApi'
import { apiMessage } from '@/lib/api'
import { StimulusCard } from '@/components/features/exam-speaking/StimulusCard'
import { GaPageHdr, GaCard, GaCap, GaBtn, TkSeg, TkBadge, TkModal, LoadingState, ErrorBanner, EmptyState } from '@/components/ui-v2'

const PROVIDERS = ['', 'GOETHE', 'TELC'] as const
const LEVELS = ['', 'A1', 'A2', 'B1', 'B2'] as const
const STATUSES = ['', 'DRAFT', 'APPROVED', 'RETIRED'] as const
const ARCHETYPES = [
  'SELF_INTRO', 'CARD_QA', 'REQUEST_RESPOND', 'ABOUT_ME', 'PLAN_NEGOTIATE',
  'TOPIC_EXCHANGE', 'PRESENT', 'FEEDBACK_FOLLOWUP', 'DISCUSS', 'PICTURE',
] as const

/**
 * Khoá partner* AI đã hỗ trợ — soi backend `AiInterlocutorService.KNOWN_PARTNER_KEYS`. Khoá partner*
 * NGOÀI danh sách bị backend từ chối 400 (khoá lạ bị ẩn khỏi client nhưng AI cũng không đọc → hỏng
 * âm thầm); FE cảnh báo sớm ngay trong form.
 */
const KNOWN_PARTNER_KEYS = new Set(['partnerCalendar', 'partnerText', 'partnerChart', 'partnerPresentation', 'partnerStance'])

const STATUS_TONE: Record<string, 'green' | 'yellow' | 'neutral'> = {
  APPROVED: 'green', DRAFT: 'yellow', RETIRED: 'neutral',
}

/** Tóm tắt 1 dòng cho bảng: giá trị chuỗi nổi bật nhất của stimulus. */
function summarize(stimulus: Record<string, unknown>): string {
  for (const k of ['thema', 'topic', 'situation', 'question', 'word', 'wort', 'object', 'title', 'context']) {
    const v = stimulus[k]
    if (typeof v === 'string' && v.trim()) return v
  }
  return ''
}

/** Đ5b-A: ma trận pool đề theo blueprint + bảng CRUD `speaking_exam_tasks` + preview thẻ như học viên thấy. */
export default function AdminExamBankPage() {
  const t = useTranslations('v2.adminOps.examBank')
  const [cells, setCells] = useState<BankPoolCell[]>([])
  const [blueprints, setBlueprints] = useState<BankBlueprint[]>([])
  const [tasks, setTasks] = useState<BankTaskRow[]>([])
  const [provider, setProvider] = useState('')
  const [level, setLevel] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [tasksLoading, setTasksLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editor, setEditor] = useState<{ row: BankTaskRow | null } | null>(null)

  const reloadOverview = useCallback(() => {
    Promise.all([adminExamBankApi.overview(), adminExamBankApi.blueprints()])
      .then(([o, b]) => {
        setCells(o.data)
        setBlueprints(b.data)
      })
      .catch((e) => setError(apiMessage(e)))
      .finally(() => setLoading(false))
  }, [])

  const reloadTasks = useCallback(() => {
    setTasksLoading(true)
    adminExamBankApi.tasks({
      ...(provider ? { provider } : {}),
      ...(level ? { level } : {}),
      ...(status ? { status } : {}),
    })
      .then((r) => setTasks(r.data))
      .catch((e) => setError(apiMessage(e)))
      .finally(() => setTasksLoading(false))
  }, [provider, level, status])

  useEffect(() => reloadOverview(), [reloadOverview])
  useEffect(() => reloadTasks(), [reloadTasks])

  const matrix = useMemo(() => {
    const byExam = new Map<string, BankPoolCell[]>()
    for (const c of cells) {
      const key = `${c.provider} ${c.level}`
      byExam.set(key, [...(byExam.get(key) ?? []), c])
    }
    return Array.from(byExam.entries())
  }, [cells])

  const onSaved = () => {
    setEditor(null)
    reloadOverview()
    reloadTasks()
  }

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        title={t('title')}
        subtitle={t('subtitle')}
        right={
          <a href="/v2/admin" className="ga-ui inline-flex items-center gap-1.5 rounded-ga border border-ga-line bg-ga-card px-4 py-2.5 text-[13px] font-semibold text-ga-ink hover:bg-ga-surface">
            <ArrowLeft size={14} aria-hidden /> {t('back')}
          </a>
        }
      />
      <div className="flex-1 space-y-5 px-4 py-5 sm:px-6 lg:px-10">
        {error && <ErrorBanner message={error} onRetry={() => setError(null)} retryLabel={t('dismiss')} />}

        {loading ? (
          <LoadingState label={t('loading')} />
        ) : (
          <>
            {/* Ma trận pool: đỏ = pick() sẽ 409 (pool < cần); vàng = vừa khít, không còn gì để xoay đề. */}
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="bank-matrix">
              {matrix.map(([exam, list]) => (
                <GaCard key={exam} className="p-4">
                  <GaCap className="mb-2 block">{exam}</GaCap>
                  <ul className="space-y-1.5">
                    {list.map((c: BankPoolCell) => {
                      const tone = c.poolApproved < c.cardsNeeded ? 'red' : c.poolApproved === c.cardsNeeded ? 'yellow' : 'green'
                      return (
                        <li key={c.teilNo} className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            className="ga-ui truncate text-left text-[13px] text-ga-ink underline-offset-2 hover:underline"
                            title={`${c.title} · ${c.archetype}`}
                            onClick={() => {
                              setProvider(c.provider)
                              setLevel(c.level)
                              setStatus('')
                            }}
                          >
                            T{c.teilNo} · {c.title}
                          </button>
                          <TkBadge tone={tone} data-testid={`pool-${c.provider}-${c.level}-${c.teilNo}`}>
                            {t('poolBadge', { pool: c.poolApproved, need: c.cardsNeeded })}
                          </TkBadge>
                        </li>
                      )
                    })}
                  </ul>
                </GaCard>
              ))}
            </section>

            <div className="flex flex-wrap items-center gap-3">
              <TkSeg
                aria-label={t('providerLabel')}
                value={provider}
                onValueChange={setProvider}
                options={PROVIDERS.map((p) => ({ value: p, label: p === '' ? t('all') : p === 'GOETHE' ? 'Goethe' : 'telc' }))}
              />
              <TkSeg
                aria-label={t('levelLabel')}
                value={level}
                onValueChange={setLevel}
                options={LEVELS.map((l) => ({ value: l, label: l === '' ? t('all') : l }))}
              />
              <TkSeg
                aria-label={t('statusLabel')}
                value={status}
                onValueChange={setStatus}
                options={STATUSES.map((s) => ({ value: s, label: s === '' ? t('all') : t(`status.${s}`) }))}
              />
              <GaBtn size="sm" onClick={() => setEditor({ row: null })} data-testid="bank-create">
                <Plus size={14} aria-hidden className="mr-1.5" /> {t('createCta')}
              </GaBtn>
            </div>

            <GaCard className="overflow-x-auto p-4">
              <GaCap className="mb-3 block">{t('tableCap', { n: tasks.length })}</GaCap>
              {tasksLoading ? (
                <LoadingState label={t('loading')} />
              ) : tasks.length === 0 ? (
                <EmptyState title={t('emptyTitle')} description={t('emptyDesc')} />
              ) : (
                <table className="ga-ui w-full min-w-[760px] text-left text-[13.5px]" data-testid="bank-table">
                  <thead>
                    <tr className="text-[12px] uppercase tracking-wide text-ga-muted">
                      <th className="py-2 pr-3">#</th>
                      <th className="py-2 pr-3">{t('colExam')}</th>
                      <th className="py-2 pr-3">Teil</th>
                      <th className="py-2 pr-3">{t('colArchetype')}</th>
                      <th className="py-2 pr-3">{t('colContent')}</th>
                      <th className="py-2 pr-3">{t('colStatus')}</th>
                      <th className="py-2 pr-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ga-line">
                    {tasks.map((r) => (
                      <tr key={r.id} data-testid={`bank-row-${r.id}`}>
                        <td className="py-2 pr-3 tabular-nums text-ga-muted">{r.id}</td>
                        <td className="py-2 pr-3">
                          {r.provider ?? <TkBadge tone="neutral">{t('shared')}</TkBadge>} {r.level}
                        </td>
                        <td className="py-2 pr-3 tabular-nums">T{r.teilNo}</td>
                        <td className="py-2 pr-3 text-[12.5px]">{r.archetype}</td>
                        <td className="max-w-[320px] truncate py-2 pr-3" title={summarize(r.stimulus)}>
                          <span className="mr-1.5 text-[11px] uppercase text-ga-muted">{String(r.stimulus.type ?? '')}</span>
                          {summarize(r.stimulus)}
                        </td>
                        <td className="py-2 pr-3">
                          <TkBadge tone={STATUS_TONE[r.status] ?? 'neutral'}>{t(`status.${r.status}`)}</TkBadge>
                        </td>
                        <td className="py-2 text-right">
                          <GaBtn variant="ghost" size="sm" onClick={() => setEditor({ row: r })} data-testid={`bank-edit-${r.id}`}>
                            <Pencil size={13} aria-hidden className="mr-1" /> {t('editCta')}
                          </GaBtn>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </GaCard>
          </>
        )}
      </div>

      {editor && <TaskEditor row={editor.row} onSaved={onSaved} onClose={() => setEditor(null)} />}
    </div>
  )
}

function TaskEditor({ row, onSaved, onClose }: { row: BankTaskRow | null; onSaved: () => void; onClose: () => void }) {
  const t = useTranslations('v2.adminOps.examBank')
  // Đề đang sửa giữ nguyên provider (null = dùng chung → ''); chỉ đề MỚI mới mặc định Goethe.
  const [provider, setProvider] = useState(row ? row.provider ?? '' : 'GOETHE')
  const [level, setLevel] = useState(row?.level ?? 'A1')
  const [teilNo, setTeilNo] = useState(row?.teilNo ?? 1)
  const [archetype, setArchetype] = useState(row?.archetype ?? 'CARD_QA')
  const [status, setStatus] = useState<string>(row?.status ?? 'DRAFT')
  const [jsonText, setJsonText] = useState(JSON.stringify(row?.stimulus ?? { type: '' }, null, 2))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const parsed = useMemo(() => {
    try {
      const v = JSON.parse(jsonText) as unknown
      return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
    } catch {
      return null
    }
  }, [jsonText])

  const partnerKeys = useMemo(() => Object.keys(parsed ?? {}).filter((k) => k.startsWith('partner')), [parsed])
  const unknownPartner = partnerKeys.filter((k) => !KNOWN_PARTNER_KEYS.has(k))
  // Preview đúng như HỌC VIÊN thấy: khoá partner* bị lọc như ExamSessionService.clientStimulus.
  const clientView = useMemo(() => {
    if (!parsed) return null
    return Object.fromEntries(Object.entries(parsed).filter(([k]) => !k.startsWith('partner')))
  }, [parsed])

  const save = async () => {
    if (!parsed) return
    setSaving(true)
    setError(null)
    const payload = { provider: provider || null, level, teilNo, archetype, status, stimulus: parsed }
    try {
      if (row) await adminExamBankApi.update(row.id, payload)
      else await adminExamBankApi.create(payload)
      onSaved()
    } catch (e) {
      setError(apiMessage(e))
      setSaving(false)
    }
  }

  const selectCls = 'ga-ui rounded-ga border border-ga-line bg-ga-card px-2.5 py-2 text-[13px] text-ga-ink'

  return (
    <TkModal open onOpenChange={(o) => { if (!o) onClose() }} title={row ? t('editorEditTitle', { id: row.id }) : t('editorCreateTitle')} size="lg">
      <div className="grid gap-4 lg:grid-cols-2" data-testid="bank-editor">
        <div className="space-y-3">
          {error && <ErrorBanner message={error} onRetry={() => setError(null)} retryLabel={t('dismiss')} />}
          <div className="flex flex-wrap gap-2">
            <label className="ga-ui flex flex-col gap-1 text-[12px] text-ga-muted">
              {t('providerLabel')}
              <select className={selectCls} value={provider ?? ''} onChange={(e) => setProvider(e.target.value)} data-testid="bank-f-provider">
                <option value="">{t('shared')}</option>
                <option value="GOETHE">Goethe</option>
                <option value="TELC">telc</option>
              </select>
            </label>
            <label className="ga-ui flex flex-col gap-1 text-[12px] text-ga-muted">
              {t('levelLabel')}
              <select className={selectCls} value={level} onChange={(e) => setLevel(e.target.value)} data-testid="bank-f-level">
                {['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((l) => <option key={l}>{l}</option>)}
              </select>
            </label>
            <label className="ga-ui flex flex-col gap-1 text-[12px] text-ga-muted">
              Teil
              <select className={selectCls} value={teilNo} onChange={(e) => setTeilNo(Number(e.target.value))} data-testid="bank-f-teil">
                {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <label className="ga-ui flex flex-col gap-1 text-[12px] text-ga-muted">
              {t('colArchetype')}
              <select className={selectCls} value={archetype} onChange={(e) => setArchetype(e.target.value)} data-testid="bank-f-archetype">
                {ARCHETYPES.map((a) => <option key={a}>{a}</option>)}
              </select>
            </label>
            <label className="ga-ui flex flex-col gap-1 text-[12px] text-ga-muted">
              {t('colStatus')}
              <select className={selectCls} value={status} onChange={(e) => setStatus(e.target.value)} data-testid="bank-f-status">
                {['DRAFT', 'APPROVED', 'RETIRED'].map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
              </select>
            </label>
          </div>

          <label className="ga-ui block text-[12px] text-ga-muted">
            {t('stimulusLabel')}
            <textarea
              className="ga-ui mt-1 h-64 w-full rounded-ga border border-ga-line bg-ga-card p-3 font-mono text-[12.5px] text-ga-ink"
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              spellCheck={false}
              data-testid="bank-f-json"
            />
          </label>
          {!parsed && <p className="ga-ui text-[12.5px] text-ga-red" data-testid="bank-json-invalid">{t('jsonInvalid')}</p>}
          {parsed && !(typeof parsed.type === 'string' && parsed.type.trim()) && (
            <p className="ga-ui text-[12.5px] text-ga-red">{t('typeMissing')}</p>
          )}

          {partnerKeys.length > 0 && (
            <div className="space-y-1" data-testid="bank-partner-keys">
              <p className="ga-ui text-[12px] font-semibold text-ga-ink">{t('partnerCap')}</p>
              <div className="flex flex-wrap gap-1.5">
                {partnerKeys.map((k) => (
                  <TkBadge key={k} tone={KNOWN_PARTNER_KEYS.has(k) ? 'teal' : 'red'}>{k}</TkBadge>
                ))}
              </div>
              <p className="ga-ui text-[12px] text-ga-muted">{t('partnerPrivate')}</p>
              {unknownPartner.length > 0 && (
                <p className="ga-ui text-[12.5px] text-ga-red" data-testid="bank-partner-unknown">
                  {t('partnerUnknown', { keys: unknownPartner.join(', ') })}
                </p>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <GaBtn onClick={() => void save()} disabled={saving || !parsed || unknownPartner.length > 0} data-testid="bank-save">
              {saving ? t('saving') : t('save')}
            </GaBtn>
            <GaBtn variant="ghost" onClick={onClose}>{t('cancel')}</GaBtn>
          </div>
        </div>

        <div className="space-y-2">
          <GaCap className="block">{t('previewCap')}</GaCap>
          <StimulusCard stimulus={clientView} stepIndex={2} candidateAction="SPEAK" />
          <p className="ga-ui text-[12px] text-ga-muted">{t('previewNote')}</p>
        </div>
      </div>
    </TkModal>
  )
}
