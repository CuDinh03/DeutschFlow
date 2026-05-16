'use client'

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { TeacherShell } from "@/components/layouts/TeacherShell";
import { useStudentPracticeSession } from "@/hooks/useStudentPracticeSession";
import api from "@/lib/api";
import { format } from "date-fns";
import { Mic, CheckCircle, Clock, BookOpen, AlertCircle, PlayCircle, Loader2, Save } from "lucide-react";

interface TeacherSpeakingSessionDto {
  id: number;
  userId: number;
  topic: string;
  cefrLevel: string;
  status: string;
  messageCount: number;
  aiScore: number | null;
  aiFeedback: string | null;
  teacherScore: number | null;
  teacherFeedback: string | null;
  startedAt: string;
  endedAt: string | null;
  reviewedAt: string | null;
}

interface StudentAssignmentDto {
  id: number;
  assignmentId: number;
  studentId: number;
  status: string;
  teacherScore: number | null;
  teacherFeedback: string | null;
  submittedAt: string | null;
  createdAt: string;
  submissionContent: string | null;
  submissionFileUrl: string | null;
}

export default function StudentReviewPage() {
  const router = useRouter();
  const { id: classId, studentId } = useParams();
  const { me: user, loading: userLoading } = useStudentPracticeSession({ requireStudent: false });
  
  const [activeTab, setActiveTab] = useState<"speaking" | "assignments" | "analytics">("speaking");
  const [speakingSessions, setSpeakingSessions] = useState<TeacherSpeakingSessionDto[]>([]);
  const [assignments, setAssignments] = useState<StudentAssignmentDto[]>([]);
  const [loading, setLoading] = useState(true);

  // Analytics state
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab === "analytics" && !analyticsData) {
      fetchAnalytics();
    }
  }, [activeTab]);

  const fetchAnalytics = async () => {
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    try {
      const res = await api.get(`/v2/teacher/classes/${classId}/students/${studentId}/comprehensive-report`);
      setAnalyticsData(res.data);
    } catch (e: any) {
      setAnalyticsError(e.response?.data?.error || "Lỗi tải dữ liệu phân tích");
    } finally {
      setAnalyticsLoading(false);
    }
  };

  // Evaluation Modal State
  const [evalSession, setEvalSession] = useState<TeacherSpeakingSessionDto | null>(null);
  const [evalAssignment, setEvalAssignment] = useState<StudentAssignmentDto | null>(null);
  const [evalScore, setEvalScore] = useState<number | "">("");
  const [evalFeedback, setEvalFeedback] = useState("");
  const [isEvaluating, setIsEvaluating] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (user.role !== "TEACHER" && user.role !== "ADMIN") {
      router.push("/dashboard");
      return;
    }
    fetchData();
  }, [user, classId, studentId]);

  const fetchData = async () => {
    try {
      const [speakingRes, assignmentRes] = await Promise.all([
        api.get<TeacherSpeakingSessionDto[]>(`/v2/teacher/students/${studentId}/speaking-sessions`),
        api.get<StudentAssignmentDto[]>(`/v2/teacher/students/${studentId}/assignments`)
      ]);
      setSpeakingSessions(speakingRes.data || []);
      setAssignments(assignmentRes.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleEvaluate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evalSession || evalScore === "") return;
    setIsEvaluating(true);
    try {
      const res = await api.post(`/v2/teacher/speaking-sessions/${evalSession.id}/evaluate`, {
        teacherScore: Number(evalScore),
        teacherFeedback: evalFeedback
      });
      // Update local state
      setSpeakingSessions((prev) => prev.map(s => s.id === evalSession.id ? res.data : s));
      setEvalSession(null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsEvaluating(false);
    }
  };

  const openEvaluation = (session: TeacherSpeakingSessionDto) => {
    setEvalSession(session);
    setEvalAssignment(null);
    setEvalScore(session.teacherScore ?? "");
    setEvalFeedback(session.teacherFeedback ?? "");
  };

  const openAssignmentEvaluation = (assignment: StudentAssignmentDto) => {
    setEvalAssignment(assignment);
    setEvalSession(null);
    setEvalScore(assignment.teacherScore ?? "");
    setEvalFeedback(assignment.teacherFeedback ?? "");
  };

  const handleEvaluateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evalAssignment || evalScore === "") return;
    setIsEvaluating(true);
    try {
      // Create endpoint in teacher controller if not exists or use existing evaluation endpoint
      // Assuming teacherService has an evaluateAssignment method
      const res = await api.post(`/v2/teacher/assignments/${evalAssignment.id}/evaluate`, {
        teacherScore: Number(evalScore),
        teacherFeedback: evalFeedback
      });
      // Fallback: If no dedicated teacher endpoint, can rely on manual status update or mock it for now.
      setAssignments((prev) => prev.map(a => a.id === evalAssignment.id ? res.data : a));
      setEvalAssignment(null);
    } catch (e) {
      console.error(e);
      alert("Lỗi khi chấm bài tập (Hoặc API chưa được định nghĩa hoàn chỉnh)");
    } finally {
      setIsEvaluating(false);
    }
  };

  if (!user || userLoading || loading) return null;

  return (
    <TeacherShell
      activeMenu="dashboard"
      userName={user.displayName}
      onLogout={() => {
        localStorage.removeItem("auth_token");
        window.location.href = "/login";
      }}
      headerTitle="Review Mode"
      headerSubtitle="Chấm điểm và nhận xét tiến độ học viên"
    >
      <div className="p-8 max-w-5xl mx-auto space-y-6">
        
        {/* Tabs */}
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab("speaking")}
            className={`px-6 py-3 font-semibold text-sm flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === "speaking" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Mic size={18} /> Giao tiếp AI (Speaking)
          </button>
          <button
            onClick={() => setActiveTab("assignments")}
            className={`px-6 py-3 font-semibold text-sm flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === "assignments" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <BookOpen size={18} /> Bài tập (Assignments)
          </button>
          <button
            onClick={() => setActiveTab("analytics")}
            className={`px-6 py-3 font-semibold text-sm flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === "analytics" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <AlertCircle size={18} /> Phân tích AI
          </button>
        </div>

        {/* Tab: Speaking */}
        {activeTab === "speaking" && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-3xl p-6 text-white shadow-md">
              <h3 className="text-xl font-bold mb-2">Đánh giá kỹ năng Nói (Speaking Review)</h3>
              <p className="text-blue-100 text-sm max-w-2xl">
                Lắng nghe lại các đoạn hội thoại của học viên với AI. Hệ thống AI đã chấm điểm sơ bộ và cung cấp phân tích lỗi. Bạn có thể chốt điểm cuối cùng và để lại nhận xét.
              </p>
            </div>

            {speakingSessions.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-3xl border border-dashed border-slate-300">
                <Mic size={48} className="mx-auto text-slate-300 mb-4" />
                <p className="text-slate-500">Học viên chưa thực hiện bài luyện nói nào.</p>
              </div>
            ) : (
              <div className="grid gap-6">
                {speakingSessions.map((session) => (
                  <div key={session.id} className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 overflow-hidden flex flex-col md:flex-row gap-6">
                    <div className="flex-1 space-y-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-bold text-slate-800 text-lg mb-1">{session.topic}</h4>
                          <span className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded text-xs font-bold mr-2">
                            {session.cefrLevel}
                          </span>
                          <span className="text-slate-500 text-sm">
                            {format(new Date(session.startedAt), "dd/MM/yyyy HH:mm")}
                          </span>
                        </div>
                        {session.teacherScore !== null ? (
                          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1">
                            <CheckCircle size={14} /> Đã chấm
                          </div>
                        ) : session.status === "ENDED" ? (
                          <div className="bg-amber-50 border border-amber-200 text-amber-700 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1">
                            <Clock size={14} /> Chờ chấm
                          </div>
                        ) : (
                          <div className="bg-blue-50 border border-blue-200 text-blue-700 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1">
                            <Loader2 size={14} className="animate-spin" /> Đang học
                          </div>
                        )}
                      </div>

                      <div className="bg-slate-50 p-4 rounded-2xl text-sm text-slate-700">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold">Nhận xét từ AI:</span>
                          {session.aiScore !== null && (
                            <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                              Điểm AI: {session.aiScore}/100
                            </span>
                          )}
                        </div>
                        <p className="whitespace-pre-wrap">{session.aiFeedback || "AI chưa đưa ra nhận xét."}</p>
                      </div>

                      <div className="flex items-center gap-4 pt-2">
                        <button 
                          className="flex items-center gap-2 text-indigo-600 font-bold text-sm bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-xl transition-colors"
                          onClick={() => {
                            // Integrate actual audio player/transcript viewer here in future
                            alert("Tính năng xem chi tiết hội thoại (Audio Player & Highlighter) đang được phát triển.");
                          }}
                        >
                          <PlayCircle size={18} /> Xem lại hội thoại
                        </button>
                        <button 
                          className={`flex items-center gap-2 font-bold text-sm px-4 py-2 rounded-xl transition-colors ${
                            session.teacherScore !== null ? "bg-slate-100 text-slate-700 hover:bg-slate-200" : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-md"
                          }`}
                          onClick={() => openEvaluation(session)}
                          disabled={session.status !== "ENDED"}
                        >
                          <Save size={18} /> {session.teacherScore !== null ? "Sửa điểm" : "Đánh giá & Chấm điểm"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab: Assignments */}
        {activeTab === "assignments" && (
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
            <h3 className="text-lg font-bold text-slate-800 mb-6">Trạng thái Bài tập</h3>
            {assignments.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                <BookOpen size={48} className="mx-auto text-slate-300 mb-4" />
                <p className="text-slate-500">Chưa có bài tập nào được giao cho học viên này.</p>
              </div>
            ) : (
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-sm">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Mã Bài Tập (Assignment ID)</th>
                    <th className="px-6 py-4 font-semibold">Trạng thái</th>
                    <th className="px-6 py-4 font-semibold text-right">Điểm số</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {assignments.map((assignment) => (
                    <tr key={assignment.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-800">#{assignment.assignmentId}</td>
                      <td className="px-6 py-4">
                        {assignment.status === "PENDING" && <span className="text-slate-500 font-bold text-sm">Chưa làm</span>}
                        {assignment.status === "SUBMITTED" && <span className="text-blue-600 font-bold text-sm">Đã nộp, chờ chấm</span>}
                        {(assignment.status === "GRADED" || assignment.status === "EVALUATED") && <span className="text-emerald-600 font-bold text-sm">Đã chấm</span>}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-indigo-600">
                        {assignment.teacherScore !== null ? `${assignment.teacherScore}/100` : "-"}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          className={`font-bold text-sm px-4 py-2 rounded-xl transition-colors ${
                            assignment.status === "SUBMITTED" ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                          }`}
                          onClick={() => openAssignmentEvaluation(assignment)}
                          disabled={assignment.status === "PENDING"}
                        >
                          Chấm bài
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Tab: Analytics */}
        {activeTab === "analytics" && (
          <div className="space-y-6">
            {analyticsLoading && <div className="text-center py-12"><Loader2 size={48} className="mx-auto animate-spin text-slate-400 mb-4" /></div>}
            {analyticsError && <div className="p-6 bg-red-50 text-red-600 rounded-2xl">{analyticsError}</div>}
            {analyticsData && (
              <div className="animate-in fade-in duration-300">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  {/* Before Class */}
                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h2 className="text-xl font-bold mb-4 text-slate-700">Trước khi vào lớp</h2>
                    <ul className="space-y-3 text-slate-600">
                      <li className="flex justify-between border-b border-slate-200 pb-2"><span>Bài tập đã làm:</span> <span className="font-bold">{analyticsData.preClassMetrics?.totalAssignmentsCompleted}</span></li>
                      <li className="flex justify-between border-b border-slate-200 pb-2"><span>Điểm trung bình (Bài tập):</span> <span className="font-bold text-amber-600">{analyticsData.preClassMetrics?.averageScore}%</span></li>
                      <li className="flex justify-between border-b border-slate-200 pb-2"><span>Số buổi Speaking:</span> <span className="font-bold">{analyticsData.preClassMetrics?.totalSpeakingSessions}</span></li>
                      <li className="flex justify-between pb-2"><span>Điểm trung bình Speaking:</span> <span className="font-bold text-amber-600">{analyticsData.preClassMetrics?.averageSpeakingScore}%</span></li>
                    </ul>
                  </div>

                  {/* In Class */}
                  <div className="bg-blue-50 p-6 rounded-2xl border border-blue-200 shadow-sm">
                    <h2 className="text-xl font-bold mb-4 text-blue-800">Sau khi vào lớp</h2>
                    <ul className="space-y-3 text-blue-700">
                      <li className="flex justify-between border-b border-blue-200 pb-2"><span>Bài tập đã làm:</span> <span className="font-bold">{analyticsData.inClassMetrics?.totalAssignmentsCompleted}</span></li>
                      <li className="flex justify-between border-b border-blue-200 pb-2"><span>Điểm trung bình (Bài tập):</span> <span className="font-bold text-emerald-600">{analyticsData.inClassMetrics?.averageScore}%</span></li>
                      <li className="flex justify-between border-b border-blue-200 pb-2"><span>Số buổi Speaking:</span> <span className="font-bold">{analyticsData.inClassMetrics?.totalSpeakingSessions}</span></li>
                      <li className="flex justify-between pb-2"><span>Điểm trung bình Speaking:</span> <span className="font-bold text-emerald-600">{analyticsData.inClassMetrics?.averageSpeakingScore}%</span></li>
                    </ul>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-6">
                  <h2 className="text-lg font-bold mb-4 text-slate-800 flex items-center gap-2"><AlertCircle size={20} className="text-red-500"/> Lỗi sai thường gặp (Top Weaknesses)</h2>
                  <ul className="list-disc pl-5 space-y-2 text-slate-600 font-medium">
                    {analyticsData.topWeaknesses?.map((weakness: string, idx: number) => (
                      <li key={idx}>{weakness}</li>
                    ))}
                  </ul>
                </div>

                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-6 rounded-2xl border border-indigo-100 shadow-sm">
                  <h2 className="text-lg font-black mb-4 text-indigo-900 flex items-center">
                    <span className="mr-2 text-2xl">✨</span> Lộ trình Đề xuất (AI Advisory)
                  </h2>
                  <div className="prose prose-indigo max-w-none text-slate-700 whitespace-pre-line font-medium leading-relaxed">
                    {analyticsData.aiAdvisoryReport}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Evaluation Modal */}
      {evalSession && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl relative animate-in fade-in zoom-in duration-200">
            <h2 className="text-2xl font-black text-slate-800 mb-2">Chấm điểm Bài Nói</h2>
            <p className="text-slate-500 mb-6">{evalSession.topic}</p>
            
            <form onSubmit={handleEvaluate} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Điểm số (0-100)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={evalScore}
                  onChange={(e) => setEvalScore(e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none text-lg font-mono"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Nhận xét của Giáo viên</label>
                <textarea
                  value={evalFeedback}
                  onChange={(e) => setEvalFeedback(e.target.value)}
                  placeholder="Nhận xét về ngữ pháp, từ vựng, độ trôi chảy..."
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none h-32 resize-none"
                />
              </div>
              <div className="flex gap-3 justify-end pt-4">
                <button
                  type="button"
                  onClick={() => setEvalSession(null)}
                  className="px-6 py-3 font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isEvaluating || evalScore === ""}
                  className="px-6 py-3 font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50 shadow-md shadow-indigo-200"
                >
                  {isEvaluating && <Loader2 size={18} className="animate-spin" />}
                  Lưu Đánh Giá
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assignment Evaluation Modal */}
      {evalAssignment && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 max-w-2xl w-full shadow-2xl relative animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-black text-slate-800 mb-4">Chấm điểm Bài Tập / Luận</h2>
            
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6 space-y-4">
              <h3 className="font-bold text-slate-700">Bài làm của học viên:</h3>
              {evalAssignment.submissionContent && (
                <div className="bg-white p-4 rounded-lg border border-slate-200 whitespace-pre-wrap text-sm text-slate-700">
                  {evalAssignment.submissionContent}
                </div>
              )}
              {evalAssignment.submissionFileUrl && (
                <div>
                  <a 
                    href={evalAssignment.submissionFileUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-indigo-600 font-bold hover:underline"
                  >
                    <BookOpen size={18} /> Tải / Xem File Đính Kèm
                  </a>
                </div>
              )}
              {!evalAssignment.submissionContent && !evalAssignment.submissionFileUrl && (
                <p className="text-sm text-slate-500 italic">Không có nội dung đính kèm.</p>
              )}
            </div>

            <form onSubmit={handleEvaluateAssignment} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Điểm số (0-100)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={evalScore}
                  onChange={(e) => setEvalScore(e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none text-lg font-mono"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Nhận xét của Giáo viên</label>
                <textarea
                  value={evalFeedback}
                  onChange={(e) => setEvalFeedback(e.target.value)}
                  placeholder="Nhận xét chi tiết về bài làm..."
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none h-32 resize-none"
                />
              </div>
              <div className="flex gap-3 justify-end pt-4">
                <button
                  type="button"
                  onClick={() => setEvalAssignment(null)}
                  className="px-6 py-3 font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isEvaluating || evalScore === ""}
                  className="px-6 py-3 font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50 shadow-md shadow-indigo-200"
                >
                  {isEvaluating && <Loader2 size={18} className="animate-spin" />}
                  Lưu Đánh Giá
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </TeacherShell>
  );
}
