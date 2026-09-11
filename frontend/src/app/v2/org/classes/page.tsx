'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Plus } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { apiMessage } from '@/lib/api'
import { getOrgSummary, getTeacherlessClassIds, listClasses, type OrgClass, type OrgSummary } from '@/lib/orgApi'
import { GaPageHdr, GaBtn, GaCap, TkSearch } from '@/components/ui-v2'
import { CreateClassModal } from './CreateClassModal'
import { OrgWriteGate } from '../../OrgLicenseGate'
import { CLASSES_PAGE_SIZE } from './pagination'

// ─────────────────────────────────────────────────────────────────────────────
// Lớp học của tổ chức (GaOrgClasses) — teal, class LIST.
// Plumbing: orgApi.listClasses → Page<OrgClass> { id, name, inviteCode, teacherId, createdAt };
//   "Tạo lớp" → POST /org/classes (chọn tên + giáo viên phụ trách, CreateClassModal).
// Option-1: OrgClass has no teacher NAME / LEVEL / student count / avg score → dropped
//   (the proto's level/students/avg columns aren't backed).
// PR-A2 (BF-03, 07/09/2026): phân trang thật thay `listClasses(0, 100)` cứng. Trang đầu PAGE_SIZE
//   lớp, nút "Tải thêm" nối trang kế; đếm "đã tải N/M"; tìm kiếm + huy hiệu "chưa có GV" nói rõ
//   chỉ tính trên phần đã tải.
// PR-A3 (07/09/2026): tìm kiếm chạy PHÍA MÁY CHỦ (`q`) — gõ tên một lớp ở trang 3 nay tìm thấy,
//   trước đó chỉ lọc trên phần đã tải nên ra rỗng và người dùng tưởng lớp không tồn tại.
// V-01 (08/09/2026): nhãn "chưa phân công" TỪNG DÒNG bỏ `teacherId == null` (cột NOT NULL, không
//   bao giờ đúng) và lấy từ `getTeacherlessClassIds()` — cùng định nghĩa với con số tổng. Huy hiệu
//   thiếu GV nay BẤM ĐƯỢC: bật bộ lọc `withoutTeacher` của máy chủ để ra đúng danh sách lớp đó,
//   và `?withoutTeacher=1` mở sẵn bộ lọc khi tới từ bảng điều khiển.
// ─────────────────────────────────────────────────────────────────────────────

const TEAL = '#11888A'
const fmtDate = (d: string | null | undefined) => (d ? format(new Date(d), 'dd/MM/yyyy') : '—')

