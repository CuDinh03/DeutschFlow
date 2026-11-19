// Tab Luyện nói · Phỏng vấn theo nghề (giao diện v3.4, Đợt 5, 19/11/2026; mẫu `interview`).
// Gương web `OccupationInterviewCard` + khối chọn nghề trên trang chủ: ô tìm nghề, chip nghề đã có người
// phỏng vấn, thẻ người phỏng vấn kèm câu hỏi tiêu biểu, lối sang Luyện nói tự do, buổi gần đây có điểm /10.
// Mức lấy theo hồ sơ (trước 19/11 màn chọn người phỏng vấn ép C1 — lỗi, owner chốt 18/11).

import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Image, Pressable, ScrollView, TextInput, View, type ImageSourcePropType } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight, Search, X } from 'lucide-react-native'
import { radius, space, useTheme } from '@/lib/theme'
import { Button, Card, GaGlyph, Icon, Skeleton, ThemedText, useTabBarClearance } from '@/components/ui'
import { PersonaBubbleAvatar } from '@/components/speaking/PersonaBubbleAvatar'
import { fetchOccupationInterviewInfo, fetchOccupations, occupationName, searchOccupations, type OccupationSummary } from '@/lib/occupations'
import { WORKPLACE_INTERVIEWERS, isWorkplaceInterviewerId, resolveStagePersona } from '@/lib/workplaceInterviewers'
import { PERSONA_TOKENS } from '@/lib/personas'
import { speakingApi } from '@/lib/speakingApi'
import { defaultOccupationCode, formatScore10, occupationChips, recentInterviews, typicalQuestion } from '@/lib/interviewHub'
import type { StartArgs } from '@/components/speaking/CompanionSelect'

// Ảnh 3D người phỏng vấn lấy từ trang công khai của web (`frontend/src/assets/public-v3`); người khác vẽ SVG.
const PORTRAITS: Partial<Record<string, ImageSourcePropType>> = {
  krueger: require('@/assets/interviewers/krueger-pflege-3d.jpg'),
  klaus: require('@/assets/interviewers/klaus-kueche-3d.jpg'),
}

const EXPERIENCE: { id: string; label: string }[] = [
  { id: '0-6M', label: 'Dưới 6 tháng' },
  { id: '1-2Y', label: '1–2 năm' },
  { id: '3Y', label: '3 năm' },
  { id: '5Y', label: '5+ năm' },
]

export const OCCUPATIONS_QUERY_KEY = ['public-occupations'] as const

function interviewerOf(personaCode: string | null | undefined) {
  const id = resolveStagePersona(personaCode)
  const who = isWorkplaceInterviewerId(id) ? WORKPLACE_INTERVIEWERS[id] : PERSONA_TOKENS[id]
  return { id, name: who.name, role: who.role, accent: who.accent }
}

interface InterviewHubProps {
  cefr: string
  profileOccupation: string | null
  starting: boolean
  /** Phiếu của buổi cũ đang tải: vòng xoay ở dòng đó, khoá nút Bắt đầu. */
  loadingReportId: number | null
  /** Nghề đã chọn (giữ ở màn cha để đổi nhánh Phỏng vấn ↔ Nói tự do không mất lựa chọn). */
  picked: string | null
  onPick: (code: string) => void
  onStart: (args: StartArgs) => void
  onFreeTalk: () => void
  onOpenReport: (sessionId: number) => void
}

