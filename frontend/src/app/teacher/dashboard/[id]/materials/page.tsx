"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, FileText, Presentation, Loader2, CheckCircle2,
  AlertCircle, Download, Sparkles, X
} from "lucide-react";

type JobStatus = "idle" | "uploading" | "processing" | "done" | "error";

export default function TeacherMaterialsPage() {
  const params = useParams();
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<JobStatus>("idle");
  const [progress, setProgress] = useState<string>("");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadName, setDownloadName] = useState("Baigiang.pptx");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Cleanup SSE on unmount
  useEffect(() => () => { esRef.current?.close(); }, []);

  const reset = () => {
    esRef.current?.close();
    setFile(null);
    setStatus("idle");
    setProgress("");
    setDownloadUrl(null);
    setErrorMsg(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { setFile(f); setErrorMsg(null); }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f && (f.name.endsWith(".pdf") || f.name.endsWith(".docx"))) {
      setFile(f);
      setErrorMsg(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setStatus("uploading");
    setProgress("Đang tải lên...");
    setErrorMsg(null);
    setDownloadUrl(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const token = localStorage.getItem("accessToken") ?? "";
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";
      const res = await fetch(`${apiBase}/api/teacher/materials/generate-pptx`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Lỗi tải lên tài liệu");
      }

      const data = await res.json();
      const jobId: string = data.jobId;

      setStatus("processing");
      setProgress("AI đang phân tích và tạo bài giảng...");

      // SSE stream
      const sseUrl = `${apiBase}/api/teacher/materials/jobs/${jobId}/sse`;
      const es = new EventSource(sseUrl + `?access_token=${encodeURIComponent(token)}`);
      esRef.current = es;

      es.addEventListener("COMPLETED", (e: any) => {
        es.close();
        try {
          const payload = JSON.parse(e.data);
          if (payload.fileData) {
            const blob = b64toBlob(payload.fileData, "application/vnd.openxmlformats-officedocument.presentationml.presentation");
            const url = URL.createObjectURL(blob);
            const fname = `BaiGiang_${file.name.replace(/\.[^.]+$/, "")}.pptx`;
            setDownloadUrl(url);
            setDownloadName(fname);
          } else if (payload.downloadUrl) {
            setDownloadUrl(payload.downloadUrl);
          }
        } catch { /* still allow user to download via link */ }
        setStatus("done");
        setProgress("Hoàn tất! Bài giảng đã sẵn sàng.");
      });

      es.addEventListener("FAILED", (e: any) => {
        es.close();
        setStatus("error");
        setErrorMsg(e.data ?? "Xử lý thất bại. Vui lòng thử lại.");
      });

      es.onerror = () => {
        es.close();
        setStatus("error");
        setErrorMsg("Mất kết nối với server. Vui lòng thử lại.");
      };

    } catch (err: any) {
      setStatus("error");
      setErrorMsg(err.message ?? "Đã xảy ra lỗi không mong muốn.");
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-6 md:p-10">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] flex items-center justify-center">
              <Sparkles size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-[#0F172A]">Tạo Bài Giảng AI</h1>
              <p className="text-sm text-[#64748B]">Lớp #{params.id} · Tự động sinh slide PowerPoint từ tài liệu</p>
            </div>
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
          {/* Upload Zone */}
          <AnimatePresence mode="wait">
            {status === "idle" && (
              <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  className="p-8"
                >
                  <label
                    htmlFor="material-file"
                    className="flex flex-col items-center justify-center gap-4 border-2 border-dashed border-[#CBD5E1] rounded-xl p-10 cursor-pointer hover:border-[#6366F1] hover:bg-[#F5F3FF] transition-all group"
                  >
                    <div className="w-16 h-16 rounded-2xl bg-[#EEF2FF] flex items-center justify-center group-hover:bg-[#6366F1]/20 transition-colors">
                      <Upload size={28} className="text-[#6366F1]" />
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-[#0F172A] mb-1">Kéo thả hoặc bấm để chọn file</p>
                      <p className="text-sm text-[#94A3B8]">Hỗ trợ PDF và DOCX · Tối đa 20MB</p>
                    </div>
                    <input
                      ref={fileRef}
                      id="material-file"
                      type="file"
                      accept=".pdf,.docx"
                      className="sr-only"
                      onChange={handleFileChange}
                    />
                  </label>

                  {/* Selected file */}
                  {file && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-4 flex items-center gap-3 p-4 bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl"
                    >
                      <FileText size={20} className="text-[#10B981] flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[#0F172A] truncate">{file.name}</p>
                        <p className="text-xs text-[#64748B]">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                      <button onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ""; }}>
                        <X size={16} className="text-[#94A3B8] hover:text-[#0F172A]" />
                      </button>
                    </motion.div>
                  )}

                  <button
                    onClick={handleUpload}
                    disabled={!file}
                    className="mt-6 w-full py-3.5 rounded-xl font-bold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: "linear-gradient(135deg, #6366F1, #8B5CF6)" }}
                  >
                    <Sparkles size={16} className="inline mr-2" />
                    Tạo bài giảng PPTX
                  </button>
                </div>
              </motion.div>
            )}

            {(status === "uploading" || status === "processing") && (
              <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="p-10 flex flex-col items-center gap-6">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full border-4 border-[#EEF2FF] flex items-center justify-center">
                    <Loader2 size={36} className="text-[#6366F1] animate-spin" />
                  </div>
                </div>
                <div className="text-center">
                  <p className="font-bold text-[#0F172A] text-lg mb-1">{progress}</p>
                  <p className="text-sm text-[#64748B]">Quá trình này có thể mất 30–90 giây</p>
                </div>
                <div className="w-full bg-[#F1F5F9] rounded-full h-2 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-[#6366F1] to-[#8B5CF6]"
                    animate={{ width: status === "uploading" ? "30%" : "80%" }}
                    transition={{ duration: 2, ease: "easeOut" }}
                  />
                </div>
              </motion.div>
            )}

            {status === "done" && (
              <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                className="p-10 flex flex-col items-center gap-6">
                <div className="w-20 h-20 rounded-full bg-[#F0FDF4] flex items-center justify-center">
                  <CheckCircle2 size={40} className="text-[#10B981]" />
                </div>
                <div className="text-center">
                  <p className="font-black text-xl text-[#0F172A] mb-1">Bài giảng đã sẵn sàng! 🎉</p>
                  <p className="text-sm text-[#64748B]">File PowerPoint đã được tạo từ tài liệu của bạn</p>
                </div>
                {downloadUrl ? (
                  <a
                    href={downloadUrl}
                    download={downloadName}
                    className="flex items-center gap-2 px-6 py-3.5 rounded-xl font-bold text-white"
                    style={{ background: "linear-gradient(135deg, #10B981, #059669)" }}
                  >
                    <Download size={18} /> Tải xuống PPTX
                  </a>
                ) : (
                  <p className="text-sm text-[#64748B]">File đang được chuẩn bị để tải xuống...</p>
                )}
                <button onClick={reset} className="text-sm text-[#6366F1] hover:underline">
                  Tạo bài giảng khác
                </button>
              </motion.div>
            )}

            {status === "error" && (
              <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="p-10 flex flex-col items-center gap-5">
                <div className="w-20 h-20 rounded-full bg-[#FEF2F2] flex items-center justify-center">
                  <AlertCircle size={40} className="text-[#EF4444]" />
                </div>
                <div className="text-center">
                  <p className="font-bold text-[#0F172A] mb-1">Đã xảy ra lỗi</p>
                  <p className="text-sm text-[#64748B] max-w-sm">{errorMsg}</p>
                </div>
                <button
                  onClick={reset}
                  className="px-6 py-2.5 rounded-xl border border-[#E2E8F0] font-semibold text-sm text-[#0F172A] hover:bg-[#F8FAFC] transition-colors"
                >
                  Thử lại
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Info */}
        <div className="mt-6 grid grid-cols-3 gap-3">
          {[
            { icon: FileText, label: "PDF / DOCX", desc: "Định dạng hỗ trợ" },
            { icon: Sparkles, label: "AI tạo nội dung", desc: "Gemini / GPT-4" },
            { icon: Presentation, label: "PPTX chuẩn", desc: "Mở bằng PowerPoint" },
          ].map(({ icon: Icon, label, desc }) => (
            <div key={label} className="bg-white rounded-xl border border-[#E2E8F0] p-4 text-center">
              <Icon size={20} className="text-[#6366F1] mx-auto mb-2" />
              <p className="font-semibold text-xs text-[#0F172A]">{label}</p>
              <p className="text-[10px] text-[#94A3B8] mt-0.5">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function b64toBlob(b64Data: string, contentType = "", sliceSize = 512): Blob {
  const byteCharacters = atob(b64Data);
  const byteArrays: Uint8Array[] = [];
  for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
    const slice = byteCharacters.slice(offset, offset + sliceSize);
    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) byteNumbers[i] = slice.charCodeAt(i);
    byteArrays.push(new Uint8Array(byteNumbers));
  }
  return new Blob(byteArrays, { type: contentType });
}
