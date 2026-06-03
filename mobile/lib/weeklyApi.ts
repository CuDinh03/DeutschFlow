// Weekly Speaking challenge: submit + review. Rubric shape mirrors the backend
// WeeklyRubricView (nested under task_completion / fluency / lexis / grammar).

import api from './api'

export interface WeeklyReplacement {
  from_de: string
  to_de_suggestion: string
  note_vi: string
}

export interface WeeklyGrammarError {
  error_code: string
  severity: string
  confidence: number | null
  wrong_span: string
  corrected_span: string
  rule_vi_short: string
}

export interface WeeklyRubric {
  task_completion?: { score_1_to_5: number; off_topic?: boolean } | null
  fluency?: { subjective_notes_de?: string; wpm_approx?: number | null; confidence_label?: string } | null
  lexis?: { richness_notes_de?: string[]; replacements_suggested_de_vi?: WeeklyReplacement[] } | null
  grammar?: { summary_de?: string; errors?: WeeklyGrammarError[] } | null
  feedback_vi_summary?: string | null
  disclaimer_vi?: string | null
}

export interface WeeklySubmitResponse {
  submissionId: number
  promptId: number
  rubric: WeeklyRubric | null
  mergedIntoWeeklyReport?: boolean
}

export interface WeeklySubmissionDetail {
  id: number
  promptId: number
  weekStartDate: string
  promptTitle: string
  promptDe: string
  cefrBand: string
  createdAt: string
  transcript: string
  rubricOrNull: WeeklyRubric | null
}

export const weeklyApi = {
  submit: (promptId: number, transcript: string, cefrBand: string) =>
    api
      .post<WeeklySubmitResponse>('/ai-speaking/weekly/submissions', { promptId, transcript, cefrBand })
      .then((r) => r.data),

  getSubmission: (id: number | string) =>
    api
      .get<WeeklySubmissionDetail>(`/ai-speaking/weekly/me/submissions/${id}`)
      .then((r) => r.data),
}

/** Pull the 1–5 task score + summary out of a rubric, handling nulls. */
export function rubricScore(rubric: WeeklyRubric | null | undefined): number | null {
  return rubric?.task_completion?.score_1_to_5 ?? null
}
