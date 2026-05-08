"use client";

import { NodeContent, WordTimestamp } from "@/stores/useNodeSessionStore";
import { useState, useRef, useCallback, useEffect } from "react";
import { Play, Pause, RotateCcw, Volume2 } from "lucide-react";

export default function ListeningView({ content }: { content: NodeContent }) {
  const audio = content.audio_content;
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [activeWordIndex, setActiveWordIndex] = useState(-1);
  const [speed, setSpeed] = useState(1);
  const [fillBlanks, setFillBlanks] = useState<Record<number, string>>({});
  const audioRef = useRef<HTMLAudioElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);

  if (!audio?.url) {
    return (
      <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-[#E2E8F0]">
        <span className="text-4xl mb-3">🎧</span>
        <p className="text-sm text-[#64748B]">Audio chưa có cho bài học này.</p>
      </div>
    );
  }

  const timestamps: WordTimestamp[] = audio.transcript_sync ?? [];

  // Pick some words to blank out (every 5th word)
  const blankIndices = new Set(
    timestamps.filter((_, i) => i > 2 && i % 5 === 0).map((_, i) => i * 5)
  );

  // Sync highlight with audio time
  useEffect(() => {
    if (!audioRef.current) return;
    const el = audioRef.current;

    const onTimeUpdate = () => {
      const t = el.currentTime;
      setCurrentTime(t);
      // Find active word
      const idx = timestamps.findIndex((w) => t >= w.start && t < w.end);
      setActiveWordIndex(idx);

      // Auto-scroll to active word
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
          <h3 className="text-xs font-bold text-[#94A3B8] uppercase mb-3">Transcript</h3>
          <div className="flex flex-wrap gap-1 leading-loose">
            {timestamps.map((w, i) => {
              const isActive = i === activeWordIndex;
              const isPast = activeWordIndex > -1 && i < activeWordIndex;
              const isBlank = blankIndices.has(i);

              if (isBlank) {
                const userInput = fillBlanks[i] ?? "";
                const isCorrect = userInput.toLowerCase().trim() === w.word.toLowerCase().trim();
                return (
                  <input
                    key={i}
                    data-word-idx={i}
                    type="text"
                    value={userInput}
                    onChange={(e) => setFillBlanks((prev) => ({ ...prev, [i]: e.target.value }))}
                    placeholder="___"
                    className={`inline-block w-20 text-center text-sm border-b-2 outline-none px-1 py-0.5 transition-colors ${
                      isActive ? "border-[#FFCD00] bg-[#FFCD00]/10" :
                      userInput && isCorrect ? "border-green-400 bg-green-50 text-green-700" :
                      userInput ? "border-red-300 bg-red-50 text-red-600" :
                      "border-[#CBD5E1] bg-transparent text-[#475569]"
                    }`}
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

      {/* ── No timestamps fallback ── */}
      {timestamps.length === 0 && (
        <div className="rounded-xl bg-white border border-[#E2E8F0] p-6 text-center">
          <p className="text-sm text-[#64748B]">Transcript chưa có. Đang nghe và luyện tập...</p>
        </div>
      )}
    </div>
  );
}
