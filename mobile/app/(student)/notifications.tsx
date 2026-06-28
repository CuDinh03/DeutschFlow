import { View, FlatList, Pressable, RefreshControl, Alert } from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { Bell, CheckCheck } from 'lucide-react-native'
import { formatDistanceToNow, isToday, isYesterday } from 'date-fns'
import { vi } from 'date-fns/locale'
import api, { apiMessage } from '@/lib/api'
import { space, useTheme } from '@/lib/theme'
import {
  Screen,
  Card,
  ThemedText,
  Icon,
  Caption,
  YellowSquare,
  AppHeader,
  EmptyState,
  ErrorState,
  Skeleton,
} from '@/components/ui'
import { mapNotification, notificationTypeLabel, type Notification, type NotificationPage } from '@/lib/notificationsApi'

// Presentation-only: editorial date buckets (HÔM NAY / HÔM QUA / TRƯỚC ĐÓ)
// derived from the already-fetched list. No extra fetch.
type ListEntry =
  | { kind: 'header'; key: string; label: string }
  | { kind: 'item'; key: string; notif: Notification }

function dateBucket(iso: string): string {
  const d = new Date(iso)
  if (isToday(d)) return 'Hôm nay'
  if (isYesterday(d)) return 'Hôm qua'
  return 'Trước đó'
}

function buildEntries(notifs: Notification[]): ListEntry[] {
  const entries: ListEntry[] = []
  let lastBucket: string | null = null
  for (const notif of notifs) {
    const bucket = dateBucket(notif.createdAt)
    if (bucket !== lastBucket) {
      entries.push({ kind: 'header', key: `h-${bucket}`, label: bucket })
      lastBucket = bucket
    }
    entries.push({ kind: 'item', key: `n-${notif.id}`, notif })
  }
  return entries
}

export default function NotificationsScreen() {
  const theme = useTheme()
  const c = theme.colors
  const qc = useQueryClient()

  const { data: notifs = [], isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['notifications'],
    queryFn: () =>
      api
        .get<NotificationPage>('/notifications', { params: { page: 0, size: 20 } })
        .then((r) => r.data.items.map(mapNotification)),
    staleTime: 30_000,
  })

  const markAllRead = useMutation({
    mutationFn: () => api.post('/notifications/read-all'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      qc.invalidateQueries({ queryKey: ['unread-count'] })
    },
    onError: (e) => Alert.alert('Lỗi', apiMessage(e)),
  })

  const markOneRead = useMutation({
    mutationFn: (id: number) => api.post(`/notifications/${id}/read`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      qc.invalidateQueries({ queryKey: ['unread-count'] })
    },
    onError: (e) => Alert.alert('Lỗi', apiMessage(e)),
  })

  const unreadCount = notifs.filter((n) => !n.isRead).length
  const entries = buildEntries(notifs)

  return (
    <Screen edges={['top']}>
      <AppHeader
        title="Thông báo"
        onBack={() => router.back()}
        right={
          <Pressable onPress={() => markAllRead.mutate()} hitSlop={8} disabled={notifs.length === 0}>
            <Icon icon={CheckCheck} size={22} color={notifs.length === 0 ? 'faint' : 'secondary'} />
          </Pressable>
        }
      />
      {isLoading ? (
        <View style={{ paddingHorizontal: space[5], gap: space[2] }}>
          <Skeleton height={76} radius="md" />
          <Skeleton height={76} radius="md" />
          <Skeleton height={76} radius="md" />
        </View>
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(entry) => entry.key}
          contentContainerStyle={{ paddingHorizontal: space[5], paddingBottom: space[6] }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isLoading}
              onRefresh={() => void refetch()}
              tintColor={c.accent}
              colors={[c.accent]}
            />
          }
          ListHeaderComponent={
            notifs.length > 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], paddingVertical: space[3] }}>
                <YellowSquare size={9} />
                <Caption>
                  {unreadCount > 0 ? `${unreadCount} thông báo chưa đọc` : 'Tất cả đã đọc'}
                </Caption>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState icon={Bell} title="Chưa có thông báo" message="Thông báo mới sẽ xuất hiện ở đây." />
          }
          renderItem={({ item: entry }) => {
            if (entry.kind === 'header') {
              return (
                <Caption color={c.textMuted} style={{ marginTop: space[4], marginBottom: space[2] }}>
                  {entry.label}
                </Caption>
              )
            }
            const item = entry.notif
            return (
              <Card
                bordered
                onPress={item.isRead ? undefined : () => markOneRead.mutate(item.id)}
                style={{
                  marginBottom: space[2],
                  borderColor: item.isRead ? c.border : c.accentSoft,
                  backgroundColor: item.isRead ? c.surface : c.accentSoft,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[3] }}>
                  {!item.isRead ? (
                    <YellowSquare size={9} style={{ marginTop: 5 }} />
                  ) : (
                    <View style={{ width: 9 }} />
                  )}
                  <View style={{ flex: 1, gap: 3 }}>
                    <Caption color={item.isRead ? c.textFaint : c.accentText}>
                      {notificationTypeLabel(item.type)}
                    </Caption>
                    <ThemedText variant="bodyStrong">{item.title}</ThemedText>
                    {item.body ? (
                      <ThemedText variant="caption" color="secondary">
                        {item.body}
                      </ThemedText>
                    ) : null}
                    <ThemedText variant="caption" color="faint" style={{ marginTop: 2 }}>
                      {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, locale: vi })}
                    </ThemedText>
                  </View>
                </View>
              </Card>
            )
          }}
        />
      )}
    </Screen>
  )
}
