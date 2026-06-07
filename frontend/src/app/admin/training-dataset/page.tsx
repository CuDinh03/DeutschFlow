"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, Download, Database, MessageSquare, AlertTriangle } from "lucide-react";
import api from "@/lib/api";
import { getAccessToken } from "@/lib/authSession";

interface DatasetStats {
  total_conversations: number;
  total_messages: number;
  total_errors: number;
  last_exported_at?: string;
}

async function downloadJson(url: string, filename: string, token: string) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL ?? ""}${url}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Không thể tải file");
  const blob = await res.blob();
  const link = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = link;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(link);
}

export default function TrainingDatasetPage() {
  const [stats, setStats] = useState<DatasetStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<DatasetStats>("/admin/training-dataset/stats");
      setStats(data);
    } catch { setStats(null); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDownload = async (type: "conversations" | "errors") => {
    setDownloading(type);
    setErrMsg(null);
    try {
      const token = getAccessToken() ?? "";
      const url = type === "conversations"
        ? "/api/admin/training-dataset/export/conversations"
        : "/api/admin/training-dataset/export/errors";
      const fname = `deutschflow-training-${type}-${new Date().toISOString().slice(0, 10)}.json`;
      await downloadJson(url, fname, token);
    } catch (e: any) {
      setErrMsg(e.message ?? "Lỗi tải dữ liệu");
    } finally { setDownloading(null); }
  };

  return (
    <div className="p-6 md:p-8 bg-[#F8FAFC] min-h-screen">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0F172A] to-[#1E293B] flex items-center justify-center">
              <Database size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-[#0F172A]">Training Dataset Export</h1>
              <p className="text-sm text-[#64748B]">Xuất dữ liệu hội thoại & lỗi để fine-tune AI model</p>
            </div>
          </div>
          <button onClick={load} className="p-2 rounded-lg border border-[#E2E8F0] text-[#64748B] hover:bg-white">
            <RefreshCw size={16} />
          </button>
        </div>

        {errMsg && (
          <div className="mb-4 px-4 py-3 rounded-xl text-sm font-medium bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA]">
            {errMsg}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-[#0F172A]" /></div>
        ) : (
          <div className="space-y-6">
            {/* Stats */}
            {stats && (
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: "Hội thoại", value: stats.total_conversations, color: "#6366F1", icon: MessageSquare },
                  { label: "Tin nhắn", value: stats.total_messages, color: "#0EA5E9", icon: Database },
                  { label: "Lỗi ghi nhận", value: stats.total_errors, color: "#F59E0B", icon: AlertTriangle },
                ].map(({ label, value, color, icon: Icon }) => (
                  <div key={label} className="bg-white rounded-2xl border border-[#E2E8F0] p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: color + "15" }}>
                        <Icon size={16} style={{ color }} />
                      </div>
                      <p className="text-xs text-[#64748B] font-medium">{label}</p>
                    </div>
                    <p className="text-3xl font-black" style={{ color }}>{value?.toLocaleString() ?? 0}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Export Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                {
                  key: "conversations" as const,
                  title: "Xuất Hội thoại",
                  desc: "Toàn bộ lịch sử hội thoại AI (JSONL format, dùng để fine-tune conversation model)",
                  icon: MessageSquare,
                  color: "#6366F1",
                },
                {
                  key: "errors" as const,
                  title: "Xuất Lỗi ngữ pháp",
                  desc: "Tập dữ liệu lỗi học viên với correction (dùng để fine-tune grammar model)",
                  icon: AlertTriangle,
                  color: "#F59E0B",
                },
              ].map(({ key, title, desc, icon: Icon, color }) => (
                <div key={key} className="bg-white rounded-2xl border border-[#E2E8F0] p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: color + "15" }}>
                      <Icon size={20} style={{ color }} />
                    </div>
                    <h2 className="font-bold text-[#0F172A]">{title}</h2>
                  </div>
                  <p className="text-sm text-[#64748B] mb-5 leading-relaxed">{desc}</p>
                  <button
                    onClick={() => handleDownload(key)}
                    disabled={downloading === key}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-white transition-all disabled:opacity-60"
                    style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }}
                  >
                    {downloading === key
                      ? <><Loader2 size={16} className="animate-spin" /> Đang xuất...</>
                      : <><Download size={16} /> Tải xuống JSON</>
                    }
                  </button>
                </div>
              ))}
            </div>

            <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-xl px-4 py-3">
              <p className="text-xs text-[#92400E] font-medium">
                ⚠️ Dữ liệu này chứa thông tin người dùng đã được ẩn danh hóa. Chỉ dùng cho mục đích cải thiện AI model. Không chia sẻ bên ngoài.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
