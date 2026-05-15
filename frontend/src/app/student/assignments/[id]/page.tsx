"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import { BookOpen, UploadCloud, CheckCircle2, ArrowLeft, Loader2, FileText } from "lucide-react";
import api from "@/lib/api";
import { StudentShell } from "@/components/layouts/StudentShell";
import { useStudentPracticeSession } from "@/hooks/useStudentPracticeSession";
import { toast } from "sonner";

interface StudentAssignmentDto {
  id: number;
  assignmentId: number;
  studentId: number;
  status: string; // PENDING, SUBMITTED, EVALUATED
  teacherScore: number | null;
  teacherFeedback: string | null;
  submittedAt: string | null;
  createdAt: string;
  topic: string;
  description: string;
  assignmentType: string;
  dueDate: string | null;
  submissionContent: string | null;
  submissionFileUrl: string | null;
}

export default function AssignmentDetailPage() {
  const router = useRouter();
  const { id } = useParams();
  const { me: user, loading: userLoading } = useStudentPracticeSession({ requireStudent: true });
  
  const [assignment, setAssignment] = useState<StudentAssignmentDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Form state
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    fetchAssignment();
  }, [user, id]);

  const fetchAssignment = async () => {
    try {
      // Find the specific assignment from the list
      const res = await api.get<StudentAssignmentDto[]>("/v2/students/assignments");
      const found = res.data?.find(a => a.assignmentId === Number(id));
      if (found) {
        setAssignment(found);
      } else {
        toast.error("Không tìm thấy bài tập");
        router.push("/student/assignments");
      }
    } catch (e) {
      console.error(e);
      toast.error("Lỗi khi tải bài tập");
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      // Check file size (e.g. max 10MB)
      if (selected.size > 10 * 1024 * 1024) {
        toast.error("File quá lớn. Vui lòng chọn file dưới 10MB.");
        return;
      }
      setFile(selected);
    }
  };

  const uploadToS3 = async (fileToUpload: File): Promise<string> => {
    // Get presigned URL
    const presignRes = await api.get<{url: string, objectKey: string}>(
      `/v2/students/assignments/presigned-url?assignmentId=${id}&filename=${fileToUpload.name}&contentType=${fileToUpload.type}`
    );
    const { url, objectKey } = presignRes.data;

    // Upload directly to S3
    const uploadRes = await fetch(url, {
      method: "PUT",
      body: fileToUpload,
      headers: {
        "Content-Type": fileToUpload.type,
      },
    });

    if (!uploadRes.ok) {
      throw new Error("Lỗi khi tải file lên S3");
    }

    // Return the public URL or S3 URI (we assume objectKey is accessible via the base S3 domain)
    // Since we don't know the exact bucket URL, we can reconstruct it from the presigned URL
    const publicUrl = url.split("?")[0];
    return publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && !file) {
      toast.error("Vui lòng nhập nội dung hoặc đính kèm file bài làm.");
      return;
    }

    setSubmitting(true);
    try {
      let submissionFileUrl = "";
      if (file) {
        submissionFileUrl = await uploadToS3(file);
      }

      await api.post(`/v2/students/assignments/${id}/submit`, {
        submissionContent: content,
        submissionFileUrl: submissionFileUrl,
      });

      toast.success("Nộp bài thành công!");
      fetchAssignment(); // Refresh assignment status
    } catch (error) {
      console.error(error);
      toast.error("Có lỗi xảy ra khi nộp bài. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!user || userLoading || loading) return null;
  if (!assignment) return null;

  return (
    <StudentShell
      activeSection="assignments"
      user={{ displayName: user.displayName, role: user.role }}
      targetLevel={user.learningTargetLevel || "A1"}
      streakDays={user.currentStreak || 0}
      initials={user.displayName?.charAt(0) || "DF"}
      onLogout={() => {
        localStorage.removeItem("auth_token");
        window.location.href = "/login";
      }}
      headerTitle="Chi tiết bài tập"
      headerSubtitle="Xem yêu cầu và nộp bài làm"
    >
      <div className="max-w-3xl mx-auto space-y-6">
        <button
          onClick={() => router.push("/student/assignments")}
          className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-indigo-600 transition-colors"
        >
          <ArrowLeft size={16} /> Quay lại danh sách
        </button>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <div className="flex justify-between items-start mb-6 pb-6 border-b border-slate-100">
            <div>
              <h1 className="text-2xl font-bold text-slate-800">{assignment.topic}</h1>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
                  {assignment.assignmentType === "ESSAY" ? "Viết luận" : assignment.assignmentType === "MOCK_TEST" ? "Thi thử" : "Bài tập chung"}
                </span>
                {assignment.dueDate && (
                  <span className="text-sm font-medium text-slate-500">
                    Hạn nộp: {format(new Date(assignment.dueDate), "dd/MM/yyyy HH:mm")}
                  </span>
                )}
              </div>
            </div>
            <div>
              {assignment.status === "PENDING" ? (
                <span className="bg-amber-100 text-amber-700 px-3 py-1.5 rounded-lg text-sm font-bold shadow-sm">
                  Chưa nộp
                </span>
              ) : assignment.status === "SUBMITTED" ? (
                <span className="bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg text-sm font-bold shadow-sm">
                  Đã nộp bài
                </span>
              ) : (
                <span className="bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg text-sm font-bold shadow-sm">
                  Đã có điểm ({assignment.teacherScore}/100)
                </span>
              )}
            </div>
          </div>

          <div className="prose prose-sm max-w-none text-slate-600 mb-8 whitespace-pre-wrap">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-3">
              <BookOpen size={18} className="text-indigo-500" /> Yêu cầu đề bài
            </h3>
            {assignment.description || "Không có mô tả chi tiết."}
          </div>

          {assignment.status === "PENDING" ? (
            <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <UploadCloud size={20} className="text-indigo-500" /> Nộp bài làm của bạn
              </h3>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Nhập nội dung bài làm (Tuỳ chọn)</label>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Bạn có thể nhập trực tiếp bài viết của mình vào đây..."
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none h-40 resize-y bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Đính kèm File (PDF, DOCX)</label>
                  <div 
                    className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:bg-slate-100 transition-colors cursor-pointer bg-white"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" 
                      onChange={handleFileChange}
                    />
                    {file ? (
                      <div className="flex flex-col items-center justify-center">
                        <FileText size={32} className="text-indigo-500 mb-2" />
                        <span className="font-semibold text-slate-700">{file.name}</span>
                        <span className="text-xs text-slate-500 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center">
                        <UploadCloud size={32} className="text-slate-400 mb-2" />
                        <span className="font-medium text-slate-600">Nhấn để tải file lên (Tối đa 10MB)</span>
                        <span className="text-xs text-slate-400 mt-1">Hỗ trợ PDF, Word</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={submitting || (!content.trim() && !file)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {submitting && <Loader2 size={18} className="animate-spin" />}
                    Xác nhận nộp bài
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-indigo-50 rounded-xl p-6 border border-indigo-100">
                <h3 className="text-lg font-bold text-indigo-900 mb-4 flex items-center gap-2">
                  <CheckCircle2 size={20} className="text-indigo-600" /> Bài làm đã nộp
                </h3>
                {assignment.submissionContent && (
                  <div className="bg-white p-4 rounded-lg border border-indigo-100 whitespace-pre-wrap text-sm text-slate-700 mb-4 shadow-sm">
                    {assignment.submissionContent}
                  </div>
                )}
                {assignment.submissionFileUrl && (
                  <div className="flex items-center gap-3">
                    <FileText className="text-indigo-500" />
                    <a 
                      href={assignment.submissionFileUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="font-semibold text-indigo-600 hover:underline"
                    >
                      Xem file đính kèm
                    </a>
                  </div>
                )}
                <div className="mt-4 text-xs text-indigo-400 font-medium">
                  Thời gian nộp: {assignment.submittedAt ? format(new Date(assignment.submittedAt), "dd/MM/yyyy HH:mm") : "N/A"}
                </div>
              </div>

              {assignment.status === "EVALUATED" && (
                <div className="bg-emerald-50 rounded-xl p-6 border border-emerald-100">
                  <h3 className="text-lg font-bold text-emerald-900 mb-3 flex items-center gap-2">
                    Nhận xét từ giáo viên
                  </h3>
                  <p className="text-emerald-800 whitespace-pre-wrap">
                    {assignment.teacherFeedback || "Không có nhận xét bổ sung."}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </StudentShell>
  );
}
