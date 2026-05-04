// ─────────────────────────────────────────────────────────────────────────────
// DeutschFlow · Thư viện lỗi / Fehlerbibliothek  (/errors)
// "Vết sẹo ngữ pháp" — Grammar scar journal
// Mobile-first · BottomNav · VI/DE bilingual
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Search, X, Check, ChevronDown, AlertTriangle, Zap,
  BookOpen, RotateCcw, Flame, Filter, Plus, Star,
  ArrowRight, TrendingUp, Shield, Heart, Award,
  ChevronRight, SlidersHorizontal,
} from "lucide-react";
import { BottomNav } from "../components/BottomNav";
import { useLanguage } from "../contexts/LanguageContext";

// ─────────────────────────────────────────────────────────────────────────────
// Design tokens (consistent with DeutschFlow system)
// ─────────────────────────────────────────────────────────────────────────────
const P = {
  navy: "#00305E", navyDark: "#002447", navyLight: "#EBF2FA",
  blue: "#2D9CDB",  blueLight: "#EBF5FB",
  yellow: "#FFCE00", yellowLight: "#FFF8E1",
  green: "#27AE60",  greenLight: "#E8F8F0",
  red: "#EB5757",    redLight: "#FDEAEA",
  purple: "#9B51E0", purpleLight: "#F4EDFF",
  orange: "#F2994A", orangeLight: "#FEF3E8",
  teal: "#00BFA5",
  bg: "#F0F4F8", card: "#FFFFFF",
  text: "#0F172A", muted: "#64748B", border: "#E2E8F0",
};

// Grammar gender colors
const CAT_COLORS: Record<string, { bg: string; text: string; border: string; label_vi: string; label_de: string }> = {
  artikel:      { bg: "#EBF5FB", text: P.blue,   border: "#BFE0F5", label_vi: "Mạo từ",     label_de: "Artikel" },
  kasus:        { bg: "#FDEAEA", text: P.red,    border: "#F5BFBF", label_vi: "Cách",        label_de: "Kasus" },
  verb:         { bg: "#F4EDFF", text: P.purple, border: "#D9BFF5", label_vi: "Động từ",     label_de: "Verb" },
  wortstellung: { bg: "#FEF3E8", text: P.orange, border: "#F5D9BF", label_vi: "Trật tự từ",  label_de: "Wortstellung" },
  adjektiv:     { bg: "#E8F8F0", text: P.green,  border: "#BFEFCF", label_vi: "Tính từ",     label_de: "Adjektiv" },
  other:        { bg: "#F8F8F8", text: P.muted,  border: P.border,  label_vi: "Khác",        label_de: "Sonstige" },
};

type Category = keyof typeof CAT_COLORS;

const SEVERITY_MAP = {
  high:   { color: P.red,    icon: "🔴", vi: "Hay gặp",   de: "Häufig" },
  medium: { color: P.orange, icon: "🟡", vi: "Thỉnh thoảng", de: "Manchmal" },
  low:    { color: P.green,  icon: "🟢", vi: "Đã hiểu",   de: "Verstanden" },
};

