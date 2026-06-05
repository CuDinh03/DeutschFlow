'use client'

import { useState } from 'react'
import { Search, Loader2, Check } from 'lucide-react'
import api, { apiMessage } from '@/lib/api'

// Mirrors backend UnsplashImageService.UnsplashImageResult
type UnsplashResult = {
  id: string
  altText?: string | null
  description?: string | null
  thumbUrl: string
  regularUrl: string
  fullUrl: string
  photographerName?: string | null
  pageUrl?: string | null
}

/**
 * Interactive Unsplash search + pick. Picking a photo downloads it to S3 on the
 * server and sets it as the word's image, then calls onAttached with the S3 URL.
 */
export default function UnsplashPicker({
  wordId,
  baseForm,
  onAttached,
}: {
  wordId: number
  baseForm: string
  onAttached: (s3Url: string) => void
}) {
  const [q, setQ] = useState(baseForm)
  const [results, setResults] = useState<UnsplashResult[]>([])
  const [loading, setLoading] = useState(false)
  const [attachingId, setAttachingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const search = async () => {
    const query = q.trim()
    if (!query) return
    setLoading(true)
    setError('')
    try {
      const r = await api.get<UnsplashResult[]>('/v2/admin/vocabulary/images/unsplash/search', {
        params: { q: query, perPage: 12 },
      })
      setResults(r.data ?? [])
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      setLoading(false)
    }
  }

  const attach = async (img: UnsplashResult) => {
    setAttachingId(img.id)
    setError('')
    try {
      const r = await api.post<{ imageUrl: string }>(
        `/v2/admin/vocabulary/images/${wordId}/unsplash`,
        { baseForm, imageUrl: img.regularUrl },
      )
      onAttached(r.data.imageUrl)
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      setAttachingId(null)
    }
  }

  return (
    <div className="mt-3 rounded-[12px] border border-[#E2E8F0] bg-[#F8FAFC] p-3">
      <div className="flex items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void search()
          }}
          placeholder="Từ khoá tìm ảnh trên Unsplash…"
          className="flex-1 px-3 py-2 rounded-[8px] border border-[#E2E8F0] text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#121212]/20 bg-white"
        />
        <button
          type="button"
          onClick={() => void search()}
          disabled={loading || !q.trim()}
          className="flex items-center gap-1.5 px-3 py-2 rounded-[8px] bg-[#121212] text-white text-sm font-semibold disabled:opacity-60"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          Tìm
        </button>
      </div>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      {results.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {results.map((img) => {
            const busy = attachingId === img.id
            return (
              <button
                key={img.id}
                type="button"
                onClick={() => void attach(img)}
                disabled={attachingId !== null}
                title={img.photographerName ? `© ${img.photographerName} · Unsplash` : 'Unsplash'}
                className="relative aspect-[4/3] rounded-[8px] overflow-hidden border border-[#E2E8F0] group disabled:opacity-60"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.thumbUrl} alt={img.altText ?? 'Unsplash'} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                  {busy ? (
                    <Loader2 size={18} className="text-white animate-spin" />
                  ) : (
                    <Check size={18} className="text-white opacity-0 group-hover:opacity-100" />
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}

      <p className="mt-2 text-[10px] text-[#94A3B8]">Ảnh được tải về và lưu trên hệ thống (S3), không hotlink.</p>
    </div>
  )
}
