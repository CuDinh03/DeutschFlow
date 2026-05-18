"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TeacherShell } from "@/components/layouts/TeacherShell";
import api from "@/lib/api";
import { logout } from "@/lib/authSession";
import {
  BookOpen, ChevronRight, Sparkles, Send, Loader2,
  CheckCircle2, Clock, AlertCircle, ChevronDown
} from "lucide-react";

interface AuthMe { displayName: string; role: string; }
interface GrammarTopic {
  topicId: number;
  topic: string;
  cefrLevel: string;
  totalExercises: number;
  completedExercises: number;
}
interface DraftExercise {
  id: number;
  topicId: number;
  topicName: string;
  question: string;
  status: string;
  createdAt: string;
}

const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];

export default function TeacherGrammarPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthMe | null>(null);
  const [selectedLevel, setSelectedLevel] = useState("A1");
  const [topics, setTopics] = useState<GrammarTopic[]>([]);
  const [drafts, setDrafts] = useState<DraftExercise[]>([]);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const [generatingId, setGeneratingId] = useState<number | null>(null);
  const [submittingId, setSubmittingId] = useState<number | null>(null);
  const [expandedTopicId, setExpandedTopicId] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    api.get<AuthMe>("/auth/me").then((res) => {
      if (res.data.role !== "TEACHER" && res.data.role !== "ADMIN") {
        router.push("/dashboard");
        return;
      }
      setUser(res.data);
    }).catch(() => router.push("/login"));
  }, [router]);

  const loadTopics = useCallback(async () => {
    setLoadingTopics(true);
    try {
      const { data } = await api.get<GrammarTopic[]>(`/grammar/syllabus/topics?cefrLevel=${selectedLevel}`);
      setTopics(data || []);
    } catch { setTopics([]); }
    finally { setLoadingTopics(false); }
  }, [selectedLevel]);

  const loadDrafts = useCallback(async () => {
    setLoadingDrafts(true);
    try {
      const { data } = await api.get<DraftExercise[]>("/grammar/syllabus/exercises/my-drafts");
      setDrafts(data || []);
    } catch { setDrafts([]); }
    finally { setLoadingDrafts(false); }
  }, []);

  useEffect(() => { if (user) { loadTopics(); loadDrafts(); } }, [user, loadTopics, loadDrafts]);

  const handleGenerate = async (topicId: number) => {
    setGeneratingId(topicId);
    setMsg(null);
    try {
      await api.post(`/grammar/syllabus/topics/${topicId}/generate`, { count: 5 });
      setMsg({ type: "success", text: "Đã sinh 5 bài tập mới! Kiểm tra trong mục Bản nháp bên dưới." });
      loadDrafts();
    } catch (e: any) {
      setMsg({ type: "error", text: e?.response?.data?.detail ?? "Lỗi khi sinh bài tập" });
    } finally { setGeneratingId(null); }
  };

  const handleSubmitReview = async (exerciseId: number) => {
    setSubmittingId(exerciseId);
    try {
      await api.post(`/grammar/syllabus/exercises/${exerciseId}/submit-review`);
      setMsg({ type: "success", text: "Đã gửi bài tập để Admin xét duyệt!" });
      loadDrafts();
    } catch (e: any) {
      setMsg({ type: "error", text: e?.response?.data?.detail ?? "Lỗi khi gửi bài tập" });
    } finally { setSubmittingId(null); }
  };

  const handleSubmitAllForTopic = async (topicId: number) => {
    setGeneratingId(topicId);
    try {
      await api.post(`/grammar/syllabus/topics/${topicId}/submit-all-review`);
      setMsg({ type: "success", text: "Đã gửi toàn bộ bản nháp của chủ đề này để xét duyệt!" });
      loadDrafts();
    } catch (e: any) {
      setMsg({ type: "error", text: e?.response?.data?.detail ?? "Lỗi khi gửi bài tập" });
    } finally { setGeneratingId(null); }
  };

  if (!user) return (
    <div className="flex h-screen items-center justify-center">
      <Loader2 className="animate-spin text-indigo-500" size={32} />
    </div>
  );

  const topicDraftMap: Record<number, DraftExercise[]> = {};
  drafts.forEach(d => {
    if (!topicDraftMap[d.topicId]) topicDraftMap[d.topicId] = [];
    topicDraftMap[d.topicId].push(d);
  });

  return (
    <TeacherShell
      activeMenu="grammar"
      userName={user.displayName}
      onLogout={() => logout()}
      headerTitle="🧠 Ngữ pháp AI"
      headerSubtitle="Sinh bài tập ngữ pháp bằng AI và gửi Admin xét duyệt"
    >
      <div className="p-6 max-w-5xl mx-auto space-y-8">

        {/* Message Banner */}
        {msg && (
          <div className={`flex items-center gap-3 p-4 rounded-2xl text-sm font-semibold ${
            msg.type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"
          }`}>
            {msg.type === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            {msg.text}
          </div>
        )}

        {/* Level Selector */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <BookOpen size={20} className="text-indigo-500" /> Chọn cấp độ CEFR
          </h2>
          <div className="flex flex-wrap gap-3">
            {CEFR_LEVELS.map(level => (
              <button
                key={level}
                onClick={() => setSelectedLevel(level)}
                className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${
                  selectedLevel === level
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200"
                    : "bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600"
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        {/* Topics List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-slate-800 text-lg flex items-center gap-2">
              <Sparkles size={20} className="text-indigo-500" />
              Chủ đề ngữ pháp — {selectedLevel}
              <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded-full">{topics.length}</span>
            </h2>
          </div>

          {loadingTopics ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin text-indigo-400" size={28} /></div>
          ) : topics.length === 0 ? (
            <div className="text-center py-12 text-slate-500 border border-dashed rounded-2xl">
              Chưa có chủ đề nào cho cấp độ {selectedLevel}.
            </div>
          ) : (
            topics.map(topic => {
              const topicDrafts = topicDraftMap[topic.topicId] || [];
              const isExpanded = expandedTopicId === topic.topicId;
              return (
                <div key={topic.topicId} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0">
                        <BookOpen size={18} className="text-indigo-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-slate-800 truncate">{topic.topic}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {topic.totalExercises} bài tập • {topicDrafts.length > 0 && (
                            <span className="text-amber-600 font-bold">{topicDrafts.length} bản nháp</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {topicDrafts.length > 0 && (
                        <button
                          onClick={() => setExpandedTopicId(isExpanded ? null : topic.topicId)}
                          className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-xl transition-colors"
                        >
                          <Clock size={14} /> {topicDrafts.length} nháp
                          <ChevronDown size={14} className={`transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                        </button>
                      )}
                      {topicDrafts.length > 0 && (
                        <button
                          onClick={() => handleSubmitAllForTopic(topic.topicId)}
                          disabled={generatingId === topic.topicId}
                          className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-colors disabled:opacity-50"
                        >
                          <Send size={14} /> Gửi tất cả
                        </button>
                      )}
                      <button
                        onClick={() => handleGenerate(topic.topicId)}
                        disabled={generatingId === topic.topicId}
                        className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors disabled:opacity-60"
                      >
                        {generatingId === topic.topicId
                          ? <><Loader2 size={14} className="animate-spin" /> Đang sinh...</>
                          : <><Sparkles size={14} /> Sinh AI</>
                        }
                      </button>
                    </div>
                  </div>

                  {/* Drafts Dropdown */}
                  {isExpanded && topicDrafts.length > 0 && (
                    <div className="border-t border-slate-100 bg-slate-50 p-4 space-y-3">
                      {topicDrafts.map(draft => (
                        <div key={draft.id} className="bg-white rounded-xl border border-slate-200 p-4 flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-slate-700 font-medium line-clamp-2">{draft.question}</p>
                            <p className="text-xs text-slate-400 mt-1">
                              {new Date(draft.createdAt).toLocaleDateString("vi-VN")}
                              {" · "}
                              <span className={`font-bold ${draft.status === "DRAFT" ? "text-amber-600" : draft.status === "PENDING_REVIEW" ? "text-blue-600" : "text-emerald-600"}`}>
                                {draft.status === "DRAFT" ? "Bản nháp" : draft.status === "PENDING_REVIEW" ? "Chờ duyệt" : "Đã duyệt"}
                              </span>
                            </p>
                          </div>
                          {draft.status === "DRAFT" && (
                            <button
                              onClick={() => handleSubmitReview(draft.id)}
                              disabled={submittingId === draft.id}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50 shrink-0"
                            >
                              {submittingId === draft.id ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                              Gửi duyệt
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </TeacherShell>
  );
}
