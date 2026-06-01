// Sample payloads for the shared MVP core (checklist §1 "Add sample payload
// fixtures for frontend and mobile development"). Field names mirror the
// backend DTOs exactly, so these double as a contract reference and as seed
// data for UI development / QA without a live backend.

import type {
  InterviewPersona,
  AiChatResponse,
  AiSpeakingSession,
  InterviewReport,
} from './speakingApi'

export const samplePersonas: InterviewPersona[] = [
  {
    code: 'LUKAS',
    label: 'Lukas — HR Manager',
    industry: 'IT',
    roleTitle: 'Junior Backend Developer',
    tone: 'friendly',
    difficulty: 'BEGINNER',
    questionStyle: 'supportive',
    evaluationBias: 'lenient',
    version: 1,
  },
  {
    code: 'WEBER',
    label: 'Frau Weber — Pflegedienstleitung',
    industry: 'Pflege',
    roleTitle: 'Pflegefachkraft',
    tone: 'professional',
    difficulty: 'INTERMEDIATE',
    questionStyle: 'scenario',
    evaluationBias: 'balanced',
    version: 1,
  },
  {
    code: 'SCHNEIDER',
    label: 'Dr. Schneider — Abteilungsleiter',
    industry: 'Technik',
    roleTitle: 'Senior Engineer',
    tone: 'demanding',
    difficulty: 'ADVANCED',
    questionStyle: 'pressure',
    evaluationBias: 'strict',
    version: 1,
  },
]

export const sampleChatResponse: AiChatResponse = {
  messageId: 1024,
  sessionId: 42,
  aiSpeechDe: 'Schön! Können Sie mir mehr über Ihre bisherige Erfahrung erzählen?',
  correction: 'Ich habe Erfahrung *mit* Java (nicht "in Java").',
  explanationVi: 'Dùng giới từ "mit" khi nói về kinh nghiệm với một công cụ.',
  grammarPoint: 'Präposition: Erfahrung mit + Dativ',
  feedback: 'Câu trả lời rõ ràng, hãy bổ sung ví dụ cụ thể.',
  similarityScore: 0.82,
  suggestions: [
    {
      germanText: 'Ich habe zwei Jahre Erfahrung mit Spring Boot.',
      vietnameseTranslation: 'Tôi có hai năm kinh nghiệm với Spring Boot.',
      level: 'B1',
      whyToUse: 'Nêu mốc thời gian cụ thể tạo ấn tượng tốt.',
      usageContext: 'interview',
      legoStructure: 'Subjekt + haben + Zeitangabe + Erfahrung mit + Dativ',
    },
  ],
  action: 'Erzählen Sie von einem konkreten Projekt.',
  isSessionEnded: false,
  interviewPhaseKey: 'HARD_SKILLS',
  interviewHintKey: 'use_concrete_example',
}

export const sampleSession: AiSpeakingSession = {
  id: 42,
  topic: 'Junior Backend Developer',
  cefrLevel: 'C1',
  persona: 'LUKAS',
  responseSchema: 'V1',
  sessionMode: 'INTERVIEW',
  status: 'ACTIVE',
  messageCount: 1,
  initialAiMessage: {
    aiSpeechDe: 'Guten Tag! Stellen Sie sich bitte kurz vor.',
    interviewPhaseKey: 'INTRO',
  },
  interviewPosition: 'Junior Backend Developer',
  experienceLevel: '0-6M',
  interviewReportJson: null,
}

export const sampleReport: InterviewReport = {
  sessionId: 42,
  position: 'Junior Backend Developer',
  experienceLevel: '0-6M',
  overallScore: 74,
  verdict: 'CONDITIONAL_PASS',
  readinessLevel: 'B1',
  strongAreas: ['Giới thiệu bản thân rõ ràng', 'Từ vựng chuyên ngành IT tốt'],
  criticalGaps: ['Cấu trúc câu phức còn lỗi', 'Thiếu ví dụ cụ thể trong STAR'],
  recommendedDrills: ['Luyện câu với "weil/dass"', 'Mô tả 1 dự án theo cấu trúc STAR'],
  phaseResults: [
    { phase: 'INTRO', score: 85, strengths: ['Trôi chảy'], weaknesses: [] },
    { phase: 'HARD_SKILLS', score: 70, strengths: ['Thuật ngữ tốt'], weaknesses: ['Câu phức'] },
    { phase: 'STAR_SOFT', score: 66, strengths: [], weaknesses: ['Thiếu ví dụ'] },
  ],
}
