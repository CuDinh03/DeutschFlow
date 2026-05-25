/** Labels aligned with backend ErrorCatalog — locale snippets for UI */

export type LocaleSnippet = { title: string; rule: string }

const SNIPPETS: Record<string, { vi: LocaleSnippet; en: LocaleSnippet }> = {
  'WORD_ORDER.V2_MAIN_CLAUSE': {
    vi: { title: 'Động từ vị trí số 2 (V2)', rule: 'Trong câu chính, động từ chia đứng vị trí thứ hai.' },
    en: { title: 'Verb second (V2)', rule: 'In main clauses, the finite verb is in second position.' },
  },
  'WORD_ORDER.SUBCLAUSE_VERB_FINAL': {
    vi: { title: 'Mệnh đề phụ: động từ cuối', rule: 'Sau weil/dass/wenn… động từ chia ở cuối mệnh đề phụ.' },
    en: { title: 'Subclause verb at end', rule: 'After weil/dass/wenn… the finite verb goes to the end.' },
  },
  'WORD_ORDER.INVERSION_AFTER_ADVERBIAL': {
    vi: { title: 'Đảo sau trạng ngữ đầu câu', rule: 'Mở đầu bằng trạng ngữ → động từ trước chủ ngữ.' },
    en: { title: 'Inversion after adverbial', rule: 'Adverbial first → verb before subject.' },
  },
  'WORD_ORDER.NICHT_POSITION': {
    vi: { title: 'Vị trí “nicht”', rule: 'Đặt nicht đúng chỗ (thường sau động từ/cụm bị phủ định).' },
    en: { title: 'Position of nicht', rule: 'Place nicht correctly (often after the verb/object negated).' },
  },
  'WORD_ORDER.TE_KA_MO_LO': {
    vi: { title: 'Thứ tự trạng ngữ', rule: 'Thường: thời gian → cách → nơi.' },
    en: { title: 'Adverbial order', rule: 'Often: time → manner → place.' },
  },
  'WORD_ORDER.MODAL_INF_END': {
    vi: { title: 'Modal + infinitive at end', rule: 'können/müssen… + infinitive at clause end.' },
    en: { title: 'Modal + infinitive at end', rule: 'Modal verb finite; main verb infinitive at end.' },
  },
  'WORD_ORDER.SEparable_PREFIX_POSITION': {
    vi: { title: 'Động từ tách (prefix cuối)', rule: 'Separated prefix (auf, an…) at end of main clause.' },
    en: { title: 'Separable verb', rule: 'Prefix goes to the end of the main clause.' },
  },
  'CASE.PREP_DAT_MIT': {
    vi: { title: 'mit + Dativ', rule: 'Sau mit dùng Dativ.' },
    en: { title: 'mit + Dative', rule: 'After mit use dative.' },
  },
  'CASE.PREP_AKK_FUER': {
    vi: { title: 'für + Akkusativ', rule: 'Sau für dùng Akkusativ.' },
    en: { title: 'für + accusative', rule: 'After für use accusative.' },
  },
  'CASE.WECHSEL_AKK_VS_DAT': {
    vi: { title: 'in/auf/an: đi vs ở', rule: 'Chuyển động → Akk; vị trí → Dat.' },
    en: { title: 'Two-way prepositions', rule: 'Movement → accusative; location → dative.' },
  },
  'CASE.DATIVE_INDIRECT_OBJECT': {
    vi: { title: 'Tân ngữ gián tiếp (Dat)', rule: 'Người nhận thường ở Dativ.' },
    en: { title: 'Dative object', rule: 'Recipient often dative.' },
  },
  'CASE.ACCUSATIVE_DIRECT_OBJECT': {
    vi: { title: 'Tân ngữ trực tiếp (Akk)', rule: 'Đối tượng trực tiếp thường Akkusativ.' },
    en: { title: 'Accusative object', rule: 'Direct object often accusative.' },
  },
  'CASE.GENITIVE_REQUIRED': {
    vi: { title: 'Giới từ + Genitiv', rule: 'wegen/trotz… thường + Genitiv (chuẩn học thuật).' },
    en: { title: 'Preposition + genitive', rule: 'wegen/trotz… often + genitive (formal).' },
  },
  'ARTICLE.GENDER_WRONG_DER_DIE_DAS': {
    vi: { title: 'Giống danh từ der/die/das', rule: 'Mạo từ phải khớp giống của danh từ.' },
    en: { title: 'Gender der/die/das', rule: 'Article must match noun gender.' },
  },
  'ARTICLE.INDEFINITE_EIN_EINE': {
    vi: { title: 'ein/eine', rule: 'Nam/trung ein; nữ eine (Nom.).' },
    en: { title: 'ein/eine', rule: 'Masculine/neuter ein; feminine eine.' },
  },
  'ARTICLE.CASE_DECLENSION_DEM_DEN_DES': {
    vi: { title: 'Mạo từ theo cách', rule: 'der/die/das đổi theo Kasus.' },
    en: { title: 'Article declension', rule: 'Articles change with case.' },
  },
  'ARTICLE.PLURAL_DECLENSION': {
    vi: { title: 'Số nhiều + Dativ', rule: 'Dativ plural: den + -n khi cần.' },
    en: { title: 'Plural dative', rule: 'Often den + plural -n.' },
  },
  'VERB.CONJ_PERSON_ENDING': {
    vi: { title: 'Chia động từ theo ngôi', rule: 'Động từ phải khớp chủ ngữ (ich/du/er…).' },
    en: { title: 'Verb conjugation', rule: 'Verb agrees with subject person/number.' },
  },
  'VERB.AUX_SEIN_HABEN_PERFEKT': {
    vi: { title: 'sein/haben trong Perfekt', rule: 'Nhiều động từ chuyển động dùng sein.' },
    en: { title: 'sein/haben in Perfekt', rule: 'Many motion/state verbs use sein.' },
  },
  'VERB.PARTIZIP_II_FORM': {
    vi: { title: 'Partizip II', rule: 'Dạng đúng của Partizip II trong Perfekt.' },
    en: { title: 'Past participle', rule: 'Correct Partizip II form.' },
  },
  'VERB.MODAL_PERFEKT_DOUBLE_INF': {
    vi: { title: 'Modal trong Perfekt (B1)', rule: 'haben + … + Infinitiv modal.' },
    en: { title: 'Modal in Perfekt', rule: 'Double infinitive with modals in Perfekt.' },
  },
  'VERB.SEIN_HABEN_PRESENT': {
    vi: { title: 'sein vs haben (cố định)', rule: 'Hunger/Zeit… thường haben.' },
    en: { title: 'sein vs haben', rule: 'Many states use haben (Hunger, Zeit).' },
  },
  'AGREEMENT.SUBJECT_VERB_NUMBER': {
    vi: { title: 'Hoà hợp chủ-vị', rule: 'Chủ ngữ số nhiều → động từ số nhiều.' },
    en: { title: 'Subject–verb agreement', rule: 'Plural subject → plural verb.' },
  },
  'DECLENSION.ADJECTIVE_ENDING': {
    vi: { title: 'Đuôi tính từ', rule: 'Đuôi -e/-en… đúng theo Artikel & Kasus.' },
    en: { title: 'Adjective endings', rule: 'Correct endings after article/case.' },
  },
  'LEXICAL.FALSE_FRIEND_BEKOMMEN': {
    vi: { title: 'bekommen vs haben', rule: '“Có” (sở hữu) thường haben; bekommen ≈ nhận được.' },
    en: { title: 'bekommen vs haben', rule: 'Possession often haben; bekommen ≈ receive.' },
  },
}

export function getErrorSnippet(code: string, locale: string): LocaleSnippet {
  const row = SNIPPETS[code]
  if (!row) {
    return { title: code, rule: '' }
  }
  if (locale === 'vi') return row.vi
  if (locale === 'de') return row.en // MVP: German UI uses English labels until translated
  return row.en
}

export const ALL_ERROR_CODES = Object.keys(SNIPPETS)
