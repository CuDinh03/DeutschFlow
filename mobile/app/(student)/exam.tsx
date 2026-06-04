import { useState } from 'react'
import { View, Pressable } from 'react-native'
import { useQuery, useMutation } from '@tanstack/react-query'
import { router, type Href } from 'expo-router'
import { Trophy, Clock, Target, Lock, ChevronRight } from 'lucide-react-native'
import { Alert } from 'react-native'
import api, { apiMessage } from '@/lib/api'
import { radius, space, useTheme } from '@/lib/theme'
import { Screen, Card, ThemedText, Icon, Pill, AppHeader, EmptyState, ErrorState, SectionHeader, Skeleton } from '@/components/ui'
import { usePlanStore } from '@/stores/usePlanStore'
import { mapExam, examApi, type RawMockExam, type ExamVariant, type ExamAttempt } from '@/lib/examApi'
import { trackFeatureAction } from '@/lib/analytics'
import { useScreenTime } from '@/hooks/useScreenTime'

const EXAM_LEVELS = ['A1', 'A2', 'B1', 'B2'] as const

export default function ExamScreen() {
  useScreenTime('exam')
  const theme = useTheme()
  const { isPro } = usePlanStore()

  const [level, setLevel] = useState<string>('B1')

  const { data: variants = [], isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['exam-variants', level],
    queryFn: () =>
      api.get<RawMockExam[]>('/mock-exams', { params: { cefrLevel: level } }).then((r) => r.data.map(mapExam)),
    enabled: isPro,
    staleTime: 300_000,
  })

  const { data: recommendedId } = useQuery({
    queryKey: ['exam-recommend', level],
    queryFn: () => examApi.recommend(level),
    enabled: isPro,
    staleTime: 300_000,
  })

  const { data: attempts = [], refetch: refetchAttempts } = useQuery({
    queryKey: ['exam-attempts'],
    queryFn: () => examApi.listAttempts(),
    enabled: isPro,
    staleTime: 60_000,
  })

  const completedAttempts = attempts.filter((a) => a.status === 'COMPLETED').slice(0, 5)

  const startExam = useMutation({
    mutationFn: (examId: number) =>
      api.post<{ id: number }>(`/mock-exams/${examId}/start`).then((r) => r.data),
  })

  function handleStart(variant: ExamVariant) {
    Alert.alert('Bắt đầu thi?', 'Phần Đọc chấm tự động trên app; phần Nghe/Viết/Nói làm trên web.', [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Bắt đầu',
        onPress: () => {
          trackFeatureAction('mock_exam', 'started', { exam_id: variant.id, level })
          startExam.mutate(variant.id, {
            onSuccess: (res) =>
              router.push({
                // Route exists; typed-route union regenerates on next `expo start`.
                pathname: '/(student)/exam-attempt',
                params: { examId: String(variant.id), attemptId: String(res.id), title: variant.title },
              } as unknown as Href),
            onError: (e) => Alert.alert('Lỗi', apiMessage(e)),
          })
        },
      },
    ])
  }

  return (
    <Screen edges={['top']}>
      <AppHeader title="Thi thử Goethe" onBack={() => router.back()} />

      {isPro ? (
        <View style={{ flexDirection: 'row', gap: space[2], paddingHorizontal: space[5], paddingVertical: space[3] }}>
          {EXAM_LEVELS.map((lv) => {
            const active = level === lv
            return (
              <Pressable
                key={lv}
                onPress={() => setLevel(lv)}
                style={{
                  paddingHorizontal: space[4],
                  paddingVertical: space[2],
                  borderRadius: radius.full,
                  borderWidth: 1,
                  borderColor: active ? theme.colors.accent : theme.colors.border,
                  backgroundColor: active ? theme.colors.accentSoft : theme.colors.surface,
                }}
              >
                <ThemedText variant="label" color={active ? 'accent' : 'secondary'}>
                  {lv}
                </ThemedText>
              </Pressable>
            )
          })}
        </View>
      ) : null}

      {!isPro ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState
            icon={Lock}
            title="Tính năng PRO"
            message="Thi thử theo format Goethe chính thức, xem điểm chi tiết và phân tích điểm yếu."
            actionLabel="Xem PRO"
            onAction={() => router.push('/(student)/upgrade')}
          />
        </View>
      ) : isLoading ? (
        <View style={{ paddingHorizontal: space[5], gap: space[3], paddingTop: space[2] }}>
          <Skeleton height={110} radius="2xl" />
          <Skeleton height={110} radius="2xl" />
        </View>
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : (
        <Screen
          scroll
          edges={[]}
          contentStyle={{ paddingHorizontal: space[5], paddingBottom: space[6], gap: space[3], paddingTop: space[2] }}
          refreshing={isFetching && !isLoading}
          onRefresh={() => {
            void refetch()
            void refetchAttempts()
          }}
        >
          {variants.length === 0 ? (
            <EmptyState icon={Trophy} title="Chưa có đề thi" message={`Chưa có đề thi ${level}. Thử cấp độ khác.`} />
          ) : null}
          {variants.map((variant) => {
            const isRec = variant.isRecommended || variant.id === recommendedId
            return (
              <Card
                key={variant.id}
                onPress={() => handleStart(variant)}
                style={{ borderColor: isRec ? theme.colors.accent + '66' : theme.colors.border }}
              >
                {isRec ? <Pill label="Gợi ý cho bạn" tone="accent" style={{ marginBottom: space[3] }} /> : null}
                <ThemedText variant="title" style={{ marginBottom: space[2] }}>
                  {variant.title}
                </ThemedText>
                <View style={{ flexDirection: 'row', gap: space[4] }}>
                  <MetaItem icon={Target} label={variant.cefrLevel} />
                  {variant.totalQuestions > 0 ? <MetaItem icon={Trophy} label={`${variant.totalQuestions} câu`} /> : null}
                  <MetaItem icon={Clock} label={`${variant.timeLimitMinutes} phút`} />
                </View>
              </Card>
            )
          })}

          {completedAttempts.length > 0 ? (
            <View style={{ marginTop: space[4], gap: space[2] }}>
              <SectionHeader title="Lịch sử thi" />
              {completedAttempts.map((a) => (
                <AttemptRow key={a.id} attempt={a} />
              ))}
            </View>
          ) : null}
        </Screen>
      )}
    </Screen>
  )
}

