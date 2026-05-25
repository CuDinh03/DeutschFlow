"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, MessageSquare, AlertTriangle, TrendingUp } from "lucide-react";
import api from "@/lib/api";

interface GrammarCoverageRow {
  grammar_point: string;
  feedback_count: number;
  distinct_users: number;
  last_seen: string;
}

export default function GrammarFeedbackCoveragePage() {
  const [rows, setRows] = useState<GrammarCoverageRow[]>([]);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<GrammarCoverageRow[]>(
        `/admin/reports/grammar-feedback-coverage?days=${days}`
      );
      setRows(data ?? []);
    } catch { setRows([]); }
    finally { setLoading(false); }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const maxCount = Math.max(...rows.map(r => r.feedback_count), 1);

  return (
    <div className="p-6 md:p-8 bg-[#F8FAFC] min-h-screen">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#F59E0B] to-[#D97706] flex items-center justify-center">
              <MessageSquare size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-[#0F172A]">Báo cáo Phản hồi Ngữ pháp</h1>
              <p className="text-sm text-[#64748B]">Lỗi ngữ pháp phổ biến cần bổ sung nội dung</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select value={days} onChange={e => setDays(Number(e.target.value))}
              className="text-sm border border-[#E2E8F0] rounded-lg px-3 py-1.5 bg-white">
              <option value={7}>7 ngày</option>
              <option value={14}>14 ngày</option>
              <option value={30}>30 ngày</option>
            </select>
            <button onClick={load} className="p-2 rounded-lg border border-[#E2E8F0] text-[#64748B] hover:bg-white">
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-[#F59E0B]" /></div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center py-20 gap-3 text-[#94A3B8] bg-white rounded-2xl border border-[#E2E8F0]">
            <AlertTriangle size={40} className="opacity-30" />
            <p className="font-medium">Không có dữ liệu trong {days} ngày</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Điểm ngữ pháp", value: rows.length, color: "#F59E0B", icon: MessageSquare },
                { label: "Tổng phản hồi", value: rows.reduce((s, r) => s + r.feedback_count, 0), color: "#6366F1", icon: TrendingUp },
                { label: "Học viên max", value: Math.max(...rows.map(r => r.distinct_users)), color: "#EF4444", icon: AlertTriangle },
              ].map(({ label, value, color, icon: Icon }) => (
                <div key={label} className="bg-white rounded-2xl border border-[#E2E8F0] p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: color + "15" }}>
                      <Icon size={16} style={{ color }} />
                    </div>
                    <p className="text-xs text-[#64748B] font-medium">{label}</p>
                  </div>
                  <p className="text-2xl font-black" style={{ color }}>{value}</p>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden">
              <div className="px-6 py-4 border-b border-[#F1F5F9]">
                <h2 className="font-bold text-[#0F172A]">Điểm ngữ pháp cần chú ý</h2>
              </div>
              <div className="divide-y divide-[#F1F5F9]">
                {rows.slice(0, 20).map((row, i) => {
                  const pct = Math.round((row.feedback_count / maxCount) * 100);
                  return (
                    <div key={row.grammar_point} className="px-6 py-4 hover:bg-[#FAFBFC]">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-black text-[#94A3B8] w-6">{i + 1}</span>
                          <span className="font-semibold text-sm text-[#0F172A]">{row.grammar_point}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-[#64748B]">
                          <span className="font-bold text-[#F59E0B]">{row.feedback_count} lần</span>
                          <span>{row.distinct_users} học viên</span>
                        </div>
                      </div>
                      <div className="ml-9 h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-[#F59E0B]" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
