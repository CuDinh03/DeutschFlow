"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { CYAN, PURPLE, glass } from "./types";

/** Ladder used for Speaking UI (subset of backend A1–C2). */
const CEFR_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

function bandIdx(b: string | null | undefined): number {
  if (!b || typeof b !== "string") return 0;
  const i = CEFR_ORDER.indexOf(b.trim().toUpperCase() as (typeof CEFR_ORDER)[number]);
  return i < 0 ? 0 : i;
}

function normalizeBandFromProfile(current: string | null | undefined, fallback: string): string {
  const c = (current ?? "").trim().toUpperCase();
  if (c === "A0" || c === "") return "A1";
  const idx = CEFR_ORDER.indexOf(c as (typeof CEFR_ORDER)[number]);
  return idx >= 0 ? CEFR_ORDER[idx] : fallback;
}

const SUGGESTED_TOPICS = [
  { id: "Alltag",   emoji: "🏠", labelKey: "topicAlltag",   descKey: "topicAlltagDesc"   },
  { id: "Reise",    emoji: "✈️", labelKey: "topicReise",    descKey: "topicReiseDesc"    },
  { id: "Beruf",    emoji: "💼", labelKey: "topicBeruf",    descKey: "topicBerufDesc"    },
  { id: "Freizeit", emoji: "🎮", labelKey: "topicFreizeit", descKey: "topicFreizeitDesc" },
  { id: "Essen",    emoji: "🍽️", labelKey: "topicEssen",    descKey: "topicEssenDesc"    },
  { id: "Familie",  emoji: "👨‍👩‍👧", labelKey: "topicFamilie",  descKey: "topicFamilieDesc"  },
] as const;

const CEFR_LEVELS = [
  { id: "A1", emoji: "🌱", color: "#4ade80", desc: "cefrA1Desc" },
  { id: "A2", emoji: "🌿", color: "#22d3ee", desc: "cefrA2Desc" },
  { id: "B1", emoji: "🌟", color: "#a78bfa", desc: "cefrB1Desc" },
  { id: "B2", emoji: "🚀", color: "#f59e0b", desc: "cefrB2Desc" },
  { id: "C1", emoji: "🎓", color: "#f472b6", desc: "cefrC1Desc" },
  { id: "C2", emoji: "👑", color: "#eab308", desc: "cefrC2Desc" },
] as const;

interface WelcomeScreenProps {
  onStart: (topic?: string, cefrLevel?: string) => void;
  isStarting: boolean;
  /** Pre-filled from dashboard / adaptive deeplink (?topic=&cefr=) */
  initialTopic?: string | null;
  initialCefr?: string | null;
  /** From GET /plan/me → plan.currentLevel — practice floor */
  planCurrentLevel?: string | null;
  /** From GET /plan/me → plan.targetLevel — max selectable band */
  planTargetLevel?: string | null;
}

