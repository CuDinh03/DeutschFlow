"use client";

import { NodeContent, useNodeSessionStore } from "@/stores/useNodeSessionStore";
import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, Square, RotateCcw, Loader2 } from "lucide-react";
import { AudioButton } from "./LearnComponents";
import api from "@/lib/api";

interface PronunciationFeedback {
  overall_score: number;
  words: Array<{
    word: string;
    score: "correct" | "minor_error" | "major_error";
    feedback?: string;
    ipa_expected?: string;
  }>;
  tips: string[];
}

export default function SpeakingView({ content }: { content: NodeContent }) {
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

  // ── Start Recording ──
  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setFeedback(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Web Audio API for waveform
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      analyserRef.current = analyser;

      // MediaRecorder for capture
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorder.onstop = () => handleRecordingComplete();
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.start();
      setRecording(true);
      drawWaveform();
    } catch {
      setError("Không thể truy cập microphone. Vui lòng cấp quyền.");
    }
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

  // ── Send to Groq LLM for pronunciation evaluation ──
  const handleRecordingComplete = useCallback(async () => {
    if (audioChunksRef.current.length === 0 || !currentDrill) return;
    setEvaluating(true);

    try {
      const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
      const formData = new FormData();
      formData.append("audio", blob, "recording.webm");
      formData.append("originalText", currentDrill.text);

      // Get focus phonemes from vocabulary
      const focusPhonemes = content.vocabulary
        .flatMap((v) => v.ai_speech_hints?.focus_phonemes ?? [])
        .slice(0, 5);
      formData.append("focusPhonemes", JSON.stringify(focusPhonemes));

      const { data } = await api.post<PronunciationFeedback>(
        "/skill-tree/evaluate-pronunciation",
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      setFeedback(data);

      if (data.overall_score >= 80) {
        setCompletedDrills((prev) => {
          const next = new Set(prev).add(currentDrillIndex);
          if (next.size >= drills.length * 0.8) {
            markTabCompleted("speaking");
          }
          return next;
        });
      }
    } catch {
      setError("Đánh giá thất bại. Vui lòng thử lại.");
    } finally {
      setEvaluating(false);
    }
  }, [currentDrillIndex, currentDrill, content.vocabulary, drills.length, markTabCompleted]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  if (drills.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-[#E2E8F0]">
        <span className="text-4xl mb-3">🎤</span>
        <p className="text-sm text-[#64748B]">Chưa có bài luyện nói cho bài học này.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Current drill card ── */}
      <div className="rounded-2xl bg-gradient-to-br from-[#121212] to-[#1E293B] p-6 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-[#FFCD00] uppercase">
            Bài {currentDrillIndex + 1} / {drills.length}
          </span>
          <div className="flex gap-1">
            {drills.map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i === currentDrillIndex ? "bg-[#FFCD00]" :
                  i < currentDrillIndex ? "bg-[#22C55E]" : "bg-white/20"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="text-center space-y-2">
          <p className="text-xl font-bold text-white">{currentDrill.text}</p>
          <p className="text-sm text-white/50">{currentDrill.hint}</p>
        </div>

        <div className="flex justify-center">
          <AudioButton text={currentDrill.speak} />
        </div>
      </div>

      {/* ── Waveform canvas ── */}
      <div className="rounded-xl bg-[#0F172A] p-4">
        <canvas
          ref={canvasRef}
          width={600}
          height={80}
          className="w-full h-20 rounded-lg"
        />
      </div>

      {/* ── Recording controls ── */}
      <div className="flex items-center justify-center gap-4">
        {!recording ? (
          <button
            type="button"
            onClick={startRecording}
            disabled={evaluating}
            className="w-16 h-16 rounded-full bg-[#EF4444] flex items-center justify-center text-white hover:scale-105 active:scale-95 transition-transform shadow-lg disabled:opacity-50"
          >
            {evaluating ? <Loader2 size={24} className="animate-spin" /> : <Mic size={24} />}
          </button>
        ) : (
          <button
            type="button"
            onClick={stopRecording}
            className="w-16 h-16 rounded-full bg-[#EF4444] flex items-center justify-center text-white animate-pulse hover:scale-105 active:scale-95 transition-transform shadow-lg"
          >
            <Square size={20} />
          </button>
        )}

        {feedback && (
          <button
            type="button"
            onClick={() => { setFeedback(null); startRecording(); }}
            className="w-10 h-10 rounded-full bg-[#F1F5F9] flex items-center justify-center text-[#64748B] hover:bg-[#E2E8F0] transition-colors"
          >
            <RotateCcw size={16} />
          </button>
        )}
      </div>

      {recording && <p className="text-center text-xs text-[#EF4444] animate-pulse">🎙️ Đang ghi âm...</p>}
      {evaluating && <p className="text-center text-xs text-[#64748B]">🤖 Đang đánh giá phát âm...</p>}
      {error && <p className="text-center text-xs text-red-500">{error}</p>}

      {/* ── Feedback ── */}
      {feedback && (
        <div className="rounded-xl bg-white border border-[#E2E8F0] p-4 space-y-3 animate-in fade-in duration-300">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold ${
              feedback.overall_score >= 80 ? "bg-green-100 text-green-600" :
              feedback.overall_score >= 50 ? "bg-yellow-100 text-yellow-600" :
              "bg-red-100 text-red-600"
            }`}>
              {feedback.overall_score}
            </div>
            <div>
              <p className="text-sm font-bold text-[#0F172A]">
                {feedback.overall_score >= 80 ? "Rất tốt! 🎉" : feedback.overall_score >= 50 ? "Khá! Cần cải thiện" : "Cần luyện thêm"}
              </p>
              <p className="text-xs text-[#64748B]">Điểm phát âm</p>
            </div>
          </div>

          {/* Word-by-word feedback */}
          <div className="flex flex-wrap gap-1">
            {feedback.words.map((w, i) => (
              <span
                key={i}
                className={`text-sm px-2 py-0.5 rounded-lg ${
                  w.score === "correct" ? "bg-green-50 text-green-700" :
                  w.score === "minor_error" ? "bg-yellow-50 text-yellow-700" :
                  "bg-red-50 text-red-700"
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
            <div className="bg-[#FFFBEB] rounded-lg p-3 space-y-1">
              <p className="text-xs font-bold text-[#92400E]">💡 Gợi ý:</p>
              {feedback.tips.map((tip, i) => (
                <p key={i} className="text-xs text-[#92400E]">• {tip}</p>
              ))}
            </div>
          )}

          {/* Next drill */}
          {currentDrillIndex < drills.length - 1 && (
            <button
              type="button"
              onClick={() => { setCurrentDrillIndex((i) => i + 1); setFeedback(null); }}
              className="w-full py-2.5 rounded-xl bg-[#121212] text-white text-sm font-bold hover:bg-[#1E293B] transition-colors"
            >
              Bài tiếp theo →
            </button>
          )}
        </div>
      )}

      {/* ── Completion Status ── */}
      {isCompleted && (
        <div className="mt-4 rounded-xl bg-green-50 border border-green-200 p-4 text-center">
          <p className="text-sm font-bold text-green-700">✅ Đã hoàn thành phần Nói (≥ 80% bài đạt điểm cao)</p>
        </div>
      )}
    </div>
  );
}
