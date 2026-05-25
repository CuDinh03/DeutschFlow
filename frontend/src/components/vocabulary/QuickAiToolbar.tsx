'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles, Languages, CheckSquare, Lightbulb, X, Loader2, Copy, Check,
  type LucideIcon,
} from 'lucide-react'
import { aiToolsApi } from '@/lib/aiToolsApi'

// ─── Types ────────────────────────────────────────────────────────────────────

type Tool = 'translate-en' | 'translate-de' | 'grammar-correct' | 'grammar-explain'

interface Result {
  tool: Tool
  content: string
}

// ─── Tool definitions ─────────────────────────────────────────────────────────

const TOOLS: { id: Tool; icon: LucideIcon; label: string; placeholder: string; color: string }[] = [
  { id: 'translate-en',     icon: Languages,    label: 'DE → EN',       placeholder: 'Nhập tiếng Đức để dịch...',       color: '#3B82F6' },
  { id: 'translate-de',     icon: Languages,    label: 'EN → DE',       placeholder: 'Enter English to translate...',   color: '#8B5CF6' },
  { id: 'grammar-correct',  icon: CheckSquare,  label: 'Sửa ngữ pháp', placeholder: 'Nhập câu cần kiểm tra ngữ pháp...', color: '#22C55E' },
  { id: 'grammar-explain',  icon: Lightbulb,    label: 'Giải thích',   placeholder: 'Nhập quy tắc ngữ pháp cần giải thích...', color: '#F59E0B' },
]

// ─── Component ────────────────────────────────────────────────────────────────

export function QuickAiToolbar() {
  const [open, setOpen] = useState(false)
  const [activeTool, setActiveTool] = useState<Tool>('translate-en')
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [copied, setCopied] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Focus textarea when panel opens
  useEffect(() => {
    if (open) setTimeout(() => textareaRef.current?.focus(), 150)
  }, [open, activeTool])

  const handleToolChange = (tool: Tool) => {
    setActiveTool(tool)
    setInput('')
    setResult(null)
  }

  const handleRun = useCallback(async () => {
    if (!input.trim() || loading) return
    setLoading(true)
    setResult(null)
    try {
      let content = ''
      switch (activeTool) {
        case 'translate-en': {
          const r = await aiToolsApi.translateToEnglish(input)
          content = r.translation
          break
        }
        case 'translate-de': {
          const r = await aiToolsApi.translateToGerman(input)
          content = r.translation
          break
        }
        case 'grammar-correct': {
          const r = await aiToolsApi.grammarCorrect(input)
          content = `✅ ${r.corrected}\n\n💬 ${r.explanation}`
          break
        }
        case 'grammar-explain': {
          const r = await aiToolsApi.grammarExplain(input)
          content = r.explanation
          break
        }
      }
      setResult({ tool: activeTool, content })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Lỗi kết nối'
      setResult({ tool: activeTool, content: `⚠️ ${msg}` })
    } finally {
      setLoading(false)
    }
  }, [input, activeTool, loading])

  const handleCopy = async () => {
    if (!result) return
    await navigator.clipboard.writeText(result.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const toolDef = TOOLS.find(t => t.id === activeTool)!

  return (
    <>
      {/* Floating trigger button */}
      <motion.button
        type="button"
        onClick={() => setOpen(o => !o)}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-2xl shadow-xl flex items-center justify-center"
        style={{
          background: open ? '#1E293B' : 'linear-gradient(135deg, #6366F1, #8B5CF6)',
        }}
        aria-label="Quick AI Tools"
      >
        {open ? <X size={22} className="text-white" /> : <Sparkles size={22} className="text-white" />}
      </motion.button>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-24 right-6 z-40 w-[340px] bg-white rounded-3xl shadow-2xl border border-[#E2E8F0] overflow-hidden"
          >
            {/* Header */}
            <div className="bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-white" />
                <span className="font-bold text-white text-sm">Công cụ AI nhanh</span>
              </div>

            </div>

            {/* Tool tabs */}
            <div className="flex border-b border-[#F1F5F9] bg-[#FAFBFF]">
              {TOOLS.map(tool => {
                const Icon = tool.icon
                const active = activeTool === tool.id
                return (
                  <button
                    key={tool.id}
                    type="button"
                    onClick={() => handleToolChange(tool.id)}
                    className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-[9px] font-bold transition-all border-b-2 ${
                      active
                        ? 'border-[#6366F1] text-[#6366F1] bg-white'
                        : 'border-transparent text-[#94A3B8] hover:text-[#64748B]'
                    }`}
                  >
                    <Icon size={14} />
                    {tool.label}
                  </button>
                )
              })}
            </div>

            {/* Input */}
            <div className="p-4">
              <textarea
                ref={textareaRef}
                rows={3}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') handleRun() }}
                placeholder={toolDef.placeholder}
                className="w-full resize-none text-sm border border-[#E2E8F0] rounded-xl p-3 text-[#0F172A] placeholder:text-[#CBD5E1] outline-none focus:border-[#6366F1] transition-all"
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] text-[#CBD5E1]">Ctrl+Enter để chạy</span>
                <button
                  type="button"
                  onClick={handleRun}
                  disabled={!input.trim() || loading}
                  className="px-4 py-2 rounded-xl font-bold text-xs text-white transition-all disabled:opacity-40"
                  style={{ background: toolDef.color }}
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : 'Chạy AI →'}
                </button>
              </div>
            </div>

            {/* Result */}
            <AnimatePresence>
              {result && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="border-t border-[#F1F5F9]"
                >
                  <div className="p-4 bg-[#FAFBFF]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest">Kết quả</span>
                      <button
                        type="button"
                        onClick={handleCopy}
                        className="flex items-center gap-1 text-[10px] text-[#64748B] hover:text-[#6366F1] transition-colors"
                      >
                        {copied ? <><Check size={11} className="text-green-500" /> Đã sao</> : <><Copy size={11} /> Sao chép</>}
                      </button>
                    </div>
                    <p className="text-sm text-[#334155] leading-relaxed whitespace-pre-wrap">{result.content}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
