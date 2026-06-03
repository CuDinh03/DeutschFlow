// Persona registry for AI Speaking — ported from web `frontend/src/lib/personas.ts`.
// Trimmed for RN: keeps id/name/role/tag/desc/group/accent + mode-support flags +
// interview positions / lesson scenarios. Soft bg/border are derived from `accent`
// in the UI, so the per-persona web CSS (glow/bubble/cta gradients) is dropped.

export type PersonaId =
  | 'lukas' | 'emma' | 'anna' | 'klaus'
  | 'lena' | 'thomas' | 'petra'
  | 'sarah' | 'schneider' | 'weber'
  | 'max' | 'oliver'
  | 'niklas' | 'nina'
  | 'hannie'
  | 'tuan' | 'lan' | 'minh'

export type PersonaGroup =
  | 'it' | 'verkauf' | 'medizin' | 'maschinenbau' | 'service' | 'medien' | 'special'

export interface PersonaScenarioRef {
  id: string
  label: string
  labelDe: string
}

export interface PersonaToken {
  id: PersonaId
  name: string
  role: string
  tag: string
  desc: string
  group: PersonaGroup
  accent: string
  supportsInterview: boolean
  supportsLesson: boolean
  interviewPositions?: PersonaScenarioRef[]
  lessonScenarios?: PersonaScenarioRef[]
}

