import { useState } from 'react'
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, RefreshControl, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { usePullRefresh } from '@/hooks/usePullRefresh'
import { router } from 'expo-router'
import { ChevronRight } from 'lucide-react-native'
import { apiMessage } from '@/lib/api'
import {
  fetchMyClasses, joinClassByInviteCode, type MyClassroom,
} from '@/lib/studentClassesApi'
import { fonts, radius, space, useTheme } from '@/lib/theme'
import {
  Button, Caption, Card, EmptyState, ErrorState, FadeIn, GaGlyph, Icon,
  ProgressBar, Screen, Skeleton, TextField, ThemedText, YellowSquare,
} from '@/components/ui'
import { MarkTitle, StatTriplet, TopBar } from '@/components/classroom/ClassroomParts'
import { formatAvgVi, percentLabel, shortDate } from '@/lib/classroomUi'
import { useBackTo } from '@/hooks/useBackTo'
import { PARENT_OF } from '@/lib/screenParents'

export default function StudentClassesIndex() {
  // Back tường minh về màn cha — Tabs firstRoute sẽ về Heute (xem lib/screenParents).
  const goBack = useBackTo(PARENT_OF['classes/index'])
  const theme = useTheme()
  const qc = useQueryClient()

  const [joinOpen, setJoinOpen] = useState(false)

  const { data: classes, isLoading, refetch, error } = useQuery({
    queryKey: ['my-classes'],
    queryFn: fetchMyClasses,
    staleTime: 30_000,
  })
  const pull = usePullRefresh(refetch)

  // Giao diện v3.4 (Đợt 6B, mẫu `classes`): nút back + "Tham gia lớp" mực, tiêu đề có vệt vàng,
  // mỗi lớp một thẻ lớn (ô glyph vàng, bộ ba số liệu, thanh tiến độ, bài mới nhất).
  const header = (
    <View style={{ paddingHorizontal: space[5], paddingTop: space[4], paddingBottom: space[2], gap: space[1] }}>
      <MarkTitle plain="Lớp" mark="của tôi" />
      <ThemedText variant="caption" color="muted" style={{ fontSize: 13 }}>
        {classes && classes.length > 0 ? `Đang tham gia ${classes.length} lớp` : 'Lớp bạn đã tham gia'}
      </ThemedText>
    </View>
  )

  return (
    <Screen>
      <TopBar
        onBack={goBack}
        right={
          <Button
            label="Tham gia lớp"
            size="sm"
            fullWidth={false}
            onPress={() => setJoinOpen(true)}
          />
        }
      />
      {header}

      {isLoading ? (
        <View style={{ paddingHorizontal: space[5], gap: space[3], paddingTop: space[2] }}>
          <Skeleton height={190} radius="lg" />
          <Skeleton height={190} radius="lg" />
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
            glyph="lophoc"
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
            paddingTop: space[3],
            paddingBottom: space[8],
            gap: space[3],
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={pull.refreshing}
              onRefresh={() => void pull.onRefresh()}
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
  const c = useTheme().colors
  const lessonPercent = classroom.lessonTotal > 0
    ? classroom.lessonCompleted / classroom.lessonTotal
    : 0
  const teachers = classroom.teachers.length > 0
    ? classroom.teachers.map((t) => t.displayName).join(', ')
    : 'Chưa có giáo viên'
  const due = shortDate(classroom.latestAssignmentDueDate)

  return (
    <Card
      onPress={() => router.push(`/(student)/classes/${classroom.id}` as never)}
      accessibilityLabel={`Mở lớp ${classroom.name}`}
      style={{ borderRadius: radius.xl, gap: space[3] }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: radius.md,
            backgroundColor: c.accent,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <GaGlyph name="lophoc" size={24} ink="onAccent" gold="ink" />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <ThemedText variant="title" numberOfLines={1}>
            {classroom.name}
          </ThemedText>
          <ThemedText variant="caption" color="muted" numberOfLines={1} style={{ fontSize: 13 }}>
            {teachers}
          </ThemedText>
        </View>
        <Icon icon={ChevronRight} size={18} color="faint" />
      </View>

      <StatTriplet
        cells={[
          { value: String(classroom.assignmentCount), label: 'Bài tập' },
          { value: String(classroom.pendingCount), label: 'Chưa nộp', tone: classroom.pendingCount > 0 ? 'danger' : undefined },
          { value: formatAvgVi(classroom.avgScore), label: 'Điểm TB' },
        ]}
      />

      {classroom.lessonTotal > 0 && (
        <View style={{ gap: space[2] }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <ThemedText variant="caption" color="muted" style={{ fontSize: 13 }}>Tiến độ lớp</ThemedText>
            <ThemedText variant="label">
              {`${classroom.lessonCompleted}/${classroom.lessonTotal} buổi · ${percentLabel(classroom.lessonCompleted, classroom.lessonTotal)}`}
            </ThemedText>
          </View>
          <ProgressBar value={lessonPercent} />
        </View>
      )}

      {classroom.latestAssignmentTopic && (
        <ThemedText variant="caption" color="muted" numberOfLines={2} style={{ fontSize: 13 }}>
          {'Bài mới nhất: '}
          <ThemedText variant="caption" style={{ fontSize: 13, fontFamily: fonts.bodySemi }}>
            {classroom.latestAssignmentTopic}
          </ThemedText>
          {due ? ` · hạn ${due}` : ''}
        </ThemedText>
      )}
    </Card>
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
