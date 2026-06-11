import api from '@/lib/api'

/** POST /api/v2/teacher/grading/grade-image — result of OCR + AI grading a handwriting photo. */
export interface GradeImageResult {
  /** German text transcribed from the photo (teacher should review before finalizing). */
  transcription: string
  score: number
  feedback: string
}

/**
 * Grade a photo of a handwritten German essay: image → Gemini OCR → AI grade.
 * `topic` is optional context for the grader.
 */
export async function gradeHandwritingImage(file: File, topic?: string): Promise<GradeImageResult> {
  const formData = new FormData()
  formData.append('file', file)
  if (topic && topic.trim()) formData.append('topic', topic.trim())

  const res = await api.post<GradeImageResult>('/v2/teacher/grading/grade-image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data
}
