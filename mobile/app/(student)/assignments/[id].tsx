import { useState } from 'react'
import { Alert, Linking, RefreshControl, ScrollView, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { router, useLocalSearchParams } from 'expo-router'
import {
  AlertCircle, BookOpen, CheckCircle2, Clock, FileText, Globe, MessageSquare, Upload,
} from 'lucide-react-native'
import { apiMessage } from '@/lib/api'
import {
  fetchAssignmentDetail, submitAssignment, type StudentAssignment,
} from '@/lib/studentClassesApi'
import { radius, space, useTheme } from '@/lib/theme'
import {
  AppHeader, Button, Card, ErrorState, Icon, Pill, Screen, Skeleton, TextField, ThemedText,
} from '@/components/ui'

const TYPE_LABELS: Record<string, string> = {
  ESSAY: 'Viết luận',
  MOCK_TEST: 'Thi thử',
  SPEAKING_SCENARIO: 'Luyện Nói AI',
}
const typeLabel = (t: string) => TYPE_LABELS[t] ?? 'Bài tập chung'

const isGraded = (status: string) => status === 'GRADED' || status === 'EVALUATED'
const isSubmitted = (status: string) => status === 'SUBMITTED' || isGraded(status)

export default function AssignmentDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const assignmentId = Number(id)
  const queryClient = useQueryClient()

  const detailQ = useQuery({
    queryKey: ['assignment-detail', assignmentId],
    queryFn: () => fetchAssignmentDetail(assignmentId),
    enabled: Number.isFinite(assignmentId),
    staleTime: 30_000,
  })

  const [content, setContent] = useState('')

  const submitMut = useMutation({
    mutationFn: () => submitAssignment(assignmentId, { submissionContent: content.trim() }),
    onSuccess: () => {
      // Refresh this screen + every class surface whose counts/score depend on it.
      void queryClient.invalidateQueries({ queryKey: ['assignment-detail', assignmentId] })
      void queryClient.invalidateQueries({ queryKey: ['class-assignments'] })
      void queryClient.invalidateQueries({ queryKey: ['class-detail'] })
      void queryClient.invalidateQueries({ queryKey: ['my-classes'] })
      setContent('')
    },
    onError: (e) => Alert.alert('Nộp bài thất bại', apiMessage(e)),
  })

  if (detailQ.isLoading) {
    return (
      <Screen>
        <AppHeader title="Đang tải bài tập…" onBack={() => router.back()} />
        <View style={{ paddingHorizontal: space[5], gap: space[3] }}>
          <Skeleton height={120} />
          <Skeleton height={160} />
        </View>
      </Screen>
    )
  }
  if (detailQ.error || !detailQ.data) {
    return (
      <Screen>
        <AppHeader title="Không mở được bài tập" onBack={() => router.back()} />
        <ErrorState
          message={detailQ.error ? apiMessage(detailQ.error) : 'Không tìm thấy bài tập này.'}
          onRetry={() => void detailQ.refetch()}
        />
      </Screen>
    )
  }

  const a = detailQ.data
  const pending = a.status === 'PENDING'
  const speaking = a.assignmentType === 'SPEAKING_SCENARIO'

  return (
    <Screen>
      <AppHeader title={a.topic || 'Chi tiết bài tập'} subtitle={typeLabel(a.assignmentType)} onBack={() => router.back()} />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space[5], paddingBottom: space[8], gap: space[4] }}
        refreshControl={<RefreshControl refreshing={detailQ.isRefetching} onRefresh={() => void detailQ.refetch()} />}
        keyboardShouldPersistTaps="handled"
      >
        <MetaCard assignment={a} />
        <DescriptionCard assignment={a} />

        {pending && speaking && <SpeakingNotice />}
        {pending && !speaking && (
          <SubmitForm
            content={content}
            setContent={setContent}
            loading={submitMut.isPending}
            onSubmit={() => submitMut.mutate()}
          />
        )}
        {!pending && <SubmissionView assignment={a} />}
      </ScrollView>
    </Screen>
  )
}

function MetaCard({ assignment: a }: { assignment: StudentAssignment }) {
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[3] }}>
        <View style={{ flex: 1, gap: space[2] }}>
          <Pill tone="accent" label={typeLabel(a.assignmentType)} />
          {a.dueDate && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] }}>
              <Icon icon={Clock} size={12} color="muted" />
              <ThemedText variant="caption" color="secondary">
                Hạn nộp {new Date(a.dueDate).toLocaleString('vi-VN')}
              </ThemedText>
            </View>
          )}
        </View>
        <StatusPill status={a.status} score={a.teacherScore} />
      </View>
    </Card>
  )
}

function StatusPill({ status, score }: { status: string; score: number | null }) {
  if (isGraded(status)) {
    return <Pill tone="success" icon={CheckCircle2} label={`Đã chấm${score != null ? ` · ${score}/100` : ''}`} />
  }
  if (status === 'SUBMITTED') {
    return <Pill tone="info" icon={Upload} label="Đã nộp" />
  }
  return <Pill tone="danger" icon={AlertCircle} label="Chưa nộp" />
}

