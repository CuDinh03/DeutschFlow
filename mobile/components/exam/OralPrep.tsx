// Phòng chuẩn bị thi nói (mẫu v3.4 `oralprep`, Đợt 5 phần B, 19/11/2026): thứ tự thi, chọn chủ đề,
// ghi chú nháp tự lưu khi ngừng gõ, vào thi sớm. Hết giờ chuẩn bị thì phòng thi tự vào (server).

import { Pressable, TextInput, View } from 'react-native'
import { radius, space, useTheme } from '@/lib/theme'
import { Button, ThemedText, YellowSquare } from '@/components/ui'
import { TeilStrategyCard } from '@/components/exam/TeilStrategyCard'
import type { BlueprintPartSummary, ExamSessionView } from '@/lib/examSpeakingApi'
import { stimulusDisplay } from '@/lib/examSpeakingUi'
import { partMinutes } from '@/lib/oralRoom'

export type NotesSaveState = 'idle' | 'saving' | 'saved' | 'error'

export function OralPrep({
  session,
  parts,
  notes,
  onChangeNotes,
  notesState,
  busy,
  onChoose,
  onEnter,
}: {
  session: ExamSessionView
  parts: readonly BlueprintPartSummary[]
  notes: string
  onChangeNotes: (text: string) => void
  notesState: NotesSaveState
  busy: boolean
  onChoose: (teilNo: number, index: number) => void
  onEnter: () => void
}) {
  const c = useTheme().colors
  const materials = session.prepMaterials ?? []
  const missingChoice = materials.some((m) => m.choiceRequired && m.chosenIndex == null)
  const notesHint =
    notesState === 'saving' ? 'Đang lưu…'
    : notesState === 'saved' ? 'Đã lưu. Trong lúc thi bạn xem lại được ghi chú này.'
    : notesState === 'error' ? 'Chưa lưu được, sẽ thử lại khi bạn gõ tiếp.'
    : 'Tự lưu khi bạn ngừng gõ. Trong lúc thi bạn xem lại được ghi chú này.'

  return (
    <View style={{ gap: space[5] }}>
      {parts.length > 0 && (
        <View style={{ gap: space[2] }}>
          <ThemedText variant="label" color="muted">Thứ tự thi</ThemedText>
          <View style={{ borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface }}>
            {parts.map((p, i) => (
              <View
                key={p.teilNo}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: space[3], paddingHorizontal: space[4], paddingVertical: space[3],
                  borderTopWidth: i === 0 ? 0 : 1, borderTopColor: c.border,
                }}
              >
                <ThemedText variant="bodyStrong" style={{ width: 56 }}>{`Teil ${p.teilNo}`}</ThemedText>
                <ThemedText variant="body" style={{ flex: 1 }} numberOfLines={2}>{p.title}</ThemedText>
                <ThemedText variant="caption" color="muted">{`${partMinutes(p.durationSec)} phút`}</ThemedText>
              </View>
            ))}
          </View>
        </View>
      )}

      {materials.map((m) => (
        <View key={m.teilNo} style={{ gap: space[2] }}>
          <ThemedText variant="label" color="muted">
            {m.choiceRequired ? `Teil ${m.teilNo} · chọn một chủ đề` : `Teil ${m.teilNo} · ${m.title}`}
          </ThemedText>
          <TeilStrategyCard provider={session.provider} level={session.level} section="SPRECHEN" teil={m.teilNo} />
          <View style={{ gap: space[2] }} accessibilityRole={m.choiceRequired ? 'radiogroup' : undefined}>
            {m.stimuli.map((s, idx) => {
              const disp = stimulusDisplay(s)
              const chosen = m.chosenIndex === idx
              const body = (
                <View style={{ flex: 1, gap: 2 }}>
                  {disp.headline ? <ThemedText variant="bodyStrong">{disp.headline}</ThemedText> : null}
                  {disp.lines.slice(0, 2).map((ln, li) => (
                    <ThemedText key={`l${li}`} variant="caption" color="secondary" numberOfLines={3}>{ln}</ThemedText>
                  ))}
                  {!m.choiceRequired && disp.bullets.slice(0, 6).map((b, bi) => (
                    <View key={`b${bi}`} style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
                      <YellowSquare size={5} />
                      <ThemedText variant="caption" color="secondary" style={{ flex: 1 }}>{b}</ThemedText>
                    </View>
                  ))}
                </View>
              )
              const rowStyle = {
                flexDirection: 'row' as const, alignItems: 'center' as const, gap: space[3], padding: space[3] + 2,
                borderRadius: radius.md, borderWidth: chosen ? 2 : 1,
                borderColor: chosen ? c.textPrimary : c.border, backgroundColor: chosen ? c.accentSoft : c.surface,
              }
              if (!m.choiceRequired) return <View key={idx} style={rowStyle}>{body}</View>
              return (
                <Pressable
                  key={idx}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: chosen, disabled: busy }}
                  accessibilityLabel={disp.headline ?? `Chủ đề ${idx + 1}`}
                  onPress={() => onChoose(m.teilNo, idx)}
                  disabled={busy}
                  style={rowStyle}
                >
                  {body}
                  <View
                    style={{
                      width: 22, height: 22, borderRadius: 11, borderWidth: 2,
                      borderColor: chosen ? c.textPrimary : c.borderStrong, alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    {chosen ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.textPrimary }} /> : null}
                  </View>
                </Pressable>
              )
            })}
          </View>
        </View>
      ))}

      <View style={{ gap: space[2] }}>
        <ThemedText variant="label" color="muted">Ghi chú nháp (chỉ bạn thấy)</ThemedText>
        <TextInput
          value={notes}
          onChangeText={onChangeNotes}
          placeholder="Gạch ý cho bài nói…"
          placeholderTextColor={c.textFaint}
          multiline
          accessibilityLabel="Ghi chú nháp"
          autoCapitalize="none"
          autoCorrect={false}
          style={{
            minHeight: 120, padding: space[3], borderRadius: radius.md, borderWidth: 1, borderColor: c.borderStrong,
            backgroundColor: c.surface, color: c.textPrimary, fontSize: 16, lineHeight: 22, textAlignVertical: 'top',
          }}
        />
        <ThemedText variant="caption" color={notesState === 'error' ? 'danger' : 'muted'}>{notesHint}</ThemedText>
      </View>

      <View style={{ gap: space[2] }}>
        <Button label={busy ? 'Đang vào…' : 'Vào thi ngay'} onPress={onEnter} loading={busy} disabled={missingChoice || busy} />
        <ThemedText variant="caption" color="muted" align="center">
          {missingChoice ? 'Chọn chủ đề trước khi vào thi.' : 'Hết giờ chuẩn bị sẽ tự vào thi.'}
        </ThemedText>
      </View>
    </View>
  )
}
