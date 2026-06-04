import {
  LayoutDashboard,
  Map,
  Mic,
  Brain,
  Search,
  AlertTriangle,
  Trophy,
  Flame,
  type LucideIcon,
} from "lucide-react";

/**
 * A single feature entry shown in the new-user guide. Visual metadata lives
 * here; all user-facing copy is resolved from the `guide` i18n namespace using
 * `key`, so the same entry powers both the tour and the help page in any locale.
 */
export interface GuideEntry {
  /** i18n key under `guide.features.<key>` (title / desc / how). */
  key: string;
  icon: LucideIcon;
  /** Accent colour (hex) used for the icon chip and step highlight. */
  accent: string;
  /** Destination when the user taps "open" on the help page. */
  href: string;
}

/**
 * Concise sequence shown in the one-time welcome tour. Ordered as the most
 * useful "what to do next" path for a brand-new learner.
 */
export const TOUR_STEPS: readonly GuideEntry[] = [
  { key: "roadmap", icon: Map, accent: "#121212", href: "/roadmap" },
  { key: "speaking", icon: Mic, accent: "#E5A100", href: "/speaking" },
  { key: "review", icon: Brain, accent: "#8B5CF6", href: "/student/review" },
  { key: "dashboard", icon: LayoutDashboard, accent: "#10B981", href: "/dashboard" },
] as const;

/**
 * Full feature catalogue shown on the always-available help page.
 */
export const GUIDE_FEATURES: readonly GuideEntry[] = [
  { key: "dashboard", icon: LayoutDashboard, accent: "#10B981", href: "/dashboard" },
  { key: "roadmap", icon: Map, accent: "#121212", href: "/roadmap" },
  { key: "speaking", icon: Mic, accent: "#E5A100", href: "/speaking" },
  { key: "review", icon: Brain, accent: "#8B5CF6", href: "/student/review" },
  { key: "vocabulary", icon: Search, accent: "#0EA5E9", href: "/vocabulary" },
  { key: "errors", icon: AlertTriangle, accent: "#F59E0B", href: "/student/errors" },
  { key: "mockExam", icon: Trophy, accent: "#EF4444", href: "/student/mock-exam" },
  { key: "streak", icon: Flame, accent: "#F97316", href: "/dashboard" },
] as const;
