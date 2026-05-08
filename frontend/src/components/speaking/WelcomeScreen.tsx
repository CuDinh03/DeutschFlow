"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Plus, X, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { CYAN, PURPLE, SPEAKING_LIGHT, glassLight } from "./types";

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
  { id: "Alltag", emoji: "🏠", labelKey: "topicAlltag", descKey: "topicAlltagDesc" },
  { id: "Reise", emoji: "✈️", labelKey: "topicReise", descKey: "topicReiseDesc" },
  { id: "Beruf", emoji: "💼", labelKey: "topicBeruf", descKey: "topicBerufDesc" },
  { id: "Freizeit", emoji: "🎮", labelKey: "topicFreizeit", descKey: "topicFreizeitDesc" },
  { id: "Essen", emoji: "🍽️", labelKey: "topicEssen", descKey: "topicEssenDesc" },
  { id: "Familie", emoji: "👨‍👩‍👧", labelKey: "topicFamilie", descKey: "topicFamilieDesc" },
] as const;

import type { SpeakingPersonaId, SpeakingResponseSchemaId, SpeakingSessionMode } from "@/lib/aiSpeakingApi";

const SPEAKING_PERSONAS: ReadonlyArray<{
  id: SpeakingPersonaId;
  emoji: string;
  nameKey: string;
  descKey: string;
}> = [
  { id: "DEFAULT", emoji: "🎓", nameKey: "personaNameDefault", descKey: "personaDescDefault" },
  { id: "LUKAS", emoji: "💻", nameKey: "personaNameLukas", descKey: "personaDescLukas" },
  { id: "EMMA", emoji: "🌿", nameKey: "personaNameEmma", descKey: "personaDescEmma" },
  { id: "HANNA", emoji: "🍃", nameKey: "personaNameHanna", descKey: "personaDescHanna" },
  { id: "KLAUS", emoji: "👨‍🍳", nameKey: "personaNameKlaus", descKey: "personaDescKlaus" },
];

const CEFR_LEVELS = [
  { id: "A1", emoji: "🌱", color: "#4ade80", desc: "cefrA1Desc" },
  { id: "A2", emoji: "🌿", color: "#22d3ee", desc: "cefrA2Desc" },
  { id: "B1", emoji: "🌟", color: "#a78bfa", desc: "cefrB1Desc" },
  { id: "B2", emoji: "🚀", color: "#f59e0b", desc: "cefrB2Desc" },
  { id: "C1", emoji: "🎓", color: "#f472b6", desc: "cefrC1Desc" },
  { id: "C2", emoji: "👑", color: "#eab308", desc: "cefrC2Desc" },
] as const;

interface WelcomeScreenProps {
  onStart: (
    topic?: string,
    cefrLevel?: string,
    persona?: SpeakingPersonaId,
    responseSchema?: SpeakingResponseSchemaId,
    sessionMode?: SpeakingSessionMode,
  ) => void;
  isStarting: boolean;
  initialTopic?: string | null;
  initialCefr?: string | null;
  initialSessionMode?: SpeakingSessionMode | null;
  planCurrentLevel?: string | null;
  planTargetLevel?: string | null;
  industry?: string | null;
}

