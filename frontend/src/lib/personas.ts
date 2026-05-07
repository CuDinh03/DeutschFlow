export type PersonaId =
  | "lukas" | "emma" | "anna" | "klaus"
  | "lena" | "thomas" | "petra"
  | "sarah" | "schneider" | "weber"
  | "max" | "oliver"
  | "niklas" | "nina"
  | "tuan" | "lan" | "minh";

export type PersonaGroup = 'it' | 'verkauf' | 'medizin' | 'maschinenbau' | 'service' | 'special';

export interface PersonaToken {
  id: PersonaId;
  name: string;
  role: string;
  tag: string;
  desc: string;
  group: PersonaGroup;
  accent: string;
  glow: string;
  bubble: string;
  border: string;
  bg: string;
  tagBg: string;
  ctaFrom: string;
  ctaTo: string;
  ctaShadow: string;
  voiceFile?: string;
  interviewPositions?: { id: string; label: string; labelDe: string }[];
  lessonScenarios?: { id: string; label: string; labelDe: string }[];
  supportsInterview: boolean;
  supportsLesson: boolean;
  replies: readonly string[];
}

export const PERSONA_TOKENS: Record<PersonaId, PersonaToken> = {
  // ═══════ IT/Startup ═══════
  lukas: {
    id: "lukas", name: "Lukas", role: "Senior Tech Mentor", tag: "Backend Dev · Berlin",
    desc: "Erklärt Grammatik wie sauberen Code. Strukturiert, logisch, präzise.",
    group: "it", voiceFile: "lukas.wav",
    accent: "#2D9CDB", glow: "rgba(45,156,219,0.4)", bubble: "#1A3A52",
    border: "rgba(45,156,219,0.25)", bg: "rgba(45,156,219,0.08)", tagBg: "rgba(45,156,219,0.15)",
    ctaFrom: "#1A6A9A", ctaTo: "#2D9CDB", ctaShadow: "0 4px 0 #0E4A6E, 0 8px 24px rgba(45,156,219,0.35)",
    supportsInterview: true, supportsLesson: false,
    interviewPositions: [
      { id: "frontend_dev", label: "Frontend Developer", labelDe: "Frontend-Entwickler/in" },
      { id: "backend_dev", label: "Backend Developer", labelDe: "Backend-Entwickler/in" },
      { id: "devops", label: "DevOps Engineer", labelDe: "DevOps-Ingenieur/in" },
      { id: "data_analyst", label: "Data Analyst", labelDe: "Datenanalyst/in" },
      { id: "qa_engineer", label: "QA Engineer", labelDe: "Qualitätssicherung" },
    ],
    replies: [
      "Hallo! Als Backend-Engineer erkläre ich dir Grammatik như sauberen Code. 👋",
      "Rất tốt! Ngữ pháp giống như Clean Code – cấu trúc và chính xác!",
    ],
  },
  emma: {
    id: "emma", name: "Emma", role: "Berlin Culture Guide", tag: "Künstlerin · Neukölln",
    desc: "Bringt dir Deutsch durch Kunst, Kultur und Berliner Flair bei.",
    group: "it", voiceFile: "emma.wav",
    accent: "#00BFA5", glow: "rgba(0,191,165,0.4)", bubble: "#0A3832",
    border: "rgba(0,191,165,0.25)", bg: "rgba(0,191,165,0.08)", tagBg: "rgba(0,191,165,0.15)",
    ctaFrom: "#007A6A", ctaTo: "#00BFA5", ctaShadow: "0 4px 0 #005A4A, 0 8px 24px rgba(0,191,165,0.35)",
    supportsInterview: true, supportsLesson: false,
    interviewPositions: [
      { id: "marketing_mgr", label: "Marketing Manager", labelDe: "Marketingleiter/in" },
      { id: "sales_exec", label: "Sales Executive", labelDe: "Vertriebsmitarbeiter/in" },
      { id: "cs_manager", label: "Customer Success Manager", labelDe: "Kundenerfolgsmanager/in" },
      { id: "hr_coordinator", label: "HR Coordinator", labelDe: "Personalkoordinator/in" },
      { id: "project_mgr", label: "Project Manager", labelDe: "Projektmanager/in" },
    ],
    replies: [
      "Hey hey! Mình là Emma! Berlin thật sống động! 🎨",
      "Tuyệt vời! Bạn học nhanh quá! ✨",
    ],
  },
  anna: {
    id: "anna", name: "Anna", role: "Everyday Life Guide", tag: "Sprachlehrerin · Hamburg",
    desc: "Begleitet dich durch den deutschen Alltag – warm, geduldig und praktisch.",
    group: "it", voiceFile: "anna.mp3",
    accent: "#F5A623", glow: "rgba(245,166,35,0.4)", bubble: "#3A2A00",
    border: "rgba(245,166,35,0.25)", bg: "rgba(245,166,35,0.08)", tagBg: "rgba(245,166,35,0.15)",
    ctaFrom: "#C97D00", ctaTo: "#F5A623", ctaShadow: "0 4px 0 #7A4D00, 0 8px 24px rgba(245,166,35,0.35)",
    supportsInterview: true, supportsLesson: false,
    interviewPositions: [
      { id: "werkstudent", label: "Werkstudent", labelDe: "Werkstudent/in" },
      { id: "praktikant", label: "Praktikant", labelDe: "Praktikant/in" },
      { id: "research_asst", label: "Research Assistant", labelDe: "Wissenschaftliche Hilfskraft" },
      { id: "student_coord", label: "Student Coordinator", labelDe: "Studienkoordinator/in" },
      { id: "teaching_asst", label: "Teaching Assistant", labelDe: "Tutor/in" },
    ],
    replies: [
      "Hallo! Ich bin Anna. Was möchtest du heute üben? 😊",
      "Super gemacht! Du lernst wirklich schnell!",
    ],
  },
  klaus: {
    id: "klaus", name: "Klaus", role: "Culinary Expert", tag: "Head Chef · München",
    desc: "Luyện tiếng Đức qua chủ đề ẩm thực, nhà bếp và giao tiếp nhóm.",
    group: "it", voiceFile: "klaus.mp3",
    accent: "#991B1B", glow: "rgba(153,27,27,0.4)", bubble: "#450A0A",
    border: "rgba(153,27,27,0.25)", bg: "rgba(153,27,27,0.08)", tagBg: "rgba(153,27,27,0.15)",
    ctaFrom: "#7F1D1D", ctaTo: "#991B1B", ctaShadow: "0 4px 0 #450A0A, 0 8px 24px rgba(153,27,27,0.35)",
    supportsInterview: true, supportsLesson: false,
    interviewPositions: [
      { id: "line_cook", label: "Koch (Line Cook)", labelDe: "Koch/Köchin" },
      { id: "sous_chef", label: "Sous Chef", labelDe: "Sous Chef" },
      { id: "head_chef", label: "Küchenchef", labelDe: "Küchenchef/in" },
      { id: "servicekraft", label: "Servicekraft", labelDe: "Servicekraft" },
      { id: "restaurant_mgr", label: "Restaurantleiter", labelDe: "Restaurantleiter/in" },
    ],
    replies: [
      "Guten Tag! Tôi là Klaus. Nhà bếp đòi hỏi sự chính xác. 👨‍🍳",
      "Rất tốt! Cắt thái gọn gàng và ngữ pháp cũng chuẩn xác!",
    ],
  },

  // ═══════ Verkauf (Bán hàng) ═══════
  lena: {
    id: "lena", name: "Lena", role: "Supermarktmitarbeiterin", tag: "Supermarkt · A1-A2",
    desc: "Thân thiện, năng động, hỗ trợ mua sắm tại siêu thị Đức.",
    group: "verkauf",
    accent: "#10B981", glow: "rgba(16,185,129,0.4)", bubble: "#064E3B",
    border: "rgba(16,185,129,0.25)", bg: "rgba(16,185,129,0.08)", tagBg: "rgba(16,185,129,0.15)",
    ctaFrom: "#047857", ctaTo: "#10B981", ctaShadow: "0 4px 0 #065F46, 0 8px 24px rgba(16,185,129,0.35)",
    supportsInterview: true, supportsLesson: false,
    interviewPositions: [
      { id: "kassierer", label: "Thu ngân (Kassierer)", labelDe: "Kassierer/in" },
      { id: "verkaufer", label: "Nhân viên bán hàng", labelDe: "Verkäufer/in" },
      { id: "lagerist", label: "Thủ kho", labelDe: "Lagerist/in" },
    ],
    replies: [
      "Guten Tag! Kann ich Ihnen helfen? 🛒",
      "Suchen Sie etwas Bestimmtes?",
    ],
  },
  thomas: {
    id: "thomas", name: "Thomas", role: "Bäcker", tag: "Bäckerei · A1-A2",
    desc: "Ấm áp, nhiệt tình, tự hào về các loại bánh truyền thống Đức.",
    group: "verkauf",
    accent: "#D97706", glow: "rgba(217,119,6,0.4)", bubble: "#451A03",
    border: "rgba(217,119,6,0.25)", bg: "rgba(217,119,6,0.08)", tagBg: "rgba(217,119,6,0.15)",
    ctaFrom: "#B45309", ctaTo: "#D97706", ctaShadow: "0 4px 0 #78350F, 0 8px 24px rgba(217,119,6,0.35)",
    supportsInterview: true, supportsLesson: false,
    interviewPositions: [
      { id: "baker", label: "Thợ bánh (Bäcker)", labelDe: "Bäcker/in" },
      { id: "konditor", label: "Thợ bánh ngọt", labelDe: "Konditor/in" },
      { id: "verkauf_bakery", label: "Bán hàng bánh", labelDe: "Bäckereiverkäufer/in" },
    ],
    replies: [
      "Willkommen in unserer Bäckerei! 🥨",
      "Unsere Brezeln sind frisch aus dem Ofen!",
    ],
  },
  petra: {
    id: "petra", name: "Petra", role: "Metzger", tag: "Metzgerei · A1-A2",
    desc: "Chuyên nghiệp, am hiểu về các loại thịt, thẳng thắn.",
    group: "verkauf",
    accent: "#DC2626", glow: "rgba(220,38,38,0.4)", bubble: "#450A0A",
    border: "rgba(220,38,38,0.25)", bg: "rgba(220,38,38,0.08)", tagBg: "rgba(220,38,38,0.15)",
    ctaFrom: "#B91C1C", ctaTo: "#DC2626", ctaShadow: "0 4px 0 #7F1D1D, 0 8px 24px rgba(220,38,38,0.35)",
    supportsInterview: true, supportsLesson: false,
    interviewPositions: [
      { id: "metzger", label: "Đồ tể (Metzger)", labelDe: "Metzger/in" },
      { id: "fleischverkauf", label: "Bán thịt", labelDe: "Fleischverkäufer/in" },
    ],
    replies: [
      "Was kann ich Ihnen anbieten? 🥩",
      "Wünschen Sie Rind, Schwein oder Geflügel?",
    ],
  },

  // ═══════ Medizin (Y khoa) ═══════
  sarah: {
    id: "sarah", name: "Sarah", role: "Med. Fachangestellte", tag: "Arztpraxis · A2-B1",
    desc: "Chuyên nghiệp, tổ chức tốt, thân thiện tại phòng khám.",
    group: "medizin",
    accent: "#8B5CF6", glow: "rgba(139,92,246,0.4)", bubble: "#2E1065",
    border: "rgba(139,92,246,0.25)", bg: "rgba(139,92,246,0.08)", tagBg: "rgba(139,92,246,0.15)",
    ctaFrom: "#6D28D9", ctaTo: "#8B5CF6", ctaShadow: "0 4px 0 #4C1D95, 0 8px 24px rgba(139,92,246,0.35)",
    supportsInterview: true, supportsLesson: false,
    interviewPositions: [
      { id: "mfa", label: "Trợ lý Y khoa (MFA)", labelDe: "Med. Fachangestellte/r" },
      { id: "rezeption_praxis", label: "Lễ tân phòng khám", labelDe: "Praxisrezeption" },
    ],
    replies: [
      "Guten Tag. Möchten Sie einen Termin vereinbaren? 🏥",
      "Haben Sie Ihre Versicherungskarte dabei?",
    ],
  },
  schneider: {
    id: "schneider", name: "Dr. Schneider", role: "Augenarzt", tag: "Augenklinik · B1-B2",
    desc: "Chính xác, kỹ lưỡng, giải thích rõ ràng các quy trình kiểm tra.",
    group: "medizin",
    accent: "#3B82F6", glow: "rgba(59,130,246,0.4)", bubble: "#1E3A5F",
    border: "rgba(59,130,246,0.25)", bg: "rgba(59,130,246,0.08)", tagBg: "rgba(59,130,246,0.15)",
    ctaFrom: "#2563EB", ctaTo: "#3B82F6", ctaShadow: "0 4px 0 #1D4ED8, 0 8px 24px rgba(59,130,246,0.35)",
    supportsInterview: true, supportsLesson: false,
    interviewPositions: [
      { id: "augenarzt", label: "Bác sĩ mắt", labelDe: "Augenarzt/-ärztin" },
      { id: "mta_auge", label: "MTA Mắt", labelDe: "MTA Augenheilkunde" },
    ],
    replies: [
      "Bitte nehmen Sie Platz. Wir machen einen Sehtest. 👁️",
    ],
  },
  weber: {
    id: "weber", name: "Dr. Weber", role: "Dermatologin", tag: "Hautarzt · B1-B2",
    desc: "Tận tâm, giải thích cặn kẽ về các vấn đề da liễu.",
    group: "medizin",
    accent: "#EC4899", glow: "rgba(236,72,153,0.4)", bubble: "#500724",
    border: "rgba(236,72,153,0.25)", bg: "rgba(236,72,153,0.08)", tagBg: "rgba(236,72,153,0.15)",
    ctaFrom: "#DB2777", ctaTo: "#EC4899", ctaShadow: "0 4px 0 #9D174D, 0 8px 24px rgba(236,72,153,0.35)",
    supportsInterview: true, supportsLesson: false,
    interviewPositions: [
      { id: "hautarzt", label: "Bác sĩ da liễu", labelDe: "Dermatolog/in" },
      { id: "mta_derm", label: "MTA Da liễu", labelDe: "MTA Dermatologie" },
    ],
    replies: [
      "Guten Tag, ich bin Dr. Weber. Was führt Sie zu mir? 🩺",
    ],
  },

  // ═══════ Maschinenbau (Cơ khí) ═══════
  max: {
    id: "max", name: "Max", role: "Maschinenbediener", tag: "Werkstatt · B1-B2",
    desc: "Thực tế, am hiểu vận hành và bảo trì máy móc.",
    group: "maschinenbau",
    accent: "#EAB308", glow: "rgba(234,179,8,0.4)", bubble: "#422006",
    border: "rgba(234,179,8,0.25)", bg: "rgba(234,179,8,0.08)", tagBg: "rgba(234,179,8,0.15)",
    ctaFrom: "#CA8A04", ctaTo: "#EAB308", ctaShadow: "0 4px 0 #854D0E, 0 8px 24px rgba(234,179,8,0.35)",
    supportsInterview: true, supportsLesson: false,
    interviewPositions: [
      { id: "maschinenbediener", label: "Thợ vận hành máy", labelDe: "Maschinenbediener/in" },
      { id: "industriemechaniker", label: "Thợ cơ khí CN", labelDe: "Industriemechaniker/in" },
    ],
    replies: [
      "Hey, die Maschine läuft nicht richtig? Was ist das Problem? ⚙️",
    ],
  },
  oliver: {
    id: "oliver", name: "Oliver", role: "CNC-Fräser", tag: "CNC · B2",
    desc: "Chính xác, logic, am hiểu lập trình và vận hành máy CNC.",
    group: "maschinenbau",
    accent: "#6366F1", glow: "rgba(99,102,241,0.4)", bubble: "#1E1B4B",
    border: "rgba(99,102,241,0.25)", bg: "rgba(99,102,241,0.08)", tagBg: "rgba(99,102,241,0.15)",
    ctaFrom: "#4F46E5", ctaTo: "#6366F1", ctaShadow: "0 4px 0 #3730A3, 0 8px 24px rgba(99,102,241,0.35)",
    supportsInterview: true, supportsLesson: false,
    interviewPositions: [
      { id: "cnc_fraser", label: "Thợ CNC", labelDe: "CNC-Fräser/in" },
      { id: "cnc_programmierer", label: "Lập trình CNC", labelDe: "CNC-Programmierer/in" },
    ],
    replies: [
      "Guten Morgen. Haben Sie die Zeichnungen für das Werkstück? 🔧",
    ],
  },

  // ═══════ Service (Phục vụ) ═══════
  niklas: {
    id: "niklas", name: "Niklas", role: "Kellner", tag: "Restaurant · A2-B1",
    desc: "Lịch sự, chu đáo, phục vụ tại nhà hàng sang trọng.",
    group: "service",
    accent: "#14B8A6", glow: "rgba(20,184,166,0.4)", bubble: "#042F2E",
    border: "rgba(20,184,166,0.25)", bg: "rgba(20,184,166,0.08)", tagBg: "rgba(20,184,166,0.15)",
    ctaFrom: "#0D9488", ctaTo: "#14B8A6", ctaShadow: "0 4px 0 #115E59, 0 8px 24px rgba(20,184,166,0.35)",
    supportsInterview: true, supportsLesson: false,
    interviewPositions: [
      { id: "kellner", label: "Phục vụ bàn", labelDe: "Kellner/in" },
      { id: "barkeeper", label: "Pha chế", labelDe: "Barkeeper/in" },
      { id: "serviceleitung", label: "Quản lý phục vụ", labelDe: "Serviceleitung" },
    ],
    replies: [
      "Guten Abend. Haben Sie reserviert? 🍽️",
    ],
  },
  nina: {
    id: "nina", name: "Nina", role: "Rezeptionistin", tag: "Hotel · A2-B1",
    desc: "Chuyên nghiệp, thân thiện, tiếp tân khách sạn.",
    group: "service",
    accent: "#F472B6", glow: "rgba(244,114,182,0.4)", bubble: "#500724",
    border: "rgba(244,114,182,0.25)", bg: "rgba(244,114,182,0.08)", tagBg: "rgba(244,114,182,0.15)",
    ctaFrom: "#EC4899", ctaTo: "#F472B6", ctaShadow: "0 4px 0 #BE185D, 0 8px 24px rgba(244,114,182,0.35)",
    supportsInterview: true, supportsLesson: false,
    interviewPositions: [
      { id: "rezeptionist", label: "Lễ tân khách sạn", labelDe: "Rezeptionist/in" },
      { id: "concierge", label: "Concierge", labelDe: "Concierge" },
    ],
    replies: [
      "Willkommen im Hotel Alpenblick! 🏨",
    ],
  },

  // ═══════ Special Vietnamese Tutors ═══════
  tuan: {
    id: "tuan", name: "Tuấn", role: "Anh bạn học nghề", tag: "Ausbildung · A1",
    desc: "Vui vẻ, tháo vát, dạy tiếng Đức 'sinh tồn' bằng tiếng Việt.",
    group: "special",
    accent: "#F59E0B", glow: "rgba(245,158,11,0.4)", bubble: "#451A03",
    border: "rgba(245,158,11,0.25)", bg: "rgba(245,158,11,0.08)", tagBg: "rgba(245,158,11,0.15)",
    ctaFrom: "#D97706", ctaTo: "#F59E0B", ctaShadow: "0 4px 0 #92400E, 0 8px 24px rgba(245,158,11,0.35)",
    supportsInterview: false, supportsLesson: true,
    lessonScenarios: [
      { id: "alphabet", label: "Bảng chữ cái (Buchstabieren)", labelDe: "Das Alphabet" },
      { id: "numbers", label: "Số đếm (Zahlen 1-100)", labelDe: "Zahlen" },
      { id: "anmeldung", label: "Đăng ký tạm trú (Anmeldung)", labelDe: "Anmeldung" },
    ],
    replies: [
      "Chào bạn! Mới sang Đức chắc còn bỡ ngỡ lắm nhỉ? Đừng lo, có mình đây! 🇩🇪",
      "Ở bên Đức khi gặp nhau họ sẽ nói là 'Hallo', từ này dễ đọc lắm!",
    ],
  },
  lan: {
    id: "lan", name: "Chị Lan", role: "Người đi trước", tag: "Hội nhập · A1",
    desc: "Ân cần, kiên nhẫn, dạy phát âm chuẩn và mẹo văn hóa Đức.",
    group: "special",
    accent: "#A78BFA", glow: "rgba(167,139,250,0.4)", bubble: "#2E1065",
    border: "rgba(167,139,250,0.25)", bg: "rgba(167,139,250,0.08)", tagBg: "rgba(167,139,250,0.15)",
    ctaFrom: "#7C3AED", ctaTo: "#A78BFA", ctaShadow: "0 4px 0 #5B21B6, 0 8px 24px rgba(167,139,250,0.35)",
    supportsInterview: false, supportsLesson: true,
    lessonScenarios: [
      { id: "umlaut", label: "Umlaut (ä, ö, ü)", labelDe: "Umlaute" },
      { id: "emergency_numbers", label: "Số khẩn cấp (110, 112)", labelDe: "Notrufnummern" },
      { id: "pronunciation", label: "Phát âm cơ bản", labelDe: "Aussprache" },
    ],
    replies: [
      "Chào em, mừng em đến với nước Đức nhé! 🌸",
      "Chữ 'ö' thì miệng em chúm lại như chữ 'o' nhưng cố gắng phát âm chữ 'ê'.",
    ],
  },
  minh: {
    id: "minh", name: "Minh", role: "Cạ cứng đường phố", tag: "Đường phố · A1",
    desc: "Năng lượng cao, học tiếng Đức qua biển báo và đường phố.",
    group: "special",
    accent: "#EF4444", glow: "rgba(239,68,68,0.4)", bubble: "#450A0A",
    border: "rgba(239,68,68,0.25)", bg: "rgba(239,68,68,0.08)", tagBg: "rgba(239,68,68,0.15)",
    ctaFrom: "#DC2626", ctaTo: "#EF4444", ctaShadow: "0 4px 0 #991B1B, 0 8px 24px rgba(239,68,68,0.35)",
    supportsInterview: false, supportsLesson: true,
    lessonScenarios: [
      { id: "street_names", label: "Tên đường phố (Straßennamen)", labelDe: "Straßennamen" },
      { id: "train_station", label: "Ga tàu (Bahnhof/Gleis)", labelDe: "Bahnhof" },
      { id: "speed_signs", label: "Biển báo tốc độ (Geschwindigkeit)", labelDe: "Verkehrszeichen" },
    ],
    replies: [
      "Bắt tay nhé người anh em! Hôm nay mình dẫn bạn đi phố! 🚶",
      "'Friedrichstraße' – dài khiếp! Nhưng đừng hoảng, mình chặt nó ra từng khúc nhé.",
    ],
  },
};

export const PERSONA_GROUPS: { id: PersonaGroup; label: string; icon: string }[] = [
  { id: 'it', label: 'IT / Startup', icon: '💻' },
  { id: 'verkauf', label: 'Bán hàng', icon: '🛒' },
  { id: 'medizin', label: 'Y khoa', icon: '🏥' },
  { id: 'maschinenbau', label: 'Cơ khí', icon: '⚙️' },
  { id: 'service', label: 'Phục vụ', icon: '🍽️' },
  { id: 'special', label: 'Bạn Việt', icon: '🇻🇳' },
];

/** Ordered list for rendering */
export const PERSONA_LIST: PersonaToken[] = Object.values(PERSONA_TOKENS);
