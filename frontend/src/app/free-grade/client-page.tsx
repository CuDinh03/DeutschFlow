'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Sparkles, Loader2, CheckCircle2, ArrowRight, PenLine, Clock, ShieldCheck } from 'lucide-react'
import { httpStatus } from '@/lib/api'
import { submitFreeGrade, type ContactType, type FreeGradeResult } from '@/lib/marketingApi'
import { ShareButtons } from '@/components/marketing/ShareButtons'
import { useTracking } from '@/hooks/useTracking'
import { B2B_EVENT } from '@/lib/analytics/b2bEvents'

const MIN_CHARS = 50
const MAX_CHARS = 3000

/** Pull the human message out of an RFC7807 ProblemDetail (or fall back). */
function errorMessage(e: unknown, fallback: string): string {
  const data = (e as { response?: { data?: { detail?: string; message?: string } } })?.response?.data
  return data?.detail || data?.message || fallback
}

export default function FreeGradeClientPage() {
  const { trackEvent } = useTracking()

  const [essay, setEssay] = useState('')
  const [topic, setTopic] = useState('')
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [contactType, setContactType] = useState<ContactType>('EMAIL')
  const [website, setWebsite] = useState('') // honeypot

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<FreeGradeResult | null>(null)

  const charCount = essay.trim().length
  const tooShort = charCount > 0 && charCount < MIN_CHARS
  const canSubmit = useMemo(
    () => charCount >= MIN_CHARS && charCount <= MAX_CHARS && contact.trim().length > 2 && !submitting,
    [charCount, contact, submitting],
  )

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    setResult(null)
    try {
      const res = await submitFreeGrade({
        name: name.trim() || undefined,
        contact: contact.trim(),
        contactType,
        topic: topic.trim() || undefined,
        essay: essay.trim(),
        website: website || undefined,
      })
      setResult(res)
      trackEvent(B2B_EVENT.LEAD_MAGNET_SUBMITTED, {
        score: res.score,
        essay_chars: charCount,
        contact_type: contactType,
        has_topic: Boolean(topic.trim()),
      })
    } catch (err) {
      const status = httpStatus(err)
      if (status === 429) {
        setError(errorMessage(err, 'Bạn đã dùng hết lượt chấm thử miễn phí hôm nay. Vui lòng quay lại sau.'))
      } else if (status === 503) {
        setError(errorMessage(err, 'Hệ thống AI đang bận. Chúng tôi đã lưu thông tin của bạn — vui lòng thử lại sau ít phút.'))
      } else if (status === 400) {
        setError(errorMessage(err, 'Dữ liệu chưa hợp lệ. Vui lòng kiểm tra lại bài viết và thông tin liên hệ.'))
      } else {
        setError('Có lỗi xảy ra. Vui lòng thử lại sau ít phút.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      {/* Hero band */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 text-white">
        {/* German-flag accent stripe */}
        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-black via-[#DD0000] to-[#FFCE00]" />
        <div className="absolute right-0 top-0 -mr-16 -mt-10 opacity-10">
          <PenLine size={260} />
        </div>
        <div className="relative z-10 mx-auto max-w-4xl px-5 pb-12 pt-14 sm:pt-20">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-indigo-200">
            <Sparkles size={14} /> Chấm thử miễn phí
          </span>
          <h1 className="mt-5 text-4xl font-black leading-[1.05] sm:text-5xl">
            Bài Schreiben B1 của bạn<br className="hidden sm:block" /> được mấy điểm?
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-slate-300">
            Dán bài viết tiếng Đức vào ô bên dưới — AI chấm điểm theo thang Goethe/telc kèm nhận
            xét ngữ pháp, từ vựng, cấu trúc câu <span className="font-semibold text-white">trong ~15 giây</span>.
            Không cần đăng ký.
          </p>
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-300">
            <span className="inline-flex items-center gap-2"><Clock size={16} className="text-[#FFCE00]" /> Kết quả tức thì</span>
            <span className="inline-flex items-center gap-2"><ShieldCheck size={16} className="text-[#FFCE00]" /> Chuẩn Goethe/telc</span>
            <span className="inline-flex items-center gap-2"><CheckCircle2 size={16} className="text-[#FFCE00]" /> Miễn phí, không cần tài khoản</span>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-4xl gap-6 px-5 py-10 lg:grid-cols-5">
        {/* Form */}
        <form onSubmit={onSubmit} className="lg:col-span-3 space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div>
            <label htmlFor="topic" className="mb-1.5 block text-sm font-bold text-slate-700">
              Chủ đề bài viết <span className="font-normal text-slate-400">(tùy chọn)</span>
            </label>
            <input
              id="topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="VD: Eine E-Mail an einen Freund schreiben"
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="essay" className="text-sm font-bold text-slate-700">Bài viết tiếng Đức</label>
              <span className={`text-xs font-semibold ${tooShort ? 'text-rose-500' : 'text-slate-400'}`}>
                {charCount}/{MAX_CHARS}
              </span>
            </div>
            <textarea
              id="essay"
              value={essay}
              onChange={(e) => setEssay(e.target.value.slice(0, MAX_CHARS))}
              rows={9}
              placeholder="Dán hoặc gõ bài viết tiếng Đức của bạn vào đây…"
              className="w-full resize-y rounded-xl border border-slate-200 px-4 py-3 text-sm leading-relaxed outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
            {tooShort && (
              <p className="mt-1 text-xs font-medium text-rose-500">Bài viết cần tối thiểu {MIN_CHARS} ký tự.</p>
            )}
          </div>

          {/* Honeypot — visually hidden, off-screen; real users never fill it */}
          <div aria-hidden className="absolute left-[-9999px] top-[-9999px] h-0 w-0 overflow-hidden">
            <label htmlFor="website">Website</label>
            <input
              id="website"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="name" className="mb-1.5 block text-sm font-bold text-slate-700">
                Tên <span className="font-normal text-slate-400">(tùy chọn)</span>
              </label>
              <input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tên của bạn"
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            <div>
              <label htmlFor="contact" className="mb-1.5 block text-sm font-bold text-slate-700">
                Email / Zalo nhận kết quả
              </label>
              <div className="flex overflow-hidden rounded-xl border border-slate-200 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100">
                <select
                  value={contactType}
                  onChange={(e) => setContactType(e.target.value as ContactType)}
                  className="border-r border-slate-200 bg-slate-50 px-2 text-xs font-semibold text-slate-600 outline-none"
                  aria-label="Loại liên hệ"
                >
                  <option value="EMAIL">Email</option>
                  <option value="ZALO">Zalo</option>
                </select>
                <input
                  id="contact"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder={contactType === 'EMAIL' ? 'ban@email.com' : '09xx xxx xxx'}
                  className="w-full px-3 py-2.5 text-sm outline-none"
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
          >
            {submitting ? (
              <><Loader2 size={18} className="animate-spin" /> Đang chấm…</>
            ) : (
              <><Sparkles size={18} /> Chấm bài miễn phí</>
            )}
          </button>
          <p className="text-center text-xs text-slate-400">
            Chúng tôi chỉ dùng email/Zalo để gửi kết quả và tài liệu luyện thi. Không spam.
          </p>
        </form>

        {/* Result / pitch sidebar */}
        <aside className="lg:col-span-2 space-y-4">
          {result ? (
            <ResultCard result={result} />
          ) : (
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-bold text-slate-800">Bạn sẽ nhận được gì?</h2>
              <ul className="mt-4 space-y-3 text-sm text-slate-600">
                <Bullet>Điểm số theo thang 100, quy chiếu chuẩn Goethe/telc.</Bullet>
                <Bullet>Nhận xét cụ thể về ngữ pháp, từ vựng, cấu trúc câu.</Bullet>
                <Bullet>Gợi ý cách cải thiện để lên điểm bài thi thật.</Bullet>
              </ul>
              <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                <span className="font-semibold text-slate-800">Là giáo viên?</span> DeutschFlow chấm cả lớp
                tự động, theo dõi tiến độ và mức sẵn sàng thi của từng học viên.
              </div>
            </div>
          )}
        </aside>
      </div>
    </main>
  )
}

function ResultCard({ result }: { result: FreeGradeResult }) {
  const tone =
    result.score >= 80 ? 'from-emerald-500 to-teal-600' :
    result.score >= 60 ? 'from-indigo-500 to-violet-600' :
    'from-amber-500 to-orange-600'
  return (
    <div className="space-y-4">
      <div className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${tone} p-6 text-white shadow-lg`}>
        <p className="text-xs font-bold uppercase tracking-widest text-white/80">Điểm AI chấm</p>
        <p className="mt-1 text-6xl font-black leading-none">{result.score}<span className="text-2xl font-bold text-white/70">/100</span></p>
      </div>
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-bold uppercase tracking-wider text-slate-500">Nhận xét</p>
        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">{result.feedback}</p>
        {result.shareToken && (
          <div className="mt-5 border-t border-slate-100 pt-5">
            <p className="mb-3 text-sm font-semibold text-slate-700">Chia sẻ kết quả</p>
            <ShareButtons url={`/report/${result.shareToken}/`} score={result.score} />
          </div>
        )}
      </div>
      <Link
        href="/register"
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
      >
        Luyện thi không giới hạn với DeutschFlow <ArrowRight size={16} />
      </Link>
      <p className="px-1 text-center text-xs text-slate-400">{result.message}</p>
    </div>
  )
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-500" />
      <span>{children}</span>
    </li>
  )
}
