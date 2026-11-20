import { Pressable, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { apiMessage } from '@/lib/api'
import { moderationApi } from '@/lib/moderationApi'
import { avatarInitial } from '@/lib/avatarInitial'
import { fonts, radius, space, useTheme } from '@/lib/theme'
import { EmptyState, ErrorState, Screen, Skeleton, ThemedText, GaGlyph } from '@/components/ui'
import { Eyebrow, MeCard, PageTitle, Row, RowList, SubHeader } from '@/components/me/MeParts'
import { useBackTo } from '@/hooks/useBackTo'
import { PARENT_OF } from '@/lib/screenParents'

/**
 * Safety & blocked users (Apple Guideline 1.2). Always reachable from Profile → this screen, so a
 * reviewer can see the block-management surface even without an active conversation. Explains the
 * report/block tools and lists (and unblocks) blocked users.
 *
 * Giao diện v3.4 (Đợt 6C, 19/11/2026; mẫu `blocked`): thẻ giải thích nền chìm, danh sách người đã chặn
 * có chữ cái đầu và chip "Bỏ chặn".
 */
export default function BlockedUsersScreen() {
  // Back tường minh về màn cha — Tabs firstRoute sẽ về Heute (xem lib/screenParents).
  const goBack = useBackTo(PARENT_OF['settings/blocked'])
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
    <Screen scroll edges={['top']} contentStyle={{ paddingHorizontal: space[5], paddingTop: space[2], paddingBottom: space[10] }}>
      <SubHeader onBack={goBack} />
      <PageTitle title="An toàn và chặn" style={{ marginTop: space[4] }} />

      <MeCard tone="sunken" style={{ marginTop: space[3] + 2, flexDirection: 'row', gap: space[3] }}>
        <GaGlyph name="antoan" size={24} ink="primary" />
        <View style={{ flex: 1, gap: space[1] }}>
          <ThemedText variant="bodyStrong">Giữ cộng đồng an toàn</ThemedText>
          <ThemedText variant="body" color="secondary">
            Trong bất kỳ cuộc trò chuyện hay kênh lớp nào, bạn có thể báo cáo tin nhắn hoặc người dùng
            vi phạm (nhấn giữ tin nhắn) và chặn người dùng (menu ⋮ ở đầu cuộc trò chuyện). Chúng tôi
            tự động lọc ngôn từ phản cảm, và mọi báo cáo đều được xem xét. Người bị chặn không thể
            nhắn tin cho bạn và nội dung của họ sẽ bị ẩn.
          </ThemedText>
        </View>
      </MeCard>

      <Eyebrow style={{ marginTop: space[5], marginBottom: space[2] }}>Người đã chặn</Eyebrow>
      {q.isLoading ? (
        <Skeleton height={56} radius="lg" />
      ) : q.isError ? (
        <ErrorState message={apiMessage(q.error)} onRetry={() => void q.refetch()} />
      ) : blocked.length === 0 ? (
        <EmptyState
          glyph="canhbao"
          title="Chưa chặn ai"
          message="Danh sách người bạn đã chặn sẽ hiển thị ở đây."
        />
      ) : (
        <RowList>
          {blocked.map((u) => (
            <Row
              key={u.userId}
              title={u.displayName}
              subtitle={blockedOnLabel(u.blockedAt)}
              leading={
                <View
                  style={{ width: 40, height: 40, borderRadius: radius.full, backgroundColor: c.surfaceSunken, alignItems: 'center', justifyContent: 'center' }}
                >
                  <ThemedText variant="title" style={{ fontFamily: fonts.displayBold }}>
                    {avatarInitial(u.displayName)}
                  </ThemedText>
                </View>
              }
              trailing={
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Bỏ chặn ${u.displayName}`}
                  accessibilityState={{ disabled: unblockMut.isPending }}
                  disabled={unblockMut.isPending}
                  onPress={() => unblockMut.mutate(u.userId)}
                  hitSlop={4}
                  style={({ pressed }) => ({
                    height: 36,
                    paddingHorizontal: space[3] + 2,
                    borderRadius: radius.full,
                    borderWidth: 1,
                    borderColor: c.border,
                    backgroundColor: c.surfaceSunken,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: pressed || unblockMut.isPending ? 0.6 : 1,
                  })}
                >
                  <ThemedText variant="label">Bỏ chặn</ThemedText>
                </Pressable>
              }
            />
          ))}
        </RowList>
      )}
    </Screen>
  )
}

/** "Chặn ngày 02/11/2026"; ngày hỏng thì bỏ dòng phụ. */
function blockedOnLabel(iso: string | null | undefined): string | undefined {
  if (!iso) return undefined
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? undefined : `Chặn ngày ${format(d, 'dd/MM/yyyy')}`
}
