/** Labels aligned with backend ErrorCatalog — locale snippets for UI */

export type LocaleSnippet = { title: string; rule: string }

const SNIPPETS: Record<string, { vi: LocaleSnippet; en: LocaleSnippet; de: LocaleSnippet }> = {
  'WORD_ORDER.V2_MAIN_CLAUSE': {
    vi: { title: 'Động từ vị trí số 2 (V2)', rule: 'Trong câu chính, động từ chia đứng vị trí thứ hai.' },
    en: { title: 'Verb second (V2)', rule: 'In main clauses, the finite verb is in second position.' },
    de: { title: 'Verb an Position 2', rule: 'Im Hauptsatz steht das konjugierte Verb an zweiter Stelle.' },
  },
  'WORD_ORDER.SUBCLAUSE_VERB_FINAL': {
    vi: { title: 'Mệnh đề phụ: động từ cuối', rule: 'Sau weil/dass/wenn… động từ chia ở cuối mệnh đề phụ.' },
    en: { title: 'Subclause verb at end', rule: 'After weil/dass/wenn… the finite verb goes to the end.' },
    de: { title: 'Verb am Satzende (Nebensatz)', rule: 'Nach weil/dass/wenn… steht das konjugierte Verb am Ende.' },
  },
  'WORD_ORDER.INVERSION_AFTER_ADVERBIAL': {
    vi: { title: 'Đảo sau trạng ngữ đầu câu', rule: 'Mở đầu bằng trạng ngữ → động từ trước chủ ngữ.' },
    en: { title: 'Inversion after adverbial', rule: 'Adverbial first → verb before subject.' },
    de: { title: 'Inversion nach Adverbial', rule: 'Adverbial am Anfang → Verb vor dem Subjekt.' },
  },
  'WORD_ORDER.NICHT_POSITION': {
    vi: { title: 'Vị trí “nicht”', rule: 'Đặt nicht đúng chỗ (thường sau động từ/cụm bị phủ định).' },
    en: { title: 'Position of nicht', rule: 'Place nicht correctly (often after the verb/object negated).' },
    de: { title: 'Position von „nicht“', rule: '„nicht“ richtig platzieren (oft nach dem verneinten Verb/Objekt).' },
  },
  'WORD_ORDER.TE_KA_MO_LO': {
    vi: { title: 'Thứ tự trạng ngữ', rule: 'Thường: thời gian → cách → nơi.' },
    en: { title: 'Adverbial order', rule: 'Often: time → manner → place.' },
    de: { title: 'Reihenfolge der Angaben', rule: 'Oft: temporal → modal → lokal (Zeit → Art → Ort).' },
  },
  'WORD_ORDER.MODAL_INF_END': {
    vi: { title: 'Modal + động từ nguyên mẫu cuối câu', rule: 'können/müssen… + động từ nguyên mẫu ở cuối câu.' },
    en: { title: 'Modal + infinitive at end', rule: 'Modal verb finite; main verb infinitive at end.' },
    de: { title: 'Modalverb + Infinitiv am Ende', rule: 'Modalverb konjugiert; Vollverb im Infinitiv am Satzende.' },
  },
  'WORD_ORDER.SEparable_PREFIX_POSITION': {
    vi: { title: 'Động từ tách (tiền tố ở cuối)', rule: 'Tiền tố tách (auf, an…) đứng cuối mệnh đề chính.' },
    en: { title: 'Separable verb', rule: 'Prefix goes to the end of the main clause.' },
    de: { title: 'Trennbares Verb', rule: 'Das abgetrennte Präfix (auf, an…) steht am Ende des Hauptsatzes.' },
  },
  'CASE.PREP_DAT_MIT': {
    vi: { title: 'mit + Dativ', rule: 'Sau mit dùng Dativ.' },
    en: { title: 'mit + Dative', rule: 'After mit use dative.' },
    de: { title: 'mit + Dativ', rule: 'Nach „mit“ steht der Dativ.' },
  },
  'CASE.PREP_AKK_FUER': {
    vi: { title: 'für + Akkusativ', rule: 'Sau für dùng Akkusativ.' },
    en: { title: 'für + accusative', rule: 'After für use accusative.' },
    de: { title: 'für + Akkusativ', rule: 'Nach „für“ steht der Akkusativ.' },
  },
  'CASE.WECHSEL_AKK_VS_DAT': {
    vi: { title: 'in/auf/an: đi vs ở', rule: 'Chuyển động → Akk; vị trí → Dat.' },
    en: { title: 'Two-way prepositions', rule: 'Movement → accusative; location → dative.' },
    de: { title: 'Wechselpräpositionen', rule: 'Bewegung → Akkusativ; Ort → Dativ.' },
  },
  'CASE.DATIVE_INDIRECT_OBJECT': {
    vi: { title: 'Tân ngữ gián tiếp (Dat)', rule: 'Người nhận thường ở Dativ.' },
    en: { title: 'Dative object', rule: 'Recipient often dative.' },
    de: { title: 'Dativobjekt', rule: 'Der Empfänger steht oft im Dativ.' },
  },
  'CASE.ACCUSATIVE_DIRECT_OBJECT': {
    vi: { title: 'Tân ngữ trực tiếp (Akk)', rule: 'Đối tượng trực tiếp thường Akkusativ.' },
    en: { title: 'Accusative object', rule: 'Direct object often accusative.' },
    de: { title: 'Akkusativobjekt', rule: 'Das direkte Objekt steht oft im Akkusativ.' },
  },
  'CASE.GENITIVE_REQUIRED': {
    vi: { title: 'Giới từ + Genitiv', rule: 'wegen/trotz… thường + Genitiv (chuẩn học thuật).' },
    en: { title: 'Preposition + genitive', rule: 'wegen/trotz… often + genitive (formal).' },
    de: { title: 'Präposition + Genitiv', rule: 'wegen/trotz… oft mit Genitiv (formell).' },
  },
  'ARTICLE.GENDER_WRONG_DER_DIE_DAS': {
    vi: { title: 'Giống danh từ der/die/das', rule: 'Mạo từ phải khớp giống của danh từ.' },
    en: { title: 'Gender der/die/das', rule: 'Article must match noun gender.' },
    de: { title: 'Genus der/die/das', rule: 'Der Artikel muss zum Genus des Nomens passen.' },
  },
  'ARTICLE.INDEFINITE_EIN_EINE': {
    vi: { title: 'ein/eine', rule: 'Nam/trung ein; nữ eine (Nom.).' },
    en: { title: 'ein/eine', rule: 'Masculine/neuter ein; feminine eine.' },
    de: { title: 'ein/eine', rule: 'Maskulin/Neutrum ein; feminin eine (Nom.).' },
  },
  'ARTICLE.CASE_DECLENSION_DEM_DEN_DES': {
    vi: { title: 'Mạo từ theo cách', rule: 'der/die/das đổi theo Kasus.' },
    en: { title: 'Article declension', rule: 'Articles change with case.' },
    de: { title: 'Artikeldeklination', rule: 'der/die/das ändern sich je nach Kasus.' },
  },
  'ARTICLE.PLURAL_DECLENSION': {
    vi: { title: 'Số nhiều + Dativ', rule: 'Dativ plural: den + -n khi cần.' },
    en: { title: 'Plural dative', rule: 'Often den + plural -n.' },
    de: { title: 'Plural im Dativ', rule: 'Dativ Plural: den + -n, wenn nötig.' },
  },
  'VERB.CONJ_PERSON_ENDING': {
    vi: { title: 'Chia động từ theo ngôi', rule: 'Động từ phải khớp chủ ngữ (ich/du/er…).' },
    en: { title: 'Verb conjugation', rule: 'Verb agrees with subject person/number.' },
    de: { title: 'Verbkonjugation', rule: 'Das Verb richtet sich nach Person/Numerus des Subjekts.' },
  },
  'VERB.AUX_SEIN_HABEN_PERFEKT': {
    vi: { title: 'sein/haben trong Perfekt', rule: 'Nhiều động từ chuyển động dùng sein.' },
    en: { title: 'sein/haben in Perfekt', rule: 'Many motion/state verbs use sein.' },
    de: { title: 'sein/haben im Perfekt', rule: 'Viele Bewegungs-/Zustandsverben bilden das Perfekt mit sein.' },
  },
  'VERB.PARTIZIP_II_FORM': {
    vi: { title: 'Partizip II', rule: 'Dạng đúng của Partizip II trong Perfekt.' },
    en: { title: 'Past participle', rule: 'Correct Partizip II form.' },
    de: { title: 'Partizip II', rule: 'Korrekte Form des Partizips II im Perfekt.' },
  },
  'VERB.MODAL_PERFEKT_DOUBLE_INF': {
    vi: { title: 'Modal trong Perfekt (B1)', rule: 'haben + … + Infinitiv modal.' },
    en: { title: 'Modal in Perfekt', rule: 'Double infinitive with modals in Perfekt.' },
    de: { title: 'Modalverb im Perfekt', rule: 'Doppelinfinitiv mit Modalverben im Perfekt.' },
  },
  'VERB.SEIN_HABEN_PRESENT': {
    vi: { title: 'sein vs haben (cố định)', rule: 'Hunger/Zeit… thường haben.' },
    en: { title: 'sein vs haben', rule: 'Many states use haben (Hunger, Zeit).' },
    de: { title: 'sein vs. haben', rule: 'Viele Zustände mit haben (Hunger, Zeit).' },
  },
  'AGREEMENT.SUBJECT_VERB_NUMBER': {
    vi: { title: 'Hoà hợp chủ-vị', rule: 'Chủ ngữ số nhiều → động từ số nhiều.' },
    en: { title: 'Subject–verb agreement', rule: 'Plural subject → plural verb.' },
    de: { title: 'Subjekt-Verb-Kongruenz', rule: 'Pluralsubjekt → Verb im Plural.' },
  },
  'DECLENSION.ADJECTIVE_ENDING': {
    vi: { title: 'Đuôi tính từ', rule: 'Đuôi -e/-en… đúng theo Artikel & Kasus.' },
    en: { title: 'Adjective endings', rule: 'Correct endings after article/case.' },
    de: { title: 'Adjektivendungen', rule: 'Korrekte Endungen nach Artikel/Kasus.' },
  },
  'LEXICAL.FALSE_FRIEND_BEKOMMEN': {
    vi: { title: 'bekommen vs haben', rule: '“Có” (sở hữu) thường haben; bekommen ≈ nhận được.' },
    en: { title: 'bekommen vs haben', rule: 'Possession often haben; bekommen ≈ receive.' },
    de: { title: 'bekommen vs. haben', rule: 'Besitz oft mit haben; bekommen ≈ erhalten.' },
  },
}

export function getErrorSnippet(code: string, locale: string): LocaleSnippet {
  const row = SNIPPETS[code]
  if (!row) {
    return { title: code, rule: '' }
  }
  if (locale === 'vi') return row.vi
  if (locale === 'de') return row.de
  return row.en
}

export const ALL_ERROR_CODES = Object.keys(SNIPPETS)
