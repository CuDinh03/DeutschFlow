"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { TeacherShell } from "@/components/layouts/TeacherShell";
import { useStudentPracticeSession } from "@/hooks/useStudentPracticeSession";
import api from "@/lib/api";
import { format } from "date-fns";
import { Users, BarChart2, BookOpen, AlertCircle, TrendingUp, Plus } from "lucide-react";

interface ClassStudent {
  studentId: number;
  displayName: string;
  email: string;
  xp: number;
  level: number;
  cefrLevel: string;
}

interface ClassAnalytics {
  errorCode: string;
  count: number;
}

interface ClassAssignment {
  id: number;
  classId: number;
  topic: string;
  description: string;
  createdAt: string;
}

export default function ClassDetailPage() {
  const router = useRouter();
  const { id } = useParams();
  const { me: user, loading: userLoading } = useStudentPracticeSession({ requireStudent: false });
  
  const [activeTab, setActiveTab] = useState<"students" | "analytics" | "assignments">("students");
  const [students, setStudents] = useState<ClassStudent[]>([]);
  const [analytics, setAnalytics] = useState<ClassAnalytics[]>([]);
  const [assignments, setAssignments] = useState<ClassAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  const [newTopic, setNewTopic] = useState("");
  const [newDesc, setNewDesc] = useState("");

  useEffect(() => {
    if (!user) return;
    if (user.role !== "TEACHER" && user.role !== "ADMIN") {
      router.push("/dashboard");
      return;
    }
    fetchData();
  }, [user, id]);

  const fetchData = async () => {
    try {
      const [studentsRes, analyticsRes, assignmentsRes] = await Promise.all([
        api.get<ClassStudent[]>(`/v2/teacher/classes/${id}/students`),
        api.get<ClassAnalytics[]>(`/v2/teacher/classes/${id}/analytics`),
        api.get<ClassAssignment[]>(`/v2/teacher/classes/${id}/assignments`),
      ]);
      setStudents(studentsRes.data || []);
      setAnalytics(analyticsRes.data || []);
      setAssignments(assignmentsRes.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopic) return;
    try {
      await api.post(`/v2/teacher/classes/${id}/assignments`, {
        topic: newTopic,
        description: newDesc,
      });
      setNewTopic("");
      setNewDesc("");
      fetchData(); // Refresh assignments
    } catch (e) {
      console.error(e);
    }
  };

  if (!user || userLoading || loading) return null;

  return (
    <TeacherShell
      activeMenu="classes"
      userName={user.displayName}
      onLogout={() => {
        localStorage.removeItem("auth_token");
        window.location.href = "/login";
      }}
      headerTitle={`Chi tiết lớp học`}
      headerSubtitle="Quản lý học viên, giao bài tập & phân tích"
    >
      <div className="p-8 max-w-5xl mx-auto space-y-6">
        
        {/* Tabs */}
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab("students")}
            className={`px-6 py-3 font-semibold text-sm flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === "students" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Users size={18} /> Danh sách Học viên
          </button>
          <button
            onClick={() => setActiveTab("analytics")}
            className={`px-6 py-3 font-semibold text-sm flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === "analytics" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <BarChart2 size={18} /> Phân tích Lỗi (Analytics)
          </button>
          <button
            onClick={() => setActiveTab("assignments")}
            className={`px-6 py-3 font-semibold text-sm flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === "assignments" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <BookOpen size={18} /> Giao bài tập AI
          </button>
        </div>

        {/* Tab: Students */}
        {activeTab === "students" && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-sm">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Học viên</th>
                    <th className="px-6 py-4 font-semibold">Trình độ</th>
                    <th className="px-6 py-4 font-semibold text-right">Tổng XP</th>
                    <th className="px-6 py-4 font-semibold text-center">Level (Streak)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {students.map((student) => (
                    <tr key={student.studentId} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-800">{student.displayName}</div>
                        <div className="text-sm text-slate-500">{student.email}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold">
                          {student.cefrLevel}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-bold text-slate-700">
                        {student.xp.toLocaleString()} XP
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="font-bold text-orange-600 flex items-center justify-center gap-1">
                          🔥 Lv. {student.level}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {students.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                        Lớp học chưa có học viên nào.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab: Analytics */}
        {activeTab === "analytics" && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-6 text-white shadow-md">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-white/20 rounded-xl">
                  <TrendingUp size={24} className="text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-1">Báo cáo Lỗi Ngữ pháp Tổng hợp</h3>
                  <p className="text-indigo-100 text-sm">
                    Hệ thống AI đã tổng hợp lỗi sai từ các phiên giao tiếp của toàn bộ học viên trong lớp. Hãy dựa vào báo cáo này để điều chỉnh giáo án ôn tập.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              {analytics.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  Học viên chưa có dữ liệu giao tiếp AI nào để phân tích.
                </div>
              ) : (
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-sm">
                    <tr>
                      <th className="px-6 py-4 font-semibold">Điểm Ngữ Pháp Thường Sai</th>
                      <th className="px-6 py-4 font-semibold text-right">Số lần sai (Toàn lớp)</th>
                      <th className="px-6 py-4 font-semibold text-center">Mức độ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {analytics.map((item, idx) => (
                      <tr key={item.errorCode} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-medium text-slate-800">
                          {item.errorCode}
                        </td>
                        <td className="px-6 py-4 text-right font-mono font-bold text-rose-600">
                          {item.count} lỗi
                        </td>
                        <td className="px-6 py-4 text-center">
                          {idx === 0 ? (
                            <span className="bg-rose-100 text-rose-700 px-2 py-1 rounded text-xs font-bold">Nghiêm trọng</span>
                          ) : idx < 3 ? (
                            <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-xs font-bold">Cần lưu ý</span>
                          ) : (
                            <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold">Bình thường</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Tab: Assignments */}
        {activeTab === "assignments" && (
          <div className="space-y-8">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              <h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center gap-2">
                <Plus size={20} className="text-indigo-600" />
                Giao chủ đề Luyện Nói AI
              </h3>
              <form onSubmit={handleCreateAssignment} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Chủ đề (Topic)</label>
                  <input
                    type="text"
                    value={newTopic}
                    onChange={(e) => setNewTopic(e.target.value)}
                    placeholder="VD: Mô tả một kỳ nghỉ hè đáng nhớ của bạn"
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Ghi chú thêm (Tuỳ chọn)</label>
                  <textarea
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder="Yêu cầu học sinh sử dụng thì Quá khứ hoàn thành (Plusquamperfekt)..."
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none h-24 resize-none"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl font-bold transition-colors"
                  >
                    Giao bài cho lớp
                  </button>
                </div>
              </form>
            </div>

            <div className="space-y-4">
              <h3 className="font-bold text-lg text-slate-800">Lịch sử giao bài ({assignments.length})</h3>
              {assignments.length === 0 ? (
                <div className="text-center py-8 text-slate-500 border border-dashed rounded-2xl">
                  Chưa có bài tập nào được giao.
                </div>
              ) : (
                <div className="grid gap-4">
                  {assignments.map((assignment) => (
                    <div key={assignment.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex justify-between items-center">
                      <div>
                        <h4 className="font-bold text-slate-800 text-lg">{assignment.topic}</h4>
                        {assignment.description && <p className="text-slate-500 text-sm mt-1">{assignment.description}</p>}
                      </div>
                      <div className="text-right text-sm text-slate-400">
                        <p>Giao ngày</p>
                        <p className="font-bold text-slate-600">{format(new Date(assignment.createdAt), "dd/MM/yyyy HH:mm")}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </TeacherShell>
  );
}
