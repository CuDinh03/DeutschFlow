import type { Workplace } from '@/lib/occupationTypes'
import type { PublicLocale } from '@/lib/publicLocale'

/**
 * Phần học nghề (Ausbildung) giai đoạn 1: dữ liệu theo nghề và cổng hiển thị. Module thuần, dùng được ở
 * trang server lẫn component client.
 *
 * Nội dung là bản nháp AI soạn, nên theo luật nội dung của dự án phải có người duyệt trước khi mở. Chưa
 * duyệt thì `/hoc-nghe/` trả 404, không vào sitemap, không có mục trên menu, trang nghề không hiện khối
 * học nghề. Xem trước bằng `?ban-nhap=1`. Duyệt xong chỉ cần đổi AUSBILDUNG_CONTENT_REVIEWED thành true.
 * Bản nháp đọc để duyệt: plans/2026-10-31-hoc-nghe-nhap-de-duyet.md.
 */
export const AUSBILDUNG_CONTENT_REVIEWED = false

export const AUSBILDUNG_PAGE = '/hoc-nghe'
export const DRAFT_PREVIEW_PARAM = 'ban-nhap'

/** Trang chỉ có tiếng Việt và tiếng Anh: bản tiếng Đức chờ Impressum (việc riêng pháp lý). */
export type AusbildungLocale = Extract<PublicLocale, 'vi' | 'en'>

export function isAusbildungLocale(locale: string): locale is AusbildungLocale {
  return locale === 'vi' || locale === 'en'
}

export function ausbildungVisible(preview: string | string[] | undefined): boolean {
  if (AUSBILDUNG_CONTENT_REVIEWED) return true
  return (Array.isArray(preview) ? preview[0] : preview) === '1'
}

export interface AusbildungOccupation {
  /** `occupation.code` trong danh mục nghề (V334). */
  code: string
  /** Thời gian học thường gặp, tính bằng năm. */
  years: number
  /** Từ khoá tìm chỗ học. Tên nghề học có khi khác tên trong danh mục, ví dụ Fleischer/in. */
  searchDe: string
  /** Mức tiếng thường được yêu cầu; nhóm y tế thường cần B2. */
  level: 'B1' | 'B2'
}

const row = (code: string, years: number, searchDe: string, level: 'B1' | 'B2' = 'B1'): AusbildungOccupation => ({
  code,
  years,
  searchDe,
  level,
})

/**
 * Nghề trong danh mục có Ausbildung và có lương học nghề. Tự soạn, không chép từ BERUFENET (quyết định 5).
 * Cố ý bỏ: nghề học tại trường không lương (điều kiện tài chính khác), nghề cần đại học, việc phổ thông.
 */
