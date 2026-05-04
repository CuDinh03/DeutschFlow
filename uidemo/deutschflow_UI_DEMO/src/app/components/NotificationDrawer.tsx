import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X, Flame, Trophy, BookOpen, Zap, Target, Sparkles,
  Bot, Check, CheckCheck, Trash2,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type NotifType = "streak" | "achievement" | "lesson" | "xp" | "goal" | "ai";

interface Notif {
  id: string;
  type: NotifType;
  title: string;
  body: string;
  time: string;
  read: boolean;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const INITIAL: Notif[] = [
  {
    id: "n1",
    type: "streak",
    title: "🔥 Streak in Gefahr!",
    body: "Du hast heute noch nicht gelernt. Halte deinen 14-Tage-Streak aufrecht!",
    time: "Vor 5 Min.",
    read: false,
  },
  {
    id: "n2",
    type: "achievement",
    title: "🏆 Neues Achievement!",
    body: 'Du hast "Grammatik-Meister" freigeschaltet. +500 Bonus-XP gutgeschrieben.',
    time: "Vor 1 Std.",
    read: false,
  },
  {
    id: "n3",
    type: "xp",
    title: "⚡ 1.000 XP Meilenstein",
    body: "Glückwunsch! Du hast 1.000 XP erreicht und Level A2 offiziell abgeschlossen.",
    time: "Vor 2 Std.",
    read: false,
  },
  {
    id: "n4",
    type: "lesson",
    title: "📚 Neues Kapitel verfügbar",
    body: "Kapitel 5 'Business Deutsch' ist jetzt freigeschaltet. Starte noch heute!",
    time: "Vor 4 Std.",
    read: true,
  },
  {
    id: "n5",
    type: "goal",
    title: "🎯 Tagesziel fast erreicht",
    body: "Noch 2 Vokabeln bis zum heutigen Ziel. Du schaffst das!",
    time: "Gestern",
    read: true,
  },
  {
    id: "n6",
    type: "ai",
    title: "🤖 KI-Tipp des Tages",
    body: "Fokus heute: der/die/das-Regeln. 73 % der Lernenden machen hier die meisten Fehler.",
    time: "Gestern",
    read: true,
  },
  {
    id: "n7",
    type: "achievement",
    title: "🌟 7-Tage-Streak!",
    body: "Eine ganze Woche am Stück gelernt. Dein Lernrhythmus ist beeindruckend!",
    time: "Vor 3 Tagen",
    read: true,
  },
];

// ─── Icon config ───────────────────────────────────────────────────────────────

const ICON_CFG: Record<NotifType, { icon: React.ElementType; color: string; bg: string }> = {
  streak:      { icon: Flame,    color: "#F97316", bg: "#FFF7ED" },
  achievement: { icon: Trophy,   color: "#FFCE00", bg: "#FFF8E1" },
  lesson:      { icon: BookOpen, color: "#2D9CDB", bg: "#EBF5FB" },
  xp:          { icon: Zap,      color: "#9B51E0", bg: "#F4EDFF" },
  goal:        { icon: Target,   color: "#27AE60", bg: "#E8F8F0" },
  ai:          { icon: Bot,      color: "#00305E", bg: "#EBF2FA" },
};

// ─── Single row ────────────────────────────────────────────────────────────────

function NotifRow({
  n,
  onRead,
  onDelete,
}: {
  n: Notif;
  onRead: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const cfg = ICON_CFG[n.type];
  const Icon = cfg.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -24, height: 0, marginBottom: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 28 }}
      className="relative flex items-start gap-3 px-4 py-3.5 rounded-[16px]"
      style={{
        background: n.read ? "#FAFBFF" : "#FFFFFF",
        border: `1.5px solid ${n.read ? "#F0F4F8" : "#E2E8F0"}`,
        boxShadow: n.read ? "none" : "0 2px 12px rgba(0,48,94,0.07)",
      }}
    >
      {/* Unread dot */}
      {!n.read && (
        <motion.div
          className="absolute top-3 right-3 w-2 h-2 rounded-full"
          style={{ background: "#00305E" }}
          animate={{ scale: [1, 1.3, 1] }}
          transition={{ duration: 1.8, repeat: Infinity }}
        />
      )}

      {/* Icon */}
      <div
        className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center mt-0.5"
        style={{ background: cfg.bg }}
      >
        <Icon size={18} style={{ color: cfg.color }} />
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0 pr-5">
        <p
          className="text-sm leading-snug mb-0.5"
          style={{ color: "#0F172A", fontWeight: n.read ? 500 : 700 }}
        >
          {n.title}
        </p>
        <p className="text-xs leading-relaxed" style={{ color: "#64748B" }}>
          {n.body}
        </p>
        <p className="text-[10px] font-semibold mt-1.5" style={{ color: "#94A3B8" }}>
          {n.time}
        </p>
      </div>

      {/* Action buttons */}
      <div className="absolute bottom-2.5 right-3 flex items-center gap-1">
        {!n.read && (
          <button
            onClick={() => onRead(n.id)}
            className="w-6 h-6 flex items-center justify-center rounded-full"
            style={{ background: "#EBF2FA" }}
            title="Als gelesen markieren"
          >
            <Check size={11} style={{ color: "#00305E" }} />
          </button>
        )}
        <button
          onClick={() => onDelete(n.id)}
          className="w-6 h-6 flex items-center justify-center rounded-full"
          style={{ background: "#FEF2F2" }}
          title="Löschen"
        >
          <Trash2 size={11} style={{ color: "#EB5757" }} />
        </button>
      </div>
    </motion.div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
}

