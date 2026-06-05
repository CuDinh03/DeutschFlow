import { useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Image as ImageIcon, Loader2, Pencil, Save, Search, Trash2, X, XCircle } from 'lucide-react'
import api, { apiMessage } from '@/lib/api'
import { ImageUploader } from '@/components/ui/ImageUploader'
import { MediaAsset } from '@/lib/mediaApi'
import { WordItem } from './types'
import UnsplashPicker from './UnsplashPicker'

const GENDER_COLORS: Record<string, string> = { DER: '#3b82f6', DIE: '#ef4444', DAS: '#22c55e' }

type EditForm = {
  baseForm: string; cefrLevel: string; dtype: string; phonetic: string
  meaningVi: string; meaningEn: string; exampleDe: string; exampleEn: string
  usageNote: string; gender: string; pluralForm: string
  imageUrl: string; imageSource: string; imageStyle: string
}

type FieldProps = {
  label: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void
  type?: string
  rows?: number
}

function Field({ label, value, onChange, type = 'text', rows }: FieldProps) {
  return (
    <div>
      <label className="block text-xs font-semibold text-[#64748B] mb-1">{label}</label>
      {rows ? (
        <textarea
          value={value}
          onChange={onChange}
          rows={rows}
          className="w-full px-3 py-2 rounded-[8px] border border-[#E2E8F0] text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#121212]/20 resize-none"
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={onChange}
          className="w-full px-3 py-2 rounded-[8px] border border-[#E2E8F0] text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#121212]/20"
        />
      )}
    </div>
  )
}

type SelectProps = {
  label: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
  opts: string[]
}

function Select({ label, value, onChange, opts }: SelectProps) {
  return (
    <div>
      <label className="block text-xs font-semibold text-[#64748B] mb-1">{label}</label>
      <select
        value={value}
        onChange={onChange}
        className="w-full px-3 py-2 rounded-[8px] border border-[#E2E8F0] text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#121212]/20 bg-white"
      >
        <option value="">— chọn —</option>
        {opts.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
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
    imageUrl:   word.imageUrl ?? '',
    imageSource: word.imageSource ?? 'EMPTY',
    imageStyle:  word.imageStyle ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [showUnsplash, setShowUnsplash] = useState(false)

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

          {/* Ảnh minh họa */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#94A3B8] mb-3 flex items-center gap-1.5">
              <ImageIcon size={12} />
              Ảnh minh họa
            </h3>

            {/* Preview ảnh hiện tại */}
            {form.imageUrl && (
              <div className="relative mb-3 rounded-[12px] overflow-hidden border border-[#E2E8F0] bg-[#F8FAFC] group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={form.imageUrl}
                  alt={`Ảnh minh họa cho từ ${word.baseForm}`}
                  className="w-full h-48 object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <button
                    onClick={() => setForm(f => ({ ...f, imageUrl: '' }))}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 text-white text-xs font-semibold rounded-[8px] hover:bg-red-600 transition-colors"
                  >
                    <Trash2 size={12} />
                    Xóa ảnh
                  </button>
                </div>
              </div>
            )}

            {/* Upload zone */}
            <div className={form.imageUrl ? 'hidden' : 'block'}>
              <ImageUploader
                category="VOCABULARY"
                tag={`word-${word.id}`}
                altText={`Ảnh minh họa từ vựng: ${word.baseForm}`}
                onUploadSuccess={(asset: MediaAsset) => {
                  setForm(f => ({ ...f, imageUrl: asset.url, imageSource: 'UPLOADED' }))
                }}
              />
            </div>

            {/* Hoặc nhập URL trực tiếp */}
            {!form.imageUrl && (
              <div className="mt-2 space-y-2">
                <label className="block text-xs text-[#94A3B8] mb-1">Hoặc dán URL ảnh trực tiếp</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={form.imageUrl}
                  onChange={set('imageUrl')}
                  className="w-full px-3 py-2 rounded-[8px] border border-[#E2E8F0] text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#121212]/20"
                />
                <input
                  type="text"
                  placeholder="Style persona (optional)"
                  value={form.imageStyle}
                  onChange={set('imageStyle')}
                  className="w-full px-3 py-2 rounded-[8px] border border-[#E2E8F0] text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#121212]/20"
                />
              </div>
            )}

            {/* Tìm & chọn ảnh từ Unsplash (tải về S3) */}
            <button
              type="button"
              onClick={() => setShowUnsplash((v) => !v)}
              className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-[#121212] hover:underline"
            >
              <Search size={12} />
              {showUnsplash ? 'Ẩn tìm Unsplash' : 'Tìm ảnh trên Unsplash'}
            </button>
            {showUnsplash && (
              <UnsplashPicker
                wordId={word.id}
                baseForm={form.baseForm || word.baseForm}
                onAttached={(url) => {
                  setForm((f) => ({ ...f, imageUrl: url, imageSource: 'UNSPLASH' }))
                  setShowUnsplash(false)
                }}
              />
            )}

            <div className="mt-3 text-xs text-[#64748B] flex flex-wrap gap-2">
              <span className="px-2 py-1 rounded bg-[#F1F5F9]">Source: {form.imageSource}</span>
              {form.imageStyle && <span className="px-2 py-1 rounded bg-[#F1F5F9]">Style: {form.imageStyle}</span>}
            </div>

          </section>

          {/* Thông tin cơ bản */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#94A3B8] mb-3">Thông tin cơ bản</h3>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Từ gốc (base_form)" value={form.baseForm} onChange={set('baseForm')} />
              <Field label="Phát âm IPA" value={form.phonetic} onChange={set('phonetic')} />
              <Select label="Cấp độ CEFR" value={form.cefrLevel} onChange={set('cefrLevel')} opts={['A1','A2','B1','B2','C1','C2']} />
              <Select label="Loại từ" value={form.dtype} onChange={set('dtype') as never} opts={['Noun','Verb','Adjective','Word']} />
            </div>
          </section>

          {/* Giống (chỉ Noun) */}
          {(form.dtype === 'Noun' || word.dtype === 'Noun') && (
            <section>
              <h3 className="text-xs font-bold uppercase tracking-widest text-[#94A3B8] mb-3">Danh từ</h3>
              <div className="grid grid-cols-2 gap-3">
                <Select label="Giống (Gender)" value={form.gender} onChange={set('gender') as never} opts={['DER','DIE','DAS']} />
                <Field label="Số nhiều (Plural)" value={form.pluralForm} onChange={set('pluralForm')} />
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
              <Field label="Nghĩa tiếng Việt" value={form.meaningVi} onChange={set('meaningVi')} />
              <Field label="Nghĩa tiếng Anh" value={form.meaningEn} onChange={set('meaningEn')} />
            </div>
          </section>

          {/* Ví dụ */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#94A3B8] mb-3">Ví dụ câu</h3>
            <div className="grid grid-cols-1 gap-3">
              <Field label="Ví dụ tiếng Đức (example_de)" value={form.exampleDe} onChange={set('exampleDe')} rows={2} />
              <Field label="Ví dụ tiếng Anh (example_en)" value={form.exampleEn} onChange={set('exampleEn')} rows={2} />
            </div>
          </section>

          {/* Cách dùng */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#94A3B8] mb-3">Cách sử dụng</h3>
            <Field label="Ghi chú cách dùng (usage_note)" value={form.usageNote} onChange={set('usageNote')} rows={3} />
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
