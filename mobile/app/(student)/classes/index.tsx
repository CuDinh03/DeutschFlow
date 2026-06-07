import { useState } from 'react'
import { Alert, FlatList, Pressable, RefreshControl, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import {
  BookOpen, ChevronRight, Clock, GraduationCap, Plus, Presentation, Sparkles,
} from 'lucide-react-native'
import { apiMessage } from '@/lib/api'
import {
  fetchMyClasses, joinClassByInviteCode, type MyClassroom,
} from '@/lib/studentClassesApi'
import { radius, space, useTheme } from '@/lib/theme'
import {
  AppHeader, Button, Card, EmptyState, ErrorState, FadeIn, Icon, Pill, ProgressBar,
  Screen, Skeleton, TextField, ThemedText,
} from '@/components/ui'

export default function StudentClassesIndex() {
  const theme = useTheme()
  const qc = useQueryClient()

  const [joinOpen, setJoinOpen] = useState(false)

  const { data: classes, isLoading, isRefetching, refetch, error } = useQuery({
    queryKey: ['my-classes'],
    queryFn: fetchMyClasses,
    staleTime: 30_000,
  })

  return (
    <Screen>
      <AppHeader
        title="Lớp của tôi"
        subtitle={
          classes && classes.length > 0
            ? `Đang tham gia ${classes.length} lớp`
            : 'Lớp bạn đã tham gia'
        }
        onBack={() => router.back()}
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tham gia lớp"
            onPress={() => setJoinOpen(true)}
            hitSlop={8}
            style={({ pressed }) => ({
              width: 40,
              height: 40,
              borderRadius: radius.md,
              backgroundColor: theme.colors.accentSoft,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Icon icon={Plus} size={20} color="accent" />
          </Pressable>
        }
      />

      {isLoading ? (
        <View style={{ paddingHorizontal: space[5], gap: space[3] }}>
          <Skeleton height={120} />
          <Skeleton height={120} />
        </View>
      ) : error ? (
        <ErrorState
          title="Không tải được danh sách lớp"
          message={apiMessage(error)}
          onRetry={() => void refetch()}
        />
      ) : !classes || classes.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState
            icon={Presentation}
            title="Chưa có lớp nào"
            message="Nhập mã mời từ giáo viên để gửi yêu cầu tham gia lớp. Giáo viên sẽ duyệt trước khi bạn vào lớp."
            actionLabel="Tham gia lớp"
            onAction={() => setJoinOpen(true)}
          />
        </View>
      ) : (
        <FlatList
          data={classes}
          keyExtractor={(c) => String(c.id)}
          contentContainerStyle={{
            paddingHorizontal: space[5],
            paddingBottom: space[8],
            gap: space[3],
          }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => void refetch()}
              tintColor={theme.colors.accent}
            />
          }
          renderItem={({ item, index }) => (
            <FadeIn delay={index * 60}>
              <ClassCard classroom={item} />
            </FadeIn>
          )}
        />
      )}

      <JoinClassModal
        visible={joinOpen}
        onClose={() => setJoinOpen(false)}
        onJoined={() => qc.invalidateQueries({ queryKey: ['my-classes'] })}
      />
    </Screen>
  )
}

function ClassCard({ classroom }: { classroom: MyClassroom }) {
  const theme = useTheme()
  const c = theme.colors
  const lessonPercent = classroom.lessonTotal > 0
    ? classroom.lessonCompleted / classroom.lessonTotal
    : 0

  return (
    <Card
      onPress={() => router.push(`/(student)/classes/${classroom.id}` as never)}
      accessibilityLabel={`Mở lớp ${classroom.name}`}
    >
      <View style={{ gap: space[3] }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[3] }}>
          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: radius.lg,
              backgroundColor: c.accentSoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon icon={Presentation} size={20} color="accent" />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <ThemedText variant="bodyStrong" numberOfLines={1}>
              {classroom.name}
            </ThemedText>
            <ThemedText variant="caption" color="secondary" numberOfLines={1}>
              {classroom.teachers.length > 0
                ? classroom.teachers.map((t) => t.displayName).join(', ')
                : 'Chưa có giáo viên'}
            </ThemedText>
          </View>
          <Icon icon={ChevronRight} size={16} color="muted" />
        </View>

        <View style={{ flexDirection: 'row', gap: space[2] }}>
          <MiniStat icon={BookOpen} label="Bài tập" value={String(classroom.assignmentCount)} />
          <MiniStat
            icon={Clock}
            label="Chưa nộp"
            value={String(classroom.pendingCount)}
            tone={classroom.pendingCount > 0 ? 'danger' : undefined}
          />
          <MiniStat
            icon={Sparkles}
            label="Điểm TB"
            value={classroom.avgScore != null ? classroom.avgScore.toFixed(1) : '–'}
          />
        </View>

        {classroom.lessonTotal > 0 && (
          <View style={{ gap: space[1] }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <ThemedText variant="caption" color="secondary">
                Tiến độ lớp
              </ThemedText>
              <ThemedText variant="caption" color="secondary">
                {classroom.lessonCompleted}/{classroom.lessonTotal} buổi
              </ThemedText>
            </View>
            <ProgressBar value={lessonPercent} />
          </View>
        )}

        {classroom.latestAssignmentTopic && (
          <View
            style={{
              backgroundColor: c.surfaceSunken,
              borderRadius: radius.md,
              padding: space[3],
            }}
          >
            <ThemedText variant="caption" color="secondary">
              Bài mới nhất
            </ThemedText>
            <ThemedText variant="body" numberOfLines={1}>
              {classroom.latestAssignmentTopic}
            </ThemedText>
          </View>
        )}
      </View>
    </Card>
  )
}

function MiniStat({
  icon, label, value, tone,
}: {
  icon: typeof BookOpen
  label: string
  value: string
  tone?: 'danger'
}) {
  const theme = useTheme()
  const c = theme.colors
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: tone === 'danger' ? c.dangerSoft : c.surfaceSunken,
        borderRadius: radius.md,
        paddingVertical: space[2],
        paddingHorizontal: space[2],
        alignItems: 'center',
        gap: 2,
      }}
    >
      <Icon icon={icon} size={12} color={tone === 'danger' ? 'danger' : 'muted'} />
      <ThemedText variant="caption" color={tone === 'danger' ? 'danger' : 'secondary'}>
        {label}
      </ThemedText>
      <ThemedText variant="bodyStrong">{value}</ThemedText>
    </View>
  )
}

