'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Paperclip, Download, Mic, Clock, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import api, { apiMessage } from '@/lib/api'
import { aiSpeakingApi } from '@/lib/aiSpeakingApi'
import { useChatStore } from '@/stores/useChatStore'
import { fetchClassAssignments, type StudentAssignment } from '@/lib/studentClassesApi'
import { GaPageHdr, GaBtn, GaCap } from '@/components/ui-v2'

// ─────────────────────────────────────────────────────────────────────────────
// Bài tập — nộp & phản hồi (GaAssignment, proto-classroom.jsx) — student↔teacher,
// yellow. Plumbing reused 1:1 (zero backend): fetchClassAssignments (find by
// assignmentId) + presigned-url GET → S3 PUT → POST /v2/students/assignments/{id}/submit
// + (SPEAKING_SCENARIO) scenario→aiSpeakingApi.createSession→/speaking/chat.
// Option-1: proto per-dimension rubric (Phát âm/Ngữ pháp/Nội dung) + waveform are
// fictional → single 0-100 score + teacher feedback (same basis as teacher grading).
// Backend allows submit only while PENDING (409 otherwise) → no re-submit after graded.
// ─────────────────────────────────────────────────────────────────────────────

const fmtDate = (d: string | null | undefined) => (d ? format(new Date(d), 'dd/MM/yyyy') : '—')
const fmtDateTime = (d: string | null | undefined) => (d ? format(new Date(d), 'dd/MM/yyyy HH:mm') : '—')

function statusLabel(s: string): { label: string; color: string } {
  const v = (s ?? '').toUpperCase()
  if (v === 'GRADED') return { label: 'Đã chấm', color: 'var(--ga-green)' }
  if (v === 'GRADING_FAILED') return { label: 'Chấm lỗi', color: 'var(--ga-red)' }
  if (v === 'SUBMITTED' || v === 'GRADING') return { label: 'Đã nộp · chờ chấm', color: '#2F6FC9' }
  return { label: 'Chưa nộp', color: 'var(--ga-orange)' }
}

