import type { ReactNode } from 'react'
import landingVi from '../../../messages/v2/landing.vi.json'
import landingEn from '../../../messages/v2/landing.en.json'
import landingDe from '../../../messages/v2/landing.de.json'
import { OG_SIZE } from '@/lib/ogImage'
import type { PublicLocale } from '@/lib/publicLocale'
import type { OccupationDetail } from '@/lib/occupationTypes'

/**
 * Mẫu ảnh chia sẻ 1200×630 (A3, 08/11/2026) — cây JSX thuần cho satori (`next/og`), không gọi
 * runtime nào nên dựng thử được ngoài Next. Phần nạp font + `ImageResponse` ở `renderOg.ts`.
 * Hệ Galerie: nền giấy, chữ mực, ô vuông vàng, viền mảnh; tiêu đề Newsreader, chữ thường Be Vietnam Pro.
 *
 * Satori không có dòng chữ "inline" trộn kiểu: tiêu đề tách thành từng từ trong một hàng flex-wrap.
 */

const C = {
  bg: '#FBFAF7', card: '#FFFFFF', ink: '#161513', muted: '#76716A', border: '#E7E3DA',
  yellow: '#FFCD00', red: '#DA291C', green: '#1E9E61', greenBg: '#E3F4EA', redBg: '#FBE7E5',
}

type Catalog = typeof landingVi.landing
export const OG_CATALOG: Record<PublicLocale, Catalog> = {
  vi: landingVi.landing,
  en: landingEn.landing as unknown as Catalog,
  de: landingDe.landing as unknown as Catalog,
}

/** Nhãn "minh hoạ" của thẻ báo cáo mẫu — trang ghi rõ báo cáo là minh hoạ, ảnh cũng phải ghi. */
const SAMPLE_TAG: Record<PublicLocale, string> = { vi: 'Minh hoạ', en: 'Sample', de: 'Beispiel' }

/** Bốn tệp WOFF đầy đủ glyph tiếng Việt/Đức (OFL) ở `public/og-fonts/`. */
export const OG_FONT_FILES = [
  ['Be Vietnam Pro', 400, 'normal', 'BeVietnamPro-Regular.woff'],
  ['Be Vietnam Pro', 600, 'normal', 'BeVietnamPro-SemiBold.woff'],
  ['Newsreader', 500, 'normal', 'Newsreader-Medium.woff'],
  ['Newsreader', 500, 'italic', 'Newsreader-MediumItalic.woff'],
] as const

// ── Mảnh dùng chung ──────────────────────────────────────────────────────────

function Logo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <svg width="46" height="46" viewBox="0 0 100 100" fill="none">
        <path d="M 20 18 L 20 82 L 52 82 L 74 62 L 74 38 L 52 18 Z" fill="none" stroke={C.ink} strokeWidth="6" strokeLinejoin="miter" />
        <polygon points="52,38 74,50 52,62" fill={C.red} />
        <rect x="24" y="45" width="9" height="9" fill={C.yellow} />
      </svg>
      <div style={{ display: 'flex', fontSize: 23, color: C.ink }}>
        <span style={{ fontWeight: 400 }}>my</span>
        <span style={{ fontWeight: 600 }}>Deutsch</span>
        <span style={{ fontWeight: 600, color: C.red }}>Flow</span>
      </div>
    </div>
  )
}

function Eyebrow({ children }: { children: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 17, fontWeight: 600, letterSpacing: 2.2, textTransform: 'uppercase', color: C.muted }}>
      <div style={{ width: 11, height: 11, background: C.yellow }} />
      {children}
    </div>
  )
}

/** Tiêu đề tách từ: phần `em` nghiêng, có dải vàng phía dưới như gạch vàng ở hero. */
function Headline({ lead, em, size }: { lead: string; em?: string; size: number }) {
  const words = (s: string) => s.split(/\s+/).filter(Boolean)
  const leadWords = words(lead)
  const emWords = em ? words(em) : []
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', fontFamily: 'Newsreader', fontWeight: 500, fontSize: size, lineHeight: 1.1, letterSpacing: -1, color: C.ink }}>
      {leadWords.map((w, i) => (
        <span key={`l${i}`} style={{ marginRight: size * 0.24 }}>{w}</span>
      ))}
      {emWords.map((w, i) => (
        <span
          key={`e${i}`}
          style={{
            fontStyle: 'italic',
            paddingRight: i < emWords.length - 1 ? size * 0.24 : 2,
            backgroundImage: `linear-gradient(to bottom, transparent 66%, ${C.yellow} 66%, ${C.yellow} 94%, transparent 94%)`,
          }}
        >
          {w}
        </span>
      ))}
    </div>
  )
}

