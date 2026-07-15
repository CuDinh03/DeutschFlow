'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
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
// labelKey resolves via t('tab…'); id drives tab logic (stable).
const ALL_TABS: { id: Tab; labelKey: 'tabInfo' | 'tabLearning' | 'tabSecurity' }[] = [
  { id: 'info', labelKey: 'tabInfo' },
  { id: 'learning', labelKey: 'tabLearning' },
  { id: 'security', labelKey: 'tabSecurity' },
]
// MANAGER/OWNER/ADMIN không có learning profile → ẩn tab Học tập
// A teacher has no learner "learning profile" tab — like admins/org roles. (Teachers were previously
// routed to a separate /v2/teacher/profile that had no password form at all, which is why they were the
// only role that couldn't change their password; they now use this shared page.)
const ROLES_WITHOUT_LEARNING = new Set(['ADMIN', 'OWNER', 'MANAGER', 'TEACHER'])

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
// v = API enum value (logic key, stays as-is); labelKey resolves the display via t(labelKey).
const SPEEDS = [
  { v: 'SLOW', labelKey: 'speedSlow' },
  { v: 'NORMAL', labelKey: 'speedNormal' },
  { v: 'FAST', labelKey: 'speedFast' },
] as const
const GOALS = [
  { v: 'WORK', labelKey: 'goalWork' },
  { v: 'CERT', labelKey: 'goalCert' },
] as const

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
  const t = useTranslations('v2.account.profile')
  const storeUser = useUserStore((s) => s.user)
  const setLocaleStore = useUserStore((s) => s.setLocale)

  const TABS = ALL_TABS.filter(
    (tab) => tab.id !== 'learning' || !ROLES_WITHOUT_LEARNING.has(storeUser?.roles?.[0] ?? '')
  )
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
      toast.success(t('savedInfo'))
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t('saveError'))
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
      toast.success(t('savedLearning'))
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t('saveError'))
    } finally {
      setSavingLp(false)
    }
  }

  const savePw = async () => {
    if (newPw.length < 8) {
      toast.error(t('passwordTooShort'))
      return
    }
    setSavingPw(true)
    try {
      await changePassword({ currentPassword: curPw, newPassword: newPw })
      setCurPw('')
      setNewPw('')
      toast.success(t('savedPassword'))
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t('passwordError'))
    } finally {
      setSavingPw(false)
    }
  }

  const setLp2 = (patch: Partial<LearningProfileData>) => setLp((prev) => (prev ? { ...prev, ...patch } : prev))

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr accent title={t('title')} subtitle={t('subtitle')} />
      <div className="flex-1 px-10 py-6">
        {/* Tabs */}
        <div className="mb-6 flex gap-2">
          {TABS.map((tabItem) => (
            <button
              key={tabItem.id}
              type="button"
              onClick={() => setTab(tabItem.id)}
              className={`ga-ui rounded-ga border px-[14px] py-2 text-[13px] font-semibold transition-colors ${
                tab === tabItem.id
                  ? 'border-ga-ink bg-ga-ink text-ga-card'
                  : 'border-ga-border bg-ga-card text-ga-muted hover:border-ga-ink hover:text-ga-ink'
              }`}
            >
              {t(tabItem.labelKey)}
            </button>
          ))}
        </div>

        {loading ? (
          <LoadingState label={t('loading')} />
        ) : (
          <GaCard className="max-w-2xl p-7">
            {tab === 'info' && (
              <div className="space-y-5">
                <Field label={t('fieldDisplayName')}>
                  <input className={inputCls} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                </Field>
                <Field label={t('fieldEmail')} hint={t('fieldEmailHint')}>
                  <input className={`${inputCls} opacity-60`} value={email} disabled />
                </Field>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <Field label={t('fieldPhone')}>
                    <input
                      className={inputCls}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder={t('phonePlaceholder')}
                    />
                  </Field>
                  <Field label={t('fieldLanguage')}>
                    <select className={inputCls} value={locale} onChange={(e) => setLocale(e.target.value)}>
                      <option value="vi">{t('langVi')}</option>
                      <option value="en">{t('langEn')}</option>
                      <option value="de">{t('langDe')}</option>
                    </select>
                  </Field>
                </div>
                <GaBtn variant="primary" onClick={saveInfo} disabled={savingInfo}>
                  {savingInfo ? t('saving') : t('saveChanges')}
                </GaBtn>
              </div>
            )}

            {tab === 'learning' &&
              (lp ? (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <Field label={t('fieldGoal')}>
                      <select
                        className={inputCls}
                        value={lp.goalType ?? ''}
                        onChange={(e) => setLp2({ goalType: e.target.value })}
                      >
                        <option value="">{t('selectPlaceholder')}</option>
                        {GOALS.map((g) => (
                          <option key={g.v} value={g.v}>
                            {t(g.labelKey)}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label={t('fieldTargetLevel')}>
                      <select
                        className={inputCls}
                        value={lp.targetLevel ?? ''}
                        onChange={(e) => setLp2({ targetLevel: e.target.value })}
                      >
                        <option value="">{t('selectPlaceholder')}</option>
                        {LEVELS.map((l) => (
                          <option key={l} value={l}>
                            {l}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <Field label={t('fieldIndustry')} hint={t('industryHint')}>
                    <input
                      className={inputCls}
                      value={lp.industry ?? ''}
                      onChange={(e) => setLp2({ industry: e.target.value })}
                    />
                  </Field>
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                    <Field label={t('fieldLearningSpeed')}>
                      <select
                        className={inputCls}
                        value={lp.learningSpeed ?? ''}
                        onChange={(e) => setLp2({ learningSpeed: e.target.value })}
                      >
                        <option value="">{t('selectPlaceholder')}</option>
                        {SPEEDS.map((s) => (
                          <option key={s.v} value={s.v}>
                            {t(s.labelKey)}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label={t('fieldSessionsPerWeek')}>
                      <input
                        type="number"
                        min={1}
                        max={14}
                        className={inputCls}
                        value={lp.sessionsPerWeek || ''}
                        onChange={(e) => setLp2({ sessionsPerWeek: Number(e.target.value) })}
                      />
                    </Field>
                    <Field label={t('fieldMinutesPerSession')}>
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
                    {savingLp ? t('saving') : t('saveGoal')}
                  </GaBtn>
                </div>
              ) : (
                <p className="ga-ui py-6 text-[14px] text-ga-muted">{t('noLearningProfile')}</p>
              ))}

            {tab === 'security' && (
              <div className="max-w-md space-y-5">
                <Field label={t('fieldCurrentPassword')}>
                  <input
                    type="password"
                    className={inputCls}
                    value={curPw}
                    onChange={(e) => setCurPw(e.target.value)}
                    autoComplete="current-password"
                  />
                </Field>
                <Field label={t('fieldNewPassword')} hint={t('newPasswordHint')}>
                  <input
                    type="password"
                    className={inputCls}
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    autoComplete="new-password"
                  />
                </Field>
                <GaBtn variant="primary" onClick={savePw} disabled={savingPw || !curPw || !newPw}>
                  {savingPw ? t('changingPassword') : t('changePassword')}
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
