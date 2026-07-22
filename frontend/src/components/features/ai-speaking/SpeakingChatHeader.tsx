"use client";

import { ArrowLeft, Clock, MoreVertical, Volume2, VolumeX, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { SpeakingPersonaMiniAvatar } from "@/components/speaking/SpeakingPersonaMiniAvatar";
import { SpeakingQuotaPill } from "./SpeakingQuotaPill";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AiSpeakingQuota } from "@/lib/aiSpeakingApi";
import { shouldShowAiSpeakingQuota } from "@/lib/authSession";
import type { StreamStatus } from "@/types/ai-speaking";

interface Props {
  companionId: string;
  companionName: string;
  subtitle: string;
  streamStatus: StreamStatus;
  secondsLabel: string;
  quota: AiSpeakingQuota | null;
  autoTtsEnabled: boolean;
  onAutoTtsChange: (v: boolean) => void;
  onBack: () => void;
  onEnd: () => void;
}

export function SpeakingChatHeader({
  companionId,
  companionName,
  subtitle,
  streamStatus,
  secondsLabel,
  quota,
  autoTtsEnabled,
  onAutoTtsChange,
  onBack,
  onEnd,
}: Props) {
  const t = useTranslations("speaking");
  const tChat = useTranslations("speaking.chat");
  const showQuota = shouldShowAiSpeakingQuota();
  const chatBusy = streamStatus === "streaming" || streamStatus === "processing";

  return (
    <header className="ga-ui flex items-center justify-between gap-2 px-3 sm:px-4 py-3 border-b border-ga-line bg-ga-card sticky top-0 z-20">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
        <button
          type="button"
          onClick={onBack}
          className="p-2 rounded-full hover:bg-ga-side-active transition-colors text-ga-muted flex-shrink-0"
          aria-label={t("back")}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <SpeakingPersonaMiniAvatar
          personaId={companionId}
          chatBusy={chatBusy}
          className="w-10 h-10 border border-ga-line flex-shrink-0"
        />
        <div className="min-w-0">
          <h1 className="font-ga-display font-medium text-ga-ink leading-tight truncate text-sm sm:text-base">
            {companionName}
          </h1>
          <p className="text-[11px] text-ga-muted font-medium truncate">{subtitle}</p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
        <div className="hidden md:flex items-center gap-2">
          {showQuota && <SpeakingQuotaPill quota={quota} />}
          <button
            type="button"
            onClick={() => onAutoTtsChange(!autoTtsEnabled)}
            className={`p-2 rounded-full transition-colors ${
              autoTtsEnabled ? "text-ga-blue bg-ga-blue-soft" : "text-ga-subtle hover:text-ga-ink"
            }`}
            title={autoTtsEnabled ? tChat("autoTtsOff") : tChat("autoTtsOn")}
          >
            {autoTtsEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
        </div>

        <div className="flex items-center gap-1 px-2 py-1 rounded-ga-pill border border-ga-line bg-ga-surface text-[11px] font-mono text-ga-muted">
          <Clock size={11} />
          {secondsLabel}
        </div>

        <button
          type="button"
          onClick={onEnd}
          className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-ga-pill text-[11px] font-semibold bg-ga-red-soft text-ga-red hover:bg-ga-red hover:text-white transition-colors border border-ga-red"
        >
          <X size={12} />
          {t("endButton")}
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="p-2 rounded-full hover:bg-ga-side-active text-ga-muted md:hidden"
              aria-label={tChat("headerMenu")}
            >
              <MoreVertical size={18} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onClick={() => onAutoTtsChange(!autoTtsEnabled)}>
              {autoTtsEnabled ? tChat("autoTtsOff") : tChat("autoTtsOn")}
            </DropdownMenuItem>
            {showQuota && quota && (
              <DropdownMenuItem disabled className="text-xs opacity-80">
                {tChat("quotaRemaining", { n: Math.max(0, Math.round(quota.remainingSpendable)) })}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onEnd} className="text-red-600 focus:text-red-600">
              {t("endButton")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