function JoinClassModal({
  visible, onClose, onJoined,
}: {
  visible: boolean
  onClose: () => void
  onJoined: () => void
}) {
  const theme = useTheme()
  const [code, setCode] = useState('')

  const mutation = useMutation({
    mutationFn: () => joinClassByInviteCode(code.trim()),
    onSuccess: () => {
      Alert.alert(
        'Đã gửi yêu cầu',
        'Vui lòng chờ giáo viên duyệt. Bạn sẽ nhận được thông báo khi được chấp thuận.',
      )
      setCode('')
      onJoined()
      onClose()
    },
    onError: (e) => {
      Alert.alert('Không gửi được yêu cầu', apiMessage(e))
    },
  })

  if (!visible) return null

  return (
    <View
      style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
      }}
    >
      <Pressable
        style={{ flex: 1 }}
        accessibilityLabel="Đóng"
        onPress={() => {
          if (!mutation.isPending) onClose()
        }}
      />
      <View
        style={{
          backgroundColor: theme.colors.surface,
          borderTopLeftRadius: radius['2xl'],
          borderTopRightRadius: radius['2xl'],
          padding: space[5],
          gap: space[4],
        }}
      >
        <View style={{ gap: space[1] }}>
          <ThemedText variant="title">Tham gia lớp</ThemedText>
          <ThemedText variant="body" color="secondary">
            Nhập mã mời mà giáo viên đã gửi cho bạn. Yêu cầu sẽ được giáo viên duyệt.
          </ThemedText>
        </View>

        <TextField
          label="Mã mời"
          value={code}
          onChangeText={(t) => setCode(t.toUpperCase())}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="VD: ABC123"
          editable={!mutation.isPending}
          maxLength={32}
        />

        <View style={{ flexDirection: 'row', gap: space[2] }}>
          <Button
            label="Huỷ"
            variant="ghost"
            onPress={onClose}
            disabled={mutation.isPending}
            style={{ flex: 1 }}
          />
          <Button
            label={mutation.isPending ? 'Đang gửi…' : 'Gửi yêu cầu'}
            onPress={() => mutation.mutate()}
            disabled={!code.trim() || mutation.isPending}
            style={{ flex: 1 }}
          />
        </View>
      </View>
    </View>
  )
}
