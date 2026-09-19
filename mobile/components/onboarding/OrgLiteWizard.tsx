import { useState } from 'react'
import { ScrollView, View } from 'react-native'
import * as Haptics from 'expo-haptics'
import { space, useTheme } from '@/lib/theme'
import { Button, Caption, Card, Screen, ThemedText, YellowSquare, GaGlyph } from '@/components/ui'
import {
  CURRENT_LEVELS,
  DAILY_GOALS,
  DEFAULT_SESSIONS_PER_WEEK,
  IconTile,
  LevelChips,
  MinuteTile,
  TitleBlock,
} from '@/components/onboarding/WizardParts'
import {
  liteProfilePayload,
  normalizePresetLevel,
  type LiteProfilePayload,
  type OnboardingContext,
} from '@/lib/onboardingContext'
import { useT, type Translator } from '@/lib/i18n'
import { orgLiteMessages } from '@/lib/i18n/messages/orgLite'

// PROFILE_LITE — bản rút gọn cho học viên trung tâm (Đợt 5, kế hoạch 17/09/2026 §4.1 C2).
//
// Trung tâm/giáo trình quyết mục tiêu, lĩnh vực và mentor, nên màn này KHÔNG hỏi ba thứ đó: chỉ
// nhịp học, cộng một câu trình độ khi server chưa có (`presetCurrentLevel` null). Sau khi lưu,
// màn cha đưa thẳng tới Câu đầu tiên (I-11: không qua TASTE/PATH_CHOICE).

interface Props {
  ctx: OnboardingContext
  submitting: boolean
  onSubmit: (payload: LiteProfilePayload) => void
}

/** "17 tháng 10, 2026" / "10/17/2026" / "17.10.2026" — không kéo thư viện ngày; mẫu ngày nằm trong từ điển orgLite (Q-D). */
function formatTrialDate(iso: string, t: Translator<typeof orgLiteMessages.vi>): string | null {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return t('trial.date', { day: d.getDate(), month: d.getMonth() + 1, year: d.getFullYear() })
}

export function OrgLiteWizard({ ctx, submitting, onSubmit }: Props) {
  const c = useTheme().colors
  const t = useT(orgLiteMessages)
  const preset = normalizePresetLevel(ctx.presetCurrentLevel)
  const [currentLevel, setCurrentLevel] = useState<string>(preset ?? 'A0')
  const [dailyGoal, setDailyGoal] = useState('15')

  const orgName = ctx.org?.name ?? null
  const className = ctx.org?.className ?? null
  const trialUntil = ctx.trial?.isTrial && ctx.trial.trialEndsAt ? formatTrialDate(ctx.trial.trialEndsAt, t) : null

  function pick(update: () => void) {
    void Haptics.selectionAsync()
    update()
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: space[6], paddingTop: space[6], paddingBottom: space[8], gap: space[5] }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        testID="org-lite-wizard"
      >
        <TitleBlock
          cap={t('cap')}
          title={className ? t('title.withClass', { className }) : orgName ? t('title.withOrg', { orgName }) : t('title.plain')}
          sub={t('sub')}
        />

        {orgName ? (
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
            <IconTile glyph="lophoc" />
            <View style={{ flex: 1, gap: 2 }}>
              <ThemedText variant="bodyStrong">{orgName}</ThemedText>
              {trialUntil ? (
                <ThemedText variant="caption" color="secondary">{t('trial.proUntil', { date: trialUntil })}</ThemedText>
              ) : null}
            </View>
          </Card>
        ) : null}

        {preset === null ? (
          <View style={{ gap: space[3] }}>
            <Caption>{t('level.cap')}</Caption>
            <ThemedText variant="caption" color="secondary">
              {t('level.hint')}
            </ThemedText>
            <LevelChips options={CURRENT_LEVELS} selected={currentLevel} onSelect={(v) => pick(() => setCurrentLevel(v))} />
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
            <YellowSquare />
            <ThemedText variant="caption" color="secondary">{t('level.preset', { level: preset })}</ThemedText>
          </View>
        )}

        <View style={{ gap: space[3] }}>
          <Caption>{t('pace.cap')}</Caption>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[3] }}>
            {DAILY_GOALS.map((g) => (
              <MinuteTile
                key={g.value}
                minutes={g.value}
                tag={g.tag}
                selected={dailyGoal === g.value}
                onPress={() => pick(() => setDailyGoal(g.value))}
              />
            ))}
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
          <GaGlyph name="thoigian" size={15} ink="secondary" />
          <ThemedText variant="caption" color="secondary" style={{ flex: 1 }}>
            {t('pace.streakHint')}
          </ThemedText>
        </View>
      </ScrollView>

      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: c.border,
          backgroundColor: c.surface,
          paddingHorizontal: space[6],
          paddingTop: space[4],
          paddingBottom: space[2],
        }}
      >
        <Button
          label={t('start')}
          loading={submitting}
          disabled={submitting}
          onPress={() =>
            onSubmit(
              liteProfilePayload({
                currentLevel,
                sessionsPerWeek: DEFAULT_SESSIONS_PER_WEEK,
                dailyGoalMinutes: parseInt(dailyGoal, 10),
              }),
            )
          }
        />
      </View>
    </Screen>
  )
}
