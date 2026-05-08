"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import api, { apiMessage } from "@/lib/api";
import { Search, Shield, ShieldAlert, KeyRound, AlertTriangle, Clock, Zap, Database, BookOpen } from "lucide-react";
import LearningDetailModal from "@/components/admin/LearningDetailModal";
import AdminShell from "@/components/admin/AdminShell";
import useAdminData from "@/hooks/useAdminData";
import { motion, AnimatePresence } from "framer-motion";

// ─── Palette (từ UI Demo) ──────────────────────────────────────────────────────
const P = {
  navy: "#121212",
  navyLt: "#EBF2FA",
  blue: "#2D9CDB",
  blueLt: "#EBF5FB",
  red: "#EB5757",
  redLt: "#FDEAEA",
  green: "#27AE60",
  greenLt: "#E8F8F0",
  yellow: "#FFCD00",
  yellowLt: "#FFF8E1",
  purple: "#9B51E0",
  purpleLt: "#F4EDFF",
  orange: "#F2994A",
  orangeLt: "#FEF3E8",
  bg: "#F5F5F5",
  white: "#FFFFFF",
  text: "#0F172A",
  muted: "#64748B",
  border: "#E2E8F0",
};

type AdminUser = {
  id: number;
  email: string;
  displayName: string;
  role: "ADMIN" | "TEACHER" | "STUDENT";
  isActive: boolean;
  planCode?: string;
  monthlyTokenLimit?: number;
  usedThisMonth?: number;
  remainingThisMonth?: number;
  dailyTokenGrant?: number;
  walletBalance?: number;
  walletCap?: number;
  usedToday?: number;
  quotaKind?: string;
  usageLast30Days?: number;
  quotaPeriodStartUtc?: string;
  quotaPeriodEndUtc?: string;
  subscriptionStartsAtUtc?: string | null;
  subscriptionEndsAtUtc?: string | null;
};

type QuotaDetail = {
  userId: number;
  planCode?: string;
  quotaKind?: string;
  unlimitedInternal?: boolean;
  dailyTokenGrant?: number;
  usedToday?: number;
  walletBalance?: number;
  walletCap?: number;
  monthlyTokenLimit?: number;
  usedThisMonth?: number;
  remainingThisMonth?: number;
  remainingSpendable?: number;
  usageLast30Days?: number;
  usageLedgerWindowDays?: number;
  usageLedgerSinceUtc?: string;
  periodStartUtc?: string;
  periodEndUtc?: string;
  subscriptionStartsAtUtc?: string | null;
  subscriptionEndsAtUtc?: string | null;
};

type PlanRow = {
  code: string;
  name: string;
  monthlyTokenLimit: number;
  isActive: boolean;
};

type UsageRow = {
  id: number;
  userId: number;
  provider?: string;
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  feature?: string;
  requestId?: string;
  sessionId?: number;
  createdAt?: string;
};

function fmt(n: number | undefined) {
  return Number(n ?? 0).toLocaleString("vi-VN");
}

function shortIso(iso: string | null | undefined) {
  if (iso == null || String(iso).trim() === "") return null;
  try {
    const d = new Date(String(iso));
    if (Number.isNaN(d.getTime())) return String(iso).slice(0, 19).replace("T", " ");
    return d.toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return String(iso);
  }
}

function quotaKindVi(k: string | undefined): string {
  switch (k) {
    case "WALLET":
      return "Ví (PRO/PREMIUM/ULTRA)";
    case "FREE_DAY":
      return "FREE / ngày VN";
    case "INTERNAL_UNLIMITED":
      return "Nội bộ không giới hạn";
    default:
      return "Không quota";
  }
}

