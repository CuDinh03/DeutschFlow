"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, BookOpen, TrendingUp, Calendar } from "lucide-react";
import api from "@/lib/api";

interface VocabQualityDay {
  date: string;
  total_generated: number;
  approved: number;
  rejected: number;
  pending: number;
  approval_rate_pct: number;
}

interface VocabQualityData {
  days: VocabQualityDay[];
  total_generated: number;
  overall_approval_rate_pct: number;
}

export default function VocabularyQualityPage() {
  const [data, setData] = useState<VocabQualityData | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: res } = await api.get<VocabQualityData>(`/admin/reports/vocabulary-quality?days=${days}`);
      setData(res);
    } catch { setData(null); }
    finally { setLoading(false); }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-6 md:p-8 bg-[#F8FAFC] min-h-screen">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] flex items-center justify-center">
              <BookOpen size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-[#0F172A]">Báo cáo Chất lượng Từ vựng</h1>
              <p className="text-sm text-[#64748B]">Tỷ lệ phê duyệt từ vựng AI theo ngày</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={days}
              onChange={e => setDays(Number(e.target.value))}
              className="text-sm border border-[#E2E8F0] rounded-lg px-3 py-1.5 bg-white"
            >
              <option value={7}>7 ngày</option>
              <option value={14}>14 ngày</option>
              <option value={30}>30 ngày</option>
              <option value={90}>90 ngày</option>
            </select>
            <button onClick={load} className="p-2 rounded-lg border border-[#E2E8F0] text-[#64748B] hover:bg-white">
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-[#6366F1]" /></div>
        ) : !data ? (
          <div className="text-center py-16 text-[#94A3B8]">Không có dữ liệu</div>
        ) : (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Tổng từ vựng sinh", value: data.total_generated, color: "#6366F1", icon: BookOpen },
                { label: "Tỷ lệ phê duyệt", value: `${data.overall_approval_rate_pct}%`, color: "#10B981", icon: TrendingUp },
                { label: "Khoảng thời gian", value: `${days} ngày`, color: "#F59E0B", icon: Calendar },
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

            {/* Daily Table */}
            <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden">
              <div className="px-6 py-4 border-b border-[#F1F5F9]">
                <h2 className="font-bold text-[#0F172A]">Chi tiết theo ngày</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#F8FAFC]">
                    <tr className="text-left text-xs font-bold text-[#64748B] uppercase tracking-wider">
                      <th className="px-6 py-3">Ngày</th>
                      <th className="px-6 py-3 text-center">Sinh ra</th>
                      <th className="px-6 py-3 text-center">Duyệt</th>
                      <th className="px-6 py-3 text-center">Từ chối</th>
                      <th className="px-6 py-3 text-center">Chờ</th>
                      <th className="px-6 py-3 text-center">Tỷ lệ duyệt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9]">
                    {(data.days ?? []).map(row => (
                      <tr key={row.date} className="hover:bg-[#FAFBFC]">
                        <td className="px-6 py-3 font-mono text-xs text-[#64748B]">{row.date}</td>
                        <td className="px-6 py-3 text-center font-bold text-[#0F172A]">{row.total_generated}</td>
                        <td className="px-6 py-3 text-center text-[#10B981] font-bold">{row.approved}</td>
                        <td className="px-6 py-3 text-center text-[#EF4444] font-bold">{row.rejected}</td>
                        <td className="px-6 py-3 text-center text-[#F59E0B] font-bold">{row.pending}</td>
                        <td className="px-6 py-3 text-center">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            row.approval_rate_pct >= 80 ? "bg-[#F0FDF4] text-[#10B981]" :
                            row.approval_rate_pct >= 60 ? "bg-[#FFFBEB] text-[#F59E0B]" :
                            "bg-[#FEF2F2] text-[#EF4444]"
                          }`}>{row.approval_rate_pct}%</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
