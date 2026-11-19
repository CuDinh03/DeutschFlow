// Phần dựng một Teil của đề (câu hỏi, kho lựa chọn, bài đọc, bài nghe, bài viết) — tách ra từ màn
// thi thử `exam-attempt.tsx` (19/11/2026) để màn luyện từng Teil (`exam-teil.tsx`) và bài chẩn đoán
// dùng lại đúng một chỗ dựng cho mọi dạng bài telc. Sau khi kiểm tra, `review` tô đúng/sai từng câu.

import type { ReactNode } from 'react'
import { Pressable, TextInput, View } from 'react-native'
import { Check, Flag, X } from 'lucide-react-native'
import { radius, space, useTheme } from '@/lib/theme'
import { Caption, Card, Icon, SelectableRow, ThemedText } from '@/components/ui'
import { itemChoices, NONE_OF_THEM, type ExamObjGroup, type ExamObjItem, type ExamWritingTask } from '@/lib/examApi'
import type { PracticeItemResult } from '@/lib/telcPracticeApi'
import { TeilStrategyCard } from './TeilStrategyCard'
import { ExamAudio } from './ExamAudio'
import { assignTeilVoices } from '@/lib/hoerenVoices'
import { HoerenGate, type HoerenGatePhase } from './HoerenGate'
import { TelcGapText } from './TelcGapText'
import { ReadingPassage } from './ReadingPassage'
import { AdPosterCard } from './AdPosterCard'

interface ObjGroupViewProps {
  group: ExamObjGroup
  section: string
  format?: string
  level?: string
  answers: Record<string, string>
  onAnswer: (itemId: string, value: string) => void
  /** Pha cổng nghi thức nghe (đề telc). Không truyền ⇒ Teil không có cổng. */
  gatePhase?: HoerenGatePhase
  onGatePhaseChange?: (phase: HoerenGatePhase) => void
  /** Kết quả đã kiểm tra theo id câu: khoá lựa chọn, tô đúng/sai, hiện giải thích. */
  review?: Map<string, PracticeItemResult>
  /** Sau khi kiểm tra: nghe lại không giới hạn (như web). */
  unlimitedPlays?: boolean
  /** Ẩn thẻ chiến thuật (bài chẩn đoán làm như thi thật). */
  hideStrategy?: boolean
  /** Thi thử: câu đã "đánh dấu xem lại" (chung với web). Không truyền ⇒ không có nút cờ. */
  flags?: readonly string[]
  onToggleFlag?: (itemId: string) => void
  /** Vị trí từng câu trong Teil (để nhảy tới câu đánh dấu). */
  onItemLayout?: (itemId: string, y: number) => void
  /** Bài đọc dựng sẵn thay cho bài đọc mặc định (luyện Teil: bài đọc có bút đánh dấu). */
  passageOverride?: ReactNode
  /** Phần thêm cuối thẻ từng câu (luyện Teil: "Vì sao tôi chọn", "Hỏi AI về câu này"). */
  renderItemExtra?: (item: ExamObjItem) => ReactNode
}

