"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, Settings, Users, BarChart2 } from "lucide-react";
import api from "@/lib/api";

interface PersonalizationData {
  total_learners_with_plan: number;
  avg_sessions_per_week: number;
  cefr_distribution: Record<string, number>;
  topic_preferences: Array<{ topic: string; count: number }>;
  generated_at?: string;
}

export default function PersonalizationRulesetPage() {
  const [data, setData] = useState<PersonalizationData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: res } = await api.get<PersonalizationData>("/admin/reports/personalization-ruleset");
      setData(res);
    } catch { setData(null); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const cefrColors: Record<string, string> = {
    A1: "#16a34a", A2: "#0ea5e9", B1: "#8b5cf6", B2: "#f59e0b", C1: "#ef4444",
  };

  return (
    <div className="p-6 md:p-8 bg-[#F8FAFC] min-h-screen">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#10B981] to-[#059669] flex items-center justify-center">
              <Settings size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-[#0F172A]">Ruleset Cá nhân hóa</h1>
              <p className="text-sm text-[#64748B]">Phân tích phân phối học viên theo trình độ & sở thích chủ đề</p>
            </div>
          </div>
          <button onClick={load} className="p-2 rounded-lg border border-[#E2E8F0] text-[#64748B] hover:bg-white">
            <RefreshCw size={16} />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-[#10B981]" /></div>
        ) : !data ? (
          <div className="text-center py-16 text-[#94A3B8]">Không có dữ liệu</div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-[#ECFDF5] flex items-center justify-center">
                    <Users size={16} className="text-[#10B981]" />
                  </div>
                  <p className="text-xs text-[#64748B] font-medium">Học viên có học lộ trình</p>
                </div>
                <p className="text-3xl font-black text-[#10B981]">{data.total_learners_with_plan}</p>
              </div>
              <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-[#EEF2FF] flex items-center justify-center">
                    <BarChart2 size={16} className="text-[#6366F1]" />
                  </div>
                  <p className="text-xs text-[#64748B] font-medium">TB sessions/tuần</p>
                </div>
                <p className="text-3xl font-black text-[#6366F1]">{data.avg_sessions_per_week?.toFixed(1) ?? "—"}</p>
              </div>
            </div>

            {/* CEFR Distribution */}
            {data.cefr_distribution && Object.keys(data.cefr_distribution).length > 0 && (
              <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6">
                <h2 className="font-bold text-[#0F172A] mb-4">Phân phối trình độ CEFR</h2>
                <div className="space-y-3">
                  {Object.entries(data.cefr_distribution).map(([lvl, count]) => {
                    const total = Object.values(data.cefr_distribution).reduce((a, b) => a + b, 0);
                    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                    const color = cefrColors[lvl] ?? "#6366F1";
                    return (
                      <div key={lvl} className="flex items-center gap-3">
                        <span className="w-8 text-xs font-black" style={{ color }}>{lvl}</span>
                        <div className="flex-1 h-2 bg-[#F1F5F9] rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                        </div>
                        <span className="text-xs font-bold text-[#64748B] w-16 text-right">{count} ({pct}%)</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Topic Preferences */}
            {data.topic_preferences && data.topic_preferences.length > 0 && (
              <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden">
                <div className="px-6 py-4 border-b border-[#F1F5F9]">
                  <h2 className="font-bold text-[#0F172A]">Chủ đề phổ biến nhất</h2>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-[#F8FAFC]">
                    <tr className="text-left text-xs font-bold text-[#64748B] uppercase tracking-wider">
                      <th className="px-6 py-3">#</th>
                      <th className="px-6 py-3">Chủ đề</th>
                      <th className="px-6 py-3 text-right">Lượt chọn</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9]">
                    {data.topic_preferences.slice(0, 10).map((row, i) => (
                      <tr key={row.topic} className="hover:bg-[#FAFBFC]">
                        <td className="px-6 py-3 text-[#94A3B8] text-xs font-bold">{i + 1}</td>
                        <td className="px-6 py-3 font-medium text-[#0F172A]">{row.topic}</td>
                        <td className="px-6 py-3 text-right font-bold text-[#6366F1]">{row.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
