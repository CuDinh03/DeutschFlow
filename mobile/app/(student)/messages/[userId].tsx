import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  FlatList, KeyboardAvoidingView, Platform, Pressable, TextInput, View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { MessageCircle, MoreVertical, Send } from 'lucide-react-native'
import { apiMessage } from '@/lib/api'
import { messagesApi, type Message } from '@/lib/messagesApi'
import { adaptivePollMs, maxMessageId, mergeThreadById } from '@/lib/chatDelta'
import { buildDmBubbles, type ChatBubbleVM } from '@/lib/chatBubbles'
import { itemsForChannel } from '@/lib/chatOutbox'
import { useChatOutboxStore } from '@/stores/useChatOutboxStore'
import { reportFlow, userSafetyMenu } from '@/lib/moderationActions'
import { fonts, radius, space, useTheme } from '@/lib/theme'
import {
  AppHeader, Caption, EmptyState, ErrorState, Icon, Screen, Skeleton, ThemedText,
} from '@/components/ui'

// The open thread polls so a teacher's reply appears live. A NEW_MESSAGE push already invalidates
// this query on arrival (usePushNotifications), so polling is the fallback for a missed foreground
// push; it pauses on background via the AppState→focusManager bridge. Each poll is a DELTA fetch
// (only messages newer than the cursor) merged into the cache, and the cadence backs off while the
// thread is idle (adaptivePollMs) — snappy when active, calm when quiet, to save battery + data.

