import { useMemo, useState } from 'react'
import {
  Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, TextInput, View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { router, useLocalSearchParams } from 'expo-router'
import { MessagesSquare, Send } from 'lucide-react-native'
import { apiMessage } from '@/lib/api'
import { classChannelApi, type ClassMessage } from '@/lib/classChannelApi'
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

  const q = useQuery({
    queryKey: ['class-channel', classId],
    queryFn: () => classChannelApi.list(classId),
    enabled: Number.isFinite(classId),
    staleTime: 8_000,
    refetchInterval: 15_000, // light polling for near-realtime (no SSE in this MVP)
  })

  const sendMut = useMutation({
    mutationFn: (body: string) => classChannelApi.post(classId, body),
    onSuccess: () => {
      setDraft('')
      void qc.invalidateQueries({ queryKey: ['class-channel', classId] })
    },
    onError: (e) => Alert.alert('Lỗi', apiMessage(e)),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => classChannelApi.remove(classId, id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['class-channel', classId] }),
    onError: (e) => Alert.alert('Lỗi', apiMessage(e)),
  })

  const confirmDelete = (m: ClassMessage) => {
    Alert.alert('Xoá tin nhắn?', 'Tin nhắn sẽ bị ẩn khỏi kênh lớp.', [
      { text: 'Huỷ', style: 'cancel' },
      { text: 'Xoá', style: 'destructive', onPress: () => deleteMut.mutate(m.id) },
    ])
  }

  // Inverted list renders index 0 at the bottom → feed it newest-first.
  const ordered = useMemo(() => (q.data ?? []).slice().reverse(), [q.data])
  const trimmed = draft.trim()
  const canSend = trimmed.length > 0 && !sendMut.isPending

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
        ) : ordered.length === 0 ? (
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
            data={ordered}
            inverted
            keyExtractor={(m) => String(m.id)}
            renderItem={({ item }) => (
              <Bubble msg={item} onLongPress={item.canDelete ? () => confirmDelete(item) : undefined} />
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
      </KeyboardAvoidingView>
    </Screen>
  )
}

function Bubble({ msg, onLongPress }: { msg: ClassMessage; onLongPress?: () => void }) {
  const c = useTheme().colors
  const mine = msg.mine
  return (
    <View style={{ alignItems: mine ? 'flex-end' : 'flex-start', marginBottom: space[2] }}>
      {!mine ? (
        <Caption color={c.textFaint} style={{ marginBottom: 2, paddingHorizontal: space[1] }}>
          {msg.senderName}
        </Caption>
      ) : null}
      <Pressable
        onLongPress={onLongPress}
        delayLongPress={300}
        accessibilityRole={onLongPress ? 'button' : undefined}
        accessibilityLabel={onLongPress ? 'Giữ để xoá tin nhắn' : undefined}
        style={{
          maxWidth: '82%',
          backgroundColor: msg.deleted ? c.surfaceSunken : mine ? c.accent : c.surface,
          borderWidth: mine && !msg.deleted ? 0 : 1,
          borderColor: c.border,
          borderRadius: radius.md,
          paddingHorizontal: space[3],
          paddingVertical: space[2],
        }}
      >
        {msg.deleted ? (
          <ThemedText variant="body" color="faint" style={{ fontStyle: 'italic' }}>
            Tin đã xoá
          </ThemedText>
        ) : (
          <ThemedText variant="body" style={{ color: mine ? c.onBrand : c.textPrimary }}>
            {msg.body}
          </ThemedText>
        )}
      </Pressable>
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