function DescriptionCard({ assignment: a }: { assignment: StudentAssignment }) {
  const openAttachment = async () => {
    if (!a.attachmentUrl) return
    try {
      await Linking.openURL(a.attachmentUrl)
    } catch {
      Alert.alert('Không mở được tài liệu đính kèm')
    }
  }
  return (
    <Card>
      <View style={{ gap: space[2] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
          <Icon icon={BookOpen} size={16} color="accent" />
          <ThemedText variant="bodyStrong">Yêu cầu đề bài</ThemedText>
        </View>
        <ThemedText variant="body" color="secondary">
          {a.description || 'Không có mô tả chi tiết.'}
        </ThemedText>
        {a.attachmentUrl && (
          <Button
            label="Xem tài liệu đính kèm"
            variant="ghost"
            size="sm"
            icon={FileText}
            fullWidth={false}
            onPress={openAttachment}
          />
        )}
      </View>
    </Card>
  )
}

function SubmitForm({
  content, setContent, loading, onSubmit,
}: {
  content: string; setContent: (v: string) => void; loading: boolean; onSubmit: () => void
}) {
  const theme = useTheme()
  return (
    <Card>
      <View style={{ gap: space[3] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
          <Icon icon={Upload} size={16} color="accent" />
          <ThemedText variant="bodyStrong">Nộp bài làm</ThemedText>
        </View>
        <TextField
          label="Nội dung bài làm"
          placeholder="Nhập bài viết của bạn vào đây…"
          value={content}
          onChangeText={setContent}
          multiline
          textAlignVertical="top"
          style={{ minHeight: 160 }}
          accessibilityLabel="Nội dung bài làm"
        />
        <View
          style={{
            flexDirection: 'row', alignItems: 'center', gap: space[2],
            backgroundColor: theme.colors.surfaceSunken, borderRadius: radius.md, padding: space[3],
          }}
        >
          <Icon icon={Globe} size={14} color="muted" />
          <ThemedText variant="caption" color="secondary" style={{ flex: 1 }}>
            Đính kèm file (PDF, Word) hiện hỗ trợ trên ứng dụng web.
          </ThemedText>
        </View>
        <Button
          label="Xác nhận nộp bài"
          icon={CheckCircle2}
          loading={loading}
          disabled={content.trim().length === 0}
          onPress={onSubmit}
        />
      </View>
    </Card>
  )
}

function SpeakingNotice() {
  return (
    <Card tone="sunken">
      <View style={{ gap: space[2], alignItems: 'center', paddingVertical: space[2] }}>
        <Icon icon={MessageSquare} size={28} color="accent" />
        <ThemedText variant="bodyStrong">Bài tập Luyện Nói AI</ThemedText>
        <ThemedText variant="caption" color="secondary" style={{ textAlign: 'center' }}>
          Hãy mở ứng dụng web để thực hiện bài Luyện nói AI này — điểm sẽ tự đồng bộ với giáo viên.
        </ThemedText>
      </View>
    </Card>
  )
}

function SubmissionView({ assignment: a }: { assignment: StudentAssignment }) {
  const openFile = async () => {
    if (!a.submissionFileUrl) return
    try {
      await Linking.openURL(a.submissionFileUrl)
    } catch {
      Alert.alert('Không mở được file đã nộp')
    }
  }
  return (
    <View style={{ gap: space[4] }}>
      <Card>
        <View style={{ gap: space[2] }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
            <Icon icon={CheckCircle2} size={16} color="success" />
            <ThemedText variant="bodyStrong">Bài làm đã nộp</ThemedText>
          </View>
          {a.submissionContent ? (
            <ThemedText variant="body" color="secondary">{a.submissionContent}</ThemedText>
          ) : null}
          {a.submissionFileUrl && (
            <Button label="Xem file đã nộp" variant="ghost" size="sm" icon={FileText} fullWidth={false} onPress={openFile} />
          )}
          {a.submittedAt && (
            <ThemedText variant="caption" color="muted">
              Nộp lúc {new Date(a.submittedAt).toLocaleString('vi-VN')}
            </ThemedText>
          )}
        </View>
      </Card>

      {isGraded(a.status) && (
        <Card>
          <View style={{ gap: space[2] }}>
            <ThemedText variant="bodyStrong" color="success">
              {a.status === 'GRADED' ? 'Đánh giá từ AI' : 'Nhận xét từ giáo viên'}
              {a.teacherScore != null ? ` · ${a.teacherScore}/100` : ''}
            </ThemedText>
            <ThemedText variant="body" color="secondary">
              {a.teacherFeedback || 'Không có nhận xét bổ sung.'}
            </ThemedText>
          </View>
        </Card>
      )}
    </View>
  )
}
