// Lối vào thi thử trọn đề telc (Đợt 4, 19/11/2026). Giới thiệu bài thi rồi gọi `/mock-exams/{id}/start`
// (máy chủ trả lượt đang dở nếu có, kèm nháp — có thể làm trên web) và mở màn làm bài có sẵn
// `exam-attempt` với đúng các câu đã trả lời. Còn thiếu so với web: lưu nháp lên máy chủ trong lúc
// làm và đồng hồ đếm ngược trên màn làm bài — nên màn này không hứa "bấm giờ".

import { useState } from 'react'
import { Alert, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { router, useLocalSearchParams, type Href } from 'expo-router'
import api, { apiMessage } from '@/lib/api'
import { space } from '@/lib/theme'
import { AppHeader, Button, Card, ErrorState, GaGlyph, Screen, Skeleton, ThemedText } from '@/components/ui'
import { getPracticeOverview } from '@/lib/telcPracticeApi'
import { practiceOverviewKey } from '@/lib/practiceTeil'
import { parseExamSections } from '@/lib/examApi'
import { parseDraftAnswers, rememberAttemptDraft } from '@/lib/attemptDraft'
import { useBackTo } from '@/hooks/useBackTo'
import { asHref, examSetRoute } from '@/lib/examRoutes'
import { trackFeatureAction } from '@/lib/analytics'

const BLOCK_NAME: Record<string, string> = { LESEN: 'Lesen', SPRACHBAUSTEINE: 'Sprachbausteine', HOEREN: 'Hören', SCHREIBEN: 'Schreiben' }
const BLOCK_GLYPH = { LESEN: 'doc', SPRACHBAUSTEINE: 'nguphap', HOEREN: 'nghe', SCHREIBEN: 'viet' } as const

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

  // Khối giờ lấy từ chính đề (telc B1: LV+SB 90′ · HV 30′ · SA 30′); đề không khai thì liệt kê phần.
  const parsed = overview?.sectionsJson ? parseExamSections(overview.sectionsJson) : null
  const blocks = (parsed?.blocks ?? [])
    .filter((b) => (b.sections ?? []).some((x) => x in BLOCK_NAME))
    .map((b) => {
      const secs = (b.sections ?? []).filter((x) => x in BLOCK_NAME)
      return { key: b.id || secs.join('-'), glyph: BLOCK_GLYPH[secs[0] as keyof typeof BLOCK_GLYPH], name: secs.map((x) => BLOCK_NAME[x]).join(' und '), minutes: b.minutes }
    })
  const total = blocks.reduce((n, b) => n + b.minutes, 0)

  async function start() {
    setStarting(true)
    try {
      const { data } = await api.post<{ id: number; draft?: { answers_json?: string | null } | null }>(`/mock-exams/${examId}/start`)
      rememberAttemptDraft(data.id, parseDraftAnswers(data.draft?.answers_json))
      trackFeatureAction('mock_exam', 'started', { exam_id: examId, level: overview?.level ?? 'B1' })
      router.replace({
        pathname: '/(student)/exam-attempt',
        params: { examId: String(examId), attemptId: String(data.id), title: overview?.title ?? '', level: overview?.level ?? 'B1', resume: '1' },
      } as unknown as Href)
    } catch (e) {
      Alert.alert('Chưa bắt đầu được', apiMessage(e) || 'Thử lại sau ít phút.')
    } finally {
      setStarting(false)
    }
  }

  return (
    <Screen edges={['top']}>
      <AppHeader title="Thi thử trọn đề" subtitle={overview ? `${overview.title} · telc ${overview.level}` : undefined} onBack={goBack} />
      {isLoading ? (
        <View style={{ paddingHorizontal: space[5], gap: space[3] }}>
          <Skeleton height={200} radius="lg" />
        </View>
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : (
        <Screen scroll edges={[]} contentStyle={{ paddingHorizontal: space[5], paddingBottom: space[12], gap: space[4] }}>
          <ThemedText variant="body" color="secondary">
            Làm trọn đề như thi thật{total > 0 ? `, khoảng ${total} phút` : ''}. Nộp bài xong máy chấm phần đọc, nghe; AI chấm bài viết. Trên app chưa có đồng hồ đếm ngược: tự canh giờ theo từng khối.
          </ThemedText>
          {blocks.length > 0 ? (
          <Card style={{ gap: space[3] }}>
            {blocks.map((b) => (
              <View key={b.key} style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
                <GaGlyph name={b.glyph} size={22} />
                <ThemedText variant="bodyStrong" style={{ flex: 1 }} accessibilityLanguage="de-DE">{b.name}</ThemedText>
                <ThemedText variant="caption" color="muted">{b.minutes} phút</ThemedText>
              </View>
            ))}
          </Card>
          ) : null}
          <ThemedText variant="caption" color="muted">
            Phần nói làm riêng trong phòng thi nói. Lượt đang dở (kể cả bắt đầu trên web) mở lại đúng các câu đã lưu. Trong lúc làm trên app, câu trả lời chưa lưu lên máy chủ: thoát giữa chừng sẽ mất phần làm thêm.
          </ThemedText>
          <Button label={starting ? 'Đang mở đề…' : 'Bắt đầu thi thử'} onPress={() => void start()} loading={starting} />
        </Screen>
      )}
    </Screen>
  )
}
