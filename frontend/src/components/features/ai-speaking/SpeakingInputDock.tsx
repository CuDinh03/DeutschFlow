"use client";

import { Send, Mic, MicOff, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { lightImpact } from "@/lib/haptics";

interface Props {
  inputText: string;
  onInputChange: (v: string) => void;
  onSubmit: () => void;
  isListening: boolean;
  isTranscribing: boolean;
  isEvaluatingPhoneme: boolean;
  streamIdle: boolean;
  repairBlocking: boolean;
  quotaBlocked?: boolean;
  /** Mic capture failed (permission/device) — reflect a blocked state. */
  micBlocked?: boolean;
  companionName: string;
  inputTip: string;
  onToggleMic: () => void;
  suggestionWaitSec?: number;
  showSuggestionHint?: boolean;
}

export function SpeakingInputDock({
  inputText,
  onInputChange,
  onSubmit,
  isListening,
  isTranscribing,
  isEvaluatingPhoneme,
  streamIdle,
  repairBlocking,
  quotaBlocked = false,
  micBlocked = false,
  companionName,
  inputTip,
  onToggleMic,
  showSuggestionHint,
}: Props) {
  const t = useTranslations("speaking");
  const tChat = useTranslations("speaking.chat");
  const micBusy = isTranscribing || isEvaluatingPhoneme;
  const inputDisabled = quotaBlocked || repairBlocking;
  // Show the blocked affordance only when idle (not while recording/working).
  const showMicBlocked = micBlocked && !isListening && !micBusy;
  const micLabel = showMicBlocked ? t("micRetry") : tChat("micTitle");

  return (
    <footer className="ga-ui border-t border-ga-line bg-ga-card p-3 sm:p-4">
      <div className="max-w-3xl mx-auto w-full md:w-[65%] md:mx-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
          className="flex items-end gap-2"
        >
          <button
            type="button"
            onClick={() => { lightImpact(); onToggleMic(); }}
            disabled={micBusy || inputDisabled}
            className={cn(
              "flex-shrink-0 rounded-full transition-all flex items-center justify-center",
              "w-14 h-14 sm:w-12 sm:h-12",
              isListening
                ? "bg-ga-red text-white ring-2 ring-ga-red-soft animate-pulse"
                : showMicBlocked
                ? "bg-ga-yellow-soft text-ga-gold border border-ga-yellow hover:bg-ga-yellow hover:text-ga-ink"
                : "bg-ga-ink text-ga-bg hover:opacity-90",
              (micBusy || inputDisabled) && "opacity-40",
            )}
            title={micLabel}
            aria-label={micLabel}
          >
            {micBusy ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : isListening || showMicBlocked ? (
              <MicOff className="w-6 h-6" />
            ) : (
              <Mic className="w-6 h-6" />
            )}
          </button>

          <div
            className={cn(
              "flex-1 flex items-end gap-2 rounded-ga border px-2 py-1.5 transition-all",
              "bg-ga-surface border-ga-line focus-within:border-ga-accent focus-within:ring-1 focus-within:ring-ga-accent",
              isListening && "border-ga-red ring-1 ring-ga-red-soft",
            )}
          >
            {isListening && (
              <span className="text-[10px] font-bold text-ga-red pl-2 pb-3 animate-pulse flex-shrink-0">
                {tChat("recordingLive")}
              </span>
            )}
            <textarea
              value={inputText}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (!inputDisabled) onSubmit();
                }
              }}
              disabled={inputDisabled}
              placeholder={
                quotaBlocked
                  ? tChat("quotaBlockedInputPlaceholder")
                  : tChat("inputPlaceholder", { name: companionName })
              }
              className="flex-1 bg-transparent border-none outline-none resize-none max-h-28 min-h-[44px] py-2.5 px-1 text-ga-ink placeholder:text-ga-subtle text-[15px] disabled:opacity-50"
              rows={1}
            />
            <button
              type="submit"
              disabled={!inputText.trim() || !streamIdle || inputDisabled}
              className="p-2.5 mb-0.5 rounded-ga bg-ga-yellow text-ga-ink hover:opacity-90 transition-opacity disabled:opacity-35 flex-shrink-0"
              aria-label={tChat("sendMessage")}
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </form>

        <div className="text-center mt-2 space-y-0.5">
          <span className="text-[10px] text-ga-muted block">{inputTip}</span>
          {showSuggestionHint && (
            <span className="text-[10px] text-ga-subtle hidden sm:block">{tChat("shortcutHint")}</span>
          )}
        </div>
      </div>
    </footer>
  );
}
