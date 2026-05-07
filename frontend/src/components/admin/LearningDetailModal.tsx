"use client";

import { useEffect, useState } from "react";
import api, { apiMessage } from "@/lib/api";
import { BookOpen, Brain, Flame, Mic, Star, Target, Trophy, X } from "lucide-react";

const P = {
  navy: "#00305E", navyLt: "#EBF2FA", blue: "#2D9CDB", blueLt: "#EBF5FB",
  red: "#EB5757", redLt: "#FDEAEA", green: "#27AE60", greenLt: "#E8F8F0",
  purple: "#9B51E0", purpleLt: "#F4EDFF", orange: "#F2994A", orangeLt: "#FEF3E8",
  yellow: "#FFCE00", bg: "#F5F5F5", white: "#FFFFFF", text: "#0F172A",
  muted: "#64748B", border: "#E2E8F0",
};

type LearningDetail = {
  learningProfile: Record<string, unknown>;
  xpGamification: Record<string, unknown>;
  streak: Record<string, unknown>;
  speakingAi: Record<string, unknown>;
  vocabularySrs: Record<string, unknown>;
};

type Tab = "profile" | "xp" | "speaking" | "vocab";

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: "profile", label: "Hồ sơ", icon: <BookOpen size={14} /> },
  { key: "xp", label: "XP & Streak", icon: <Flame size={14} /> },
  { key: "speaking", label: "Speaking AI", icon: <Mic size={14} /> },
  { key: "vocab", label: "Từ vựng SRS", icon: <Brain size={14} /> },
];

function fmt(n: number | undefined | null) {
  return Number(n ?? 0).toLocaleString("vi-VN");
}

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

