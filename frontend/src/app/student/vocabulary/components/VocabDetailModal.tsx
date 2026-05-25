'use client'

import { useEffect, useRef, useState } from 'react'
import { Pause, Play, X, BookOpen, AlignLeft, Star } from 'lucide-react'
import { speakGerman } from '@/lib/speechDe'
import type { VocabCardItem } from './types'

function ExampleHoverSentence({ sentenceDe, meaningVi }: { sentenceDe: string; meaningVi?: string }) {
  const meaning = (meaningVi || '').trim()
  return (
    <div className="relative group">
      <p className="text-slate-700 text-sm leading-relaxed">🇩🇪 {sentenceDe}</p>
      {meaning ? <div className="pointer-events-none absolute left-0 top-full z-10 mt-2 w-full max-w-xl rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 shadow-lg opacity-0 transition-opacity duration-150 group-hover:opacity-100">🇻🇳 {meaning}</div> : null}
    </div>
  )
}

function DetailSection({ title, icon, accent, children }: { title: string; icon: React.ReactNode; accent: string; children: React.ReactNode }) {
  return (
    <div className="px-6 py-5 border-b border-slate-200/80 last:border-b-0">
      <div className="flex items-center gap-2 mb-3">
        <span className="flex items-center justify-center w-7 h-7 rounded-lg" style={{ background: `${accent}15`, color: accent }}>{icon}</span>
        <h3 className="text-sm font-bold uppercase tracking-widest" style={{ color: accent }}>{title}</h3>
      </div>
      {children}
    </div>
  )
}

export default function VocabDetailModal({ item, onClose, closing }: { item: VocabCardItem; onClose: () => void; closing: boolean }) {
  const [isPlaying, setIsPlaying] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (intervalRef.current) clearTimeout(intervalRef.current) }, [])

  const togglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false)
      if (intervalRef.current) clearTimeout(intervalRef.current)
      intervalRef.current = null
      return
    }
    setIsPlaying(true)
    speakGerman(`${item.article} ${item.word}`.trim())
    intervalRef.current = setTimeout(() => setIsPlaying(false), 1800)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      <div className={`absolute inset-0 bg-slate-950/60 backdrop-blur-sm ${closing ? 'df-overlay-exit' : 'df-overlay-enter'}`} onClick={onClose} />
      <div className={`relative w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl bg-white shadow-2xl border border-slate-200 ${closing ? 'df-modal-exit' : 'df-modal-enter'}`}>
        <div className="relative px-6 py-6 rounded-t-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950">
          {item.imageUrl ? (
            <div className="mb-4 rounded-2xl overflow-hidden border border-white/10 max-h-48">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.imageUrl}
                alt=""
                className="w-full h-48 object-cover"
                onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = 'none' }}
              />
            </div>
          ) : null}
          <button type="button" onClick={onClose} className="absolute top-4 right-4 w-9 h-9 rounded-full border border-white/15 bg-white/10 text-white flex items-center justify-center hover:bg-white/15 transition-colors"><X size={16} /></button>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white/80 text-xs font-semibold mb-4">
            {item.category}
          </div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight">{item.word}</h2>
          <p className="text-white/70 text-sm mt-1">{item.english}</p>
          <div className="mt-5 rounded-2xl border border-white/10 bg-white/8 p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] uppercase tracking-[0.22em] text-white/60">Aussprache</p>
              <p className="text-xs text-white/50 font-mono">{item.phonetic}</p>
            </div>
            <button type="button" className="mt-2 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FFCD00] text-[#121212] font-bold text-sm shadow-sm hover:brightness-95 transition-colors" onClick={togglePlay}>{isPlaying ? <Pause size={14} /> : <Play size={14} />} {isPlaying ? 'Pause' : 'Abspielen'}</button>
          </div>
        </div>
        <DetailSection title="Bedeutung" icon={<BookOpen size={16} />} accent="#0f172a">
          <p className="text-sm text-slate-700 leading-relaxed">{item.meaning}</p>
        </DetailSection>
        {item.exampleDE ? <DetailSection title="Beispielsatz" icon={<AlignLeft size={16} />} accent="#b45309"><div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><ExampleHoverSentence sentenceDe={item.exampleDE} meaningVi={item.exampleTranslation} /></div></DetailSection> : null}
        <DetailSection title="Grammatikdetails" icon={<Star size={16} />} accent="#7c3aed">
          <p className="text-sm text-slate-600 leading-relaxed">{item.usageNote}</p>
        </DetailSection>
      </div>
    </div>
  )
}
