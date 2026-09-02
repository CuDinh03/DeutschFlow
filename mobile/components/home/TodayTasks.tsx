import { View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import { ChevronRight, Mic, Wrench } from 'lucide-react-native'
import { radius, space, useTheme } from '@/lib/theme'
import { Caption, Card, Icon, Pill, ThemedText, YellowSquare } from '@/components/ui'
import { errorSkillsApi, todayApi, todayHrefToRoute } from '@/lib/todayApi'

/**
 * Khối "Việc hôm nay" trên Trang chủ (cụm Heute — thiết kế đã chốt 02/09).
 *
 * Cố ý là một KHỐI chèn vào màn Trang chủ hiện có thay vì thay cả màn: Trang
 * chủ là mỏ neo của spotlight tour onboarding (homeStreak/homeSrsCard) — thay
 * trọn màn là vỡ tour (đúng lớp lỗi F-2 cũ). Thẻ Ôn SRS đến hạn đã có sẵn ngay
 * dưới khối này và đóng vai trò một "việc" — ở đây không lặp lại.
 *
 * Lỗi/thiếu dữ liệu → khối tự ẩn (Trang chủ không được phép gãy vì /today/me).
 */
export function TodayTasks() {
  const c = useTheme().colors

  const planQ = useQuery({
    queryKey: ['today-plan'],
    queryFn: () => todayApi.me(),
    staleTime: 60_000 * 5,
  })
  // ruleViShort/sample cho chip mô tả lỗi — join theo errorCode.
  const skillsQ = useQuery({
    queryKey: ['error-skills'],
    queryFn: () => errorSkillsApi.mine(),
    staleTime: 60_000 * 5,
  })

  const plan = planQ.data
  if (planQ.isError || !plan) return null

  const dueTasks = plan.dueRepairTasks ?? []
  const speaking = plan.recommendedSpeaking
  const vocab = plan.recommendedVocabPractice
  const ruleByCode = new Map((skillsQ.data ?? []).map((s) => [s.errorCode, s.ruleViShort ?? s.errorCode]))

  const hasAnything = dueTasks.length > 0 || speaking || vocab
  if (!hasAnything) return null

  return (
    <View style={{ paddingHorizontal: space[5], marginTop: space[4], gap: space[3] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
        <YellowSquare />
        <Caption>Việc hôm nay</Caption>
      </View>

      {/* 1. Sửa lỗi đến hạn — ưu tiên cao nhất (SRS của chính lỗi bạn mắc) */}
      {dueTasks.length > 0 && (
        <Card
          onPress={() => router.push('/(student)/error-repair')}
          accessibilityLabel={`Sửa ${dueTasks.length} lỗi đến hạn hôm nay`}
          style={{ gap: space[3] }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
            <View style={{ width: 40, height: 40, borderRadius: radius.md, backgroundColor: c.dangerSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Icon icon={Wrench} size={20} color="danger" />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <ThemedText variant="bodyStrong">Sửa lỗi đến hạn</ThemedText>
              <ThemedText variant="caption" color="muted">
                {`${dueTasks.length} lỗi tới hạn ôn lại hôm nay`}
              </ThemedText>
            </View>
            <Pill label="ĐẾN HẠN" tone="danger" />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[1] + 2 }}>
            {dueTasks.slice(0, 3).map((t) => (
              <View key={t.id} style={{ borderWidth: 1, borderColor: c.border, borderRadius: radius.sm, paddingHorizontal: space[2], paddingVertical: 4 }}>
                <ThemedText variant="caption" color="secondary">
                  {ruleByCode.get(t.errorCode) ?? t.errorCode}
                </ThemedText>
              </View>
            ))}
          </View>
        </Card>
      )}

      {/* 2. Nói theo gợi ý — đúng cấu trúc đang yếu */}
      {speaking && (
        <Card
          onPress={() => router.push(todayHrefToRoute(speaking.href))}
          accessibilityLabel="Luyện nói theo gợi ý hôm nay"
          style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}
        >
          <View style={{ width: 40, height: 40, borderRadius: radius.md, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Icon icon={Mic} size={20} color="accent" />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <ThemedText variant="bodyStrong">
              {speaking.topic ? `Nói 5 phút · ${speaking.topic}` : 'Nói 5 phút theo gợi ý'}
            </ThemedText>
            {(speaking.focusOrStructures ?? []).length > 0 ? (
              <ThemedText variant="caption" color="muted" numberOfLines={1}>
                {`Ôn đúng cấu trúc đang yếu: ${(speaking.focusOrStructures ?? []).slice(0, 2).join(', ')}`}
              </ThemedText>
            ) : speaking.cefrLevel ? (
              <ThemedText variant="caption" color="muted">{`Trình độ ${speaking.cefrLevel}`}</ThemedText>
            ) : null}
          </View>
          <Icon icon={ChevronRight} size={16} color="muted" />
        </Card>
      )}

      {/* 3. Từ vựng gợi ý */}
      {vocab && (
        <Card
          onPress={() => router.push(todayHrefToRoute(vocab.href))}
          accessibilityLabel="Luyện từ vựng theo gợi ý hôm nay"
          style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}
        >
          <View style={{ width: 40, height: 40, borderRadius: radius.md, backgroundColor: c.surfaceSunken, alignItems: 'center', justifyContent: 'center' }}>
            <YellowSquare size={10} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <ThemedText variant="bodyStrong">
              {vocab.topic ? `Từ vựng · ${vocab.topic}` : 'Luyện từ vựng hôm nay'}
            </ThemedText>
            {vocab.cefrLevel ? (
              <ThemedText variant="caption" color="muted">{`Trình độ ${vocab.cefrLevel}`}</ThemedText>
            ) : null}
          </View>
          <Icon icon={ChevronRight} size={16} color="muted" />
        </Card>
      )}
    </View>
  )
}
