'use client'

import * as React from 'react'
import {
  Bike, BookOpen, Briefcase, Camera, Car, Dog, Drama, Dumbbell, GraduationCap, House, Laptop, Music, Paintbrush,
  Plane, Scissors, Sofa, Truck, Users, UtensilsCrossed, type LucideIcon,
} from 'lucide-react'
import '@/styles/ad-posters.css'
import { cn } from '@/lib/utils'
import { MarkedText, type MarkLayer } from '@/components/exam/marks/MarkedText'
import type { Mark } from '@/components/exam/marks/marksModel'
import { parseAdParts, type AdPart } from './adParts'
import { TEMPLATES_WITH_ICON, adIcon, assignTemplates, type AdIconKey, type PosterTemplate } from './adTemplates'
import { posterFontVars } from './posterFonts'

/** Hình nét Lucide (hệ icon của web, `ICON_WEB.md`) — chỉ để trang trí, luôn `aria-hidden`. */
const ICONS: Record<AdIconKey, LucideIcon> = {
  bike: Bike,
  truck: Truck,
  car: Car,
  plane: Plane,
  music: Music,
  theater: Drama,
  food: UtensilsCrossed,
  sport: Dumbbell,
  pet: Dog,
  camera: Camera,
  sewing: Scissors,
  paint: Paintbrush,
  course: GraduationCap,
  kids: Users,
  book: BookOpen,
  tech: Laptop,
  furniture: Sofa,
  home: House,
  job: Briefcase,
}

/** Khuôn đặt hình phía trên tiêu đề (canh giữa); các khuôn khác đặt hình sau tiêu đề, trôi bên phải. */
const ICON_ON_TOP: ReadonlySet<PosterTemplate> = new Set<PosterTemplate>(['bild', 'plakat', 'grau'])

/** Khuôn của từng mẩu trong một Teil — ổn định theo chữ của cả bộ mẩu (xem `assignTemplates`). */
export function usePosterTemplates(ads: ReadonlyArray<{ key: string; text: string }>): Record<string, PosterTemplate> {
  const sig = ads.map((a) => `${a.key}\u0000${a.text}`).join('\u0001')
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `sig` là chữ ký nội dung của `ads`
  return React.useMemo(() => assignTemplates(ads.map((a) => ({ ...a, parsed: parseAdParts(a.text) }))), [sig])
}

/**
 * Khối chứa các áp phích: ba cột cao thấp không đều như tờ đề (CSS nhiều cột) khi đủ rộng, hai cột hẹp chữ nhỏ
 * trên điện thoại, một cột khi rất hẹp — theo bề rộng của CHÍNH khối (container query), không theo màn hình,
 * vì khối nằm trong cột nguồn của khung hai vùng. Gắn luôn bốn biến phông `--font-poster-*`.
 */
export function AdPosterSheet({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('ad-sheet-wrap', posterFontVars)}>
      <div {...rest} className={cn('ad-sheet', className)}>
        {children}
      </div>
    </div>
  )
}

/**
 * Một mẩu rao vặt vẽ thành áp phích (telc Lesen Teil 3, 14/11/2026). Chữ vẫn là chữ thật theo đúng thứ tự đọc:
 * mỗi phần (tiêu đề / dòng phụ / thân / liên hệ) là một lát cắt của CÙNG chuỗi `text`, vẽ qua `MarkedText` với
 * `from`/`to` nên `span[data-seg]` mang đúng vị trí ký tự trong khối `block` — bút đánh dấu, đánh dấu đã lưu,
 * "mở từ sổ từ" chạy y như khi mẩu là một đoạn chữ trơn. Dải nghiêng, dải tối chỉ là CSS.
 */
export function AdPoster({
  block,
  text,
  template,
  layer,
  lastByGroup,
  className,
}: {
  /** Id khối chữ của mẩu (`ad:<k>`) — không đổi so với trước. */
  block: string
  /** Chữ của khối (đã chuẩn hoá xuống dòng) — không đổi so với trước. */
  text: string
  template: PosterTemplate
  layer?: MarkLayer | null
  lastByGroup?: Map<string, Mark>
  className?: string
}) {
  const parsed = React.useMemo(() => parseAdParts(text), [text])
  const iconKey = TEMPLATES_WITH_ICON.has(template) ? adIcon(text, parsed) : null
  const Icon = iconKey ? ICONS[iconKey] : null

  const run = (from: number, to: number) => (
    <MarkedText block={block} text={text} from={from} to={to} layer={layer} lastByGroup={lastByGroup} />
  )
  const head = parsed.parts.find((p) => p.role === 'headline')
  const tag = parsed.parts.find((p) => p.role === 'tagline')
  const body = parsed.parts.filter((p) => p.role === 'body')
  const contact = parsed.parts.find((p) => p.role === 'contact')
  // khuôn "dải giữa": dải tối là dòng phụ, không có thì dòng thân đầu
  const band: AdPart | undefined = template === 'band' ? tag ?? body[0] : undefined
  const icon = Icon ? <Icon className="ad-icon" aria-hidden focusable={false} /> : null
  const iconOnTop = ICON_ON_TOP.has(template)

  return (
    <div className={cn('ad-poster', className)} data-tpl={template} data-mode={parsed.mode} lang="de">
      {iconOnTop && icon}
      {head && (
        <span className="ad-head">
          <span className="ad-head-text">
            {run(head.s, head.soft ?? head.e)}
            {head.soft != null && <span className="ad-soft">{run(head.soft, head.e)}</span>}
          </span>
        </span>
      )}
      {!iconOnTop && icon}
      {tag && (
        <span className="ad-tag" data-band={band === tag ? '' : undefined}>
          {run(tag.s, tag.e)}
        </span>
      )}
      {body.length > 0 && (
        <span className="ad-body">
          {body.map((p) => (
            <span key={p.s} className="ad-line" data-band={band === p ? '' : undefined}>
              {run(p.s, p.e)}
            </span>
          ))}
        </span>
      )}
      {contact && <span className="ad-contact">{run(contact.s, contact.e)}</span>}
    </div>
  )
}
