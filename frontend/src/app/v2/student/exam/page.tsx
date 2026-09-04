'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ArrowRight, BookOpen, ClipboardCheck, FileText, Headphones, Info, Mic, PenTool } from 'lucide-react'
import { useStudentPracticeSession } from '@/hooks/useStudentPracticeSession'
import { GaCap, GaCard, GaPageHdr } from '@/components/ui-v2'

/**
 * Prüfung hub — `/v2/student/exam` (S-09, IA §6.3).
 *
 * Trước đây màn này là một trang giới thiệu tĩnh: bốn thẻ "luyện theo kỹ năng" mà **ba trong bốn
 * đều dẫn về cùng một chỗ** (`/mock-exam`), cộng bốn thẻ cấp độ không bấm được. Nó hứa nhiều
 * đường đi hơn số đường thật sự có (IA-04).
 *
 * Hub mới nói đúng những gì hệ thống có, theo ba nhóm của IA §6.3:
 *   1. **Prüfungssimulation** — bài thi đầy đủ có giờ. Đây là hành động chính, nên nó chiếm khối
 *      lớn nhất và là thứ duy nhất mang CTA nổi.
 *   2. **B1-Bereitschaft** — đánh giá mức sẵn sàng, một khái niệm KHÁC với thi thử.
 *   3. **Prüfungsberichte** — lịch sử và phiếu điểm.
 * Bốn kỹ năng Goethe không còn giả làm bốn destination: chúng là dải MÔ TẢ đề thi gồm những gì,
 * và chỉ Sprechen mang một đường đi thật (cross-link sang phòng luyện nói, có nhãn mode).
 *
 * Dòng ngữ cảnh "đang chuẩn bị cấp nào" chỉ hiện khi có dữ liệu thật; không có thì bỏ hẳn dòng đó
 * chứ không bịa một cấp mặc định (P4-D5).
 */

/** Bốn kỹ năng của đề Goethe — mô tả cấu trúc đề, không phải bốn lối đi. */
const SKILLS = [
  { key: 'lesen', icon: BookOpen },
  { key: 'hoeren', icon: Headphones },
  { key: 'schreiben', icon: PenTool },
  { key: 'sprechen', icon: Mic },
] as const

export default function V2StudentExamPage() {
  const t = useTranslations('v2.student.exam')
  const { targetLevel, loading } = useStudentPracticeSession()

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr accent title={t('title')} subtitle={t('subtitle')} />

      <div className="flex-1 px-4 py-6 sm:px-6 lg:px-10">
        {/* Ngữ cảnh: chỉ in khi biết thật. Không có `targetLevel` thì không có dòng nào. */}
        {!loading && targetLevel && (
          <p className="ga-ui mb-5 text-ga-body text-ga-muted">
            {t.rich('preparingFor', {
              level: targetLevel,
              strong: (chunks) => <span className="font-semibold text-ga-ink">{chunks}</span>,
            })}
          </p>
        )}

        {/* ── 1. Prüfungssimulation — hành động chính ───────────────────────── */}
        <section aria-labelledby="sim-heading" className="mb-[22px]">
          <div className="flex flex-col gap-5 bg-ga-ink p-5 text-ga-bg md:flex-row md:items-center md:justify-between lg:p-7">
            <div className="min-w-0">
              <GaCap className="mb-2 block text-ga-subtle">{t('simCap')}</GaCap>
              <h2 id="sim-heading" className="font-ga-display text-ga-h1-m text-ga-bg lg:text-ga-h1">
                {t('simTitle')}
              </h2>
              <p className="ga-ui mt-1.5 max-w-[52ch] text-ga-body text-ga-subtle">{t('simDesc')}</p>

              {/* Cảnh báo TRƯỚC khi vào bài (B-13): phạm vi lưu phải nói ra trước, không để người
                  thi tự phát hiện sau khi mất bài. */}
              <p className="ga-ui mt-3.5 flex max-w-[52ch] items-start gap-2 text-ga-caption text-ga-subtle">
                <Info size={15} className="mt-px shrink-0" aria-hidden />
                <span>{t('simSaveNotice')}</span>
              </p>
            </div>

            <Link
              href="/v2/student/mock-exam"
              className="ga-ui inline-flex min-h-11 shrink-0 items-center gap-2 self-start rounded-ga bg-ga-yellow px-5 text-ga-body font-semibold text-ga-ink transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ga-ink md:self-center"
            >
              {t('simCta')} <ArrowRight size={16} aria-hidden />
            </Link>
          </div>
        </section>

        {/* ── 2 + 3. Đánh giá sẵn sàng · Báo cáo ────────────────────────────── */}
        <div className="mb-[22px] grid grid-cols-1 gap-[18px] md:grid-cols-2">
          {[
            {
              href: '/v2/student/assessment',
              icon: ClipboardCheck,
              capKey: 'readinessCap',
              titleKey: 'readinessTitle',
              descKey: 'readinessDesc',
            },
            {
              href: '/v2/student/mock-exam/run',
              icon: FileText,
              capKey: 'reportsCap',
              titleKey: 'reportsTitle',
              descKey: 'reportsDesc',
            },
          ].map(({ href, icon: Icon, capKey, titleKey, descKey }) => (
            <Link key={href} href={href} className="group focus-visible:outline-none">
              <GaCard
                hover
                className="flex h-full flex-col gap-2.5 p-5 group-focus-visible:ring-2 group-focus-visible:ring-ga-focus group-focus-visible:ring-inset"
              >
                <span className="grid h-11 w-11 place-items-center rounded-ga bg-ga-accent-soft text-ga-accent">
                  <Icon size={20} aria-hidden />
                </span>
                <GaCap className="block">{t(capKey)}</GaCap>
                <h2 className="text-ga-h3 text-ga-ink">{t(titleKey)}</h2>
                <p className="ga-ui text-ga-small text-ga-muted">{t(descKey)}</p>
                <ArrowRight
                  size={16}
                  className="mt-auto text-ga-subtle transition-colors group-hover:text-ga-accent"
                  aria-hidden
                />
              </GaCard>
            </Link>
          ))}
        </div>

        {/* ── 4. Đề thi gồm những gì ────────────────────────────────────────── */}
        <section aria-labelledby="skills-heading">
          <h2 id="skills-heading" className="ga-ui mb-3 block uppercase text-ga-stat-label text-ga-muted">
            {t('skillsCap')}
          </h2>
          <div className="grid grid-cols-1 divide-y divide-ga-line border border-ga-line bg-ga-card sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4">
            {SKILLS.map(({ key, icon: Icon }) => (
              <div key={key} className="flex items-start gap-3 border-ga-line p-4 sm:border-l sm:first:border-l-0 lg:p-5">
                <Icon size={18} className="mt-0.5 shrink-0 text-ga-subtle" aria-hidden />
                <div className="min-w-0">
                  <h3 className="text-ga-h3 text-ga-ink">{t(`skills.${key}Name`)}</h3>
                  <p className="ga-ui mt-1 text-ga-caption text-ga-muted">{t(`skills.${key}Desc`)}</p>
                  {/* Chỉ Sprechen có một phòng luyện riêng — và nói rõ đó là phòng LUYỆN, không
                      phải một phần của bài thi mô phỏng. */}
                  {key === 'sprechen' && (
                    <Link
                      href="/v2/student/speaking"
                      className="ga-ui mt-2 inline-flex min-h-11 items-center gap-1.5 text-ga-small font-semibold text-ga-accent transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus focus-visible:ring-inset lg:min-h-0"
                    >
                      {t('skills.sprechenLink')} <ArrowRight size={14} aria-hidden />
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
