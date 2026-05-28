"use client";

import { useEffect, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import { interviewDomainApi, InterviewAnalytics } from "@/lib/interviewDomainApi";
import { Loader2, TrendingUp, Users, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

function BarRow({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max === 0 ? 0 : Math.round((value / max) * 100);
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 text-xs text-slate-600 dark:text-slate-400 truncate shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 text-right text-xs font-semibold text-slate-700 dark:text-slate-300">{value}</span>
    </div>
  );
}

function ScoreRow({ label, score }: { label: string; score: number }) {
  const pct = Math.round((score / 10) * 100);
  const color = score >= 7 ? "bg-emerald-500" : score >= 5 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 text-xs text-slate-600 dark:text-slate-400 truncate shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-12 text-right text-xs font-semibold text-slate-700 dark:text-slate-300">
        {score.toFixed(1)}/10
      </span>
    </div>
  );
}

const PHASE_LABELS: Record<string, string> = {
  INTRO: "Intro",
  ICE_BREAKER: "Ice Breaker",
  HARD_SKILLS: "Hard Skills",
  STAR_SOFT: "STAR / Soft",
  CLOSING: "Closing",
};

const VERDICT_COLOR: Record<string, string> = {
  control: "bg-slate-200 text-slate-700",
  variant_b: "bg-blue-100 text-blue-700",
  variant_c: "bg-purple-100 text-purple-700",
};

export default function InterviewAnalyticsPage() {
  const [data, setData] = useState<InterviewAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    interviewDomainApi.getAnalytics()
      .then(setData)
      .catch((e) => setError(e.message || "Lỗi tải dữ liệu"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AdminShell
      title="Interview Analytics"
      subtitle="KPI theo ngành, persona, và phase — Phase 3"
      activeNav="interview-analytics"
    >
      <div className="max-w-5xl mx-auto space-y-6">
        {loading && (
          <div className="flex justify-center py-24">
            <Loader2 size={28} className="animate-spin text-slate-400" />
          </div>
        )}

        {error && (
          <div className="flex items-center gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
            <AlertTriangle size={18} className="text-red-500 shrink-0" />
            <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
          </div>
        )}

        {data && (
          <>
            {/* Top-level KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard label="Tổng phiên" value={data.totalSessions} />
              <StatCard label="Hoàn thành" value={data.completedSessions} />
              <StatCard
                label="Tỉ lệ hoàn thành"
                value={`${data.completionRate.toFixed(1)}%`}
                sub="ENDED / total"
              />
              <StatCard
                label="Số ngành"
                value={Object.keys(data.sessionsByIndustry).length}
                sub="industries active"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Sessions by industry */}
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp size={16} className="text-slate-500" />
                  <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Phiên theo ngành</h2>
                </div>
                <div className="space-y-2.5">
                  {Object.entries(data.sessionsByIndustry)
                    .sort((a, b) => b[1] - a[1])
                    .map(([industry, count]) => (
                      <BarRow
                        key={industry}
                        label={industry}
                        value={count}
                        max={Math.max(...Object.values(data.sessionsByIndustry))}
                        color="bg-blue-500"
                      />
                    ))}
                  {Object.keys(data.sessionsByIndustry).length === 0 && (
                    <p className="text-xs text-slate-400">Chưa có dữ liệu</p>
                  )}
                </div>
              </div>

              {/* Sessions by persona */}
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Users size={16} className="text-slate-500" />
                  <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Phiên theo persona</h2>
                </div>
                <div className="space-y-2.5">
                  {Object.entries(data.sessionsByPersona)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 10)
                    .map(([persona, count]) => (
                      <BarRow
                        key={persona}
                        label={persona}
                        value={count}
                        max={Math.max(...Object.values(data.sessionsByPersona))}
                        color="bg-violet-500"
                      />
                    ))}
                  {Object.keys(data.sessionsByPersona).length === 0 && (
                    <p className="text-xs text-slate-400">Chưa có dữ liệu</p>
                  )}
                </div>
              </div>
            </div>

            {/* Phase drop-off funnel */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4">
                Phase drop-off funnel
              </h2>
              <div className="space-y-3">
                {data.phaseDropOff.map((p) => (
                  <div key={p.phase} className="flex items-center gap-3">
                    <span className="w-28 text-xs text-slate-600 dark:text-slate-400 shrink-0">
                      {PHASE_LABELS[p.phase] ?? p.phase}
                    </span>
                    <div className="flex-1 h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500"
                        style={{ width: `${Math.min(100, p.reachRate)}%` }}
                      />
                    </div>
                    <span className="w-20 text-right text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {p.sessionsReached} ({p.reachRate.toFixed(1)}%)
                    </span>
                  </div>
                ))}
                {data.phaseDropOff.length === 0 && (
                  <p className="text-xs text-slate-400">Chưa có dữ liệu phase</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Avg score by industry */}
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle2 size={16} className="text-emerald-500" />
                  <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    Điểm trung bình theo ngành
                  </h2>
                </div>
                <div className="space-y-2.5">
                  {Object.entries(data.avgScoreByIndustry)
                    .sort((a, b) => b[1] - a[1])
                    .map(([industry, score]) => (
                      <ScoreRow key={industry} label={industry} score={score} />
                    ))}
                  {Object.keys(data.avgScoreByIndustry).length === 0 && (
                    <p className="text-xs text-slate-400">Chưa có dữ liệu điểm</p>
                  )}
                </div>
              </div>

              {/* A/B variant performance */}
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <XCircle size={16} className="text-slate-400" />
                  <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">A/B Variant</h2>
                </div>

                {/* Variant distribution */}
                <p className="text-[10px] uppercase tracking-wide text-slate-400 mb-2">Phân bổ phiên</p>
                <div className="space-y-2 mb-4">
                  {Object.entries(data.variantDistribution).map(([variant, count]) => (
                    <div key={variant} className="flex items-center justify-between">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${VERDICT_COLOR[variant] ?? "bg-slate-100 text-slate-600"}`}>
                        {variant}
                      </span>
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{count}</span>
                    </div>
                  ))}
                  {Object.keys(data.variantDistribution).length === 0 && (
                    <p className="text-xs text-slate-400">Chưa có experiment</p>
                  )}
                </div>

                {/* Avg score by variant */}
                {Object.keys(data.avgScoreByVariant).length > 0 && (
                  <>
                    <p className="text-[10px] uppercase tracking-wide text-slate-400 mb-2">Điểm trung bình</p>
                    <div className="space-y-2.5">
                      {Object.entries(data.avgScoreByVariant).map(([variant, score]) => (
                        <ScoreRow key={variant} label={variant} score={score} />
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </AdminShell>
  );
}
