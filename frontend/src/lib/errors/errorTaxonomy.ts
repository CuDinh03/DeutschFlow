/**
 * Nhãn người-đọc-được cho từng mã lỗi của backend ErrorCatalog.
 *
 * `title` là thứ học viên nhìn thấy: gọi thẳng tên lỗi ("Sai giống danh từ",
 * "Chia động từ sai") chứ KHÔNG phải mã máy. Mã chỉ còn dùng làm khoá tra cứu,
 * key React và bộ lọc tìm kiếm — không màn nào của học viên được in mã ra.
 * `rule` là câu quy tắc ngắn đi kèm (tooltip / thẻ drill).
 */

export type LocaleSnippet = { title: string; rule: string }

const SNIPPETS: Record<string, { vi: LocaleSnippet; en: LocaleSnippet; de: LocaleSnippet }> = {
  'WORD_ORDER.V2_MAIN_CLAUSE': {
    vi: { title: 'Sai vị trí động từ', rule: 'Trong câu chính, động từ chia đứng vị trí thứ hai.' },
    en: { title: 'Verb in the wrong position', rule: 'In main clauses, the finite verb is in second position.' },
    de: { title: 'Verb an der falschen Stelle', rule: 'Im Hauptsatz steht das konjugierte Verb an zweiter Stelle.' },
  },
  'WORD_ORDER.SUBCLAUSE_VERB_FINAL': {
    vi: { title: 'Sai vị trí động từ ở mệnh đề phụ', rule: 'Sau weil/dass/wenn… động từ chia ở cuối mệnh đề phụ.' },
    en: { title: 'Verb misplaced in the subclause', rule: 'After weil/dass/wenn… the finite verb goes to the end.' },
    de: { title: 'Verb im Nebensatz falsch platziert', rule: 'Nach weil/dass/wenn… steht das konjugierte Verb am Ende.' },
  },
  'WORD_ORDER.INVERSION_AFTER_ADVERBIAL': {
    vi: { title: 'Thiếu đảo ngữ', rule: 'Mở đầu bằng trạng ngữ → động từ đứng trước chủ ngữ.' },
    en: { title: 'Missing inversion', rule: 'Adverbial first → verb before subject.' },
    de: { title: 'Fehlende Inversion', rule: 'Adverbial am Anfang → Verb vor dem Subjekt.' },
  },
  'WORD_ORDER.NICHT_POSITION': {
    vi: { title: 'Đặt sai chữ phủ định “nicht”', rule: 'Đặt nicht đúng chỗ (thường trước thành phần bị phủ định).' },
    en: { title: '“nicht” in the wrong place', rule: 'Place nicht correctly (usually before the negated part).' },
    de: { title: '„nicht“ falsch platziert', rule: '„nicht“ richtig platzieren (meist vor dem verneinten Teil).' },
  },
  'WORD_ORDER.TE_KA_MO_LO': {
    vi: { title: 'Sai thứ tự trạng ngữ', rule: 'Thường: thời gian → nguyên nhân → cách thức → nơi chốn.' },
    en: { title: 'Adverbials in the wrong order', rule: 'Often: time → reason → manner → place.' },
    de: { title: 'Angaben in falscher Reihenfolge', rule: 'Oft: temporal → kausal → modal → lokal.' },
  },
  'WORD_ORDER.MODAL_INF_END': {
    vi: { title: 'Sai vị trí động từ nguyên mẫu', rule: 'können/müssen… chia ở vị trí 2; động từ nguyên mẫu về cuối câu.' },
    en: { title: 'Infinitive in the wrong place', rule: 'Modal verb finite; main verb infinitive at the end.' },
    de: { title: 'Infinitiv an der falschen Stelle', rule: 'Modalverb konjugiert; Vollverb im Infinitiv am Satzende.' },
  },
  'WORD_ORDER.SEparable_PREFIX_POSITION': {
    vi: { title: 'Sai vị trí tiền tố tách', rule: 'Tiền tố tách (auf, an…) đứng cuối mệnh đề chính.' },
    en: { title: 'Separable prefix misplaced', rule: 'The prefix goes to the end of the main clause.' },
    de: { title: 'Trennbares Präfix falsch platziert', rule: 'Das abgetrennte Präfix (auf, an…) steht am Satzende.' },
  },
  'CASE.PREP_DAT_MIT': {
    vi: { title: 'Sai cách sau giới từ “mit”', rule: 'Sau mit luôn dùng Dativ: mit dem Bus, mit der U-Bahn.' },
    en: { title: 'Wrong case after “mit”', rule: 'After mit always use the dative.' },
    de: { title: 'Falscher Kasus nach „mit“', rule: 'Nach „mit“ steht immer der Dativ.' },
  },
  'CASE.PREP_AKK_FUER': {
    vi: { title: 'Sai cách sau giới từ “für”', rule: 'Sau für luôn dùng Akkusativ: für den Freund.' },
    en: { title: 'Wrong case after “für”', rule: 'After für always use the accusative.' },
    de: { title: 'Falscher Kasus nach „für“', rule: 'Nach „für“ steht immer der Akkusativ.' },
  },
  'CASE.WECHSEL_AKK_VS_DAT': {
    vi: { title: 'Sai cách sau giới từ hai cách', rule: 'in/auf/an…: chuyển động → Akkusativ; đứng yên → Dativ.' },
    en: { title: 'Wrong case after a two-way preposition', rule: 'Movement → accusative; location → dative.' },
    de: { title: 'Falscher Kasus nach Wechselpräposition', rule: 'Bewegung → Akkusativ; Ort → Dativ.' },
  },
  'CASE.DATIVE_INDIRECT_OBJECT': {
    vi: { title: 'Sai cách của tân ngữ gián tiếp', rule: 'Người nhận (cho ai) đứng ở Dativ.' },
    en: { title: 'Wrong case for the indirect object', rule: 'The recipient takes the dative.' },
    de: { title: 'Falscher Kasus beim Dativobjekt', rule: 'Der Empfänger steht im Dativ.' },
  },
  'CASE.ACCUSATIVE_DIRECT_OBJECT': {
    vi: { title: 'Sai cách của tân ngữ trực tiếp', rule: 'Đối tượng trực tiếp (cái gì/ai) đứng ở Akkusativ.' },
    en: { title: 'Wrong case for the direct object', rule: 'The direct object takes the accusative.' },
    de: { title: 'Falscher Kasus beim Akkusativobjekt', rule: 'Das direkte Objekt steht im Akkusativ.' },
  },
  'CASE.GENITIVE_REQUIRED': {
    vi: { title: 'Thiếu sở hữu cách', rule: 'wegen/trotz… thường đi với Genitiv (văn viết chuẩn).' },
    en: { title: 'Missing genitive', rule: 'wegen/trotz… usually take the genitive (formal).' },
    de: { title: 'Fehlender Genitiv', rule: 'wegen/trotz… stehen meist mit Genitiv (formell).' },
  },
  'ARTICLE.GENDER_WRONG_DER_DIE_DAS': {
    vi: { title: 'Sai giống danh từ', rule: 'Mạo từ phải khớp giống của danh từ — học từ mới luôn kèm der/die/das.' },
    en: { title: 'Wrong noun gender', rule: 'The article must match the noun gender (der/die/das).' },
    de: { title: 'Falsches Genus', rule: 'Der Artikel muss zum Genus des Nomens passen.' },
  },
  'ARTICLE.INDEFINITE_EIN_EINE': {
    vi: { title: 'Sai mạo từ không xác định', rule: 'Giống đực/trung dùng ein; giống cái dùng eine.' },
    en: { title: 'Wrong indefinite article', rule: 'Masculine/neuter ein; feminine eine.' },
    de: { title: 'Falscher unbestimmter Artikel', rule: 'Maskulin/Neutrum ein; feminin eine.' },
  },
  'ARTICLE.CASE_DECLENSION_DEM_DEN_DES': {
    vi: { title: 'Sai mạo từ theo cách', rule: 'der/die/das đổi theo cách: den, dem, des…' },
    en: { title: 'Wrong article for the case', rule: 'Articles change with the case: den, dem, des…' },
    de: { title: 'Falscher Artikel im Kasus', rule: 'der/die/das ändern sich je nach Kasus.' },
  },
  'ARTICLE.PLURAL_DECLENSION': {
    vi: { title: 'Sai dạng số nhiều', rule: 'Số nhiều: die ở Nominativ/Akkusativ, den + đuôi -n ở Dativ.' },
    en: { title: 'Wrong plural form', rule: 'Plural: die in nominative/accusative, den + -n in dative.' },
    de: { title: 'Falsche Pluralform', rule: 'Plural: die im Nominativ/Akkusativ, den + -n im Dativ.' },
  },
  'VERB.CONJ_PERSON_ENDING': {
    vi: { title: 'Chia động từ sai', rule: 'Động từ phải khớp chủ ngữ: ich -e, du -st, er/sie/es -t.' },
    en: { title: 'Verb conjugated incorrectly', rule: 'The verb must agree with the subject: ich -e, du -st, er -t.' },
    de: { title: 'Verb falsch konjugiert', rule: 'Das Verb richtet sich nach Person und Numerus des Subjekts.' },
  },
  'VERB.AUX_SEIN_HABEN_PERFEKT': {
    vi: { title: 'Sai trợ động từ ở thì quá khứ', rule: 'Perfekt: động từ chuyển động/đổi trạng thái dùng sein, còn lại haben.' },
    en: { title: 'Wrong auxiliary in the past tense', rule: 'Perfekt: motion/change verbs take sein, the rest haben.' },
    de: { title: 'Falsches Hilfsverb im Perfekt', rule: 'Bewegungs- und Zustandsverben bilden das Perfekt mit sein.' },
  },
  'VERB.PARTIZIP_II_FORM': {
    vi: { title: 'Sai dạng động từ quá khứ', rule: 'Partizip II: ge- + thân + -t (yếu) / -en (mạnh); động từ -ieren không có ge-.' },
    en: { title: 'Wrong past participle form', rule: 'Partizip II: ge- + stem + -t / -en; -ieren verbs take no ge-.' },
    de: { title: 'Falsche Partizip-II-Form', rule: 'Partizip II: ge- + Stamm + -t / -en; -ieren-Verben ohne ge-.' },
  },
  'VERB.MODAL_PERFEKT_DOUBLE_INF': {
    vi: { title: 'Sai động từ khuyết thiếu ở thì quá khứ', rule: 'haben + động từ nguyên mẫu kép: Ich habe kommen müssen.' },
    en: { title: 'Wrong modal in the past tense', rule: 'Double infinitive with modals: Ich habe kommen müssen.' },
    de: { title: 'Modalverb im Perfekt falsch', rule: 'Doppelinfinitiv mit Modalverben: Ich habe kommen müssen.' },
  },
  'VERB.SEIN_HABEN_PRESENT': {
    vi: { title: 'Nhầm “sein” với “haben”', rule: 'Hunger, Zeit, Angst… đi với haben, không phải sein.' },
    en: { title: 'Mixed up “sein” and “haben”', rule: 'Hunger, Zeit, Angst… take haben, not sein.' },
    de: { title: '„sein“ und „haben“ verwechselt', rule: 'Hunger, Zeit, Angst… stehen mit haben, nicht mit sein.' },
  },
  'AGREEMENT.SUBJECT_VERB_NUMBER': {
    vi: { title: 'Động từ không hợp với chủ ngữ', rule: 'Chủ ngữ số nhiều → động từ số nhiều: die Kinder spielen.' },
    en: { title: 'Verb does not match the subject', rule: 'Plural subject → plural verb: die Kinder spielen.' },
    de: { title: 'Verb passt nicht zum Subjekt', rule: 'Pluralsubjekt → Verb im Plural: die Kinder spielen.' },
  },
  'DECLENSION.ADJECTIVE_ENDING': {
    vi: { title: 'Sai đuôi tính từ', rule: 'Đuôi -e/-en… theo mạo từ, giống và cách: der gute Mann, ein guter Mann.' },
    en: { title: 'Wrong adjective ending', rule: 'Endings follow article, gender and case: der gute Mann.' },
    de: { title: 'Falsche Adjektivendung', rule: 'Endungen richten sich nach Artikel, Genus und Kasus.' },
  },
  'LEXICAL.FALSE_FRIEND_BEKOMMEN': {
    vi: { title: 'Dùng sai từ “bekommen”', rule: 'bekommen = nhận được; “trở thành” là werden, “có” là haben.' },
    en: { title: 'Wrong word choice: “bekommen”', rule: 'bekommen = receive; “become” is werden, “have” is haben.' },
    de: { title: 'Falsche Wortwahl: „bekommen“', rule: 'bekommen = erhalten; „werden“ heißt become, Besitz mit haben.' },
  },
}