export function WelcomeScreen({
  onStart,
  isStarting,
  initialTopic,
  initialCefr,
  initialSessionMode,
  planCurrentLevel,
  planTargetLevel,
  industry,
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

  const [wizardStep, setWizardStep] = useState<1 | 2>(1);

  const [selected, setSelected] = useState<string | null>(presetMatch ? presetMatch.id : null);
  const [custom, setCustom] = useState(presetMatch ? "" : topicFromLink);
  const [cefrLevel, setCefrLevel] = useState<string>(pickAllowedCefr);
  const [persona, setPersona] = useState<SpeakingPersonaId>("DEFAULT");
  const [responseSchema, setResponseSchema] = useState<SpeakingResponseSchemaId>("V1");
  const [learningMode, setLearningMode] = useState<SpeakingSessionMode>(() =>
    initialSessionMode === "INTERVIEW" ? "INTERVIEW" : "COMMUNICATION",
  );

  useEffect(() => {
    setCefrLevel(pickAllowedCefr);
  }, [pickAllowedCefr]);

  useEffect(() => {
    if (initialSessionMode === "INTERVIEW") setLearningMode("INTERVIEW");
  }, [initialSessionMode]);

  const selectableLevels = CEFR_LEVELS.filter(
    (lvl) => bandIdx(lvl.id) >= bandIdx(floorBand) && bandIdx(lvl.id) <= bandIdx(ceilBand),
  );

  const modeKeys = useMemo(() => {
    if (persona === "KLAUS") {
      return {
        commName: "klausModeGastronomy" as const,
        commDesc: "klausModeGastronomyDesc" as const,
        intName: "klausModeChefInterview" as const,
        intDesc: "klausModeChefInterviewDesc" as const,
      };
    }
    return {
      commName: "learningModeCommunication" as const,
      commDesc: "learningModeCommunicationDesc" as const,
      intName: "learningModeInterview" as const,
      intDesc: "learningModeInterviewDesc" as const,
    };
  }, [persona]);

  const displayTopics = useMemo(() => {
    const base = [...SUGGESTED_TOPICS];
    if (industry && industry !== "không xác định") {
      const capIndustry = industry.charAt(0).toUpperCase() + industry.slice(1);
      return [
        { id: `Arbeitsalltag (${capIndustry})`, emoji: "💼", labelKey: "topicIndustryDaily", descKey: "topicIndustryDailyDesc" },
        { id: `Fachgespräch (${capIndustry})`, emoji: "🎯", labelKey: "topicIndustryPro", descKey: "topicIndustryProDesc" },
        ...base,
      ];
    }
    return base;
  }, [industry]);

  const startLabel =
    persona === "KLAUS" && learningMode === "INTERVIEW"
      ? t("klausStartChefInterview")
      : learningMode === "INTERVIEW"
        ? t("startInterviewSession")
        : t("newSession");

  const hero = (
    <div
      className="relative overflow-hidden rounded-[20px] border border-amber-200/80 bg-white/80 p-5 shadow-sm"
      style={{ backgroundImage: `linear-gradient(135deg, rgba(34,211,238,0.12), rgba(167,139,250,0.12))` }}
    >
      <div
        className="absolute -right-6 -top-6 h-32 w-32 rounded-full"
        style={{
          background: `radial-gradient(circle, rgba(34,211,238,0.18) 0%, transparent 70%)`,
          filter: "blur(20px)",
        }}
      />
      <div className="relative z-10">
        <div
          className="mb-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold"
          style={{ background: `${CYAN}18`, border: `1px solid ${CYAN}44`, color: "#0e7490" }}
        >
          ✨ {t("welcomeBadge")}
        </div>
        <h2 className="mb-1 text-xl font-extrabold" style={{ color: SPEAKING_LIGHT.ink }}>
          {t("welcomeTitle")}
        </h2>
        <p className="text-sm leading-relaxed" style={{ color: SPEAKING_LIGHT.inkMuted }}>
          {t("welcomeSubtitle")}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {[t("tagInstantCorrection"), t("tagGrammarTips"), t("tagNaturalChat")].map((label) => (
            <span
              key={label}
              className="rounded-full border border-slate-200/90 bg-white/85 px-2.5 py-1 text-[11px]"
              style={{ color: SPEAKING_LIGHT.inkSoft }}
            >
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div
      className="df-glass-subtle flex flex-1 flex-col gap-4 overflow-y-auto rounded-[22px] border border-white/50 px-3 py-5 sm:px-4"
      style={{ scrollbarWidth: "none" }}
    >
      {planCurrentLevel || planTargetLevel ? (
        <p
          className="rounded-[10px] px-1 py-2 text-[11px] leading-snug bg-slate-100/90"
          style={{ color: SPEAKING_LIGHT.inkMuted }}
        >
          {t("levelRangeHint", { floor: floorBand, ceil: ceilBand })}
        </p>
      ) : null}

      {wizardStep === 1 ? (
        <>
          {hero}
          <p className="text-center text-[11px] font-semibold uppercase tracking-wide" style={{ color: SPEAKING_LIGHT.inkSoft }}>
            {t("welcomeStep1Title")}
          </p>

          <div className="rounded-[20px] p-4" style={glassLight}>
            <p className="mb-3 text-xs font-semibold" style={{ color: SPEAKING_LIGHT.inkSoft }}>
              {t("chooseLearningMode")}
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {(
                [
                  { id: "COMMUNICATION" as const, nameKey: modeKeys.commName, descKey: modeKeys.commDesc },
                  { id: "INTERVIEW" as const, nameKey: modeKeys.intName, descKey: modeKeys.intDesc },
                ] as const
              ).map(({ id, nameKey, descKey }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setLearningMode(id)}
                  className="flex flex-col items-start gap-1 rounded-[14px] p-3 text-left transition-all"
                  style={{
                    background: learningMode === id ? `${CYAN}14` : "rgba(248, 250, 252, 0.96)",
                    border: learningMode === id ? `1px solid ${CYAN}55` : `1px solid ${SPEAKING_LIGHT.line}`,
                  }}
                >
                  <span
                    className="text-[11px] font-semibold"
                    style={{ color: learningMode === id ? "#0e7490" : SPEAKING_LIGHT.ink }}
                  >
                    {t(nameKey)}
                  </span>
                  <span className="text-[9px] leading-snug" style={{ color: SPEAKING_LIGHT.inkFaint }}>
                    {t(descKey)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-[20px] p-4" style={glassLight}>
            <p className="mb-3 text-xs font-semibold" style={{ color: SPEAKING_LIGHT.inkSoft }}>
              {t("choosePersona")}
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {SPEAKING_PERSONAS.map(({ id, emoji, nameKey, descKey }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPersona(id)}
                  className="flex flex-col items-start gap-1 rounded-[14px] p-3 text-left transition-all"
                  style={{
                    background: persona === id ? `${PURPLE}14` : "rgba(248, 250, 252, 0.96)",
                    border:
                      persona === id ? `1px solid ${PURPLE}55` : `1px solid ${SPEAKING_LIGHT.line}`,
                  }}
                >
                  <span className="text-lg">{emoji}</span>
                  <span
                    className="text-[11px] font-semibold leading-tight"
                    style={{ color: persona === id ? PURPLE : SPEAKING_LIGHT.ink }}
                  >
                    {t(nameKey)}
                  </span>
                  <span className="text-[9px] leading-snug" style={{ color: SPEAKING_LIGHT.inkFaint }}>
                    {t(descKey)}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <motion.button
            type="button"
            onClick={() => setWizardStep(2)}
            className="flex w-full items-center justify-center gap-2 rounded-[16px] py-4 text-sm font-bold text-white"
            style={{
              background: `linear-gradient(135deg, ${CYAN}, ${PURPLE})`,
              boxShadow: `0 5px 0 0 rgba(0,0,0,0.2), 0 8px 24px rgba(34,211,238,0.25)`,
            }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
          >
            {t("continueToSettings")}
            <ChevronRight size={18} aria-hidden />
          </motion.button>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setWizardStep(1)}
            className="flex items-center gap-1.5 self-start rounded-xl px-2 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100/90"
          >
            <ArrowLeft size={16} aria-hidden />
            {t("backToModeAndPersona")}
          </button>
          <div className="mb-1">
            <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: SPEAKING_LIGHT.inkSoft }}>
              {t("welcomeStep2Title")}
            </p>
          </div>
          {hero}

          <div className="rounded-[20px] p-4" style={glassLight}>
            <p className="mb-3 text-xs font-semibold" style={{ color: SPEAKING_LIGHT.inkSoft }}>
              {t("chooseLevel")}
            </p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {CEFR_LEVELS.map(({ id, emoji, color, desc }) => {
                const enabled = selectableLevels.some((s) => s.id === id);
                return (
                  <button
                    key={id}
                    type="button"
                    disabled={!enabled}
                    onClick={() => enabled && setCefrLevel(id)}
                    className="flex flex-col items-center gap-1.5 rounded-[14px] p-3 transition-all disabled:pointer-events-none disabled:opacity-35"
                    style={{
                      background: cefrLevel === id ? `${color}18` : "rgba(248, 250, 252, 0.96)",
                      border: cefrLevel === id ? `1px solid ${color}55` : `1px solid ${SPEAKING_LIGHT.line}`,
                    }}
                  >
                    <span className="text-lg">{emoji}</span>
                    <span className="text-xs font-extrabold" style={{ color: cefrLevel === id ? color : SPEAKING_LIGHT.ink }}>
                      {id}
                    </span>
                    <span className="text-center text-[9px] leading-tight" style={{ color: SPEAKING_LIGHT.inkFaint }}>
                      {t(desc)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-[20px] p-4" style={glassLight}>
            <p className="mb-3 text-xs font-semibold" style={{ color: SPEAKING_LIGHT.inkSoft }}>
              {t("chooseResponseSchema")}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { id: "V1" as const, nameKey: "schemaV1Name", descKey: "schemaV1Desc" },
                  { id: "V2" as const, nameKey: "schemaV2Name", descKey: "schemaV2Desc" },
                ] as const
              ).map(({ id, nameKey, descKey }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setResponseSchema(id)}
                  className="flex flex-col items-start gap-1 rounded-[14px] p-3 text-left transition-all"
                  style={{
                    background: responseSchema === id ? `${CYAN}14` : "rgba(248, 250, 252, 0.96)",
                    border: responseSchema === id ? `1px solid ${CYAN}55` : `1px solid ${SPEAKING_LIGHT.line}`,
                  }}
                >
                  <span
                    className="text-[11px] font-semibold"
                    style={{ color: responseSchema === id ? "#0e7490" : SPEAKING_LIGHT.ink }}
                  >
                    {t(nameKey)}
                  </span>
                  <span className="text-[9px] leading-snug" style={{ color: SPEAKING_LIGHT.inkFaint }}>
                    {t(descKey)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-[20px] p-4" style={glassLight}>
            <p className="mb-3 text-xs font-semibold" style={{ color: SPEAKING_LIGHT.inkSoft }}>
              {t("chooseTopic")}
            </p>
            <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {displayTopics.map(({ id, emoji, labelKey, descKey }) => {
                const isDynamic = id.includes("(");
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setSelected(id);
                      setCustom("");
                    }}
                    className="flex flex-col items-center gap-1 rounded-[14px] p-3 transition-all"
                    style={{
                      background: selected === id && !custom ? `${CYAN}14` : "rgba(248, 250, 252, 0.96)",
                      border: selected === id && !custom ? `1px solid ${CYAN}48` : `1px solid ${SPEAKING_LIGHT.line}`,
                    }}
                  >
                    <span className="text-xl">{emoji}</span>
                    <span
                      className="text-[11px] font-semibold"
                      style={{ color: selected === id && !custom ? "#0e7490" : SPEAKING_LIGHT.ink }}
                    >
                      {isDynamic ? id : t(labelKey)}
                    </span>
                    <span className="text-[9px] text-center" style={{ color: SPEAKING_LIGHT.inkFaint }}>
                      {isDynamic ? (learningMode === "INTERVIEW" ? "Berufsbezogenes Interview" : "Berufsbezogener Alltag") : t(descKey)}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="relative">
              <input
                type="text"
                value={custom}
                onChange={(e) => {
                  setCustom(e.target.value);
                  if (e.target.value) setSelected(null);
                }}
                placeholder={t("customTopicPlaceholder")}
                className="w-full rounded-[12px] border bg-white px-4 py-2.5 pr-8 text-sm outline-none"
                style={{
                  borderColor: custom ? `${CYAN}66` : SPEAKING_LIGHT.lineStrong,
                  color: SPEAKING_LIGHT.ink,
                  caretColor: CYAN,
                }}
              />
              {custom && (
                <button
                  type="button"
                  onClick={() => setCustom("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: SPEAKING_LIGHT.inkFaint }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          <motion.button
            type="button"
            onClick={() => onStart(custom.trim() || selected || undefined, cefrLevel, persona, responseSchema, learningMode)}
            disabled={isStarting}
            className="flex w-full items-center justify-center gap-2 rounded-[16px] py-4 text-sm font-bold"
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
                <motion.div
                  className="h-4 w-4 rounded-full border-2"
                  style={{ borderColor: "rgba(255,255,255,0.3)", borderTopColor: "white" }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                />
                {t("starting")}
              </>
            ) : (
              <>
                <Plus size={18} aria-hidden />
                {startLabel}
                <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: "rgba(0,0,0,0.25)" }}>
                  {cefrLevel}
                </span>
                {(selected || custom) && (
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: "rgba(0,0,0,0.25)" }}>
                    {custom || selected}
                  </span>
                )}
                <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: "rgba(0,0,0,0.25)" }}>
                  {t(SPEAKING_PERSONAS.find((p) => p.id === persona)?.nameKey ?? "personaNameDefault")}
                </span>
                <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: "rgba(0,0,0,0.25)" }}>
                  {responseSchema}
                </span>
              </>
            )}
          </motion.button>
        </>
      )}
    </div>
  );
}