export default function V2OrgClassesPage() {
  const t = useTranslations('v2.org.classes')
  const tc = useTranslations('v2.common')
  const router = useRouter()
  const [classes, setClasses] = useState<OrgClass[]>([])
  const [total, setTotal] = useState(0)
  const [nextPage, setNextPage] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [summary, setSummary] = useState<OrgSummary | null>(null)
  // null = chưa biết (chưa tải xong / lỗi) — KHÔNG được đọc thành "lớp nào cũng đã có GV".
  const [teacherlessIds, setTeacherlessIds] = useState<Set<number> | null>(null)
  const [onlyTeacherless, setOnlyTeacherless] = useState(false)

  // Từ khoá ĐÃ CHỐT để gửi lên máy chủ (hoãn sau khi ngừng gõ) — tách khỏi `query` là thứ ô nhập
  // hiển thị, để mỗi phím gõ không thành một request.
  const [appliedQuery, setAppliedQuery] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const page = await listClasses(0, CLASSES_PAGE_SIZE, { q: appliedQuery, ...(onlyTeacherless ? { withoutTeacher: true } : {}) })
      setClasses(page.content ?? [])
      setTotal(page.totalElements ?? (page.content ?? []).length)
      setNextPage(page.last === false ? (page.number ?? 0) + 1 : null)
      setError('')
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      setLoading(false)
    }
  }, [appliedQuery, onlyTeacherless])

  const loadMore = useCallback(async () => {
    if (nextPage == null || loadingMore) return
    setLoadingMore(true)
    try {
      const page = await listClasses(nextPage, CLASSES_PAGE_SIZE, { q: appliedQuery, ...(onlyTeacherless ? { withoutTeacher: true } : {}) })
      setClasses((prev) => {
        const seen = new Set(prev.map((c) => c.id))
        return [...prev, ...(page.content ?? []).filter((c) => !seen.has(c.id))]
      })
      setTotal(page.totalElements ?? total)
      setNextPage(page.last === false ? (page.number ?? nextPage) + 1 : null)
    } catch (e: unknown) {
      toast.error(`${t('loadMoreError')} ${apiMessage(e)}`)
    } finally {
      setLoadingMore(false)
    }
  }, [nextPage, loadingMore, total, t, appliedQuery, onlyTeacherless])

  // 300 ms sau khi ngừng gõ mới hỏi máy chủ. `load` phụ thuộc `appliedQuery` nên effect dưới tự chạy lại.
  useEffect(() => {
    const id = setTimeout(() => setAppliedQuery(query.trim()), 300)
    return () => clearTimeout(id)
  }, [query])

  // Số "thiếu GV" đếm trên TOÀN trung tâm nên không phụ thuộc phân trang hay từ khoá.
  const loadOrgWide = useCallback(() => {
    getOrgSummary().then(setSummary).catch(() => setSummary(null))
    getTeacherlessClassIds().then(setTeacherlessIds).catch(() => setTeacherlessIds(null))
  }, [])
  useEffect(() => { loadOrgWide() }, [loadOrgWide])

  // Deep-link từ bảng điều khiển: `?withoutTeacher=1` mở thẳng danh sách lớp chưa ai dạy. Đọc bằng
  // `window.location` chứ không `useSearchParams()` để trang không phải bọc Suspense khi prerender.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (new URLSearchParams(window.location.search).get('withoutTeacher') === '1') setOnlyTeacherless(true)
  }, [])

  useEffect(() => { void load() }, [load])

  // Máy chủ đã lọc theo `appliedQuery` (PR-A3) nên KHÔNG lọc lại ở đây. Lọc hai lần sẽ làm mất kết
  // quả trong khoảng 300 ms chờ: `query` mới còn `classes` vẫn là kết quả của từ khoá cũ.
  const rows = classes
  // `teacherId == null` KHÔNG BAO GIỜ đúng: cột teacher_id là NOT NULL trong CSDL, nên huy hiệu này
  // đã im lặng hiện 0 từ đầu. Nay lấy số THẬT từ máy chủ (PR-A3): "thiếu GV" = không còn ai đang là
  // giáo viên ACTIVE của trung tâm đứng lớp đó — giáo viên đã rời thì lớp cần người mới.
  const unassigned = summary?.classesWithoutTeacher ?? 0
  // Khi bộ lọc đang bật thì MỌI dòng trả về đều là lớp chưa ai dạy — khỏi phụ thuộc trần của tập id.
  const teacherlessOf = (id: number): boolean | null =>
    onlyTeacherless ? true : teacherlessIds == null ? null : teacherlessIds.has(id)
  const allLoaded = nextPage == null
  const remaining = Math.max(total - classes.length, 0)

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        title={t('title')}
        subtitle={t('subtitle')}
        right={
          // D5: trung tâm chỉ-đọc thì nút "Tạo lớp" bị VÔ HIỆU HOÁ chứ không bị giấu — người dùng
          // phải thấy chức năng còn đó và biết vì sao nó không bấm được (xem OrgWriteGate).
          <OrgWriteGate>
            <GaBtn variant="yellow" size="sm" onClick={() => setShowCreate(true)}>
              <Plus size={15} /> {t('createClass')}
            </GaBtn>
          </OrgWriteGate>
        }
      />

      <div className="flex-1 overflow-auto px-4 py-6 sm:px-6 lg:px-10">
        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <GaCap>{allLoaded ? t('count', { count: rows.length }) : t('loadedOf', { loaded: classes.length, total })}</GaCap>
            {(unassigned > 0 || onlyTeacherless) && (
              // Bấm vào con số là ra ĐÚNG danh sách đó (bộ lọc `withoutTeacher` phía máy chủ) — trước
              // đây con số đứng im, người dùng không có đường nào đi từ cảnh báo tới việc cần làm.
              <button
                type="button"
                aria-pressed={onlyTeacherless}
                onClick={() => setOnlyTeacherless((v) => !v)}
                className="ga-ui inline-flex min-h-[32px] items-center border px-2 py-0.5 text-[11px] font-bold transition-colors"
                style={{
                  color: 'var(--ga-red)',
                  background: onlyTeacherless ? 'transparent' : 'var(--ga-red-soft)',
                  borderColor: onlyTeacherless ? 'var(--ga-red)' : 'transparent',
                }}
              >
                {onlyTeacherless ? t('unassignedFilterOn') : t('unassignedBadge', { count: unassigned })}
              </button>
            )}
          </div>
          <TkSearch value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('searchPlaceholder')} containerClassName="w-full sm:w-[220px]" />
        </div>
        {/* ĐÃ GỠ lời nhắc "chỉ tìm trong phần đã tải": từ PR-A3 máy chủ tìm trên TOÀN trung tâm,
            giữ câu đó lại là nói sai với người dùng. Khoá `searchHint` cũng đã gỡ khỏi catalog. */}

        {loading ? (
          <div className="flex flex-col gap-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="ga-shimmer h-[54px] border border-ga-line" aria-hidden />)}</div>
        ) : error ? (
          <div className="border border-ga-line bg-ga-card px-4 py-8 sm:px-8 lg:px-10 lg:py-[52px] text-center">
            <h2 className="font-ga-display text-[20px] font-medium text-ga-red lg:text-[24px]">{t('loadError')}</h2>
            <p className="ga-ui mx-auto mb-5 mt-3 max-w-sm break-words text-[14px] text-ga-muted">{error} <code className="font-mono text-[12px] text-ga-accent">GET /api/org/classes</code></p>
            <GaBtn variant="primary" onClick={load}>{tc('retry')}</GaBtn>
          </div>
        ) : rows.length === 0 ? (
          <div className="border border-dashed border-ga-line px-4 py-8 text-center text-[14px] text-ga-muted sm:px-8 lg:px-10 lg:py-[40px]">
            {onlyTeacherless ? t('emptyTeacherless') : classes.length === 0 ? t('emptyOrg') : t('emptySearch')}
          </div>
        ) : (
          <div className="overflow-x-auto border border-ga-line bg-ga-card lg:overflow-visible">
            <div className="grid min-w-[760px] items-center gap-2 border-b border-ga-line bg-ga-bg px-5 py-[11px] lg:min-w-0" style={{ gridTemplateColumns: '1.6fr 150px 130px 120px 84px' }}>
              {[t('colClass'), t('colTeacher'), t('colCode'), t('colCreated'), ''].map((h, i) => (
                <span key={i} className="ga-ui text-[10px] font-bold uppercase tracking-[0.1em] text-ga-muted">{h}</span>
              ))}
            </div>
            {rows.map((c, i) => (
              <div key={c.id} className="grid min-w-[760px] items-center gap-2 px-5 py-3.5 transition-colors hover:bg-ga-surface lg:min-w-0" style={{ gridTemplateColumns: '1.6fr 150px 130px 120px 84px', borderTop: i ? '1px solid var(--ga-line)' : 'none' }}>
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="grid h-8 w-8 shrink-0 place-items-center font-ga-display text-[14px] font-medium" style={{ color: TEAL, background: 'var(--ga-teal-soft)' }}>{(c.name[0] ?? 'L').toUpperCase()}</span>
                  <span className="min-w-0 truncate text-[14px] font-semibold text-ga-ink">{c.name}</span>
                </div>
                <span>
                  {teacherlessOf(c.id) === null ? (
                    // Chưa biết thì nói là chưa biết — không được mặc định thành "đã phân công".
                    <span className="text-ga-small text-ga-subtle">—</span>
                  ) : teacherlessOf(c.id) ? (
                    <span className="px-2 py-0.5 text-[11px] font-bold" style={{ color: 'var(--ga-red)', background: 'var(--ga-red-soft)' }}>{t('unassigned')}</span>
                  ) : (
                    <span className="text-[13px] text-ga-muted">{t('assigned')}</span>
                  )}
                </span>
                <span>{c.inviteCode ? <code className="bg-ga-ink px-2 py-1 text-[11px] font-semibold tracking-[0.06em] text-ga-yellow">{c.inviteCode}</code> : <span className="text-[12px] text-ga-subtle">—</span>}</span>
                <span className="text-[12.5px] text-ga-muted">{fmtDate(c.createdAt)}</span>
                <button type="button" onClick={() => router.push(`/v2/org/classes/${c.id}`)} className="ga-ui inline-flex min-h-[40px] items-center justify-center justify-self-end border border-ga-line px-2.5 py-1.5 text-[11px] font-semibold text-ga-muted transition-colors hover:border-ga-accent hover:text-ga-accent lg:min-h-0">
                  {t('detail')}
                </button>
              </div>
            ))}
          </div>
        )}

        {!loading && !error && !allLoaded && (
          <div className="mt-3 flex justify-center">
            <GaBtn variant="ghost" size="sm" disabled={loadingMore} onClick={loadMore}>
              {loadingMore ? tc('loading') : t('loadMore', { remaining })}
            </GaBtn>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateClassModal onClose={() => setShowCreate(false)} onCreated={() => { void load(); loadOrgWide() }} />
      )}
    </div>
  )
}
