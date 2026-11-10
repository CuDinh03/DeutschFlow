/**
 * Câu trích bằng chứng (`evidence`, chép nguyên văn trong `mock_exam_explanations`) → vị trí ký tự
 * trong khối chữ (09/11/2026, đánh dấu bài đọc).
 *
 * Mọi khoảng trắng liền nhau — kể cả xuống dòng tác giả ngắt trong `teil.context` — coi như MỘT dấu
 * cách, nên câu trích vắt qua hai dòng vẫn tìm được (bản cũ so trong từng dòng nên bỏ sót). Test
 * backend `PracticeEvidenceAllSetsTest` dùng đúng luật này để bắt câu trích lệch trong dữ liệu đề.
 */

const IS_SPACE = /[\s ]/

/** `[s, e)` trên chuỗi gốc, hoặc `null` nếu không có. */
export function findQuote(block: string, quote: string): [number, number] | null {
  const q = quote.replace(/[\s ]+/g, ' ').trim()
  if (!q) return null
  let norm = ''
  const map: number[] = []
  let i = 0
  while (i < block.length) {
    if (IS_SPACE.test(block[i])) {
      map.push(i)
      norm += ' '
      while (i < block.length && IS_SPACE.test(block[i])) i++
    } else {
      map.push(i)
      norm += block[i]
      i++
    }
  }
  const at = norm.indexOf(q)
  if (at < 0) return null
  // q đã trim nên ký tự cuối không phải khoảng trắng ⇒ ánh xạ 1-1 về chuỗi gốc
  return [map[at], map[at + q.length - 1] + 1]
}

/** Mọi câu trích tìm được, theo thứ tự trong khối. */
export function evidenceRanges(block: string, quotes: readonly string[]): Array<[number, number]> {
  const out: Array<[number, number]> = []
  for (const quote of quotes) {
    const r = findQuote(block, quote)
    if (r) out.push(r)
  }
  return out.sort((a, b) => a[0] - b[0])
}
