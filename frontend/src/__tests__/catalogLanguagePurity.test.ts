/**
 * Hợp đồng CATALOG: chuỗi tiếng Đức không được lặng lẽ lọt vào bản `vi`/`en` của `/v2`.
 *
 * VÌ SAO CẦN TEST NÀY: 10/09/2026 owner soi màn `/v2/student/dashboard` ở cả ba ngôn ngữ và thấy
 * ngôn ngữ nào cũng lẫn tiếng Đức. Soát ra hai loại rất khác nhau nhưng nhìn giống hệt nhau trên màn:
 *
 *   1. NHÃN ĐỨC CÓ CHỦ Ý — nay chỉ còn thuật ngữ miền: tên bốn kỹ năng thi (Hören/Lesen/Schreiben/
 *      Sprechen), "Lektion", "Hörtext", nội dung mẫu tiếng Đức. Chúng nằm trong DANH SÁCH MIỄN ở
 *      dưới, từng khoá một, kèm lý do. Nhãn immersion của giao diện ("Heute", "Weiterlernen",
 *      "Lernweg", menu area) từng được miễn ở đây — owner bỏ lối đó 10/09/2026, các khoá ấy đã dịch
 *      và KHÔNG còn trong danh sách: thêm lại một nhãn Đức kiểu đó sẽ làm test đỏ, đúng ý.
 *   2. BẢN DỊCH BỎ QUÊN — `personas.lukas/emma/anna.desc` trong `student.vi.json` là ba câu tiếng
 *      Đức nguyên vẹn, trong khi 15 persona còn lại đều đã có tiếng Việt và bản `en` đã dịch đủ.
 *      Không màn hình nào báo, `tsc` im, lint im: catalog vẫn đủ khoá, chỉ sai NGÔN NGỮ.
 *
 * Loại 2 mới là thứ test này canh. Luật: chuỗi `vi`/`en` GIỐNG HỆT chuỗi `de` **và** mang dấu hiệu
 * tiếng Đức (ä/ö/ü/ß hoặc một hư từ Đức) thì phải được miễn tường minh. Chuỗi trùng nhau mà không
 * có dấu hiệu Đức (tên riêng, "A1", "CEFR", số) không bị đụng tới.
 *
 * Thêm nhãn Đức mới ⇒ test đỏ ⇒ người thêm phải khai vào danh sách miễn và nói vì sao nó là NHÃN
 * chứ không phải bản dịch bị bỏ quên.
 */
import { describe, expect, it } from 'vitest'
import { catalogMessages, type UiLocale } from '@/test/intlCatalog'

/**
 * Dấu hiệu "câu này là tiếng Đức": chữ cái riêng của tiếng Đức, hoặc một hư từ/từ khoá miền.
 * Cố tình hẹp — mục tiêu là bắt bản dịch bỏ quên, không phải chấm điểm ngôn ngữ học.
 */
const GERMAN =
  /[äöüßÄÖÜ]|\b(der|die|das|den|dem|ein|eine|einen|und|oder|nicht|ist|sind|war|wird|werden|kann|muss|soll|du|dir|dich|deine|wir|ihr|sie|mit|von|bei|für|auf|aus|nach|über|unter|zum|zur|im|am|beim|vom|noch|schon|sehr|hier|jetzt|heute|weiter|weiterlernen|lernen|lernweg|sprechen|hören|lesen|schreiben|prüfung|prüfen|fertig|lektion|klassen|bewerten|materialien|berichte|mehr|fortschritt|erste|beruf|arbeit)\b/i

/**
 * Khoá được miễn — chữ Đức ở đó là CÓ CHỦ Ý. Ba nhóm, không trộn lẫn:
 *
 * (a) Thuật ngữ thi/giáo trình — tên bốn kỹ năng Goethe/telc và đơn vị bài "Lektion" là danh từ
 *     riêng của miền, dịch ra sẽ sai với đề thi và giáo trình học viên cầm trên tay.
 * (b) Chỗ điền ví dụ bằng tiếng Đức — nội dung mẫu phải là tiếng Đức thật thì mới làm mẫu được.
 * (c) Nhân vật người Đức — nghề nghiệp/địa chỉ giữ nguyên tiếng Đức trong bản `vi`.
 */
