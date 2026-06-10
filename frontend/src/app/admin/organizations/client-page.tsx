"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Building2,
  Plus,
  Search,
  ChevronDown,
  Users as UsersIcon,
  Armchair,
  Zap,
  Receipt,
  ShieldAlert,
  CheckCircle2,
  X,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import AdminShell from "@/components/admin/AdminShell"
import useAdminData from "@/hooks/useAdminData"
import { apiMessage } from "@/lib/api"
import {
  listOrganizations,
  createOrganization,
  updateOrganization,
  addMember,
  activateEntitlements,
  createInvoice,
  listOrgInvoices,
  listOrgMembers,
  updateInvoiceStatus,
  type AdminOrg,
  type AdminOrgMember,
  type OrgInvoice,
  type OrgStatus,
  type InvoiceStatus,
} from "@/lib/adminOrgApi"
import type { OrgRole } from "@/lib/orgApi"

// ─── Palette (đồng bộ với /admin/users) ──────────────────────────────────────
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
}

const ORG_STATUSES: OrgStatus[] = ["ACTIVE", "SUSPENDED", "PENDING"]
const INVOICE_STATUSES: InvoiceStatus[] = ["DRAFT", "SENT", "PAID", "VOID"]

function fmt(n: number | null | undefined) {
  return Number(n ?? 0).toLocaleString("vi-VN")
}

function shortIso(iso: string | null | undefined) {
  if (iso == null || String(iso).trim() === "") return null
  try {
    const d = new Date(String(iso))
    if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10)
    return d.toLocaleDateString("vi-VN", { dateStyle: "medium" })
  } catch {
    return String(iso)
  }
}

function statusTone(status: string): { bg: string; fg: string } {
  switch (status?.toUpperCase()) {
    case "ACTIVE":
      return { bg: P.greenLt, fg: P.green }
    case "SUSPENDED":
      return { bg: P.redLt, fg: P.red }
    case "PENDING":
      return { bg: P.yellowLt, fg: P.orange }
    case "PAID":
      return { bg: P.greenLt, fg: P.green }
    case "SENT":
      return { bg: P.blueLt, fg: P.blue }
    case "VOID":
      return { bg: P.redLt, fg: P.red }
    case "DRAFT":
    default:
      return { bg: P.navyLt, fg: P.navy }
  }
}

const STATUS_VI: Record<string, string> = {
  ACTIVE: "Đang hoạt động",
  SUSPENDED: "Tạm ngưng",
  PENDING: "Chờ kích hoạt",
  DRAFT: "Nháp",
  SENT: "Đã gửi",
  PAID: "Đã thanh toán",
  VOID: "Huỷ",
}

