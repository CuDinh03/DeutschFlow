'use client'

import { useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { toast } from 'sonner'
import {
  updateProfile,
  changePassword,
  getMyLearningProfile,
  updateLearningProfile,
  getPersonalProfile,
  declareBirthDate,
  revokeOtherSessions,
  deleteMyAccount,
  BIRTH_DATE_SELF_DECLARE_ENABLED,
  type LearningProfileData,
} from '@/lib/profileApi'
import { clearTokens, setTokens } from '@/lib/authSession'
import { useUserStore } from '@/stores/useUserStore'
import { GaPageHdr, GaBtn, GaCard, LoadingState, ConfirmDialog } from '@/components/ui-v2'
import { RoleShell } from '../RoleShell'
import { AvatarSection } from './AvatarSection'
import { timezoneOptionsFor, deviceTimezone, canonicalTimezone } from './timezones'
import { REMINDER_HOURS } from '@/features/onboarding/starterChecklist'

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
// currentLevel nhận thêm A0 (mới bắt đầu) — enum CurrentLevel phía backend.
const CURRENT_LEVELS = ['A0', ...LEVELS]
// Giá trị examType khớp onboarding (EXAMS). Nhãn là danh từ riêng — không cần i18n.
const EXAM_TYPES = [
  { v: 'GOETHE', label: 'Goethe' },
  { v: 'TELC', label: 'telc' },
  { v: 'TESTDAF', label: 'TestDaF' },
] as const
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
      <span className="ga-ui mb-1.5 block text-ga-eyebrow uppercase text-ga-muted">
        {label}
      </span>
      {children}
      {hint && <span className="ga-ui mt-1 block text-ga-caption text-ga-subtle">{hint}</span>}
    </label>
  )
}

/**
 * ISO yyyy-MM-dd → ngày đọc được theo ngôn ngữ giao diện.
 *
 * 🪤 Dựng Date từ BA SỐ RỜI chứ không `new Date('1996-03-05')`: dạng chuỗi đó được hiểu là nửa đêm
 * UTC, nên ở mọi múi giờ âm nó lùi thành 04/03 — đúng loại lỗi "lệch một ngày" khó thấy nhất.
 */
function formatIsoDate(iso: string, locale: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(new Date(y, m - 1, d))
  } catch {
    return iso
  }
}

const inputCls =
  'ga-ui w-full rounded-ga border border-ga-line bg-ga-card px-3.5 py-2.5 text-ga-body text-ga-ink outline-none transition-colors focus:border-ga-accent'

