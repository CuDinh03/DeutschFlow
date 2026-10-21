"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Briefcase } from "lucide-react";
import { aiSpeakingApi } from "@/lib/aiSpeakingApi";
import { occupationApi } from "@/lib/occupationApi";
import { occupationName, type OccupationDetail } from "@/lib/occupationTypes";
import { PERSONA_TOKENS, type PersonaId } from "@/lib/personas";
import { workplaceInterviewer } from "@/lib/workplaceInterviewers";
import { companionFromPersonaId } from "@/lib/speaking/resumeSession";
import { loadSpeakingSessionIntoStore } from "@/lib/speakingSessionBootstrap";
import { toastApiError } from "@/lib/toastApiError";
import { mediumImpact } from "@/lib/haptics";
import { SpeakingPersonaMiniAvatar } from "@/components/speaking/SpeakingPersonaMiniAvatar";
import { EXPERIENCE_LEVELS } from "./experienceLevels";

interface Props {
  occupationCode: string;
  cefrLevel: string;
  chatHref: string;
  quotaBlocked: boolean;
}

/**
 * K3b (21/10/2026): lối vào phỏng vấn theo nghề trên màn Luyện nói.
 *
 * Trước K3b không client nào gửi `occupationCode` khi tạo phiên ⇒ lớp câu hỏi theo nghề (đợt 2b) và
 * tám người tuyển dụng theo nơi làm việc (đợt 2c) không bao giờ tới người học. Thẻ này đọc nghề (hồ
 * sơ hoặc `?occupation=`), hỏi số năm kinh nghiệm rồi tạo phiên INTERVIEW chỉ kèm `occupationCode`:
 * persona và vị trí để backend chọn theo nghề. Nghề không tải được ⇒ thẻ không hiện (màn cũ giữ nguyên).
 */
export function OccupationInterviewCard({ occupationCode, cefrLevel, chatHref, quotaBlocked }: Props) {
  const tc = useTranslations("v2.student.companionSelect");
  const t = useTranslations("speaking");
  const locale = useLocale();
  const router = useRouter();
  const [detail, setDetail] = useState<OccupationDetail | null>(null);
  const [experience, setExperience] = useState<string>("1-2Y");
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    let alive = true;
    setDetail(null);
    occupationApi
      .detail(occupationCode)
      .then((d) => { if (alive) setDetail(d); })
      .catch(() => { /* không có nghề ⇒ không hiện thẻ */ });
    return () => { alive = false; };
  }, [occupationCode]);

  if (!detail) return null;

  const interviewerName =
    workplaceInterviewer(detail.personaCode)?.name
    ?? PERSONA_TOKENS[detail.personaCode.toLowerCase() as PersonaId]?.name
    ?? detail.personaCode;

  async function start() {
    if (!detail || starting) return;
    mediumImpact();
    if (quotaBlocked) {
      toast.error(t("errorQuota"));
      return;
    }
    setStarting(true);
    try {
      const res = await aiSpeakingApi.createSession(
        detail.interviewPosition, cefrLevel, undefined, "V1", "INTERVIEW", null, experience, null, occupationCode,
      );
      const session = res.data;
      const companion = companionFromPersonaId(session.persona, cefrLevel);
      if (!companion) throw new Error(`Unknown persona ${session.persona}`);
      loadSpeakingSessionIntoStore({
        session,
        companion,
        sessionMode: "INTERVIEW",
        topic: session.interviewPosition ?? detail.interviewPosition,
        experienceLevel: experience,
      });
      router.push(chatHref);
    } catch (error) {
      toastApiError(error, { quotaMessage: t("errorQuota"), locale });
    } finally {
      setStarting(false);
    }
  }

  return (
    <section aria-label={tc("occupation.cap")} className="rounded-ga border border-ga-ink bg-ga-card p-4 space-y-3">
      <p className="ga-ui flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-ga-gold">
        <Briefcase size={13} aria-hidden />
        {tc("occupation.cap")}
      </p>
      <div className="flex items-center gap-3">
        <SpeakingPersonaMiniAvatar personaId={detail.personaCode} chatBusy={false} className="h-12 w-12" />
        <div className="min-w-0">
          <p className="ga-ui text-[15px] font-bold text-ga-ink" lang="de">{detail.occupation.nameDe}</p>
          {locale !== "de" && <p className="ga-ui text-xs text-ga-muted">{occupationName(detail.occupation, locale)}</p>}
          <p className="ga-ui text-xs text-ga-muted">{tc("occupation.interviewer", { name: interviewerName })}</p>
        </div>
      </div>
      <div>
        <p className="ga-ui mb-1.5 text-xs font-semibold text-ga-ink">{tc("experienceLabel")}</p>
        <div role="radiogroup" aria-label={tc("experienceLabel")} className="flex flex-wrap gap-1.5">
          {EXPERIENCE_LEVELS.map((exp) => (
            <button
              key={exp.id}
              type="button"
              role="radio"
              aria-checked={experience === exp.id}
              onClick={() => setExperience(exp.id)}
              className={`ga-ui rounded-ga-pill border px-3 py-1.5 text-xs font-semibold transition-colors ${
                experience === exp.id ? "border-ga-ink bg-ga-yellow-soft text-ga-ink" : "border-ga-line bg-ga-card text-ga-muted hover:text-ga-ink"
              }`}
            >
              {tc(exp.labelKey)}
            </button>
          ))}
        </div>
      </div>
      <button
        type="button"
        onClick={() => void start()}
        disabled={starting}
        aria-busy={starting || undefined}
        className="ga-ui flex h-11 w-full items-center justify-center rounded-ga bg-ga-ink text-sm font-semibold text-ga-bg transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {tc("occupation.start")}
      </button>
      <p className="ga-ui text-xs text-ga-muted">{tc("occupation.hint")}</p>
    </section>
  );
}
