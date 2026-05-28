'use client'

import { useState } from 'react'
import { Volume2 } from 'lucide-react'

// Shape produced by vocabularyApi.getA1Words()
export interface Word {
  id: number
  word: string
  translation: string
  audioUrl: string
  pronunciation_ipa: string
  example_sentence: string
  article?: string
  image_url?: string
}

// ─── Gender color tokens (mirrors GENDER_STYLE in types.ts) ─────────────────

const ARTICLE_STYLE: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  der: { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE', dot: '#3B82F6' },
  die: { bg: '#FFF1F2', text: '#BE123C', border: '#FECDD3', dot: '#F43F5E' },
  das: { bg: '#F0FDF4', text: '#166534', border: '#BBF7D0', dot: '#10B981' },
}

const DEFAULT_STYLE = { bg: '#F1F5F9', text: '#475569', border: '#E2E8F0', dot: '#94A3B8' }

// ─── Component ────────────────────────────────────────────────────────────────

interface VocabularyCardProps {
  word: Word
}

export default function VocabularyCard({ word }: VocabularyCardProps) {
  const [hovered, setHovered] = useState(false)
  const [playing, setPlaying] = useState(false)

  const style = word.article ? (ARTICLE_STYLE[word.article.toLowerCase()] ?? DEFAULT_STYLE) : DEFAULT_STYLE

  const handleAudio = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!word.audioUrl || playing) return
    setPlaying(true)
    const audio = new Audio(word.audioUrl)
    audio.onended = () => setPlaying(false)
    audio.onerror = () => setPlaying(false)
    audio.play().catch(() => setPlaying(false))
  }

  return (
    <div
      className="relative overflow-hidden text-left bg-white rounded-2xl border-2 transition-all duration-200 ease-out hover:-translate-y-[3px] hover:shadow-xl"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderColor: hovered ? '#CBD5E1' : '#E2E8F0',
        boxShadow: hovered
          ? '0 12px 30px rgba(0,48,94,0.16)'
          : '0 3px 10px rgba(0,48,94,0.06)',
      }}
    >
      {/* Hover accent bar */}
      <div
        className="absolute top-0 left-0 right-0 h-1 transition-opacity duration-200"
        style={{
          opacity: hovered ? 1 : 0,
          background: `linear-gradient(90deg, ${style.dot} 0%, #2B6CB0 100%)`,
        }}
      />

      {/* Image */}
      {word.image_url ? (
        <div className="mx-4 mt-4 rounded-xl overflow-hidden border border-[#E2E8F0] bg-[#F8FAFC] h-28">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={word.image_url}
            alt=""
            className="w-full h-full object-cover"
            onError={(e) => {
              const el = (e.target as HTMLImageElement).parentElement
              if (el) el.style.display = 'none'
            }}
          />
        </div>
      ) : null}

      {/* Header row: article chip + A1 badge + audio */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {word.article ? (
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border"
              style={{ background: style.bg, color: style.text, borderColor: style.border }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: style.dot }} />
              {word.article}
            </span>
          ) : null}
          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-[#F0FDF4] text-[#166534]">
            A1
          </span>
        </div>

        {word.audioUrl ? (
          <button
            type="button"
            aria-label={`Nghe phát âm "${word.word}"`}
            onClick={handleAudio}
            disabled={playing}
            className="p-1.5 rounded-lg hover:bg-[#F4F7FA] disabled:opacity-50 transition-colors"
          >
            <Volume2
              size={15}
              className={playing ? 'text-blue-500 animate-pulse' : 'text-[#94A3B8]'}
            />
          </button>
        ) : null}
      </div>

      {/* Word + IPA */}
      <div className="px-4 pb-3">
        <h3 className="font-extrabold text-xl text-[#121212] tracking-tight leading-none">
          {word.word}
        </h3>
        {word.pronunciation_ipa ? (
          <p className="text-[11px] text-[#94A3B8] font-mono mt-0.5">/{word.pronunciation_ipa}/</p>
        ) : null}
      </div>

      <div className="mx-4 h-px bg-[#EEF2F6]" />

      {/* Translation */}
      <div className="px-4 py-3">
        <p className="text-sm font-semibold text-[#334155]">{word.translation}</p>
        {word.example_sentence ? (
          <p className="text-xs text-[#94A3B8] mt-1.5 italic line-clamp-2">
            {word.example_sentence}
          </p>
        ) : null}
      </div>
    </div>
  )
}
