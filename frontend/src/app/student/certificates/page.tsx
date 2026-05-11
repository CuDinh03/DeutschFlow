"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Trophy, Award, Download, Loader2, Lock, CheckCircle2, Star, Shield } from "lucide-react";
import { StudentShell } from "@/components/layouts/StudentShell";
import { useStudentPracticeSession } from "@/hooks/useStudentPracticeSession";
import { logout } from "@/lib/authSession";
import api from "@/lib/api";

interface Certificate {
  id: number;
  cefr_level: string;
  issued_at: string;
  exam_score: number;
  certificate_code: string;
  is_active: boolean;
  alreadyHas?: boolean;
  justIssued?: boolean;
}

const LEVEL_CONFIG: Record<string, { color: string; bg: string; border: string; desc: string }> = {
  A1: { color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0", desc: "Starter — Goethe Start Deutsch 1" },
  A2: { color: "#0ea5e9", bg: "#f0f9ff", border: "#bae6fd", desc: "Elementary — Goethe-Zertifikat A2" },
  B1: { color: "#8b5cf6", bg: "#f5f3ff", border: "#ddd6fe", desc: "Intermediate — Goethe-Zertifikat B1" },
  B2: { color: "#f59e0b", bg: "#fffbeb", border: "#fde68a", desc: "Upper Intermediate — Goethe-Zertifikat B2" },
  C1: { color: "#ef4444", bg: "#fef2f2", border: "#fecaca", desc: "Advanced — Goethe-Zertifikat C1" },
};

function CertificateCard({ cert }: { cert: Certificate }) {
  const cfg = LEVEL_CONFIG[cert.cefr_level] ?? LEVEL_CONFIG["A1"];
  const date = new Date(cert.issued_at).toLocaleDateString("vi-VN");
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
      className="rounded-2xl border-2 p-6 relative overflow-hidden"
      style={{ background: cfg.bg, borderColor: cfg.border }}
    >
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-10"
        style={{ background: cfg.color, transform: "translate(40%, -40%)" }} />

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: cfg.color }}>
            <Award size={32} className="text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl font-black" style={{ color: cfg.color }}>{cert.cefr_level}</span>
              <CheckCircle2 size={18} style={{ color: cfg.color }} />
            </div>
            <p className="font-semibold text-[#0F172A] text-sm">{cfg.desc}</p>
            <p className="text-xs text-[#64748B] mt-1">Điểm: {cert.exam_score}/100 · Ngày: {date}</p>
          </div>
        </div>
        <button className="w-9 h-9 rounded-xl flex items-center justify-center border-2 flex-shrink-0"
          style={{ borderColor: cfg.border, color: cfg.color }}
          title="Tải chứng chỉ">
          <Download size={16} />
        </button>
      </div>

      <div className="mt-4 pt-4 border-t" style={{ borderColor: cfg.border }}>
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 font-mono" style={{ color: cfg.color }}>
            <Shield size={12} />
            <span>{cert.certificate_code}</span>
          </div>
          <div className="flex items-center gap-1 text-[#94A3B8]">
            <Star size={12} className="fill-current text-yellow-400" />
            <span>DeutschFlow Verified</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function LockedLevel({ level, onClaim }: { level: string; onClaim: () => void }) {
  const cfg = LEVEL_CONFIG[level] ?? LEVEL_CONFIG["A1"];
  return (
    <div className="rounded-2xl border-2 border-dashed border-[#E2E8F0] p-6 flex items-center gap-4 opacity-60">
      <div className="w-16 h-16 rounded-2xl bg-[#F1F5F9] flex items-center justify-center flex-shrink-0">
        <Lock size={28} className="text-[#CBD5E1]" />
      </div>
      <div className="flex-1">
        <p className="font-bold text-[#64748B]">Chứng chỉ {level}</p>
        <p className="text-xs text-[#94A3B8]">{cfg.desc}</p>
        <p className="text-xs text-[#94A3B8] mt-1">Pass mock exam {level} để nhận chứng chỉ</p>
      </div>
      <button onClick={onClaim}
        className="px-3 py-1.5 rounded-lg text-xs font-bold text-white flex-shrink-0"
        style={{ background: cfg.color, opacity: 0.8 }}>
        Nhận ngay
      </button>
    </div>
  );
}

