import { ARTICLE_COLOR, type ArticleLower } from '@/lib/vocabWords'

/** Đáp ứng của `GET /api/words/facets` — số từ theo từng trục lọc, đã tính giao với các trục khác. */
export interface WordFacets {
  total: number
  status: Record<string, number>
  dtype: Record<string, number>
  gender: Record<string, number>
  cefr: Record<string, number>
  topics: { name: string; label: string; count: number }[]
}

export const EMPTY_FACETS: WordFacets = {
  total: 0,
  status: {},
  dtype: {},
  gender: {},
  cefr: {},
  topics: [],
}

/** Trạng thái học — trục chính, thứ tự theo hành trình của người học. */
export const STATUS_ORDER = ['NEW', 'LEARNING', 'MASTERED'] as const
/** Từ loại. 'Word' là nhóm còn lại của kho, để cuối. */
export const DTYPE_ORDER = ['Noun', 'Verb', 'Adjective', 'Word'] as const
/** Mạo từ — chỉ có nghĩa khi đang lọc danh từ. */
export const GENDER_ORDER = ['DER', 'DIE', 'DAS'] as const
export const CEFR_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const
export const UNGRADED = 'UNGRADED'

/** Bộ lọc đang bật của hub. `null` = không lọc theo trục đó. */
export interface VocabFilterState {
  status: string | null
  dtype: string | null
  gender: string | null
  tag: string | null
  cefr: string | null
}

export const NO_FILTERS: VocabFilterState = {
  status: null,
  dtype: null,
  gender: null,
  tag: null,
  cefr: null,
}

export function hasAnyFilter(f: VocabFilterState): boolean {
  return Boolean(f.status || f.dtype || f.gender || f.tag || f.cefr)
}

/**
 * Tham số gửi lên `/words` và `/words/facets`.
 *
 * <p>Mạo từ chỉ đi kèm khi đang lọc danh từ — gửi `gender` với động từ sẽ trả rỗng vì bảng `nouns`
 * không có dòng nào cho chúng.
 */
export function filterParams(f: VocabFilterState, locale: string, query: string): Record<string, string | boolean> {
  const params: Record<string, string | boolean> = { locale }
  if (query) params.q = query
  if (f.cefr) {
    params.cefr = f.cefr
    // exact=true: chip "A2" trả ĐÚNG từ A2. Mặc định của API là cộng dồn (A2 = A1+A2).
    params.exact = true
  }
  if (f.status) params.status = f.status
  if (f.dtype) params.dtype = f.dtype
  if (f.dtype === 'Noun' && f.gender) params.gender = f.gender
  if (f.tag) params.tag = f.tag
  return params
}

/**
 * Chọn/bỏ chọn một giá trị trên một trục.
 *
 * <p>Bỏ chọn "Danh từ" thì bỏ luôn mạo từ đang chọn — nếu không, bộ lọc còn lại là `gender` mồ côi và
 * người học nhìn thấy một danh sách rỗng không rõ vì sao.
 */
export function toggleAxis(f: VocabFilterState, axis: keyof VocabFilterState, value: string): VocabFilterState {
  const next: VocabFilterState = { ...f, [axis]: f[axis] === value ? null : value }
  if (axis === 'dtype' && next.dtype !== 'Noun') next.gender = null
  return next
}

/** Màu giống cho chip mạo từ; các trục khác không tô màu. */
export function genderChipColor(gender: string): string | null {
  const article = gender.toLowerCase() as ArticleLower
  return ARTICLE_COLOR[article] ?? null
}
