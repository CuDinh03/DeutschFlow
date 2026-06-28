import { useState } from 'react'
import {
  Alert, KeyboardAvoidingView, Linking, Platform, RefreshControl, ScrollView, View,
} from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { router, useLocalSearchParams } from 'expo-router'
import {
  AlertCircle, CheckCircle2, Clock, FileText, Globe, MessageSquare, Upload,
} from 'lucide-react-native'
import { apiMessage } from '@/lib/api'
import {
  fetchAssignmentDetail, submitAssignment, type StudentAssignment,
} from '@/lib/studentClassesApi'
import { radius, space, useTheme } from '@/lib/theme'
import {
  AppHeader, Button, Caption, Card, ErrorState, Icon, Pill, ProgressRing,
  Screen, Skeleton, TextField, ThemedText, YellowSquare,
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
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: space[5], paddingBottom: space[8], gap: space[5] }}
          refreshControl={<RefreshControl refreshing={detailQ.isRefetching} onRefresh={() => void detailQ.refetch()} />}
          keyboardShouldPersistTaps="handled"
        >
          <StatusRow assignment={a} />
          {isGraded(a.status) && <GradedHero assignment={a} />}
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
      </KeyboardAvoidingView>
    </Screen>
  )
}

// Status chip on the left, due date on the right — the reference's top meta row.
function StatusRow({ assignment: a }: { assignment: StudentAssignment }) {
  const c = useTheme().colors
  return (
    <View style={{ gap: space[3], paddingTop: space[1] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3] }}>
        <StatusPill status={a.status} score={a.teacherScore} />
        {a.dueDate && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] }}>
            <Icon icon={Clock} size={12} color="muted" />
            <ThemedText variant="caption" color="secondary">
              Hạn {new Date(a.dueDate).toLocaleDateString('vi-VN')}
            </ThemedText>
          </View>
        )}
      </View>
      <View style={{ height: 1, backgroundColor: c.border }} />
    </View>
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

// Editorial ink hero for the graded result — the screen's primary metric.
function GradedHero({ assignment: a }: { assignment: StudentAssignment }) {
  const c = useTheme().colors
  const score = a.teacherScore ?? 0
  const verdict = score >= 85 ? 'Rất tốt' : score >= 70 ? 'Đạt yêu cầu' : 'Cần cố gắng'
  return (
    <Card style={{ backgroundColor: c.inkSurface, borderColor: c.inkSurface }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[5] }}>
        <View style={{ width: 84, height: 84, alignItems: 'center', justifyContent: 'center' }}>
          <ProgressRing
            value={score / 100}
            size={84}
            strokeWidth={7}
            color={c.accent}
            trackColor={c.onInkMuted}
          />
          <View style={{ position: 'absolute', alignItems: 'center' }}>
            <ThemedText variant="monoLg" style={{ color: c.onInk, lineHeight: 26 }}>
              {a.teacherScore != null ? String(a.teacherScore) : '—'}
            </ThemedText>
            <ThemedText variant="caption" style={{ color: c.onInkMuted, fontSize: 9, lineHeight: 11 }}>
              /100
            </ThemedText>
          </View>
        </View>
        <View style={{ flex: 1, gap: space[1] }}>
          <Caption color={c.accent}>Đã chấm</Caption>
          <ThemedText variant="titleLg" style={{ color: c.onInk }}>
            {verdict}
          </ThemedText>
          {a.submittedAt && (
            <ThemedText variant="caption" style={{ color: c.onInkMuted }}>
              Nộp lúc {new Date(a.submittedAt).toLocaleString('vi-VN')}
            </ThemedText>
          )}
        </View>
      </View>
    </Card>
  )
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
    <View style={{ gap: space[3] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
        <YellowSquare size={8} />
        <Caption>Đề bài</Caption>
      </View>
      <Card>
        <View style={{ gap: space[3] }}>
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
    </View>
  )
}

function SubmitForm({
  content, setContent, loading, onSubmit,
}: {
  content: string; setContent: (v: string) => void; loading: boolean; onSubmit: () => void
}) {
  const c = useTheme().colors
  return (
    <View style={{ gap: space[3] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
        <YellowSquare size={8} />
        <Caption>Nộp bài làm</Caption>
      </View>
      <Card>
        <View style={{ gap: space[3] }}>
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
              backgroundColor: c.surfaceSunken, borderRadius: radius.md, padding: space[3],
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
          <ThemedText variant="caption" color="muted" align="center">
            Sau khi nộp sẽ không sửa lại được
          </ThemedText>
        </View>
      </Card>
    </View>
  )
}

function SpeakingNotice() {
  const c = useTheme().colors
  return (
    <Card tone="sunken">
      <View style={{ gap: space[3], alignItems: 'center', paddingVertical: space[3] }}>
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: radius.md,
            backgroundColor: c.accentSoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon icon={MessageSquare} size={26} color="accent" />
        </View>
        <ThemedText variant="title" align="center">Bài tập Luyện Nói AI</ThemedText>
        <ThemedText variant="caption" color="secondary" align="center">
          Hãy mở ứng dụng web để thực hiện bài Luyện nói AI này — điểm sẽ tự đồng bộ với giáo viên.
        </ThemedText>
      </View>
    </Card>
  )
}

function SubmissionView({ assignment: a }: { assignment: StudentAssignment }) {
  const c = useTheme().colors
  const openFile = async () => {
    if (!a.submissionFileUrl) return
    try {
      await Linking.openURL(a.submissionFileUrl)
    } catch {
      Alert.alert('Không mở được file đã nộp')
    }
  }
  return (
    <View style={{ gap: space[5] }}>
      <View style={{ gap: space[3] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
          <Icon icon={CheckCircle2} size={14} color="success" />
          <Caption>Bài đã nộp</Caption>
        </View>
        <Card>
          <View style={{ gap: space[3] }}>
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
      </View>

      {isGraded(a.status) && (
        <View style={{ gap: space[3] }}>
          <Caption>{a.status === 'GRADED' ? 'Đánh giá từ AI' : 'Nhận xét từ giáo viên'}</Caption>
          <Card style={{ borderLeftWidth: 3, borderLeftColor: c.success }}>
            <View style={{ gap: space[2] }}>
              {a.teacherScore != null ? (
                <ThemedText variant="bodyStrong" color="success">{`${a.teacherScore}/100`}</ThemedText>
              ) : null}
              <ThemedText variant="body" color="secondary">
                {a.teacherFeedback || 'Không có nhận xét bổ sung.'}
              </ThemedText>
            </View>
          </Card>
        </View>
      )}
    </View>
  )
}