function ProfileTab({ d }: { d: LearningDetail }) {
  const p = d.learningProfile;
  if (p.notConfigured) return <p className="text-sm italic" style={{ color: P.muted }}>Người dùng chưa thiết lập hồ sơ học tập.</p>;
  const rows: [string, unknown][] = [
    ["Mục tiêu", p.goalType === "WORK" ? "Công việc" : p.goalType === "CERT" ? "Lấy chứng chỉ" : String(p.goalType ?? "—")],
    ["Cấp độ hiện tại", p.currentLevel ?? "—"],
    ["Cấp độ mục tiêu", p.targetLevel ?? "—"],
    ["Ngành nghề", p.industry ?? "—"],
    ["Kỳ thi", p.examType ?? "—"],
    ["Buổi/tuần", p.sessionsPerWeek ?? "—"],
    ["Phút/buổi", p.minutesPerSession ?? "—"],
    ["Tốc độ học", p.learningSpeed === "SLOW" ? "Chậm" : p.learningSpeed === "FAST" ? "Nhanh" : "Bình thường"],
    ["Độ tuổi", String(p.ageRange ?? "—").replace("_", " ")],
  ];
  const interests = Array.isArray(p.interests) ? (p.interests as string[]) : [];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Stat label="Cấp hiện tại" value={String(p.currentLevel ?? "—")} color={P.blue} />
        <Stat label="Mục tiêu" value={String(p.targetLevel ?? "—")} color={P.green} />
        <Stat label="Tốc độ" value={p.learningSpeed === "SLOW" ? "Chậm" : p.learningSpeed === "FAST" ? "Nhanh" : "TB"} color={P.orange} />
      </div>
      <div className="overflow-x-auto rounded-[10px] border" style={{ borderColor: P.border }}>
        <table className="w-full text-xs">
          <tbody>{rows.map(([k, v], i) => (
            <tr key={k} style={{ background: i % 2 === 0 ? P.white : "#FAFCFF" }}>
              <td className="px-3 py-2 font-semibold" style={{ color: P.muted }}>{k}</td>
              <td className="px-3 py-2 font-bold" style={{ color: P.text }}>{String(v)}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      {interests.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase mb-1.5" style={{ color: P.muted }}>Sở thích</p>
          <div className="flex flex-wrap gap-1.5">{interests.map(i => (
            <span key={i} className="px-2 py-1 rounded-full text-[10px] font-bold" style={{ background: P.purpleLt, color: P.purple }}>{i}</span>
          ))}</div>
        </div>
      )}
    </div>
  );
}

function XpTab({ d }: { d: LearningDetail }) {
  const xp = d.xpGamification;
  const s = d.streak;
  const totalXp = Number(xp.totalXp ?? 0);
  const level = Number(xp.level ?? 1);
  const progress = Number(xp.progressInLevel ?? 0);
  const needed = Number(xp.xpNeededForNext ?? 100);
  const pct = needed > 0 ? Math.min(100, Math.round((progress / needed) * 100)) : 0;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Total XP" value={fmt(totalXp)} color={P.purple} />
        <Stat label="Level" value={String(level)} color={P.blue} />
        <Stat label="Streak" value={`${s.currentStreak ?? 0} ngày`} color={P.orange} />
        <Stat label="Sessions" value={fmt(Number(s.totalCompletedSessions ?? 0))} color={P.green} />
      </div>
      <SectionCard title="Tiến độ Level" icon={<Star size={14} style={{ color: P.yellow }} />}>
        <div className="mb-2 flex justify-between text-[10px] font-bold" style={{ color: P.muted }}>
          <span>Lv.{level}</span><span>{progress}/{needed} XP ({pct}%)</span><span>Lv.{level + 1}</span>
        </div>
        <div className="h-3 rounded-full overflow-hidden" style={{ background: P.bg }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${P.blue}, ${P.purple})` }} />
        </div>
      </SectionCard>
      <SectionCard title="Thành tựu" icon={<Trophy size={14} style={{ color: P.orange }} />}>
        <div className="flex items-center gap-4 text-sm">
          <span className="font-black" style={{ color: P.green }}>{fmt(Number(xp.achievementsUnlocked ?? 0))}</span>
          <span style={{ color: P.muted }}>/</span>
          <span className="font-bold" style={{ color: P.text }}>{fmt(Number(xp.achievementsTotal ?? 0))}</span>
          <span className="text-[10px]" style={{ color: P.muted }}>đã mở khóa</span>
        </div>
      </SectionCard>
    </div>
  );
}

function SpeakingTab({ d }: { d: LearningDetail }) {
  const sp = d.speakingAi;
  const weakPoints = Array.isArray(sp.topWeakPoints) ? (sp.topWeakPoints as { grammarPoint: string; count: number }[]) : [];
  const recentErrors = Array.isArray(sp.recentErrors) ? (sp.recentErrors as Record<string, unknown>[]) : [];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Phiên nói" value={fmt(Number(sp.totalSessions ?? 0))} color={P.blue} />
        <Stat label="Tin nhắn" value={fmt(Number(sp.totalMessages ?? 0))} color={P.purple} />
      </div>
      {weakPoints.length > 0 && (
        <SectionCard title="Điểm yếu ngữ pháp (Top 5)" icon={<Target size={14} style={{ color: P.red }} />}>
          <div className="space-y-2">{weakPoints.map((wp, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <span className="font-semibold" style={{ color: P.text }}>{wp.grammarPoint}</span>
              <span className="px-2 py-0.5 rounded-full font-bold text-[10px]" style={{ background: P.redLt, color: P.red }}>{wp.count}×</span>
            </div>
          ))}</div>
        </SectionCard>
      )}
      {recentErrors.length > 0 && (
        <SectionCard title="Lỗi gần đây" icon={<Mic size={14} style={{ color: P.orange }} />}>
          <div className="overflow-x-auto rounded-[10px] border" style={{ borderColor: P.border }}>
            <table className="w-full text-[11px]">
              <thead style={{ background: P.navyLt }}>
                <tr>
                  <th className="px-3 py-2 text-left font-bold" style={{ color: P.navy }}>Lỗi</th>
                  <th className="px-3 py-2 text-left font-bold" style={{ color: P.navy }}>Sai → Đúng</th>
                  <th className="px-3 py-2 text-left font-bold" style={{ color: P.navy }}>Mức</th>
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
  const v = d.vocabularySrs;
  const total = Number(v.totalItems ?? 0);
  const mastered = Number(v.mastered ?? 0);
  const learning = Number(v.learning ?? 0);
  const newItems = Number(v.newItems ?? 0);
  const due = Number(v.dueToday ?? 0);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Tổng mục" value={fmt(total)} color={P.navy} />
        <Stat label="Cần ôn hôm nay" value={fmt(due)} color={P.red} />
        <Stat label="Đã thuộc" value={fmt(mastered)} color={P.green} />
        <Stat label="Đang học" value={fmt(learning)} color={P.blue} />
      </div>
      {total > 0 && (
        <SectionCard title="Phân bố" icon={<Brain size={14} style={{ color: P.purple }} />}>
          <div className="h-4 rounded-full overflow-hidden flex" style={{ background: P.bg }}>
            {mastered > 0 && <div style={{ width: `${(mastered / total) * 100}%`, background: P.green }} title={`Đã thuộc: ${mastered}`} />}
            {learning > 0 && <div style={{ width: `${(learning / total) * 100}%`, background: P.blue }} title={`Đang học: ${learning}`} />}
            {newItems > 0 && <div style={{ width: `${(newItems / total) * 100}%`, background: P.muted }} title={`Mới: ${newItems}`} />}
          </div>
          <div className="flex gap-4 mt-2 text-[10px] font-bold">
            <span style={{ color: P.green }}>■ Thuộc ({mastered})</span>
            <span style={{ color: P.blue }}>■ Đang học ({learning})</span>
            <span style={{ color: P.muted }}>■ Mới ({newItems})</span>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <Stat label="Từ vựng" value={fmt(Number(v.wordCount ?? 0))} color={P.purple} />
            <Stat label="Ngữ pháp" value={fmt(Number(v.grammarCount ?? 0))} color={P.orange} />
          </div>
        </SectionCard>
      )}
      {total === 0 && <p className="text-sm italic" style={{ color: P.muted }}>Chưa có mục SRS nào.</p>}
    </div>
  );
}

export default function LearningDetailModal({ userId, userName, onClose }: { userId: number; userName: string; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("profile");
  const [detail, setDetail] = useState<LearningDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    setError(null);
    api.get(`/admin/users/${userId}/learning-detail`)
      .then(r => { if (!cancel) setDetail(r.data) })
      .catch(e => { if (!cancel) setError(apiMessage(e)) })
      .finally(() => { if (!cancel) setLoading(false) });
    return () => { cancel = true };
  }, [userId]);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl max-h-[85vh] flex flex-col rounded-[24px] bg-white overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: P.border }}>
          <div>
            <h3 className="font-bold text-base" style={{ color: P.text }}>Hồ sơ học tập</h3>
            <p className="text-xs" style={{ color: P.muted }}>#{userId} · {userName}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400">
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 py-2 border-b overflow-x-auto" style={{ borderColor: P.border, background: P.bg }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] text-xs font-bold whitespace-nowrap transition-all"
              style={{ background: tab === t.key ? P.navy : "transparent", color: tab === t.key ? P.white : P.muted }}
            >{t.icon}{t.label}</button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5" style={{ background: P.bg }}>
          {loading && <p className="text-sm animate-pulse text-center py-12" style={{ color: P.muted }}>Đang tải hồ sơ học tập...</p>}
          {error && <p className="text-sm text-center py-8" style={{ color: P.red }}>{error}</p>}
          {detail && !loading && (
            <>
              {tab === "profile" && <ProfileTab d={detail} />}
              {tab === "xp" && <XpTab d={detail} />}
              {tab === "speaking" && <SpeakingTab d={detail} />}
              {tab === "vocab" && <VocabTab d={detail} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
