import { useCallback } from 'react'
import { Pressable, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { usePullRefresh } from '@/hooks/usePullRefresh'
import { router, useFocusEffect } from 'expo-router'
import { ChevronRight } from 'lucide-react-native'
import { apiMessage } from '@/lib/api'
import { messagesApi, type Conversation } from '@/lib/messagesApi'
import { fetchMyClasses, type MyClassroom } from '@/lib/studentClassesApi'
import { fonts, radius, space, useTheme } from '@/lib/theme'
import {
  Button, EmptyState, ErrorState, GaGlyph, Icon, Screen, Skeleton, ThemedText,
} from '@/components/ui'
import {
  InitialAvatar, ListBlock, MarkTitle, SectionTitle, TopBar, listRowStyle,
} from '@/components/classroom/ClassroomParts'
import { nameInitial } from '@/lib/classroomUi'
import { useBackToMainTab } from '@/hooks/useBackTo'

// Unified inbox (QA build 15): personal 1:1 threads and class group channels
// live under ONE "Tin nhắn" entry — mirrors the web unified inbox (#286). The class
// part reuses the student's class list; each row opens the existing class-chat screen.
//
// Giao diện v3.4 (Đợt 6B, mẫu `inbox`): tiêu đề "Tin nhắn" có vệt vàng, hai mục xếp chồng
// "Tin nhắn cá nhân" và "Tin nhắn nhóm lớp" (thay cho hai tab cũ), mỗi mục một khối danh sách.
// Hai truy vấn vẫn như cũ; kéo để làm mới thì làm mới cả hai.
export default function MessagesHubScreen() {
  // Back tường minh về màn cha — Tabs firstRoute sẽ về Heute (xem lib/screenParents).
  const goBack = useBackToMainTab()

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
  const pull = usePullRefresh(async () => {
    await Promise.all([conv.refetch(), classes.refetch()])
  })

  const totalUnread = (conv.data ?? []).reduce((sum, c) => sum + c.unread, 0)
  const noConversations = !conv.isLoading && !conv.isError && (conv.data?.length ?? 0) === 0
  const noClasses = !classes.isLoading && !classes.isError && (classes.data?.length ?? 0) === 0

  return (
    <Screen edges={['top']}>
      <TopBar onBack={goBack} />
      <Screen
        scroll
        edges={[]}
        contentStyle={{ paddingHorizontal: space[5], paddingBottom: space[10], paddingTop: space[4] }}
        refreshing={pull.refreshing}
        onRefresh={() => void pull.onRefresh()}
      >
        <MarkTitle plain="Tin" mark="nhắn" />
        <ThemedText variant="caption" color="muted" style={{ fontSize: 13, marginTop: space[1] }}>
          {totalUnread > 0 ? `Cá nhân · Nhóm lớp · ${totalUnread} tin chưa đọc` : 'Cá nhân · Nhóm lớp'}
        </ThemedText>

        {noConversations && noClasses ? (
          <View style={{ paddingTop: space[8] }}>
            <EmptyState
              glyph="hoithoai"
              title="Chưa có tin nhắn"
              message="Mở trang lớp học → tab Giáo viên → Nhắn tin để bắt đầu trò chuyện."
              actionLabel="Xem lớp của tôi"
              onAction={() => router.push('/(student)/classes')}
            />
          </View>
        ) : (
          <>
            <SectionTitle>Tin nhắn cá nhân</SectionTitle>
            {renderPersonal()}
            <SectionTitle>Tin nhắn nhóm lớp</SectionTitle>
            {renderClasses()}
          </>
        )}
      </Screen>
    </Screen>
  )

  // Plain render helpers (no hooks) — NOT nested components, which would
  // remount their subtree on every parent re-render.
  function renderPersonal() {
    if (conv.isLoading) return <RowSkeletons />
    if (conv.isError) return <ErrorState message={apiMessage(conv.error)} onRetry={() => void conv.refetch()} />
    if ((conv.data?.length ?? 0) === 0) {
      return (
        <ThemedText variant="body" color="muted">
          Chưa có tin nhắn. Mở trang lớp học → tab Giáo viên → Nhắn tin để bắt đầu trò chuyện.
        </ThemedText>
      )
    }
    return (
      <ListBlock>
        {conv.data!.map((c, i) => (
          <ConversationRow key={c.userId} conv={c} first={i === 0} />
        ))}
      </ListBlock>
    )
  }

  function renderClasses() {
    if (classes.isLoading) return <RowSkeletons />
    if (classes.isError) return <ErrorState message={apiMessage(classes.error)} onRetry={() => void classes.refetch()} />
    if ((classes.data?.length ?? 0) === 0) {
      return (
        <View style={{ gap: space[3], alignItems: 'flex-start' }}>
          <ThemedText variant="body" color="muted">
            Vào một lớp học để trò chuyện cùng cả lớp trong kênh nhóm.
          </ThemedText>
          <Button
            label="Xem lớp của tôi"
            variant="secondary"
            size="sm"
            fullWidth={false}
            onPress={() => router.push('/(student)/classes')}
          />
        </View>
      )
    }
    return (
      <ListBlock>
        {classes.data!.map((k, i) => (
          <ClassChannelRow key={k.id} klass={k} first={i === 0} />
        ))}
      </ListBlock>
    )
  }
}

function ClassChannelRow({ klass, first }: { klass: MyClassroom; first: boolean }) {
  const c = useTheme().colors
  const teacherNames = klass.teachers.map((t) => t.displayName).join(', ')
  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: '/(student)/class-chat/[classId]',
          params: { classId: String(klass.id), className: klass.name, from: 'messages' },
        })
      }
      accessibilityRole="button"
      accessibilityLabel={`Kênh chat lớp ${klass.name}`}
      style={({ pressed }) => listRowStyle(c.border, first, { backgroundColor: pressed ? c.surfaceSunken : 'transparent' })}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: radius.full,
          backgroundColor: c.accent,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <GaGlyph name="lophoc" size={22} ink="onAccent" gold="ink" />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <ThemedText variant="bodyStrong" numberOfLines={1}>
          {klass.name}
        </ThemedText>
        <ThemedText variant="caption" color="muted" numberOfLines={1}>
          {teacherNames ? `Kênh chat cả lớp · GV: ${teacherNames}` : 'Kênh chat cả lớp'}
        </ThemedText>
      </View>
      <Icon icon={ChevronRight} size={18} color="faint" />
    </Pressable>
  )
}

