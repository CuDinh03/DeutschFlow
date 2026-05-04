"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { StudentBottomNav } from "@/components/layouts/StudentBottomNav";
import { cn } from "@/lib/utils";
import { isStudentImmersivePath } from "@/lib/studentImmersiveRoutes";
import {
  LayoutDashboard,
  BookOpen,
  Mic2,
  BookMarked,
  Settings,
  Flame,
  ChevronRight,
  Menu,
  X,
  ShieldCheck,
  Gamepad2,
  Map,
  Library,
  LogOut,
  Mic,
  Repeat2,
  AlertTriangle,
  BadgePercent,
  Calendar,
  History,
} from "lucide-react";

export type StudentShellSection =
  | "dashboard"
  | "courses"
  | "speaking"
  | "vocabulary"
  | "settings"
  | "roadmap"
  | "flashcards"
  | "swipe"
  | "game"
  | "errors"
  | "myPlan"
  | "weeklySpeaking"
  | "exerciseHistory";

type Props = {
  activeSection: StudentShellSection;
  user: { displayName: string; role: string };
  targetLevel: string;
  streakDays: number;
  initials: string;
  onLogout: () => void;
  headerTitle: ReactNode;
  headerSubtitle?: ReactNode;
  /** Extra nodes in header right (before streak pill) */
  headerRight?: ReactNode;
  /** Full-bleed content (hide white app bar — e.g. AI Chat V2 companion) */
  hideAppHeader?: boolean;
  children: ReactNode;
};

