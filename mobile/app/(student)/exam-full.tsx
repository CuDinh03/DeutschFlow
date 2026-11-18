// Lối vào thi thử trọn đề telc (Đợt 4, 19/11/2026). Giới thiệu bài thi rồi gọi `/mock-exams/{id}/start`
// (máy chủ trả lượt đang dở nếu có) và mở màn làm bài có sẵn `exam-attempt` (dựng đủ Lesen,
// Sprachbausteine, Hören, Schreiben, nộp rồi chờ chấm). Còn thiếu so với web: lưu nháp lên máy chủ
// và đồng hồ đếm ngược trên màn làm bài — ghi ở bảng theo dõi thi công.

import { useState } from 'react'
import { Alert, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { router, useLocalSearchParams, type Href } from 'expo-router'
import api, { apiMessage } from '@/lib/api'
import { space } from '@/lib/theme'
import { AppHeader, Button, Card, ErrorState, GaGlyph, Screen, Skeleton, ThemedText } from '@/components/ui'
import { getPracticeOverview } from '@/lib/telcPracticeApi'
import { practiceOverviewKey } from '@/lib/practiceTeil'
import { useBackTo } from '@/hooks/useBackTo'
import { asHref, examSetRoute } from '@/lib/examRoutes'
import { trackFeatureAction } from '@/lib/analytics'

const BLOCKS = [
  { glyph: 'doc' as const, name: 'Lesen und Sprachbausteine', minutes: 90 },
  { glyph: 'nghe' as const, name: 'Hören', minutes: 30 },
  { glyph: 'viet' as const, name: 'Schreiben', minutes: 30 },
]

export default function ExamFullScreen() {
  const { examId } = useLocalSearchParams<{ examId: string }>()
  return <FullIntro key={examId ?? 'none'} examId={Number(examId)} />
}

function FullIntro({ examId }: { examId: number }) {
  const goBack = useBackTo(() => asHref(examSetRoute(examId)))
  const [starting, setStarting] = useState(false)
  const { data: overview, isLoading, isError, refetch } = useQuery({
    queryKey: practiceOverviewKey(examId),
    queryFn: () => getPracticeOverview(examId),
    enabled: Number.isFinite(examId),
  })

  async function start() {
    setStarting(true)
    try {
      const { data } = await api.post<{ id: number }>(`/mock-exams/${examId}/start`)
      trackFeatureAction('mock_exam', 'started', { exam_id: examId, level: overview?.level ?? 'B1' })
      router.replace({
        pathname: '/(student)/exam-attempt',
        params: { examId: String(examId), attemptId: String(data.id), title: overview?.title ?? '', level: overview?.level ?? 'B1' },
      } as unknown as Href)
    } catch (e) {
      Alert.alert('Chưa bắt đầu được', apiMessage(e) || 'Thử lại sau ít phút.')
    } finally {
      setStarting(false)
    }
  }

  return (
    <Screen edges={['top']}>
      <AppHeader title="Thi thử trọn đề" subtitle={overview?.title} onBack={goBack} />
      {isLoading ? (
        <View style={{ paddingHorizontal: space[5], gap: space[3] }}>
          <Skeleton height={200} radius="lg" />
        </View>
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : (
        <Screen scroll edges={[]} contentStyle={{ paddingHorizontal: space[5], paddingBottom: space[12], gap: space[4] }}>
          <ThemedText variant="body" color="secondary">
            Làm như thi thật: ba khối liền nhau, tổng khoảng 150 phút. Nộp bài xong máy chấm phần đọc, nghe; AI chấm bài viết.
          </ThemedText>
          <Card style={{ gap: space[3] }}>
            {BLOCKS.map((b) => (
              <View key={b.name} style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
                <GaGlyph name={b.glyph} size={22} />
                <ThemedText variant="bodyStrong" style={{ flex: 1 }} accessibilityLanguage="de-DE">{b.name}</ThemedText>
                <ThemedText variant="caption" color="muted">{b.minutes} phút</ThemedText>
              </View>
            ))}
          </Card>
          <ThemedText variant="caption" color="muted">
            Phần nói làm riêng trong phòng thi nói. Trên app, bài đang làm chưa lưu lên máy chủ: thoát giữa chừng sẽ mất câu đã trả lời.
          </ThemedText>
          <Button label={starting ? 'Đang mở đề…' : 'Bắt đầu thi thử'} onPress={() => void start()} loading={starting} />
        </Screen>
      )}
    </Screen>
  )
}
