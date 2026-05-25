"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { getAccessToken } from "@/lib/authSession";
import { StudentShell } from "@/components/layouts/StudentShell";
import { ArrowLeft, Sparkles, Target, Clock3, Trophy, Brain, BookOpen } from "lucide-react";

type StudyLevel = "A0" | "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
type FocusArea = "listening" | "speaking" | "grammar" | "vocabulary";

type SetupFormState = {
  goalType: "WORK" | "CERT";
  industry: string;
  currentLevel: StudyLevel;
  targetLevel: StudyLevel;
  sessionsPerWeek: string;
  minutesPerSession: string;
  learningSpeed: "SLOW" | "NORMAL" | "FAST";
  examType: string;
  focusAreas: FocusArea[];
};

const initialState: SetupFormState = {
  goalType: "CERT",
  industry: "",
  currentLevel: "A0",
  targetLevel: "A1",
  sessionsPerWeek: "3",
  minutesPerSession: "30",
  learningSpeed: "NORMAL",
  examType: "",
  focusAreas: ["listening", "speaking"],
};

const focusOptions: Array<{ id: FocusArea; label: string; description: string }> = [
  { id: "listening", label: "Nghe", description: "Tăng phản xạ nghe hiểu" },
  { id: "speaking", label: "Nói", description: "Luyện phản xạ giao tiếp" },
  { id: "grammar", label: "Ngữ pháp", description: "Củng cố cấu trúc câu" },
  { id: "vocabulary", label: "Từ vựng", description: "Mở rộng vốn từ theo chủ đề" },
];