export default function AdminOrganizationsClientPage() {
  const [query, setQuery] = useState("")
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const { data, loading, refreshing, error, lastSyncedAt, reload } = useAdminData<AdminOrg[]>({
    initialData: [],
    errorMessage: "Không thể tải danh sách tổ chức.",
    fetchData: async () => {
      const res = await listOrganizations(0, 200)
      return res.content ?? []
    },
  })

  const filtered = data.filter((o) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return (
      o.name.toLowerCase().includes(q) ||
      (o.slug || "").toLowerCase().includes(q) ||
      (o.planCode || "").toLowerCase().includes(q) ||
      String(o.id).includes(q)
    )
  })

  if (loading) {
    return <div className="page-shell p-8 text-sm" style={{ color: P.muted }}>Đang tải tổ chức…</div>
  }

  return (
    <AdminShell
      title="Quản lý Tổ chức (B2B)"
      subtitle="Tenant · gói & ghế · kích hoạt quyền lợi · hoá đơn"
      activeNav="organizations"
      error={error}
      refreshing={refreshing}
      onRefresh={() => reload({ silent: true })}
      lastSyncedAt={lastSyncedAt}
    >
      {/* ── Toolbar ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row gap-3 mb-5">
        <div
          className="flex-1 flex items-center gap-2 px-3 py-2.5 bg-white rounded-[12px] transition-shadow focus-within:shadow-[0_2px_8px_rgba(0,48,94,0.06)]"
          style={{ border: `1.5px solid ${P.border}` }}
        >
          <Search size={15} style={{ color: P.muted }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm theo tên, slug, gói…"
            className="flex-1 bg-transparent outline-none text-sm font-medium"
            style={{ color: P.text }}
          />
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-[12px] text-sm font-bold transition-all hover:opacity-90"
          style={{ background: P.navy, color: P.white, boxShadow: "0 2px 8px rgba(0,48,94,0.15)" }}
        >
          <Plus size={16} /> Tạo tổ chức
        </button>
      </div>

      {/* ── Org list ─────────────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div
          className="py-12 text-center text-sm font-medium rounded-[20px] bg-white"
          style={{ color: P.muted, border: `1.5px dashed ${P.border}` }}
        >
          {data.length === 0 ? "Chưa có tổ chức nào." : "Không có tổ chức phù hợp với tìm kiếm."}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((org) => (
            <OrgRow
              key={org.id}
              org={org}
              expanded={expandedId === org.id}
              onToggle={() => setExpandedId((cur) => (cur === org.id ? null : org.id))}
              onChanged={() => reload({ silent: true })}
            />
          ))}
        </div>
      )}

      {/* ── Create modal ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showCreate && (
          <CreateOrgModal
            onClose={() => setShowCreate(false)}
            onCreated={() => {
              setShowCreate(false)
              reload({ silent: true })
            }}
          />
        )}
      </AnimatePresence>
    </AdminShell>
  )
}

// ─── Org row (collapsible detail) ─────────────────────────────────────────────
function OrgRow({
  org,
  expanded,
  onToggle,
  onChanged,
}: {
  org: AdminOrg
  expanded: boolean
  onToggle: () => void
  onChanged: () => void
}) {
  const tone = statusTone(org.status)

  return (
    <div className="bg-white rounded-[18px] overflow-hidden" style={{ border: `1.5px solid ${P.border}` }}>
      {/* Header (clickable) */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50/60 transition-colors"
      >
        <div
          className="w-10 h-10 rounded-[12px] flex items-center justify-center flex-shrink-0"
          style={{ background: P.navyLt, color: P.navy }}
        >
          <Building2 size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-bold text-sm truncate" style={{ color: P.text }}>{org.name}</p>
            <span
              className="px-2 py-0.5 rounded-full text-[10px] font-black tracking-wide flex-shrink-0"
              style={{ background: tone.bg, color: tone.fg }}
            >
              {STATUS_VI[org.status?.toUpperCase()] ?? org.status}
            </span>
          </div>
          <p className="text-[11px] truncate mt-0.5" style={{ color: P.muted }}>
            #{org.id}
            {org.slug ? ` · ${org.slug}` : ""}
            {org.planCode ? ` · ${org.planCode}` : " · chưa có gói"}
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-4 flex-shrink-0">
          <Metric icon={<Armchair size={13} />} label="Ghế" value={`${fmt(org.seatUsed)}/${fmt(org.seatLimit)}`} color={P.blue} />
          <Metric icon={<UsersIcon size={13} />} label="HV" value={fmt(org.studentCount)} color={P.purple} />
        </div>
        <ChevronDown
          size={18}
          style={{ color: P.muted, transform: expanded ? "rotate(180deg)" : "none", transition: "transform .2s" }}
        />
      </button>

      {/* Detail */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
            style={{ borderTop: `1px solid ${P.border}`, background: P.bg }}
          >
            <OrgDetail org={org} onChanged={onChanged} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Metric({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span style={{ color }}>{icon}</span>
      <span className="text-[11px] font-bold" style={{ color: P.text }}>{value}</span>
      <span className="text-[10px] font-semibold" style={{ color: P.muted }}>{label}</span>
    </div>
  )
}

// ─── Org detail body (config + members + invoices) ────────────────────────────
function OrgDetail({ org, onChanged }: { org: AdminOrg; onChanged: () => void }) {
  const [members, setMembers] = useState<AdminOrgMember[]>([])
  const [invoices, setInvoices] = useState<OrgInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  // Config form
  const [planCode, setPlanCode] = useState(org.planCode ?? "")
  const [seatLimit, setSeatLimit] = useState(String(org.seatLimit ?? 0))
  const [monthlyTokenPool, setMonthlyTokenPool] = useState(
    org.monthlyTokenPool != null ? String(org.monthlyTokenPool) : "",
  )
  const [status, setStatus] = useState<OrgStatus>((org.status?.toUpperCase() as OrgStatus) || "PENDING")
  const [validUntil, setValidUntil] = useState(org.validUntil ? String(org.validUntil) : "")

  // Add member form
  const [memberEmail, setMemberEmail] = useState("")
  const [memberRole, setMemberRole] = useState<OrgRole>("TEACHER")

  // Create invoice form
  const [invPeriodStart, setInvPeriodStart] = useState("")
  const [invPeriodEnd, setInvPeriodEnd] = useState("")
  const [invSeats, setInvSeats] = useState(String(org.seatLimit ?? 0))
  const [invAmount, setInvAmount] = useState("")
  const [invNote, setInvNote] = useState("")

  const loadDetail = useCallback(async () => {
    setLoading(true)
    try {
      const [m, inv] = await Promise.all([listOrgMembers(org.id), listOrgInvoices(org.id)])
      setMembers(m)
      setInvoices(inv)
    } catch (e: unknown) {
      setMsg({ kind: "err", text: apiMessage(e) })
    } finally {
      setLoading(false)
    }
  }, [org.id])

  useEffect(() => {
    void loadDetail()
  }, [loadDetail])

  const flash = (kind: "ok" | "err", text: string) => {
    setMsg({ kind, text })
    if (kind === "ok") setTimeout(() => setMsg(null), 3500)
  }

  const saveConfig = async () => {
    setBusy(true)
    setMsg(null)
    try {
      await updateOrganization(org.id, {
        planCode: planCode.trim() || undefined,
        seatLimit: seatLimit.trim() ? Number(seatLimit.trim()) : undefined,
        monthlyTokenPool: monthlyTokenPool.trim() ? Number(monthlyTokenPool.trim()) : undefined,
        status,
        validUntil: validUntil.trim() ? validUntil.trim() : null,
      })
      flash("ok", "Đã cập nhật tổ chức.")
      onChanged()
    } catch (e: unknown) {
      flash("err", apiMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const doActivate = async () => {
    setBusy(true)
    setMsg(null)
    try {
      const granted = await activateEntitlements(org.id)
      flash("ok", `Đã kích hoạt quyền lợi cho ${granted} học viên.`)
      onChanged()
    } catch (e: unknown) {
      flash("err", apiMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const doAddMember = async () => {
    if (!memberEmail.trim()) return
    setBusy(true)
    setMsg(null)
    try {
      await addMember(org.id, { email: memberEmail.trim(), role: memberRole })
      setMemberEmail("")
      flash("ok", "Đã thêm thành viên.")
      await loadDetail()
      onChanged()
    } catch (e: unknown) {
      flash("err", apiMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const doCreateInvoice = async () => {
    setBusy(true)
    setMsg(null)
    try {
      await createInvoice(org.id, {
        periodStart: invPeriodStart.trim() || undefined,
        periodEnd: invPeriodEnd.trim() || undefined,
        seats: invSeats.trim() ? Number(invSeats.trim()) : 0,
        amountVnd: invAmount.trim() ? Number(invAmount.trim()) : 0,
        note: invNote.trim() || undefined,
      })
      setInvAmount("")
      setInvNote("")
      flash("ok", "Đã tạo hoá đơn nháp.")
      await loadDetail()
    } catch (e: unknown) {
      flash("err", apiMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const changeInvoiceStatus = async (invoiceId: number, next: InvoiceStatus) => {
    setBusy(true)
    setMsg(null)
    try {
      await updateInvoiceStatus(org.id, invoiceId, next)
      await loadDetail()
    } catch (e: unknown) {
      flash("err", apiMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="p-4 space-y-4">
      {msg && (
        <div
          className="rounded-[12px] p-3 text-sm font-medium flex items-center gap-2"
          style={
            msg.kind === "ok"
              ? { background: P.greenLt, color: P.green, border: `1.5px solid ${P.green}40` }
              : { background: P.redLt, color: P.red, border: `1.5px solid ${P.red}40` }
          }
        >
          {msg.kind === "ok" ? <CheckCircle2 size={16} /> : <ShieldAlert size={16} />} {msg.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── Config ───────────────────────────────────────────────────────── */}
        <section className="rounded-[14px] bg-white p-4" style={{ border: `1.5px solid ${P.border}` }}>
          <div className="flex items-center gap-2 mb-3">
            <Zap size={15} style={{ color: P.orange }} />
            <h4 className="font-bold text-sm" style={{ color: P.text }}>Gói & vòng đời</h4>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Plan Code">
              <Input value={planCode} onChange={setPlanCode} placeholder="VD: PRO" />
            </Field>
            <Field label="Số ghế (Seat limit)">
              <Input value={seatLimit} onChange={setSeatLimit} type="number" />
            </Field>
            <Field label="Token pool / tháng">
              <Input value={monthlyTokenPool} onChange={setMonthlyTokenPool} type="number" placeholder="Tuỳ chọn" />
            </Field>
            <Field label="Trạng thái">
              <Select value={status} onChange={(v) => setStatus(v as OrgStatus)} options={ORG_STATUSES.map((s) => ({ value: s, label: STATUS_VI[s] ?? s }))} />
            </Field>
            <div className="col-span-2">
              <Field label="Hiệu lực đến (ISO, bỏ trống = vô thời hạn)">
                <Input value={validUntil} onChange={setValidUntil} placeholder="2026-12-31T00:00:00Z" mono />
              </Field>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              disabled={busy}
              onClick={saveConfig}
              className="flex-1 py-2.5 rounded-[10px] text-sm font-bold transition-all disabled:opacity-60"
              style={{ background: P.yellow, color: P.navy }}
            >
              {busy ? "Đang lưu…" : "Lưu thay đổi"}
            </button>
            <button
              disabled={busy}
              onClick={doActivate}
              className="flex-1 py-2.5 rounded-[10px] text-sm font-bold transition-all disabled:opacity-60"
              style={{ background: P.green, color: P.white }}
            >
              Kích hoạt quyền lợi
            </button>
          </div>
          <p className="text-[10px] mt-2" style={{ color: P.muted }}>
            Chuyển sang <b>Tạm ngưng</b> sẽ thu hồi quyền lợi của học viên; chuyển về <b>Hoạt động</b> sẽ cấp lại.
          </p>
        </section>

        {/* ── Members ──────────────────────────────────────────────────────── */}
        <section className="rounded-[14px] bg-white p-4" style={{ border: `1.5px solid ${P.border}` }}>
          <div className="flex items-center gap-2 mb-3">
            <UsersIcon size={15} style={{ color: P.purple }} />
            <h4 className="font-bold text-sm" style={{ color: P.text }}>Thành viên ({members.length})</h4>
          </div>
          <div className="flex items-end gap-2 mb-3">
            <div className="flex-1">
              <Field label="Email">
                <Input value={memberEmail} onChange={setMemberEmail} placeholder="user@example.com" />
              </Field>
            </div>
            <div className="w-32">
              <Field label="Vai trò">
                <Select
                  value={memberRole}
                  onChange={(v) => setMemberRole(v as OrgRole)}
                  options={(["OWNER", "ADMIN", "TEACHER", "STUDENT"] as OrgRole[]).map((r) => ({ value: r, label: r }))}
                />
              </Field>
            </div>
            <button
              disabled={busy || !memberEmail.trim()}
              onClick={doAddMember}
              className="h-[38px] px-3 rounded-[10px] text-xs font-bold transition-all disabled:opacity-50"
              style={{ background: P.navy, color: P.white }}
            >
              Thêm
            </button>
          </div>
          <div className="rounded-[10px] overflow-hidden max-h-52 overflow-y-auto" style={{ border: `1px solid ${P.border}` }}>
            {loading ? (
              <p className="py-6 text-center text-xs animate-pulse" style={{ color: P.muted }}>Đang tải…</p>
            ) : members.length === 0 ? (
              <p className="py-6 text-center text-xs italic" style={{ color: P.muted }}>Chưa có thành viên.</p>
            ) : (
              members.map((m, i) => (
                <div
                  key={m.userId}
                  className="flex items-center gap-2 px-3 py-2"
                  style={{ background: i % 2 === 0 ? P.white : "#FAFCFF" }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color: P.text }}>
                      {m.displayName || m.email}
                    </p>
                    <p className="text-[10px] truncate" style={{ color: P.muted }}>{m.email}</p>
                  </div>
                  <span
                    className="px-1.5 py-0.5 rounded-full text-[9px] font-black"
                    style={{ background: P.navyLt, color: P.navy }}
                  >
                    {m.role}
                  </span>
                  <span className="text-[9px] font-bold" style={{ color: m.status === "ACTIVE" ? P.green : P.red }}>
                    {m.status === "ACTIVE" ? "Aktiv" : "Removed"}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* ── Invoices ───────────────────────────────────────────────────────── */}
      <section className="rounded-[14px] bg-white p-4" style={{ border: `1.5px solid ${P.border}` }}>
        <div className="flex items-center gap-2 mb-3">
          <Receipt size={15} style={{ color: P.blue }} />
          <h4 className="font-bold text-sm" style={{ color: P.text }}>Hoá đơn ({invoices.length})</h4>
        </div>

        {/* Create invoice */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 items-end mb-4">
          <Field label="Từ ngày">
            <Input value={invPeriodStart} onChange={setInvPeriodStart} type="date" />
          </Field>
          <Field label="Đến ngày">
            <Input value={invPeriodEnd} onChange={setInvPeriodEnd} type="date" />
          </Field>
          <Field label="Số ghế">
            <Input value={invSeats} onChange={setInvSeats} type="number" />
          </Field>
          <Field label="Số tiền (VND)">
            <Input value={invAmount} onChange={setInvAmount} type="number" />
          </Field>
          <Field label="Ghi chú">
            <Input value={invNote} onChange={setInvNote} placeholder="Tuỳ chọn" />
          </Field>
          <button
            disabled={busy}
            onClick={doCreateInvoice}
            className="h-[38px] px-3 rounded-[10px] text-xs font-bold transition-all disabled:opacity-60"
            style={{ background: P.navy, color: P.white }}
          >
            Tạo hoá đơn
          </button>
        </div>

        {/* Invoice table */}
        <div className="overflow-x-auto rounded-[10px]" style={{ border: `1px solid ${P.border}` }}>
          <table className="w-full text-xs text-left">
            <thead style={{ background: P.navyLt }}>
              <tr>
                {["#", "Kỳ", "Ghế", "Số tiền", "Ghi chú", "Trạng thái"].map((h) => (
                  <th key={h} className="px-3 py-2.5 font-bold text-[10px] uppercase tracking-wider" style={{ color: P.navy }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: P.border }}>
              {loading ? (
                <tr><td colSpan={6} className="px-3 py-5 text-center animate-pulse" style={{ color: P.muted }}>Đang tải…</td></tr>
              ) : invoices.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-5 text-center italic" style={{ color: P.muted }}>Chưa có hoá đơn.</td></tr>
              ) : (
                invoices.map((inv, i) => {
                  const t = statusTone(inv.status)
                  return (
                    <tr key={inv.id} style={{ background: i % 2 === 0 ? P.white : "#FAFCFF" }}>
                      <td className="px-3 py-2.5 font-mono" style={{ color: P.muted }}>{inv.id}</td>
                      <td className="px-3 py-2.5" style={{ color: P.text }}>
                        {shortIso(inv.periodStart) ?? "—"} → {shortIso(inv.periodEnd) ?? "—"}
                      </td>
                      <td className="px-3 py-2.5 font-bold" style={{ color: P.text }}>{fmt(inv.seats)}</td>
                      <td className="px-3 py-2.5 font-black" style={{ color: P.blue }}>{fmt(inv.amountVnd)} ₫</td>
                      <td className="px-3 py-2.5 max-w-[200px] truncate" style={{ color: P.muted }}>{inv.note || "—"}</td>
                      <td className="px-3 py-2.5">
                        <select
                          disabled={busy}
                          value={inv.status?.toUpperCase()}
                          onChange={(e) => changeInvoiceStatus(inv.id, e.target.value as InvoiceStatus)}
                          className="text-[11px] font-bold rounded-[8px] px-2 py-1 outline-none cursor-pointer appearance-none"
                          style={{ background: t.bg, color: t.fg, border: `1px solid ${t.fg}30` }}
                        >
                          {INVOICE_STATUSES.map((s) => (
                            <option key={s} value={s}>{STATUS_VI[s] ?? s}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

// ─── Create org modal ─────────────────────────────────────────────────────────
function CreateOrgModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [planCode, setPlanCode] = useState("")
  const [seatLimit, setSeatLimit] = useState("")
  const [ownerEmail, setOwnerEmail] = useState("")
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")

  const submit = async () => {
    if (!name.trim()) {
      setErr("Tên tổ chức là bắt buộc.")
      return
    }
    setBusy(true)
    setErr("")
    try {
      await createOrganization({
        name: name.trim(),
        slug: slug.trim() || undefined,
        planCode: planCode.trim() || undefined,
        seatLimit: seatLimit.trim() ? Number(seatLimit.trim()) : undefined,
        ownerEmail: ownerEmail.trim() || undefined,
      })
      onCreated()
    } catch (e: unknown) {
      setErr(apiMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.95 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="relative z-10 w-full max-w-md rounded-[24px] bg-white overflow-hidden shadow-2xl"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: P.border }}>
          <div className="flex items-center gap-2">
            <Building2 size={18} style={{ color: P.navy }} />
            <h3 className="font-bold text-base" style={{ color: P.text }}>Tạo tổ chức mới</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400">
            <X size={16} />
          </button>
        </div>
        <div className="px-6 py-5 space-y-3" style={{ background: P.bg }}>
          {err && (
            <div className="rounded-[12px] p-3 text-sm font-medium flex items-center gap-2" style={{ background: P.redLt, color: P.red, border: `1.5px solid ${P.red}40` }}>
              <ShieldAlert size={16} /> {err}
            </div>
          )}
          <Field label="Tên tổ chức *">
            <Input value={name} onChange={setName} placeholder="Trung tâm Đức ngữ ABC" />
          </Field>
          <Field label="Slug (tuỳ chọn)">
            <Input value={slug} onChange={setSlug} placeholder="abc-center" mono />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Plan Code">
              <Input value={planCode} onChange={setPlanCode} placeholder="PRO" />
            </Field>
            <Field label="Số ghế">
              <Input value={seatLimit} onChange={setSeatLimit} type="number" placeholder="50" />
            </Field>
          </div>
          <Field label="Email chủ tổ chức (owner)">
            <Input value={ownerEmail} onChange={setOwnerEmail} placeholder="owner@example.com" />
          </Field>
        </div>
        <div className="px-6 py-4 border-t flex gap-2" style={{ borderColor: P.border }}>
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-[10px] text-sm font-bold transition-colors"
            style={{ background: P.bg, color: P.muted, border: `1px solid ${P.border}` }}
          >
            Huỷ
          </button>
          <button
            disabled={busy}
            onClick={submit}
            className="flex-1 py-2.5 rounded-[10px] text-sm font-bold transition-all disabled:opacity-60"
            style={{ background: P.navy, color: P.white }}
          >
            {busy ? "Đang tạo…" : "Tạo tổ chức"}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Small form primitives ────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold uppercase block mb-1" style={{ color: P.muted }}>{label}</span>
      {children}
    </label>
  )
}

function Input({
  value,
  onChange,
  placeholder,
  type = "text",
  mono = false,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  mono?: boolean
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full px-3 py-2 rounded-[10px] text-sm font-medium outline-none focus:ring-2 focus:ring-blue-100 transition-shadow ${mono ? "font-mono text-xs" : ""}`}
      style={{ border: `1px solid ${P.border}`, background: P.white, color: P.text }}
    />
  )
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 rounded-[10px] text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-shadow appearance-none cursor-pointer"
      style={{ border: `1px solid ${P.border}`, background: P.white, color: P.navy }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}
