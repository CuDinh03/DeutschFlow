import { useMemo } from 'react'
import { View, FlatList, Pressable, RefreshControl, Alert } from 'react-native'
import type { GlyphName } from '@/lib/galerieGlyphs'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usePullRefresh } from '@/hooks/usePullRefresh'
import { router } from 'expo-router'
import { formatDistanceToNow } from 'date-fns'
import { vi } from 'date-fns/locale'
import api, { apiMessage } from '@/lib/api'
import { radius, space, useTheme } from '@/lib/theme'
import {
  Screen,
  ThemedText,
  EmptyState,
  ErrorState,
  Skeleton, GaGlyph } from '@/components/ui'
import { Chip, MarkTitle, TopBar } from '@/components/classroom/ClassroomParts'
import { groupByDay } from '@/lib/classroomUi'
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
  profile: 'hoso',
  // Phiếu đánh giá gửi gia đình: bộ glyph chưa có hình "phiếu" riêng, dùng `thongke` vì phiếu
  // chính là bảng điểm bốn kỹ năng + chuyên cần. Thêm glyph mới phải theo mobile/GALERIE_GLYPHS.md.
  report: 'thongke',
  bell: 'thongbao',
}

function notificationTypeIcon(type: string): GlyphName {
  return ICON_BY_KEY[notificationIconKey(type)]
}

// Presentation-only: nhóm ngày (Hôm nay / Hôm qua / Trước đó) tính từ danh sách đã tải, không gọi
// thêm API. Hàm thuần `groupByDay` ở lib/classroomUi (có test), đánh dấu dòng đầu/cuối mỗi nhóm để
// vẽ mỗi nhóm thành một khối danh sách liền như mẫu v3.4 `notifs`.

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
  // Khoá theo ngày: màn không unmount, qua nửa đêm thì nhóm Hôm nay/Hôm qua phải tính lại.
  const dayKey = new Date().toDateString()
  const entries = useMemo(() => groupByDay(notifs, (n) => `n-${n.id}`, new Date(dayKey)), [notifs, dayKey])

  return (
    <Screen edges={['top']}>
      {/* Giao diện v3.4 (Đợt 6B, mẫu `notifs`): chip "Đánh dấu tất cả đã đọc" ở thanh đầu, tiêu đề
          có vệt vàng, mỗi nhóm ngày một khối danh sách; dòng chưa đọc nền vàng nhạt + chấm đỏ. */}
      <TopBar
        onBack={goBack}
        right={
          <Chip
            label="Đánh dấu tất cả đã đọc"
            disabled={notifs.length === 0}
            onPress={() => markAllRead.mutate()}
          />
        }
      />
      {isLoading ? (
        <View style={{ paddingHorizontal: space[5], gap: space[2], paddingTop: space[4] }}>
          <Skeleton height={64} radius="lg" />
          <Skeleton height={64} radius="lg" />
          <Skeleton height={64} radius="lg" />
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
            <View style={{ paddingTop: space[4], gap: space[1] }}>
              <MarkTitle plain="Thông" mark="báo" />
              {notifs.length > 0 ? (
                <ThemedText variant="caption" color="muted" style={{ fontSize: 13 }}>
                  {unreadCount > 0 ? `${unreadCount} thông báo chưa đọc` : 'Tất cả đã đọc'}
                </ThemedText>
              ) : null}
            </View>
          }
          ListEmptyComponent={
            <EmptyState glyph="thongbao" title="Chưa có thông báo" message="Thông báo mới sẽ xuất hiện ở đây." />
          }
          renderItem={({ item: entry }) => {
            if (entry.kind === 'header') {
              return (
                <ThemedText variant="title" accessibilityRole="header" style={{ marginTop: space[6], marginBottom: space[3] }}>
                  {entry.label}
                </ThemedText>
              )
            }
            const item = entry.item
            const title = stripLeadingEmoji(item.title)
            const when = formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, locale: vi })
            const corner = radius.lg
            return (
              <Pressable
                onPress={() => openNotification(item)}
                accessibilityRole="button"
                accessibilityLabel={`${notificationTypeLabel(item.type)}: ${title}${item.body ? `. ${item.body}` : ''}. ${when}${item.isRead ? '' : '. Chưa đọc'}`}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space[3] + 2,
                  minHeight: 56,
                  paddingHorizontal: space[4],
                  paddingVertical: space[2] + 2,
                  backgroundColor: pressed ? c.surfaceSunken : item.isRead ? c.surface : c.accentSoft,
                  borderColor: c.border,
                  borderLeftWidth: 1,
                  borderRightWidth: 1,
                  borderTopWidth: 1,
                  borderBottomWidth: entry.last ? 1 : 0,
                  borderTopLeftRadius: entry.first ? corner : 0,
                  borderTopRightRadius: entry.first ? corner : 0,
                  borderBottomLeftRadius: entry.last ? corner : 0,
                  borderBottomRightRadius: entry.last ? corner : 0,
                })}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: radius.sm,
                    backgroundColor: item.isRead ? c.surfaceSunken : c.surface,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <GaGlyph name={notificationTypeIcon(item.type)} size={20} />
                </View>
                <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                  <ThemedText variant="bodyStrong">{title}</ThemedText>
                  <ThemedText variant="caption" color="muted">
                    {item.body ? `${item.body} · ${when}` : when}
                  </ThemedText>
                </View>
                {!item.isRead ? (
                  <View style={{ width: 8, height: 8, borderRadius: radius.full, backgroundColor: c.danger }} />
                ) : null}
              </Pressable>
            )
          }}
        />
      )}
    </Screen>
  )
}