/** Nhóm lỗi (phần trước dấu chấm của mã) — nhãn thuần theo ngôn ngữ đang xem. */
const CATEGORIES: Record<string, { vi: string; en: string; de: string }> = {
  WORD_ORDER: { vi: 'Trật tự từ', en: 'Word order', de: 'Wortstellung' },
  CASE: { vi: 'Cách', en: 'Case', de: 'Kasus' },
  ARTICLE: { vi: 'Mạo từ', en: 'Article', de: 'Artikel' },
  VERB: { vi: 'Động từ', en: 'Verb', de: 'Verb' },
  AGREEMENT: { vi: 'Hoà hợp chủ vị', en: 'Agreement', de: 'Kongruenz' },
  DECLENSION: { vi: 'Tính từ', en: 'Adjective', de: 'Adjektiv' },
  LEXICAL: { vi: 'Từ vựng', en: 'Vocabulary', de: 'Wortschatz' },
}

/** Nhãn chung khi backend trả mã ngoài taxonomy — thà chung chung còn hơn lộ mã máy. */
const GENERIC_TITLE: Record<string, string> = {
  vi: 'Lỗi ngữ pháp',
  en: 'Grammar issue',
  de: 'Grammatikfehler',
}

function pick<T>(row: { vi: T; en: T; de: T }, locale: string): T {
  if (locale === 'vi') return row.vi
  if (locale === 'de') return row.de
  return row.en
}

