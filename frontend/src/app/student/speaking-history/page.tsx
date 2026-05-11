"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic2, ChevronDown, ChevronUp, Clock, MessageSquare,
  AlertTriangle, ArrowLeft, Loader2, Calendar,
} from "lucide-react";
import api from "@/lib/api";
import { StudentShell } from "@/components/layouts/StudentShell";
import { useTranslations } from "next-intl";
import { clearTokens, logout } from "@/lib/authSession";

interface SessionMessage {
  id: number;
  role: "USER" | "ASSISTANT";
  userMessage?: string;
  aiSpeechDe?: string;
  correction?: string;
  explanationVi?: string;
  grammarPoint?: string;
  errors?: Array<{
    errorCode: string;
    severity: string;
    wrongSpan?: string;
    correctedSpan?: string;
    ruleViShort?: string;
  }>;
  createdAt?: string;
}

interface SpeakingSession {
  id: number;
  topic?: string;
  cefrLevel?: string;
  persona?: string;
  status?: string;
  createdAt?: string;
  messageCount?: number;
}

function severityColor(s: string) {
  if (s === "MAJOR" || s === "BLOCKING") return "text-red-600 bg-red-50 border-red-200";
  if (s === "MINOR") return "text-amber-600 bg-amber-50 border-amber-200";
  return "text-amber-600 bg-amber-50 border-amber-200";
}

