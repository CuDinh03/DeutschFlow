// Nhãn tiếng Việt cho mã lỗi ngữ pháp, để giao diện KHÔNG bao giờ hiện mã máy
// kiểu "WORD_ORDER.V2_MAIN_CLAUSE" cho học viên.
//
// Bản sao các giá trị vi.title của web (frontend/src/lib/errors/errorTaxonomy.ts —
// nguồn duy nhất). Thêm/đổi mã ở backend ErrorCatalog.java thì sửa cả hai nơi.

const VI_TITLES: Record<string, string> = {
  'WORD_ORDER.V2_MAIN_CLAUSE': 'Sai vị trí động từ',
  'WORD_ORDER.SUBCLAUSE_VERB_FINAL': 'Sai vị trí động từ ở mệnh đề phụ',
  'WORD_ORDER.INVERSION_AFTER_ADVERBIAL': 'Thiếu đảo ngữ',
  'WORD_ORDER.NICHT_POSITION': 'Đặt sai chữ phủ định “nicht”',
  'WORD_ORDER.TE_KA_MO_LO': 'Sai thứ tự trạng ngữ',
  'WORD_ORDER.MODAL_INF_END': 'Sai vị trí động từ nguyên mẫu',
  'WORD_ORDER.SEparable_PREFIX_POSITION': 'Sai vị trí tiền tố tách',
  'CASE.PREP_DAT_MIT': 'Sai cách sau giới từ “mit”',
  'CASE.PREP_AKK_FUER': 'Sai cách sau giới từ “für”',
  'CASE.WECHSEL_AKK_VS_DAT': 'Sai cách sau giới từ hai cách',
  'CASE.DATIVE_INDIRECT_OBJECT': 'Sai cách của tân ngữ gián tiếp',
  'CASE.ACCUSATIVE_DIRECT_OBJECT': 'Sai cách của tân ngữ trực tiếp',
  'CASE.GENITIVE_REQUIRED': 'Thiếu sở hữu cách',
  'ARTICLE.GENDER_WRONG_DER_DIE_DAS': 'Sai giống danh từ',
  'ARTICLE.INDEFINITE_EIN_EINE': 'Sai mạo từ không xác định',
  'ARTICLE.CASE_DECLENSION_DEM_DEN_DES': 'Sai mạo từ theo cách',
  'ARTICLE.PLURAL_DECLENSION': 'Sai dạng số nhiều',
  'VERB.CONJ_PERSON_ENDING': 'Chia động từ sai',
  'VERB.AUX_SEIN_HABEN_PERFEKT': 'Sai trợ động từ ở thì quá khứ',
  'VERB.PARTIZIP_II_FORM': 'Sai dạng động từ quá khứ',
  'VERB.MODAL_PERFEKT_DOUBLE_INF': 'Sai động từ khuyết thiếu ở thì quá khứ',
  'VERB.SEIN_HABEN_PRESENT': 'Nhầm “sein” với “haben”',
  'AGREEMENT.SUBJECT_VERB_NUMBER': 'Động từ không hợp với chủ ngữ',
  'DECLENSION.ADJECTIVE_ENDING': 'Sai đuôi tính từ',
  'LEXICAL.FALSE_FRIEND_BEKOMMEN': 'Dùng sai từ “bekommen”',
}

/** Nhãn chung khi mã ngoài bảng — thà chung chung còn hơn để lộ mã máy. */
export const GENERIC_ERROR_TITLE = 'Lỗi ngữ pháp'

/** Tên lỗi tiếng Việt cho một mã; mã lạ rơi về nhãn chung, KHÔNG in mã ra giao diện. */
export function getErrorTitle(code: string): string {
  return VI_TITLES[code] ?? GENERIC_ERROR_TITLE
}