/** Nhãn chung theo ngôn ngữ (mã lạ / mã rỗng). */
export function genericErrorTitle(locale: string): string {
  return GENERIC_TITLE[locale] ?? GENERIC_TITLE.en
}

/**
 * Nhãn + quy tắc cho một mã lỗi. Mã lạ (backend mới hơn FE, hoặc LLM trả mã
 * ngoài whitelist) rơi về nhãn chung — KHÔNG bao giờ trả về mã thô, vì mọi
 * caller đều render thẳng `title` ra màn hình học viên.
 */
export function getErrorSnippet(code: string, locale: string): LocaleSnippet {
  const row = SNIPPETS[code]
  if (!row) {
    return { title: genericErrorTitle(locale), rule: '' }
  }
  return pick(row, locale)
}

/**
 * Nhãn người-đọc-được cho một mã lỗi, hoặc null nếu mã ngoài taxonomy — khác
 * getErrorSnippet ở chỗ KHÔNG rơi về nhãn chung, để caller tự chọn nhãn riêng
 * (ví dụ chuỗi i18n của chính màn đó).
 */
export function labelForCode(code: string | null | undefined, locale: string): string | null {
  if (!code) return null
  const row = SNIPPETS[code]
  if (!row) return null
  return pick(row, locale).title
}

/** Nhãn nhóm lỗi theo ngôn ngữ; null nếu nhóm lạ (caller dùng nhãn "Khác"). */
export function categoryLabel(code: string | null | undefined, locale: string): string | null {
  const prefix = code?.split('.')[0]?.toUpperCase() ?? ''
  const row = CATEGORIES[prefix]
  return row ? pick(row, locale) : null
}

export const ALL_ERROR_CODES = Object.keys(SNIPPETS)
