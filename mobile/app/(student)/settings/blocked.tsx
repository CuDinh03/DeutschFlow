import { Pressable, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { ShieldCheck, ShieldOff } from 'lucide-react-native'
import { apiMessage } from '@/lib/api'
import { moderationApi } from '@/lib/moderationApi'
import { radius, space, useTheme } from '@/lib/theme'
import {
  AppHeader, Caption, Card, EmptyState, ErrorState, Icon, Screen, Skeleton, ThemedText,
} from '@/components/ui'

/**
 * Safety & blocked users (Apple Guideline 1.2). Always reachable from Profile → this screen, so a
 * reviewer can see the block-management surface even without an active conversation. Explains the
 * report/block tools and lists (and unblocks) blocked users.
 */
export default function BlockedUsersScreen() {
  const c = useTheme().colors
  const qc = useQueryClient()

  const q = useQuery({
    queryKey: ['blocked-users'],
    queryFn: () => moderationApi.blocks(),
    staleTime: 10_000,
  })

  const unblockMut = useMutation({
    mutationFn: (userId: number) => moderationApi.unblock(userId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['blocked-users'] }),
  })

  const blocked = q.data ?? []

  return (
    <Screen edges={['top']}>
      <AppHeader title="An toàn & chặn" subtitle="Báo cáo và chặn người dùng" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: space[5], gap: space[4], paddingTop: space[2] }}>
        <Card style={{ gap: space[2] }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
            <Icon icon={ShieldCheck} size={18} color="accent" />
            <ThemedText variant="title">Giữ cộng đồng an toàn</ThemedText>
          </View>
          <ThemedText variant="body" style={{ color: c.textSecondary }}>
            Trong bất kỳ cuộc trò chuyện hay kênh lớp nào, bạn có thể báo cáo tin nhắn hoặc người dùng
            vi phạm (nhấn giữ tin nhắn) và chặn người dùng (menu ⋮ ở đầu cuộc trò chuyện). Chúng tôi
            tự động lọc ngôn từ phản cảm, và mọi báo cáo đều được xem xét. Người bị chặn không thể
            nhắn tin cho bạn và nội dung của họ sẽ bị ẩn.
          </ThemedText>
        </Card>

        <View style={{ gap: space[2] }}>
          <Caption color={c.textFaint}>NGƯỜI ĐÃ CHẶN</Caption>
          {q.isLoading ? (
            <Skeleton height={56} radius="md" />
          ) : q.isError ? (
            <ErrorState message={apiMessage(q.error)} onRetry={() => void q.refetch()} />
          ) : blocked.length === 0 ? (
            <EmptyState
              icon={ShieldOff}
              title="Chưa chặn ai"
              message="Danh sách người bạn đã chặn sẽ hiển thị ở đây."
            />
          ) : (
            <Card style={{ padding: 0 }}>
              {blocked.map((u, i) => (
                <View
                  key={u.userId}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingHorizontal: space[4],
                    paddingVertical: space[3],
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: c.border,
                  }}
                >
                  <ThemedText variant="body" style={{ flex: 1 }} numberOfLines={1}>
                    {u.displayName}
                  </ThemedText>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Bỏ chặn ${u.displayName}`}
                    disabled={unblockMut.isPending}
                    onPress={() => unblockMut.mutate(u.userId)}
                    style={{
                      paddingHorizontal: space[3],
                      paddingVertical: space[2],
                      borderRadius: radius.sm,
                      borderWidth: 1,
                      borderColor: c.border,
                    }}
                  >
                    <ThemedText variant="label" style={{ color: c.accent }}>Bỏ chặn</ThemedText>
                  </Pressable>
                </View>
              ))}
            </Card>
          )}
        </View>
      </View>
    </Screen>
  )
}
