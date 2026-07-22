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
      <div className="mb-5">
        <SpeakingPersonaMiniAvatar
          personaId={personaId}
          chatBusy={false}
          className="w-24 h-24 border border-ga-line"
        />
      </div>
      <p className="font-ga-display text-ga-ink font-medium text-lg mb-1">
        {t("emptyStart", { name: companionName })}
      </p>
      {personaRole && <p className="ga-ui text-sm text-ga-muted mb-2 max-w-xs">{personaRole}</p>}
      {sessionTopic && (
        <p className="ga-ui text-xs font-medium text-ga-blue mb-4 px-3 py-1 rounded-ga-pill border border-ga-blue bg-ga-blue-soft">
          {t("sessionMission", { topic: sessionTopic })}
        </p>
      )}
      <p className="ga-ui text-[11px] text-ga-subtle uppercase tracking-[0.08em] mb-3">{t("startersTitle")}</p>
      <div className="flex flex-col gap-2 w-full max-w-sm">
        {starters.map((phrase, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onStarterSelect(phrase)}
            className="ga-ui text-left text-sm px-4 py-3 rounded-ga border border-ga-line bg-ga-card text-ga-ink hover:border-ga-accent hover:bg-ga-accent-soft transition-colors"
          >
            {phrase}
          </button>
        ))}
      </div>
    </div>
  );
}
