import { useNavigate, useLocation } from "react-router";
import { motion } from "motion/react";
import { LayoutDashboard, BookOpen, Mic, Layers, Map } from "lucide-react";

const NAV = [
  { path: "/", label: "Home", icon: LayoutDashboard },
  { path: "/lesson", label: "Lernen", icon: BookOpen },
  { path: "/speaking", label: "Sprechen", icon: Mic },
  { path: "/swipe", label: "Karten", icon: Layers },
  { path: "/roadmap", label: "Pfad", icon: Map },
];

export function BottomNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex items-end justify-around bg-white px-1"
      style={{
        height: 64,
        borderTop: "1px solid #E2E8F0",
        boxShadow: "0 -4px 24px rgba(0,48,94,0.09)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      {NAV.map(({ path, label, icon: Icon }) => {
        const active = pathname === path;
        return (
          <button
            key={path}
            onClick={() => navigate(path)}
            className="relative flex flex-col items-center justify-center gap-1 h-full flex-1 transition-all"
          >
            <motion.div
              className="relative flex items-center justify-center rounded-[12px]"
              style={{ width: 40, height: 32 }}
              animate={{
                background: active ? "#00305E" : "rgba(0,0,0,0)",
                scale: active ? 1.05 : 1,
              }}
              transition={{ type: "spring", stiffness: 320, damping: 24 }}
            >
              {active && (
                <motion.div
                  layoutId="nav-pill"
                  className="absolute inset-0 rounded-[12px]"
                  style={{ background: "#00305E" }}
                  transition={{ type: "spring", stiffness: 320, damping: 28 }}
                />
              )}
              <Icon
                size={18}
                className="relative z-10"
                style={{ color: active ? "#FFCE00" : "#94A3B8" }}
                strokeWidth={active ? 2.5 : 2}
              />
            </motion.div>
            <span
              className="text-[10px] font-bold leading-none"
              style={{ color: active ? "#00305E" : "#94A3B8" }}
            >
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}