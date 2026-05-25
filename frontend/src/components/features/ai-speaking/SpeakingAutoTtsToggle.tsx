"use client";

import { Volume2, VolumeX } from "lucide-react";
import { useTranslations } from "next-intl";

interface Props {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}

export function SpeakingAutoTtsToggle({ enabled, onChange }: Props) {
  const t = useTranslations("speaking.chat");

  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      className={`p-2 rounded-full transition-colors ${
        enabled
          ? "text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/40"
          : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
      }`}
      title={enabled ? t("autoTtsOff") : t("autoTtsOn")}
      aria-pressed={enabled}
      aria-label={enabled ? t("autoTtsOff") : t("autoTtsOn")}
    >
      {enabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
    </button>
  );
}
