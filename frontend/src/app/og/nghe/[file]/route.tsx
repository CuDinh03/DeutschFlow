import { OccupationCard, OG_CATALOG, TextCard, pickOgQuestion } from '@/lib/og/ogCards'
import { renderOg } from '@/lib/og/renderOg'
import { fetchOccupationDetail } from '@/lib/occupationServer'
import { occupationName, questionTranslation, type OccupationDetail } from '@/lib/occupationTypes'
import { DEFAULT_PUBLIC_LOCALE, isPublicLocale, type PublicLocale } from '@/lib/publicLocale'
import { interviewerInfo } from '@/components/landing-v2/interviewerInfo'

/**
 * `/og/nghe/<mã>.png?l=<vi|en|de>` — ảnh chia sẻ của trang nghề (A3, 08/11/2026): tên nghề + một câu
 * hỏi thật đã duyệt (`pickOgQuestion`).
 *
 * Mã lạ → 404. Backend lỗi tạm → ảnh chung của trang tổng nghề, cache ngắn (5 phút) để lần sau có ảnh đúng.
 */
export async function GET(req: Request, { params }: { params: { file: string } }) {
  const code = /^([a-z0-9_]{1,64})\.png$/.exec(params.file)?.[1]
  if (!code) return new Response('Not found', { status: 404 })
  const l = new URL(req.url).searchParams.get('l')
  const locale: PublicLocale = l && isPublicLocale(l) ? l : DEFAULT_PUBLIC_LOCALE

  let detail: OccupationDetail | null
  try {
    detail = await fetchOccupationDetail(code)
  } catch {
    const o = OG_CATALOG[locale].occupationPages.index
    return renderOg(<TextCard eyebrow={o.cap} lead={o.title} sub={o.intro} />, 300)
  }
  if (!detail) return new Response('Not found', { status: 404 })

  const o = detail.occupation
  const q = pickOgQuestion(detail.sampleQuestions)
  return renderOg(
    <OccupationCard
      locale={locale}
      nameDe={o.nameDe}
      nameLocal={locale === 'de' ? null : occupationName(o, locale)}
      question={q?.questionDe ?? null}
      translation={q ? questionTranslation(q, locale) : null}
      interviewer={interviewerInfo(detail.personaCode)?.name ?? null}
    />,
  )
}
