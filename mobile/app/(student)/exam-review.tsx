import { View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { router, useLocalSearchParams } from 'expo-router'
import { Check, X } from 'lucide-react-native'
import { radius, space, useTheme } from '@/lib/theme'
import { Screen, Card, ThemedText, Icon, AppHeader, EmptyState, ErrorState, Skeleton } from '@/components/ui'
import { examApi, type ReviewItem } from '@/lib/examApi'

const TF_LABEL: Record<string, string> = { richtig: 'Richtig', falsch: 'Falsch' }
const label = (v: string | null) => (v == null ? '—' : (TF_LABEL[v.toLowerCase()] ?? v))

export default function ExamReviewScreen() {
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
        <Screen scroll edges={[]} contentStyle={{ paddingHorizontal: space[5], paddingBottom: space[10], gap: space[3], paddingTop: space[2] }}>
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <ThemedText variant="bodyStrong">Kết quả phần Đọc</ThemedText>
              <ThemedText variant="monoLg" color="accent">
                {correct}/{totalItems}
              </ThemedText>
            </View>
          </Card>

          {sections.map((s, si) => (
            <View key={si} style={{ gap: space[2] }}>
              <ThemedText variant="label" color="muted">
                {s.sectionName}
              </ThemedText>
              {s.items.map((item) => (
                <ReviewItemCard key={item.id} item={item} />
              ))}
            </View>
          ))}
        </Screen>
      )}
    </Screen>
  )
}

function ReviewItemCard({ item }: { item: ReviewItem }) {
  const c = useTheme().colors
  const ok = item.is_correct
  return (
    <Card style={{ gap: space[2], borderLeftWidth: 3, borderLeftColor: ok ? c.success : c.danger }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[2] }}>
        <View
          style={{
            width: 20,
            height: 20,
            borderRadius: radius.full,
            backgroundColor: ok ? c.successSoft : c.dangerSoft,
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 2,
          }}
        >
          <Icon icon={ok ? Check : X} size={12} color={ok ? 'success' : 'danger'} />
        </View>
        <ThemedText variant="bodyStrong" style={{ flex: 1 }}>
          {item.question}
        </ThemedText>
      </View>

      {!ok ? (
        <ThemedText variant="caption">
          <ThemedText variant="caption" color="muted">
            Bạn chọn:{' '}
          </ThemedText>
          <ThemedText variant="caption" style={{ color: c.danger }}>
            {label(item.user_answer)}
          </ThemedText>
        </ThemedText>
      ) : null}
      <ThemedText variant="caption">
        <ThemedText variant="caption" color="muted">
          Đáp án:{' '}
        </ThemedText>
        <ThemedText variant="caption" style={{ color: c.success }}>
          {label(item.correct_answer)}
        </ThemedText>
      </ThemedText>

      {item.explanation ? (
        <ThemedText variant="caption" color="muted">
          {item.explanation}
        </ThemedText>
      ) : null}
    </Card>
  )
}
