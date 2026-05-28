"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, FileEdit, CheckCircle2, Clock, Send, SendHorizonal,
  Loader2, RefreshCw, BookOpen, ChevronDown, ChevronUp, AlertCircle
} from "lucide-react";
import api from "@/lib/api";

interface GrammarTopic {
  id: number;
  cefr_level: string;
  title_de: string;
  title_vi: string;
}

interface DraftExercise {
  id: number;
  exercise_type: string;
  difficulty: number;
  question_json: string;
  status: string;
  topic_id: number;
}

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  DRAFT:        { label: "Bản nháp",   color: "#64748B" },
  PENDING_REVIEW: { label: "Chờ duyệt", color: "#F59E0B" },
  APPROVED:     { label: "Đã duyệt",   color: "#10B981" },
  REJECTED:     { label: "Bị từ chối", color: "#EF4444" },
};

export default function TeacherGrammarPage() {
  const params = useParams();

  const [topics, setTopics] = useState<GrammarTopic[]>([]);
  const [drafts, setDrafts] = useState<DraftExercise[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<GrammarTopic | null>(null);
  const [generatingFor, setGeneratingFor] = useState<number | null>(null);
  const [submittingId, setSubmittingId] = useState<number | null>(null);
  const [submittingAll, setSubmittingAll] = useState<number | null>(null);
  const [loadingTopics, setLoadingTopics] = useState(true);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const showMsg = (type: "ok" | "err", text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 4000);
  };

  const loadTopics = useCallback(async () => {
    setLoadingTopics(true);
    try {
      const { data } = await api.get<GrammarTopic[]>("/grammar/syllabus/topics?cefrLevel=A1");
      setTopics(data ?? []);
    } catch { setTopics([]); }
    finally { setLoadingTopics(false); }
  }, []);

  const loadDrafts = useCallback(async () => {
    setLoadingDrafts(true);
    try {
      const { data } = await api.get<DraftExercise[]>("/grammar/syllabus/exercises/my-drafts");
      setDrafts(data ?? []);
    } catch { setDrafts([]); }
    finally { setLoadingDrafts(false); }
  }, []);

  useEffect(() => { loadTopics(); loadDrafts(); }, [loadTopics, loadDrafts]);

  const generate = async (topic: GrammarTopic) => {
    setGeneratingFor(topic.id);
    try {
      const { data } = await api.post<DraftExercise[]>(
        `/grammar/syllabus/topics/${topic.id}/generate`,
        { count: 5 }
      );
      showMsg("ok", `✅ Đã sinh ${data?.length ?? 5} bài tập cho "${topic.title_vi}"`);
      loadDrafts();
    } catch (e: any) {
      showMsg("err", e?.response?.data?.error ?? "Lỗi sinh bài tập");
    } finally { setGeneratingFor(null); }
  };

  const submitOne = async (exerciseId: number) => {
    setSubmittingId(exerciseId);
    try {
      await api.post(`/grammar/syllabus/exercises/${exerciseId}/submit-review`);
      showMsg("ok", "📤 Đã nộp duyệt bài tập");
      loadDrafts();
    } catch {
      showMsg("err", "Không thể nộp duyệt");
    } finally { setSubmittingId(null); }
  };

  const submitAll = async (topicId: number) => {
    setSubmittingAll(topicId);
    try {
      await api.post(`/grammar/syllabus/topics/${topicId}/submit-all-review`);
      showMsg("ok", "📤 Đã nộp tất cả bài tập cho duyệt");
      loadDrafts();
    } catch {
      showMsg("err", "Không thể nộp hàng loạt");
    } finally { setSubmittingAll(null); }
  };

  const topicDrafts = selectedTopic
    ? drafts.filter(d => d.topic_id === selectedTopic.id)
    : drafts;

  return (
    <div className="p-6 md:p-8 bg-[#F8FAFC] min-h-screen">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] flex items-center justify-center">
              <Brain size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-[#0F172A]">Quản lý Bài tập Ngữ pháp</h1>
              <p className="text-sm text-[#64748B]">Sinh bài tập AI → Nộp duyệt → Admin phê duyệt</p>
            </div>
          </div>
          <button
            onClick={() => { loadTopics(); loadDrafts(); }}
            className="p-2 rounded-lg border border-[#E2E8F0] text-[#64748B] hover:bg-white transition-all"
          >
            <RefreshCw size={16} />
          </button>
        </div>

        {/* Toast */}
        <AnimatePresence>
          {msg && (
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className={`mb-4 px-4 py-3 rounded-xl text-sm font-medium ${
                msg.type === "ok" ? "bg-[#F0FDF4] text-[#15803D] border border-[#BBF7D0]" : "bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA]"
              }`}
            >
              {msg.text}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Topic List */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 space-y-2">
            <p className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider mb-3">Chủ đề ngữ pháp</p>
            {loadingTopics ? (
              <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-[#6366F1]" /></div>
            ) : topics.map(topic => (
              <div key={topic.id} className="space-y-2">
                <button
                  onClick={() => setSelectedTopic(selectedTopic?.id === topic.id ? null : topic)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    selectedTopic?.id === topic.id
                      ? "bg-[#EEF2FF] text-[#6366F1] border border-[#6366F1]/20"
                      : "hover:bg-[#F8FAFC] text-[#0F172A]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="truncate">{topic.title_vi}</span>
                    <span className="text-[10px] bg-[#F1F5F9] text-[#64748B] px-1.5 py-0.5 rounded font-bold ml-2 flex-shrink-0">
                      {topic.cefr_level}
                    </span>
                  </div>
                </button>

                {selectedTopic?.id === topic.id && (
                  <div className="flex gap-2 pl-2">
                    <button
                      onClick={() => generate(topic)}
                      disabled={generatingFor === topic.id}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] disabled:opacity-60 transition-all"
                    >
                      {generatingFor === topic.id ? <Loader2 size={12} className="animate-spin" /> : <Brain size={12} />}
                      Sinh AI (5)
                    </button>
                    <button
                      onClick={() => submitAll(topic.id)}
                      disabled={submittingAll === topic.id}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold border border-[#E2E8F0] text-[#0F172A] hover:bg-[#F8FAFC] disabled:opacity-60 transition-all"
                    >
                      {submittingAll === topic.id ? <Loader2 size={12} className="animate-spin" /> : <SendHorizonal size={12} />}
                      Nộp tất cả
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Drafts List */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-bold text-[#0F172A]">
                {selectedTopic ? `Bài tập: "${selectedTopic.title_vi}"` : "Tất cả bản nháp của tôi"}
                <span className="ml-2 text-xs font-normal text-[#94A3B8]">({topicDrafts.length} bài)</span>
              </p>
            </div>

            {loadingDrafts ? (
              <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-[#6366F1]" /></div>
            ) : topicDrafts.length === 0 ? (
              <div className="flex flex-col items-center py-16 gap-3 text-[#94A3B8] bg-white rounded-2xl border border-[#E2E8F0]">
                <BookOpen size={36} className="opacity-30" />
                <p className="font-medium">Chưa có bài tập nào</p>
                <p className="text-sm">Chọn một chủ đề và bấm &quot;Sinh AI&quot; để tạo bài tập</p>
              </div>
            ) : topicDrafts.map((ex) => {
              const badge = STATUS_BADGE[ex.status] ?? STATUS_BADGE["DRAFT"];
              let parsed: any = {};
              try { parsed = JSON.parse(ex.question_json); } catch { /* ignore */ }

              return (
                <div key={ex.id} className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="w-8 h-8 rounded-lg bg-[#EEF2FF] flex items-center justify-center flex-shrink-0">
                      <FileEdit size={14} className="text-[#6366F1]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#0F172A] truncate">{parsed.prompt ?? "Bài tập ngữ pháp"}</p>
                      <p className="text-xs text-[#94A3B8]">{ex.exercise_type} · Độ khó {ex.difficulty}/5</p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{ background: badge.color + "15", color: badge.color }}>
                      {badge.label}
                    </span>
                    <button onClick={() => setExpandedId(expandedId === ex.id ? null : ex.id)}
                      className="text-[#94A3B8] hover:text-[#0F172A] transition-colors">
                      {expandedId === ex.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>

                  <AnimatePresence>
                    {expandedId === ex.id && (
                      <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
                        className="overflow-hidden border-t border-[#F1F5F9]">
                        <div className="px-4 py-3 bg-[#FAFBFC]">
                          {parsed.options && (
                            <div className="flex flex-wrap gap-2 mb-2">
                              {parsed.options.map((o: string, i: number) => (
                                <span key={i} className={`text-xs px-2 py-1 rounded-lg ${o === parsed.correct_answer ? "bg-[#F0FDF4] text-[#10B981] font-bold border border-[#BBF7D0]" : "bg-[#F1F5F9] text-[#64748B]"}`}>{o}</span>
                              ))}
                            </div>
                          )}
                          {parsed.explanation_vi && (
                            <p className="text-xs text-[#64748B] italic mb-3">{parsed.explanation_vi}</p>
                          )}
                          {ex.status === "DRAFT" && (
                            <button
                              onClick={() => submitOne(ex.id)}
                              disabled={submittingId === ex.id}
                              className="flex items-center gap-1.5 text-xs font-bold text-[#6366F1] hover:underline disabled:opacity-50"
                            >
                              {submittingId === ex.id ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                              Nộp bài này để duyệt
                            </button>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
