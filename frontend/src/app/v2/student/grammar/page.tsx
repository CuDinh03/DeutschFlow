'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Mic } from 'lucide-react'
import { toast } from 'sonner'
import { errorSkillsApi, type ErrorSkillDto } from '@/lib/errors/drillApi'
import { getErrorSnippet } from '@/lib/errors/errorCatalog'
import { getDrillRule } from '@/lib/errors/drillRules'
import { GaPageHdr, GaBtn, GaCap, LoadingState, ErrorBanner } from '@/components/ui-v2'

// Reskin of proto GaGrammar (proto-learn.jsx): personal error library from AI-speaking sessions —
// left list of the learner's frequent mistakes (code · frequency · "mắc N lần"), right detail with
// ✗ what-you-wrote → ✓ corrected + rule. Wired to the REAL personalized data:
// errorSkillsApi.getMine (ErrorSkillDto: count / sampleWrong / sampleCorrected / ruleViShort) and
// repairAttempt (persists "đã luyện sửa"). Replaces the prior grammar/topics browser (wrong source).

interface Row {
  code: string
  title: string
  count: number
  wrong: string | null
  corrected: string | null
  rule: string
  priority: number
}

// Frequency-based emphasis (the DTO has no formal MAJOR/MINOR severity → derive from how often
// the learner makes the mistake, which is the actionable signal here).
function freqTone(count: number): { label: string; color: string } {
  if (count >= 6) return { label: 'Hay mắc', color: 'var(--ga-red)' }
  if (count >= 3) return { label: 'Thỉnh thoảng', color: 'var(--ga-orange)' }
  return { label: 'Ít gặp', color: 'var(--ga-blue)' }
}

