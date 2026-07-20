/**
 * vocabWords.ts — kiểu dữ liệu + tiện ích dùng chung cho cụm luyện từ vựng /v2.
 *
 * Đây là bản "nâng lên chỗ trung lập" của phần dùng chung trong
 * `src/app/student/vocabulary/components/types.ts` (cây v1 sắp bị xoá). Các trang
 * /v2/student/vocabulary/* import từ đây để việc xoá cây v1 KHÔNG làm gãy v2.
 * Contract API (`GET /words`) giữ nguyên 100%: cùng field, cùng query param.
 *
 * ⚠️ Mạo từ der/die/das là ràng buộc sư phạm CỨNG: mọi màn hình hiển thị danh từ
 * PHẢI kèm mạo từ + mã màu giống (der = xanh, die = đỏ, das = lục).
 */

export type ArticleLower = 'der' | 'die' | 'das'
export type GenderCode = 'DER' | 'DIE' | 'DAS'

/** Màu giống — thống nhất với /v2/student/vocabulary (der xanh · die đỏ · das lục). */
export const ARTICLE_COLOR: Record<ArticleLower, string> = {
  der: '#2F6FC9',
  die: '#DA291C',
  das: '#1E9E61',
}

/** Item của `GET /words` (WordListResponse.items). */
export interface WordListItem {
  id: number
  dtype: string
  baseForm: string
  cefrLevel?: string | null
  phonetic?: string | null
  meaning?: string | null
  meaningEn?: string | null
  example?: string | null
  exampleDe?: string | null
  exampleEn?: string | null
  usageNote?: string | null
  imageUrl?: string | null
  gender?: GenderCode | null
  article?: ArticleLower | null
  tags?: string[] | null
}

export interface WordListResponse {
  items: WordListItem[]
  page: number
  size: number
  total: number
}

/** Item của `GET /tags?topicsOnly=true` (taxonomy chủ đề cho picker học viên). */
export interface TagItem {
  id: number
  name: string
  color?: string | null
  localizedLabel?: string | null
}

/** Màu giống từ một chuỗi mạo từ tuỳ ý ("Der", "die"…). Trả null nếu không phải der/die/das. */
export function colorForArticle(article: string | null | undefined): string | null {
  if (!article) return null
  const a = article.toLowerCase()
  return a === 'der' || a === 'die' || a === 'das' ? ARTICLE_COLOR[a] : null
}

/** Suy mạo từ từ mã giống (DER→der …). Trả null cho từ không phải danh từ. */
export function articleOf(word: Pick<WordListItem, 'article' | 'gender'>): ArticleLower | null {
  if (word.article && ARTICLE_COLOR[word.article]) return word.article
  if (word.gender === 'DER') return 'der'
  if (word.gender === 'DIE') return 'die'
  if (word.gender === 'DAS') return 'das'
  return null
}

/** Màu hiển thị theo giống; fallback về mực nếu không phải danh từ. */
export function genderColor(word: Pick<WordListItem, 'article' | 'gender'>): string {
  const a = articleOf(word)
  return a ? ARTICLE_COLOR[a] : 'var(--ga-ink)'
}

/** Chuỗi đọc/hiển thị đầy đủ: "der Tisch" (danh từ) hoặc "gehen" (động/tính từ). */
export function wordWithArticle(word: Pick<WordListItem, 'article' | 'gender' | 'baseForm'>): string {
  const a = articleOf(word)
  return a ? `${a} ${word.baseForm}` : word.baseForm
}

/** Fisher–Yates — không đụng mảng gốc (immutable). */
export function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
