"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Briefcase, Clock, MessageSquare, ArrowLeft, Loader2, Calendar, Target, Plus
} from "lucide-react";
import api from "@/lib/api";
import { StudentShell } from "@/components/layouts/StudentShell";
import { clearTokens, logout } from "@/lib/authSession";
import { SessionSummary } from "@/components/features/ai-speaking/SessionSummary";

interface SessionMessage {
  id: string;
  role: "user" | "ai";
  contentDe: string;
  isStreaming?: boolean;
  feedback?: {
    errors?: Array<any>;
    explanationVi?: string;
    suggestions?: string[];
    correction?: string;
    grammarPoint?: string;
    action?: any;
  };
}

interface SpeakingSession {
  id: number;
  topic?: string;
  cefrLevel?: string;
  persona?: string;
  status?: string;
  createdAt?: string;
  messageCount?: number;
  sessionMode?: "COMMUNICATION" | "INTERVIEW";
  interviewPosition?: string;
  experienceLevel?: string;
  interviewReportJson?: string;
}

function SessionCard({ session, onSelect }: { session: SpeakingSession; onSelect: () => void }) {
  const date = session.createdAt ? new Date(session.createdAt) : null;
  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      onClick={onSelect}
      className="w-full text-left bg-white border border-[#E2E8F0] rounded-[16px] p-5 hover:border-[#121212]/40 hover:shadow-md transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-[8px] bg-[#FFCD00]/20 flex items-center justify-center">
              <Briefcase size={16} className="text-[#121212]" />
            </div>
            <span className="font-semibold text-[#0F172A] text-sm truncate">
              {session.interviewPosition ?? "Vị trí không xác định"} 
            </span>
            {session.experienceLevel && (
              <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">
                {session.experienceLevel}
              </span>
            )}
            {session.cefrLevel && (
              <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-medium border border-slate-200">
                {session.cefrLevel}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-[#94A3B8] text-xs">
            {date && (
              <span className="flex items-center gap-1">
                <Calendar size={11} />
                {date.toLocaleDateString("vi-VN")} — {date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
            <span className="flex items-center gap-1">
              <MessageSquare size={11} />
              {session.messageCount ?? 0} lượt trao đổi
            </span>
            {session.persona && (
              <span className="flex items-center gap-1">
                <Target size={11} />
                HR: {session.persona}
              </span>
            )}
          </div>
        </div>
        <span className={`text-[10px] px-2 py-1 rounded-full font-medium ${
          session.status === "COMPLETED" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
        }`}>
          {session.status === "COMPLETED" ? "Đã xong" : "Chưa hoàn thành"}
        </span>
      </div>
    </motion.button>
  );
}

export default function InterviewsHistoryPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SpeakingSession[]>([]);
  const [selected, setSelected] = useState<SpeakingSession | null>(null);
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [profile, setProfile] = useState<{ displayName: string; role: string; targetLevel: string; streakDays: number; initials: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get("/auth/me"),
      api.get("/ai-speaking/sessions?size=50&sort=createdAt,desc"),
    ]).then(([meRes, sessRes]) => {
      const me = meRes.data;
      const parts = (me.displayName ?? "").split(" ");
      setProfile({
        displayName: me.displayName ?? "Học viên",
        role: me.role,
        targetLevel: me.targetLevel ?? "B1",
        streakDays: me.streakDays ?? 0,
        initials: parts.map((p: string) => p[0]).join("").slice(0, 2).toUpperCase() || "DF",
      });
      const data = sessRes.data;
      const allSessions = Array.isArray(data) ? data : (data?.content ?? data?.items ?? []);
      // Filter for interview sessions only
      setSessions(allSessions.filter((s: SpeakingSession) => s.sessionMode === "INTERVIEW"));
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const openSession = async (sess: SpeakingSession) => {
    setSelected(sess);
    setLoadingMsgs(true);
    try {
      const res = await api.get(`/ai-speaking/sessions/${sess.id}/messages`);
      const raw = Array.isArray(res.data) ? res.data : (res.data?.content ?? []);
      // Map API messages back to ChatMessage shape required by SessionSummary
      const mapped: SessionMessage[] = raw.map((m: any) => ({
        id: String(m.id || Date.now() + Math.random()),
        role: m.role?.toLowerCase() === "user" ? "user" : "ai",
        contentDe: m.role?.toLowerCase() === "user" ? m.userMessage : m.aiSpeechDe,
        isStreaming: false,
        feedback: {
          errors: m.errors || [],
          explanationVi: m.explanationVi || "",
          correction: m.correction || null,
          grammarPoint: m.grammarPoint || null,
          action: m.assistantAction || null,
        }
      }));
      setMessages(mapped);
    } catch {
      setMessages([]);
    } finally {
      setLoadingMsgs(false);
    }
  };

  const handleLogout = () => { clearTokens(); router.push("/login"); };

  if (loading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-[#121212]" />
      </div>
    );
  }

  // If a session is selected, we want to render the SessionSummary taking up the whole screen.
  // The SessionSummary is designed for dark mode, so we wrap it appropriately.
  if (selected && !loadingMsgs) {
    return (
      <div
        className="min-h-screen flex flex-col"
        style={{ background: "linear-gradient(180deg, #0A0F1E 0%, #0F172A 60%, #1A1535 100%)" }}
      >
        <div className="max-w-[460px] mx-auto w-full flex flex-col flex-1 p-4 overflow-y-auto">
          {/* Custom Back Button for the summary view */}
          <button
            onClick={() => { setSelected(null); setMessages([]); }}
            className="flex items-center gap-2 text-white/70 hover:text-white mb-4 mt-2 transition-colors self-start"
          >
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
              <ArrowLeft size={16} />
            </div>
            <span className="text-sm font-medium">Đóng báo cáo</span>
          </button>
          
          <SessionSummary
            messages={messages as any}
            duration="N/A"
            isInterviewMode={true}
            interviewReportJson={selected.interviewReportJson}
            onRestart={() => router.push("/speaking")}
            onExit={() => { setSelected(null); setMessages([]); }}
          />
        </div>
      </div>
    );
  }

  return (
    <StudentShell
      activeSection="interviews"
      user={{ displayName: profile.displayName, role: profile.role }}
      targetLevel={profile.targetLevel}
      streakDays={profile.streakDays}
      initials={profile.initials}
      onLogout={handleLogout}
      headerTitle="Kết quả phỏng vấn"
      headerSubtitle="Xem lại kết quả các buổi phỏng vấn giả lập"
    >
      <div className="max-w-3xl mx-auto">
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-[#64748B]" />
              <span className="text-sm text-[#64748B]">{sessions.length} phiên phỏng vấn</span>
            </div>
            <button
              onClick={() => router.push("/speaking")}
              className="text-sm font-semibold text-[#121212] hover:underline flex items-center gap-1 bg-[#FFCD00]/20 px-3 py-1.5 rounded-full transition-all hover:bg-[#FFCD00]/30"
            >
              <Plus size={13} /> Phỏng vấn mới
            </button>
          </div>

          {loadingMsgs ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-[#121212]" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-16 text-[#94A3B8]">
              <Briefcase size={40} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">Chưa có kết quả phỏng vấn nào</p>
              <p className="text-sm mt-1">Hãy tham gia một buổi phỏng vấn giả lập!</p>
              <button onClick={() => router.push("/speaking")} className="mt-4 bg-[#121212] text-white rounded-[12px] px-5 py-2 text-sm font-semibold hover:bg-[#1E1E1E] transition-colors">
                Bắt đầu ngay
              </button>
            </div>
          ) : (
            sessions.map(sess => (
              <SessionCard key={sess.id} session={sess} onSelect={() => openSession(sess)} />
            ))
          )}
        </div>
      </div>
    </StudentShell>
  );
}
