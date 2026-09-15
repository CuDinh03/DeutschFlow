/**
 * Lớp phủ dịch cho persona luyện nói (đợt 3 audit UTF-8/i18n 06/09/2026, F-I18N-02).
 *
 * `lib/personas.ts` là DỮ LIỆU, không dịch tại nguồn: `desc` còn được gửi làm "personality" cho AI
 * (lib/speaking/resumeSession.ts, CompanionSelect) và `label` của vị trí/kịch bản là giá trị gửi API
 * (topic của phiên). Hook này chỉ đổi phần HIỂN THỊ: tra catalog `v2.student.personas`
 *   - `<personaId>.{role,tag,desc}`
 *   - `<personaId>.positions.<positionId>` / `<personaId>.scenarios.<scenarioId>`
 *   - `groups.<groupId>` (PERSONA_GROUPS)
 * và lùi về dữ liệu gốc khi thiếu khoá: role/tag/desc giữ nguyên chuỗi trong personas.ts; vị trí/kịch
 * bản lấy `labelDe` khi locale `de`, còn lại `label`; id không có trong dữ liệu → trả chính id.
 *
 * Chỉ dùng trong khu student (provider cấp `v2.student.*`).
 */
import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { PERSONA_GROUPS, PERSONA_TOKENS, type PersonaId, type PersonaToken } from "@/lib/personas";

type LabelledOption = { id: string; label: string; labelDe: string };

export interface PersonaText {
  role(persona: PersonaToken): string;
  tag(persona: PersonaToken): string;
  desc(persona: PersonaToken): string;
  groupLabel(groupId: string): string;
  positionLabel(personaId: string, positionId: string): string;
  scenarioLabel(personaId: string, scenarioId: string): string;
}

function optionFallback(options: LabelledOption[] | undefined, id: string, locale: string): string {
  const option = options?.find((o) => o.id === id);
  if (!option) return id;
  return locale === "de" ? option.labelDe : option.label;
}

function tokenOf(personaId: string): PersonaToken | undefined {
  return PERSONA_TOKENS[personaId as PersonaId];
}

export function usePersonaText(): PersonaText {
  const t = useTranslations("v2.student.personas");
  const locale = useLocale();
  return useMemo(() => {
    const pick = (key: string, fallback: string): string => (t.has(key) ? t(key) : fallback);
    return {
      role: (persona) => pick(`${persona.id}.role`, persona.role),
      tag: (persona) => pick(`${persona.id}.tag`, persona.tag),
      desc: (persona) => pick(`${persona.id}.desc`, persona.desc),
      groupLabel: (groupId) =>
        pick(`groups.${groupId}`, PERSONA_GROUPS.find((g) => g.id === groupId)?.label ?? groupId),
      positionLabel: (personaId, positionId) =>
        pick(
          `${personaId}.positions.${positionId}`,
          optionFallback(tokenOf(personaId)?.interviewPositions, positionId, locale),
        ),
      scenarioLabel: (personaId, scenarioId) =>
        pick(
          `${personaId}.scenarios.${scenarioId}`,
          optionFallback(tokenOf(personaId)?.lessonScenarios, scenarioId, locale),
        ),
    };
  }, [t, locale]);
}