export function NotificationDrawer({ open, onClose }: Props) {
  const [notifs, setNotifs] = useState<Notif[]>(INITIAL);
  const unread = notifs.filter((n) => !n.read).length;

  const markRead = (id: string) =>
    setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));

  const deleteNotif = (id: string) =>
    setNotifs((prev) => prev.filter((n) => n.id !== id));

  const markAll = () =>
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));

  const clearAll = () => setNotifs([]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-40"
            style={{ background: "rgba(0,0,0,0.35)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Drawer panel */}
          <motion.div
            className="fixed inset-x-0 top-0 z-50 flex flex-col"
            style={{
              maxWidth: 430,
              margin: "0 auto",
              maxHeight: "88vh",
              background: "#F5F5F5",
              borderBottomLeftRadius: 28,
              borderBottomRightRadius: 28,
              boxShadow: "0 8px 40px rgba(0,48,94,0.22)",
              overflow: "hidden",
            }}
            initial={{ y: "-100%" }}
            animate={{ y: 0 }}
            exit={{ y: "-100%" }}
            transition={{ type: "spring", stiffness: 340, damping: 36 }}
          >
            {/* ── Header ──────────────────────────────────────────── */}
            <div
              className="px-5 pt-12 pb-4 flex-shrink-0"
              style={{
                background: "linear-gradient(135deg, #00305E 0%, #004898 100%)",
              }}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Sparkles size={18} style={{ color: "#FFCE00" }} />
                  <h2
                    className="font-extrabold text-lg"
                    style={{ color: "#FFFFFF" }}
                  >
                    Benachrichtigungen
                  </h2>
                  {unread > 0 && (
                    <motion.span
                      className="flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-black"
                      style={{ background: "#FFCE00", color: "#00305E" }}
                      key={unread}
                      initial={{ scale: 1.4 }}
                      animate={{ scale: 1 }}
                    >
                      {unread}
                    </motion.span>
                  )}
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 flex items-center justify-center rounded-full"
                  style={{ background: "rgba(255,255,255,0.15)" }}
                >
                  <X size={16} style={{ color: "#fff" }} />
                </button>
              </div>

              {/* Action row */}
              <div className="flex items-center gap-2 mt-3">
                {unread > 0 && (
                  <button
                    onClick={markAll}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold"
                    style={{ background: "rgba(255,255,255,0.15)", color: "#fff" }}
                  >
                    <CheckCheck size={13} />
                    Alle gelesen
                  </button>
                )}
                {notifs.length > 0 && (
                  <button
                    onClick={clearAll}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold"
                    style={{ background: "rgba(255,255,255,0.15)", color: "#fff" }}
                  >
                    <Trash2 size={13} />
                    Alle löschen
                  </button>
                )}
              </div>
            </div>

            {/* ── List ────────────────────────────────────────────── */}
            <div
              className="flex-1 overflow-y-auto px-4 py-4 space-y-2.5"
              style={{ overscrollBehavior: "contain" }}
            >
              <AnimatePresence mode="popLayout">
                {notifs.length === 0 ? (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center justify-center py-16 gap-4"
                  >
                    <div
                      className="w-20 h-20 rounded-full flex items-center justify-center"
                      style={{ background: "#EBF2FA" }}
                    >
                      <Sparkles size={36} style={{ color: "#00305E" }} />
                    </div>
                    <div className="text-center">
                      <p
                        className="font-bold mb-1"
                        style={{ color: "#0F172A" }}
                      >
                        Alles erledigt!
                      </p>
                      <p className="text-xs" style={{ color: "#94A3B8" }}>
                        Keine neuen Benachrichtigungen
                      </p>
                    </div>
                  </motion.div>
                ) : (
                  <>
                    {/* Unread group */}
                    {notifs.some((n) => !n.read) && (
                      <div>
                        <p
                          className="text-[10px] font-black uppercase tracking-widest px-1 mb-2"
                          style={{ color: "#94A3B8" }}
                        >
                          Neu · {unread}
                        </p>
                        <div className="space-y-2">
                          {notifs
                            .filter((n) => !n.read)
                            .map((n) => (
                              <NotifRow
                                key={n.id}
                                n={n}
                                onRead={markRead}
                                onDelete={deleteNotif}
                              />
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Read group */}
                    {notifs.some((n) => n.read) && (
                      <div className="mt-4">
                        <p
                          className="text-[10px] font-black uppercase tracking-widest px-1 mb-2"
                          style={{ color: "#94A3B8" }}
                        >
                          Früher
                        </p>
                        <div className="space-y-2">
                          {notifs
                            .filter((n) => n.read)
                            .map((n) => (
                              <NotifRow
                                key={n.id}
                                n={n}
                                onRead={markRead}
                                onDelete={deleteNotif}
                              />
                            ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </AnimatePresence>

              {/* bottom safe area */}
              <div className="h-4" />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}