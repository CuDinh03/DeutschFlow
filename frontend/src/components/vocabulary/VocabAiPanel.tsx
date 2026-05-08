'use client'

import { useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles, BookOpen, Brain, Link2, BookMarked, Dna,
  HelpCircle, Loader2, ChevronDown, RefreshCw,
  CheckCircle2, XCircle, type LucideIcon,
} from 'lucide-react'
import { vocabAiApi } from '@/lib/vocabAiApi'

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type TabId = 'examples' | 'mnemonic' | 'similar' | 'story' | 'etymology' | 'quiz'

interface TabState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

interface VocabAiPanelProps {
  word: string
  meaning?: string
}

// ─────────────────────────────────────────────
// Tab definitions
// ─────────────────────────────────────────────

const TABS: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: 'examples',  label: 'Ví dụ',    icon: BookOpen   },
  { id: 'mnemonic',  label: 'Cách nhớ', icon: Brain      },
  { id: 'similar',   label: 'Tương tự', icon: Link2      },
  { id: 'story',     label: 'Câu chuyện', icon: BookMarked },
  { id: 'etymology', label: 'Nguồn gốc', icon: Dna       },
  { id: 'quiz',      label: 'Mini Quiz', icon: HelpCircle },
]

// ─────────────────────────────────────────────
// Quiz component
// ─────────────────────────────────────────────

