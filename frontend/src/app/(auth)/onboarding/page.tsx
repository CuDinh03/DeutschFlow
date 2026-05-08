"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Briefcase,
  GraduationCap,
  ArrowRight,
  ArrowLeft,
  Check,
  Sparkles,
} from "lucide-react";
import api from "@/lib/api";
import Image from "next/image";

type GoalType = "WORK" | "CERT";
type PersonaType = "LUKAS" | "EMMA" | "ANNA" | "KLAUS";

const INTERESTS = [
  { id: "TECH", label: "Công nghệ" },
  { id: "BUSINESS", label: "Kinh doanh" },
  { id: "TRAVEL", label: "Du lịch" },
  { id: "HEALTH", label: "Y tế" },
  { id: "EDUCATION", label: "Giáo dục" },
  { id: "CULTURE", label: "Văn hóa" },
  { id: "SPORTS", label: "Thể thao" },
  { id: "ART", label: "Nghệ thuật" },
];

const PERSONAS = [
  {
    id: "LUKAS",
    name: "Lukas",
    role: "Lập trình viên · Berlin",
    color: "#22D3EE",
    img: "/companions/lukas.png",
  },
  {
    id: "EMMA",
    name: "Emma",
    role: "Nghệ sĩ · Neukölln",
    color: "#F472B6",
    img: "/companions/emma.png",
  },
  {
    id: "ANNA",
    name: "Anna",
    role: "Giáo viên · Hamburg",
    color: "#FBBF24",
    img: "/companions/anna.png",
  },
  {
    id: "KLAUS",
    name: "Klaus",
    role: "Đầu bếp · München",
    color: "#F87171",
    img: "/companions/klaus.png",
  },
];

