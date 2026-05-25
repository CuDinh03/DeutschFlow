"use client";

import { useTranslations } from "next-intl";
import { SpeakingPersonaMiniAvatar } from "@/components/speaking/SpeakingPersonaMiniAvatar";

interface Props {
  personaId: string;
  companionName: string;
  personaRole?: string;
  sessionTopic?: string | null;
  onStarterSelect: (text: string) => void;
}

export function SpeakingChatEmptyState({
  personaId,
  companionName,
  personaRole,
  sessionTopic,
  onStarterSelect,
}: Props) {
  const t = useTranslations("speaking.chat");

  const starters = [t("starter1"), t("starter2"), t("starter3")] as const;

  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-4">
      <div className="relative mb-5">
        <div
          className="absolute inset-0 rounded-full blur-2xl opacity-40"
          style={{ background: "radial-gradient(circle, rgba(34,211,238,0.45) 0%, transparent 70%)" }}
        />
        <SpeakingPersonaMiniAvatar
          personaId={personaId}
          chatBusy={false}
          className="relative w-24 h-24 border-2 border-cyan-400/30 shadow-[0_0_40px_rgba(34,211,238,0.25)]"
        />
      </div>
      <p className="text-white/90 font-semibold text-lg mb-1">
        {t("emptyStart", { name: companionName })}
      </p>
      {personaRole && <p className="text-sm text-white/45 mb-2 max-w-xs">{personaRole}</p>}
      {sessionTopic && (
        <p className="text-xs font-medium text-cyan-400/90 mb-4 px-3 py-1 rounded-full border border-cyan-400/25 bg-cyan-500/10">
          {t("sessionMission", { topic: sessionTopic })}
        </p>
      )}
      <p className="text-[11px] text-white/40 uppercase tracking-wide mb-3">{t("startersTitle")}</p>
      <div className="flex flex-col gap-2 w-full max-w-sm">
        {starters.map((phrase, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onStarterSelect(phrase)}
            className="text-left text-sm px-4 py-3 rounded-xl border border-white/12 bg-white/[0.06] text-white/80 hover:border-cyan-400/40 hover:bg-cyan-500/10 transition-colors"
          >
            {phrase}
          </button>
        ))}
      </div>
    </div>
  );
}
