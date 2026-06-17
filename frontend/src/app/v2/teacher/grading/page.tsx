'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Mic, PenLine, FileText, BookOpen, SpellCheck, Sparkles, Save, Loader2,
  CheckCircle2, AlertCircle, AlertTriangle, Play, ExternalLink, Clock,
} from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import api, { apiMessage } from '@/lib/api'
import { GaPageHdr, GaBtn, GaCap, TkSeg, type TkSegOption } from '@/components/ui-v2'

// ─────────────────────────────────────────────────────────────────────────────
// Trung tâm Chấm bài (GaGrading) — violet. 3-column: queue · submission · scoring.
// Plumbing reused 1:1 from the legacy /teacher/grading page (zero backend change):
//   GET  /v2/teacher/grading/queue?classId=&type=         → GradingQueueItem[]
//   GET  /v2/teacher/grading/stats                        → { totalPending, totalGraded, byClass }
//   POST /v2/teacher/assignments/{id}/ai-grade            → async AI grade (poll for result)
//   GET  /v2/teacher/grading/classes/{cid}/assignments/{aid}/submissions  → poll score+feedback
//   POST /v2/teacher/assignments/{id}/evaluate { teacherScore, teacherFeedback }
// Option-1 (user-approved): real grading is a single 0–100 score + feedback. The proto's
// per-dimension rubric, AI confidence %, and auto-quiz per-item breakdown have no backing
// data → dropped (backend backlog). Everything else is the proto visual.
// ─────────────────────────────────────────────────────────────────────────────

interface GradingQueueItem {
  id: number
  assignmentId: number
  studentId: number
  studentName: string
  studentEmail: string
  topic: string
  description: string
  assignmentType: string
  dueDate: string | null
  classId: number
  className: string
  status: string
  submittedAt: string | null
  submissionContent: string | null
  submissionFileUrl: string | null
  score: number | null
  feedback: string | null
  attachmentUrl: string | null
}

interface GradingStats {
  totalPending: number
  totalGraded: number
  byClass: { classId: number; className: string; pending: number; graded: number }[]
}

type Tone = 'violet' | 'blue' | 'green' | 'teal' | 'orange' | 'muted'
const TONE_FG: Record<Tone, string> = {
  violet: 'var(--ga-violet)', blue: 'var(--ga-blue)', green: 'var(--ga-green)',
  teal: 'var(--ga-teal)', orange: 'var(--ga-orange)', muted: 'var(--ga-muted)',
}
const TONE_BG: Record<Tone, string> = {
  violet: 'var(--ga-violet-soft)', blue: 'var(--ga-blue-soft)', green: 'var(--ga-green-soft)',
  teal: 'var(--ga-teal-soft)', orange: 'var(--ga-orange-soft)', muted: 'var(--ga-side-active)',
}

const TYPE_META: Record<string, { label: string; tone: Tone; Icon: typeof Mic }> = {
  SPEAKING_SCENARIO: { label: 'Luyện Nói AI', tone: 'violet', Icon: Mic },
  ESSAY: { label: 'Viết luận', tone: 'blue', Icon: PenLine },
  WRITING: { label: 'Viết · Schreiben', tone: 'blue', Icon: PenLine },
  MOCK_TEST: { label: 'Thi thử', tone: 'orange', Icon: FileText },
  VOCABULARY: { label: 'Từ vựng', tone: 'green', Icon: BookOpen },
  GRAMMAR: { label: 'Ngữ pháp', tone: 'teal', Icon: SpellCheck },
  GENERAL: { label: 'Bài tập chung', tone: 'muted', Icon: FileText },
}
const metaOf = (type: string) => TYPE_META[type] ?? TYPE_META.GENERAL

// Honest medium-based filter (the proto's manual/auto split doesn't exist in real data).
type Bucket = 'all' | 'speaking' | 'written'
const BUCKETS: TkSegOption<Bucket>[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'speaking', label: 'Nói AI' },
  { value: 'written', label: 'Bài viết' },
]
const bucketOf = (type: string): Exclude<Bucket, 'all'> =>
  type === 'SPEAKING_SCENARIO' ? 'speaking' : 'written'

