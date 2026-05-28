'use client'

import { ChevronDown } from 'lucide-react'
import { useState } from 'react'

export type LearningStatus = 'all' | 'new' | 'due' | 'mastered'
export type WordType = '' | 'NOUN' | 'VERB' | 'ADJECTIVE' | 'PHRASE'

type VocabularyFilterProps = {
  cefr: string
  onCefrChange: (v: string) => void
  wordType: WordType
  onWordTypeChange: (v: WordType) => void
  learningStatus: LearningStatus
  onLearningStatusChange: (v: LearningStatus) => void
  totalCount: number
}

const CEFR_LEVELS = ['', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const

const STATUS_OPTIONS: { value: LearningStatus; label: string; color: string }[] = [
  { value: 'all', label: 'Alle', color: 'text-slate-600 bg-slate-100' },
  { value: 'new', label: 'Neu', color: 'text-blue-700 bg-blue-50' },
  { value: 'due', label: 'Fällig', color: 'text-amber-700 bg-amber-50' },
  { value: 'mastered', label: 'Gelernt', color: 'text-emerald-700 bg-emerald-50' },
]

const WORD_TYPE_OPTIONS: { value: WordType; label: string }[] = [
  { value: '', label: 'Alle Typen' },
  { value: 'NOUN', label: 'Nomen' },
  { value: 'VERB', label: 'Verben' },
  { value: 'ADJECTIVE', label: 'Adjektive' },
  { value: 'PHRASE', label: 'Phrasen' },
]

export default function VocabularyFilter({
  cefr, onCefrChange,
  wordType, onWordTypeChange,
  learningStatus, onLearningStatusChange,
  totalCount,
}: VocabularyFilterProps) {
  const [showAdvanced, setShowAdvanced] = useState(false)

  return (
    <div className="bg-white border-b border-slate-200 px-5 py-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          {STATUS_OPTIONS.map(({ value, label, color }) => (
            <button key={value} type="button"
              onClick={() => onLearningStatusChange(value)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                learningStatus === value
                  ? color + ' ring-2 ring-offset-1 ring-current'
                  : 'text-slate-500 bg-slate-50 hover:bg-slate-100'
              }`}>
              {label}
            </button>
          ))}
        </div>
        <button type="button"
          onClick={() => setShowAdvanced((s) => !s)}
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors">
          Filter
          <ChevronDown size={13} className={`transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {showAdvanced ? (
        <div className="pt-1 border-t border-slate-100 flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Niveau</span>
            <div className="flex gap-1">
              {CEFR_LEVELS.map((level) => (
                <button key={level} type="button"
                  onClick={() => onCefrChange(level)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                    cefr === level
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}>
                  {level || 'Alle'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Typ</span>
            <div className="flex gap-1">
              {WORD_TYPE_OPTIONS.map(({ value, label }) => (
                <button key={value} type="button"
                  onClick={() => onWordTypeChange(value)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                    wordType === value
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <span className="ml-auto text-[11px] text-slate-400">{totalCount.toLocaleString()} Wörter</span>
        </div>
      ) : null}
    </div>
  )
}
