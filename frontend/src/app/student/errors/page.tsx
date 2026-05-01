"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { getAccessToken } from "@/lib/authSession";
import { errorSkillsApi, type ErrorSkillDto } from "@/lib/errors/drillApi";
import { getErrorSnippet } from "@/lib/errors/errorTaxonomy";
import ErrorRepairDrill from "@/components/errors/ErrorRepairDrill";

export default function StudentErrorsPage() {
  const router = useRouter();
  const t = useTranslations("student");
  const locale = useLocale();
  const [skills, setSkills] = useState<ErrorSkillDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [drillOpen, setDrillOpen] = useState(false);
  const [drillCode, setDrillCode] = useState("");
  const [drillExample, setDrillExample] = useState<string | undefined>();
  const [drillRule, setDrillRule] = useState<string | undefined>();

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }
    errorSkillsApi
      .getMine(30)
      .then((res) => setSkills(res.data ?? []))
      .catch(() => setSkills([]))
      .finally(() => setLoading(false));
  }, [router]);

  return (
    <div className="min-h-screen bg-[#0f172a] text-white px-4 py-8 max-w-lg mx-auto">
      <button
        type="button"
        onClick={() => router.push("/dashboard")}
        className="flex items-center gap-2 text-sm text-white/60 hover:text-white mb-6"
      >
        <ArrowLeft size={18} /> Dashboard
      </button>

      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
          <AlertTriangle className="text-amber-400" size={22} />
        </div>
        <div>
          <h1 className="text-xl font-bold">{t("errorLibraryTitle")}</h1>
          <p className="text-sm text-white/50">{t("errorLibrarySubtitle")}</p>
        </div>
      </div>

      {loading ? (
        <p className="text-white/50 mt-8">{t("loading")}</p>
      ) : skills.length === 0 ? (
        <p className="text-white/45 mt-8 text-center">{t("errorLibraryEmpty")}</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {skills.map((s) => {
            const snippet = getErrorSnippet(s.errorCode, locale);
            return (
              <li
                key={s.errorCode}
                className="rounded-2xl border border-white/10 bg-white/5 p-4 flex flex-col gap-2"
              >
                <div className="flex justify-between gap-2 items-start">
                  <div>
                    <p className="font-semibold">{snippet.title}</p>
                    <p className="text-[11px] font-mono text-cyan-300/80">{s.errorCode}</p>
                  </div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/10">
                    ×{s.count}
                  </span>
                </div>
                {(s.ruleViShort || s.sampleCorrected) && (
                  <p className="text-xs text-white/50">
                    {s.ruleViShort}
                    {s.sampleCorrected ? ` → ${s.sampleCorrected}` : ""}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setDrillCode(s.errorCode);
                    setDrillExample(s.sampleCorrected ?? undefined);
                    setDrillRule(s.ruleViShort ?? undefined);
                    setDrillOpen(true);
                  }}
                  className="mt-1 self-start text-xs font-bold px-4 py-2 rounded-full bg-gradient-to-r from-cyan-500 to-violet-600"
                >
                  {t("practiceTwoMin")}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <ErrorRepairDrill
        open={drillOpen}
        onClose={() => setDrillOpen(false)}
        errorCode={drillCode}
        exampleCorrectDe={drillExample}
        ruleViShort={drillRule}
      />
    </div>
  );
}
