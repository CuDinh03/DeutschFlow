'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import api from '@/lib/api'
import {
  updateProfile,
  changePassword,
  getMyLearningProfile,
  updateLearningProfile,
  type LearningProfileData,
} from '@/lib/profileApi'
import { useUserStore } from '@/stores/useUserStore'
import { GaPageHdr, GaBtn, GaCard, LoadingState } from '@/components/ui-v2'
import { RoleShell } from '../RoleShell'

type Tab = 'info' | 'learning' | 'security'
const TABS: { id: Tab; label: string }[] = [
  { id: 'info', label: 'Thông tin' },
  { id: 'learning', label: 'Học tập' },
  { id: 'security', label: 'Bảo mật' },
]

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

function Field({
  label,
  children,
  hint,
}: {
  label: string
  children: React.ReactNode
  hint?: string
}) {
  return (
    <label className="block">
      <span className="ga-ui mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.06em] text-ga-muted">
        {label}
      </span>
      {children}
      {hint && <span className="ga-ui mt-1 block text-[12px] text-ga-subtle">{hint}</span>}
    </label>
  )
}

const inputCls =
  'ga-ui w-full rounded-ga border border-ga-line bg-ga-card px-3.5 py-2.5 text-[14px] text-ga-ink outline-none transition-colors focus:border-ga-accent'

function ProfileBody() {
  const storeUser = useUserStore((s) => s.user)
  const setLocaleStore = useUserStore((s) => s.setLocale)

  const [tab, setTab] = useState<Tab>('info')
  const [loading, setLoading] = useState(true)

  // info
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [locale, setLocale] = useState('vi')
  const [savingInfo, setSavingInfo] = useState(false)

  // learning
  const [lp, setLp] = useState<LearningProfileData | null>(null)
  const [savingLp, setSavingLp] = useState(false)

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
        /* learning profile optional */
      }
      if (!cancelled) setLoading(false)
    })()
    return () => { cancelled = true }
  }, [storeUser])

  const saveInfo = async () => {
    setSavingInfo(true)
    try {
      await updateProfile({ displayName, phoneNumber: phone || undefined, locale })
      setLocaleStore(locale)
      toast.success('Đã lưu thông tin cá nhân.')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Không thể lưu.')
    } finally {
      setSavingInfo(false)
    }
  }

  const saveLearning = async () => {
    if (!lp) return
    setSavingLp(true)
    try {
      const updated = await updateLearningProfile({
        goalType: lp.goalType ?? undefined,
        targetLevel: lp.targetLevel ?? undefined,
        industry: lp.industry ?? undefined,
        learningSpeed: lp.learningSpeed ?? undefined,
        sessionsPerWeek: lp.sessionsPerWeek,
        minutesPerSession: lp.minutesPerSession,
      })
      setLp(updated)
      toast.success('Đã lưu mục tiêu học tập.')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Không thể lưu.')
    } finally {
      setSavingLp(false)
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

  const setLp2 = (patch: Partial<LearningProfileData>) => setLp((prev) => (prev ? { ...prev, ...patch } : prev))

  return (
    <div className="flex min-h-screen flex-col">
      <GaPageHdr accent title="Hồ sơ" subtitle="Thông tin cá nhân, mục tiêu học tập và bảo mật" />
      <div className="flex-1 px-10 py-6">
        {/* Tabs */}
        <div className="mb-6 flex gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`ga-ui rounded-ga border px-[14px] py-2 text-[13px] font-semibold transition-colors ${
                tab === t.id
                  ? 'border-ga-ink bg-ga-ink text-ga-card'
                  : 'border-ga-border bg-ga-card text-ga-muted hover:border-ga-ink hover:text-ga-ink'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <LoadingState label="Đang tải hồ sơ…" />
        ) : (
          <GaCard className="max-w-2xl p-7">
            {tab === 'info' && (
              <div className="space-y-5">
                <Field label="Tên hiển thị">
                  <input className={inputCls} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                </Field>
                <Field label="Email" hint="Email đăng nhập không thể thay đổi tại đây.">
                  <input className={`${inputCls} opacity-60`} value={email} disabled />
                </Field>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <Field label="Số điện thoại">
                    <input
                      className={inputCls}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="0xxxxxxxxx"
                    />
                  </Field>
                  <Field label="Ngôn ngữ">
                    <select className={inputCls} value={locale} onChange={(e) => setLocale(e.target.value)}>
                      <option value="vi">Tiếng Việt</option>
                      <option value="en">English</option>
                      <option value="de">Deutsch</option>
                    </select>
                  </Field>
                </div>
                <GaBtn variant="primary" onClick={saveInfo} disabled={savingInfo}>
                  {savingInfo ? 'Đang lưu…' : 'Lưu thay đổi'}
                </GaBtn>
              </div>
            )}

            {tab === 'learning' &&
              (lp ? (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <Field label="Mục tiêu">
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
                    </Field>
                    <Field label="Trình độ mục tiêu">
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
                    </Field>
                  </div>
                  <Field label="Lĩnh vực / Ngành" hint="Ví dụ: Điều dưỡng, Cơ khí, Du học…">
                    <input
                      className={inputCls}
                      value={lp.industry ?? ''}
                      onChange={(e) => setLp2({ industry: e.target.value })}
                    />
                  </Field>
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                    <Field label="Tốc độ học">
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
                    </Field>
                    <Field label="Buổi / tuần">
                      <input
                        type="number"
                        min={1}
                        max={14}
                        className={inputCls}
                        value={lp.sessionsPerWeek || ''}
                        onChange={(e) => setLp2({ sessionsPerWeek: Number(e.target.value) })}
                      />
                    </Field>
                    <Field label="Phút / buổi">
                      <input
                        type="number"
                        min={5}
                        max={120}
                        step={5}
                        className={inputCls}
                        value={lp.minutesPerSession || ''}
                        onChange={(e) => setLp2({ minutesPerSession: Number(e.target.value) })}
                      />
                    </Field>
                  </div>
                  <GaBtn variant="primary" onClick={saveLearning} disabled={savingLp}>
                    {savingLp ? 'Đang lưu…' : 'Lưu mục tiêu'}
                  </GaBtn>
                </div>
              ) : (
                <p className="ga-ui py-6 text-[14px] text-ga-muted">Chưa có hồ sơ học tập.</p>
              ))}

            {tab === 'security' && (
              <div className="max-w-md space-y-5">
                <Field label="Mật khẩu hiện tại">
                  <input
                    type="password"
                    className={inputCls}
                    value={curPw}
                    onChange={(e) => setCurPw(e.target.value)}
                    autoComplete="current-password"
                  />
                </Field>
                <Field label="Mật khẩu mới" hint="Tối thiểu 8 ký tự.">
                  <input
                    type="password"
                    className={inputCls}
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    autoComplete="new-password"
                  />
                </Field>
                <GaBtn variant="primary" onClick={savePw} disabled={savingPw || !curPw || !newPw}>
                  {savingPw ? 'Đang đổi…' : 'Đổi mật khẩu'}
                </GaBtn>
              </div>
            )}
          </GaCard>
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
