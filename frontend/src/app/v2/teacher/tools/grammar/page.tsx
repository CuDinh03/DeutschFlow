'use client'

import { useState } from 'react'
import { Check, X, RotateCcw, Copy, Sparkles, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { aiToolsApi, type GrammarCorrectResponse } from '@/lib/aiToolsApi'
import { apiMessage } from '@/lib/api'
import { GaPageHdr, GaBtn, GaCap } from '@/components/ui-v2'

// ─────────────────────────────────────────────────────────────────────────────
// Ngữ pháp AI (GaGrammarAI) — violet, 2-column (input · result).
// Plumbing reused 1:1 (zero backend): POST /ai/grammar/correct { text }
//   → { original, corrected, explanation }  (aiToolsApi.grammarCorrect).
// Option-1: proto's error-TYPE badge + "correct examples" list have no backing
// field in GrammarCorrectResponse → dropped. Examples/history are client-side input
// helpers (the proto's are too). AI requires the LLM configured (prod); locally it
// surfaces the real error state.
// ─────────────────────────────────────────────────────────────────────────────

const EXAMPLES = [
  'Ich habe gestern ins Kino gegangen.',
  'Er arbeitet seit drei Jahren in Deutschland.',
  'Obwohl ich müde bin, ich lerne weiter.',
]

export default function V2GrammarAiPage() {
  const [input, setInput] = useState('')
  const [result, setResult] = useState<GrammarCorrectResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [explanation, setExplanation] = useState('')

  const check = async (text?: string) => {
    const t = (text ?? input).trim()
    if (!t) return
    setInput(t)
    setLoading(true)
    setError('')
    setResult(null)
    setExplanation('')
    try {
      const res = await aiToolsApi.grammarCorrect(t)
      setResult(res)
      setHistory((h) => [t, ...h.filter((x) => x !== t)].slice(0, 5))
      // /correct returns only {original, corrected}; fetch the teaching explanation
      // separately (best-effort) so the "Giải thích" panel the subtitle promises works.
      aiToolsApi
        .grammarExplain(res.corrected)
        .then((ex) => setExplanation(ex.explanation))
        .catch(() => {})
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      setLoading(false)
    }
  }

  const hasError = result && result.corrected.trim() !== result.original.trim()

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <GaPageHdr accent title="Ngữ pháp AI" subtitle="Kiểm tra và giải thích ngữ pháp tiếng Đức tức thì" />

      <div className="grid min-h-0 flex-1 grid-cols-2 border-t border-ga-line">
        {/* Input */}
        <div className="flex flex-col overflow-auto border-r border-ga-line px-9 py-7">
          <GaCap className="mb-3 block">Nhập câu cần kiểm tra</GaCap>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) check() }}
            placeholder="Nhập câu tiếng Đức bất kỳ…"
            rows={5}
            className="ga-ui mb-3.5 block w-full resize-none border border-ga-line bg-ga-bg px-4 py-3.5 text-[16px] leading-[1.65] text-ga-ink outline-none focus:border-ga-accent"
          />
          <GaBtn variant="yellow" className="self-start" loading={loading} disabled={loading || !input.trim()} onClick={() => check()}>
            <Sparkles size={16} /> Kiểm tra ngay
          </GaBtn>

          <div className="mt-6">
            <GaCap className="mb-3 block">Câu ví dụ</GaCap>
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => check(ex)}
                className="mb-1.5 block w-full border border-ga-line bg-ga-card px-3.5 py-2.5 text-left font-ga-display text-[14.5px] italic text-ga-ink transition-colors hover:border-ga-accent"
              >
                {ex}
              </button>
            ))}
          </div>

          {history.length > 0 && (
            <div className="mt-5">
              <GaCap className="mb-2.5 block">Lịch sử kiểm tra</GaCap>
              {history.map((h, i) => (
                <button
                  key={`${h}-${i}`}
                  type="button"
                  onClick={() => check(h)}
                  className="ga-ui mb-1.5 flex w-full items-center gap-2 border border-ga-line bg-transparent px-3 py-2 text-left text-[13px] text-ga-muted transition-colors hover:text-ga-ink"
                >
                  <RotateCcw size={12} className="shrink-0 text-ga-subtle" />
                  <span className="truncate">{h}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Result */}
        <div className={`overflow-auto px-9 py-7 ${result ? 'bg-ga-card' : 'bg-ga-bg'}`}>
          {loading ? (
            <div className="grid h-full place-items-center text-center text-ga-muted">
              <div>
                <Loader2 size={28} className="mx-auto mb-3 animate-spin text-ga-accent" />
                <p className="ga-ui text-[14px]">AI đang phân tích câu…</p>
              </div>
            </div>
          ) : error ? (
            <div className="grid h-full place-items-center text-center">
              <div>
                <X size={32} className="mx-auto mb-3 text-ga-red" />
                <p className="font-ga-display text-[20px] font-medium text-ga-ink">Không phân tích được</p>
                <p className="ga-ui mx-auto mt-1.5 max-w-sm text-[13.5px] text-ga-muted">{error}</p>
                <GaBtn variant="primary" className="mt-4" onClick={() => check()}>Thử lại</GaBtn>
              </div>
            </div>
          ) : !result ? (
            <div className="grid h-full place-items-center text-center text-ga-muted">
              <p className="ga-ui text-[14px]">Kết quả phân tích sẽ hiện ở đây.</p>
            </div>
          ) : (
            <div>
              <GaCap className="mb-4 block">Kết quả phân tích</GaCap>

              {hasError ? (
                <>
                  <div className="mb-3.5 border px-4 py-3.5" style={{ background: 'var(--ga-red-soft)', borderColor: 'var(--ga-red)' }}>
                    <div className="mb-1.5 flex items-center gap-1.5 text-[13px] font-bold" style={{ color: 'var(--ga-red)' }}>
                      <X size={14} /> Phát hiện lỗi
                    </div>
                    <div className="font-ga-display text-[16.5px] italic leading-[1.5] text-ga-ink line-through decoration-[var(--ga-red)]">
                      {result.original}
                    </div>
                  </div>
                  <div className="mb-5 border px-4 py-3.5" style={{ background: 'var(--ga-green-soft)', borderColor: 'var(--ga-green)' }}>
                    <div className="mb-1.5 flex items-center gap-1.5 text-[13px] font-bold" style={{ color: 'var(--ga-green)' }}>
                      <Check size={14} /> Câu đúng
                    </div>
                    <div className="font-ga-display text-[16.5px] italic leading-[1.5] text-ga-ink">{result.corrected}</div>
                  </div>
                </>
              ) : (
                <div className="mb-5 border px-4 py-3.5" style={{ background: 'var(--ga-green-soft)', borderColor: 'var(--ga-green)' }}>
                  <div className="mb-1.5 flex items-center gap-1.5 text-[13px] font-bold" style={{ color: 'var(--ga-green)' }}>
                    <Check size={14} /> Câu đã đúng ngữ pháp
                  </div>
                  <div className="font-ga-display text-[16.5px] italic leading-[1.5] text-ga-ink">{result.corrected}</div>
                </div>
              )}

              {explanation && (
                <div className="mb-4 border border-ga-line bg-ga-bg px-[18px] py-4">
                  <GaCap className="mb-2 block">Giải thích</GaCap>
                  <p className="ga-ui m-0 text-[14.5px] leading-[1.72] text-ga-ink">{explanation}</p>
                </div>
              )}

              <div className="mt-[18px] flex gap-2.5">
                <GaBtn variant="ghost" size="sm" onClick={() => toast('Đã lưu vào tài liệu lớp (sắp ra mắt)')}>
                  Lưu làm ví dụ
                </GaBtn>
                <GaBtn
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    void navigator.clipboard?.writeText(result.corrected)
                    toast.success('Đã sao chép câu đúng')
                  }}
                >
                  <Copy size={14} /> Sao chép
                </GaBtn>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
