"use client";

import { NodeContent, WordTimestamp, useNodeSessionStore } from "@/stores/useNodeSessionStore";
import { useTranslations } from "next-intl";
import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Play, Pause, RotateCcw, Volume2, CheckCircle } from "lucide-react";

export default function ListeningView({ content, isLocked = false }: { content: NodeContent; isLocked?: boolean }) {
  const tLearn = useTranslations("learn");
  const audio = content.audio_content;
  const { markTabCompleted, tabCompletion } = useNodeSessionStore();
  const isCompleted = tabCompletion.listening;

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [activeWordIndex, setActiveWordIndex] = useState(-1);
  const [speed, setSpeed] = useState(1);
  const [fillBlanks, setFillBlanks] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);

  const timestamps = useMemo<WordTimestamp[]>(
    () => audio?.transcript_sync ?? [],
    [audio?.transcript_sync]
  );

  const blankIndices = useMemo(() => new Set(
    timestamps.filter((_, i) => i > 2 && i % 5 === 0).map((_, i) => i * 5)
  ), [timestamps]);

  const stripPunc = (s: string) => s.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");

  // Handle submit
  const handleSubmit = useCallback(() => {
    if (blankIndices.size === 0) return;
    let correct = 0;
    blankIndices.forEach((idx) => {
      const w = stripPunc(timestamps[idx].word).toLowerCase().trim();
      const input = stripPunc(fillBlanks[idx] ?? "").toLowerCase().trim();
      if (w === input) correct++;
    });
    const pct = Math.round((correct / blankIndices.size) * 100);
    setCorrectCount(correct);
    setScore(pct);
    setSubmitted(true);
    if (pct >= 80) {
      markTabCompleted("listening", pct);
    }
  }, [blankIndices, timestamps, fillBlanks, markTabCompleted]);

  // Sync highlight with audio time
  useEffect(() => {
    if (!audioRef.current) return;
    const el = audioRef.current;

    const onTimeUpdate = () => {
      const t = el.currentTime;
      setCurrentTime(t);
      const idx = timestamps.findIndex((w) => t >= w.start && t < w.end);
      setActiveWordIndex(idx);
      if (idx >= 0 && transcriptRef.current) {
        const wordEl = transcriptRef.current.querySelector(`[data-word-idx="${idx}"]`);
        wordEl?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    };
    const onEnded = () => setIsPlaying(false);
    const onLoadedMetadata = () => setDuration(el.duration);

    el.addEventListener("timeupdate", onTimeUpdate);
    el.addEventListener("ended", onEnded);
    el.addEventListener("loadedmetadata", onLoadedMetadata);
    return () => {
      el.removeEventListener("timeupdate", onTimeUpdate);
      el.removeEventListener("ended", onEnded);
      el.removeEventListener("loadedmetadata", onLoadedMetadata);
    };
  }, [timestamps]);

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlaying) { audioRef.current.pause(); }
    else { audioRef.current.play(); }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const restart = useCallback(() => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = 0;
    audioRef.current.play();
    setIsPlaying(true);
  }, []);

  const changeSpeed = useCallback(() => {
    const speeds = [0.5, 0.75, 1, 1.25];
    const next = speeds[(speeds.indexOf(speed) + 1) % speeds.length];
    setSpeed(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  }, [speed]);

  useEffect(() => {
    if (audioRef.current && audio?.url) {
      audioRef.current.playbackRate = speed;
    }
  }, [speed, audio?.url]);

  const seekTo = useCallback((t: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = t;
    setCurrentTime(t);
  }, []);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const allFilled = blankIndices.size > 0 && Array.from(blankIndices).every(idx => (fillBlanks[idx] ?? "").trim() !== "");

  if (!audio?.url) {
    return (
      <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-[#E2E8F0]">
        <span className="text-4xl mb-3">🎧</span>
        <p className="text-sm text-[#64748B]">Audio chưa có cho bài học này.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <audio ref={audioRef} src={audio.url} preload="metadata" />

      {/* ── Audio Player ── */}
      <div className="rounded-2xl bg-gradient-to-r from-[#121212] to-[#1E293B] p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Volume2 size={16} className="text-[#FFCD00]" />
          <span className="text-sm font-bold text-white">Bài nghe</span>
          <button
            type="button"
            onClick={changeSpeed}
            className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/80 hover:bg-white/20 transition-colors font-mono"
          >
            {speed}x
          </button>
        </div>

        {/* Progress bar */}
        <div
          className="relative h-2 bg-white/10 rounded-full cursor-pointer group"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = (e.clientX - rect.left) / rect.width;
            seekTo(pct * duration);
          }}
        >
          <div
            className="absolute h-full bg-[#FFCD00] rounded-full transition-all duration-100"
            style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
          />
          <div
            className="absolute w-3 h-3 bg-white rounded-full -top-0.5 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ left: `${duration ? (currentTime / duration) * 100 : 0}%`, transform: "translateX(-50%)" }}
          />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-white/50 font-mono">{formatTime(currentTime)}</span>
          <div className="flex items-center gap-3">
            <button type="button" onClick={restart} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:bg-white/20 transition-colors">
              <RotateCcw size={14} />
            </button>
            <button
              type="button"
              onClick={togglePlay}
              className="w-12 h-12 rounded-full bg-[#FFCD00] flex items-center justify-center text-[#121212] hover:scale-105 active:scale-95 transition-transform shadow-lg"
            >
              {isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
            </button>
          </div>
          <span className="text-xs text-white/50 font-mono">{formatTime(duration)}</span>
        </div>
      </div>

      {/* ── Karaoke Transcript ── */}
      {timestamps.length > 0 && (
        <div ref={transcriptRef} className="rounded-xl bg-white border border-[#E2E8F0] p-4 max-h-[300px] overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-[#94A3B8] uppercase">Transcript</h3>
            {blankIndices.size > 0 && !submitted && !isLocked && (
              <span className="text-[10px] text-[#94A3B8]">
                Điền vào ô trống, sau đó bấm <strong>Nộp bài</strong>
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1 leading-loose">
            {timestamps.map((w, i) => {
              const isActive = i === activeWordIndex;
              const isPast = activeWordIndex > -1 && i < activeWordIndex;
              const isBlank = blankIndices.has(i);

              if (isBlank) {
                const userInput = fillBlanks[i] ?? "";
                const isCorrect = stripPunc(userInput).toLowerCase().trim() === stripPunc(w.word).toLowerCase().trim();
                // After submit: show correct/wrong color; before submit: neutral
                let inputClass = "border-[#CBD5E1] bg-transparent text-[#475569]";
                if (isLocked || submitted) {
                  inputClass = isCorrect
                    ? "border-green-400 bg-green-50 text-green-700"
                    : "border-red-300 bg-red-50 text-red-600";
                } else if (isActive) {
                  inputClass = "border-[#FFCD00] bg-[#FFCD00]/10";
                }

                return (
                  <input
                    key={i}
                    data-word-idx={i}
                    type="text"
                    value={userInput}
                    onChange={(e) => {
                      if (!submitted && !isLocked) {
                        setFillBlanks((prev) => ({ ...prev, [i]: e.target.value }));
                      }
                    }}
                    placeholder="___"
                    disabled={submitted || isLocked}
                    className={`inline-block w-20 text-center text-sm border-b-2 outline-none px-1 py-0.5 transition-colors ${inputClass} ${(submitted || isLocked) ? "cursor-not-allowed" : ""}`}
                  />
                );
              }

              return (
                <span
                  key={i}
                  data-word-idx={i}
                  onClick={() => seekTo(w.start)}
                  className={`cursor-pointer px-0.5 rounded transition-all duration-150 text-sm ${
                    isActive ? "bg-[#FFCD00] text-[#121212] font-bold scale-105" :
                    isPast ? "text-[#94A3B8]" :
                    "text-[#1E293B] hover:bg-[#F1F5F9]"
                  }`}
                >
                  {w.word}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Submit Button (only before submit, not locked) ── */}
      {timestamps.length > 0 && !submitted && !isLocked && blankIndices.size > 0 && (
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!allFilled}
          className={`w-full py-3 rounded-xl font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 ${
            allFilled
              ? "bg-[#121212] text-white hover:bg-[#1E293B] shadow-md"
              : "bg-[#E2E8F0] text-[#94A3B8] cursor-not-allowed"
          }`}
        >
          <CheckCircle size={16} />
          {allFilled ? "Nộp bài" : `Điền đủ ${blankIndices.size} ô trống để nộp bài`}
        </button>
      )}

      {/* ── Score Result (after submit) ── */}
      {submitted && score !== null && (
        <div className={`rounded-xl p-5 text-center space-y-2 border-2 ${
          score >= 100 ? "bg-green-50 border-green-300" :
          score >= 80  ? "bg-yellow-50 border-yellow-300" :
          "bg-red-50 border-red-300"
        }`}>
          <div className={`text-4xl font-black ${
            score >= 100 ? "text-green-600" :
            score >= 80  ? "text-yellow-600" :
            "text-red-600"
          }`}>
            {score}
            <span className="text-lg font-medium">/100</span>
          </div>
          <p className={`text-sm font-bold ${
            score >= 100 ? "text-green-700" :
            score >= 80  ? "text-yellow-700" :
            "text-red-700"
          }`}>
            {score >= 100 ? "🎉 Hoàn hảo! Đúng tất cả!" :
             score >= 80  ? "👍 Khá tốt! Đủ điều kiện vượt qua" :
             "❌ Chưa đạt – Cần làm lại (yêu cầu 100% để vượt node)"}
          </p>
          <p className="text-xs text-[#64748B]">
            Đúng {correctCount}/{blankIndices.size} từ
          </p>
          {score < 80 && (
            <button
              onClick={() => { setSubmitted(false); setScore(null); setFillBlanks({}); setCorrectCount(0); }}
              className="mt-2 px-5 py-2 rounded-xl bg-[#121212] text-white text-sm font-bold hover:bg-[#1E293B] transition-colors"
            >
              🔄 Thử lại
            </button>
          )}
        </div>
      )}

      {/* ── Completion Status ── */}
      {isCompleted && !submitted && timestamps.length > 0 && (
        <div className="rounded-xl bg-green-50 border border-green-200 p-4 text-center">
          <p className="text-sm font-bold text-green-700">✅ {tLearn("listeningSuccess")}</p>
        </div>
      )}

      {/* ── No timestamps fallback ── */}
      {timestamps.length === 0 && (
        <div className="rounded-xl bg-white border border-[#E2E8F0] p-6 text-center space-y-4">
          <p className="text-sm text-[#64748B]">Transcript chưa có. Đang nghe và luyện tập...</p>
          <button
            onClick={() => markTabCompleted("listening")}
            disabled={isCompleted}
            className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-colors ${
              isCompleted
                ? "bg-green-500 text-white"
                : "bg-[#22C55E] hover:bg-[#16A34A] text-white"
            }`}
          >
            {isCompleted ? `✅ ${tLearn("completed")}` : `✅ ${tLearn("listenedAndUnderstood")}`}
          </button>
        </div>
      )}
    </div>
  );
}