function QuizView({ content, word }: { content: string; word: string }) {
  const [answered, setAnswered] = useState<string | null>(null)

  // Simple parser: look for "Correct: X" in the AI response
  const correctMatch = content.match(/Correct:\s*([A-D])/i)
  const correct = correctMatch ? correctMatch[1].toUpperCase() : null

  return (
    <div className="space-y-4">
      <div className="bg-[#F8FAFF] rounded-xl p-4 border border-[#E2E8F0]">
        <p className="text-sm text-[#334155] leading-relaxed whitespace-pre-wrap">{content}</p>
      </div>
      {correct && (
        <div className="flex gap-2">
          {['A', 'B', 'C', 'D'].map(opt => {
            const isCorrect = opt === correct
            const chosen = answered === opt
            return (
              <button
                key={opt}
                type="button"
                onClick={() => setAnswered(opt)}
                className={`flex-1 py-2 rounded-xl font-bold text-sm border-2 transition-all ${
                  answered
                    ? isCorrect
                      ? 'bg-green-50 border-green-400 text-green-700'
                      : chosen
                        ? 'bg-red-50 border-red-400 text-red-600'
                        : 'bg-white border-[#E2E8F0] text-[#94A3B8]'
                    : 'bg-white border-[#E2E8F0] text-[#334155] hover:border-[#121212]'
                }`}
              >
                {opt}
                {answered && isCorrect && <CheckCircle2 size={12} className="inline ml-1" />}
                {answered && chosen && !isCorrect && <XCircle size={12} className="inline ml-1" />}
              </button>
            )
          })}
        </div>
      )}
      {answered && (
        <button
          type="button"
          onClick={() => setAnswered(null)}
          className="text-xs text-[#64748B] underline"
        >
          Thử lại
        </button>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────

export function VocabAiPanel({ word, meaning = '' }: VocabAiPanelProps) {
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>('examples')
  const [cache, setCache] = useState<Partial<Record<TabId, TabState<unknown>>>>({})
  const loadedRef = useRef<Set<TabId>>(new Set())

  const getState = <T,>(tab: TabId): TabState<T> => {
    return (cache[tab] as TabState<T>) ?? { data: null, loading: false, error: null }
  }

  const setTabState = <T,>(tab: TabId, state: Partial<TabState<T>>) => {
    setCache(prev => ({
      ...prev,
      [tab]: { ...(prev[tab] ?? { data: null, loading: false, error: null }), ...state },
    }))
  }

  const loadTab = useCallback(async (tab: TabId, force = false) => {
    if (loadedRef.current.has(tab) && !force) return
    loadedRef.current.add(tab)

    setTabState(tab, { loading: true, error: null })
    try {
      let data: unknown
      switch (tab) {
        case 'examples':
          data = await vocabAiApi.examples(word, 3)
          break
        case 'mnemonic':
          data = await vocabAiApi.mnemonic(word, meaning)
          break
        case 'similar':
          data = await vocabAiApi.similar(word)
          break
        case 'story':
          data = await vocabAiApi.story([word])
          break
        case 'etymology':
          data = await vocabAiApi.etymology(word)
          break
        case 'quiz':
          data = await vocabAiApi.quiz([word], 1)
          break
      }
      setTabState(tab, { data, loading: false })
    } catch (e: unknown) {
      loadedRef.current.delete(tab) // allow retry
      const msg = e instanceof Error ? e.message : 'Lỗi kết nối AI'
      setTabState(tab, { loading: false, error: msg })
    }
  }, [word, meaning])

  const handleOpenTab = (tab: TabId) => {
    setActiveTab(tab)
    if (!open) setOpen(true)
    loadTab(tab)
  }

  const handleToggle = () => {
    const next = !open
    setOpen(next)
    if (next) loadTab(activeTab)
  }

  // ─── Render tab content ───────────────────────────────────────────

  const renderContent = () => {
    const { data, loading, error } = getState(activeTab)

    if (loading) {
      return (
        <div className="flex items-center justify-center py-10 gap-3 text-[#64748B]">
          <Loader2 size={20} className="animate-spin text-[#121212]" />
          <span className="text-sm">Đang hỏi AI…</span>
        </div>
      )
    }
    if (error) {
      return (
        <div className="py-6 text-center">
          <p className="text-sm text-red-500 mb-3">⚠️ {error}</p>
          <button
            type="button"
            onClick={() => {
              loadedRef.current.delete(activeTab)
              loadTab(activeTab, true)
            }}
            className="inline-flex items-center gap-1.5 text-xs text-[#121212] font-semibold px-3 py-1.5 rounded-lg border border-[#E2E8F0] hover:bg-[#F8FAFF]"
          >
            <RefreshCw size={13} /> Thử lại
          </button>
        </div>
      )
    }
    if (!data) return null

    switch (activeTab) {
      case 'examples': {
        const d = data as { examples: string[] }
        return (
          <div className="space-y-3">
            {d.examples.map((ex, i) => (
              <div key={i} className="bg-[#F0F6FF] rounded-xl p-3 border-l-4 border-[#3B82F6]">
                <p className="text-sm text-[#1E293B] leading-relaxed">🇩🇪 {ex}</p>
              </div>
            ))}
          </div>
        )
      }
      case 'mnemonic': {
        const d = data as { mnemonic: string }
        return (
          <div className="bg-gradient-to-br from-[#FFF8E1] to-[#FFFDE7] rounded-xl p-4 border border-[#FDE68A]">
            <p className="text-sm text-[#92400E] leading-relaxed">💡 {d.mnemonic}</p>
          </div>
        )
      }
      case 'similar': {
        const d = data as { similarWords: string[] }
        return (
          <div className="flex flex-wrap gap-2">
            {d.similarWords.map((w, i) => (
              <span
                key={i}
                className="px-3 py-1.5 rounded-full bg-[#F5F3FF] text-[#4C1D95] font-semibold text-sm border border-[#DDD6FE]"
              >
                {w}
              </span>
            ))}
          </div>
        )
      }
      case 'story': {
        const d = data as { story: string }
        return (
          <div className="bg-[#F8FAFF] rounded-xl p-4 border border-[#E2E8F0]">
            <p className="text-sm text-[#334155] leading-relaxed italic">{d.story}</p>
          </div>
        )
      }
      case 'etymology': {
        const d = data as { etymology: string }
        return (
          <div className="bg-[#F0FDF4] rounded-xl p-4 border border-[#BBF7D0]">
            <p className="text-sm text-[#166534] leading-relaxed">📜 {d.etymology}</p>
          </div>
        )
      }
      case 'quiz': {
        const d = data as { questions: Array<{ word: string; content: string }> }
        return d.questions.length > 0
          ? <QuizView content={d.questions[0].content} word={word} />
          : <p className="text-sm text-[#94A3B8] text-center py-4">Không có câu hỏi</p>
      }
    }
  }

  return (
    <div className="border-t border-[#EEF2F6]">
      {/* Header / toggle */}
      <button
        type="button"
        onClick={handleToggle}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-[#F8FAFF] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] flex items-center justify-center">
            <Sparkles size={14} className="text-white" />
          </div>
          <span className="font-bold text-sm text-[#0F172A]">AI Insights</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#F5F3FF] text-[#6366F1] font-bold">powered by Groq</span>
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={16} className="text-[#94A3B8]" />
        </motion.div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {/* Tab bar */}
            <div className="px-6 pb-2 overflow-x-auto">
              <div className="flex gap-1 border-b border-[#EEF2F6] min-w-max">
                {TABS.map(tab => {
                  const Icon = tab.icon
                  const active = activeTab === tab.id
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => handleOpenTab(tab.id)}
                      className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
                        active
                          ? 'border-[#6366F1] text-[#6366F1]'
                          : 'border-transparent text-[#64748B] hover:text-[#0F172A] hover:border-[#CBD5E1]'
                      }`}
                    >
                      <Icon size={13} />
                      {tab.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Tab content */}
            <div className="px-6 pb-5 pt-3 min-h-[120px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15 }}
                >
                  {renderContent()}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
