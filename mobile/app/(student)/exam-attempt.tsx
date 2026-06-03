import { useMemo, useState } from 'react'
import { View, Pressable, Alert } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { router, useLocalSearchParams } from 'expo-router'
import { Check, BookOpen } from 'lucide-react-native'
import api, { apiMessage } from '@/lib/api'
import { radius, space, useTheme } from '@/lib/theme'
import { Screen, Card, ThemedText, Icon, Pill, Button, AppHeader, EmptyState, ErrorState, Skeleton } from '@/components/ui'
import { parseLesenItems, type ExamObjItem } from '@/lib/examApi'

interface AttemptResult {
  totalScore?: number
}

// Auto-scored objective reading (Lesen) attempt. Listening/Writing/Speaking are
// scored on the web; the app covers the true/false + single-choice items so a
// student can practise reading and get an instant score.
export default function ExamAttemptScreen() {
  const theme = useTheme()
  const c = theme.colors
  const params = useLocalSearchParams<{ examId: string; attemptId: string; title?: string }>()
  const examId = Number(params.examId)
  const attemptId = Number(params.attemptId)

  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [score, setScore] = useState<number | null>(null)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['exam-questions', examId],
    queryFn: () =>
      api.get<{ sections_json: string }>(`/mock-exams/${examId}/questions`).then((r) => r.data),
    enabled: Number.isFinite(examId),
  })

  const parsed = useMemo(
    () => (data?.sections_json ? parseLesenItems(data.sections_json) : null),
    [data?.sections_json],
  )

  const totalItems = parsed?.groups.reduce((n, g) => n + g.items.length, 0) ?? 0
  const answeredCount = Object.keys(answers).length

  async function submit() {
    if (answeredCount === 0) return
    setSubmitting(true)
    try {
      await api.post(`/mock-exams/attempts/${attemptId}/finish`, { answers })
      const res = await api.get<AttemptResult>(`/mock-exams/attempts/${attemptId}/result`)
      setScore(res.data.totalScore ?? 0)
    } catch (e) {
      Alert.alert('Lỗi', apiMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Screen edges={['top']}>
      <AppHeader title={params.title ?? 'Bài thi'} subtitle="Phần Đọc (Lesen)" onBack={() => router.back()} />

      {isLoading ? (
        <View style={{ paddingHorizontal: space[5], gap: space[3], paddingTop: space[2] }}>
          <Skeleton height={90} radius="2xl" />
          <Skeleton height={90} radius="2xl" />
        </View>
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : score != null ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState
            icon={Check}
            title={`Bạn được ${score} điểm`}
            message="Phần Đọc đã được chấm tự động. Phần Nghe, Viết và Nói làm trên web để có điểm đầy đủ."
            actionLabel="Xong"
            onAction={() => router.back()}
          />
        </View>
      ) : !parsed || parsed.groups.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState
            icon={BookOpen}
            title="Chưa hỗ trợ trên app"
            message="Đề này gồm phần Nghe/Viết/Nói — hãy làm trên web. App hỗ trợ các đề có phần Đọc trắc nghiệm."
          />
        </View>
      ) : (
        <Screen scroll edges={[]} contentStyle={{ paddingHorizontal: space[5], paddingBottom: space[10], gap: space[3], paddingTop: space[2] }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: space[2],
              backgroundColor: c.infoSoft,
              borderRadius: radius.md,
              padding: space[3],
            }}
          >
            <Icon icon={BookOpen} size={16} color="info" />
            <ThemedText variant="caption" color="info" style={{ flex: 1 }}>
              Phần Đọc trắc nghiệm. Nghe/Viết/Nói làm trên web để có điểm đầy đủ.
            </ThemedText>
          </View>

          {parsed.groups.map((group, gi) => (
            <View key={gi} style={{ gap: space[2] }}>
              <ThemedText variant="label" color="muted">
                {group.title}
              </ThemedText>
              {group.items.map((item) => (
                <QuestionCard
                  key={item.id}
                  item={item}
                  selected={answers[item.id]}
                  onSelect={(val) => setAnswers((prev) => ({ ...prev, [item.id]: val }))}
                />
              ))}
            </View>
          ))}

          <ThemedText variant="caption" color="faint" align="center">
            Đã trả lời {answeredCount}/{totalItems} câu
          </ThemedText>
          <Button
            label={submitting ? 'Đang chấm…' : 'Nộp bài'}
            onPress={submit}
            loading={submitting}
            disabled={answeredCount === 0}
          />
        </Screen>
      )}
    </Screen>
  )
}

function QuestionCard({
  item,
  selected,
  onSelect,
}: {
  item: ExamObjItem
  selected?: string
  onSelect: (val: string) => void
}) {
  const choices = item.options ?? ['richtig', 'falsch']
  const labelFor = (v: string) => (v === 'richtig' ? 'Richtig' : v === 'falsch' ? 'Falsch' : v)
  return (
    <Card style={{ gap: space[3] }}>
      {item.passage ? (
        <ThemedText variant="caption" color="secondary">
          {item.passage}
        </ThemedText>
      ) : null}
      <ThemedText variant="bodyStrong">{item.question}</ThemedText>
      <View style={{ gap: space[2] }}>
        {choices.map((choice) => (
          <Choice key={choice} label={labelFor(choice)} active={selected === choice} onPress={() => onSelect(choice)} />
        ))}
      </View>
    </Card>
  )
}

function Choice({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { colors } = useTheme()
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[2],
        borderWidth: 1,
        borderColor: active ? colors.accent : colors.border,
        backgroundColor: active ? colors.accentSoft : colors.surface,
        borderRadius: radius.md,
        paddingHorizontal: space[3],
        paddingVertical: space[3],
      }}
    >
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: radius.full,
          borderWidth: 2,
          borderColor: active ? colors.accent : colors.border,
          backgroundColor: active ? colors.accent : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {active ? <Icon icon={Check} size={12} color="onAccent" /> : null}
      </View>
      <ThemedText variant="body" color={active ? 'primary' : 'secondary'} style={{ flex: 1 }}>
        {label}
      </ThemedText>
    </Pressable>
  )
}
