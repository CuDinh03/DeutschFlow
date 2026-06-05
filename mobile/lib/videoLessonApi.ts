import api from './api'

/** Mirrors backend `VideoSceneDto`. */
export interface VideoScene {
  seq: number
  wordId: number
  germanWord: string
  translation: string
  exampleDe: string
  imageUrl: string
  /** S3 URL of German narration, or null when TTS is unavailable (player paces by durationMs). */
  narrationAudioUrl: string | null
  captionDe: string
  captionVi: string
  durationMs: number
  transition: string
}

/** Mirrors backend `VideoTimelineDto`. */
export interface VideoTimeline {
  type: string
  level: string
  persona: string
  totalScenes: number
  scenes: VideoScene[]
}

export const videoLessonApi = {
  /** Vocab video timeline for a CEFR level (image + German narration + captions per scene). */
  getVocabTimeline: (level: string, limit = 8) =>
    api
      .get<VideoTimeline>(`/video-lessons/vocab?level=${encodeURIComponent(level)}&limit=${limit}`)
      .then((r) => r.data),
}
