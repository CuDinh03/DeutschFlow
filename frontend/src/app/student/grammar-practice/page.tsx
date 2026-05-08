"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Brain, CheckCircle2, RotateCcw, Loader2, BookOpen, Globe } from "lucide-react";
import { StudentShell } from "@/components/layouts/StudentShell";
import { useStudentPracticeSession } from "@/hooks/useStudentPracticeSession";
import { logout } from "@/lib/authSession";
import api from "@/lib/api";
import { recordAbilityScore, scorePercentToItem } from "@/lib/abilityApi";
import { localAiApi } from "@/lib/localAiApi";

type Tab = "suggestions" | "correct" | "explain" | "analyze" | "cultural";
const TABS: { id: Tab; label: string }[] = [
  { id: "suggestions", label: "Gợi ý" },
  { id: "correct", label: "Sửa lỗi" },
  { id: "explain", label: "Giải thích" },
  { id: "analyze", label: "Phân tích" },
  { id: "cultural", label: "Văn hóa 🇩🇪" },
];
const CEFR = ["A1", "A2", "B1", "B2"] as const;

const CULTURAL_CHIPS = [
  "Pünktlichkeit", "Kaffeekultur", "Duzen vs Siezen", "Begrüßung",
  "Feierabend", "Mülltrennung", "Direktheit", "Weihnachten",
];

