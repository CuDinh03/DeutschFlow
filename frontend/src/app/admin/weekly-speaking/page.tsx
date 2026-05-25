"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Pencil, Trash2, Loader2, Save, X, RefreshCw } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import useAdminData from "@/hooks/useAdminData";
import api from "@/lib/api";

interface WeeklyPrompt {
  id: number;
  weekNumber: number;
  cefrLevel: string;
  topicDe: string;
  topicVi: string;
  descriptionVi?: string;
  isActive: boolean;
  createdAt?: string;
}

interface PromptForm {
  weekNumber: number;
  cefrLevel: string;
  topicDe: string;
  topicVi: string;
  descriptionVi: string;
  isActive: boolean;
}

const EMPTY_FORM: PromptForm = { weekNumber: 1, cefrLevel: "A1", topicDe: "", topicVi: "", descriptionVi: "", isActive: true };

export default function AdminWeeklySpeakingPage() {
  const [form, setForm] = useState<PromptForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  const { data: prompts, loading, refreshing, error, lastSyncedAt, reload } = useAdminData<WeeklyPrompt[]>({
    initialData: [],
    errorMessage: "Không thể tải weekly prompts.",
    fetchData: async () => {
      const res = await api.get<WeeklyPrompt[]>("/admin/speaking/weekly-prompts");
      return Array.isArray(res.data) ? res.data : [];
    },
  });

  const openCreate = () => { setForm(EMPTY_FORM); setEditingId(null); setShowForm(true); };
  const openEdit = (p: WeeklyPrompt) => {
    setForm({ weekNumber: p.weekNumber, cefrLevel: p.cefrLevel, topicDe: p.topicDe, topicVi: p.topicVi, descriptionVi: p.descriptionVi ?? "", isActive: p.isActive });
    setEditingId(p.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.topicDe.trim() || !form.topicVi.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/admin/speaking/weekly-prompts/${editingId}`, form);
      } else {
        await api.post("/admin/speaking/weekly-prompts", form);
      }
      setShowForm(false);
      void reload({ silent: true });
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Xác nhận xóa prompt này?")) return;
    setDeleting(id);
    try {
      await api.delete(`/admin/speaking/weekly-prompts/${id}`);
      void reload({ silent: true });
    } catch (e) { console.error(e); }
    finally { setDeleting(null); }
  };

  return (
    <AdminShell title="Weekly Speaking Prompts" subtitle="Quản lý chủ đề Speaking hàng tuần" activeNav="weekly-speaking"
      error={error} refreshing={refreshing} onRefresh={() => reload({ silent: true })} lastSyncedAt={lastSyncedAt}>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">{(prompts ?? []).length} prompts</p>
          <button type="button" onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#121212] text-white text-sm font-semibold hover:bg-[#1E1E1E] transition-colors">
            <Plus size={14} /> Tạo mới
          </button>
        </div>

        {/* Form */}
        {showForm && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl p-5 border-2 border-[#121212]/20 space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-bold text-[#0F172A]">{editingId ? "Sửa Prompt" : "Tạo Prompt mới"}</p>
              <button type="button" onClick={() => setShowForm(false)}><X size={16} className="text-[#94A3B8]" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[#64748B] mb-1 block">Tuần</label>
                <input type="number" value={form.weekNumber} onChange={e => setForm(f => ({ ...f, weekNumber: Number(e.target.value) }))}
                  className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm" min={1} />
              </div>
              <div>
                <label className="text-xs text-[#64748B] mb-1 block">CEFR Level</label>
                <select value={form.cefrLevel} onChange={e => setForm(f => ({ ...f, cefrLevel: e.target.value }))}
                  className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm">
                  {["A1", "A2", "B1", "B2", "C1"].map(l => <option key={l}>{l}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-[#64748B] mb-1 block">Chủ đề (tiếng Đức)</label>
              <input value={form.topicDe} onChange={e => setForm(f => ({ ...f, topicDe: e.target.value }))}
                className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm" placeholder="Arbeit und Beruf" />
            </div>
            <div>
              <label className="text-xs text-[#64748B] mb-1 block">Chủ đề (tiếng Việt)</label>
              <input value={form.topicVi} onChange={e => setForm(f => ({ ...f, topicVi: e.target.value }))}
                className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm" placeholder="Nghề nghiệp & Công việc" />
            </div>
            <div>
              <label className="text-xs text-[#64748B] mb-1 block">Mô tả (tuỳ chọn)</label>
              <textarea value={form.descriptionVi} onChange={e => setForm(f => ({ ...f, descriptionVi: e.target.value }))}
                className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm resize-none" rows={2} />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} id="isActive" />
              <label htmlFor="isActive" className="text-sm text-[#475569]">Kích hoạt</label>
            </div>
            <button type="button" onClick={handleSave} disabled={saving || !form.topicDe.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#121212] text-white text-sm font-bold disabled:opacity-50">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? "Đang lưu..." : "Lưu"}
            </button>
          </motion.div>
        )}

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-[#121212]" /></div>
        ) : (
          <div className="space-y-2">
            {(prompts ?? []).map(p => (
              <div key={p.id} className="bg-white rounded-2xl p-4 border border-[#E2E8F0] flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#EEF4FF] flex items-center justify-center flex-shrink-0 font-bold text-[#121212] text-sm">
                  W{p.weekNumber}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm text-[#0F172A]">{p.topicVi}</p>
                    <span className="text-[10px] bg-[#EEF4FF] text-[#121212] px-2 py-0.5 rounded-full font-bold">{p.cefrLevel}</span>
                    {!p.isActive && <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Tắt</span>}
                  </div>
                  <p className="text-xs text-[#64748B] mt-0.5 italic">{p.topicDe}</p>
                  {p.descriptionVi && <p className="text-xs text-[#94A3B8] mt-1">{p.descriptionVi}</p>}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button type="button" onClick={() => openEdit(p)} className="p-1.5 rounded-lg hover:bg-[#F1F5F9] transition-colors">
                    <Pencil size={13} className="text-[#64748B]" />
                  </button>
                  <button type="button" onClick={() => handleDelete(p.id)} disabled={deleting === p.id}
                    className="p-1.5 rounded-lg hover:bg-red-50 transition-colors">
                    {deleting === p.id ? <Loader2 size={13} className="animate-spin text-red-400" /> : <Trash2 size={13} className="text-red-400" />}
                  </button>
                </div>
              </div>
            ))}
            {(prompts ?? []).length === 0 && (
              <div className="text-center py-12 text-[#94A3B8]">
                <p className="text-sm">Chưa có prompt nào. Tạo mới để bắt đầu.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </AdminShell>
  );
}