export default function CertificatePage() {
  const { me, loading: meLoading, targetLevel, streakDays, initials } = useStudentPracticeSession();
  const [certs, setCerts] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [claimMsg, setClaimMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<Certificate[]>("/certificates/me");
      setCerts(data ?? []);
    } catch { setCerts([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (me) load(); }, [me, load]);

  const claim = async (level: string) => {
    setClaiming(level);
    setClaimMsg(null);
    try {
      const { data } = await api.post<Certificate>("/certificates/claim", { cefrLevel: level });
      if (data.alreadyHas) {
        setClaimMsg(`✅ Bạn đã có chứng chỉ ${level}`);
      } else if (data.justIssued) {
        setClaimMsg(`🎉 Chứng chỉ ${level} đã được cấp!`);
        load();
      }
    } catch (e: any) {
      setClaimMsg(e?.response?.data?.error ?? `Cần pass mock exam ${level} trước`);
    } finally { setClaiming(null); }
  };

  if (meLoading || !me) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin" size={28} /></div>;

  const earnedLevels = new Set(certs.map(c => c.cefr_level));
  const allLevels = ["A1", "A2", "B1", "B2", "C1"];
  const lockedLevels = allLevels.filter(l => !earnedLevels.has(l));

  return (
    <StudentShell activeSection="badges" user={me} targetLevel={targetLevel} streakDays={streakDays}
      initials={initials} onLogout={() => logout()}
      headerTitle="🏅 Chứng chỉ CEFR" headerSubtitle="Chứng nhận trình độ tiếng Đức của bạn">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

        {/* Banner */}
        <div className="rounded-2xl p-6 text-white" style={{ background: "linear-gradient(135deg,#1E293B 0%,#4F46E5 100%)" }}>
          <div className="flex items-center gap-3 mb-3">
            <Trophy size={32} className="text-yellow-300" />
            <div>
              <p className="font-extrabold text-xl">DeutschFlow Certificate</p>
              <p className="text-white/70 text-sm">Được xác nhận bởi hệ thống đánh giá Goethe-format</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="bg-white/10 rounded-xl p-3 text-center">
              <p className="text-2xl font-black">{certs.length}</p>
              <p className="text-xs text-white/60">Đã nhận</p>
            </div>
            <div className="bg-white/10 rounded-xl p-3 text-center">
              <p className="text-2xl font-black">{lockedLevels.length}</p>
              <p className="text-xs text-white/60">Còn lại</p>
            </div>
            <div className="bg-white/10 rounded-xl p-3 text-center">
              <p className="text-2xl font-black">{allLevels.length}</p>
              <p className="text-xs text-white/60">Tổng cộng</p>
            </div>
          </div>
        </div>

        {claimMsg && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl border border-[#E2E8F0] p-4 text-sm text-center font-semibold text-[#0F172A]">
            {claimMsg}
          </motion.div>
        )}

        {loading && <div className="flex justify-center py-10"><Loader2 size={24} className="animate-spin text-[#6366F1]" /></div>}

        {/* Earned */}
        {!loading && certs.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-bold text-[#0F172A]">✅ Chứng chỉ đã nhận ({certs.length})</h3>
            {certs.map(c => <CertificateCard key={c.id} cert={c} />)}
          </div>
        )}

        {/* Locked */}
        {!loading && (
          <div className="space-y-3">
            <h3 className="font-bold text-[#0F172A]">🔒 Chưa mở khóa</h3>
            {lockedLevels.map(l => (
              <LockedLevel key={l} level={l} onClaim={() => claim(l)} />
            ))}
          </div>
        )}
      </div>
    </StudentShell>
  );
}