function AttemptRow({ attempt }: { attempt: ExamAttempt }) {
  const c = useTheme().colors
  const passed = attempt.passed === true
  return (
    <Card
      onPress={() =>
        router.push({
          pathname: '/(student)/exam-review',
          params: { attemptId: String(attempt.id), title: attempt.exam_title },
        } as unknown as Href)
      }
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
        <View style={{ flex: 1, gap: 2 }}>
          <ThemedText variant="bodyStrong" numberOfLines={1}>
            {attempt.exam_title}
          </ThemedText>
          <ThemedText variant="caption" color="muted">
            {shortDate(attempt.finished_at ?? attempt.started_at)}
            {attempt.total_score != null ? ` · ${attempt.total_score} điểm` : ''}
          </ThemedText>
        </View>
        {attempt.passed != null ? (
          <Pill label={passed ? 'Đạt' : 'Chưa đạt'} tone={passed ? 'success' : 'danger'} />
        ) : null}
        <Icon icon={ChevronRight} size={16} color="faint" />
      </View>
    </Card>
  )
}

function shortDate(iso: string | null): string {
  if (!iso) return ''
  const p = iso.slice(0, 10).split('-')
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : ''
}

function MetaItem({ icon, label }: { icon: typeof Target; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] }}>
      <Icon icon={icon} size={13} color="muted" />
      <ThemedText variant="caption" color="muted">
        {label}
      </ThemedText>
    </View>
  )
}