export const AUSBILDUNG_OCCUPATIONS: readonly AusbildungOccupation[] = [
  row('koch', 3, 'Koch'),
  row('hotelfachkraft', 3, 'Hotelfachmann'),
  row('systemgastronomie', 3, 'Systemgastronomie'),
  row('tourismuskaufmann', 3, 'Tourismuskaufmann'),
  row('baecker', 3, 'Bäcker'),
  row('konditor', 3, 'Konditor'),
  row('metzger', 3, 'Fleischer'),
  row('lebensmitteltechnik', 3, 'Fachkraft für Lebensmitteltechnik'),

  row('pflegefachkraft', 3, 'Pflegefachmann', 'B2'),
  row('ota', 3, 'Operationstechnischer Assistent', 'B2'),
  row('mfa', 3, 'Medizinischer Fachangestellter', 'B2'),
  row('zfa', 3, 'Zahnmedizinischer Fachangestellter', 'B2'),
  row('notfallsanitaeter', 3, 'Notfallsanitäter', 'B2'),
  row('mtl', 3, 'Medizinischer Technologe Laboratoriumsanalytik', 'B2'),
  row('mtr', 3, 'Medizinischer Technologe Radiologie', 'B2'),

  row('maurer', 3, 'Maurer'),
  row('beton', 3, 'Beton- und Stahlbetonbauer'),
  row('zimmerer', 3, 'Zimmerer'),
  row('tischler', 3, 'Tischler'),
  row('dachdecker', 3, 'Dachdecker'),
  row('elektroniker_eg', 3.5, 'Elektroniker Energie- und Gebäudetechnik'),
  row('anlagenmechaniker_shk', 3.5, 'Anlagenmechaniker Sanitär Heizung Klima'),
  row('maler', 3, 'Maler und Lackierer'),
  row('fliesenleger', 3, 'Fliesenleger'),
  row('stuckateur', 3, 'Stuckateur'),
  row('geruestbauer', 3, 'Gerüstbauer'),
  row('strassenbauer', 3, 'Straßenbauer'),
  row('tiefbau', 2, 'Tiefbaufacharbeiter'),
  row('metallbauer', 3.5, 'Metallbauer'),
  row('kfz_mechatroniker', 3.5, 'Kfz-Mechatroniker'),
  row('augenoptiker', 3, 'Augenoptiker'),
  row('friseur', 3, 'Friseur'),
  row('kosmetiker', 3, 'Kosmetiker'),
  row('gebaeudereiniger', 3, 'Gebäudereiniger'),
  row('gaertner', 3, 'Gärtner'),

  row('industriemechaniker', 3.5, 'Industriemechaniker'),
  row('zerspanungsmechaniker', 3.5, 'Zerspanungsmechaniker'),
  row('mechatroniker', 3.5, 'Mechatroniker'),
  row('elektroniker_bt', 3.5, 'Elektroniker für Betriebstechnik'),
  row('chemikant', 3.5, 'Chemikant'),
  row('kunststofftechnik', 3, 'Verfahrensmechaniker Kunststoff- und Kautschuktechnik'),
  row('technischer_produktdesigner', 3.5, 'Technischer Produktdesigner'),
  row('landmaschinen', 3.5, 'Land- und Baumaschinenmechatroniker'),
  row('landwirt', 3, 'Landwirt'),
  row('tierwirt', 3, 'Tierwirt'),

  row('fachkraft_lagerlogistik', 3, 'Fachkraft für Lagerlogistik'),
  row('berufskraftfahrer', 3, 'Berufskraftfahrer'),
  row('speditionskaufmann', 3, 'Kaufmann für Spedition und Logistikdienstleistung'),
  row('sicherheitsmitarbeiter', 3, 'Fachkraft für Schutz und Sicherheit'),

  row('verkaeufer', 2, 'Verkäufer'),
  row('einzelhandelskaufmann', 3, 'Kaufmann im Einzelhandel'),
  row('baeckereiverkaeufer', 3, 'Fachverkäufer Lebensmittelhandwerk Bäckerei'),
  row('fleischereiverkaeufer', 3, 'Fachverkäufer Lebensmittelhandwerk Fleischerei'),
  row('drogist', 3, 'Drogist'),
  row('florist', 3, 'Florist'),

  row('fachinformatiker_si', 3, 'Fachinformatiker Systemintegration'),
  row('bueromanagement', 3, 'Kaufmann für Büromanagement'),
  row('steuerfachangestellter', 3, 'Steuerfachangestellter'),
  row('bankkaufmann', 3, 'Bankkaufmann'),
  row('industriekaufmann', 3, 'Industriekaufmann'),
]

const BY_CODE = new Map(AUSBILDUNG_OCCUPATIONS.map((o) => [o.code, o]))

export function ausbildungOccupation(code: string): AusbildungOccupation | null {
  return BY_CODE.get(code) ?? null
}

export interface AusbildungCompany {
  name: string
  workplace: Workplace
  /** Trang tuyển học nghề hoặc tuyển dụng trên CHÍNH website của doanh nghiệp. */
  url: string
}

/**
 * Danh bạ doanh nghiệp có đào tạo học nghề. Tự tổng hợp từ website công khai của từng doanh nghiệp: chỉ
 * có tên và link, không chép tin tuyển, không dùng logo. Mọi link đã mở được ngày 31/10/2026 và có nội
 * dung về Ausbildung. Các doanh nghiệp này không phải đối tác, và chưa xác nhận có nhận người ở nước ngoài.
 *
 * Danh bạ PHẢI miễn phí cho người học: § 296a SGB III chỉ cho thu phí Ausbildungsvermittlung từ phía
 * doanh nghiệp, nên không đặt phần này sau gói trả phí.
 */