export function WelcomeScreen({
  onStart,
  isStarting,
  initialTopic,
  initialCefr,
  planCurrentLevel,
  planTargetLevel,
}: WelcomeScreenProps) {
  const t = useTranslations("speaking");
  const topicFromLink = (initialTopic ?? "").trim();
  const presetMatch = SUGGESTED_TOPICS.find((s) => s.id === topicFromLink);

  const { floorBand, ceilBand } = useMemo(() => {
    const floor = normalizeBandFromProfile(planCurrentLevel, "A1");
    const rawTarget = (planTargetLevel ?? "").trim().toUpperCase();
    const ceilRaw = CEFR_ORDER.includes(rawTarget as (typeof CEFR_ORDER)[number]) ? rawTarget : floor;
    let fi = bandIdx(floor);
    let ci = bandIdx(ceilRaw);
    if (ci < fi) ci = fi;
    return { floorBand: CEFR_ORDER[fi], ceilBand: CEFR_ORDER[ci] };
  }, [planCurrentLevel, planTargetLevel]);

  const pickAllowedCefr = useMemo(() => {
    const deeplink = (initialCefr ?? "").trim().toUpperCase();
    const inLadder =
      deeplink &&
      CEFR_ORDER.includes(deeplink as (typeof CEFR_ORDER)[number]) &&
      bandIdx(deeplink) >= bandIdx(floorBand) &&
      bandIdx(deeplink) <= bandIdx(ceilBand)
        ? deeplink
        : null;
    return inLadder ?? floorBand;
  }, [initialCefr, floorBand, ceilBand]);

  const [selected, setSelected]   = useState<string | null>(presetMatch ? presetMatch.id : null);
  const [custom, setCustom]       = useState(presetMatch ? "" : topicFromLink);
  const [cefrLevel, setCefrLevel] = useState<string>(pickAllowedCefr);

  useEffect(() => {
    setCefrLevel(pickAllowedCefr);
  }, [pickAllowedCefr]);

  const selectableLevels = CEFR_LEVELS.filter(
    (lvl) =>
      bandIdx(lvl.id) >= bandIdx(floorBand) && bandIdx(lvl.id) <= bandIdx(ceilBand),
  );

  return (
    <div className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-4"
      style={{ scrollbarWidth: "none" }}>
      {planCurrentLevel || planTargetLevel ? (
        <p className="text-[11px] leading-snug px-1 rounded-[10px] py-2" style={{ color: "rgba(255,255,255,0.45)", background: "rgba(255,255,255,0.05)" }}>
          {t("levelRangeHint", { floor: floorBand, ceil: ceilBand })}
        </p>
      ) : null}

      {/* Hero */}
      <div className="rounded-[20px] p-5 relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, rgba(34,211,238,0.15), rgba(167,139,250,0.15))`, border: `1px solid rgba(34,211,238,0.2)` }}>
        <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full"
          style={{ background: `radial-gradient(circle, rgba(34,211,238,0.2) 0%, transparent 70%)`, filter: "blur(20px)" }} />
        <div className="relative z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mb-3"
            style={{ background: `${CYAN}20`, border: `1px solid ${CYAN}40`, color: CYAN }}>
            ✨ {t("welcomeBadge")}
          </div>
          <h2 className="text-white font-extrabold text-xl mb-1">{t("welcomeTitle")}</h2>
          <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>
            {t("welcomeSubtitle")}
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            {[t("tagInstantCorrection"), t("tagGrammarTips"), t("tagNaturalChat")].map((label) => (
              <span key={label} className="text-[11px] px-2.5 py-1 rounded-full"
                style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.1)" }}>
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* CEFR Level selector */}
      <div className="rounded-[20px] p-4" style={glass}>
        <p className="text-xs font-semibold mb-3" style={{ color: "rgba(255,255,255,0.5)" }}>{t("chooseLevel")}</p>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {CEFR_LEVELS.map(({ id, emoji, color, desc }) => {
            const enabled = selectableLevels.some((s) => s.id === id);
            return (
            <button
              key={id}
              type="button"
              disabled={!enabled}
              onClick={() => enabled && setCefrLevel(id)}
              className="flex flex-col items-center gap-1.5 p-3 rounded-[14px] transition-all disabled:opacity-35 disabled:pointer-events-none"
              style={{
                background: cefrLevel === id ? `${color}20` : "rgba(255,255,255,0.05)",
                border: cefrLevel === id ? `1px solid ${color}60` : "1px solid rgba(255,255,255,0.08)",
              }}>
              <span className="text-lg">{emoji}</span>
              <span className="text-xs font-extrabold" style={{ color: cefrLevel === id ? color : "rgba(255,255,255,0.7)" }}>{id}</span>
              <span className="text-[9px] leading-tight text-center" style={{ color: "rgba(255,255,255,0.35)" }}>{t(desc)}</span>
            </button>
            );
          })}
        </div>
      </div>

      {/* Topic grid */}
      <div className="rounded-[20px] p-4" style={glass}>
        <p className="text-xs font-semibold mb-3" style={{ color: "rgba(255,255,255,0.5)" }}>{t("chooseTopic")}</p>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {SUGGESTED_TOPICS.map(({ id, emoji, labelKey, descKey }) => (
            <button key={id} onClick={() => { setSelected(id); setCustom(""); }}
              className="flex flex-col items-center gap-1 p-3 rounded-[14px] transition-all"
              style={{
                background: selected === id && !custom ? `${CYAN}15` : "rgba(255,255,255,0.05)",
                border: selected === id && !custom ? `1px solid ${CYAN}50` : "1px solid rgba(255,255,255,0.08)",
              }}>
              <span className="text-xl">{emoji}</span>
              <span className="text-[11px] font-semibold" style={{ color: selected === id && !custom ? CYAN : "rgba(255,255,255,0.8)" }}>{t(labelKey)}</span>
              <span className="text-[9px]" style={{ color: "rgba(255,255,255,0.35)" }}>{t(descKey)}</span>
            </button>
          ))}
        </div>
        <div className="relative">
          <input type="text" value={custom}
            onChange={(e) => { setCustom(e.target.value); if (e.target.value) setSelected(null); }}
            placeholder={t("customTopicPlaceholder")}
            className="w-full px-4 py-2.5 pr-8 rounded-[12px] text-sm outline-none"
            style={{
              background: "rgba(255,255,255,0.06)", border: `1px solid ${custom ? CYAN + "50" : "rgba(255,255,255,0.1)"}`,
              color: "rgba(255,255,255,0.9)", caretColor: CYAN,
            }} />
          {custom && (
            <button onClick={() => setCustom("")} className="absolute right-3 top-1/2 -translate-y-1/2"
              style={{ color: "rgba(255,255,255,0.4)" }}>
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Start button */}
      <motion.button
        onClick={() => onStart(custom.trim() || selected || undefined, cefrLevel)}
        disabled={isStarting}
        className="w-full flex items-center justify-center gap-2 py-4 rounded-[16px] font-bold text-sm"
        style={{
          background: isStarting ? "rgba(255,255,255,0.1)" : `linear-gradient(135deg, ${CYAN}, ${PURPLE})`,
          color: "white",
          boxShadow: isStarting ? "none" : `0 5px 0 0 rgba(0,0,0,0.3), 0 8px 24px rgba(34,211,238,0.3)`,
          opacity: isStarting ? 0.7 : 1,
        }}
        whileHover={!isStarting ? { scale: 1.02 } : {}}
        whileTap={!isStarting ? { scale: 0.97 } : {}}
      >
        {isStarting ? (
          <>
            <motion.div className="w-4 h-4 rounded-full border-2"
              style={{ borderColor: "rgba(255,255,255,0.3)", borderTopColor: "white" }}
              animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }} />
            {t("starting")}
          </>
        ) : (
          <>
            <Plus size={18} />
            {t("newSession")}
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
              style={{ background: "rgba(0,0,0,0.25)" }}>
              {cefrLevel}
            </span>
            {(selected || custom) && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                style={{ background: "rgba(0,0,0,0.25)" }}>
                {custom || selected}
              </span>
            )}
          </>
        )}
      </motion.button>
    </div>
  );
}
