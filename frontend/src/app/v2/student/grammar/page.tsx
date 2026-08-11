'use client'

import { useTranslations } from 'next-intl'
import { ArrowRight, Dumbbell, Sparkles } from 'lucide-react'
import { GaPageHdr, GaCard } from '@/components/ui-v2'

// Launcher cho hai công cụ ngữ pháp trong /v2. Trước đây trang này còn fetch GET /grammar/topics để
// duyệt chủ đề, nhưng endpoint đó KHÔNG tồn tại trên backend (chỉ có /grammar/syllabus/*) nên trang
// luôn rơi vào loadError (QA F-9). Việc duyệt chủ đề + luyện tập đã có đầy đủ ở trang "Luyện ngữ
// pháp" (grammar-syllabus flow), nên hub này chỉ giữ vai trò dẫn tới hai công cụ — không lặp lại.
const PRACTICE_HREF = '/v2/student/grammar/practice'
const AI_HREF = '/v2/student/grammar/ai'

export default function V2StudentGrammarPage() {
  const t = useTranslations('v2.student.grammar')

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr accent title={t('title')} subtitle={t('subtitle')} />

      <div className="flex-1 px-4 py-6 sm:px-6 lg:px-10">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <a href={PRACTICE_HREF} className="group block">
            <GaCard className="flex h-full items-center gap-4 px-5 py-6 transition-colors hover:bg-ga-surface">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-ga bg-ga-accent text-ga-accent-ink">
                <Dumbbell size={22} aria-hidden />
              </span>
              <span className="block min-w-0 flex-1 text-[16px] font-semibold text-ga-ink">{t('practiceCta')}</span>
              <ArrowRight size={18} className="shrink-0 text-ga-subtle transition-transform group-hover:translate-x-0.5" aria-hidden />
            </GaCard>
          </a>

          <a href={AI_HREF} className="group block">
            <GaCard className="flex h-full items-center gap-4 px-5 py-6 transition-colors hover:bg-ga-surface">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-ga border border-ga-line bg-ga-card text-ga-ink">
                <Sparkles size={22} aria-hidden />
              </span>
              <span className="block min-w-0 flex-1 text-[16px] font-semibold text-ga-ink">{t('aiCta')}</span>
              <ArrowRight size={18} className="shrink-0 text-ga-subtle transition-transform group-hover:translate-x-0.5" aria-hidden />
            </GaCard>
          </a>
        </div>
      </div>
    </div>
  )
}
