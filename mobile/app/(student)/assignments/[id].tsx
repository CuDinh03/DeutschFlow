import { useEffect, useRef, useState } from 'react'
import type { GlyphName } from '@/lib/galerieGlyphs'
import {
  Alert, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, View,
} from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { router, useLocalSearchParams, type Href } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import * as DocumentPicker from 'expo-document-picker'
import * as WebBrowser from 'expo-web-browser'
import {
  useAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio'
import { ExternalLink, FileText, Image as ImageIcon, Link2, Mic, Music, Square, Video as VideoIcon, X, RotateCcw } from 'lucide-react-native'
import { apiMessage } from '@/lib/api'
import { usePullRefresh } from '@/hooks/usePullRefresh'
import { ensureAiConsent } from '@/lib/aiConsent'
import { presentMinorAudioBlocked } from '@/lib/minorAudio'
import {
  assignmentStatusView, fetchAssignmentDetail, fetchAssignmentMaterials, fetchAssignmentMaterialUrl, GRADING_FAILED_LABEL, isAwaitingTeacher, isFinalGrade, isSubmittedStatus, submitAssignment, uploadAssignmentFile, MAX_UPLOAD_BYTES, type AssignmentMaterial, type MaterialKind, type StudentAssignment, type UploadFile, fetchAssignmentScenario, scenarioTopic,
} from '@/lib/studentClassesApi'
import { useRecorderBlurGuard } from '@/hooks/useRecorderBlurGuard'
import { radius, space, useTheme } from '@/lib/theme'
import {
  Button, Card, ErrorState, GaGlyph, Icon, ProgressRing, Screen, Skeleton, TextField, ThemedText,
} from '@/components/ui'
import { Chip, Eyebrow, ListBlock, StatusBadge, TopBar, listRowStyle, type BadgeTone } from '@/components/classroom/ClassroomParts'
import { assignmentTypeLabel, clockLabel, shortDate } from '@/lib/classroomUi'
import { useBackTo } from '@/hooks/useBackTo'

// Giao diện v3.4 (Đợt 6B, mẫu `assign`): thanh đầu "Chi tiết bài tập", hàng nhãn loại + trạng thái +
// hạn nộp, tên bài lớn, thẻ "Đề bài", khối nộp bài với chip đính kèm. Logic nộp/nộp lại/ghi âm giữ nguyên.
const typeLabel = assignmentTypeLabel

// Phân loại trạng thái dùng chung với classes/[id].tsx — định nghĩa + lý do ở
// lib/studentClassesApi.ts (gương AssignmentStatus.java backend, F-14 soát 02/09).
const isGraded = isFinalGrade
/**
 * Nộp lại được chừng nào giáo viên CHƯA chốt điểm. AI_GRADED nằm trong nhóm này: AI mới đề xuất điểm
 * và học viên chưa hề thấy nó. Backend trước đây chặn mọi trạng thái khác PENDING, nên chọn nhầm ảnh
 * hay thu âm hỏng là vĩnh viễn — không có đường rút hay thay bài nộp.
 */
const canResubmit = isAwaitingTeacher
const isSubmitted = isSubmittedStatus

const MATERIAL_KIND_ICON: Record<MaterialKind, typeof FileText> = {
  PDF: FileText, DOCX: FileText, PPTX: FileText, OTHER: FileText,
  IMAGE: ImageIcon, AUDIO: Music, VIDEO: VideoIcon, LINK: Link2,
}

/**
 * Open a document/URL INSIDE the app (SFSafariViewController / Chrome Custom Tab) instead of handing
 * off to the external browser — the student reads it without leaving the app and without a manual
 * download. PDFs and images render inline in the in-app browser.
 */
async function openInApp(url: string, errMsg = 'Không mở được tài liệu') {
  try {
    await WebBrowser.openBrowserAsync(url)
  } catch {
    Alert.alert(errMsg)
  }
}

export default function AssignmentDetail() {
  // Màn sống trong Tabs nên KHÔNG unmount khi đổi tham số: mở sang id khác vẫn là bản thể cũ,
  // giữ nguyên state (nháp, câu trả lời, điểm, tệp đính kèm) của lần trước. Remount theo key
  // giống mẫu ở skill-practice.tsx.
  const { id } = useLocalSearchParams<{ id: string }>()
  return <AssignmentDetailRunner key={id ?? 'none'} />
}

function AssignmentDetailRunner() {
  const { id, classId } = useLocalSearchParams<{ id: string; classId?: string }>()
  // Back tường minh về màn cha — Tabs firstRoute sẽ về Heute (xem lib/screenParents).
  // classId có khi mở từ trang lớp; từ thông báo / sau phiên nói thì về danh sách lớp.
  const goBack = useBackTo(() => (classId ? { pathname: '/(student)/classes/[id]', params: { id: classId } } : '/(student)/classes'))
  const assignmentId = Number(id)
  const queryClient = useQueryClient()

  // V-07: kèm classId để hàm gọi đúng endpoint theo LỚP thay vì tải toàn bộ bài của mọi lớp rồi
  // lọc — classId nằm sẵn trong params của route này (màn lớp luôn truyền sang).
  const classIdNum = Number(classId)
  const detailQ = useQuery({
    queryKey: ['assignment-detail', assignmentId, Number.isFinite(classIdNum) ? classIdNum : null],
    queryFn: () => fetchAssignmentDetail(assignmentId, Number.isFinite(classIdNum) ? classIdNum : undefined),
    enabled: Number.isFinite(assignmentId),
    staleTime: 30_000,
  })
  const pull = usePullRefresh(detailQ.refetch)

  const [content, setContent] = useState('')
  const [file, setFile] = useState<UploadFile | null>(null)
  /** Mở lại ô soạn để nộp bản khác đè lên bản đã nộp. */
  const [resubmitting, setResubmitting] = useState(false)

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
      setResubmitting(false)
    },
    onError: (e) => {
      // 403 MINOR_AUDIO_BLOCKED từ presigned-url (tệp ghi âm, D8): sheet giải thích thay Alert chung.
      if (presentMinorAudioBlocked(e)) return
      Alert.alert('Nộp bài thất bại', apiMessage(e))
    },
  })

  if (detailQ.isLoading) {
    return (
      <Screen>
        <TopBar title="Chi tiết bài tập" subtitle="Đang tải bài tập…" onBack={goBack} />
        <View style={{ paddingHorizontal: space[5], gap: space[3], paddingTop: space[4] }}>
          <Skeleton height={120} radius="lg" />
          <Skeleton height={160} radius="lg" />
        </View>
      </Screen>
    )
  }
  if (detailQ.error || !detailQ.data) {
    return (
      <Screen>
        <TopBar title="Chi tiết bài tập" onBack={goBack} />
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
  const showForm = pending || resubmitting

  return (
    <Screen>
      <TopBar title="Chi tiết bài tập" onBack={goBack} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: space[5], paddingTop: space[4], paddingBottom: space[8], gap: space[5] }}
          refreshControl={<RefreshControl refreshing={pull.refreshing} onRefresh={() => void pull.onRefresh()} />}
          keyboardShouldPersistTaps="handled"
        >
          <StatusRow assignment={a} />
          {isGraded(a.status) && <GradedHero assignment={a} />}
          <DescriptionCard assignment={a} />
          <MaterialsCard assignmentId={assignmentId} />

          {showForm && speaking && <SpeakingStart assignment={a} />}
          {showForm && !speaking && (
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
          {!showForm && (
            <SubmissionView
              assignment={a}
              onResubmit={canResubmit(a.status) ? () => {
                // Mở lại ô soạn với chính nội dung đã nộp, để sửa chứ không phải gõ lại từ đầu.
                setContent(a.submissionContent ?? '')
                setFile(null)
                setResubmitting(true)
              } : undefined}
            />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  )
}

// Hàng nhãn (`.badge` loại bài + trạng thái) và hạn nộp ở trên, tên bài lớn ở dưới (mẫu `assign`).
function StatusRow({ assignment: a }: { assignment: StudentAssignment }) {
  const status = statusBadge(a.status, a.teacherScore)
  const due = shortDate(a.dueDate)
  const dueClock = clockLabel(a.dueDate)
  return (
    <View style={{ gap: space[2] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space[1] + 2 }}>
        <StatusBadge label={typeLabel(a.assignmentType)} />
        <StatusBadge label={status.label} tone={status.tone} />
        <View style={{ flex: 1 }} />
        {due ? (
          <ThemedText variant="caption" color="muted" style={{ fontSize: 13 }}>
            {`Hạn ${due}${dueClock ? ` · ${dueClock}` : ''}`}
          </ThemedText>
        ) : null}
      </View>
      <ThemedText variant="titleLg" accessibilityRole="header">{a.topic || 'Bài tập'}</ThemedText>
    </View>
  )
}

function statusBadge(status: string, score: number | null): { label: string; tone: BadgeTone } {
  // Phân loại dùng CHUNG với màn danh sách bài của lớp (assignmentStatusView) — V-12c.
  switch (assignmentStatusView(status)) {
    case 'graded':
      return { label: `Đã chấm${score != null ? ` · ${score}/100` : ''}`, tone: 'success' }
    case 'gradingFailed':
      // Đã nộp NHƯNG khâu chấm chết — gộp vào "Đã nộp" là giấu mất chuyện bài chưa được chấm.
      return { label: GRADING_FAILED_LABEL, tone: 'danger' }
    case 'awaitingTeacher':
      // AI_GRADED hiển thị y như SUBMITTED: backend cố ý không công bố khâu chấm AI cho học viên.
      return { label: 'Đã nộp', tone: 'info' }
    default:
      return { label: 'Chưa nộp', tone: 'danger' }
  }
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
          <ThemedText variant="label" style={{ color: c.accent, letterSpacing: 1, textTransform: 'uppercase', fontSize: 11.5 }}>Đã chấm</ThemedText>
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
    await openInApp(a.attachmentUrl, 'Không mở được tài liệu đính kèm')
  }
  return (
    <Card style={{ gap: space[2] }}>
      <Eyebrow>Đề bài</Eyebrow>
      <ThemedText variant="body">
        {a.description || 'Không có mô tả chi tiết.'}
      </ThemedText>
      {a.attachmentUrl && (
        <View style={{ flexDirection: 'row', marginTop: space[2] }}>
          <Chip
            label="Xem tài liệu đính kèm"
            leading={<Icon icon={FileText} size={16} color="secondary" />}
            onPress={() => void openAttachment()}
          />
        </View>
      )}
    </Card>
  )
}

/**
 * Library materials the teacher handed out with this assignment. Tapping one opens it in the in-app
 * browser (read without leaving the app / manual download). Hidden entirely when the assignment has
 * none. The list `url` is a presigned GET (~1h) so we re-sign right before opening.
 */
function MaterialsCard({ assignmentId }: { assignmentId: number }) {
  const c = useTheme().colors
  const [opening, setOpening] = useState<number | null>(null)
  const materialsQ = useQuery({
    queryKey: ['assignment-materials', assignmentId],
    queryFn: () => fetchAssignmentMaterials(assignmentId),
    enabled: Number.isFinite(assignmentId),
    staleTime: 60_000,
  })

  const open = async (m: AssignmentMaterial) => {
    setOpening(m.id)
    try {
      const fresh = await fetchAssignmentMaterialUrl(assignmentId, m.id)
      await openInApp(fresh)
    } catch (e) {
      // R-M10: message-as-title — Alert.alert(title, message). Trước đây chuỗi lỗi bị nhét làm
      // TIÊU ĐỀ (đậm, không body), còn tiêu đề thật thì mất.
      Alert.alert('Không mở được tài liệu', apiMessage(e))
    } finally {
      setOpening(null)
    }
  }

  const items = materialsQ.data ?? []
  // Nothing to show until we know there's at least one material (keeps the layout clean when empty).
  if (items.length === 0) return null

  return (
    <View style={{ gap: space[2] }}>
      <Eyebrow>Tài liệu được giao</Eyebrow>
      <ListBlock>
        {items.map((m, i) => {
          const KindIcon = MATERIAL_KIND_ICON[m.kind] ?? FileText
          const busy = opening === m.id
          return (
            <Pressable
              key={m.id}
              onPress={() => void open(m)}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={`Mở tài liệu ${m.title}`}
              accessibilityState={{ busy, disabled: busy }}
              style={({ pressed }) => listRowStyle(c.border, i === 0, {
                backgroundColor: pressed ? c.surfaceSunken : 'transparent',
                opacity: busy ? 0.6 : 1,
              })}
            >
              <View style={{ width: 36, height: 36, borderRadius: radius.sm, backgroundColor: c.surfaceSunken, alignItems: 'center', justifyContent: 'center' }}>
                <Icon icon={KindIcon} size={16} color="secondary" />
              </View>
              <ThemedText variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
                {m.title}
              </ThemedText>
              <ThemedText variant="caption" color="muted">{m.kind}</ThemedText>
              <Icon icon={ExternalLink} size={14} color="muted" />
            </Pressable>
          )
        })}
      </ListBlock>
      <ThemedText variant="caption" color="muted">
        Chạm để mở đọc ngay trong ứng dụng.
      </ThemedText>
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
      <ThemedText variant="bodyStrong" accessibilityRole="header">Nộp bài làm</ThemedText>
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
          glyph="hoanthanh"
          loading={loading}
          disabled={!canSubmit}
          onPress={onSubmit}
        />
        {/* V-12c: câu cũ ("Sau khi nộp sẽ không sửa lại được") NGƯỢC với chính màn này — ngay
            dưới bài đã nộp có nút "Nộp lại" — và ngược với backend: isAwaitingTeacher
            (SUBMITTED/AI_GRADED/GRADING_FAILED) vẫn cho nộp đè cho tới khi giáo viên chốt điểm. */}
        <ThemedText variant="caption" color="muted" align="center">
          Nộp xong bạn vẫn nộp lại được cho tới khi giáo viên chấm
        </ThemedText>
      </View>
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

  // Rời màn giữa lúc ghi âm → dừng mic + thoát record mode (F-9/F-11 soát 02/09).
  // Bản ghi dở bị bỏ; timer đếm giây phải dừng theo kẻo UI kẹt "Đang ghi…".
  useRecorderBlurGuard(recorder, () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    setRecording(false)
  })

  const oversize = () => Alert.alert('Tệp quá lớn', 'Vui lòng chọn tệp dưới 10MB.')
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
    } finally {
      // Audio mode là cấu hình toàn app: quên thoát record mode ở đây làm mọi
      // phát lại sau đó (TTS từ vựng, video bài học) ra loa trong rất nhỏ (F-11).
      void setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {})
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
        <GaGlyph name="speaking" size={16} ink="danger" gold="danger" />
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
      <ThemedText variant="caption" color="muted" style={{ fontSize: 13 }}>Đính kèm (không bắt buộc) · tối đa 10MB</ThemedText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
        <PickChip glyph="camera" label="Chụp ảnh" disabled={disabled} onPress={() => void pickImage(true)} />
        <PickChip icon={ImageIcon} label="Ảnh" disabled={disabled} onPress={() => void pickImage(false)} />
        <PickChip icon={FileText} label="Tệp" disabled={disabled} onPress={() => void pickDocument()} />
        <PickChip glyph="speaking" label="Ghi âm" disabled={disabled} onPress={() => void startRecording()} />
      </View>
    </View>
  )
}

