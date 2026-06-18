'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import api from '@/lib/api'
import {
  updateProfile,
  changePassword,
  getMyLearningProfile,
  updateLearningProfile,
  type LearningProfileData,
} from '@/lib/profileApi'
import { xpApi, type XpSummaryDto } from '@/lib/xpApi'
import { useUserStore } from '@/stores/useUserStore'
import { GaPageHdr, GaBtn, GaCap, LoadingState } from '@/components/ui-v2'
import { RoleShell } from '../RoleShell'

// Reskin of proto GaProfile (proto-student-extra.jsx): editorial 2-col layout —
// left avatar card + level/XP stat-strip + plan card; right inline-editable info grid + badges.
// /v2/profile is a shared RoleShell screen → the gamified blocks (stat-strip, plan, badges)
// render for STUDENT only; other roles get an honest role/org card. Plumbing reused 1:1:
// /auth/me · getMyLearningProfile · updateProfile · updateLearningProfile · changePassword · xpApi.

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
const SPEEDS = [
  { v: 'SLOW', l: 'Chậm' },
  { v: 'NORMAL', l: 'Bình thường' },
  { v: 'FAST', l: 'Nhanh' },
]
const GOALS = [
  { v: 'WORK', l: 'Công việc / Nghề nghiệp' },
  { v: 'CERT', l: 'Chứng chỉ (Goethe…)' },
]

const SPEED_LABEL = (v: string | null) => SPEEDS.find((s) => s.v === v)?.l ?? '—'
const GOAL_LABEL = (v: string | null) => GOALS.find((g) => g.v === v)?.l ?? '—'

const inputCls =
  'ga-ui w-full rounded-ga border border-ga-line bg-ga-bg px-3.5 py-2.5 text-[14.5px] text-ga-ink outline-none transition-colors focus:border-ga-accent'

function GridField({
  label,
  edit,
  value,
  children,
}: {
  label: string
  edit: boolean
  value: string
  children?: React.ReactNode
}) {
  return (
    <div className="mb-[18px]">
      <span className="ga-ui mb-1.5 block text-[12.5px] font-semibold uppercase tracking-[0.05em] text-ga-muted">
        {label}
      </span>
      {edit && children ? children : <span className="text-[15.5px] font-medium text-ga-ink">{value || '—'}</span>}
    </div>
  )
}