export default function GrammarPracticePage() {
  const { me, loading: meLoading, targetLevel, streakDays, initials } = useStudentPracticeSession();
  const [tab, setTab] = useState<Tab>("suggestions");
  const [cefr, setCefr] = useState("A1");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [suggestions, setSuggestions] = useState<{ topic: string; description: string; example: string }[]>([]);
  const [sessionStart] = useState(() => Date.now());

  // Cultural context state
  const [culturalTopic, setCulturalTopic] = useState("");
  const [culturalLoading, setCulturalLoading] = useState(false);
  const [culturalResult, setCulturalResult] = useState<{ topic: string; culturalContext: string } | null>(null);

  const loadSuggestions = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.post<{ suggestions: { topic: string; description: string; example: string }[] }>(
        "/grammar/ai/practice-suggestions", { cefrLevel: cefr, count: 6 }
      );
      setSuggestions(data?.suggestions ?? []);
    } catch { setSuggestions([]); }
    finally { setLoading(false); }
  }, [cefr]);

  useEffect(() => { if (me && tab === "suggestions") void loadSuggestions(); }, [me, tab, loadSuggestions]);

  const run = async () => {
    if (!text.trim()) return;
    setLoading(true); setResult(null);
    const endpoint = tab === "correct" ? "/grammar/ai/correct" : tab === "explain" ? "/grammar/ai/explain" : "/grammar/ai/analyze";
    try {
      const { data } = await api.post<Record<string, unknown>>(endpoint, { text, cefrLevel: cefr });
      setResult(data);
      const score = tab === "analyze" ? Number((data as { score?: number })?.score ?? 70) : (data as { errors?: unknown[] })?.errors?.length ? 60 : 90;
      await recordAbilityScore([scorePercentToItem(score)], Math.max(1, (Date.now() - sessionStart) / 1000));
    } catch { setResult(null); }
    finally { setLoading(false); }
  };

  const runCultural = async (topic?: string) => {
    const t = topic ?? culturalTopic;
    if (!t.trim()) return;
    if (topic) setCulturalTopic(topic);
    setCulturalLoading(true);
    setCulturalResult(null);
    try {
      const res = await localAiApi.culturalContext(t.trim());
      setCulturalResult(res.data);
    } catch { setCulturalResult(null); }
    finally { setCulturalLoading(false); }
  };

  if (meLoading || !me) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin text-[#00305E]" size={28} /></div>;

  return (
    <StudentShell activeSection="grammar-practice" user={me} targetLevel={targetLevel} streakDays={streakDays} initials={initials} onLogout={() => { logout(); }} headerTitle="Luyện ngữ pháp AI" headerSubtitle="Sửa lỗi · Giải thích · Phân tích · Văn hóa">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* CEFR selector */}
        {tab !== "cultural" && (
          <div className="flex gap-2">
            {CEFR.map(l => (
              <button key={l} type="button" onClick={() => setCefr(l)}
                className="px-4 py-2 rounded-xl text-sm font-bold transition-all"
                style={{ background: l === cefr ? "#00305E" : "#EEF4FF", color: l === cefr ? "white" : "#00305E" }}>
                {l}
              </button>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-white rounded-2xl p-1.5 border border-[#E2E8F0] overflow-x-auto">
          {TABS.map(t => (
            <button key={t.id} type="button" onClick={() => { setTab(t.id); setResult(null); setCulturalResult(null); }}
              className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap flex-shrink-0 min-w-[56px]"
              style={{ background: tab === t.id ? "#00305E" : "transparent", color: tab === t.id ? "white" : "#64748B" }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Suggestions */}
        {tab === "suggestions" && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <button type="button" onClick={() => void loadSuggestions()} className="text-xs text-[#00305E] flex items-center gap-1"><RotateCcw size={11} /> Làm mới</button>
            </div>
            {loading ? <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-[#00305E]" /></div> :
              suggestions.map((s, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className="bg-white rounded-2xl p-4 border border-[#E2E8F0] cursor-pointer hover:border-[#00305E]/30"
                  onClick={() => { setText(s.example ?? ""); setTab("correct"); }}>
                  <p className="font-semibold text-sm text-[#0F172A]">{s.topic}</p>
                  <p className="text-xs text-[#64748B] mt-1">{s.description}</p>
                  {s.example && <p className="text-xs italic text-[#475569] bg-[#F8FAFC] px-2 py-1 rounded-lg mt-2 border border-[#E2E8F0]">&ldquo;{s.example}&rdquo;</p>}
                </motion.div>
              ))}
          </div>
        )}

        {/* Cultural context tab */}
        {tab === "cultural" && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4">
              <p className="text-xs text-[#94A3B8] mb-2 font-medium">Chủ đề văn hóa Đức</p>
              <div className="flex gap-2">
                <input
                  value={culturalTopic}
                  onChange={e => setCulturalTopic(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") void runCultural(); }}
                  placeholder="Pünktlichkeit, Kaffeekultur..."
                  className="flex-1 text-sm text-[#0F172A] placeholder-[#CBD5E1] outline-none border border-[#E2E8F0] rounded-xl px-3 py-2"
                />
                <button type="button" onClick={() => void runCultural()} disabled={culturalLoading || !culturalTopic.trim()}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm disabled:opacity-50"
                  style={{ background: "#00305E", color: "white" }}>
                  {culturalLoading ? <Loader2 size={14} className="animate-spin" /> : <Globe size={14} />}
                </button>
              </div>
              {/* Quick chips */}
              <div className="flex flex-wrap gap-1.5 mt-3">
                {CULTURAL_CHIPS.map(chip => (
                  <button key={chip} type="button" onClick={() => void runCultural(chip)}
                    className="text-[11px] px-2.5 py-1 rounded-full bg-[#EEF4FF] text-[#00305E] font-medium hover:bg-[#DBEAFE] transition-colors">
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            {culturalLoading && (
              <div className="flex items-center justify-center py-10 gap-3">
                <Loader2 size={22} className="animate-spin text-[#00305E]" />
                <span className="text-sm text-[#64748B]">AI đang tra cứu văn hóa Đức...</span>
              </div>
            )}

            {culturalResult && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl p-5 border border-[#E2E8F0]">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xl">🇩🇪</span>
                  <p className="font-bold text-[#0F172A]">{culturalResult.topic}</p>
                </div>
                <p className="text-sm text-[#475569] leading-relaxed whitespace-pre-wrap">{culturalResult.culturalContext}</p>
              </motion.div>
            )}
          </div>
        )}

        {/* Text input tabs (correct / explain / analyze) */}
        {tab !== "suggestions" && tab !== "cultural" && (
          <div className="space-y-3">
            <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4">
              <textarea value={text} onChange={e => setText(e.target.value)}
                placeholder={tab === "correct" ? "Ich gehe zu Schule jeden Tag..." : tab === "explain" ? "Dativ, Akkusativ, Modalverben..." : "Ich arbeite seit drei Jahren..."}
                className="w-full resize-none text-sm text-[#0F172A] placeholder-[#CBD5E1] outline-none min-h-[90px]" rows={4} />
              <button type="button" onClick={run} disabled={loading || !text.trim()}
                className="mt-3 flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm disabled:opacity-50"
                style={{ background: "#00305E", color: "white" }}>
                {loading ? <Loader2 size={14} className="animate-spin" /> : tab === "correct" ? <CheckCircle2 size={14} /> : tab === "explain" ? <BookOpen size={14} /> : <Brain size={14} />}
                {loading ? "Đang xử lý..." : tab === "correct" ? "Sửa lỗi" : tab === "explain" ? "Giải thích" : "Phân tích"}
              </button>
            </div>

            {result != null && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl p-4 border border-[#E2E8F0]">
                <p className="text-xs text-[#94A3B8] font-medium mb-3 uppercase tracking-wide">Kết quả</p>
                <pre className="text-xs text-[#0F172A] whitespace-pre-wrap font-mono bg-[#F8FAFC] rounded-xl p-3 border border-[#E2E8F0] overflow-auto max-h-64">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </motion.div>
            )}
          </div>
        )}
      </div>
    </StudentShell>
  );
}