function SessionCard({ session, onSelect, tHistory }: { session: SpeakingSession; onSelect: () => void; tHistory: any }) {
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
            <div className="w-8 h-8 rounded-[8px] bg-[#121212]/8 flex items-center justify-center">
              <Mic2 size={16} className="text-[#121212]" />
            </div>
            <span className="font-semibold text-[#0F172A] text-sm truncate">
              {session.topic ?? tHistory("noTopic")} — {session.cefrLevel ?? "?"}
            </span>
            {session.persona && (
              <span className="text-[10px] bg-[#FFCD00]/20 text-[#121212] px-2 py-0.5 rounded-full font-medium border border-[#FFCD00]/30">
                {session.persona}
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
              {tHistory("messages", { count: session.messageCount ?? 0 })}
            </span>
          </div>
        </div>
        <span className={`text-[10px] px-2 py-1 rounded-full font-medium ${
          session.status === "COMPLETED" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
        }`}>
          {session.status === "COMPLETED" ? tHistory("completed") : tHistory("open")}
        </span>
      </div>
    </motion.button>
  );
}

function MessageBubble({ msg, tHistory }: { msg: SessionMessage; tHistory: any }) {
  const [expanded, setExpanded] = useState(false);
  const isUser = msg.role === "USER";
  const hasErrors = (msg.errors?.length ?? 0) > 0;
  const hasGrammar = !!msg.grammarPoint || !!msg.correction;

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} gap-2`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-[#121212] flex items-center justify-center flex-shrink-0 mt-1">
          <Mic2 size={13} className="text-white" />
        </div>
      )}
      <div className={`max-w-[80%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-1`}>
        <div className={`rounded-[16px] px-4 py-3 text-sm ${
          isUser
            ? "bg-[#121212] text-white rounded-br-sm"
            : "bg-white border border-[#E2E8F0] text-[#0F172A] rounded-bl-sm"
        }`}>
          {isUser ? msg.userMessage : msg.aiSpeechDe}
        </div>

        {/* Correction */}
        {!isUser && msg.correction && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-800 max-w-full">
            <span className="font-bold">{tHistory("correction")}</span>{msg.correction}
          </div>
        )}
        {!isUser && msg.explanationVi && (
          <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 text-xs text-amber-800 max-w-full">
            <span className="font-bold">{tHistory("explanation")}</span>{msg.explanationVi}
          </div>
        )}

        {/* Errors expandable */}
        {!isUser && (hasErrors || hasGrammar) && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="flex items-center gap-1 text-[10px] text-[#94A3B8] hover:text-[#0F172A] transition-colors mt-0.5"
          >
            {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            {hasErrors ? tHistory("grammarErrors", { count: msg.errors!.length }) : tHistory("details")}
          </button>
        )}

        <AnimatePresence>
          {expanded && hasErrors && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-1.5 overflow-hidden"
            >
              {msg.errors!.map((err, i) => (
                <div key={i} className={`rounded-xl px-3 py-2 text-xs border ${severityColor(err.severity)}`}>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <AlertTriangle size={10} />
                    <span className="font-bold">{err.errorCode}</span>
                    <span className="opacity-60">({err.severity})</span>
                  </div>
                  {err.wrongSpan && <p>❌ <span className="line-through">{err.wrongSpan}</span> → ✅ {err.correctedSpan}</p>}
                  {err.ruleViShort && <p className="mt-0.5 opacity-80">{err.ruleViShort}</p>}
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function SpeakingHistoryPage() {
  const router = useRouter();
  const tHistory = useTranslations("history");
  const [sessions, setSessions] = useState<SpeakingSession[]>([]);
  const [selected, setSelected] = useState<SpeakingSession | null>(null);
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [profile, setProfile] = useState<{ displayName: string; role: string; targetLevel: string; streakDays: number; initials: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get("/auth/me"),
      api.get("/ai-speaking/sessions?size=20&sort=createdAt,desc"),
    ]).then(([meRes, sessRes]) => {
      const me = meRes.data;
      const parts = (me.displayName ?? "").split(" ");
      setProfile({
        displayName: me.displayName ?? tHistory("student"),
        role: me.role,
        targetLevel: me.targetLevel ?? "B1",
        streakDays: me.streakDays ?? 0,
        initials: parts.map((p: string) => p[0]).join("").slice(0, 2).toUpperCase() || "DF",
      });
      const data = sessRes.data;
      setSessions(Array.isArray(data) ? data : (data?.content ?? data?.items ?? []));
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const openSession = async (sess: SpeakingSession) => {
    setSelected(sess);
    setLoadingMsgs(true);
    try {
      const res = await api.get(`/ai-speaking/sessions/${sess.id}/messages`);
      const raw = Array.isArray(res.data) ? res.data : (res.data?.content ?? []);
      setMessages(raw);
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

  return (
    <StudentShell
      activeSection="speaking"
      user={{ displayName: profile.displayName, role: profile.role }}
      targetLevel={profile.targetLevel}
      streakDays={profile.streakDays}
      initials={profile.initials}
      onLogout={handleLogout}
      headerTitle={selected ? tHistory("replayTitle") : tHistory("historyTitle")}
      headerSubtitle={selected ? `${selected.topic ?? ""} — ${selected.cefrLevel ?? ""}` : tHistory("historySubtitle")}
    >
      <div className="max-w-3xl mx-auto">
        {/* Back button */}
        {selected && (
          <button
            onClick={() => { setSelected(null); setMessages([]); }}
            className="flex items-center gap-1.5 text-sm text-[#64748B] hover:text-[#121212] mb-5 transition-colors"
          >
            <ArrowLeft size={15} /> {tHistory("sessionList")}
          </button>
        )}

        {!selected ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-[#64748B]" />
                <span className="text-sm text-[#64748B]">{tHistory("recentSessions", { count: sessions.length })}</span>
              </div>
              <button
                onClick={() => router.push("/speaking")}
                className="text-sm font-semibold text-[#121212] hover:underline flex items-center gap-1"
              >
                <Mic2 size={13} /> {tHistory("startNew")}
              </button>
            </div>
            {sessions.length === 0 ? (
              <div className="text-center py-16 text-[#94A3B8]">
                <Mic2 size={40} className="mx-auto mb-3 opacity-30" />
                <p className="font-medium">{tHistory("noSessions")}</p>
                <p className="text-sm mt-1">{tHistory("promptStart")}</p>
                <button onClick={() => router.push("/speaking")} className="mt-4 bg-[#121212] text-white rounded-[12px] px-5 py-2 text-sm font-semibold hover:bg-[#1E1E1E]">
                  {tHistory("startNow")}
                </button>
              </div>
            ) : (
              sessions.map(sess => (
                <SessionCard key={sess.id} session={sess} onSelect={() => openSession(sess)} tHistory={tHistory} />
              ))
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {loadingMsgs ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={24} className="animate-spin text-[#121212]" />
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-12 text-[#94A3B8]">
                <MessageSquare size={32} className="mx-auto mb-3 opacity-30" />
                <p>{tHistory("noMessages")}</p>
              </div>
            ) : (
              <div className="space-y-4 pb-6">
                {messages.map(msg => <MessageBubble key={msg.id} msg={msg} tHistory={tHistory} />)}
              </div>
            )}
          </div>
        )}
      </div>
    </StudentShell>
  );
}
