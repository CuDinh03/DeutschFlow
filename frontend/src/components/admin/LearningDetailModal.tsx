"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import api, { apiMessage, isAxiosErr } from "@/lib/api";
import { BookOpen, Brain, Briefcase, Flame, Lock, Mic, Star, Target, Trophy, Unlock, X, ChevronDown, ChevronUp, MessageSquare, Calendar, Save, Pencil, Check, Bot, User } from "lucide-react";
import { CompleteBauhausLogo } from "@/components/BauhausLogo";
import { useFmt } from '@/lib/i18n/useFmt'

const P = {
  navy: "#121212", navyLt: "#EBF2FA", blue: "#2D9CDB", blueLt: "#EBF5FB",
  red: "#EB5757", redLt: "#FDEAEA", green: "#27AE60", greenLt: "#E8F8F0",
  purple: "#9B51E0", purpleLt: "#F4EDFF", orange: "#F2994A", orangeLt: "#FEF3E8",
  yellow: "#FFCD00", bg: "#F5F5F5", white: "#FFFFFF", text: "#0F172A",
  muted: "#64748B", border: "#E2E8F0",
};

type AchievementItem = {
  code: string; nameVi: string; descriptionVi: string;
  iconEmoji: string; xpReward: number; rarity: string; unlocked: boolean;
};

type LearningDetail = {
  learningProfile: Record<string, unknown>;
  xpGamification: Record<string, unknown> & { achievements?: AchievementItem[] };
  streak: Record<string, unknown>;
  speakingAi: Record<string, unknown>;
  vocabularySrs: Record<string, unknown>;
};

type Tab = "profile" | "xp" | "speaking" | "vocab" | "interview";

const TABS: { key: Tab; labelKey: string; icon: React.ReactNode }[] = [
  { key: "profile", labelKey: "tabs.profile", icon: <BookOpen size={14} /> },
  { key: "xp", labelKey: "tabs.xp", icon: <Flame size={14} /> },
  { key: "speaking", labelKey: "tabs.speaking", icon: <Mic size={14} /> },
  { key: "vocab", labelKey: "tabs.vocab", icon: <Brain size={14} /> },
  { key: "interview", labelKey: "tabs.interview", icon: <Briefcase size={14} /> },
];


function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-[12px] p-3 text-center" style={{ background: color + "15", border: `1px solid ${color}30` }}>
      <p className="font-black text-sm leading-none mb-1" style={{ color }}>{value}</p>
      <p className="text-[9px] font-bold uppercase tracking-wide opacity-70" style={{ color }}>{label}</p>
    </div>
  );
}

function SectionCard({ children, title, icon }: { children: React.ReactNode; title: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-[14px] bg-white p-4 shadow-sm" style={{ border: `1.5px solid ${P.border}` }}>
      <div className="flex items-center gap-2 mb-3">{icon}<h4 className="font-bold text-sm" style={{ color: P.text }}>{title}</h4></div>
      {children}
    </div>
  );
}

type EditProfileForm = {
  goalType: string; targetLevel: string; currentLevel: string;
  learningSpeed: string; industry: string;
  sessionsPerWeek: string; minutesPerSession: string;
};

