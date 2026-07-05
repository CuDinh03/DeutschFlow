import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, TextInput, View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { MessagesSquare, Send } from 'lucide-react-native'
import { apiMessage } from '@/lib/api'
import { classChannelApi } from '@/lib/classChannelApi'
import { buildClassBubbles, type ChatBubbleVM } from '@/lib/chatBubbles'
import { itemsForChannel } from '@/lib/chatOutbox'
import { useChatOutboxStore } from '@/stores/useChatOutboxStore'
import { reportFlow } from '@/lib/moderationActions'
import { fonts, radius, space, useTheme } from '@/lib/theme'
import {
  AppHeader, Caption, EmptyState, ErrorState, Icon, Screen, Skeleton, ThemedText,
} from '@/components/ui'

export default function ClassChatScreen() {
  const c = useTheme().colors
  const insets = useSafeAreaInsets()
  const qc = useQueryClient()
  const params = useLocalSearchParams<{ classId: string; className?: string }>()
  const classId = Number(params.classId)
  const className = params.className ?? 'Chat lớp'
  const [draft, setDraft] = useState('')

  const outboxItems = useChatOutboxStore((s) => s.items)
  const send = useChatOutboxStore((s) => s.send)
  const retry = useChatOutboxStore((s) => s.retry)
  const flush = useChatOutboxStore((s) => s.flush)
  const reconcile = useChatOutboxStore((s) => s.reconcile)

  const q = useQuery({
    queryKey: ['class-channel', classId],
    queryFn: () => classChannelApi.list(classId),
    enabled: Number.isFinite(classId),
    staleTime: 3_000,
    refetchInterval: 8_000, // light polling for near-realtime (no SSE in this MVP)
  })

  // Refetch + retry queued sends when the channel regains focus so a returning member never sees
  // a stale thread and a message queued offline goes out promptly.
  const refetch = q.refetch
  useFocusEffect(useCallback(() => {
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
  const trimmed = draft.trim()
  const canSend = trimmed.length > 0

  const onSend = () => {
    if (!canSend) return
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    send('class', classId, trimmed)
    setDraft('')
  }

  return (
    <Screen edges={['top']}>
      <AppHeader title={className} subtitle="Kênh chat lớp" onBack={() => router.back()} />
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
              icon={MessagesSquare}
              title="Chưa có tin nhắn"
              message="Hãy gửi tin nhắn đầu tiên cho cả lớp."
            />
          </View>
        ) : (
          <FlatList
            style={{ flex: 1 }}
            data={bubbles}
            inverted
            keyExtractor={(b) => b.key}
            maintainVisibleContentPosition={{ minIndexForVisible: 1 }}
            renderItem={({ item }) => (
              <Bubble
                vm={item}
                onLongPress={item.realId != null ? () => messageActions(item) : undefined}
                onRetry={item.status === 'failed' ? () => retry(item.tempId!) : undefined}
              />
            )}
            contentContainerStyle={{ paddingHorizontal: space[5], paddingVertical: space[3] }}
            keyboardDismissMode="interactive"
          />
        )}

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: space[2],
            paddingHorizontal: space[4],
            paddingTop: space[2],
            paddingBottom: Math.max(insets.bottom, space[2]),
            borderTopWidth: 1,
            borderTopColor: c.border,
            backgroundColor: c.bg,
          }}
        >
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Nhắn cả lớp…"
            placeholderTextColor={c.textFaint}
            multiline
            accessibilityLabel="Nội dung tin nhắn"
            style={{
              flex: 1,
              maxHeight: 120,
              backgroundColor: c.surfaceSunken,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: c.border,
              paddingHorizontal: space[3],
              paddingVertical: space[2],
              color: c.textPrimary,
              fontFamily: fonts.bodyRegular,
              fontSize: 15,
            }}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Gửi tin nhắn"
            accessibilityState={{ disabled: !canSend }}
            disabled={!canSend}
            onPress={onSend}
            style={{
              width: 44,
              height: 44,
              borderRadius: radius.md,
              backgroundColor: canSend ? c.accent : c.surfaceSunken,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon icon={Send} size={18} color={canSend ? 'onAccent' : 'faint'} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  )
}

function Bubble({
  vm, onLongPress, onRetry,
}: { vm: ChatBubbleVM; onLongPress?: () => void; onRetry?: () => void }) {
  const c = useTheme().colors
  const mine = vm.mine
  const failed = vm.status === 'failed'
  const sending = vm.status === 'sending'
  return (
    <View style={{ alignItems: mine ? 'flex-end' : 'flex-start', marginBottom: space[2] }}>
      {!mine && vm.senderName ? (
        <Caption color={c.textFaint} style={{ marginBottom: 2, paddingHorizontal: space[1] }}>
          {vm.senderName}
        </Caption>
      ) : null}
      <Pressable
        onLongPress={onLongPress}
        onPress={onRetry}
        delayLongPress={300}
        accessibilityRole={onLongPress || onRetry ? 'button' : undefined}
        accessibilityLabel={
          onRetry ? 'Gửi lại tin nhắn' : onLongPress ? 'Giữ để xoá tin nhắn' : undefined
        }
        style={{
          maxWidth: '82%',
          opacity: sending ? 0.65 : 1,
          backgroundColor: vm.deleted ? c.surfaceSunken : mine ? c.accent : c.surface,
          borderWidth: mine && !vm.deleted ? 0 : 1,
          borderColor: c.border,
          borderRadius: radius.md,
          paddingHorizontal: space[3],
          paddingVertical: space[2],
        }}
      >
        {vm.deleted ? (
          <ThemedText variant="body" color="faint" style={{ fontStyle: 'italic' }}>
            Tin đã xoá
          </ThemedText>
        ) : (
          <ThemedText variant="body" style={{ color: mine ? c.onBrand : c.textPrimary }}>
            {vm.body}
          </ThemedText>
        )}
      </Pressable>
      {failed ? (
        <Caption color={c.danger} style={{ marginTop: 2, paddingHorizontal: space[1] }}>
          Gửi lỗi · Chạm để thử lại
        </Caption>
      ) : (
        <Caption color={c.textFaint} style={{ marginTop: 2, paddingHorizontal: space[1] }}>
          {sending ? 'Đang gửi…' : clock(vm.createdAt)}
        </Caption>
      )}
    </View>
  )
}

function clock(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}
