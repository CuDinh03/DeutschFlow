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
    <header className="flex items-center justify-between gap-2 px-3 sm:px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] border-b border-white/10 bg-[rgba(10,22,40,0.75)] backdrop-blur-md sticky top-0 z-20">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
        <button
          type="button"
          onClick={onBack}
          className="p-2 rounded-full hover:bg-white/10 transition-colors text-white/60 flex-shrink-0"
          aria-label={t("back")}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <SpeakingPersonaMiniAvatar
          personaId={companionId}
          chatBusy={chatBusy}
          className="w-10 h-10 border-2 border-white/15 flex-shrink-0"
        />
        <div className="min-w-0">
          <h1 className="font-bold text-white leading-tight truncate text-sm sm:text-base">
            {companionName}
          </h1>
          <p className="text-[11px] text-white/50 font-medium truncate">{subtitle}</p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
        <div className="hidden md:flex items-center gap-2">
          {showQuota && <SpeakingQuotaPill quota={quota} />}
          <button
            type="button"
            onClick={() => onAutoTtsChange(!autoTtsEnabled)}
            className={`p-2 rounded-full transition-colors ${
              autoTtsEnabled ? "text-cyan-400 bg-cyan-500/15" : "text-white/40 hover:text-white/70"
            }`}
            title={autoTtsEnabled ? tChat("autoTtsOff") : tChat("autoTtsOn")}
          >
            {autoTtsEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
        </div>

        <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-white/8 border border-white/10 text-[11px] font-mono text-white/55">
          <Clock size={11} />
          {secondsLabel}
        </div>

        <button
          type="button"
          onClick={onEnd}
          className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-semibold bg-red-500/15 text-red-300 hover:bg-red-500/25 border border-red-400/25"
        >
          <X size={12} />
          {t("endButton")}
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="p-2 rounded-full hover:bg-white/10 text-white/60 md:hidden"
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
