import api from '@/lib/api'

export type VocabularyImageReviewItem = {
  unsplashId: string
  thumbUrl: string
  regularUrl: string
  fullUrl: string
  altText?: string | null
  description?: string | null
  photographerName?: string | null
  pageUrl?: string | null
  queryUsed: string
}

export type VocabularyImageReviewResponse = {
  wordId: number
  baseForm: string
  meaning: string
  dtype: string
  queryUsed: string
  suggestions: VocabularyImageReviewItem[]
}

export async function fetchVocabularyImageReview(wordId: number, limit = 8) {
  const res = await api.get(`/api/v2/admin/vocabulary/images/review/${wordId}`, {
    params: { limit },
  })
  return res.data as VocabularyImageReviewResponse
}

export async function approveVocabularyImageReview(
  wordId: number,
  payload: { unsplashId: string; decision: 'APPROVE'; personaStyle?: string; imageUrl?: string },
) {
  const res = await api.post(`/api/v2/admin/vocabulary/images/review/${wordId}/approve`, payload)
  return res.data
}
