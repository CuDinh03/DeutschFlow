import api from '@/lib/api'
import { MediaAsset } from '@/lib/mediaApi'

export type AiImageGenerateRequest = {
  prompt: string
  preset: string
  style: string
  size: string
  count: number
  mode: 'preview' | 'final'
}

export type AiImageGenerateResponse = {
  provider: string
  finalPrompt: string
  assets: MediaAsset[]
}

export async function generateAiImages(payload: AiImageGenerateRequest) {
  const res = await api.post('/v2/ai-images/generate', payload)
  return res.data as AiImageGenerateResponse
}
