// Lối vào thi thử trọn đề telc (mẫu v3.4 `mockstart`; Đợt 4 rồi 4b, 19/11/2026). Chọn kiểu lượt (Trọn
// đề · Phần viết · Phần nói), xem các phần thi và ba quy tắc, rồi gọi `/mock-exams/{id}/start` (máy chủ
// trả lượt đang dở nếu có, kèm nháp + mốc giờ — có thể bắt đầu trên web) và mở màn làm bài
// `exam-attempt` với đúng các câu đã lưu và đồng hồ theo giờ server. Phần nói thi ở phòng thi nói.

import { useState } from 'react'
import { Alert, Pressable, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { router, useLocalSearchParams, type Href } from 'expo-router'
import { ArrowLeft } from 'lucide-react-native'
import api, { apiMessage } from '@/lib/api'
import { radius, space, useTheme } from '@/lib/theme'
import { BrushMark, Button, ErrorState, GaGlyph, IconButton, Screen, Skeleton, ThemedText } from '@/components/ui'
import { getPracticeOverview } from '@/lib/telcPracticeApi'
import { practiceOverviewKey } from '@/lib/practiceTeil'
import { parseExamSections, type ExamAttempt } from '@/lib/examApi'
import { rememberAttemptStart, type AttemptStartBody } from '@/lib/attemptDraft'
import { useBackTo } from '@/hooks/useBackTo'
import { asHref, examSetRoute, oralRoute } from '@/lib/examRoutes'
import { trackFeatureAction } from '@/lib/analytics'
import type { GlyphName } from '@/lib/galerieGlyphs'

const BLOCK_NAME: Record<string, string> = { LESEN: 'Lesen', SPRACHBAUSTEINE: 'Sprachbausteine', HOEREN: 'Hören', SCHREIBEN: 'Schreiben' }
const BLOCK_GLYPH = { LESEN: 'doc', SPRACHBAUSTEINE: 'nguphap', HOEREN: 'nghe', SCHREIBEN: 'viet' } as const
/** Phần nói telc: ba Teil với giám khảo và bạn thi AI, khoảng 15 phút (định dạng đề cố định). */
const ORAL_MINUTES = 15

type Mode = 'all' | 'written' | 'oral'

export default function ExamFullScreen() {
  const { examId } = useLocalSearchParams<{ examId: string }>()
  return <FullIntro key={examId ?? 'none'} examId={Number(examId)} />
}

function FullIntro({ examId }: { examId: number }) {
  const c = useTheme().colors
  const goBack = useBackTo(() => asHref(examSetRoute(examId)))
  const [starting, setStarting] = useState(false)
  const [mode, setMode] = useState<Mode>('all')
  const { data: overview, isLoading, isError, refetch } = useQuery({
    queryKey: practiceOverviewKey(examId),
    queryFn: () => getPracticeOverview(examId),
    enabled: Number.isFinite(examId),
  })
  // Cùng khoá + cùng lời gọi với màn Đề: biết có lượt đang dở để nói "Làm tiếp" và đồng hồ đã chạy.
  const { data: attempts = [] } = useQuery({
    queryKey: ['exam-attempts-me'],
    queryFn: () =>
      api.get<ExamAttempt[]>('/mock-exams/attempts/me', { params: { includePartial: true } }).then((r) => r.data ?? []),
    staleTime: 30_000,
  })
  const running = attempts.some((a) => a.exam_id === examId && a.status === 'IN_PROGRESS')

  // Khối giờ lấy từ chính đề (telc B1: LV+SB 90′ · HV 30′ · SA 30′); đề không khai thì liệt kê phần.
  const parsed = overview?.sectionsJson ? parseExamSections(overview.sectionsJson) : null
  const blocks = (parsed?.blocks ?? [])
    .filter((b) => (b.sections ?? []).some((x) => x in BLOCK_NAME))
    .map((b) => {
      const secs = (b.sections ?? []).filter((x) => x in BLOCK_NAME)
      return { key: b.id || secs.join('-'), glyph: BLOCK_GLYPH[secs[0] as keyof typeof BLOCK_GLYPH] as GlyphName, name: secs.map((x) => BLOCK_NAME[x]).join(' + '), minutes: b.minutes }
    })
  const total = blocks.reduce((n, b) => n + b.minutes, 0)
  const level = overview?.level ?? 'B1'

  const modes: { id: Mode; glyph: GlyphName; name: string; meta: string }[] = [
    { id: 'all', glyph: 'thithu', name: 'Trọn đề', meta: `Phần viết rồi phần nói${total > 0 ? ` · khoảng ${total + ORAL_MINUTES} phút` : ''}` },
    { id: 'written', glyph: 'viet', name: 'Phần viết', meta: `Lesen, Sprachbausteine, Hören, Schreiben${total > 0 ? ` · ${total} phút` : ''}` },
    { id: 'oral', glyph: 'noi', name: 'Phần nói', meta: `3 Teil với giám khảo và bạn thi AI · khoảng ${ORAL_MINUTES} phút` },
  ]

  async function start() {
    setStarting(true)
    try {
      const { data } = await api.post<AttemptStartBody>(`/mock-exams/${examId}/start`)
      // Mốc giờ đo lúc NHẬN phản hồi: đồng hồ màn làm bài neo vào đây, không vào giờ máy.
      rememberAttemptStart(data, Date.now())
      trackFeatureAction('mock_exam', 'started', { exam_id: examId, level })
      router.replace({
        pathname: '/(student)/exam-attempt',
        // `t`: nonce để màn làm bài (sống ẩn dưới Tabs) dựng lại từ nháp mới nhất mỗi lần mở.
        params: { examId: String(examId), attemptId: String(data.id), title: overview?.title ?? '', level, resume: '1', t: String(Date.now()) },
      } as unknown as Href)
    } catch (e) {
      Alert.alert('Chưa bắt đầu được', apiMessage(e) || 'Thử lại sau ít phút.')
    } finally {
      setStarting(false)
    }
  }

  const startLabel = mode === 'oral' ? 'Bắt đầu phần nói' : running ? 'Làm tiếp phần viết' : mode === 'all' ? 'Bắt đầu trọn đề' : 'Bắt đầu phần viết'
  const onStart = () => (mode === 'oral' ? router.navigate(asHref(oralRoute({ level }))) : void start())

  return (
    <Screen edges={['top']}>
      <View style={{ paddingHorizontal: space[5], paddingTop: space[2] }}>
        <IconButton icon={ArrowLeft} accessibilityLabel="Về màn Đề" onPress={goBack} />
      </View>
      {isLoading ? (
        <View style={{ paddingHorizontal: space[5], gap: space[3], paddingTop: space[3] }}>
          <Skeleton height={60} radius="lg" />
          <Skeleton height={200} radius="lg" />
        </View>
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : (
        <Screen scroll edges={[]} contentStyle={{ paddingHorizontal: space[5], paddingBottom: space[12], paddingTop: space[3], gap: space[4] }}>
          <View style={{ gap: space[1] }}>
            <ThemedText variant="label" color="muted" style={{ letterSpacing: 1, textTransform: 'uppercase' }} numberOfLines={1}>
              {`Thi thử${overview ? ` · ${overview.title} · telc ${overview.level}` : ''}`}
            </ThemedText>
            <View
              style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', columnGap: space[2] }}
              accessible
              accessibilityRole="header"
              accessibilityLabel="Giống thi thật"
            >
              <ThemedText variant="display">Giống</ThemedText>
              <BrushMark>thi thật</BrushMark>
            </View>
          </View>

          <View accessibilityRole="radiogroup" accessibilityLabel="Phần thi" style={{ gap: space[2] + 2 }}>
            {modes.map((m) => {
              const on = mode === m.id
              return (
                <Pressable
                  key={m.id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={`${m.name}, ${m.meta}`}
                  onPress={() => setMode(m.id)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: space[3],
                    minHeight: 64,
                    padding: space[3],
                    borderRadius: radius.lg,
                    borderWidth: on ? 2 : 1,
                    borderColor: on ? c.textPrimary : c.border,
                    backgroundColor: c.surface,
                  }}
                >
                  <GaGlyph name={m.glyph} size={22} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <ThemedText variant="bodyStrong">{m.name}</ThemedText>
                    <ThemedText variant="caption" color="muted">{m.meta}</ThemedText>
                  </View>
                  <View
                    style={{ width: 22, height: 22, borderRadius: radius.full, borderWidth: 2, borderColor: on ? c.textPrimary : c.borderStrong, alignItems: 'center', justifyContent: 'center' }}
                  >
                    {on ? <View style={{ width: 10, height: 10, borderRadius: radius.full, backgroundColor: c.textPrimary }} /> : null}
                  </View>
                </Pressable>
              )
            })}
          </View>

          <View accessibilityLabel="Các phần thi">
            {blocks.map((b) => (
              <PartRow key={b.key} glyph={b.glyph} name={b.name} meta={`${b.minutes}′`} off={mode === 'oral'} />
            ))}
            <PartRow glyph="noi" name="Sprechen" meta={`~${ORAL_MINUTES}′`} off={mode === 'written'} />
          </View>

          {mode !== 'oral' ? (
            <View style={{ gap: space[3], backgroundColor: c.surfaceSunken, borderRadius: radius.lg, padding: space[4] }}>
              <Rule glyph="thoigian" text={running ? 'Bạn đang có lượt dở: đồng hồ tính từ lúc bắt đầu lượt đó và không dừng, kể cả khi thoát app.' : 'Đồng hồ chạy khi bấm Bắt đầu và không dừng, kể cả khi thoát app.'} />
              <Rule glyph="nghe" text="Vào Hören là không quay lại Lesen và Sprachbausteine." />
              <Rule glyph="hoanthanh" text="Bài tự lưu trong lúc làm. Hết giờ bài tự nộp; Viết được AI chấm sau khi nộp." />
            </View>
          ) : null}

          <View style={{ gap: space[2] }}>
            <Button label={starting ? 'Đang mở đề thi…' : startLabel} onPress={onStart} loading={starting} />
            {mode === 'all' ? (
              <ThemedText variant="caption" color="muted" align="center">Xong phần viết thì sang phòng thi nói.</ThemedText>
            ) : null}
          </View>
        </Screen>
      )}
    </Screen>
  )
}

function PartRow({ glyph, name, meta, off }: { glyph: GlyphName; name: string; meta: string; off: boolean }) {
  const c = useTheme().colors
  return (
    <View
      accessible
      accessibilityLabel={`${name}, ${meta.replace('′', ' phút')}${off ? ', không thi trong lượt này' : ''}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 48, borderTopWidth: 1, borderColor: c.border, opacity: off ? 0.35 : 1 }}
    >
      <GaGlyph name={glyph} size={20} />
      <ThemedText variant="body" style={{ flex: 1 }} accessibilityLanguage="de-DE">{name}</ThemedText>
      <ThemedText variant="caption" color="muted" style={{ fontVariant: ['tabular-nums'] }}>{meta}</ThemedText>
    </View>
  )
}

function Rule({ glyph, text }: { glyph: GlyphName; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[3] }}>
      <GaGlyph name={glyph} size={20} />
      <ThemedText variant="body" color="secondary" style={{ flex: 1 }}>{text}</ThemedText>
    </View>
  )
}