function PickChip({
  icon, glyph, label, disabled, onPress,
}: {
  icon?: typeof FileText; glyph?: GlyphName; label: string; disabled: boolean; onPress: () => void
}) {
  const leading = glyph
    ? <GaGlyph name={glyph} size={16} ink="secondary" />
    : icon ? <Icon icon={icon} size={16} color="secondary" /> : null
  return <Chip label={label} leading={leading} disabled={disabled} onPress={onPress} />
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

/**
 * N2 (đợt 2, 05/09): bài giao SPEAKING_SCENARIO làm NGAY trong app — trước đây màn này chỉ
 * bảo "mở ứng dụng web". Gương web classes/[id]/assignments/[aid]: lấy kịch bản
 * (GET …/{assignmentId}/scenario, id bài của LỚP) → mở màn Speaking với phiên LESSON gắn
 * `assignmentId` = id DÒNG BÀI của học viên (a.id). Kết thúc buổi nói, backend tự chấm và
 * đẩy bài sang chờ giáo viên (AI_GRADED / GRADING_FAILED) — không có bước "nộp" riêng.
 */
function SpeakingStart({ assignment: a }: { assignment: StudentAssignment }) {
  const c = useTheme().colors
  const [busy, setBusy] = useState(false)
  async function start() {
    if (busy) return
    setBusy(true)
    try {
      const sc = await fetchAssignmentScenario(a.assignmentId)
      router.push({
        pathname: '/(student)/speaking',
        params: {
          assignmentId: String(a.id),
          backTo: String(a.assignmentId),
          topic: scenarioTopic(sc),
          level: sc.level || 'A2',
          // nonce: mở lại cùng bài lần sau vẫn tự bắt đầu phiên mới (speaking.tsx khoá theo key này)
          t: String(Date.now()),
        },
      } as unknown as Href)
    } catch (e) {
      Alert.alert('Chưa mở được bài nói', apiMessage(e))
    } finally {
      setBusy(false)
    }
  }
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
          <GaGlyph name="hoithoai" size={26} ink="primary" />
        </View>
        <ThemedText variant="title" align="center">Bài tập Luyện Nói AI</ThemedText>
        <ThemedText variant="caption" color="secondary" align="center">
          Trò chuyện với gia sư AI theo tình huống giáo viên giao. Kết thúc buổi nói là bài được nộp và chấm tự động; giáo viên xác nhận điểm sau.
        </ThemedText>
        <View style={{ alignSelf: 'stretch', paddingTop: space[1] }}>
          <Button label="Bắt đầu bài nói" onPress={() => void start()} loading={busy} />
        </View>
      </View>
    </Card>
  )
}

function SubmissionView({ assignment: a, onResubmit }: { assignment: StudentAssignment; onResubmit?: () => void }) {
  const c = useTheme().colors
  const openFile = async () => {
    if (!a.submissionFileUrl) return
    await openInApp(a.submissionFileUrl, 'Không mở được file đã nộp')
  }
  return (
    <View style={{ gap: space[5] }}>
      <View style={{ gap: space[3] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
          <GaGlyph name="hoanthanh" size={14} ink="success" gold="success" />
          <Eyebrow>Bài đã nộp</Eyebrow>
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
            {onResubmit && (
              <>
                <Button label="Nộp lại" variant="ghost" size="sm" icon={RotateCcw} fullWidth={false} onPress={onResubmit} />
                <ThemedText variant="caption" color="muted">
                  Nộp nhầm bài? Bạn vẫn nộp lại được cho tới khi giáo viên chấm.
                </ThemedText>
              </>
            )}
          </View>
        </Card>
      </View>

      {isGraded(a.status) && (
        <View style={{ gap: space[3] }}>
          <Eyebrow>{a.status === 'GRADED' ? 'Đánh giá từ AI' : 'Nhận xét từ giáo viên'}</Eyebrow>
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
