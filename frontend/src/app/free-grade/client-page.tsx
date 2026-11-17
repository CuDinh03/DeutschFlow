'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { BrandPageLoader } from '@/components/ui-v2/BrandPageLoader'
import { GaGlyphMark } from '@/components/ui-v2/GaGlyphMark'
import { httpStatus } from '@/lib/api'
import { submitFreeGrade, type ContactType, type FreeGradeResult } from '@/lib/marketingApi'
import { ShareButtons } from '@/components/marketing/ShareButtons'
import { GradeScore } from '@/components/marketing/GradeScore'
import { GaBtn } from '@/components/ui-v2/GaBtn'
import { GaInput } from '@/components/ui-v2/GaInput'
import { useTracking } from '@/hooks/useTracking'
import { B2B_EVENT } from '@/lib/analytics/b2bEvents'
import { START_HREF } from '@/components/landing-v2/links'

const MIN_CHARS = 50
const MAX_CHARS = 3000

const SAMPLE_PROMPTS = [
  {
    label: 'Đề mẫu 1: Dời lịch hẹn bác sĩ',
    topic: 'Einen Arzttermin verschieben (E-Mail B1)',
  },
  {
    label: 'Đề mẫu 2: Hỏi thông tin khóa tiếng Đức',
    topic: 'Informationen über einen Deutschkurs anfragen',
  },
] as const

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
        setError('AI đang bận. Bạn thử lại sau vài phút nhé.')
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
    <main className="mx-auto max-w-[1120px] px-5 pb-20 pt-8 sm:px-8 md:pt-14">
      {submitting && (
        <BrandPageLoader
          mode="fullscreen"
          label="Đang chấm bài viết tiếng Đức…"
          sublabel="AI đang đối chiếu ngữ pháp, từ vựng, nội dung và bố cục"
        />
      )}

      <div className="mb-4 inline-flex items-center gap-2 rounded-ga-pill border border-ga-border bg-ga-card px-3.5 py-1.5 text-ga-eyebrow uppercase text-ga-ink shadow-ga-sm">
        <span className="inline-block h-[7px] w-[7px] shrink-0 bg-ga-yellow" />Chấm thử miễn phí
      </div>
      <h1 className="max-w-[780px] font-ga-display text-ga-m-h1-m sm:text-ga-m-h1-t lg:text-ga-m-h1 text-ga-ink">
        Bài Schreiben B1 của bạn <em className="ga-hero-mark italic">được mấy điểm?</em>
      </h1>
      <p className="mt-4 max-w-[680px] text-ga-m-lead text-ga-muted">
        Dán bài viết tiếng Đức vào tờ giấy bên dưới. AI chấm theo thang 100 và nhận xét ngữ pháp, từ vựng, nội dung, bố cục. Không cần tạo tài khoản, chỉ cần email hoặc Zalo để nhận kết quả.
      </p>
      <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-ga-small text-ga-muted">
        <li className="inline-flex items-center gap-2">
          <GaGlyphMark name="thoigian" size={20} className="shrink-0 text-ga-ink" /> Kết quả hiện ngay trên trang này
        </li>
        <li className="inline-flex items-center gap-2">
          <GaGlyphMark name="viet" size={20} className="shrink-0 text-ga-ink" /> Chấm theo ngữ pháp, từ vựng, nội dung, bố cục
        </li>
        <li className="inline-flex items-center gap-2">
          <GaGlyphMark name="hoso" size={20} className="shrink-0 text-ga-ink" /> Không cần tạo tài khoản
        </li>
      </ul>

      <div className="mt-9 grid gap-7 lg:grid-cols-5">
        {/* Form viết trên giấy kẻ dòng Đức .briefpapier */}
        <form
          onSubmit={onSubmit}
          className="space-y-5 rounded-ga-xl border border-ga-border-strong bg-ga-card p-5 shadow-ga-md sm:p-7 lg:col-span-3"
        >
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="topic" className="text-ga-small font-semibold text-ga-ink">
                Chủ đề bài viết <span className="font-normal text-ga-muted">(tùy chọn)</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {SAMPLE_PROMPTS.map((sp) => (
                  <button
                    key={sp.topic}
                    type="button"
                    onClick={() => setTopic(sp.topic)}
                    className="rounded-ga-pill border border-ga-border bg-ga-bg px-2.5 py-1 text-ga-caption font-medium text-ga-ink transition-colors hover:border-ga-ink"
                  >
                    {sp.label}
                  </button>
                ))}
              </div>
            </div>
            <GaInput
              id="topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="VD: Eine E-Mail an einen Freund schreiben"
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="essay" className="text-ga-small font-semibold text-ga-ink">
                Bài viết tiếng Đức
              </label>
              <span className={`text-ga-caption font-semibold tabular-nums ${tooShort ? 'text-ga-red' : 'text-ga-muted'}`}>
                {charCount} / {MAX_CHARS} ký tự
              </span>
            </div>
            <div className={`briefpapier overflow-hidden rounded-ga-md border transition-shadow focus-within:ring-2 focus-within:ring-ga-focus ${tooShort ? 'border-ga-red' : 'border-ga-line'}`}>
              <textarea
                id="essay"
                lang="de"
                value={essay}
                onChange={(e) => setEssay(e.target.value.slice(0, MAX_CHARS))}
                rows={10}
                aria-invalid={tooShort || undefined}
                aria-describedby={tooShort ? 'essay-short' : undefined}
                placeholder="Sehr geehrte Damen und Herren, … (tối thiểu 50 ký tự)"
                className="w-full resize-y bg-transparent p-4 font-ga-ui text-ga-body-lg leading-[28px] text-ga-ink outline-none placeholder:text-ga-subtle"
              />
            </div>
            {tooShort && (
              <p id="essay-short" className="mt-1.5 text-ga-caption font-medium text-ga-red">
                Bài viết cần tối thiểu {MIN_CHARS} ký tự.
              </p>
            )}
          </div>

          {/* Honeypot — ẩn khỏi người thật và trình đọc màn hình */}
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
                Email hoặc Zalo của bạn <span className="font-normal text-ga-red">* (bắt buộc)</span>
              </label>
              <div className="flex min-h-11 overflow-hidden rounded-ga-sm border border-ga-line bg-ga-card focus-within:ring-2 focus-within:ring-ga-focus lg:min-h-10">
                <select
                  value={contactType}
                  onChange={(e) => setContactType(e.target.value as ContactType)}
                  className="border-r border-ga-line bg-ga-surface-2 px-2.5 text-ga-caption font-semibold text-ga-ink outline-none"
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
                  className="min-w-0 w-full bg-transparent px-3 py-2.5 text-ga-small font-medium text-ga-ink outline-none placeholder:text-ga-subtle"
                />
              </div>
            </div>
          </div>

          {error && (
            <div role="alert" className="rounded-ga-md border border-ga-red bg-ga-red-soft px-4 py-3 text-ga-small font-medium text-ga-red">
              {error}
            </div>
          )}

          <GaBtn type="submit" variant="yellow" size="lg" disabled={!canSubmit} className="ga-btn-gleam w-full">
            <span className="inline-block h-[7px] w-[7px] shrink-0 bg-ga-ink" />
            {submitting ? 'Đang chấm bài…' : 'Chấm bài miễn phí'}
          </GaBtn>
          <p className="text-center text-ga-caption text-ga-muted">
            Kết quả hiện ngay trên trang. Email hoặc Zalo dùng để gửi liên kết kết quả và chống lạm dụng lượt chấm thử. Không spam.
          </p>
        </form>

        {/* Kết quả / cột bên */}
        <aside className="space-y-4 lg:col-span-2" aria-live="polite">
          {result ? (
            <ResultCard result={result} />
          ) : (
            <div className="rounded-ga-xl border border-ga-border bg-ga-card p-6 shadow-ga-sm">
              <h2 className="font-ga-display text-ga-h2 text-ga-ink">Bạn sẽ nhận được gì?</h2>
              <ul className="mt-4 space-y-3 text-ga-small text-ga-muted">
                <Bullet>Điểm theo thang 100, không phải điểm thi chính thức (không liên kết với Goethe-Institut hay telc).</Bullet>
                <Bullet>Nhận xét về ngữ pháp, từ vựng, nội dung và bố cục.</Bullet>
                <Bullet>Chỉ ra chỗ cần sửa để bài viết lần sau mạch lạc và đúng ngữ pháp hơn.</Bullet>
              </ul>
              <div className="mt-5 rounded-ga-md bg-ga-surface-2 p-4 text-ga-small text-ga-muted">
                <span className="font-semibold text-ga-ink">Là giáo viên?</span> Ở trung tâm dùng myDeutschFlow, AI
                chấm nháp bài cả lớp, giáo viên xem lại và chốt điểm, theo dõi tiến độ từng học viên.
              </div>
            </div>
          )}
        </aside>
      </div>
    </main>
  )
}

