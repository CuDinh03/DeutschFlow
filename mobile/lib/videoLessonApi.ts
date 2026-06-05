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

/** Mirrors backend `RenderStatusDto`. status: PENDING | PROCESSING | COMPLETED | FAILED */
export interface RenderStatus {
  status: string
  videoUrl: string | null
  error: string | null
}

export const videoLessonApi = {
  /** Vocab video timeline for a CEFR level (image + German narration + captions per scene). */
  getVocabTimeline: (level: string, limit = 8) =>
    api
      .get<VideoTimeline>(`/video-lessons/vocab?level=${encodeURIComponent(level)}&limit=${limit}`)
      .then((r) => r.data),

  /** Phase B — start an async .mp4 render; returns the jobId to poll. */
  startVocabRender: (level: string, limit = 8) =>
    api
      .post<{ jobId: string }>(`/video-lessons/vocab/render?level=${encodeURIComponent(level)}&limit=${limit}`)
      .then((r) => r.data.jobId),

  /** Poll a render job's status / final video URL. */
  getRenderStatus: (jobId: string) =>
    api.get<RenderStatus>(`/video-lessons/render/${jobId}`).then((r) => r.data),
}
