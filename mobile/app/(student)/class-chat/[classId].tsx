import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert, FlatList, KeyboardAvoidingView, Platform, View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useFocusEffect, useLocalSearchParams } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { apiMessage } from '@/lib/api'
import { classChannelApi, type ClassMessage } from '@/lib/classChannelApi'
import { adaptivePollMs } from '@/lib/chatDelta'
import { buildClassBubbles, type ChatBubbleVM } from '@/lib/chatBubbles'
import { itemsForChannel } from '@/lib/chatOutbox'
import { useChatOutboxStore } from '@/stores/useChatOutboxStore'
import { useChatAutoScroll } from '@/hooks/useChatAutoScroll'
import { useIsScreenFocused } from '@/hooks/useIsScreenFocused'
import { reportFlow } from '@/lib/moderationActions'
import { space } from '@/lib/theme'
import {
  EmptyState, ErrorState, Screen, Skeleton,
} from '@/components/ui'
import { TopBar } from '@/components/classroom/ClassroomParts'
import { BubbleView, ChatComposer, DaySeparator } from '@/components/classroom/ChatParts'
import { clockLabel, daySeparatorAbove } from '@/lib/classroomUi'
import { useBackTo } from '@/hooks/useBackTo'

export default function ClassChatScreen() {
  // Màn sống trong Tabs nên KHÔNG unmount khi đổi tham số: mở sang classId khác vẫn là bản thể cũ,
  // giữ nguyên state (nháp, câu trả lời, điểm, tệp đính kèm) của lần trước. Remount theo key
  // giống mẫu ở skill-practice.tsx.
  const { classId } = useLocalSearchParams<{ classId: string }>()
  return <ClassChatRunner key={classId ?? 'none'} />
}

