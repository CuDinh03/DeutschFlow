import api from '@/lib/api'

/** GET /api/ai-speaking/weekly/current-prompt */
export interface WeeklyPromptResponse {
  id: number
  weekStartDate: string
  cefrBand: string
  title: string
  promptDe: string
  mandatoryPoints: string[]
  optionalPoints: string[]
  promptVersion: string
}

export interface WeeklyGrammarErrorHint {
  error_code: string
  severity: string
  confidence: number | null
  wrong_span: string | null
  corrected_span: string | null
  rule_vi_short: string | null
}

/** Rubric subtree uses snake_case in JSON from the backend */
export interface WeeklyRubricView {
  task_completion: {
    score_1_to_5: number
    covered_mandatory_indices: number[]
    missing_mandatory_indices: number[]
    off_topic: boolean
    ambiguous: boolean
  }
  fluency: {
    subjective_notes_de: string
    filler_approx_count: number
    wpm_approx: number | null
    confidence_label: string
  }
  lexis: {
    richness_notes_de: string[]
    replacements_suggested_de_vi: { from_de: string; to_de_suggestion: string; note_vi: string }[]
  }
  grammar: {
    summary_de: string
    errors: WeeklyGrammarErrorHint[]
  }
  feedback_vi_summary: string
  disclaimer_vi: string
}

export interface WeeklySubmissionResponse {
  submissionId: number
  promptId: number
  rubric: WeeklyRubricView
  mergedIntoWeeklyReport: boolean
}

export interface WeeklySubmissionRequest {
  promptId: number
  transcript: string
  audioDurationSec?: number | null
  cefrBand?: string | null
}

export interface WeeklySubmissionListItem {
  id: number
  promptId: number
  weekStartDate: string
  promptTitle: string
  cefrBand: string
  createdAt: string
  taskScoreOrNull: number | null
  feedbackViSummaryPreviewOrNull: string | null
}

export interface WeeklySubmissionDetailDto {
  id: number
  promptId: number
  weekStartDate: string
  promptTitle: string
  promptDe: string
  cefrBand: string
  createdAt: string
  transcript: string
  rubricOrNull: WeeklyRubricView | null
  rubricPayloadRawOrNull: string | null
}

export interface PageWeeklySubmissions {
  content: WeeklySubmissionListItem[]
  totalElements: number
  totalPages: number
  number: number
  size: number
}

export const weeklySpeakingApi = {
  getCurrentPrompt: (cefrBand?: string | null) =>
    api.get<WeeklyPromptResponse>('/ai-speaking/weekly/current-prompt', {
      params: cefrBand ? { cefrBand } : {},
    }),

  submit: (body: WeeklySubmissionRequest) =>
    api.post<WeeklySubmissionResponse>('/ai-speaking/weekly/submissions', body),

  listMySubmissions: (page = 0, size = 15) =>
    api.get<PageWeeklySubmissions>('/ai-speaking/weekly/me/submissions', { params: { page, size } }),

  getMySubmission: (id: number) =>
    api.get<WeeklySubmissionDetailDto>(`/ai-speaking/weekly/me/submissions/${id}`),
}

