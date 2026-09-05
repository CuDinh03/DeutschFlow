import { useCallback, useState } from 'react'
import { View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { usePullRefresh } from '@/hooks/usePullRefresh'
import { router, useFocusEffect } from 'expo-router'
import { ChevronRight, MessageCircle, Users } from 'lucide-react-native'
import { apiMessage } from '@/lib/api'
import { messagesApi, type Conversation } from '@/lib/messagesApi'
import { fetchMyClasses, type MyClassroom } from '@/lib/studentClassesApi'
import { radius, space, useTheme } from '@/lib/theme'
import {
  AppHeader, Caption, Card, EmptyState, ErrorState, Icon, Pill, Screen, SelectableChip, Skeleton, ThemedText,
} from '@/components/ui'

// Unified inbox (QA build 15): personal 1:1 threads and class group channels
// live under ONE "Tin nhắn" entry, split by tab — mirrors the web unified
// inbox (#286). The class tab reuses the student's class list; each row opens
// the existing class-chat screen.
type InboxTab = 'personal' | 'class'

export default function MessagesHubScreen() {
  const [tab, setTab] = useState<InboxTab>('personal')

  const conv = useQuery({
    queryKey: ['conversations'],
    queryFn: () => messagesApi.conversations(),
    staleTime: 15_000,
  })
  const classes = useQuery({
    queryKey: ['my-classes'],
    queryFn: fetchMyClasses,
    staleTime: 60_000,
  })

  const refetchConv = conv.refetch
  // Re-fetch each time the list regains focus (e.g. after reading a thread) so unread clears.
  useFocusEffect(useCallback(() => { void refetchConv() }, [refetchConv]))
  const pullConv = usePullRefresh(conv.refetch)
  const pullClasses = usePullRefresh(classes.refetch)

  const totalUnread = (conv.data ?? []).reduce((sum, c) => sum + c.unread, 0)

  return (
    <Screen edges={['top']}>
      <AppHeader title="Tin nhắn" subtitle="Cá nhân · Nhóm lớp" onBack={() => router.back()} />

      <View style={{ flexDirection: 'row', gap: space[2], paddingHorizontal: space[5], marginBottom: space[3] }}>
        <SelectableChip label="Tin nhắn cá nhân" selected={tab === 'personal'} onPress={() => setTab('personal')}>
          <Pill
            label={totalUnread > 0 ? `Cá nhân · ${totalUnread}` : 'Cá nhân'}
            tone={tab === 'personal' ? 'accent' : 'neutral'}
            solid={tab === 'personal'}
          />
        </SelectableChip>
        <SelectableChip label="Tin nhắn nhóm lớp" selected={tab === 'class'} onPress={() => setTab('class')}>
          <Pill label="Nhóm lớp" tone={tab === 'class' ? 'accent' : 'neutral'} solid={tab === 'class'} />
        </SelectableChip>
      </View>

      {tab === 'personal' ? renderPersonalTab() : renderClassTab()}
    </Screen>
  )

  // Plain render helpers (no hooks) — NOT nested components, which would
  // remount their subtree on every parent re-render.
  function renderPersonalTab() {
    if (conv.isLoading) return <RowSkeletons />
    if (conv.isError) return <ErrorState message={apiMessage(conv.error)} onRetry={() => void conv.refetch()} />
    if ((conv.data?.length ?? 0) === 0) {
      return (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState
            icon={MessageCircle}
            title="Chưa có tin nhắn"
            message="Mở trang lớp học → tab Giáo viên → Nhắn tin để bắt đầu trò chuyện."
            actionLabel="Xem lớp của tôi"
            onAction={() => router.push('/(student)/classes')}
          />
        </View>
      )
    }
    return (
      <Screen
        scroll
        edges={[]}
        contentStyle={{ paddingHorizontal: space[5], paddingBottom: space[10], gap: space[2], paddingTop: space[2] }}
        refreshing={pullConv.refreshing}
        onRefresh={() => void pullConv.onRefresh()}
      >
        {conv.data!.map((c) => (
          <ConversationRow key={c.userId} conv={c} />
        ))}
      </Screen>
    )
  }

  function renderClassTab() {
    if (classes.isLoading) return <RowSkeletons />
    if (classes.isError) return <ErrorState message={apiMessage(classes.error)} onRetry={() => void classes.refetch()} />
    if ((classes.data?.length ?? 0) === 0) {
      return (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState
            icon={Users}
            title="Chưa vào lớp nào"
            message="Vào một lớp học để trò chuyện cùng cả lớp trong kênh nhóm."
            actionLabel="Xem lớp của tôi"
            onAction={() => router.push('/(student)/classes')}
          />
        </View>
      )
    }
    return (
      <Screen
        scroll
        edges={[]}
        contentStyle={{ paddingHorizontal: space[5], paddingBottom: space[10], gap: space[2], paddingTop: space[2] }}
        refreshing={pullClasses.refreshing}
        onRefresh={() => void pullClasses.onRefresh()}
      >
        {classes.data!.map((k) => (
          <ClassChannelRow key={k.id} klass={k} />
        ))}
      </Screen>
    )
  }
}

function ClassChannelRow({ klass }: { klass: MyClassroom }) {
  const c = useTheme().colors
  const teacherNames = klass.teachers.map((t) => t.displayName).join(', ')
  return (
    <Card
      onPress={() =>
        router.push({
          pathname: '/(student)/class-chat/[classId]',
          params: { classId: String(klass.id), className: klass.name },
        })
      }
      accessibilityLabel={`Kênh chat lớp ${klass.name}`}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: radius.md,
            backgroundColor: c.accentSoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon icon={Users} size={20} color="accent" />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <ThemedText variant="bodyStrong" numberOfLines={1}>
            {klass.name}
          </ThemedText>
          <ThemedText variant="caption" color="muted" numberOfLines={1}>
            {teacherNames ? `GV: ${teacherNames}` : 'Kênh chat cả lớp'}
          </ThemedText>
        </View>
        <Icon icon={ChevronRight} size={18} color="muted" />
      </View>
    </Card>
  )
}

function RowSkeletons() {
  return (
    <View style={{ paddingHorizontal: space[5], gap: space[3], paddingTop: space[2] }}>
      <Skeleton height={72} radius="md" />
      <Skeleton height={72} radius="md" />
      <Skeleton height={72} radius="md" />
    </View>
  )
}

function ConversationRow({ conv }: { conv: Conversation }) {
  const c = useTheme().colors
  const hasUnread = conv.unread > 0
  return (
    <Card
      onPress={() =>
        router.push({
          pathname: '/(student)/messages/[userId]',
          params: { userId: String(conv.userId), name: conv.displayName },
        })
      }
      accessibilityLabel={`Trò chuyện với ${conv.displayName}${hasUnread ? `, ${conv.unread} tin chưa đọc` : ''}`}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
        <Avatar name={conv.displayName} />
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
            <ThemedText variant="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>
              {conv.displayName}
            </ThemedText>
            <Caption color={c.textFaint}>{timeAgo(conv.lastAt)}</Caption>
          </View>
          <ThemedText
            variant="caption"
            color={hasUnread ? 'primary' : 'muted'}
            numberOfLines={1}
            style={hasUnread ? { fontWeight: '600' } : undefined}
          >
            {conv.lastMessage ?? 'Bắt đầu trò chuyện'}
          </ThemedText>
        </View>
        {hasUnread ? (
          <View
            style={{
              minWidth: 20,
              height: 20,
              paddingHorizontal: 5,
              borderRadius: radius.full,
              backgroundColor: c.danger,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ThemedText variant="caption" style={{ color: c.onBrand, fontSize: 10 }}>
              {conv.unread > 9 ? '9+' : String(conv.unread)}
            </ThemedText>
          </View>
        ) : null}
      </View>
    </Card>
  )
}

function Avatar({ name }: { name: string }) {
  const c = useTheme().colors
  const initial = name.trim().charAt(0).toUpperCase() || '?'
  return (
    <View
      style={{
        width: 44,
        height: 44,
        borderRadius: radius.md,
        backgroundColor: c.accentSoft,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <ThemedText variant="title" color="accent">{initial}</ThemedText>
    </View>
  )
}

// Compact Vietnamese relative time for the conversation list.
function timeAgo(iso: string | null): string {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const min = Math.floor((Date.now() - then) / 60_000)
  if (min < 1) return 'vừa xong'
  if (min < 60) return `${min} phút`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} giờ`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day} ngày`
  return new Date(iso).toLocaleDateString('vi-VN')
}
