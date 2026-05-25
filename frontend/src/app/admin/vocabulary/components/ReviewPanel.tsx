import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ClipboardCheck, RefreshCw, CheckCircle2, XCircle } from 'lucide-react'
import api, { apiMessage } from '@/lib/api'

const DTYPE_OPTIONS = ['Noun','Verb','Adjective','Adverb','Conjunction','Article','Pronoun','Preposition','Other']
const GENDER_OPTIONS = ['DER','DIE','DAS']
const CEFR_OPTIONS   = ['A1','A2','B1','B2','C1','C2']

type ReviewWord = {
  id: number
  base_form: string
  dtype: string
  cefr_level: string
  phonetic: string | null
  gender: string | null
  meaning_vi: string | null
  meaning_en: string | null
  admin_review_notes: string | null
}

async function adminGet(path: string) {
  const res = await api.get(path)
  return res.data as Record<string, unknown>
}

async function adminPatch(path: string, body: Record<string, unknown>) {
  const res = await api.patch(path, body)
  return res.data
}

export default function ReviewPanel() {
  const [stats, setStats] = useState<any>(null)
  const [queue, setQueue] = useState<ReviewWord[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [filterCefr, setFilterCefr] = useState('')
  const [filterDtype, setFilterDtype] = useState('')
  const [editState, setEditState] = useState<Record<number, { dtype: string; gender: string; notes: string }>>({})
  const [saving, setSaving] = useState<Record<number, boolean>>({})
  const [saved, setSaved] = useState<Record<number, boolean>>({})
  const [error, setError] = useState('')

  const loadStats = async () => {
    try {
      const data = await adminGet('/admin/vocabulary/review/stats') as any
      setStats(data)
    } catch { /* ignore */ }
  }

  const loadQueue = async () => {
    setLoading(true); setError('')
    try {
      const params = new URLSearchParams({ limit: '50' })
      if (filterCefr) params.append('cefrLevel', filterCefr)
      if (filterDtype) params.append('dtype', filterDtype)
      const data = await adminGet(`/admin/vocabulary/review/queue?${params}`) as { items: ReviewWord[]; total: number }
      setQueue(data.items || [])
      setTotal(data.total || 0)
      // Init editState
      const init: Record<number, { dtype: string; gender: string; notes: string }> = {}
      for (const w of (data.items || [])) {
        init[w.id] = { dtype: w.dtype || '', gender: w.gender || '', notes: w.admin_review_notes || '' }
      }
      setEditState(init)
    } catch (e: unknown) { setError(apiMessage(e)) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    loadStats()
    loadQueue()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const approve = async (word: ReviewWord) => {
    const st = editState[word.id] || {}
    setSaving(s => ({ ...s, [word.id]: true }))
    try {
      await adminPatch(`/admin/vocabulary/${word.id}/review`, {
        reviewed: true,
        dtype:  st.dtype  !== word.dtype   ? st.dtype  : undefined,
        gender: st.gender !== word.gender  ? st.gender : undefined,
        notes:  st.notes  !== (word.admin_review_notes ?? '') ? st.notes : undefined,
      })
      setSaved(s => ({ ...s, [word.id]: true }))
      setQueue(q => q.filter(w => w.id !== word.id))
      setTotal(t => t - 1)
      await loadStats()
    } catch (e: unknown) { setError(apiMessage(e)) }
    finally { setSaving(s => ({ ...s, [word.id]: false })) }
  }

  const percentDone = stats ? Math.round(((stats.totals?.reviewed ?? 0) / Math.max(stats.totals?.total ?? 1, 1)) * 100) : 0

  return (
    <div className="bg-white rounded-[16px] border border-[#E2E8F0] shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[#F0F4F8] flex items-center gap-3">
        <div className="w-9 h-9 rounded-[10px] bg-gradient-to-br from-emerald-50 to-green-50 flex items-center justify-center">
          <ClipboardCheck size={16} className="text-emerald-600" />
        </div>
        <div>
          <h3 className="font-semibold text-[#0F172A] text-sm">Phase 4 — Quality Review</h3>
          <p className="text-[#94A3B8] text-xs">Kiểm tra thủ công dtype / gender / IPA trước khi publish</p>
        </div>
        <span className="ml-auto text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">PHASE 4</span>
      </div>

      {/* Stats bar */}
      {stats && (
        <div className="px-5 py-3 border-b border-[#F0F4F8] bg-[#FAFBFC]">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-xs text-[#64748B]">Tiến độ review:</span>
            <span className="text-xs font-bold text-emerald-700">{stats.totals?.reviewed ?? 0}</span>
            <span className="text-xs text-[#94A3B8]">/ {stats.totals?.total ?? 0}</span>
            <span className="ml-auto text-xs font-semibold text-emerald-600">{percentDone}%</span>
          </div>
          <div className="w-full bg-[#E2E8F0] rounded-full h-1.5">
            <div className="h-1.5 rounded-full bg-gradient-to-r from-emerald-400 to-green-500 transition-all duration-500"
              style={{ width: `${percentDone}%` }} />
          </div>
          {/* By level */}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {(stats.byLevel || []).map((row: any) => (
              <span key={row.cefr_level}
                className="text-[10px] px-2 py-0.5 rounded-full bg-white border border-[#E2E8F0] text-[#475569]">
                {row.cefr_level}: <strong className="text-emerald-600">{row.reviewed}</strong>
                <span className="text-[#94A3B8]">/{row.total}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="px-5 py-4 space-y-4">
        {/* Filters + Load */}
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="block text-[10px] font-medium text-[#64748B] mb-1">CEFR</label>
            <select value={filterCefr} onChange={e => setFilterCefr(e.target.value)}
              className="text-xs px-2 py-1.5 rounded-[7px] border border-[#E2E8F0] bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400/40">
              <option value="">Tất cả</option>
              {CEFR_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-medium text-[#64748B] mb-1">Loại từ</label>
            <select value={filterDtype} onChange={e => setFilterDtype(e.target.value)}
              className="text-xs px-2 py-1.5 rounded-[7px] border border-[#E2E8F0] bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400/40">
              <option value="">Tất cả</option>
              {DTYPE_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <button onClick={loadQueue} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[7px] bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-semibold transition-colors">
            {loading ? <span className="animate-spin inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full" /> : <RefreshCw size={12} />}
            {loading ? 'Đang tải...' : 'Tải queue'}
          </button>
          <span className="text-[10px] text-[#94A3B8] ml-auto">Còn lại: <strong className="text-[#0F172A]">{total}</strong> từ</span>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 border border-red-200 rounded-[8px] px-3 py-2">
            <XCircle size={13} /> {error}
          </div>
        )}

        {/* Word cards */}
        <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
          {queue.length === 0 && !loading && (
            <div className="text-center py-10 text-[#94A3B8] text-sm">
              {total === 0 ? '🎉 Tất cả từ đã được review!' : 'Nhấn "Tải queue" để bắt đầu review'}
            </div>
          )}
          {queue.map(word => {
            const st = editState[word.id] || { dtype: word.dtype, gender: word.gender || '', notes: word.admin_review_notes || '' }
            const isDirty = st.dtype !== word.dtype || st.gender !== (word.gender || '') || st.notes !== (word.admin_review_notes || '')
            return (
              <motion.div key={word.id} initial={{ opacity: 0, y: 2 }} animate={{ opacity: 1, y: 0 }}
                className={`border rounded-[10px] px-4 py-3 ${saved[word.id] ? 'border-emerald-300 bg-emerald-50' : 'border-[#E2E8F0] bg-white'}`}>
                <div className="flex items-start gap-3 flex-wrap">
                  {/* Word info */}
                  <div className="flex-1 min-w-[160px]">
                    <div className="flex items-baseline gap-2">
                      <span className="font-bold text-[#0F172A] text-base">{word.base_form}</span>
                      {word.phonetic && <span className="text-[#94A3B8] text-[11px]">{word.phonetic}</span>}
                    </div>
                    <div className="flex gap-1.5 mt-1 flex-wrap">
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 border border-blue-100 text-blue-700">{word.cefr_level}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-50 border border-slate-200 text-slate-600">{word.dtype}</span>
                      {word.gender && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-50 border border-purple-100 text-purple-700">{word.gender}</span>}
                    </div>
                    {word.meaning_vi && <p className="text-xs text-[#64748B] mt-1 truncate max-w-[220px]">{word.meaning_vi}</p>}
                    {word.meaning_en && <p className="text-[10px] text-[#94A3B8] mt-0.5 italic truncate max-w-[220px]">{word.meaning_en}</p>}
                  </div>

                  {/* Editable fields */}
                  <div className="flex flex-wrap gap-2 items-end flex-shrink-0">
                    <div>
                      <label className="block text-[9px] font-semibold text-[#94A3B8] mb-0.5 uppercase tracking-wide">Dtype</label>
                      <select value={st.dtype} onChange={e => setEditState(es => ({ ...es, [word.id]: { ...es[word.id], dtype: e.target.value } }))}
                        className="text-xs px-2 py-1 rounded-[6px] border border-[#E2E8F0] focus:outline-none focus:ring-2 focus:ring-emerald-400/40 bg-white">
                        {DTYPE_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    {(st.dtype === 'Noun' || word.dtype === 'Noun') && (
                      <div>
                        <label className="block text-[9px] font-semibold text-[#94A3B8] mb-0.5 uppercase tracking-wide">Gender</label>
                        <select value={st.gender} onChange={e => setEditState(es => ({ ...es, [word.id]: { ...es[word.id], gender: e.target.value } }))}
                          className="text-xs px-2 py-1 rounded-[6px] border border-[#E2E8F0] focus:outline-none focus:ring-2 focus:ring-emerald-400/40 bg-white">
                          <option value="">—</option>
                          {GENDER_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                      </div>
                    )}
                    <div>
                      <label className="block text-[9px] font-semibold text-[#94A3B8] mb-0.5 uppercase tracking-wide">Notes</label>
                      <input type="text" placeholder="Ghi chú..."
                        value={st.notes}
                        onChange={e => setEditState(es => ({ ...es, [word.id]: { ...es[word.id], notes: e.target.value } }))}
                        className="text-xs px-2 py-1 rounded-[6px] border border-[#E2E8F0] focus:outline-none focus:ring-2 focus:ring-emerald-400/40 w-36" />
                    </div>
                    <button onClick={() => approve(word)} disabled={saving[word.id]}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-white text-xs font-semibold transition-all ${
                        saved[word.id] ? 'bg-emerald-400' : isDirty ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-500 hover:bg-emerald-600'
                      } disabled:opacity-60`}>
                      {saving[word.id]
                        ? <span className="animate-spin inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full" />
                        : saved[word.id] ? <CheckCircle2 size={12} /> : <CheckCircle2 size={12} />
                      }
                      {saved[word.id] ? 'Đã lưu' : isDirty ? 'Lưu & duyệt' : 'Duyệt'}
                    </button>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
