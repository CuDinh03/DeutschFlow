'use client'

import { useCallback } from 'react'
import { Play, Pause, Square, Volume2, VolumeX } from 'lucide-react'
import { useGermanTTS, TTSState } from '@/hooks/useGermanTTS'

interface AudioPlayerProps {
  script: string
  label?: string
  /** compact = small inline pill; default = full card */
  compact?: boolean
}

const LABEL: Record<TTSState, string> = {
  idle:        'Nghe audio',
  loading:     'Đang tải giọng...',
  playing:     'Đang phát...',
  paused:      'Tạm dừng',
  done:        'Phát lại',
  unsupported: 'Trình duyệt không hỗ trợ audio',
}

export function AudioPlayer({ script, label, compact = false }: AudioPlayerProps) {
  const { state, progress, speak, pause, resume, stop } = useGermanTTS()

  const handlePrimary = useCallback(() => {
    if (state === 'playing') { pause(); return }
    if (state === 'paused')  { resume(); return }
    speak(script)
  }, [state, pause, resume, speak, script])

  const isActive  = state === 'playing' || state === 'paused'
  const isLoading = state === 'loading'
  const disabled  = state === 'unsupported'

  if (compact) {
    return (
      <div className="flex items-center gap-2 mb-3 bg-sky-50 border border-sky-100 px-3 py-2 rounded-xl w-max">
        <button
          onClick={handlePrimary}
          disabled={disabled || isLoading}
          className="w-7 h-7 rounded-full bg-sky-500 hover:bg-sky-600 disabled:opacity-40 flex items-center justify-center transition-colors"
          aria-label="Phát audio"
        >
          {isLoading
            ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : state === 'playing'
            ? <Pause size={12} className="text-white" />
            : <Play size={12} className="text-white ml-0.5" />}
        </button>
        {isActive && (
          <button onClick={stop} className="text-sky-400 hover:text-sky-600 transition-colors" aria-label="Dừng">
            <Square size={11} />
          </button>
        )}
        <span className="text-xs text-sky-700 font-medium">
          {label ?? LABEL[state]}
        </span>
        {isActive && progress > 0 && (
          <div className="w-16 h-1 bg-sky-200 rounded-full overflow-hidden">
            <div className="h-full bg-sky-500 transition-all" style={{ width: `${progress * 100}%` }} />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="bg-sky-50 border border-sky-100 rounded-2xl p-4 mb-6">
      <div className="flex items-center gap-4">
        {/* Big play button */}
        <button
          onClick={handlePrimary}
          disabled={disabled || isLoading}
          className="w-12 h-12 rounded-full bg-sky-500 hover:bg-sky-600 active:scale-95 disabled:opacity-40 flex items-center justify-center transition-all shadow-md shadow-sky-200 shrink-0"
          aria-label="Phát audio"
        >
          {isLoading
            ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : state === 'playing'
            ? <Pause size={20} className="text-white" />
            : <Play size={20} className="text-white ml-0.5" />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              {disabled
                ? <VolumeX size={14} className="text-slate-400" />
                : <Volume2 size={14} className="text-sky-600" />}
              <span className="text-sm font-semibold text-sky-700">
                {label ?? 'Hörtext — Goethe A1'}
              </span>
            </div>
            {isActive && (
              <button onClick={stop} className="text-xs text-sky-400 hover:text-sky-600 flex items-center gap-1 transition-colors">
                <Square size={11} /> Dừng
              </button>
            )}
          </div>

          {/* Progress bar */}
          <div className="h-1.5 bg-sky-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-sky-500 rounded-full transition-all duration-200"
              style={{ width: `${progress * 100}%` }}
            />
          </div>

          <p className="text-xs text-sky-500 mt-1.5 italic">
            {disabled
              ? 'Trình duyệt không hỗ trợ. Dùng Chrome hoặc Safari.'
              : LABEL[state]}
          </p>
        </div>
      </div>

      {/* Show first sentence as preview */}
      <p className="text-xs text-slate-500 mt-3 pt-3 border-t border-sky-100 line-clamp-2 italic">
        &ldquo;{script.split('.')[0].trim()}.&rdquo;
      </p>
    </div>
  )
}