export default function V2StudentGrammarPage() {
  const router = useRouter()
  const [rows, setRows] = useState<Row[]>([])
  const [sel, setSel] = useState(0)
  const [repaired, setRepaired] = useState<Record<string, boolean>>({})
  const [marking, setMarking] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    setError(null)
    errorSkillsApi
      .getMine(30)
      .then((res) => {
        const list = (res.data ?? [])
          .map((e: ErrorSkillDto): Row => {
            const snip = getErrorSnippet(e.errorCode, 'vi')
            return {
              code: e.errorCode,
              title: snip?.title || e.errorCode,
              count: e.count,
              wrong: e.sampleWrong,
              corrected: e.sampleCorrected ?? getDrillRule(e.errorCode)?.rewriteTarget_de ?? null,
              rule: e.ruleViShort || snip?.rule || '',
              priority: e.priorityScore,
            }
          })
          .sort((a, b) => b.priority - a.priority)
        setRows(list)
        setSel(0)
      })
      .catch(() => setError('Không thể tải thư viện lỗi.'))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const e = rows[sel]
  const tone = useMemo(() => (e ? freqTone(e.count) : null), [e])

  const markRepaired = async () => {
    if (!e) return
    setMarking(true)
    try {
      await errorSkillsApi.repairAttempt(e.code)
      setRepaired((r) => ({ ...r, [e.code]: true }))
      toast.success('Đã ghi nhận luyện sửa — lỗi sẽ quay lại theo lịch ôn.')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Không thể lưu.')
    } finally {
      setMarking(false)
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        title="Ngữ pháp & Lỗi sai"
        subtitle="Thư viện lỗi cá nhân hoá từ các buổi luyện nói AI · luyện sửa theo lịch lặp lại ngắt quãng"
      />
      {loading ? (
        <div className="px-10 py-8">
          <LoadingState label="Đang tải thư viện lỗi…" />
        </div>
      ) : error ? (
        <div className="px-10 py-8">
          <ErrorBanner message={error} onRetry={load} />
        </div>
      ) : rows.length === 0 ? (
        <div className="px-10 py-8">
          <div className="border border-ga-line bg-ga-card py-16 text-center">
            <div className="text-[40px]">✨</div>
            <p className="mt-3 font-ga-display text-[22px] font-medium text-ga-ink">Chưa ghi nhận lỗi nào</p>
            <p className="ga-ui mt-2 text-[14px] text-ga-muted">
              Luyện nói với AI để hệ thống lập thư viện lỗi cá nhân cho bạn.
            </p>
            <GaBtn variant="primary" className="mt-5" onClick={() => router.push('/v2/student/speaking')}>
              <Mic size={15} aria-hidden /> Luyện nói ngay
            </GaBtn>
          </div>
        </div>
      ) : (
        <div className="grid flex-1 grid-cols-1 overflow-hidden md:grid-cols-[340px_1fr]">
          {/* left list */}
          <div className="overflow-auto border-ga-line px-[18px] py-5 md:border-r">
            <GaCap className="mb-3.5">Lỗi thường gặp của bạn (30 ngày)</GaCap>
            {rows.map((er, i) => {
              const on = sel === i
              const t = freqTone(er.count)
              return (
                <button
                  key={er.code}
                  type="button"
                  onClick={() => setSel(i)}
                  className={`mb-2 block w-full rounded-ga border px-4 py-3.5 text-left transition-colors ${
                    on ? 'bg-ga-surface' : 'bg-ga-card hover:bg-ga-surface'
                  }`}
                  style={{
                    borderColor: on ? 'var(--ga-accent)' : 'var(--ga-line)',
                    borderLeftWidth: 3,
                    borderLeftColor: t.color,
                  }}
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-[14px] font-bold text-ga-ink">{er.title}</span>
                    {repaired[er.code] && <Check size={14} className="shrink-0 text-ga-green" aria-hidden />}
                  </div>
                  <div className="ga-ui flex gap-2.5 text-[12px] text-ga-muted">
                    <span style={{ color: t.color }} className="font-semibold">
                      {t.label}
                    </span>
                    <span>· mắc {er.count} lần</span>
                  </div>
                </button>
              )
            })}
          </div>

          {/* right detail */}
          {e && tone && (
            <div className="overflow-auto px-9 py-7">
              <div className="mb-[18px] flex items-center gap-2.5">
                <span className="h-2.5 w-2.5" style={{ background: tone.color }} />
                <h2 className="font-ga-display text-[24px] font-medium text-ga-ink">{e.title}</h2>
                <span
                  className="ga-ui border px-2 py-[3px] text-[10px] font-bold uppercase tracking-[0.08em]"
                  style={{ color: tone.color, borderColor: `color-mix(in srgb, ${tone.color} 45%, transparent)` }}
                >
                  {tone.label} · {e.count}×
                </span>
              </div>

              {e.wrong && (
                <div className="mb-3 border border-ga-red bg-ga-red-soft px-[18px] py-4">
                  <div className="ga-ui mb-1.5 text-[12px] font-bold text-ga-red">✗ Bạn từng nói/viết</div>
                  <div className="font-ga-display text-[17px] italic text-ga-ink line-through">{e.wrong}</div>
                </div>
              )}
              {e.corrected && (
                <div className="mb-5 border border-ga-green bg-ga-green-soft px-[18px] py-4">
                  <div className="ga-ui mb-1.5 text-[12px] font-bold text-ga-green">✓ Câu đúng</div>
                  <div className="font-ga-display text-[17px] italic text-ga-ink">{e.corrected}</div>
                </div>
              )}

              <div className="flex flex-wrap gap-2.5">
                <GaBtn variant="primary" onClick={markRepaired} disabled={marking || repaired[e.code]} loading={marking}>
                  <Check size={15} aria-hidden />
                  {repaired[e.code] ? 'Đã đánh dấu' : 'Đánh dấu đã luyện sửa'}
                </GaBtn>
                <GaBtn variant="ghost" onClick={() => router.push('/v2/student/speaking')}>
                  <Mic size={15} aria-hidden /> Luyện nói để củng cố
                </GaBtn>
              </div>

              {e.rule && (
                <p className="ga-ui mt-[18px] text-[13.5px] leading-relaxed text-ga-muted">
                  <span className="font-semibold text-ga-ink">Quy tắc:</span> {e.rule}
                </p>
              )}
              <p className="ga-ui mt-2 text-[12.5px] leading-relaxed text-ga-subtle">
                Lỗi sẽ xuất hiện lại trong hàng ôn theo thuật toán lặp lại ngắt quãng cho đến khi bạn không còn mắc.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