function RowSkeletons() {
  return (
    <View style={{ gap: space[2] }}>
      <Skeleton height={64} radius="lg" />
      <Skeleton height={64} radius="lg" />
    </View>
  )
}

function ConversationRow({ conv, first }: { conv: Conversation; first: boolean }) {
  const c = useTheme().colors
  const hasUnread = conv.unread > 0
  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: '/(student)/messages/[userId]',
          params: { userId: String(conv.userId), name: conv.displayName },
        })
      }
      accessibilityRole="button"
      accessibilityLabel={`Trò chuyện với ${conv.displayName}${hasUnread ? `, ${conv.unread} tin chưa đọc` : ''}`}
      style={({ pressed }) => listRowStyle(c.border, first, { backgroundColor: pressed ? c.surfaceSunken : 'transparent' })}
    >
      <InitialAvatar initial={nameInitial(conv.displayName)} size={44} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <ThemedText variant="bodyStrong" numberOfLines={1}>
          {conv.displayName}
        </ThemedText>
        <ThemedText
          variant="caption"
          color={hasUnread ? 'primary' : 'muted'}
          numberOfLines={1}
          style={hasUnread ? { fontFamily: fonts.bodySemi } : undefined}
        >
          {conv.lastMessage ?? 'Bắt đầu trò chuyện'}
        </ThemedText>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <ThemedText variant="caption" color="muted">{timeAgo(conv.lastAt)}</ThemedText>
        {hasUnread ? (
          <View
            style={{
              minWidth: 20,
              height: 20,
              paddingHorizontal: 6,
              borderRadius: radius.full,
              backgroundColor: c.danger,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ThemedText variant="caption" style={{ color: c.onBrand, fontSize: 11.5, fontFamily: fonts.bodyBold }}>
              {conv.unread > 9 ? '9+' : String(conv.unread)}
            </ThemedText>
          </View>
        ) : null}
      </View>
    </Pressable>
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
