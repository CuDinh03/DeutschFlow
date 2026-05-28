import api from "@/lib/api";

export interface InterviewPersonaInfo {
  code: string;
  label: string;
  industry: string;
  roleTitle: string;
  tone: string;
  difficulty: number;
  questionStyle: string;
  evaluationBias: string;
  version: number;
}

export interface InterviewTurnInfo {
  turnIndex: number;
  phase: string;
  questionText: string;
  userAnswer: string;
  aiFollowUp: string;
  directiveType: string;
  latencyMs: number | null;
  createdAt: string;
}

export interface InterviewPhaseResultInfo {
  id: number;
  sessionId: number;
  phase: string;
  score: number;
  rubricTemplateId: number | null;
  strengthsJson: string;
  weaknessesJson: string;
}

export interface InterviewReport {
  sessionId: number;
  position: string;
  experienceLevel: string;
  overallScore: number;
  verdict: "PASS" | "CONDITIONAL_PASS" | "NOT_PASS";
  readinessLevel: string;
  strongAreas: string[];
  criticalGaps: string[];
  recommendedDrills: string[];
  phaseResults: Array<{ phase: string; score: number; strengths: string[]; weaknesses: string[] }>;
}

export interface PhaseDropOff {
  phase: string;
  sessionsReached: number;
  reachRate: number;
}

export interface InterviewAnalytics {
  totalSessions: number;
  completedSessions: number;
  completionRate: number;
  sessionsByIndustry: Record<string, number>;
  sessionsByPersona: Record<string, number>;
  avgScoreByIndustry: Record<string, number>;
  phaseDropOff: PhaseDropOff[];
  variantDistribution: Record<string, number>;
  avgScoreByVariant: Record<string, number>;
}

export const interviewDomainApi = {
  listPersonas: () =>
    api.get<InterviewPersonaInfo[]>("/interviews/personas").then((r) => r.data),

  getTurns: (sessionId: number) =>
    api.get<InterviewTurnInfo[]>(`/interviews/${sessionId}/turns`).then((r) => r.data),

  getPhaseResults: (sessionId: number) =>
    api.get<InterviewPhaseResultInfo[]>(`/interviews/${sessionId}/phase-results`).then((r) => r.data),

  getReport: (sessionId: number) =>
    api.get<InterviewReport>(`/interviews/${sessionId}/report`).then((r) => r.data),

  getAnalytics: () =>
    api.get<InterviewAnalytics>("/interviews/analytics").then((r) => r.data),
};

export const interviewAdminApi = {
  listAllPersonas: () =>
    api.get<InterviewPersonaInfo[]>("/admin/interviews/personas").then((r) => r.data),

  togglePersona: (code: string) =>
    api.patch<InterviewPersonaInfo>(`/admin/interviews/personas/${code}/toggle`).then((r) => r.data),

  listRubrics: () =>
    api.get("/admin/interviews/rubrics").then((r) => r.data),

  updateRubric: (id: number, body: { criteriaJson?: string; weightJson?: string }) =>
    api.put(`/admin/interviews/rubrics/${id}`, body).then((r) => r.data),
};