export const PERSONA_TOKENS: Record<PersonaId, PersonaToken> = {
  // ─── IT / Startup ───
  lukas: {
    id: 'lukas', name: 'Lukas', role: 'Senior Tech Mentor', tag: 'Backend Dev · Berlin',
    desc: 'Erklärt Grammatik wie sauberen Code. Strukturiert, logisch, präzise.',
    group: 'it', accent: '#2D9CDB', supportsInterview: true, supportsLesson: false,
    interviewPositions: [
      { id: 'frontend_dev', label: 'Frontend Developer', labelDe: 'Frontend-Entwickler/in' },
      { id: 'backend_dev', label: 'Backend Developer', labelDe: 'Backend-Entwickler/in' },
      { id: 'devops', label: 'DevOps Engineer', labelDe: 'DevOps-Ingenieur/in' },
      { id: 'data_analyst', label: 'Data Analyst', labelDe: 'Datenanalyst/in' },
      { id: 'qa_engineer', label: 'QA Engineer', labelDe: 'Qualitätssicherung' },
    ],
  },
  emma: {
    id: 'emma', name: 'Emma', role: 'Berlin Culture Guide', tag: 'Künstlerin · Neukölln',
    desc: 'Bringt dir Deutsch durch Kunst, Kultur und Berliner Flair bei.',
    group: 'it', accent: '#00BFA5', supportsInterview: true, supportsLesson: false,
    interviewPositions: [
      { id: 'marketing_mgr', label: 'Marketing Manager', labelDe: 'Marketingleiter/in' },
      { id: 'sales_exec', label: 'Sales Executive', labelDe: 'Vertriebsmitarbeiter/in' },
      { id: 'cs_manager', label: 'Customer Success Manager', labelDe: 'Kundenerfolgsmanager/in' },
      { id: 'hr_coordinator', label: 'HR Coordinator', labelDe: 'Personalkoordinator/in' },
      { id: 'project_mgr', label: 'Project Manager', labelDe: 'Projektmanager/in' },
    ],
  },
  anna: {
    id: 'anna', name: 'Anna', role: 'Everyday Life Guide', tag: 'Sprachlehrerin · Hamburg',
    desc: 'Begleitet dich durch den deutschen Alltag – warm, geduldig und praktisch.',
    group: 'it', accent: '#F5A623', supportsInterview: true, supportsLesson: false,
    interviewPositions: [
      { id: 'werkstudent', label: 'Werkstudent', labelDe: 'Werkstudent/in' },
      { id: 'praktikant', label: 'Praktikant', labelDe: 'Praktikant/in' },
      { id: 'research_asst', label: 'Research Assistant', labelDe: 'Wissenschaftliche Hilfskraft' },
      { id: 'student_coord', label: 'Student Coordinator', labelDe: 'Studienkoordinator/in' },
      { id: 'teaching_asst', label: 'Teaching Assistant', labelDe: 'Tutor/in' },
    ],
  },
  klaus: {
    id: 'klaus', name: 'Klaus', role: 'Culinary Expert', tag: 'Head Chef · München',
    desc: 'Luyện tiếng Đức qua chủ đề ẩm thực, nhà bếp và giao tiếp nhóm.',
    group: 'it', accent: '#991B1B', supportsInterview: true, supportsLesson: false,
    interviewPositions: [
      { id: 'line_cook', label: 'Koch (Line Cook)', labelDe: 'Koch/Köchin' },
      { id: 'sous_chef', label: 'Sous Chef', labelDe: 'Sous Chef' },
      { id: 'head_chef', label: 'Küchenchef', labelDe: 'Küchenchef/in' },
      { id: 'servicekraft', label: 'Servicekraft', labelDe: 'Servicekraft' },
      { id: 'restaurant_mgr', label: 'Restaurantleiter', labelDe: 'Restaurantleiter/in' },
    ],
  },
  // ─── Verkauf ───
  lena: {
    id: 'lena', name: 'Lena', role: 'Supermarktmitarbeiterin', tag: 'Supermarkt · A1-A2',
    desc: 'Thân thiện, năng động, hỗ trợ mua sắm tại siêu thị Đức.',
    group: 'verkauf', accent: '#10B981', supportsInterview: true, supportsLesson: false,
    interviewPositions: [
      { id: 'kassierer', label: 'Thu ngân (Kassierer)', labelDe: 'Kassierer/in' },
      { id: 'verkaufer', label: 'Nhân viên bán hàng', labelDe: 'Verkäufer/in' },
      { id: 'lagerist', label: 'Thủ kho', labelDe: 'Lagerist/in' },
    ],
  },
  thomas: {
    id: 'thomas', name: 'Thomas', role: 'Bäcker', tag: 'Bäckerei · A1-A2',
    desc: 'Ấm áp, nhiệt tình, tự hào về các loại bánh truyền thống Đức.',
    group: 'verkauf', accent: '#D97706', supportsInterview: true, supportsLesson: false,
    interviewPositions: [
      { id: 'baker', label: 'Thợ bánh (Bäcker)', labelDe: 'Bäcker/in' },
      { id: 'konditor', label: 'Thợ bánh ngọt', labelDe: 'Konditor/in' },
      { id: 'verkauf_bakery', label: 'Bán hàng bánh', labelDe: 'Bäckereiverkäufer/in' },
    ],
  },
  petra: {
    id: 'petra', name: 'Petra', role: 'Metzger', tag: 'Metzgerei · A1-A2',
    desc: 'Chuyên nghiệp, am hiểu về các loại thịt, thẳng thắn.',
    group: 'verkauf', accent: '#DC2626', supportsInterview: true, supportsLesson: false,
    interviewPositions: [
      { id: 'metzger', label: 'Đồ tể (Metzger)', labelDe: 'Metzger/in' },
      { id: 'fleischverkauf', label: 'Bán thịt', labelDe: 'Fleischverkäufer/in' },
    ],
  },
  // ─── Medizin ───
  sarah: {
    id: 'sarah', name: 'Sarah', role: 'Med. Fachangestellte', tag: 'Arztpraxis · A2-B1',
    desc: 'Chuyên nghiệp, tổ chức tốt, thân thiện tại phòng khám.',
    group: 'medizin', accent: '#8B5CF6', supportsInterview: true, supportsLesson: false,
    interviewPositions: [
      { id: 'mfa', label: 'Trợ lý Y khoa (MFA)', labelDe: 'Med. Fachangestellte/r' },
      { id: 'rezeption_praxis', label: 'Lễ tân phòng khám', labelDe: 'Praxisrezeption' },
    ],
  },
  schneider: {
    id: 'schneider', name: 'Dr. Schneider', role: 'Augenarzt', tag: 'Augenklinik · B1-B2',
    desc: 'Chính xác, kỹ lưỡng, giải thích rõ ràng các quy trình kiểm tra.',
    group: 'medizin', accent: '#3B82F6', supportsInterview: true, supportsLesson: false,
    interviewPositions: [
      { id: 'augenarzt', label: 'Bác sĩ mắt', labelDe: 'Augenarzt/-ärztin' },
      { id: 'mta_auge', label: 'MTA Mắt', labelDe: 'MTA Augenheilkunde' },
    ],
  },
  weber: {
    id: 'weber', name: 'Dr. Weber', role: 'Dermatologin', tag: 'Hautarzt · B1-B2',
    desc: 'Tận tâm, giải thích cặn kẽ về các vấn đề da liễu.',
    group: 'medizin', accent: '#EC4899', supportsInterview: true, supportsLesson: false,
    interviewPositions: [
      { id: 'hautarzt', label: 'Bác sĩ da liễu', labelDe: 'Dermatolog/in' },
      { id: 'mta_derm', label: 'MTA Da liễu', labelDe: 'MTA Dermatologie' },
    ],
  },
  // ─── Maschinenbau ───
  max: {
    id: 'max', name: 'Max', role: 'Maschinenbediener', tag: 'Werkstatt · B1-B2',
    desc: 'Thực tế, am hiểu vận hành và bảo trì máy móc.',
    group: 'maschinenbau', accent: '#EAB308', supportsInterview: true, supportsLesson: false,
    interviewPositions: [
      { id: 'maschinenbediener', label: 'Thợ vận hành máy', labelDe: 'Maschinenbediener/in' },
      { id: 'industriemechaniker', label: 'Thợ cơ khí CN', labelDe: 'Industriemechaniker/in' },
    ],
  },
  oliver: {
    id: 'oliver', name: 'Oliver', role: 'CNC-Fräser', tag: 'CNC · B2',
    desc: 'Chính xác, logic, am hiểu lập trình và vận hành máy CNC.',
    group: 'maschinenbau', accent: '#6366F1', supportsInterview: true, supportsLesson: false,
    interviewPositions: [
      { id: 'cnc_fraser', label: 'Thợ CNC', labelDe: 'CNC-Fräser/in' },
      { id: 'cnc_programmierer', label: 'Lập trình CNC', labelDe: 'CNC-Programmierer/in' },
    ],
  },
  // ─── Service ───
  niklas: {
    id: 'niklas', name: 'Niklas', role: 'Kellner', tag: 'Restaurant · A2-B1',
    desc: 'Lịch sự, chu đáo, phục vụ tại nhà hàng sang trọng.',
    group: 'service', accent: '#14B8A6', supportsInterview: true, supportsLesson: false,
    interviewPositions: [
      { id: 'kellner', label: 'Phục vụ bàn', labelDe: 'Kellner/in' },
      { id: 'barkeeper', label: 'Pha chế', labelDe: 'Barkeeper/in' },
      { id: 'serviceleitung', label: 'Quản lý phục vụ', labelDe: 'Serviceleitung' },
    ],
  },
  nina: {
    id: 'nina', name: 'Nina', role: 'Rezeptionistin', tag: 'Hotel · A2-B1',
    desc: 'Chuyên nghiệp, thân thiện, tiếp tân khách sạn.',
    group: 'service', accent: '#F472B6', supportsInterview: true, supportsLesson: false,
    interviewPositions: [
      { id: 'rezeptionist', label: 'Lễ tân khách sạn', labelDe: 'Rezeptionist/in' },
      { id: 'concierge', label: 'Concierge', labelDe: 'Concierge' },
    ],
  },
  // ─── Medien ───
  hannie: {
    id: 'hannie', name: 'Hannie', role: 'Moderatorin & MC', tag: 'Medien · 20 Jahre',
    desc: '20 tuổi, người Đức năng động vui tươi. Dẫn chương trình, sự kiện, truyền thông.',
    group: 'medien', accent: '#F97316', supportsInterview: true, supportsLesson: false,
    interviewPositions: [
      { id: 'moderatorin', label: 'Moderatorin / MC', labelDe: 'Moderator/in' },
      { id: 'redakteurin', label: 'Redakteurin', labelDe: 'Redakteur/in' },
      { id: 'social_media_mgr', label: 'Social Media Manager', labelDe: 'Social-Media-Manager/in' },
      { id: 'pr_specialist', label: 'PR Specialist', labelDe: 'PR-Spezialist/in' },
      { id: 'content_creator', label: 'Content Creator', labelDe: 'Content Creator' },
      { id: 'event_manager', label: 'Event Manager', labelDe: 'Eventmanager/in' },
    ],
  },
  // ─── Special: Vietnamese tutors (LESSON) ───
  tuan: {
    id: 'tuan', name: 'Tuấn', role: 'Anh bạn học nghề', tag: 'Ausbildung · A1',
    desc: "Vui vẻ, tháo vát, dạy tiếng Đức 'sinh tồn' bằng tiếng Việt.",
    group: 'special', accent: '#F59E0B', supportsInterview: false, supportsLesson: true,
    lessonScenarios: [
      { id: 'alphabet', label: 'Bảng chữ cái (Buchstabieren)', labelDe: 'Das Alphabet' },
      { id: 'numbers', label: 'Số đếm (Zahlen 1-100)', labelDe: 'Zahlen' },
      { id: 'anmeldung', label: 'Đăng ký tạm trú (Anmeldung)', labelDe: 'Anmeldung' },
    ],
  },
  lan: {
    id: 'lan', name: 'Chị Lan', role: 'Người đi trước', tag: 'Hội nhập · A1',
    desc: 'Ân cần, kiên nhẫn, dạy phát âm chuẩn và mẹo văn hóa Đức.',
    group: 'special', accent: '#A78BFA', supportsInterview: false, supportsLesson: true,
    lessonScenarios: [
      { id: 'umlaut', label: 'Umlaut (ä, ö, ü)', labelDe: 'Umlaute' },
      { id: 'emergency_numbers', label: 'Số khẩn cấp (110, 112)', labelDe: 'Notrufnummern' },
      { id: 'pronunciation', label: 'Phát âm cơ bản', labelDe: 'Aussprache' },
    ],
  },
  minh: {
    id: 'minh', name: 'Minh', role: 'Cạ cứng đường phố', tag: 'Đường phố · A1',
    desc: 'Năng lượng cao, học tiếng Đức qua biển báo và đường phố.',
    group: 'special', accent: '#EF4444', supportsInterview: false, supportsLesson: true,
    lessonScenarios: [
      { id: 'street_names', label: 'Tên đường phố (Straßennamen)', labelDe: 'Straßennamen' },
      { id: 'train_station', label: 'Ga tàu (Bahnhof/Gleis)', labelDe: 'Bahnhof' },
      { id: 'speed_signs', label: 'Biển báo tốc độ (Geschwindigkeit)', labelDe: 'Verkehrszeichen' },
    ],
  },
}

export const PERSONA_GROUPS: { id: PersonaGroup; label: string; icon: string }[] = [
  { id: 'it', label: 'IT / Startup', icon: '💻' },
  { id: 'verkauf', label: 'Bán hàng', icon: '🛒' },
  { id: 'medizin', label: 'Y khoa', icon: '🏥' },
  { id: 'maschinenbau', label: 'Cơ khí', icon: '⚙️' },
  { id: 'service', label: 'Phục vụ', icon: '🍽️' },
  { id: 'medien', label: 'Truyền thông', icon: '🎤' },
  { id: 'special', label: 'Bạn Việt', icon: '🇻🇳' },
]

export const PERSONA_LIST: PersonaToken[] = Object.values(PERSONA_TOKENS)