export default function V2AssignmentPage() {
  const params = useParams()
  const router = useRouter()
  const classId = Number(params.id)
  const assignmentId = Number(params.aid)
  const { setSessionId, setExperienceLevel } = useChatStore()

  const [a, setA] = useState<StudentAssignment | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [content, setContent] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const list = await fetchClassAssignments(classId)
      const found = list.find((x) => x.assignmentId === assignmentId) ?? null
      if (!found) setError('Không tìm thấy bài tập trong lớp này.')
      else { setA(found); setError('') }
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      setLoading(false)
    }
  }, [classId, assignmentId])

  useEffect(() => { void load() }, [load])

  const uploadToS3 = async (f: File): Promise<string> => {
    const { data } = await api.get<{ url: string; objectKey: string }>(
      `/v2/students/assignments/presigned-url?assignmentId=${assignmentId}&filename=${encodeURIComponent(f.name)}&contentType=${encodeURIComponent(f.type)}`,
    )
    const res = await fetch(data.url, { method: 'PUT', body: f, headers: { 'Content-Type': f.type } })
    if (!res.ok) throw new Error('Tải file lên thất bại')
    return data.url.split('?')[0]
  }

  const submit = async () => {
    if (!content.trim() && !file) { toast.error('Vui lòng nhập nội dung hoặc đính kèm file bài làm.'); return }
    setBusy(true)
    try {
      let submissionFileUrl = ''
      if (file) submissionFileUrl = await uploadToS3(file)
      await api.post(`/v2/students/assignments/${assignmentId}/submit`, { submissionContent: content, submissionFileUrl })
      toast.success('Nộp bài thành công!')
      setContent(''); setFile(null)
      await load()
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const startSpeakingAi = async () => {
    if (!a) return
    setBusy(true)
    try {
      const { data: sc } = await api.get(`/v2/students/assignments/${a.assignmentId}/scenario`)
      const fullTopic = `Chủ đề: ${sc.topic}\n\nMô tả chi tiết: ${sc.scenarioDescription}\n\nGợi ý: ${sc.followUpQuestions}`
      const session = await aiSpeakingApi.createSession(fullTopic, sc.level, 'DEFAULT', 'V1', 'LESSON', null, null, a.id)
      setSessionId(session.data.id)
      setExperienceLevel(null)
      router.push('/speaking/chat')
    } catch {
      toast.error('Không thể bắt đầu phiên luyện nói. Vui lòng thử lại.')
      setBusy(false)
    }
  }

  const st = a ? statusLabel(a.status) : { label: '', color: '' }
  const isPending = (a?.status ?? '').toUpperCase() === 'PENDING'
  const isGraded = (a?.status ?? '').toUpperCase() === 'GRADED'
  const isSpeaking = (a?.assignmentType ?? '').toUpperCase() === 'SPEAKING_SCENARIO'

  return (
    <div className="flex min-h-screen flex-col">
      <GaPageHdr
        accent
        title={a?.topic ?? (loading ? 'Đang tải…' : 'Bài tập')}
        subtitle={a ? `${a.assignmentType} · giao bởi giáo viên` : ''}
        right={
          <div className="flex items-center gap-2.5">
            {a && <span className="ga-ui px-3 py-[7px] text-[11.5px] font-bold" style={{ color: st.color, background: 'var(--ga-side-active)' }}>{st.label}</span>}
            <GaBtn variant="ghost" size="sm" onClick={() => router.push(`/v2/student/classes/${classId}`)}><ArrowLeft size={14} /> Về lớp học</GaBtn>
          </div>
        }
      />

      <div className="flex-1 overflow-auto px-10 py-7">
        {loading ? (
          <div className="ga-shimmer h-[280px] max-w-[1000px] border border-ga-line" aria-hidden />
        ) : error ? (
          <div className="max-w-[640px] border border-ga-line bg-ga-card px-10 py-[44px] text-center">
            <p className="ga-ui text-[14px] text-ga-red">{error}</p>
            <GaBtn variant="primary" className="mt-4" onClick={load}>Thử lại</GaBtn>
          </div>
        ) : a ? (
          <div className="grid max-w-[1000px] grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_320px]">
            <div className="flex flex-col gap-[18px]">
              {/* Instructions */}
              <div className="border border-ga-line bg-ga-card px-6 py-[22px]">
                <GaCap className="mb-3 block">Yêu cầu của giáo viên</GaCap>
                <p className="mb-3.5 text-[15px] leading-relaxed text-ga-ink">{a.description || 'Giáo viên chưa thêm mô tả chi tiết.'}</p>
                <div className="flex flex-wrap gap-4 text-[13px] text-ga-muted">
                  <span>Hạn nộp: <strong className="text-ga-ink">{fmtDate(a.dueDate)}</strong></span>
                  <span>Thang điểm: <strong className="text-ga-ink">100</strong></span>
                </div>
                {a.attachmentUrl && (
                  <a href={a.attachmentUrl} target="_blank" rel="noopener noreferrer" className="ga-ui mt-3.5 inline-flex items-center gap-2 border border-ga-line px-3 py-2 text-[13px] font-semibold text-ga-ink transition-colors hover:bg-ga-surface">
                    <Download size={14} /> Tải tài liệu đính kèm
                  </a>
                )}
              </div>

              {/* Submission / feedback */}
              {isPending ? (
                <div className="border border-ga-line bg-ga-card p-6">
                  <GaCap className="mb-4 block">Bài nộp của bạn</GaCap>
                  {isSpeaking && (
                    <div className="mb-4 flex items-center gap-4 border border-dashed border-ga-line bg-ga-bg p-5">
                      <span className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-full" style={{ background: 'var(--ga-red)' }}><Mic size={20} className="text-white" /></span>
                      <div className="min-w-0">
                        <div className="text-[14.5px] font-semibold text-ga-ink">Luyện nói trực tiếp với AI</div>
                        <div className="mt-0.5 text-[13px] text-ga-muted">Mở kịch bản phỏng vấn, AI sẽ tạo phiên rồi tự nộp kết quả.</div>
                      </div>
                      <GaBtn variant="ghost" size="sm" className="ml-auto shrink-0" loading={busy} disabled={busy} onClick={startSpeakingAi}>Luyện với AI →</GaBtn>
                    </div>
                  )}
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={6}
                    placeholder="Nhập câu trả lời / bài làm của bạn bằng tiếng Đức…"
                    className="ga-ui w-full resize-y border border-ga-line bg-ga-bg px-4 py-3 text-[14.5px] text-ga-ink outline-none focus:border-ga-ink"
                  />
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <input ref={fileRef} type="file" className="hidden" onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f && f.size > 10 * 1024 * 1024) { toast.error('File quá lớn (tối đa 10MB).'); return }
                      setFile(f ?? null)
                    }} />
                    <GaBtn variant="ghost" size="sm" onClick={() => fileRef.current?.click()}><Paperclip size={14} /> {file ? 'Đổi file' : 'Đính kèm file'}</GaBtn>
                    {file && <span className="ga-ui truncate text-[13px] text-ga-muted">{file.name}</span>}
                    <GaBtn variant="yellow" size="sm" className="ml-auto" loading={busy} disabled={busy} onClick={submit}>Nộp bài cho giáo viên</GaBtn>
                  </div>
                </div>
              ) : isGraded ? (
                <div className="border border-ga-line bg-ga-card p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <GaCap>Phản hồi từ giáo viên</GaCap>
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-ga-display text-[40px] font-medium" style={{ color: 'var(--ga-green)' }}>{a.teacherScore ?? '—'}</span>
                      <span className="text-[14px] text-ga-muted">/100</span>
                    </div>
                  </div>
                  {a.teacherFeedback ? (
                    <div className="border-l-[3px] p-4" style={{ background: 'rgba(124,86,200,0.10)', borderColor: '#7C56C8' }}>
                      <p className="m-0 text-[14.5px] leading-relaxed text-ga-ink">{a.teacherFeedback}</p>
                    </div>
                  ) : (
                    <p className="text-[14px] text-ga-muted">Giáo viên chưa để lại nhận xét chi tiết.</p>
                  )}
                  {a.submissionContent && (
                    <>
                      <GaCap className="mb-2 mt-5 block">Bài bạn đã nộp</GaCap>
                      <p className="whitespace-pre-wrap border border-ga-line bg-ga-bg p-4 text-[14px] leading-relaxed text-ga-ink">{a.submissionContent}</p>
                    </>
                  )}
                  {a.submissionFileUrl && (
                    <a href={a.submissionFileUrl} target="_blank" rel="noopener noreferrer" className="ga-ui mt-3 inline-flex items-center gap-2 border border-ga-line px-3 py-2 text-[13px] font-semibold text-ga-ink hover:bg-ga-surface"><Download size={14} /> File đã nộp</a>
                  )}
                </div>
              ) : (
                // submitted / grading / failed
                <div className="border border-ga-line bg-ga-card p-6">
                  <GaCap className="mb-4 block">Bài nộp của bạn</GaCap>
                  {a.submissionContent && <p className="mb-4 whitespace-pre-wrap border border-ga-line bg-ga-bg p-4 text-[14px] leading-relaxed text-ga-ink">{a.submissionContent}</p>}
                  {a.submissionFileUrl && <a href={a.submissionFileUrl} target="_blank" rel="noopener noreferrer" className="ga-ui mb-4 inline-flex items-center gap-2 border border-ga-line px-3 py-2 text-[13px] font-semibold text-ga-ink hover:bg-ga-surface"><Download size={14} /> File đã nộp</a>}
                  <div className="flex items-center gap-3 border p-3.5" style={{ background: 'rgba(47,111,201,0.08)', borderColor: 'rgba(47,111,201,0.25)' }}>
                    <Clock size={18} style={{ color: '#2F6FC9' }} />
                    <div>
                      <div className="text-[14px] font-semibold text-ga-ink">Đã nộp — đang chờ giáo viên chấm</div>
                      <div className="mt-0.5 text-[12.5px] text-ga-muted">Nộp lúc {fmtDateTime(a.submittedAt)}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Side meta */}
            <div className="border border-ga-line bg-ga-card px-[22px] py-5">
              <GaCap className="mb-3.5 block">Thông tin bài tập</GaCap>
              {([
                ['Loại', a.assignmentType || '—'],
                ['Hạn nộp', fmtDate(a.dueDate)],
                ['Trạng thái', st.label],
                ['Nộp lúc', a.submittedAt ? fmtDateTime(a.submittedAt) : '—'],
                ['Điểm', a.teacherScore != null ? `${a.teacherScore}/100` : '—'],
              ] as [string, string][]).map(([k, v], i) => (
                <div key={k} className="flex justify-between py-[9px] text-[13.5px]" style={{ borderTop: i ? '1px solid var(--ga-line)' : 'none' }}>
                  <span className="text-ga-muted">{k}</span>
                  <span className="font-medium text-ga-ink">{v}</span>
                </div>
              ))}
              {isGraded && (
                <div className="mt-3 flex items-center gap-1.5 text-[12.5px]" style={{ color: 'var(--ga-green)' }}>
                  <CheckCircle2 size={14} /> Bài đã được chấm xong
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