const GERMAN_ON_PURPOSE: readonly string[] = [
  // (a) thuật ngữ thi / giáo trình
  'v2.student.exam.simCap',
  'v2.student.exam.reportsCap',
  'v2.student.exam.skills.lesenName',
  'v2.student.exam.skills.hoerenName',
  'v2.student.exam.skills.schreibenName',
  'v2.student.exam.skills.sprechenName',
  'v2.student.mockExamRun.hoertext',
  'v2.student.examResult.audioPlayer.defaultLabel',
  'v2.teacher.tcChecklist.lektion',
  'v2.teacher.classDetail.skillTitle',
  'v2.org.classDetail.colHoren',
  'v2.org.classDetail.colLesen',
  'v2.org.classDetail.skillHoren',
  'v2.org.classDetail.skillLesen',
  'v2.org.classDetail.skillSchreiben',
  'v2.org.classDetail.skillSprechen',
  'v2.org.curricula.lektionCap',

  // (b) chỗ điền ví dụ bằng tiếng Đức
  'v2.student.grammarAi.culturalPlaceholder',
  'v2.adminOps.weeklySpeaking.titlePlaceholder',
  'v2.adminOps.weeklySpeaking.promptPlaceholder',
  'v2.adminOps.weeklySpeaking.mandatoryPlaceholder',
  'v2.org.accept.displayNamePlaceholder',
  'v2.landing.stats.1.l',
  'v2.landing.pains.items.0.title',

  // (c) nhân vật người Đức (bản vi giữ nguyên nghề/nơi chốn)
  'v2.student.personas.emma.tag',
  'v2.student.personas.thomas.role',
  'v2.student.personas.thomas.tag',
  'v2.student.personas.oliver.role',
]

const EXEMPT = new Set(GERMAN_ON_PURPOSE)

/**
 * Duyệt mọi chuỗi trong nhánh `v2` thành bảng phẳng {đường dẫn đầy đủ: giá trị}.
 *
 * Trả `Record` chứ không `Map`: tsconfig không đặt `target` (⇒ ES5) nên `for…of` trên Map là lỗi
 * biên dịch TS2802 — vitest vẫn chạy được nhưng CI đỏ ở bước tsc.
 */
function v2Strings(locale: UiLocale): Record<string, string> {
  const out: Record<string, string> = {}
  const walk = (node: unknown, path: string) => {
    if (typeof node === 'string') {
      out[path] = node
      return
    }
    if (node === null || typeof node !== 'object') return
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      walk(v, path ? `${path}.${k}` : k)
    }
  }
  walk((catalogMessages(locale) as Record<string, unknown>).v2, 'v2')
  return out
}

describe('catalog /v2 — không lẫn tiếng Đức ngoài danh sách miễn', () => {
  const de = v2Strings('de')

  it.each(['vi', 'en'] as const)('bản %s không có bản dịch bị bỏ quên', (locale) => {
    const leaked: string[] = []
    for (const [key, value] of Object.entries(v2Strings(locale))) {
      if (EXEMPT.has(key)) continue
      if (!value.trim()) continue
      if (value !== de[key]) continue
      if (!GERMAN.test(value)) continue
      leaked.push(`${key} = ${JSON.stringify(value)}`)
    }
    expect(leaked, `Chuỗi tiếng Đức lọt vào bản ${locale}. Dịch nó, hoặc nếu là NHÃN có chủ ý thì khai vào GERMAN_ON_PURPOSE kèm lý do.`).toEqual([])
  })

  it('danh sách miễn không có khoá chết', () => {
    const stale = GERMAN_ON_PURPOSE.filter((k) => de[k] === undefined)
    expect(stale, 'Khoá này đã bị xoá/đổi tên trong catalog — bỏ khỏi GERMAN_ON_PURPOSE.').toEqual([])
  })
})