export function ObjGroupView({
  group,
  section,
  format,
  level,
  answers,
  onAnswer,
  gatePhase,
  onGatePhaseChange,
  review,
  unlimitedPlays = false,
  hideStrategy = false,
  flags,
  onToggleFlag,
  onItemLayout,
  passageOverride,
  renderItemExtra,
}: ObjGroupViewProps) {
  const c = useTheme().colors
  const phase = review ? 'ready' : gatePhase
  const audioLocked = phase !== undefined && phase !== 'ready'
  // Chưa bấm bắt đầu thì câu hỏi còn ẩn — cho đọc trước là vô hiệu hoá thời gian đọc của đề thật.
  const hideBody = phase === 'idle'
  const plays = unlimitedPlays ? undefined : group.maxPlays
  // Mỗi nhân vật một giọng, chia một lần cho cả Teil như web — người dẫn một giọng cố định cho cả đề.
  // Tính thẳng (vài chục dòng, một hash) — không dùng hook để test dựng cây bằng cách gọi hàm vẫn chạy.
  const teilVoices = assignTeilVoices(group.audio, group.items.map((it) => it.audio))
  return (
    <View style={{ gap: space[3] }}>
      <Caption>{group.title}</Caption>
      {hideStrategy ? null : <TeilStrategyCard provider={format} level={level} section={section} teil={group.teilNo} />}
      {group.instruction ? (
        <ThemedText variant="body" color="secondary">
          {group.instruction}
        </ThemedText>
      ) : null}

      {group.ansage && !review && onGatePhaseChange ? (
        <HoerenGate
          title={group.title}
          ansage={group.ansage}
          readingSeconds={group.readingSeconds ?? 0}
          framing={group.framing}
          phase={gatePhase ?? 'idle'}
          onPhaseChange={onGatePhaseChange}
        />
      ) : null}

      {!hideBody && group.audio ? <ExamAudio script={group.audio} label={group.title} maxPlays={plays} locked={audioLocked} voices={teilVoices.group} /> : null}

      {/* Kho lựa chọn dùng chung cả Teil — in một lần ở đầu như đề giấy. */}
      {/* Lesen Teil 3: mẩu rao vặt dựng như tờ dán bảng tin, sáu kiểu luân phiên (Đợt 7a). */}
      {group.pool && group.telcType === 'MATCH_AD_X' ? (
        <View style={{ gap: space[3] }}>
          <Caption>Các mẩu rao vặt · mỗi mẩu chỉ dùng một lần</Caption>
          {group.pool.map((opt, i) => (
            <AdPosterCard key={opt.key} letter={opt.key} label={opt.label} index={i} />
          ))}
        </View>
      ) : null}

      {group.pool && group.telcType === 'MATCH_HEADLINE' ? (
        <View style={{ gap: space[2], backgroundColor: c.surfaceSunken, borderRadius: radius.md, padding: space[3] }}>
          <Caption>Các tiêu đề</Caption>
          {group.pool.map((opt) => (
            <ThemedText key={opt.key} variant="body" color="secondary" accessibilityLanguage="de-DE">
              {opt.key}. {opt.label}
            </ThemedText>
          ))}
          <Caption>Mỗi lựa chọn chỉ dùng một lần.</Caption>
        </View>
      ) : null}

      {group.stimulusAd ? (
        <View style={{ gap: space[1], borderWidth: 1.5, borderColor: c.borderStrong, borderRadius: radius.md, padding: space[3] }}>
          <Caption>Mẩu tin mà bức thư trả lời</Caption>
          <ThemedText variant="body" accessibilityLanguage="de-DE">{group.stimulusAd}</ThemedText>
        </View>
      ) : null}

      {group.gappedText ? (
        <TelcGapText text={group.gappedText} items={group.items} answers={answers} showWord={group.telcType === 'GAP_WORDBANK'} />
      ) : null}

      {passageOverride ? (
        passageOverride
      ) : group.passage ? (
        group.passageLines || group.vorspann || group.glossary || group.quelle ? (
          <ReadingPassage
            title={group.passageTitle}
            vorspann={group.vorspann}
            body={group.passage}
            numbered={group.passageLines === true}
            glossary={group.glossary}
            quelle={group.quelle}
          />
        ) : (
          <View style={{ gap: space[2], backgroundColor: c.surfaceSunken, borderRadius: radius.md, padding: space[3] }}>
            <Caption>Bài đọc</Caption>
            <ThemedText variant="body" color="secondary" accessibilityLanguage="de-DE">
              {group.passage}
            </ThemedText>
          </View>
        )
      ) : null}

      {group.examples ? (
        <View style={{ gap: space[2], borderWidth: 1, borderStyle: 'dashed', borderColor: c.border, borderRadius: radius.md, padding: space[3] }}>
          <Caption>Ví dụ (Beispiele)</Caption>
          {group.examples.map((ex, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: space[2], alignItems: 'flex-start' }}>
              <ThemedText variant="caption" color="faint">{ex.label ?? `0${i + 1}`}</ThemedText>
              <ThemedText variant="body" color="secondary" style={{ flex: 1 }}>{ex.situation}</ThemedText>
              <ThemedText variant="bodyStrong">{ex.answer === NONE_OF_THEM ? 'không' : ex.answer}</ThemedText>
            </View>
          ))}
        </View>
      ) : null}

      {!hideBody &&
        group.items.map((item, idx) => (
          <View key={item.id} style={{ gap: space[2] }} onLayout={onItemLayout ? (e) => onItemLayout(item.id, e.nativeEvent.layout.y) : undefined}>
            {item.audio ? <ExamAudio script={item.audio} label={item.question} maxPlays={plays} locked={audioLocked} compact voices={teilVoices.items[idx]} /> : null}
            <QuestionCard
              item={item}
              group={group}
              answers={answers}
              selected={answers[item.id]}
              onSelect={(val) => onAnswer(item.id, val)}
              result={review?.get(item.id)}
              reviewing={!!review}
              flagged={flags ? flags.includes(item.id) : undefined}
              onToggleFlag={onToggleFlag ? () => onToggleFlag(item.id) : undefined}
              extra={renderItemExtra?.(item)}
            />
          </View>
        ))}
    </View>
  )
}