export function InterviewHub({ cefr, profileOccupation, starting, loadingReportId, picked, onPick, onStart, onFreeTalk, onOpenReport }: InterviewHubProps) {
  const c = useTheme().colors
  const tabClearance = useTabBarClearance(space[6])
  const occupations = useQuery({ queryKey: OCCUPATIONS_QUERY_KEY, queryFn: fetchOccupations, staleTime: 600_000 })
  // API không lọc theo chế độ: lấy rộng để người nói tự do nhiều vẫn thấy buổi phỏng vấn gần đây.
  const recent = useQuery({ queryKey: ['ai-speaking-sessions', 'recent-interviews'], queryFn: () => speakingApi.listSessions(40), staleTime: 60_000 })
  const all = useMemo(() => occupations.data ?? [], [occupations.data])

  const [query, setQuery] = useState('')
  // Danh mục tải lỗi/chưa có mà hồ sơ đã có nghề ⇒ vẫn mở thẻ người phỏng vấn của nghề đó.
  const selectedCode = picked ?? (all.length ? defaultOccupationCode(all, profileOccupation) : profileOccupation)
  const chips = useMemo(() => occupationChips(all, selectedCode), [all, selectedCode])
  const results = useMemo(() => (query.trim() ? searchOccupations(all, query, 6) : []), [all, query])
  const recentRows = useMemo(() => recentInterviews(recent.data ?? [], new Date()), [recent.data])

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: space[5], paddingBottom: tabClearance }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <ThemedText variant="label" color="muted" style={{ marginTop: space[5], letterSpacing: 1, textTransform: 'uppercase' }}>
        Phỏng vấn theo nghề
      </ThemedText>
      <View style={{ marginTop: space[2] }} accessible accessibilityRole="header" accessibilityLabel="Bạn làm nghề gì?">
        <ThemedText variant="display">Bạn làm</ThemedText>
        <BrushMark>nghề gì?</BrushMark>
      </View>
      <ThemedText variant="body" color="secondary" style={{ marginTop: space[2] }}>
        AI đóng vai nhà tuyển dụng Đức, hỏi đúng nghề bạn chọn và chỉ ra lỗi sau mỗi câu trả lời.
      </ThemedText>

      <View
        style={{
          marginTop: space[4],
          flexDirection: 'row',
          alignItems: 'center',
          gap: space[2],
          height: 48,
          paddingHorizontal: space[3],
          borderRadius: radius.md,
          backgroundColor: c.surface,
          borderWidth: 1,
          borderColor: c.borderStrong,
        }}
      >
        <Icon icon={Search} size={18} color="muted" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Ví dụ: đầu bếp, Kellner…"
          placeholderTextColor={c.textFaint}
          accessibilityLabel="Tìm nghề"
          autoCorrect={false}
          returnKeyType="search"
          style={{ flex: 1, color: c.textPrimary, fontSize: 15 }}
        />
        {query ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Xoá ô tìm" hitSlop={10} onPress={() => setQuery('')}>
            <Icon icon={X} size={16} color="muted" />
          </Pressable>
        ) : null}
      </View>

      {query.trim() ? (
        <Card style={{ marginTop: space[2], paddingVertical: space[1], paddingHorizontal: 0 }}>
          {results.length === 0 ? (
            <ThemedText variant="body" color="muted" style={{ padding: space[3] }}>
              {occupations.isLoading ? 'Đang tải danh sách nghề…' : 'Chưa có nghề này. Thử gõ tên tiếng Đức hoặc tên gần giống.'}
            </ThemedText>
          ) : (
            results.map((o) => (
              <OccupationRow
                key={o.code}
                occupation={o}
                onPress={() => {
                  onPick(o.code)
                  setQuery('')
                }}
              />
            ))
          )}
        </Card>
      ) : null}

      {occupations.isLoading ? (
        <Skeleton height={36} radius="full" style={{ marginTop: space[3] }} />
      ) : occupations.isError ? (
        <Pressable accessibilityRole="button" onPress={() => void occupations.refetch()} style={{ marginTop: space[3] }}>
          <ThemedText variant="caption" color="danger">Chưa tải được danh sách nghề. Chạm để thử lại.</ThemedText>
        </Pressable>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: space[3], marginHorizontal: -space[5] }} contentContainerStyle={{ paddingHorizontal: space[5], gap: space[2] }}>
          {chips.map((o) => {
            const on = o.code === selectedCode
            return (
              <Pressable
                key={o.code}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLanguage="de-DE"
                onPress={() => onPick(o.code)}
                style={{
                  height: 36,
                  paddingHorizontal: space[3],
                  justifyContent: 'center',
                  borderRadius: radius.full,
                  backgroundColor: on ? c.textPrimary : c.surfaceSunken,
                  borderWidth: 1,
                  borderColor: on ? c.textPrimary : c.border,
                }}
              >
                <ThemedText variant="label" style={{ color: on ? c.bg : c.textSecondary }}>{o.nameDe}</ThemedText>
              </Pressable>
            )
          })}
        </ScrollView>
      )}

      {selectedCode ? (
        <InterviewerCard key={selectedCode} code={selectedCode} cefr={cefr} starting={starting} disabled={loadingReportId !== null} onStart={onStart} />
      ) : null}

      <Pressable accessibilityRole="button" onPress={onFreeTalk} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1, marginTop: space[3] })}>
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], padding: space[3] }}>
          <View style={{ width: 44, height: 44, borderRadius: radius.md, backgroundColor: c.surfaceSunken, alignItems: 'center', justifyContent: 'center' }}>
            <GaGlyph name="hoithoai" size={24} />
          </View>
          <View style={{ flex: 1 }}>
            <ThemedText variant="bodyStrong">Luyện nói tự do với AI</ThemedText>
            <ThemedText variant="caption" color="muted">Hội thoại đời sống, chọn người đồng hành</ThemedText>
          </View>
          <Icon icon={ChevronRight} size={18} color="faint" />
        </Card>
      </Pressable>

      {recentRows.length > 0 ? (
        <View style={{ marginTop: space[6] }}>
          <ThemedText variant="title" style={{ marginBottom: space[2] }}>Buổi gần đây</ThemedText>
          <Card style={{ paddingVertical: 0, paddingHorizontal: 0 }}>
            {recentRows.map((r, i) => (
              <Pressable
                key={r.id}
                accessibilityRole="button"
                accessibilityLabel={`${r.title}${r.when ? `, ${r.when}` : ''}${r.score != null ? `, ${formatScore10(r.score)} trên 10` : ''}. Xem phiếu nhận xét`}
                accessibilityState={{ busy: loadingReportId === r.id, disabled: loadingReportId !== null }}
                disabled={loadingReportId !== null}
                onPress={() => onOpenReport(r.id)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space[3],
                  minHeight: 56,
                  paddingHorizontal: space[4],
                  paddingVertical: space[2],
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: c.border,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <View style={{ width: 36, height: 36, borderRadius: radius.sm, backgroundColor: c.surfaceSunken, alignItems: 'center', justifyContent: 'center' }}>
                  <GaGlyph name="phongvan" size={22} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <ThemedText variant="bodyStrong" numberOfLines={1} accessibilityLanguage="de-DE">
                    {r.title} · {interviewerOf(r.persona).name}
                  </ThemedText>
                  {r.when ? <ThemedText variant="caption" color="muted">{r.when}</ThemedText> : null}
                </View>
                {r.score != null ? <ThemedText variant="titleLg">{formatScore10(r.score)}</ThemedText> : null}
                {loadingReportId === r.id ? <ActivityIndicator size="small" color={c.textMuted} /> : <Icon icon={ChevronRight} size={18} color="faint" />}
              </Pressable>
            ))}
          </Card>
        </View>
      ) : null}
    </ScrollView>
  )
}

