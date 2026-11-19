// Các khối dưới thẻ "Lịch ôn hôm nay" của màn Hôm nay (giao diện v3.4, Đợt 2b, 19/11/2026; mẫu
// `plans/ios-v3.4-mau` màn `today`): thẻ phỏng vấn theo nghề, hai ô nhanh (Thi thử trọn đề, Lộ trình),
// danh sách "Tiếp tục học". Chỉ hiện số có thật: thiếu dữ liệu thì ô/dòng đó tự ẩn hoặc nói rõ là chưa có.

import { useCallback, useState, type ReactNode } from 'react'
import { View } from 'react-native'
import { router, useFocusEffect, type Href } from 'expo-router'
import { radius, space, useTheme } from '@/lib/theme'
import { Button, Card, GaGlyph, ListRow, ProgressBar, SectionHeader, ThemedText } from '@/components/ui'
import { PersonaBubbleAvatar } from '@/components/speaking/PersonaBubbleAvatar'
import { go } from '@/components/exam/hub/HubCards'
import { useExamHub } from '@/hooks/useExamHub'
import { loadActiveSession } from '@/lib/activeSession'
import { fullExamRoute } from '@/lib/examRoutes'
import { resolveStagePersona, stagePersonaInfo } from '@/lib/workplaceInterviewers'
import { continueNode, nextMockDay, pendingInterview, shortDayDate } from '@/lib/homeToday'
import type { RoadmapNode } from '@/lib/lernwegApi'

function Eyebrow({ children }: { children: string }) {
  return (
    <ThemedText variant="label" color="muted" style={{ letterSpacing: 1, textTransform: 'uppercase', fontSize: 11 }}>
      {children}
    </ThemedText>
  )
}

