'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import api, { apiMessage } from '@/lib/api'
import { updateProfile } from '@/lib/profileApi'
import { GaPageHdr, GaBtn, GaCap } from '@/components/ui-v2'
import { cn } from '@/lib/utils'

const VIOLET = '#7C56C8'
const TABS = [
  { id: 'info', label: 'Thông tin' },
  { id: 'avail', label: 'Lịch dạy' },
  { id: 'reviews', label: 'Đánh giá' },
] as const
type TabId = (typeof TABS)[number]['id']

const AVAIL_DAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
const AVAIL_SLOTS = ['Sáng', 'Chiều', 'Tối']

interface Me {
  displayName: string
  email: string
  role: string
  locale: string
  industry: string | null
  orgId: number | null
}

function initials(name: string): string {
  const p = (name || '').trim().split(/\s+/)
  if (p.length === 1) return (p[0]?.slice(0, 2) || 'GV').toUpperCase()
  return (p[0][0] + p[p.length - 1][0]).toUpperCase()
}

export default function V2TeacherProfilePage() {
  const [me, setMe] = useState<Me | null>(null)
  const [classCount, setClassCount] = useState(0)
  const [studentCount, setStudentCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TabId>('info')
  const [edit, setEdit] = useState(false)
  const [saving, setSaving] = useState(false)
  // form (info tab) + availability (client-side — no teacher-availability endpoint yet)
  const [name, setName] = useState('')
  const [locale, setLocale] = useState('vi')
  const [avail, setAvail] = useState<Record<string, boolean>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [meRes, clsRes] = await Promise.all([
        api.get('/auth/me'),
        api.get('/v2/teacher/classes').catch(() => ({ data: [] })),
      ])
      const m = (meRes.data ?? {}) as Record<string, unknown>
      const u: Me = {
        displayName: String(m.displayName ?? ''),
        email: String(m.email ?? ''),
        role: String(m.role ?? ''),
        locale: String(m.locale ?? 'vi'),
        industry: (m.industry as string | null) ?? null,
        orgId: (m.orgId as number | null) ?? null,
      }
      setMe(u)
      setName(u.displayName)
      setLocale(u.locale)
      const classes = (clsRes.data ?? []) as Record<string, unknown>[]
      setClassCount(classes.length)
      setStudentCount(classes.reduce((a, c) => a + (Number(c.studentCount) || 0), 0))
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const openCount = useMemo(() => Object.values(avail).filter(Boolean).length, [avail])

  const onPrimary = async () => {
    if (!edit) {
      setEdit(true)
      return
    }
    setSaving(true)
    try {
      await updateProfile({ displayName: name.trim() || undefined, locale })
      toast.success('Đã lưu hồ sơ')
      setEdit(false)
      await load()
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const ROLE_LABEL: Record<string, string> = { TEACHER: 'Giáo viên', ADMIN: 'Quản trị viên', STUDENT: 'Học viên' }
  const fields: [string, React.ReactNode, boolean][] = me
    ? [
        ['Họ và tên', name, true],
        ['Email', me.email, false],
        ['Vai trò', ROLE_LABEL[me.role] ?? me.role, false],
        ['Ngôn ngữ', locale, true],
        ['Ngành', me.industry || 'Chưa cập nhật', false],
        ['Tổ chức', me.orgId ? `#${me.orgId}` : 'Cá nhân', false],
      ]
    : []

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        title="Hồ sơ giáo viên"
        subtitle="Thông tin hiển thị với học viên và tổ chức"
        right={
          <GaBtn variant={edit ? 'yellow' : 'ghost'} disabled={saving || loading} onClick={onPrimary}>
            {edit ? (saving ? 'Đang lưu…' : 'Lưu thay đổi') : 'Chỉnh sửa'}
          </GaBtn>
        }
      />

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-ga-line bg-ga-card px-10">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'relative -mb-px border-b-2 px-4 py-3.5 text-[13.5px] font-semibold transition-colors',
              tab === t.id
                ? 'border-ga-accent text-ga-ink'
                : 'border-transparent text-ga-muted hover:text-ga-ink',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto px-10 py-7">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[300px_1fr] xl:items-start">
          {/* Left card — persists across tabs */}
          <div className="border border-ga-line bg-ga-card p-7 text-center">
            <span
              className="mx-auto mb-4 grid h-[90px] w-[90px] place-items-center rounded-full font-ga-display text-[34px] font-medium text-white"
              style={{ background: VIOLET }}
            >
              {me ? initials(me.displayName) : '–'}
            </span>
            <div className="text-[20px] font-bold text-ga-ink">{me?.displayName || '—'}</div>
            <div className="mb-4 mt-1 text-[13.5px] text-ga-muted">
              {ROLE_LABEL[me?.role ?? ''] ?? me?.role} {me?.orgId ? `· Tổ chức #${me.orgId}` : '· Cá nhân'}
            </div>
            <div className="mb-4 flex border border-ga-line">
              {[
                [classCount, 'Lớp'],
                [studentCount, 'Học viên'],
                ['—', 'Đánh giá'],
              ].map(([v, l], i) => (
                <div key={l as string} className={cn('flex-1 py-3', i && 'border-l border-ga-line')}>
                  <div className="font-ga-display text-[18px] font-medium text-ga-ink">{v}</div>
                  <div className="mt-[3px] text-[10.5px] text-ga-muted">{l}</div>
                </div>
              ))}
            </div>
            <div className="text-left">
              <GaCap className="mb-2 block">Ngành chuyên môn</GaCap>
              <div className="flex flex-wrap gap-1.5">
                <span className="border border-ga-line px-[9px] py-[5px] text-[11px] font-semibold text-ga-muted">
                  {me?.industry || 'Chưa cập nhật'}
                </span>
              </div>
            </div>
          </div>

          {/* Right content by tab */}
          {tab === 'info' && (
            <div className="border border-ga-line bg-ga-card px-8 py-7">
              <GaCap className="mb-5 block">Thông tin chuyên môn</GaCap>
              <div className="grid grid-cols-1 gap-x-[22px] sm:grid-cols-2">
                {fields.map(([label, value, editable]) => (
                  <div key={label} className="mb-[18px]">
                    <label className="mb-[7px] block text-[12.5px] font-semibold text-ga-muted">{label}</label>
                    {edit && editable ? (
                      <input
                        value={label === 'Ngôn ngữ' ? locale : name}
                        onChange={(e) => (label === 'Ngôn ngữ' ? setLocale(e.target.value) : setName(e.target.value))}
                        className="block w-full rounded-ga border border-ga-line bg-ga-bg px-3.5 py-2.5 text-[15px] text-ga-ink outline-none"
                      />
                    ) : (
                      <div className="text-[15.5px] font-medium text-ga-ink">{value}</div>
                    )}
                  </div>
                ))}
              </div>
              <p className="mt-2 border-t border-ga-line pt-4 text-[11.5px] text-ga-subtle">
                Giới thiệu &amp; chứng chỉ chi tiết — sắp ra mắt (cần mở rộng hồ sơ ở backend).
              </p>
            </div>
          )}

          {tab === 'avail' && (
            <div className="border border-ga-line bg-ga-card px-8 py-7">
              <div className="mb-[18px] flex items-center justify-between">
                <GaCap>Khung giờ nhận dạy 1:1</GaCap>
                <span className="text-[13px] text-ga-muted">{openCount} khung đang mở</span>
              </div>
              <div className="grid gap-1.5" style={{ gridTemplateColumns: '70px repeat(7, minmax(0, 1fr))' }}>
                <div />
                {AVAIL_DAYS.map((d) => (
                  <div key={d} className="pb-1 text-center text-[11.5px] font-bold text-ga-ink">
                    {d}
                  </div>
                ))}
                {AVAIL_SLOTS.map((slot, si) => (
                  <div key={slot} className="contents">
                    <div className="flex items-center text-[12px] font-semibold text-ga-muted">{slot}</div>
                    {AVAIL_DAYS.map((_, di) => {
                      const k = `${di}-${si}`
                      const on = !!avail[k]
                      return (
                        <button
                          key={k}
                          type="button"
                          onClick={() => setAvail((a) => ({ ...a, [k]: !a[k] }))}
                          className="h-[46px] border text-[13px] font-bold transition-colors"
                          style={{
                            borderColor: on ? VIOLET : 'var(--ga-line)',
                            background: on ? 'var(--ga-violet-soft)' : 'transparent',
                            color: on ? VIOLET : 'var(--ga-faint)',
                          }}
                        >
                          {on ? '✓' : ''}
                        </button>
                      )
                    })}
                  </div>
                ))}
              </div>
              <div className="mt-[18px] flex gap-2.5">
                <GaBtn variant="yellow" onClick={() => toast('Lưu lịch rảnh (sắp ra mắt — chờ backend availability)')}>
                  Lưu lịch
                </GaBtn>
                <GaBtn variant="ghost" onClick={() => setAvail({})}>
                  Xoá hết
                </GaBtn>
              </div>
            </div>
          )}

          {tab === 'reviews' && (
            <div className="border border-dashed border-ga-line px-10 py-[52px] text-center">
              <div className="font-ga-display text-[20px] italic text-ga-muted">Chưa có đánh giá</div>
              <p className="ga-ui mx-auto mt-2 max-w-sm text-[13.5px] text-ga-subtle">
                Đánh giá của học viên sẽ hiển thị ở đây (cần endpoint đánh giá giáo viên — backlog backend).
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
