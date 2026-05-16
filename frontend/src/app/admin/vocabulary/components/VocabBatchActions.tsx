import { useState, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, Loader2, XCircle, Zap } from 'lucide-react'
import api, { apiMessage } from '@/lib/api'

async function adminPost(
  path: string,
  params?: Record<string, string | number | boolean>,
  config?: { longRunning?: boolean }
) {
  const qs =
    params && Object.keys(params).length > 0
      ? '?' + new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString()
      : ''
  const res = await api.post(path + qs, undefined, config?.longRunning ? { timeout: 0 } : undefined)
  return res.data
}

async function adminGet(path: string) {
  const res = await api.get(path)
  return res.data as Record<string, unknown>
}

async function adminPatch(path: string, body: Record<string, unknown>) {
  const res = await api.patch(path, body)
  return res.data
}

const VOCAB_ADMIN_BATCH_MAX = 200

// ─── Auto Topic Tagging Panel ─────────────────────────────────────────────────

export function AutoTagPanel({ onDone }: { onDone: () => void }) {
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

export function GlosbeViPanel({ onDone }: { onDone: () => void }) {
  const [limit, setLimit] = useState(30)
  const [resetCursor, setResetCursor] = useState(false)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')

  const run = async () => {
    setRunning(true); setResult(null); setError('')
    try {
      const data = await adminPost('/admin/vocabulary/glosbe-vi/enrich/batch', { limit, resetCursor }, { longRunning: true })
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
            <input type="number" min={1} max={VOCAB_ADMIN_BATCH_MAX} value={limit}
              onChange={e =>
                setLimit(Math.max(1, Math.min(VOCAB_ADMIN_BATCH_MAX, parseInt(e.target.value) || 30)))
              }
              className="w-24 px-3 py-2 rounded-[8px] border border-[#E2E8F0] text-sm focus:outline-none focus:ring-2 focus:ring-[#121212]/20" />
          </div>
          <label className="flex items-center gap-2 cursor-pointer pb-2">
            <div onClick={() => setResetCursor(v => !v)}
              className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${resetCursor ? 'bg-[#121212]' : 'bg-[#CBD5E1]'}`}>
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
        <p className="text-[#94A3B8] text-[11px] leading-relaxed">
          Mỗi từ ~1–2s trễ crawl; giới hạn tối đa 50 từ/lần để tránh timeout.
          Glosbe không có public API — dùng{' '}
          <strong className="text-amber-700">LLM DE→VI (bên dưới)</strong> để dịch nhanh hơn và ổn định hơn.
        </p>
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

// ─── LLM VI Translation Panel ─────────────────────────────────────────────────

export function LlmViPanel({ onDone }: { onDone: () => void }) {
  const [limit, setLimit] = useState(50)
  const [resetCursor, setResetCursor] = useState(false)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')

  const run = async () => {
    setRunning(true); setResult(null); setError('')
    try {
      const data = await adminPost('/admin/vocabulary/llm-vi/enrich/batch', { limit, resetCursor }, { longRunning: true })
      setResult(data); onDone()
    } catch (e: unknown) { setError(apiMessage(e)) }
    finally { setRunning(false) }
  }

  return (
    <div className="bg-white rounded-[16px] border border-[#E2E8F0] shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-[#F0F4F8] flex items-center gap-3">
        <div className="w-9 h-9 rounded-[10px] bg-gradient-to-br from-violet-50 to-blue-50 flex items-center justify-center">
          <span className="text-lg">🤖</span>
        </div>
        <div>
          <h3 className="font-semibold text-[#0F172A] text-sm">LLM DE→VI Dịch nghĩa</h3>
          <p className="text-[#94A3B8] text-xs">
            Thay thế Glosbe: AI dịch batch 50 từ/lần · ~$0.024 cho 10k từ · Không bị block
          </p>
        </div>
        <span className="ml-auto text-[10px] font-bold px-2 py-1 rounded-full bg-green-100 text-green-700">RECOMMENDED</span>
      </div>
      <div className="px-5 py-4 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-[#0F172A] mb-1.5">Số từ mỗi lần (max 500)</label>
            <input type="number" min={1} max={500} value={limit}
              onChange={e => setLimit(Math.max(1, Math.min(500, parseInt(e.target.value) || 50)))}
              className="w-24 px-3 py-2 rounded-[8px] border border-[#E2E8F0] text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/40" />
          </div>
          <label className="flex items-center gap-2 cursor-pointer pb-2">
            <div onClick={() => setResetCursor(v => !v)}
              className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${resetCursor ? 'bg-violet-600' : 'bg-[#CBD5E1]'}`}>
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${resetCursor ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </div>
            <span className="text-xs text-[#64748B]">Reset cursor</span>
          </label>
          <button onClick={run} disabled={running}
            className="flex items-center gap-2 px-4 py-2 rounded-[8px] disabled:opacity-60 text-white text-sm font-semibold transition-all"
            style={{ background: running ? '#6d28d9' : 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}>
            {running ? <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full" /> : <span>🤖</span>}
            {running ? 'Đang dịch…' : 'Chạy ngay'}
          </button>
        </div>
        <p className="text-[#94A3B8] text-[11px]">
          Dùng LLM để dịch từ còn thiếu nghĩa VI. Ưu tiên A1 trước.
          Cần cấu hình AI provider trong môi trường server để sử dụng tính năng này.
        </p>
        {error && (
          <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 border border-red-200 rounded-[8px] px-3 py-2">
            <XCircle size={13} /> {error}
          </div>
        )}
        {result && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
            className="bg-violet-50 border border-violet-200 rounded-[10px] px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 size={13} className="text-violet-600" />
              <span className="text-violet-800 text-xs font-semibold">Hoàn thành — {result.status}</span>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              {[['Đã xử lý', result.processed], ['Đã dịch', result.translated], ['Lỗi', result.failed], ['Còn lại', result.remaining]].map(([l, v]) => (
                <span key={String(l)} className="bg-white border border-violet-100 rounded px-2 py-1">
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

// ─── DtypeFixPanel ──────────────────────────────────────────────────────────

export function DtypeFixPanel() {
  const [limit, setLimit]   = useState(500)
  const [useLlm, setUseLlm] = useState(true)
  const [dryRun, setDryRun] = useState(true)
  const [running, setRunning] = useState(false)
  const [result, setResult]   = useState<any>(null)
  const [error, setError]     = useState('')

  const run = async () => {
    setRunning(true); setResult(null); setError('')
    try {
      const data = await adminPost(
        `/admin/vocabulary/dtype-fix/batch?limit=${limit}&useLlm=${useLlm}&dryRun=${dryRun}`,
        {},
        { longRunning: true }
      )
      setResult(data)
    } catch (e: unknown) { setError(apiMessage(e)) }
    finally { setRunning(false) }
  }

  return (
    <div className="bg-white rounded-[16px] border border-[#E2E8F0] shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-[#F0F4F8] flex items-center gap-3">
        <div className="w-9 h-9 rounded-[10px] bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center">
          <span className="text-lg">🔧</span>
        </div>
        <div>
          <h3 className="font-semibold text-[#0F172A] text-sm">Phase 1 — Sửa dtype (loại từ)</h3>
          <p className="text-[#94A3B8] text-xs">
            Tự động sửa Noun sai thành Adjective/Conjunction/Verb/… bằng suffix rules + LLM
          </p>
        </div>
        <span className="ml-auto text-[10px] font-bold px-2 py-1 rounded-full bg-orange-100 text-orange-700">PHASE 1</span>
      </div>
      <div className="px-5 py-4 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-[#0F172A] mb-1.5">Số từ (max 1000)</label>
            <input type="number" min={1} max={1000} value={limit}
              onChange={e => setLimit(Math.max(1, Math.min(1000, parseInt(e.target.value) || 200)))}
              className="w-24 px-3 py-2 rounded-[8px] border border-[#E2E8F0] text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/40" />
          </div>
          <label className="flex items-center gap-2 cursor-pointer pb-2">
            <div onClick={() => setUseLlm(v => !v)}
              className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${useLlm ? 'bg-orange-500' : 'bg-[#CBD5E1]'}`}>
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${useLlm ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </div>
            <span className="text-xs text-[#64748B]">Dùng LLM cho từ khó</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer pb-2">
            <div onClick={() => setDryRun(v => !v)}
              className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${dryRun ? 'bg-blue-500' : 'bg-red-400'}`}>
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${dryRun ? 'translate-x-0.5' : 'translate-x-4'}`} />
            </div>
            <span className="text-xs text-[#64748B]">{dryRun ? '👁 Dry Run (xem trước)' : '⚠️ Áp dụng thực'}</span>
          </label>
          <button onClick={run} disabled={running}
            className="flex items-center gap-2 px-4 py-2 rounded-[8px] disabled:opacity-60 text-white text-sm font-semibold transition-all"
            style={{ background: running ? '#d97706' : dryRun ? 'linear-gradient(135deg,#f59e0b,#d97706)' : 'linear-gradient(135deg,#ea580c,#dc2626)' }}>
            {running ? <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full" /> : <span>🔧</span>}
            {running ? 'Đang xử lý…' : dryRun ? 'Xem trước' : 'Sửa thực sự'}
          </button>
        </div>
        <p className="text-[#94A3B8] text-[11px]">
          Bước 1: Chạy <strong>Dry Run</strong> để xem preview. Bước 2: Tắt Dry Run rồi chạy thực để ghi vào DB.
        </p>
        {error && (
          <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 border border-red-200 rounded-[8px] px-3 py-2">
            <XCircle size={13} /> {error}
          </div>
        )}
        {result && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
            className="bg-orange-50 border border-orange-200 rounded-[10px] px-4 py-3 space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={13} className="text-orange-600" />
              <span className="text-orange-800 text-xs font-semibold">
                {result.dryRun ? 'Preview (chưa ghi)' : 'Hoàn thành'} — {result.status}
              </span>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              {[
                ['Đã xử lý', result.processed],
                ['Suffix fix', result.suffixFixed],
                ['LLM fix', result.llmFixed],
                ['Tổng fix', result.totalFixed],
                ['Không đổi', result.unchanged],
              ].map(([l, v]) => (
                <span key={String(l)} className="bg-white border border-orange-100 rounded px-2 py-1">
                  {l}: <strong>{v}</strong>
                </span>
              ))}
            </div>
            {result.preview && result.preview.length > 0 && (
              <div className="mt-2">
                <p className="text-orange-700 text-[11px] font-semibold mb-1">Preview (tối đa 20 thay đổi):</p>
                <div className="max-h-32 overflow-y-auto space-y-0.5">
                  {result.preview.map((line: string, i: number) => (
                    <div key={i} className="text-[10px] font-mono text-orange-800 bg-orange-100 rounded px-2 py-0.5">{line}</div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  )
}

// ─── GenderEnrichPanel ────────────────────────────────────────────────────────

export function GenderEnrichPanel() {
  const [limit, setLimit]   = useState(100)
  const [running, setRunning] = useState(false)
  const [result, setResult]   = useState<any>(null)
  const [error, setError]     = useState('')

  const run = async () => {
    setRunning(true); setResult(null); setError('')
    try {
      const data = await adminPost(
        `/admin/vocabulary/wiktionary/gender/batch?limit=${limit}`,
        {}, { longRunning: true }
      )
      setResult(data)
    } catch (e: unknown) { setError(apiMessage(e)) }
    finally { setRunning(false) }
  }

  return (
    <div className="bg-white rounded-[16px] border border-[#E2E8F0] shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-[#F0F4F8] flex items-center gap-3">
        <div className="w-9 h-9 rounded-[10px] bg-gradient-to-br from-purple-50 to-violet-50 flex items-center justify-center">
          <span className="text-lg">⚧</span>
        </div>
        <div>
          <h3 className="font-semibold text-[#0F172A] text-sm">Phase 2 — Enrich Gender (Wiktionary)</h3>
          <p className="text-[#94A3B8] text-xs">Tự động điền der/die/das cho danh từ thiếu giới tính từ Wiktionary</p>
        </div>
        <span className="ml-auto text-[10px] font-bold px-2 py-1 rounded-full bg-purple-100 text-purple-700">PHASE 2</span>
      </div>
      <div className="px-5 py-4 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-[#0F172A] mb-1.5">Số danh từ (max 500)</label>
            <input type="number" min={1} max={500} value={limit}
              onChange={e => setLimit(Math.max(1, Math.min(500, parseInt(e.target.value) || 100)))}
              className="w-24 px-3 py-2 rounded-[8px] border border-[#E2E8F0] text-sm focus:outline-none focus:ring-2 focus:ring-purple-400/40" />
          </div>
          <button onClick={run} disabled={running}
            className="flex items-center gap-2 px-4 py-2 rounded-[8px] disabled:opacity-60 text-white text-sm font-semibold transition-all"
            style={{ background: running ? '#7c3aed' : 'linear-gradient(135deg,#8b5cf6,#7c3aed)' }}>
            {running ? <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full" /> : <span>⚧</span>}
            {running ? 'Đang scrape...' : 'Chạy Gender Enrichment'}
          </button>
        </div>
        <p className="text-[#94A3B8] text-[11px]">⏱ ~1-2s/từ. 100 từ ≈ 2-3 phút. A1/A2 ưu tiên trước.</p>
        {error && <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 border border-red-200 rounded-[8px] px-3 py-2"><XCircle size={13} /> {error}</div>}
        {result && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
            className="bg-purple-50 border border-purple-200 rounded-[10px] px-4 py-3 space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={13} className="text-purple-600" />
              <span className="text-purple-800 text-xs font-semibold">Hoàn thành — {result.status}</span>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              {[['Đã xử lý', result.processed], ['Gender filled', result.genderFilled],
                ['Plural filled', result.pluralFilled], ['Không có data', result.noData], ['Còn lại', result.remaining],
              ].map(([l, v]) => (
                <span key={String(l)} className="bg-white border border-purple-100 rounded px-2 py-1">{l}: <strong>{v}</strong></span>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}

// ─── MissingDataPanel ─────────────────────────────────────────────────────────

export function MissingDataPanel() {
  const [limit, setLimit]   = useState(100)
  const [running, setRunning] = useState(false)
  const [result, setResult]   = useState<any>(null)
  const [error, setError]     = useState('')

  const run = async () => {
    setRunning(true); setResult(null); setError('')
    try {
      const data = await adminPost(
        `/admin/vocabulary/wiktionary/missing-data/batch?limit=${limit}`,
        {}, { longRunning: true }
      )
      setResult(data)
    } catch (e: unknown) { setError(apiMessage(e)) }
    finally { setRunning(false) }
  }

  return (
    <div className="bg-white rounded-[16px] border border-[#E2E8F0] shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-[#F0F4F8] flex items-center gap-3">
        <div className="w-9 h-9 rounded-[10px] bg-gradient-to-br from-teal-50 to-cyan-50 flex items-center justify-center">
          <span className="text-lg">🔊</span>
        </div>
        <div>
          <h3 className="font-semibold text-[#0F172A] text-sm">Phase 3 — Enrich IPA + EN meaning</h3>
          <p className="text-[#94A3B8] text-xs">Điền phiên âm IPA và nghĩa tiếng Anh cho từ đang thiếu (Wiktionary)</p>
        </div>
        <span className="ml-auto text-[10px] font-bold px-2 py-1 rounded-full bg-teal-100 text-teal-700">PHASE 3</span>
      </div>
      <div className="px-5 py-4 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-[#0F172A] mb-1.5">Số từ (max 500)</label>
            <input type="number" min={1} max={500} value={limit}
              onChange={e => setLimit(Math.max(1, Math.min(500, parseInt(e.target.value) || 100)))}
              className="w-24 px-3 py-2 rounded-[8px] border border-[#E2E8F0] text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/40" />
          </div>
          <button onClick={run} disabled={running}
            className="flex items-center gap-2 px-4 py-2 rounded-[8px] disabled:opacity-60 text-white text-sm font-semibold transition-all"
            style={{ background: running ? '#0d9488' : 'linear-gradient(135deg,#14b8a6,#0d9488)' }}>
            {running ? <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full" /> : <span>🔊</span>}
            {running ? 'Đang scrape...' : 'Chạy IPA + EN Enrichment'}
          </button>
        </div>
        <p className="text-[#94A3B8] text-[11px]">⏱ ~1-2s/từ. 100 từ ≈ 2-3 phút. A1/A2 ưu tiên trước.</p>
        {error && <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 border border-red-200 rounded-[8px] px-3 py-2"><XCircle size={13} /> {error}</div>}
        {result && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
            className="bg-teal-50 border border-teal-200 rounded-[10px] px-4 py-3 space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={13} className="text-teal-600" />
              <span className="text-teal-800 text-xs font-semibold">Hoàn thành — {result.status}</span>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              {[['Đã xử lý', result.processed], ['IPA filled', result.ipaFilled],
                ['EN filled', result.enFilled], ['Không có data', result.noData],
                ['Còn thiếu IPA', result.remainingIpa], ['Còn thiếu EN', result.remainingEn],
              ].map(([l, v]) => (
                <span key={String(l)} className="bg-white border border-teal-100 rounded px-2 py-1">{l}: <strong>{v}</strong></span>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}

// ─── WiktionaryBatchPanel ─────────────────────────────────────────────────────

export function WiktionaryBatchPanel({ onDone }: { onDone: () => void }) {
  const [batchLimit, setBatchLimit] = useState(50)
  const [resetCursor, setResetCursor] = useState(false)
  const [batchRunning, setBatchRunning] = useState(false)
  const [batchResult, setBatchResult] = useState<any>(null)
  const [batchError, setBatchError] = useState('')

  const runBatch = async () => {
    setBatchRunning(true); setBatchResult(null); setBatchError('')
    try {
      const data = await adminPost('/admin/vocabulary/wiktionary/enrich/batch', { limit: batchLimit, resetCursor }, {
        longRunning: true,
      })
      setBatchResult(data); onDone()
    } catch (e: unknown) { setBatchError(apiMessage(e)) }
    finally { setBatchRunning(false) }
  }

  return (
    <div className="bg-white rounded-[16px] border border-[#E2E8F0] shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-[#F0F4F8] flex items-center gap-3">
        <div className="w-9 h-9 rounded-[10px] bg-[#EEF4FF] flex items-center justify-center">
          <Zap size={16} className="text-[#121212]" />
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
            <input type="number" min={1} max={VOCAB_ADMIN_BATCH_MAX} value={batchLimit}
              onChange={e =>
                setBatchLimit(
                  Math.max(1, Math.min(VOCAB_ADMIN_BATCH_MAX, parseInt(e.target.value) || 50)),
                )}
              className="w-28 px-3 py-2 rounded-[8px] border border-[#E2E8F0] text-sm focus:outline-none focus:ring-2 focus:ring-[#121212]/20" />
          </div>
          <label className="flex items-center gap-2 cursor-pointer pb-2">
            <div onClick={() => setResetCursor(v => !v)}
              className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${resetCursor ? 'bg-[#121212]' : 'bg-[#CBD5E1]'}`}>
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${resetCursor ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </div>
            <span className="text-xs text-[#64748B]">Reset cursor</span>
          </label>
          <button onClick={runBatch} disabled={batchRunning}
            className="flex items-center gap-2 px-4 py-2 rounded-[8px] bg-[#121212] hover:bg-[#000000] disabled:opacity-60 text-white text-sm font-semibold transition-colors">
            {batchRunning ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
            {batchRunning ? 'Đang chạy…' : 'Chạy Batch'}
          </button>
        </div>
        <p className="text-[#94A3B8] text-[11px] leading-relaxed">
          Mỗi từ gọi Wiktionary có delay an toàn; batch 10k có thể mất rất lâu — có thể tăng{' '}
          <code className="text-[11px]">WIKTIONARY_SCHEDULER_BATCH_SIZE</code> để crawl nền, hoặc chia nhiều lần.
        </p>
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
  )
}

// ─── ResetReimportPanel ───────────────────────────────────────────────────────

export function ResetReimportPanel({ onDone }: { onDone: () => void }) {
  const [wiktionaryLimit, setWiktionaryLimit] = useState(100)
  const [resetRunning, setResetRunning] = useState(false)
  const [resetResult, setResetResult] = useState<any>(null)
  const [resetError, setResetError] = useState('')
  const [confirmed, setConfirmed] = useState(false)

  const runReset = async () => {
    setResetRunning(true); setResetResult(null); setResetError('')
    try {
      const data = await adminPost('/admin/vocabulary/reset', { wiktionaryLimit })
      setResetResult(data); setConfirmed(false); onDone()
    } catch (e: unknown) { setResetError(apiMessage(e)) }
    finally { setResetRunning(false) }
  }

  return (
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
  )
}
