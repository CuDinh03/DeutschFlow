import { useState } from 'react'
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, RefreshControl, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import {
  BookOpen, ChevronRight, Clock, Plus, Presentation, Sparkles,
} from 'lucide-react-native'
import { apiMessage } from '@/lib/api'
import {
  fetchMyClasses, joinClassByInviteCode, type MyClassroom,
} from '@/lib/studentClassesApi'
import { radius, space, useTheme } from '@/lib/theme'
import {
  AppHeader, Button, Caption, Card, EmptyState, ErrorState, FadeIn, Icon,
  ProgressBar, Screen, Skeleton, TextField, ThemedText, YellowSquare,
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
          <Skeleton height={150} radius="md" />
          <Skeleton height={150} radius="md" />
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
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => void refetch()}
              tintColor={theme.colors.accent}
            />
          }
          ListHeaderComponent={
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: space[2],
                paddingTop: space[3],
                paddingBottom: space[1],
              }}
            >
              <YellowSquare size={9} />
              <Caption>
                {`${classes.length} lớp đang tham gia`}
              </Caption>
            </View>
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
      padded={false}
      onPress={() => router.push(`/(student)/classes/${classroom.id}` as never)}
      accessibilityLabel={`Mở lớp ${classroom.name}`}
    >
      {/* Editorial header — eyebrow + serif title, teacher line, chevron affordance */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: space[3],
          padding: space[4],
          borderBottomWidth: 1,
          borderBottomColor: c.border,
        }}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: radius.md,
            backgroundColor: c.accentSoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon icon={Presentation} size={20} color="accent" />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <Caption color={c.accentText}>Lớp học</Caption>
          <ThemedText variant="title" numberOfLines={1}>
            {classroom.name}
          </ThemedText>
          <ThemedText variant="caption" color="secondary" numberOfLines={1}>
            {classroom.teachers.length > 0
              ? classroom.teachers.map((t) => t.displayName).join(', ')
              : 'Chưa có giáo viên'}
          </ThemedText>
        </View>
        <Icon icon={ChevronRight} size={18} color="faint" />
      </View>

      {/* Mini-stats — hairline sharp tiles */}
      <View style={{ flexDirection: 'row', borderBottomWidth: classroom.lessonTotal > 0 || classroom.latestAssignmentTopic ? 1 : 0, borderBottomColor: c.border }}>
        <MiniStat icon={BookOpen} label="Bài tập" value={String(classroom.assignmentCount)} />
        <MiniStat
          icon={Clock}
          label="Chưa nộp"
          value={String(classroom.pendingCount)}
          tone={classroom.pendingCount > 0 ? 'danger' : undefined}
          divider
        />
        <MiniStat
          icon={Sparkles}
          label="Điểm TB"
          value={classroom.avgScore != null ? classroom.avgScore.toFixed(1) : '–'}
          divider
        />
      </View>

      {classroom.lessonTotal > 0 && (
        <View
          style={{
            gap: space[2],
            padding: space[4],
            borderBottomWidth: classroom.latestAssignmentTopic ? 1 : 0,
            borderBottomColor: c.border,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Caption>Tiến độ lớp</Caption>
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
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: space[2],
            padding: space[4],
          }}
        >
          <YellowSquare size={9} style={{ marginTop: 4 }} />
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Caption>Bài mới nhất</Caption>
            <ThemedText variant="bodyStrong" numberOfLines={1}>
              {classroom.latestAssignmentTopic}
            </ThemedText>
          </View>
        </View>
      )}
    </Card>
  )
}

function MiniStat({
  icon, label, value, tone, divider,
}: {
  icon: typeof BookOpen
  label: string
  value: string
  tone?: 'danger'
  divider?: boolean
}) {
  const theme = useTheme()
  const c = theme.colors
  const isDanger = tone === 'danger'
  return (
    <View
      style={{
        flex: 1,
        paddingVertical: space[3],
        paddingHorizontal: space[2],
        alignItems: 'center',
        gap: 4,
        borderLeftWidth: divider ? 1 : 0,
        borderLeftColor: c.border,
      }}
    >
      <Icon icon={icon} size={14} color={isDanger ? 'danger' : 'muted'} />
      <ThemedText variant="monoLg" color={isDanger ? 'danger' : 'primary'}>
        {value}
      </ThemedText>
      <Caption color={isDanger ? c.danger : c.textMuted}>{label}</Caption>
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
        backgroundColor: theme.colors.overlay,
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, justifyContent: 'flex-end' }}
      >
        <Pressable
          style={{ flex: 1 }}
          accessibilityRole="button"
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
            borderTopWidth: 1,
            borderColor: theme.colors.border,
            padding: space[5],
            gap: space[4],
          }}
        >
          <View style={{ gap: space[2] }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
              <YellowSquare size={9} />
              <Caption color={theme.colors.accentText}>Tham gia lớp</Caption>
            </View>
            <ThemedText variant="titleLg">Nhập mã mời</ThemedText>
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
      </KeyboardAvoidingView>
    </View>
  )
}