function ClassChatRunner() {
  const insets = useSafeAreaInsets()
  const qc = useQueryClient()
  const params = useLocalSearchParams<{ classId: string; className?: string; from?: string }>()
  // Back tường minh về màn cha — Tabs firstRoute sẽ về Heute (xem lib/screenParents).
  const goBack = useBackTo(() =>
    params.from === 'messages'
      ? '/(student)/messages'
      : { pathname: '/(student)/classes/[id]', params: { id: params.classId } },
  )
  const classId = Number(params.classId)
  const className = params.className ?? 'Chat lớp'
  const [draft, setDraft] = useState('')

  const outboxItems = useChatOutboxStore((s) => s.items)
  const send = useChatOutboxStore((s) => s.send)
  const retry = useChatOutboxStore((s) => s.retry)
  const flush = useChatOutboxStore((s) => s.flush)
  const reconcile = useChatOutboxStore((s) => s.reconcile)

  const lastActivityRef = useRef(Date.now())

  // M1 audit lag 02/09: cùng gate với messages/[userId] — Tabs không unmount nên blur phải trả
  // refetchInterval=false, kẻo kênh lớp poll 4–30s vô hạn sau lưng người dùng; focus lại thì
  // useFocusEffect refetch ngay và interval sống lại.
  const isFocused = useIsScreenFocused()
  const isFocusedRef = useRef(isFocused)
  isFocusedRef.current = isFocused

  const q = useQuery({
    queryKey: ['class-channel', classId],
    // Full fetch (no delta): a soft-delete flips an existing row's `deleted` flag without changing
    // its id, so an id-cursor delta would miss deletions — the channel must always see current
    // moderation state. The adaptive cadence keeps the cost down when the channel is quiet.
    queryFn: async () => {
      const prev = qc.getQueryData<ClassMessage[]>(['class-channel', classId]) ?? []
      const next = await classChannelApi.list(classId)
      if (next.length !== prev.length) lastActivityRef.current = Date.now()
      return next
    },
    enabled: Number.isFinite(classId),
    staleTime: 3_000,
    refetchInterval: () =>
      isFocusedRef.current ? adaptivePollMs(Date.now() - lastActivityRef.current) : false,
  })

  // Refetch + retry queued sends when the channel regains focus so a returning member never sees
  // a stale thread and a message queued offline goes out promptly.
  const refetch = q.refetch
  useFocusEffect(useCallback(() => {
    lastActivityRef.current = Date.now()
    void refetch()
    flush()
  }, [refetch, flush]))

  // Retire optimistic shadows once a real fetch surfaces them (server rows take over).
  useEffect(() => {
    if (q.data) reconcile('class', classId, q.data.map((m) => m.id))
  }, [q.data, classId, reconcile])

  const deleteMut = useMutation({
    mutationFn: (id: number) => classChannelApi.remove(classId, id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['class-channel', classId] }),
    onError: (e) => Alert.alert('Lỗi', apiMessage(e)),
  })

  const confirmDelete = (id: number) => {
    Alert.alert('Xoá tin nhắn?', 'Tin nhắn sẽ bị ẩn khỏi kênh lớp.', [
      { text: 'Huỷ', style: 'cancel' },
      { text: 'Xoá', style: 'destructive', onPress: () => deleteMut.mutate(id) },
    ])
  }

  // Long-press an acknowledged message → report it (Apple 1.2); own/teacher messages also delete.
  const messageActions = (vm: ChatBubbleVM) => {
    if (vm.realId == null) return
    const id = vm.realId
    const buttons: Parameters<typeof Alert.alert>[2] = [
      {
        text: 'Báo cáo tin nhắn',
        onPress: () =>
          reportFlow({ context: 'CLASS_MESSAGE', classMessageId: id, classId }, 'Báo cáo tin nhắn'),
      },
    ]
    if (vm.canDelete) {
      buttons!.push({ text: 'Xoá tin nhắn', style: 'destructive', onPress: () => confirmDelete(id) })
    }
    buttons!.push({ text: 'Huỷ', style: 'cancel' })
    Alert.alert('Tin nhắn', undefined, buttons)
  }

  const outbox = useMemo(() => itemsForChannel(outboxItems, 'class', classId), [outboxItems, classId])
  const bubbles = useMemo(() => buildClassBubbles(q.data ?? [], outbox), [q.data, outbox])
  // Vạch ngày (v3.4 `.daysep`) — chỉ trình bày, tính từ danh sách đã dựng.
  // Màn không unmount: khoá theo NGÀY để qua nửa đêm (dữ liệu không đổi) nhãn Hôm nay/Hôm qua vẫn tính lại.
  const dayKey = new Date().toDateString()
  const separators = useMemo(() => {
    const now = new Date(dayKey) // 00:00 hôm nay — đủ để so theo ngày
    return bubbles.map((_, i) => daySeparatorAbove(bubbles, i, now))
  }, [bubbles, dayKey])

  // Follow the newest bubble (own send or an incoming message) when at the bottom; don't yank a
  // user reading history. bubbles[0] is the newest (list is inverted / newest-first).
  const { listRef, onScroll } = useChatAutoScroll(bubbles[0])
  const trimmed = draft.trim()
  const canSend = trimmed.length > 0

  const onSend = () => {
    if (!canSend) return
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    lastActivityRef.current = Date.now()
    send('class', classId, trimmed)
    setDraft('')
  }

  return (
    <Screen edges={['top']}>
      {/* Giao diện v3.4 (Đợt 6B, mẫu `cchat`): thanh đầu giữa, bong bóng mực/thẻ, vạch ngày, ô nhập viên thuốc. */}
      <TopBar title="Kênh chat lớp" subtitle={className} onBack={goBack} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {q.isLoading ? (
          <View style={{ paddingHorizontal: space[5], gap: space[3], paddingTop: space[2] }}>
            <Skeleton height={48} radius="md" />
            <Skeleton height={48} radius="md" />
          </View>
        ) : q.isError ? (
          <ErrorState message={apiMessage(q.error)} onRetry={() => void q.refetch()} />
        ) : bubbles.length === 0 ? (
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <EmptyState
              glyph="hoithoai"
              title="Chưa có tin nhắn"
              message="Hãy gửi tin nhắn đầu tiên cho cả lớp."
            />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            style={{ flex: 1 }}
            data={bubbles}
            inverted
            keyExtractor={(b) => b.key}
            onScroll={onScroll}
            scrollEventThrottle={16}
            renderItem={({ item, index }) => (
              <View>
                {separators[index] ? <DaySeparator label={separators[index]!} /> : null}
                <Bubble
                  vm={item}
                  onLongPress={item.realId != null ? () => messageActions(item) : undefined}
                  onRetry={item.status === 'failed' ? () => retry(item.tempId!) : undefined}
                />
              </View>
            )}
            contentContainerStyle={{ paddingHorizontal: space[5], paddingVertical: space[3] }}
            keyboardDismissMode="interactive"
          />
        )}

        <ChatComposer
          value={draft}
          onChangeText={setDraft}
          placeholder="Nhắn cả lớp…"
          canSend={canSend}
          onSend={onSend}
          bottomInset={insets.bottom}
          hint="Giữ một tin nhắn để báo cáo, hoặc xoá tin của bạn."
        />
      </KeyboardAvoidingView>
    </Screen>
  )
}

function Bubble({
  vm, onLongPress, onRetry,
}: { vm: ChatBubbleVM; onLongPress?: () => void; onRetry?: () => void }) {
  const sending = vm.status === 'sending'
  const who = vm.mine ? 'Bạn' : vm.senderName || 'Thành viên'
  return (
    <BubbleView
      mine={vm.mine}
      meta={`${who} · ${sending ? 'Đang gửi…' : clockLabel(vm.createdAt)}`}
      body={vm.body}
      deleted={vm.deleted}
      sending={sending}
      failed={vm.status === 'failed'}
      onLongPress={onLongPress}
      onPress={onRetry}
      delayLongPress={300}
      accessibilityHint={
        onRetry ? 'Chạm để gửi lại' : onLongPress ? (vm.mine ? 'Giữ để báo cáo hoặc xoá' : 'Giữ để báo cáo') : undefined
      }
    />
  )
}
