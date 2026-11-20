import { useMemo } from 'react'
import { View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { usePullRefresh } from '@/hooks/usePullRefresh'
import { useLocalSearchParams } from 'expo-router'
import { apiMessage } from '@/lib/api'
import { fetchClassSessions, type ClassSession } from '@/lib/studentClassesApi'
import { space, radius, useTheme } from '@/lib/theme'
import {
  EmptyState, ErrorState, Screen, Skeleton, ThemedText,
} from '@/components/ui'
import { ListBlock, SectionTitle, StatusBadge, TopBar, listRowStyle, type BadgeTone } from '@/components/classroom/ClassroomParts'
import { clockLabel, sessionDayBox } from '@/lib/classroomUi'
import { useBackTo } from '@/hooks/useBackTo'

// Giao diện v3.4 (Đợt 6B, mẫu `cschedule`): thanh đầu "Lịch buổi học" + tên lớp, hai khối danh sách
// "Sắp tới" / "Đã qua"; mỗi dòng có ô ngày (số + thứ), giờ học, phòng, nhãn trạng thái.
export default function ClassScheduleScreen() {
  const params = useLocalSearchParams<{ classId: string; className?: string }>()
  // Back tường minh về màn cha — Tabs firstRoute sẽ về Heute (xem lib/screenParents).
  const goBack = useBackTo(() => ({ pathname: '/(student)/classes/[id]', params: { id: params.classId } }))
  const classId = Number(params.classId)
  const className = params.className ?? 'Lịch học'

  const q = useQuery({
    queryKey: ['class-sessions', classId],
    queryFn: () => fetchClassSessions(classId),
    enabled: Number.isFinite(classId),
    staleTime: 60_000,
  })
  const pull = usePullRefresh(q.refetch)

  const { upcoming, past } = useMemo(() => {
    const now = Date.now()
    const list = q.data ?? []
    const up = list.filter((s) => new Date(s.startAt).getTime() >= now)
    const pa = list.filter((s) => new Date(s.startAt).getTime() < now).reverse() // most recent first
    return { upcoming: up, past: pa }
  }, [q.data])

  return (
    <Screen edges={['top']}>
      <TopBar title="Lịch buổi học" subtitle={className} onBack={goBack} />

      {q.isLoading ? (
        <View style={{ paddingHorizontal: space[5], gap: space[3], paddingTop: space[4] }}>
          <Skeleton height={84} radius="lg" />
          <Skeleton height={84} radius="lg" />
        </View>
      ) : q.isError ? (
        <ErrorState message={apiMessage(q.error)} onRetry={() => void q.refetch()} />
      ) : (q.data?.length ?? 0) === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState
            glyph="lich"
            title="Chưa có lịch học"
            message="Lớp chưa có buổi học nào được xếp lịch."
          />
        </View>
      ) : (
        <Screen
          scroll
          edges={[]}
          contentStyle={{ paddingHorizontal: space[5], paddingBottom: space[10] }}
          refreshing={pull.refreshing}
          onRefresh={() => void pull.onRefresh()}
        >
          {upcoming.length > 0 ? (
            <View>
              <SectionTitle>Sắp tới</SectionTitle>
              <ListBlock>
                {upcoming.map((s, i) => (
                  <SessionRow key={s.id} session={s} first={i === 0} />
                ))}
              </ListBlock>
            </View>
          ) : null}
          {past.length > 0 ? (
            <View>
              <SectionTitle>Đã qua</SectionTitle>
              <ListBlock style={{ opacity: 0.7 }}>
                {past.map((s, i) => (
                  <SessionRow key={s.id} session={s} first={i === 0} past />
                ))}
              </ListBlock>
            </View>
          ) : null}
        </Screen>
      )}
    </Screen>
  )
}

function SessionRow({ session, first, past }: { session: ClassSession; first: boolean; past?: boolean }) {
  const c = useTheme().colors
  const start = new Date(session.startAt)
  const valid = !Number.isNaN(start.getTime())
  const end = valid ? new Date(start.getTime() + session.durationMinutes * 60_000) : null
  const box = sessionDayBox(session.startAt)
  const st = sessionStatus(session.status, past)
  const cancelled = session.status === 'CANCELLED'
  const online = session.mode === 'ONLINE'
  const where = online ? 'Học online' : session.room ? `Phòng ${session.room}` : 'Chưa có phòng'
  const when = valid && end ? `${clockLabel(start.toISOString())} – ${clockLabel(end.toISOString())}` : `${session.durationMinutes} phút`
  return (
    <View
      style={listRowStyle(c.border, first)}
      accessible
      accessibilityLabel={`${valid ? start.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric' }) : ''}, ${when}, ${where}, ${st.label}`}
    >
      <View
        style={{
          width: 46,
          height: 50,
          borderRadius: radius.md,
          backgroundColor: c.surfaceSunken,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ThemedText variant="title" style={{ lineHeight: 22, fontVariant: ['tabular-nums'] }}>{box?.day ?? '—'}</ThemedText>
        <ThemedText variant="caption" color="muted" style={{ fontSize: 11, lineHeight: 13 }}>{box?.weekday ?? ''}</ThemedText>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <ThemedText
          variant="bodyStrong"
          style={cancelled ? { textDecorationLine: 'line-through' } : undefined}
        >
          {when}
        </ThemedText>
        <ThemedText variant="caption" color="muted" numberOfLines={1}>
          {where}
          {box ? ` · ${box.month}` : ''}
        </ThemedText>
      </View>
      <StatusBadge tone={st.tone} label={st.label} />
    </View>
  )
}

/**
 * Nhãn trạng thái buổi. Buổi ĐÃ QUA vẫn ở trạng thái đã xếp thì hiện "Đã qua" (mẫu ghi "Đã học",
 * nhưng API lịch không cho biết học viên có đi học hay không — điểm danh nằm ở tab Đánh giá).
 */
function sessionStatus(status: ClassSession['status'], past?: boolean): { label: string; tone: BadgeTone } {
  switch (status) {
    case 'CANCELLED':
      return { label: 'Đã huỷ', tone: 'danger' }
    case 'MOVED':
      return { label: 'Dời lịch', tone: 'accent' }
    default:
      return past ? { label: 'Đã qua', tone: 'neutral' } : { label: 'Đã xếp', tone: 'success' }
  }
}