function OccupationRow({ occupation, onPress }: { occupation: OccupationSummary; onPress: () => void }) {
  const c = useTheme().colors
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({ paddingHorizontal: space[3], paddingVertical: space[2], backgroundColor: pressed ? c.surfaceSunken : 'transparent' })}
    >
      <ThemedText variant="bodyStrong" accessibilityLanguage="de-DE">{occupation.nameDe}</ThemedText>
      <ThemedText variant="caption" color="muted">{occupationName(occupation, 'vi')}</ThemedText>
    </Pressable>
  )
}

function InterviewerCard({ code, cefr, starting, disabled, onStart }: { code: string; cefr: string; starting: boolean; disabled: boolean; onStart: (args: StartArgs) => void }) {
  const c = useTheme().colors
  const [experience, setExperience] = useState('1-2Y')
  const [showVi, setShowVi] = useState(false)
  const info = useQuery({ queryKey: ['occupation-interview', code], queryFn: () => fetchOccupationInterviewInfo(code), staleTime: 600_000, retry: 1 })
  useEffect(() => setShowVi(false), [code])

  if (info.isLoading) return <Skeleton height={320} radius="lg" style={{ marginTop: space[4] }} />
  if (!info.data) {
    return (
      <Card style={{ marginTop: space[4], gap: space[2] }}>
        <ThemedText variant="body" color="muted">Chưa tải được người phỏng vấn của nghề này.</ThemedText>
        <Button label="Thử lại" variant="ghost" size="sm" onPress={() => void info.refetch()} />
      </Card>
    )
  }
  const data = info.data
  const who = interviewerOf(data.personaCode)
  const portrait = PORTRAITS[who.id]
  const question = typicalQuestion(data)

  return (
    <Card style={{ marginTop: space[4], padding: 0, overflow: 'hidden' }}>
      {portrait ? (
        <Image source={portrait} accessibilityIgnoresInvertColors style={{ width: '100%', height: 210 }} resizeMode="cover" />
      ) : (
        <View style={{ height: 150, alignItems: 'center', justifyContent: 'flex-end', backgroundColor: c.surfaceSunken }}>
          <PersonaBubbleAvatar personaId={who.id} size={96} ringColor={who.accent} paused />
        </View>
      )}
      <View style={{ padding: space[4], gap: space[3] }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[3] }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <ThemedText variant="title" accessibilityLanguage="de-DE">{who.name}</ThemedText>
            <ThemedText variant="caption" color="muted" numberOfLines={2}>
              <ThemedText variant="caption" color="muted" accessibilityLanguage="de-DE">{who.role}</ThemedText>
              {' · '}
              {occupationName(data.occupation, 'vi')}
            </ThemedText>
          </View>
          <View style={{ paddingHorizontal: space[2], paddingVertical: 4, borderRadius: radius.full, backgroundColor: c.accentSoft }}>
            <ThemedText variant="caption" style={{ color: c.accentText }}>Mức {cefr}</ThemedText>
          </View>
        </View>

        {question ? (
          <View style={{ gap: space[1] }}>
            <ThemedText variant="label" color="muted" style={{ letterSpacing: 1, textTransform: 'uppercase' }}>Câu hỏi tiêu biểu</ThemedText>
            <ThemedText variant="bodyLg" accessibilityLanguage="de-DE" style={{ fontFamily: 'Newsreader_500Medium', color: c.textSecondary }}>
              „{question.de}“
            </ThemedText>
            {question.vi ? (
              showVi ? (
                <ThemedText variant="caption" color="muted">{question.vi}</ThemedText>
              ) : (
                <Pressable accessibilityRole="button" hitSlop={8} onPress={() => setShowVi(true)}>
                  <ThemedText variant="label" style={{ color: c.der }}>Hiện bản dịch</ThemedText>
                </Pressable>
              )
            ) : null}
          </View>
        ) : null}

        <View style={{ gap: space[2] }}>
          <ThemedText variant="label" color="muted">Kinh nghiệm của bạn</ThemedText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
            {EXPERIENCE.map((e) => {
              const on = experience === e.id
              return (
                <Pressable
                  key={e.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  onPress={() => setExperience(e.id)}
                  style={{
                    paddingHorizontal: space[3],
                    paddingVertical: 6,
                    borderRadius: radius.full,
                    backgroundColor: on ? c.accentSoft : c.surfaceSunken,
                    borderWidth: 1,
                    borderColor: on ? c.accent : c.border,
                  }}
                >
                  <ThemedText variant="caption" style={{ color: on ? c.accentText : c.textSecondary }}>{e.label}</ThemedText>
                </Pressable>
              )
            })}
          </View>
        </View>

        <Button
          label="Bắt đầu phỏng vấn"
          loading={starting}
          disabled={disabled}
          onPress={() =>
            onStart({
              sessionMode: 'INTERVIEW',
              topic: data.interviewPosition,
              cefrLevel: cefr,
              experienceLevel: experience,
              occupationCode: code,
            })
          }
        />
      </View>
    </Card>
  )
}

/** Chữ có vệt bút dạ vàng phía dưới, như `.mark` của mẫu v3.4. */
function BrushMark({ children }: { children: string }) {
  const c = useTheme().colors
  return (
    <View style={{ alignSelf: 'flex-start' }}>
      <View
        pointerEvents="none"
        style={{ position: 'absolute', left: -2, right: -2, bottom: 4, height: '42%', borderRadius: 6, backgroundColor: c.accent, transform: [{ rotate: '-1deg' }] }}
      />
      <ThemedText variant="display">{children}</ThemedText>
    </View>
  )
}