const STEPS = ["Mục tiêu", "Mentor", "Bản thân", "Xác nhận"];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    goalType: "" as GoalType | "",
    persona: "LUKAS" as PersonaType,
    industry: "",
    interests: [] as string[],
  });

  const selectedPersona = PERSONAS.find((p) => p.id === form.persona)!;
  const accentColor = selectedPersona.color;

  const next = () => setStep((s) => Math.min(s + 1, 4));
  const prev = () => setStep((s) => Math.max(s - 1, 1));

  const toggleInterest = (id: string) => {
    setForm((f) => ({
      ...f,
      interests: f.interests.includes(id)
        ? f.interests.filter((x) => x !== id)
        : [...f.interests, id],
    }));
  };

  const handleFinish = async () => {
    setLoading(true);
    try {
      await api.patch("/auth/me", {
        goalType: form.goalType || "WORK",
        industry: form.industry || null,
        interests: form.interests,
      });
    } catch {
      // silent — non-blocking
    } finally {
      setLoading(false);
      router.push("/dashboard");
    }
  };

  const canProceed =
    (step === 1 && form.goalType !== "") ||
    step === 2 ||
    step === 3 ||
    step === 4;

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #0B0F19 0%, #0F172A 60%, #1A0A2E 100%)" }}
    >
      {/* Ambient orbs */}
      <div
        className="absolute top-[-15%] left-[-10%] w-[500px] h-[500px] rounded-full blur-[140px] opacity-20 pointer-events-none transition-colors duration-700"
        style={{ backgroundColor: accentColor }}
      />
      <div className="absolute bottom-[-15%] right-[-10%] w-[400px] h-[400px] rounded-full blur-[120px] opacity-15 pointer-events-none bg-[#121212]" />

      {/* Logo */}
      <div className="relative z-10 mb-8 flex items-center gap-2">
        <div className="w-8 h-8 rounded-[8px] bg-[#FFCD00] flex items-center justify-center">
          <span className="text-[#121212] font-black text-base leading-none">D</span>
        </div>
        <span className="text-white font-bold text-xl tracking-tight">
          DeutschFlow<span className="text-[#FFCD00]">.</span>
        </span>
      </div>

      {/* Step indicator */}
      <div className="relative z-10 flex items-center gap-2 mb-8">
        {STEPS.map((label, i) => {
          const num = i + 1;
          const isDone = num < step;
          const isActive = num === step;
          return (
            <div key={num} className="flex items-center gap-2">
              <div className="flex flex-col items-center gap-1">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300"
                  style={
                    isDone
                      ? { backgroundColor: accentColor, color: "#0B0F19" }
                      : isActive
                      ? { backgroundColor: accentColor + "30", border: `2px solid ${accentColor}`, color: accentColor }
                      : { backgroundColor: "rgba(255,255,255,0.05)", border: "2px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.3)" }
                  }
                >
                  {isDone ? <Check size={12} /> : num}
                </div>
                <span
                  className="text-[10px] font-medium transition-colors duration-300 hidden sm:block"
                  style={{ color: isActive ? accentColor : isDone ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.25)" }}
                >
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className="w-10 h-px mb-4 hidden sm:block transition-colors duration-300"
                  style={{ backgroundColor: num < step ? accentColor + "80" : "rgba(255,255,255,0.1)" }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Card */}
      <div className="relative z-10 w-full max-w-xl px-4">
        <div
          className="rounded-2xl border p-8 shadow-2xl backdrop-blur-xl"
          style={{
            background: "rgba(15,23,42,0.85)",
            borderColor: "rgba(255,255,255,0.08)",
          }}
        >
          <AnimatePresence mode="wait">

            {/* ── STEP 1: GOAL ── */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.25 }}
              >
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-white">Mục tiêu của bạn là gì?</h2>
                  <p className="text-white/50 text-sm mt-1">Chọn mục tiêu để chúng tôi xây dựng lộ trình phù hợp nhất.</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { id: "WORK", icon: Briefcase, title: "Đi làm / Công việc", desc: "Giao tiếp thực tế trong công việc & phỏng vấn" },
                    { id: "CERT", icon: GraduationCap, title: "Thi chứng chỉ", desc: "Luyện thi Goethe, TELC, TestDaF" },
                  ].map(({ id, icon: Icon, title, desc }) => {
                    const selected = form.goalType === id;
                    return (
                      <button
                        key={id}
                        onClick={() => { setForm({ ...form, goalType: id as GoalType }); }}
                        className="relative flex flex-col items-center gap-4 p-6 rounded-xl border-2 transition-all duration-200 text-center group"
                        style={
                          selected
                            ? { borderColor: accentColor, backgroundColor: accentColor + "15" }
                            : { borderColor: "rgba(255,255,255,0.08)", backgroundColor: "rgba(255,255,255,0.02)" }
                        }
                      >
                        <div
                          className="w-14 h-14 rounded-2xl flex items-center justify-center transition-colors duration-200"
                          style={selected ? { backgroundColor: accentColor + "25" } : { backgroundColor: "rgba(255,255,255,0.05)" }}
                        >
                          <Icon size={28} style={{ color: selected ? accentColor : "rgba(255,255,255,0.4)" }} />
                        </div>
                        <div>
                          <p className="font-semibold text-white text-sm">{title}</p>
                          <p className="text-white/40 text-xs mt-1 leading-relaxed">{desc}</p>
                        </div>
                        {selected && (
                          <div
                            className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center"
                            style={{ backgroundColor: accentColor }}
                          >
                            <Check size={11} color="#0B0F19" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* ── STEP 2: PERSONA ── */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.25 }}
              >
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-white">Chọn Mentor đồng hành</h2>
                  <p className="text-white/50 text-sm mt-1">Họ sẽ dẫn dắt bạn xuyên suốt hành trình học tiếng Đức.</p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {PERSONAS.map((p) => {
                    const selected = form.persona === p.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => setForm({ ...form, persona: p.id as PersonaType })}
                        className="relative rounded-xl overflow-hidden border-2 transition-all duration-200"
                        style={selected ? { borderColor: p.color } : { borderColor: "rgba(255,255,255,0.08)" }}
                      >
                        <div className="aspect-[3/4] relative bg-[#0B0F19]">
                          <motion.div
                            animate={{ y: selected ? [0, -4, 0] : 0 }}
                            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                            className="absolute inset-0"
                          >
                            <Image src={p.img} alt={p.name} fill className="object-cover object-top" />
                          </motion.div>
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                          <div className="absolute bottom-0 inset-x-0 p-3 text-left">
                            <p className="font-bold text-white text-sm leading-tight">{p.name}</p>
                            <p className="text-white/50 text-[10px] mt-0.5 leading-snug">{p.role}</p>
                          </div>
                          {selected && (
                            <div
                              className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
                              style={{ backgroundColor: p.color }}
                            >
                              <Check size={11} color="#0B0F19" />
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* ── STEP 3: PROFILE ── */}
            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.25 }}
              >
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-white">Giới thiệu về bạn</h2>
                  <p className="text-white/50 text-sm mt-1">Để AI cá nhân hoá từ vựng & tình huống học cho bạn.</p>
                </div>

                <div className="space-y-5">
                  <div>
                    <label className="block text-white/70 text-sm font-medium mb-2">
                      Ngành nghề / Lĩnh vực
                    </label>
                    <input
                      type="text"
                      value={form.industry}
                      onChange={(e) => setForm({ ...form, industry: e.target.value })}
                      placeholder="VD: IT, Nhà hàng, Điều dưỡng, Tài chính..."
                      className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 outline-none border transition-colors duration-200"
                      style={{
                        backgroundColor: "rgba(255,255,255,0.05)",
                        borderColor: form.industry ? accentColor + "60" : "rgba(255,255,255,0.08)",
                      }}
                    />
                  </div>

                  <div>
                    <label className="block text-white/70 text-sm font-medium mb-3">
                      Sở thích <span className="text-white/30 font-normal">(tuỳ chọn)</span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {INTERESTS.map(({ id, label }) => {
                        const active = form.interests.includes(id);
                        return (
                          <button
                            key={id}
                            onClick={() => toggleInterest(id)}
                            className="px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-150 border"
                            style={
                              active
                                ? { backgroundColor: accentColor + "25", borderColor: accentColor + "80", color: accentColor }
                                : { backgroundColor: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)" }
                            }
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── STEP 4: CONFIRM ── */}
            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.3 }}
                className="text-center"
              >
                <motion.div
                  initial={{ scale: 0, rotate: -20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", damping: 12, delay: 0.1 }}
                  className="w-20 h-20 mx-auto rounded-2xl flex items-center justify-center mb-5"
                  style={{ backgroundColor: accentColor + "20" }}
                >
                  <Sparkles size={40} style={{ color: accentColor }} />
                </motion.div>

                <h2 className="text-2xl font-bold text-white mb-1">Sẵn sàng rồi!</h2>
                <p className="text-white/50 text-sm mb-6">Lộ trình học cá nhân hoá đã được tạo cho bạn.</p>

                <div
                  className="rounded-xl border divide-y text-left mb-2"
                  style={{ borderColor: "rgba(255,255,255,0.08)" }}
                >
                  {[
                    { label: "Mục tiêu", value: form.goalType === "WORK" ? "Đi làm / Công việc" : "Thi chứng chỉ" },
                    { label: "Mentor", value: selectedPersona.name + " — " + selectedPersona.role },
                    { label: "Ngành nghề", value: form.industry || "Chung" },
                    { label: "Sở thích", value: form.interests.length ? form.interests.map(i => INTERESTS.find(x => x.id === i)?.label).join(", ") : "Chưa chọn" },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between px-4 py-3">
                      <span className="text-white/40 text-sm">{label}</span>
                      <span className="text-white text-sm font-medium text-right max-w-[60%]">{value}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Actions */}
          <div className="mt-8 flex items-center justify-between">
            {step > 1 ? (
              <button
                onClick={prev}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium text-white/40 hover:text-white/70 hover:bg-white/5 transition-all duration-150"
              >
                <ArrowLeft size={16} />
                Quay lại
              </button>
            ) : (
              <div />
            )}

            {step < 4 ? (
              <button
                onClick={next}
                disabled={!canProceed}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
                style={{ backgroundColor: accentColor, color: "#0B0F19" }}
              >
                Tiếp tục
                <ArrowRight size={16} />
              </button>
            ) : (
              <button
                onClick={handleFinish}
                disabled={loading}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-150 hover:scale-105 active:scale-95 disabled:opacity-50"
                style={{ backgroundColor: accentColor, color: "#0B0F19" }}
              >
                {loading ? "Đang tạo..." : "Bắt đầu học"}
                {!loading && <Check size={16} />}
              </button>
            )}
          </div>
        </div>
      </div>

      <p className="relative z-10 mt-6 text-white/20 text-xs">
        Bạn có thể thay đổi thông tin này sau trong Cài đặt.
      </p>
    </div>
  );
}
