"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TeacherShell } from "@/components/layouts/TeacherShell";
import { useStudentPracticeSession } from "@/hooks/useStudentPracticeSession";
import api from "@/lib/api";
import { Plus, Users } from "lucide-react";
import { format } from "date-fns";

interface TeacherClass {
  id: number;
  name: string;
  inviteCode: string;
  createdAt: string;
}

export default function TeacherDashboard() {
  const router = useRouter();
  const { me: user, loading } = useStudentPracticeSession({ requireStudent: false });
  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [classesLoading, setClassesLoading] = useState(true);
  const [newClassName, setNewClassName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (user.role !== "TEACHER" && user.role !== "ADMIN") {
      router.push("/dashboard");
      return;
    }
    fetchClasses();
  }, [user, router]);

  const fetchClasses = async () => {
    try {
      const res = await api.get<TeacherClass[]>("/v2/teacher/classes");
      setClasses(res.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setClassesLoading(false);
    }
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) return;
    setIsCreating(true);
    try {
      await api.post("/v2/teacher/classes", { name: newClassName });
      setNewClassName("");
      fetchClasses();
    } catch (e) {
      console.error(e);
    } finally {
      setIsCreating(false);
    }
  };

  if (!user || loading || classesLoading) return null;

  return (
    <TeacherShell
      activeMenu="dashboard"
      userName={user.displayName}
      onLogout={() => {
        localStorage.removeItem("auth_token");
        window.location.href = "/login";
      }}
      headerTitle="Dashboard"
      headerSubtitle="Quản lý lớp học của bạn"
    >
      <div className="p-8 max-w-5xl mx-auto space-y-8">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <h2 className="text-lg font-bold text-slate-800 mb-4">Tạo lớp học mới</h2>
          <form onSubmit={handleCreateClass} className="flex gap-4">
            <input
              type="text"
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              placeholder="Tên lớp (VD: Lớp B1 - Tối 2-4-6)"
              className="flex-1 px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
            />
            <button
              type="submit"
              disabled={isCreating || !newClassName.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isCreating ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Plus size={20} /> Tạo lớp
                </>
              )}
            </button>
          </form>
        </div>

        <div>
          <h2 className="text-lg font-bold text-slate-800 mb-4">Danh sách lớp học ({classes.length})</h2>
          {classes.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
              <Users size={48} className="mx-auto text-slate-400 mb-4" />
              <p className="text-slate-500">Bạn chưa có lớp học nào.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {classes.map((cls) => (
                <div
                  key={cls.id}
                  onClick={() => router.push(`/teacher/classes/${cls.id}`)}
                  className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
                >
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="font-bold text-slate-800 group-hover:text-indigo-600 transition-colors line-clamp-2">
                      {cls.name}
                    </h3>
                  </div>
                  <div className="space-y-2 text-sm text-slate-600">
                    <div className="flex justify-between">
                      <span>Mã mời:</span>
                      <span className="font-mono font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">
                        {cls.inviteCode}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Ngày tạo:</span>
                      <span>{format(new Date(cls.createdAt), "dd/MM/yyyy")}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </TeacherShell>
  );
}
