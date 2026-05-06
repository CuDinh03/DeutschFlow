'use client'

export type PersonaId = "lukas" | "emma" | "anna" | "klaus";

export interface PersonaToken {
  id: PersonaId;
  // Labels
  name: string;
  role: string;
  tag: string;
  desc: string;
  // Colors — light variants
  accent: string;
  glow: string;
  bubble: string;
  border: string;
  bg: string;
  tagBg: string;
  // CTA button gradient
  ctaFrom: string;
  ctaTo: string;
  ctaShadow: string;
  // Voice
  voiceFile?: string;
  // Interview positions available for this persona
  interviewPositions?: { id: string; label: string; labelDe: string }[];
  // Mock replies
  replies: readonly string[];
}

export const PERSONA_TOKENS: Record<PersonaId, PersonaToken> = {
  lukas: {
    id: "lukas",
    name: "Lukas",
    role: "Senior Tech Mentor",
    tag: "Backend Dev · Berlin",
    desc: "Erklärt Grammatik wie sauberen Code. Strukturiert, logisch, präzise.",
    voiceFile: "lukas.wav",
    accent: "#2D9CDB",
    glow: "rgba(45,156,219,0.4)",
    bubble: "#1A3A52",
    border: "rgba(45,156,219,0.25)",
    bg: "rgba(45,156,219,0.08)",
    tagBg: "rgba(45,156,219,0.15)",
    ctaFrom: "#1A6A9A",
    ctaTo: "#2D9CDB",
    ctaShadow: "0 4px 0 #0E4A6E, 0 8px 24px rgba(45,156,219,0.35)",
    interviewPositions: [
      { id: "frontend_dev", label: "Frontend Developer", labelDe: "Frontend-Entwickler/in" },
      { id: "backend_dev", label: "Backend Developer", labelDe: "Backend-Entwickler/in" },
      { id: "devops", label: "DevOps Engineer", labelDe: "DevOps-Ingenieur/in" },
      { id: "data_analyst", label: "Data Analyst", labelDe: "Datenanalyst/in" },
      { id: "qa_engineer", label: "QA Engineer", labelDe: "Qualitätssicherung" },
    ],
    replies: [
      "Hallo! Als Backend-Engineer erkläre ich dir Grammatik như sauberen Code. Bạn muốn học gì hôm nay? 👋",
      "Rất tốt! Đó hoàn toàn chính xác. Ngữ pháp giống như Clean Code – cấu trúc và chính xác!",
      "Câu hỏi thú vị! Sự khác biệt giữa Dativ và Akkusativ: Dativ trả lời cho 'wem', Akkusativ cho 'wen'. Hãy tưởng tượng Dativ như người nhận!",
      "Chú ý! Phát hiện bug trong ngữ pháp của bạn! Hãy viết: 'Ich gehe IN DIE Schule' – Akkusativ khi có chuyển động! 🐛",
      "Tiếp tục nhé! Bạn đang tiến bộ rất nhanh. Thử thách tiếp theo: Genitiv. Bạn muốn thử không?",
      "Hoàn hảo! Đó là hướng tiếp cận đúng. Luôn nhớ bốn cách: Nominativ, Akkusativ, Dativ, Genitiv – giống như Stack Traces! 🚀",
    ],
  },
  emma: {
    id: "emma",
    name: "Emma",
    role: "Berlin Culture Guide",
    tag: "Künstlerin · Neukölln",
    desc: "Bringt dir Deutsch durch Kunst, Kultur und Berliner Flair bei.",
    voiceFile: "emma.wav",
    accent: "#00BFA5",
    glow: "rgba(0,191,165,0.4)",
    bubble: "#0A3832",
    border: "rgba(0,191,165,0.25)",
    bg: "rgba(0,191,165,0.08)",
    tagBg: "rgba(0,191,165,0.15)",
    ctaFrom: "#007A6A",
    ctaTo: "#00BFA5",
    ctaShadow: "0 4px 0 #005A4A, 0 8px 24px rgba(0,191,165,0.35)",
    interviewPositions: [
      { id: "marketing_mgr", label: "Marketing Manager", labelDe: "Marketingleiter/in" },
      { id: "sales_exec", label: "Sales Executive", labelDe: "Vertriebsmitarbeiter/in" },
      { id: "cs_manager", label: "Customer Success Manager", labelDe: "Kundenerfolgsmanager/in" },
      { id: "hr_coordinator", label: "HR Coordinator", labelDe: "Personalkoordinator/in" },
      { id: "project_mgr", label: "Project Manager", labelDe: "Projektmanager/in" },
    ],
    replies: [
      "Hey hey! Mình là Emma! Berlin thật sống động! Hãy cùng khám phá tiếng Đức qua văn hóa và nghệ thuật nhé! 🎨",
      "Tuyệt vời! Bạn học nhanh quá! Mình rất vui! Tiếp tục nào! ✨",
      "Đó là một câu hỏi tuyệt vời! Ở Berlin chúng mình thường nói 'Kiez' cho khu phố của mình. Mỗi khu phố đều có một tâm hồn riêng!",
      "Haha, buồn cười thật! Nhưng hãy cứ tiếp tục học nhé – mắc lỗi là một phần của quá trình mà! 💪",
      "Nhìn kìa! Trong bối cảnh Berlin, chúng ta nghe thấy nhiều từ mượn từ tiếng Anh. Bạn có thể nêu một ví dụ không?",
      "Nghe cứ như một người Berlin bản địa vậy! Mình rất ấn tượng! Tiếp tục nhé, bạn đang làm rất tốt! 🌟",
    ],
  },
  anna: {
    id: "anna",
    name: "Anna",
    role: "Everyday Life Guide",
    tag: "Sprachlehrerin · Hamburg",
    desc: "Begleitet dich durch den deutschen Alltag – warm, geduldig und praktisch.",
    voiceFile: "anna.mp3",
    accent: "#F5A623",
    glow: "rgba(245,166,35,0.4)",
    bubble: "#3A2A00",
    border: "rgba(245,166,35,0.25)",
    bg: "rgba(245,166,35,0.08)",
    tagBg: "rgba(245,166,35,0.15)",
    ctaFrom: "#C97D00",
    ctaTo: "#F5A623",
    ctaShadow: "0 4px 0 #7A4D00, 0 8px 24px rgba(245,166,35,0.35)",
    interviewPositions: [
      { id: "werkstudent", label: "Werkstudent (Working Student)", labelDe: "Werkstudent/in" },
      { id: "praktikant", label: "Praktikant (Intern)", labelDe: "Praktikant/in" },
      { id: "research_asst", label: "Research Assistant", labelDe: "Wissenschaftliche Hilfskraft" },
      { id: "student_coord", label: "Student Coordinator", labelDe: "Studienkoordinator/in" },
      { id: "teaching_asst", label: "Teaching Assistant", labelDe: "Tutor/in" },
    ],
    replies: [
      "Hallo! Ich bin Anna. Ich helfe dir, Deutsch im Alltag zu lernen. Was möchtest du heute üben? 😊",
      "Super gemacht! Du lernst wirklich schnell. Weiter so!",
      "Das ist eine gute Frage! Im Alltag benutzen wir oft die Präposition 'in' mit dem Dativ. Zum Beispiel: 'Ich bin im Supermarkt.'",
      "Kein Problem! Fehler sind wichtig beim Lernen. Lass uns das zusammen üben!",
      "Sehr gut! Denk daran: Beim Einkaufen sagst du 'Ich hätte gern...' für höfliche Anfragen.",
      "Wunderbar! Du klingst schon wie ein Hamburger! Ich bin sehr stolz auf dich! 🌟",
    ],
  },
  klaus: {
    id: "klaus",
    name: "Klaus",
    role: "Culinary Expert",
    tag: "Head Chef · München",
    desc: "Luyện tiếng Đức qua chủ đề ẩm thực, nhà bếp và giao tiếp nhóm hiệu quả.",
    voiceFile: "klaus.mp3",
    accent: "#991B1B",
    glow: "rgba(153,27,27,0.4)",
    bubble: "#450A0A",
    border: "rgba(153,27,27,0.25)",
    bg: "rgba(153,27,27,0.08)",
    tagBg: "rgba(153,27,27,0.15)",
    ctaFrom: "#7F1D1D",
    ctaTo: "#991B1B",
    ctaShadow: "0 4px 0 #450A0A, 0 8px 24px rgba(153,27,27,0.35)",
    interviewPositions: [
      { id: "line_cook", label: "Koch (Line Cook)", labelDe: "Koch/Köchin" },
      { id: "sous_chef", label: "Sous Chef", labelDe: "Sous Chef" },
      { id: "head_chef", label: "Küchenchef (Head Chef)", labelDe: "Küchenchef/in" },
      { id: "servicekraft", label: "Servicekraft (Waiter/Waitress)", labelDe: "Servicekraft" },
      { id: "restaurant_mgr", label: "Restaurantleiter (Restaurant Manager)", labelDe: "Restaurantleiter/in" },
    ],
    replies: [
      "Guten Tag! Tôi là Klaus. Nhà bếp là nơi đòi hỏi sự chính xác và giao tiếp rõ ràng. Sẵn sàng chưa? 👨‍🍳",
      "Rất tốt! Cắt thái gọn gàng và ngữ pháp cũng chuẩn xác. Tiếp tục phát huy!",
      "Chú ý: Trong bếp, chúng ta dùng câu mệnh lệnh (Imperativ) rất nhiều. Ví dụ: 'Schneide das Gemüse!' thay vì 'Du schneidest...'",
      "An toàn vệ sinh thực phẩm (HACCP) rất quan trọng! Bạn biết từ 'vệ sinh' tiếng Đức là gì không?",
      "Hương vị tuyệt hảo! Bạn đang làm rất tốt, giống như một đầu bếp thực thụ vậy! 🍲",
      "Hãy nhớ, làm việc nhóm (Teamarbeit) là chìa khóa thành công. Khi giao việc, hãy dùng cấu trúc 'Könntest du bitte...?' cho lịch sự nhé!",
    ],
  },
};

/** Ordered list for rendering */
export const PERSONA_LIST: PersonaToken[] = [
  PERSONA_TOKENS.lukas,
  PERSONA_TOKENS.emma,
  PERSONA_TOKENS.anna,
  PERSONA_TOKENS.klaus,
];
