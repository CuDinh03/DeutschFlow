import { useMemo } from 'react'
import { View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { router, useLocalSearchParams } from 'expo-router'
import { CalendarClock, Clock, MapPin, Video } from 'lucide-react-native'
import { apiMessage } from '@/lib/api'
import { fetchClassSessions, type ClassSession } from '@/lib/studentClassesApi'
import { space, useTheme } from '@/lib/theme'
import {
  AppHeader, Caption, Card, EmptyState, ErrorState, Icon, Pill, Screen, Skeleton, ThemedText,
} from '@/components/ui'

export default function ClassScheduleScreen() {
  const params = useLocalSearchParams<{ classId: string; className?: string }>()
  const classId = Number(params.classId)
  const className = params.className ?? 'Lịch học'

  const q = useQuery({
    queryKey: ['class-sessions', classId],
    queryFn: () => fetchClassSessions(classId),
    enabled: Number.isFinite(classId),
    staleTime: 60_000,
  })

  const { upcoming, past } = useMemo(() => {
    const now = Date.now()
    const list = q.data ?? []
    const up = list.filter((s) => new Date(s.startAt).getTime() >= now)
    const pa = list.filter((s) => new Date(s.startAt).getTime() < now).reverse() // most recent first
    return { upcoming: up, past: pa }
  }, [q.data])

  return (
    <Screen edges={['top']}>
      <AppHeader
        title={className}
        subtitle="Lịch buổi học"
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/(student)'))}
      />

      {q.isLoading ? (
        <View style={{ paddingHorizontal: space[5], gap: space[3], paddingTop: space[2] }}>
          <Skeleton height={84} radius="md" />
          <Skeleton height={84} radius="md" />
        </View>
      ) : q.isError ? (
        <ErrorState message={apiMessage(q.error)} onRetry={() => void q.refetch()} />
      ) : (q.data?.length ?? 0) === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState
            icon={CalendarClock}
            title="Chưa có lịch học"
            message="Lớp chưa có buổi học nào được xếp lịch."
          />
        </View>
      ) : (
        <Screen
          scroll
          edges={[]}
          contentStyle={{ paddingHorizontal: space[5], paddingBottom: space[10], gap: space[4], paddingTop: space[2] }}
          refreshing={q.isRefetching}
          onRefresh={() => void q.refetch()}
        >
          {upcoming.length > 0 ? (
            <View style={{ gap: space[2] }}>
              <Caption>Sắp tới</Caption>
              {upcoming.map((s) => (
                <SessionRow key={s.id} session={s} />
              ))}
            </View>
          ) : null}
          {past.length > 0 ? (
            <View style={{ gap: space[2] }}>
              <Caption>Đã qua</Caption>
              {past.map((s) => (
                <SessionRow key={s.id} session={s} past />
              ))}
            </View>
          ) : null}
        </Screen>
      )}
    </Screen>
  )
}

function SessionRow({ session, past }: { session: ClassSession; past?: boolean }) {
  const start = new Date(session.startAt)
  const valid = !Number.isNaN(start.getTime())
  const end = valid ? new Date(start.getTime() + session.durationMinutes * 60_000) : null
  const st = sessionStatus(session.status)
  const cancelled = session.status === 'CANCELLED'
  const online = session.mode === 'ONLINE'
  return (
    <Card style={{ opacity: past || cancelled ? 0.65 : 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
        <View style={{ alignItems: 'center', minWidth: 46 }}>
          <ThemedText variant="caption" color="muted">
            {valid ? start.toLocaleDateString('vi-VN', { weekday: 'short' }) : ''}
          </ThemedText>
          <ThemedText variant="titleLg">{valid ? String(start.getDate()) : '—'}</ThemedText>
          <ThemedText variant="caption" color="faint">{valid ? `Th${start.getMonth() + 1}` : ''}</ThemedText>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
            <Icon icon={Clock} size={13} color="muted" />
            <ThemedText
              variant="bodyStrong"
              style={cancelled ? { textDecorationLine: 'line-through' } : undefined}
            >
              {valid && end ? `${clock(start)}–${clock(end)}` : `${session.durationMinutes} phút`}
            </ThemedText>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
            <Icon icon={online ? Video : MapPin} size={13} color="faint" />
            <ThemedText variant="caption" color="muted">
              {online ? 'Học online' : session.room ? `Phòng ${session.room}` : 'Chưa có phòng'}
            </ThemedText>
          </View>
        </View>
        <Pill tone={st.tone} label={st.label} />
      </View>
    </Card>
  )
}

function sessionStatus(status: ClassSession['status']): { label: string; tone: 'success' | 'danger' | 'accent' } {
  switch (status) {
    case 'CANCELLED':
      return { label: 'Đã huỷ', tone: 'danger' }
    case 'MOVED':
      return { label: 'Dời lịch', tone: 'accent' }
    default:
      return { label: 'Đã xếp', tone: 'success' }
  }
}

function clock(d: Date): string {
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}
