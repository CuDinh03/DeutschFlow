import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Loader2, Pencil, RotateCcw } from 'lucide-react'
import { WordItem } from './types'

const GENDER_COLORS: Record<string, string> = { DER: '#3b82f6', DIE: '#ef4444', DAS: '#22c55e' }
const CEFR_COLORS: Record<string, { bg: string; text: string }> = {
  A1: { bg: '#F0FDF4', text: '#065F46' }, A2: { bg: '#EFF6FF', text: '#1E40AF' },
  B1: { bg: '#FFFBEB', text: '#92400E' }, B2: { bg: '#F5F3FF', text: '#4C1D95' },
  C1: { bg: '#FFF1F2', text: '#9F1239' }, C2: { bg: '#F0F9FF', text: '#0C4A6E' },
}

type VocabDataTableProps = {
  words: WordItem[]
  total: number
  page: number
  totalPages: number
  loading: boolean
  enrichingId: number | null
  onEnrichOne: (wordId: number, e: React.MouseEvent) => void
  onEditWord: (word: WordItem) => void
  onPageChange: (p: number) => void
  pageSize: number
}

export default function VocabDataTable({
  words,
  total,
  page,
  totalPages,
  loading,
  enrichingId,
  onEnrichOne,
  onEditWord,
  onPageChange,
  pageSize
}: VocabDataTableProps) {
  return (
    <div className="bg-white rounded-[16px] border border-[#E2E8F0] shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-[#F0F4F8] flex items-center justify-between">
        <p className="text-sm font-semibold text-[#0F172A]">{total.toLocaleString()} từ</p>
        <p className="text-xs text-[#94A3B8]">Click vào hàng để chỉnh sửa</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-[#94A3B8]">
          <Loader2 size={20} className="animate-spin mr-2" /> Đang tải...
        </div>
      ) : words.length === 0 ? (
        <div className="text-center py-16 text-[#94A3B8] text-sm">Không tìm thấy từ nào.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#F0F4F8] bg-[#FAFBFC]">
                {['ID', 'Từ', 'Loại', 'Cấp', 'Giống', 'IPA', 'Nghĩa VI', 'Nghĩa EN', 'Ví dụ DE', ''].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-[#64748B] text-xs font-semibold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {words.map((w, i) => {
                const cc = CEFR_COLORS[w.cefrLevel] ?? { bg: '#F5F7FA', text: '#64748B' }
                const gc = w.gender ? GENDER_COLORS[w.gender] : null
                const hasMeaning = w.meaning?.trim()
                const hasIpa = w.phonetic?.trim()
                return (
                  <motion.tr key={w.id}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.008 }}
                    onClick={() => onEditWord(w)}
                    className="border-b border-[#F8FAFC] hover:bg-[#EEF4FF] transition-colors cursor-pointer group">
                    <td className="px-3 py-2.5">
                      <span className="font-mono text-[10px] text-[#94A3B8] bg-[#F5F7FA] px-1.5 py-0.5 rounded">{w.id}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        {w.article && <span className="text-xs font-bold" style={{ color: gc ?? '#64748B' }}>{w.article}</span>}
                        <span className="font-semibold text-[#0F172A]">{w.baseForm}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5"><span className="text-xs text-[#64748B]">{w.dtype}</span></td>
                    <td className="px-3 py-2.5">
                      <span className="inline-flex px-2 py-0.5 rounded text-xs font-bold"
                        style={{ backgroundColor: cc.bg, color: cc.text }}>{w.cefrLevel}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      {w.gender && (
                        <span className="inline-flex px-2 py-0.5 rounded text-xs font-bold text-white"
                          style={{ backgroundColor: gc ?? '#94A3B8' }}>{w.gender}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {hasIpa
                        ? <span className="text-xs font-mono text-[#121212]">{w.phonetic}</span>
                        : <span className="text-[#CBD5E1] text-xs">—</span>}
                    </td>
                    <td className="px-3 py-2.5 max-w-[140px]">
                      {hasMeaning
                        ? <span className="text-xs text-[#0F172A] line-clamp-1">{w.meaning}</span>
                        : <span className="text-[#CBD5E1] text-xs">—</span>}
                    </td>
                    <td className="px-3 py-2.5 max-w-[140px]">
                      {w.meaningEn
                        ? <span className="text-xs text-[#64748B] line-clamp-1">{w.meaningEn}</span>
                        : <span className="text-[#CBD5E1] text-xs">—</span>}
                    </td>
                    <td className="px-3 py-2.5 max-w-[160px]">
                      {w.exampleDe
                        ? <span className="text-xs text-[#64748B] line-clamp-1 italic">{w.exampleDe}</span>
                        : <span className="text-[#CBD5E1] text-xs">—</span>}
                    </td>
                    <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={e => onEnrichOne(w.id, e)} disabled={enrichingId === w.id}
                          title="Enrich từ Wiktionary"
                          className="p-1.5 rounded-[6px] hover:bg-[#EEF4FF] text-[#94A3B8] hover:text-[#121212] transition-colors disabled:opacity-50">
                          {enrichingId === w.id ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                        </button>
                        <button onClick={() => onEditWord(w)} title="Chỉnh sửa"
                          className="p-1.5 rounded-[6px] hover:bg-[#EEF4FF] text-[#94A3B8] hover:text-[#121212] transition-colors">
                          <Pencil size={13} />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between px-5 py-3 border-t border-[#F0F4F8] bg-[#FAFBFC]">
        <p className="text-xs text-[#94A3B8]">
          {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} / {total.toLocaleString()} từ
        </p>
        <div className="flex items-center gap-1">
          <button onClick={() => onPageChange(Math.max(0, page - 1))} disabled={page === 0 || loading}
            className="p-1.5 rounded border border-[#E2E8F0] disabled:opacity-40 hover:bg-white transition-colors text-[#64748B]">
            <ChevronLeft size={14} />
          </button>
          {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
            const start = Math.max(0, Math.min(page - 3, totalPages - 7))
            const p = start + i
            return (
              <button key={p} onClick={() => onPageChange(p)}
                className={`w-7 h-7 rounded text-xs font-semibold border transition-colors ${p === page ? 'bg-[#121212] text-white border-[#121212]' : 'border-[#E2E8F0] text-[#64748B] hover:bg-white'}`}>
                {p + 1}
              </button>
            )
          })}
          <button onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1 || loading}
            className="p-1.5 rounded border border-[#E2E8F0] disabled:opacity-40 hover:bg-white transition-colors text-[#64748B]">
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
