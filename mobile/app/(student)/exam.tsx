import { useState } from 'react'
import { View, Pressable } from 'react-native'
import { useQuery, useMutation } from '@tanstack/react-query'
import { router } from 'expo-router'
import { Trophy, Clock, Target, Lock } from 'lucide-react-native'
import { Alert } from 'react-native'
import api from '@/lib/api'
import { radius, space, useTheme } from '@/lib/theme'
import { Screen, Card, ThemedText, Icon, Pill, AppHeader, EmptyState, Skeleton } from '@/components/ui'
import { usePlanStore } from '@/stores/usePlanStore'

interface ExamVariant {
  id: number
  title: string
  cefrLevel: string
  totalQuestions: number
  timeLimitMinutes: number
  isRecommended?: boolean
}

// Backend GET /api/mock-exams?cefrLevel=X returns raw snake_case rows.
interface RawMockExam {
  id: number
  cefr_level: string
  title: string
  time_limit_minutes: number
  total_questions?: number
}

const EXAM_LEVELS = ['A1', 'A2', 'B1', 'B2'] as const

function mapExam(e: RawMockExam): ExamVariant {
  return {
    id: e.id,
    title: e.title,
    cefrLevel: e.cefr_level,
    totalQuestions: e.total_questions ?? 0,
    timeLimitMinutes: e.time_limit_minutes,
  }
}

export default function ExamScreen() {
  const theme = useTheme()
  const { isPro } = usePlanStore()

  const [level, setLevel] = useState<string>('B1')

  const { data: variants = [], isLoading } = useQuery({
    queryKey: ['exam-variants', level],
    queryFn: () =>
      api.get<RawMockExam[]>('/mock-exams', { params: { cefrLevel: level } }).then((r) => r.data.map(mapExam)),
    enabled: isPro,
    staleTime: 300_000,
  })

  const startExam = useMutation({
    mutationFn: (examId: number) => api.post<{ attemptId?: number }>(`/mock-exams/${examId}/start`),
  })

  function handleStart(variantId: number) {
    Alert.alert('Bắt đầu thi?', 'Bài thi sẽ tính giờ. Bạn có sẵn sàng?', [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Bắt đầu',
        onPress: () => {
          startExam.mutate(variantId, {
            onSuccess: () => Alert.alert('Đang phát triển', 'Màn hình thi đang được xây dựng.'),
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
      ) : (
        <Screen scroll edges={[]} contentStyle={{ paddingHorizontal: space[5], paddingBottom: space[6], gap: space[3], paddingTop: space[2] }}>
          {variants.length === 0 ? (
            <EmptyState icon={Trophy} title="Chưa có đề thi" message={`Chưa có đề thi ${level}. Thử cấp độ khác.`} />
          ) : null}
          {variants.map((variant) => (
            <Card
              key={variant.id}
              onPress={() => handleStart(variant.id)}
              style={{ borderColor: variant.isRecommended ? theme.colors.accent + '66' : theme.colors.border }}
            >
              {variant.isRecommended ? <Pill label="Gợi ý" tone="accent" style={{ marginBottom: space[3] }} /> : null}
              <ThemedText variant="title" style={{ marginBottom: space[2] }}>
                {variant.title}
              </ThemedText>
              <View style={{ flexDirection: 'row', gap: space[4] }}>
                <MetaItem icon={Target} label={variant.cefrLevel} />
                {variant.totalQuestions > 0 ? <MetaItem icon={Trophy} label={`${variant.totalQuestions} câu`} /> : null}
                <MetaItem icon={Clock} label={`${variant.timeLimitMinutes} phút`} />
              </View>
            </Card>
          ))}
        </Screen>
      )}
    </Screen>
  )
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
