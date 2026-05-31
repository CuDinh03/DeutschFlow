import { View } from 'react-native'
import { useQuery, useMutation } from '@tanstack/react-query'
import { router } from 'expo-router'
import { Trophy, Clock, Target, Lock } from 'lucide-react-native'
import { Alert } from 'react-native'
import api from '@/lib/api'
import { space, useTheme } from '@/lib/theme'
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

export default function ExamScreen() {
  const theme = useTheme()
  const { isPro } = usePlanStore()

  const { data: variants = [], isLoading } = useQuery({
    queryKey: ['exam-variants'],
    queryFn: () => api.get<ExamVariant[]>('/mock-exam/variants').then((r) => r.data),
    enabled: isPro,
    staleTime: 300_000,
  })

  const startExam = useMutation({
    mutationFn: (variantId: number) => api.post<{ attemptId: number }>('/mock-exam/start', { variantId }),
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
                <MetaItem icon={Trophy} label={`${variant.totalQuestions} câu`} />
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