export const AUSBILDUNG_COMPANIES: readonly AusbildungCompany[] = [
  { name: 'Dorint Hotels & Resorts', workplace: 'gastro', url: 'https://karriere.dorint.com/ausbildung/' },
  { name: 'Maritim Hotels', workplace: 'gastro', url: 'https://karriere.maritim.de/de/' },
  { name: 'Motel One', workplace: 'gastro', url: 'https://jobs.motel-one.com/de/' },
  { name: "McDonald's Deutschland", workplace: 'gastro', url: 'https://karriere.mcdonalds.de/' },

  { name: 'Charité – Universitätsmedizin Berlin', workplace: 'pflege', url: 'https://karriere.charite.de/ausbildung' },
  { name: 'Vivantes', workplace: 'pflege', url: 'https://karriere.vivantes.de/' },
  { name: 'Helios Kliniken', workplace: 'pflege', url: 'https://www.helios-gesundheit.de/karriere/einstiege/' },
  { name: 'Asklepios Kliniken', workplace: 'pflege', url: 'https://www.asklepios.com/karriere' },
  { name: 'Sana Kliniken', workplace: 'pflege', url: 'https://www.sana.de/karriere' },

  { name: 'HOCHTIEF', workplace: 'bau', url: 'https://www.hochtief.de/karriere' },
  { name: 'PORR Deutschland', workplace: 'bau', url: 'https://www.porr.de/karriere' },
  { name: 'Ed. Züblin', workplace: 'bau', url: 'https://karriere.zueblin.de/' },

  { name: 'Bosch', workplace: 'industrie', url: 'https://www.bosch.de/karriere/dein-einstieg/schuelerinnen-und-schueler/' },
  { name: 'BMW Group', workplace: 'industrie', url: 'https://www.bmwgroup.jobs/de/de/schueler/ausbildung.html' },
  { name: 'Mercedes-Benz Group', workplace: 'industrie', url: 'https://group.mercedes-benz.com/karriere/schueler/ausbildung/' },
  { name: 'Volkswagen', workplace: 'industrie', url: 'https://www.volkswagen-karriere.de/de/einstiegsmoeglichkeiten/schueler/ausbildung.html' },
  { name: 'BASF', workplace: 'industrie', url: 'https://karriere.basf.com/de/de/einstieg/schuelerinnen' },
  { name: 'Liebherr', workplace: 'industrie', url: 'https://www.liebherr.com/de-de/karriere/karriere-3364204' },

  { name: 'Deutsche Post DHL', workplace: 'logistik', url: 'https://careers.dhl.com/eu/de/ausbildung' },
  { name: 'Deutsche Bahn', workplace: 'logistik', url: 'https://db.jobs/de-de/dein-einstieg/ausbildung' },

  { name: 'REWE', workplace: 'handel', url: 'https://karriere.rewe.de/ausbildung' },
  { name: 'ALDI SÜD', workplace: 'handel', url: 'https://karriere.aldi-sued.de/schueler/ausbildung' },
  { name: 'Lidl', workplace: 'handel', url: 'https://jobs.lidl.de/' },
  { name: 'Kaufland', workplace: 'handel', url: 'https://jobs.kaufland.de/' },
  { name: 'dm-drogerie markt', workplace: 'handel', url: 'https://www.dm-jobs.de/' },
  { name: 'ROSSMANN', workplace: 'handel', url: 'https://jobs.rossmann.de/' },

  { name: 'Deutsche Telekom', workplace: 'buero', url: 'https://careers.telekom.com/de/pupils-in-Germany' },
  { name: 'Sparkassen-Finanzgruppe', workplace: 'buero', url: 'https://www.sparkasse.de/karriere.html' },
]

/** Link sang kết quả tìm kiếm theo nghề: không lưu tin tuyển nên dữ liệu luôn mới và không vướng quyền dữ liệu. */
export function jobsucheUrl(searchDe: string): string {
  return `https://www.arbeitsagentur.de/jobsuche/suche?angebotsart=4&was=${encodeURIComponent(searchDe)}`
}

export function ausbildungDeUrl(searchDe: string): string {
  return `https://www.ausbildung.de/suche/?search=${encodeURIComponent(searchDe)}`
}