export function StudentShell({
  activeSection,
  user,
  targetLevel,
  streakDays,
  initials,
  onLogout,
  headerTitle,
  headerSubtitle,
  headerRight,
  hideAppHeader,
  children,
}: Props) {
  const t = useTranslations("student");
  const router = useRouter();
  const pathname = usePathname();
  const showMobileBottomPad = !isStudentImmersivePath(pathname);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navItems = useMemo(
    () => [
      { id: "dashboard" as const, label: t("navDashboard"), icon: LayoutDashboard, href: "/dashboard" },
      { id: "courses" as const, label: t("navMyCourses"), icon: BookOpen, href: "/student/plan" },
      { id: "roadmap" as const, label: t("navLearningPath"), icon: Map, href: "/roadmap" },
      { id: "speaking" as const, label: t("navSpeaking"), icon: Mic2, href: "/speaking" },
      { id: "vocabulary" as const, label: t("navVocabulary"), icon: BookMarked, href: "/student/vocabulary" },
      { id: "weeklySpeaking" as const, label: t("navWeeklySpeaking"), icon: Calendar, href: "/student/weekly-speaking" },
      { id: "swipe" as const, label: t("navSwipeLearn"), icon: Repeat2, href: "/student/swipe-cards" },
      { id: "errors" as const, label: t("navMyErrors"), icon: AlertTriangle, href: "/student/errors" },
      { id: "game" as const, label: t("navLegoGame"), icon: Gamepad2, href: "/student/game" },
      { id: "settings" as const, label: t("navSettings"), icon: Settings, href: "/dashboard" },
    ],
    [t],
  );

  const go = (href: string) => {
    router.push(href);
    setSidebarOpen(false);
  };

  const isPrimaryActive = (id: StudentShellSection) => activeSection === id;

  return (
    <div className="flex h-screen overflow-hidden df-page-mesh">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={`fixed lg:relative z-30 flex flex-col h-full w-64 bg-[#00305E]/95 backdrop-blur-md border-r border-white/10 text-white transition-transform duration-300 shadow-xl shadow-black/10
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        <div className="flex items-center gap-3 px-6 py-6 border-b border-white/10">
          <div className="w-9 h-9 rounded-[10px] bg-[#FFCE00] flex items-center justify-center flex-shrink-0">
            <span className="text-[#00305E] font-extrabold text-lg leading-none">D</span>
          </div>
          <span className="font-bold text-xl tracking-tight">DeutschFlow</span>
          <button type="button" className="ml-auto lg:hidden text-white/60 hover:text-white" onClick={() => setSidebarOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto custom-scrollbar">
          {navItems.map(({ id, label, icon: Icon, href }) => (
            <button
              key={id}
              type="button"
              onClick={() => go(href)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-[12px] transition-all duration-200 text-left group
                ${
                  isPrimaryActive(id)
                    ? "bg-[#FFCE00] text-[#00305E] shadow-md"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
            >
              <Icon size={19} className="flex-shrink-0" />
              <div className="flex-1 flex items-center justify-between min-w-0">
                <span className="font-medium text-sm truncate">{label}</span>
                {id === "speaking" && (
                  <span className="text-[10px] font-bold bg-[#22D3EE]/20 text-[#22D3EE] px-1.5 py-0.5 rounded-full border border-[#22D3EE]/30 ml-2 flex-shrink-0">
                    AI
                  </span>
                )}
                {id === "roadmap" && (
                  <span className="text-[10px] font-bold bg-[#FFCE00]/20 text-[#FFCE00] px-1.5 py-0.5 rounded-full border border-[#FFCE00]/30 ml-2 flex-shrink-0">
                    {t("newBadge")}
                  </span>
                )}
                {isPrimaryActive(id) && <ChevronRight size={14} className="text-[#00305E]/60 ml-2" />}
              </div>
            </button>
          ))}
        </nav>

        <div className="px-3 pb-6">
          <button
            type="button"
            onClick={onLogout}
            className="mb-2 w-full flex items-center gap-3 px-4 py-3 rounded-[12px] text-white/70 hover:bg-white/10 hover:text-white transition-all duration-200 text-left"
          >
            <LogOut size={19} className="flex-shrink-0" />
            <span className="font-medium text-sm">{t("logout")}</span>
          </button>

          <div className="flex items-center gap-3 px-4 py-3 rounded-[12px] bg-white/8 border border-white/10">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#FFCE00] to-[#E6B900] flex items-center justify-center flex-shrink-0">
              <span className="text-[#00305E] font-bold text-sm">{initials}</span>
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm text-white truncate">{user.displayName}</p>
              <p className="text-white/50 text-[10px] truncate">{t("roleLevel", { role: user.role, level: targetLevel })}</p>
            </div>
          </div>

          {user.role === "ADMIN" && (
            <button
              type="button"
              onClick={() => go("/admin")}
              className="mt-2 w-full flex items-center gap-2 px-4 py-2 rounded-[10px] text-white/40 hover:text-white/70 hover:bg-white/8 transition-colors text-xs"
            >
              <ShieldCheck size={13} />
              {t("navAdminDashboard")}
            </button>
          )}
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        {!hideAppHeader && (
          <header className="df-header-shadow flex flex-shrink-0 items-center justify-between border-b border-[#E2E8F0] bg-white px-6 py-4">
            <div className="flex items-center gap-4 min-w-0">
              <button type="button" className="lg:hidden p-2 rounded-[10px] hover:bg-[#F5F7FA] text-[#64748B]" onClick={() => setSidebarOpen(true)}>
                <Menu size={20} />
              </button>
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-[#1A1A1A] truncate">{headerTitle}</h1>
                {headerSubtitle && <p className="text-[#64748B] text-sm mt-0.5 truncate">{headerSubtitle}</p>}
              </div>
            </div>

            <div className="flex items-center gap-3 flex-shrink-0">
              {headerRight}
              <div className="flex items-center gap-2 bg-[#FFF8E1] border border-[#FFCE00]/40 rounded-[12px] px-3 py-2">
                <Flame size={18} className="text-orange-500" fill="#f97316" />
                <span className="font-bold text-[#00305E] text-sm">{t("streakDays", { n: streakDays })}</span>
                <span className="text-[#64748B] text-xs hidden sm:inline">{t("streakBadgeShort")}</span>
              </div>
              <NotificationBell buttonClassName="p-2.5 rounded-[12px] bg-[#F5F7FA] hover:bg-[#E2E8F0] transition-colors" />
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#00305E] to-[#004080] flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-sm">{initials}</span>
              </div>
            </div>
          </header>
        )}

        <main
          className={cn(
            hideAppHeader
              ? "flex h-full min-h-0 flex-1 flex-col overflow-hidden p-0"
              : [
                  "flex-1 overflow-y-auto px-4 sm:px-6 py-6",
                  showMobileBottomPad && "pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] lg:pb-6",
                  !showMobileBottomPad && "pb-6",
                ],
          )}
        >
          {children}
        </main>
      </div>

      <StudentBottomNav onOpenMenu={() => setSidebarOpen(true)} />
    </div>
  );
}
