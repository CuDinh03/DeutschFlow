"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, CheckCircle, XCircle, Loader2, Send,
  Clock, ChevronDown, ChevronUp, Sparkles, RefreshCw
} from "lucide-react";
import api from "@/lib/api";
import { logout } from "@/lib/authSession";

const CEFR_LEVELS = ["A1", "A2", "B1", "B2"];

interface GrammarTopic {
  id: number; topic_code: string; title_de: string; title_vi: string;
  cefr_level: string; sort_order: number;
}
interface DraftExercise {
  id: number; topic_id: number; topic_title: string; exercise_type: string;
  difficulty: number; question_json: string; status: string; reject_reason?: string;
  created_at: string;
}

export default function TeacherGrammarPage() {
  const [me, setMe] = useState<any>(null);
  const [topics, setTopics] = useState<GrammarTopic[]>([]);
  const [drafts, setDrafts] = useState<DraftExercise[]>([]);
  const [cefr, setCefr] = useState("A1");
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);
  const [genCount, setGenCount] = useState(5);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [expandedDraft, setExpandedDraft] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    try {
      const [meRes, draftsRes] = await Promise.all([
        api.get("/auth/me"),
        api.get<DraftExercise[]>("/grammar/syllabus/exercises/my-drafts"),
      ]);
      setMe(meRes.data);
      setDrafts(draftsRes.data ?? []);
    } catch { /* */ }
    finally { setLoading(false); }
  }, []);

  const loadTopics = useCallback(async () => {
    try {
      const { data } = await api.get<GrammarTopic[]>(`/grammar/syllabus/topics?cefrLevel=${cefr}`);
      setTopics(data ?? []);
      setSelectedTopicId(data?.[0]?.id ?? null);
    } catch { setTopics([]); }
  }, [cefr]);

  useEffect(() => { void loadAll(); }, [loadAll]);
  useEffect(() => { void loadTopics(); }, [loadTopics]);

  const generate = async () => {
    if (!selectedTopicId) return;
    setGenerating(true); setError(null); setSuccess(null);
    try {
      const { data } = await api.post(`/grammar/syllabus/topics/${selectedTopicId}/generate`, { count: genCount });
      setSuccess(`✅ AI đã tạo ${(data as any[]).length} bài tập! Kiểm tra và gửi duyệt bên dưới.`);
      await loadAll();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? "Tạo bài tập thất bại.");
    } finally { setGenerating(false); }
  };

  const submitAll = async (topicId: number) => {
    setSubmitting(true); setError(null);
    try {
      await api.post(`/grammar/syllabus/topics/${topicId}/submit-all-review`);
      setSuccess("📤 Đã gửi tất cả bài tập cho Admin duyệt!");
      await loadAll();
    } catch { setError("Gửi duyệt thất bại."); }
    finally { setSubmitting(false); }
  };

  const draftsByTopic = drafts.reduce<Record<number, DraftExercise[]>>((acc, d) => {
    if (!acc[d.topic_id]) acc[d.topic_id] = [];
    acc[d.topic_id].push(d);
    return acc;
  }, {});

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" size={28} /></div>;

  return (
    <div className="min-h-screen bg-[#F1F4F9]">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div className="bg-gradient-to-r from-[#121212] to-[#1E293B] rounded-2xl p-6 text-white">
          <div className="flex items-center gap-3 mb-1">
            <Brain size={24} className="text-[#FFCD00]" />
            <h1 className="text-xl font-extrabold">Grammar Exercise Creator</h1>
          </div>
          <p className="text-white/60 text-sm">AI tạo bài tập · Bạn review · Admin duyệt · Học viên học</p>
          {me && <p className="text-white/40 text-xs mt-1">Đăng nhập: {me.displayName ?? me.email} ({me.role})</p>}
        </div>

        {/* Generate panel */}
        <div className="bg-white rounded-2xl p-5 border border-[#E2E8F0] shadow-sm space-y-4">
          <h2 className="font-bold text-[#0F172A]">🤖 Tạo bài tập bằng AI</h2>

          <div className="flex gap-2">
            {CEFR_LEVELS.map(l => (
              <button key={l} onClick={() => setCefr(l)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                style={{ background: l === cefr ? "#121212" : "#EEF4FF", color: l === cefr ? "white" : "#121212" }}>
                {l}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <select value={selectedTopicId ?? ""} onChange={e => setSelectedTopicId(Number(e.target.value))}
              className="flex-1 border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm outline-none focus:border-[#121212]/40">
              {topics.map(t => <option key={t.id} value={t.id}>{t.title_de} — {t.title_vi}</option>)}
            </select>
            <select value={genCount} onChange={e => setGenCount(Number(e.target.value))}
              className="w-20 border border-[#E2E8F0] rounded-xl px-2 py-2 text-sm outline-none">
              {[3, 5, 8, 10, 15, 20].map(n => <option key={n} value={n}>{n} bài</option>)}
            </select>
          </div>

          <button onClick={generate} disabled={generating || !selectedTopicId}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#121212] text-white rounded-xl font-bold text-sm disabled:opacity-50">
            {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {generating ? "AI đang tạo..." : "Tạo bài tập"}
          </button>

          {success && <p className="text-emerald-600 text-sm">{success}</p>}
          {error && <p className="text-red-500 text-sm">{error}</p>}
        </div>

        {/* Drafts list */}
        {Object.keys(draftsByTopic).length > 0 && (
          <div className="space-y-4">
            <h2 className="font-bold text-[#0F172A]">📋 Bài tập của tôi</h2>
            {Object.entries(draftsByTopic).map(([topicIdStr, exs]) => {
              const topicId = Number(topicIdStr);
              const firstEx = exs[0];
              const pending = exs.filter(e => e.status === "DRAFT").length;
              return (
                <div key={topicId} className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 bg-[#F8FAFC] border-b border-[#E2E8F0]">
                    <div>
                      <p className="font-semibold text-sm text-[#0F172A]">{firstEx.topic_title}</p>
                      <p className="text-xs text-[#94A3B8]">{exs.length} bài • {pending} chờ gửi</p>
                    </div>
                    {pending > 0 && (
                      <button onClick={() => void submitAll(topicId)} disabled={submitting}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#121212] text-white rounded-lg text-xs font-bold">
                        <Send size={11} /> Gửi duyệt ({pending})
                      </button>
                    )}
                  </div>
                  <div className="divide-y divide-[#F1F4F9]">
                    {exs.slice(0, 5).map(ex => {
                      let q: any = {};
                      try { q = JSON.parse(ex.question_json); } catch { /* */ }
                      const isOpen = expandedDraft === ex.id;
                      const statusColor = ex.status === "APPROVED" ? "text-emerald-600" :
                        ex.status === "REJECTED" ? "text-red-500" :
                        ex.status === "PENDING_REVIEW" ? "text-amber-500" : "text-[#94A3B8]";
                      return (
                        <div key={ex.id} className="px-4 py-3">
                          <div className="flex items-center justify-between cursor-pointer"
                            onClick={() => setExpandedDraft(isOpen ? null : ex.id)}>
                            <div className="flex-1">
                              <p className="text-sm text-[#0F172A] font-medium line-clamp-1">{q.prompt ?? "(no prompt)"}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] bg-[#121212]/10 px-1.5 py-0.5 rounded font-bold">
                                  {ex.exercise_type}
                                </span>
                                <span className={`text-[10px] font-bold ${statusColor}`}>{ex.status}</span>
                              </div>
                            </div>
                            {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </div>
                          <AnimatePresence>
                            {isOpen && (
                              <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
                                className="overflow-hidden">
                                <div className="pt-3 space-y-2">
                                  <pre className="text-xs bg-[#F8FAFC] rounded-xl p-3 overflow-auto max-h-48 whitespace-pre-wrap">
                                    {JSON.stringify(q, null, 2)}
                                  </pre>
                                  {ex.reject_reason && (
                                    <p className="text-xs text-red-500">❌ Lý do từ chối: {ex.reject_reason}</p>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                    {exs.length > 5 && (
                      <div className="px-4 py-2 text-xs text-[#94A3B8]">+{exs.length - 5} bài tập khác...</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {drafts.length === 0 && (
          <div className="text-center py-12 bg-white rounded-2xl border border-[#E2E8F0]">
            <Brain size={40} className="text-slate-300 mx-auto mb-3" />
            <p className="text-[#64748B]">Chưa có bài tập nào. Hãy tạo bằng AI!</p>
          </div>
        )}

        <button onClick={() => logout()}
          className="text-sm text-[#94A3B8] hover:text-[#64748B] transition-colors">
          Đăng xuất
        </button>
      </div>
    </div>
  );
}
