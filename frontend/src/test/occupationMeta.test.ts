/**
 * Tiêu đề/mô tả trang nghề (rà câu chữ 14/11/2026): mọi nghề ≤ 60 / ≤ 160 ký tự ở cả ba ngôn ngữ, kể cả
 * tên nghề dài nhất của danh mục (V334), và tên tiếng Việt không lặp hai cặp ngoặc.
 */
import { describe, expect, it } from 'vitest'
import { MAX_DESCRIPTION, MAX_TITLE, fitText } from '@/lib/occupationMeta'
import { occupationTitleName, type OccupationSummary } from '@/lib/occupationTypes'
import landingVi from '../../messages/v2/landing.vi.json'
import landingEn from '../../messages/v2/landing.en.json'
import landingDe from '../../messages/v2/landing.de.json'

type Occ = Pick<OccupationSummary, 'code' | 'nameDe' | 'nameEn' | 'nameVi'>

/** Các nghề có tên dài nhất theo từng ngôn ngữ (chép từ `V334__occupation_catalog.sql`) và nghề có ngoặc. */
const LONGEST: Occ[] = [
  { code: 'anlagenmechaniker_shk', nameDe: 'Anlagenmechaniker/in für Sanitär-, Heizungs- und Klimatechnik', nameEn: 'Plumber / HVAC installer', nameVi: 'Thợ nước, sưởi và điều hoà' },
  { code: 'kunststofftechnik', nameDe: 'Verfahrensmechaniker/in für Kunststoff- und Kautschuktechnik', nameEn: 'Plastics process technician', nameVi: 'Thợ vận hành máy nhựa' },
  { code: 'mtl', nameDe: 'Medizinische/r Technologe/-in für Laboratoriumsanalytik', nameEn: 'Medical laboratory technologist', nameVi: 'Kỹ thuật viên xét nghiệm' },
  { code: 'speditionskaufmann', nameDe: 'Kaufmann/-frau für Spedition und Logistikdienstleistung', nameEn: 'Freight forwarding clerk', nameVi: 'Nhân viên giao nhận vận tải' },
  { code: 'mtr', nameDe: 'Medizinische/r Technologe/-in für Radiologie', nameEn: 'Radiographer', nameVi: 'Kỹ thuật viên chẩn đoán hình ảnh' },
  { code: 'kfz_mechatroniker', nameDe: 'Kfz-Mechatroniker/in', nameEn: 'Automotive mechatronics technician', nameVi: 'Thợ sửa chữa ô tô' },
  { code: 'landmaschinen', nameDe: 'Land- und Baumaschinenmechatroniker/in', nameEn: 'Agricultural machinery technician', nameVi: 'Thợ sửa máy nông nghiệp' },
  { code: 'industriekaufmann', nameDe: 'Industriekaufmann/-frau', nameEn: 'Industrial business administrator', nameVi: 'Nhân viên kinh doanh doanh nghiệp sản xuất' },
  { code: 'lebensmitteltechnik', nameDe: 'Fachkraft für Lebensmitteltechnik', nameEn: 'Food technologist', nameVi: 'Kỹ thuật viên chế biến thực phẩm' },
  { code: 'chemikant', nameDe: 'Chemikant/in', nameEn: 'Chemical plant operator', nameVi: 'Kỹ thuật viên vận hành hoá chất' },
  { code: 'elektroniker_eg', nameDe: 'Elektroniker/in für Energie- und Gebäudetechnik', nameEn: 'Electrician', nameVi: 'Thợ điện' },
  { code: 'gaertner', nameDe: 'Gärtner/in (Garten- und Landschaftsbau)', nameEn: 'Landscape gardener', nameVi: 'Thợ làm vườn cảnh quan' },
  { code: 'bundesfreiwilligendienst', nameDe: 'Freiwillige/r im Bundesfreiwilligendienst (BFD)', nameEn: 'Federal volunteer (BFD)', nameVi: 'Tình nguyện viên (BFD)' },
  { code: 'mfa', nameDe: 'Medizinische/r Fachangestellte/r', nameEn: 'Medical assistant', nameVi: 'Trợ lý y khoa (MFA)' },
  { code: 'werkstudent', nameDe: 'Werkstudent/in', nameEn: 'Working student', nameVi: 'Sinh viên làm thêm (Werkstudent)' },
  { code: 'hilfskraft', nameDe: 'Wissenschaftliche Hilfskraft', nameEn: 'Research assistant (student)', nameVi: 'Trợ lý nghiên cứu sinh viên' },
]

const CATALOGS = { vi: landingVi, en: landingEn, de: landingDe } as const
const fill = (tpl: string, vars: Record<string, string>) => tpl.replace(/\{(\w+)\}/g, (_, k: string) => vars[k])

describe('title/meta trang nghề', () => {
  for (const [locale, cat] of Object.entries(CATALOGS)) {
    const m = cat.landing.occupationPages.detail.meta
    it(`${locale}: mọi nghề ≤ ${MAX_TITLE} / ≤ ${MAX_DESCRIPTION} ký tự`, () => {
      for (const o of LONGEST) {
        const vars = { nameDe: o.nameDe, name: occupationTitleName(o, locale) }
        const title = fitText([m.title, m.titleShort, m.titleMin].map((t) => fill(t, vars)), MAX_TITLE)
        const description = fitText([m.description, m.descriptionShort].map((t) => fill(t, vars)), MAX_DESCRIPTION)
        expect(title.length, title).toBeLessThanOrEqual(MAX_TITLE)
        expect(description.length, description).toBeLessThanOrEqual(MAX_DESCRIPTION)
      }
    })
  }

  it('vi: tiêu đề không lặp hai cặp ngoặc liền nhau', () => {
    const m = landingVi.landing.occupationPages.detail.meta
    for (const o of LONGEST) {
      const title = fill(m.title, { nameDe: o.nameDe, name: occupationTitleName(o, 'vi') })
      expect(title, title).not.toMatch(/\)\s*\(/)
    }
  })

  it('fitText lùi dần, cắt ở ranh giới từ khi không bản nào vừa', () => {
    expect(fitText(['a'.repeat(70), 'ngắn'], 60)).toBe('ngắn')
    const cut = fitText(['Anlagenmechaniker/in für Sanitär-, Heizungs- und Klimatechnik'], 60)
    expect(cut.length).toBeLessThanOrEqual(60)
    expect(cut.endsWith('…')).toBe(true)
  })
})
