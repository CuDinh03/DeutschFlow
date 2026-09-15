import { View, FlatList, Pressable, RefreshControl, Alert } from 'react-native'
import type { GlyphName } from '@/lib/galerieGlyphs'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usePullRefresh } from '@/hooks/usePullRefresh'
import { router } from 'expo-router'
import { CheckCheck } from 'lucide-react-native'
import { formatDistanceToNow, isToday, isYesterday } from 'date-fns'
import { vi } from 'date-fns/locale'
import api, { apiMessage } from '@/lib/api'
import { radius, space, useTheme } from '@/lib/theme'
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
  Skeleton, GaGlyph } from '@/components/ui'
import {
  mapNotification,
  notificationIconKey,
  notificationTypeLabel,
  stripLeadingEmoji,
  type Notification,
  type NotificationIconKey,
  type NotificationPage,
} from '@/lib/notificationsApi'
import { resolveNotificationRoute } from '@/lib/notificationRoute'
import { useBackToMainTab } from '@/hooks/useBackTo'

// Themed icon per notification type — replaces the emoji the backend bakes into titles (stripped
// via stripLeadingEmoji). The type→key decision is a PURE function in lib/notificationsApi so it can
// be unit-tested against the full list of student-facing types; here we only bind key → component.
//
// QA 13/08: trước đây bảng này chỉ liệt kê 8 loại, nên "được duyệt vào lớp", "thêm vào lớp",
// "thông báo từ giáo viên"… vừa bị cắt emoji vừa chỉ còn chuông chung — ít thông tin hơn cả
// trước khi cắt emoji. Nay mọi loại học viên nhận được đều có icon riêng.
const ICON_BY_KEY: Record<NotificationIconKey, GlyphName> = {
  trophy: 'thithu',
  levelUp: 'thongke',
  review: 'srs',
  streak: 'chuoi',
  assignment: 'baigiao',
  graded: 'hoanthanh',
  classJoinOk: 'hoanthanh',
  classJoinNo: 'canhbao',
  classAdded: 't_exam',
  announcement: 'thongbao',
  message: 'hoithoai',
  calendarAdd: 'lich',
  calendarCancel: 'lich',
  calendarMove: 'lich',
  plan: 'thinoi',
  maintenance: 'sualoi',
  bell: 'thongbao',
}

function notificationTypeIcon(type: string): GlyphName {
  return ICON_BY_KEY[notificationIconKey(type)]
}

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
  // Back tường minh về màn cha — Tabs firstRoute sẽ về Heute (xem lib/screenParents).
  const goBack = useBackToMainTab()
  const theme = useTheme()
  const c = theme.colors
  const qc = useQueryClient()

  const { data: notifs = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['notifications'],
    queryFn: () =>
      api
        .get<NotificationPage>('/notifications', { params: { page: 0, size: 20 } })
        .then((r) => r.data.items.map(mapNotification)),
    staleTime: 30_000,
  })
  const pull = usePullRefresh(refetch)

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

  // Tapping a row marks it read (if unread) and deep-links to where it belongs
  // (the assignment, the class, the chat thread, …). No destination → just marks read.
  const openNotification = (item: Notification) => {
    if (!item.isRead) markOneRead.mutate(item.id)
    const route = resolveNotificationRoute(item.type, item.payload)
    if (route) router.push(route)
  }

  const unreadCount = notifs.filter((n) => !n.isRead).length
  const entries = buildEntries(notifs)

  return (
    <Screen edges={['top']}>
      <AppHeader
        title="Thông báo"
        onBack={goBack}
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Đánh dấu tất cả đã đọc"
            accessibilityState={{ disabled: notifs.length === 0 }}
            onPress={() => markAllRead.mutate()}
            hitSlop={8}
            disabled={notifs.length === 0}
          >
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
              refreshing={pull.refreshing}
              onRefresh={() => void pull.onRefresh()}
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
            <EmptyState glyph="thongbao" title="Chưa có thông báo" message="Thông báo mới sẽ xuất hiện ở đây." />
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
                onPress={() => openNotification(item)}
                style={{
                  marginBottom: space[2],
                  borderColor: item.isRead ? c.border : c.accentSoft,
                  backgroundColor: item.isRead ? c.surface : c.accentSoft,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[3] }}>
                  {/* Type icon tile — surface-on-yellow when unread (card bg is
                      accentSoft), soft-yellow-on-white when read. */}
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: radius.md,
                      backgroundColor: item.isRead ? c.accentSoft : c.surface,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <GaGlyph name={notificationTypeIcon(item.type)} size={20} />
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
                      {!item.isRead ? <YellowSquare size={8} /> : null}
                      <Caption color={item.isRead ? c.textFaint : c.accentText}>
                        {notificationTypeLabel(item.type)}
                      </Caption>
                    </View>
                    <ThemedText variant="bodyStrong">{stripLeadingEmoji(item.title)}</ThemedText>
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
