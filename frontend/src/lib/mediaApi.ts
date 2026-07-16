import api from '@/lib/api'

export type MediaAsset = {
  id: number
  url: string
  category: string
  originalName: string
  s3Key: string
  fileSize: number
  scope?: string | null
  source?: string | null
  style?: string | null
  tag?: string | null
  altText?: string | null
}

export type MediaPageResponse = {
  content: MediaAsset[]
  totalPages: number
}

export async function listMediaByCategory(category: string) {
  const res = await api.get('/v2/media', { params: { category, size: 100 } })
  return res.data
}

export async function listMedia(category: string, page = 0, size = 16): Promise<MediaPageResponse> {
  const params: Record<string, string | number> = { page, size }
  if (category && category !== 'ALL') params.category = category

  const res = await api.get('/v2/media', { params })
  return res.data
}

export async function getMediaByTag(category: string, tag: string): Promise<MediaAsset | null> {
  const res = await api.get('/v2/media/by-tag', { params: { category, tag } })
  return res.data ?? null
}

export async function uploadMedia(
  file: File,
  category = 'GENERAL',
  tag?: string,
  altText?: string,
): Promise<MediaAsset> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('category', category)
  if (tag) formData.append('tag', tag)
  if (altText) formData.append('altText', altText)

  const res = await api.post('/v2/media/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data as MediaAsset
}

// Xoá/sửa metadata đi qua MediaController (/api/v2/media/{id}) — KHÔNG có route /v2/admin/media/*
// nào ở backend (đường cũ luôn 404). Quyền do MediaAssetAccessPolicy quyết định: ADMIN toàn quyền,
// TEACHER chỉ thao tác được trên ảnh do chính mình upload và không thuộc category admin-only.
export async function deleteMedia(id: number) {
  return api.delete(`/v2/media/${id}`)
}

// Gửi chuỗi RỖNG (không phải null) khi người dùng xoá trắng ô: MediaAssetService.updateMediaMetadata
// bỏ qua field `null` (`if (altText != null)`), nên gửi null = "không đổi" → xoá tag/alt text sẽ im
// lặng không có tác dụng dù toast báo thành công. Chuỗi rỗng mới là tín hiệu "xoá" mà backend hiểu
// (tag "" → null, altText "" → "").
export async function updateMediaMetadata(id: number, altText: string, tag: string) {
  const res = await api.patch(`/v2/media/${id}`, { altText, tag })
  return res.data as MediaAsset
}

export async function overrideWordImage(wordId: number, imageUrl: string, imageStyle?: string | null) {
  return api.post(`/v2/admin/vocabulary/images/${wordId}/override`, {
    imageUrl,
    imageStyle: imageStyle ?? null,
  })
}

export async function previewVocabularyImageBatch(
  limit = 20,
  personaStyle = 'DEFAULT',
  cefr?: string,
  dtype?: string,
  tag?: string,
) {
  const params: Record<string, string | number> = { limit, personaStyle }
  if (cefr) params.cefr = cefr
  if (dtype) params.dtype = dtype
  if (tag) params.tag = tag
  const res = await api.post('/v2/admin/vocabulary/images/batch/preview', null, { params })
  return res.data
}

export type WordInfo = {
  id: number
  base_form: string
  cefr_level: string
  dtype: string
  image_url: string | null
}

export async function getVocabWordInfo(ids: number[]): Promise<WordInfo[]> {
  if (!ids.length) return []
  const res = await api.get('/v2/admin/vocabulary/images/batch/word-info', { params: { ids: ids.join(',') } })
  return res.data as WordInfo[]
}

export async function generateVocabularyImageBatch(
  limit = 20,
  personaStyle = 'DEFAULT',
  cefr?: string,
  dtype?: string,
  tag?: string,
  approvedWordIds?: number[],
) {
  const params: Record<string, string | number> = { limit, personaStyle }
  if (cefr) params.cefr = cefr
  if (dtype) params.dtype = dtype
  if (tag) params.tag = tag
  const payload = approvedWordIds && approvedWordIds.length > 0 ? { limit, personaStyle, cefr, dtype, tag, approvedWordIds } : null
  const res = await api.post('/v2/admin/vocabulary/images/batch/generate', payload, { params })
  return res.data
}