export function WritingTaskView({
  task,
  section,
  format,
  level,
  value,
  onChange,
  editable = true,
  hideStrategy = false,
  checkedPoints,
  onTogglePoint,
}: {
  task: ExamWritingTask
  section: string
  format?: string
  level?: string
  value: string
  onChange: (text: string) => void
  editable?: boolean
  hideStrategy?: boolean
  /** Ý (Leitpunkt) học viên đã đánh dấu là viết xong — chỉ lưu trên máy. */
  checkedPoints?: readonly string[]
  /** Có thì mỗi ý là một ô đánh dấu (luyện Teil); không thì in ý như tờ đề. */
  onTogglePoint?: (point: string) => void
}) {
  const c = useTheme().colors
  const words = value.trim().split(/\s+/).filter(Boolean).length
  return (
    <Card style={{ gap: space[3] }}>
      {task.instruction ? <ThemedText variant="title">{task.instruction}</ThemedText> : null}
      {hideStrategy ? null : <TeilStrategyCard provider={format} level={level} section={section} teil={task.teil} />}
      {/* Đề telc in nguyên văn E-Mail của bạn (Von/Betreff/thân thư); có nó thì dòng prompt là thừa. */}
      {task.stimulus ? (
        <View style={{ gap: space[2], borderWidth: 1.5, borderColor: c.borderStrong, borderRadius: radius.md, padding: space[3] }}>
          <Caption>
            {task.stimulus.type === 'AD' ? 'Mẩu tin mà bài viết trả lời' : task.stimulus.type === 'LETTER' ? 'Thư bạn nhận được' : 'E-Mail bạn nhận được'}
          </Caption>
          {task.stimulus.from ? (
            <ThemedText variant="body">
              <ThemedText variant="body" color="secondary">Từ: </ThemedText>
              {task.stimulus.from}
            </ThemedText>
          ) : null}
          {task.stimulus.subject ? (
            <ThemedText variant="body">
              <ThemedText variant="body" color="secondary">Chủ đề: </ThemedText>
              {task.stimulus.subject}
            </ThemedText>
          ) : null}
          <ThemedText variant="body" accessibilityLanguage="de-DE">{task.stimulus.body}</ThemedText>
        </View>
      ) : task.prompt ? (
        <View style={{ gap: space[2], backgroundColor: c.surfaceSunken, borderRadius: radius.md, padding: space[3] }}>
          <ThemedText variant="body" color="secondary">{task.prompt}</ThemedText>
        </View>
      ) : null}
      {task.points && onTogglePoint ? (
        <LeitpunktChecklist points={task.points} checked={checkedPoints ?? []} onToggle={onTogglePoint} />
      ) : (
        task.points?.map((pt, i) => (
          <ThemedText key={i} variant="body" color="secondary" accessibilityLanguage="de-DE">
            P{i + 1}. {pt}
          </ThemedText>
        ))
      )}
      <TextInput
        multiline
        editable={editable}
        value={value}
        onChangeText={onChange}
        placeholder="Viết bài của bạn ở đây…"
        placeholderTextColor={c.textFaint}
        accessibilityLabel="Bài viết"
        autoCorrect={false}
        style={{
          minHeight: 180,
          borderWidth: 1,
          borderColor: c.border,
          borderRadius: radius.sm,
          padding: space[3],
          color: c.textPrimary,
          textAlignVertical: 'top',
        }}
      />
      <Caption>{words} từ</Caption>
    </Card>
  )
}