function ProfileTab({ d, userId, onSaved }: { d: LearningDetail; userId: number; onSaved: () => void }) {
  const t = useTranslations('v2.adminOps.learningDetail');
  const p = d.learningProfile;
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState('');
  const [form, setForm] = useState<EditProfileForm>({
    goalType: String(p.goalType ?? 'WORK'),
    targetLevel: String(p.targetLevel ?? 'B1'),
    currentLevel: String(p.currentLevel ?? 'A0'),
    learningSpeed: String(p.learningSpeed ?? 'NORMAL'),
    industry: String(p.industry ?? ''),
    sessionsPerWeek: String(p.sessionsPerWeek ?? '3'),
    minutesPerSession: String(p.minutesPerSession ?? '30'),
  });

  const fld = (key: keyof EditProfileForm) => (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  const handleSave = async () => {
    setSaving(true); setSaveErr('');
    try {
      await api.put(`/admin/users/${userId}/learning-profile`, {
        goalType: form.goalType,
        targetLevel: form.targetLevel,
        currentLevel: form.currentLevel,
        learningSpeed: form.learningSpeed,
        industry: form.industry || null,
        sessionsPerWeek: Number(form.sessionsPerWeek),
        minutesPerSession: Number(form.minutesPerSession),
      });
      setEditing(false);
      onSaved();
    } catch (e) {
      setSaveErr(apiMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const selCls = 'w-full rounded-[8px] border px-2 py-1.5 text-xs font-medium outline-none focus:ring-2';
  const selStyle = { borderColor: P.border, background: P.white, color: P.text };

  if (editing) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] font-bold mb-1" style={{ color: P.muted }}>{t('profile.goalCap')}</p>
            <select value={form.goalType} onChange={fld('goalType')} className={selCls} style={selStyle}>
              <option value="WORK">{t('profile.goal.WORK')}</option>
              <option value="CERT">{t('profile.goal.CERT')}</option>
            </select>
          </div>
          <div>
            <p className="text-[10px] font-bold mb-1" style={{ color: P.muted }}>{t('profile.speedCap')}</p>
            <select value={form.learningSpeed} onChange={fld('learningSpeed')} className={selCls} style={selStyle}>
              <option value="SLOW">{t('profile.speed.SLOW')}</option>
              <option value="NORMAL">{t('profile.speed.NORMAL')}</option>
              <option value="FAST">{t('profile.speed.FAST')}</option>
            </select>
          </div>
          <div>
            <p className="text-[10px] font-bold mb-1" style={{ color: P.muted }}>{t('profile.currentLevelCap')}</p>
            <select value={form.currentLevel} onChange={fld('currentLevel')} className={selCls} style={selStyle}>
              {['A0','A1','A2','B1','B2','C1','C2'].map(l => <option key={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <p className="text-[10px] font-bold mb-1" style={{ color: P.muted }}>{t('profile.targetLevelCap')}</p>
            <select value={form.targetLevel} onChange={fld('targetLevel')} className={selCls} style={selStyle}>
              {['A1','A2','B1','B2','C1','C2'].map(l => <option key={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <p className="text-[10px] font-bold mb-1" style={{ color: P.muted }}>{t('profile.sessionsPerWeekCap')}</p>
            <input type="number" min={1} max={14} value={form.sessionsPerWeek} onChange={fld('sessionsPerWeek')}
              className={selCls} style={selStyle} />
          </div>
          <div>
            <p className="text-[10px] font-bold mb-1" style={{ color: P.muted }}>{t('profile.minutesPerSessionCap')}</p>
            <input type="number" min={10} max={180} value={form.minutesPerSession} onChange={fld('minutesPerSession')}
              className={selCls} style={selStyle} />
          </div>
        </div>
        <div>
          <p className="text-[10px] font-bold mb-1" style={{ color: P.muted }}>{t('profile.industryCap')}</p>
          <input type="text" value={form.industry} onChange={fld('industry')} placeholder={t('profile.industryPlaceholder')}
            className={selCls} style={selStyle} />
        </div>
        {saveErr && <p className="text-xs font-medium" style={{ color: P.red }}>{saveErr}</p>}
        <div className="flex gap-2 pt-1">
          <button onClick={handleSave} disabled={saving}
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-[10px] text-xs font-bold transition-opacity"
            style={{ background: P.navy, color: P.white, opacity: saving ? 0.6 : 1 }}>
            {saving ? t('profile.saving') : <><Save size={13} aria-hidden /> {t('profile.save')}</>}
          </button>
          <button onClick={() => { setEditing(false); setSaveErr(''); }}
            className="px-4 py-2 rounded-[10px] text-xs font-bold"
            style={{ background: P.bg, color: P.muted, border: `1px solid ${P.border}` }}>
            {t('profile.cancel')}
          </button>
        </div>
      </div>
    );
  }

  const speedKey = p.learningSpeed === 'SLOW' || p.learningSpeed === 'FAST' ? p.learningSpeed : 'NORMAL';
  const goalLabel = p.goalType === 'WORK' || p.goalType === 'CERT' ? t(`profile.goal.${p.goalType}`) : String(p.goalType ?? '—');

  return (
    <div className="space-y-4">
      {p.notConfigured ? (
        <div className="rounded-[14px] p-5 text-center" style={{ border: `2px dashed ${P.border}` }}>
          <p className="text-sm font-medium mb-1" style={{ color: P.muted }}>{t('profile.notConfigured')}</p>
          <p className="text-xs mb-3" style={{ color: P.muted }}>{t('profile.adminCanCreate')}</p>
          <button onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[10px] text-xs font-bold"
            style={{ background: P.navy, color: P.white }}>
            <Pencil size={13} aria-hidden /> {t('profile.create')}
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Stat label={t('profile.stat.currentLevel')} value={String(p.currentLevel ?? '—')} color={P.blue} />
            <Stat label={t('profile.stat.target')} value={String(p.targetLevel ?? '—')} color={P.green} />
            <Stat label={t('profile.stat.speed')} value={t(`profile.speedShort.${speedKey}`)} color={P.orange} />
          </div>
          <div className="overflow-x-auto rounded-[10px] border" style={{ borderColor: P.border }}>
            <table className="w-full text-xs">
              <tbody>{([
                [t('profile.row.goal'), goalLabel],
                [t('profile.row.currentLevel'), p.currentLevel ?? '—'],
                [t('profile.row.targetLevel'), p.targetLevel ?? '—'],
                [t('profile.row.industry'), p.industry ?? '—'],
                [t('profile.row.exam'), p.examType ?? '—'],
                [t('profile.row.sessionsPerWeek'), p.sessionsPerWeek ?? '—'],
                [t('profile.row.minutesPerSession'), p.minutesPerSession ?? '—'],
                [t('profile.row.speed'), t(`profile.speed.${speedKey}`)],
                [t('profile.row.ageRange'), String(p.ageRange ?? '—').replace('_', ' ')],
              ] as [string, string][]).map(([k, v], i) => (
                <tr key={String(k)} style={{ background: i % 2 === 0 ? P.white : '#FAFCFF' }}>
                  <td className="px-3 py-2 font-semibold" style={{ color: P.muted }}>{k}</td>
                  <td className="px-3 py-2 font-bold" style={{ color: P.text }}>{String(v)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          {Array.isArray(p.interests) && (p.interests as string[]).length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase mb-1.5" style={{ color: P.muted }}>{t('profile.interests')}</p>
              <div className="flex flex-wrap gap-1.5">{(p.interests as string[]).map(i => (
                <span key={i} className="px-2 py-1 rounded-full text-[10px] font-bold" style={{ background: '#F4EDFF', color: P.purple }}>{i}</span>
              ))}</div>
            </div>
          )}
          <div className="flex justify-end pt-1">
            <button onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[10px] text-xs font-bold transition-all hover:opacity-80"
              style={{ background: P.navyLt, color: P.navy, border: `1px solid ${P.navy}30` }}>
              <Pencil size={13} aria-hidden /> {t('profile.edit')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

const RARITY_STYLE: Record<string, { bg: string; color: string; labelKey: string }> = {
  COMMON:    { bg: '#F1F5F9', color: '#64748B', labelKey: 'xp.rarity.COMMON' },
  RARE:      { bg: '#EFF6FF', color: '#2D9CDB', labelKey: 'xp.rarity.RARE' },
  EPIC:      { bg: '#F4EDFF', color: '#9B51E0', labelKey: 'xp.rarity.EPIC' },
  LEGENDARY: { bg: '#FFF8E1', color: '#F59E0B', labelKey: 'xp.rarity.LEGENDARY' },
};

function XpTab({ d }: { d: LearningDetail }) {
  const fmt = useFmt()
  const t = useTranslations('v2.adminOps.learningDetail');
  const xp = d.xpGamification;
  const s = d.streak;
  const totalXp = Number(xp.totalXp ?? 0);
  const level = Number(xp.level ?? 1);
  const progress = Number(xp.progressInLevel ?? 0);
  const needed = Number(xp.xpNeededForNext ?? 100);
  const pct = needed > 0 ? Math.min(100, Math.round((progress / needed) * 100)) : 0;
  const achievements: AchievementItem[] = Array.isArray(xp.achievements) ? xp.achievements : [];
  const unlocked = achievements.filter(a => a.unlocked);
  const locked = achievements.filter(a => !a.unlocked);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label={t('xp.stat.totalXp')} value={fmt.num(totalXp)} color={P.purple} />
        <Stat label={t('xp.stat.level')} value={String(level)} color={P.blue} />
        <Stat label={t('xp.stat.streak')} value={t('xp.streakDays', { n: String(s.currentStreak ?? 0) })} color={P.orange} />
        <Stat label={t('xp.stat.sessions')} value={fmt.num(Number(s.totalCompletedSessions ?? 0))} color={P.green} />
      </div>
      <SectionCard title={t('xp.levelProgress')} icon={<Star size={14} style={{ color: P.yellow }} />}>
        <div className="mb-2 flex justify-between text-[10px] font-bold" style={{ color: P.muted }}>
          <span>Lv.{level}</span><span>{progress}/{needed} XP ({pct}%)</span><span>Lv.{level + 1}</span>
        </div>
        <div className="h-3 rounded-full overflow-hidden" style={{ background: P.bg }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${P.blue}, ${P.purple})` }} />
        </div>
      </SectionCard>

      <SectionCard title={t('xp.achievementsTitle', { unlocked: String(unlocked.length), total: String(achievements.length > 0 ? achievements.length : (xp.achievementsTotal ?? 14)) })} icon={<Trophy size={14} style={{ color: P.orange }} />}>
        {achievements.length === 0 ? (
          <p className="text-xs italic" style={{ color: P.muted }}>{t('xp.achievementsLoading')}</p>
        ) : (
          <div className="space-y-3">
            {/* Unlocked */}
            {unlocked.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase mb-2 flex items-center gap-1" style={{ color: P.green }}>
                  <Unlock size={10} /> {t('xp.unlocked', { n: String(unlocked.length) })}
                </p>
                <div className="grid grid-cols-1 gap-1.5">
                  {unlocked.map(a => {
                    const rs = RARITY_STYLE[a.rarity] ?? RARITY_STYLE.COMMON;
                    return (
                      <div key={a.code} className="flex items-center gap-3 rounded-[10px] px-3 py-2" style={{ background: rs.bg, border: `1px solid ${rs.color}30` }}>
                        <span className="text-xl leading-none">{a.iconEmoji}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold truncate" style={{ color: P.text }}>{a.nameVi}</p>
                          <p className="text-[10px] truncate" style={{ color: P.muted }}>{a.descriptionVi}</p>
                        </div>
                        <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: rs.color + '20', color: rs.color }}>{t(rs.labelKey)}</span>
                          <span className="text-[9px] font-bold" style={{ color: P.purple }}>+{a.xpReward} XP</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {/* Locked */}
            {locked.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase mb-2 flex items-center gap-1" style={{ color: P.muted }}>
                  <Lock size={10} /> {t('xp.locked', { n: String(locked.length) })}
                </p>
                <div className="grid grid-cols-1 gap-1.5">
                  {locked.map(a => (
                    <div key={a.code} className="flex items-center gap-3 rounded-[10px] px-3 py-2 opacity-50" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                      <span className="text-xl leading-none grayscale">{a.iconEmoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate" style={{ color: P.muted }}>{a.nameVi}</p>
                        <p className="text-[10px] truncate" style={{ color: P.muted }}>{a.descriptionVi}</p>
                      </div>
                      <Lock size={12} style={{ color: P.muted, flexShrink: 0 }} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function SpeakingTab({ d }: { d: LearningDetail }) {
  const fmt = useFmt()
  const t = useTranslations('v2.adminOps.learningDetail');
  const sp = d.speakingAi;
  const weakPoints = Array.isArray(sp.topWeakPoints) ? (sp.topWeakPoints as { grammarPoint: string; count: number }[]) : [];
  const recentErrors = Array.isArray(sp.recentErrors) ? (sp.recentErrors as Record<string, unknown>[]) : [];
  const errorSkills = Array.isArray(sp.errorSkills) ? (sp.errorSkills as Record<string, unknown>[]) : [];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Stat label={t('speaking.stat.sessions')} value={fmt.num(Number(sp.totalSessions ?? 0))} color={P.blue} />
        <Stat label={t('speaking.stat.messages')} value={fmt.num(Number(sp.totalMessages ?? 0))} color={P.purple} />
      </div>
      {weakPoints.length > 0 && (
        <SectionCard title={t('speaking.weakPointsTitle')} icon={<Target size={14} style={{ color: P.red }} />}>
          <div className="space-y-2">{weakPoints.map((wp, i) => (
            <div key={i} className="flex items-center justify-between gap-2 text-xs">
              <span className="min-w-0 break-words font-semibold" style={{ color: P.text }}>{wp.grammarPoint}</span>
              <span className="px-2 py-0.5 rounded-full font-bold text-[10px]" style={{ background: P.redLt, color: P.red }}>{wp.count}×</span>
            </div>
          ))}</div>
        </SectionCard>
      )}
      {errorSkills.length > 0 && (
        <SectionCard title={t('speaking.errorSkillsTitle')} icon={<Star size={14} style={{ color: P.orange }} />}>
          <div className="space-y-2">{errorSkills.map((s, i) => {
            const openCount = Number(s.openCount ?? 0);
            const resolvedCount = Number(s.resolvedCount ?? 0);
            const isResolved = openCount <= 0 && resolvedCount > 0;
            return (
              <div key={i} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="min-w-0 break-all font-mono font-semibold" style={{ color: P.text }}>{String(s.errorCode ?? "—")}</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: P.navyLt, color: P.navy }}>
                    {Number(s.totalCount ?? 0)}×
                  </span>
                  <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full`}
                    style={{ background: isResolved ? P.greenLt : P.redLt, color: isResolved ? P.green : P.red }}
                  >
                    {isResolved ? <><Check size={9} aria-hidden /> {t('speaking.fixed')}</> : <><X size={9} aria-hidden /> {t('speaking.unfixed', { n: String(openCount) })}</>}
                  </span>
                </div>
              </div>
            );
          })}</div>
        </SectionCard>
      )}
      {recentErrors.length > 0 && (
        <SectionCard title={t('speaking.recentErrorsTitle')} icon={<Mic size={14} style={{ color: P.orange }} />}>
          <div className="overflow-x-auto rounded-[10px] border" style={{ borderColor: P.border }}>
            <table className="w-full min-w-[420px] lg:min-w-0 text-[11px]">
              <thead style={{ background: P.navyLt }}>
                <tr>
                  <th className="px-3 py-2 text-left font-bold" style={{ color: P.navy }}>{t('speaking.col.error')}</th>
                  <th className="px-3 py-2 text-left font-bold" style={{ color: P.navy }}>{t('speaking.col.wrongToRight')}</th>
                  <th className="px-3 py-2 text-left font-bold" style={{ color: P.navy }}>{t('speaking.col.severity')}</th>
                </tr>
              </thead>
              <tbody>{recentErrors.map((e, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? P.white : "#FAFCFF" }}>
                  <td className="px-3 py-2 font-semibold" style={{ color: P.text }}>{String(e.errorCode ?? "—")}</td>
                  <td className="px-3 py-2" style={{ color: P.muted }}>
                    <span className="line-through text-red-400">{String(e.wrongSpan ?? "")}</span>
                    {e.correctedSpan != null && Boolean(e.correctedSpan) && <> → <span className="text-green-600 font-semibold">{String(e.correctedSpan)}</span></>}
                  </td>
                  <td className="px-3 py-2">
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold" style={{
                      background: e.severity === "CRITICAL" ? P.redLt : e.severity === "MAJOR" ? P.orangeLt : P.blueLt,
                      color: e.severity === "CRITICAL" ? P.red : e.severity === "MAJOR" ? P.orange : P.blue
                    }}>{String(e.severity ?? "—")}</span>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </SectionCard>
      )}
    </div>
  );
}

function VocabTab({ d }: { d: LearningDetail }) {
  const fmt = useFmt()
  const t = useTranslations('v2.adminOps.learningDetail');
  const v = d.vocabularySrs;
  const total = Number(v.totalItems ?? 0);
  const mastered = Number(v.mastered ?? 0);
  const learning = Number(v.learning ?? 0);
  const newItems = Number(v.newItems ?? 0);
  const due = Number(v.dueToday ?? 0);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label={t('vocab.stat.total')} value={fmt.num(total)} color={P.navy} />
        <Stat label={t('vocab.stat.dueToday')} value={fmt.num(due)} color={P.red} />
        <Stat label={t('vocab.stat.mastered')} value={fmt.num(mastered)} color={P.green} />
        <Stat label={t('vocab.stat.learning')} value={fmt.num(learning)} color={P.blue} />
      </div>
      {total > 0 && (
        <SectionCard title={t('vocab.distributionTitle')} icon={<Brain size={14} style={{ color: P.purple }} />}>
          <div className="h-4 rounded-full overflow-hidden flex" style={{ background: P.bg }}>
            {mastered > 0 && <div style={{ width: `${(mastered / total) * 100}%`, background: P.green }} title={t('vocab.barMastered', { n: String(mastered) })} />}
            {learning > 0 && <div style={{ width: `${(learning / total) * 100}%`, background: P.blue }} title={t('vocab.barLearning', { n: String(learning) })} />}
            {newItems > 0 && <div style={{ width: `${(newItems / total) * 100}%`, background: P.muted }} title={t('vocab.barNew', { n: String(newItems) })} />}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[10px] font-bold">
            <span style={{ color: P.green }}>{t('vocab.legendMastered', { n: String(mastered) })}</span>
            <span style={{ color: P.blue }}>{t('vocab.legendLearning', { n: String(learning) })}</span>
            <span style={{ color: P.muted }}>{t('vocab.legendNew', { n: String(newItems) })}</span>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <Stat label={t('vocab.stat.words')} value={fmt.num(Number(v.wordCount ?? 0))} color={P.purple} />
            <Stat label={t('vocab.stat.grammar')} value={fmt.num(Number(v.grammarCount ?? 0))} color={P.orange} />
          </div>
        </SectionCard>
      )}
      {total === 0 && <p className="text-sm italic" style={{ color: P.muted }}>{t('vocab.empty')}</p>}
    </div>
  );
}

// ─── Interview Tab ─────────────────────────────────────────────

type InterviewSession = {
  id: number;
  interviewPosition?: string;
  experienceLevel?: string;
  cefrLevel?: string;
  persona?: string;
  status?: string;
  messageCount?: number;
  startedAt?: string;
  endedAt?: string;
  interviewReportJson?: string;
};

type TranscriptMessage = {
  id: number;
  role: string;
  userText?: string;
  userMessage?: string;
  aiSpeechDe?: string;
  explanationVi?: string;
  correction?: string;
  createdAt?: string;
};

function InterviewTab({ userId }: { userId: number }) {
  const fmt = useFmt()
  const t = useTranslations('v2.adminOps.learningDetail');
  const [sessions, setSessions] = useState<InterviewSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([]);
  const [transcriptLoading, setTranscriptLoading] = useState(false);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    api.get(`/admin/users/${userId}/interview-sessions`)
      .then(r => { if (!cancel) setSessions(r.data ?? []) })
      .catch(e => { if (!cancel) setError(apiMessage(e)) })
      .finally(() => { if (!cancel) setLoading(false) });
    return () => { cancel = true };
  }, [userId]);

  const toggleSession = async (sessId: number) => {
    if (expandedId === sessId) {
      setExpandedId(null);
      setTranscript([]);
      return;
    }
    setExpandedId(sessId);
    setTranscriptLoading(true);
    try {
      const res = await api.get(`/admin/users/${userId}/interview-sessions/${sessId}/messages`);
      setTranscript(res.data ?? []);
    } catch {
      setTranscript([]);
    } finally {
      setTranscriptLoading(false);
    }
  };

  if (loading) return <p className="text-xs animate-pulse" style={{ color: P.muted }}>{t('interview.loading')}</p>;
  if (error) return <p className="text-xs" style={{ color: P.red }}>{error}</p>;
  if (sessions.length === 0) return (
    <div className="rounded-[14px] p-6 text-center" style={{ border: `2px dashed ${P.border}` }}>
      <Briefcase size={32} className="mx-auto mb-2 opacity-30" />
      <p className="text-sm font-medium" style={{ color: P.muted }}>{t('interview.empty')}</p>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <MessageSquare size={14} style={{ color: P.blue }} />
        <span className="text-xs font-bold" style={{ color: P.muted }}>{t('interview.count', { n: String(sessions.length) })}</span>
      </div>
      {sessions.map(s => {
        const isExpanded = expandedId === s.id;
        const date = s.startedAt ? new Date(s.startedAt) : null;
        return (
          <div key={s.id} className="rounded-[14px] bg-white overflow-hidden" style={{ border: `1.5px solid ${isExpanded ? P.blue + '60' : P.border}` }}>
            {/* Session header */}
            <button
              onClick={() => toggleSession(s.id)}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-bold text-sm truncate" style={{ color: P.text }}>
                    {s.interviewPosition ?? t('interview.unknownPosition')}
                  </span>
                  {s.experienceLevel && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: P.blueLt, color: P.blue }}>
                      {s.experienceLevel}
                    </span>
                  )}
                  {s.cefrLevel && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: P.navyLt, color: P.navy }}>
                      {s.cefrLevel}
                    </span>
                  )}
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full`}
                    style={{ background: s.status === 'COMPLETED' ? P.greenLt : P.orangeLt, color: s.status === 'COMPLETED' ? P.green : P.orange }}
                  >
                    {s.status === 'COMPLETED' ? t('interview.statusDone') : t('interview.statusPending')}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]" style={{ color: P.muted }}>
                  {date && (
                    <span className="flex items-center gap-1">
                      <Calendar size={10} />
                      {fmt.date(date)} — {fmt.time(date, { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <MessageSquare size={10} /> {t('interview.messageCount', { n: String(s.messageCount ?? 0) })}
                  </span>
                </div>
              </div>
              {isExpanded ? <ChevronUp size={16} style={{ color: P.muted }} /> : <ChevronDown size={16} style={{ color: P.muted }} />}
            </button>

            {/* Transcript */}
            {isExpanded && (
              <div className="border-t px-4 py-3 space-y-2" style={{ borderColor: P.border, background: '#FAFCFF' }}>
                {transcriptLoading ? (
                  <p className="text-xs animate-pulse text-center py-4" style={{ color: P.muted }}>{t('interview.transcriptLoading')}</p>
                ) : transcript.length === 0 ? (
                  <p className="text-xs text-center py-4 italic" style={{ color: P.muted }}>{t('interview.noMessages')}</p>
                ) : (
                  transcript.map((msg) => {
                    const isAi = msg.role === 'ASSISTANT' || msg.role === 'AI';
                    const content = isAi ? msg.aiSpeechDe : (msg.userText ?? msg.userMessage);
                    if (!content) return null;
                    return (
                      <div key={msg.id} className={`flex ${isAi ? 'justify-start' : 'justify-end'}`}>
                        <div
                          className="max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed"
                          style={{
                            background: isAi ? P.navyLt : P.blueLt,
                            color: P.text,
                            borderBottomLeftRadius: isAi ? '4px' : undefined,
                            borderBottomRightRadius: !isAi ? '4px' : undefined,
                          }}
                        >
                          <span className="flex items-center gap-1 text-[9px] font-bold mb-0.5" style={{ color: isAi ? P.navy : P.blue }}>
                            {isAi ? <><Bot size={9} aria-hidden /> {t('interview.roleAi')}</> : <><User size={9} aria-hidden /> {t('interview.roleUser')}</>}
                          </span>
                          {content}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function LearningDetailModal({ userId, userName, onClose }: { userId: number; userName: string; onClose: () => void }) {
  const t = useTranslations('v2.adminOps.learningDetail');
  const [tab, setTab] = useState<Tab>("profile");
  const [detail, setDetail] = useState<LearningDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Timeout giữ dạng cờ, dịch lúc render — effect không gọi t nên deps vẫn chỉ [userId].
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    setError(null);
    setTimedOut(false);
    api.get(`/admin/users/${userId}/learning-detail`, { timeout: 8000 })
      .then(r => { if (!cancel) setDetail(r.data) })
      .catch(e => {
        if (!cancel) {
          const isTimeout = isAxiosErr(e) && e.code === 'ECONNABORTED';
          setTimedOut(isTimeout);
          if (!isTimeout) setError(apiMessage(e));
        }
      })
      .finally(() => { if (!cancel) setLoading(false) });
    return () => { cancel = true };
  }, [userId]);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl max-h-[85vh] flex flex-col rounded-[24px] bg-white overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-4 lg:px-6 py-4 border-b" style={{ borderColor: P.border }}>
          <div className="min-w-0">
            <h3 className="font-bold text-base" style={{ color: P.text }}>{t('title')}</h3>
            <p className="text-xs break-words" style={{ color: P.muted }}>#{userId} · {userName}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400">
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 lg:px-6 py-2 border-b overflow-x-auto" style={{ borderColor: P.border, background: P.bg }}>
          {TABS.map(item => (
            <button key={item.key} onClick={() => setTab(item.key)}
              className="flex shrink-0 items-center gap-1.5 min-h-[40px] lg:min-h-0 px-3 py-2 rounded-[10px] text-xs font-bold whitespace-nowrap transition-all"
              style={{ background: tab === item.key ? P.navy : "transparent", color: tab === item.key ? P.white : P.muted }}
            >{item.icon}{t(item.labelKey)}</button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 lg:px-6 lg:py-5" style={{ background: P.bg }}>
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <CompleteBauhausLogo variant="icon-only" size={120} animated />
              <p className="text-xs font-medium animate-pulse" style={{ color: P.muted }}>{t('loading')}</p>
            </div>
          )}
          {(error || timedOut) && <p className="text-sm text-center py-8" style={{ color: P.red }}>{timedOut ? t('backendBusy') : error}</p>}
          {detail && !loading && (
            <>
              {tab === "profile" && <ProfileTab d={detail} userId={userId} onSaved={() => {
                setDetail(null); setLoading(true); setError(null); setTimedOut(false);
                api.get(`/admin/users/${userId}/learning-detail`, { timeout: 8000 })
                  .then(r => setDetail(r.data))
                  .catch(e => setError(apiMessage(e)))
                  .finally(() => setLoading(false));
              }} />}
              {tab === "xp" && <XpTab d={detail} />}
              {tab === "speaking" && <SpeakingTab d={detail} />}
              {tab === "vocab" && <VocabTab d={detail} />}
              {tab === "interview" && <InterviewTab userId={userId} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
