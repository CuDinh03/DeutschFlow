import { useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Loader2, Pencil, Save, X, XCircle } from 'lucide-react'
import api, { apiMessage } from '@/lib/api'
import { WordItem } from './types'

const GENDER_COLORS: Record<string, string> = { DER: '#3b82f6', DIE: '#ef4444', DAS: '#22c55e' }

type EditForm = {
  baseForm: string; cefrLevel: string; dtype: string; phonetic: string
  meaningVi: string; meaningEn: string; exampleDe: string; exampleEn: string
  usageNote: string; gender: string; pluralForm: string
}

export default function EditWordCard({
  word,
  onClose,
  onSaved,
}: {
  word: WordItem
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<EditForm>({
    baseForm:   word.baseForm,
    cefrLevel:  word.cefrLevel,
    dtype:      word.dtype,
    phonetic:   word.phonetic ?? '',
    meaningVi:  word.meaning ?? '',
    meaningEn:  word.meaningEn ?? '',
    exampleDe:  word.exampleDe ?? word.example ?? '',
    exampleEn:  word.exampleEn ?? '',
    usageNote:  word.usageNote ?? '',
    gender:     word.gender ?? '',
    pluralForm: word.nounDetails?.pluralForm ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const set = (k: keyof EditForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const save = async () => {
    setSaving(true); setError('')
    try {
      await api.patch(`/admin/vocabulary/${word.id}`, form)
      setSaved(true)
      setTimeout(() => { setSaved(false); onSaved(); onClose() }, 800)
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally { setSaving(false) }
  }

  const Field = ({ label, k, type = 'text', rows }: { label: string; k: keyof EditForm; type?: string; rows?: number }) => (
    <div>
      <label className="block text-xs font-semibold text-[#64748B] mb-1">{label}</label>
      {rows ? (
        <textarea
          value={form[k]}
          onChange={set(k)}
          rows={rows}
          className="w-full px-3 py-2 rounded-[8px] border border-[#E2E8F0] text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#121212]/20 resize-none"
        />
      ) : (
        <input
          type={type}
          value={form[k]}
          onChange={set(k)}
          className="w-full px-3 py-2 rounded-[8px] border border-[#E2E8F0] text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#121212]/20"
        />
      )}
    </div>
  )

  const Select = ({ label, k, opts }: { label: string; k: keyof EditForm; opts: string[] }) => (
    <div>
      <label className="block text-xs font-semibold text-[#64748B] mb-1">{label}</label>
      <select
        value={form[k]}
        onChange={set(k)}
        className="w-full px-3 py-2 rounded-[8px] border border-[#E2E8F0] text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#121212]/20 bg-white"
      >
        <option value="">— chọn —</option>
        {opts.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Card */}
      <motion.div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-[20px] shadow-2xl"
        initial={{ scale: 0.95, y: 16, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.95, y: 16, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-[#121212] rounded-t-[20px]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[10px] bg-white/15 flex items-center justify-center">
              <Pencil size={16} className="text-white" />
            </div>
            <div>
              <h2 className="font-bold text-white text-base">{word.baseForm}</h2>
              <p className="text-white/50 text-xs">ID #{word.id} · {word.dtype}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-[8px] hover:bg-white/10 text-white/70 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">

          {/* Thông tin cơ bản */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#94A3B8] mb-3">Thông tin cơ bản</h3>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Từ gốc (base_form)" k="baseForm" />
              <Field label="Phát âm IPA" k="phonetic" />
              <Select label="Cấp độ CEFR" k="cefrLevel" opts={['A1','A2','B1','B2','C1','C2']} />
              <Select label="Loại từ" k="dtype" opts={['Noun','Verb','Adjective','Word']} />
            </div>
          </section>

          {/* Giống (chỉ Noun) */}
          {(form.dtype === 'Noun' || word.dtype === 'Noun') && (
            <section>
              <h3 className="text-xs font-bold uppercase tracking-widest text-[#94A3B8] mb-3">Danh từ</h3>
              <div className="grid grid-cols-2 gap-3">
                <Select label="Giống (Gender)" k="gender" opts={['DER','DIE','DAS']} />
                <Field label="Số nhiều (Plural)" k="pluralForm" />
              </div>
              {form.gender && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-[#64748B]">Preview:</span>
                  <span className="inline-flex px-2.5 py-1 rounded text-xs font-bold text-white"
                    style={{ backgroundColor: GENDER_COLORS[form.gender] ?? '#94A3B8' }}>
                    {form.gender}
                  </span>
                  <span className="text-sm font-semibold text-[#0F172A]">
                    {form.gender === 'DER' ? 'der' : form.gender === 'DIE' ? 'die' : 'das'} {form.baseForm}
                  </span>
                  {form.pluralForm && <span className="text-[#94A3B8] text-xs">· Pl: {form.pluralForm}</span>}
                </div>
              )}
            </section>
          )}

          {/* Nghĩa */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#94A3B8] mb-3">Nghĩa</h3>
            <div className="grid grid-cols-1 gap-3">
              <Field label="Nghĩa tiếng Việt" k="meaningVi" />
              <Field label="Nghĩa tiếng Anh" k="meaningEn" />
            </div>
          </section>

          {/* Ví dụ */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#94A3B8] mb-3">Ví dụ câu</h3>
            <div className="grid grid-cols-1 gap-3">
              <Field label="Ví dụ tiếng Đức (example_de)" k="exampleDe" rows={2} />
              <Field label="Ví dụ tiếng Anh (example_en)" k="exampleEn" rows={2} />
            </div>
          </section>

          {/* Cách dùng */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#94A3B8] mb-3">Cách sử dụng</h3>
            <Field label="Ghi chú cách dùng (usage_note)" k="usageNote" rows={3} />
          </section>

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 border border-red-200 rounded-[8px] px-3 py-2">
              <XCircle size={13} /> {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-between px-6 py-4 bg-[#FAFBFC] border-t border-[#E2E8F0] rounded-b-[20px]">
          <button onClick={onClose} className="px-4 py-2 rounded-[10px] text-[#64748B] hover:bg-[#E2E8F0] text-sm font-medium transition-colors">
            Hủy
          </button>
          <button
            onClick={save}
            disabled={saving || saved}
            className="flex items-center gap-2 px-5 py-2.5 rounded-[10px] text-white text-sm font-semibold transition-all disabled:opacity-70"
            style={{ background: saved ? '#10b981' : '#121212' }}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : <Save size={14} />}
            {saving ? 'Đang lưu…' : saved ? 'Đã lưu!' : 'Lưu thay đổi'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