/** Thẻ phỏng vấn theo nghề: có buổi phỏng vấn dở (tham chiếu resume cục bộ) thì mời làm tiếp. */
export function InterviewCard() {
  const c = useTheme().colors
  const [pending, setPending] = useState<ReturnType<typeof pendingInterview>>(null)

  // Tab không unmount: đọc lại tham chiếu mỗi lần quay về (buổi có thể vừa kết thúc ở tab Luyện nói).
  useFocusEffect(
    useCallback(() => {
      let alive = true
      void loadActiveSession().then((ref) => {
        if (alive) setPending(pendingInterview(ref))
      })
      return () => {
        alive = false
      }
    }, []),
  )

  const who = pending ? stagePersonaInfo(resolveStagePersona(pending.persona)) : null
  const open = () =>
    router.push({ pathname: '/(student)/speaking', params: { mode: 'INTERVIEW', t: String(Date.now()) } } as unknown as Href)

  return (
    <Card style={{ padding: space[4], gap: space[3] }}>
      <View style={{ flexDirection: 'row', gap: space[4], alignItems: 'center' }}>
        {pending ? (
          <PersonaBubbleAvatar personaId={resolveStagePersona(pending.persona)} size={64} paused />
        ) : (
          <View style={{ width: 64, height: 64, borderRadius: radius.sm, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
            <GaGlyph name="phongvan" size={30} ink="primary" />
          </View>
        )}
        <View style={{ flex: 1, gap: 3 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
            <Eyebrow>Phỏng vấn theo nghề</Eyebrow>
            {pending ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.accent }} /> : null}
          </View>
          <ThemedText variant="title">{who ? `${who.name} · buổi đang dở` : 'Phỏng vấn thử với nhà tuyển dụng Đức'}</ThemedText>
          <ThemedText variant="body" color="secondary" numberOfLines={2}>
            {pending
              ? pending.position
                ? `Vị trí ${pending.position}. Vào lại để trả lời tiếp.`
                : 'Vào lại để trả lời tiếp câu đang dở.'
              : 'AI đóng vai nhà tuyển dụng, hỏi như buổi phỏng vấn thật và nhận xét cuối buổi.'}
          </ThemedText>
        </View>
      </View>
      <Button
        label={pending ? 'Tiếp tục buổi phỏng vấn' : 'Vào phòng phỏng vấn'}
        variant="secondary"
        size="sm"
        onPress={open}
      />
    </Card>
  )
}

function Tile({
  glyph,
  label,
  children,
  a11y,
  onPress,
}: {
  glyph: 'thithu' | 'lernweg'
  label: string
  children: ReactNode
  a11y: string
  onPress: () => void
}) {
  return (
    <Card onPress={onPress} accessibilityLabel={a11y} style={{ flex: 1, padding: space[4], gap: space[1] }}>
      <GaGlyph name={glyph} size={26} />
      <ThemedText variant="caption" color="muted" style={{ marginTop: space[2] }}>
        {label}
      </ThemedText>
      {children}
    </Card>
  )
}

/** Hai ô nhanh: buổi thi thử trọn đề kế tiếp trong lịch ôn, tiến độ lộ trình. */
export function QuickTiles({
  roadmap,
}: {
  roadmap: { pct: number; done: number; total: number; range: string | null } | null
}) {
  const { data, derived } = useExamHub()
  const showMock = !!data?.access && !!derived && data.rows.length > 0
  const mock = showMock ? nextMockDay(derived?.week?.days, derived?.today ?? '') : null
  // Chưa có lịch ôn đang chạy (chưa đặt ngày thi) thì đừng nói "lịch ôn" như thể đã có (soát Đợt 2b).
  const hasActivePlan = data?.plan?.status === 'ACTIVE'
  if (!showMock && !roadmap) return null

  return (
    <View style={{ flexDirection: 'row', gap: space[3] }}>
      {showMock ? (
        mock ? (
          <Tile
            glyph="thithu"
            label="Thi thử trọn đề"
            a11y={`Thi thử trọn đề ${mock.date === derived?.today ? 'hôm nay' : shortDayDate(mock.date)}, ${mock.minutes} phút`}
            onPress={() => (mock.examId ? go(fullExamRoute(mock.examId)) : router.navigate('/(student)/exam'))}
          >
            <ThemedText variant="titleLg" style={{ fontVariant: ['tabular-nums'] }}>
              {mock.date === derived?.today ? 'Hôm nay' : shortDayDate(mock.date)}
            </ThemedText>
            <ThemedText variant="caption" color="muted" numberOfLines={2}>
              {`${mock.examTitle ?? 'Đề telc'} · ${mock.minutes} phút`}
            </ThemedText>
          </Tile>
        ) : (
          <Tile
            glyph="thithu"
            label="Thi thử trọn đề"
            a11y={hasActivePlan ? 'Thi thử trọn đề, tuần này chưa có buổi trong lịch ôn' : 'Thi thử trọn đề, đặt ngày thi để xếp buổi thi thử'}
            onPress={() => router.navigate('/(student)/exam')}
          >
            <ThemedText variant="title">Chưa xếp</ThemedText>
            <ThemedText variant="caption" color="muted" numberOfLines={2}>
              {hasActivePlan ? 'Tuần này chưa có buổi thi thử trong lịch ôn' : 'Đặt ngày thi để xếp buổi thi thử'}
            </ThemedText>
          </Tile>
        )
      ) : null}
      {roadmap ? (
        <Tile
          glyph="lernweg"
          label={roadmap.range ? `Lộ trình ${roadmap.range}` : 'Lộ trình'}
          a11y={`Lộ trình${roadmap.range ? ` ${roadmap.range}` : ''}, ${roadmap.pct}%, ${roadmap.done}/${roadmap.total} chặng`}
          onPress={() => router.push('/(student)/lernweg')}
        >
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
            <ThemedText variant="display" style={{ fontVariant: ['tabular-nums'] }}>{String(roadmap.pct)}</ThemedText>
            <ThemedText variant="caption" color="muted">%</ThemedText>
          </View>
          <ProgressBar value={roadmap.pct / 100} style={{ marginTop: space[1] }} />
        </Tile>
      ) : null}
    </View>
  )
}

/** "Tiếp tục học": chặng đang học trên lộ trình, ôn thẻ từ, luyện nói. */
export function ContinueLearning({ nodes }: { nodes: readonly RoadmapNode[] }) {
  const node = continueNode(nodes)
  return (
    <View>
      <SectionHeader title="Tiếp tục học" actionLabel="Lộ trình" onAction={() => router.push('/(student)/lernweg')} />
      <Card padded={false} style={{ paddingHorizontal: space[4] }}>
        {node ? (
          <>
            <ListRow
              glyph="lernweg"
              iconTone="accent"
              title={node.title}
              subtitle={[node.cefrLevel, node.subtitle].filter(Boolean).join(' · ')}
              onPress={() =>
                router.push({ pathname: '/(student)/node', params: { nodeId: String(node.id), title: node.title } } as unknown as Href)
              }
            />
            <Divider />
          </>
        ) : null}
        <ListRow
          glyph="hoc"
          iconTone="accent"
          title="Luyện từ vựng SRS"
          subtitle="Flashcard lặp lại ngắt quãng"
          onPress={() => router.push('/(student)/srs')}
        />
        <Divider />
        <ListRow
          glyph="speaking"
          iconTone="info"
          title="Luyện nói AI"
          subtitle="Hội thoại với AI coach"
          onPress={() => router.push('/(student)/speaking')}
        />
      </Card>
    </View>
  )
}

function Divider() {
  const c = useTheme().colors
  return <View style={{ height: 1, backgroundColor: c.border }} />
}
