/**
 * Lớp phủ dịch persona luyện nói (đợt 3 audit UTF-8/i18n 06/09/2026).
 *
 * Dùng next-intl THẬT (NextIntlClientProvider) + catalog thật (catalogMessages) thay vì mock trả key,
 * để chứng minh: (a) người dùng VI thấy đúng y chuỗi gốc trong lib/personas.ts và mọi persona / vị trí /
 * kịch bản / nhóm đều có khoá trong catalog; (b) locale de lấy labelDe + nhãn nhóm/vai trò tiếng Đức;
 * (c) id lạ lùi về fallback, không ném lỗi; (d) PersonaCard hiển thị qua lớp phủ.
 */
import React from 'react'
import { render, renderHook, screen } from '@testing-library/react'
import { NextIntlClientProvider, type AbstractIntlMessages } from 'next-intl'
import { describe, expect, it } from 'vitest'
import { catalogMessages, catalogT, type UiLocale } from '@/test/intlCatalog'
import { PERSONA_GROUPS, PERSONA_LIST, PERSONA_TOKENS, type PersonaId } from '@/lib/personas'
import { usePersonaText } from '@/components/features/ai-speaking/personaText'
import { PersonaCard } from '@/components/features/ai-speaking/PersonaCard'

// Cùng bộ ký tự "chắc chắn là tiếng Việt" với plans/tools/2026-09-06-utf8-i18n/hardcoded.py.
const VI_LETTERS = /[ăđơưạảấầẩẫậắằẳẵặẹẻẽếềểễệịỉĩọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i

function wrapperFor(locale: UiLocale) {
  const messages = catalogMessages(locale) as AbstractIntlMessages
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <NextIntlClientProvider locale={locale} messages={messages} timeZone="Asia/Ho_Chi_Minh">
        {children}
      </NextIntlClientProvider>
    )
  }
}

function personaText(locale: UiLocale) {
  return renderHook(() => usePersonaText(), { wrapper: wrapperFor(locale) }).result.current
}

function leaves(node: unknown, out: string[] = []): string[] {
  if (typeof node === 'string') out.push(node)
  else if (node && typeof node === 'object') Object.values(node).forEach((v) => leaves(v, out))
  return out
}

