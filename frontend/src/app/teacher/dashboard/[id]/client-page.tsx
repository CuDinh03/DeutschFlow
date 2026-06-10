"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { TeacherShell } from "@/components/layouts/TeacherShell";
import { GradingPanel } from "@/components/teacher/GradingPanel";
import type { GradingQueueItem } from "@/components/teacher/GradingQueueCard";
import { usePendingGradingCount } from "@/hooks/usePendingGradingCount";
import api from "@/lib/api";
import { logout } from "@/lib/authSession";
import { format } from "date-fns";
import { listMedia, MediaAsset } from "@/lib/mediaApi";
import { ImageUploader } from "@/components/ui/ImageUploader";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Users, BarChart2, BookOpen, AlertCircle, TrendingUp, Plus, Trophy, Trash2, FileBarChart, Mail, Pencil, Check, X, ChevronDown, ChevronUp, Clock, CheckCircle2, FileText, ExternalLink, Loader2 } from "lucide-react";

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
  assignmentType?: string;
  dueDate?: string | null;
  attachmentUrl?: string | null;
  createdAt: string;
}

interface AssignmentSubmission {
  studentId: number;
  studentName: string;
  studentEmail: string;
  submissionId: number | null;
  status: string; // NOT_SUBMITTED | PENDING | SUBMITTED | GRADED | EVALUATED
  score: number | null;
  feedback: string | null;
  submittedAt: string | null;
  gradedAt: string | null;
  submissionContent: string | null;
  submissionFileUrl: string | null;
}

interface AuthMe {
  displayName: string;
  role: string;
  userId?: number;
  email?: string | null;
}

interface ClassTeacherInfo {
  teacherId: number;
  name: string;
  email: string;
  role: string; // PRIMARY | ASSISTANT
  joinedAt: string | null;
}