// ─────────────────────────────────────────────────────────────────────────────
// Error data model
// ─────────────────────────────────────────────────────────────────────────────
interface GrammarError {
  id: string;
  category: Category;
  wrong: string;
  correct: string;
  rule_vi: string;
  rule_de: string;
  explanation_vi: string;
  explanation_de: string;
  frequency: number;
  mastered: boolean;
  severity: "high" | "medium" | "low";
  persona: "lukas" | "emma";
  comment_vi: string;
  comment_de: string;
  dateAdded: string;
  context: string; // sentence context
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock error library — 14 realistic "grammar scars"
// ─────────────────────────────────────────────────────────────────────────────
const INITIAL_ERRORS: GrammarError[] = [
  {
    id: "e1", category: "kasus",
    wrong: "Ich gehe in der Schule.",
    correct: "Ich gehe in die Schule.",
    rule_vi: "Akkusativ khi có chuyển động (Bewegung)",
    rule_de: "Akkusativ bei Bewegung",
    explanation_vi: "Giới từ 'in' dùng Akkusativ khi chỉ sự di chuyển đến nơi nào đó, Dativ khi chỉ vị trí đứng yên.",
    explanation_de: "Das Präp. 'in' regiert Akkusativ bei Bewegung (wohin?), aber Dativ bei Lage (wo?).",
    frequency: 14, mastered: false, severity: "high",
    persona: "lukas",
    comment_vi: "Bug nghiêm trọng! 'in + Akkusativ = wohin' (đi đến đâu), 'in + Dativ = wo' (ở đâu). Nhớ như switch-case! 🐛",
    comment_de: "Kritischer Bug! 'in + Akkusativ = wohin', 'in + Dativ = wo'. Denk an Switch-Case! 🐛",
    dateAdded: "2025-01-12", context: "Kapitel 4 · Wegbeschreibung",
  },
  {
    id: "e2", category: "artikel",
    wrong: "der Mädchen",
    correct: "das Mädchen",
    rule_vi: "Danh từ có hậu tố -chen luôn là Neutrum",
    rule_de: "Diminutiv -chen → immer Neutrum",
    explanation_vi: "Tất cả danh từ kết thúc bằng -chen hoặc -lein đều là Neutrum (das), dù nghĩa của chúng là gì.",
    explanation_de: "Alle Substantive mit -chen oder -lein sind immer Neutrum, unabhängig von der Bedeutung.",
    frequency: 9, mastered: false, severity: "high",
    persona: "lukas",
    comment_vi: "Rule quan trọng: hậu tố -chen/-lein = das, không ngoại lệ. Giống như type annotation trong TypeScript! 📝",
    comment_de: "Wichtige Regel: Suffix -chen/-lein = das, keine Ausnahme. Wie ein Typ-Constraint! 📝",
    dateAdded: "2025-01-10", context: "Kapitel 2 · Familie",
  },
  {
    id: "e3", category: "verb",
    wrong: "Ich habe geschlafen haben.",
    correct: "Ich habe geschlafen.",
    rule_vi: "Không dùng double Hilfsverb trong Perfekt",
    rule_de: "Kein doppeltes Hilfsverb im Perfekt",
    explanation_vi: "Thì Perfekt chỉ cần một trợ động từ (haben/sein) + Partizip II. Không lặp lại 'haben' ở cuối.",
    explanation_de: "Das Perfekt braucht nur ein Hilfsverb (haben/sein) + Partizip II. Kein Doppel-Hilfsverb.",
    frequency: 6, mastered: true, severity: "medium",
    persona: "emma",
    comment_vi: "Haha, này là lỗi kinh điển! Nhớ nhé: haben/sein + Partizip II là đủ rồi. Không cần thêm! 😄",
    comment_de: "Klassischer Fehler! haben/sein + Partizip II – das reicht. Nicht mehr! 😄",
    dateAdded: "2025-01-08", context: "Kapitel 3 · Perfekt",
  },
  {
    id: "e4", category: "wortstellung",
    wrong: "Ich bin gegangen gestern ins Kino.",
    correct: "Ich bin gestern ins Kino gegangen.",
    rule_vi: "Partizip II luôn đứng cuối câu",
    rule_de: "Partizip II steht immer am Satzende",
    explanation_vi: "Trong câu Perfekt, trợ động từ (bin) ở vị trí 2, Partizip II (gegangen) ở cuối câu. Các thành phần khác ở giữa.",
    explanation_de: "Im Perfekt: Hilfsverb an Position 2, Partizip II ans Satzende. Andere Elemente dazwischen.",
    frequency: 11, mastered: false, severity: "high",
    persona: "lukas",
    comment_vi: "Cấu trúc câu tiếng Đức như kiến trúc phần mềm: mỗi phần có vị trí cố định. Verb-Klammer = bracket notation! 🏗️",
    comment_de: "Deutsche Satzstruktur wie Software-Architektur: jedes Teil hat seinen fixen Platz. Verbklammer! 🏗️",
    dateAdded: "2025-01-15", context: "Kapitel 3 · Perfekt",
  },
  {
    id: "e5", category: "artikel",
    wrong: "das Hunger",
    correct: "der Hunger",
    rule_vi: "Danh từ trừu tượng từ động từ mạnh → thường Maskulin",
    rule_de: "Nomina aus starken Verben → meist Maskulin",
    explanation_vi: "'Hunger' xuất phát từ động từ 'hungern'. Nhiều danh từ từ động từ mạnh là Maskulin (der Schlaf, der Lauf...).",
    explanation_de: "'Hunger' kommt von 'hungern'. Viele Substantive aus starken Verben sind Maskulin.",
    frequency: 5, mastered: false, severity: "medium",
    persona: "emma",
    comment_vi: "Berlin đầy những cái bẫy như này! der Hunger, der Durst, der Schlaf... học theo cụm cho dễ nhớ nhé! 🌟",
    comment_de: "Berlin steckt voller solcher Fallen! der Hunger, der Durst, der Schlaf... am besten in Gruppen lernen! 🌟",
    dateAdded: "2025-01-14", context: "Kapitel 5 · Alltag",
  },
  {
    id: "e6", category: "kasus",
    wrong: "Ich helfe dich.",
    correct: "Ich helfe dir.",
    rule_vi: "Động từ 'helfen' yêu cầu Dativ, không phải Akkusativ",
    rule_de: "helfen + Dativ (nicht Akkusativ)",
    explanation_vi: "Một số động từ trong tiếng Đức luôn đi với Dativ: helfen, danken, folgen, gehören, glauben, gefallen...",
    explanation_de: "Einige Verben fordern immer Dativ: helfen, danken, folgen, gehören, glauben, gefallen...",
    frequency: 8, mastered: false, severity: "high",
    persona: "lukas",
    comment_vi: "Danh sách 'Dativ-Verben' là một trong những bug thường gặp nhất! Bookmark lại và học thuộc. No shortcuts! 📌",
    comment_de: "Die Liste der Dativ-Verben ist einer der häufigsten Bugs! Auswendig lernen. No shortcuts! 📌",
    dateAdded: "2025-01-11", context: "Kapitel 4 · Dativ",
  },
  {
    id: "e7", category: "adjektiv",
    wrong: "ein schöne Garten",
    correct: "ein schöner Garten",
    rule_vi: "Adjective ending sau mạo từ bất định (ein) theo mixed declension",
    rule_de: "Adjektivendung nach unbestimmtem Artikel (gemischte Deklination)",
    explanation_vi: "Sau 'ein' (mạo từ bất định), tính từ phải mang đuôi mạnh ở những trường hợp 'ein' không thể hiện giới tính: -er (Mask.Nom.), -es (Neut.Nom./Akk.), -e (Fem.Nom./Akk. + Plural).",
    explanation_de: "Nach 'ein' trägt das Adjektiv starke Endungen, wo 'ein' kein Genus zeigt: -er (Mask.Nom.), -es (Neut.Nom./Akk.).",
    frequency: 12, mastered: false, severity: "high",
    persona: "lukas",
    comment_vi: "Adjektiv declension là bảng phức tạp nhất — nhưng có logic! Luật: nếu mạo từ không cho thấy giống, adjektiv phải làm thay! 🧩",
    comment_de: "Adjektivdeklination ist die komplexeste Tabelle — aber logisch! Wenn der Artikel kein Genus zeigt, muss das Adjektiv es übernehmen! 🧩",
    dateAdded: "2025-01-09", context: "Kapitel 6 · Adjektive",
  },
  {
    id: "e8", category: "verb",
    wrong: "Ich kann nicht kommen heute.",
    correct: "Ich kann heute nicht kommen.",
    rule_vi: "Modalverb: Infinitiv luôn cuối câu, 'nicht' trước Infinitiv",
    rule_de: "Modalverb: Infinitiv ans Satzende, 'nicht' vor dem Infinitiv",
    explanation_vi: "Khi có Modalverb (kann, muss, darf...), Infinitiv chính luôn ở cuối câu. 'nicht' đứng ngay trước Infinitiv đó.",
    explanation_de: "Bei Modalverben steht der Hauptinfinitiv immer am Ende. 'nicht' steht unmittelbar davor.",
    frequency: 7, mastered: true, severity: "medium",
    persona: "lukas",
    comment_vi: "Modalverben = wrapper functions! können(doSomething) → 'Ich kann [adverb] [Infinitiv]'. Bracket phải đúng vị trí! 🔧",
    comment_de: "Modalverben = Wrapper-Funktionen! können(doSomething) → 'Ich kann [Adverb] [Infinitiv]'. Klammerstruktur! 🔧",
    dateAdded: "2025-01-07", context: "Kapitel 3 · Modalverben",
  },
  {
    id: "e9", category: "artikel",
    wrong: "die Problem",
    correct: "das Problem",
    rule_vi: "Từ mượn từ Hy Lạp/Latin kết thúc -ma → Neutrum",
    rule_de: "Fremdwörter auf -ma (griech./lat.) → Neutrum",
    explanation_vi: "Danh từ gốc Hy Lạp kết thúc bằng -ma: das Thema, das Drama, das Schema, das Klima, das Problem đều là Neutrum.",
    explanation_de: "Gräzismen auf -ma: das Thema, das Drama, das Schema, das Klima, das Problem – alle Neutrum.",
    frequency: 4, mastered: false, severity: "medium",
    persona: "emma",
    comment_vi: "Ơi, das Problem là tiếng Hy Lạp đó! -ma ending = das. Còn das Thema, das Drama... nghệ thuật mà cũng có luật! 🎨",
    comment_de: "Das Problem kommt aus dem Griechischen! -ma-Endung = das. Auch das Thema, das Drama... Kunst hat Regeln! 🎨",
    dateAdded: "2025-01-13", context: "Kapitel 5 · Fremdwörter",
  },
  {
    id: "e10", category: "kasus",
    wrong: "trotz dem Regen",
    correct: "trotz des Regens",
    rule_vi: "Giới từ 'trotz' yêu cầu Genitiv",
    rule_de: "trotz + Genitiv",
    explanation_vi: "Các giới từ yêu cầu Genitiv: trotz, wegen, während, statt/anstatt, aufgrund, mithilfe, innerhalb, außerhalb...",
    explanation_de: "Genitivpräpositionen: trotz, wegen, während, statt/anstatt, aufgrund, mithilfe, innerhalb, außerhalb...",
    frequency: 3, mastered: false, severity: "low",
    persona: "emma",
    comment_vi: "Tiếng Đức hiện đại thường dùng Dativ thay Genitiv trong văn nói — nhưng văn viết formal vẫn cần Genitiv! Context matters! 📖",
    comment_de: "Im modernen Deutsch oft Dativ statt Genitiv im Gespräch — aber im formellen Schreiben bleibt Genitiv! Context matters! 📖",
    dateAdded: "2025-01-16", context: "Kapitel 7 · Genitiv",
  },
  {
    id: "e11", category: "wortstellung",
    wrong: "Obwohl es regnet, ich gehe raus.",
    correct: "Obwohl es regnet, gehe ich raus.",
    rule_vi: "Sau mệnh đề phụ (Nebensatz), verb chính đứng đầu mệnh đề chính",
    rule_de: "Nach Nebensatz steht das Verb des Hauptsatzes an Position 1",
    explanation_vi: "Khi Nebensatz đứng trước Hauptsatz, toàn bộ Nebensatz chiếm vị trí 1. Do đó, verb của Hauptsatz phải ở vị trí 2 ngay sau dấu phẩy.",
    explanation_de: "Wenn der Nebensatz vorangestellt ist, nimmt er Position 1 ein. Deshalb kommt das Verb des Hauptsatzes direkt nach dem Komma (Position 2).",
    frequency: 10, mastered: false, severity: "high",
    persona: "lukas",
    comment_vi: "V2-Regel là kiến trúc cốt lõi của tiếng Đức! Verb luôn ở vị trí 2 trong Hauptsatz — như main() function luôn là entry point! 💻",
    comment_de: "Die V2-Regel ist das Kernmuster des Deutschen! Verb immer auf Position 2 im Hauptsatz — wie main() als Entry Point! 💻",
    dateAdded: "2025-01-06", context: "Kapitel 4 · Nebensätze",
  },
  {
    id: "e12", category: "verb",
    wrong: "Er ist geschwommen haben.",
    correct: "Er hat geschwommen.",
    rule_vi: "Schwimmen dùng 'haben' (không phải 'sein') khi không có đích đến",
    rule_de: "schwimmen mit 'haben' (ohne Richtungsangabe)",
    explanation_vi: "Động từ chuyển động như schwimmen, fahren, reiten dùng 'sein' khi có đích đến cụ thể, nhưng dùng 'haben' khi chỉ là hoạt động không có đích.",
    explanation_de: "Bewegungsverben (schwimmen, fahren, reiten) nehmen 'sein' bei konkretem Ziel, aber 'haben' bei bloßer Aktivität ohne Ziel.",
    frequency: 5, mastered: false, severity: "medium",
    persona: "emma",
    comment_vi: "Sein hay haben? Nếu bạn đến được một nơi nào đó = sein. Nếu chỉ là hoạt động = haben. Nghĩ về đích đến nhé! 🏊",
    comment_de: "Sein oder haben? Wenn du irgendwo ankommst = sein. Wenn's nur eine Aktivität ist = haben. An das Ziel denken! 🏊",
    dateAdded: "2025-01-17", context: "Kapitel 3 · Perfekt",
  },
  {
    id: "e13", category: "adjektiv",
    wrong: "Das Haus ist sehr schönen.",
    correct: "Das Haus ist sehr schön.",
    rule_vi: "Sau động từ 'sein' (predikativ), tính từ không có đuôi",
    rule_de: "Prädikatives Adjektiv nach 'sein' – keine Endung",
    explanation_vi: "Khi tính từ đứng sau sein/werden/bleiben (vị ngữ tính từ - prädikativ), nó không có đuôi biến cách. Chỉ tính từ attributiv (trước danh từ) mới có đuôi.",
    explanation_de: "Prädikative Adjektive (nach sein/werden/bleiben) sind endungslos. Nur attributive Adjektive (vor Nomen) erhalten Endungen.",
    frequency: 8, mastered: true, severity: "medium",
    persona: "lukas",
    comment_vi: "Prädikativ vs. Attributiv — hai role hoàn toàn khác nhau! Sau 'sein' = không đuôi. Trước danh từ = có đuôi. Clean separation! ✅",
    comment_de: "Prädikativ vs. Attributiv – zwei völlig verschiedene Rollen! Nach 'sein' = keine Endung. Vor Nomen = Endung. Klare Trennung! ✅",
    dateAdded: "2025-01-05", context: "Kapitel 6 · Adjektive",
  },
  {
    id: "e14", category: "artikel",
    wrong: "Die Sonne ist sehr heißes.",
    correct: "Die Sonne ist sehr heiß.",
    rule_vi: "Tính từ prädikativ không biến cách (xem lỗi e13)",
    rule_de: "Prädikatives Adjektiv ohne Endung (vgl. Fehler e13)",
    explanation_vi: "Lỗi tương tự e13 nhưng ở ngữ cảnh khác — cho thấy pattern này chưa được internalize.",
    explanation_de: "Ähnlicher Fehler wie e13, aber in anderem Kontext – zeigt, dass das Muster noch nicht verinnerlicht ist.",
    frequency: 6, mastered: false, severity: "medium",
    persona: "emma",
    comment_vi: "Mình thấy pattern này xuất hiện lần nữa! Khi tính từ sau 'ist/sind/war/werden', nhớ: không cần đuôi gì cả! 🌸",
    comment_de: "Ich sehe das Muster wieder! Adjektiv nach 'ist/sind/war/werden' – keine Endung nötig! 🌸",
    dateAdded: "2025-01-18", context: "Kapitel 6 · Wetter",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Translations
// ─────────────────────────────────────────────────────────────────────────────
const T = {
  vi: {
    title: "Thư viện lỗi",
    subtitle: "Vết sẹo ngữ pháp — càng nhớ lâu, càng giỏi nhanh",
    search: "Tìm lỗi...",
    all: "Tất cả",
    mastered: "Đã thuần thục",
    pending: "Cần luyện",
    stats: {
      total: "Tổng lỗi",
      mastered: "Đã thuần thục",
      pending: "Chưa thuần thục",
      mostFreq: "Hay gặp nhất",
    },
    wrong: "Sai ❌",
    correct: "Đúng ✓",
    rule: "Quy tắc",
    explanation: "Giải thích",
    freq: "lần",
    freqLabel: "Đã gặp",
    markMastered: "Đánh dấu đã thuần thục",
    unmarkMastered: "Bỏ đánh dấu",
    review: "Ôn lại",
    addError: "Thêm lỗi mới",
    emptySearch: "Không tìm thấy lỗi nào",
    emptyFilter: "Không có lỗi trong danh mục này",
    scarCount: (n: number) => `${n} vết sẹo`,
    healedCount: (n: number) => `${n} đã lành`,
    sortBy: "Sắp xếp",
    sortFreq: "Tần suất",
    sortDate: "Ngày thêm",
    sortCat: "Danh mục",
    filter: "Lọc",
    context: "Ngữ cảnh",
    close: "Đóng",
    insightTitle: "Phân tích lỗi",
    insightDesc: "Nhóm lỗi cần chú ý nhiều nhất",
    progressTitle: "Tiến trình chữa lành",
    progressDesc: "vết sẹo đã lành",
    tip: "💡 Mẹo: Nhấp vào thẻ để xem giải thích chi tiết từ AI",
  },
  de: {
    title: "Fehlerbibliothek",
    subtitle: "Deine Grammatiknarben — je länger du erinnerst, desto schneller wirst du",
    search: "Fehler suchen...",
    all: "Alle",
    mastered: "Gemeistert",
    pending: "Noch üben",
    stats: {
      total: "Fehler gesamt",
      mastered: "Gemeistert",
      pending: "Noch offen",
      mostFreq: "Am häufigsten",
    },
    wrong: "Falsch ❌",
    correct: "Richtig ✓",
    rule: "Regel",
    explanation: "Erklärung",
    freq: "×",
    freqLabel: "Gesehen",
    markMastered: "Als gemeistert markieren",
    unmarkMastered: "Markierung aufheben",
    review: "Wiederholen",
    addError: "Fehler hinzufügen",
    emptySearch: "Keine Fehler gefunden",
    emptyFilter: "Keine Fehler in dieser Kategorie",
    scarCount: (n: number) => `${n} Narben`,
    healedCount: (n: number) => `${n} geheilt`,
    sortBy: "Sortieren",
    sortFreq: "Häufigkeit",
    sortDate: "Datum",
    sortCat: "Kategorie",
    filter: "Filter",
    context: "Kontext",
    close: "Schließen",
    insightTitle: "Fehleranalyse",
    insightDesc: "Die wichtigsten Fehlergruppen",
    progressTitle: "Heilungsfortschritt",
    progressDesc: "Narben geheilt",
    tip: "💡 Tipp: Karte antippen für KI-Erklärung",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// SVG Scar Icon (decorative)
// ─────────────────────────────────────────────────────────────────────────────
function ScarIcon({ healed = false }: { healed?: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      {healed ? (
        <>
          <circle cx="10" cy="10" r="9" fill={P.greenLight} stroke={P.green} strokeWidth="1.5" />
          <path d="M6 10l3 3 5-5" stroke={P.green} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : (
        <>
          <circle cx="10" cy="10" r="9" fill={P.redLight} stroke={P.red} strokeWidth="1.5" />
          <path d="M10 4v6M7 7l3 3 3-3" stroke={P.red} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stat Card
// ─────────────────────────────────────────────────────────────────────────────
function StatCard({ value, label, color, bg, icon }: {
  value: string | number; label: string; color: string; bg: string; icon: React.ReactNode;
}) {
  return (
    <motion.div
      className="rounded-[16px] p-3.5 flex flex-col gap-1"
      style={{ background: bg, border: `1.5px solid ${color}30` }}
      whileTap={{ scale: 0.97 }}
    >
      <div className="flex items-center justify-between">
        <div className="w-8 h-8 rounded-[10px] flex items-center justify-center"
          style={{ background: `${color}18` }}>
          {icon}
        </div>
      </div>
      <p className="text-xl font-black" style={{ color }}>{value}</p>
      <p className="text-[11px] font-semibold leading-tight" style={{ color: P.muted }}>{label}</p>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Category Insight Bar
// ─────────────────────────────────────────────────────────────────────────────
function InsightBar({ category, count, total, lang }: {
  category: Category; count: number; total: number; lang: "vi" | "de";
}) {
  const c = CAT_COLORS[category];
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-bold w-24 flex-shrink-0" style={{ color: c.text }}>
        {lang === "vi" ? c.label_vi : c.label_de}
      </span>
      <div className="flex-1 h-2 rounded-full" style={{ background: `${c.text}15` }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: c.text }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
      <span className="text-xs font-bold w-6 text-right" style={{ color: c.text }}>{count}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Error Detail Sheet (bottom drawer)
// ─────────────────────────────────────────────────────────────────────────────
function ErrorDetailSheet({
  error, lang, onClose, onToggleMastered
}: {
  error: GrammarError;
  lang: "vi" | "de";
  onClose: () => void;
  onToggleMastered: (id: string) => void;
}) {
  const t = T[lang];
  const c = CAT_COLORS[error.category];
  const sev = SEVERITY_MAP[error.severity];

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
        onClick={onClose}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      />

      {/* Sheet */}
      <motion.div
        className="relative z-10 rounded-t-[28px] overflow-hidden"
        style={{ background: "white", maxHeight: "88vh" }}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full" style={{ background: P.border }} />
        </div>

        <div className="overflow-y-auto" style={{ maxHeight: "calc(88vh - 20px)" }}>
          {/* Header */}
          <div className="px-5 pb-4" style={{ borderBottom: `1px solid ${P.border}` }}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                  style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
                  {lang === "vi" ? c.label_vi : c.label_de}
                </span>
                <span className="text-xs font-semibold" style={{ color: sev.color }}>
                  {sev.icon} {lang === "vi" ? sev.vi : sev.de}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                  style={{ background: P.navyLight, color: P.navy }}>
                  {t.freqLabel}: {error.frequency}{t.freq}
                </span>
              </div>
              <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full flex-shrink-0"
                style={{ background: P.border }}>
                <X size={14} style={{ color: P.muted }} />
              </button>
            </div>
          </div>

          <div className="p-5 space-y-4">
            {/* Wrong / Correct */}
            <div className="grid grid-cols-1 gap-3">
              <div className="rounded-[16px] p-4" style={{ background: `${P.red}08`, border: `1.5px solid ${P.red}25` }}>
                <p className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: P.red }}>{t.wrong}</p>
                <p className="font-bold text-base" style={{ color: P.text }}>{error.wrong}</p>
              </div>
              <div className="rounded-[16px] p-4" style={{ background: `${P.green}08`, border: `1.5px solid ${P.green}25` }}>
                <p className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: P.green }}>{t.correct}</p>
                <p className="font-bold text-base" style={{ color: P.text }}>{error.correct}</p>
              </div>
            </div>

            {/* Rule */}
            <div className="rounded-[16px] p-4" style={{ background: P.navyLight, border: `1.5px solid ${P.navy}18` }}>
              <div className="flex items-center gap-2 mb-2">
                <Shield size={13} style={{ color: P.navy }} />
                <p className="text-xs font-bold uppercase tracking-wide" style={{ color: P.navy }}>{t.rule}</p>
              </div>
              <p className="font-black text-sm" style={{ color: P.navy }}>
                {lang === "vi" ? error.rule_vi : error.rule_de}
              </p>
            </div>

            {/* Explanation */}
            <div className="rounded-[16px] p-4" style={{ background: "#FAFBFC", border: `1px solid ${P.border}` }}>
              <div className="flex items-center gap-2 mb-2">
                <BookOpen size={13} style={{ color: P.muted }} />
                <p className="text-xs font-bold uppercase tracking-wide" style={{ color: P.muted }}>{t.explanation}</p>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: P.text }}>
                {lang === "vi" ? error.explanation_vi : error.explanation_de}
              </p>
            </div>

            {/* AI Persona Comment */}
            <div className="rounded-[16px] p-4"
              style={{
                background: error.persona === "lukas"
                  ? "linear-gradient(135deg, #1A3A52 0%, #0E2A3A 100%)"
                  : "linear-gradient(135deg, #0A3832 0%, #062820 100%)",
              }}>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center font-black text-sm flex-shrink-0"
                  style={{
                    background: error.persona === "lukas"
                      ? "linear-gradient(135deg, #2D9CDB, #1A6A9A)"
                      : "linear-gradient(135deg, #00BFA5, #007A6A)",
                    color: "white",
                  }}>
                  {error.persona === "lukas" ? "L" : "E"}
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold mb-1"
                    style={{ color: error.persona === "lukas" ? "#2D9CDB" : "#00BFA5" }}>
                    {error.persona === "lukas" ? "Lukas" : "Emma"}
                  </p>
                  <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.85)" }}>
                    {lang === "vi" ? error.comment_vi : error.comment_de}
                  </p>
                </div>
              </div>
            </div>

            {/* Context */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-[10px]"
              style={{ background: P.orangeLight }}>
              <Zap size={12} style={{ color: P.orange }} />
              <span className="text-xs font-semibold" style={{ color: P.orange }}>{t.context}:</span>
              <span className="text-xs" style={{ color: P.muted }}>{error.context}</span>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3 pb-2">
              <motion.button
                onClick={() => onToggleMastered(error.id)}
                className="py-3 rounded-[14px] font-bold text-sm flex items-center justify-center gap-2"
                style={{
                  background: error.mastered ? P.greenLight : P.green,
                  color: error.mastered ? P.green : "white",
                  border: `2px solid ${error.mastered ? P.green : "transparent"}`,
                }}
                whileTap={{ scale: 0.97 }}>
                {error.mastered ? <><RotateCcw size={14} /> {t.unmarkMastered}</> : <><Check size={14} /> {t.markMastered}</>}
              </motion.button>
              <motion.button
                className="py-3 rounded-[14px] font-bold text-sm flex items-center justify-center gap-2"
                style={{ background: P.navy, color: "white" }}
                whileTap={{ scale: 0.97 }}>
                <RotateCcw size={14} /> {t.review}
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Error Card
// ─────────────────────────────────────────────────────────────────────────────
function ErrorCard({
  error, lang, onClick, onToggleMastered, index
}: {
  error: GrammarError;
  lang: "vi" | "de";
  onClick: () => void;
  onToggleMastered: (e: React.MouseEvent, id: string) => void;
  index: number;
}) {
  const t = T[lang];
  const c = CAT_COLORS[error.category];
  const sev = SEVERITY_MAP[error.severity];

  return (
    <motion.div
      className="rounded-[20px] overflow-hidden relative cursor-pointer"
      style={{
        background: "white",
        border: `1.5px solid ${error.mastered ? P.green + "40" : P.border}`,
        boxShadow: error.mastered
          ? `0 4px 20px ${P.green}18`
          : "0 4px 20px rgba(0,48,94,0.07)",
      }}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
    >
      {/* Mastered ribbon */}
      {error.mastered && (
        <div className="absolute top-0 right-0 z-10">
          <div className="w-16 h-16 overflow-hidden">
            <div className="absolute top-3 right-[-18px] rotate-45 px-6 py-0.5 text-[8px] font-black"
              style={{ background: P.green, color: "white" }}>
              ✓
            </div>
          </div>
        </div>
      )}

      {/* Left accent stripe */}
      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-[20px]"
        style={{ background: error.mastered ? P.green : c.text }} />

      <div className="pl-4 pr-4 pt-4 pb-3">
        {/* Top row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
              {lang === "vi" ? c.label_vi : c.label_de}
            </span>
            <span className="text-[10px] font-semibold" style={{ color: sev.color }}>
              {sev.icon}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: P.navyLight, color: P.navy }}>
              {error.frequency}{t.freq}
            </span>
            <ScarIcon healed={error.mastered} />
          </div>
        </div>

        {/* Wrong */}
        <div className="mb-2 px-3 py-2 rounded-[10px]" style={{ background: `${P.red}08`, border: `1px solid ${P.red}20` }}>
          <span className="text-[9px] font-bold uppercase tracking-wide block mb-0.5" style={{ color: P.red }}>✗</span>
          <p className="text-sm font-semibold" style={{ color: P.text, textDecoration: "line-through", textDecorationColor: `${P.red}60` }}>
            {error.wrong}
          </p>
        </div>

        {/* Correct */}
        <div className="mb-3 px-3 py-2 rounded-[10px]" style={{ background: `${P.green}08`, border: `1px solid ${P.green}20` }}>
          <span className="text-[9px] font-bold uppercase tracking-wide block mb-0.5" style={{ color: P.green }}>✓</span>
          <p className="text-sm font-bold" style={{ color: P.text }}>{error.correct}</p>
        </div>

        {/* Rule chip */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <Shield size={10} style={{ color: P.navy, flexShrink: 0 }} />
            <span className="text-[11px] font-semibold truncate" style={{ color: P.navy }}>
              {lang === "vi" ? error.rule_vi : error.rule_de}
            </span>
          </div>
          <button
            onClick={e => onToggleMastered(e, error.id)}
            className="ml-2 w-7 h-7 flex items-center justify-center rounded-full flex-shrink-0 transition-all"
            style={{
              background: error.mastered ? P.green : P.border,
              border: `1.5px solid ${error.mastered ? P.green : P.border}`,
            }}>
            <Check size={12} style={{ color: error.mastered ? "white" : P.muted }} />
          </button>
        </div>
      </div>

      {/* Persona avatar in corner */}
      <div className="absolute bottom-3 right-3.5 w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-black"
        style={{
          background: error.persona === "lukas"
            ? "linear-gradient(135deg, #2D9CDB, #1A6A9A)"
            : "linear-gradient(135deg, #00BFA5, #007A6A)",
          color: "white",
        }}>
        {error.persona === "lukas" ? "L" : "E"}
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export default function ErrorLibrary() {
  const { lang } = useLanguage();
  const t = T[lang];

  const [errors, setErrors] = useState<GrammarError[]>(INITIAL_ERRORS);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "pending" | "mastered">("all");
  const [activeCategory, setActiveCategory] = useState<"all" | Category>("all");
  const [sortBy, setSortBy] = useState<"freq" | "date" | "cat">("freq");
  const [selectedError, setSelectedError] = useState<GrammarError | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Stats
  const total = errors.length;
  const masteredCount = errors.filter(e => e.mastered).length;
  const pendingCount = total - masteredCount;
  const mostFreq = [...errors].sort((a, b) => b.frequency - a.frequency)[0];

  // Category breakdown
  const catCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    errors.forEach(e => { counts[e.category] = (counts[e.category] || 0) + 1; });
    return counts;
  }, [errors]);

  // Filter + sort
  const filtered = useMemo(() => {
    let list = [...errors];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(e =>
        e.wrong.toLowerCase().includes(q) ||
        e.correct.toLowerCase().includes(q) ||
        e.rule_vi.toLowerCase().includes(q) ||
        e.rule_de.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q)
      );
    }
    if (activeTab === "mastered") list = list.filter(e => e.mastered);
    if (activeTab === "pending")  list = list.filter(e => !e.mastered);
    if (activeCategory !== "all") list = list.filter(e => e.category === activeCategory);

    list.sort((a, b) => {
      if (sortBy === "freq") return b.frequency - a.frequency;
      if (sortBy === "date") return b.dateAdded.localeCompare(a.dateAdded);
      return a.category.localeCompare(b.category);
    });
    return list;
  }, [errors, search, activeTab, activeCategory, sortBy]);

  const toggleMastered = (id: string) => {
    setErrors(prev => prev.map(e => e.id === id ? { ...e, mastered: !e.mastered } : e));
    if (selectedError?.id === id) {
      setSelectedError(prev => prev ? { ...prev, mastered: !prev.mastered } : null);
    }
  };

  const healPct = total > 0 ? Math.round((masteredCount / total) * 100) : 0;
  const circumference = 2 * Math.PI * 26;

  return (
    <div className="min-h-screen pb-24" style={{ background: P.bg }}>
      {/* ── HEADER ── */}
      <div
        className="sticky top-0 z-40 px-4 pt-12 pb-4"
        style={{
          background: `linear-gradient(160deg, ${P.navy} 0%, #004898 100%)`,
          boxShadow: "0 4px 24px rgba(0,48,94,0.35)",
        }}
      >
        {/* Title row */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-[9px] flex items-center justify-center"
                style={{ background: P.yellow }}>
                <span className="text-sm">🩹</span>
              </div>
              <h1 className="text-xl font-black text-white">{t.title}</h1>
            </div>
            <p className="text-xs text-white/50 pl-9">{t.subtitle}</p>
          </div>
          {/* Healing ring */}
          <div className="flex flex-col items-center gap-0.5">
            <svg width="56" height="56" viewBox="0 0 60 60">
              <circle cx="30" cy="30" r="26" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="5" />
              <motion.circle
                cx="30" cy="30" r="26" fill="none"
                stroke={P.yellow} strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset: circumference - (circumference * healPct) / 100 }}
                transition={{ duration: 1.4, ease: "easeOut" }}
                style={{ transform: "rotate(-90deg)", transformOrigin: "center" }}
              />
              <text x="30" y="35" textAnchor="middle" fill="white"
                fontSize="13" fontWeight="800" fontFamily="Inter,sans-serif">
                {healPct}%
              </text>
            </svg>
            <span className="text-[9px] font-bold text-white/50">{t.progressTitle}</span>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "rgba(255,255,255,0.4)" }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t.search}
            className="w-full pl-10 pr-10 py-2.5 rounded-[12px] text-sm outline-none"
            style={{
              background: "rgba(255,255,255,0.10)",
              border: "1px solid rgba(255,255,255,0.15)",
              color: "white",
            }}
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X size={13} style={{ color: "rgba(255,255,255,0.5)" }} />
            </button>
          )}
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* ── STATS BENTO ── */}
        <div className="grid grid-cols-4 gap-2.5">
          <StatCard value={total}          label={t.stats.total}    color={P.navy}   bg={P.navyLight}   icon={<BookOpen size={15} style={{ color: P.navy }} />} />
          <StatCard value={masteredCount}  label={t.stats.mastered} color={P.green}  bg={P.greenLight}  icon={<Heart size={15} style={{ color: P.green }} />} />
          <StatCard value={pendingCount}   label={t.stats.pending}  color={P.red}    bg={P.redLight}    icon={<AlertTriangle size={15} style={{ color: P.red }} />} />
          <StatCard value={mostFreq?.frequency ?? 0} label={t.stats.mostFreq} color={P.orange} bg={P.orangeLight} icon={<Flame size={15} style={{ color: P.orange }} />} />
        </div>

        {/* ── INSIGHT: Category breakdown ── */}
        <motion.div
          className="rounded-[20px] p-4"
          style={{ background: "white", border: `1.5px solid ${P.border}`, boxShadow: "0 4px 20px rgba(0,48,94,0.06)" }}
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp size={14} style={{ color: P.navy }} />
              <span className="font-bold text-sm" style={{ color: P.text }}>{t.insightTitle}</span>
            </div>
            <span className="text-xs" style={{ color: P.muted }}>{t.insightDesc}</span>
          </div>
          <div className="space-y-2.5">
            {(Object.keys(CAT_COLORS) as Category[]).map(cat => (
              <InsightBar
                key={cat}
                category={cat}
                count={catCounts[cat] || 0}
                total={total}
                lang={lang}
              />
            ))}
          </div>
        </motion.div>

        {/* ── FILTER TABS (mastered/pending/all) ── */}
        <div className="flex items-center gap-2">
          <div className="flex-1 flex gap-1 p-1 rounded-[14px]" style={{ background: "white", border: `1px solid ${P.border}` }}>
            {(["all", "pending", "mastered"] as const).map(tab => (
              <button key={tab}
                onClick={() => setActiveTab(tab)}
                className="flex-1 py-2 rounded-[10px] text-xs font-bold transition-all"
                style={{
                  background: activeTab === tab ? P.navy : "transparent",
                  color: activeTab === tab ? "white" : P.muted,
                }}>
                {tab === "all" ? `${t.all} (${total})` : tab === "pending" ? `${t.pending} (${pendingCount})` : `${t.mastered} (${masteredCount})`}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowFilters(v => !v)}
            className="w-10 h-10 rounded-[12px] flex items-center justify-center flex-shrink-0"
            style={{
              background: showFilters ? P.navy : "white",
              border: `1.5px solid ${showFilters ? P.navy : P.border}`,
            }}>
            <SlidersHorizontal size={15} style={{ color: showFilters ? "white" : P.muted }} />
          </button>
        </div>

        {/* ── EXPANDED FILTERS ── */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="rounded-[16px] p-4 space-y-3"
                style={{ background: "white", border: `1.5px solid ${P.border}` }}>
                {/* Category filter */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: P.muted }}>
                    {lang === "vi" ? "Danh mục" : "Kategorie"}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => setActiveCategory("all")}
                      className="px-2.5 py-1 rounded-full text-xs font-semibold transition-all"
                      style={{
                        background: activeCategory === "all" ? P.navy : P.navyLight,
                        color: activeCategory === "all" ? "white" : P.navy,
                      }}>
                      {t.all}
                    </button>
                    {(Object.keys(CAT_COLORS) as Category[]).map(cat => {
                      const c = CAT_COLORS[cat];
                      const active = activeCategory === cat;
                      return (
                        <button key={cat}
                          onClick={() => setActiveCategory(cat)}
                          className="px-2.5 py-1 rounded-full text-xs font-semibold transition-all"
                          style={{
                            background: active ? c.text : c.bg,
                            color: active ? "white" : c.text,
                            border: `1px solid ${active ? c.text : c.border}`,
                          }}>
                          {lang === "vi" ? c.label_vi : c.label_de}
                          {catCounts[cat] ? ` (${catCounts[cat]})` : ""}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Sort */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: P.muted }}>
                    {t.sortBy}
                  </p>
                  <div className="flex gap-1.5">
                    {(["freq", "date", "cat"] as const).map(s => (
                      <button key={s}
                        onClick={() => setSortBy(s)}
                        className="px-3 py-1.5 rounded-[8px] text-xs font-semibold transition-all"
                        style={{
                          background: sortBy === s ? P.yellow : P.navyLight,
                          color: sortBy === s ? P.navy : P.muted,
                        }}>
                        {s === "freq" ? t.sortFreq : s === "date" ? t.sortDate : t.sortCat}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── RESULTS HEADER ── */}
        <div className="flex items-center justify-between px-1">
          <p className="text-sm font-bold" style={{ color: P.text }}>
            {t.scarCount(filtered.length)}
            {masteredCount > 0 && (
              <span className="ml-2 font-normal text-xs" style={{ color: P.green }}>
                · {t.healedCount(masteredCount)}
              </span>
            )}
          </p>
          <p className="text-xs" style={{ color: P.muted }}>{t.tip}</p>
        </div>

        {/* ── ERROR CARDS GRID ── */}
        <AnimatePresence mode="popLayout">
          {filtered.length > 0 ? (
            <div className="grid grid-cols-1 gap-3">
              {filtered.map((error, i) => (
                <ErrorCard
                  key={error.id}
                  error={error}
                  lang={lang}
                  index={i}
                  onClick={() => setSelectedError(error)}
                  onToggleMastered={(e, id) => {
                    e.stopPropagation();
                    toggleMastered(id);
                  }}
                />
              ))}
            </div>
          ) : (
            <motion.div
              className="flex flex-col items-center justify-center py-16 gap-3"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ background: P.navyLight }}>
                <Search size={24} style={{ color: P.muted }} />
              </div>
              <p className="font-bold" style={{ color: P.muted }}>
                {search ? t.emptySearch : t.emptyFilter}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── ADD ERROR FAB hint ── */}
        <motion.div
          className="rounded-[16px] p-4 flex items-center gap-3"
          style={{
            background: `linear-gradient(135deg, ${P.navy}08, ${P.blue}08)`,
            border: `1.5px dashed ${P.border}`,
          }}
          whileTap={{ scale: 0.98 }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
          <div className="w-10 h-10 rounded-[12px] flex items-center justify-center"
            style={{ background: P.navy }}>
            <Plus size={18} style={{ color: P.yellow }} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold" style={{ color: P.navy }}>{t.addError}</p>
            <p className="text-xs mt-0.5" style={{ color: P.muted }}>
              {lang === "vi" ? "Lưu lại lỗi bạn vừa mắc phải từ bài học" : "Fehler aus deiner aktuellen Lektion speichern"}
            </p>
          </div>
          <ChevronRight size={16} style={{ color: P.muted }} />
        </motion.div>
      </div>

      {/* ── DETAIL SHEET ── */}
      <AnimatePresence>
        {selectedError && (
          <ErrorDetailSheet
            error={selectedError}
            lang={lang}
            onClose={() => setSelectedError(null)}
            onToggleMastered={toggleMastered}
          />
        )}
      </AnimatePresence>

      <BottomNav />
    </div>
  );
}
