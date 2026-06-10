// Friendly Vietnamese names for grammar error codes, so the UI never shows
// raw codes like "WORD_ORDER.V2_MAIN_CLAUSE" to learners.
//
// Mirrors the vi.title values in the web app's
// frontend/src/lib/errors/errorTaxonomy.ts (the source of truth). Keep the two
// in sync when codes are added/changed in backend ErrorCatalog.java.

const VI_TITLES: Record<string, string> = {
  'WORD_ORDER.V2_MAIN_CLAUSE': 'Động từ vị trí số 2 (V2)',
  'WORD_ORDER.SUBCLAUSE_VERB_FINAL': 'Mệnh đề phụ: động từ cuối',
  'WORD_ORDER.INVERSION_AFTER_ADVERBIAL': 'Đảo sau trạng ngữ đầu câu',
  'WORD_ORDER.NICHT_POSITION': 'Vị trí “nicht”',
  'WORD_ORDER.TE_KA_MO_LO': 'Thứ tự trạng ngữ',
  'WORD_ORDER.MODAL_INF_END': 'Modal + động từ nguyên mẫu cuối câu',
  'WORD_ORDER.SEparable_PREFIX_POSITION': 'Động từ tách (tiền tố ở cuối)',
  'CASE.PREP_DAT_MIT': 'mit + Dativ',
  'CASE.PREP_AKK_FUER': 'für + Akkusativ',
  'CASE.WECHSEL_AKK_VS_DAT': 'in/auf/an: đi vs ở',
  'CASE.DATIVE_INDIRECT_OBJECT': 'Tân ngữ gián tiếp (Dat)',
  'CASE.ACCUSATIVE_DIRECT_OBJECT': 'Tân ngữ trực tiếp (Akk)',
  'CASE.GENITIVE_REQUIRED': 'Giới từ + Genitiv',
  'ARTICLE.GENDER_WRONG_DER_DIE_DAS': 'Giống danh từ der/die/das',
  'ARTICLE.INDEFINITE_EIN_EINE': 'ein/eine',
  'ARTICLE.CASE_DECLENSION_DEM_DEN_DES': 'Mạo từ theo cách',
  'ARTICLE.PLURAL_DECLENSION': 'Số nhiều + Dativ',
  'VERB.CONJ_PERSON_ENDING': 'Chia động từ theo ngôi',
  'VERB.AUX_SEIN_HABEN_PERFEKT': 'sein/haben trong Perfekt',
  'VERB.PARTIZIP_II_FORM': 'Partizip II',
  'VERB.MODAL_PERFEKT_DOUBLE_INF': 'Modal trong Perfekt (B1)',
  'VERB.SEIN_HABEN_PRESENT': 'sein vs haben (cố định)',
  'AGREEMENT.SUBJECT_VERB_NUMBER': 'Hoà hợp chủ-vị',
  'DECLENSION.ADJECTIVE_ENDING': 'Đuôi tính từ',
  'LEXICAL.FALSE_FRIEND_BEKOMMEN': 'bekommen vs haben',
}

/** Vietnamese display name for a grammar error code; falls back to the code if unmapped. */
export function getErrorTitle(code: string): string {
  return VI_TITLES[code] ?? code
}
