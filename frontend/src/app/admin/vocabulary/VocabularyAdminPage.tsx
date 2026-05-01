'use client'

import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertTriangle, Check, CheckCircle2, ChevronLeft, ChevronRight,
  Database, Filter, Loader2, Pencil, RefreshCw, RotateCcw,
  Save, Search, X, XCircle, Zap,
} from 'lucide-react'
import { useLocale } from 'next-intl'
import api, { apiMessage } from '@/lib/api'
import AdminShell from '@/components/admin/AdminShell'

// ─── Types ────────────────────────────────────────────────────────────────────

type WordItem = {
  id: number; dtype: string; baseForm: string; cefrLevel: string
  phonetic?: string | null; meaning?: string | null; meaningEn?: string | null
  example?: string | null; exampleDe?: string | null; exampleEn?: string | null
  usageNote?: string | null; gender?: string | null; article?: string | null
  genderColor?: string | null; tags?: string[] | null
  nounDetails?: { pluralForm?: string | null; genitiveForm?: string | null } | null
}
type WordListResponse = { items: WordItem[]; page: number; size: number; total: number }
type TagItem = { id: number; name: string; color?: string | null; localizedLabel?: string | null }

// ─── Constants ────────────────────────────────────────────────────────────────

const GENDER_COLORS: Record<string, string> = { DER: '#3b82f6', DIE: '#ef4444', DAS: '#22c55e' }
const CEFR_COLORS: Record<string, { bg: string; text: string }> = {
  A1: { bg: '#F0FDF4', text: '#065F46' }, A2: { bg: '#EFF6FF', text: '#1E40AF' },
  B1: { bg: '#FFFBEB', text: '#92400E' }, B2: { bg: '#F5F3FF', text: '#4C1D95' },
  C1: { bg: '#FFF1F2', text: '#9F1239' }, C2: { bg: '#F0F9FF', text: '#0C4A6E' },
}
const PAGE_SIZE = 25

async function adminPost(path: string, params?: Record<string, string | number | boolean>) {
  const qs = params ? '?' + new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString() : ''
  const res = await api.post(path + qs)
  return res.data
}

async function adminGet(path: string) {
  const res = await api.get(path)
  return res.data as Record<string, unknown>
}

// ─── Edit Card ────────────────────────────────────────────────────────────────

type EditForm = {
  baseForm: string; cefrLevel: string; dtype: string; phonetic: string
  meaningVi: string; meaningEn: string; exampleDe: string; exampleEn: string
  usageNote: string; gender: string; pluralForm: string
}

