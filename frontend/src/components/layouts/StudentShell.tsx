"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { StudentBottomNav } from "@/components/layouts/StudentBottomNav";
import { cn } from "@/lib/utils";
import { isStudentImmersivePath } from "@/lib/studentImmersiveRoutes";
import type { LucideIcon } from "lucide-react";
import { DeutschFlowLogo } from "@/components/ui/DeutschFlowLogo";
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
  LogOut,
  Repeat2,
  AlertTriangle,
  Calendar,
  History,
  Users,
  Trophy,
  BarChart2,
  Brain,
  Briefcase,
} from "lucide-react";
import { XpLevelPill } from "@/components/gamification/XpLevelPill";

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
  | "exerciseHistory"
  | "tutor"
  | "webDashboard"
  | "speakingHistory"
  | "interviews"
  | "review-queue"
  | "vocab-analytics"
  | "leaderboard"
  | "grammar-practice"
  | "curriculum"
  | "review";

type NavItem = {
  id: StudentShellSection;
  label: string;
  icon: LucideIcon;
  href: string;
  badge?: ReactNode;
};

type NavGroup = {
  groupKey: string;
  label: string;
  items: NavItem[];
};

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
  /** Hide bottom tab bar (e.g. immersive interview session) */
  hideBottomNav?: boolean;
  /** Hide sidebar completely (e.g. for Onboarding wizard) */
  hideSidebar?: boolean;
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
  hideBottomNav,
  hideSidebar,
  children,
}: Props) {
  const t = useTranslations("student");
  const router = useRouter();
  const pathname = usePathname();
  const showMobileBottomPad = !isStudentImmersivePath(pathname) && !hideBottomNav;
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navGroups = useMemo<NavGroup[]>(
    () => [
      {
        groupKey: "learn",
        label: t("navGroupLearn"),
        items: [
          { id: "dashboard" as const, label: t("navDashboard"), icon: LayoutDashboard, href: "/dashboard" },
          { id: "courses" as const, label: t("navMyCourses"), icon: BookOpen, href: "/student/plan" },
          { id: "roadmap" as const, label: t("navLearningPath"), icon: Map, href: "/student/roadmap",
            badge: <span className="text-[9px] font-bold bg-[#FFCD00]/20 text-[#FFCD00] px-1.5 py-0.5 rounded-full border border-[#FFCD00]/30">{t("newBadge")}</span> },
          { id: "vocabulary" as const, label: t("navVocabulary"), icon: BookMarked, href: "/student/vocabulary" },
          { id: "vocab-analytics" as const, label: "Thống kê từ vựng", icon: BarChart2 as any, href: "/student/vocab-analytics" },
          { id: "grammar-practice" as const, label: "Luyện ngữ pháp AI", icon: Brain, href: "/student/grammar-practice" },
          { id: "curriculum" as const, label: "Giáo trình A1", icon: BookOpen, href: "/student/curriculum" },
        ],
      },
      {
        groupKey: "practice",
        label: t("navGroupPractice"),
        items: [
          { id: "speaking" as const, label: t("navSpeaking"), icon: Mic2, href: "/speaking",
            badge: <span className="text-[9px] font-bold bg-[#22D3EE]/20 text-[#22D3EE] px-1.5 py-0.5 rounded-full border border-[#22D3EE]/30">AI</span> },
          { id: "swipe" as const, label: t("navSwipeLearn"), icon: Repeat2, href: "/student/swipe-cards" },
          { id: "game" as const, label: t("navLegoGame"), icon: Gamepad2, href: "/student/game" },
          { id: "weeklySpeaking" as const, label: t("navWeeklySpeaking"), icon: Calendar, href: "/student/weekly-speaking" },
        ],
      },
      {
        groupKey: "review",
        label: t("navGroupReview"),
        items: [
          { id: "errors" as const, label: t("navMyErrors"), icon: AlertTriangle, href: "/student/errors" },
          {
            id: "review" as const,
            label: "📚 Ôn tập SRS",
            icon: Brain,
            href: "/student/review",
            badge: <span className="text-[9px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-full">Ôn</span>,
          },
          { id: "review-queue" as const, label: "Ôn tập hôm nay", icon: Brain, href: "/student/review-queue" },
          { id: "speakingHistory" as const, label: t("navSpeakingHistory"), icon: History, href: "/student/speaking-history" },
          { id: "interviews" as const, label: "Kết quả phỏng vấn", icon: Briefcase, href: "/student/interviews" },
        ],
      },
      {
        groupKey: "profile",
        label: t("navGroupProfile"),
        items: [
          { id: "tutor" as const, label: t("navTutorProfile"), icon: Users, href: "/student/tutor" },
          { id: "leaderboard" as const, label: "Bảng xếp hạng", icon: Trophy, href: "/student/leaderboard" },
          { id: "settings" as const, label: t("navSettings"), icon: Settings, href: "/dashboard" },
        ],
      },
    ],
    [t],
  );

  const go = (href: string) => {
    router.push(href);
    setSidebarOpen(false);
  };

  return (
    <div className="flex h-screen overflow-hidden df-page-mesh">
      {!hideSidebar && sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {!hideSidebar && (
        <aside
          className={`fixed lg:relative z-30 flex flex-col h-full w-64 bg-[var(--brand-black)] backdrop-blur-md border-r border-white/10 text-[var(--sidebar-foreground)] transition-transform duration-300 shadow-xl shadow-black/10
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
        >
          <div className="flex items-center gap-2 px-4 py-5 border-b border-white/10">
            <DeutschFlowLogo
              variant="horizontal"
              size={160}
              animated={false}
            />
            <button type="button" className="ml-auto lg:hidden text-white/60 hover:text-white" onClick={() => setSidebarOpen(false)}>
              <X size={20} />
            </button>
          </div>

          <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto custom-scrollbar">
            {navGroups.map(({ groupKey, label, items }) => (
              <div key={groupKey}>
                {/* Section header */}
                <p className="px-4 mb-1.5 text-[10px] font-bold tracking-widest text-white/30 uppercase select-none">
                  {label}
                </p>
                <div className="space-y-0.5">
                  {items.map(({ id, label: itemLabel, icon: Icon, href, badge }) => {
                    const active = activeSection === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => go(href)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-[12px] transition-all duration-200 text-left group
                          ${active
                            ? "bg-[var(--brand-yellow)] text-[var(--brand-black)] shadow-md"
                            : "text-white/70 hover:bg-white/10 hover:text-white"
                          }`}
                      >
                        <Icon size={17} className="flex-shrink-0" />
                        <div className="flex-1 flex items-center justify-between min-w-0">
                          <span className="font-medium text-sm truncate">{itemLabel}</span>
                          {badge && !active && badge}
                          {active && <ChevronRight size={13} className="text-[var(--brand-black)]/60 ml-2" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className="px-3 pb-5">
            <button
              type="button"
              onClick={onLogout}
              className="mb-2 w-full flex items-center gap-3 px-4 py-2.5 rounded-[12px] text-white/70 hover:bg-white/10 hover:text-white transition-all duration-200 text-left"
            >
              <LogOut size={17} className="flex-shrink-0" />
              <span className="font-medium text-sm">{t("logout")}</span>
            </button>

            <div className="flex items-center gap-3 px-4 py-3 rounded-[12px] bg-white/8 border border-white/10">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[var(--brand-yellow)] to-[var(--brand-yellow-dark)] flex items-center justify-center flex-shrink-0">
                <span className="text-[var(--brand-black)] font-bold text-sm">{initials}</span>
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
      )}

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
              <XpLevelPill />
              <div className="flex items-center gap-2 bg-[#FFF8E1] border border-[#FFCD00]/40 rounded-[12px] px-3 py-2">

                <Flame size={18} className="text-orange-500" fill="#f97316" />
                <span className="font-bold text-[var(--brand-black)] text-sm">{t("streakDays", { n: streakDays })}</span>
                <span className="text-[#64748B] text-xs hidden sm:inline">{t("streakBadgeShort")}</span>
              </div>
              <NotificationBell buttonClassName="p-2.5 rounded-[12px] bg-[#F5F7FA] hover:bg-[#E2E8F0] transition-colors" />
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[var(--brand-black)] to-[var(--brand-black-dark)] flex items-center justify-center flex-shrink-0">
                <span className="text-[var(--brand-yellow)] font-bold text-sm">{initials}</span>
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

      {!hideBottomNav && <StudentBottomNav onOpenMenu={() => setSidebarOpen(true)} />}
    </div>
  );
}