const isImageUrl = (url: string) => /\.(png|jpe?g|gif|webp|avif|svg)(\?|$)/i.test(url)
const wordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length
const initial = (name: string) => (name.trim()[0] ?? '?').toUpperCase()
// Deterministic decorative waveform bar heights from a submission id.
const waveBars = (id: number): number[] =>
  [8, 12, 20, 16, 24, 10, 18, 14, 22, 9, 15, 11, 19, 7, 13, 21, 17, 6, 23, 10].map((h) => Math.max(5, (h + (id % 7)) % 26))

interface Draft { score: number | ''; feedback: string }

export default function V2TeacherGradingPage() {
  const [queue, setQueue] = useState<GradingQueueItem[]>([])
  const [stats, setStats] = useState<GradingStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [filter, setFilter] = useState<Bucket>('all')
  const [activeId, setActiveId] = useState<number | null>(null)

  // Per-item editing drafts (preserved while switching between submissions).
  const [drafts, setDrafts] = useState<Record<number, Draft>>({})
  const [aiSuggested, setAiSuggested] = useState<Record<number, boolean>>({})

  // Transient per-active state.
  const [saving, setSaving] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [panelError, setPanelError] = useState('')
  const [panelSuccess, setPanelSuccess] = useState('')
  const pollRef = useRef(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [q, s] = await Promise.all([
        api.get<GradingQueueItem[]>('/v2/teacher/grading/queue'),
        api.get<GradingStats>('/v2/teacher/grading/stats').catch(() => ({ data: null })),
      ])
      const rows = q.data ?? []
      setQueue(rows)
      setStats((s.data as GradingStats | null) ?? null)
      setActiveId((prev) => (prev && rows.some((r) => r.id === prev) ? prev : rows[0]?.id ?? null))
      setError('')
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    return () => { pollRef.current = false }
  }, [load])

  const filtered = useMemo(
    () => queue.filter((g) => filter === 'all' || bucketOf(g.assignmentType) === filter),
    [queue, filter],
  )
  const active = useMemo(() => queue.find((g) => g.id === activeId) ?? null, [queue, activeId])

  // Reset transient panel state when the active submission changes.
  useEffect(() => {
    setPanelError('')
    setPanelSuccess('')
    setAiLoading(false)
  }, [activeId])

  const draft: Draft = active
    ? drafts[active.id] ?? { score: active.score ?? '', feedback: active.feedback ?? '' }
    : { score: '', feedback: '' }

  const setDraft = (patch: Partial<Draft>) => {
    if (!active) return
    setDrafts((d) => ({ ...d, [active.id]: { ...draft, ...patch } }))
  }

  const advance = (savedId: number) => {
    const next = filtered.find((g) => g.id !== savedId)
    setQueue((prev) => prev.filter((g) => g.id !== savedId))
    setStats((prev) =>
      prev ? { ...prev, totalPending: Math.max(0, prev.totalPending - 1), totalGraded: prev.totalGraded + 1 } : prev,
    )
    setActiveId(next?.id ?? null)
  }

  // ── Real AI grade: trigger async, then poll the per-assignment submissions endpoint ──
  const cleanFailure = (fb: string | null) => {
    const raw = (fb ?? '').replace(/^\[AI ch[aấ]m l[oỗ]i\]\s*/i, '').trim()
    return raw ? `AI chấm bài thất bại: ${raw}` : 'AI chấm bài thất bại. Vui lòng tự chấm điểm.'
  }

  const runAiGrade = async () => {
    if (!active) return
    const current = active
    setAiLoading(true)
    setPanelError('')
    try {
      await api.post(`/v2/teacher/assignments/${current.id}/ai-grade`)
      const MAX = 8, INTERVAL = 3000
      for (let attempt = 0; attempt < MAX; attempt++) {
        await new Promise((r) => setTimeout(r, INTERVAL))
        if (!pollRef.current) return
        try {
          const res = await api.get(
            `/v2/teacher/grading/classes/${current.classId}/assignments/${current.assignmentId}/submissions`,
          )
          const rows = (res.data ?? []) as Array<{ submissionId: number | null; status: string; score: number | null; feedback: string | null }>
          const row = rows.find((r) => r.submissionId === current.id)
          if (!row) continue
          if (row.status === 'GRADING_FAILED') {
            setPanelError(cleanFailure(row.feedback))
            setAiLoading(false)
            return
          }
          if ((row.status === 'GRADED' || row.status === 'EVALUATED') && row.score !== null) {
            setDrafts((d) => ({ ...d, [current.id]: { score: row.score as number, feedback: row.feedback ?? '' } }))
            setAiSuggested((m) => ({ ...m, [current.id]: true }))
            setAiLoading(false)
            return
          }
        } catch {
          // transient — keep polling
        }
      }
      setPanelError('AI vẫn đang xử lý. Vui lòng thử lại sau giây lát.')
      setAiLoading(false)
    } catch {
      setPanelError('Lỗi khi gọi AI chấm bài')
      setAiLoading(false)
    }
  }

  const save = async () => {
    if (!active) return
    if (draft.score === '') { setPanelError('Vui lòng nhập điểm số'); return }
    setSaving(true)
    setPanelError('')
    setPanelSuccess('')
    try {
      await api.post(`/v2/teacher/assignments/${active.id}/evaluate`, {
        teacherScore: Number(draft.score),
        teacherFeedback: draft.feedback,
      })
      setPanelSuccess('Đã lưu điểm thành công!')
      toast.success(`Đã lưu điểm cho ${active.studentName}`)
      const savedId = active.id
      setTimeout(() => advance(savedId), 700)
    } catch (e: unknown) {
      setPanelError(apiMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const graded = stats?.totalGraded ?? 0
  const total = (stats?.totalPending ?? 0) + graded
  const pct = total ? (graded / total) * 100 : 0

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <GaPageHdr
        accent
        title="Trung tâm Chấm bài"
        subtitle="AI chấm sơ bộ · giáo viên xác nhận điểm & nhận xét"
        right={
          stats ? (
            <div className="flex items-center gap-2.5">
              <span className="block h-1.5 w-[90px] bg-ga-line">
                <span className="block h-full bg-ga-green transition-[width] duration-300" style={{ width: `${pct}%` }} />
              </span>
              <span className="ga-ui text-[12.5px] font-semibold text-ga-muted">
                {graded}/{total} đã chấm
              </span>
            </div>
          ) : undefined
        }
      />

      <div className="grid min-h-0 flex-1 overflow-x-auto [&>*]:min-w-0" style={{ gridTemplateColumns: 'minmax(200px,232px) minmax(360px,1fr) minmax(300px,330px)' }}>
        {/* ── Queue ── */}
        <div className="flex flex-col overflow-auto border-r border-ga-line bg-ga-card">
          <div className="px-3.5 pb-2.5 pt-3.5">
            <GaCap className="mb-2.5 block">Hàng đợi chấm</GaCap>
            <TkSeg options={BUCKETS} value={filter} onValueChange={setFilter} className="w-full [&>button]:flex-1" aria-label="Lọc loại bài" />
          </div>

          {loading ? (
            Array.from({ length: 5 }).map((_, i) => <div key={i} className="ga-shimmer mx-3.5 mb-2 h-[52px]" aria-hidden />)
          ) : filtered.length === 0 ? (
            <div className="px-4 py-6 text-center text-[13px] text-ga-muted">
              {queue.length === 0 ? 'Không có bài chờ chấm 🎉' : 'Không có bài loại này.'}
            </div>
          ) : (
            filtered.map((g) => {
              const m = metaOf(g.assignmentType)
              const on = g.id === activeId
              const failed = g.status === 'GRADING_FAILED'
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setActiveId(g.id)}
                  className="flex w-full items-center gap-2.5 border-l-[3px] px-3.5 py-[11px] text-left transition-colors"
                  style={{
                    background: on ? 'var(--ga-violet-soft)' : 'transparent',
                    borderLeftColor: on ? 'var(--ga-violet)' : 'transparent',
                  }}
                >
                  <span
                    className="grid h-[30px] w-[30px] shrink-0 place-items-center font-ga-display text-[14px] font-medium text-ga-bg"
                    style={{ background: 'var(--ga-ink)' }}
                  >
                    {initial(g.studentName)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-ga-ink">{g.studentName}</span>
                    <span className="mt-[3px] flex items-center gap-1.5">
                      <m.Icon size={13} style={{ color: TONE_FG[m.tone] }} />
                      <span className="truncate text-[11px] text-ga-muted">{m.label}</span>
                    </span>
                  </span>
                  {failed && <AlertTriangle size={14} className="shrink-0 text-ga-red" />}
                </button>
              )
            })
          )}
        </div>

        {/* ── Submission viewer ── */}
        <div className="overflow-auto border-r border-ga-line px-[30px] py-6">
          {error ? (
            <div className="border border-ga-line bg-ga-card px-10 py-[52px] text-center">
              <h2 className="font-ga-display text-[24px] font-medium text-ga-red">Không tải được hàng đợi</h2>
              <p className="ga-ui mx-auto mb-5 mt-3 max-w-sm text-[14px] text-ga-muted">
                {error} <code className="font-mono text-[12px] text-ga-accent">GET /api/v2/teacher/grading/queue</code>
              </p>
              <GaBtn variant="primary" onClick={load}>Thử lại</GaBtn>
            </div>
          ) : !active ? (
            <div className="grid h-full place-items-center text-center">
              <div>
                <CheckCircle2 size={40} className="mx-auto mb-3 text-ga-green" />
                <p className="font-ga-display text-[22px] font-medium text-ga-ink">Đã chấm hết bài</p>
                <p className="ga-ui mt-1.5 text-[14px] text-ga-muted">Chưa có bài nộp nào chờ chấm.</p>
              </div>
            </div>
          ) : (
            <Submission item={active} />
          )}
        </div>

        {/* ── Scoring (single score + feedback + real AI suggest) ── */}
        <div className="overflow-auto bg-ga-card px-[22px] py-6">
          {active && (
            <Scoring
              item={active}
              draft={draft}
              setDraft={setDraft}
              suggested={!!aiSuggested[active.id]}
              aiLoading={aiLoading}
              onAi={runAiGrade}
              saving={saving}
              onSave={save}
              error={panelError}
              success={panelSuccess}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ── Submission viewer (varies by type) ──────────────────────────────────────
function Submission({ item }: { item: GradingQueueItem }) {
  const m = metaOf(item.assignmentType)
  const isSpeaking = item.assignmentType === 'SPEAKING_SCENARIO'
  const serif = item.assignmentType === 'ESSAY' || item.assignmentType === 'WRITING'

  return (
    <>
      <div className="mb-[18px] flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center font-ga-display text-[18px] font-medium text-ga-bg" style={{ background: 'var(--ga-ink)' }}>
          {initial(item.studentName)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[16px] font-bold text-ga-ink">{item.studentName}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12.5px] text-ga-muted">
            <span className="truncate">{item.className}</span>
            {item.submittedAt && (
              <span className="flex items-center gap-1"><Clock size={11} /> {format(new Date(item.submittedAt), 'dd/MM HH:mm')}</span>
            )}
          </div>
        </div>
        <span
          className="inline-flex shrink-0 items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.04em]"
          style={{ color: TONE_FG[m.tone], background: TONE_BG[m.tone] }}
        >
          <m.Icon size={14} /> {m.label}
        </span>
      </div>

      {/* Prompt / task */}
      <div className="mb-3.5 border border-ga-line bg-ga-bg px-[18px] py-[15px]">
        <GaCap className="mb-2 block">{isSpeaking ? 'Câu hỏi / Tình huống' : 'Đề bài'}</GaCap>
        <div className="font-ga-display text-[15.5px] italic leading-[1.55] text-ga-ink">{item.topic}</div>
        {item.description && <p className="ga-ui mt-2 text-[13.5px] leading-[1.6] text-ga-muted">{item.description}</p>}
      </div>

      {/* Submission content */}
      {item.submissionContent ? (
        isSpeaking ? (
          <div className="mb-[18px] border px-[18px] py-[15px]" style={{ background: 'var(--ga-yellow-soft)', borderColor: 'var(--ga-yellow)' }}>
            <GaCap className="mb-2 block" style={{ color: '#8B7000' }}>Câu trả lời của học viên</GaCap>
            <div className="text-[15px] leading-[1.65] text-ga-ink">{item.submissionContent}</div>
          </div>
        ) : (
          <>
            <div className="mb-2 flex items-center justify-between">
              <GaCap>Bài làm của học viên</GaCap>
              <span className="text-[12px] text-ga-muted">{wordCount(item.submissionContent)} từ</span>
            </div>
            <div
              className="whitespace-pre-wrap border border-ga-line bg-ga-card px-[22px] py-[18px] text-[15px] leading-[1.75] text-ga-ink"
              style={serif ? { fontFamily: 'var(--ga-display)' } : undefined}
            >
              {item.submissionContent}
            </div>
          </>
        )
      ) : (
        !item.submissionFileUrl && (
          <div className="border border-dashed border-ga-line bg-ga-bg px-4 py-8 text-center text-[13.5px] text-ga-muted">
            Không có nội dung văn bản — chấm thủ công theo file đính kèm.
          </div>
        )
      )}

      {/* Audio (speaking with a recording) — decorative waveform + real controls */}
      {isSpeaking && item.submissionFileUrl && (
        <div className="mt-3.5 border border-ga-line bg-ga-card px-4 py-3">
          <div className="flex items-center gap-3.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full" style={{ background: 'var(--ga-ink)' }}>
              <Play size={16} className="text-ga-bg" fill="currentColor" />
            </span>
            <span className="flex h-7 flex-1 items-center gap-[2px]" aria-hidden>
              {waveBars(item.id).map((h, i) => (
                <span key={i} className="flex-1" style={{ height: h, background: i < 8 ? 'var(--ga-yellow)' : 'var(--ga-line)' }} />
              ))}
            </span>
          </div>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio controls preload="none" src={item.submissionFileUrl} className="mt-2.5 h-8 w-full" />
        </div>
      )}

      {/* File / image attachments */}
      {item.submissionFileUrl && !isSpeaking && (
        isImageUrl(item.submissionFileUrl) ? (
          <div className="mt-3.5">
            <GaCap className="mb-2 block">Ảnh bài nộp</GaCap>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.submissionFileUrl} alt="Bài nộp của học viên" className="max-h-[360px] w-full border border-ga-line object-contain" />
          </div>
        ) : (
          <a href={item.submissionFileUrl} target="_blank" rel="noopener noreferrer"
            className="mt-3.5 inline-flex items-center gap-2 text-[13.5px] font-semibold text-ga-accent hover:underline">
            <FileText size={15} /> Xem file đính kèm <ExternalLink size={13} />
          </a>
        )
      )}

      {item.attachmentUrl && (
        <a href={item.attachmentUrl} target="_blank" rel="noopener noreferrer"
          className="mt-2.5 ml-1 inline-flex items-center gap-2 text-[12.5px] font-medium text-ga-muted hover:text-ga-ink hover:underline">
          <FileText size={14} /> Tài liệu đề bài <ExternalLink size={12} />
        </a>
      )}
    </>
  )
}

// ── Scoring panel (single score + feedback + real AI suggest) ────────────────
const SCORE_STEPS = [60, 65, 70, 75, 80, 85, 90, 95, 100]

interface ScoringProps {
  item: GradingQueueItem
  draft: Draft
  setDraft: (patch: Partial<Draft>) => void
  suggested: boolean
  aiLoading: boolean
  onAi: () => void
  saving: boolean
  onSave: () => void
  error: string
  success: string
}

function Scoring({ item, draft, setDraft, suggested, aiLoading, onAi, saving, onSave, error, success }: ScoringProps) {
  const isAiGradable = item.assignmentType !== 'SPEAKING_SCENARIO'
  const hasText = !!item.submissionContent

  return (
    <>
      {/* AI suggest */}
      {isAiGradable && (
        <div className="mb-[18px] border p-4" style={{ background: 'var(--ga-violet-soft)', borderColor: 'color-mix(in srgb, var(--ga-violet) 35%, transparent)' }}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="ga-ui flex items-center gap-1.5 text-[12.5px] font-bold uppercase tracking-[0.04em]" style={{ color: 'var(--ga-violet)' }}>
                <Sparkles size={14} /> Chấm bằng AI
              </p>
              <p className="ga-ui mt-1 text-[12px] text-ga-muted">AI đọc bài làm → đề xuất điểm + nhận xét</p>
            </div>
            <button
              type="button"
              onClick={onAi}
              disabled={aiLoading || !hasText}
              title={!hasText ? 'Bài nộp không có nội dung văn bản để AI chấm' : undefined}
              className="ga-ui inline-flex shrink-0 items-center gap-2 rounded-ga px-4 py-2 text-[13px] font-bold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
              style={{ background: 'var(--ga-violet)' }}
            >
              {aiLoading ? <><Loader2 size={15} className="animate-spin" /> Đang chấm…</> : <><Sparkles size={15} /> Chấm AI</>}
            </button>
          </div>
          {!hasText && (
            <p className="ga-ui mt-2 flex items-start gap-1 text-[11.5px]" style={{ color: 'var(--ga-violet)' }}>
              <AlertCircle size={13} className="mt-0.5 shrink-0" />
              Bài chỉ có file/ảnh đính kèm — hãy chấm thủ công hoặc dùng &quot;Chấm ảnh bài viết tay&quot;.
            </p>
          )}
          {suggested && (
            <p className="ga-ui mt-2 flex items-center gap-1 text-[11.5px] font-medium" style={{ color: 'var(--ga-violet)' }}>
              <CheckCircle2 size={13} /> AI đã đề xuất — bạn có thể chỉnh trước khi lưu.
            </p>
          )}
        </div>
      )}

      <GaCap className="mb-3.5 block">Giáo viên xác nhận điểm</GaCap>

      {/* Score: quick steps + exact input */}
      <div className="mb-4">
        <div className="mb-2.5 flex items-center justify-between">
          <span className="ga-ui text-[13px] font-semibold text-ga-ink">
            Điểm số <span className="text-ga-muted">(0–100)</span>
            {suggested && (
              <span className="ml-2 rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ color: 'var(--ga-violet)', background: 'var(--ga-violet-soft)' }}>
                Đề xuất từ AI
              </span>
            )}
          </span>
          {draft.score !== '' && <span className="font-ga-display text-[20px] font-medium text-ga-ink">{draft.score}</span>}
        </div>
        <div className="mb-2.5 flex flex-wrap gap-1.5">
          {SCORE_STEPS.map((s) => {
            const on = draft.score === s
            return (
              <button
                key={s}
                type="button"
                onClick={() => setDraft({ score: s })}
                className="ga-ui h-[30px] w-10 text-[12px] font-semibold transition-colors"
                style={{
                  background: on ? 'var(--ga-violet)' : 'transparent',
                  color: on ? '#fff' : 'var(--ga-muted)',
                  border: `1px solid ${on ? 'var(--ga-violet)' : 'var(--ga-line)'}`,
                }}
              >
                {s}
              </button>
            )
          })}
        </div>
        <input
          type="number"
          min={0}
          max={100}
          value={draft.score}
          onChange={(e) => setDraft({ score: e.target.value === '' ? '' : Math.max(0, Math.min(100, Number(e.target.value))) })}
          placeholder="Nhập điểm chính xác 0–100"
          className="ga-ui block w-full border border-ga-line bg-ga-bg px-3 py-2.5 text-[15px] font-semibold text-ga-ink outline-none focus:border-ga-accent"
        />
      </div>

      {/* Feedback */}
      <div className="border-t border-ga-line pt-4">
        <label className="ga-ui mb-2 block text-[12.5px] font-semibold text-ga-muted">
          Nhận xét cho học viên
          {suggested && (
            <span className="ml-2 rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ color: 'var(--ga-violet)', background: 'var(--ga-violet-soft)' }}>
              Đề xuất từ AI
            </span>
          )}
        </label>
        <textarea
          value={draft.feedback}
          onChange={(e) => setDraft({ feedback: e.target.value })}
          placeholder="Nhận xét về ngữ pháp, từ vựng, cấu trúc câu…"
          rows={5}
          className="ga-ui block w-full resize-y border border-ga-line bg-ga-bg px-3 py-2.5 text-[14px] leading-[1.6] text-ga-ink outline-none focus:border-ga-accent"
        />
      </div>

      {error && (
        <div className="mt-3.5 flex items-center gap-2 border px-3 py-2.5 text-[13px] font-medium" style={{ color: 'var(--ga-red)', background: 'var(--ga-red-soft)', borderColor: 'color-mix(in srgb, var(--ga-red) 30%, transparent)' }}>
          <AlertCircle size={16} className="shrink-0" /> {error}
        </div>
      )}
      {success && (
        <div className="mt-3.5 flex items-center gap-2 border px-3 py-2.5 text-[13px] font-medium" style={{ color: 'var(--ga-green)', background: 'var(--ga-green-soft)', borderColor: 'color-mix(in srgb, var(--ga-green) 30%, transparent)' }}>
          <CheckCircle2 size={16} className="shrink-0" /> {success}
        </div>
      )}

      <GaBtn
        variant="yellow"
        onClick={onSave}
        loading={saving}
        disabled={saving || draft.score === ''}
        className="mt-[18px] w-full"
      >
        <Save size={16} /> Lưu &amp; Tiếp theo →
      </GaBtn>
    </>
  )
}
