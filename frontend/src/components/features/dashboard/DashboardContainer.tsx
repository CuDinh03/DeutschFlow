"use client";

import { ReactNode } from "react";
import { StudentShell } from "@/components/layouts/StudentShell";
import { useStudentPracticeSession } from "@/hooks/useStudentPracticeSession";
import { motion } from "framer-motion";

export function DashboardContainer({ children }: { children: ReactNode }) {
  const { me, loading, targetLevel, streakDays, initials } = useStudentPracticeSession();

  if (loading || !me) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F1F4F9]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-4 border-[#121212] border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <StudentShell
      activeSection="dashboard"
      user={me}
      targetLevel={targetLevel}
      streakDays={streakDays}
      initials={initials}
      onLogout={() => {}}
      headerTitle="Học viện trung tâm"
      headerSubtitle="Willkommen zurück! 👋 Sẵn sàng chinh phục bài học mới chưa?"
    >
      {children}
    </StudentShell>
  );
}
