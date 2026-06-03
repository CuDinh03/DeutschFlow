import { View, FlatList, Pressable, RefreshControl } from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { Bell, CheckCheck } from 'lucide-react-native'
import { formatDistanceToNow } from 'date-fns'
import { vi } from 'date-fns/locale'
import api from '@/lib/api'
import { radius, space, useTheme } from '@/lib/theme'
import { Screen, Card, ThemedText, Icon, AppHeader, EmptyState, ErrorState, Skeleton } from '@/components/ui'
import { mapNotification, type NotificationPage } from '@/lib/notificationsApi'

export default function NotificationsScreen() {
  const theme = useTheme()
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
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : (
        <FlatList
          data={notifs}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingHorizontal: space[5], paddingBottom: space[6], gap: space[2] }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isLoading}
              onRefresh={() => void refetch()}
              tintColor={theme.colors.accent}
              colors={[theme.colors.accent]}
            />
          }
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
