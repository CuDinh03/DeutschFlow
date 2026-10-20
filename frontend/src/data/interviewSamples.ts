import type { PersonaId } from '@/lib/personas'

/**
 * Câu hỏi phỏng vấn mẫu hiển thị trên trang chủ (ô "Bạn làm nghề gì?", đợt 1 A+B+E).
 *
 * Mỗi câu chép NGUYÊN VĂN từ ngân hàng câu hỏi mà AI thật sự hỏi trong app —
 * backend `speaking/interview/InterviewQuestionBank.java` (lớp chung `commonQuestions` + lớp riêng
 * theo nhân vật). `{pos}` là chỗ backend ghép tên vị trí; trang chủ thay bằng tên vị trí tiếng Đức.
 *
 * Vì sao không tự viết câu hỏi cho landing: nếu trang chủ hiện câu A mà vào app AI hỏi câu B thì
 * đó lại là một lời hứa sai (xem sổ lời hứa, plans/2026-10-18-quyet-dinh-dinh-huong-abe.md).
 * Test `interviewSamplesParity.test.ts` đọc file Java và đỏ khi một câu ở đây không còn trong bank.
 */

/** Câu mở đầu dùng chung cho MỌI vị trí (`intro_self`, giai đoạn INTRO). */
export const COMMON_INTRO_QUESTION =
  'Bitte stellen Sie sich kurz vor: Werdegang, relevante Erfahrung für {pos}, und Ihr nächster Schritt.'

/** Nhân vật có bộ câu hỏi phỏng vấn riêng (supportsInterview = true trong src/lib/personas.ts). */
export type InterviewPersonaId = Exclude<PersonaId, 'tuan' | 'lan' | 'minh'>

/** Hai câu ở giai đoạn HARD_SKILLS của từng nhân vật, đúng thứ tự trong bank. */
export const INTERVIEW_SAMPLES: Record<InterviewPersonaId, readonly [string, string]> = {
  // techQuestions
  lukas: [
    'Welches technische Projekt für {pos} war Ihr wichtigster Beitrag — Architektur, Ihre Rolle, Trade-off?',
    'Beschreiben Sie einen schweren Produktionsfehler: Ursache, Debugging-Schritte, Fix und Prävention.',
  ],
  // businessQuestions
  emma: [
    'Beschreiben Sie einen Deal oder Kunden, den Sie für {pos} gewonnen haben — KPI und Vorgehen.',
    'Nennen Sie eine schwierige Verhandlung mit messbarem Ergebnis.',
  ],
  // educationQuestions
  anna: [
    'Wie planen Sie Lern- oder Studienziele für {pos} — konkretes Beispiel mit Zeitrahmen.',
    'Wie moderieren Sie Konflikte in einer Gruppe? STAR-Beispiel.',
  ],
  // gastroQuestions
  klaus: [
    'Nennen Sie einen HACCP-/Hygiene-Vorfall in der Küche und Ihre sofortigen Maßnahmen.',
    'Wie organisieren Sie die Station in der Rush Hour für {pos}? Konkretes Beispiel.',
  ],
  // retailFoodQuestions (LENA, THOMAS, PETRA dùng chung)
  lena: [
    'Wie gehen Sie mit einer schwierigen Kundenreklamation um? Konkretes Beispiel für {pos}.',
    'Welche Hygiene- und Qualitätsstandards sind in Ihrem Bereich kritisch — Praxisbeispiel.',
  ],
  thomas: [
    'Wie gehen Sie mit einer schwierigen Kundenreklamation um? Konkretes Beispiel für {pos}.',
    'Welche Hygiene- und Qualitätsstandards sind in Ihrem Bereich kritisch — Praxisbeispiel.',
  ],
  petra: [
    'Wie gehen Sie mit einer schwierigen Kundenreklamation um? Konkretes Beispiel für {pos}.',
    'Welche Hygiene- und Qualitätsstandards sind in Ihrem Bereich kritisch — Praxisbeispiel.',
  ],
  // medicalAssistantQuestions
  sarah: [
    'Wie organisieren Sie Termine und Patientenaufnahme unter Zeitdruck? Ein Beispiel aus der Praxis.',
    'Wie dokumentieren Sie Befunde und Datenschutz im Alltag? Nennen Sie System und einen Ablauf.',
  ],
  // ophthalmologyQuestions
  schneider: [
    'Welche Sehtests führen Sie selbstständig durch, und wie dokumentieren Sie die Werte für {pos}?',
    'Wie beruhigen Sie einen ängstlichen Patienten vor einer Untersuchung? Konkretes Beispiel.',
  ],
  // dermatologyQuestions
  weber: [
    'Wie sprechen Sie mit einem Patienten, der sich wegen sichtbarer Hautveränderungen schämt? Ein konkretes Beispiel.',
    'Wie führen Sie eine Hautanamnese strukturiert durch, bevor der Arzt die Untersuchung übernimmt?',
  ],
  // operationsQuestions (MAX, OLIVER dùng chung)
  max: [
    'Nennen Sie einen Sicherheitsvorfall oder Beinahe-Unfall und Ihre Maßnahmen für {pos}.',
    'Wie führen Sie Wartung oder Störungssuche an einer Maschine durch — konkreter Ablauf.',
  ],
  oliver: [
    'Nennen Sie einen Sicherheitsvorfall oder Beinahe-Unfall und Ihre Maßnahmen für {pos}.',
    'Beschreiben Sie Qualitätskontrolle mit Toleranzen oder Messwerten aus Ihrer Erfahrung.',
  ],
  // serviceQuestions (NIKLAS, NINA dùng chung)
  niklas: [
    'Wie behandeln Sie einen unzufriedenen Gast? STAR-Beispiel für {pos}.',
    'Beschreiben Sie einen Abend mit hohem Gästeaufkommen — Priorisierung und Team.',
  ],
  nina: [
    'Wie behandeln Sie einen unzufriedenen Gast? STAR-Beispiel für {pos}.',
    'Nennen Sie einen Fehler an Kasse/Reservierung und wie Sie ihn korrigiert haben.',
  ],
  // mediaQuestions
  hannie: [
    'Beschreiben Sie eine Live-Situation oder Moderation für {pos} — was lief schief und wie reagierten Sie?',
    'Wie bereiten Sie Skript und Improvisation vor? Konkretes Event.',
  ],
}

/** Thay `{pos}` bằng tên vị trí (tiếng Đức) như backend ghép chuỗi. */
export function fillPosition(question: string, positionDe: string): string {
  return question.split('{pos}').join(positionDe)
}