export default function ClassDetailPage() {
  const router = useRouter();
  const { id } = useParams();

  const [user, setUser] = useState<AuthMe | null>(null);
  const [pageReady, setPageReady] = useState(false);
  const { count: pendingGradingCount, refresh: refreshGradingCount } = usePendingGradingCount()
  
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
  const [newAttachment, setNewAttachment] = useState<File | null>(null);
  const [isCreatingAssignment, setIsCreatingAssignment] = useState(false);

  // S3 Library Modal states
  const [isLibraryModalOpen, setIsLibraryModalOpen] = useState(false);
  const [libraryImages, setLibraryImages] = useState<MediaAsset[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [selectedLibraryImage, setSelectedLibraryImage] = useState<MediaAsset | null>(null);
  const [libraryTab, setLibraryTab] = useState<"my-library" | "upload-new">("my-library");

  const openLibraryModal = async () => {
    setIsLibraryModalOpen(true);
    setLibraryTab("my-library");
    setLibraryLoading(true);
    try {
      const res = await listMedia("ALL", 0, 40);
      const filtered = res.content.filter(item => 
        item.category === 'ASSIGNMENT' || item.category === 'TEACHER_MATERIAL' || item.category === 'GENERAL'
      );
      setLibraryImages(filtered);
    } catch (err) {
      console.error(err);
      toast.error("Không thể tải danh sách ảnh từ S3");
    } finally {
      setLibraryLoading(false);
    }
  };

  const handleLibraryUploadSuccess = (asset: MediaAsset) => {
    setLibraryImages(prev => [asset, ...prev]);
    setSelectedLibraryImage(asset);
    setIsLibraryModalOpen(false);
    toast.success("Đã chọn ảnh vừa tải lên!");
  };

  // Submissions per assignment (lazy loaded)
  const [expandedAssignmentId, setExpandedAssignmentId] = useState<number | null>(null);
  const [submissionsMap, setSubmissionsMap] = useState<Record<number, AssignmentSubmission[]>>({});
  const [submissionsLoading, setSubmissionsLoading] = useState<Record<number, boolean>>({});

  // Grading panel
  const [gradingItem, setGradingItem] = useState<GradingQueueItem | null>(null);

  // Student quick stats (pending submissions per student)
  const [studentPendingMap, setStudentPendingMap] = useState<Record<number, number>>({});

  // Rename class state
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [className, setClassName] = useState("");

  // Add student by email state
  const [addEmailValue, setAddEmailValue] = useState("");
  const [isAddingStudent, setIsAddingStudent] = useState(false);
  const [addStudentError, setAddStudentError] = useState("");

  // Co-teacher state
  const [classTeachers, setClassTeachers] = useState<ClassTeacherInfo[]>([]);
  const [addTeacherEmail, setAddTeacherEmail] = useState("");
  const [isAddingTeacher, setIsAddingTeacher] = useState(false);
  const [addTeacherError, setAddTeacherError] = useState("");
  // userId chưa xác định → vẫn hiện form (backend tự chặn nếu không phải giáo viên chính)
  const isPrimaryTeacher = user?.userId == null
    || classTeachers.some(t => t.teacherId === user.userId && t.role === "PRIMARY");
  const [analyticsOverview, setAnalyticsOverview] = useState<ClassAnalyticsOverview | null>(null);
  const classIdRef = useRef<string | null>(null);

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
  const fetchData = useCallback(async () => {
    if (!id) return;
    const currentClassId = String(id);
    classIdRef.current = currentClassId;
    setPageReady(false);
    setClassName("");
    setRenameValue("");
    setStudents([]);
    setJoinRequests([]);
    setAnalytics([]);
    setAssignments([]);
    setLeaderboard([]);
    setClassReport(null);
    setStudentPendingMap({});
    setExpandedAssignmentId(null);
    setSubmissionsMap({});
    setSubmissionsLoading({});
    setGradingItem(null);
    try {
      const [studentsRes, joinRequestsRes, analyticsRes, assignmentsRes, leaderboardRes, classReportRes, teachersRes] = await Promise.all([
        api.get<ClassStudent[]>(`/v2/teacher/classes/${id}/students`),
        api.get<any[]>(`/v2/teacher/classes/${id}/join-requests`).catch(() => ({ data: [] })),
        api.get<ClassAnalyticsOverview>(`/v2/teacher/classes/${id}/analytics`).catch(() => ({ data: { topErrors: [], studentCount: 0, totalXp: 0, completedAssignments: 0 } })),
        api.get<ClassAssignment[]>(`/v2/teacher/classes/${id}/assignments`).catch(() => ({ data: [] })),
        api.get<LeaderboardDto[]>(`/v2/teacher/classes/${id}/leaderboard?type=${leaderboardType}`).catch(() => ({ data: [] })),
        api.get(`/v2/teacher/reports/classes/${id}`).catch(() => ({ data: null })),
        api.get<ClassTeacherInfo[]>(`/v2/teacher/classes/${id}/teachers`).catch(() => ({ data: [] })),
      ]);
      if (classIdRef.current !== currentClassId) return;
      setStudents(studentsRes.data || []);
      setClassTeachers(teachersRes.data || []);
      setJoinRequests(joinRequestsRes.data || []);
      const analyticsData = analyticsRes.data as ClassAnalyticsOverview;
      setAnalytics(analyticsData?.topErrors || []);
      setAnalyticsOverview(analyticsData || null);
      setAssignments(assignmentsRes.data || []);
      setLeaderboard(leaderboardRes.data || []);
      setClassReport(classReportRes.data || null);

      const assignmentList = assignmentsRes.data as ClassAssignment[];
      if (assignmentList.length > 0) {
        const pendingMap: Record<number, number> = {};
        api.get(`/v2/teacher/grading/queue?classId=${currentClassId}`)
          .then(r => {
            if (classIdRef.current !== currentClassId) return;
            const queue = r.data as any[];
            queue.forEach(item => {
              if (item.status === 'SUBMITTED') {
                pendingMap[item.studentId] = (pendingMap[item.studentId] || 0) + 1;
              }
            });
            setStudentPendingMap(pendingMap);
          })
          .catch(() => {});
      }
      api.get('/v2/teacher/classes').then(r => {
        if (classIdRef.current !== currentClassId) return;
        const cls = (r.data as any[]).find((c: any) => String(c.id) === currentClassId);
        if (cls) setClassName(cls.name);
      }).catch(() => {});
    } catch (e) {
      console.error(e);
    } finally {
      if (classIdRef.current === currentClassId) {
        setPageReady(true);
      }
    }
  }, [id, leaderboardType]);

  useEffect(() => {
    if (!user) return;
    void fetchData();
  }, [user, fetchData]);

  useEffect(() => {
    return () => {
      classIdRef.current = null;
    };
  }, []);

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopic || isCreatingAssignment) return;
    setIsCreatingAssignment(true);
    try {
      let attachmentUrl = null;
      if (newAttachment) {
        const res = await api.get(`/v2/teacher/assignments/presigned-url?filename=${encodeURIComponent(newAttachment.name)}&contentType=${encodeURIComponent(newAttachment.type)}`);
        const { url } = res.data;
        await fetch(url, {
          method: "PUT",
          body: newAttachment,
          headers: {
            "Content-Type": newAttachment.type,
          },
        });
        attachmentUrl = url.split("?")[0];
      } else if (selectedLibraryImage) {
        attachmentUrl = selectedLibraryImage.url;
      }

      await api.post(`/v2/teacher/classes/${id}/assignments`, {
        topic: newTopic,
        description: newDesc,
        assignmentType: newAssignmentType,
        dueDate: newDueDate ? new Date(newDueDate).toISOString() : null,
        attachmentUrl
      });
      setNewTopic("");
      setNewDesc("");
      setNewDueDate("");
      setNewAssignmentType("GENERAL");
      setNewAttachment(null);
      setSelectedLibraryImage(null);
      fetchData(); // Refresh assignments
    } catch (e) {
      console.error(e);
      toast.error("Lỗi khi giao bài tập");
    } finally {
      setIsCreatingAssignment(false);
    }
  };

  const handleApprove = async (requestId: number) => {
    try {
      await api.post(`/v2/teacher/classes/${id}/join-requests/${requestId}/approve`);
      fetchData();
    } catch (e) {
      console.error(e);
      toast.error("Lỗi khi duyệt học viên");
    }
  };

  const handleReject = async (requestId: number) => {
    try {
      await api.post(`/v2/teacher/classes/${id}/join-requests/${requestId}/reject`);
      fetchData();
    } catch (e) {
      console.error(e);
      toast.error("Lỗi khi từ chối học viên");
    }
  };

  const toggleAssignmentSubmissions = async (assignmentId: number) => {
    if (expandedAssignmentId === assignmentId) {
      setExpandedAssignmentId(null);
      return;
    }
    setExpandedAssignmentId(assignmentId);
    if (submissionsMap[assignmentId]) return; // already loaded
    setSubmissionsLoading(prev => ({ ...prev, [assignmentId]: true }));
    try {
      const res = await api.get<AssignmentSubmission[]>(
        `/v2/teacher/grading/classes/${id}/assignments/${assignmentId}/submissions`
      );
      setSubmissionsMap(prev => ({ ...prev, [assignmentId]: res.data || [] }));
    } catch (e) {
      console.error(e);
    } finally {
      setSubmissionsLoading(prev => ({ ...prev, [assignmentId]: false }));
    }
  };

  const handleRemoveStudent = async (studentId: number, studentName: string) => {    if (!confirm(`Bạn chắc chắn muốn xóa học viên "${studentName}" khỏi lớp?`)) return;
    setRemovingStudentId(studentId);
    try {
      await api.delete(`/v2/teacher/classes/${id}/students/${studentId}`);
      fetchData();
    } catch (e) {
      console.error(e);
      toast.error("Lỗi khi xóa học viên");
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
      toast.error("Không thể đổi tên lớp. Vui lòng thử lại.");
    }
  };

  const handleAddCoTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addTeacherEmail.trim()) return;
    setIsAddingTeacher(true);
    setAddTeacherError("");
    try {
      await api.post(`/v2/teacher/classes/${id}/teachers`, { email: addTeacherEmail.trim() });
      setAddTeacherEmail("");
      toast.success("Đã thêm trợ giảng vào lớp");
      fetchData();
    } catch (err: any) {
      setAddTeacherError(err.response?.data?.message || err.response?.data?.error || "Không thể thêm giáo viên này.");
    } finally {
      setIsAddingTeacher(false);
    }
  };

  const handleRemoveCoTeacher = async (teacherId: number, teacherName: string) => {
    if (!confirm(`Bạn chắc chắn muốn xóa trợ giảng "${teacherName}" khỏi lớp?`)) return;
    try {
      await api.delete(`/v2/teacher/classes/${id}/teachers/${teacherId}`);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Lỗi khi xóa trợ giảng");
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
    <>
    <TeacherShell
      activeMenu="classes"
      userName={user.displayName}
      pendingGradingCount={pendingGradingCount}
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
            onClick={() => setActiveTab("overview" as any)}
            className={`px-6 py-3 font-semibold text-sm flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === ("overview" as any) ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <BarChart2 size={18} /> Tổng quan
          </button>
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

        {/* Tab: Overview */}
        {activeTab === ("overview" as any) && (
          <div className="space-y-6">
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm text-center">
                <p className="text-3xl font-black text-indigo-600">{students.length}</p>
                <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mt-1">Học viên</p>
              </div>
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm text-center">
                <p className="text-3xl font-black text-purple-600">{assignments.length}</p>
                <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mt-1">Bài tập đã giao</p>
              </div>
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm text-center">
                <p className="text-3xl font-black text-rose-500">
                  {Object.values(studentPendingMap).reduce((a, b) => a + b, 0)}
                </p>
                <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mt-1">Bài chờ chấm</p>
              </div>
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm text-center">
                <p className="text-3xl font-black text-amber-500">
                  {analyticsOverview ? analyticsOverview.totalXp.toLocaleString() : 0}
                </p>
                <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mt-1">Tổng XP</p>
              </div>
            </div>

            {/* Quick actions */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <h3 className="font-bold text-slate-800 mb-4 text-sm">Thao tác nhanh</h3>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => setActiveTab("assignments")}
                  className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl text-sm font-bold hover:bg-indigo-100 transition-colors"
                >
                  <Plus size={15} /> Giao bài tập mới
                </button>
                <button
                  onClick={() => router.push(`/teacher/grading?classId=${id}`)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-sm font-bold hover:bg-rose-100 transition-colors"
                >
                  <CheckCircle2 size={15} />
                  Chấm bài ({Object.values(studentPendingMap).reduce((a, b) => a + b, 0)} chờ)
                </button>
                <button
                  onClick={() => setActiveTab("analytics")}
                  className="flex items-center gap-2 px-4 py-2.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-xl text-sm font-bold hover:bg-purple-100 transition-colors"
                >
                  <TrendingUp size={15} /> Xem phân tích lỗi
                </button>
                <button
                  onClick={() => setActiveTab("leaderboard")}
                  className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl text-sm font-bold hover:bg-amber-100 transition-colors"
                >
                  <Trophy size={15} /> Bảng xếp hạng
                </button>
                <button
                  onClick={() => router.push(`/teacher/classes/${id}/lessons`)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-sm font-bold hover:bg-emerald-100 transition-colors"
                >
                  <BookOpen size={15} /> Buổi học
                </button>
              </div>
            </div>

            {/* Student progress overview */}
            {students.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100">
                  <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                    <Users size={16} className="text-indigo-500" />
                    Tiến độ học viên
                  </h3>
                </div>
                <div className="divide-y divide-slate-100">
                  {students.map(student => {
                    const pending = studentPendingMap[student.studentId] ?? 0;
                    const maxXp = Math.max(...students.map(s => s.xp), 1);
                    const xpPct = Math.round((student.xp / maxXp) * 100);
                    return (
                      <div
                        key={student.studentId}
                        className="px-5 py-3.5 flex items-center gap-4 hover:bg-slate-50 transition-colors cursor-pointer"
                        onClick={() => router.push(`/teacher/dashboard/${id}/students/${student.studentId}`)}
                      >
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-xs shrink-0">
                          {student.displayName.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-slate-800 text-sm truncate">{student.displayName}</span>
                            <div className="flex items-center gap-2 shrink-0 ml-2">
                              <span className="text-xs text-slate-400 font-mono">{student.xp.toLocaleString()} XP</span>
                              {pending > 0 && (
                                <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
                                  {pending} chờ chấm
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-indigo-400 to-purple-500 rounded-full transition-all"
                              style={{ width: `${xpPct}%` }}
                            />
                          </div>
                        </div>
                        <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full shrink-0">
                          {student.cefrLevel}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recent assignments */}
            {assignments.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                    <BookOpen size={16} className="text-purple-500" />
                    Bài tập gần đây
                  </h3>
                  <button
                    onClick={() => setActiveTab("assignments")}
                    className="text-xs text-indigo-600 font-semibold hover:underline"
                  >
                    Xem tất cả →
                  </button>
                </div>
                <div className="divide-y divide-slate-100">
                  {assignments.slice(0, 5).map(a => {
                    const typeLabels: Record<string, string> = {
                      GENERAL: 'Bài tập chung', SPEAKING_SCENARIO: 'Luyện Nói AI',
                      ESSAY: 'Viết luận', MOCK_TEST: 'Thi thử',
                      VOCABULARY: 'Từ vựng', GRAMMAR: 'Ngữ pháp',
                    };
                    return (
                      <div key={a.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-800 text-sm truncate">{a.topic}</p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {format(new Date(a.createdAt), 'dd/MM/yyyy')}
                            {a.dueDate && ` · Hạn: ${format(new Date(a.dueDate), 'dd/MM/yyyy')}`}
                          </p>
                        </div>
                        {a.assignmentType && (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 shrink-0">
                            {typeLabels[a.assignmentType] ?? a.assignmentType}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab: Students */}
        {activeTab === "students" && (
          <>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-sm">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Học viên</th>
                    <th className="px-6 py-4 font-semibold">Trình độ</th>
                    <th className="px-6 py-4 font-semibold text-right">Tổng XP</th>
                    <th className="px-6 py-4 font-semibold text-center">Level</th>
                    <th className="px-6 py-4 font-semibold text-center">Bài chờ chấm</th>
                    <th className="px-6 py-4 font-semibold text-center">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {students.map((student) => {
                    const pendingCount = studentPendingMap[student.studentId] ?? 0;
                    return (
                      <tr
                        key={student.studentId}
                        className="hover:bg-indigo-50/50 transition-colors group"
                      >
                        <td
                          className="px-6 py-4 cursor-pointer"
                          onClick={() => router.push(`/teacher/dashboard/${id}/students/${student.studentId}`)}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                              {student.displayName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-bold text-slate-800 group-hover:text-indigo-600 transition-colors text-sm">
                                {student.displayName}
                              </div>
                              <div className="text-xs text-slate-400">{student.email}</div>
                            </div>
                          </div>
                        </td>
                        <td
                          className="px-6 py-4 cursor-pointer"
                          onClick={() => router.push(`/teacher/dashboard/${id}/students/${student.studentId}`)}
                        >
                          <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold">
                            {student.cefrLevel}
                          </span>
                        </td>
                        <td
                          className="px-6 py-4 text-right font-mono font-bold text-slate-700 cursor-pointer text-sm"
                          onClick={() => router.push(`/teacher/dashboard/${id}/students/${student.studentId}`)}
                        >
                          {student.xp.toLocaleString()} XP
                        </td>
                        <td
                          className="px-6 py-4 text-center cursor-pointer"
                          onClick={() => router.push(`/teacher/dashboard/${id}/students/${student.studentId}`)}
                        >
                          <span className="font-bold text-orange-600 flex items-center justify-center gap-1 text-sm">
                            🔥 Lv. {student.level}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {pendingCount > 0 ? (
                            <button
                              onClick={() => router.push(`/teacher/grading?classId=${id}`)}
                              className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-full hover:bg-rose-100 transition-colors"
                            >
                              <Clock size={11} />
                              {pendingCount} bài
                            </button>
                          ) : (
                            <span className="text-xs text-slate-300 font-medium">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => router.push(`/teacher/dashboard/${id}/students/${student.studentId}`)}
                              className="p-2 rounded-lg text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                              title="Xem chi tiết học viên"
                            >
                              <FileText size={15} />
                            </button>
                            <button
                              onClick={() => handleRemoveStudent(student.studentId, student.displayName)}
                              disabled={removingStudentId === student.studentId}
                              className="p-2 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors disabled:opacity-50"
                              title="Xóa khỏi lớp"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {students.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
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

          {/* Co-teaching: giáo viên của lớp */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mt-6">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
              <Users size={17} className="text-indigo-600" />
              <h3 className="font-bold text-slate-800 text-sm">Giáo viên của lớp</h3>
              <span className="text-slate-400 text-xs">{classTeachers.length} người</span>
            </div>
            <ul className="divide-y divide-slate-100">
              {classTeachers.map(t => (
                <li key={t.teacherId} className="px-6 py-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0 ${
                      t.role === "PRIMARY" ? "bg-gradient-to-br from-amber-400 to-orange-500" : "bg-gradient-to-br from-slate-400 to-slate-500"
                    }`}>
                      {(t.name || "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 text-sm truncate">{t.name}</p>
                      <p className="text-xs text-slate-400 truncate">{t.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                      t.role === "PRIMARY"
                        ? "bg-amber-50 text-amber-700 border border-amber-200"
                        : "bg-slate-50 text-slate-600 border border-slate-200"
                    }`}>
                      {t.role === "PRIMARY" ? "Giáo viên chính" : "Trợ giảng"}
                    </span>
                    {t.role !== "PRIMARY" && isPrimaryTeacher && (
                      <button
                        onClick={() => handleRemoveCoTeacher(t.teacherId, t.name)}
                        className="p-2 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                        title="Xóa trợ giảng khỏi lớp"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            {isPrimaryTeacher && (
              <div className="border-t border-slate-100 px-6 py-4 bg-slate-50">
                <form onSubmit={handleAddCoTeacher} className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      value={addTeacherEmail}
                      onChange={e => setAddTeacherEmail(e.target.value)}
                      placeholder="Thêm trợ giảng bằng email (tài khoản phải có vai trò giáo viên)..."
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm bg-white"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isAddingTeacher || !addTeacherEmail.trim()}
                    className="px-4 py-2.5 bg-slate-700 text-white font-bold rounded-xl text-sm hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Plus size={15} /> Thêm trợ giảng
                  </button>
                </form>
                {addTeacherError && (
                  <p className="text-rose-600 text-xs font-medium mt-2 ml-1">{addTeacherError}</p>
                )}
              </div>
            )}
          </div>
          </>
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
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Tài liệu đính kèm (Tuỳ chọn)</label>
                  <div className="space-y-3">
                    <input
                      type="file"
                      disabled={!!selectedLibraryImage}
                      onChange={(e) => setNewAttachment(e.target.files ? e.target.files[0] : null)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={openLibraryModal}
                        disabled={!!newAttachment}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        📁 Chọn hoặc tải ảnh từ Thư viện S3
                      </button>
                      
                      {selectedLibraryImage && (
                        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-1.5 rounded-xl text-xs font-semibold">
                          <span>Đã chọn: {selectedLibraryImage.originalName}</span>
                          <button
                            type="button"
                            onClick={() => setSelectedLibraryImage(null)}
                            className="text-emerald-600 hover:text-emerald-800 font-bold"
                          >
                            ✕
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Ghi chú / Hướng dẫn thêm</label>
                  <textarea
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder="Nhập ghi chú hoặc hướng dẫn cho học viên..."
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none h-24 resize-none"
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={isCreatingAssignment}
                    className={`px-6 py-3 rounded-xl font-bold text-sm shadow-sm transition-all duration-200 ${
                      isCreatingAssignment
                        ? "bg-indigo-400 text-white cursor-not-allowed"
                        : "bg-indigo-600 hover:bg-indigo-700 text-white"
                    }`}
                  >
                    {isCreatingAssignment ? "Đang khởi tạo kịch bản AI..." : "Giao bài cho lớp"}
                  </button>
                </div>
              </form>
            </div>

            {/* Assignment list with submission status */}
            <div className="space-y-4">
              <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                Lịch sử giao bài
                <span className="bg-indigo-100 text-indigo-700 text-sm font-bold px-2.5 py-0.5 rounded-full">{assignments.length}</span>
              </h3>
              {assignments.length === 0 ? (
                <div className="text-center py-8 text-slate-500 border border-dashed rounded-2xl">
                  Chưa có bài tập nào được giao.
                </div>
              ) : (
                <div className="space-y-3">
                  {assignments.map((assignment) => {
                    const isExpanded = expandedAssignmentId === assignment.id;
                    const subs = submissionsMap[assignment.id] ?? [];
                    const isLoadingSubs = submissionsLoading[assignment.id] ?? false;
                    const submittedCount = subs.filter(s => s.status === 'SUBMITTED').length;
                    const gradedCount = subs.filter(s => s.status === 'GRADED' || s.status === 'EVALUATED').length;
                    const notSubmittedCount = subs.filter(s => s.status === 'NOT_SUBMITTED' || s.status === 'PENDING').length;
                    const totalStudents = subs.length;

                    const typeLabels: Record<string, string> = {
                      GENERAL: 'Bài tập chung', SPEAKING_SCENARIO: 'Luyện Nói AI',
                      ESSAY: 'Viết luận', MOCK_TEST: 'Thi thử',
                      VOCABULARY: 'Từ vựng', GRAMMAR: 'Ngữ pháp',
                    };

                    return (
                      <div key={assignment.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        {/* Assignment header */}
                        <div
                          className="p-5 flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-50 transition-colors"
                          onClick={() => toggleAssignmentSubmissions(assignment.id)}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <h4 className="font-bold text-slate-800">{assignment.topic}</h4>
                              {assignment.assignmentType && (
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                                  {typeLabels[assignment.assignmentType] ?? assignment.assignmentType}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                              <span>Giao ngày {format(new Date(assignment.createdAt), "dd/MM/yyyy HH:mm")}</span>
                              {assignment.dueDate && (
                                <span className={`flex items-center gap-1 font-medium ${new Date(assignment.dueDate) < new Date() ? 'text-rose-500' : 'text-slate-500'}`}>
                                  <Clock size={11} /> Hạn: {format(new Date(assignment.dueDate), "dd/MM/yyyy HH:mm")}
                                </span>
                              )}
                            </div>
                            {/* Progress bar (only when loaded) */}
                            {subs.length > 0 && (
                              <div className="mt-3 flex items-center gap-3">
                                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all"
                                    style={{ width: `${totalStudents > 0 ? ((gradedCount + submittedCount) / totalStudents) * 100 : 0}%` }}
                                  />
                                </div>
                                <div className="flex items-center gap-2 text-xs font-medium shrink-0">
                                  {submittedCount > 0 && (
                                    <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">{submittedCount} chờ chấm</span>
                                  )}
                                  {gradedCount > 0 && (
                                    <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">{gradedCount} đã chấm</span>
                                  )}
                                  {notSubmittedCount > 0 && (
                                    <span className="text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">{notSubmittedCount} chưa nộp</span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {assignment.attachmentUrl && (
                              <a
                                href={assignment.attachmentUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={e => e.stopPropagation()}
                                className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                title="Xem tài liệu đính kèm"
                              >
                                <ExternalLink size={15} />
                              </a>
                            )}
                            <div className="p-2 rounded-lg text-slate-400">
                              {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                            </div>
                          </div>
                        </div>

                        {/* Submissions table */}
                        {isExpanded && (
                          <div className="border-t border-slate-100">
                            {isLoadingSubs ? (
                              <div className="flex items-center justify-center py-8 gap-2 text-slate-400">
                                <Loader2 size={18} className="animate-spin" />
                                <span className="text-sm">Đang tải danh sách nộp bài...</span>
                              </div>
                            ) : subs.length === 0 ? (
                              <div className="py-8 text-center text-slate-400 text-sm">
                                Chưa có học viên nào trong lớp.
                              </div>
                            ) : (
                              <table className="w-full text-left">
                                <thead className="bg-slate-50 text-xs text-slate-500 font-semibold uppercase tracking-wider">
                                  <tr>
                                    <th className="px-5 py-3">Học viên</th>
                                    <th className="px-5 py-3">Trạng thái</th>
                                    <th className="px-5 py-3 text-right">Điểm</th>
                                    <th className="px-5 py-3 text-center">Hành động</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {subs.map((sub) => (
                                    <tr key={sub.studentId} className="hover:bg-slate-50 transition-colors">
                                      <td className="px-5 py-3">
                                        <div className="font-semibold text-slate-800 text-sm">{sub.studentName}</div>
                                        <div className="text-xs text-slate-400">{sub.studentEmail}</div>
                                      </td>
                                      <td className="px-5 py-3">
                                        {sub.status === 'NOT_SUBMITTED' || sub.status === 'PENDING' ? (
                                          <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2 py-1 rounded-full">Chưa nộp</span>
                                        ) : sub.status === 'SUBMITTED' ? (
                                          <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-1 rounded-full flex items-center gap-1 w-fit">
                                            <Clock size={11} /> Chờ chấm
                                          </span>
                                        ) : (
                                          <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full flex items-center gap-1 w-fit">
                                            <CheckCircle2 size={11} /> Đã chấm
                                          </span>
                                        )}
                                      </td>
                                      <td className="px-5 py-3 text-right font-mono font-bold text-sm">
                                        {sub.score !== null ? (
                                          <span className="text-indigo-600">{sub.score}/100</span>
                                        ) : (
                                          <span className="text-slate-300">—</span>
                                        )}
                                      </td>
                                      <td className="px-5 py-3 text-center">
                                        {(sub.status === 'SUBMITTED' || sub.status === 'GRADED' || sub.status === 'EVALUATED') && sub.submissionId !== null ? (
                                          <button
                                            onClick={() => setGradingItem({
                                              id: sub.submissionId!,
                                              assignmentId: assignment.id,
                                              studentId: sub.studentId,
                                              studentName: sub.studentName,
                                              studentEmail: sub.studentEmail,
                                              topic: assignment.topic,
                                              description: assignment.description ?? '',
                                              assignmentType: assignment.assignmentType ?? 'GENERAL',
                                              dueDate: assignment.dueDate ?? null,
                                              classId: Number(id),
                                              className: className,
                                              status: sub.status,
                                              submittedAt: sub.submittedAt,
                                              submissionContent: sub.submissionContent,
                                              submissionFileUrl: sub.submissionFileUrl,
                                              score: sub.score,
                                              feedback: sub.feedback,
                                              attachmentUrl: assignment.attachmentUrl ?? null,
                                            })}
                                            className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${
                                              sub.status === 'SUBMITTED'
                                                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                            }`}
                                          >
                                            {sub.status === 'SUBMITTED' ? 'Chấm bài' : 'Xem / Sửa'}
                                          </button>
                                        ) : (
                                          <span className="text-xs text-slate-300">—</span>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
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
                    <p className="text-emerald-100 text-sm">Tổng hợp số bài tập, số học viên và điểm trung bình của lớp.</p>
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
                        ['Bài tập đã giao', classReport.assignmentCount ?? 0],
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
                  <p className="text-4xl font-black text-emerald-600">{classReport.assignmentCount ?? 0}</p>
                  <p className="text-slate-500 text-sm mt-2 font-semibold">Bài tập đã giao</p>
                </div>
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm text-center">
                  <p className="text-4xl font-black text-amber-500">{Number(classReport.avgScore ?? 0).toFixed(1)}</p>
                  <p className="text-slate-500 text-sm mt-2 font-semibold">Điểm trung bình</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-slate-500 border border-dashed rounded-2xl">
                Chưa có dữ liệu báo cáo cho lớp học này.
              </div>
            )}
          </div>
        )}


      </div>
    </TeacherShell>

      {/* Grading Panel */}
      <GradingPanel
        item={gradingItem}
        onClose={() => setGradingItem(null)}
        onSaved={(updated) => {
          // Update submissions map
          setSubmissionsMap(prev => {
            const newMap = { ...prev };
            for (const assignmentId of Object.keys(newMap)) {
              newMap[Number(assignmentId)] = newMap[Number(assignmentId)].map(s =>
                s.submissionId === updated.id
                  ? { ...s, status: 'EVALUATED', score: updated.score, feedback: updated.feedback }
                  : s
              );
            }
            return newMap;
          });
          // Cập nhật pending map cho học viên đó
          setStudentPendingMap(prev => {
            const newMap = { ...prev };
            if (newMap[updated.studentId] && newMap[updated.studentId] > 0) {
              newMap[updated.studentId] = newMap[updated.studentId] - 1;
            }
            return newMap;
          });
          // Invalidate cache → badge sidebar cập nhật ngay
          refreshGradingCount();
          setGradingItem(null);
        }}
      />

      {/* S3 Library Modal */}
      <Dialog open={isLibraryModalOpen} onOpenChange={setIsLibraryModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col p-6 bg-white/95 backdrop-blur-md border border-slate-200 shadow-2xl rounded-2xl overflow-hidden">
          <DialogHeader className="border-b border-slate-100 pb-4">
            <DialogTitle className="text-xl font-bold text-slate-800 flex items-center gap-2">
              📁 Thư viện ảnh S3
            </DialogTitle>
          </DialogHeader>

          {/* Tabs */}
          <div className="flex border-b border-slate-100 mb-4">
            <button
              onClick={() => setLibraryTab("my-library")}
              className={`flex-1 py-3 text-center text-sm font-bold transition-all border-b-2 ${
                libraryTab === "my-library"
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              Thư viện của tôi
            </button>
            <button
              onClick={() => setLibraryTab("upload-new")}
              className={`flex-1 py-3 text-center text-sm font-bold transition-all border-b-2 ${
                libraryTab === "upload-new"
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              Tải ảnh mới lên S3
            </button>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto min-h-[300px] max-h-[50vh] pr-2">
            {libraryTab === "my-library" ? (
              libraryLoading ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                  <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mb-2" />
                  <p className="text-sm font-medium">Đang tải danh sách ảnh từ S3...</p>
                </div>
              ) : libraryImages.length === 0 ? (
                <div className="text-center py-20 text-slate-500 border border-dashed border-slate-200 rounded-2xl">
                  <p className="text-sm">Chưa có ảnh nào được tải lên cho bài tập/tài liệu.</p>
                  <button
                    onClick={() => setLibraryTab("upload-new")}
                    className="mt-3 px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-xl text-xs font-bold transition-all"
                  >
                    Tải lên ảnh đầu tiên
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 p-1">
                  {libraryImages.map((image) => {
                    const isSelected = selectedLibraryImage?.id === image.id;
                    return (
                      <div
                        key={image.id}
                        onClick={() => setSelectedLibraryImage(image)}
                        className={`group relative aspect-square rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${
                          isSelected
                            ? "border-indigo-600 ring-2 ring-indigo-600/20"
                            : "border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <img
                          src={image.url}
                          alt={image.altText || image.originalName || "S3 asset"}
                          className="w-full h-full object-cover transition-transform group-hover:scale-105"
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <p className="text-[10px] text-white font-bold truncate">
                            {image.originalName}
                          </p>
                        </div>
                        {isSelected && (
                          <div className="absolute top-1.5 right-1.5 bg-indigo-600 text-white rounded-full p-1 shadow-md">
                            <Check size={12} className="stroke-[3]" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              <div className="py-4">
                <ImageUploader
                  category="ASSIGNMENT"
                  onUploadSuccess={handleLibraryUploadSuccess}
                />
              </div>
            )}
          </div>

          <div className="border-t border-slate-100 pt-4 mt-4 flex justify-end gap-2 shrink-0">
            <button
              onClick={() => setIsLibraryModalOpen(false)}
              className="px-4 py-2 text-slate-500 hover:text-slate-700 text-sm font-bold transition-colors"
            >
              Hủy
            </button>
            {libraryTab === "my-library" && (
              <button
                disabled={!selectedLibraryImage}
                onClick={() => {
                  setIsLibraryModalOpen(false);
                  toast.success(`Đã chọn ảnh: ${selectedLibraryImage?.originalName}`);
                }}
                className={`px-5 py-2 rounded-xl text-sm font-bold transition-all ${
                  selectedLibraryImage
                    ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                    : "bg-slate-100 text-slate-400 cursor-not-allowed"
                }`}
              >
                Xác nhận chọn
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}