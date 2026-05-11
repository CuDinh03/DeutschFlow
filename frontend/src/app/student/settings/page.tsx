"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { StudentShell } from "@/components/layouts/StudentShell";
import { useStudentPracticeSession } from "@/hooks/useStudentPracticeSession";
import { logout, setTokens } from "@/lib/authSession";
import {
  updateProfile,
  changePassword,
  getMyLearningProfile,
  updateLearningProfile,
  type LearningProfileData,
} from "@/lib/profileApi";
import {
  User, Lock, BookOpen, Save, Eye, EyeOff,
  CheckCircle2, AlertCircle, Loader2, ChevronRight,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────

type Tab = "personal" | "security" | "learning";

// ── Sub-components ────────────────────────────────────────────────────────

function Toast({ msg, type }: { msg: string; type: "success" | "error" }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-5 py-3 rounded-2xl shadow-xl text-sm font-medium ${
        type === "success"
          ? "bg-emerald-600 text-white"
          : "bg-red-600 text-white"
      }`}
    >
      {type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
      {msg}
    </motion.div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
      <div className="px-5 py-3 bg-[#F8FAFC] border-b border-[#E2E8F0]">
        <p className="text-xs font-bold uppercase tracking-widest text-[#64748B]">{title}</p>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  );
}

function Field({
  label, required, children,
}: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-semibold text-[#374151]">
        {label}{required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full px-4 py-2.5 rounded-xl border border-[#E2E8F0] text-sm focus:outline-none focus:ring-2 focus:ring-[#FFCD00]/50 focus:border-[#FFCD00] transition-all bg-white text-[#0F172A] placeholder:text-[#94A3B8]";

const disabledInputCls =
  "w-full px-4 py-2.5 rounded-xl border border-[#E2E8F0] text-sm bg-[#F8FAFC] text-[#94A3B8] cursor-not-allowed";

function SaveButton({ loading, label = "Lưu thay đổi" }: { loading: boolean; label?: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#121212] text-white text-sm font-bold hover:bg-[#1E293B] disabled:opacity-50 transition-all"
    >
      {loading ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
      {loading ? "Đang lưu..." : label}
    </button>
  );
}

// ── Goal types & levels ───────────────────────────────────────────────────

const GOAL_OPTIONS = [
  { value: "WORK", label: "🏢 Đi làm / Công việc" },
  { value: "CERT", label: "📜 Thi chứng chỉ (Goethe, TestDaF)" },
];
const LEVEL_OPTIONS = ["A1", "A2", "B1", "B2", "C1", "C2"];
const SPEED_OPTIONS = [
  { value: "SLOW", label: "🐢 Chậm (ôn chắc)" },
  { value: "NORMAL", label: "🚶 Bình thường" },
  { value: "FAST", label: "🚀 Nhanh (cường độ cao)" },
];
const INTEREST_CHIPS = [
  "Du lịch", "Nấu ăn", "Thể thao", "Âm nhạc", "Công nghệ",
  "Y tế", "Kinh doanh", "Phim ảnh", "Văn học", "Thiên nhiên",
];

// ── Main Page ─────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const router = useRouter();
  const { me, loading: meLoading, targetLevel, streakDays, initials } =
    useStudentPracticeSession();

  const [activeTab, setActiveTab] = useState<Tab>("personal");
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  if (meLoading || !me) return null;

  return (
    <StudentShell
      activeSection="settings"
      user={me}
      targetLevel={targetLevel}
      streakDays={streakDays}
      initials={initials}
      onLogout={() => logout()}
      headerTitle="⚙️ Cài đặt hồ sơ"
      headerSubtitle="Quản lý thông tin cá nhân và hồ sơ học tập"
    >
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

        {/* Avatar card */}
        <div
          className="rounded-2xl p-5 flex items-center gap-4 text-white"
          style={{ background: "linear-gradient(135deg,#121212 0%,#1E293B 100%)" }}
        >
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#FFCD00] to-[#F59E0B] flex items-center justify-center flex-shrink-0">
            <span className="text-[#121212] font-black text-xl">{initials}</span>
          </div>
          <div className="min-w-0">
            <p className="font-bold text-lg truncate">{me.displayName}</p>
            <p className="text-white/50 text-sm truncate">{me.email}</p>
          </div>
          <div className="ml-auto flex-shrink-0 bg-[#FFCD00]/15 border border-[#FFCD00]/30 rounded-xl px-3 py-1.5 text-[#FFCD00] text-xs font-bold">
            {targetLevel || "Chưa xác định"}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-[#F1F5F9] rounded-2xl">
          {(
            [
              { id: "personal" as Tab, label: "Thông tin", icon: User },
              { id: "security" as Tab, label: "Bảo mật", icon: Lock },
              { id: "learning" as Tab, label: "Hồ sơ học", icon: BookOpen },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${
                activeTab === id
                  ? "bg-white text-[#121212] shadow-sm"
                  : "text-[#64748B] hover:text-[#121212]"
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.18 }}
          >
            {activeTab === "personal" && (
              <PersonalTab me={me} showToast={showToast} />
            )}
            {activeTab === "security" && (
              <SecurityTab showToast={showToast} />
            )}
            {activeTab === "learning" && (
              <LearningTab showToast={showToast} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {toast && <Toast msg={toast.msg} type={toast.type} />}
      </AnimatePresence>
    </StudentShell>
  );
}

// ── Tab: Thông tin cá nhân ────────────────────────────────────────────────

function PersonalTab({
  me,
  showToast,
}: {
  me: { displayName: string; email?: string | null; phoneNumber?: string | null };
  showToast: (msg: string, type?: "success" | "error") => void;
}) {
  const [displayName, setDisplayName] = useState(me.displayName);
  const [phoneNumber, setPhoneNumber] = useState(me.phoneNumber ?? "");
  const [locale, setLocale] = useState("vi");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: Record<string, string> = {};
      if (displayName.trim() !== me.displayName) payload.displayName = displayName.trim();
      if (phoneNumber.trim() !== (me.phoneNumber ?? "")) payload.phoneNumber = phoneNumber.trim();
      payload.locale = locale;

      const res = await updateProfile(payload);
      if (res.accessToken) setTokens(res);
      showToast("Đã cập nhật thông tin thành công!");
    } catch (err: any) {
      showToast(err.message ?? "Cập nhật thất bại", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <SectionCard title="Thông tin cơ bản">
        <Field label="Email">
          <div className={disabledInputCls}>{me.email}</div>
          <p className="text-xs text-[#94A3B8] mt-1">
            Email không thể thay đổi sau khi đăng ký.
          </p>
        </Field>

        <Field label="Tên hiển thị" required>
          <input
            className={inputCls}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            minLength={2}
            maxLength={100}
            placeholder="Tên của bạn"
            required
          />
        </Field>

        <Field label="Số điện thoại">
          <input
            className={inputCls}
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="0912 345 678"
            pattern="^(\+84|0)[0-9]{8,9}$"
            title="Số điện thoại Việt Nam hợp lệ (0xxxxxxxxx)"
          />
          <p className="text-xs text-[#94A3B8] mt-1">Định dạng: 0xxxxxxxxx hoặc +84xxxxxxxxx</p>
        </Field>

        <Field label="Ngôn ngữ giao diện">
          <select
            className={inputCls}
            value={locale}
            onChange={(e) => setLocale(e.target.value)}
          >
            <option value="vi">🇻🇳 Tiếng Việt</option>
            <option value="en">🇬🇧 English</option>
            <option value="de">🇩🇪 Deutsch</option>
          </select>
        </Field>
      </SectionCard>

      <div className="flex justify-end">
        <SaveButton loading={saving} />
      </div>
    </form>
  );
}

// ── Tab: Bảo mật ──────────────────────────────────────────────────────────

function SecurityTab({
  showToast,
}: {
  showToast: (msg: string, type?: "success" | "error") => void;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      showToast("Mật khẩu mới không khớp", "error");
      return;
    }
    if (newPassword.length < 6) {
      showToast("Mật khẩu mới phải có ít nhất 6 ký tự", "error");
      return;
    }
    setSaving(true);
    try {
      await changePassword({ currentPassword, newPassword });
      showToast("Đổi mật khẩu thành công! Vui lòng đăng nhập lại.");
      setTimeout(() => logout(), 2500);
    } catch (err: any) {
      showToast(err.message ?? "Đổi mật khẩu thất bại", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <SectionCard title="Đổi mật khẩu">
        <Field label="Mật khẩu hiện tại" required>
          <div className="relative">
            <input
              className={inputCls + " pr-10"}
              type={showCurrent ? "text" : "password"}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Nhập mật khẩu hiện tại"
              required
            />
            <button
              type="button"
              onClick={() => setShowCurrent((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#64748B]"
            >
              {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </Field>

        <Field label="Mật khẩu mới" required>
          <div className="relative">
            <input
              className={inputCls + " pr-10"}
              type={showNew ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Tối thiểu 6 ký tự"
              minLength={6}
              required
            />
            <button
              type="button"
              onClick={() => setShowNew((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#64748B]"
            >
              {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </Field>

        <Field label="Xác nhận mật khẩu mới" required>
          <input
            className={inputCls + (confirmPassword && confirmPassword !== newPassword ? " border-red-400" : "")}
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Nhập lại mật khẩu mới"
            required
          />
          {confirmPassword && confirmPassword !== newPassword && (
            <p className="text-xs text-red-500 mt-1">Mật khẩu không khớp</p>
          )}
        </Field>
      </SectionCard>

      <div
        className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 flex items-start gap-2"
      >
        <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
        Sau khi đổi mật khẩu, bạn sẽ bị đăng xuất và cần đăng nhập lại bằng mật khẩu mới.
      </div>

      <div className="flex justify-end">
        <SaveButton loading={saving} label="Đổi mật khẩu" />
      </div>
    </form>
  );
}

// ── Tab: Hồ sơ học tập ────────────────────────────────────────────────────

function LearningTab({
  showToast,
}: {
  showToast: (msg: string, type?: "success" | "error") => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<LearningProfileData | null>(null);

  // Form state
  const [goalType, setGoalType] = useState("");
  const [targetLevel, setTargetLevel] = useState("");
  const [industry, setIndustry] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [learningSpeed, setLearningSpeed] = useState("NORMAL");
  const [sessionsPerWeek, setSessionsPerWeek] = useState(3);
  const [minutesPerSession, setMinutesPerSession] = useState(30);

  useEffect(() => {
    getMyLearningProfile()
      .then((p) => {
        setProfile(p);
        setGoalType(p.goalType ?? "");
        setTargetLevel(p.targetLevel ?? "");
        setIndustry(p.industry ?? "");
        setInterests(p.interests ?? []);
        setLearningSpeed(p.learningSpeed ?? "NORMAL");
        setSessionsPerWeek(p.sessionsPerWeek ?? 3);
        setMinutesPerSession(p.minutesPerSession ?? 30);
      })
      .catch(() => showToast("Không thể tải hồ sơ học tập", "error"))
      .finally(() => setLoading(false));
  }, []);

  const toggleInterest = (chip: string) => {
    setInterests((prev) =>
      prev.includes(chip) ? prev.filter((i) => i !== chip) : [...prev, chip]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateLearningProfile({
        goalType: goalType || undefined,
        targetLevel: targetLevel || undefined,
        industry: industry || undefined,
        interests,
        learningSpeed: learningSpeed || undefined,
        sessionsPerWeek,
        minutesPerSession,
      });
      showToast("Đã cập nhật hồ sơ học tập!");
    } catch (err: any) {
      showToast(err.message ?? "Cập nhật thất bại", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={32} className="animate-spin text-[#64748B]" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      <SectionCard title="Mục tiêu học tập">
        <Field label="Mục tiêu">
          <div className="grid grid-cols-2 gap-3">
            {GOAL_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setGoalType(value)}
                className={`px-4 py-3 rounded-xl border-2 text-sm font-medium text-left transition-all ${
                  goalType === value
                    ? "border-[#121212] bg-[#121212] text-white"
                    : "border-[#E2E8F0] bg-white text-[#374151] hover:border-[#CBD5E1]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Trình độ hướng đến">
          <div className="flex gap-2 flex-wrap">
            {LEVEL_OPTIONS.map((lv) => (
              <button
                key={lv}
                type="button"
                onClick={() => setTargetLevel(lv)}
                className={`px-4 py-2 rounded-xl border-2 text-sm font-bold transition-all ${
                  targetLevel === lv
                    ? "border-[#FFCD00] bg-[#FFFBEB] text-[#78350F]"
                    : "border-[#E2E8F0] bg-white text-[#64748B] hover:border-[#CBD5E1]"
                }`}
              >
                {lv}
              </button>
            ))}
          </div>
        </Field>
      </SectionCard>

      <SectionCard title="Thông tin cá nhân hóa">
        <Field label="Nghề nghiệp / Ngành">
          <input
            className={inputCls}
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            placeholder="VD: Lập trình viên, Bác sĩ, Kế toán..."
            maxLength={100}
          />
        </Field>

        <Field label="Sở thích">
          <div className="flex flex-wrap gap-2">
            {INTEREST_CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => toggleInterest(chip)}
                className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${
                  interests.includes(chip)
                    ? "border-[#22D3EE] bg-[#ECFEFF] text-[#0E7490]"
                    : "border-[#E2E8F0] bg-white text-[#64748B] hover:border-[#CBD5E1]"
                }`}
              >
                {interests.includes(chip) ? "✓ " : ""}{chip}
              </button>
            ))}
          </div>
          {interests.length > 0 && (
            <p className="text-xs text-[#64748B]">{interests.length} sở thích đã chọn</p>
          )}
        </Field>
      </SectionCard>

      <SectionCard title="Lịch học">
        <Field label="Tốc độ học">
          <div className="grid grid-cols-3 gap-2">
            {SPEED_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setLearningSpeed(value)}
                className={`px-3 py-2.5 rounded-xl border-2 text-xs font-medium text-center transition-all ${
                  learningSpeed === value
                    ? "border-[#121212] bg-[#121212] text-white"
                    : "border-[#E2E8F0] bg-white text-[#374151] hover:border-[#CBD5E1]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Buổi học / tuần">
            <input
              className={inputCls}
              type="number"
              min={1}
              max={14}
              value={sessionsPerWeek}
              onChange={(e) => setSessionsPerWeek(Number(e.target.value))}
            />
          </Field>
          <Field label="Phút / buổi">
            <input
              className={inputCls}
              type="number"
              min={5}
              max={180}
              step={5}
              value={minutesPerSession}
              onChange={(e) => setMinutesPerSession(Number(e.target.value))}
            />
          </Field>
        </div>

        <div className="rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] px-4 py-3 text-xs text-[#64748B]">
          📅 Ước tính: <span className="font-bold text-[#0F172A]">
            {sessionsPerWeek * minutesPerSession} phút/tuần
          </span> · {Math.round(sessionsPerWeek * minutesPerSession / 60 * 10) / 10} giờ/tuần
        </div>
      </SectionCard>

      <div className="flex justify-end">
        <SaveButton loading={saving} label="Lưu hồ sơ học tập" />
      </div>
    </form>
  );
}
