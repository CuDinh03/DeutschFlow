import { View, FlatList, Pressable } from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { Bell, CheckCheck } from 'lucide-react-native'
import { formatDistanceToNow } from 'date-fns'
import { vi } from 'date-fns/locale'
import api from '@/lib/api'
import { radius, space, useTheme } from '@/lib/theme'
import { Screen, Card, ThemedText, Icon, AppHeader, EmptyState, Skeleton } from '@/components/ui'

interface Notification {
  id: number
  title: string
  body: string
  type: string
  isRead: boolean
  createdAt: string
}

// Backend: GET /api/notifications -> NotificationPageResponse { items: [...] }.
// Each item carries title/body inside a freeform `payload` map; status is `read`
// and timestamp is `createdAtUtc`.
interface RawNotificationItem {
  id: number
  type: string
  payload: Record<string, unknown> | null
  read: boolean
  createdAtUtc: string
}
interface NotificationPage {
  items: RawNotificationItem[]
}

function notificationTypeLabel(type: string): string {
  switch (type) {
    case 'ACHIEVEMENT_UNLOCKED':
      return 'Thành tích mới'
    case 'LEVEL_UP':
      return 'Lên cấp'
    case 'NEW_ASSIGNMENT':
    case 'NEW_CLASS_ASSIGNMENT':
      return 'Bài tập mới'
    case 'ASSIGNMENT_GRADED':
      return 'Bài đã chấm'
    default:
      return 'Thông báo'
  }
}

function mapNotification(item: RawNotificationItem): Notification {
  const p = item.payload ?? {}
  const title = typeof p.title === 'string' && p.title ? p.title : notificationTypeLabel(item.type)
  const body =
    typeof p.body === 'string' && p.body
      ? p.body
      : typeof p.message === 'string' && p.message
        ? p.message
        : ''
  return { id: item.id, title, body, type: item.type, isRead: item.read, createdAt: item.createdAtUtc }
}

export default function NotificationsScreen() {
  const theme = useTheme()
  const qc = useQueryClient()

  const { data: notifs = [], isLoading } = useQuery({
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
    },
  })

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
          <Skeleton height={72} radius="lg" />
          <Skeleton height={72} radius="lg" />
          <Skeleton height={72} radius="lg" />
        </View>
      ) : (
        <FlatList
          data={notifs}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingHorizontal: space[5], paddingBottom: space[6], gap: space[2] }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState icon={Bell} title="Chưa có thông báo" message="Thông báo mới sẽ xuất hiện ở đây." />
          }
          renderItem={({ item }) => (
            <Card
              bordered
              style={{ borderColor: item.isRead ? theme.colors.border : theme.colors.accent + '4D' }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[2] }}>
                {!item.isRead ? (
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: radius.full,
                      backgroundColor: theme.colors.accent,
                      marginTop: 6,
                    }}
                  />
                ) : null}
                <View style={{ flex: 1, gap: 2 }}>
                  <ThemedText variant="bodyStrong">{item.title}</ThemedText>
                  <ThemedText variant="caption" color="secondary">
                    {item.body}
                  </ThemedText>
                  <ThemedText variant="caption" color="faint" style={{ marginTop: 2 }}>
                    {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, locale: vi })}
                  </ThemedText>
                </View>
              </View>
            </Card>
          )}
        />
      )}
    </Screen>
  )
}