// Generate initials from name (e.g., "Nguyen Van A" -> "NA")
function getInitials(name: string | undefined | null) {
  if (!name) return "U";
  const parts = name.trim().split(" ");
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function AdminUsersPage() {
  const [items, setItems] = useState<AdminUser[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [roleErrorId, setRoleErrorId] = useState<number | null>(null);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [detailUser, setDetailUser] = useState<AdminUser | null>(null);
  const [planCode, setPlanCode] = useState("FREE");
  const [overrideLimit, setOverrideLimit] = useState("");
  const [usage, setUsage] = useState<UsageRow[]>([]);
  const [usageLoading, setUsageLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [modalError, setModalError] = useState("");
  const [startsAtUtcInput, setStartsAtUtcInput] = useState("");
  const [endsAtUtcInput, setEndsAtUtcInput] = useState("");

  const [quotaDetail, setQuotaDetail] = useState<QuotaDetail | null>(null);
  const [quotaLoading, setQuotaLoading] = useState(false);
  const [learningUser, setLearningUser] = useState<AdminUser | null>(null);

  const { data, loading, refreshing, error, lastSyncedAt, reload } = useAdminData<AdminUser[]>({
    initialData: [],
    errorMessage: "Không thể tải danh sách người dùng.",
    fetchData: async () => {
      const res = await api.get("/admin/users");
      return (res.data ?? []) as AdminUser[];
    },
  });

  useEffect(() => {
    setItems(data);
  }, [data]);

  useEffect(() => {
    let cancelled = false;
    api
      .get("/admin/plans")
      .then((res) => {
        if (!cancelled) setPlans((res.data ?? []) as PlanRow[]);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const updateRole = async (id: number, role: string) => {
    setRoleErrorId(null);
    try {
      await api.patch(`/admin/users/${id}/role`, { role });
      await reload({ silent: true });
    } catch (e: unknown) {
      setRoleErrorId(id);
      console.error(apiMessage(e));
    }
  };

  const openDetail = async (u: AdminUser) => {
    setDetailUser(u);
    setPlanCode((u.planCode || "FREE").toUpperCase());
    setOverrideLimit("");
    setStartsAtUtcInput(
      u.subscriptionStartsAtUtc != null && String(u.subscriptionStartsAtUtc).trim() !== ""
        ? String(u.subscriptionStartsAtUtc)
        : new Date().toISOString()
    );
    setEndsAtUtcInput(u.subscriptionEndsAtUtc != null ? String(u.subscriptionEndsAtUtc) : "");
    setModalError("");
    setUsage([]);
    setQuotaDetail(null);
    setQuotaLoading(true);
    setUsageLoading(true);
    try {
      const [usageRes, quotaRes] = await Promise.allSettled([
        api.get(`/admin/users/${u.id}/usage`, { params: { limit: 200 } }),
        api.get<QuotaDetail>(`/admin/users/${u.id}/quota`),
      ]);
      if (usageRes.status === "fulfilled") {
        setUsage((usageRes.value.data ?? []) as UsageRow[]);
      } else {
        setUsage([]);
      }
      if (quotaRes.status === "fulfilled") {
        setQuotaDetail(quotaRes.value.data ?? null);
      } else {
        setQuotaDetail(null);
      }
      if (usageRes.status === "rejected") {
        setModalError(apiMessage(usageRes.reason));
      } else if (quotaRes.status === "rejected") {
        setModalError(apiMessage(quotaRes.reason));
      }
    } catch (e: unknown) {
      setModalError(apiMessage(e));
    } finally {
      setUsageLoading(false);
      setQuotaLoading(false);
    }
  };

  const savePlan = async () => {
    if (!detailUser) return;
    setSaveLoading(true);
    setModalError("");
    try {
      await api.patch(`/admin/users/${detailUser.id}/plan`, {
        planCode,
        monthlyTokenLimitOverride: overrideLimit.trim() ? Number(overrideLimit.trim()) : null,
        startsAtUtc: startsAtUtcInput.trim() || new Date().toISOString(),
        endsAtUtc: endsAtUtcInput.trim() ? endsAtUtcInput.trim() : null,
      });
      await reload({ silent: true });
      setDetailUser(null);
    } catch (e: unknown) {
      setModalError(apiMessage(e));
    } finally {
      setSaveLoading(false);
    }
  };

  const filteredItems = items.filter((u) => {
    const q = query.trim().toLowerCase();
    const matchesQ =
      !q ||
      u.displayName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      String(u.id).includes(q) ||
      u.role.toLowerCase().includes(q) ||
      (u.planCode || "").toLowerCase().includes(q);
    const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? u.isActive : !u.isActive);
    return matchesQ && matchesStatus;
  });

  const listHint = (() => {
    if (error && items.length === 0 && !loading) {
      return "Kiểm tra Spring Boot (thường :8080), biến NEXT_PUBLIC_BACKEND_URL / BACKEND_URL trên Next, và JWT tài khoản ADMIN.";
    }
    return null;
  })();

  if (loading) return <div className="page-shell text-muted-foreground p-8">Đang tải người dùng…</div>;

  return (
    <AdminShell
      title="Quản lý người dùng"
      subtitle="Phân quyền · gói đăng ký · quota AI (snapshot ví/ngày VN + ledger 30 ngày)"
      activeNav="students"
      error={error}
      refreshing={refreshing}
      onRefresh={() => reload({ silent: true })}
      lastSyncedAt={lastSyncedAt}
    >
      {listHint && error && (
        <div className="mb-4 rounded-[12px] p-3 text-sm flex items-start gap-2" style={{ background: P.redLt, color: P.red, border: `1.5px solid ${P.red}40` }}>
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
          <p>{listHint}</p>
        </div>
      )}

      {/* ── Toolbar ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row gap-3 mb-5">
        <div className="flex-1 flex items-center gap-2 px-3 py-2.5 bg-white rounded-[12px] transition-shadow focus-within:shadow-[0_2px_8px_rgba(0,48,94,0.06)]" style={{ border: `1.5px solid ${P.border}` }}>
          <Search size={15} style={{ color: P.muted }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm theo tên, email, role, plan…"
            className="flex-1 bg-transparent outline-none text-sm font-medium"
            style={{ color: P.text }}
          />
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex p-1 rounded-[12px] bg-white" style={{ border: `1.5px solid ${P.border}` }}>
            {(["all", "active", "inactive"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setStatusFilter(k)}
                className="px-3 py-1.5 rounded-[8px] text-xs font-bold transition-colors"
                style={{
                  background: statusFilter === k ? P.navy : "transparent",
                  color: statusFilter === k ? P.white : P.muted,
                }}
              >
                {k === "all" ? "Tất cả" : k === "active" ? "Aktiv" : "Inaktiv"}
              </button>
            ))}
          </div>
          <Link
            href="/admin/plans"
            className="px-4 py-2 rounded-[12px] text-xs font-bold transition-colors"
            style={{ background: P.navyLt, color: P.navy }}
          >
            Gói & Hạn mức
          </Link>
        </div>
      </div>

      {/* ── User List (Cards) ────────────────────────────────────────────────── */}
      {filteredItems.length === 0 ? (
        <div className="py-12 text-center text-sm font-medium rounded-[20px] bg-white" style={{ color: P.muted, border: `1.5px dashed ${P.border}` }}>
          {error && items.length === 0 ? (
            "Chưa có dữ liệu do lỗi tải. Bấm làm mới phía trên."
          ) : items.length === 0 ? (
            "Hệ thống chưa có người dùng nào."
          ) : (
            "Không có người dùng phù hợp với bộ lọc."
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <AnimatePresence>
            {filteredItems.map((u) => (
              <motion.div
                key={u.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-[20px] p-4 flex flex-col transition-shadow hover:shadow-[0_4px_24px_rgba(0,48,94,0.06)]"
                style={{ border: `1.5px solid ${P.border}` }}
              >
                {/* Header: Avatar, Info, Status */}
                <div className="flex items-start gap-3 mb-4">
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-black text-white flex-shrink-0"
                    style={{ background: `linear-gradient(135deg, ${P.navy}, ${P.blue})` }}
                  >
                    {getInitials(u.displayName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-sm truncate" style={{ color: P.text }}>{u.displayName}</p>
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black tracking-wider flex-shrink-0"
                        style={{
                          background: u.role === "ADMIN" ? P.redLt : u.role === "TEACHER" ? P.purpleLt : P.navyLt,
                          color: u.role === "ADMIN" ? P.red : u.role === "TEACHER" ? P.purple : P.navy,
                        }}>
                        {u.role}
                      </span>
                    </div>
                    <p className="text-[11px] truncate mt-0.5" style={{ color: P.muted }}>
                      #{u.id} · {u.email}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="flex items-center gap-1 text-[10px] font-bold" style={{ color: u.isActive ? P.green : P.red }}>
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: u.isActive ? P.green : P.red }} />
                        {u.isActive ? "Aktiv" : "Inaktiv"}
                      </span>
                      {u.planCode && (
                        <span className="flex items-center gap-1 text-[10px] font-semibold" style={{ color: P.orange }}>
                          <span className="text-orange-300">•</span> {u.planCode}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-3 gap-2 mb-4 mt-auto">
                  {[
                    { label: "Ledger 30d", val: fmt(u.usageLast30Days), color: P.purple, bg: P.purpleLt },
                    { label: "Hôm nay", val: fmt(u.usedToday ?? u.usedThisMonth), color: P.blue, bg: P.blueLt },
                    { label: "Còn lại", val: fmt(u.remainingThisMonth), color: P.green, bg: P.greenLt },
                  ].map(({ label, val, color, bg }) => (
                    <div key={label} className="rounded-[12px] p-2 text-center flex flex-col justify-center" style={{ background: bg, border: `1.5px solid ${color}30` }}>
                      <p className="font-black text-xs leading-none mb-1" style={{ color }}>{val}</p>
                      <p className="text-[9px] font-bold uppercase tracking-wide leading-none opacity-70" style={{ color }}>{label}</p>
                    </div>
                  ))}
                </div>

                {/* Sub info */}
                {u.quotaKind && (
                  <p className="text-[10px] font-medium mb-3 text-center" style={{ color: P.muted }}>
                    Quota: {quotaKindVi(u.quotaKind)}
                    {Number(u.walletCap ?? 0) > 0 ? ` (Trần ${fmt(u.walletCap)})` : ""}
                  </p>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 mt-auto pt-3" style={{ borderTop: `1px solid ${P.border}` }}>
                  <select
                    className="flex-1 outline-none text-xs font-bold py-2 px-2 rounded-[10px] appearance-none cursor-pointer text-center"
                    style={{
                      background: P.bg,
                      color: P.navy,
                      border: roleErrorId === u.id ? `1.5px solid ${P.red}` : `1px solid ${P.border}`,
                    }}
                    value={u.role}
                    onChange={(e) => updateRole(u.id, e.target.value)}
                  >
                    <option value="STUDENT">STUDENT</option>
                    <option value="TEACHER">TEACHER</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                  <button
                    onClick={() => setLearningUser(u)}
                    className="flex-1 py-2 px-3 rounded-[10px] text-xs font-bold text-center transition-all hover:opacity-90 flex justify-center items-center gap-1.5"
                    style={{ background: P.purpleLt, color: P.purple, border: `1px solid ${P.purple}30` }}
                  >
                    <BookOpen size={12} /> Hồ sơ
                  </button>
                  <button
                    onClick={() => openDetail(u)}
                    className="flex-1 py-2 px-3 rounded-[10px] text-xs font-bold text-center transition-all hover:opacity-90 flex justify-center items-center gap-1.5"
                    style={{ background: P.navy, color: P.white, boxShadow: "0 2px 8px rgba(0,48,94,0.15)" }}
                  >
                    <Database size={12} /> Quota
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* ── Modal: Detail & Quota ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {detailUser && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setDetailUser(null)}
            />
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative z-10 w-full max-w-3xl max-h-[90vh] flex flex-col rounded-[24px] bg-white overflow-hidden shadow-2xl"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: P.border }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-black text-white"
                    style={{ background: `linear-gradient(135deg, ${P.navy}, ${P.blue})` }}>
                    {getInitials(detailUser.displayName)}
                  </div>
                  <div>
                    <h3 className="font-bold text-base" style={{ color: P.text }}>{detailUser.displayName}</h3>
                    <p className="text-xs" style={{ color: P.muted }}>#{detailUser.id} · {detailUser.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => setDetailUser(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-400"
                >
                  <AlertTriangle size={18} className="hidden" /> {/* just for import use */}
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M13 1L1 13M1 1L13 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5" style={{ background: P.bg }}>
                {modalError && (
                  <div className="rounded-[12px] p-3 text-sm font-medium flex items-center gap-2" style={{ background: P.redLt, color: P.red, border: `1.5px solid ${P.red}40` }}>
                    <ShieldAlert size={16} /> {modalError}
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {/* Quota Details */}
                  <div className="rounded-[16px] bg-white p-5 shadow-sm" style={{ border: `1.5px solid ${P.border}` }}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Zap size={16} style={{ color: P.blue }} />
                        <h4 className="font-bold text-sm" style={{ color: P.text }}>Chi tiết Quota</h4>
                      </div>
                      {quotaLoading && <span className="text-[10px] font-bold text-blue-500 animate-pulse">Đang tải...</span>}
                    </div>

                    {quotaDetail ? (
                      <div className="space-y-4">
                        <div className="p-3 rounded-[12px]" style={{ background: P.blueLt, border: `1px solid ${P.blue}30` }}>
                          <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: P.blue }}>Cơ chế</p>
                          <p className="font-bold text-sm" style={{ color: P.text }}>
                            {quotaKindVi(quotaDetail.quotaKind)}
                            {quotaDetail.unlimitedInternal && <span className="ml-2 px-1.5 py-0.5 rounded-[6px] text-[10px] bg-green-100 text-green-700 border border-green-200">Không giới hạn</span>}
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-[10px] font-bold uppercase" style={{ color: P.muted }}>Ledger 30 ngày</p>
                            <p className="font-black" style={{ color: P.text }}>{fmt(quotaDetail.usageLast30Days)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase" style={{ color: P.muted }}>Hôm nay (VN)</p>
                            <p className="font-black" style={{ color: P.text }}>{fmt(quotaDetail.usedToday ?? quotaDetail.usedThisMonth)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase" style={{ color: P.muted }}>Còn chi tiêu được</p>
                            <p className="font-black" style={{ color: P.green }}>{quotaDetail.unlimitedInternal ? "—" : fmt(quotaDetail.remainingSpendable ?? quotaDetail.remainingThisMonth)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase" style={{ color: P.muted }}>Trần ví (Cap)</p>
                            <p className="font-black" style={{ color: P.text }}>{fmt(quotaDetail.walletCap)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase" style={{ color: P.muted }}>Cộng mỗi ngày</p>
                            <p className="font-black" style={{ color: P.text }}>{fmt(quotaDetail.dailyTokenGrant)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase" style={{ color: P.muted }}>Số dư ví hiện tại</p>
                            <p className="font-black" style={{ color: P.text }}>{fmt(quotaDetail.walletBalance)}</p>
                          </div>
                        </div>
                        <div className="pt-3 border-t mt-2" style={{ borderColor: P.border }}>
                          <p className="text-[10px] font-medium" style={{ color: P.muted }}>
                            Khung: <span className="font-mono">{quotaDetail.periodStartUtc ?? "—"} → {quotaDetail.periodEndUtc ?? "—"}</span>
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs italic" style={{ color: P.muted }}>{!quotaLoading ? "Chưa có snapshot quota." : ""}</p>
                    )}
                  </div>

                  {/* Plan Update */}
                  <div className="rounded-[16px] bg-white p-5 shadow-sm" style={{ border: `1.5px solid ${P.border}` }}>
                    <div className="flex items-center gap-2 mb-4">
                      <KeyRound size={16} style={{ color: P.orange }} />
                      <h4 className="font-bold text-sm" style={{ color: P.text }}>Đổi gói Đăng ký</h4>
                    </div>

                    <div className="p-3 mb-4 rounded-[12px] text-xs" style={{ background: P.orangeLt, border: `1px solid ${P.orange}30` }}>
                      <p style={{ color: P.text }} className="font-medium">
                        Gói hiện tại: <span className="font-bold">{detailUser.planCode ?? "—"}</span>
                      </p>
                      <p style={{ color: P.text, marginTop: 4 }}>
                        Từ: {shortIso(detailUser.subscriptionStartsAtUtc) ?? "—"}
                        <br />Đến: {shortIso(detailUser.subscriptionEndsAtUtc) ?? "Vô thời hạn"}
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="text-[10px] font-bold uppercase block mb-1" style={{ color: P.muted }}>Ngày bắt đầu (UTC)</label>
                        <input
                          className="w-full px-3 py-2 rounded-[10px] text-sm font-mono outline-none focus:ring-2 focus:ring-blue-100 transition-shadow"
                          style={{ border: `1px solid ${P.border}`, background: P.bg }}
                          value={startsAtUtcInput} onChange={(e) => setStartsAtUtcInput(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase block mb-1" style={{ color: P.muted }}>Ngày kết thúc (Bỏ trống = Vô thời hạn)</label>
                        <input
                          className="w-full px-3 py-2 rounded-[10px] text-sm font-mono outline-none focus:ring-2 focus:ring-blue-100 transition-shadow"
                          style={{ border: `1px solid ${P.border}`, background: P.bg }}
                          value={endsAtUtcInput} onChange={(e) => setEndsAtUtcInput(e.target.value)}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-bold uppercase block mb-1" style={{ color: P.muted }}>Plan Code</label>
                          <select
                            className="w-full px-3 py-2 rounded-[10px] text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-shadow appearance-none"
                            style={{ border: `1px solid ${P.border}`, background: P.bg, color: P.navy }}
                            value={planCode} onChange={(e) => setPlanCode(e.target.value)}
                          >
                            {plans.map((p) => (
                              <option key={p.code} value={p.code}>{p.code}</option>
                            ))}
                            {plans.length === 0 && <option value="FREE">FREE</option>}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold uppercase block mb-1" style={{ color: P.muted }}>Override Limit</label>
                          <input
                            className="w-full px-3 py-2 rounded-[10px] text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-shadow"
                            style={{ border: `1px solid ${P.border}`, background: P.bg }}
                            placeholder="Tuỳ chọn"
                            value={overrideLimit} onChange={(e) => setOverrideLimit(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>

                    <button
                      disabled={saveLoading}
                      onClick={savePlan}
                      className="w-full mt-4 py-2.5 rounded-[10px] text-sm font-bold transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                      style={{ background: P.yellow, color: P.navy, boxShadow: "0 2px 8px rgba(255, 206, 0, 0.2)" }}
                    >
                      {saveLoading ? "Đang lưu..." : "Lưu Thay Đổi"}
                    </button>
                  </div>
                </div>

                {/* Usage Log Table */}
                <div className="rounded-[16px] bg-white p-5 shadow-sm" style={{ border: `1.5px solid ${P.border}` }}>
                  <div className="flex items-center gap-2 mb-4">
                    <Clock size={16} style={{ color: P.purple }} />
                    <h4 className="font-bold text-sm" style={{ color: P.text }}>Nhật ký Usage (200 gần nhất)</h4>
                  </div>
                  
                  {usageLoading ? (
                    <div className="py-8 text-center text-sm font-medium animate-pulse" style={{ color: P.muted }}>Đang tải lịch sử...</div>
                  ) : (
                    <div className="overflow-x-auto rounded-[12px] border" style={{ borderColor: P.border }}>
                      <table className="w-full text-xs text-left">
                        <thead style={{ background: P.navyLt }}>
                          <tr>
                            <th className="px-4 py-3 font-bold text-[10px] uppercase tracking-wider" style={{ color: P.navy }}>Thời điểm</th>
                            <th className="px-4 py-3 font-bold text-[10px] uppercase tracking-wider" style={{ color: P.navy }}>Tính năng</th>
                            <th className="px-4 py-3 font-bold text-[10px] uppercase tracking-wider" style={{ color: P.navy }}>Provider/Model</th>
                            <th className="px-4 py-3 font-bold text-[10px] uppercase tracking-wider" style={{ color: P.navy }}>Tokens</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y" style={{ borderColor: P.border }}>
                          {usage.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="px-4 py-6 text-center italic" style={{ color: P.muted }}>Không có lịch sử usage.</td>
                            </tr>
                          ) : (
                            usage.map((r, i) => (
                              <tr key={r.id} style={{ background: i % 2 === 0 ? P.white : "#FAFCFF" }} className="hover:bg-slate-50 transition-colors">
                                <td className="px-4 py-3 whitespace-nowrap" style={{ color: P.muted }}>{r.createdAt ? String(r.createdAt) : "—"}</td>
                                <td className="px-4 py-3 font-semibold" style={{ color: P.text }}>{r.feature ?? "—"}</td>
                                <td className="px-4 py-3 text-[11px]" style={{ color: P.muted }}>{[r.provider, r.model].filter(Boolean).join(" / ") || "—"}</td>
                                <td className="px-4 py-3 font-black" style={{ color: P.blue }}>{fmt(r.totalTokens)}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Modal: Learning Detail ──────────────────────────────────────────── */}
      {learningUser && (
        <LearningDetailModal
          userId={learningUser.id}
          userName={learningUser.displayName}
          onClose={() => setLearningUser(null)}
        />
      )}
    </AdminShell>
  );
}
