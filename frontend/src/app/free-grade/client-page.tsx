'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Sparkles, Loader2, Check, ArrowRight, Clock, ShieldCheck } from 'lucide-react'
import { httpStatus } from '@/lib/api'
import { submitFreeGrade, type ContactType, type FreeGradeResult } from '@/lib/marketingApi'
import { ShareButtons } from '@/components/marketing/ShareButtons'
import { GradeScore } from '@/components/marketing/GradeScore'
import { GaBtn } from '@/components/ui-v2/GaBtn'
import { GaInput, GaTextarea } from '@/components/ui-v2/GaInput'
import { useTracking } from '@/hooks/useTracking'
import { B2B_EVENT } from '@/lib/analytics/b2bEvents'
import { START_HREF } from '@/components/landing-v2/links'

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
    <main className="mx-auto max-w-[1080px] px-5 pb-16 pt-10 sm:px-8 md:pt-14">
      <div className="mb-[18px] inline-flex items-center gap-2 text-ga-eyebrow uppercase text-ga-muted">
        <span className="inline-block h-[7px] w-[7px] shrink-0 bg-ga-yellow" />Chấm thử miễn phí
      </div>
      <h1 className="max-w-[760px] font-ga-display text-ga-h1-m font-medium leading-[1.1] sm:text-ga-h1">
        Bài Schreiben B1 của bạn được mấy điểm?
      </h1>
      <p className="mt-5 max-w-[680px] text-ga-body-lg text-ga-muted">
        Dán bài viết tiếng Đức vào ô bên dưới. AI chấm theo thang 100 và chỉ ra lỗi ngữ pháp, từ vựng,
        cấu trúc câu, kèm câu sửa. Không cần tạo tài khoản.
      </p>
      <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-ga-small text-ga-muted">
        <li className="inline-flex items-center gap-2"><Clock size={16} aria-hidden className="text-ga-ink" /> Kết quả hiện ngay trên trang này</li>
        <li className="inline-flex items-center gap-2"><ShieldCheck size={16} aria-hidden className="text-ga-ink" /> Tham chiếu tiêu chí bài viết B1</li>
        <li className="inline-flex items-center gap-2"><Check size={16} aria-hidden className="text-ga-ink" /> Không cần tạo tài khoản, chỉ cần email hoặc Zalo để nhận kết quả</li>
      </ul>

      <div className="mt-10 grid gap-6 lg:grid-cols-5">
        {/* Form */}
        <form onSubmit={onSubmit} className="space-y-5 border border-ga-border bg-ga-card p-5 sm:p-8 lg:col-span-3">
          <div>
            <label htmlFor="topic" className="mb-1.5 block text-ga-small font-semibold text-ga-ink">
              Chủ đề bài viết <span className="font-normal text-ga-muted">(tùy chọn)</span>
            </label>
            <GaInput
              id="topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="VD: Eine E-Mail an einen Freund schreiben"
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="essay" className="text-ga-small font-semibold text-ga-ink">Bài viết tiếng Đức</label>
              <span className={`text-ga-caption font-semibold tabular-nums ${tooShort ? 'text-ga-red' : 'text-ga-muted'}`}>
                {charCount}/{MAX_CHARS}
              </span>
            </div>
            <GaTextarea
              id="essay"
              value={essay}
              onChange={(e) => setEssay(e.target.value.slice(0, MAX_CHARS))}
              rows={9}
              invalid={tooShort}
              aria-describedby={tooShort ? 'essay-short' : undefined}
              placeholder="Dán hoặc gõ bài viết tiếng Đức của bạn vào đây…"
              className="resize-y leading-relaxed"
            />
            {tooShort && (
              <p id="essay-short" className="mt-1 text-ga-caption font-medium text-ga-red">
                Bài viết cần tối thiểu {MIN_CHARS} ký tự.
              </p>
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
              <label htmlFor="name" className="mb-1.5 block text-ga-small font-semibold text-ga-ink">
                Tên <span className="font-normal text-ga-muted">(tùy chọn)</span>
              </label>
              <GaInput id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên của bạn" />
            </div>
            <div>
              <label htmlFor="contact" className="mb-1.5 block text-ga-small font-semibold text-ga-ink">
                Email / Zalo nhận kết quả <span className="font-normal text-ga-muted">(bắt buộc)</span>
                <span className="sr-only"> (bắt buộc)</span>
              </label>
              <div className="flex min-h-11 overflow-hidden rounded-ga-touch border border-ga-line bg-ga-card focus-within:ring-2 focus-within:ring-ga-focus lg:min-h-9">
                <select
                  value={contactType}
                  onChange={(e) => setContactType(e.target.value as ContactType)}
                  className="border-r border-ga-line bg-ga-surface px-2 text-ga-caption font-semibold text-ga-ink outline-none"
                  aria-label="Loại liên hệ"
                >
                  <option value="EMAIL">Email</option>
                  <option value="ZALO">Zalo</option>
                </select>
                <input
                  id="contact"
                  aria-required="true"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder={contactType === 'EMAIL' ? 'ban@email.com' : '09xx xxx xxx'}
                  className="w-full bg-transparent px-3 py-2.5 text-ga-small font-medium text-ga-ink outline-none placeholder:text-ga-subtle"
                />
              </div>
            </div>
          </div>

          {error && (
            <div role="alert" className="border border-ga-red bg-ga-red-soft px-4 py-3 text-ga-small font-medium text-ga-red">
              {error}
            </div>
          )}

          <GaBtn type="submit" variant="ink" size="lg" disabled={!canSubmit} className="w-full">
            {submitting ? (
              <><Loader2 size={18} aria-hidden className="ga-spin" /> Đang chấm…</>
            ) : (
              <><Sparkles size={18} aria-hidden /> Chấm bài miễn phí</>
            )}
          </GaBtn>
          <p className="text-center text-ga-caption text-ga-muted">
            Chúng tôi chỉ dùng email/Zalo để gửi kết quả và tài liệu luyện thi. Không spam.
          </p>
        </form>

        {/* Result / pitch sidebar */}
        <aside className="space-y-4 lg:col-span-2" aria-live="polite">
          {result ? (
            <ResultCard result={result} />
          ) : (
            <div className="border border-ga-border bg-ga-card p-6">
              <h2 className="text-ga-h3 text-ga-ink">Bạn sẽ nhận được gì?</h2>
              <ul className="mt-4 space-y-3 text-ga-small text-ga-muted">
                <Bullet>Điểm số theo thang 100, mô phỏng tiêu chí bài viết B1 (không liên kết với Goethe-Institut hay telc).</Bullet>
                <Bullet>Nhận xét cụ thể về ngữ pháp, từ vựng, cấu trúc câu.</Bullet>
                <Bullet>Gợi ý sửa để bài sau tốt hơn.</Bullet>
              </ul>
              <div className="mt-5 bg-ga-surface p-4 text-ga-small text-ga-muted">
                <span className="font-semibold text-ga-ink">Là giáo viên?</span> myDeutschFlow chấm nháp cả lớp
                để bạn chốt điểm, theo dõi tiến độ và mức sẵn sàng thi của từng học viên.
              </div>
            </div>
          )}
        </aside>
      </div>
    </main>
  )
}

function ResultCard({ result }: { result: FreeGradeResult }) {
  return (
    <div className="space-y-4">
      <div>
        <GradeScore score={result.score} />
        <div className="border-x border-b border-ga-border bg-ga-card p-6">
          <p className="text-ga-eyebrow uppercase text-ga-muted">Nhận xét</p>
          <p className="mt-2 whitespace-pre-line text-ga-body text-ga-ink">{result.feedback}</p>
          {result.shareToken && (
            <div className="mt-5 border-t border-ga-border pt-5">
              <p className="mb-3 text-ga-small font-semibold text-ga-ink">Chia sẻ kết quả</p>
              <ShareButtons url={`/report/${result.shareToken}/`} score={result.score} />
            </div>
          )}
        </div>
      </div>
      <GaBtn asChild variant="ink" size="lg" className="w-full">
        <Link href={START_HREF}>
          Luyện tiếp với myDeutschFlow <ArrowRight size={16} aria-hidden />
        </Link>
      </GaBtn>
      <p className="px-1 text-center text-ga-caption text-ga-muted">{result.message}</p>
    </div>
  )
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <Check size={16} aria-hidden className="mt-0.5 shrink-0 text-ga-ink" />
      <span>{children}</span>
    </li>
  )
}