/** Cột chữ bên trái. Satori không trải phẳng Fragment (thành một hộp flex hàng ngang) nên phải là div. */
function Stack({ children }: { children: ReactNode }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>{children}</div>
}

function Site() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 19, color: C.muted }}>
      <div style={{ width: 8, height: 8, background: C.ink }} />
      mydeutschflow.com
    </div>
  )
}

function Frame({ left, right, rightWidth = 0 }: { left: ReactNode; right?: ReactNode; rightWidth?: number }) {
  return (
    <div style={{ width: OG_SIZE.width, height: OG_SIZE.height, display: 'flex', background: C.bg, fontFamily: 'Be Vietnam Pro', color: C.ink, padding: '60px 68px', gap: 56 }}>
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1, minWidth: 0 }}>
        <Logo />
        {left}
        <Site />
      </div>
      {right && <div style={{ display: 'flex', width: rightWidth, position: 'relative' }}>{right}</div>}
    </div>
  )
}

/** Thẻ trắng có khối vàng lệch phía sau — cùng mô-típ cột phải hero trang chủ. */
function OffsetCard({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'flex', position: 'relative', width: '100%', alignSelf: 'center' }}>
      <div style={{ position: 'absolute', right: -18, top: -18, width: '86%', height: '78%', background: C.yellow }} />
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', background: C.card, border: `1px solid ${C.border}`, padding: 30, gap: 18 }}>
        {children}
      </div>
    </div>
  )
}

function Cap({ children, color = C.muted }: { children: string; color?: string }) {
  return <div style={{ display: 'flex', fontSize: 14, fontWeight: 600, letterSpacing: 1.8, textTransform: 'uppercase', color }}>{children}</div>
}

/** Câu tiếng Đức tách từ, tô một cụm (`mark`) theo kiểu sai/đúng. */
function Sentence({ text, mark, tone }: { text: string; mark: string; tone: 'wrong' | 'right' }) {
  const at = text.indexOf(mark)
  const parts = at < 0 ? [[text, false]] : [[text.slice(0, at), false], [mark, true], [text.slice(at + mark.length), false]]
  const markStyle = tone === 'wrong'
    ? { color: C.red, textDecoration: 'line-through', background: C.redBg }
    : { color: C.green, fontWeight: 600 as const, background: C.greenBg }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', fontFamily: 'Newsreader', fontStyle: 'italic', fontSize: 23, lineHeight: 1.35, color: C.ink }}>
      {parts.flatMap(([chunk, isMark], pi) =>
        String(chunk).split(/\s+/).filter(Boolean).map((w, wi) => (
          <span key={`${pi}-${wi}`} style={{ marginRight: 6, padding: isMark ? '0 3px' : 0, ...(isMark ? markStyle : {}) }}>{w}</span>
        )),
      )}
    </div>
  )
}

/**
 * Câu hỏi đưa lên ảnh trang nghề: câu chuyên môn ĐÃ DUYỆT (bộ viết tay hoặc lớp nghề đã duyệt) trước,
 * không có thì câu mở đầu. Không bao giờ lấy câu AI chưa duyệt — ảnh không mang được nhãn chất lượng
 * như trang (sổ lời hứa).
 */
export function pickOgQuestion(questions: OccupationDetail['sampleQuestions']) {
  const trusted = questions.filter((q) => q.source !== 'AI_GENERATED')
  return trusted.find((q) => q.phase !== 'INTRO') ?? trusted[0] ?? null
}

// ── Bốn mẫu ảnh ──────────────────────────────────────────────────────────────