export default function MessageThreadScreen() {
  const c = useTheme().colors
  const insets = useSafeAreaInsets()
  const qc = useQueryClient()
  const params = useLocalSearchParams<{ userId: string; name?: string }>()
  const userId = Number(params.userId)
  const name = params.name ?? 'Giáo viên'

  const [draft, setDraft] = useState('')

  // Local-first send: the composer never blocks on the network. Sending enqueues an optimistic
  // bubble in the outbox store; the store POSTs in the background and reconciles the cache.
  const outboxItems = useChatOutboxStore((s) => s.items)
  const send = useChatOutboxStore((s) => s.send)
  const retry = useChatOutboxStore((s) => s.retry)
  const flush = useChatOutboxStore((s) => s.flush)
  const reconcile = useChatOutboxStore((s) => s.reconcile)

  // Timestamp of the last thread activity (send / focus / a poll that brought new messages).
  // Drives the adaptive poll cadence — reset to "now" makes the next intervals snappy again.
  const lastActivityRef = useRef(Date.now())

  const q = useQuery({
    queryKey: ['message-thread', userId],
    queryFn: async () => {
      const prev = qc.getQueryData<Message[]>(['message-thread', userId]) ?? []
      const cursor = maxMessageId(prev) // from the CACHE (server truth), never from optimistic shadows
      const delta = await messagesApi.thread(userId, cursor > 0 ? cursor : undefined)
      const merged = cursor > 0 ? mergeThreadById(prev, delta) : delta
      if (merged.length !== prev.length) lastActivityRef.current = Date.now() // new messages → poll fast
      return merged
    },
    enabled: Number.isFinite(userId),
    staleTime: 2_000,
    refetchInterval: () => adaptivePollMs(Date.now() - lastActivityRef.current),
  })

  // Re-fetch + retry any stuck sends whenever the thread regains focus (e.g. after backgrounding
  // and returning) so it never shows a stale snapshot and a queued message goes out promptly.
  const refetch = q.refetch
  useFocusEffect(useCallback(() => {
    lastActivityRef.current = Date.now() // returning to the thread → poll snappily again
    void refetch()
    flush()
  }, [refetch, flush]))

  // Fetching the thread marks it read server-side → refresh the list + unread badge.
  useEffect(() => {
    if (q.isSuccess) {
      void qc.invalidateQueries({ queryKey: ['conversations'] })
      void qc.invalidateQueries({ queryKey: ['messages-unread'] })
    }
  }, [q.isSuccess, q.dataUpdatedAt, qc])

  // When a real fetch surfaces our just-sent messages, retire their optimistic shadows so the
  // server rows take over cleanly. Driven only by genuine server data (react-query keeps the
  // same ref when unchanged, so this no-ops between polls).
  useEffect(() => {
    if (q.data) reconcile('dm', userId, q.data.map((m) => m.id))
  }, [q.data, userId, reconcile])

  const outbox = useMemo(() => itemsForChannel(outboxItems, 'dm', userId), [outboxItems, userId])
  const bubbles = useMemo(() => buildDmBubbles(q.data ?? [], outbox), [q.data, outbox])

  const trimmed = draft.trim()
  const canSend = trimmed.length > 0

  // Optimistic send: clear the composer + haptic immediately, enqueue, done.
  const onSend = () => {
    if (!canSend) return
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    lastActivityRef.current = Date.now() // just sent → keep polling snappy to surface the reply
    send('dm', userId, trimmed)
    setDraft('')
  }

  return (
    <Screen edges={['top']}>
      <AppHeader
        title={name}
        subtitle="Nhắn tin với giáo viên"
        onBack={() => router.back()}
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tùy chọn an toàn"
            hitSlop={8}
            onPress={() =>
              userSafetyMenu(userId, name, () => {
                void qc.invalidateQueries({ queryKey: ['conversations'] })
                router.back()
              })
            }
            style={{ padding: space[2] }}
          >
            <Icon icon={MoreVertical} size={20} color="faint" />
          </Pressable>
        }
      />
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
              icon={MessageCircle}
              title="Chưa có tin nhắn"
              message={`Gửi tin nhắn đầu tiên cho ${name}.`}
            />
          </View>
        ) : (
          <FlatList
            style={{ flex: 1 }}
            data={bubbles}
            inverted
            keyExtractor={(b) => b.key}
            // Keep the visible thread anchored when a new bubble arrives at the bottom (index 0),
            // so an incoming reply never shoves the messages you're reading.
            maintainVisibleContentPosition={{ minIndexForVisible: 1 }}
            renderItem={({ item }) => (
              <Bubble
                vm={item}
                onRetry={item.status === 'failed' ? () => retry(item.tempId!) : undefined}
                onReport={
                  item.mine || item.realId == null
                    ? undefined
                    : () => reportFlow({ context: 'DIRECT_MESSAGE', messageId: item.realId! }, 'Báo cáo tin nhắn')
                }
              />
            )}
            contentContainerStyle={{ paddingHorizontal: space[5], paddingVertical: space[3] }}
            keyboardDismissMode="interactive"
          />
        )}

        {/* Composer */}
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
            placeholder="Nhập tin nhắn…"
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

function Bubble({ vm, onReport, onRetry }: { vm: ChatBubbleVM; onReport?: () => void; onRetry?: () => void }) {
  const c = useTheme().colors
  const mine = vm.mine
  const failed = vm.status === 'failed'
  const sending = vm.status === 'sending'
  return (
    <View style={{ alignItems: mine ? 'flex-end' : 'flex-start', marginBottom: space[2] }}>
      <Pressable
        onLongPress={onReport}
        onPress={onRetry}
        accessibilityRole={onReport || onRetry ? 'button' : undefined}
        accessibilityLabel={
          onRetry ? 'Gửi lại tin nhắn' : onReport ? 'Giữ để báo cáo tin nhắn' : undefined
        }
        style={{
          maxWidth: '82%',
          opacity: sending ? 0.65 : 1,
          backgroundColor: mine ? c.accent : c.surface,
          borderWidth: mine ? 0 : 1,
          borderColor: c.border,
          borderRadius: radius.md,
          paddingHorizontal: space[3],
          paddingVertical: space[2],
        }}
      >
        <ThemedText variant="body" style={{ color: mine ? c.onBrand : c.textPrimary }}>
          {vm.body}
        </ThemedText>
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
