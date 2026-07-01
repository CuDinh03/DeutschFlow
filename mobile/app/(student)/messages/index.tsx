import { useCallback } from 'react'
import { View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { router, useFocusEffect } from 'expo-router'
import { MessageCircle } from 'lucide-react-native'
import { apiMessage } from '@/lib/api'
import { messagesApi, type Conversation } from '@/lib/messagesApi'
import { radius, space, useTheme } from '@/lib/theme'
import {
  AppHeader, Caption, Card, EmptyState, ErrorState, Screen, Skeleton, ThemedText,
} from '@/components/ui'

export default function MessagesListScreen() {
  const q = useQuery({
    queryKey: ['conversations'],
    queryFn: () => messagesApi.conversations(),
    staleTime: 15_000,
  })
  const refetch = q.refetch
  // Re-fetch each time the list regains focus (e.g. after reading a thread) so unread clears.
  useFocusEffect(useCallback(() => { void refetch() }, [refetch]))

  return (
    <Screen edges={['top']}>
      <AppHeader title="Tin nhắn" onBack={() => router.back()} />

      {q.isLoading ? (
        <View style={{ paddingHorizontal: space[5], gap: space[3], paddingTop: space[2] }}>
          <Skeleton height={72} radius="md" />
          <Skeleton height={72} radius="md" />
          <Skeleton height={72} radius="md" />
        </View>
      ) : q.isError ? (
        <ErrorState message={apiMessage(q.error)} onRetry={() => void refetch()} />
      ) : (q.data?.length ?? 0) === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState
            icon={MessageCircle}
            title="Chưa có tin nhắn"
            message="Mở trang lớp học → tab Giáo viên → Nhắn tin để bắt đầu trò chuyện."
          />
        </View>
      ) : (
        <Screen
          scroll
          edges={[]}
          contentStyle={{ paddingHorizontal: space[5], paddingBottom: space[10], gap: space[2], paddingTop: space[2] }}
          refreshing={q.isRefetching}
          onRefresh={() => void refetch()}
        >
          {q.data!.map((conv) => (
            <ConversationRow key={conv.userId} conv={conv} />
          ))}
        </Screen>
      )}
    </Screen>
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
