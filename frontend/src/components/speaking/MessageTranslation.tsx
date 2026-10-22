"use client";

import { useState } from "react";
import { Languages, Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { aiSpeakingApi } from "@/lib/aiSpeakingApi";

/**
 * Nút "Dịch" dưới câu của trợ lý (K4 A+B+E, 22/10/2026). Dịch theo ngôn ngữ giao diện (vi → Việt,
 * en → Anh); giao diện tiếng Đức không có nút. Mặc định ẩn để người học tự nghe hiểu trước; bấm lần
 * đầu mới gọi backend (backend lưu lại), bấm tiếp chỉ ẩn/hiện.
 */
export function MessageTranslation({ sessionId, messageId }: { sessionId: number; messageId: number }) {
  const locale = useLocale();
  const t = useTranslations("speaking.chat");
  const [text, setText] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  if (locale === "de") return null;
  const lang = locale === "en" ? "en" : "vi";

  const toggle = async () => {
    if (text) {
      setOpen((v) => !v);
      return;
    }
    setState("loading");
    try {
      setText(await aiSpeakingApi.translateMessage(sessionId, messageId, lang));
      setOpen(true);
      setState("idle");
    } catch {
      setState("error");
    }
  };

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={toggle}
        disabled={state === "loading"}
        aria-expanded={open}
        className="inline-flex min-h-8 items-center gap-1.5 text-[12px] font-semibold text-ga-muted transition-colors hover:text-ga-ink disabled:opacity-60"
      >
        {state === "loading" ? <Loader2 size={13} className="animate-spin" aria-hidden /> : <Languages size={13} aria-hidden />}
        {state === "error" ? t("translateFailed") : open ? t("hideTranslation") : t("translate")}
      </button>
      {open && text && (
        <p lang={lang} className="text-sm leading-relaxed text-ga-muted">
          {text}
        </p>
      )}
    </div>
  );
}
