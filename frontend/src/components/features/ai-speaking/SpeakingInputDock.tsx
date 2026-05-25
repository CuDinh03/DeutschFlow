"use client";

import { Send, Mic, MicOff, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

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
  companionName,
  inputTip,
  onToggleMic,
  showSuggestionHint,
}: Props) {
  const tChat = useTranslations("speaking.chat");
  const micBusy = isTranscribing || isEvaluatingPhoneme;
  const inputDisabled = quotaBlocked || repairBlocking;

  return (
    <footer className="border-t border-white/10 bg-[rgba(8,16,32,0.92)] backdrop-blur-md p-3 sm:p-4">
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
            onClick={onToggleMic}
            disabled={micBusy || inputDisabled}
            className={cn(
              "flex-shrink-0 rounded-full transition-all flex items-center justify-center",
              "w-14 h-14 sm:w-12 sm:h-12",
              isListening
                ? "bg-red-500/25 text-red-300 ring-2 ring-red-400/50 animate-pulse shadow-[0_0_24px_rgba(248,113,113,0.35)]"
                : "bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 border border-cyan-400/30",
              (micBusy || inputDisabled) && "opacity-40",
            )}
            title={tChat("micTitle")}
            aria-label={tChat("micTitle")}
          >
            {micBusy ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : isListening ? (
              <MicOff className="w-6 h-6" />
            ) : (
              <Mic className="w-6 h-6" />
            )}
          </button>

          <div
            className={cn(
              "flex-1 flex items-end gap-2 rounded-2xl border px-2 py-1.5 transition-all",
              "bg-white/[0.06] border-white/12 focus-within:border-cyan-400/40 focus-within:ring-1 focus-within:ring-cyan-400/25",
              isListening && "border-red-400/35 ring-1 ring-red-400/20",
            )}
          >
            {isListening && (
              <span className="text-[10px] font-bold text-red-400 pl-2 pb-3 animate-pulse flex-shrink-0">
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
              className="flex-1 bg-transparent border-none outline-none resize-none max-h-28 min-h-[44px] py-2.5 px-1 text-white/90 placeholder:text-white/35 text-[15px] disabled:opacity-50"
              rows={1}
            />
            <button
              type="submit"
              disabled={!inputText.trim() || !streamIdle || inputDisabled}
              className="p-2.5 mb-0.5 rounded-xl bg-cyan-500 text-slate-950 hover:bg-cyan-400 transition-colors disabled:opacity-35 flex-shrink-0"
              aria-label={tChat("sendMessage")}
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </form>

        <div className="text-center mt-2 space-y-0.5">
          <span className="text-[10px] text-white/40 block">{inputTip}</span>
          {showSuggestionHint && (
            <span className="text-[10px] text-cyan-400/50 hidden sm:block">{tChat("shortcutHint")}</span>
          )}
        </div>
      </div>
    </footer>
  );
}
