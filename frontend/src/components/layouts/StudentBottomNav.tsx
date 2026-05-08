"use client";

import { useRouter, usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { LayoutDashboard, Map, Mic2, BookOpen, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { isStudentImmersivePath } from "@/lib/studentImmersiveRoutes";

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

  if (isStudentImmersivePath(pathname)) return null;

  const items: Item[] = [
    { href: "/dashboard", id: "dash", icon: LayoutDashboard },
    { href: "/student/roadmap", id: "road", icon: Map },
    { href: "/speaking", id: "speak", icon: Mic2 },
    { href: "/student/plan", id: "plan", icon: BookOpen },
  ];

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav
      className={cn(
        "df-bottom-nav lg:hidden fixed bottom-0 left-0 right-0 z-40 flex items-end justify-around px-1 pt-1",
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
            onClick={() => router.push(href)}
            className={cn(
              "relative flex h-full min-h-0 flex-1 flex-col items-center justify-center gap-1 transition-colors",
              active ? "text-[var(--brand-black)]" : "text-[#94A3B8]",
            )}
          >
            <motion.div
              className="relative flex h-8 w-10 items-center justify-center rounded-[12px]"
              animate={{
                background: active ? "var(--brand-black)" : "rgba(0,0,0,0)",
                scale: active ? 1.05 : 1,
              }}
              transition={{ type: "spring", stiffness: 320, damping: 24 }}
            >
              <Icon
                size={18}
                strokeWidth={active ? 2.5 : 2}
                className="relative z-10"
                style={{ color: active ? "#FFCD00" : "#94A3B8" }}
              />
            </motion.div>
            <span className="text-[10px] font-bold leading-none">
              {id === "dash" && t("bottomNavHome")}
              {id === "road" && t("bottomNavPath")}
              {id === "speak" && t("bottomNavSpeak")}
              {id === "plan" && t("bottomNavPlan")}
            </span>
          </button>
        );
      })}

      <button
        type="button"
        onClick={onOpenMenu}
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