function ProfileBody() {
  const router = useRouter()
  const storeUser = useUserStore((s) => s.user)
  const orgRole = useUserStore((s) => s.orgRole)
  const setLocaleStore = useUserStore((s) => s.setLocale)

  const has = (r: string) => storeUser?.roles?.some((x) => x.toUpperCase().includes(r)) ?? false
  const isStudent = !orgRole && !has('ADMIN') && !has('TEACHER')
  const roleLabel = orgRole ? 'Tổ chức' : has('ADMIN') ? 'Quản trị viên' : has('TEACHER') ? 'Giáo viên' : 'Học viên'

  const [loading, setLoading] = useState(true)
  const [edit, setEdit] = useState(false)
  const [saving, setSaving] = useState(false)

  // info
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [locale, setLocale] = useState('vi')
  // learning + gamification
  const [lp, setLp] = useState<LearningProfileData | null>(null)
  const [xp, setXp] = useState<XpSummaryDto | null>(null)
  // security
  const [curPw, setCurPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [savingPw, setSavingPw] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const me = (await api.get('/auth/me')).data as Record<string, unknown>
        if (!cancelled) {
          setDisplayName(String(me.displayName ?? storeUser?.displayName ?? ''))
          setEmail(String(me.email ?? storeUser?.email ?? ''))
          setPhone(String(me.phoneNumber ?? ''))
          setLocale(String(me.locale ?? 'vi'))
        }
      } catch {
        if (!cancelled) {
          setDisplayName(storeUser?.displayName ?? '')
          setEmail(storeUser?.email ?? '')
        }
      }
      try {
        const profile = await getMyLearningProfile()
        if (!cancelled) setLp(profile)
      } catch {
        /* learning profile optional (non-students) */
      }
      try {
        const summary = await xpApi.getMyXp()
        if (!cancelled) setXp(summary)
      } catch {
        /* xp optional (non-students) */
      }
      if (!cancelled) setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [storeUser])

  const setLp2 = (patch: Partial<LearningProfileData>) => setLp((prev) => (prev ? { ...prev, ...patch } : prev))

  const saveAll = async () => {
    setSaving(true)
    try {
      await updateProfile({ displayName, phoneNumber: phone || undefined, locale })
      setLocaleStore(locale)
      if (lp) {
        await updateLearningProfile({
          goalType: lp.goalType ?? undefined,
          targetLevel: lp.targetLevel ?? undefined,
          industry: lp.industry ?? undefined,
          learningSpeed: lp.learningSpeed ?? undefined,
        })
      }
      toast.success('Đã lưu hồ sơ.')
      setEdit(false)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Không thể lưu.')
    } finally {
      setSaving(false)
    }
  }

  const savePw = async () => {
    if (newPw.length < 8) {
      toast.error('Mật khẩu mới phải có ít nhất 8 ký tự.')
      return
    }
    setSavingPw(true)
    try {
      await changePassword({ currentPassword: curPw, newPassword: newPw })
      setCurPw('')
      setNewPw('')
      toast.success('Đã đổi mật khẩu.')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Không thể đổi mật khẩu.')
    } finally {
      setSavingPw(false)
    }
  }

  const initial = (displayName || email || '?').trim().charAt(0).toUpperCase()
  const unlockedBadges = (xp?.achievements ?? []).filter((a) => a.unlocked)
  const stats = isStudent
    ? [
        { v: lp?.currentLevel ?? '—', l: 'Trình độ' },
        { v: xp ? `Lv ${xp.level}` : '—', l: 'Cấp độ' },
        { v: xp ? xp.totalXp.toLocaleString('vi-VN') : '—', l: 'XP' },
      ]
    : []

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        title="Hồ sơ cá nhân"
        right={
          edit ? (
            <GaBtn variant="primary" size="sm" onClick={saveAll} loading={saving} disabled={saving}>
              {saving ? 'Đang lưu…' : 'Lưu thay đổi'}
            </GaBtn>
          ) : (
            <GaBtn variant="ghost" size="sm" onClick={() => setEdit(true)}>
              Chỉnh sửa
            </GaBtn>
          )
        }
      />
      <div className="flex-1 px-10 py-8">
        {loading ? (
          <LoadingState label="Đang tải hồ sơ…" />
        ) : (
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[280px_1fr]">
            {/* Left — avatar + stats + plan */}
            <div className="flex flex-col gap-[18px]">
              <div className="border border-ga-line bg-ga-card p-7 text-center">
                <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-ga-ink font-ga-display text-[32px] font-bold text-ga-accent">
                  {initial}
                </div>
                <div className="text-[20px] font-bold text-ga-ink">{displayName || 'Người dùng'}</div>
                <div className="ga-ui mb-4 mt-1 text-[14px] text-ga-muted">{email}</div>
                {isStudent ? (
                  <div className="flex border border-ga-line">
                    {stats.map((s, i) => (
                      <div key={s.l} className={`flex-1 py-3 text-center ${i ? 'border-l border-ga-line' : ''}`}>
                        <div className="font-ga-display text-[19px] font-medium text-ga-ink">{s.v}</div>
                        <div className="ga-ui mt-0.5 text-[10.5px] text-ga-muted">{s.l}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="ga-ui inline-block rounded-ga-pill bg-ga-accent-soft px-3 py-1 text-[12px] font-semibold text-ga-accent">
                    {roleLabel}
                  </span>
                )}
              </div>

              {isStudent && (
                <div className="border border-ga-line bg-ga-card px-5 py-[18px]">
                  <GaCap className="mb-3.5">Gói hiện tại</GaCap>
                  <div className="text-[20px] font-bold text-ga-ink">Miễn phí</div>
                  <p className="ga-ui mb-3.5 mt-1 text-[13.5px] text-ga-muted">
                    Nâng cấp để mở khoá AI không giới hạn & luyện thi đầy đủ.
                  </p>
                  <GaBtn
                    variant="primary"
                    size="sm"
                    className="w-full justify-center"
                    onClick={() => router.push('/v2/payment')}
                  >
                    Nâng cấp lên Pro →
                  </GaBtn>
                </div>
              )}
            </div>

            {/* Right — editable info grid + badges */}
            <div className="flex flex-col gap-[18px]">
              <div className="border border-ga-line bg-ga-card p-7">
                <GaCap className="mb-5">Thông tin {isStudent ? 'học tập' : 'tài khoản'}</GaCap>
                <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
                  <GridField label="Họ và tên" edit={edit} value={displayName}>
                    <input className={inputCls} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                  </GridField>
                  <GridField label="Email" edit={false} value={email} />
                  <GridField label="Số điện thoại" edit={edit} value={phone}>
                    <input
                      className={inputCls}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="0xxxxxxxxx"
                    />
                  </GridField>
                  <GridField
                    label="Ngôn ngữ"
                    edit={edit}
                    value={{ vi: 'Tiếng Việt', en: 'English', de: 'Deutsch' }[locale] ?? locale}
                  >
                    <select className={inputCls} value={locale} onChange={(e) => setLocale(e.target.value)}>
                      <option value="vi">Tiếng Việt</option>
                      <option value="en">English</option>
                      <option value="de">Deutsch</option>
                    </select>
                  </GridField>

                  {lp && (
                    <>
                      <GridField label="Ngành nghề" edit={edit} value={lp.industry ?? ''}>
                        <input
                          className={inputCls}
                          value={lp.industry ?? ''}
                          onChange={(e) => setLp2({ industry: e.target.value })}
                          placeholder="Điều dưỡng, Cơ khí…"
                        />
                      </GridField>
                      <GridField label="Mục tiêu" edit={edit} value={GOAL_LABEL(lp.goalType)}>
                        <select
                          className={inputCls}
                          value={lp.goalType ?? ''}
                          onChange={(e) => setLp2({ goalType: e.target.value })}
                        >
                          <option value="">— Chọn —</option>
                          {GOALS.map((g) => (
                            <option key={g.v} value={g.v}>
                              {g.l}
                            </option>
                          ))}
                        </select>
                      </GridField>
                      <GridField label="Trình độ hiện tại" edit={false} value={lp.currentLevel ?? '—'} />
                      <GridField label="Trình độ mục tiêu" edit={edit} value={lp.targetLevel ?? ''}>
                        <select
                          className={inputCls}
                          value={lp.targetLevel ?? ''}
                          onChange={(e) => setLp2({ targetLevel: e.target.value })}
                        >
                          <option value="">— Chọn —</option>
                          {LEVELS.map((l) => (
                            <option key={l} value={l}>
                              {l}
                            </option>
                          ))}
                        </select>
                      </GridField>
                      <GridField label="Tốc độ học" edit={edit} value={SPEED_LABEL(lp.learningSpeed)}>
                        <select
                          className={inputCls}
                          value={lp.learningSpeed ?? ''}
                          onChange={(e) => setLp2({ learningSpeed: e.target.value })}
                        >
                          <option value="">— Chọn —</option>
                          {SPEEDS.map((s) => (
                            <option key={s.v} value={s.v}>
                              {s.l}
                            </option>
                          ))}
                        </select>
                      </GridField>
                    </>
                  )}
                </div>

                {isStudent && (
                  <div className="mt-1 border-t border-ga-line pt-5">
                    <GaCap className="mb-4">Huy hiệu đã đạt được</GaCap>
                    {unlockedBadges.length ? (
                      <div className="flex flex-wrap gap-2.5">
                        {unlockedBadges.map((b) => (
                          <span
                            key={b.code}
                            className="ga-ui flex items-center gap-1.5 border border-ga-line bg-ga-bg px-3.5 py-[7px] text-[13px] font-semibold text-ga-ink"
                          >
                            <span aria-hidden>{b.iconEmoji}</span>
                            {b.nameVi}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="ga-ui text-[13.5px] text-ga-muted">Chưa có huy hiệu — học tập để mở khoá.</p>
                    )}
                  </div>
                )}
              </div>

              {/* Security */}
              <div className="border border-ga-line bg-ga-card p-7">
                <GaCap className="mb-5">Đổi mật khẩu</GaCap>
                <div className="grid max-w-md grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="ga-ui mb-1.5 block text-[12.5px] font-semibold uppercase tracking-[0.05em] text-ga-muted">
                      Mật khẩu hiện tại
                    </span>
                    <input
                      type="password"
                      className={inputCls}
                      value={curPw}
                      onChange={(e) => setCurPw(e.target.value)}
                      autoComplete="current-password"
                    />
                  </label>
                  <label className="block">
                    <span className="ga-ui mb-1.5 block text-[12.5px] font-semibold uppercase tracking-[0.05em] text-ga-muted">
                      Mật khẩu mới
                    </span>
                    <input
                      type="password"
                      className={inputCls}
                      value={newPw}
                      onChange={(e) => setNewPw(e.target.value)}
                      autoComplete="new-password"
                    />
                  </label>
                </div>
                <GaBtn
                  variant="ghost"
                  size="sm"
                  className="mt-4"
                  onClick={savePw}
                  disabled={savingPw || !curPw || !newPw}
                  loading={savingPw}
                >
                  {savingPw ? 'Đang đổi…' : 'Đổi mật khẩu'}
                </GaBtn>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function V2ProfilePage() {
  return (
    <RoleShell>
      <ProfileBody />
    </RoleShell>
  )
}
