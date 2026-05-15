"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { BookOpen, CheckCircle2, Clock, UploadCloud, AlertCircle } from "lucide-react";
import api from "@/lib/api";
import { StudentShell } from "@/components/layouts/StudentShell";
import { useStudentPracticeSession } from "@/hooks/useStudentPracticeSession";

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
}

export default function StudentAssignmentsPage() {
  const router = useRouter();
  const { me: user, loading: userLoading } = useStudentPracticeSession({ requireStudent: true });
  const [assignments, setAssignments] = useState<StudentAssignmentDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchAssignments();
  }, [user]);

  const fetchAssignments = async () => {
    try {
      const res = await api.get<StudentAssignmentDto[]>("/v2/students/assignments");
      setAssignments(res.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (!user || userLoading || loading) return null;

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
      headerTitle="Bài tập & Thi thử"
      headerSubtitle="Xem và nộp bài tập được giao bởi giáo viên"
    >
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <BookOpen className="text-indigo-600 w-6 h-6" />
            <h2 className="text-xl font-bold text-slate-800">Danh sách bài tập</h2>
          </div>

          {assignments.length === 0 ? (
            <div className="text-center py-12 text-slate-500 border border-dashed rounded-xl">
              Bạn chưa có bài tập nào. Hãy đợi giáo viên giao bài nhé!
            </div>
          ) : (
            <div className="space-y-4">
              {assignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className="bg-slate-50 border border-slate-200 rounded-xl p-5 hover:border-indigo-300 transition-colors cursor-pointer"
                  onClick={() => router.push(`/student/assignments/${assignment.assignmentId}`)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="text-lg font-bold text-slate-800">{assignment.topic}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">
                          {assignment.assignmentType === "ESSAY" ? "Viết luận" : assignment.assignmentType === "MOCK_TEST" ? "Thi thử" : "Bài tập chung"}
                        </span>
                        {assignment.dueDate && (
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <Clock size={12} /> Hạn nộp: {format(new Date(assignment.dueDate), "dd/MM/yyyy HH:mm")}
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      {assignment.status === "PENDING" ? (
                        <span className="flex items-center gap-1 text-sm font-semibold text-amber-600 bg-amber-50 px-3 py-1 rounded-full">
                          <AlertCircle size={14} /> Chưa nộp
                        </span>
                      ) : assignment.status === "SUBMITTED" ? (
                        <span className="flex items-center gap-1 text-sm font-semibold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                          <UploadCloud size={14} /> Đã nộp
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-sm font-semibold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
                          <CheckCircle2 size={14} /> Đã chấm ({assignment.teacherScore}/100)
                        </span>
                      )}
                    </div>
                  </div>
                  {assignment.description && (
                    <p className="text-sm text-slate-500 line-clamp-2 mt-2">
                      {assignment.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </StudentShell>
  );
}