function EditWordCard({
  word,
  onClose,
  onSaved,
}: {
  word: WordItem
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<EditForm>({
    baseForm:   word.baseForm,
    cefrLevel:  word.cefrLevel,
    dtype:      word.dtype,
    phonetic:   word.phonetic ?? '',
    meaningVi:  word.meaning ?? '',
    meaningEn:  word.meaningEn ?? '',
    exampleDe:  word.exampleDe ?? word.example ?? '',
    exampleEn:  word.exampleEn ?? '',
    usageNote:  word.usageNote ?? '',
    gender:     word.gender ?? '',
    pluralForm: word.nounDetails?.pluralForm ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const set = (k: keyof EditForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const save = async () => {
    setSaving(true); setError('')
    try {
      await api.patch(`/admin/vocabulary/${word.id}`, form)
      setSaved(true)
      setTimeout(() => { setSaved(false); onSaved(); onClose() }, 800)
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally { setSaving(false) }
  }

  const Field = ({ label, k, type = 'text', rows }: { label: string; k: keyof EditForm; type?: string; rows?: number }) => (
    <div>
      <label className="block text-xs font-semibold text-[#64748B] mb-1">{label}</label>
      {rows ? (
        <textarea
          value={form[k]}
          onChange={set(k)}
          rows={rows}
          className="w-full px-3 py-2 rounded-[8px] border border-[#E2E8F0] text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#00305E]/20 resize-none"
        />
      ) : (
        <input
          type={type}
          value={form[k]}
          onChange={set(k)}
          className="w-full px-3 py-2 rounded-[8px] border border-[#E2E8F0] text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#00305E]/20"
        />
      )}
    </div>
  )

  const Select = ({ label, k, opts }: { label: string; k: keyof EditForm; opts: string[] }) => (
    <div>
      <label className="block text-xs font-semibold text-[#64748B] mb-1">{label}</label>
      <select
        value={form[k]}
        onChange={set(k)}
        className="w-full px-3 py-2 rounded-[8px] border border-[#E2E8F0] text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#00305E]/20 bg-white"
      >
        <option value="">— chọn —</option>
        {opts.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Card */}
      <motion.div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-[20px] shadow-2xl"
        initial={{ scale: 0.95, y: 16, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.95, y: 16, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-[#00305E] rounded-t-[20px]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[10px] bg-white/15 flex items-center justify-center">
              <Pencil size={16} className="text-white" />
            </div>
            <div>
              <h2 className="font-bold text-white text-base">{word.baseForm}</h2>
              <p className="text-white/50 text-xs">ID #{word.id} · {word.dtype}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-[8px] hover:bg-white/10 text-white/70 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">

          {/* Thông tin cơ bản */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#94A3B8] mb-3">Thông tin cơ bản</h3>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Từ gốc (base_form)" k="baseForm" />
              <Field label="Phát âm IPA" k="phonetic" />
              <Select label="Cấp độ CEFR" k="cefrLevel" opts={['A1','A2','B1','B2','C1','C2']} />
              <Select label="Loại từ" k="dtype" opts={['Noun','Verb','Adjective','Word']} />
            </div>
          </section>

          {/* Giống (chỉ Noun) */}
          {(form.dtype === 'Noun' || word.dtype === 'Noun') && (
            <section>
              <h3 className="text-xs font-bold uppercase tracking-widest text-[#94A3B8] mb-3">Danh từ</h3>
              <div className="grid grid-cols-2 gap-3">
                <Select label="Giống (Gender)" k="gender" opts={['DER','DIE','DAS']} />
                <Field label="Số nhiều (Plural)" k="pluralForm" />
              </div>
              {form.gender && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-[#64748B]">Preview:</span>
                  <span className="inline-flex px-2.5 py-1 rounded text-xs font-bold text-white"
                    style={{ backgroundColor: GENDER_COLORS[form.gender] ?? '#94A3B8' }}>
                    {form.gender}
                  </span>
                  <span className="text-sm font-semibold text-[#0F172A]">
                    {form.gender === 'DER' ? 'der' : form.gender === 'DIE' ? 'die' : 'das'} {form.baseForm}
                  </span>
                  {form.pluralForm && <span className="text-[#94A3B8] text-xs">· Pl: {form.pluralForm}</span>}
                </div>
              )}
            </section>
          )}

          {/* Nghĩa */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#94A3B8] mb-3">Nghĩa</h3>
            <div className="grid grid-cols-1 gap-3">
              <Field label="Nghĩa tiếng Việt" k="meaningVi" />
              <Field label="Nghĩa tiếng Anh" k="meaningEn" />
            </div>
          </section>

          {/* Ví dụ */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#94A3B8] mb-3">Ví dụ câu</h3>
            <div className="grid grid-cols-1 gap-3">
              <Field label="Ví dụ tiếng Đức (example_de)" k="exampleDe" rows={2} />
              <Field label="Ví dụ tiếng Anh (example_en)" k="exampleEn" rows={2} />
            </div>
          </section>

          {/* Cách dùng */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#94A3B8] mb-3">Cách sử dụng</h3>
            <Field label="Ghi chú cách dùng (usage_note)" k="usageNote" rows={3} />
          </section>

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 border border-red-200 rounded-[8px] px-3 py-2">
              <XCircle size={13} /> {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-between px-6 py-4 bg-[#FAFBFC] border-t border-[#E2E8F0] rounded-b-[20px]">
          <button onClick={onClose} className="px-4 py-2 rounded-[10px] text-[#64748B] hover:bg-[#E2E8F0] text-sm font-medium transition-colors">
            Hủy
          </button>
          <button
            onClick={save}
            disabled={saving || saved}
            className="flex items-center gap-2 px-5 py-2.5 rounded-[10px] text-white text-sm font-semibold transition-all disabled:opacity-70"
            style={{ background: saved ? '#10b981' : '#00305E' }}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : <Save size={14} />}
            {saving ? 'Đang lưu…' : saved ? 'Đã lưu!' : 'Lưu thay đổi'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Auto Topic Tagging Panel ─────────────────────────────────────────────────

function AutoTagPanel({ onDone }: { onDone: () => void }) {
  const [limit, setLimit] = useState(100)
  const [dryRun, setDryRun] = useState(true)
  const [resetTags, setResetTags] = useState(false)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState('')
  const [taxSummary, setTaxSummary] = useState<Record<string, unknown> | null>(null)

  const refreshTaxSummary = useCallback(() => {
    adminGet('/admin/vocabulary/taxonomy-summary').then(setTaxSummary).catch(() => {})
  }, [])

  useEffect(() => {
    refreshTaxSummary()
  }, [refreshTaxSummary, result])

  const run = async () => {
    if (!dryRun && resetTags) {
      const ok =
        typeof window !== 'undefined' &&
        window.confirm(
          'Sẽ xóa liên kết chủ đề taxonomy (chỉ tag is_topic_taxonomy) trước khi gán lại. Hãy sao lưu DB. Tiếp tục?',
        )
      if (!ok) return
    }
    setRunning(true)
    setResult(null)
    setError('')
    try {
      const data = await adminPost('/admin/vocabulary/auto-tag/batch', { limit, dryRun, resetTags })
      setResult(data)
      if (!dryRun) onDone()
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      setRunning(false)
    }
  }

  const pct = taxSummary?.percentWordsWithTopicTag != null ? String(taxSummary.percentWordsWithTopicTag) : null

  return (
    <div className="bg-white rounded-[16px] border border-[#E2E8F0] shadow-sm overflow-hidden">
      <div className="px-5 py-4 flex items-center gap-3 border-b border-[#F1F5F9]">
        <div className="w-9 h-9 rounded-[10px] flex items-center justify-center bg-purple-50">
          <span className="text-lg">🏷️</span>
        </div>
        <div>
          <h3 className="font-semibold text-[#0F172A] text-sm">AI Auto-Tagging theo chủ đề</h3>
          <p className="text-[#94A3B8] text-xs">
            Keyword rules + LLM. Reset chỉ xóa facet chủ đề (không đụng tag nguồn import như GOETHE_AUTO).
            {taxSummary && (
              <>
                {' '}
                · Topic tags: {String(taxSummary.topicTagCount ?? '—')} · Độ phủ:&nbsp;
                {pct}%
                ({String(taxSummary.wordsWithTopicTag ?? '—')} / {String(taxSummary.totalWords ?? '—')} từ)
              </>
            )}
          </p>
        </div>
      </div>
      <div className="px-5 py-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-xs text-[#64748B] font-medium block mb-1">Limit</label>
          <input type="number" className="border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-sm w-24 focus:outline-none focus:border-purple-400"
            value={limit} onChange={e => setLimit(Number(e.target.value))} />
        </div>
        <label className="flex items-center gap-1.5 text-sm text-[#475569] cursor-pointer">
          <input type="checkbox" checked={dryRun} onChange={e => setDryRun(e.target.checked)} className="rounded" />
          Dry Run (preview only)
        </label>
        <label className="flex items-center gap-1.5 text-sm text-[#475569] cursor-pointer">
          <input type="checkbox" checked={resetTags} onChange={e => setResetTags(e.target.checked)} className="rounded" />
          Reset topic taxonomy links
        </label>
        <button onClick={run} disabled={running}
          className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
          style={{ background: dryRun ? '#f3e8ff' : 'linear-gradient(135deg,#a78bfa,#7c3aed)', color: dryRun ? '#7c3aed' : 'white' }}>
          {running ? 'Running…' : dryRun ? '🔍 Preview' : '🚀 Apply'}
        </button>
      </div>
      {error && <p className="px-5 pb-3 text-xs text-red-500">{error}</p>}
      {result && (
        <div className="px-5 pb-4 space-y-1">
          <p className="text-xs text-[#64748B]">
            ✓ Processed: {String(result.wordsProcessed)} · Tagged: {String(result.wordsTagged)} · Tag links:&nbsp;
            {String(result.tagLinksCreated)} · Keyword hits: {String(result.keywordClassifiedWords ?? 0)}
          </p>
          {Array.isArray(result.preview) && result.preview.length > 0 && (
            <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-xs space-y-1">
              {(
                result.preview as Array<{
                  wordId?: number
                  baseForm: string
                  tags: string[]
                  source?: string
                }>
              )
                .slice(0, 50)
                .map((p, i) => (
                  <div key={i} className="flex flex-wrap gap-x-2 gap-y-1">
                    <span className="font-semibold text-[#0F172A] min-w-[100px]">{p.baseForm}</span>
                    {p.wordId != null ? <span className="text-slate-400">#{p.wordId}</span> : null}
                    <span className="text-[10px] uppercase text-slate-500">{p.source ?? ''}</span>
                    <span className="text-purple-600">{p.tags.join(', ')}</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Glosbe VI Panel ──────────────────────────────────────────────────────────

function GlosbeViPanel({ onDone }: { onDone: () => void }) {
  const [limit, setLimit] = useState(30)
  const [resetCursor, setResetCursor] = useState(false)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')

  const run = async () => {
    setRunning(true); setResult(null); setError('')
    try {
      const data = await adminPost('/admin/vocabulary/glosbe-vi/enrich/batch', { limit, resetCursor })
      setResult(data); onDone()
    } catch (e: unknown) { setError(apiMessage(e)) }
    finally { setRunning(false) }
  }

  return (
    <div className="bg-white rounded-[16px] border border-[#E2E8F0] shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-[#F0F4F8] flex items-center gap-3">
        <div className="w-9 h-9 rounded-[10px] bg-[#FFF8E1] flex items-center justify-center">
          <span className="text-lg">🇻🇳</span>
        </div>
        <div>
          <h3 className="font-semibold text-[#0F172A] text-sm">Glosbe DE→VI Enrich</h3>
          <p className="text-[#94A3B8] text-xs">Lấy nghĩa tiếng Việt từ vi.glosbe.com (tự động chạy mỗi 1 phút)</p>
        </div>
      </div>
      <div className="px-5 py-4 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-[#0F172A] mb-1.5">Số từ mỗi lần</label>
            <input type="number" min={1} max={200} value={limit}
              onChange={e => setLimit(Math.max(1, Math.min(200, parseInt(e.target.value) || 30)))}
              className="w-24 px-3 py-2 rounded-[8px] border border-[#E2E8F0] text-sm focus:outline-none focus:ring-2 focus:ring-[#00305E]/20" />
          </div>
          <label className="flex items-center gap-2 cursor-pointer pb-2">
            <div onClick={() => setResetCursor(v => !v)}
              className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${resetCursor ? 'bg-[#00305E]' : 'bg-[#CBD5E1]'}`}>
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${resetCursor ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </div>
            <span className="text-xs text-[#64748B]">Reset cursor</span>
          </label>
          <button onClick={run} disabled={running}
            className="flex items-center gap-2 px-4 py-2 rounded-[8px] bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white text-sm font-semibold transition-colors">
            {running ? <Loader2 size={14} className="animate-spin" /> : <span>🇻🇳</span>}
            {running ? 'Đang chạy…' : 'Chạy ngay'}
          </button>
        </div>
        {error && (
          <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 border border-red-200 rounded-[8px] px-3 py-2">
            <XCircle size={13} /> {error}
          </div>
        )}
        {result && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
            className="bg-[#FFFBEB] border border-amber-200 rounded-[10px] px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 size={13} className="text-amber-600" />
              <span className="text-amber-800 text-xs font-semibold">Hoàn thành — {result.status}</span>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              {[['Đã xử lý', result.processedRows], ['Nghĩa VI', result.viUpserts], ['Lỗi', result.failed]].map(([l, v]) => (
                <span key={String(l)} className="bg-white border border-amber-100 rounded px-2 py-1">
                  {l}: <strong>{v}</strong>
                </span>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function VocabularyAdminPage() {
  const uiLocale = useLocale()
  const [words, setWords] = useState<WordItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState('')
  const [cefr, setCefr] = useState('')
  const [dtype, setDtype] = useState('')
  const [gender, setGender] = useState('')
  const [tag, setTag] = useState('')
  const [tags, setTags] = useState<TagItem[]>([])

  const [editWord, setEditWord] = useState<WordItem | null>(null)
  const [enrichingId, setEnrichingId] = useState<number | null>(null)

  const [batchLimit, setBatchLimit] = useState(50)
  const [resetCursor, setResetCursor] = useState(false)
  const [batchRunning, setBatchRunning] = useState(false)
  const [batchResult, setBatchResult] = useState<any>(null)
  const [batchError, setBatchError] = useState('')

  const [wiktionaryLimit, setWiktionaryLimit] = useState(100)
  const [resetRunning, setResetRunning] = useState(false)
  const [resetResult, setResetResult] = useState<any>(null)
  const [resetError, setResetError] = useState('')
  const [confirmed, setConfirmed] = useState(false)

  // load tags for topic filter
  useEffect(() => {
    api.get<TagItem[]>('/tags', { params: { locale: uiLocale } })
      .then(r => setTags(r.data ?? []))
      .catch(() => setTags([]))
  }, [uiLocale])

  const fetchWords = useCallback(async (p = 0, overrides?: { cefr?: string; dtype?: string; gender?: string; q?: string; tag?: string }) => {
    setLoading(true)
    try {
      const activeCefr  = overrides?.cefr   !== undefined ? overrides.cefr   : cefr
      const activeDtype = overrides?.dtype  !== undefined ? overrides.dtype  : dtype
      const activeGender = overrides?.gender !== undefined ? overrides.gender : gender
      const activeQ     = overrides?.q      !== undefined ? overrides.q      : q
      const activeTag   = overrides?.tag    !== undefined ? overrides.tag    : tag
      const params: Record<string, string> = { page: String(p), size: String(PAGE_SIZE), locale: uiLocale }
      if (activeQ)      params.q      = activeQ
      if (activeCefr)   params.cefr   = activeCefr
      if (activeDtype)  params.dtype  = activeDtype
      if (activeGender) params.gender = activeGender
      if (activeTag)    params.tag    = activeTag
      const res = await api.get('/words', { params })
      const data: WordListResponse = res.data
      setWords(data.items)
      setTotal(data.total)
      setPage(p)
    } catch { setWords([]) }
    finally { setLoading(false) }
  }, [q, cefr, dtype, gender, tag, uiLocale])

  useEffect(() => { fetchWords(0) }, [fetchWords])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const enrichOne = async (wordId: number, e: React.MouseEvent) => {
    e.stopPropagation()
    setEnrichingId(wordId)
    try {
      await adminPost('/admin/vocabulary/wiktionary/enrich/one', { wordId })
      await fetchWords(page)
    } catch { }
    finally { setEnrichingId(null) }
  }

  const runBatch = async () => {
    setBatchRunning(true); setBatchResult(null); setBatchError('')
    try {
      const data = await adminPost('/admin/vocabulary/wiktionary/enrich/batch', { limit: batchLimit, resetCursor })
      setBatchResult(data); fetchWords(page)
    } catch (e: unknown) { setBatchError(apiMessage(e)) }
    finally { setBatchRunning(false) }
  }

  const runReset = async () => {
    setResetRunning(true); setResetResult(null); setResetError('')
    try {
      const data = await adminPost('/admin/vocabulary/reset', { wiktionaryLimit })
      setResetResult(data); setConfirmed(false); fetchWords(0)
    } catch (e: unknown) { setResetError(apiMessage(e)) }
    finally { setResetRunning(false) }
  }

  return (
    <AdminShell title="Quản lý từ vựng" subtitle={`${total.toLocaleString()} từ trong database`} activeNav="vocabulary">
      <div className="space-y-5">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Tổng từ', value: total.toLocaleString(), icon: Database, color: '#00305E' },
            { label: 'Đang hiển thị', value: words.length, icon: Filter, color: '#10b981' },
            { label: 'Trang', value: `${page + 1} / ${totalPages}`, icon: ChevronRight, color: '#f59e0b' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-white rounded-[12px] p-4 border border-[#E2E8F0] shadow-sm flex items-center gap-3">
              <div className="w-9 h-9 rounded-[8px] flex items-center justify-center" style={{ backgroundColor: color + '15' }}>
                <Icon size={16} style={{ color }} />
              </div>
              <div>
                <p className="text-[#0F172A] font-bold text-lg leading-tight">{value}</p>
                <p className="text-[#94A3B8] text-xs">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-[16px] p-4 border border-[#E2E8F0] shadow-sm">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="relative flex-1 min-w-[180px]">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
              <input value={q} onChange={e => setQ(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && fetchWords(0)}
                placeholder="Tìm từ... (Enter)"
                className="w-full pl-8 pr-3 py-2 rounded-[8px] border border-[#E2E8F0] text-sm focus:outline-none focus:ring-2 focus:ring-[#00305E]/15" />
            </div>
            <select value={cefr} onChange={e => { setCefr(e.target.value); fetchWords(0, { cefr: e.target.value }) }}
              className="pl-3 pr-7 py-2 rounded-[8px] border border-[#E2E8F0] text-sm focus:outline-none focus:ring-2 focus:ring-[#00305E]/15 bg-white">
              {['', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map(o => <option key={o} value={o}>{o || 'Cấp độ'}</option>)}
            </select>
            <select value={dtype} onChange={e => { setDtype(e.target.value); fetchWords(0, { dtype: e.target.value }) }}
              className="pl-3 pr-7 py-2 rounded-[8px] border border-[#E2E8F0] text-sm focus:outline-none focus:ring-2 focus:ring-[#00305E]/15 bg-white">
              {['', 'Noun', 'Verb', 'Adjective', 'Word'].map(o => <option key={o} value={o}>{o || 'Loại từ'}</option>)}
            </select>
            <select value={gender} onChange={e => { setGender(e.target.value); fetchWords(0, { gender: e.target.value }) }}
              className="pl-3 pr-7 py-2 rounded-[8px] border border-[#E2E8F0] text-sm focus:outline-none focus:ring-2 focus:ring-[#00305E]/15 bg-white">
              {['', 'DER', 'DIE', 'DAS'].map(o => <option key={o} value={o}>{o || 'Giống'}</option>)}
            </select>
            <select value={tag} onChange={e => { setTag(e.target.value); fetchWords(0, { tag: e.target.value }) }}
              className="pl-3 pr-7 py-2 rounded-[8px] border border-[#E2E8F0] text-sm focus:outline-none focus:ring-2 focus:ring-[#00305E]/15 bg-white min-w-[160px]">
              <option value="">Chủ đề</option>
              {tags.map(t => (
                <option key={t.id} value={t.name}>{t.localizedLabel ?? t.name}</option>
              ))}
            </select>
            <button onClick={() => fetchWords(0)} disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-[8px] bg-[#00305E] text-white text-sm font-semibold hover:bg-[#002447] transition-colors disabled:opacity-60">
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              Tìm kiếm
            </button>
          </div>
        </div>

        {/* Word Table */}
        <div className="bg-white rounded-[16px] border border-[#E2E8F0] shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-[#F0F4F8] flex items-center justify-between">
            <p className="text-sm font-semibold text-[#0F172A]">{total.toLocaleString()} từ</p>
            <p className="text-xs text-[#94A3B8]">Click vào hàng để chỉnh sửa</p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-40 text-[#94A3B8]">
              <Loader2 size={20} className="animate-spin mr-2" /> Đang tải...
            </div>
          ) : words.length === 0 ? (
            <div className="text-center py-16 text-[#94A3B8] text-sm">Không tìm thấy từ nào.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#F0F4F8] bg-[#FAFBFC]">
                    {['ID', 'Từ', 'Loại', 'Cấp', 'Giống', 'IPA', 'Nghĩa VI', 'Nghĩa EN', 'Ví dụ DE', ''].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left text-[#64748B] text-xs font-semibold whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {words.map((w, i) => {
                    const cc = CEFR_COLORS[w.cefrLevel] ?? { bg: '#F5F7FA', text: '#64748B' }
                    const gc = w.gender ? GENDER_COLORS[w.gender] : null
                    const hasMeaning = w.meaning?.trim()
                    const hasIpa = w.phonetic?.trim()
                    return (
                      <motion.tr key={w.id}
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.008 }}
                        onClick={() => setEditWord(w)}
                        className="border-b border-[#F8FAFC] hover:bg-[#EEF4FF] transition-colors cursor-pointer group">
                        <td className="px-3 py-2.5">
                          <span className="font-mono text-[10px] text-[#94A3B8] bg-[#F5F7FA] px-1.5 py-0.5 rounded">{w.id}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1.5">
                            {w.article && <span className="text-xs font-bold" style={{ color: gc ?? '#64748B' }}>{w.article}</span>}
                            <span className="font-semibold text-[#0F172A]">{w.baseForm}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5"><span className="text-xs text-[#64748B]">{w.dtype}</span></td>
                        <td className="px-3 py-2.5">
                          <span className="inline-flex px-2 py-0.5 rounded text-xs font-bold"
                            style={{ backgroundColor: cc.bg, color: cc.text }}>{w.cefrLevel}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          {w.gender && (
                            <span className="inline-flex px-2 py-0.5 rounded text-xs font-bold text-white"
                              style={{ backgroundColor: gc ?? '#94A3B8' }}>{w.gender}</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          {hasIpa
                            ? <span className="text-xs font-mono text-[#00305E]">{w.phonetic}</span>
                            : <span className="text-[#CBD5E1] text-xs">—</span>}
                        </td>
                        <td className="px-3 py-2.5 max-w-[140px]">
                          {hasMeaning
                            ? <span className="text-xs text-[#0F172A] line-clamp-1">{w.meaning}</span>
                            : <span className="text-[#CBD5E1] text-xs">—</span>}
                        </td>
                        <td className="px-3 py-2.5 max-w-[140px]">
                          {w.meaningEn
                            ? <span className="text-xs text-[#64748B] line-clamp-1">{w.meaningEn}</span>
                            : <span className="text-[#CBD5E1] text-xs">—</span>}
                        </td>
                        <td className="px-3 py-2.5 max-w-[160px]">
                          {w.exampleDe
                            ? <span className="text-xs text-[#64748B] line-clamp-1 italic">{w.exampleDe}</span>
                            : <span className="text-[#CBD5E1] text-xs">—</span>}
                        </td>
                        <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={e => enrichOne(w.id, e)} disabled={enrichingId === w.id}
                              title="Enrich từ Wiktionary"
                              className="p-1.5 rounded-[6px] hover:bg-[#EEF4FF] text-[#94A3B8] hover:text-[#00305E] transition-colors disabled:opacity-50">
                              {enrichingId === w.id ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                            </button>
                            <button onClick={() => setEditWord(w)} title="Chỉnh sửa"
                              className="p-1.5 rounded-[6px] hover:bg-[#EEF4FF] text-[#94A3B8] hover:text-[#00305E] transition-colors">
                              <Pencil size={13} />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-[#F0F4F8] bg-[#FAFBFC]">
            <p className="text-xs text-[#94A3B8]">
              {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} / {total.toLocaleString()} từ
            </p>
            <div className="flex items-center gap-1">
              <button onClick={() => fetchWords(Math.max(0, page - 1))} disabled={page === 0 || loading}
                className="p-1.5 rounded border border-[#E2E8F0] disabled:opacity-40 hover:bg-white transition-colors text-[#64748B]">
                <ChevronLeft size={14} />
              </button>
              {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                const start = Math.max(0, Math.min(page - 3, totalPages - 7))
                const p = start + i
                return (
                  <button key={p} onClick={() => fetchWords(p)}
                    className={`w-7 h-7 rounded text-xs font-semibold border transition-colors ${p === page ? 'bg-[#00305E] text-white border-[#00305E]' : 'border-[#E2E8F0] text-[#64748B] hover:bg-white'}`}>
                    {p + 1}
                  </button>
                )
              })}
              <button onClick={() => fetchWords(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1 || loading}
                className="p-1.5 rounded border border-[#E2E8F0] disabled:opacity-40 hover:bg-white transition-colors text-[#64748B]">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Wiktionary Batch */}
        <div className="bg-white rounded-[16px] border border-[#E2E8F0] shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-[#F0F4F8] flex items-center gap-3">
            <div className="w-9 h-9 rounded-[10px] bg-[#EEF4FF] flex items-center justify-center">
              <Zap size={16} className="text-[#00305E]" />
            </div>
            <div>
              <h3 className="font-semibold text-[#0F172A] text-sm">Wiktionary Batch Enrich</h3>
              <p className="text-[#94A3B8] text-xs">Lấy IPA, nghĩa EN, ví dụ DE, giống từ Wiktionary</p>
            </div>
          </div>
          <div className="px-5 py-4 space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs font-medium text-[#0F172A] mb-1.5">Limit mỗi lần chạy</label>
                <input type="number" min={1} max={500} value={batchLimit}
                  onChange={e => setBatchLimit(Math.max(1, Math.min(500, parseInt(e.target.value) || 50)))}
                  className="w-24 px-3 py-2 rounded-[8px] border border-[#E2E8F0] text-sm focus:outline-none focus:ring-2 focus:ring-[#00305E]/20" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer pb-2">
                <div onClick={() => setResetCursor(v => !v)}
                  className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${resetCursor ? 'bg-[#00305E]' : 'bg-[#CBD5E1]'}`}>
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${resetCursor ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </div>
                <span className="text-xs text-[#64748B]">Reset cursor</span>
              </label>
              <button onClick={runBatch} disabled={batchRunning}
                className="flex items-center gap-2 px-4 py-2 rounded-[8px] bg-[#00305E] hover:bg-[#002447] disabled:opacity-60 text-white text-sm font-semibold transition-colors">
                {batchRunning ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                {batchRunning ? 'Đang chạy…' : 'Chạy Batch'}
              </button>
            </div>
            {batchError && (
              <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 border border-red-200 rounded-[8px] px-3 py-2">
                <XCircle size={13} /> {batchError}
              </div>
            )}
            {batchResult && (
              <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                className="bg-[#F0FDF4] border border-emerald-200 rounded-[10px] px-4 py-3">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 size={13} className="text-emerald-600" />
                  <span className="text-emerald-800 text-xs font-semibold">Hoàn thành — {batchResult.status}</span>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  {[['Đã xử lý', batchResult.processedRows], ['IPA', batchResult.ipaFilled],
                    ['EN nghĩa', batchResult.enUpserts], ['DE ví dụ', batchResult.deUpserts],
                    ['Lỗi', batchResult.failed]].map(([l, v]) => (
                    <span key={String(l)} className="bg-white border border-emerald-100 rounded px-2 py-1">
                      {l}: <strong>{v}</strong>
                    </span>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* Auto Topic Tagging */}
        <AutoTagPanel onDone={() => fetchWords(page)} />

        {/* Glosbe VI Enrich */}
        <GlosbeViPanel onDone={() => fetchWords(page)} />

        {/* Reset & Reimport */}
        <div className="bg-white rounded-[16px] border border-red-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-red-100 bg-red-50 flex items-center gap-3">
            <div className="w-9 h-9 rounded-[10px] bg-red-100 flex items-center justify-center">
              <AlertTriangle size={16} className="text-red-600" />
            </div>
            <div>
              <h3 className="font-semibold text-red-900 text-sm">Reset & Reimport toàn bộ từ vựng</h3>
              <p className="text-red-600 text-xs">Xóa TẤT CẢ từ và import lại từ Goethe + Wiktionary</p>
            </div>
          </div>
          <div className="px-5 py-4 space-y-3">
            <div className="bg-[#FEF2F2] border border-red-200 rounded-[10px] px-4 py-3 text-xs text-red-800 space-y-1">
              <p>① Xóa tất cả words, translations, grammar data</p>
              <p>② Import Goethe Official TSV + A1–C1 Auto (~10,000 từ)</p>
              <p>③ Enrich Wiktionary vòng đầu (IPA, nghĩa EN, ví dụ DE, giống)</p>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs font-medium text-[#0F172A] mb-1.5">Wiktionary limit (vòng đầu)</label>
                <input type="number" min={10} max={500} value={wiktionaryLimit}
                  onChange={e => setWiktionaryLimit(Math.max(10, Math.min(500, parseInt(e.target.value) || 100)))}
                  className="w-24 px-3 py-2 rounded-[8px] border border-[#E2E8F0] text-sm focus:outline-none focus:ring-2 focus:ring-red-300" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer pb-2">
                <div onClick={() => setConfirmed(v => !v)}
                  className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${confirmed ? 'bg-red-500' : 'bg-[#CBD5E1]'}`}>
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${confirmed ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </div>
                <span className="text-xs text-red-700 font-medium">Xác nhận xóa tất cả từ vựng</span>
              </label>
              <button onClick={runReset} disabled={resetRunning || !confirmed}
                className="flex items-center gap-2 px-4 py-2 rounded-[8px] bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-semibold transition-colors">
                {resetRunning ? <Loader2 size={14} className="animate-spin" /> : <AlertTriangle size={14} />}
                {resetRunning ? 'Đang chạy…' : 'Reset & Reimport'}
              </button>
            </div>
            {resetError && (
              <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 border border-red-200 rounded-[8px] px-3 py-2">
                <XCircle size={13} /> {resetError}
              </div>
            )}
            {resetResult && (
              <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                className="bg-[#F0FDF4] border border-emerald-200 rounded-[10px] px-4 py-3 space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={13} className="text-emerald-600" />
                  <span className="text-emerald-800 text-xs font-semibold">Reset hoàn thành</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  {[
                    ['Goethe Official', resetResult.goetheOfficial?.status === 'OK' ? `+${resetResult.goetheOfficial.inserted} từ` : 'Lỗi'],
                    ['Goethe A1–C1', resetResult.goetheAuto?.status === 'OK' ? `+${resetResult.goetheAuto.inserted} từ` : 'Lỗi'],
                    ['Wiktionary', resetResult.wiktionaryEnrich?.status === 'OK' ? `${resetResult.wiktionaryEnrich.processedRows} từ` : 'Lỗi'],
                    ['Tổng từ', resetResult.finalStats?.totalWords?.toLocaleString() ?? '—'],
                    ['Có nghĩa', resetResult.finalStats?.wordsWithMeaning?.toLocaleString() ?? '—'],
                    ['Có IPA', resetResult.finalStats?.wordsWithIpa?.toLocaleString() ?? '—'],
                  ].map(([l, v]) => (
                    <div key={String(l)} className="bg-white rounded px-2 py-1.5 border border-emerald-100">
                      <p className="text-[#94A3B8] text-[10px]">{l}</p>
                      <p className="font-bold text-[#0F172A]">{v}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        </div>

      </div>

      {/* Edit Card Modal */}
      <AnimatePresence>
        {editWord && (
          <EditWordCard
            word={editWord}
            onClose={() => setEditWord(null)}
            onSaved={() => fetchWords(page)}
          />
        )}
      </AnimatePresence>
    </AdminShell>
  )
}
