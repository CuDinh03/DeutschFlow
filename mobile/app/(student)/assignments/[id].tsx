import { useEffect, useRef, useState } from 'react'
import {
  Alert, KeyboardAvoidingView, Linking, Platform, Pressable, RefreshControl, ScrollView, View,
} from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { router, useLocalSearchParams } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import * as DocumentPicker from 'expo-document-picker'
import {
  useAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio'
import {
  AlertCircle, Camera, CheckCircle2, Clock, FileText, Image as ImageIcon, MessageSquare, Mic,
  Paperclip, Square, Upload, X,
} from 'lucide-react-native'
import { apiMessage } from '@/lib/api'
import { ensureAiConsent } from '@/lib/aiConsent'
import {
  fetchAssignmentDetail, submitAssignment, uploadAssignmentFile,
  MAX_UPLOAD_BYTES, type StudentAssignment, type UploadFile,
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
  const [file, setFile] = useState<UploadFile | null>(null)

  const submitMut = useMutation({
    // Upload the attachment (if any) to S3 first, then submit with its URL. isPending covers
    // both steps so the button shows a single loading state through upload + submit.
    mutationFn: async () => {
      const submissionFileUrl = file ? await uploadAssignmentFile(assignmentId, file) : undefined
      return submitAssignment(assignmentId, {
        submissionContent: content.trim() || undefined,
        submissionFileUrl,
      })
    },
    onSuccess: () => {
      // Refresh this screen + every class surface whose counts/score depend on it.
      void queryClient.invalidateQueries({ queryKey: ['assignment-detail', assignmentId] })
      void queryClient.invalidateQueries({ queryKey: ['class-assignments'] })
      void queryClient.invalidateQueries({ queryKey: ['class-detail'] })
      void queryClient.invalidateQueries({ queryKey: ['my-classes'] })
      setContent('')
      setFile(null)
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
              file={file}
              setFile={setFile}
              loading={submitMut.isPending}
              onSubmit={async () => {
                // 5.1.1(i): typed-text and document submissions have no capture-time consent gate,
                // and a prior grant may have been revoked — confirm before the submission is sent to
                // third-party AI grading. Instant no-op when consent is already granted.
                if (!(await ensureAiConsent())) return
                submitMut.mutate()
              }}
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
  content, setContent, file, setFile, loading, onSubmit,
}: {
  content: string
  setContent: (v: string) => void
  file: UploadFile | null
  setFile: (f: UploadFile | null) => void
  loading: boolean
  onSubmit: () => void
}) {
  const canSubmit = content.trim().length > 0 || file != null
  return (
    <View style={{ gap: space[3] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
        <YellowSquare size={8} />
        <Caption>Nộp bài làm</Caption>
      </View>
      <Card>
        <View style={{ gap: space[3] }}>
          <TextField
            label="Nội dung bài làm (không bắt buộc nếu đã đính kèm)"
            placeholder="Nhập bài viết của bạn vào đây…"
            value={content}
            onChangeText={setContent}
            multiline
            textAlignVertical="top"
            style={{ minHeight: 140 }}
            accessibilityLabel="Nội dung bài làm"
          />
          <AttachmentPicker file={file} setFile={setFile} disabled={loading} />
          <Button
            label={loading ? 'Đang nộp…' : 'Xác nhận nộp bài'}
            icon={CheckCircle2}
            loading={loading}
            disabled={!canSubmit}
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

// Attach an image (camera/library), a document (PDF/Word), or a voice recording, then upload on
// submit. expo-audio recording (HIGH_QUALITY) writes .m4a → audio/mp4-family, allow-listed backend.
const AUDIO_CONTENT_TYPE = 'audio/m4a'

function AttachmentPicker({
  file, setFile, disabled,
}: {
  file: UploadFile | null
  setFile: (f: UploadFile | null) => void
  disabled: boolean
}) {
  const c = useTheme().colors
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY)
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current) }, [])

  const oversize = () => Alert.alert('File quá lớn', 'Vui lòng chọn tệp dưới 10MB.')
  const tooBig = (size?: number) => size != null && size > MAX_UPLOAD_BYTES

  async function pickImage(fromCamera: boolean) {
    // 5.1.1(i): submitted photos are OCR'd/graded by a third-party AI — disclose & get consent first.
    if (!(await ensureAiConsent())) return
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      Alert.alert('Cần cấp quyền', fromCamera ? 'Hãy cho phép truy cập máy ảnh.' : 'Hãy cho phép truy cập ảnh.')
      return
    }
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.7 })
    if (result.canceled) return
    const asset = result.assets[0]
    if (tooBig(asset.fileSize)) return oversize()
    setFile({
      uri: asset.uri,
      name: asset.fileName ?? `anh-${asset.assetId ?? 'moi'}.jpg`,
      contentType: asset.mimeType ?? 'image/jpeg',
    })
  }

  async function pickDocument() {
    // 5.1.1(i): submitted documents are OCR'd/graded by a third-party AI — disclose & get consent first.
    if (!(await ensureAiConsent())) return
    const result = await DocumentPicker.getDocumentAsync({
      type: [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ],
      copyToCacheDirectory: true,
    })
    if (result.canceled) return
    const asset = result.assets[0]
    if (tooBig(asset.size ?? undefined)) return oversize()
    setFile({ uri: asset.uri, name: asset.name, contentType: asset.mimeType ?? 'application/pdf' })
  }

  async function startRecording() {
    // 5.1.1(i): the recording is transcribed/graded by a third-party AI — disclose & get consent first.
    if (!(await ensureAiConsent())) return
    const perm = await requestRecordingPermissionsAsync()
    if (!perm.granted) {
      Alert.alert('Cần quyền micro', 'Hãy cho phép truy cập micro để ghi âm.')
      return
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true })
    await recorder.prepareToRecordAsync()
    recorder.record()
    setSeconds(0)
    setRecording(true)
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000)
  }

  async function stopRecording() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    setRecording(false)
    try {
      await recorder.stop()
    } catch {
      Alert.alert('Lỗi ghi âm', 'Không lưu được bản ghi. Vui lòng thử lại.')
      return
    }
    const uri = recorder.uri
    if (!uri) return
    setFile({ uri, name: `ghi-am-${seconds || 1}s.m4a`, contentType: AUDIO_CONTENT_TYPE })
  }

  if (recording) {
    return (
      <View
        style={{
          flexDirection: 'row', alignItems: 'center', gap: space[3],
          backgroundColor: c.dangerSoft, borderRadius: radius.md, padding: space[3],
        }}
      >
        <Icon icon={Mic} size={16} color="danger" />
        <ThemedText variant="bodyStrong" style={{ flex: 1, color: c.danger }}>
          Đang ghi… {formatSeconds(seconds)}
        </ThemedText>
        <Button label="Dừng" variant="secondary" size="sm" icon={Square} fullWidth={false} onPress={() => void stopRecording()} />
      </View>
    )
  }

  if (file) {
    return (
      <View
        style={{
          flexDirection: 'row', alignItems: 'center', gap: space[3],
          backgroundColor: c.surfaceSunken, borderRadius: radius.md, padding: space[3],
        }}
      >
        <Icon icon={fileIcon(file.contentType)} size={18} color="accent" />
        <View style={{ flex: 1 }}>
          <ThemedText variant="bodyStrong" numberOfLines={1}>{file.name}</ThemedText>
          <ThemedText variant="caption" color="muted">{fileKindLabel(file.contentType)}</ThemedText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Xoá tệp đính kèm"
          disabled={disabled}
          onPress={() => setFile(null)}
          hitSlop={8}
        >
          <Icon icon={X} size={18} color="muted" />
        </Pressable>
      </View>
    )
  }

  return (
    <View style={{ gap: space[2] }}>
      <ThemedText variant="caption" color="muted">Đính kèm (không bắt buộc) · tối đa 10MB</ThemedText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
        <PickButton icon={Camera} label="Chụp ảnh" disabled={disabled} onPress={() => void pickImage(true)} />
        <PickButton icon={ImageIcon} label="Ảnh" disabled={disabled} onPress={() => void pickImage(false)} />
        <PickButton icon={Paperclip} label="File" disabled={disabled} onPress={() => void pickDocument()} />
        <PickButton icon={Mic} label="Ghi âm" disabled={disabled} onPress={() => void startRecording()} />
      </View>
    </View>
  )
}

function PickButton({
  icon, label, disabled, onPress,
}: {
  icon: typeof Camera; label: string; disabled: boolean; onPress: () => void
}) {
  return <Button label={label} icon={icon} variant="secondary" size="sm" fullWidth={false} disabled={disabled} onPress={onPress} />
}

function formatSeconds(s: number): string {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${String(sec).padStart(2, '0')}`
}

function fileIcon(contentType: string): typeof FileText {
  if (contentType.startsWith('image/')) return ImageIcon
  if (contentType.startsWith('audio/')) return Mic
  return FileText
}

function fileKindLabel(contentType: string): string {
  if (contentType.startsWith('image/')) return 'Ảnh'
  if (contentType.startsWith('audio/')) return 'Bản ghi âm'
  if (contentType === 'application/pdf') return 'PDF'
  if (contentType.includes('word')) return 'Tài liệu Word'
  return 'Tệp đính kèm'
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
