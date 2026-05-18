"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { TeacherShell } from "@/components/layouts/TeacherShell";
import api from "@/lib/api";
import { logout } from "@/lib/authSession";
import { format } from "date-fns";
import { Users, BarChart2, BookOpen, AlertCircle, TrendingUp, Plus, Trophy, Trash2, FileBarChart, Mail, Pencil, Check, X } from "lucide-react";

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

interface ClassAnalyticsOverview {
  studentCount: number;
  totalXp: number;
  completedAssignments: number;
  topErrors: ClassAnalytics[];
}

interface LeaderboardDto {
  rank: number;
  userId: number;
  displayName: string;
  totalXp: number;
  level: number;
}

interface ClassAssignment {
  id: number;
  classId: number;
  topic: string;
  description: string;
  createdAt: string;
}

interface AuthMe {
  displayName: string;
  role: string;
  userId?: number;
  email?: string | null;
}

export default function ClassDetailPage() {
  const router = useRouter();
  const { id } = useParams();

  const [user, setUser] = useState<AuthMe | null>(null);
  const [pageReady, setPageReady] = useState(false);
  
  const [activeTab, setActiveTab] = useState<"students" | "joinRequests" | "analytics" | "assignments" | "leaderboard" | "reports">("students");
  const [students, setStudents] = useState<ClassStudent[]>([]);
  const [joinRequests, setJoinRequests] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<ClassAnalytics[]>([]);
  const [assignments, setAssignments] = useState<ClassAssignment[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardDto[]>([]);
  const [leaderboardType, setLeaderboardType] = useState<"ALL_TIME" | "WEEKLY">("ALL_TIME");
  const [classReport, setClassReport] = useState<any>(null);
  const [removingStudentId, setRemovingStudentId] = useState<number | null>(null);

  const [newTopic, setNewTopic] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newAssignmentType, setNewAssignmentType] = useState("GENERAL");

  // Rename class state
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [className, setClassName] = useState("");

  // Add student by email state
  const [addEmailValue, setAddEmailValue] = useState("");
  const [isAddingStudent, setIsAddingStudent] = useState(false);
  const [addStudentError, setAddStudentError] = useState("");
  const [analyticsOverview, setAnalyticsOverview] = useState<ClassAnalyticsOverview | null>(null);

  // Step 1: Auth check
  useEffect(() => {
    api.get<AuthMe>("/auth/me")
      .then((res) => {
        const userData = res.data;
        if (userData.role !== "TEACHER" && userData.role !== "ADMIN") {
          router.push("/dashboard");
          return;
        }
        setUser(userData);
      })
      .catch(() => {
        router.push("/login");
      });
  }, [router]);

  // Step 2: Fetch class data once user is confirmed
  useEffect(() => {
    if (!user || !id) return;
    fetchData();
  }, [user, id]);

  const fetchData = async () => {
    try {
      const [studentsRes, joinRequestsRes, analyticsRes, assignmentsRes, leaderboardRes, classReportRes] = await Promise.all([
        api.get<ClassStudent[]>(`/v2/teacher/classes/${id}/students`),
        api.get<any[]>(`/v2/teacher/classes/${id}/join-requests`).catch(() => ({ data: [] })),
        api.get<ClassAnalyticsOverview>(`/v2/teacher/classes/${id}/analytics`).catch(() => ({ data: { topErrors: [], studentCount: 0, totalXp: 0, completedAssignments: 0 } })),
        api.get<ClassAssignment[]>(`/v2/teacher/classes/${id}/assignments`).catch(() => ({ data: [] })),
        api.get<LeaderboardDto[]>(`/v2/teacher/classes/${id}/leaderboard?type=${leaderboardType}`).catch(() => ({ data: [] })),
        api.get(`/teacher/reports/classes/${id}`).catch(() => ({ data: null })),
      ]);
      setStudents(studentsRes.data || []);
      setJoinRequests(joinRequestsRes.data || []);
      const analyticsData = analyticsRes.data as ClassAnalyticsOverview;
      setAnalytics(analyticsData?.topErrors || []);
      setAnalyticsOverview(analyticsData || null);
      setAssignments(assignmentsRes.data || []);
      setLeaderboard(leaderboardRes.data || []);
      setClassReport(classReportRes.data || null);
      // Set class name for rename feature
      if (!className && studentsRes.data) {
        // Fetch class name from classes list
        api.get('/v2/teacher/classes').then(r => {
          const cls = (r.data as any[]).find((c: any) => String(c.id) === String(id));
          if (cls) setClassName(cls.name);
        }).catch(() => {});
      }
    } catch (e) {
      console.error(e);
    } finally {
      setPageReady(true);
    }
  };

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopic) return;
    try {
      await api.post(`/v2/teacher/classes/${id}/assignments`, {
        topic: newTopic,
        description: newDesc,
        assignmentType: newAssignmentType,
        dueDate: newDueDate ? new Date(newDueDate).toISOString() : null,
      });
      setNewTopic("");
      setNewDesc("");
      setNewDueDate("");
      setNewAssignmentType("GENERAL");
      fetchData(); // Refresh assignments
    } catch (e) {
      console.error(e);
    }
  };

  const handleApprove = async (requestId: number) => {
    try {
      await api.post(`/v2/teacher/classes/${id}/join-requests/${requestId}/approve`);
      fetchData();
    } catch (e) {
      console.error(e);
      alert("Lỗi khi duyệt học viên");
    }
  };

  const handleReject = async (requestId: number) => {
    try {
      await api.post(`/v2/teacher/classes/${id}/join-requests/${requestId}/reject`);
      fetchData();
    } catch (e) {
      console.error(e);
      alert("Lỗi khi từ chối học viên");
    }
  };

  const handleRemoveStudent = async (studentId: number, studentName: string) => {
    if (!confirm(`Bạn chắc chắn muốn xóa học viên "${studentName}" khỏi lớp?`)) return;
    setRemovingStudentId(studentId);
    try {
      await api.delete(`/v2/teacher/classes/${id}/students/${studentId}`);
      fetchData();
    } catch (e) {
      console.error(e);
      alert("Lỗi khi xóa học viên");
    } finally {
      setRemovingStudentId(null);
    }
  };

  const handleRenameClass = async () => {
    if (!renameValue.trim() || renameValue.trim() === className) {
      setIsRenaming(false);
      return;
    }
    const oldName = className;
    setClassName(renameValue.trim()); // Optimistic update
    setIsRenaming(false);
    try {
      await api.put(`/teacher/classes/${id}`, { name: renameValue.trim() });
    } catch (e) {
      console.error(e);
      setClassName(oldName); // Revert on failure
      alert("Không thể đổi tên lớp. Vui lòng thử lại.");
    }
  };

  const handleAddStudentByEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addEmailValue.trim()) return;
    setIsAddingStudent(true);
    setAddStudentError("");
    try {
      await api.post(`/v2/teacher/classes/${id}/students`, { email: addEmailValue.trim() });
      setAddEmailValue("");
      fetchData();
    } catch (err: any) {
      setAddStudentError(err.response?.data?.message || err.response?.data?.error || "Không tìm thấy học viên với email này.");
    } finally {
      setIsAddingStudent(false);
    }
  };

  if (!user) return (
    <div className="flex h-screen items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
    </div>
  );

  return (
    <TeacherShell
      activeMenu="classes"
      userName={user.displayName}
      onLogout={() => logout()}
      headerTitle={`Chi tiết lớp học`}
      headerSubtitle="Quản lý học viên, giao bài tập & phân tích"
    >
      <div className="p-8 max-w-5xl mx-auto space-y-6">

        {/* Class Name Header with Rename */}
        <div className="flex items-center gap-3">
          {isRenaming ? (
            <div className="flex items-center gap-2 flex-1">
              <input
                autoFocus
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleRenameClass(); if (e.key === 'Escape') setIsRenaming(false); }}
                className="text-2xl font-black text-slate-800 border-b-2 border-indigo-500 outline-none bg-transparent flex-1 py-1"
              />
              <button onClick={handleRenameClass} className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200"><Check size={18} /></button>
              <button onClick={() => setIsRenaming(false)} className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200"><X size={18} /></button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-slate-800">{className || `Lớp #${id}`}</h1>
              <button
                onClick={() => { setRenameValue(className); setIsRenaming(true); }}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                title="Đổi tên lớp"
              ><Pencil size={15} /></button>
            </div>
          )}
        </div>
        
        {/* Tabs */}
        <div className="flex border-b border-slate-200 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setActiveTab("students")}
            className={`px-6 py-3 font-semibold text-sm flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === "students" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Users size={18} /> Danh sách Học viên
          </button>
          <button
            onClick={() => setActiveTab("joinRequests")}
            className={`px-6 py-3 font-semibold text-sm flex items-center gap-2 border-b-2 transition-colors relative whitespace-nowrap shrink-0 ${
              activeTab === "joinRequests" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <AlertCircle size={18} /> Duyệt Học Viên
            {joinRequests.length > 0 && (
              <span className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">
                {joinRequests.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("analytics")}
            className={`px-6 py-3 font-semibold text-sm flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === "analytics" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <BarChart2 size={18} /> Phân tích Lỗi (Analytics)
          </button>
          <button
            onClick={() => setActiveTab("assignments")}
            className={`px-6 py-3 font-semibold text-sm flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === "assignments" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <BookOpen size={18} /> Giao bài tập AI
          </button>
          <button
            onClick={() => setActiveTab("leaderboard")}
            className={`px-6 py-3 font-semibold text-sm flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === "leaderboard" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Trophy size={18} /> Bảng xếp hạng
          </button>
          <button
            onClick={() => setActiveTab("reports")}
            className={`px-6 py-3 font-semibold text-sm flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === "reports" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <FileBarChart size={18} /> Báo cáo Lớp
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
                    <th className="px-6 py-4 font-semibold text-center">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {students.map((student) => (
                    <tr 
                      key={student.studentId} 
                      className="hover:bg-indigo-50/50 transition-colors group"
                    >
                      <td className="px-6 py-4 cursor-pointer" onClick={() => router.push(`/teacher/dashboard/${id}/students/${student.studentId}`)}>
                        <div className="font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{student.displayName}</div>
                        <div className="text-sm text-slate-500">{student.email}</div>
                      </td>
                      <td className="px-6 py-4 cursor-pointer" onClick={() => router.push(`/teacher/dashboard/${id}/students/${student.studentId}`)}>  
                        <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold">
                          {student.cefrLevel}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-bold text-slate-700 cursor-pointer" onClick={() => router.push(`/teacher/dashboard/${id}/students/${student.studentId}`)}>
                        {student.xp.toLocaleString()} XP
                      </td>
                      <td className="px-6 py-4 text-center cursor-pointer" onClick={() => router.push(`/teacher/dashboard/${id}/students/${student.studentId}`)}>  
                        <span className="font-bold text-orange-600 flex items-center justify-center gap-1">
                          🔥 Lv. {student.level}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => handleRemoveStudent(student.studentId, student.displayName)}
                          disabled={removingStudentId === student.studentId}
                          className="p-2 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors disabled:opacity-50"
                          title="Xóa khỏi lớp"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {students.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                        Lớp học chưa có học viên nào.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {/* Add student by email */}
            <div className="border-t border-slate-100 px-6 py-4 bg-slate-50">
              <form onSubmit={handleAddStudentByEmail} className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    value={addEmailValue}
                    onChange={e => setAddEmailValue(e.target.value)}
                    placeholder="Thêm học viên bằng email..."
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm bg-white"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isAddingStudent || !addEmailValue.trim()}
                  className="px-4 py-2.5 bg-indigo-600 text-white font-bold rounded-xl text-sm hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Plus size={15} /> Thêm học viên
                </button>
              </form>
              {addStudentError && (
                <p className="text-rose-600 text-xs font-medium mt-2 ml-1">{addStudentError}</p>
              )}
            </div>
          </div>
        )}

        {/* Tab: Join Requests */}
        {activeTab === "joinRequests" && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-sm">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Học viên xin tham gia</th>
                    <th className="px-6 py-4 font-semibold text-right">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {joinRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-800">{req.studentName}</div>
                        <div className="text-sm text-slate-500">{req.studentEmail}</div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleApprove(req.id)}
                          className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 px-4 py-2 rounded-lg font-semibold text-sm transition-colors mr-2"
                        >
                          Phê Duyệt
                        </button>
                        <button
                          onClick={() => handleReject(req.id)}
                          className="bg-rose-100 text-rose-700 hover:bg-rose-200 px-4 py-2 rounded-lg font-semibold text-sm transition-colors"
                        >
                          Từ Chối
                        </button>
                      </td>
                    </tr>
                  ))}
                  {joinRequests.length === 0 && (
                    <tr>
                      <td colSpan={2} className="px-6 py-12 text-center text-slate-500">
                        Không có yêu cầu tham gia nào đang chờ duyệt.
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

            {/* Overview Cards */}
            {analyticsOverview && (
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm text-center">
                  <p className="text-3xl font-black text-indigo-600">{analyticsOverview.studentCount ?? 0}</p>
                  <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mt-1">Học viên</p>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm text-center">
                  <p className="text-3xl font-black text-amber-500">{(analyticsOverview.totalXp ?? 0).toLocaleString()}</p>
                  <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mt-1">Tổng XP</p>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm text-center">
                  <p className="text-3xl font-black text-emerald-600">{analyticsOverview.completedAssignments ?? 0}</p>
                  <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mt-1">Bài tập hoàn thành</p>
                </div>
              </div>
            )}

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
                    {Array.isArray(analytics) && analytics.map((item, idx) => (
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Loại bài tập</label>
                    <select
                      value={newAssignmentType}
                      onChange={(e) => setNewAssignmentType(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                    >
                      <option value="GENERAL">Bài tập chung (Tự do)</option>
                      <option value="SPEAKING_SCENARIO">Luyện Nói (Speaking Scenario)</option>
                      <option value="VOCABULARY">Từ Vựng (Vocabulary)</option>
                      <option value="GRAMMAR">Ngữ Pháp (Grammar)</option>
                      <option value="ESSAY">Viết luận (Essay)</option>
                      <option value="MOCK_TEST">Thi thử (Mock Test)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Hạn nộp (Due Date)</label>
                    <input
                      type="datetime-local"
                      value={newDueDate}
                      onChange={(e) => setNewDueDate(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                    />
                  </div>
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

        {/* Tab: Leaderboard */}
        {activeTab === "leaderboard" && (
          <div className="space-y-6">
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setLeaderboardType("ALL_TIME"); setTimeout(fetchData, 100); }}
                className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${leaderboardType === "ALL_TIME" ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                Toàn thời gian
              </button>
              <button
                onClick={() => { setLeaderboardType("WEEKLY"); setTimeout(fetchData, 100); }}
                className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${leaderboardType === "WEEKLY" ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                Tuần này
              </button>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-sm">
                  <tr>
                    <th className="px-6 py-4 font-semibold text-center w-16">Hạng</th>
                    <th className="px-6 py-4 font-semibold">Học viên</th>
                    <th className="px-6 py-4 font-semibold text-right">Tổng XP</th>
                    <th className="px-6 py-4 font-semibold text-center">Level</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {leaderboard.map((student) => (
                    <tr key={student.userId} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-center font-bold text-xl text-slate-400">
                        {student.rank === 1 ? "🥇" : student.rank === 2 ? "🥈" : student.rank === 3 ? "🥉" : `#${student.rank}`}
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-800">
                        {student.displayName}
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-bold text-amber-500">
                        {student.totalXp.toLocaleString()} XP
                      </td>
                      <td className="px-6 py-4 text-center font-bold text-indigo-600">
                        Lv. {student.level}
                      </td>
                    </tr>
                  ))}
                  {leaderboard.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                        Chưa có dữ liệu bảng xếp hạng.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {/* Tab: Reports */}
        {activeTab === "reports" && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl p-6 text-white shadow-md">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-white/20 rounded-xl">
                    <FileBarChart size={24} className="text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-1">Báo cáo Chi tiết Lớp học</h3>
                    <p className="text-emerald-100 text-sm">Tổng hợp hiệu suất quiz, số học viên và điểm trung bình của lớp.</p>
                  </div>
                </div>
                {classReport && (
                  <button
                    onClick={() => {
                      const BOM = '\uFEFF';
                      const rows = [
                        ['Báo cáo Lớp học', `Lớp #${id}`],
                        [''],
                        ['Chỉ số', 'Giá trị'],
                        ['Số học viên', classReport.studentCount ?? 0],
                        ['Quiz đã tổ chức', classReport.quizCount ?? 0],
                        ['Điểm trung bình', Number(classReport.avgScore ?? 0).toFixed(2)],
                        [''],
                        ['Danh sách học viên'],
                        ['Tên', 'Email', 'CEFR', 'XP', 'Level'],
                        ...students.map(s => [s.displayName, s.email, s.cefrLevel, s.xp, s.level]),
                      ];
                      const csv = BOM + rows.map(r => r.join(',')).join('\n');
                      const a = document.createElement('a');
                      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
                      a.download = `bao-cao-lop-${id}.csv`;
                      a.click();
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-bold transition-colors"
                  >
                    <FileBarChart size={15} /> Xuất CSV
                  </button>
                )}
              </div>
            </div>

            {classReport ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm text-center">
                  <p className="text-4xl font-black text-indigo-600">{classReport.studentCount ?? 0}</p>
                  <p className="text-slate-500 text-sm mt-2 font-semibold">Học viên</p>
                </div>
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm text-center">
                  <p className="text-4xl font-black text-emerald-600">{classReport.quizCount ?? 0}</p>
                  <p className="text-slate-500 text-sm mt-2 font-semibold">Quiz đã tổ chức</p>
                </div>
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm text-center">
                  <p className="text-4xl font-black text-amber-500">{Number(classReport.avgScore ?? 0).toFixed(1)}</p>
                  <p className="text-slate-500 text-sm mt-2 font-semibold">Điểm trung bình</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-slate-500 border border-dashed rounded-2xl">
                Chưa có dữ liệu báo cáo quiz cho lớp học này.
              </div>
            )}
          </div>
        )}


      </div>
    </TeacherShell>
  );
}