/** Các ý bắt buộc của bài Viết thành ô đánh dấu "đã viết" (mẫu iOS `writing`). */
function LeitpunktChecklist({ points, checked, onToggle }: { points: string[]; checked: readonly string[]; onToggle: (point: string) => void }) {
  const c = useTheme().colors
  const done = points.filter((p) => checked.includes(p)).length
  return (
    <View style={{ gap: space[2] }}>
      <Caption>{`Viết xong ý nào thì đánh dấu ý đó · ${done}/${points.length}`}</Caption>
      {points.map((pt, i) => {
        const on = checked.includes(pt)
        return (
          <Pressable
            key={`${i}-${pt}`}
            accessibilityRole="checkbox"
            accessibilityLabel={pt}
            accessibilityLanguage="de-DE"
            accessibilityState={{ checked: on }}
            onPress={() => onToggle(pt)}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: space[3],
              minHeight: 44,
              paddingHorizontal: space[3],
              paddingVertical: space[2],
              borderRadius: radius.sm,
              borderWidth: 1.5,
              borderColor: on ? c.success : c.border,
              backgroundColor: pressed ? c.surfaceSunken : c.surface,
            })}
          >
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                borderWidth: 1.5,
                borderColor: on ? c.success : c.borderStrong,
                backgroundColor: on ? c.success : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {on ? <Icon icon={Check} size={14} color="onInk" strokeWidth={3} /> : null}
            </View>
            <ThemedText variant="bodyStrong" style={{ flex: 1 }} accessibilityLanguage="de-DE">{pt}</ThemedText>
          </Pressable>
        )
      })}
    </View>
  )
}

