import { useEffect, useMemo, useState } from 'react'
import {
  FlatList, KeyboardAvoidingView, Platform, Pressable, TextInput, View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { router, useLocalSearchParams } from 'expo-router'
import { MessageCircle, Send } from 'lucide-react-native'
import { apiMessage } from '@/lib/api'
import { messagesApi, type Message } from '@/lib/messagesApi'
import { fonts, radius, space, useTheme } from '@/lib/theme'
import {
  AppHeader, Caption, EmptyState, ErrorState, Icon, Screen, Skeleton, ThemedText,
} from '@/components/ui'

export default function MessageThreadScreen() {
  const c = useTheme().colors
  const insets = useSafeAreaInsets()
  const qc = useQueryClient()
  const params = useLocalSearchParams<{ userId: string; name?: string }>()
  const userId = Number(params.userId)
  const name = params.name ?? 'Giáo viên'

  const [draft, setDraft] = useState('')

  const q = useQuery({
    queryKey: ['message-thread', userId],
    queryFn: () => messagesApi.thread(userId),
    enabled: Number.isFinite(userId),
    staleTime: 10_000,
  })

  // Fetching the thread marks it read server-side → refresh the list + unread badge.
  useEffect(() => {
    if (q.isSuccess) {
      void qc.invalidateQueries({ queryKey: ['conversations'] })
      void qc.invalidateQueries({ queryKey: ['messages-unread'] })
    }
  }, [q.isSuccess, q.dataUpdatedAt, qc])

  const sendMut = useMutation({
    mutationFn: (body: string) => messagesApi.send(userId, body),
    onSuccess: () => {
      setDraft('')
      void qc.invalidateQueries({ queryKey: ['message-thread', userId] })
      void qc.invalidateQueries({ queryKey: ['conversations'] })
    },
  })

  // Inverted list renders index 0 at the bottom → feed it newest-first.
  const ordered = useMemo(() => (q.data ?? []).slice().reverse(), [q.data])

  const trimmed = draft.trim()
  const canSend = trimmed.length > 0 && !sendMut.isPending

  return (
    <Screen edges={['top']}>
      <AppHeader title={name} subtitle="Nhắn tin với giáo viên" onBack={() => router.back()} />
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
        ) : ordered.length === 0 ? (
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
            data={ordered}
            inverted
            keyExtractor={(m) => String(m.id)}
            renderItem={({ item }) => <Bubble msg={item} />}
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
            onPress={() => sendMut.mutate(trimmed)}
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
        {sendMut.isError ? (
          <Caption color={c.danger} style={{ paddingHorizontal: space[5], paddingBottom: space[2] }}>
            {apiMessage(sendMut.error)}
          </Caption>
        ) : null}
      </KeyboardAvoidingView>
    </Screen>
  )
}

function Bubble({ msg }: { msg: Message }) {
  const c = useTheme().colors
  const mine = msg.mine
  return (
    <View style={{ alignItems: mine ? 'flex-end' : 'flex-start', marginBottom: space[2] }}>
      <View
        style={{
          maxWidth: '82%',
          backgroundColor: mine ? c.accent : c.surface,
          borderWidth: mine ? 0 : 1,
          borderColor: c.border,
          borderRadius: radius.md,
          paddingHorizontal: space[3],
          paddingVertical: space[2],
        }}
      >
        <ThemedText variant="body" style={{ color: mine ? c.onBrand : c.textPrimary }}>
          {msg.body}
        </ThemedText>
      </View>
      <Caption color={c.textFaint} style={{ marginTop: 2, paddingHorizontal: space[1] }}>
        {clock(msg.createdAt)}
      </Caption>
    </View>
  )
}

function clock(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}
