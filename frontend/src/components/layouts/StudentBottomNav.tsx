"use client";

import { useRouter, usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { spring } from "@/lib/motion";
import { useTranslations } from "next-intl";
import { LayoutDashboard, Map, Menu, Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import { isStudentImmersivePath } from "@/lib/studentImmersiveRoutes";
import { useTracking } from "@/hooks/useTracking";
import { lightImpact } from "@/lib/haptics";

type Item = { href: string; id: string; icon: typeof LayoutDashboard };

export function StudentBottomNav({
  onOpenMenu,
  className,
  minimized = false,
}: {
  /** Opens full sidebar on mobile (same nav as desktop). */
  onOpenMenu: () => void;
  className?: string;
  /** Collapse to an icons-only slim bar (e.g. while scrolling content down). */
  minimized?: boolean;
}) {
  const t = useTranslations("student");
  const router = useRouter();
  const pathname = usePathname();
  const { trackEvent } = useTracking();

  if (isStudentImmersivePath(pathname)) return null;

  const items: Item[] = [
    { href: "/dashboard", id: "dash", icon: LayoutDashboard },
    { href: "/speaking", id: "speak", icon: Mic },
    { href: "/roadmap", id: "road", icon: Map },
  ];

  // Static export (Capacitor) uses trailingSlash, so usePathname() returns
  // e.g. "/dashboard/". Normalize before matching, otherwise exact-match tabs
  // (Dashboard) never light up.
  const path = pathname.replace(/\/+$/, "") || "/";
  const isActive = (href: string) =>
    href === "/dashboard" ? path === "/dashboard" : path === href || path.startsWith(`${href}/`);

  return (
    <nav
      className={cn(
        // Positioning + size handled by .df-bottom-nav (CSS), giving us the
        // floating Liquid Glass pill above the safe area instead of a full-
        // width bar pinned to the edge.
        "df-bottom-nav lg:hidden z-40 flex items-center justify-around px-2",
        className,
      )}
      aria-label={t("bottomNavAria")}
      style={{ height: minimized ? 50 : 64, transition: "height .32s cubic-bezier(.4,0,.2,1)" }}
    >
      {items.map(({ href, id, icon: Icon }) => {
        const active = isActive(href);
        return (
          <button
            key={id}
            type="button"
            data-ph-capture="true"
            data-ph-feature={id}
            onClick={() => {
              lightImpact()
              trackEvent('nav_clicked', { feature: id, from: pathname })
              router.push(href)
            }}
            className={cn(
              "relative flex h-full min-h-0 flex-1 flex-col items-center justify-center gap-1 transition-colors",
              active ? "text-[var(--brand-black)]" : "text-[#94A3B8]",
            )}
          >
            <span className="relative flex h-8 w-12 items-center justify-center">
              {active && (
                <motion.span
                  layoutId="bottomNavActive"
                  className="absolute inset-0 rounded-full bg-[var(--brand-yellow)]"
                  transition={spring.nav}
                />
              )}
              <Icon
                size={18}
                strokeWidth={active ? 2.5 : 2}
                className="relative z-10"
                style={{ color: active ? "var(--brand-black)" : "#94A3B8" }}
              />
            </span>
            <span
              className="text-[10px] font-bold leading-none"
              style={{
                maxHeight: minimized ? 0 : 16,
                opacity: minimized ? 0 : 1,
                overflow: "hidden",
                transition: "max-height .28s ease, opacity .18s ease",
              }}
            >
              {id === "dash" && t("bottomNavHome")}
              {id === "speak" && "Nói với AI"}
              {id === "road" && t("bottomNavPath")}
            </span>
          </button>
        );
      })}

      <button
        type="button"
        onClick={() => {
          lightImpact()
          onOpenMenu()
        }}
        className="flex h-full min-h-0 flex-1 flex-col items-center justify-center gap-1 text-[#94A3B8]"
      >
        <div className="flex h-8 w-10 items-center justify-center rounded-[12px]">
          <Menu size={18} strokeWidth={2} />
        </div>
        <span
          className="text-[10px] font-bold leading-none"
          style={{
            maxHeight: minimized ? 0 : 16,
            opacity: minimized ? 0 : 1,
            overflow: "hidden",
            transition: "max-height .28s ease, opacity .18s ease",
          }}
        >
          {t("bottomNavMore")}
        </span>
      </button>
    </nav>
  );
}
