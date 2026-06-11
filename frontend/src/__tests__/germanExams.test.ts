import { describe, it, expect } from 'vitest'
import { GERMAN_EXAMS, getExamBySlug, totalDurationMin } from '@/data/germanExams'

describe('germanExams data', () => {
  it('has a non-empty exam catalog', () => {
    expect(GERMAN_EXAMS.length).toBeGreaterThan(0)
  })

  it('has unique, URL-safe slugs', () => {
    const slugs = GERMAN_EXAMS.map((e) => e.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    for (const slug of slugs) {
      expect(slug).toMatch(/^[a-z0-9-]+$/)
    }
  })

  it('every exam has the required non-empty fields', () => {
    for (const e of GERMAN_EXAMS) {
      expect(e.name.trim()).not.toBe('')
      expect(e.shortName.trim()).not.toBe('')
      expect(e.tagline.trim()).not.toBe('')
      expect(e.metaTitle.trim()).not.toBe('')
      expect(e.metaDescription.trim()).not.toBe('')
      expect(e.overview.trim()).not.toBe('')
      expect(e.whoFor.trim()).not.toBe('')
      expect(e.scoring.trim()).not.toBe('')
      expect(['Goethe', 'telc']).toContain(e.provider)
      expect(['A2', 'B1', 'B2']).toContain(e.level)
      expect(e.officialUrl).toMatch(/^https:\/\//)
    }
  })

  it('every exam has modules with positive durations', () => {
    for (const e of GERMAN_EXAMS) {
      expect(e.modules.length).toBeGreaterThan(0)
      for (const m of e.modules) {
        expect(m.durationMin).toBeGreaterThan(0)
        expect(m.name.trim()).not.toBe('')
      }
      expect(totalDurationMin(e)).toBeGreaterThan(0)
    }
  })

  it('every exam has a readiness checklist, study tips and FAQs', () => {
    for (const e of GERMAN_EXAMS) {
      expect(e.readiness.length).toBeGreaterThan(0)
      for (const g of e.readiness) {
        expect(g.items.length).toBeGreaterThan(0)
      }
      expect(e.studyTips.length).toBeGreaterThan(0)
      expect(e.faqs.length).toBeGreaterThan(0)
      for (const f of e.faqs) {
        expect(f.q.trim()).not.toBe('')
        expect(f.a.trim()).not.toBe('')
      }
    }
  })

  it('meta titles/descriptions stay within sane SEO lengths', () => {
    for (const e of GERMAN_EXAMS) {
      expect(e.metaTitle.length).toBeLessThanOrEqual(70)
      expect(e.metaDescription.length).toBeLessThanOrEqual(170)
    }
  })

  it('getExamBySlug resolves known slugs and rejects unknown', () => {
    expect(getExamBySlug('goethe-b1')?.level).toBe('B1')
    expect(getExamBySlug('does-not-exist')).toBeUndefined()
  })
})
