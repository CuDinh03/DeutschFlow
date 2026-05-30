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
}: {
  /** Opens full sidebar on mobile (same nav as desktop). */
  onOpenMenu: () => void;
  className?: string;
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

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname === href || pathname.startsWith(`${href}/`);

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
            <motion.div
              className="relative flex h-8 w-10 items-center justify-center rounded-[var(--radius-md)]"
              animate={{
                background: active ? "var(--brand-black)" : "rgba(0,0,0,0)",
                scale: active ? 1.05 : 1,
              }}
              transition={spring.nav}
            >
              <Icon
                size={18}
                strokeWidth={active ? 2.5 : 2}
                className="relative z-10"
                style={{
                  color: active ? "#FFCD00" : "#94A3B8",
                  filter: active ? "drop-shadow(0 0 5px rgba(255,205,0,0.55))" : "none",
                  transition: "filter 0.2s ease",
                }}
              />
            </motion.div>
            <span className="text-[10px] font-bold leading-none">
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
        <span className="text-[10px] font-bold leading-none">{t("bottomNavMore")}</span>
      </button>
    </nav>
  );
}
