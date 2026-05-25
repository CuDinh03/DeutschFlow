"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2, XCircle, Loader2, RefreshCw,
  ChevronDown, ChevronUp, CheckCheck, Filter
} from "lucide-react";
import api from "@/lib/api";

interface PendingExercise {
  id: number;
  exercise_type: string;
  difficulty: number;
  question_json: string;
  status: string;
  topic_id: number;
  topic_title_vi?: string;
  cefr_level?: string;
  created_by_name?: string;
}

export default function AdminGrammarReviewPage() {
  const [exercises, setExercises] = useState<PendingExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [actionId, setActionId] = useState<number | null>(null);
  const [bulkWorking, setBulkWorking] = useState(false);
  const [rejectReason, setRejectReason] = useState<Record<number, string>>({});
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [filterLevel, setFilterLevel] = useState("ALL");

  const showMsg = (type: "ok" | "err", text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<PendingExercise[]>("/grammar/syllabus/admin/pending");
      setExercises(data ?? []);
      setSelected(new Set());
    } catch { setExercises([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const approve = async (id: number) => {
    setActionId(id);
    try {
      await api.post(`/grammar/syllabus/admin/exercises/${id}/approve`);
      setExercises(prev => prev.filter(e => e.id !== id));
      showMsg("ok", "✅ Đã phê duyệt bài tập");
    } catch { showMsg("err", "Lỗi phê duyệt"); }
    finally { setActionId(null); }
  };

  const reject = async (id: number) => {
    setActionId(id);
    try {
      await api.post(`/grammar/syllabus/admin/exercises/${id}/reject`, { reason: rejectReason[id] ?? "" });
      setExercises(prev => prev.filter(e => e.id !== id));
      showMsg("ok", "❌ Đã từ chối bài tập");
    } catch { showMsg("err", "Lỗi từ chối"); }
    finally { setActionId(null); }
  };

  const bulkApprove = async () => {
    if (selected.size === 0) return;
    setBulkWorking(true);
    try {
      await api.post("/grammar/syllabus/admin/exercises/bulk-approve", { ids: Array.from(selected) });
      setExercises(prev => prev.filter(e => !selected.has(e.id)));
      showMsg("ok", `✅ Đã duyệt ${selected.size} bài tập`);
      setSelected(new Set());
    } catch { showMsg("err", "Lỗi duyệt hàng loạt"); }
    finally { setBulkWorking(false); }
  };

  const toggleSelect = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const filtered = filterLevel === "ALL" ? exercises : exercises.filter(e => e.cefr_level === filterLevel);

  return (
    <div className="p-6 md:p-8 min-h-screen bg-[#F8FAFC]">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-[#0F172A]">Duyệt Bài tập Ngữ pháp</h1>
            <p className="text-sm text-[#64748B] mt-0.5">{exercises.length} bài đang chờ phê duyệt</p>
          </div>
          <div className="flex items-center gap-2">
            {selected.size > 0 && (
              <button
                onClick={bulkApprove}
                disabled={bulkWorking}
                className="flex items-center gap-2 px-4 py-2 bg-[#10B981] text-white rounded-xl text-sm font-bold hover:bg-[#059669] transition-colors disabled:opacity-60"
              >
                {bulkWorking ? <Loader2 size={14} className="animate-spin" /> : <CheckCheck size={14} />}
                Duyệt {selected.size} bài
              </button>
            )}
            <button onClick={load} className="p-2 rounded-xl border border-[#E2E8F0] text-[#64748B] hover:bg-white">
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        {/* Toast */}
        <AnimatePresence>
          {msg && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className={`mb-4 px-4 py-3 rounded-xl text-sm font-medium ${
                msg.type === "ok" ? "bg-[#F0FDF4] text-[#15803D] border border-[#BBF7D0]" : "bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA]"
              }`}>
              {msg.text}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Filters */}
        <div className="flex items-center gap-2 mb-4">
          <Filter size={14} className="text-[#94A3B8]" />
          {["ALL", "A1", "A2", "B1", "B2"].map(lvl => (
            <button
              key={lvl}
              onClick={() => setFilterLevel(lvl)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                filterLevel === lvl ? "bg-[#6366F1] text-white" : "bg-white border border-[#E2E8F0] text-[#64748B] hover:border-[#6366F1] hover:text-[#6366F1]"
              }`}
            >
              {lvl === "ALL" ? "Tất cả" : lvl}
            </button>
          ))}

          {filtered.length > 0 && (
            <button
              onClick={() => setSelected(filtered.every(e => selected.has(e.id)) ? new Set() : new Set(filtered.map(e => e.id)))}
              className="ml-auto text-xs font-semibold text-[#6366F1] hover:underline"
            >
              {filtered.every(e => selected.has(e.id)) ? "Bỏ chọn tất cả" : "Chọn tất cả"}
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-[#6366F1]" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-20 gap-3 text-[#94A3B8] bg-white rounded-2xl border border-[#E2E8F0]">
            <CheckCircle2 size={40} className="opacity-30" />
            <p className="font-medium">Không có bài tập nào cần duyệt</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(ex => {
              let parsed: any = {};
              try { parsed = JSON.parse(ex.question_json); } catch { /* ignore */ }

              return (
                <div key={ex.id} className={`bg-white rounded-2xl border transition-all ${selected.has(ex.id) ? "border-[#6366F1] ring-2 ring-[#6366F1]/20" : "border-[#E2E8F0]"}`}>
                  <div className="flex items-start gap-3 p-4">
                    <input
                      type="checkbox"
                      checked={selected.has(ex.id)}
                      onChange={() => toggleSelect(ex.id)}
                      className="mt-1 w-4 h-4 rounded accent-[#6366F1] cursor-pointer flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-[#0F172A]">{parsed.prompt ?? "Bài tập"}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {ex.cefr_level && (
                          <span className="text-[10px] bg-[#EEF2FF] text-[#6366F1] font-bold px-1.5 py-0.5 rounded">
                            {ex.cefr_level}
                          </span>
                        )}
                        <span className="text-[10px] bg-[#F1F5F9] text-[#64748B] px-1.5 py-0.5 rounded">
                          {ex.exercise_type}
                        </span>
                        {ex.topic_title_vi && (
                          <span className="text-[10px] text-[#94A3B8] truncate">{ex.topic_title_vi}</span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => approve(ex.id)}
                        disabled={actionId === ex.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F0FDF4] text-[#10B981] border border-[#BBF7D0] rounded-lg text-xs font-bold hover:bg-[#DCFCE7] transition-colors disabled:opacity-60"
                      >
                        {actionId === ex.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                        Duyệt
                      </button>
                      <button
                        onClick={() => setExpandedId(expandedId === ex.id ? null : ex.id)}
                        className="text-[#94A3B8] hover:text-[#0F172A] transition-colors"
                      >
                        {expandedId === ex.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </div>
                  </div>

                  <AnimatePresence>
                    {expandedId === ex.id && (
                      <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                        <div className="px-4 pb-4 border-t border-[#F1F5F9] pt-3 space-y-3">
                          {parsed.options && (
                            <div className="flex flex-wrap gap-2">
                              {parsed.options.map((o: string, i: number) => (
                                <span key={i} className={`text-xs px-2.5 py-1 rounded-lg ${
                                  o === parsed.correct_answer
                                    ? "bg-[#F0FDF4] text-[#10B981] font-bold border border-[#BBF7D0]"
                                    : "bg-[#F1F5F9] text-[#64748B]"
                                }`}>{o}</span>
                              ))}
                            </div>
                          )}
                          {parsed.explanation_vi && (
                            <p className="text-xs text-[#64748B] italic">{parsed.explanation_vi}</p>
                          )}

                          {/* Reject with reason */}
                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="Lý do từ chối (tuỳ chọn)..."
                              value={rejectReason[ex.id] ?? ""}
                              onChange={e => setRejectReason(prev => ({ ...prev, [ex.id]: e.target.value }))}
                              className="flex-1 text-xs border border-[#E2E8F0] rounded-lg px-3 py-2 focus:outline-none focus:border-[#EF4444]"
                            />
                            <button
                              onClick={() => reject(ex.id)}
                              disabled={actionId === ex.id}
                              className="flex items-center gap-1.5 px-3 py-2 bg-[#FEF2F2] text-[#EF4444] border border-[#FECACA] rounded-lg text-xs font-bold hover:bg-[#FEE2E2] transition-colors disabled:opacity-60"
                            >
                              {actionId === ex.id ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />}
                              Từ chối
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