describe('usePersonaText — lớp phủ dịch persona', () => {
  it('vi: mọi persona / vị trí / kịch bản / nhóm có khoá trong catalog và trả đúng y chuỗi gốc của personas.ts', () => {
    const px = personaText('vi')
    const cat = catalogT('v2.student.personas', 'vi')
    for (const p of PERSONA_LIST) {
      for (const field of ['role', 'tag', 'desc'] as const) {
        expect(cat.has(`${p.id}.${field}`), `thiếu khoá ${p.id}.${field}`).toBe(true)
      }
      expect(px.role(p)).toBe(p.role)
      expect(px.tag(p)).toBe(p.tag)
      expect(px.desc(p)).toBe(p.desc)
      for (const o of p.interviewPositions ?? []) {
        expect(cat.has(`${p.id}.positions.${o.id}`), `thiếu khoá ${p.id}.positions.${o.id}`).toBe(true)
        expect(px.positionLabel(p.id, o.id)).toBe(o.label)
      }
      for (const o of p.lessonScenarios ?? []) {
        expect(cat.has(`${p.id}.scenarios.${o.id}`), `thiếu khoá ${p.id}.scenarios.${o.id}`).toBe(true)
        expect(px.scenarioLabel(p.id, o.id)).toBe(o.label)
      }
    }
    for (const g of PERSONA_GROUPS) {
      expect(cat.has(`groups.${g.id}`), `thiếu khoá groups.${g.id}`).toBe(true)
      expect(px.groupLabel(g.id)).toBe(g.label)
    }
  })

  it('de: vị trí / kịch bản trả labelDe, nhãn nhóm và vai trò là tiếng Đức', () => {
    const px = personaText('de')
    for (const o of PERSONA_TOKENS.lukas.interviewPositions ?? []) {
      expect(px.positionLabel('lukas', o.id)).toBe(o.labelDe)
    }
    expect(px.positionLabel('lukas', 'frontend_dev')).toBe('Frontend-Entwickler/in')
    expect(px.positionLabel('lena', 'kassierer')).toBe('Kassierer/in')
    for (const o of PERSONA_TOKENS.tuan.lessonScenarios ?? []) {
      expect(px.scenarioLabel('tuan', o.id)).toBe(o.labelDe)
    }
    expect(px.groupLabel('verkauf')).toBe('Verkauf')
    expect(px.groupLabel('special')).toBe('Vietnamesische Buddys')
    expect(px.role(PERSONA_TOKENS.lena)).toBe('Supermarktmitarbeiterin')
    expect(px.role(PERSONA_TOKENS.tuan)).not.toMatch(VI_LETTERS)
    expect(px.tag(PERSONA_TOKENS.minh)).not.toMatch(VI_LETTERS)
    // desc của Lukas vốn đã là tiếng Đức trong dữ liệu → bản de giữ nguyên câu đó.
    expect(px.desc(PERSONA_TOKENS.lukas)).toBe(PERSONA_TOKENS.lukas.desc)
  })

  it('en: vị trí Việt trong dữ liệu được dịch; catalog en/de của persona, companionSelect, chatBubble không còn tiếng Việt', () => {
    const px = personaText('en')
    expect(px.positionLabel('lena', 'kassierer')).toBe('Cashier (Kassierer)')
    expect(px.groupLabel('verkauf')).toBe('Retail')
    expect(px.desc(PERSONA_TOKENS.lukas)).not.toBe(PERSONA_TOKENS.lukas.desc)
    for (const locale of ['en', 'de'] as const) {
      const v2 = catalogMessages(locale).v2 as Record<string, Record<string, unknown>>
      for (const sub of ['personas', 'companionSelect', 'chatBubble']) {
        for (const s of leaves(v2.student[sub])) {
          expect(s, `${locale} ${sub}: "${s}" còn ký tự tiếng Việt`).not.toMatch(VI_LETTERS)
        }
      }
    }
  })

  it('persona / vị trí / nhóm lạ → lùi về dữ liệu gốc hoặc id, không ném lỗi', () => {
    const px = personaText('de')
    expect(px.positionLabel('ghost', 'x')).toBe('x')
    expect(px.scenarioLabel('lukas', 'nope')).toBe('nope')
    expect(px.groupLabel('nope')).toBe('nope')
    const ghost = { ...PERSONA_TOKENS.lukas, id: 'ghost' as PersonaId, role: 'R', tag: 'T', desc: 'D' }
    expect(px.role(ghost)).toBe('R')
    expect(px.tag(ghost)).toBe('T')
    expect(px.desc(ghost)).toBe('D')
  })
})

describe('PersonaCard — hiển thị qua lớp phủ dịch', () => {
  it('de: tag / role / desc và aria-label lấy từ catalog', () => {
    render(<PersonaCard persona={PERSONA_TOKENS.lena} isSelected={false} index={0} onClick={() => {}} />, {
      wrapper: wrapperFor('de'),
    })
    const de = catalogT('v2.student.personas', 'de')
    expect(screen.getByRole('button', { name: `Lena — ${de('lena.role')}` })).toBeInTheDocument()
    expect(screen.getByText(de('lena.tag'))).toBeInTheDocument()
    expect(screen.getByText(de('lena.desc'))).toBeInTheDocument()
  })

  it('vi: vẫn đúng y chuỗi gốc trong personas.ts', () => {
    render(<PersonaCard persona={PERSONA_TOKENS.tuan} isSelected index={0} onClick={() => {}} />, {
      wrapper: wrapperFor('vi'),
    })
    expect(screen.getByRole('button', { name: `Tuấn — ${PERSONA_TOKENS.tuan.role}` })).toBeInTheDocument()
    expect(screen.getByText(PERSONA_TOKENS.tuan.desc)).toBeInTheDocument()
  })
})