/** Trang chủ: tiêu đề hero + thẻ báo cáo "Bạn đã nói / Nên nói". */
export function HomeCard({ locale }: { locale: PublicLocale }) {
  const t = OG_CATALOG[locale]
  const size = (t.hero.titleLead + t.hero.titleEm).length > 52 ? 54 : 62
  return (
    <Frame
      rightWidth={470}
      left={<Headline lead={t.hero.titleLead} em={t.hero.titleEm} size={size} />}
      right={
        <OffsetCard>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Cap>{t.report.cap}</Cap>
            <div style={{ display: 'flex', fontSize: 13, fontWeight: 600, color: C.muted, border: `1px solid ${C.border}`, padding: '3px 9px' }}>{SAMPLE_TAG[locale]}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
            <div style={{ display: 'flex', fontFamily: 'Newsreader', fontSize: 44, lineHeight: 1 }}>{t.report.overall}</div>
            <div style={{ display: 'flex', fontSize: 15, color: C.muted }}>Koch/Köchin</div>
          </div>
          <div style={{ display: 'flex', height: 1, background: C.border }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Cap color={C.red}>{t.report.quoteCap}</Cap>
            <Sentence text={t.report.quote} mark={t.report.quoteWrong} tone="wrong" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Cap color={C.green}>{t.report.fixCap}</Cap>
            <Sentence text={t.report.fix} mark={t.report.fixRight} tone="right" />
          </div>
        </OffsetCard>
      }
    />
  )
}

/** Trang chữ (trung tâm, tổng nghề): nhãn + tiêu đề lớn, khối vàng góc phải. */
export function TextCard({ eyebrow, lead, em, sub }: { eyebrow: string; lead: string; em?: string; sub?: string }) {
  const size = (lead + (em ?? '')).length > 70 ? 56 : 66
  return (
    <Frame
      rightWidth={170}
      left={
        <Stack>
          <Eyebrow>{eyebrow}</Eyebrow>
          <Headline lead={lead} em={em} size={size} />
          {sub && <div style={{ display: 'flex', fontSize: 22, lineHeight: 1.5, color: C.muted, maxWidth: 820 }}>{sub}</div>}
        </Stack>
      }
      right={
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'flex-end', width: '100%', gap: 14 }}>
          <div style={{ width: 120, height: 120, background: C.yellow }} />
          <div style={{ width: 52, height: 52, background: C.ink }} />
        </div>
      }
    />
  )
}

/** Trang luyện thi: tiêu đề + bốn phần thi. Trang `/luyen-thi` hiện chỉ có tiếng Việt. */
export function ExamCard() {
  const parts: [string, string][] = [['Lesen', 'Đọc'], ['Hören', 'Nghe'], ['Schreiben', 'Viết'], ['Sprechen', 'Nói']]
  return (
    <Frame
      rightWidth={400}
      left={
        <Stack>
          <Eyebrow>Goethe · telc · A2 – B2</Eyebrow>
          <Headline lead="Luyện thi tiếng Đức" em="theo format đề thật." size={64} />
          <div style={{ display: 'flex', fontSize: 22, lineHeight: 1.5, color: C.muted }}>Cấu trúc đề, cách tính điểm, checklist sẵn sàng thi.</div>
        </Stack>
      }
      right={
        <div style={{ display: 'flex', flexWrap: 'wrap', alignContent: 'center', gap: 16, width: '100%' }}>
          {parts.map(([de, vi], i) => (
            <div key={de} style={{ display: 'flex', flexDirection: 'column', gap: 6, width: 192, padding: '24px 22px', background: i === 3 ? C.ink : C.card, border: `1px solid ${i === 3 ? C.ink : C.border}` }}>
              <div style={{ width: 10, height: 10, background: C.yellow }} />
              <div style={{ display: 'flex', fontFamily: 'Newsreader', fontStyle: 'italic', fontSize: 32, color: i === 3 ? C.card : C.ink }}>{de}</div>
              <div style={{ display: 'flex', fontSize: 17, color: i === 3 ? C.border : C.muted }}>{vi}</div>
            </div>
          ))}
        </div>
      }
    />
  )
}

/** Trang nghề: tên nghề + một câu hỏi thật của người phỏng vấn. */
export function OccupationCard({
  locale, nameDe, nameLocal, question, translation, interviewer,
}: {
  locale: PublicLocale
  nameDe: string
  nameLocal: string | null
  question: string | null
  translation: string | null
  interviewer: string | null
}) {
  const t = OG_CATALOG[locale]
  const detail = t.occupationPages.detail
  return (
    <Frame
      rightWidth={question ? 480 : 0}
      left={
        <Stack>
          <Eyebrow>{t.occupationPages.index.cap}</Eyebrow>
          <Headline lead={nameDe} size={nameDe.length > 22 ? 58 : 72} />
          {nameLocal && <div style={{ display: 'flex', fontSize: 26, color: C.muted }}>{nameLocal}</div>}
        </Stack>
      }
      right={
        question ? (
          <OffsetCard>
            <Cap>{detail.questionsCap}</Cap>
            <div style={{ display: 'flex', fontFamily: 'Newsreader', fontStyle: 'italic', fontSize: 30, lineHeight: 1.3 }}>„{question}“</div>
            {translation && <div style={{ display: 'flex', fontSize: 19, lineHeight: 1.45, color: C.muted }}>{translation}</div>}
            {interviewer && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderTop: `1px solid ${C.border}`, paddingTop: 14, fontSize: 16, color: C.muted }}>
                <div style={{ width: 8, height: 8, background: C.yellow }} />
                {`${detail.interviewer}: ${interviewer}`}
              </div>
            )}
          </OffsetCard>
        ) : undefined
      }
    />
  )
}