export default function RoadmapSetupPage() {
  const router = useRouter();
  const [form, setForm] = useState<SetupFormState>(initialState);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const submitLockRef = useRef(false);

  const branchLabel = useMemo(() => (form.currentLevel === "A0" ? "Lộ trình nền tảng cơ bản" : "Lộ trình cá nhân hóa"), [form.currentLevel]);

  useEffect(() => {
    if (!getAccessToken()) {
      router.push("/login");
    }
  }, [router]);

  const toggleFocus = (focus: FocusArea) => {
    setForm((prev) => ({
      ...prev,
      focusAreas: prev.focusAreas.includes(focus)
        ? prev.focusAreas.filter((item) => item !== focus)
        : [...prev.focusAreas, focus],
    }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (submitting || submitLockRef.current) {
      return;
    }

    submitLockRef.current = true;
    setError("");

    if (!form.goalType) {
      setError("Vui lòng chọn mục tiêu học.");
      return;
    }

    if (!form.currentLevel) {
      setError("Vui lòng chọn trình độ hiện tại.");
      return;
    }

    if (!form.targetLevel) {
      setError("Vui lòng chọn trình độ mục tiêu.");
      return;
    }

    if (!form.minutesPerSession || Number.isNaN(Number(form.minutesPerSession)) || Number(form.minutesPerSession) <= 0) {
      setError("Vui lòng nhập số phút học mỗi ngày hợp lệ.");
      return;
    }

    if (form.focusAreas.length === 0) {
      setError("Vui lòng chọn ít nhất một kỹ năng ưu tiên.");
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/roadmap/setup", {
        goalType: form.goalType,
        currentLevel: form.currentLevel,
        targetLevel: form.targetLevel,
        sessionsPerWeek: Number(form.sessionsPerWeek),
        minutesPerSession: Number(form.minutesPerSession),
        learningSpeed: form.learningSpeed,
        industry: form.industry,
        focusAreas: form.focusAreas,
        examType: form.examType,
      });

      router.push("/roadmap/tree");
    } catch {
      setError("Không thể tạo lộ trình lúc này. Vui lòng thử lại.");
    } finally {
      submitLockRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <StudentShell
      activeSection="roadmap"
      user={{ displayName: "Roadmap Setup", role: "STUDENT" }}
      targetLevel={form.targetLevel}
      streakDays={0}
      initials="RS"
      onLogout={() => router.push("/")}
      headerTitle="Thiết lập lộ trình"
      headerSubtitle="Chọn đầu vào để tạo roadmap phù hợp với trình độ của bạn"
      hideBottomNav
    >
      <div className="max-w-4xl mx-auto w-full px-4 py-6">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 mb-6"
        >
          <ArrowLeft size={16} /> Quay lại
        </button>

        <div className="grid gap-6 lg:grid-cols-[1.3fr_0.9fr] items-start">
          <form onSubmit={onSubmit} className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 md:p-8 space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Sparkles size={22} />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold text-slate-900">Thiết lập lộ trình học</h1>
                <p className="text-slate-500 mt-1">Nhập vài thông tin cơ bản để hệ thống tạo lộ trình phù hợp.</p>
              </div>
            </div>

            <div className="grid gap-4">
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-slate-700 flex items-center gap-2"><Target size={16} /> Mục tiêu học</span>
                <select
                  value={form.goalType}
                  onChange={(e) => setForm((prev) => ({ ...prev, goalType: e.target.value as SetupFormState["goalType"] }))}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="CERT">Thi chứng chỉ</option>
                  <option value="WORK">Dùng cho công việc</option>
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-semibold text-slate-700 flex items-center gap-2"><BookOpen size={16} /> Ngành nghề / bối cảnh</span>
                <input
                  value={form.industry}
                  onChange={(e) => setForm((prev) => ({ ...prev, industry: e.target.value }))}
                  placeholder="Ví dụ: IT, y tế, nhà hàng..."
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>

              <div className="grid gap-4 md:grid-cols-3">
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-slate-700 flex items-center gap-2"><BookOpen size={16} /> Trình độ hiện tại</span>
                  <select
                    value={form.currentLevel}
                    onChange={(e) => {
                      const next = e.target.value as StudyLevel;
                      setForm((prev) => ({ ...prev, currentLevel: next, targetLevel: next === "A0" ? "A1" : prev.targetLevel }));
                    }}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {(["A0", "A1", "A2", "B1", "B2", "C1", "C2"] as StudyLevel[]).map((level) => (
                      <option key={level} value={level}>{level}</option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-slate-700 flex items-center gap-2"><Target size={16} /> Trình độ mục tiêu</span>
                  <select
                    value={form.targetLevel}
                    onChange={(e) => setForm((prev) => ({ ...prev, targetLevel: e.target.value as StudyLevel }))}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {(["A1", "A2", "B1", "B2", "C1", "C2"] as StudyLevel[]).map((level) => (
                      <option key={level} value={level}>{level}</option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-slate-700 flex items-center gap-2"><Clock3 size={16} /> Phút mỗi buổi</span>
                  <input
                    type="number"
                    min={10}
                    step={5}
                    value={form.minutesPerSession}
                    onChange={(e) => setForm((prev) => ({ ...prev, minutesPerSession: e.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-slate-700 flex items-center gap-2"><Trophy size={16} /> Buổi học mỗi tuần</span>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={form.sessionsPerWeek}
                    onChange={(e) => setForm((prev) => ({ ...prev, sessionsPerWeek: e.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-slate-700 flex items-center gap-2"><Brain size={16} /> Tốc độ học</span>
                  <select
                    value={form.learningSpeed}
                    onChange={(e) => setForm((prev) => ({ ...prev, learningSpeed: e.target.value as SetupFormState["learningSpeed"] }))}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="SLOW">Chậm</option>
                    <option value="NORMAL">Bình thường</option>
                    <option value="FAST">Nhanh</option>
                  </select>
                </label>
              </div>

              <label className="grid gap-2">
                <span className="text-sm font-semibold text-slate-700 flex items-center gap-2"><Trophy size={16} /> Kỳ thi / chứng chỉ</span>
                <input
                  value={form.examType}
                  onChange={(e) => setForm((prev) => ({ ...prev, examType: e.target.value }))}
                  placeholder="Ví dụ: Goethe A1, telc A2..."
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-slate-700">
                <Brain size={16} /> Kỹ năng ưu tiên
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {focusOptions.map((option) => {
                  const active = form.focusAreas.includes(option.id);
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => toggleFocus(option.id)}
                      className={`text-left rounded-2xl border p-4 transition-all ${active ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-slate-300"}`}
                    >
                      <div className="font-bold text-slate-900">{option.label}</div>
                      <div className="text-sm text-slate-500 mt-1">{option.description}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {error && <div className="rounded-2xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">{error}</div>}

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 text-white px-5 py-3 font-bold disabled:opacity-60"
              >
                {submitting ? "Đang lưu..." : "Tạo lộ trình"}
              </button>
              <button
                type="button"
                onClick={() => router.push("/roadmap")}
                className="rounded-2xl border border-slate-200 px-5 py-3 font-semibold text-slate-700"
              >
                Để sau
              </button>
            </div>
          </form>

          <aside className="bg-slate-900 text-white rounded-3xl p-6 md:p-8 space-y-5 shadow-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 text-sm font-semibold">
              <Sparkles size={14} /> {branchLabel}
            </div>
            <h2 className="text-2xl font-extrabold leading-tight">Lộ trình sẽ được cá nhân hóa theo trình độ đầu vào của bạn</h2>
            <p className="text-white/70 leading-relaxed">
              Nếu bạn bắt đầu từ A1 trở lên, hệ thống sẽ tạo lộ trình cá nhân hóa ngay trên nền CEFR.
              Nếu bạn chưa biết gì (A0), bạn sẽ đi qua phần nền tảng cơ bản trước để tránh bị quá tải.
            </p>
            <div className="space-y-3 text-sm text-white/75">
              <div className="rounded-2xl bg-white/5 border border-white/10 p-4">1. Xác nhận mục tiêu và level đầu vào</div>
              <div className="rounded-2xl bg-white/5 border border-white/10 p-4">2. AI tinh chỉnh roadmap theo thời gian học và kỹ năng ưu tiên</div>
              <div className="rounded-2xl bg-white/5 border border-white/10 p-4">3. Chuyển sang skill tree để bắt đầu học ngay</div>
            </div>
          </aside>
        </div>
      </div>
    </StudentShell>
  );
}