/** Câu dưới kết quả chấm thử — câu cố định theo sổ lời hứa. */
export const RESULT_NOTE =
  'Đây là bản chấm thử bằng AI, điểm để tham khảo. Muốn luyện đủ 4 phần thi telc B1, bạn dùng thử 7 ngày, không cần thanh toán trước.'

function ResultCard({ result }: { result: FreeGradeResult }) {
  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-ga-lg shadow-ga-md">
        <GradeScore score={result.score} />
        <div className="rounded-b-ga-lg border-x border-b border-ga-border-strong bg-ga-card p-6">
          <p className="inline-flex items-center gap-1.5 text-ga-eyebrow uppercase text-ga-red">
            <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-ga-pill bg-ga-red" />
            Nhận xét chi tiết
          </p>
          <p className="mt-2.5 whitespace-pre-line text-ga-body text-ga-ink">{result.feedback}</p>
          {result.shareToken && (
            <div className="mt-5 border-t border-ga-border pt-5">
              <p className="mb-3 text-ga-small font-semibold text-ga-ink">Chia sẻ kết quả</p>
              <ShareButtons url={`/report/${result.shareToken}/`} score={result.score} />
            </div>
          )}
        </div>
      </div>
      <GaBtn asChild variant="yellow" size="lg" className="ga-btn-gleam w-full">
        <Link href={START_HREF}>
          Học thử miễn phí <ArrowRight size={16} aria-hidden />
        </Link>
      </GaBtn>
      <p className="px-1 text-center text-ga-caption text-ga-muted">{RESULT_NOTE}</p>
    </div>
  )
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span aria-hidden className="mt-1.5 inline-block h-[7px] w-[7px] shrink-0 bg-ga-yellow" />
      <span>{children}</span>
    </li>
  )
}