function QuestionCard({
  item,
  group,
  answers,
  selected,
  onSelect,
  result,
  reviewing = false,
  flagged,
  onToggleFlag,
  extra,
}: {
  item: ExamObjItem
  /** Teil chứa câu này — cần cho luật "mỗi lựa chọn một lần" của đề telc. */
  group?: ExamObjGroup
  answers?: Record<string, string>
  selected?: string
  onSelect: (val: string) => void
  result?: PracticeItemResult
  /** Đang xem kết quả: không chọn lại được, nhưng không làm mờ hay đọc "(đã dùng)". */
  reviewing?: boolean
  /** Thi thử: câu có cờ "xem lại"; `undefined` ⇒ không có nút cờ. */
  flagged?: boolean
  onToggleFlag?: () => void
  extra?: ReactNode
}) {
  const { colors } = useTheme()
  // Giá trị nộp tách khỏi nhãn: trắc nghiệm options object nộp chữ cái A/B/C (AC-MOBFIX-03).
  const choices = itemChoices(item)

  // telc: lựa chọn đã bị câu KHÁC trong cùng Teil chiếm thì khoá lại — nhưng VẪN HIỆN, vì ẩn đi
  // là học viên mất dấu thứ tự a–l để đối chiếu với danh sách in ở đầu Teil. Đáp án `x` ("không
  // mẩu nào hợp") không bao giờ bị khoá: nhiều tình huống cùng có thể không hợp mẩu nào.
  const used = new Set<string>()
  if (group?.singleUse && answers) {
    for (const other of group.items) {
      if (other.id === item.id) continue
      const picked = answers[other.id]
      if (picked && picked !== NONE_OF_THEM) used.add(picked)
    }
  }
  const allChoices = group?.allowNone ? [...choices, { value: NONE_OF_THEM, label: 'không mẩu nào hợp' }] : choices
  const same = (a?: string | null, b?: string | null) => (a ?? '').toLowerCase() === (b ?? '').toLowerCase()
  return (
    <Card style={{ gap: space[4], borderColor: result ? (result.isCorrect ? colors.success : colors.danger) : colors.border }}>
      {item.passage ? (
        <View style={{ gap: space[2], backgroundColor: colors.surfaceSunken, borderRadius: radius.md, padding: space[3] }}>
          <Caption>Đoạn văn</Caption>
          <ThemedText variant="body" color="secondary" accessibilityLanguage="de-DE">
            {item.passage}
          </ThemedText>
        </View>
      ) : null}
      {onToggleFlag ? (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[2] }}>
          <ThemedText variant="title" accessibilityLanguage="de-DE" style={{ flex: 1 }}>{item.question}</ThemedText>
          <FlagToggle on={!!flagged} onPress={onToggleFlag} />
        </View>
      ) : (
        <ThemedText variant="title" accessibilityLanguage="de-DE">{item.question}</ThemedText>
      )}
      <View style={{ gap: space[2] }}>
        {allChoices.map((choice) => {
          const mark = result ? (same(choice.value, result.correct) ? 'right' : same(choice.value, result.given) ? 'wrong' : null) : null
          return (
            <Choice
              key={choice.value}
              label={choice.label}
              german={choice.value !== NONE_OF_THEM}
              active={selected === choice.value}
              locked={!reviewing && used.has(choice.value) && selected !== choice.value}
              reviewing={reviewing}
              mark={mark}
              onPress={() => onSelect(choice.value)}
            />
          )
        })}
      </View>
      {result ? <ItemExplanation result={result} /> : null}
      {extra}
    </Card>
  )
}

/** Phân tích một câu sau khi kiểm tra (như web): vì sao đúng, vì sao sai, bẫy, bằng chứng trong bài. */
function ItemExplanation({ result }: { result: PracticeItemResult }) {
  const c = useTheme().colors
  const lines: { label: string; text: string }[] = []
  if (!result.isCorrect && result.whyWrong) lines.push({ label: 'Vì sao chưa đúng', text: result.whyWrong })
  if (result.whyRight) lines.push({ label: 'Vì sao đáp án đúng', text: result.whyRight })
  if (result.trap) lines.push({ label: 'Bẫy của câu', text: result.trap })
  if (result.rule) lines.push({ label: 'Quy tắc', text: result.rule })
  return (
    <View style={{ gap: space[2], backgroundColor: c.surfaceSunken, borderRadius: radius.md, padding: space[3] }}>
      <ThemedText variant="label" style={{ color: result.isCorrect ? c.success : c.danger }}>
        {result.isCorrect ? 'Đúng' : result.answered ? `Sai · đáp án đúng: ${result.correctText ?? result.correct}` : `Chưa trả lời · đáp án: ${result.correctText ?? result.correct}`}
      </ThemedText>
      {lines.map((l) => (
        <View key={l.label} style={{ gap: 2 }}>
          <Caption>{l.label}</Caption>
          <ThemedText variant="body" color="secondary">{l.text}</ThemedText>
        </View>
      ))}
      {result.evidence.length > 0 ? (
        <View style={{ gap: 2 }}>
          <Caption>Bằng chứng trong bài</Caption>
          {result.evidence.map((e, i) => (
            <ThemedText key={i} variant="body" accessibilityLanguage="de-DE" style={{ backgroundColor: c.accentSoft }}>
              „{e}“
            </ThemedText>
          ))}
        </View>
      ) : null}
    </View>
  )
}

