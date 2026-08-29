"use client";

import { NodeContent, useNodeSessionStore } from "@/stores/useNodeSessionStore";
import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, Square, RotateCcw, Loader2 } from "lucide-react";
import { AudioButton } from "./LearnComponents";
import api from "@/lib/api";
import { useTranslations } from "next-intl";

import { subscribeToJobSse } from "@/lib/jobSseApi";

interface PronunciationFeedback {
  overall_score: number;
  words: Array<{
    word: string;
    score: "correct" | "minor_error" | "major_error";
    feedback?: string;
    ipa_expected?: string;
  }>;
  tips: string[];
  transcribed?: string;
}

export default function SpeakingView({ content, isLocked = false }: { content: NodeContent; isLocked?: boolean }) {
  const tLearn = useTranslations("learn");
  const { markTabCompleted, tabCompletion } = useNodeSessionStore();
  const isCompleted = tabCompletion.speaking;

  const [currentDrillIndex, setCurrentDrillIndex] = useState(0);
  const [recording, setRecording] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [feedback, setFeedback] = useState<PronunciationFeedback | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [completedDrills, setCompletedDrills] = useState<Set<number>>(new Set());

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const sseCtrlRef = useRef<AbortController | null>(null);

  // Build drill list from phrases + examples
  const drills = [
    ...content.phrases.map((p) => ({ text: p.german, hint: p.meaning, speak: p.speak_de })),
    ...content.examples.map((e) => ({ text: e.german, hint: e.translation, speak: e.speak_de })),
  ];

  const currentDrill = drills[currentDrillIndex];

  // ── Waveform visualization (Web Audio API AnalyserNode) ──
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteTimeDomainData(dataArray);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#FFCD00";
    ctx.beginPath();

    const sliceWidth = canvas.width / bufferLength;
    let x = 0;
    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const y = (v * canvas.height) / 2;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      x += sliceWidth;
    }
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();

    animFrameRef.current = requestAnimationFrame(drawWaveform);
  }, []);

  // ── Fix Stale Closure for onstop ──
  const handleRecordingCompleteRef = useRef<((mime: string) => Promise<void>) | null>(null);

  // ── Start Recording ──
  const startRecording = useCallback(async () => {
    try {
      if (sseCtrlRef.current) sseCtrlRef.current.abort();
      setError(null);
      setFeedback(null);
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      streamRef.current = stream;

      // Web Audio API for waveform
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Determine best supported mime type
      const getSupportedMimeType = () => {
        const types = [
          "audio/webm;codecs=opus",
          "audio/webm",
          "audio/mp4",
          "audio/ogg;codecs=opus"
        ];
        for (const t of types) {
          if (MediaRecorder.isTypeSupported(t)) return t;
        }
        return "";
      };
      
      const mimeType = getSupportedMimeType();
      const options = mimeType ? { mimeType } : {};

      // MediaRecorder for capture
      const mediaRecorder = new MediaRecorder(stream, options);
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorder.onstop = () => {
        if (handleRecordingCompleteRef.current) handleRecordingCompleteRef.current(mimeType);
      };
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.start();
      setRecording(true);
      drawWaveform();
    } catch {
      setError("Không thể truy cập microphone. Vui lòng cấp quyền.");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawWaveform]);

  // ── Stop Recording ──
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      cancelAnimationFrame(animFrameRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    }
  }, [recording]);

  // ── Send to Database Queue and poll via SSE ──
  const handleRecordingComplete = useCallback(async (mimeType: string) => {
    if (audioChunksRef.current.length === 0 || !currentDrill) return;
    setEvaluating(true);

    const blobType = mimeType || "audio/webm";
    const blob = new Blob(audioChunksRef.current, { type: blobType });
    const extension = blobType.includes("mp4") ? "m4a" : "webm";
    
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onloadend = async () => {
      const base64data = reader.result?.toString().split(',')[1];
      if (!base64data) return;

      try {
        const focusPhonemes = content.vocabulary
          .flatMap((v) => v.ai_speech_hints?.focus_phonemes ?? [])
          .slice(0, 5);

        const { data } = await api.post<{ jobId: number }>("/jobs/pronunciation-eval", {
          originalText: currentDrill.text,
          audioBase64: base64data,
          filename: `recording.${extension}`,
          focusPhonemes,
        });

        sseCtrlRef.current = subscribeToJobSse<PronunciationFeedback>(
          data.jobId,
          (result) => {
            setFeedback(result);
            setEvaluating(false);

            if (result.overall_score >= 80) {
              setCompletedDrills((prev) => {
                const next = new Set(prev).add(currentDrillIndex);
                if (next.size >= drills.length * 0.8) {
                  markTabCompleted("speaking", result.overall_score);
                }
                return next;
              });
            }
          },
          (errMsg) => {
            setError(errMsg);
            setEvaluating(false);
          }
        );

      } catch {
        setError("Đánh giá thất bại. Vui lòng thử lại.");
        setEvaluating(false);
      }
    };
  }, [currentDrillIndex, currentDrill, content.vocabulary, drills.length, markTabCompleted]);

  // Keep the ref updated with the latest closure
  useEffect(() => {
    handleRecordingCompleteRef.current = handleRecordingComplete;
  }, [handleRecordingComplete]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  if (drills.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 bg-ga-card rounded-ga border border-ga-line">
        <span className="text-4xl mb-3">🎤</span>
        <p className="text-sm text-ga-muted">Chưa có bài luyện nói cho bài học này.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Current drill card ── */}
      <div className="rounded-ga bg-gradient-to-br from-ga-ink to-ga-ink p-4 lg:p-6 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold text-ga-yellow uppercase">
            Bài {currentDrillIndex + 1} / {drills.length}
          </span>
          <div className="flex min-w-0 flex-wrap justify-end gap-1">
            {drills.map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i === currentDrillIndex ? "bg-ga-yellow" :
                  i < currentDrillIndex ? "bg-ga-green" : "bg-ga-card/20"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="text-center space-y-2">
          <p className="text-lg lg:text-xl font-bold text-white break-words">{currentDrill.text}</p>
          <p className="text-sm text-white/50">{currentDrill.hint}</p>
        </div>

        <div className="flex justify-center">
          <AudioButton text={currentDrill.speak} />
        </div>
      </div>

      {/* ── Waveform canvas ── */}
      <div className="rounded-ga bg-ga-ink p-4">
        <canvas
          ref={canvasRef}
          width={600}
          height={80}
          className="w-full h-20 rounded-ga"
        />
      </div>

      {/* ── Recording controls ── */}
      <div className="flex items-center justify-center gap-4">
        {!recording ? (
          <button
            type="button"
            onClick={startRecording}
            disabled={evaluating}
            className="w-16 h-16 rounded-full bg-ga-red flex items-center justify-center text-white hover:scale-105 active:scale-95 transition-transform shadow-ga-card-hover disabled:opacity-50"
          >
            {evaluating ? <Loader2 size={24} className="animate-spin" /> : <Mic size={24} />}
          </button>
        ) : (
          <button
            type="button"
            onClick={stopRecording}
            className="w-16 h-16 rounded-full bg-ga-red flex items-center justify-center text-white animate-pulse hover:scale-105 active:scale-95 transition-transform shadow-ga-card-hover"
          >
            <Square size={20} />
          </button>
        )}

        {feedback && (
          <button
            type="button"
            onClick={() => { setFeedback(null); startRecording(); }}
            className="w-10 h-10 rounded-full bg-ga-surface flex items-center justify-center text-ga-muted hover:bg-ga-line transition-colors"
          >
            <RotateCcw size={16} />
          </button>
        )}
      </div>

      {recording && <p className="text-center text-xs text-ga-red animate-pulse">🎙️ Đang ghi âm...</p>}
      {evaluating && <p className="text-center text-xs text-ga-muted">🤖 Đang đánh giá phát âm...</p>}
      {error && <p className="text-center text-xs text-ga-red">{error}</p>}

      {/* ── Feedback ── */}
      {feedback && (
        <div className="rounded-ga bg-ga-card border border-ga-line p-4 space-y-3 animate-in fade-in duration-300">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold ${
              feedback.overall_score >= 80 ? "bg-ga-green-soft text-ga-green" :
              feedback.overall_score >= 50 ? "bg-ga-yellow-soft text-ga-orange" :
              "bg-ga-red-soft text-ga-red"
            }`}>
              {feedback.overall_score}
            </div>
            <div>
              <p className="text-sm font-bold text-ga-ink">
                {feedback.overall_score >= 80 ? "Rất tốt! 🎉" : feedback.overall_score >= 50 ? "Khá! Cần cải thiện" : "Cần luyện thêm"}
              </p>
              <p className="text-xs text-ga-muted">Điểm phát âm</p>
            </div>
          </div>
          
          <div className="bg-ga-surface rounded-ga p-3 border border-ga-line">
            <p className="text-xs font-bold text-ga-muted uppercase mb-1">🎙️ Hệ thống nghe được:</p>
            {feedback.transcribed ? (
              <p className="text-sm italic text-ga-ink">{'"'}{feedback.transcribed}{'"'}</p>
            ) : (
              <p className="text-sm text-ga-red font-medium">
                [Không thu được tiếng — Vui lòng nói to và rõ hơn]
              </p>
            )}
          </div>

          {/* Word-by-word feedback */}
          <div className="flex flex-wrap gap-1">
            {feedback.words.map((w, i) => (
              <span
                key={i}
                className={`text-sm px-2 py-0.5 rounded-ga ${
                  w.score === "correct" ? "bg-ga-green-soft text-ga-green" :
                  w.score === "minor_error" ? "bg-ga-yellow-soft text-ga-orange" :
                  "bg-ga-red-soft text-ga-red"
                }`}
                title={w.feedback}
              >
                {w.word}
                {w.score === "correct" && " ✓"}
                {w.score === "minor_error" && " ⚠"}
                {w.score === "major_error" && " ✕"}
              </span>
            ))}
          </div>

          {/* Tips */}
          {feedback.tips.length > 0 && (
            <div className="bg-ga-yellow-soft rounded-ga p-3 space-y-1">
              <p className="text-xs font-bold text-ga-orange">💡 Gợi ý:</p>
              {feedback.tips.map((tip, i) => (
                <p key={i} className="text-xs text-ga-orange">• {tip}</p>
              ))}
            </div>
          )}

          {/* Next drill */}
          {currentDrillIndex < drills.length - 1 && (
            <button
              type="button"
              onClick={() => { setCurrentDrillIndex((i) => i + 1); setFeedback(null); }}
              className="w-full py-2.5 rounded-ga bg-ga-ink text-white text-sm font-bold hover:bg-ga-ink transition-colors"
            >
              Bài tiếp theo →
            </button>
          )}
        </div>
      )}

      {/* ── Completion Status ── */}
      {isCompleted && (
        <div className="mt-4 rounded-ga bg-ga-green-soft border border-ga-green/40 p-4 text-center">
          <p className="text-sm font-bold text-ga-green">✅ {tLearn("speakingSuccess")}</p>
        </div>
      )}
    </div>
  );
}
