"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Mic, MicOff, RotateCcw, Volume2, X } from "lucide-react";

interface WordResult {
  expected: string;
  transcribed: string | null;
  verdict: "CORRECT" | "CLOSE" | "MISSING";
  score: number;
}

interface PronunciationScore {
  transcribedText: string;
  overallScore: number;
  avgLogprob: number;
  words: WordResult[];
}

interface PronunciationFeedbackProps {
  expectedText: string;
  onClose?: () => void;
}

const VERDICT_STYLE: Record<string, string> = {
  CORRECT: "bg-emerald-100 text-emerald-800 border-emerald-200",
  CLOSE:   "bg-amber-100 text-amber-800 border-amber-200",
  MISSING: "bg-red-100 text-red-700 border-red-200 line-through",
};

// Khoá tương đối trong namespace `v2.student.learnViews.pronunciation`.
const VERDICT_LABEL_KEY: Record<string, string> = {
  CORRECT: "verdict.CORRECT",
  CLOSE:   "verdict.CLOSE",
  MISSING: "verdict.MISSING",
};

export function PronunciationFeedback({ expectedText, onClose }: PronunciationFeedbackProps) {
  const t = useTranslations("v2.student.learnViews.pronunciation");
  const [recording, setRecording] = useState(false);
  const [result, setResult] = useState<PronunciationScore | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunks, { type: "audio/webm" });
        await submitAudio(blob);
      };

      setAudioChunks(chunks);
      setMediaRecorder(recorder);
      recorder.start();
      setRecording(true);
      setResult(null);
      setError(null);
    } catch {
      setError(t("micDenied"));
    }
  }, [expectedText, t]);

  const stopRecording = useCallback(() => {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
      setRecording(false);
    }
  }, [mediaRecorder]);

  const submitAudio = async (audioBlob: Blob) => {
    const formData = new FormData();
    formData.append("audio", audioBlob, "audio.webm");
    formData.append("expectedText", expectedText);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/speaking/pronunciation-check`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (res.ok) {
        setResult(await res.json());
      } else {
        setError(t("scoreFailed"));
      }
    } catch {
      setError(t("networkError"));
    }
  };

  const scoreColor = result
    ? result.overallScore >= 80 ? "text-emerald-600"
    : result.overallScore >= 60 ? "text-amber-600"
    : "text-red-500"
    : "";

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5 space-y-4">
      {/* Target sentence */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{t("readCap")}</p>
          <p className="text-lg font-semibold text-[#0F172A]">{expectedText}</p>
        </div>
        {onClose && (
          <button onClick={onClose} aria-label={t("close")} className="text-gray-400 hover:text-gray-600 shrink-0"><X size={16} aria-hidden /></button>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        {!recording ? (
          <button
            onClick={startRecording}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 text-white px-4 py-2.5 text-sm font-semibold hover:bg-indigo-700"
          >
            <Mic size={16} /> {t("startRecording")}
          </button>
        ) : (
          <button
            onClick={stopRecording}
            className="flex items-center gap-2 rounded-xl bg-red-500 text-white px-4 py-2.5 text-sm font-semibold hover:bg-red-600 animate-pulse"
          >
            <MicOff size={16} /> {t("stopAndScore")}
          </button>
        )}
        {result && (
          <button
            onClick={() => { setResult(null); setError(null); }}
            className="flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50"
          >
            <RotateCcw size={14} /> {t("retry")}
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {/* Results */}
      {result && (
        <div className="space-y-3">
          {/* Overall score */}
          <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-4">
            <div className={`text-3xl font-black ${scoreColor}`}>
              {result.overallScore}
            </div>
            <div>
              <p className="text-xs text-gray-500">{t("pronScore")}</p>
              <div className="mt-1 h-2 w-32 rounded-full bg-gray-200">
                <div
                  className={`h-full rounded-full transition-all ${
                    result.overallScore >= 80 ? "bg-emerald-500"
                    : result.overallScore >= 60 ? "bg-amber-500"
                    : "bg-red-400"
                  }`}
                  style={{ width: `${result.overallScore}%` }}
                />
              </div>
            </div>
          </div>

          {/* Transcribed text */}
          <div>
            <p className="text-xs text-gray-400 mb-1">{t("heard")}</p>
            <p className="text-sm text-gray-600 italic">&ldquo;{result.transcribedText}&rdquo;</p>
          </div>

          {/* Per-word breakdown */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{t("perWordCap")}</p>
            <div className="flex flex-wrap gap-2">
              {result.words.map((w, i) => (
                <div key={i} className="relative group">
                  <span className={`inline-block border rounded-lg px-2.5 py-1 text-sm font-medium ${VERDICT_STYLE[w.verdict]}`}>
                    {w.expected}
                  </span>
                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:flex whitespace-nowrap rounded-lg bg-gray-900 text-white text-xs px-2 py-1 z-10">
                    {t(VERDICT_LABEL_KEY[w.verdict])}
                    {w.transcribed && w.verdict !== "CORRECT" && ` → "${w.transcribed}"`}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tips based on missing words */}
          {result.words.some(w => w.verdict === "MISSING") && (
            <div className="rounded-xl bg-rose-50 border border-rose-100 p-3">
              <p className="text-xs font-semibold text-rose-700 mb-1">{t("wordsToPractice")}</p>
              <div className="flex flex-wrap gap-1">
                {result.words.filter(w => w.verdict === "MISSING").map((w, i) => (
                  <span key={i} className="text-xs font-medium text-rose-800 bg-rose-100 rounded px-1.5 py-0.5">
                    {w.expected}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