function Choice({
  label,
  active,
  locked = false,
  mark = null,
  reviewing = false,
  german = true,
  onPress,
}: {
  label: string
  /** Nhãn tiếng Đức (đọc bằng giọng Đức); "không mẩu nào hợp" là tiếng Việt. */
  german?: boolean
  active: boolean
  locked?: boolean
  reviewing?: boolean
  /** Sau khi kiểm tra: `right` = đáp án đúng, `wrong` = lựa chọn sai của học viên. */
  mark?: 'right' | 'wrong' | null
  onPress: () => void
}) {
  const { colors } = useTheme()
  const reviewed = mark !== null
  const blocked = locked || reviewing
  const border = mark === 'right' ? colors.success : mark === 'wrong' ? colors.danger : active ? colors.accent : colors.border
  const bg = mark === 'right' ? colors.successSoft : mark === 'wrong' ? colors.dangerSoft : active ? colors.accentSoft : colors.surface
  const suffix = mark === 'right' ? ' (đáp án đúng)' : mark === 'wrong' ? ' (bạn chọn, chưa đúng)' : locked && !active ? ' (đã dùng)' : ''
  return (
    <SelectableRow
      role="radio"
      label={`${label}${suffix}`}
      selected={active}
      disabled={blocked}
      onPress={blocked ? () => {} : onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[3],
        borderWidth: active || reviewed ? 2 : 1,
        borderColor: border,
        backgroundColor: bg,
        borderRadius: radius.sm,
        paddingHorizontal: space[4],
        // Compensate the +1px active border so rows don't shift height.
        paddingVertical: active || reviewed ? space[4] - 1 : space[4],
        // `SelectableRow` chỉ chặn thao tác và khai trợ năng; dấu hiệu NHÌN THẤY phải do đây đặt,
        // bằng không lựa chọn đã khoá trông y hệt lựa chọn còn bấm được. Lúc xem kết quả thì không mờ.
        opacity: locked && !active ? 0.45 : 1,
      }}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: radius.full,
          borderWidth: 2,
          borderColor: mark ? border : active ? colors.accent : colors.borderStrong,
          backgroundColor: mark ? border : active ? colors.accent : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {mark === 'wrong' ? (
          <Icon icon={X} size={13} color="onAccent" strokeWidth={3} />
        ) : mark === 'right' || active ? (
          <Icon icon={Check} size={13} color="onAccent" strokeWidth={3} />
        ) : null}
      </View>
      <ThemedText variant={active ? 'bodyStrong' : 'body'} color={active ? 'primary' : 'secondary'} style={{ flex: 1 }} accessibilityLanguage={german ? 'de-DE' : undefined}>
        {label}
      </ThemedText>
    </SelectableRow>
  )
}

/** Cờ "đánh dấu xem lại" của một câu thi thử (mẫu `mockrun`): bật thì nền vàng nhạt, viền cam. */
function FlagToggle({ on, onPress }: { on: boolean; onPress: () => void }) {
  const { colors } = useTheme()
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={on ? 'Bỏ đánh dấu xem lại' : 'Đánh dấu xem lại'}
      accessibilityState={{ selected: on }}
      hitSlop={4}
      style={({ pressed }) => ({
        width: 36,
        height: 36,
        borderRadius: radius.md,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: on ? 2 : 1,
        borderColor: on ? colors.orange : colors.border,
        backgroundColor: on ? colors.accentSoft : colors.surface,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Icon icon={Flag} size={18} color={on ? 'primary' : 'muted'} />
    </Pressable>
  )
}
