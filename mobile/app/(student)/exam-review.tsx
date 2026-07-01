import { View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { router, useLocalSearchParams } from 'expo-router'
import { Check, X } from 'lucide-react-native'
import { radius, space, useTheme } from '@/lib/theme'
import {
  Screen,
  Card,
  ThemedText,
  Icon,
  AppHeader,
  Caption,
  ProgressBar,
  EmptyState,
  ErrorState,
  Skeleton,
} from '@/components/ui'
import { examApi, type ReviewItem } from '@/lib/examApi'

const TF_LABEL: Record<string, string> = { richtig: 'Richtig', falsch: 'Falsch' }
const label = (v: string | null) => (v == null ? '—' : (TF_LABEL[v.toLowerCase()] ?? v))

export default function ExamReviewScreen() {
  const c = useTheme().colors
  const params = useLocalSearchParams<{ attemptId: string; title?: string }>()
  const attemptId = Number(params.attemptId)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['exam-review', attemptId],
    queryFn: () => examApi.getReview(attemptId),
    enabled: Number.isFinite(attemptId),
  })

  const sections = data?.sections ?? []
  const totalItems = sections.reduce((n, s) => n + s.items.length, 0)
  const correct = sections.reduce((n, s) => n + s.items.filter((i) => i.is_correct).length, 0)

  return (
    <Screen edges={['top']}>
      <AppHeader title={params.title ?? 'Xem lại bài thi'} subtitle="Phần Đọc" onBack={() => router.back()} />

      {isLoading ? (
        <View style={{ paddingHorizontal: space[5], gap: space[3], paddingTop: space[2] }}>
          <Skeleton height={80} radius="2xl" />
          <Skeleton height={120} radius="2xl" />
        </View>
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : totalItems === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState icon={Check} title="Không có câu để xem lại" message="Bài thi này chưa có câu trắc nghiệm phần Đọc." />
        </View>
      ) : (
        <Screen scroll edges={[]} contentStyle={{ paddingHorizontal: space[5], paddingBottom: space[10], gap: space[5], paddingTop: space[2] }}>
          {/* Score hero — editorial ink card for the key result metric */}
          <Card style={{ backgroundColor: c.inkSurface, borderColor: c.inkSurface, gap: space[4] }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
              <View style={{ gap: space[1] }}>
                <Caption color={c.accent}>Kết quả phần Đọc</Caption>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space[1] }}>
                  <ThemedText variant="displayLg" style={{ color: c.onInk }}>
                    {String(correct)}
                  </ThemedText>
                  <ThemedText variant="title" style={{ color: c.onInkMuted }}>
                    / {totalItems}
                  </ThemedText>
                </View>
              </View>
              <ThemedText variant="monoLg" style={{ color: c.accent }}>
                {Math.round((correct / totalItems) * 100)}%
              </ThemedText>
            </View>
            <ProgressBar
              value={correct / totalItems}
              fillColor={c.accent}
              trackColor={c.onInkMuted}
              height={6}
            />
          </Card>

          <View style={{ gap: space[4] }}>
            <Caption>Chi tiết từng câu</Caption>
            {sections.map((s, si) => (
              <View key={si} style={{ gap: space[3] }}>
                <Caption color={c.textMuted}>{s.sectionName}</Caption>
                {s.items.map((item) => (
                  <ReviewItemCard key={item.id} item={item} />
                ))}
              </View>
            ))}
          </View>
        </Screen>
      )}
    </Screen>
  )
}

function ReviewItemCard({ item }: { item: ReviewItem }) {
  const c = useTheme().colors
  const ok = item.is_correct
  return (
    <Card style={{ gap: space[3], borderLeftWidth: 3, borderLeftColor: ok ? c.success : c.danger }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[3] }}>
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: radius.sm,
            backgroundColor: ok ? c.successSoft : c.dangerSoft,
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 1,
          }}
        >
          <Icon icon={ok ? Check : X} size={13} color={ok ? 'success' : 'danger'} />
        </View>
        <ThemedText variant="bodyStrong" style={{ flex: 1 }}>
          {item.question}
        </ThemedText>
      </View>

      <View style={{ gap: space[2], paddingLeft: space[3] + 22 }}>
        {!ok ? (
          <View style={{ gap: space[1] }}>
            <Caption color={c.textMuted}>Bạn chọn</Caption>
            <ThemedText variant="bodyStrong" style={{ color: c.danger }}>
              {label(item.user_answer)}
            </ThemedText>
          </View>
        ) : null}
        <View style={{ gap: space[1] }}>
          <Caption color={c.textMuted}>Đáp án</Caption>
          <ThemedText variant="bodyStrong" style={{ color: c.success }}>
            {label(item.correct_answer)}
          </ThemedText>
        </View>

        {item.explanation ? (
          <ThemedText variant="caption" color="muted" style={{ marginTop: space[1] }}>
            {item.explanation}
          </ThemedText>
        ) : null}
      </View>
    </Card>
  )
}