function ProfileBody() {
  const t = useTranslations('v2.account.profile')
  const uiLocale = useLocale()
  const storeUser = useUserStore((s) => s.user)
  const setUserStore = useUserStore((s) => s.setUser)
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
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [timezone, setTimezone] = useState('Asia/Ho_Chi_Minh')
  // Đợt 6 (W11): '' = chưa chọn (server NULL ⇒ 18:00 mặc định); số = giờ 0–23.
  const [reminderHour, setReminderHour] = useState<number | ''>('')
  const [savingInfo, setSavingInfo] = useState(false)

  // birth date — ghi MỘT LẦN (backend chặn lần hai), nên có nút lưu riêng + hộp thoại xác nhận
  const [birthDate, setBirthDate] = useState('')
  const [birthDateLocked, setBirthDateLocked] = useState(false)
  const [confirmBirthDate, setConfirmBirthDate] = useState(false)
  const [savingBirthDate, setSavingBirthDate] = useState(false)

  // learning
  const [lp, setLp] = useState<LearningProfileData | null>(null)
  const [savingLp, setSavingLp] = useState(false)

  // security
  const [curPw, setCurPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [savingPw, setSavingPw] = useState(false)
  const [confirmRevoke, setConfirmRevoke] = useState(false)
  const [revoking, setRevoking] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  /** Backend chặn xoá (409 — còn là thành viên trung tâm): giữ nguyên văn để nói rõ phải làm gì. */
  const [deleteBlocked, setDeleteBlocked] = useState<string | null>(null)

  // Chỉ nạp form MỘT lần khi vào trang. Trước đây deps [storeUser] vô hại vì store không đổi
  // trong lúc ở trang này; nay upload/gỡ avatar cập nhật store (cho sidebar đổi ngay) — thiếu
  // guard này effect sẽ refetch và ĐÈ các ô đang gõ dở (displayName/phone…) sau mỗi lần đổi ảnh.
  // Ref chỉ được đặt SAU khi nạp xong (không phải trước fetch) để lần mount kép của StrictMode
  // không bỏ trang ở trạng thái loading vĩnh viễn.
  const loadedRef = useRef(false)
  useEffect(() => {
    if (loadedRef.current) return
    let cancelled = false
    ;(async () => {
      try {
        // /profile/me (không phải /auth/me): chỉ endpoint này trả ngày sinh và múi giờ thông báo.
        const me = await getPersonalProfile()
        if (!cancelled) {
          setDisplayName(me.displayName || storeUser?.displayName || '')
          setEmail(me.email || storeUser?.email || '')
          setPhone(me.phoneNumber ?? '')
          setLocale((me.locale || 'vi').toLowerCase())
          setBirthDate(me.birthDate ?? '')
          setBirthDateLocked(me.birthDateLocked)
          // Chưa đặt múi giờ ⇒ gợi ý theo thiết bị, nhưng KHÔNG tự lưu: đổi giờ thông báo sau lưng
          // người dùng là thay đổi hành vi họ không yêu cầu.
          // Chuẩn hoá luôn: DB có thể đang giữ tên cũ (Asia/Saigon) mà danh sách chọn dùng tên
          // chuẩn — không quy về một mối thì <select> không khớp option nào và hiện ô trống.
          setTimezone(
            canonicalTimezone(me.notificationTimezone || deviceTimezone() || 'Asia/Ho_Chi_Minh')
          )
          setReminderHour(typeof me.reminderHourLocal === 'number' ? me.reminderHourLocal : '')
          const serverAvatar = me.avatarUrl || null
          setAvatarUrl(serverAvatar)
          // Store persist từ phiên đăng nhập cũ có thể chưa có avatarUrl — đồng bộ để sidebar hiện ảnh.
          if (storeUser && (storeUser.avatarUrl ?? null) !== serverAvatar) {
            setUserStore({ ...storeUser, avatarUrl: serverAvatar ?? undefined })
          }
        }
      } catch {
        if (!cancelled) {
          setDisplayName(storeUser?.displayName ?? '')
          setEmail(storeUser?.email ?? '')
          setAvatarUrl(storeUser?.avatarUrl ?? null)
        }
      }
      try {
        const profile = await getMyLearningProfile()
        if (!cancelled) setLp(profile)
      } catch {
        /* learning profile optional */
      }
      if (!cancelled) {
        loadedRef.current = true
        setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [storeUser, setUserStore])

  const saveInfo = async () => {
    setSavingInfo(true)
    try {
      await updateProfile({
        displayName,
        phoneNumber: phone || undefined,
        locale,
        notificationTimezone: timezone || undefined,
        // -1 = bỏ giờ nhắc (server ghi NULL). Gửi luôn để chọn 'Mặc định' cũng lưu được.
        reminderHourLocal: reminderHour === '' ? -1 : reminderHour,
      })
      setLocaleStore(locale)
      // Đồng bộ store để sidebar đổi tên ngay (loadedRef chặn refetch nên không đè form).
      if (storeUser) setUserStore({ ...storeUser, displayName })
      toast.success(t('savedInfo'))
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t('saveError'))
    } finally {
      setSavingInfo(false)
    }
  }

  const saveBirthDate = async () => {
    setSavingBirthDate(true)
    try {
      const result = await declareBirthDate(birthDate)
      setBirthDate(result.birthDate)
      setBirthDateLocked(true)
      setConfirmBirthDate(false)
      toast.success(result.requiresGuardianConsent ? t('birthDateSavedMinor') : t('birthDateSaved'))
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t('saveError'))
    } finally {
      setSavingBirthDate(false)
    }
  }

  const doRevokeOthers = async () => {
    setRevoking(true)
    try {
      const refreshed = await revokeOtherSessions()
      // BẮT BUỘC: backend vừa thu hồi SẠCH refresh token, kể cả của phiên này. Không nạp cặp mới
      // thì chính tab đang mở sẽ rụng ở lần refresh kế tiếp.
      setTokens(refreshed)
      setConfirmRevoke(false)
      toast.success(t('revokedOthers'))
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t('saveError'))
    } finally {
      setRevoking(false)
    }
  }

  const doDeleteAccount = async () => {
    setDeleting(true)
    try {
      await deleteMyAccount()
      clearTokens()
      // Về trang chủ chứ không về trang đăng nhập: tài khoản không còn, mời đăng nhập là vô nghĩa.
      window.location.href = '/'
    } catch (e: unknown) {
      // 409 của AccountDeletionGuard nói rõ phải rời trung tâm trước — hiện nguyên văn, đừng nuốt.
      setDeleteBlocked(e instanceof Error ? e.message : t('saveError'))
      setConfirmDelete(false)
      setDeleting(false)
    }
  }

  /** Avatar đổi (upload/gỡ) → cập nhật form + store để chip sidebar đổi ảnh tức thì. */
  const onAvatarChange = (url: string | null) => {
    setAvatarUrl(url)
    if (storeUser) setUserStore({ ...storeUser, avatarUrl: url ?? undefined })
  }

  const saveLearning = async () => {
    if (!lp) return
    setSavingLp(true)
    try {
      const updated = await updateLearningProfile({
        goalType: lp.goalType ?? undefined,
        targetLevel: lp.targetLevel ?? undefined,
        currentLevel: lp.currentLevel ?? undefined,
        // Chuỗi rỗng (chọn "— Chọn —") = xoá kỳ thi mục tiêu phía backend (blankToNull).
        examType: lp.examType ?? '',
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
      <div className="flex-1 px-4 py-6 sm:px-6 lg:px-10">
        {/* Tabs */}
        <div className="mb-6 flex flex-wrap gap-2">
          {TABS.map((tabItem) => (
            <button
              key={tabItem.id}
              type="button"
              onClick={() => setTab(tabItem.id)}
              className={`ga-ui min-h-[40px] rounded-ga border px-[14px] py-2 text-ga-small font-semibold transition-colors lg:min-h-0 ${
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
          <GaCard className="max-w-2xl p-5 lg:p-7">
            {tab === 'info' && (
              <div className="space-y-5">
                <AvatarSection displayName={displayName} avatarUrl={avatarUrl} onChange={onAvatarChange} />
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
                <Field label={t('fieldTimezone')} hint={t('timezoneHint')}>
                  <select className={inputCls} value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                    {timezoneOptionsFor(timezone).map((zone) => (
                      <option key={zone} value={zone}>
                        {zone.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t('fieldReminderHour')} hint={t('reminderHourHint')}>
                  <select
                    className={inputCls}
                    value={reminderHour === '' ? '' : String(reminderHour)}
                    onChange={(e) => setReminderHour(e.target.value === '' ? '' : Number(e.target.value))}
                    data-testid="profile-reminder-hour"
                  >
                    <option value="">{t('reminderHourNone')}</option>
                    {REMINDER_HOURS.map((h) => (
                      <option key={h} value={h}>
                        {t('reminderHourAt', { hour: String(h).padStart(2, '0') })}
                      </option>
                    ))}
                  </select>
                </Field>
                <GaBtn variant="primary" onClick={saveInfo} disabled={savingInfo}>
                  {savingInfo ? t('saving') : t('saveChanges')}
                </GaBtn>

                {/* Ngày sinh đi endpoint riêng và chỉ ghi được một lần — tách hẳn khỏi form trên
                    để không ai tưởng nút "Lưu thay đổi" cũng lưu nó. */}
                {BIRTH_DATE_SELF_DECLARE_ENABLED && (
                <div className="border-t border-ga-line pt-5">
                  <Field
                    label={t('fieldBirthDate')}
                    hint={birthDateLocked ? t('birthDateLockedHint') : t('birthDateHint')}
                  >
                    <input
                      type="date"
                      className={`${inputCls} ${birthDateLocked ? 'opacity-60' : ''} sm:max-w-xs`}
                      value={birthDate}
                      max={new Date().toISOString().slice(0, 10)}
                      disabled={birthDateLocked}
                      onChange={(e) => setBirthDate(e.target.value)}
                    />
                  </Field>
                  {!birthDateLocked && (
                    <GaBtn
                      variant="ghost"
                      className="mt-3"
                      disabled={!birthDate || savingBirthDate}
                      onClick={() => setConfirmBirthDate(true)}
                    >
                      {savingBirthDate ? t('saving') : t('saveBirthDate')}
                    </GaBtn>
                  )}
                </div>
                )}
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
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <Field label={t('fieldCurrentLevel')} hint={t('currentLevelHint')}>
                      <select
                        className={inputCls}
                        value={lp.currentLevel ?? ''}
                        onChange={(e) => setLp2({ currentLevel: e.target.value || null })}
                      >
                        <option value="">{t('selectPlaceholder')}</option>
                        {CURRENT_LEVELS.map((l) => (
                          <option key={l} value={l}>
                            {l === 'A0' ? t('currentLevelA0') : l}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label={t('fieldExamType')}>
                      <select
                        className={inputCls}
                        value={lp.examType ?? ''}
                        onChange={(e) => setLp2({ examType: e.target.value || null })}
                      >
                        <option value="">{t('selectPlaceholder')}</option>
                        {EXAM_TYPES.map((exam) => (
                          <option key={exam.v} value={exam.v}>
                            {exam.label}
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
                <p className="ga-ui py-6 text-ga-body text-ga-muted">{t('noLearningProfile')}</p>
              ))}

            {tab === 'security' && (
              <div className="space-y-8">
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

              {/* Phiên đăng nhập */}
              <div className="max-w-md border-t border-ga-line pt-6">
                <h3 className="ga-ui text-ga-body font-semibold text-ga-ink">{t('sessionsTitle')}</h3>
                <p className="ga-ui mt-1 text-ga-small text-ga-muted">{t('sessionsDesc')}</p>
                <GaBtn variant="ghost" className="mt-3" disabled={revoking} onClick={() => setConfirmRevoke(true)}>
                  {revoking ? t('revoking') : t('revokeOthers')}
                </GaBtn>
              </div>

              {/* Vùng nguy hiểm — xoá vĩnh viễn */}
              <div className="max-w-md rounded-ga border border-ga-red/40 bg-ga-red/5 p-5">
                <h3 className="ga-ui text-ga-body font-semibold text-ga-red">{t('dangerTitle')}</h3>
                <p className="ga-ui mt-1 text-ga-small text-ga-muted">{t('deleteAccountDesc')}</p>
                {deleteBlocked && (
                  <p
                    role="alert"
                    className="ga-ui mt-3 rounded-ga border border-ga-line bg-ga-card px-3 py-2 text-ga-small text-ga-ink"
                  >
                    {deleteBlocked}
                  </p>
                )}
                <GaBtn
                  variant="ghost"
                  className="mt-3 text-ga-red hover:bg-ga-red hover:text-ga-card"
                  disabled={deleting}
                  onClick={() => {
                    setDeleteBlocked(null)
                    setConfirmDelete(true)
                  }}
                >
                  {t('deleteAccount')}
                </GaBtn>
              </div>
              </div>
            )}
          </GaCard>
        )}
      </div>

      <ConfirmDialog
        open={confirmBirthDate}
        onOpenChange={setConfirmBirthDate}
        title={t('confirmBirthDateTitle')}
        description={t('confirmBirthDateDesc', { date: formatIsoDate(birthDate, uiLocale) })}
        details={[t('confirmBirthDateDetail1'), t('confirmBirthDateDetail2'), t('confirmBirthDateDetail3')]}
        destructive={false}
        confirmLabel={t('saveBirthDate')}
        cancelLabel={t('cropCancel')}
        loading={savingBirthDate}
        onConfirm={saveBirthDate}
      />

      <ConfirmDialog
        open={confirmRevoke}
        onOpenChange={setConfirmRevoke}
        title={t('revokeOthers')}
        description={t('confirmRevokeDesc')}
        details={[t('confirmRevokeDetail1'), t('confirmRevokeDetail2')]}
        destructive={false}
        confirmLabel={t('revokeOthers')}
        cancelLabel={t('cropCancel')}
        loading={revoking}
        onConfirm={doRevokeOthers}
      />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t('confirmDeleteTitle')}
        description={t('confirmDeleteDesc')}
        details={[t('confirmDeleteDetail1'), t('confirmDeleteDetail2'), t('confirmDeleteDetail3')]}
        confirmLabel={t('deleteAccount')}
        cancelLabel={t('cropCancel')}
        loading={deleting}
        onConfirm={doDeleteAccount}
      />
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
